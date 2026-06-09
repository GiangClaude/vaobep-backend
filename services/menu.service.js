const MenuModel = require('../models/menu.model');
const aiService = require('../services/ai.service');
const AppError = require('../utils/AppError');
const db = require('../config/db');
class MenuService {
 async createMenu(userId, menuData) {
        if (!menuData || !menuData.name) throw new AppError('Tên thực đơn không được để trống', 400);
        if (userId == null) throw new AppError('Unauthorized: User ID is missing', 401);

        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();
            // Truyền connection xuống Model
            const newMenu = await MenuModel.create(connection, userId, menuData);
            await connection.commit();
            return newMenu;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async updateMenu(menuId, userId, menuData) {
        const existingMenu = await MenuModel.findById(menuId);
        if (!existingMenu) throw new AppError('Không tìm thấy thực đơn', 404);
        if (existingMenu.user_id !== userId) throw new AppError('Bạn không có quyền sửa thực đơn này', 403);

        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();
            // Truyền connection xuống Model
            await MenuModel.update(connection, menuId, userId, menuData);
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async getUserMenus(userId) {
        return await MenuModel.getUserMenus(userId);
    }

    async getMenuById(menuId) {
        const menu = await MenuModel.findById(menuId);
        if (!menu) throw new AppError('Không tìm thấy thực đơn', 404);
        return menu;
    }

    async deleteMenu(menuId, userId) {
        const isDeleted = await MenuModel.delete(menuId, userId);
        if (!isDeleted) throw new AppError('Xóa thất bại. Có thể menu không tồn tại hoặc bạn không có quyền.', 400);
        return true;
    }

    async getShoppingList(menuId) {
        return await MenuModel.generateShoppingList(menuId);
    }

    async getPublicMenus() {
        return await MenuModel.getPublicMenus();
    }

    async cloneMenu(menuId, userId) {
        const existingMenu = await MenuModel.findById(menuId);
        if (!existingMenu) throw new AppError('Không tìm thấy thực đơn gốc', 404);
        if (!existingMenu.is_public && existingMenu.user_id !== userId) {
            throw new AppError('Thực đơn này đang ở chế độ riêng tư', 403);
        }

        existingMenu.name = existingMenu.name + ' (Bản sao)';
        existingMenu.is_public = false;
        existingMenu.cloned_from_id = menuId;

        return await MenuModel.create(userId, existingMenu);
    }

    async getPublicMenusByUser(userId) {
        return await MenuModel.getPublicMenusByUser(userId);
    }

    async consultMenuAI(menuState = {}) {
        const simplifiedMenu = {
            total_days: menuState.days?.length || 0,
            days: menuState.days?.map(d => ({
                day: d.title,
                meals: d.meals?.map(m => ({
                    meal: m.meal_type,
                    recipes: m.recipes?.map(r => ({
                        name: r.title,
                        calo: Math.round((r.total_calo || 0) * (r.servings_multiplier || 1))
                    }))
                }))
            }))
        };

        return await aiService.analyzeMenuWithAI(simplifiedMenu);
    }

    async generateMenuAI(prompt) {
        if (!prompt) throw new AppError('Thiếu prompt yêu cầu.', 400);
        return await aiService.generateMenuWithRAG(prompt);
    }
}

module.exports = new MenuService();