const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interaction.controllers');
const { protect } = require('../middlewares/auth.middleware');


router.post('/like', protect, interactionController.toggleLike);
router.post('/save', protect, interactionController.toggleSave);

router.post('/comment', protect, interactionController.postComment);
router.get('/comments', interactionController.getComments); // Không cần protect nếu cho khách xem cmt
router.get('/comments/:parentId/replies', interactionController.getReplies);
router.put('/comment/:commentId', protect, interactionController.editComment);
router.delete('/comment/:commentId', protect, interactionController.deleteComment);
router.post('/rate', protect, interactionController.ratePost);

router.post('/follow', protect, interactionController.followUser);

router.post('/report', protect, interactionController.reportPost);

router.get('/state', protect, interactionController.getInteractionState);

module.exports = router;