const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tag.controllers');

// GET /api/tags
router.get('/', tagController.getAllTags);

module.exports = router;