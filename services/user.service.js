// backend/services/user.service.js
const UserModel = require('../models/user.model');
const PointModel = require('../models/point.model');
const authUtils = require('../utils/auth.utils');
const db = require('../config/db');
const AppError = require('../utils/AppError');

const { deleteCloudinaryImage } = require('../utils/cloudinary');
const { DEFAULT_AVATAR_IMG, DEFAULT_COVER_IMG} = require('../config/constants');

class UserService {
    /**
     * Update user password (authenticated user with old password)
     * - Validate all inputs
     * - Verify old password matches
     * - Hash new password
     * - Update in database
     */
    async updatePassword(userId, oldPassword, newPassword, confirmPassword) {
        // Validate all inputs provided
        if (!oldPassword || !newPassword || !confirmPassword) {
            throw new AppError('Vui lòng điền đầy đủ mật khẩu cũ, mật khẩu mới và xác nhận.', 400);
        }

        // Check passwords match
        if (newPassword !== confirmPassword) {
            throw new AppError('Mật khẩu mới và xác nhận không khớp.', 400);
        }

        // Ensure new password is different from old
        if (oldPassword === newPassword) {
            throw new AppError('Mật khẩu mới phải khác mật khẩu cũ.', 400);
        }

        // Get current password hash from database
        const currentHashedPass = await UserModel.findPasswordByUserId(userId);
        if (!currentHashedPass) {
            throw new AppError('Không tìm thấy người dùng.', 404);
        }

        // Verify old password
        const isMatch = await authUtils.comparePassword(oldPassword, currentHashedPass);
        if (!isMatch) {
            throw new AppError('Mật khẩu cũ không chính xác.', 401);
        }

        // Hash new password
        const hashedNewPassword = await authUtils.hashPassword(newPassword);

        // Update password in database
        await UserModel.changePassword(userId, hashedNewPassword);

        return { message: 'Đổi mật khẩu thành công' };
    }

