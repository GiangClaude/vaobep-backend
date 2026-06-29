const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controllers');
const rateLimit = require('../middlewares/rateLimit.middleware');
const safety = require('../middlewares/safety.middleware'); // Nếu có

router.post('/chat', rateLimit.perUserLimit, safety.loadRules, aiController.handleChat);

router.post('/summarize', rateLimit.perUserLimit, aiController.summarizeContext);

router.delete('/history', aiController.clearHistory);

router.post('/analyze-post', aiController.suggestPostTagsAndCalo);

module.exports = router;