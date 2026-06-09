// backend/utils/reward.strategy.js
const PointTransaction = require('../models/point.model');
const InventoryModel = require('../models/inventory.model');
const db = require('../config/db');
const pool = db.pool;

// 1. Interface (Base Class)
class RewardStrategy {
    async apply(userId, value, connection) {
        throw new Error("Method 'apply()' must be implemented.");
    }
}

// 2. Chiến lược cộng Điểm (Cập nhật bảng users và ghi log transaction)
class PointsReward extends RewardStrategy {
    async apply(userId, value, connection) {
        const amount = parseInt(value);
        // Cập nhật số điểm trong bảng users
        await connection.execute(
            "UPDATE users SET points = points + ? WHERE user_id = ?",
            [amount, userId]
        );
        // Ghi log vào Point_Transactions
        return await PointTransaction.create({
            userId,
            type: 'redeem',
            amount: amount,
            message: `Nhận thưởng từ hộp quà`
        }, connection);
    }
}

// 3. Chiến lược cấp Vật phẩm (Huy hiệu, Vé quảng bá...)
class ItemReward extends RewardStrategy {
    async apply(userId, itemId, connection) {
        // value ở đây chính là item_id
        return await InventoryModel.addItem(userId, itemId, 1, connection);
    }
}

// 4. Factory để lấy Strategy tương ứng
class RewardFactory {
    static getStrategy(type) {
        switch (type) {
            case 'points': return new PointsReward();
            case 'item': return new ItemReward();
            default: throw new Error(`Unknown reward type: ${type}`);
        }
    }
}

module.exports = { RewardFactory };