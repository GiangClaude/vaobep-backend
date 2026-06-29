const express = require('express');
const router = express.Router();
const articleController = require('../controllers/article.controllers');
const { protect } = require('../middlewares/auth.middleware');
const { verifyProMiddleware } = require('../utils/auth.utils'); // Nhớ import middleware này
const { uploadArticle } = require('../config/multer.config');
const uploadArticleImages = uploadArticle.fields([
    { name: 'cover_image', maxCount: 1 }
]);
const { v4: uuidv4 } = require('uuid');

const generateArticleId = (req, res, next) => {
    req.savedArticleId = uuidv4();
    console.log("Đã tạo Article ID trước: ", req.savedArticleId);
    next();
};


router.get('/me/owner', protect, verifyProMiddleware, articleController.getOwnerArticles);
router.get('/me/saved', protect, articleController.getSavedArticles);

router.post('/create', 
    protect, 
    verifyProMiddleware, 
    generateArticleId, 
    uploadArticleImages, 
    articleController.createArticle
);

// Chỉnh sửa bài viết
router.put('/update/:articleId', 
    protect, 
    verifyProMiddleware, 
    uploadArticleImages, 
    articleController.updateArticle
);

// Xóa bài viết
router.delete('/delete/:articleId', 
    protect, 
    verifyProMiddleware, 
    articleController.deleteArticle
);


router.get('/', articleController.getPublicArticles); 

router.get('/featured', articleController.getFeaturedArticles);

router.get('/user/:userId', articleController.getUserArticles);

router.get('/:articleId', articleController.getArticleById); 

module.exports = router;