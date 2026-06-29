const { createClient } = require('redis');
const redisClient = require('../config/redis.config');
const rawKeys = process.env.GEMINI_API_KEYS || process.env.GOOGLE_API_KEY;
const API_KEYS = rawKeys ? rawKeys.split(',').map(k => k.trim()).filter(Boolean) : [];
const MAX_REQ_PER_MIN = parseInt(process.env.GEMINI_RATE_LIMIT || '14', 10);

async function getAvailableKey() {
  if (API_KEYS.length === 0) {
    throw new Error('Chưa cấu hình GEMINI_API_KEYS trong file .env');
  }

  if (!redisClient.isOpen) {
    console.warn('⚠️ Redis không hoạt động, sử dụng Random API Key.');
    return API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
  }

  for (const key of API_KEYS) {
    const redisKey = `ratelimit:gemini:${key.slice(-6)}`; 
    
    try {
      const currentCount = await redisClient.incr(redisKey);
      
      if (currentCount === 1) {
          await redisClient.expire(redisKey, 60); 
      }
      
      if (currentCount <= MAX_REQ_PER_MIN) {
          return key; 
      }
      
    } catch (err) {
      console.error('Lỗi khi check Redis API Key:', err.message);
    }
  }

  throw new Error('RATE_LIMIT_EXCEEDED: Hệ thống AI đang quá tải. Vui lòng thử lại sau 1 phút.');
}

module.exports = { getAvailableKey };