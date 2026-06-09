const { pool } = require('../config/db');
const RecipeLinkModel = require('./recipe_link.model');

const DictionaryDish = {
    // Lấy danh sách có phân trang và tìm kiếm
    getAll: async (limit, offset, search = '', sortKey = 'created_at', sortOrder = 'DESC') => {
        const searchTerm = `%${search}%`;
        // Map public sort keys to DB columns
        const sortMapping = {
            name: 'original_name',
            country: 'country',
            created_at: 'created_at'
        };

        const key = sortMapping[sortKey] || sortMapping['created_at'];
        const order = (String(sortOrder).toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

        const query = `
            SELECT * FROM Dictionary_Dishes 
            WHERE original_name LIKE ? OR english_name LIKE ? OR country LIKE ?
            ORDER BY ${key} ${order}
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.execute(query, [searchTerm, searchTerm, searchTerm, String(limit), String(offset)]);
        return rows;
    },

    // Đếm tổng số bản ghi để phân trang
    countAll: async (search = '') => {
        const searchTerm = `%${search}%`;
        const query = `
            SELECT COUNT(*) as total 
            FROM Dictionary_Dishes 
            WHERE original_name LIKE ? OR english_name LIKE ? OR country LIKE ?
        `;
        const [rows] = await pool.execute(query, [searchTerm, searchTerm, searchTerm]);
        return rows[0].total;
    },

    // Alias for dashboard usage: count all dishes (keeps API stable)
    countAllDishes: async (search = '') => {
        const searchTerm = `%${search}%`;
        const query = `
            SELECT COUNT(*) as total 
            FROM Dictionary_Dishes 
            WHERE original_name LIKE ? OR english_name LIKE ? OR country LIKE ?
        `;
        const [rows] = await pool.execute(query, [searchTerm, searchTerm, searchTerm]);
        return rows[0].total;
    },

    // Lấy chi tiết một món ăn
    getById: async (id) => {
        const query = `SELECT * FROM Dictionary_Dishes WHERE dish_id = ?`;
        const [rows] = await pool.execute(query, [id]);
        return rows[0];
    },

    getEateriesByDishId: async (id) => {
        const [eateries] = await pool.execute(
            `SELECT name, address FROM Dish_Eateries WHERE dish_id = ?`, [id]
        );
        return eateries;
    },

    getMapSummary: async () => {
        const query = `
            SELECT 
                d.country, 
                c.lat, c.lng, 
                COUNT(*) as total_dishes,
                (SELECT image_url FROM Dictionary_Dishes d2 
                 WHERE d2.country = d.country ORDER BY point DESC LIMIT 1) as top_dish_image,
                (SELECT original_name FROM Dictionary_Dishes d2 
                 WHERE d2.country = d.country ORDER BY point DESC LIMIT 1) as top_dish_name
            FROM Dictionary_Dishes d
            JOIN Countries_Coordinates c ON d.country = c.country_name
            GROUP BY d.country
        `;
        const [rows] = await pool.execute(query);
        return rows;
    },

    getMapAllDishes: async () => {
        const query = `
            SELECT dish_id, original_name, english_name, description, image_url, point, country, latitude, longitude 
            FROM Dictionary_Dishes 
            WHERE latitude IS NOT NULL
        `;
        const [rows] = await pool.execute(query);
        return rows;
    },

    getFullDetail: async (id) => {
        // 1. Lấy thông tin cơ bản của món ăn
        const [dishRows] = await pool.execute(
            `SELECT * FROM Dictionary_Dishes WHERE dish_id = ?`, [id]
        );
        if (dishRows.length === 0) return null;
        const dish = dishRows[0];

        // 2. Lấy danh sách địa điểm ăn uống (Eateries)
        const [eateries] = await pool.execute(
            `SELECT name, address FROM Dish_Eateries WHERE dish_id = ?`, [id]
        );

        // 3. Lấy danh sách công thức liên kết (Recipes)
        // const recipes = await RecipeLinkModel.getRecipesByPost(id, 'dish');

        return { ...dish, eateries};
    },

    // --- THÊM MỚI TỪ ĐÂY: API CHO ADMIN CRUD TỪ ĐIỂN MÓN ĂN ---

    // Tạo món ăn mới
    createDish: async (dishData) => {
        const {
            dish_id, admin_id, original_name, english_name, description, history,
            country, image_url, latitude, longitude
        } = dishData;

        const query = `
            INSERT INTO Dictionary_Dishes 
            (dish_id, admin_id, original_name, english_name, description, history, country, image_url, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            dish_id, admin_id, original_name, english_name || null, description || null, history || null,
            country || null, image_url || null, latitude || null, longitude || null
        ];

        const [result] = await pool.execute(query, values);
        return result;
    },

    // Cập nhật thông tin món ăn (Dynamic Update)
    updateDish: async (dishId, updateData) => {
        const keys = Object.keys(updateData).filter(key => updateData[key] !== undefined);
        if (keys.length === 0) return null;

        const setClauses = keys.map(key => `\`${key}\` = ?`);
        setClauses.push('update_at = NOW()');
        
        const values = keys.map(key => updateData[key]);
        values.push(dishId);

        const query = `UPDATE Dictionary_Dishes SET ${setClauses.join(', ')} WHERE dish_id = ?`;
        const [result] = await pool.execute(query, values);
        return result;
    },

    // Xóa món ăn (ON DELETE CASCADE sẽ tự động xóa trong bảng dish_eateries)
    deleteDish: async (dishId) => {
        const query = `DELETE FROM Dictionary_Dishes WHERE dish_id = ?`;
        const [result] = await pool.execute(query, [dishId]);
        return result;
    },

    // Thêm các địa điểm ăn uống (Eateries) cho 1 món ăn
    addEateries: async (dishId, eateriesArray) => {
        if (!eateriesArray || eateriesArray.length === 0) return;

        // eateriesArray format: [{ eatery_id, name, address, user_id (có thể null) }]
        const query = `INSERT INTO Dish_Eateries (eatery_id, dish_id, name, address) VALUES (?, ?, ?, ?)`;
        
        // Chạy Promise.all để insert nhiều dòng
        const promises = eateriesArray.map(eatery => {
            return pool.execute(query, [eatery.eatery_id, dishId, eatery.name, eatery.address]);
        });

        await Promise.all(promises);
    },

    // Xóa toàn bộ Eateries của 1 món ăn (Dùng khi update lại danh sách quán ăn)
    deleteEateriesByDishId: async (dishId) => {
        const query = `DELETE FROM Dish_Eateries WHERE dish_id = ?`;
        await pool.execute(query, [dishId]);
    }
    
    // --- KẾT THÚC PHẦN THÊM MỚI ---


};

module.exports = DictionaryDish;