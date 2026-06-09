const db = require('../config/db');
const DictionaryDish = require('../models/dictionaryDish.model');
const RecipeLinkModel = require('../models/recipe_link.model');
const InteractionModel = require('../models/interaction.model');
const { addVectorSyncJob } = require('./vectorQueue.service');
const AppError = require('../utils/AppError');

class DictionaryDishService {
    /**
     * Lấy danh sách món ăn (có phân trang và tìm kiếm)
     */
    async getAllDishes(page, limit, search) {
        const offset = (page - 1) * limit;
        
        // Chạy song song count và get để tối ưu
        const [totalItems, dishes] = await Promise.all([
            DictionaryDish.countAll(search),
            DictionaryDish.getAll(limit, offset, search)
        ]);

        return { totalItems, dishes };
    }

    /**
     * Lấy chi tiết món ăn kèm các thông tin liên quan (Aggregation)
     */
    async getDishDetail(dishId, userId) {
        const [dish, eateries, recipes] = await Promise.all([
            DictionaryDish.getById(dishId),
            DictionaryDish.getEateriesByDishId(dishId), 
            RecipeLinkModel.getRecipesByPost(userId, dishId, 'dish') 
        ]);

        if (!dish) {
            throw new AppError('Dish not found', 404);
        }

        let interactionState = null;
        if (userId) {
            interactionState = await InteractionModel.getUserInteractionState(userId, dishId, 'dish');
        }

        return { ...dish, eateries, recipes, interactionState };
    }

    /**
     * Lấy dữ liệu tóm tắt cho Bản đồ
     */
    async getMapSummary() {
        return await DictionaryDish.getMapSummary();
    }

    /**
     * Lấy toàn bộ món ăn cho Bản đồ
     */
    async getMapAllDishes() {
        return await DictionaryDish.getMapAllDishes();
    }

    /**
     * Đề cử công thức cho món ăn (Có sử dụng Transaction)
     */
    async voteRecipeForDish(dishId, recipeId, userId) {
        if (!userId) throw new AppError('Bạn cần đăng nhập để thực hiện chức năng này', 401);

        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();

            const result = await RecipeLinkModel.toggleVote(connection, userId, recipeId, dishId, 'dish');
            
            // Đồng bộ Vector DB
            addVectorSyncJob(dishId, 'dish', 'upsert');

            await connection.commit();
            return result.action;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new DictionaryDishService();