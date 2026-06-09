// backend/utils/auth.utils.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// require('dotenv').config();
const UserModel = require('../models/user.model');
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10; // Độ phức tạp của thuật toán hash
const { sendResponse } = require('./responseHelper');
const AppError = require('./AppError');

const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const generateToken = (userId) => {
    // Token sẽ hết hạn sau 1 giờ
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random()* 900000).toString();
}

const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null; // Token không hợp lệ hoặc hết hạn
    }
};

const validateOTP = async (email, otp) => {
    const user = await UserModel.findByEmailAndOTP(email, otp);

    // 2. Nếu không tìm thấy (OTP sai)
    if (!user) {
        throw new Error('Invalid OTP or Email');
    }

    // 3. Kiểm tra xem OTP còn hạn không
    if (new Date() > new Date(user.otp_expires_at)) {
        // (Nâng cao: Ở đây nên xóa OTP cũ đi)
        throw new Error('OTP het han');
    }

    return user;

}

const getUserIdFromToken = (req) => {
    console.log("Authorization header:", req.headers.authorization); // Debug log để kiểm tra header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);
            
            return decoded.id; // Code Mới
            
        } catch (e) {
            return null;
        }
    }
    return null;
};

const verifyAdminMiddleware = async (req, res, next) => {
    try {
        // 1. Lấy token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Vui lòng đăng nhập để tiếp tục.', 401);
        }
        const token = authHeader.split(' ')[1];

        // 2. Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || !decoded.id) {
            throw new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 403);
        }

        // 3. Query DB để lấy Role (Tuân thủ nguyên tắc Clean Code: Logic DB nằm trong Model)
        // Giả định UserModel đã có findById. Nếu chưa, bạn cần thêm vào user.model.js
        const user = await UserModel.findById(decoded.id); 

        if (!user) {
            throw new AppError('Không tìm thấy người dùng.', 404);
        }

        // 4. Check Role
        if (user.role === 'admin') {
            req.user = user; // Gán user vào req để dùng ở controller sau nếu cần
            return next();
        } else {
            throw new AppError('Truy cập bị từ chối. Chỉ dành cho Quản trị viên.', 403);
        }

    } catch (error) {
        console.error("Admin Auth Error:", error);
        throw new AppError(error.message || 'Không có quyền truy cập.', 403);
    }
};

// Thêm vào backend/utils/auth.utils.js
const verifyProMiddleware = async (req, res, next) => {
    try {
        // Sử dụng protect middleware trước đó đã gắn req.user
        const userId = req.user?.user_id || req.user?.id; // Tùy thuộc vào payload JWT của bạn
        
        if (!userId) {
            throw new AppError('Vui lòng đăng nhập để tiếp tục.', 401);
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            throw new AppError('Không tìm thấy người dùng.', 404);
        }

        // Chỉ cho phép pro hoặc admin
        if (user.role === 'pro' || user.role === 'admin') {
            req.user = user; 
            return next();
        } else {
            throw new AppError('Truy cập bị từ chối. Chỉ dành cho Chuyên gia hoặc Admin.', 403);
        }
    } catch (error) {
        console.error("Pro Auth Error:", error);
        throw new AppError('Lỗi phân quyền chuyên gia', 500);
    }
};

// Nhớ export thêm verifyProMiddleware

module.exports = {
    hashPassword,
    comparePassword,
    generateToken,
    verifyToken,
    generateOTP,
    validateOTP, 
    getUserIdFromToken,
    verifyAdminMiddleware,
    verifyProMiddleware
};