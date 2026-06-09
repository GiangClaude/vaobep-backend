const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });
redisClient.connect().catch(() => {});

const PER_USER_LIMIT = parseInt(process.env.RATE_LIMIT_PER_USER || '2', 10); // per second
const GLOBAL_RPM = parseInt(process.env.GLOBAL_RPM || '15', 10);
const { sendResponse } = require('../utils/responseHelper');
const AppError = require('../utils/AppError');
async function perUserLimit(req, res, next) {
  try {
    const userId = (req.body && req.body.userId) || req.headers['x-user-id'] || req.ip;
    const userKey = `rl:u:${userId}`;
    const globalKey = `rl:global`;

    const userCount = await redisClient.incr(userKey);
    if (userCount === 1) {
      await redisClient.expire(userKey, 1);
    }
    if (userCount > PER_USER_LIMIT) {
      throw new AppError('Bạn thao tác quá nhanh, vui lòng thử lại sau vài giây.', 429);
    }

    const globalCount = await redisClient.incr(globalKey);
    if (globalCount === 1) {
      await redisClient.expire(globalKey, 60);
    }
    if (globalCount > GLOBAL_RPM) {
      throw new AppError('Hệ thống đang quá tải, vui lòng thử lại sau ít phút.', 429);
    }

    next();
  } catch (err) {
    console.error('Rate limit middleware error:', err.message);
    // Fail open on redis error
    next();
  }
}

module.exports = { perUserLimit };
