const authUtils = require('../utils/auth.utils');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const AuthService = require('../services/auth.service');
const UserModel = require('../models/user.model');
const { sendResponse } = require('../utils/responseHelper');

// Đăng ký người dùng mới
const register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const user = await AuthService.register(name, email, password);
    sendResponse(res, 201, true, 'User registered successfully. Please check your email for verification OTP.', { user });
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    sendResponse(res, 200, true, 'Login successful', { token: result.token, user: result.user });
});

const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    await AuthService.verifyOTP(email, otp);
    sendResponse(res, 200, true, 'OTP hợp lệ.');
});

const activateAccount = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    const result = await AuthService.activateAccount(email, otp);
    sendResponse(res, 200, true, 'Account verified successfully. You are now logged in.', { token: result.token, user: result.user });
});

const resendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await AuthService.resendOTP(email);
    sendResponse(res, 200, true, result.message || 'OTP sent successfully', null);
});

// Yêu cầu đặt lại mật khẩu (gửi OTP về email)
const requestPasswordReset = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await AuthService.requestPasswordReset(email);
    sendResponse(res, 200, true, result.message || 'Password reset OTP sent successfully');
});

// Quên mật khẩu
const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const result = await AuthService.resetPassword(email, otp, newPassword);
    sendResponse(res, 200, true, result.message || 'Password reset successful');
});

module.exports = {
    register,
    login,
    verifyOTP,
    activateAccount,
    resendOTP,
    requestPasswordReset,
    resetPassword
};