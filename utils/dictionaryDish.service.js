const { pool } = require('../config/db');

const DictionaryDishService = {
    // 1. Logic tạo tọa độ rải rác quanh trung tâm quốc gia
    generateJitteredCoordinates: async (countryName) => {
        const [rows] = await pool.execute(
            'SELECT lat, lng FROM Countries_Coordinates WHERE country_name = ?',
            [countryName]
        );

        if (rows.length > 0) {
            const { lat, lng } = rows[0];
            // Độ lệch ngẫu nhiên khoảng ±0.5 đến ±1.5 độ tùy ý bạn chỉnh
            const jitter = 0.8; 
            return {
                latitude: lat + (Math.random() - 0.5) * jitter * 2,
                longitude: lng + (Math.random() - 0.5) * jitter * 2
            };
        }
        return { latitude: null, longitude: null };
    },

    // 2. Logic tính toán Point tổng hợp (Gọi sau khi Like/Comment/Link...)
    recalculatePoint: async (dishId) => {
        const query = `
            UPDATE Dictionary_Dishes 
            SET point = (like_count * 1) + (comment_count * 2) + (eatery_count * 3) + (recipe_link_count * 5) - (report_count * 10)
            WHERE dish_id = ?
        `;
        await pool.execute(query, [dishId]);
    }
};

module.exports = DictionaryDishService;