const express = require('express');
const router = express.Router();
const { verifyAdminMiddleware } = require('../utils/auth.utils');

// Global admin protection
router.use(verifyAdminMiddleware);

// Mount focused admin sub-routers
router.use('/stats', require('./admin/adminDashboard.routes') || ((req,res)=>res.sendStatus(404)));
router.use('/users', require('./admin/adminUser.routes'));
router.use('/recipes', require('./admin/adminRecipe.routes'));
router.use('/ingredients', require('./admin/adminIngredient.routes'));
router.use('/reports', require('./admin/adminReport.routes'));
router.use('/dictionary', require('./admin/adminDictionary.routes'));
router.use('/articles', require('./admin/adminArticle.routes'));

module.exports = router;