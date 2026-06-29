const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const RecipeModel = require('../../models/recipe.model');
const { addVectorSyncJob } = require('../vectorQueue.service');
const AppError = require('../../utils/AppError');

class AdminRecipeService {
    async getRecipes(page, limit, search, sortKey, sortOrder) {
        const offset = (page - 1) * limit;
        const recipes = await RecipeModel.getAllRecipesForAdmin(limit, offset, search, sortKey, sortOrder);
        const total = await RecipeModel.countAllRecipes(search);

        return { recipes, total, totalPages: Math.ceil(total / limit) };
    }

    async hideRecipe(id, status) {
        const targetStatus = status || 'banned';
        await RecipeModel.updateStatus(id, targetStatus);
        
        if (targetStatus === 'public' || targetStatus === 'hidden') {
            addVectorSyncJob(id, 'recipe', 'upsert');
        } else {
            addVectorSyncJob(id, 'recipe', 'delete');
        }
        return targetStatus;
    }

    async getRecipeDetail(id) {
        const recipe = await RecipeModel.findById(id);
        if (!recipe) throw new AppError('Recipe not found', 404);
        return recipe;
    }

    async createAdminRecipe(userId, data, fileInfo) {
        const recipeId = uuidv4();
        const { title, description, instructions, servings, cook_time, total_calo, ingredients, tags } = data;

        if (!title || !instructions) throw new AppError('Tên món và hướng dẫn không được để trống', 400);

        let coverImage = null;
        if (fileInfo) {
            coverImage = fileInfo.path; 
        }

        let ingredientsData = [];
        if (ingredients) {
            try {
                const rawIngredients = JSON.parse(ingredients);
                ingredientsData = rawIngredients.map(item => ({
                    name: item.name?.trim(),
                    unit: item.unit?.trim(),
                    quantity: parseFloat(item.quantity) || 0
                })).filter(item => item.name && item.unit);
            } catch (e) {
                throw new AppError('Dữ liệu nguyên liệu không hợp lệ', 400);
            }
        }

        let tagsData = [];
        if (tags) {
            try { tagsData = JSON.parse(tags); } catch (e) {  }
        }

        await RecipeModel.create(null, { 
            recipeId,
            userId,
            title,
            description,
            instructions,
            coverImage,
            servings: parseInt(servings) || 1,
            cookTime: parseInt(cook_time) || 0,
            totalCalo: parseFloat(total_calo) || 0,
            ingredientsData,
            status: 'public',
            tags: tagsData
        });

        addVectorSyncJob(recipeId, 'recipe', 'upsert');
        
        return recipeId;
    }

    async updateRecipe(id, data) {
        const { status, is_trust } = data;
        await RecipeModel.adminUpdate(id, { status, is_trust });
        
        if (status) {
            if (status === 'public' || status === 'hidden') addVectorSyncJob(id, 'recipe', 'upsert');
            else addVectorSyncJob(id, 'recipe', 'delete');
        } else {
            addVectorSyncJob(id, 'recipe', 'upsert');
        }
        return true;
    }
}

module.exports = new AdminRecipeService();