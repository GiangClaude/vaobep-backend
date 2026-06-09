const db = require('../config/db');
const scoringUtils = require('../utils/scoring.utils');

class LeaderboardModel {
    
    /**
     * Đồng bộ điểm của một Công thức (Được gọi bên trong Transaction)
     */
    static async syncRecipePoint(connection, recipeId) {
        // Sử dụng connection truyền vào để đảm bảo tính nhất quán của Transaction hiện tại
        const exec = connection || db.pool;

        // 1. Lấy thống kê hiện tại của Recipe (Đã được Trigger cập nhật)
        const [recipeRows] = await exec.execute(
            `SELECT user_id, like_count, comment_count, rating_avg_score, is_trusted, report_count 
             FROM Recipes WHERE recipe_id = ?`, 
            [recipeId]
        );
        if (recipeRows.length === 0) return;
        const stats = recipeRows[0];

        // 2. Đếm số lượng bài viết / từ điển liên kết
        const [linkRows] = await exec.execute(
            `SELECT COUNT(*) as linkCount FROM Recipe_Post_Links WHERE source_recipe_id = ?`, 
            [recipeId]
        );

        // 3. Lấy snapshot của tháng trước để tính tăng trưởng
        const date = new Date();
        date.setMonth(date.getMonth() - 1); // Lùi 1 tháng
        const lastMonth = date.getMonth() + 1;
        const lastYear = date.getFullYear();

        const [snapRows] = await exec.execute(
            `SELECT likes, comments FROM monthly_snapshots 
             WHERE entity_id = ? AND entity_type = 'recipe' 
             AND snapshot_month = ? AND snapshot_year = ?`,
            [recipeId, lastMonth, lastYear]
        );

        let growthStats = { newLikes: 0, newComments: 0 };
        if (snapRows.length > 0) {
            growthStats.newLikes = Math.max(0, stats.like_count - snapRows[0].likes);
            growthStats.newComments = Math.max(0, stats.comment_count - snapRows[0].comments);
        }

        // 4. Tính điểm
        const scoreObj = {
            likeCount: stats.like_count,
            commentCount: stats.comment_count,
            avgRating: stats.rating_avg_score,
            linkCount: linkRows[0].linkCount,
            isTrusted: stats.is_trusted,
            reportCount: stats.report_count
        };
        const newPoint = scoringUtils.calculateRecipeScore(scoreObj, growthStats);

        // 5. Cập nhật điểm cho Recipe
        await exec.execute(`UPDATE Recipes SET point = ? WHERE recipe_id = ?`, [newPoint, recipeId]);

        // 6. Điểm Recipe thay đổi -> Điểm tác giả thay đổi -> Gọi đồng bộ điểm User
        await this.syncUserPoint(exec, stats.user_id);
    }

    /**
     * Đồng bộ điểm của một Đầu bếp (Được gọi bên trong Transaction)
     */
    static async syncUserPoint(connection, userId) {
        const exec = connection || db.pool;

        // 1. Lấy trung bình điểm các Recipe của user và đếm số recipe trusted
        const [recipeStats] = await exec.execute(
            `SELECT AVG(point) as avg_point, SUM(IF(is_trusted = 1, 1, 0)) as trusted_count 
             FROM Recipes WHERE user_id = ? AND status = 'public'`, 
            [userId]
        );

        // 2. Lấy số lượng người theo dõi
        const [followRows] = await exec.execute(
            `SELECT COUNT(*) as followerCount FROM Follows WHERE following_id = ?`, 
            [userId]
        );

        // 3. Lấy snapshot tháng trước
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        const lastMonth = date.getMonth() + 1;
        const lastYear = date.getFullYear();

        const [snapRows] = await exec.execute(
            `SELECT followers, badges FROM monthly_snapshots 
             WHERE entity_id = ? AND entity_type = 'user' 
             AND snapshot_month = ? AND snapshot_year = ?`,
            [userId, lastMonth, lastYear]
        );

        let growthStats = { newFollowers: 0, newBadges: 0 };
        // Lấy tổng huy hiệu hiện tại
        const [badgeRows] = await exec.execute(`SELECT COUNT(*) as badgeCount FROM User_Badges WHERE user_id = ?`, [userId]);

        if (snapRows.length > 0) {
            growthStats.newFollowers = Math.max(0, followRows[0].followerCount - snapRows[0].followers);
            growthStats.newBadges = Math.max(0, badgeRows[0].badgeCount - snapRows[0].badges);
        }

        // 4. Tính điểm User
        const scoreObj = {
            avgRecipePoint: recipeStats[0].avg_point || 0,
            followerCount: followRows[0].followerCount,
            trustedRecipeCount: recipeStats[0].trusted_count || 0
        };
        const newPoint = scoringUtils.calculateUserScore(scoreObj, growthStats);

        // 5. Cập nhật điểm cho User
        await exec.execute(`UPDATE Users SET rank_point = ? WHERE user_id = ?`, [newPoint, userId]);
    }

    // --- THÊM MỚI BẮT ĐẦU ---

    /**
     * Lấy Top 10 Công thức (Real-time tháng hiện tại)
     */
    static async getLiveTopRecipes(limit = 10) {
        const sql = `
            SELECT 
                r.recipe_id, r.title, r.cover_image, r.point, 
                r.like_count, r.comment_count, r.rating_avg_score,
                u.user_id as author_id, u.full_name as author_name, u.avatar as author_avatar,
                (SELECT GROUP_CONCAT(t.name) 
                 FROM tag_post tp 
                 JOIN Tags t ON tp.tag_id = t.tag_id 
                 WHERE tp.post_id = r.recipe_id AND tp.post_type = 'recipe') as tags
            FROM Recipes r
            JOIN Users u ON r.user_id = u.user_id
            WHERE r.status = 'public'
            ORDER BY r.point DESC
            LIMIT ?
        `;
        const [rows] = await db.pool.execute(sql, [limit.toString()]);
        return rows;
    }

