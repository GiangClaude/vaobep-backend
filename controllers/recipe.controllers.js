const paginationHelper = require('../utils/paginationHelper');
const { getUserIdFromToken } = require('../utils/auth.utils');
const asyncHandler = require('../utils/asyncHandler');
const RecipeService = require('../services/recipe.service');
const { sendResponse } = require('../utils/responseHelper'); 

const createRecipe = asyncHandler(async (req, res) => {
    const newRecipe = await RecipeService.createRecipe(req.savedRecipeId, req.user.user_id, req.body, req.files);
    sendResponse(res, 201, true, "Tạo công thức thành công!", newRecipe);
});

const updateRecipe = asyncHandler(async (req, res) => {
    const result = await RecipeService.updateRecipe(req.params.recipeId, req.user.user_id, req.body, req.files);
    sendResponse(res, 200, true, result.message || "Cập nhật công thức thành công", { notification: result.notification });
});

const deleteRecipe = asyncHandler(async (req, res) => {
    const result = await RecipeService.deleteRecipe(req.params.recipeId, req.user.user_id);
    sendResponse(res, 200, true, "Xóa công thức thành công");
});

const getRecipeById = asyncHandler(async (req, res) => {
    const recipeData = await RecipeService.getRecipeById(req.params.recipeId);
    sendResponse(res, 200, true, 'Success', recipeData);
});

const getRecipes = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const filters = {
        ingredients: req.query.ingredients ? req.query.ingredients.split(',') : null,
        tags: req.query.tags ? req.query.tags.split(',') : null,
        minRating: req.query.minRating,
        minCalo: req.query.minCalo,
        keyword: req.query.keyword,
        cookingTime: req.query.cookingTime,
        difficulty: req.query.difficulty
    };

    let currentUserId = getUserIdFromToken(req);
    const { recipes, totalItems } = await RecipeService.getRecipes(page, limit, filters, currentUserId);
    const pagination = paginationHelper.createPagination(page, limit, totalItems);

    sendResponse(res, 200, true, 'Lấy danh sách công thức thành công', recipes, pagination);
});

const getRecentlyRecipes = asyncHandler(async (req, res) => {
    const currentUserId = getUserIdFromToken(req);
    console.log('Current User ID:', currentUserId);
    const recipes = await RecipeService.getRecentlyRecipes(req.query.category, req.query.tag, currentUserId);
    sendResponse(res, 200, true, 'Lấy danh sách thành công', recipes);
});

const getFeatureRecipes = asyncHandler(async (req, res) => {
    const recipes = await RecipeService.getFeatureRecipes();
    sendResponse(res, 200, true, 'Đã lấy được recipe đặc biệt!', recipes, { count: recipes.length });
});

const getOwnerRecipe = asyncHandler(async (req, res) => {
    const recipes = await RecipeService.getOwnerRecipe(req.user.user_id);
    sendResponse(res, 200, true, 'Success', recipes);
});

const getUserRecipe = asyncHandler(async (req, res) => {
    const recipes = await RecipeService.getUserRecipe(req.params.userId);
    sendResponse(res, 200, true, 'Success', recipes);
});

const getPreviewComments = asyncHandler(async (req, res) => {
    const comments = await RecipeService.getPreviewComments(req.params.recipeId);
    sendResponse(res, 200, true, 'Success', comments);
});

const changeRecipeStatus = asyncHandler(async (req, res) => {
    const newStatus = await RecipeService.changeRecipeStatus(req.params.recipeId, req.user.user_id, req.body.status);
    sendResponse(res, 200, true, `Đã chuyển trạng thái sang "${newStatus}" thành công!`, { newStatus });
});

const getSavedRecipes = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const result = await RecipeService.getSavedRecipes(req.user.user_id, req.query.sortKey, req.query.sortOrder, limit, page);
    sendResponse(res, 200, true, 'Lấy danh sách đã lưu thành công', result.recipes, paginationHelper.createPagination(page, limit, result.total));
});

const searchSimpleRecipes = asyncHandler(async (req, res) => {
    const userId = getUserIdFromToken(req);
    const recipes = await RecipeService.searchSimpleRecipes(req.query.keyword, userId);
    sendResponse(res, 200, true, 'Tìm kiếm công thức thành công', recipes);
});

module.exports = {
    getRecipes, getRecentlyRecipes, getFeatureRecipes, searchSimpleRecipes,
    createRecipe, updateRecipe, getRecipeById, deleteRecipe, getOwnerRecipe, 
    getUserRecipe, getPreviewComments, changeRecipeStatus, getSavedRecipes
};