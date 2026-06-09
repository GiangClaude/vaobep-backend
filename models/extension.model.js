const db = require('../config/db');

class ExtensionModel {
    static async getRandomRecipes(limit = 3) {
        const sql = `
            SELECT recipe_id, title, cover_image, cook_time, total_calo 
            FROM recipes 
            WHERE status = 'public' 
            ORDER BY RAND() 
            LIMIT ?
        `;
        const [rows] = await db.pool.execute(sql, [limit.toString()]);
        return rows;
    }

    static async searchRecipesByTitle(searchTerm, limit = 5) {
        const sql = `
            SELECT recipe_id, title, cover_image, cook_time, total_calo
            FROM recipes 
            WHERE status = 'public' AND title LIKE ? 
            ORDER BY RAND()
            LIMIT ?
        `;
        const [rows] = await db.pool.execute(sql, [searchTerm, limit.toString()]);
        return rows;
    }
}

module.exports = ExtensionModel;