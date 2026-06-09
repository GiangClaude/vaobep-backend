// VỊ TRÍ: backend/services/admin/adminUser.service.js
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const UserModel = require('../../models/user.model');
const emailUtils = require('../../utils/email.utils');
const authUtils = require('../../utils/auth.utils');
const AppError = require('../../utils/AppError');

class AdminUserService {
    /**
     * Lấy danh sách User (Có phân trang, tìm kiếm, sort)
     */
    async getUsers(page, limit, search, sortKey, sortOrder) {
        const offset = (page - 1) * limit;
        const users = await UserModel.getAllUsers(limit, offset, search, sortKey, sortOrder);
        const total = await UserModel.countUsers(search);

        return { users, total, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Khóa hoặc mở khóa User
     */
    async toggleUserStatus(id, status) {
        if (!['active', 'blocked'].includes(status)) throw new AppError('Invalid status', 400);
        await UserModel.updateStatus(id, status);
        return status;
    }

    /**
     * Tạo tài khoản mới bởi Admin
     */
    async createUser(data) {
        const { full_name, email, password, role } = data;
        
        if (!['admin', 'vip', 'pro', 'user'].includes(role)) throw new AppError('Invalid role', 400);
        if (!email || !password || !full_name) throw new AppError('Vui lòng điền đủ thông tin.', 400);

        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) throw new AppError('Email đã tồn tại.', 400);

        const hashedPassword = await authUtils.hashPassword(password);
        const userId = uuidv4();
        const otp = authUtils.generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await UserModel.createWithRole({
            id: userId,
            full_name,
            email,
            passwordHash: hashedPassword,
            role,
            otp,
            otpExpires
        });

        // Gửi email xác thực
        const emailResult = await emailUtils.sendVerificationEmail(email, otp);
        if (!emailResult.success) {
            throw new AppError('Tạo tài khoản thành công nhưng gửi email xác thực thất bại.', 500);
        }

        // Tạo thư mục cá nhân cho user
        const userFolderPath = path.join(__dirname, '../../../public/user', userId.toString());
        try {
            await fs.mkdir(userFolderPath, { recursive: true });
        } catch (fsError) {
            console.warn(`[Cảnh báo] Không thể tạo thư mục ảnh cho user ${userId}:`, fsError.message);
        }

        return userId;
    }

    /**
     * Lấy chi tiết User
     */
    async getUserDetail(id) {
        const user = await UserModel.findByIdForAdmin(id);
        if (!user) throw new AppError('User not found', 404);
        return user;
    }

    /**
     * Cập nhật thông tin User (Phân quyền, Trạng thái)
     */
    async updateUser(id, data) {
        const { role, account_status } = data;

        if (role && !['admin', 'vip', 'pro', 'user'].includes(role)) {
            throw new AppError('Invalid role', 400);
        }
        if (account_status && !['active', 'blocked', 'pending'].includes(account_status)) {
            throw new AppError('Invalid status', 400);
        }

        await UserModel.adminUpdateUser(id, { role, status: account_status });
        return true;
    }
}

module.exports = new AdminUserService();