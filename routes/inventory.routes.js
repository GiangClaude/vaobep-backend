const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controllers');

const { protect } = require('../middlewares/auth.middleware');


router.get('/me', protect, inventoryController.getMyInventory);

router.get('/:userId', inventoryController.getPublicInventory);

module.exports = router;