const IngredientService = require('../services/ingredient.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/responseHelper');

const getAllIngredients = asyncHandler(async (req, res) => {
    const rows = await IngredientService.getAllIngredients();    
    sendResponse(res, 200, true, 'Success', rows);
});

module.exports = {
    getAllIngredients
};