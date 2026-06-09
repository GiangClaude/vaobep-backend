const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipe.controllers');
const { protect } = require('../middlewares/auth.middleware');


const { v4: uuidv4 } = require('uuid');

const { uploadRecipe } = require('../config/multer.config');
const uploadRecipeImages = uploadRecipe.fields([
  { name: 'cover_image', maxCount: 1 },
  { name: 'result_images', maxCount: 10 }
]);

// Đây là Middleware "Phát vé"
const generateRecipeId = (req, res, next) => {
    // 1. Tạo một ID mới
    const newId = uuidv4();
    
    // 2. "Gắn" ID này vào đối tượng req (request)
    // Chúng ta tự đặt tên biến là 'savedRecipeId' để dùng sau này
    req.savedRecipeId = newId;
    
    console.log("Đã tạo ID trước: ", req.savedRecipeId);

    // 3. Cho phép đi tiếp sang bước sau (là Multer)
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