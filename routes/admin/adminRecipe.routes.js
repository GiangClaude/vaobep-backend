const express = require('express');
const router = express.Router();
const adminRecipeController = require('../../controllers/admin/adminRecipe.controller');
const { verifyAdminMiddleware } = require('../../utils/auth.utils');
const { uploadRecipe } = require('../../config/multer.config');

router.use(verifyAdminMiddleware);

router.get('/', adminRecipeController.getRecipes);
router.post('/', uploadRecipe.single('cover_image'), adminRecipeController.createAdminRecipe);
router.get('/:id', adminRecipeController.getRecipeDetail);
router.put('/:id', adminRecipeController.updateRecipe);
router.put('/:id/hide', adminRecipeController.hideRecipe);

module.exports = router;
