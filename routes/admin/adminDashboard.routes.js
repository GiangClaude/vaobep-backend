const express = require('express');
const router = express.Router();
const adminDashboardController = require('../../controllers/admin/adminDashboard.controller');
const { verifyAdminMiddleware } = require('../../utils/auth.utils');

router.use(verifyAdminMiddleware);

router.get('/', adminDashboardController.getDashboardStats);

module.exports = router;