    /**
     * Lấy Top 10 Đầu bếp (Real-time tháng hiện tại)
     */
    static async getLiveTopUsers(limit = 10) {
        // Sử dụng subquery để đếm số công thức mới trong tháng hiện tại
        const sql = `
            SELECT 
                u.user_id, u.full_name, u.avatar, u.bio, u.email, u.rank_point,
                (SELECT COUNT(*) FROM Recipes r WHERE r.user_id = u.user_id AND r.status = 'public') as total_recipes,
                (SELECT COUNT(*) FROM Recipes r2 WHERE r2.user_id = u.user_id AND r2.status = 'public' AND MONTH(r2.created_at) = MONTH(CURRENT_DATE()) AND YEAR(r2.created_at) = YEAR(CURRENT_DATE())) as new_recipes_this_month,
                (SELECT COUNT(*) FROM Follows f WHERE f.following_id = u.user_id) as total_followers
            FROM Users u
            WHERE u.account_status = 'active'
            ORDER BY u.rank_point DESC
            LIMIT ?
        `;
        const [rows] = await db.pool.execute(sql, [limit.toString()]);
        return rows;
    }

    /**
     * Lấy Top 10 từ Lịch sử (Tháng trước)
     */
    static async getHistoryLeaderboard(entityType, month, year, limit = 10) {
        const sql = `
            SELECT * FROM leaderboards_history
            WHERE entity_type = ? AND rank_month = ? AND rank_year = ?
            ORDER BY rank_position ASC
            LIMIT ?
        `;
        const [rows] = await db.pool.execute(sql, [entityType, month, year, limit.toString()]);
        // Parse lại snapshot_data từ JSON
        return rows.map(row => ({
            ...row,
            snapshot_data: typeof row.snapshot_data === 'string' ? JSON.parse(row.snapshot_data) : row.snapshot_data
        }));
    }

    /**
     * Hàm Chốt Sổ (Chạy vào cuối tháng)
     * Lưu Snapshot toàn bộ hệ thống và lưu Top 10 vào History
     */
    static async runMonthlySnapshot() {
        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();

            const date = new Date();
            // Lấy tháng vừa kết thúc (nếu chạy ngày 1/6 thì chốt sổ cho tháng 5)
            const targetMonth = date.getMonth() === 0 ? 12 : date.getMonth(); 
            const targetYear = date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear();

            // 1. Lấy Top 10 Recipe và chèn vào bảng History
            const topRecipes = await this.getLiveTopRecipes(10);
            for (let i = 0; i < topRecipes.length; i++) {
                const r = topRecipes[i];
                const snapshotData = JSON.stringify({
                    title: r.title, cover_image: r.cover_image, author_name: r.author_name, author_id: r.author_id, author_avatar: r.author_avatar,
                    like_count: r.like_count, comment_count: r.comment_count, rating_avg_score: r.rating_avg_score, tags: r.tags
                });
                await connection.execute(
                    `INSERT INTO leaderboards_history (entity_id, entity_type, rank_month, rank_year, rank_position, score, snapshot_data) 
                     VALUES (?, 'recipe', ?, ?, ?, ?, ?)`,
                    [r.recipe_id, targetMonth, targetYear, i + 1, r.point, snapshotData]
                );
            }

            // 2. Lấy Top 10 User và chèn vào bảng History
            const topUsers = await this.getLiveTopUsers(10);
            for (let i = 0; i < topUsers.length; i++) {
                const u = topUsers[i];
                const snapshotData = JSON.stringify({
                    full_name: u.full_name, avatar: u.avatar, bio: u.bio,
                    total_recipes: u.total_recipes, new_recipes: u.new_recipes_this_month, total_followers: u.total_followers
                });
                await connection.execute(
                    `INSERT INTO leaderboards_history (entity_id, entity_type, rank_month, rank_year, rank_position, score, snapshot_data) 
                     VALUES (?, 'user', ?, ?, ?, ?, ?)`,
                    [u.user_id, targetMonth, targetYear, i + 1, u.rank_point, snapshotData]
                );
            }

            // 3. Cập nhật Snapshot (số lượng like, cmt, follow...) của TẤT CẢ mọi người để tháng sau tính tăng trưởng
            await connection.execute(`
                INSERT INTO monthly_snapshots (entity_id, entity_type, snapshot_month, snapshot_year, likes, comments, trusted_recipes)
                SELECT recipe_id, 'recipe', ?, ?, like_count, comment_count, is_trusted FROM Recipes
                ON DUPLICATE KEY UPDATE likes = VALUES(likes), comments = VALUES(comments)
            `, [targetMonth, targetYear]);

            await connection.execute(`
                INSERT INTO monthly_snapshots (entity_id, entity_type, snapshot_month, snapshot_year, followers, badges)
                SELECT u.user_id, 'user', ?, ?, 
                   (SELECT COUNT(*) FROM Follows WHERE following_id = u.user_id),
                   (SELECT COUNT(*) FROM User_Badges WHERE user_id = u.user_id)
                FROM Users u
                ON DUPLICATE KEY UPDATE followers = VALUES(followers), badges = VALUES(badges)
            `, [targetMonth, targetYear]);

            await connection.commit();
            return { success: true, message: `Chốt sổ tháng ${targetMonth}/${targetYear} thành công.` };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    // --- THÊM MỚI KẾT THÚC ---
}

module.exports = LeaderboardModel;