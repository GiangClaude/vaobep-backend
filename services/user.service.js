// backend/services/user.service.js
const UserModel = require('../models/user.model');
const PointModel = require('../models/point.model');
const authUtils = require('../utils/auth.utils');
const db = require('../config/db');
const AppError = require('../utils/AppError');

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

    /**
     * Get all users (ADMIN)
     * - Support search, pagination
     */
    async getAllUsers(page, limit, search) {
        const offset = (page - 1) * limit;

        const countQuery = 'SELECT COUNT(*) as total FROM Users WHERE full_name LIKE ? OR email LIKE ?';
        const [totalResult] = await db.pool.execute(countQuery, [`%${search}%`, `%${search}%`]);
        const total = totalResult[0].total;

        const query = `
            SELECT user_id, full_name, email, role, account_status, points, created_at 
            FROM Users 
            WHERE full_name LIKE ? OR email LIKE ?
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;

        const [users] = await db.pool.execute(query, [`%${search}%`, `%${search}%`, limit.toString(), offset.toString()]);

        return {
            users,
            pagination: { page: parseInt(page), limit: parseInt(limit), total }
        };
    }

    /**
     * Get user detail with stats (ADMIN)
     */
    async getUserDetailAdmin(userId) {
        const userQuery =
            'SELECT user_id, full_name, email, avatar, bio, role, account_status, points, created_at FROM Users WHERE user_id = ?';
        const [users] = await db.pool.execute(userQuery, [userId]);

        if (users.length === 0) {
            throw new AppError('User not found', 404);
        }

        // Get statistics
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM Recipes WHERE user_id = ?) as total_recipes,
                (SELECT COUNT(*) FROM Article_Posts WHERE user_id = ?) as total_articles,
                (SELECT COUNT(*) FROM Reports WHERE post_id IN (SELECT recipe_id FROM Recipes WHERE user_id = ?)) as total_reports_received
        `;
        const [stats] = await db.pool.execute(statsQuery, [userId, userId, userId]);

        return {
            user: users[0],
            stats: stats[0]
        };
    }

    /**
     * 3. Khóa/Mở khóa User (ADMIN)
     * - Validate status input
     * - Update in database
     */
    async updateUserStatus(userId, status) {
        // Validate
        if (!['active', 'blocked'].includes(status)) {
            throw new AppError('Trạng thái không hợp lệ. Chỉ chấp nhận "active" hoặc "blocked"', 400);
        }

        // Cập nhật DB (Nếu bạn có UserModel.updateStatus thì nên dùng, ở đây tôi dùng raw query như code cũ của bạn)
        const [result] = await db.pool.execute(
            `UPDATE Users SET account_status = ? WHERE user_id = ?`, 
            [status, userId]
        );

        // Kiểm tra xem user có tồn tại không
        if (result.affectedRows === 0) {
            throw new AppError('Không tìm thấy người dùng.', 404);
        }

        return { message: `Đã cập nhật trạng thái người dùng thành: ${status}` };
    }

    /**
     * 4. Tạo tài khoản mới (ADMIN)
     * - Validate required fields
     * - Check if email already exists
     * - Hash password
     * - Insert to database
     */
    async createUserAdmin(userData) {
        const { full_name, email, password, role } = userData;

        // 1. Validate cơ bản
        if (!email || !password || !full_name) {
            throw new AppError('Vui lòng điền đầy đủ họ tên, email và mật khẩu.', 400);
        }

        // 2. Check email tồn tại
        const [existing] = await db.pool.execute(
            `SELECT email FROM Users WHERE email = ?`, 
            [email]
        );
        
        if (existing.length > 0) {
            throw new AppError('Email này đã được sử dụng trong hệ thống.', 400);
        }

        // 3. Hash mật khẩu (Tái sử dụng authUtils thay vì gọi trực tiếp bcrypt)
        const hashedPassword = await authUtils.hashPassword(password);

        // 4. Insert vào DB
        const finalRole = role || 'user';
        const query = `
            INSERT INTO Users (full_name, email, password, role, account_status) 
            VALUES (?, ?, ?, ?, 'active')`;
        
        await db.pool.execute(query, [full_name, email, hashedPassword, finalRole]);

        return { message: 'Tạo tài khoản người dùng thành công' };
    }
}

module.exports = new UserService();
