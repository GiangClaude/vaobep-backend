const db = require('../config/db');
const pool = db.pool;

class TagModel {
    static async getAll() {
        try {
            const sql = "SELECT * FROM tags ORDER BY name ASC";
            const [rows] = await pool.execute(sql);
            return rows;
        } catch (error) {
            console.error("Lỗi TagModel.getAll:", error);
            throw error;
        }
    }

    static async getTagsByPostId(postId) {
        try {
            const sql = `
                SELECT t.* FROM tags t
                JOIN tag_post tp ON t.tag_id = tp.tag_id
                WHERE tp.post_id = ?
            `;
            const [rows] = await pool.execute(sql, [postId]);
            return rows;
        } catch (error) {
            console.error("Lỗi TagModel.getTagsByPostId:", error);
            throw error; 
        }
    }


    // Hàm thêm danh sách tag mới cho một bài viết
    static async addTagsToPost(postId, postType, tagIds, connection) {
        if (!tagIds || tagIds.length === 0) return;
        
        const executor = connection || pool;

        const values = [];
        const placeholders = tagIds.map(tagId => {
            values.push(tagId, postId, postType);
            return '(?, ?, ?)';
        }).join(', ');

        const sql = `INSERT INTO tag_post (tag_id, post_id, post_type) VALUES ${placeholders}`;
        await executor.execute(sql, values);
    }

    // Hàm cập nhật tag 
    static async updateTagsForPost(postId, postType, tagIds, connection) {
        const isExternalConn = !!connection;
        const conn = connection || await pool.getConnection();
        try {
            if (!isExternalConn) await conn.beginTransaction();

            await connection.execute(`DELETE FROM tag_post WHERE post_id = ? AND post_type = ?`, [postId, postType]);

            if (tagIds && tagIds.length > 0) {
                const values = [];
                const placeholders = tagIds.map(tagId => {
                    values.push(tagId, postId, postType);
                    return '(?, ?, ?)';
                }).join(', ');
                
                await conn.execute(`INSERT INTO tag_post (tag_id, post_id, post_type) VALUES ${placeholders}`, values);
            }

            if (!isExternalConn) await conn.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = TagModel;