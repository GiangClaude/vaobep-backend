// VỊ TRÍ: backend/controllers/admin/adminReport.controller.js
const adminReportService = require('../../services/admin/adminReport.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendResponse } = require('../../utils/responseHelper');

const getReports = asyncHandler(async (req, res) => {
    const reports = await adminReportService.getReports();
    sendResponse(res, 200, true, 'Success', reports);
});

const processReport = asyncHandler(async (req, res) => {
    const { report_id, action, post_id, post_type } = req.body;
    
    const message = await adminReportService.processReport(report_id, action, post_id, post_type);
    
    sendResponse(res, 200, true, message);
});

module.exports = { getReports, processReport };