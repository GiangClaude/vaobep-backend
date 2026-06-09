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
            data = await LeaderboardModel.getLiveTopRecipes(10);
        } else {
            if (!month || !year) throw new AppError('Thiếu tháng hoặc năm', 400);
            data = await LeaderboardModel.getHistoryLeaderboard('recipe', parseInt(month), parseInt(year), 10);
        }

        return { data, isCurrentMonth };
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