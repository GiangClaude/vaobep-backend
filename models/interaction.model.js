// models/interaction.model.js
const db = require('../config/db');
const pool = db.pool;
const LeaderboardModel = require('./leaderboard.model');


class Interaction {

    // --- Hàm Helper nội bộ: Kiểm tra sự tồn tại và trạng thái của bài viết ---
    static async _validatePostStatus(connection, postId, postType) {
        let targetTable = '';
        let idColumn = '';

        if (postType === 'recipe') { targetTable = 'Recipes'; idColumn = 'recipe_id'; }
        else if (postType === 'article') { targetTable = 'Article_Posts'; idColumn = 'article_id'; }
        else if (postType === 'dish') { targetTable = 'Dictionary_Dishes'; idColumn = 'dish_id'; }
        else { throw new Error('Loại bài viết không hợp lệ'); }

        // Truy vấn kiểm tra
        // Lưu ý: bảng Dictionary_Dishes trong SQL của bạn không có cột status nên mặc định là công khai
        const selectFields = (postType === 'dish') ? '1 as exists_flag' : 'status';
        const [rows] = await connection.execute(
            `SELECT ${selectFields} FROM ${targetTable} WHERE ${idColumn} = ?`,
            [postId]
        );

        if (rows.length === 0) {
            throw new Error('Nội dung không tồn tại');
        }

        if (postType !== 'dish' && rows[0].status !== 'public') {
            throw new Error('Nội dung này hiện không công khai và không thể tương tác');
        }

        return { targetTable, idColumn };
    }

    // --- Hàm Helper nội bộ: Kiểm tra độ sâu của comment ---
    static async _getCommentDepth(connection, commentId) {
        if (!commentId) return 0; // Không có parentId => Cấp 0 (Root)

        // Truy vấn lấy parent_id của comment hiện tại và parent_id của comment cha nó
        const sql = `
            SELECT c1.parent_id AS p1_parent, c2.parent_id AS p2_parent
            FROM Comments c1
            LEFT JOIN Comments c2 ON c1.parent_id = c2.comment_id
            WHERE c1.comment_id = ?
        `;
        const [rows] = await connection.execute(sql, [commentId]);
        
        if (rows.length === 0) throw new Error('Bình luận cha không tồn tại');

        if (rows[0].p1_parent === null) return 1; // Cha là Root => Comment mới sẽ là cấp 1
        if (rows[0].p2_parent === null) return 2; // Cha là cấp 1 => Comment mới sẽ là cấp 2
        
        return 3; // Cha đã là cấp 2 hoặc sâu hơn
    }
    
    // --- 1. LIKE / UNLIKE (Hỗ trợ Recipe, Article, Dish) ---
    static async toggleLike(connection, { userId, postId, postType }) {
            // Xác định bảng cần update count
            const { targetTable, idColumn } = await this._validatePostStatus(connection, postId, postType);

            const [postRows] = await connection.execute(
                `SELECT ${postType === 'dish' ? '1' : 'status'} FROM ${targetTable} WHERE ${idColumn} = ?`,
                [postId]
            );
            
            // Kiểm tra đã like chưa
            const [exists] = await connection.execute(
                `SELECT * FROM Likes WHERE user_id = ? AND post_id = ? AND post_type = ?`,
                [userId, postId, postType]
            );


            let isLiked = false;

            if (exists.length > 0) {
                // Đã like -> Xóa (Unlike) -> Giảm count
                await connection.execute(
                    `DELETE FROM Likes WHERE user_id = ? AND post_id = ? AND post_type = ?`,
                    [userId, postId, postType]
                );
                console.log(`User ${userId} unliked ${postType} ${postId}`);
                // await connection.execute(
                //     `UPDATE ${targetTable} SET like_count = GREATEST(like_count - 1, 0) WHERE ${idColumn} = ?`,
                //     [postId]
                // );
                isLiked = false;
            } else {
                // Chưa like -> Thêm (Like) -> Tăng count
                await connection.execute(
                    `INSERT INTO Likes (user_id, post_id, post_type) VALUES (?, ?, ?)`,
                    [userId, postId, postType]
                );
                console.log(`User ${userId} liked ${postType} ${postId}`);
                // await connection.execute(
                //     `UPDATE ${targetTable} SET like_count = like_count + 1 WHERE ${idColumn} = ?`,
                //     [postId]
                // );
                isLiked = true;
            }

            if (postType === 'recipe') {
                await LeaderboardModel.syncRecipePoint(connection, postId);
            }

            await connection.commit();
            return { isLiked };
    }



