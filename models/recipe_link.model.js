const db = require('../config/db');
const pool = db.pool;

class RecipeLinkModel {
    // /**
    //  * Thêm các liên kết recipe vào một bài viết (Article)
    //  * @param {object} connection - Kết nối đang chạy Transaction
    //  * @param {string} sourceId - ID của Article
    //  * @param {array} linkedRecipeIds - Mảng các UUID của Recipe
    //  */
    // static async addRecipeLinksToArticle(connection, sourceId, linkedRecipeIds) {
    //     // Giải thích: Hàm này dùng để chèn hàng loạt (Bulk Insert) 
    //     // vào bảng Recipe_Post_Links với type là 'recipe'
    //     if (!linkedRecipeIds || linkedRecipeIds.length === 0) return;

    //     const values = [];
    //     const placeholders = linkedRecipeIds.map(recipeId => {
    //         values.push(sourceId, recipeId, 'recipe');
    //         return '(?, ?, ?)';
    //     }).join(', ');

    //     const sql = `
    //         INSERT INTO Recipe_Post_Links (source_recipe_id, linked_post_id, linked_post_type) 
    //         VALUES ${placeholders}
    //     `;

    //     // Sử dụng connection truyền vào để đảm bảo tính nhất quán của Transaction
    //     await connection.execute(sql, values);
    // }

    /**
 * Thêm liên kết Recipe vào một Post (Article/Dish/...)
 * @param {object} connection - Connection transaction
 * @param {array} recipeIds - Mảng các ID Recipe (Source)
 * @param {string} targetId - ID của Article hoặc Dish (Target)
 * @param {string} targetType - 'article' hoặc 'dish'
 */
    static async addLinks(connection, recipeIds, targetId, targetType) {
        if (!recipeIds || recipeIds.length === 0) return;

        const values = [];
        const placeholders = recipeIds.map(recipeId => {
            // recipeId vào source_recipe_id (Đúng FK), targetId vào linked_post_id
            values.push(recipeId, targetId, targetType); 
            return '(?, ?, ?)';
        }).join(', ');

        const sql = `
            INSERT INTO Recipe_Post_Links (source_recipe_id, linked_post_id, linked_post_type) 
            VALUES ${placeholders}
        `;
        await connection.execute(sql, values);
    }

    // /**
    //  * Cập nhật liên kết (Xóa cũ - Thêm mới)
    //  * @param {object} connection - Kết nối đang chạy Transaction
    //  * @param {string} articleId - ID của Article
    //  * @param {array} newRecipeIds - Mảng ID recipe mới
    //  */
    // static async updateRecipeLinksForArticle(connection, articleId, newRecipeIds) {
    //     // Giải thích: Trước khi thêm mới, ta phải dọn dẹp các liên kết cũ 
    //     // của bài viết này để tránh trùng lặp hoặc dư thừa.
        
    //     // 1. Xóa toàn bộ liên kết recipe cũ của Article này
    //     const sqlDelete = `
    //         DELETE FROM Recipe_Post_Links 
    //         WHERE source_recipe_id = ? AND linked_post_type = 'recipe'
    //     `;
    //     await connection.execute(sqlDelete, [articleId]);

    //     // 2. Gọi lại hàm add để thêm mảng mới
    //     if (newRecipeIds && newRecipeIds.length > 0) {
    //         await this.addRecipeLinksToArticle(connection, articleId, newRecipeIds);
    //     }
    // }

    /**
 * Cập nhật liên kết (Xóa cũ theo Target - Thêm mới)
    */
    static async updateLinks(connection, targetId, targetType, newRecipeIds) {
        // Xóa dựa trên targetId và targetType để không xóa nhầm liên kết của các loại khác
        const sqlDelete = `
            DELETE FROM Recipe_Post_Links 
            WHERE linked_post_id = ? AND linked_post_type = ?
        `;
        await connection.execute(sqlDelete, [targetId, targetType]);

        if (newRecipeIds && newRecipeIds.length > 0) {
            await this.addLinks(connection, newRecipeIds, targetId, targetType);
        }
    }

    // /**
    //  * Lấy danh sách Recipe đã gắn vào Article
    //  * @param {string} articleId 
    //  */
    // static async getLinkedRecipesByArticleId(articleId) {
    //     // Giải thích: Hàm này join sang bảng Recipes để lấy thông tin hiển thị
    //     const sql = `
    //         SELECT r.recipe_id, r.title, r.cover_image, r.status, u.user_id as author_id, u.full_name as author_name
    //         FROM Recipes r
    //         JOIN Recipe_Post_Links rpl ON r.recipe_id = rpl.linked_post_id
    //         JOIN Users u ON r.user_id = u.user_id
    //         WHERE rpl.source_recipe_id = ? AND rpl.linked_post_type = 'recipe'
    //     `;
    //     const [rows] = await pool.execute(sql, [articleId]);
    //     return rows;
    // }

