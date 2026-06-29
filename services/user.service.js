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
     * Update user password
     */
    async updatePassword(userId, oldPassword, newPassword, confirmPassword) {
        if (!oldPassword || !newPassword || !confirmPassword) {
            throw new AppError('Vui lòng điền đầy đủ mật khẩu cũ, mật khẩu mới và xác nhận.', 400);
        }

        if (newPassword !== confirmPassword) {
            throw new AppError('Mật khẩu mới và xác nhận không khớp.', 400);
        }

        if (oldPassword === newPassword) {
            throw new AppError('Mật khẩu mới phải khác mật khẩu cũ.', 400);
        }

        const currentHashedPass = await UserModel.findPasswordByUserId(userId);
        if (!currentHashedPass) {
            throw new AppError('Không tìm thấy người dùng.', 404);
        }

        const isMatch = await authUtils.comparePassword(oldPassword, currentHashedPass);
        if (!isMatch) {
            throw new AppError('Mật khẩu cũ không chính xác.', 401);
        }

        const hashedNewPassword = await authUtils.hashPassword(newPassword);

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
     */
    async updateUserProfile(userId, updateData) {
        if (Object.keys(updateData).length === 0) {
            throw new AppError('Không có dữ liệu nào được gửi để cập nhật.', 400);
        }

        if (updateData.fullName !== undefined) {
            if (updateData.fullName.trim() === '') {
                throw new AppError('Họ và tên không được để trống.', 400);
            }
        }

        if (updateData.avatar !== undefined || updateData.coverImage !== undefined) {
            const oldUser = await UserModel.findById(userId);
            
            if (oldUser) {
                if (updateData.avatar !== undefined && oldUser.avatar && oldUser.avatar !== DEFAULT_AVATAR_IMG) {
                    if (updateData.avatar !== oldUser.avatar) {
                        deleteCloudinaryImage(oldUser.avatar);
                    }
                }
                
                if (updateData.coverImage !== undefined && oldUser.coverImage && oldUser.coverImage !== DEFAULT_COVER_IMG) {
                    if (updateData.coverImage !== oldUser.coverImage) {
                        deleteCloudinaryImage(oldUser.coverImage);
                    }
                }
            }
        }

        await UserModel.updateProfile(userId, updateData);

        const updatedUser = await UserModel.findById(userId);
        return updatedUser;
    }

    /**
     * Daily check-in
     */
    async dailyCheckIn(userId) {
        const hasCheckedIn = await PointModel.hasCheckedInToday(userId);
        if (hasCheckedIn) {
            throw new AppError('Hôm nay bạn đã điểm danh rồi. Hãy quay lại vào ngày mai!', 400);
        }

        const bonusPoints = 10;
        await UserModel.updatePoints(userId, bonusPoints);

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
     */
    async giftPoints(senderId, recipientId, amount, message) {
        const connection = await db.pool.getConnection();

        try {
            const pointsToSend = parseInt(amount);

            if (!recipientId || !pointsToSend) {
                throw new AppError('Thiếu thông tin người nhận hoặc số điểm.', 400);
            }
            if (pointsToSend < 10) {
                throw new AppError('Số điểm tặng tối thiểu là 10.', 400);
            }
            if (senderId === recipientId) {
                throw new AppError('Không thể tự tặng điểm cho mình.', 400);
            }

            await connection.beginTransaction();

            const sender = await UserModel.findByIdForUpdate(senderId, connection);
            if (!sender || sender.points < pointsToSend) {
                await connection.rollback();
                throw new AppError('Số điểm của bạn không đủ để tặng.', 400);
            }

            const recipient = await UserModel.findByIdForUpdate(recipientId, connection);
            if (!recipient) {
                await connection.rollback();
                throw new AppError('Người nhận không tồn tại.', 404);
            }
            if (recipient.account_status !== 'active') {
                await connection.rollback();
                throw new AppError('Người nhận đang bị khóa hoặc chưa kích hoạt.', 400);
            }

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
