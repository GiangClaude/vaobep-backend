const express = require('express');
const router = express.Router();
const adminUserController = require('../../controllers/admin/adminUser.controller');
const { verifyAdminMiddleware } = require('../../utils/auth.utils');

router.use(verifyAdminMiddleware);

router.get('/', adminUserController.getUsers);
router.post('/', adminUserController.createUser);
router.get('/:id', adminUserController.getUserDetail);
router.put('/:id', adminUserController.updateUser);
router.put('/:id/status', adminUserController.toggleUserStatus);

module.exports = router;
