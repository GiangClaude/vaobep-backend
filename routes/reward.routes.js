const express = require('express');
const router = express.Router();
const RewardController = require('../controllers/reward.controllers');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

// Lấy danh sách hộp quà trong trang cá nhân
router.get('/my-rewards', protect, RewardController.getMyRewards);

// Gửi request mở quà
router.post('/claim', protect, RewardController.claimReward);

module.exports = router;