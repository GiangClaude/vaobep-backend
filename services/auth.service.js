const fs = require('fs');
const path = require('path');
const UserModel = require('../models/user.model');
const authUtils = require('../utils/auth.utils');
const emailUtils = require('../utils/email.utils');
const AppError = require('../utils/AppError');

class AuthService {
    async register(name, email, password) {
        if (!name || !email || !password) {
            throw new AppError('Name, email, and password are required', 400);
        }

        let user = await UserModel.findByEmail(email);
        if (user) {
            throw new AppError('Email is already registered', 409);
        }

        const otp = authUtils.generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        const hashedPassword = await authUtils.hashPassword(password);

        const newUserId = await UserModel.create(name, email, hashedPassword, otp, otpExpires);

        const emailResult = await emailUtils.sendVerificationEmail(email, otp);
        if (!emailResult.success) {
            throw new AppError('Failed to send verification email', 500);
        }

        const userFolderPath = path.join(__dirname, '../../public/user', newUserId.toString());
        if (!fs.existsSync(userFolderPath)) {
            fs.mkdirSync(userFolderPath, { recursive: true });
        }

        return { id: newUserId, name, email };
    }

    async login(email, password) {
        if (!email || !password) {
            throw new AppError('Email and password are required', 400);
        }

        const user = await UserModel.findByEmail(email);
        if (!user) {
            throw new AppError('Invalid email or password', 400);
        }

        const isMatch = await authUtils.comparePassword(password, user.password);
        if (!isMatch) {
            throw new AppError('Invalid email or password', 400);
        }

        if (user.account_status === 'pending') {
            throw new AppError('Tài khoản chưa xác thực', 403);
        }

        const token = authUtils.generateToken(user.user_id);

        return { token, user: { id: user.user_id, name: user.full_name, email: user.email, role: user.role } };
    }
    async verifyOTP(email, otp) {
        if (!email || !otp) {
            throw new AppError('Email and OTP are required', 400);
        }

        const user = await authUtils.validateOTP(email, otp);
        return user;
    }

    async activateAccount(email, otp) {
        if (!email || !otp) {
            throw new AppError('Email and OTP are required', 400);
        }

        const user = await authUtils.validateOTP(email, otp);

        await UserModel.activateUser(user.user_id);

        await UserModel.clearOTP(user.user_id);

        const token = authUtils.generateToken(user.user_id);

        return {
            token,
            user: { id: user.user_id, name: user.full_name, email: user.email }
        };
    }

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

        const otp = authUtils.generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await UserModel.updateOTP(user.user_id, otp, otpExpires);

        await emailUtils.sendPasswordResetEmail(email, otp);

        return { message: 'Đã gửi lại OTP' };
    }

    async requestPasswordReset(email) {
        if (!email) {
            throw new AppError('Email is required', 400);
        }

        const user = await UserModel.findByEmail(email);
        if (!user) {
            return { message: 'If your email is registered, you will receive a password reset OTP.' };
        }

        const otp = authUtils.generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await UserModel.updateOTP(user.user_id, otp, otpExpires);

        await emailUtils.sendPasswordResetEmail(email, otp);

        return { message: 'Password reset OTP sent to your email!' };
    }

    async resetPassword(email, otp, newPassword) {
        if (!email || !otp || !newPassword) {
            throw new AppError('Email, OTP, and new password are required', 400);
        }

        const user = await UserModel.findByEmail(email);
        if (!user) {
            throw new AppError('Người dùng không tồn tại', 404);
        }

        await authUtils.validateOTP(email, otp);

        const hashedNewPassword = await authUtils.hashPassword(newPassword);

        await UserModel.changePassword(user.user_id, hashedNewPassword);

        await UserModel.clearOTP(user.user_id);

        return { message: 'Password reset successfully' };
    }
}

module.exports = new AuthService();
