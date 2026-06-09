const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const dictionaryDishController = require('../controllers/dictionaryDish.controllers');

router.get('/map/summary', dictionaryDishController.getMapSummary);

// Route lấy tất cả món ăn có tọa độ (Zoom in)
router.get('/map/all', dictionaryDishController.getMapAllDishes);

// Route lấy danh sách bài viết từ điển
router.get('/', dictionaryDishController.getAllDishes);

router.post('/:id/vote-recipe', protect, dictionaryDishController.voteRecipeForDish);

// Route lấy chi tiết một bài viết từ điển
router.get('/:id', dictionaryDishController.getDishDetail);


module.exports = router;