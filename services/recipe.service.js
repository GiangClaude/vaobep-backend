const path = require('path');
const fsPromises = require('fs').promises; // Dùng promises để xóa file
const db = require('../config/db'); // Kéo db vào để dùng Transaction
const RecipeModel = require('../models/recipe.model');
const UserModel = require('../models/user.model');
const IngredientModel = require('../models/ingredient.model'); 
const UnitModel = require('../models/unit.model');
const TagModel = require('../models/tag.model');
const AppError = require('../utils/AppError');
const { checkRecipeOwner } = require('../utils/recipe.utils');
const { addVectorSyncJob } = require('./vectorQueue.service');
const { deleteCloudinaryImage } = require('../utils/cloudinary');

const {DEFAULT_RECIPE_IMG} = require("../config/constants")
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
                let parsedSteps = [];
                try {
                    parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
                    
                    const stepImageFiles = (files && files['step_images']) ? files['step_images'] : [];
                    let fileIndex = 0;

                    parsedSteps = parsedSteps.map(step => {
                        if (step.hasNewFile && stepImageFiles[fileIndex]) {
                            step.image = stepImageFiles[fileIndex].path;
                            fileIndex++;
                        }
                        delete step.hasNewFile;
                        return step;
                    });
                    
                    finalInstructions = JSON.stringify(parsedSteps);
                } catch (e) {
                    finalInstructions = typeof steps === 'object' ? JSON.stringify(steps) : steps;
                }
            }

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
            let resultImagesList = [];
            
            if (files && files.length > 0) {
                files.forEach(file => {
                    if (file.fieldname === 'cover_image') {
                        coverImageName = file.path;
                    } else if (file.fieldname === 'result_images') {
                        resultImagesList.push({ url: file.path, description: "Thành phẩm" });
                    } else if (file.fieldname.startsWith('step_image_')) {
                        const stepIndex = parseInt(file.fieldname.split('_')[2]);
                        resultImagesList.push({ url: file.path, description: `Bước ${stepIndex + 1}` });
                    }
                });
            }

            let cleanInstructions = [];
            if (steps) {
                const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
                cleanInstructions = parsedSteps.map(s => ({ step: s.step, description: s.description }));
            }
            finalInstructions = JSON.stringify(cleanInstructions);

            let processedIngredients = [];
            if (ingredientsList && ingredientsList.length > 0) {
                for (const ing of ingredientsList) {
                    const ingredient = await IngredientModel.findOrCreate(ing.name, connection);
                    const unitId = await UnitModel.findOrCreate(ing.unit, connection);
                    
                    processedIngredients.push({
                        ingredientId: ingredient.id,
                        unitId: unitId,
                        quantity: parseFloat(ing.amount || ing.quantity)
                    });
                }
            }

            const newRecipe = await RecipeModel.create(connection, {
                recipeId, userId, title, description, instructions: finalInstructions,
                coverImage: coverImageName, servings: finalServings, cookTime: finalCookTime,
                totalCalo: finalTotalCalo, ingredientsData: processedIngredients, 
                status: body.status || 'draft', resultImages: resultImagesList
            });

            if (finalTags && finalTags.length > 0) {
                await TagModel.addTagsToPost(recipeId, 'recipe', finalTags, connection);
            }

            await connection.commit();

            if (newRecipe.status === 'public') {
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

            let { title, description, servings, cookTime, cook_time, totalCalo, total_calo, ingredients, status, tags, steps, cover_image } = body;

            const finalCookTime = cookTime || cook_time || 60;
            const finalTotalCalo = totalCalo || total_calo || 0;
            const finalServings = servings || 1;
            let finalTags = null;

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
                title, description, servings: finalServings,
                cook_time: finalCookTime, total_calo: finalTotalCalo, status: status || 'draft',
            };

            const oldRecipe = await RecipeModel.findById(recipeId);

            if (cover_image === "") {
                recipeData.cover_image = ""; 
                if (oldRecipe && oldRecipe.cover_image && oldRecipe.cover_image !== DEFAULT_RECIPE_IMG) {
                    deleteCloudinaryImage(oldRecipe.cover_image); 
                }
            }

            let resultImagesList = [];

            if (files && files.length > 0) {
                files.forEach(file => {
                    if (file.fieldname === 'cover_image') {
                        recipeData.cover_image = file.path;
                    } else if (file.fieldname.startsWith('step_image_')) {
                        const stepIndex = parseInt(file.fieldname.split('_')[2]);
                        resultImagesList.push({ url: file.path, description: `Bước ${stepIndex + 1}` });
                    }
                });
            }

            if (recipeData.cover_image && recipeData.cover_image !== "") {
                if (oldRecipe && oldRecipe.cover_image && oldRecipe.cover_image !== DEFAULT_RECIPE_IMG && recipeData.cover_image !== oldRecipe.cover_image) {
                    deleteCloudinaryImage(oldRecipe.cover_image);
                }
            }

            let cleanInstructions = [];
            if (steps) {
                const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
                cleanInstructions = parsedSteps.map((s, index) => {
                    if (s.existingImage) {
                        resultImagesList.push({ url: s.existingImage, description: `Bước ${index + 1}` });
                    }
                    return { step: s.step, description: s.description };
                });
            }
            recipeData.instructions = JSON.stringify(cleanInstructions);
            recipeData.resultImages = resultImagesList; 

            // 3. DỌN RÁC CLOUDINARY 
            if (oldRecipe && oldRecipe.images && oldRecipe.images.length > 0) {
                const newImageUrls = resultImagesList.map(img => img.url);
                oldRecipe.images.forEach(oldImg => {
                    if (!newImageUrls.includes(oldImg.imgLink) && oldImg.imgLink.includes('cloudinary.com')) {
                        deleteCloudinaryImage(oldImg.imgLink);
                    }
                });
            }

            let processedIngredients = [];
            let newIngredientsPending = false;
            if (ingredientsList && ingredientsList.length > 0) {
                for (const item of ingredientsList) {
                    const { name: ingredientName, amount, unit: unitName } = item;
                    
                    const ingredient = await IngredientModel.findOrCreate(ingredientName, connection);
                    const unitId = await UnitModel.findOrCreate(unitName, connection);
                    
                    if (ingredient.status === 'pending') {
                        newIngredientsPending = true;
                    }

                    processedIngredients.push({
                        ingredientId: ingredient.id,
                        unitId: unitId,
                        quantity: parseFloat(amount)
                    });
                }
            }
            const result = await RecipeModel.update(recipeId, recipeData, processedIngredients, connection);
            result.notification = newIngredientsPending ? 'Nguyên liệu mới đang chờ duyệt.' : null;

            if (finalTags !== null) {
                await TagModel.updateTagsForPost(recipeId, 'recipe', finalTags, connection);
            }

            await connection.commit();

            if (recipeData.status === 'public') {
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
        const oldRecipe = await RecipeModel.findById(recipeId);
        const result = await RecipeModel.deleteById(recipeId);

        if (oldRecipe && oldRecipe.cover_image && oldRecipe.cover_image !== DEFAULT_RECIPE_IMG) {
            deleteCloudinaryImage(oldRecipe.cover_image);
        }

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

        if (status === 'public') {
            addVectorSyncJob(recipeId, 'recipe', 'upsert');
        } else {
            addVectorSyncJob(recipeId, 'recipe', 'delete');
        }

        return status;
    }

    async searchSimpleRecipes(keyword, userId) {

        if (!keyword) return [];
        return await RecipeModel.searchSimpleRecipes(keyword);
    }

    async getRecipeById(recipeId) {
        const recipeData = await RecipeModel.findById(recipeId);
        if (!recipeData) throw new AppError('Không tìm thấy công thức', 404);
        return recipeData;
    }

    async getRecipes(page, limit, filters, currentUserId) {
        return await RecipeModel.getRecipes(page, limit, filters, currentUserId);
    }

    async getRecentlyRecipes(category, tag, currentUserId) {
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