// VỊ TRÍ TẠO FILE MỚI: backend/services/apiKey.service.js

const { createClient } = require('redis');

// Khởi tạo Redis client độc lập cho ApiKey Service
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('❌ Redis Error in API Key Service:', err.message));
redisClient.connect().catch(() => {});

// Lấy danh sách keys từ .env (Hỗ trợ fallback về GOOGLE_API_KEY cũ nếu quên setup)
const rawKeys = process.env.GEMINI_API_KEYS || process.env.GOOGLE_API_KEY;
const API_KEYS = rawKeys ? rawKeys.split(',').map(k => k.trim()).filter(Boolean) : [];
const MAX_REQ_PER_MIN = parseInt(process.env.GEMINI_RATE_LIMIT || '14', 10);

/**
 * Thuật toán lấy API Key khả dụng (Round-robin kết hợp Redis Rate Limit)
 */
async function getAvailableKey() {
  if (API_KEYS.length === 0) {
    throw new Error('Chưa cấu hình GEMINI_API_KEYS trong file .env');
  }

  if (!redisClient.isOpen) {
    console.warn('⚠️ Redis không hoạt động, sử dụng Random API Key.');
    return API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
  }

  // Lặp qua từng key để tìm key nào còn "chỗ trống"
  for (const key of API_KEYS) {
    const redisKey = `ratelimit:gemini:${key.slice(-6)}`; 
    
    try {
      // INCR là thao tác Nguyên tử (Atomic). Trả về giá trị SAU KHI TĂNG.
      // Nếu 10 request vào cùng 1 mili-giây, Redis sẽ trả về lần lượt 1, 2, 3... 10. Chắc chắn không bị đụng độ.
      const currentCount = await redisClient.incr(redisKey);
      
      // Nếu là request đầu tiên (currentCount === 1), set thời gian sống cho key là 60 giây
      if (currentCount === 1) {
          await redisClient.expire(redisKey, 60); 
      }
      
      // Kiểm tra xem giới hạn đã bị vượt chưa
      if (currentCount <= MAX_REQ_PER_MIN) {
          return key; // Đạt yêu cầu, cấp phát key này cho LLM dùng
      }
      
      // Nếu > MAX_REQ_PER_MIN, vòng lặp tự động chạy sang kiểm tra API Key tiếp theo
    } catch (err) {
      console.error('Lỗi khi check Redis API Key:', err.message);
      // Lỗi Redis cho key này, thử tiếp key sau
    }
  }

  // Nếu chạy qua tất cả các Key mà không return được -> TẤT CẢ ĐỀU QUÁ TẢI
  throw new Error('RATE_LIMIT_EXCEEDED: Hệ thống AI đang quá tải. Vui lòng thử lại sau 1 phút.');
}

module.exports = { getAvailableKey };