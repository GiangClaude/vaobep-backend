// backend/services/auth.service.js
const fs = require('fs');
const path = require('path');
const UserModel = require('../models/user.model');
const authUtils = require('../utils/auth.utils');
const emailUtils = require('../utils/email.utils');
const AppError = require('../utils/AppError');

class AuthService {
    /**
     * Register new user
     * - Validate inputs
     * - Hash password
     * - Generate OTP
     * - Create user in DB
     * - Send verification email
     * - Create user directory
     */
    async register(name, email, password) {
        // Validate inputs
        if (!name || !email || !password) {
            throw new AppError('Name, email, and password are required', 400);
        }

        // Check if email already registered
        let user = await UserModel.findByEmail(email);
        if (user) {
            throw new AppError('Email is already registered', 409);
        }

        // Generate OTP and expiry time
        const otp = authUtils.generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Hash password
        const hashedPassword = await authUtils.hashPassword(password);

        // Create user in database
        const newUserId = await UserModel.create(name, email, hashedPassword, otp, otpExpires);

        // Send verification email
        const emailResult = await emailUtils.sendVerificationEmail(email, otp);
        if (!emailResult.success) {
            throw new AppError('Failed to send verification email', 500);
        }

        // Create user directory
        const userFolderPath = path.join(__dirname, '../../public/user', newUserId.toString());
        if (!fs.existsSync(userFolderPath)) {
            fs.mkdirSync(userFolderPath, { recursive: true });
        }

        return { id: newUserId, name, email };
    }

    /**
     * Login user
     * - Validate email and password
     * - Check account status
     * - Generate JWT token
     */
    async login(email, password) {
        // Validate inputs
        if (!email || !password) {
            throw new AppError('Email and password are required', 400);
        }

        // Find user by email
        const user = await UserModel.findByEmail(email);
        if (!user) {
            throw new AppError('Invalid email or password', 400);
        }

        // Compare passwords
        const isMatch = await authUtils.comparePassword(password, user.password);
        if (!isMatch) {
            throw new AppError('Invalid email or password', 400);
        }

        // Check account status
        if (user.account_status === 'pending') {
            throw new AppError('Tài khoản chưa xác thực', 403);
        }

        // Generate token
        const token = authUtils.generateToken(user.user_id);

        return { token, user: { id: user.user_id, name: user.name, email: user.email } };
    }

    /**
     * Verify OTP
     * - Validate email and OTP
     * - Return user if valid
     */
    async verifyOTP(email, otp) {
        if (!email || !otp) {
            throw new AppError('Email and OTP are required', 400);
        }

        // Validate OTP (throws error if invalid or expired)
        const user = await authUtils.validateOTP(email, otp);
        return user;
    }

    /**
     * Activate account
     * - Verify OTP
     * - Activate user account
     * - Clear OTP
     * - Generate token
     */
    async activateAccount(email, otp) {
        if (!email || !otp) {
            throw new AppError('Email and OTP are required', 400);
        }

        // Validate OTP
        const user = await authUtils.validateOTP(email, otp);

        // Activate user account
        await UserModel.activateUser(user.user_id);

        // Clear OTP
        await UserModel.clearOTP(user.user_id);

        // Generate token for immediate login
        const token = authUtils.generateToken(user.user_id);

        return {
            token,
            user: { id: user.user_id, name: user.full_name, email: user.email }
        };
    }

    /**
     * Resend OTP
     * - Validate account exists and is pending
     * - Generate new OTP
     * - Send verification email
     */
    async resendOTP(email) {
        if (!email) {
            throw new AppError('Email is required', 400);
        }

        const user = await UserModel.findByEmail(email);
        if (!user) {
            throw new AppError('Không tìm thấy tài khoản', 400);
        }

        if (user.account_status === 'active') {
            throw new AppError('Tài khoản đã được xác thực', 400);
        }

        // Generate new OTP
        const otp = authUtils.generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        // Update OTP in database
        await UserModel.updateOTP(user.user_id, otp, otpExpires);

        // Send email
        await emailUtils.sendPasswordResetEmail(email, otp);

        return { message: 'Đã gửi lại OTP' };
    }

    /**
     * Request password reset
     * - Validate email
     * - Generate OTP
     * - Send password reset email
     * - Return safe response (doesn't reveal if email exists)
     */
    async requestPasswordReset(email) {
        if (!email) {
            throw new AppError('Email is required', 400);
        }

        const user = await UserModel.findByEmail(email);
        if (!user) {
            // Return same response whether email exists or not (security)
            return { message: 'If your email is registered, you will receive a password reset OTP.' };
        }

        // Generate OTP
        const otp = authUtils.generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        // Update OTP in database
        await UserModel.updateOTP(user.user_id, otp, otpExpires);

        // Send email
        await emailUtils.sendPasswordResetEmail(email, otp);

        return { message: 'Password reset OTP sent to your email!' };
    }

    /**
     * Change password (authenticated user)
     * - Validate old password
     * - Hash new password
     * - Update in database
     * - Cancel because UserModel also have changePassword function, and we can directly call that in user.controller.js. If we put it here, it will be redundant and we also need to call UserModel.findPasswordByUserId to get current password hash, which is not efficient.
     */
    // async changePasswordAuth(userId, oldPassword, newPassword) {
    //     if (!oldPassword || !newPassword) {
    //         throw new AppError('Vui lòng nhập mật khẩu cũ và mới', 400);
    //     }

    //     // Get current password hash
    //     const currentHashedPassword = await UserModel.findPasswordByUserId(userId);

    //     // Verify old password
    //     const isMatch = await authUtils.comparePassword(oldPassword, currentHashedPassword);
    //     if (!isMatch) {
    //         throw new AppError('Mật khẩu cũ không chính xác', 400);
    //     }

    //     // Hash new password
    //     const hashedNewPassword = await authUtils.hashPassword(newPassword);

    //     // Update password in database
    //     await UserModel.changePassword(userId, hashedNewPassword);

    //     return { message: 'Đổi mật khẩu thành công' };
    // }

    /**
     * Reset password (forgot password flow)
     * - Validate OTP
     * - Hash new password
     * - Update password
     * - Clear OTP
     */
    async resetPassword(email, otp, newPassword) {
        if (!email || !otp || !newPassword) {
            throw new AppError('Email, OTP, and new password are required', 400);
        }

        // Find user
        const user = await UserModel.findByEmail(email);
        if (!user) {
            throw new AppError('Người dùng không tồn tại', 404);
        }

        await authUtils.validateOTP(email, otp);

        // Hash new password
        const hashedNewPassword = await authUtils.hashPassword(newPassword);

        // Update password
        await UserModel.changePassword(user.user_id, hashedNewPassword);

        // Clear OTP
        await UserModel.clearOTP(user.user_id);

        return { message: 'Password reset successfully' };
    }
}

module.exports = new AuthService();
