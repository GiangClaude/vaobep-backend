// backend/utils/recipe.utils.js
const db = require('../config/db');
const pool = db.pool;

/**
 * Định nghĩa các hàm xử lý chuyên biệt cho từng bộ lọc cụ thể.
 * Thiết kế này giúp tuân thủ nghiêm ngặt nguyên lý Single Responsibility (SRP) và Open/Closed (OCP).
 */
const filterHandlers = {
    // Hàm xử lý lọc theo danh sách nguyên liệu
    ingredients: (values, ctx) => {
        if (!Array.isArray(values) || values.length === 0) return;
        const placeholders = values.map(() => '?').join(', ');
        
        ctx.joinClauses.push('JOIN Recipe_Ingredients AS RI ON R.recipe_id = RI.recipe_id');
        ctx.joinClauses.push('JOIN Ingredients AS Ing ON RI.ingredient_id = Ing.ingredient_id');
        ctx.whereClauses.push(`Ing.name IN (${placeholders})`);
        ctx.params.push(...values);
    },

    // Hàm xử lý tìm kiếm theo từ khóa (Tách biệt alias độc lập để tránh lỗi thiếu alias)
    keyword: (value, ctx) => {
        if (!value || String(value).trim() === '') return;
        const kw = `%${value}%`;
        
        ctx.joinClauses.push('LEFT JOIN Recipe_Ingredients AS RI_Search ON R.recipe_id = RI_Search.recipe_id');
        ctx.joinClauses.push('LEFT JOIN Ingredients AS Ing_Search ON RI_Search.ingredient_id = Ing_Search.ingredient_id');
        ctx.whereClauses.push('(LOWER(R.title) LIKE LOWER(?) OR LOWER(R.description) LIKE LOWER(?) OR LOWER(Ing_Search.name) LIKE LOWER(?))');
        ctx.params.push(kw, kw, kw);
    },

    // Hàm xử lý lọc theo danh sách thẻ Tags
    tags: (values, ctx) => {
        // Hỗ trợ cả trường hợp tags truyền lên dạng chuỗi ngăn cách bằng dấu phẩy
        const tagList = typeof values === 'string' ? values.split(',').filter(Boolean) : values;
        if (!Array.isArray(tagList) || tagList.length === 0) return;

        const placeholders = tagList.map(() => '?').join(', ');
        ctx.joinClauses.push('JOIN tag_post AS TP ON R.recipe_id = TP.post_id AND TP.post_type = "recipe"');
        ctx.whereClauses.push(`TP.tag_id IN (${placeholders})`);
        ctx.params.push(...tagList);
    },

    // Hàm xử lý lọc theo khoảng thời gian nấu
    cookingTime: (value, ctx) => {
        const timeMap = {
            '0-30': 'R.cook_time < 30',
            '30-60': '(R.cook_time >= 30 AND R.cook_time <= 60)',
            '60+': 'R.cook_time > 60'
        };
        if (timeMap[value]) {
            ctx.whereClauses.push(timeMap[value]);
        }
    },

    // Hàm xử lý lọc theo điểm đánh giá trung bình tối thiểu
    minRating: (value, ctx) => {
        const rating = parseFloat(value);
        if (!isNaN(rating)) {
            ctx.whereClauses.push('R.rating_avg_score >= ?');
            ctx.params.push(rating);
        }
    },

    // Hàm xử lý giới hạn lượng calo tối đa của món ăn
    maxCalo: (value, ctx) => {
        const calo = parseInt(value, 10);
        if (!isNaN(calo)) {
            ctx.whereClauses.push('R.total_calo <= ?');
            ctx.params.push(calo);
        }
    },

    // [MỞ RỘNG DỄ DÀNG] Ví dụ sau này bà muốn thêm lọc độ khó thì chỉ cần thêm dòng này:
    // difficulty: (value, ctx) => { ctx.whereClauses.push('R.difficulty = ?'); ctx.params.push(value); }
};

/**
 * Hàm trung tâm xây dựng các mảnh SQL (Join, Where, Params) dựa trên object bộ lọc đầu vào.
 * @param {object} filters - Chứa các trường dữ liệu cần lọc lấy từ req.query
 * @returns {object} {joinClauses, whereClauses, params}
 */
const buildRecipeQuery = (filters = {}) => {
    // Khởi tạo ngữ cảnh truy vấn mặc định
    const ctx = {
        joinClauses: [],
        whereClauses: ["R.status = 'public'"],
        params: []
    };

    // Quét qua các key filter do Frontend gửi lên và thực thi handler tương ứng (Tuân thủ OCP)
    Object.keys(filters).forEach(key => {
        const value = filters[key];
        const hasValue = value !== undefined && value !== null && value !== '';
        
        if (hasValue && filterHandlers[key]) {
            filterHandlers[key](value, ctx);
        }
    });

    console.log("Debug buildRecipeQuery (Cleaned):", ctx);
    return ctx;
};

/**
 * Hàm kiểm tra xem một user có phải là người tạo ra công thức nấu ăn đó không.
 */
const checkRecipeOwner = async (recipeId, userId) => {
    if (!recipeId || !userId) return false;
    try {
        const sql = 'SELECT user_id FROM Recipes WHERE recipe_id = ?';
        const [owner] = await pool.execute(sql, [recipeId]);

        return owner.length > 0 && owner[0].user_id === userId;
    } catch (error) {
        console.error("Lỗi khi kiểm tra quyền sở hữu recipe:", error);
        return false;     
    }
};

module.exports = {
    buildRecipeQuery,
    checkRecipeOwner
};