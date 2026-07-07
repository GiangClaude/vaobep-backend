const db = require('../config/db');
const pool = db.pool;

class RecipeLinkModel {

    static async _syncRecipeLinkCount(connection, targetId, targetType) {
        if (targetType === 'dish') {
            await connection.execute(
                `UPDATE dictionary_dishes 
                 SET recipe_link_count = (
                     SELECT COUNT(*) FROM recipe_post_links 
                     WHERE linked_post_id = ? AND linked_post_type = 'dish'
                 ) 
                 WHERE dish_id = ?`,
                [targetId, targetId]
            );
        }
    }

    static async addLinks(connection, recipeIds, targetId, targetType) {
        if (!recipeIds || recipeIds.length === 0) return;
        const uniqueRecipeIds = [...new Set(recipeIds)];

        const values = [];
        const placeholders = uniqueRecipeIds.map(recipeId => {
            values.push(recipeId, targetId, targetType); 
            return '(?, ?, ?)';
        }).join(', ');

        const sql = `
            INSERT IGNORE INTO recipe_post_links (source_recipe_id, linked_post_id, linked_post_type) 
            VALUES ${placeholders}
        `;
        await connection.execute(sql, values);

        await this._syncRecipeLinkCount(connection, targetId, targetType);
    }
    static async updateLinks(connection, targetId, targetType, newRecipeIds) {
        const sqlDelete = `
            DELETE FROM recipe_post_links 
            WHERE linked_post_id = ? AND linked_post_type = ?
        `;
        await connection.execute(sqlDelete, [targetId, targetType]);

        if (newRecipeIds && newRecipeIds.length > 0) {
            await this.addLinks(connection, newRecipeIds, targetId, targetType);
        } else {
            await this._syncRecipeLinkCount(connection, targetId, targetType);
        }
    }

static async getRecipesByPost(userId = null, targetId, targetType) {
    const sql = `
        SELECT r.recipe_id, r.title, r.cover_image, r.status, r.rating_avg_score,
            u.user_id as author_id, u.full_name as author_name,
            rpl.vote_count,
            -- Thêm cột này để kiểm tra trạng thái vote của user hiện tại
            IF((SELECT 1 FROM recipe_link_votes v 
                    WHERE v.recipe_id = r.recipe_id 
                    AND v.post_id = rpl.linked_post_id 
                    AND v.user_id = ?), 1, 0) as is_voted
        FROM recipes r
        JOIN recipe_post_links rpl ON r.recipe_id = rpl.source_recipe_id
        JOIN users u ON r.user_id = u.user_id
        WHERE rpl.linked_post_id = ? AND rpl.linked_post_type = ?
        ORDER BY rpl.vote_count DESC, r.created_at DESC
    `;
    const [rows] = await pool.execute(sql, [userId, targetId, targetType]);
    return rows;
}

    /**
     * Kiểm tra xem một người dùng đã vote cho link này chưa
     */
    static async checkUserVoted(userId, recipeId, postId) {
        const sql = `SELECT 1 FROM recipe_link_votes WHERE user_id = ? AND recipe_id = ? AND post_id = ?`;
        const [rows] = await pool.execute(sql, [userId, recipeId, postId]);
        return rows.length > 0;
    }

    static async toggleVote(connection, userId, recipeId, postId, postType) {
    // 1. Kiểm tra xem đã vote chưa
    const [voted] = await connection.execute(
        `SELECT 1 FROM recipe_link_votes WHERE user_id = ? AND recipe_id = ? AND post_id = ?`,
        [userId, recipeId, postId]
    );

    if (voted.length > 0) {
        // TRƯỜNG HỢP 1: ĐÃ VOTE -> THỰC HIỆN HỦY VOTE
        await connection.execute(
            `DELETE FROM recipe_link_votes WHERE user_id = ? AND recipe_id = ? AND post_id = ?`,
            [userId, recipeId, postId]
        );
        await connection.execute(
            `UPDATE recipe_post_links SET vote_count = GREATEST(0, vote_count - 1) 
             WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ?`,
            [recipeId, postId, postType]
        );

        const [deleteResult] = await connection.execute(
                `DELETE FROM recipe_post_links 
                 WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ? AND vote_count <= 0`,
                [recipeId, postId, postType]
            );

        if (deleteResult.affectedRows > 0) {
                await this._syncRecipeLinkCount(connection, postId, postType);
            }
        return { action: 'unvoted' };
    } else {
        // TRƯỜNG HỢP 2: CHƯA VOTE -> THỰC HIỆN VOTE (Logic cũ của bạn)
        const [link] = await connection.execute(
            `SELECT 1 FROM recipe_post_links WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ?`,
            [recipeId, postId, postType]
        );

        if (link.length === 0) {
            await connection.execute(
                `INSERT INTO recipe_post_links (source_recipe_id, linked_post_id, linked_post_type, vote_count) VALUES (?, ?, ?, 1)`,
                [recipeId, postId, postType]
            );
            await this._syncRecipeLinkCount(connection, postId, postType);
        } else {
            await connection.execute(
                `UPDATE recipe_post_links SET vote_count = vote_count + 1 
                 WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ?`,
                [recipeId, postId, postType]
            );

        }
        await connection.execute(
            `INSERT INTO recipe_link_votes (user_id, recipe_id, post_id) VALUES (?, ?, ?)`,
            [userId, recipeId, postId]
        );
        return { action: 'voted' };
    }
}

    static async removeLink(connection, recipeId, postId, postType) {
        await connection.execute(
            `DELETE FROM recipe_post_links WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ?`,
            [recipeId, postId, postType]
        );
         await this._syncRecipeLinkCount(connection, postId, postType);
    }
}

module.exports = RecipeLinkModel;