    // --- 2. SAVE / UNSAVE (Bookmark) ---
    static async toggleSave(connection, { userId, postId, postType }) {
            await this._validatePostStatus(connection, postId, postType);

            // Kiểm tra đã lưu chưa
            const [exists] = await connection.execute(
                `SELECT * FROM Saved_Posts WHERE user_id = ? AND post_id = ? AND post_type = ?`,
                [userId, postId, postType]
            );

            let isSaved = false;
            if (exists.length > 0) {
                // Đã lưu -> Bỏ lưu
                await connection.execute(
                    `DELETE FROM Saved_Posts WHERE user_id = ? AND post_id = ? AND post_type = ?`,
                    [userId, postId, postType]
                );
                isSaved = false;
            } else {
                // Chưa lưu -> Lưu
                await connection.execute(
                    `INSERT INTO Saved_Posts (user_id, post_id, post_type) VALUES (?, ?, ?)`,
                    [userId, postId, postType]
                );
                isSaved = true;
            }
            return { isSaved };
    }

    // --- 3. COMMENT (Bình luận) ---
    static async createComment(connection,{ userId, postId, postType, content, parentId = null}) {
            await this._validatePostStatus(connection, postId, postType);

            if (parentId) {
                const depth = await this._getCommentDepth(connection, parentId);
                if (depth >= 3) {
                    throw new Error('Hệ thống chỉ hỗ trợ phản hồi tối đa 2 cấp');
                }
            }

             // Xác định bảng cần update comment_count
            const { targetTable, idColumn } = await this._validatePostStatus(connection, postId, postType);

            const commentId = crypto.randomUUID();

            // Insert Comment
            // Lưu ý: bảng Comments có cột comment_id default uuid() nhưng MySQL < 8.0 có thể cần gen ID từ code.
            // Giả sử DB tự gen hoặc dùng uuid() trong SQL
            const sqlInsert = `INSERT INTO Comments (comment_id, user_id, post_id, post_type, content, parent_id) VALUES (?, ?, ?, ?, ?, ?)`;
            await connection.execute(sqlInsert, [commentId, userId, postId, postType, content, parentId]);

            // // Update Count
            // if (targetTable) {
            //     await connection.execute(
            //         `UPDATE ${targetTable} SET comment_count = comment_count + 1 WHERE ${idColumn} = ?`,
            //         [postId]
            //     );
            // }

            if (parentId) {
                let currentParentId = parentId;
                while (currentParentId) {
                    //Tăng reply_count cho cha hiện tại
                    await connection.execute(
                        `UPDATE Comments SET reply_count = reply_count + 1 WHERE comment_id = ?`,
                        [currentParentId]
                    );
                    
                    // Tìm ID của cha cấp cao hơn (nếu có)
                    const [pRows] = await connection.execute(
                        `SELECT parent_id FROM Comments WHERE comment_id = ?`,
                        [currentParentId]
                    );
                    currentParentId = pRows[0]?.parent_id; 
                }
            }

            const [rows] = await connection.execute(`
                SELECT 
                    c.comment_id, c.content, c.created_at, c.update_at, c.parent_id, c.post_id, c.post_type, c.user_id,
                    u.full_name, u.avatar,
                    (SELECT COUNT(*) FROM Comments WHERE parent_id = c.comment_id) as reply_count
                FROM Comments c
                JOIN Users u ON c.user_id = u.user_id
                WHERE c.comment_id = ?
            `, [commentId]);
            
            if (postType === 'recipe') {
                await LeaderboardModel.syncRecipePoint(connection, postId);
            }

            await connection.commit();
            return rows[0];
    }

