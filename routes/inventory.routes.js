const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controllers');

// Import middleware protect từ auth.controllers (Dựa theo cấu trúc bạn đã gửi)
const { protect } = require('../middlewares/auth.middleware');


// Lấy túi đồ của chính mình (Yêu cầu đăng nhập)
router.get('/me', protect, inventoryController.getMyInventory);

// Lấy vật phẩm của người khác (Public, mặc định là lấy badge)
// Route này để ở dưới cùng để tránh xung đột với '/me'
router.get('/:userId', inventoryController.getPublicInventory);

module.exports = router;