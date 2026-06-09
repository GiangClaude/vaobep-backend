// VỊ TRÍ: backend/controllers/admin/adminArticle.controller.js
const adminArticleService = require('../../services/admin/adminArticle.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendResponse } = require('../../utils/responseHelper');

// Controller giờ đây rất mỏng (Thin Controller), chỉ nhận Request và gọi Service
const getArticles = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const statusFilter = req.query.status || 'all';
    const sortKey = req.query.sortKey || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';

    const result = await adminArticleService.getArticles(page, limit, search, statusFilter, sortKey, sortOrder);

    sendResponse(res, 200, true, 'Success', result.articles, { page, limit, totalItems: result.total, totalPages: result.totalPages });
});

const getAdminArticleDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const article = await adminArticleService.getArticleDetail(id);
    
    sendResponse(res, 200, true, 'Success', article);
});

const updateArticleStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const newStatus = await adminArticleService.updateArticleStatus(id, status);
    
    sendResponse(res, 200, true, `Đã cập nhật trạng thái bài viết thành: ${newStatus}`);
});

const deleteArticle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    await adminArticleService.deleteArticle(id);
    
    sendResponse(res, 200, true, 'Xóa bài viết thành công');
});

module.exports = { 
    getArticles, 
    getAdminArticleDetail, 
    updateArticleStatus, 
    deleteArticle 
};