    static async getComments(postId, postType, page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        const sql = `
            SELECT C.*, U.full_name, U.avatar,
                   C.reply_count
            FROM Comments C
            JOIN Users U ON C.user_id = U.user_id
            WHERE C.post_id = ? AND C.post_type = ? AND C.parent_id IS NULL
            ORDER BY C.created_at DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.execute(sql, [postId, postType, limit.toString(), offset.toString()]);
        
        // Đếm tổng comment để phân trang
        const [countRows] = await pool.execute(
            `SELECT COUNT(*) as total FROM Comments WHERE post_id = ? AND post_type = ? AND parent_id IS NULL`, 
            [postId, postType]
        );
        
        return {
            comments: rows,
            total: countRows[0].total
        };
    }

    static async getCommentById(commentId) {
        const sql = `SELECT * FROM Comments WHERE comment_id = ?`;
        const [rows] = await pool.execute(sql, [commentId]);
        return rows.length > 0 ? rows[0] : null;
    }

    // Hàm lấy danh sách phản hồi (Lazy Load)
    static async getReplies(parentId) {
        const sql = `
            SELECT C.*, U.full_name, U.avatar,
                   C.reply_count
            FROM Comments C
            JOIN Users U ON C.user_id = U.user_id
            WHERE C.parent_id = ?
            ORDER BY C.created_at ASC
        `;
        const [rows] = await pool.execute(sql, [parentId]);
        return rows;
    }

    // Thêm vào trong class Interaction của file models/interaction.model.js

    // Hàm cập nhật nội dung bình luận
    static async updateComment(commentId, userId, newContent) {
        // Chỉ cập nhật khi đúng comment_id và người tạo (user_id)
        const sql = `UPDATE Comments SET content = ?, update_at = NOW() WHERE comment_id = ? AND user_id = ?`;
        const [result] = await pool.execute(sql, [newContent, commentId, userId]);
        return result.affectedRows > 0;
    }

    // Hàm xóa bình luận và giảm comment_count của bài viết
// Hàm xóa bình luận và tất cả phản hồi con, trigger sẽ tự lo việc giảm comment_count
    static async deleteComment(connection, commentId, userId) {
            // 1. Kiểm tra xem comment có tồn tại và thuộc về user này không để chống xóa lén
            const [checkOwner] = await connection.execute(
                `SELECT comment_id FROM Comments WHERE comment_id = ? AND user_id = ?`,
                [commentId, userId]
            );

            if (checkOwner.length === 0) {
                throw new Error("Không tìm thấy comment hoặc bạn không có quyền xóa.");
            }

            // 2. Truy vấn lấy ID của comment cha và toàn bộ comment con/cháu (hỗ trợ 2 cấp)
            const sqlGetIds = `
                SELECT comment_id FROM Comments 
                WHERE comment_id = ? 
                   OR parent_id = ? 
                   OR parent_id IN (SELECT comment_id FROM Comments WHERE parent_id = ?)
            `;
            const [rows] = await connection.execute(sqlGetIds, [commentId, commentId, commentId]);
            
            // Tạo mảng chứa tất cả các ID cần xóa
            const idsToDelete = rows.map(row => row.comment_id);

            // 3. Thực hiện xóa tất cả các ID trong 1 câu lệnh
            // Lưu ý: Lệnh IN() này sẽ kích hoạt trigger after_comment_delete cho TỪNG bình luận bị xóa
            if (idsToDelete.length > 0) {
                const [targetComment] = await connection.execute(
                    `SELECT parent_id FROM Comments WHERE comment_id = ?`, [commentId]
                );
                const topParentId = targetComment[0]?.parent_id;

                // Thực hiện xóa (idsToDelete chứa bản thân nó và toàn bộ con cháu)
                const totalToRemove = idsToDelete.length;
                const placeholders = idsToDelete.map(() => '?').join(',');
                const sqlDelete = `DELETE FROM Comments WHERE comment_id IN (${placeholders})`;
                await connection.execute(sqlDelete, idsToDelete);

                // Nếu nó có cha, cập nhật trừ reply_count cho các cấp bên trên
                if (topParentId) {
                    let currentParentId = topParentId;
                    while (currentParentId) {
                        await connection.execute(
                            `UPDATE Comments SET reply_count = GREATEST(reply_count - ?, 0) WHERE comment_id = ?`,
                            [totalToRemove, currentParentId]
                        );
                        const [pRows] = await connection.execute(`SELECT parent_id FROM Comments WHERE comment_id = ?`, [currentParentId]);
                        currentParentId = pRows[0]?.parent_id;
                    }
                }

            }

            const [checkPostType] = await connection.execute(
                `SELECT post_type, post_id FROM Comments WHERE comment_id = ?`, [commentId]
            );
            if (checkPostType.length > 0 && checkPostType[0].post_type === 'recipe') {
                await LeaderboardModel.syncRecipePoint(connection, checkPostType[0].post_id);
            }

            await connection.commit();
            
            // Trả về số lượng comment đã xóa để client có thể biết
            return { success: true, deletedCount: idsToDelete.length };
    }

    // --- 4. RATING (Đánh giá sao) ---
    static async ratePost(connection, { userId, postId, postType, score }) {
            // Dùng INSERT ON DUPLICATE KEY UPDATE để xử lý việc user đánh giá lại
            // Bảng Ratings khóa chính là (user_id, post_id) -> Đảm bảo 1 user chỉ rate 1 lần/bài
            const sqlRate = `
                INSERT INTO Ratings (user_id, post_id, post_type, score) 
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE score = VALUES(score)
            `;
            await connection.execute(sqlRate, [userId, postId, postType, score]);

            // Tính toán lại điểm trung bình
            const [stats] = await connection.execute(
                `SELECT COUNT(*) as count, SUM(score) as sum_score 
                 FROM Ratings 
                 WHERE post_id = ? AND post_type = ?`,
                [postId, postType]
            );

            const ratingCount = stats[0].count;
            const sumScore = stats[0].sum_score || 0; // Tránh null
            const avgScore = ratingCount > 0 ? (sumScore / ratingCount) : 0;

            // Update ngược lại vào bảng cha (Recipes/Article)
            let targetTable = '';
            let idColumn = '';
            if (postType === 'recipe') { targetTable = 'Recipes'; idColumn = 'recipe_id'; }
            else if (postType === 'article') { targetTable = 'Article_Posts'; idColumn = 'article_id'; }
            else if (postType === 'dish') { targetTable = 'Dictionary_Dishes'; idColumn = 'dish_id'; }

            if (targetTable) {
                await connection.execute(
                    `UPDATE ${targetTable} 
                     SET rating_count = ?, rating_sum_score = ?, rating_avg_score = ? 
                     WHERE ${idColumn} = ?`,
                    [ratingCount, sumScore, avgScore, postId]
                );
            }

            if (postType === 'recipe') {
                await LeaderboardModel.syncRecipePoint(connection, postId);
            }

            await connection.commit();
            return { avgScore, ratingCount };
    }

    // --- 5. FOLLOW USER (Theo dõi người dùng) ---
    static async toggleFollow(connection, followerId, followingId) {

            // Không được follow chính mình
            const [exists] = await connection.execute(
                `SELECT * FROM Follows WHERE follower_id = ? AND following_id = ?`,
                [followerId, followingId]
            );

            let isFollowing = false;
            if (exists.length > 0) {
                // Unfollow
                await connection.execute(
                    `DELETE FROM Follows WHERE follower_id = ? AND following_id = ?`,
                    [followerId, followingId]
                );
                isFollowing = false;
            } else {
                // Follow
                await connection.execute(
                    `INSERT INTO Follows (follower_id, following_id) VALUES (?, ?)`,
                    [followerId, followingId]
                );
                isFollowing = true;
            }

            await LeaderboardModel.syncUserPoint(connection, followingId);
            
            return { isFollowing };
    }
    
    // Check trạng thái của user với các bài viết (Dùng khi load trang chi tiết)
    static async getUserInteractionState(userId, postId, postType) {
        if (!userId) return { liked: false, saved: false, rated: 0 };
        
        const [likeRows] = await pool.execute(
            `SELECT 1 FROM Likes WHERE user_id = ? AND post_id = ? AND post_type = ?`, 
            [userId, postId, postType]
        );
        const [saveRows] = await pool.execute(
            `SELECT 1 FROM Saved_Posts WHERE user_id = ? AND post_id = ? AND post_type = ?`, 
            [userId, postId, postType]
        );
         const [rateRows] = await pool.execute(
            `SELECT score FROM Ratings WHERE user_id = ? AND post_id = ? AND post_type = ?`, 
            [userId, postId, postType]
        );
        
        return {
            liked: likeRows.length > 0,
            saved: saveRows.length > 0,
            rated: rateRows.length > 0 ? rateRows[0].score : 0
        };
    }

    // --- 6. REPORT (Báo cáo bài viết) ---
    static async reportPost(connection, { userId, postId, postType, reason }) {
            // Xác định bảng cần update report_count
            let targetTable = '';
            let idColumn = '';
            if (postType === 'recipe') { targetTable = 'Recipes'; idColumn = 'recipe_id'; }
            else if (postType === 'article') { targetTable = 'Article_Posts'; idColumn = 'article_id'; }
            else if (postType === 'dish') { targetTable = 'Dictionary_Dishes'; idColumn = 'dish_id'; }
            else { throw new Error('Invalid post_type'); }

            // Kiểm tra đã báo cáo chưa (chống spam, 1 user chỉ báo cáo 1 lần/post)
            const [exists] = await connection.execute(
                `SELECT * FROM Reports WHERE reporter_user_id = ? AND post_id = ? AND post_type = ?`,
                [userId, postId, postType]
            );
            if (exists.length > 0) {
                throw new Error('Bạn đã báo cáo bài viết này trước đó');
            }

            // Ghi nhận báo cáo
            await connection.execute(
                `INSERT INTO Reports (reporter_user_id, post_id, post_type, reason) VALUES (?, ?, ?, ?)`,
                [userId, postId, postType, reason]
            );

            // Tăng report_count cho post
            await connection.execute(
                `UPDATE ${targetTable} SET report_count = report_count + 1 WHERE ${idColumn} = ?`,
                [postId]
            );

            if (postType === 'recipe') {
                await LeaderboardModel.syncRecipePoint(connection, postId);
            }

            await connection.commit();
            return { success: true };
    }

    // --- Lấy trạng thái tương tác cho danh sách bài viết (Batch Check) ---
    static async getBatchInteractionState(userId, postIds, postType) {
        if (!userId || postIds.length === 0) return {};

        const placeholders = postIds.map(() => '?').join(',');
        
        // 1. Lấy danh sách các bài đã Like
        const [likeRows] = await pool.execute(
            `SELECT post_id FROM Likes WHERE user_id = ? AND post_type = ? AND post_id IN (${placeholders})`,
            [userId, postType, ...postIds]
        );

        // 2. Lấy danh sách các bài đã Save
        const [saveRows] = await pool.execute(
            `SELECT post_id FROM Saved_Posts WHERE user_id = ? AND post_type = ? AND post_id IN (${placeholders})`,
            [userId, postType, ...postIds]
        );

        // 3. Chuyển thành Map để Controller dễ ghép
        const results = {};
        postIds.forEach(id => results[id] = { liked: false, saved: false });
        
        likeRows.forEach(row => { if (results[row.post_id]) results[row.post_id].liked = true; });
        saveRows.forEach(row => { if (results[row.post_id]) results[row.post_id].saved = true; });

        return results;
    }

    static async getInteractionCounts(postId, postType) {
        try {
            let tableName = '';
            let idColumn = '';
            let selectFields = '';

            // Phân loại để chọn đúng bảng và các cột cần lấy
            if (postType === 'recipe') {
                tableName = 'Recipes';
                idColumn = 'recipe_id';
                // Bảng Recipes có đầy đủ like, comment và rating
                selectFields = 'like_count, comment_count, rating_count, rating_avg_score, report_count';
            } else if (postType === 'article') {
                tableName = 'Article_Posts';
                idColumn = 'article_id';
                // Bảng Article chỉ có like, comment và report (theo cấu trúc ông mô tả)
                selectFields = 'like_count, comment_count, report_count';
            } else if (postType === 'dish') {
                tableName = 'Dictionary_Dishes';
                idColumn = 'dish_id';
                // Bảng Dish cũng tương tự Article
                selectFields = 'like_count, comment_count, report_count';
            } else {
                throw new Error('Loại bài viết không hợp lệ');
            }

            const query = `SELECT ${selectFields} FROM ${tableName} WHERE ${idColumn} = ?`;
            const [rows] = await pool.execute(query, [postId]);
            if (rows.length === 0) {
                throw new Error('Không tìm thấy bài viết');
            }

            // Trả về trực tiếp dòng dữ liệu chứa các con số
            return rows[0];
        } catch (error) {
            console.error("Lỗi khi lấy dữ liệu tổng hợp tương tác:", error);
            throw error;
        }

    }
}

module.exports = Interaction;