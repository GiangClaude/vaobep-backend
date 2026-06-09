const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboard.controllers');

router.get('/recipes', leaderboardController.getTopRecipes);
router.get('/users', leaderboardController.getTopUsers);

// API ẩn dùng để kích hoạt chốt sổ thủ công (Test Postman)
router.post('/trigger-snapshot', leaderboardController.triggerSnapshot);

module.exports = router;