const express = require('express');
const authController = require('../controllers/auth.controllers');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');


// Đăng ký
router.post('/register', authController.register);
// Đăng nhập
router.post('/login', authController.login);
//Xác thực
router.post('/verify-otp', authController.verifyOTP);
router.post('/activate-account', authController.activateAccount);
router.post('/resend-otp', authController.resendOTP)
//Quên mật khẩu
router.post('/request-password-reset', authController.requestPasswordReset)
router.put('/reset-password', authController.resetPassword);
//Chủ động đổi mật khẩu
//Chuyển sang cho user(Nhớ kiểm tra lại)
// router.put('/change-password', protect, authController.changePasswordAuth);
module.exports = router;