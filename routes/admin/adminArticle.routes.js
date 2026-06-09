const express = require('express');
const router = express.Router();
const adminArticleController = require('../../controllers/admin/adminArticle.controller');
const { verifyAdminMiddleware } = require('../../utils/auth.utils');

router.use(verifyAdminMiddleware);

router.get('/', adminArticleController.getArticles);
router.get('/:id', adminArticleController.getAdminArticleDetail);
router.put('/:id/status', adminArticleController.updateArticleStatus);
router.delete('/:id', adminArticleController.deleteArticle);

module.exports = router;
