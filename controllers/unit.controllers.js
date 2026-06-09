const UnitService = require('../services/unit.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/responseHelper');
const getAllUnits = asyncHandler(async (req, res) => {
    const result = await UnitService.getAllUnits();
    
    // Giữ nguyên định dạng trả về cũ
    sendResponse(res, 200, true, 'Success', result);
});

module.exports = {
    getAllUnits
};