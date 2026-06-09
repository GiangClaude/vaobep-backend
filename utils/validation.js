// utils/validation.js

// Kiểm tra postType hợp lệ
const isValidPostType = (type) => ['recipe', 'article', 'dish'].includes(type);

// Validate input cho báo cáo (report)
function validateReportInput({ postId, postType, reason }) {
    if (!postId || typeof postId !== 'string' || postId.trim() === '') {
        return { valid: false, message: 'Thiếu hoặc sai postId' };
    }
    if (!isValidPostType(postType)) {
        return { valid: false, message: 'postType không hợp lệ' };
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
        return { valid: false, message: 'Vui lòng chọn một lý do báo cáo' };
    }
    return { valid: true };
}

// Validate cho Like, Save, State (các hành động chỉ cần postId và postType)
function validateInteractionInput({ postId, postType }) {
    if (!postId || typeof postId !== 'string' || postId.trim() === '') {
        return { valid: false, message: 'ID bài viết không hợp lệ' };
    }
    if (!isValidPostType(postType)) {
        return { valid: false, message: 'Loại bài viết (postType) không hỗ trợ' };
    }
    return { valid: true };
}

function validateOwner(ownerId, userId) {
    if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
        return { valid: false, message: 'ID người sở hữu không hợp lệ' };
    }
    if (ownerId !== userId) {
        return { valid: false, message: 'Bạn không có quyền thực hiện hành động này' };
    }
    return { valid: true };
}

function validateCommentInput({ postId, postType, content, parentId }) {
    if (!postId || typeof postId !== 'string' || postId.trim() === '') {
        return { valid: false, message: 'ID bài viết không hợp lệ' };
    }
    if (!isValidPostType(postType)) {
        return { valid: false, message: 'Loại bài viết không hỗ trợ' };
    }
    if (!content || typeof content !== 'string' || content.trim() === '') {
        return { valid: false, message: 'Nội dung bình luận không được để trống' };
    }
    // parentId có thể null (nếu là comment gốc), nhưng nếu có thì phải là string
    if (parentId && typeof parentId !== 'string') {
        return { valid: false, message: 'ID bình luận cha không hợp lệ' };
    }
    return { valid: true };
}

module.exports = {
    isValidPostType,
    validateReportInput,
    validateInteractionInput,
    validateCommentInput 
};

