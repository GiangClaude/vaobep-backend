// backend/utils/cloudinary.js
const cloudinary = require('cloudinary').v2;

const getPublicIdFromUrl = (url) => {
    try {
        if (!url || !url.includes('/upload/')) return null;

        // 1. Cắt lấy phần đuôi sau chữ "/upload/"
        let publicIdWithExtension = url.split('/upload/')[1];

        // 2. Xóa cái version string đi (vd: "v1781103051/") nếu có
        publicIdWithExtension = publicIdWithExtension.replace(/^v\d+\//, '');

        // 3. Xóa đuôi mở rộng file (.jpg, .png, .webp)
        const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
        const publicId = lastDotIndex !== -1 
            ? publicIdWithExtension.substring(0, lastDotIndex) 
            : publicIdWithExtension;

        return publicId; 
        // Kết quả sẽ ra chuẩn xác: "vaobep/recipes/05a1b2c3-d0a1-11f0-8b2b-0a002700000f/cover_1732638100001"
    } catch (error) {
        console.error("Lỗi parse Cloudinary URL:", error);
        return null;
    }
};

const deleteCloudinaryImage = async (imageUrl) => {
    if (!imageUrl) return;
    
    const publicId = getPublicIdFromUrl(imageUrl);
    if (publicId) {
        try {
            await cloudinary.uploader.destroy(publicId);
            console.log(`[Cloudinary] Đã xóa ảnh: ${publicId}`);
        } catch (error) {
            console.error(`[Cloudinary] Lỗi xóa ảnh ${publicId}:`, error.message);
        }
    }
};

module.exports = { deleteCloudinaryImage, getPublicIdFromUrl };