    /**
 * Lấy danh sách Recipe đã gắn vào một Post
 */
static async getRecipesByPost(userId = null, targetId, targetType) {
    console.log("Fetching linked recipes for post:", { targetId, targetType, userId });
    const sql = `
        SELECT r.recipe_id, r.title, r.cover_image, r.status, r.rating_avg_score,
            u.user_id as author_id, u.full_name as author_name,
            rpl.vote_count,
            -- Thêm cột này để kiểm tra trạng thái vote của user hiện tại
            IF((SELECT 1 FROM Recipe_Link_Votes v 
                    WHERE v.recipe_id = r.recipe_id 
                    AND v.post_id = rpl.linked_post_id 
                    AND v.user_id = ?), 1, 0) as is_voted
        FROM Recipes r
        JOIN Recipe_Post_Links rpl ON r.recipe_id = rpl.source_recipe_id
        JOIN Users u ON r.user_id = u.user_id
        WHERE rpl.linked_post_id = ? AND rpl.linked_post_type = ?
        ORDER BY rpl.vote_count DESC, r.created_at DESC
    `;
    // Truyền userId vào tham số đầu tiên
    const [rows] = await pool.execute(sql, [userId, targetId, targetType]);
    console.log("Linked recipes fetched:", rows);
    return rows;
}

    /**
     * Kiểm tra xem một người dùng đã vote cho link này chưa
     */
    static async checkUserVoted(userId, recipeId, postId) {
        const sql = `SELECT 1 FROM Recipe_Link_Votes WHERE user_id = ? AND recipe_id = ? AND post_id = ?`;
        const [rows] = await pool.execute(sql, [userId, recipeId, postId]);
        return rows.length > 0;
    }

    static async toggleVote(connection, userId, recipeId, postId, postType) {
    // 1. Kiểm tra xem đã vote chưa
    const [voted] = await connection.execute(
        `SELECT 1 FROM Recipe_Link_Votes WHERE user_id = ? AND recipe_id = ? AND post_id = ?`,
        [userId, recipeId, postId]
    );

    if (voted.length > 0) {
        // TRƯỜNG HỢP 1: ĐÃ VOTE -> THỰC HIỆN HỦY VOTE
        // Xóa bản ghi vote
        await connection.execute(
            `DELETE FROM Recipe_Link_Votes WHERE user_id = ? AND recipe_id = ? AND post_id = ?`,
            [userId, recipeId, postId]
        );
        // Giảm số lượng vote_count trong bảng liên kết
        await connection.execute(
            `UPDATE Recipe_Post_Links SET vote_count = GREATEST(0, vote_count - 1) 
             WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ?`,
            [recipeId, postId, postType]
        );

        await connection.execute(
                `DELETE FROM Recipe_Post_Links 
                 WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ? AND vote_count <= 0`,
                [recipeId, postId, postType]
            );
        return { action: 'unvoted' };
    } else {
        // TRƯỜNG HỢP 2: CHƯA VOTE -> THỰC HIỆN VOTE (Logic cũ của bạn)
        // Kiểm tra xem link đã tồn tại chưa để Insert hoặc Update
        const [link] = await connection.execute(
            `SELECT 1 FROM Recipe_Post_Links WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ?`,
            [recipeId, postId, postType]
        );

        if (link.length === 0) {
            await connection.execute(
                `INSERT INTO Recipe_Post_Links (source_recipe_id, linked_post_id, linked_post_type, vote_count) VALUES (?, ?, ?, 1)`,
                [recipeId, postId, postType]
            );
        } else {
            await connection.execute(
                `UPDATE Recipe_Post_Links SET vote_count = vote_count + 1 
                 WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ?`,
                [recipeId, postId, postType]
            );
        }
        await connection.execute(
            `INSERT INTO Recipe_Link_Votes (user_id, recipe_id, post_id) VALUES (?, ?, ?)`,
            [userId, recipeId, postId]
        );
        return { action: 'voted' };
    }
}

    static async removeLink(connection, recipeId, postId, postType) {
        await connection.execute(
            `DELETE FROM Recipe_Post_Links WHERE source_recipe_id = ? AND linked_post_id = ? AND linked_post_type = ?`,
            [recipeId, postId, postType]
        );
    }
}

module.exports = RecipeLinkModel;