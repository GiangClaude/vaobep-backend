const express = require('express');
const ingredientController = require('../controllers/ingredient.controllers');

const router = express.Router();

router.get('/', ingredientController.getAllIngredients);


module.exports = router;