    /**
     * Get user's own profile
     */
    async getMyProfile(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AppError('Không tìm thấy người dùng', 404);
        }
        return user;
    }

    /**
     * Search users
     * - Validate keyword
     * - Apply filters and sorting
     * - Return paginated results
     */
    async searchUsers(keyword, page, limit, sort, currentUserId) {
        if (!keyword) {
            return { users: [], totalItems: 0, totalPages: 0, currentPage: 1 };
        }

        const result = await UserModel.searchUsers({
            keyword,
            page,
            limit,
            sort,
            currentUserId
        });

        return result;
    }

    /**
     * Update user profile
     * - Validate and normalize input data
     * - Handle file upload if present
     * - Update in database
     * - Return updated user data
     */
    async updateUserProfile(userId, updateData) {
        // Validate at least one field to update
        if (Object.keys(updateData).length === 0) {
            throw new AppError('Không có dữ liệu nào được gửi để cập nhật.', 400);
        }

        // Validate fullName if provided
        if (updateData.fullName !== undefined) {
            if (updateData.fullName.trim() === '') {
                throw new AppError('Họ và tên không được để trống.', 400);
            }
        }

        if (updateData.avatar !== undefined || updateData.coverImage !== undefined) {
            const oldUser = await UserModel.findById(userId);
            
            if (oldUser) {
                // Xử lý xóa Avatar cũ
                if (updateData.avatar !== undefined && oldUser.avatar && oldUser.avatar !== DEFAULT_AVATAR_IMG) {
                    if (updateData.avatar !== oldUser.avatar) {
                        deleteCloudinaryImage(oldUser.avatar);
                    }
                }
                
                // Xử lý xóa Cover Image cũ
                if (updateData.coverImage !== undefined && oldUser.coverImage && oldUser.coverImage !== DEFAULT_COVER_IMG) {
                    if (updateData.coverImage !== oldUser.coverImage) {
                        deleteCloudinaryImage(oldUser.coverImage);
                    }
                }
            }
        }

        // Update profile in database
        await UserModel.updateProfile(userId, updateData);

        // Get and return updated user data
        const updatedUser = await UserModel.findById(userId);
        return updatedUser;
    }

    /**
     * Daily check-in
     * - Check if user already checked in today
     * - Award bonus points (10)
     * - Record transaction
     */
    async dailyCheckIn(userId) {
        // Check if already checked in today
        const hasCheckedIn = await PointModel.hasCheckedInToday(userId);
        if (hasCheckedIn) {
            throw new AppError('Hôm nay bạn đã điểm danh rồi. Hãy quay lại vào ngày mai!', 400);
        }

        // Award points
        const bonusPoints = 10;
        await UserModel.updatePoints(userId, bonusPoints);

        // Record transaction
        await PointModel.create({
            userId,
            type: 'checkin',
            amount: bonusPoints,
            message: 'Điểm danh hàng ngày'
        });

        return { message: `Điểm danh thành công! Bạn nhận được ${bonusPoints} điểm.` };
    }

    /**
     * Get point history
     * - Retrieve point transactions for user
     * - Support filtering by month
     * - Return paginated results
     */
    async getPointHistory(userId, page, month) {
        const result = await PointModel.getHistory(
            userId,
            parseInt(page) || 1,
            10,
            month === 'all' ? null : month
        );

        return result;
    }

    /**
     * Gift points to another user
     * - Validate sender has enough points
     * - Validate recipient exists and is active
     * - Perform transaction (sender loses points, recipient gains)
     * - Record both transactions
     */
    async giftPoints(senderId, recipientId, amount, message) {
        const connection = await db.pool.getConnection();

        try {
            const pointsToSend = parseInt(amount);

            // Validate inputs
            if (!recipientId || !pointsToSend) {
                throw new AppError('Thiếu thông tin người nhận hoặc số điểm.', 400);
            }
            if (pointsToSend < 10) {
                throw new AppError('Số điểm tặng tối thiểu là 10.', 400);
            }
            if (senderId === recipientId) {
                throw new AppError('Không thể tự tặng điểm cho mình.', 400);
            }

            // Begin transaction
            await connection.beginTransaction();

            // Check sender has enough points
            const sender = await UserModel.findByIdForUpdate(senderId, connection);
            if (!sender || sender.points < pointsToSend) {
                await connection.rollback();
                throw new AppError('Số điểm của bạn không đủ để tặng.', 400);
            }

            // Validate recipient
            const recipient = await UserModel.findByIdForUpdate(recipientId, connection);
            if (!recipient) {
                await connection.rollback();
                throw new AppError('Người nhận không tồn tại.', 404);
            }
            if (recipient.account_status !== 'active') {
                await connection.rollback();
                throw new AppError('Người nhận đang bị khóa hoặc chưa kích hoạt.', 400);
            }

            // Deduct points from sender
            await UserModel.updatePoints(senderId, -pointsToSend, connection);
            await PointModel.create(
                {
                    userId: senderId,
                    type: 'gift_sent',
                    amount: -pointsToSend,
                    relatedUserId: recipientId,
                    message: message || `Tặng điểm cho ${recipient.full_name}`
                },
                connection
            );

            // Add points to recipient
            await UserModel.updatePoints(recipientId, pointsToSend, connection);
            await PointModel.create(
                {
                    userId: recipientId,
                    type: 'earn',
                    amount: pointsToSend,
                    relatedUserId: senderId,
                    message: message || `Nhận điểm từ ${sender.full_name}`
                },
                connection
            );

            // Commit transaction
            await connection.commit();

            return { message: 'Tặng điểm thành công!' };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get public profile of user (viewed by another user)
     * - Return only public information
     * - Check if viewed user is blocked or active
     */
    async getUserProfile(userId, viewerId) {
        const user = await UserModel.findPublicProfileById(userId, viewerId);
        if (!user) {
            throw new AppError('Người dùng không tồn tại hoặc tài khoản đã bị khóa.', 404);
        }
        return user;
    }
}

module.exports = new UserService();
