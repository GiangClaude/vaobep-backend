// backend/services/reward.service.js
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
     * Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
     * Sử dụng Strategy Pattern để linh hoạt xử lý từng loại quà
     */
    async claimReward(userRewardId, userId) {
        const connection = await db.pool.getConnection();

        try {
            // Mở Transaction
            await connection.beginTransaction();

            // 1. Kiểm tra hộp quà có tồn tại và đúng là của user này không
            const userReward = await RewardModel.getUserRewardById(userRewardId);
            if (!userReward || userReward.user_id !== userId) {
                await connection.rollback();
                throw new AppError('Phần thưởng không tồn tại hoặc không thuộc về bạn.', 404);
            }

            // 2. Kiểm tra xem quà đã được nhận chưa
            if (userReward.status === 'claimed') {
                await connection.rollback();
                throw new AppError('Phần thưởng này đã được nhận rồi.', 400);
            }

            // 3. Lấy danh sách vật phẩm bên trong hộp quà
            const items = await RewardModel.getBoxItems(userReward.box_id);
            if (!items || items.length === 0) {
                await connection.rollback();
                throw new AppError('Hộp quà này trống rỗng (Lỗi cấu hình hệ thống).', 500);
            }

            const receivedItems = [];

            // 4. Xử lý từng vật phẩm (Áp dụng tỉ lệ rơi đồ nếu là hộp Gacha)
            for (const item of items) {
                if (userReward.box_type === 'gacha' && Math.random() > item.probability) {
                    continue; // Trượt tỉ lệ (quay xịt), bỏ qua vật phẩm này
                }

                // Dùng Strategy Pattern để trao thưởng tùy theo loại vật phẩm (điểm, huy hiệu, v.v.)
                const strategy = RewardFactory.getStrategy(item.type);
                await strategy.apply(userId, item.value, connection);

                receivedItems.push({ type: item.type, value: item.value });
            }

            // 5. Đánh dấu hộp quà này là "Đã nhận" (claimed)
            const updated = await RewardModel.updateClaimStatus(userRewardId, connection);
            if (!updated) {
                await connection.rollback();
                throw new AppError('Không thể cập nhật trạng thái nhận thưởng.', 500);
            }

            // Hoàn tất Transaction
            await connection.commit();

            return { 
                message: receivedItems.length > 0 ? 'Mở quà thành công!' : 'Rất tiếc, bạn không trúng vật phẩm nào.', 
                data: receivedItems 
            };

        } catch (error) {
            // Bất kỳ lỗi nào (AppError hoặc lỗi DB) đều sẽ Rollback để bảo toàn dữ liệu
            await connection.rollback();
            throw error;
        } finally {
            // Luôn luôn trả connection về pool để tránh tràn RAM/kẹt DB
            connection.release();
        }
    }
}

// Xuất ra một instance duy nhất (Singleton Pattern)
module.exports = new RewardService();