const db = require('../config/db'); 
const pool = db.pool;

class Report {
    // Lấy danh sách báo cáo đang chờ xử lý (Pending)
    static async getPendingReports() {
        const query = `
            SELECT 
                r.report_id, r.reason, r.created_at,
                u.full_name as reporter_name, u.email as reporter_email,
                r.post_id, r.post_type
            FROM Reports r
            JOIN Users u ON r.reporter_user_id = u.user_id
            WHERE r.status = 'pending'
            ORDER BY r.created_at DESC
        `;
        const [rows] = await pool.execute(query);
        return rows;
    }

    // Đánh dấu báo cáo đã giải quyết
    static async resolveReport(reportId) {
        const query = `UPDATE Reports SET status = 'resolved' WHERE report_id = ?`;
        const [result] = await pool.execute(query, [reportId]);
        return result;
    }
}

module.exports = Report;