// backend/models/reward.model.js
const db = require('../config/db');
const pool = db.pool;

class RewardModel {
    /**
     * Lấy toàn bộ danh sách hộp quà của user (Cả chưa mở và đã mở)
     * Dùng để hiển thị trong tab "Phần thưởng" hoặc "Lịch sử nhận quà"
     */
    static async getUserRewardBoxes(userId) {
        const sql = `
            SELECT 
                ur.user_reward_id,
                ur.status,
                ur.claimed_at,
                rb.box_id,
                rb.name as box_name,
                rb.type as box_type,
                c.title as challenge_title
            FROM user_rewards ur
            JOIN reward_boxes rb ON ur.box_id = rb.box_id
            LEFT JOIN challenges c ON rb.challenge_id = c.challenge_id
            WHERE ur.user_id = ?
            ORDER BY ur.status ASC, ur.claimed_at DESC
        `;
        const [rows] = await pool.execute(sql, [userId]);
        return rows;
    }

    /**
     * Lấy chi tiết 1 bản ghi sở hữu hộp quà của user
     */
    static async getUserRewardById(userRewardId) {
        const sql = `
            SELECT ur.*, rb.type as box_type, rb.name as box_name
            FROM user_rewards ur
            JOIN reward_boxes rb ON ur.box_id = rb.box_id
            WHERE ur.user_reward_id = ?
        `;
        const [rows] = await pool.execute(sql, [userRewardId]);
        return rows[0];
    }

    /**
     * Lấy danh sách vật phẩm bên trong một hộp quà
     */
    static async getBoxItems(boxId) {
        const sql = `
            SELECT item_id, type, value, probability 
            FROM reward_items 
            WHERE box_id = ?
        `;
        const [rows] = await pool.execute(sql, [boxId]);
        return rows;
    }

    /**
     * Cập nhật trạng thái đã nhận thưởng
     * @param {string} userRewardId 
     * @param {object} connection - Connection từ transaction
     */
    static async updateClaimStatus(userRewardId, connection = null) {
        const dbExec = connection || pool;
        const sql = `
            UPDATE user_rewards 
            SET status = 'claimed', claimed_at = NOW() 
            WHERE user_reward_id = ? AND status = 'pending'
        `;
        const [result] = await dbExec.execute(sql, [userRewardId]);
        return result.affectedRows > 0;
    }
}

module.exports = RewardModel;