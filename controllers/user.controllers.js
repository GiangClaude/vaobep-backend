const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const UserService = require('../services/user.service');
const authUtils = require('../utils/auth.utils');
const db = require('../config/db');
const { sendResponse } = require('../utils/responseHelper');

// Update mật khẩu mới (chủ động)
const updatePassword = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const result = await UserService.updatePassword(userId, oldPassword, newPassword, confirmPassword);
    sendResponse(res, 200, true, result.message || 'Password updated successfully', null);
});

const getMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const user = await UserService.getMyProfile(userId);
    sendResponse(res, 200, true, 'Success', user);
});

// Search users
const searchUsers = asyncHandler(async (req, res) => {
    const { keyword, page, limit, sort } = req.query;
    const viewerId = authUtils.getUserIdFromToken(req);
    const result = await UserService.searchUsers(keyword, page, limit, sort, viewerId);
    sendResponse(res, 200, true, 'Success', result.users, { totalItems: result.totalItems, totalPages: result.totalPages, currentPage: result.currentPage });
});

const updateUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { fullName, bio } = req.body;
    
    const updateData = {};
    if (fullName !== undefined) {
        updateData.fullName = fullName;
    }
    if (bio !== undefined) {
        updateData.bio = bio;
    }
    if (req.file) {
        updateData.avatar = req.file.filename;
    }

    const updatedUser = await UserService.updateUserProfile(userId, updateData);
    sendResponse(res, 200, true, 'Profile updated successfully', updatedUser);
    });

const dailyCheckIn = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const result = await UserService.dailyCheckIn(userId);
    sendResponse(res, 200, true, result.message);
});

// Lấy lịch sử điểm
const getPointHistory = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { page, month } = req.query;
    const result = await UserService.getPointHistory(userId, page, month);
    sendResponse(res, 200, true, 'Success', result);
});

// Tặng điểm cho user khác (transactional)
const giftPoints = asyncHandler(async (req, res) => {
    const senderId = req.user.user_id;
    const { recipientId, amount, message } = req.body;
    const result = await UserService.giftPoints(senderId, recipientId, amount, message);
    sendResponse(res, 200, true, result.message);
});

const getUserProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const viewerId = authUtils.getUserIdFromToken(req);
    const user = await UserService.getUserProfile(id, viewerId);
    sendResponse(res, 200, true, 'Success', user);
});



module.exports = {
    updatePassword,
    getMyProfile,
    searchUsers,
    updateUserProfile,
    dailyCheckIn,
    getPointHistory,
    giftPoints,
    getUserProfile,
}