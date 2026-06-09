const express = require('express');
const router = express.Router();
const adminIngredientController = require('../../controllers/admin/adminIngredient.controller');
const { verifyAdminMiddleware } = require('../../utils/auth.utils');

router.use(verifyAdminMiddleware);

router.get('/pending', adminIngredientController.getPendingIngredients);
router.put('/:id/process', adminIngredientController.processIngredient);

// CRUD
router.get('/all', adminIngredientController.getAllIngredients);
router.post('/', adminIngredientController.createIngredient);
router.put('/:id', adminIngredientController.updateIngredient);
router.delete('/:id', adminIngredientController.deleteIngredient);

module.exports = router;
