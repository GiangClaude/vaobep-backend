const db = require('../config/db');
const pool = db.pool;
const { v4: uuidv4 } = require('uuid');

const ArticleModel = {
// --- THÊM MỚI TỪ ĐÂY: CHO ADMIN QUẢN LÝ BÀI VIẾT TỪ ĐIỂN ---

    // Lấy danh sách có lọc Status
    getArticlesByAdmin: async (limit, offset, search, statusFilter, sortKey = 'created_at', sortOrder = 'DESC') => {
        // Map allowed sort keys to DB columns
        const sortMapping = {
            name: 'a.title',
            author: 'u.full_name',
            status: 'a.status',
            created_at: 'a.created_at'
        };

        const key = sortMapping[sortKey] || sortMapping['created_at'];
        const order = (String(sortOrder).toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

        let query = `
            SELECT a.article_id, a.title, a.status, a.created_at, a.read_time, a.report_count,
                   u.full_name as author_name, u.role as author_role
            FROM Article_Posts a
            JOIN Users u ON a.user_id = u.user_id
            WHERE 1=1
        `;
        let params = [];

        if (search) {
            query += ` AND (a.title LIKE ? OR a.description LIKE ?) `;
            params.push(`%${search}%`);
        }

        if (statusFilter && statusFilter !== 'all') {
            query += ` AND a.status = ? `;
            params.push(statusFilter);
        }

        query += ` ORDER BY ${key} ${order} LIMIT ? OFFSET ?`;
        params.push(limit.toString(), offset.toString());

        const [rows] = await pool.execute(query, params);
        return rows;
    },

    // Đếm tổng số để phân trang có lọc Status
    countArticlesByAdmin: async (search, statusFilter) => {
        let query = `
            SELECT COUNT(*) as total 
            FROM Article_Posts a
            JOIN Users u ON a.user_id = u.user_id
            WHERE 1=1
        `;
        let params = [];
        
        if (search) {
            query += ` AND a.title LIKE ?`;
            params.push(`%${search}%`);
        }

        if (statusFilter && statusFilter !== 'all') {
            query += ` AND a.status = ? `;
            params.push(statusFilter);
        }

        const [rows] = await pool.execute(query, params);
        return rows[0].total;
    },

    // --- KẾT THÚC PHẦN THÊM MỚI ---
    // --- CÁC HÀM MỚI CHO USECASE CHUYÊN GIA ---

    // 1. Tạo bài viết
    create: async (connection, { articleId, userId, title, description, content, coverImage, status, readTime }) => {
        // Giả sử bạn đã chạy lệnh ALTER TABLE thêm description và cover_image.
        // Nếu chưa, hãy xóa 2 tham số đó khỏi câu query dưới đây.
        const executor = connection || pool;
        // console.log("Debug ArticleModel.create:", { articleId, userId, title, description, content, coverImage, status, readTime });
        const query = `
            INSERT INTO Article_Posts (article_id, user_id, title, description, content, cover_image, status, read_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await executor.execute(query, [
            articleId, userId, title, description || '', content, coverImage || null, status || 'draft', readTime || 1
        ]);
        return result;
    },

    // 2. Chuyên gia cập nhật bài viết
    update: async (connection, articleId, updateData) => {
        const executor = connection || pool;
        const keys = Object.keys(updateData).filter(key => updateData[key] !== undefined);
        if (keys.length === 0) return null;

        const setClauses = keys.map(key => `\`${key}\` = ?`);
        setClauses.push('update_at = NOW()');
        
        const values = keys.map(key => updateData[key]);
        values.push(articleId);

        const query = `UPDATE Article_Posts SET ${setClauses.join(', ')} WHERE article_id = ?`;
        const [result] = await executor.execute(query, values);
        return result;
    },

    // 3. Lấy chi tiết bài viết (Công khai)
    findById: async (articleId) => {
        const query = `
            SELECT a.*, u.full_name as author_name, u.avatar as author_avatar
            FROM Article_Posts a
            JOIN Users u ON a.user_id = u.user_id
            WHERE a.article_id = ?
        `;
        const [rows] = await pool.execute(query, [articleId]);
        return rows[0] || null;
    },

    // 4. Lấy danh sách bài viết (Public - Cho trang Học thuật)
    getPublicArticles: async ({ limit, offset, keyword, tagIds, sort }) => {
        let params = [];
        // Tích hợp luôn công thức tính score từ hàm getFeaturedArticles cũ của bạn vào đây
        let query = `
            SELECT a.article_id, a.title, a.description, a.cover_image, a.created_at, a.comment_count, a.read_time, a.like_count,
                   u.full_name as author_name, u.avatar as author_avatar, u.user_id as author_id,
                   (
                       (LOG(1 + COALESCE(a.comment_count,0)) * 2)
                       + (1.5 * (1 / (1 + ABS(COALESCE(a.read_time,1) - 5))))
                       - (3 * COALESCE(a.report_count,0))
                       + (3 * GREATEST(0, 30 - TIMESTAMPDIFF(DAY, a.created_at, NOW())) / 30)
                       + (RAND() * 0.5)
                   ) AS score
            FROM Article_Posts a
            JOIN Users u ON a.user_id = u.user_id
            WHERE a.status = 'public'
        `;

        // 1. Xử lý tìm kiếm từ khóa (Keyword)
        if (keyword) {
            query += ` AND (
                a.title LIKE ? 
                OR a.description LIKE ? 
                OR a.content LIKE ? 
                OR EXISTS (
                    SELECT 1 FROM tag_post tp 
                    JOIN Tags t ON tp.tag_id = t.tag_id 
                    WHERE tp.post_id = a.article_id AND tp.post_type = 'article' AND t.name LIKE ?
                )
            )`;
            const searchVal = `%${keyword}%`;
            params.push(searchVal, searchVal, searchVal, searchVal);
        }

        // 2. Xử lý lọc theo danh sách Tags (Logic AND: Phải có đủ tất cả tag đã chọn)
        if (tagIds && tagIds.length > 0) {
            const placeholders = tagIds.map(() => '?').join(',');
            query += ` AND a.article_id IN (
                SELECT post_id 
                FROM tag_post 
                WHERE post_type = 'article' AND tag_id IN (${placeholders})
                GROUP BY post_id
                HAVING COUNT(DISTINCT tag_id) = ?
            )`;
            params.push(...tagIds, tagIds.length); // Thêm các tag_id và số lượng tag cần khớp
        }
        // 3. Xử lý Sắp xếp (Sort)
        switch (sort) {
            case 'featured':
                query += ` ORDER BY score DESC`;
                break;
            case 'read_time_asc':
                query += ` ORDER BY a.read_time ASC`;
                break;
            case 'read_time_desc':
                query += ` ORDER BY a.read_time DESC`;
                break;
            case 'newest':
            default:
                query += ` ORDER BY a.created_at DESC`;
                break;
        }

        // 4. Phân trang
        query += ` LIMIT ? OFFSET ?`;
        params.push(limit.toString(), offset.toString());

        const [rows] = await pool.execute(query, params);
        return rows;
    },

    countPublicArticles: async ({ keyword, tagIds }) => {
        let params = [];
        let query = `
            SELECT COUNT(DISTINCT a.article_id) as total 
            FROM Article_Posts a
            WHERE a.status = 'public'
        `;

        if (keyword) {
            query += ` AND (
                a.title LIKE ? OR a.description LIKE ? OR a.content LIKE ?
                OR EXISTS (
                    SELECT 1 FROM tag_post tp 
                    JOIN Tags t ON tp.tag_id = t.tag_id 
                    WHERE tp.post_id = a.article_id AND tp.post_type = 'article' AND t.name LIKE ?
                )
            )`;
            const searchVal = `%${keyword}%`;
            params.push(searchVal, searchVal, searchVal, searchVal);
        }

        if (tagIds && tagIds.length > 0) {
            const placeholders = tagIds.map(() => '?').join(',');
            query += ` AND a.article_id IN (
                SELECT post_id FROM tag_post WHERE post_type = 'article' AND tag_id IN (${placeholders})
            )`;
            params.push(...tagIds);
        }

        const [rows] = await pool.execute(query, params);
        return rows[0].total;
    },

    // 4b. Lấy các bài viết nổi bật theo công thức điểm (score)
    // Công thức kết hợp: tương tác (comment_count), độ dài (read_time), báo cáo (report_count), tươi mới (created_at) và một jitter ngẫu nhiên để tránh lặp bài
    getFeaturedArticles: async (limit = 10) => {
        const query = `
            SELECT a.article_id, a.title, a.description, a.cover_image, a.created_at, a.comment_count, a.like_count, a.report_count, a.read_time,
                   u.full_name as author_name, u.avatar as author_avatar, u.user_id as author_id,
                   (
                       (LOG(1 + COALESCE(a.comment_count,0)) * 2)
                       + (1.5 * (1 / (1 + ABS(COALESCE(a.read_time,1) - 5))))
                       - (3 * COALESCE(a.report_count,0))
                       + (3 * GREATEST(0, 30 - TIMESTAMPDIFF(DAY, a.created_at, NOW())) / 30)
                       + (RAND() * 0.5)
                   ) AS score
            FROM Article_Posts a
            JOIN Users u ON a.user_id = u.user_id
            WHERE a.status = 'public'
            ORDER BY score DESC
            LIMIT ?
        `;

        const [rows] = await pool.execute(query, [limit.toString()]);
        return rows;
    },

    // Thêm vào ArticleModel trong file article.model.js

    // Lấy danh sách bài viết đã lưu của 1 user
    getSavedArticlesByUser: async ({ userId, limit, offset }) => {
        const query = `
            SELECT 
                a.article_id, a.title, a.description, a.cover_image, a.created_at, 
                a.comment_count, a.read_time, a.like_count, a.status,
                s.created_at as saved_at,
                u.full_name as author_name, u.avatar as author_avatar, u.user_id as author_id
            FROM Saved_Posts s
            JOIN Article_Posts a ON s.post_id = a.article_id
            JOIN Users u ON a.user_id = u.user_id
            WHERE s.user_id = ? AND s.post_type = 'article'
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.execute(query, [userId, limit.toString(), offset.toString()]);
        return rows;
    },

    // Đếm tổng số bài đã lưu để phân trang
    countSavedArticlesByUser: async (userId) => {
        const query = `
            SELECT COUNT(*) as total 
            FROM Saved_Posts 
            WHERE user_id = ? AND post_type = 'article'
        `;
        const [rows] = await pool.execute(query, [userId]);
        return rows[0].total;
    },

    // 5. Lấy bài viết của chính chuyên gia đó
    getOwnerArticles: async (userId) => {
        const query = `
            SELECT * FROM Article_Posts 
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;
        const [rows] = await pool.execute(query, [userId]);
        return rows;
    },

    // 6. Xóa bài viết
    deleteById: async (articleId) => {
        const query = `DELETE FROM Article_Posts WHERE article_id = ?`;
        const [result] = await pool.execute(query, [articleId]);
        return result;
    }

    ,
    // 7. Cập nhật status và update_at (dùng bởi admin controller)
    updateStatus: async (articleId, status) => {
        const query = `
            UPDATE Article_Posts 
            SET status = ?, update_at = NOW() 
            WHERE article_id = ?
        `;
        const [result] = await pool.execute(query, [status, articleId]);
        return result.affectedRows > 0;
    },

    // 8. Đếm tổng số bài viết (dùng bởi dashboard)
    countAllArticles: async (search = '') => {
        let query = `SELECT COUNT(*) as total FROM Article_Posts`;
        const params = [];
        if (search) {
            query += ` WHERE title LIKE ? OR description LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
        }
        const [rows] = await pool.execute(query, params);
        return rows[0].total;
    }
};

module.exports = ArticleModel;