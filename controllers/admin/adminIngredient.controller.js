// VỊ TRÍ: backend/controllers/admin/adminIngredient.controller.js
const adminIngredientService = require('../../services/admin/adminIngredient.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendResponse } = require('../../utils/responseHelper');

const getPendingIngredients = asyncHandler(async (req, res) => {
    const ingredients = await adminIngredientService.getPendingIngredients();
    sendResponse(res, 200, true, 'Success', ingredients);
});

const processIngredient = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, calo_per_100g } = req.body;
    const message = await adminIngredientService.processIngredient(id, action, calo_per_100g);
    sendResponse(res, 200, true, message);
});

const getAllIngredients = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const sortKey = req.query.sortKey || 'name';
    const sortOrder = req.query.sortOrder || 'ASC';

    const result = await adminIngredientService.getAllIngredients(page, limit, search, sortKey, sortOrder);

    sendResponse(res, 200, true, 'Success', result.ingredients, { page, limit, totalItems: result.total, totalPages: result.totalPages });
});

const createIngredient = asyncHandler(async (req, res) => {
    const { name, calo_per_100g, status } = req.body;
    const ingredientId = await adminIngredientService.createIngredient(name, calo_per_100g, status);
    sendResponse(res, 201, true, 'Thêm nguyên liệu thành công', { ingredientId });
});

const updateIngredient = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, calo_per_100g, status } = req.body;
    await adminIngredientService.updateIngredient(id, name, calo_per_100g, status);
    sendResponse(res, 200, true, 'Cập nhật nguyên liệu thành công');
});

const deleteIngredient = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await adminIngredientService.deleteIngredient(id);
    sendResponse(res, 200, true, 'Xóa nguyên liệu thành công');
});

module.exports = { getPendingIngredients, processIngredient, getAllIngredients, createIngredient, updateIngredient, deleteIngredient };