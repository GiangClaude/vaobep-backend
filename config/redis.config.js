const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('edis Client Error:', err.message));
redisClient.on('connect', () => console.log('Redis connected successfully'));

// Khởi tạo kết nối
redisClient.connect().catch(() => {
    console.warn('⚠️ Could not connect to Redis. Running without cache/rate-limit.');
});

module.exports = redisClient;