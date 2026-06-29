const LeaderboardService = require('../services/leaderboard.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/responseHelper');

const getTopRecipes = asyncHandler(async (req, res) => {
    const { month, year } = req.query;
    const result = await LeaderboardService.getTopRecipes(month, year);
    sendResponse(res, 200, true, 'Success', result);
});

const getTopUsers = asyncHandler(async (req, res) => {
    const { month, year } = req.query;
    const result = await LeaderboardService.getTopUsers(month, year);
    sendResponse(res, 200, true, 'Success', result);
});

const triggerSnapshot = asyncHandler(async (req, res) => {
    const result = await LeaderboardService.triggerSnapshot();
    sendResponse(res, 200, true, result.message || 'Snapshot triggered successfully', null);
});

module.exports = {
    getTopRecipes,
    getTopUsers,
    triggerSnapshot
};