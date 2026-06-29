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

const getCountries = asyncHandler(async (req, res) => {
    const countries = await adminDictionaryService.getCountries();
    sendResponse(res, 200, true, 'Lấy danh sách quốc gia thành công', countries);
});

module.exports = { getDictionaryDishes, createDictionaryDish, updateDictionaryDish, deleteDictionaryDish, getCountries };