const LeaderboardModel = require('../models/leaderboard.model');
const AppError = require('../utils/AppError');

class LeaderboardService {
    /**
     * Helper ẩn (private): Kiểm tra xem có phải là tháng hiện tại không
     */
    _checkIsCurrentMonth(month, year) {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        return (!month && !year) || (parseInt(month) === currentMonth && parseInt(year) === currentYear);
    }

    async getTopRecipes(month, year) {
        const isCurrentMonth = this._checkIsCurrentMonth(month, year);
        let data = [];

        if (isCurrentMonth) {
             const cacheKey = 'leaderboard:live:recipes';
        
            // 1. Kiểm tra cache Redis
            if (redisClient.isOpen) {
                const cachedData = await redisClient.get(cacheKey);
                if (cachedData) return { data: JSON.parse(cachedData), isCurrentMonth: true };
            }

            // 2. Nếu không có cache, chọc vào MySQL (Chỉ 1 request bị chậm)
            data = await LeaderboardModel.getLiveTopRecipes(10);

            // 3. Lưu vào Redis, cấu hình sống (TTL) trong 5 phút (300s)
            if (redisClient.isOpen) {
                await redisClient.set(cacheKey, JSON.stringify(data), { EX: 300 });
            }

        } else {
            if (!month || !year) throw new AppError('Thiếu tháng hoặc năm', 400);
            data = await LeaderboardModel.getHistoryLeaderboard('recipe', parseInt(month), parseInt(year), 10);
        }

        return { data, isCurrentMonth: true };
    }

    async getTopUsers(month, year) {
        const isCurrentMonth = this._checkIsCurrentMonth(month, year);
        let data = [];

        if (isCurrentMonth) {
            data = await LeaderboardModel.getLiveTopUsers(10);
        } else {
            if (!month || !year) throw new AppError('Thiếu tháng hoặc năm', 400);
            data = await LeaderboardModel.getHistoryLeaderboard('user', parseInt(month), parseInt(year), 10);
        }

        return { data, isCurrentMonth };
    }

    async triggerSnapshot() {
        return await LeaderboardModel.runMonthlySnapshot();
    }
}

module.exports = new LeaderboardService();