const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menu.controllers');
const { protect } = require('../middlewares/auth.middleware');

// Tạo menu mới
router.post('/create', protect, menuController.createMenu);

// Lấy danh sách menu của người dùng hiện tại
router.get('/me', protect, menuController.getUserMenus);


// Lấy danh sách menu công khai (Đặt TRƯỚC route /:menuId)
router.get('/public', menuController.getPublicMenus);

// Lấy thực đơn public của 1 user (đặt TRƯỚC route /:menuId)
router.get('/user/:userId', menuController.getPublicMenusByUser);

// Lấy chi tiết 1 menu (Route này tạm thời không dùng protect để người khác có thể xem menu public)
router.get('/:menuId', menuController.getMenuById);

// Cập nhật menu (Ghi đè cấu trúc)
router.put('/update/:menuId', protect, menuController.updateMenu);

// Xóa menu
router.delete('/delete/:menuId', protect, menuController.deleteMenu);

router.get('/:menuId/shopping-list', menuController.getShoppingList);



// Nhân bản menu
router.post('/clone/:menuId', protect, menuController.cloneMenu);

// Gọi AI tư vấn thực đơn
router.post('/ai/consult', protect, menuController.consultMenuAI);
// AI tự động sinh thực đơn (RAG)
router.post('/ai/generate', protect, menuController.generateMenuAI);
module.exports = router;