const path = require('path');
const fsPromises = require('fs').promises; // Dùng promises để xóa file
const db = require('../config/db'); // Kéo db vào để dùng Transaction
const RecipeModel = require('../models/recipe.model');
const UserModel = require('../models/user.model');
const AppError = require('../utils/AppError');
const { checkRecipeOwner } = require('../utils/recipe.utils');
const { addVectorSyncJob } = require('./vectorQueue.service');

class RecipeService {
    async createRecipe(recipeId, userId, body, files) {
        const connection = await db.pool.getConnection(); // MỞ TRANSACTION
        try {
            await connection.beginTransaction();

            let { title, description, servings, cook_time, cookTime, total_calo, totalCalo, ingredients, instructions, tags, steps } = body;
            
            const finalCookTime = cook_time || cookTime || 60;
            const finalTotalCalo = total_calo || totalCalo || 0;
            const finalServings = servings || 1;
            let finalTags = [];
            let finalInstructions = instructions;

            if (steps) {
                finalInstructions = typeof steps === 'object' ? JSON.stringify(steps) : steps;
            }

            // Fix lỗi nuốt lỗi JSON
            if (tags) {
                try { finalTags = typeof tags === 'string' ? JSON.parse(tags) : tags; } 
                catch (e) { throw new AppError("Định dạng tags không hợp lệ", 400); }
            }

            let ingredientsList = [];
            if (ingredients) {
                try { ingredientsList = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients; } 
                catch (e) { throw new AppError("Định dạng nguyên liệu (ingredients) không hợp lệ", 400); }
            }

            let coverImageName = null;
            if (files && files['cover_image'] && files['cover_image'].length > 0) {
                coverImageName = files['cover_image'][0].filename;
            }

            let resultImagesList = [];
            if (files && files['result_images']) {
                resultImagesList = files['result_images'].map(file => ({
                    url: file.filename, 
                    description: "Thành phẩm"
                }));
            }

            // TRUYỀN CONNECTION VÀO MODEL ĐỂ ĐẢM BẢO TRANSACTION
            const newRecipe = await RecipeModel.create(connection, {
                recipeId, userId, title, description, instructions: finalInstructions,
                coverImage: coverImageName, servings: finalServings, cookTime: finalCookTime,
                totalCalo: finalTotalCalo, ingredientsData: ingredientsList,
                status: body.status || 'draft', resultImages: resultImagesList, tags: finalTags
            });

            await connection.commit();

            if (newRecipe.status === 'public' || newRecipe.status === 'hidden') {
                addVectorSyncJob(recipeId, 'recipe', 'upsert');
            }

            return newRecipe;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async updateRecipe(recipeId, userId, body, files) {
        const canEdit = await checkRecipeOwner(recipeId, userId);
        if (!canEdit) throw new AppError('Bạn không có quyền chỉnh sửa công thức này!', 403);

        const connection = await db.pool.getConnection(); // MỞ TRANSACTION
        try {
            await connection.beginTransaction();

            let { title, description, servings, cookTime, cook_time, totalCalo, total_calo, ingredients, instructions, status, tags, steps } = body;

            const finalCookTime = cookTime || cook_time || 60;
            const finalTotalCalo = totalCalo || total_calo || 0;
            const finalServings = servings || 1;
            let finalTags = null;

            let finalInstructions = instructions;
            if (steps) {
                finalInstructions = typeof steps === 'object' ? JSON.stringify(steps) : steps;
            }

            // Fix lỗi nuốt lỗi JSON
            if (tags !== undefined) {
                try { finalTags = typeof tags === 'string' ? JSON.parse(tags) : tags; } 
                catch (e) { throw new AppError("Định dạng tags không hợp lệ", 400); }
            }

            let ingredientsList = [];
            if (ingredients) {
                try { ingredientsList = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients; } 
                catch (e) { throw new AppError("Dữ liệu nguyên liệu lỗi format", 400); }
            }

            const recipeData = {
                title, description, instructions: finalInstructions, servings: finalServings,
                cook_time: finalCookTime, total_calo: finalTotalCalo, status: status || 'draft',
            };

            // FIX: XÓA ẢNH CŨ KHI UPLOAD ẢNH MỚI CHỐNG TRÀN Ổ CỨNG
            if (files && files['cover_image'] && files['cover_image'].length > 0) {
                const oldRecipe = await RecipeModel.findById(recipeId);
                if (oldRecipe && oldRecipe.cover_image) {
                    const oldFilePath = path.join(__dirname, '../public/recipes', recipeId.toString(), oldRecipe.cover_image);
                    try { 
                        await fsPromises.unlink(oldFilePath); 
                    } catch (e) {
                        console.warn(`[File System] Không thể xóa ảnh cover cũ của recipe ${recipeId}:`, e.message);
                    } // Soft delete
                }
                recipeData.cover_image = files['cover_image'][0].filename;
            }

            const mappedIngredients = (ingredientsList || []).map(item => ({
                name: item.name,
                unit: item.unit, 
                quantity: item.amount || item.quantity
            }));

            // TRUYỀN CONNECTION VÀO MODEL ĐỂ ĐẢM BẢO TRANSACTION
            const result = await RecipeModel.update(recipeId, recipeData, mappedIngredients, finalTags, connection);

            await connection.commit();

            if (recipeData.status === 'public' || recipeData.status === 'hidden') {
                addVectorSyncJob(recipeId, 'recipe', 'upsert');
            } else {
                addVectorSyncJob(recipeId, 'recipe', 'delete');
            }

            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async deleteRecipe(recipeId, userId) {
        const canEdit = await checkRecipeOwner(recipeId, userId);
        if (!canEdit) throw new AppError('Bạn không có quyền xóa công thức này!', 403);

        const result = await RecipeModel.deleteById(recipeId);
        addVectorSyncJob(recipeId, 'recipe', 'delete');

        return result;
    }

    async changeRecipeStatus(recipeId, userId, status) {
        const validStatuses = ['public', 'hidden', 'draft']; 
        if (!status || !validStatuses.includes(status)) {
            throw new AppError('Trạng thái không hợp lệ! Chỉ chấp nhận: ' + validStatuses.join(', '), 400);
        }

        const canEdit = await checkRecipeOwner(recipeId, userId);
        if (!canEdit) throw new AppError('Bạn không có quyền thay đổi trạng thái bài viết này.', 403);

        const success = await RecipeModel.updateStatus(recipeId, status);
        if (!success) throw new AppError('Không tìm thấy công thức để cập nhật.', 404);

        if (status === 'public' || status === 'hidden') {
            addVectorSyncJob(recipeId, 'recipe', 'upsert');
        } else {
            addVectorSyncJob(recipeId, 'recipe', 'delete');
        }

        return status;
    }

    async searchSimpleRecipes(keyword, userId) {
        const user = await UserModel.findById(userId);
        if (!user) throw new AppError('Không tìm thấy người dùng', 404);
        if (user.role === 'user') throw new AppError('Bạn không có quyền truy cập tính năng này', 403);

        if (!keyword) return [];
        return await RecipeModel.searchSimpleRecipes(keyword);
    }

    // ==========================================
    // CÁC HÀM GET CHUYỂN TỪ CONTROLLER SANG ĐỂ ĐẢM BẢO 3-TIER ARCHITECTURE
    // ==========================================
    async getRecipeById(recipeId) {
        const recipeData = await RecipeModel.findById(recipeId);
        if (!recipeData) throw new AppError('Không tìm thấy công thức', 404);
        return recipeData;
    }

    async getRecipes(page, limit, filters, currentUserId) {
        return await RecipeModel.getRecipes(page, limit, filters, currentUserId);
    }

    async getRecentlyRecipes(category, tag, currentUserId) {
        console.log('Recently Recipes - Category:', category, 'Tag:', tag, 'Current User ID:', currentUserId);
        const recipes = await RecipeModel.getRecentlyRecipes(category, tag, 10, currentUserId);
        if (!recipes || recipes.length === 0) throw new AppError('Không tìm thấy công thức nào gần đây', 404);
        return recipes;
    }

    async getFeatureRecipes() {
        const recipes = await RecipeModel.getFeatureRecipes();
        if (!recipes || recipes.length === 0) throw new AppError('Không có feature thỏa mãn', 404);
        return recipes;
    }

    async getOwnerRecipe(userId) {
        return await RecipeModel.getOwnerRecipe(userId);
    }

    async getUserRecipe(userId) {
        return await RecipeModel.getUserRecipe(userId);
    }

    async getPreviewComments(recipeId) {
        return await RecipeModel.getPreviewComments(recipeId);
    }

    async getSavedRecipes(userId, sortKey, sortOrder, limit, page) {
        return await RecipeModel.getSavedRecipes(userId, sortKey, sortOrder, limit, page);
    }
}

module.exports = new RecipeService();