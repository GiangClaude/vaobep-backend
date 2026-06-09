const db = require('../config/db');
const aiService = require('./ai.service');
const vectorStore = require('./vectorstore.service');

// Lấy namespace từ .env, mặc định là 'food-content'
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || 'food-content';

/**
 * BƯỚC 1: CÁC HÀM TRUY VẤN GOM DỮ LIỆU (AGGREGATION QUERIES)
 */

async function getRecipeDataForAI(recipeId) {
    const query = `
        SELECT 
            r.recipe_id, r.title, r.description, r.instructions, r.status,
            u.full_name as author_name,
            (SELECT GROUP_CONCAT(t.name SEPARATOR ', ') FROM tag_post tp JOIN Tags t ON tp.tag_id = t.tag_id WHERE tp.post_id = r.recipe_id AND tp.post_type = 'recipe') as tags,
            (SELECT GROUP_CONCAT(i.name SEPARATOR ', ') FROM recipe_ingredients ri JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id WHERE ri.recipe_id = r.recipe_id) as ingredients
        FROM Recipes r 
        JOIN Users u ON r.user_id = u.user_id 
        WHERE r.recipe_id = ?
    `;
    const [rows] = await db.pool.execute(query, [recipeId]);
    return rows[0];
}

async function getArticleDataForAI(articleId) {
    const query = `
        SELECT 
            a.article_id, a.title, a.description, a.content, a.status,
            u.full_name as author_name,
            (SELECT GROUP_CONCAT(CONCAT(r.title, ' (ID: ', r.recipe_id, ')') SEPARATOR ' | ') 
             FROM recipe_post_links rpl 
             JOIN Recipes r ON rpl.source_recipe_id = r.recipe_id 
             WHERE rpl.linked_post_id = a.article_id AND rpl.linked_post_type = 'article') as linked_recipes
        FROM Article_Posts a 
        JOIN Users u ON a.user_id = u.user_id 
        WHERE a.article_id = ?
    `;
    const [rows] = await db.pool.execute(query, [articleId]);
    return rows[0];
}

async function getDishDataForAI(dishId) {
    const query = `
        SELECT 
            d.dish_id, d.original_name, d.description, d.country,
            (SELECT GROUP_CONCAT(name SEPARATOR ', ') FROM Dish_Eateries WHERE dish_id = d.dish_id) as eateries,
            (SELECT GROUP_CONCAT(CONCAT(r.title, ' (ID: ', r.recipe_id, ')') SEPARATOR ' | ') 
             FROM recipe_post_links rpl 
             JOIN Recipes r ON rpl.source_recipe_id = r.recipe_id 
             WHERE rpl.linked_post_id = d.dish_id AND rpl.linked_post_type = 'dish') as linked_recipes
        FROM Dictionary_Dishes d 
        WHERE d.dish_id = ?
    `;
    const [rows] = await db.pool.execute(query, [dishId]);
    return rows[0];
}

/**
 * BƯỚC 2: CÁC HÀM FORMAT TEXT CHO AI
 */

function formatRecipeText(data) {
    if (!data) return '';
    return `[LOẠI: CÔNG THỨC NẤU ĂN]
            Tên món: ${data.title || ''}
            Tác giả: ${data.author_name || ''}
            Mô tả: ${data.description || ''}
            Phân loại (Tags): ${data.tags || 'Không có'}
            Nguyên liệu: ${data.ingredients || 'Không có'}
            Hướng dẫn: ${data.instructions || ''}`.trim();
}

function formatArticleText(data) {
    if (!data) return '';
    // Giới hạn content 1000 ký tự để tiết kiệm token và tránh nhiễu
    const shortContent = data.content ? data.content.substring(0, 1000) : '';
    return `[LOẠI: BÀI VIẾT ẨM THỰC]
        Tiêu đề: ${data.title || ''}
        Tác giả: ${data.author_name || ''}
        Mô tả: ${data.description || ''}
        Nội dung tóm tắt: ${shortContent}...
        Công thức liên kết (Tham khảo): ${data.linked_recipes || 'Không có'}`.trim();
}

function formatDishText(data) {
    if (!data) return '';
    return `[LOẠI: TỪ ĐIỂN MÓN ĂN]
        Tên món: ${data.original_name || ''}
        Quốc gia/Vùng miền: ${data.country || 'Chưa cập nhật'}
        Mô tả & Lịch sử: ${data.description || ''}
        Quán ăn gợi ý: ${data.eateries || 'Chưa cập nhật'}
        Công thức liên kết (Tham khảo): ${data.linked_recipes || 'Không có'}`.trim();
}

/**
 * HÀM CHÍNH ĐỂ ĐỒNG BỘ LÊN PINECONE
 * Hàm này sẽ được gọi bởi Worker/Job Queue sau này
 */
async function syncEntityToPinecone(entityId, type, action) {
    try {
        console.log(`🔄 Bắt đầu đồng bộ Pinecone: [${type}] - ID: ${entityId} - Action: ${action}`);

        // Nếu là hành động xóa (hoặc bị ẩn/ban)
        if (action === 'delete') {
            // YÊU CẦU: Hàm vectorStore.deleteVector() phải được thêm vào vectorstore.service.js
            if(typeof vectorStore.deleteVector === 'function'){
                await vectorStore.deleteVector(entityId, PINECONE_NAMESPACE);
                console.log(`✅ Đã xóa vector [${type}] ID: ${entityId} khỏi Pinecone`);
            } else {
                console.warn(`⚠️ Bỏ qua xóa Pinecone vì chưa có hàm deleteVector!`);
            }
            return;
        }

        // Nếu là hành động Thêm/Sửa (upsert)
        let data, textToEmbed, metadata;

        if (type === 'recipe') {
            data = await getRecipeDataForAI(entityId);
            if (!data) throw new Error(`Không tìm thấy Recipe ID: ${entityId} trong DB`);
            textToEmbed = formatRecipeText(data);
            metadata = { id: entityId, type: 'recipe', title: data.title, status: data.status };
        } 
        else if (type === 'article') {
            data = await getArticleDataForAI(entityId);
            if (!data) throw new Error(`Không tìm thấy Article ID: ${entityId} trong DB`);
            textToEmbed = formatArticleText(data);
            metadata = { id: entityId, type: 'article', title: data.title, status: data.status };
        } 
        else if (type === 'dish') {
            data = await getDishDataForAI(entityId);
            if (!data) throw new Error(`Không tìm thấy Dish ID: ${entityId} trong DB`);
            textToEmbed = formatDishText(data);
            metadata = { id: entityId, type: 'dish', title: data.original_name, status: 'public' }; // Dish luôn coi là public
        }

        // Gọi Gemini lấy Embedding Vector
        const vectorValues = await aiService.getEmbedding(textToEmbed);

        // Đẩy lên Pinecone
        const vectorData = [{
            id: entityId,
            values: vectorValues,
            metadata: metadata
        }];

        await vectorStore.upsert(vectorData, PINECONE_NAMESPACE);
        console.log(`✅ Đã Upsert thành công [${type}] ID: ${entityId} lên Pinecone`);

    } catch (error) {
        console.error(`❌ Lỗi đồng bộ Pinecone cho [${type}] ID: ${entityId}:`, error.message);
        throw error; // Ném lỗi ra để Queue (BullMQ) biết đường chạy lại nếu cần
    }
}

module.exports = {
    syncEntityToPinecone
};