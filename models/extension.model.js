const db = require('../config/db');

class ExtensionModel {
    static async getRandomRecipes(limit = 3) {
        const sql = `
            SELECT recipe_id, title, cover_image, cook_time, total_calo 
            FROM recipes 
            WHERE status = 'public' 
            ORDER BY RAND() 
            LIMIT LIMIT ${parseInt(limit) || 3}
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
}

module.exports = ExtensionModel;