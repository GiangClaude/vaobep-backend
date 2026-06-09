const IngredientService = require('../services/ingredient.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/responseHelper');

const getAllIngredients = asyncHandler(async (req, res) => {
    // Controller chỉ gọi Service, không gọi Model
    const rows = await IngredientService.getAllIngredients();
    
    // Chuẩn hóa định dạng trả về
    sendResponse(res, 200, true, 'Success', rows);
});

module.exports = {
    getAllIngredients
};