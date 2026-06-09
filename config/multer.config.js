// backend/config/multer.config.js
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const AppError = require('../utils/AppError');

// 1. Middleware kiểm tra định dạng file (Bảo mật)
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        // Ném lỗi vào AppError để Error Middleware của bạn bắt được
        cb(new AppError('Định dạng file không hợp lệ! Chỉ cho phép JPG, PNG, WEBP.', 400), false);
    }
};

// 2. Factory Function tạo cấu hình Multer (Giải quyết vi phạm OCP)
const createUploader = (entityConfig) => {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            // Lấy ID động dựa trên hàm getId truyền vào từ config
            const id = entityConfig.getId(req);
            let uploadPath = path.join(__dirname, '../public', entityConfig.folderName);

            if (id) {
                uploadPath = path.join(uploadPath, id.toString());
            } else {
                uploadPath = path.join(__dirname, '../public/temp');
            }

            // Tạo thư mục nếu chưa tồn tại (chỉ tạo 1 lần)
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }

            cb(null, uploadPath);
        },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname).toLowerCase();
            
            // Xử lý tiền tố thông minh: 'cover_image' -> 'cover', 'result_images' -> 'result'
            const prefix = file.fieldname.split('_')[0]; 
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            
            cb(null, `${prefix}_${uniqueSuffix}${ext}`);
        }
    });

    return multer({ 
        storage: storage,
        fileFilter: fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn 5MB
    });
};

// 3. Khai báo các module Upload cụ thể (Mở rộng thoải mái mà không cần sửa code lõi)
const uploadAvatar = createUploader({
    folderName: 'user',
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
    folderName: 'dictionarydish',
    getId: (req) => req.savedDishId || req.params.id
});

// Export các hàm middleware để Router sử dụng
module.exports = {
    uploadAvatar,
    uploadRecipe,
    uploadArticle,
    uploadDictionary
};