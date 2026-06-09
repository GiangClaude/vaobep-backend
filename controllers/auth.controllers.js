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

// const protect = asyncHandler(async (req, res, next) => {
//     let token;
//     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//         token = req.headers.authorization.split(' ')[1];

//         const decoded = authUtils.verifyToken(token);
//         if (!decoded) {
//             throw new AppError('Not authorized, token failed', 401);
//         }

//         const fetchedUser = await UserModel.findAuth(decoded.id);
//         req.user = Array.isArray(fetchedUser) ? fetchedUser[0] : fetchedUser;
        
//         if (!req.user) {
//             throw new AppError('User không còn tồn tại', 401);
//         }

//         return next();
//     }

//     if (!token) {
//         throw new AppError('Not authorized, no token', 401);
//     }
// });

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

// // Xử lý đổi mật khẩu cho user đang đăng nhập bằng mật khẩu cũ
// const changePasswordAuth = asyncHandler(async (req, res) => {
//     const { oldPassword, newPassword } = req.body;
//     const userId = req.user.user_id || req.user.id;
//     const result = await AuthService.changePasswordAuth(userId, oldPassword, newPassword);
//     res.status(200).json(result);
// });

// Đổi mật khẩu khi đã quên mật khẩu cũ => sử dụng hàm resetPassword
const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const result = await AuthService.resetPassword(email, otp, newPassword);
    sendResponse(res, 200, true, result.message || 'Password reset successful');
});

module.exports = {
    register,
    login,
    // protect, 
    verifyOTP,
    activateAccount,
    resendOTP,
    requestPasswordReset,
    // changePasswordAuth,
    resetPassword
};