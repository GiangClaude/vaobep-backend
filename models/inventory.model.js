// backend/models/inventory.model.js
const db = require('../config/db');
const pool = db.pool;

class InventoryModel {
    /**
     * Thêm vật phẩm vào kho đồ (Nếu đã có thì cộng thêm số lượng)
     * @param {string} userId 
     * @param {string} itemId 
     * @param {number} quantity 
     * @param {object} connection - Để dùng trong Transaction
     */
    static async addItem(userId, itemId, quantity = 1, connection = null) {
        const dbExec = connection || pool;
        const sql = `
            INSERT INTO user_inventory (user_id, item_id, quantity)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
        `;
        const [result] = await dbExec.execute(sql, [userId, itemId, quantity]);
        return result.affectedRows > 0;
    }

 /**
     * Lấy kho đồ của User kèm thông tin chi tiết vật phẩm
     * @param {string} userId
     * @param {string|null} itemType - Lọc theo loại vật phẩm (badge, ticket, consumable,...)
     */
    static async getUserInventory(userId, itemType = null) {
        let sql = `
            SELECT i.item_id, i.name, i.description, i.icon_url, i.item_type, ui.quantity
            FROM user_inventory ui
            JOIN items i ON ui.item_id = i.item_id
            WHERE ui.user_id = ?
        `;
        const params = [userId];

        // Nếu có truyền itemType thì thêm điều kiện lọc vào SQL
        if (itemType) {
            sql += ` AND i.item_type = ?`;
            params.push(itemType);
        }

        const [rows] = await pool.execute(sql, params);
        console.log(`Lấy inventory cho user ${userId} với itemType ${itemType}:`, rows);
        return rows;
    }
    
    /**
     * Trừ vật phẩm khi sử dụng (Ví dụ khi dùng vé quảng bá)
     */
    static async consumeItem(userId, itemId, quantity = 1, connection = null) {
        const dbExec = connection || pool;
        const sql = `
            UPDATE user_inventory 
            SET quantity = quantity - ? 
            WHERE user_id = ? AND item_id = ? AND quantity >= ?
        `;
        const [result] = await dbExec.execute(sql, [quantity, userId, itemId, quantity]);
        return result.affectedRows > 0;
    }
}

module.exports = InventoryModel;