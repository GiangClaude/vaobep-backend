// ingredients.model.js
const db = require('../config/db');
const pool = db.pool;

class Ingredient {
    // ... các hàm create, update cũ của bạn ...
    static async getAll() {
        const [rows] = await pool.execute('SELECT * FROM ingredients');
        return rows;
    }

    // --- HÀM MỚI CHUYỂN SANG ---
    static async getByRecipeIds(recipeIds) {
        if (!recipeIds || recipeIds.length === 0) return [];
        
        // Tạo chuỗi dấu ? cho câu query IN (...)
        const placeholders = recipeIds.map(() => '?').join(',');
        
        // Query bảng trung gian recipe_ingredients JOIN với Ingredients
        const sql = `
            SELECT ri.recipe_id, i.name
            FROM recipe_ingredients ri
            JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
            WHERE ri.recipe_id IN (${placeholders})
        `;
        
        const [rows] = await pool.execute(sql, recipeIds);
        return rows;
    }

    static async getPendingIngredients(search = '') {
        let query = `
            SELECT i.ingredient_id, i.name, i.status, c.calo_per_100g 
            FROM Ingredients i
            LEFT JOIN CaloForIngredients c ON i.ingredient_id = c.ingredient_id
            WHERE i.status = 'pending'
        `;
        
        const params = [];
        if (search) {
            query += ` AND i.name LIKE ?`;
            params.push(`%${search}%`);
        }
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // 2. Duyệt hoặc Từ chối nguyên liệu
    static async updateStatus(id, status){
        const query = `UPDATE Ingredients SET status = ? WHERE ingredient_id = ?`;
        const [result] = await pool.execute(query, [status, id]); // Sửa db.execute -> pool.execute
        return result;
    }
    
    // 3. Cập nhật Calo (Admin sửa lại calo cho đúng trước khi duyệt)
   static async updateCalo(id, calo) {
        const query = `
            INSERT INTO CaloForIngredients (ingredient_id, calo_per_100g) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE calo_per_100g = ?
        `;
        const [result] = await pool.execute(query, [id, calo, calo]); // Sửa db.execute -> pool.execute
        return result;
    }
    // --- THÊM MỚI TỪ ĐÂY: API CHO ADMIN CRUD ---

    // 4. Lấy danh sách nguyên liệu cho Admin (Có phân trang, Search, Join Calo)
    static async getAllAdmin(limit, offset, search = '', sortKey = 'name', sortOrder = 'ASC') {
        // Whitelist mapping from public sort keys to actual DB columns
        const sortMapping = {
            name: 'i.name',
            status: 'i.status',
            calo: 'c.calo_per_100g'
        };

        const allowed = Object.keys(sortMapping);
        const key = allowed.includes(sortKey) ? sortMapping[sortKey] : sortMapping['name'];
        const order = (String(sortOrder).toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

        let query = `
            SELECT i.ingredient_id, i.name, i.status, c.calo_per_100g 
            FROM Ingredients i
            LEFT JOIN CaloForIngredients c ON i.ingredient_id = c.ingredient_id
        `;
        const params = [];

        if (search) {
            query += ` WHERE i.name LIKE ?`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY ${key} ${order} LIMIT ? OFFSET ?`;
        params.push(limit.toString(), offset.toString());

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // 5. Đếm tổng số nguyên liệu cho Admin (Hỗ trợ phân trang)
    static async countAllAdmin(search = '') {
        let query = `SELECT COUNT(*) as total FROM Ingredients`;
        const params = [];

        if (search) {
            query += ` WHERE name LIKE ?`;
            params.push(`%${search}%`);
        }

        const [rows] = await pool.execute(query, params);
        return rows[0].total;
    }

    // Alias for dashboard usage
    static async countAllIngredients(search = '') {
        return await Ingredient.countAllAdmin(search);
    }

    // 6. Tạo nguyên liệu mới (Admin tạo thủ công)
    static async create(id, name, status = 'approved') {
        const query = `INSERT INTO Ingredients (ingredient_id, name, status) VALUES (?, ?, ?)`;
        const [result] = await pool.execute(query, [id, name, status]);
        return result;
    }

    // 7. Cập nhật tên nguyên liệu
    static async updateName(id, name) {
        const query = `UPDATE Ingredients SET name = ? WHERE ingredient_id = ?`;
        const [result] = await pool.execute(query, [name, id]);
        return result;
    }

    // 8. Xóa nguyên liệu
    static async delete(id) {
        // Lưu ý: Sẽ xảy ra lỗi SQL Error nếu nguyên liệu này đang được dùng trong recipe_ingredients
        // Lỗi này sẽ được bắt (catch) và xử lý ở tầng Controller.
        const query = `DELETE FROM Ingredients WHERE ingredient_id = ?`;
        const [result] = await pool.execute(query, [id]);
        return result;
    }

}

module.exports = Ingredient;