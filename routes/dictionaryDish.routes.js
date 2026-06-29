const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const dictionaryDishController = require('../controllers/dictionaryDish.controllers');

router.get('/map/summary', dictionaryDishController.getMapSummary);

router.get('/map/all', dictionaryDishController.getMapAllDishes);

router.get('/', dictionaryDishController.getAllDishes);

router.post('/:id/vote-recipe', protect, dictionaryDishController.voteRecipeForDish);

router.get('/:id', dictionaryDishController.getDishDetail);


module.exports = router;