const RewardModel = require('../models/reward.model');
const { RewardFactory } = require('../utils/reward.strategy');
const db = require('../config/db');
const AppError = require('../utils/AppError');

class RewardService {
    /**
     * Lấy danh sách hộp quà của user
     */
    async getMyRewards(userId) {
        const boxes = await RewardModel.getUserRewardBoxes(userId);
        return boxes;
    }

    /**
     * Mở hộp quà (Claim reward)
     */
    async claimReward(userRewardId, userId) {
        const connection = await db.pool.getConnection();

        try {
            await connection.beginTransaction();

            const userReward = await RewardModel.getUserRewardById(userRewardId);
            if (!userReward || userReward.user_id !== userId) {
                await connection.rollback();
                throw new AppError('Phần thưởng không tồn tại hoặc không thuộc về bạn.', 404);
            }

            if (userReward.status === 'claimed') {
                await connection.rollback();
                throw new AppError('Phần thưởng này đã được nhận rồi.', 400);
            }

            const items = await RewardModel.getBoxItems(userReward.box_id);
            if (!items || items.length === 0) {
                await connection.rollback();
                throw new AppError('Hộp quà này trống rỗng (Lỗi cấu hình hệ thống).', 500);
            }

            const receivedItems = [];

            for (const item of items) {
                if (userReward.box_type === 'gacha' && Math.random() > item.probability) {
                    continue; 
                }

                const strategy = RewardFactory.getStrategy(item.type);
                await strategy.apply(userId, item.value, connection);

                receivedItems.push({ type: item.type, value: item.value });
            }

            const updated = await RewardModel.updateClaimStatus(userRewardId, connection);
            if (!updated) {
                await connection.rollback();
                throw new AppError('Không thể cập nhật trạng thái nhận thưởng.', 500);
            }

            await connection.commit();

            return { 
                message: receivedItems.length > 0 ? 'Mở quà thành công!' : 'Rất tiếc, bạn không trúng vật phẩm nào.', 
                data: receivedItems 
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new RewardService();