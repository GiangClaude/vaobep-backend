const db = require('../config/db');

class ExtensionModel {
    static async getRandomRecipes(limit = 3) {
        const sql = `
            SELECT recipe_id, title, cover_image, cook_time, total_calo 
            FROM recipes 
            WHERE status = 'public' 
            ORDER BY RAND() 
            LIMIT ${parseInt(limit) || 3} 
        `;
        const [rows] = await db.pool.execute(sql);
        return rows;
    }

    static async searchRecipesByTitle(searchTerm, limit = 5) {
        const sql = `
            SELECT recipe_id, title, cover_image, cook_time, total_calo
            FROM recipes 
            WHERE status = 'public' AND title LIKE ? 
            ORDER BY RAND()
            LIMIT ${parseInt(limit) || 5}
        `;
        const [rows] = await db.pool.execute(sql, [searchTerm]);
        return rows;
    }

    static async getRecipesByIds(ids) {
        if (!ids || ids.length === 0) return [];
        
        const placeholders = ids.map(() => '?').join(',');
        // Dùng ORDER BY FIELD để giữ đúng thứ tự được sắp xếp từ Pinecone
        const sql = `
            SELECT recipe_id, title, cover_image, cook_time, total_calo 
            FROM recipes 
            WHERE status = 'public' AND recipe_id IN (${placeholders})
            ORDER BY FIELD(recipe_id, ${placeholders})
        `;
        // Truyền mảng ids 2 lần (1 cho IN, 1 cho FIELD)
        const [rows] = await db.pool.execute(sql, [...ids, ...ids]);
        return rows;
    }
}

module.exports = ExtensionModel;