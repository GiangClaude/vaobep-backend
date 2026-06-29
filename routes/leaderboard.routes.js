const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboard.controllers');

router.get('/recipes', leaderboardController.getTopRecipes);
router.get('/users', leaderboardController.getTopUsers);
router.post('/trigger-snapshot', leaderboardController.triggerSnapshot);

module.exports = router;