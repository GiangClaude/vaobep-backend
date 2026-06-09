const InteractionService = require('../services/interaction.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/responseHelper');

const toggleLike = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { postId, postType } = req.body; 

    const result = await InteractionService.toggleLike(userId, postId, postType);
                    
    sendResponse(res, 200, true, result.message, { isLiked: result.isLiked });
});

const toggleSave = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { postId, postType } = req.body;

    const result = await InteractionService.toggleSave(userId, postId, postType);

    sendResponse(res, 200, true, result.message, { isSaved: result.isSaved });
});

const postComment = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { postId, postType, content, parentId } = req.body;

    const result = await InteractionService.postComment(userId, postId, postType, content, parentId);

    sendResponse(res, 201, true, result.message, result.newComment);
});

const editComment = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { commentId } = req.params; 
    const { content } = req.body;

    await InteractionService.editComment(userId, commentId, content);

    sendResponse(res, 200, true, "Cập nhật bình luận thành công");
});

const deleteComment = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { commentId } = req.params; 

    await InteractionService.deleteComment(userId, commentId);
    
    sendResponse(res, 200, true, "Xóa bình luận thành công");
});

const getComments = asyncHandler(async (req, res) => {
    const { postId, postType } = req.query; 
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const data = await InteractionService.getComments(postId, postType, page, limit);
    sendResponse(res, 200, true, 'Success', data);
});

const getReplies = asyncHandler(async (req, res) => {
    const { parentId } = req.params;
    const replies = await InteractionService.getReplies(parentId);
    sendResponse(res, 200, true, 'Success', replies);
});

const ratePost = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { postId, postType, score } = req.body;

    const result = await InteractionService.ratePost(userId, postId, postType, score);
    sendResponse(res, 200, true, 'Đánh giá thành công', result);
});

const followUser = asyncHandler(async (req, res) => {
    const followerId = req.user.user_id;
    const { followingId } = req.body;
    
    const result = await InteractionService.followUser(followerId, followingId);
    sendResponse(res, 200, true, result.message, { isFollowing: result.isFollowing });
});

const getInteractionState = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { postId, postType } = req.query;

    const state = await InteractionService.getInteractionState(userId, postId, postType);
    sendResponse(res, 200, true, 'Success', state);
});

const reportPost = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { postId, postType, reason } = req.body;

    const result = await InteractionService.reportPost(userId, postId, postType, reason);
    sendResponse(res, 201, true, 'Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét.', result);
});

module.exports = {
    toggleLike, toggleSave, postComment, editComment, deleteComment, 
    getComments, getReplies, ratePost, followUser, getInteractionState, reportPost
};