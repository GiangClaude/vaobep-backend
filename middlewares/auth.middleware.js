const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authUtils = require('../utils/auth.utils');
const UserModel = require('../models/user.model');
const { createClient } = require('redis');
const redisClient = require('../config/redis.config'); 

const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        // 1. Giải mã Token
        const decoded = authUtils.verifyToken(token);
        
        if (!decoded) {
            throw new AppError('Xác thực thất bại, token không hợp lệ', 401);
        }

        const userId = decoded.id;
        const cacheKey = `auth_user:${userId}`;

        // 2. Kiểm tra trong Redis Cache 
        if (redisClient.isOpen) {
            const cachedUser = await redisClient.get(cacheKey);
            if (cachedUser) {
                req.user = JSON.parse(cachedUser);
                return next(); 
            }
        }

        const fetchedUser = await UserModel.findAuth(userId);
        req.user = Array.isArray(fetchedUser) ? fetchedUser[0] : fetchedUser;
        
        if (!req.user) {
            throw new AppError('Người dùng không còn tồn tại hoặc đã bị khóa', 401);
        }

        if (redisClient.isOpen) {
            await redisClient.set(cacheKey, JSON.stringify(req.user), { EX: 300 });
        }

        return next();
    }

    if (!token) {
        throw new AppError('Bạn chưa đăng nhập, vui lòng cung cấp token', 401);
    }
});

module.exports = { protect };