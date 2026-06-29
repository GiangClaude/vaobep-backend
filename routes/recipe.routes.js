const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipe.controllers');
const { protect } = require('../middlewares/auth.middleware');


const { v4: uuidv4 } = require('uuid');

const { uploadRecipe } = require('../config/multer.config');
const uploadRecipeImages = uploadRecipe.any();

const generateRecipeId = (req, res, next) => {
    const newId = uuidv4();
    req.savedRecipeId = newId;
    next();
}

router.post('/create', 
    protect, 
    generateRecipeId,
    uploadRecipeImages,
    recipeController.createRecipe
);

router.get('/', recipeController.getRecipes);

router.get('/recently', recipeController.getRecentlyRecipes);
router.get('/feature', recipeController.getFeatureRecipes);
router.get('/owner', protect, recipeController.getOwnerRecipe);
router.get('/saved', protect, recipeController.getSavedRecipes);
router.get('/user/:userId', recipeController.getUserRecipe);
router.get('/:recipeId/preview-comments', recipeController.getPreviewComments);
router.get('/:recipeId', recipeController.getRecipeById);


router.put('/update/:recipeId', protect, uploadRecipeImages, recipeController.updateRecipe);

router.patch('/status/:recipeId', protect, recipeController.changeRecipeStatus);

router.delete('/delete/:recipeId',protect, recipeController.deleteRecipe);

router.get('/search/simple', recipeController.searchSimpleRecipes);

module.exports = router;