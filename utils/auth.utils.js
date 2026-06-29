const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10; 
const { sendResponse } = require('./responseHelper');
const AppError = require('./AppError');

const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random()* 900000).toString();
}

const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null; 
    }
};

const validateOTP = async (email, otp) => {
    const user = await UserModel.findByEmailAndOTP(email, otp);

    if (!user) {
        throw new Error('Invalid OTP or Email');
    }

    if (new Date() > new Date(user.otp_expires_at)) {
        throw new Error('OTP het han');
    }

    return user;

}

const getUserIdFromToken = (req) => {
    console.log("Authorization header:", req.headers.authorization); 
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);
            
            return decoded.id; 
            
        } catch (e) {
            return null;
        }
    }
    return null;
};

const verifyAdminMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Vui lòng đăng nhập để tiếp tục.', 401);
        }
        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || !decoded.id) {
            throw new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 403);
        }

        const user = await UserModel.findById(decoded.id); 

        if (!user) {
            throw new AppError('Không tìm thấy người dùng.', 404);
        }

        if (user.role === 'admin') {
            req.user = user;
            return next();
        } else {
            throw new AppError('Truy cập bị từ chối. Chỉ dành cho Quản trị viên.', 403);
        }

    } catch (error) {
        console.error("Admin Auth Error:", error);
        throw new AppError(error.message || 'Không có quyền truy cập.', 403);
    }
};

const verifyProMiddleware = async (req, res, next) => {
    try {
        const userId = req.user?.user_id || req.user?.id; 
        
        if (!userId) {
            throw new AppError('Vui lòng đăng nhập để tiếp tục.', 401);
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            throw new AppError('Không tìm thấy người dùng.', 404);
        }

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