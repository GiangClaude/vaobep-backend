const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menu.controllers');
const { protect } = require('../middlewares/auth.middleware');

router.post('/create', protect, menuController.createMenu);

router.get('/me', protect, menuController.getUserMenus);

router.get('/public', menuController.getPublicMenus);

router.get('/user/:userId', menuController.getPublicMenusByUser);

router.get('/:menuId', menuController.getMenuById);

router.put('/update/:menuId', protect, menuController.updateMenu);

router.delete('/delete/:menuId', protect, menuController.deleteMenu);

router.get('/:menuId/shopping-list', menuController.getShoppingList);



// Nhân bản menu
router.post('/clone/:menuId', protect, menuController.cloneMenu);

// Gọi AI tư vấn thực đơn
router.post('/ai/consult', protect, menuController.consultMenuAI);
// AI tự động sinh thực đơn (RAG)
router.post('/ai/generate', protect, menuController.generateMenuAI);
module.exports = router;