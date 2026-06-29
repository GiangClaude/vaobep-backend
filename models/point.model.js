// backend/models/point.model.js
const db = require('../config/db');
const pool = db.pool;

class PointTransaction {
    
    // Tạo lịch sử giao dịch mới
   static async create({ userId, type, amount, relatedUserId = null, message = '' }, connection = null) {
        const dbExec = connection || pool;
        const sql = `
            INSERT INTO point_transactions (user_id, type, amount, related_user_id, message)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await dbExec.execute(sql, [userId, type, amount, relatedUserId, message]);
        return result.insertId;
    }

    static async hasCheckedInToday(userId) {
        const sql = `
            SELECT transaction_id FROM point_transactions 
            WHERE user_id = ? 
            AND type = 'checkin' 
            AND DATE(created_at) = CURRENT_DATE()
        `;
        const [rows] = await pool.execute(sql, [userId]);
        return rows.length > 0;
    }

    static async getHistory(userId, page = 1, limit = 10, filterMonth = null) {
        const offset = (page - 1) * limit;
        let sql = `
            SELECT t.*, u.full_name as related_user_name, u.avatar as related_user_avatar
            FROM point_transactions t
            LEFT JOIN users u ON t.related_user_id = u.user_id
            WHERE t.user_id = ?
        `;
        const params = [userId];

        if (filterMonth) {
            sql += ` AND DATE_FORMAT(t.created_at, '%Y-%m') = ?`;
            params.push(filterMonth);
        }

        sql += ` ORDER BY t.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

        const [rows] = await pool.execute(sql, params);

        let countSql = `SELECT COUNT(*) as total FROM point_transactions WHERE user_id = ?`;
        const countParams = [userId];
        if (filterMonth) {
            countSql += ` AND DATE_FORMAT(created_at, '%Y-%m') = ?`;
            countParams.push(filterMonth);
        }
        const [countRows] = await pool.execute(countSql, countParams);

        return {
            transactions: rows,
            total: countRows[0].total,
            page: page,
            totalPages: Math.ceil(countRows[0].total / limit)
        };
    }
}

module.exports = PointTransaction;