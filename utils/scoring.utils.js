/**
 * utils/scoring.utils.js
 * Chứa logic tính điểm chuẩn hóa cho Leaderboard.
 */

// Định nghĩa trọng số (Weights) - Dễ dàng cấu hình và thay đổi sau này
const WEIGHTS = {
    RECIPE: {
        LIKE: 10,
        COMMENT: 15,
        RATING_AVG: 20, // Điểm = Trung bình sao * 20 (VD: 5 sao = 100đ)
        LINK: 5,        // Số lượng article/dish liên kết
        TRUSTED: 100,
        GROWTH: 15,     // Mỗi tương tác tăng thêm (like/cmt) trong tháng x 15
        REPORT: -50     // Điểm trừ
    },
    USER: {
        RECIPE_AVG_POINT: 1, // Lấy trung bình điểm các công thức của user
        FOLLOWER: 20,
        FOLLOWER_GROWTH: 50, // Follower mới trong tháng x 50
        TRUSTED_RECIPE: 150,
        NEW_BADGE: 30
    }
};

/**
 * Tính điểm cho một Công thức (Recipe)
 * @param {Object} stats - Dữ liệu thống kê hiện tại
 * @param {number} stats.likeCount
 * @param {number} stats.commentCount
 * @param {number} stats.avgRating
 * @param {number} stats.linkCount
 * @param {boolean} stats.isTrusted
 * @param {number} stats.reportCount
 * @param {Object} growthStats - Tăng trưởng tuyệt đối trong tháng
 * @param {number} growthStats.newLikes
 * @param {number} growthStats.newComments
 * @returns {number} Điểm tổng
 */
const calculateRecipeScore = (stats, growthStats = { newLikes: 0, newComments: 0 }) => {
    let score = 0;

    // Tính điểm tĩnh
    score += (stats.likeCount || 0) * WEIGHTS.RECIPE.LIKE;
    score += (stats.commentCount || 0) * WEIGHTS.RECIPE.COMMENT;
    score += (stats.avgRating || 0) * WEIGHTS.RECIPE.RATING_AVG;
    score += (stats.linkCount || 0) * WEIGHTS.RECIPE.LINK;
    score += stats.isTrusted ? WEIGHTS.RECIPE.TRUSTED : 0;
    
    // Tính điểm trừ
    score += (stats.reportCount || 0) * WEIGHTS.RECIPE.REPORT;

    // Tính điểm tăng trưởng trong tháng
    const totalNewInteractions = (growthStats.newLikes || 0) + (growthStats.newComments || 0);
    score += totalNewInteractions * WEIGHTS.RECIPE.GROWTH;

    // Đảm bảo điểm không bị âm
    return Math.max(score, 0);
};

/**
 * Tính điểm cho một Đầu bếp (User)
 * @param {Object} stats 
 * @param {number} stats.avgRecipePoint 
 * @param {number} stats.followerCount 
 * @param {number} stats.trustedRecipeCount 
 * @param {Object} growthStats 
 * @param {number} growthStats.newFollowers 
 * @param {number} growthStats.newBadges 
 * @returns {number} Điểm tổng
 */
const calculateUserScore = (stats, growthStats = { newFollowers: 0, newBadges: 0 }) => {
    let score = 0;

    score += (stats.avgRecipePoint || 0) * WEIGHTS.USER.RECIPE_AVG_POINT;
    score += (stats.followerCount || 0) * WEIGHTS.USER.FOLLOWER;
    score += (stats.trustedRecipeCount || 0) * WEIGHTS.USER.TRUSTED_RECIPE;
    
    score += (growthStats.newFollowers || 0) * WEIGHTS.USER.FOLLOWER_GROWTH;
    score += (growthStats.newBadges || 0) * WEIGHTS.USER.NEW_BADGE;

    return Math.max(score, 0);
};

module.exports = {
    calculateRecipeScore,
    calculateUserScore,
    WEIGHTS
};