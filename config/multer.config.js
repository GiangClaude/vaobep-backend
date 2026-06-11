// backend/config/multer.config.js
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const AppError = require('../utils/AppError');

// 1. Cấu hình kết nối Cloudinary (Đọc từ biến môi trường)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Middleware kiểm tra định dạng file (Giữ nguyên của bạn)
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Định dạng file không hợp lệ! Chỉ cho phép JPG, PNG, WEBP.', 400), false);
    }
};

// 3. Factory Function tạo cấu hình Multer với Cloudinary
const createUploader = (entityConfig) => {
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            // Lấy ID động
            const id = entityConfig.getId(req) || 'temp';
            
            // Tạo thư mục trên Cloudinary giống hệt cấu trúc cũ của bạn (ví dụ: vaobep/user/1)
            const folderPath = `vaobep/${entityConfig.folderName}/${id}`;
            
            // Xử lý tiền tố thông minh
            const prefix = file.fieldname.split('_')[0]; 
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            console.log("multer: ", folderPath);

            return {
                folder: folderPath,
                allowed_formats: ['jpg', 'png', 'jpeg', 'webp'], // Thay thế fileFilter bên dưới nhưng khai báo thêm cho chắc chắn
                public_id: `${prefix}_${uniqueSuffix}` // Tên file (không cần đuôi mở rộng vì Cloudinary tự lo)
            };
        },
    });

    return multer({ 
        storage: storage,
        fileFilter: fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn 5MB
    });
};

// 4. Khai báo các module Upload cụ thể (Giữ nguyên)
const uploadAvatar = createUploader({
    folderName: 'users',
    getId: (req) => req.user?.user_id || req.user?.id
});

const uploadRecipe = createUploader({
    folderName: 'recipes',
    getId: (req) => req.savedRecipeId || req.params.recipeId || req.params.id
});

const uploadArticle = createUploader({
    folderName: 'articles',
    getId: (req) => req.savedArticleId || req.params.articleId || req.params.id
});

const uploadDictionary = createUploader({
    folderName: 'dictionarydishes',
    getId: (req) => req.dishId || req.params.id
});

// Export các hàm middleware để Router sử dụng
module.exports = {
    uploadAvatar,
    uploadRecipe,
    uploadArticle,
    uploadDictionary
};