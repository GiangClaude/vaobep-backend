// VỊ TRÍ: backend/services/admin/adminIngredient.service.js
const { v4: uuidv4 } = require('uuid');
const IngredientModel = require('../../models/ingredient.model');
const AppError = require('../../utils/AppError');

class AdminIngredientService {
    /**
     * Lấy danh sách nguyên liệu đang chờ duyệt
     */
    async getPendingIngredients() {
        return await IngredientModel.getPendingIngredients();
    }

    /**
     * Duyệt hoặc từ chối nguyên liệu do user đề xuất
     */
    async processIngredient(id, action, calo_per_100g) {
        if (action === 'approve') {
            await IngredientModel.updateStatus(id, 'approved');
            if (calo_per_100g !== undefined && calo_per_100g !== null) {
                await IngredientModel.updateCalo(id, calo_per_100g);
            }
            return 'Ingredient approved';
        } else if (action === 'reject') {
            await IngredientModel.updateStatus(id, 'reject');
            return 'Ingredient rejected';
        } else {
            throw new AppError('Invalid action', 400);
        }
    }

    /**
     * Lấy toàn bộ nguyên liệu (có phân trang, search)
     */
    async getAllIngredients(page, limit, search, sortKey, sortOrder) {
        const offset = (page - 1) * limit;
        const ingredients = await IngredientModel.getAllAdmin(limit, offset, search, sortKey, sortOrder);
        const total = await IngredientModel.countAllAdmin(search);

        return { ingredients, total, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Admin tạo nguyên liệu mới
     */
    async createIngredient(name, calo_per_100g, status) {
        if (!name) throw new AppError('Tên nguyên liệu không được để trống', 400);

        const ingredientId = uuidv4();
        const ingStatus = status || 'approved';

        await IngredientModel.create(ingredientId, name.trim(), ingStatus);

        if (calo_per_100g !== undefined && calo_per_100g !== null && calo_per_100g !== '') {
            await IngredientModel.updateCalo(ingredientId, calo_per_100g);
        }

        return ingredientId;
    }

    /**
     * Cập nhật thông tin nguyên liệu
     */
    async updateIngredient(id, name, calo_per_100g, status) {
        if (name) await IngredientModel.updateName(id, name.trim());
        if (calo_per_100g !== undefined && calo_per_100g !== null && calo_per_100g !== '') {
            await IngredientModel.updateCalo(id, calo_per_100g);
        }
        if (status) await IngredientModel.updateStatus(id, status);
        
        return true;
    }

    /**
     * Xóa nguyên liệu
     */
    async deleteIngredient(id) {
        try {
            await IngredientModel.delete(id);
            return true;
        } catch (error) {
            // Lỗi ER_ROW_IS_REFERENCED_2 xảy ra khi nguyên liệu đang nằm trong 1 công thức nào đó
            if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                throw new AppError('Không thể xóa nguyên liệu này vì đang được sử dụng trong công thức nấu ăn.', 400);
            }
            throw error;
        }
    }
}

module.exports = new AdminIngredientService();