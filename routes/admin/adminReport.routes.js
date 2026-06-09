const express = require('express');
const router = express.Router();
const adminReportController = require('../../controllers/admin/adminReport.controller');
const { verifyAdminMiddleware } = require('../../utils/auth.utils');

router.use(verifyAdminMiddleware);

router.get('/', adminReportController.getReports);
router.post('/process', adminReportController.processReport);

module.exports = router;
