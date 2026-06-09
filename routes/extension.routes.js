// VỊ TRÍ TẠO FILE MỚI: backend/routes/extension.routes.js

const express = require('express');
const router = express.Router();
const extensionController = require('../controllers/extension.controllers');

// Không cần middleware xác thực (login) vì extension sẽ dùng công khai (hoặc bạn có thể tự thêm sau)
router.get('/suggest', extensionController.suggestRecipes);
router.post('/search', extensionController.searchRecipes);
router.post('/identify-image', extensionController.identifyImage);
router.post('/ask-context', extensionController.askContext);

module.exports = router;