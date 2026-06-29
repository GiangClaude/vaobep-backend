const cloudinary = require('cloudinary').v2;

const getPublicIdFromUrl = (url) => {
    try {
        if (!url || !url.includes('/upload/')) return null;

        let publicIdWithExtension = url.split('/upload/')[1];

        publicIdWithExtension = publicIdWithExtension.replace(/^v\d+\//, '');

        const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
        const publicId = lastDotIndex !== -1 
            ? publicIdWithExtension.substring(0, lastDotIndex) 
            : publicIdWithExtension;

        return publicId; 
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