// VỊ TRÍ: backend/controllers/admin/adminDashboard.controller.js
const adminDashboardService = require('../../services/admin/adminDashboard.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendResponse } = require('../../utils/responseHelper');

const getDashboardStats = asyncHandler(async (req, res) => {
    const stats = await adminDashboardService.getDashboardStats();

    sendResponse(res, 200, true, 'Get stats successfully', stats);
});

module.exports = { getDashboardStats };