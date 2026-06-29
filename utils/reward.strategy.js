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

class PointsReward extends RewardStrategy {
    async apply(userId, value, connection) {
        const amount = parseInt(value);
        await connection.execute(
            "UPDATE users SET points = points + ? WHERE user_id = ?",
            [amount, userId]
        );
        return await PointTransaction.create({
            userId,
            type: 'redeem',
            amount: amount,
            message: `Nhận thưởng từ hộp quà`
        }, connection);
    }
}

class ItemReward extends RewardStrategy {
    async apply(userId, itemId, connection) {
        return await InventoryModel.addItem(userId, itemId, 1, connection);
    }
}

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