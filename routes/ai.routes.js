const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controllers');
const rateLimit = require('../middlewares/rateLimit.middleware');
const safety = require('../middlewares/safety.middleware'); // Nếu có

// 1. Endpoint Chat tổng hợp (Xử lý cả DB Query & Hỏi đáp theo ngữ cảnh bài viết)
router.post('/chat', rateLimit.perUserLimit, safety.loadRules, aiController.handleChat);

// 2. Endpoint Tóm tắt bài viết / công thức
router.post('/summarize', rateLimit.perUserLimit, aiController.summarizeContext);

// 3. Endpoint Xóa lịch sử
router.delete('/history', aiController.clearHistory);

module.exports = router;