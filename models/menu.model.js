const db = require('../config/db');
const pool = db.pool;
const { v4: uuidv4 } = require('uuid');

class MenuModel {
    /**
     * TẠO MENU MỚI (Lưu cả Ngày, Bữa, Món bằng Transaction)
     */
    static async create(connection, userId, menuData) {
            const menuId = uuidv4();
            const { name, description, is_public, cloned_from_id, days } = menuData;

            // 1. Insert Menu
            const sqlMenu = `
                INSERT INTO menus (menu_id, user_id, name, description, is_public, cloned_from_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            await connection.execute(sqlMenu, [
                menuId, 
                userId, 
                name, 
                description || null, 
                is_public || false, 
                cloned_from_id || null
            ]);

            // 2. Insert Nested Data (Days -> Meals -> Recipes)
            if (days && days.length > 0) {
                for (let i = 0; i < days.length; i++) {
                    const day = days[i];
                    const dayId = uuidv4();
                    
                    // Insert Day
                    await connection.execute(
                        `INSERT INTO menu_days (day_id, menu_id, day_index, title) VALUES (?, ?, ?, ?)`,
                        [dayId, menuId, i + 1, day.title || `Ngày ${i + 1}`]
                    );

                    if (day.meals && day.meals.length > 0) {
                        for (const meal of day.meals) {
                            const mealId = uuidv4();
                            
                            // Insert Meal
                            await connection.execute(
                                `INSERT INTO menu_meals (meal_id, day_id, meal_type, title, note) VALUES (?, ?, ?, ?, ?)`,
                                [mealId, dayId, meal.meal_type || 'breakfast', meal.title || null, meal.note || null]
                            );

                            if (meal.recipes && meal.recipes.length > 0) {
                                for (const recipe of meal.recipes) {
                                    // Insert Recipe
                                    await connection.execute(
                                        `INSERT INTO menu_recipes (meal_id, recipe_id, servings_multiplier) VALUES (?, ?, ?)`,
                                        [mealId, recipe.recipe_id, recipe.servings_multiplier || 1.0]
                                    );
                                }
                            }
                        }
                    }
                }
            }

            return { menu_id: menuId, name };
    }

    /**
     * LẤY CHI TIẾT 1 MENU (Dựng lại cấu trúc cây JSON)
     */
    static async findById(menuId) {
        try {
            // 1. Lấy thông tin Menu
            const [menus] = await pool.execute(`SELECT * FROM menus WHERE menu_id = ?`, [menuId]);
            if (menus.length === 0) return null;
            const menu = menus[0];

            // 2. Lấy danh sách Ngày
            const [days] = await pool.execute(
                `SELECT * FROM menu_days WHERE menu_id = ? ORDER BY day_index ASC`, 
                [menuId]
            );

            // 3. Lấy danh sách Bữa ăn thuộc Menu này
            const [meals] = await pool.execute(
                `SELECT mm.* FROM menu_meals mm 
                 JOIN menu_days md ON mm.day_id = md.day_id 
                 WHERE md.menu_id = ?
                 ORDER BY md.day_index ASC, FIELD(mm.meal_type, 'breakfast', 'lunch', 'dinner', 'snack') ASC`,
                [menuId]
            );

            // 4. Lấy danh sách Món ăn (kèm thông tin hiển thị cơ bản)
            const [recipes] = await pool.execute(
                `SELECT mr.*, r.title, r.cover_image, r.total_calo, r.cook_time, r.status 
                 FROM menu_recipes mr 
                 JOIN menu_meals mm ON mr.meal_id = mm.meal_id 
                 JOIN menu_days md ON mm.day_id = md.day_id 
                 JOIN recipes r ON mr.recipe_id = r.recipe_id 
                 WHERE md.menu_id = ?`,
                [menuId]
            );

            // DỰNG LẠI CẤU TRÚC CÂY (Lắp ráp nested JSON)
            menu.days = days.map(day => {
                const dayMeals = meals.filter(m => m.day_id === day.day_id);
                day.meals = dayMeals.map(meal => {
                    meal.recipes = recipes.filter(r => r.meal_id === meal.meal_id);
                    return meal;
                });
                return day;
            });

            return menu;
        } catch (error) {
            console.error('Lỗi MenuModel (findById):', error);
            throw error;
        }
        // Đã xóa khối finally { if(connection) connection.release() } vì không dùng connection nữa
    }

    /**
     * LẤY DANH SÁCH MENU CỦA USER
     */
    static async getUserMenus(userId) {
        try {
            const sql = `
                SELECT m.*, 
                       (SELECT COUNT(md.day_id) FROM menu_days md WHERE md.menu_id = m.menu_id) as total_days
                FROM menus m 
                WHERE m.user_id = ? 
                ORDER BY m.created_at DESC
            `;
            const [rows] = await pool.execute(sql, [userId]);
            return rows;
        } catch (error) {
            console.error('Lỗi MenuModel (getUserMenus):', error);
            throw error;
        }
    }

    /**
     * CẬP NHẬT MENU (Ghi đè cấu trúc lồng)
     */
    static async update(connection,menuId, userId, menuData) {
            const { name, description, is_public, days } = menuData;

            // 1. Update basic info
            await connection.execute(
                `UPDATE menus SET name = ?, description = ?, is_public = ? WHERE menu_id = ? AND user_id = ?`,
                [name, description || null, is_public || false, menuId, userId]
            );

            // 2. XÓA TOÀN BỘ NGÀY CŨ (Nhờ ON DELETE CASCADE, meals và recipes bên trong tự động bay theo)
            await connection.execute(`DELETE FROM menu_days WHERE menu_id = ?`, [menuId]);

            // 3. INSERT LẠI CẤU TRÚC MỚI (Copy logic từ hàm Create)
            if (days && days.length > 0) {
                for (let i = 0; i < days.length; i++) {
                    const day = days[i];
                    const dayId = uuidv4();
                    
                    await connection.execute(
                        `INSERT INTO menu_days (day_id, menu_id, day_index, title) VALUES (?, ?, ?, ?)`,
                        [dayId, menuId, i + 1, day.title || `Ngày ${i + 1}`]
                    );

                    if (day.meals && day.meals.length > 0) {
                        for (const meal of day.meals) {
                            const mealId = uuidv4();
                            
                            await connection.execute(
                                `INSERT INTO menu_meals (meal_id, day_id, meal_type, title, note) VALUES (?, ?, ?, ?, ?)`,
                                [mealId, dayId, meal.meal_type || 'breakfast', meal.title || null, meal.note || null]
                            );

                            if (meal.recipes && meal.recipes.length > 0) {
                                for (const recipe of meal.recipes) {
                                    await connection.execute(
                                        `INSERT INTO menu_recipes (meal_id, recipe_id, servings_multiplier) VALUES (?, ?, ?)`,
                                        [mealId, recipe.recipe_id, recipe.servings_multiplier || 1.0]
                                    );
                                }
                            }
                        }
                    }
                }
            }
        return { success: true };   
    }

    /**
     * XÓA MENU
     */
    static async delete(menuId, userId) {
        try {
            // Cascade delete sẽ lo phần Days, Meals, Recipes
            const [result] = await pool.execute(
                `DELETE FROM menus WHERE menu_id = ? AND user_id = ?`,
                [menuId, userId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Lỗi MenuModel (delete):', error);
            throw error;
        }
    }

    /**
     * TẠO DANH SÁCH ĐI CHỢ TỰ ĐỘNG
     */
    static async generateShoppingList(menuId) {
        try {
            const sql = `
                SELECT 
                    i.category,
                    i.name AS ingredient_name,
                    u.name AS unit_name,
                    SUM(ri.quantity * mr.servings_multiplier) AS total_quantity
                FROM menu_recipes mr
                JOIN menu_meals mm ON mr.meal_id = mm.meal_id
                JOIN menu_days md ON mm.day_id = md.day_id
                JOIN recipe_ingredients ri ON mr.recipe_id = ri.recipe_id
                JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
                JOIN units u ON ri.unit_id = u.unit_id
                WHERE md.menu_id = ?
                GROUP BY i.category, i.ingredient_id, u.unit_id, i.name, u.name
                ORDER BY i.category ASC, i.name ASC
            `;
            const [rows] = await pool.execute(sql, [menuId]);

            // Format lại data theo nhóm (Category) cho dễ hiển thị ở UI
            const groupedList = rows.reduce((acc, row) => {
                const cat = row.category || 'others';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push({
                    name: row.ingredient_name,
                    quantity: Math.round(row.total_quantity * 100) / 100, // Làm tròn 2 chữ số thập phân
                    unit: row.unit_name
                });
                return acc;
            }, {});

            return groupedList;
        } catch (error) {
            console.error('Lỗi MenuModel (generateShoppingList):', error);
            throw error;
        }
    }

    /**
     * LẤY DANH SÁCH THỰC ĐƠN CÔNG KHAI (Dành cho tab Khám phá)
     */
    static async getPublicMenus() {
        try {
            // Lấy thêm thông tin người tạo (bảng users) để hiển thị "Đăng bởi Admin / Vào Bếp"
            const sql = `
                SELECT m.*, 
                       u.full_name AS author_name, 
                       u.avatar AS author_avatar,
                       u.role AS author_role,
                       u.user_id AS author_id,
                       (SELECT COUNT(md.day_id) FROM menu_days md WHERE md.menu_id = m.menu_id) as total_days
                FROM menus m 
                JOIN users u ON m.user_id = u.user_id
                WHERE m.is_public = true 
                ORDER BY m.created_at DESC
                LIMIT 50
            `;
            const [rows] = await pool.execute(sql);
            return rows;
        } catch (error) {
            console.error('Lỗi MenuModel (getPublicMenus):', error);
            throw error;
        }
    }

    /**
     * LẤY THỰC ĐƠN PUBLIC CỦA 1 USER CỤ THỂ (Cho trang cá nhân)
     */
    static async getPublicMenusByUser(userId) {
        try {
            const sql = `
                SELECT m.*, 
                       (SELECT COUNT(md.day_id) FROM menu_days md WHERE md.menu_id = m.menu_id) as total_days
                FROM menus m 
                WHERE m.user_id = ? AND m.is_public = true
                ORDER BY m.created_at DESC
            `;
            const [rows] = await pool.execute(sql, [userId]);
            return rows;
        } catch (error) {
            console.error('Lỗi MenuModel (getPublicMenusByUser):', error);
            throw error;
        }
    }
}

module.exports = MenuModel;