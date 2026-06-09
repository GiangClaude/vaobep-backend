// VỊ TRÍ: backend/controllers/admin/adminDictionary.controller.js
const adminDictionaryService = require('../../services/admin/adminDictionary.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendResponse } = require('../../utils/responseHelper');

const getDictionaryDishes = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const sortKey = req.query.sortKey || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';

    const result = await adminDictionaryService.getDictionaryDishes(page, limit, search, sortKey, sortOrder);

    sendResponse(res, 200, true, 'Success', result.dishes, { page, limit, totalItems: result.total, totalPages: result.totalPages });
});

const createDictionaryDish = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    // Chuyển toàn bộ req.body và thông tin file xuống Service
    const dishId = await adminDictionaryService.createDictionaryDish(adminId, req.body, req.file);

    sendResponse(res, 201, true, 'Tạo món ăn thành công', { dishId });
});

const updateDictionaryDish = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await adminDictionaryService.updateDictionaryDish(id, req.body, req.file);

    sendResponse(res, 200, true, 'Cập nhật món ăn thành công');
});

const deleteDictionaryDish = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await adminDictionaryService.deleteDictionaryDish(id);
    
    sendResponse(res, 200, true, 'Xóa món ăn thành công');
});

module.exports = { getDictionaryDishes, createDictionaryDish, updateDictionaryDish, deleteDictionaryDish };