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

// Middleware tạo ID cho bài viết trước khi Upload ảnh (giống Recipe)
const generateArticleId = (req, res, next) => {
    req.savedArticleId = uuidv4();
    console.log("Đã tạo Article ID trước: ", req.savedArticleId);
    next();
};



// ==========================================
// CÁC ROUTES DÀNH CHO CHUYÊN GIA (PRO) VÀ ADMIN
// ==========================================

// Lấy danh sách bài của chính mình
router.get('/me/owner', protect, verifyProMiddleware, articleController.getOwnerArticles);
router.get('/me/saved', protect, articleController.getSavedArticles);

// Đăng bài viết mới
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


// ==========================================
// CÁC ROUTES DÀNH CHO NGƯỜI DÙNG/KHÁCH (GUEST)
// ==========================================
router.get('/', articleController.getPublicArticles); // Xem danh sách bài viết public
// Bài viết nổi bật
router.get('/featured', articleController.getFeaturedArticles);
router.get('/:articleId', articleController.getArticleById); // Xem chi tiết 1 bài viết


module.exports = router;