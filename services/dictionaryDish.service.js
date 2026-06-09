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
            console.log("Dich Service: ", result);
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

    /**
     * Lấy tọa độ trung tâm quốc gia từ DB và tạo độ lệch ngẫu nhiên (jitter) phục vụ hiển thị bản đồ
     */
    async generateJitteredCoordinates(countryName) {
        const [rows] = await db.pool.execute(
            'SELECT lat, lng FROM Countries_Coordinates WHERE country_name = ?',
            [countryName]
        );

        if (rows.length > 0) {
            const { lat, lng } = rows[0];
            const jitter = 0.8; 
            return {
                latitude: lat + (Math.random() - 0.5) * jitter * 2,
                longitude: lng + (Math.random() - 0.5) * jitter * 2
            };
        }
        return { latitude: null, longitude: null };
    }

    /**
     * Tính toán lại điểm tổng hợp (point) của món ăn dựa trên số lượng tương tác (like, comment, report...)
     */
    async recalculatePoint(dishId) {
        const query = `
            UPDATE Dictionary_Dishes 
            SET point = (like_count * 1) + (comment_count * 2) + (eatery_count * 3) + (recipe_link_count * 5) - (report_count * 10)
            WHERE dish_id = ?
        `;
        await db.pool.execute(query, [dishId]);
    }
}

module.exports = new DictionaryDishService();