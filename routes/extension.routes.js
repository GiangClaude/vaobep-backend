const express = require('express');
const router = express.Router();
const extensionController = require('../controllers/extension.controllers');

router.get('/suggest', extensionController.suggestRecipes);
router.post('/search', extensionController.searchRecipes);
router.post('/identify-image', extensionController.identifyImage);
router.post('/ask-context', extensionController.askContext);

module.exports = router;