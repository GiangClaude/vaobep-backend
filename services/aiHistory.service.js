// backend/services/aiHistory.service.js
const { createClient } = require('redis');

class AIHistoryService {
    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = createClient({ url: redisUrl });
        this.client.on('error', (err) => console.error('❌ Redis Error in AI History:', err.message));
        this.client.connect().catch(() => {});
    }

    _getKey(sessionId, userId) {
        return `chat_history:${sessionId || userId}`;
    }

    async getHistory(sessionId, userId) {
        try {
            if (this.client.isOpen) {
                const historyStr = await this.client.get(this._getKey(sessionId, userId));
                if (historyStr) return JSON.parse(historyStr);
            }
        } catch (e) {
            console.error("Lỗi lấy lịch sử Redis:", e.message);
        }
        return [];
    }

    async saveHistory(sessionId, userId, chatHistory, ttl = 3600) {
        try {
            if (this.client.isOpen) {
                await this.client.set(this._getKey(sessionId, userId), JSON.stringify(chatHistory), { EX: ttl });
            }
        } catch (e) {
            console.error("Lỗi lưu lịch sử Redis:", e.message);
        }
    }

    async clearHistory(sessionId, userId) {
        try {
            if (this.client.isOpen) {
                const key = this._getKey(sessionId, userId);
                await this.client.del(key);
                console.log(`🧹 Đã xóa lịch sử chat: ${key}`);
            }
        } catch (e) {
            console.error("Lỗi xóa lịch sử Redis:", e.message);
        }
    }
}

module.exports = new AIHistoryService();