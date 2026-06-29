const asyncHandler = require('../utils/asyncHandler');
const RewardService = require('../services/reward.service');
const { sendResponse } = require('../utils/responseHelper');

/**
 * Lấy danh sách hộp quà của người dùng hiện tại
 */
const getMyRewards = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const boxes = await RewardService.getMyRewards(userId);
    
    sendResponse(res, 200, true, 'Success', boxes);
});

/**
 * Xử lý mở hộp quà (Claim Reward)
 */
const claimReward = asyncHandler(async (req, res) => {
    const { userRewardId } = req.body;
    const userId = req.user.user_id;

    const result = await RewardService.claimReward(userRewardId, userId);

    sendResponse(res, 200, true, result.message, result.data);
});

module.exports = {
    getMyRewards,
    claimReward
};