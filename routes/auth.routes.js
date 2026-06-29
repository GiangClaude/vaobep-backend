const express = require('express');
const authController = require('../controllers/auth.controllers');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');


router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOTP);
router.post('/activate-account', authController.activateAccount);
router.post('/resend-otp', authController.resendOTP)
router.post('/request-password-reset', authController.requestPasswordReset)
router.put('/reset-password', authController.resetPassword);

module.exports = router;