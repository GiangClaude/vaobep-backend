// backend/routes/reward.routes.js
const express = require('express');
const router = express.Router();
const RewardController = require('../controllers/reward.controllers');
const { protect } = require('../middlewares/auth.middleware');
 // Giả định bạn đã có middleware verify token

// Tất cả các route này đều cần đăng nhập
router.use(protect);

// Lấy danh sách hộp quà trong trang cá nhân
router.get('/my-rewards', RewardController.getMyRewards);

// Gửi request mở quà
router.post('/claim', RewardController.claimReward);

module.exports = router;