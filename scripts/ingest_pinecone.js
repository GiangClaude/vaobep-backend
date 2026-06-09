// VỊ TRÍ: backend/scripts/ingest_pinecone.js
require('dotenv').config(); // Load biến môi trường vì đây là script chạy độc lập
const db = require('../config/db');
const { syncEntityToPinecone } = require('../services/vectorSync.service');

// Hàm tạo độ trễ (Sleep)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    try {
        console.log("=== BẮT ĐẦU QUÁ TRÌNH BULK INGEST (ĐỒNG BỘ HÀNG LOẠT) LÊN PINECONE ===");

        // 1. Lấy tất cả ID cần đồng bộ từ Database
        console.log("Đang lấy danh sách ID từ Database...");
        
        // Chỉ lấy Recipe có status là public hoặc hidden (Bỏ qua draft, banned)
        const [recipes] = await db.pool.execute("SELECT recipe_id FROM Recipes WHERE status IN ('public', 'hidden')");
        
        // Chỉ lấy Article có status là public hoặc hidden
        const [articles] = await db.pool.execute("SELECT article_id FROM Article_Posts WHERE status IN ('public', 'hidden')");
        
        // Lấy tất cả Dictionary Dishes (Dish mặc định luôn public)
        const [dishes] = await db.pool.execute("SELECT dish_id FROM Dictionary_Dishes");

        // Gom tất cả thành 1 mảng các công việc (tasks)
        const tasks = [
            ...recipes.map(r => ({ id: r.recipe_id, type: 'recipe' })),
            ...articles.map(a => ({ id: a.article_id, type: 'article' })),
            ...dishes.map(d => ({ id: d.dish_id, type: 'dish' }))
        ];

        console.log(`🔍 Tìm thấy tổng cộng ${tasks.length} bản ghi cần đồng bộ:`);
        console.log(`   - ${recipes.length} Recipes`);
        console.log(`   - ${articles.length} Articles`);
        console.log(`   - ${dishes.length} Dishes`);
        
        // Mức giới hạn của Gemini theo apiKey.service.js của bạn là 14 requests/min.
        // Để an toàn tuyệt đối, chúng ta xử lý lô (batch) 10 bản ghi, sau đó nghỉ 61 giây.
        const BATCH_SIZE = 10;
        const SLEEP_TIME_MS = 61000; // 61 giây

        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            const batch = tasks.slice(i, i + BATCH_SIZE);
            console.log(`\n📦 Đang xử lý Batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(tasks.length / BATCH_SIZE)} (Từ item ${i + 1} đến ${i + batch.length})`);

            // Chạy song song các task trong 1 batch để tiết kiệm thời gian
            const promises = batch.map(async (task) => {
                try {
                    await syncEntityToPinecone(task.id, task.type, 'upsert');
                } catch (err) {
                    // Lỗi 1 item không được làm chết cả script
                    console.error(`❌ Bỏ qua ID ${task.id} do lỗi:`, err.message);
                }
            });

            await Promise.all(promises);

            // Nếu chưa phải batch cuối cùng thì "Ngủ" 1 phút để tránh Rate Limit của Gemini
            if (i + BATCH_SIZE < tasks.length) {
                console.log(`⏳ Đã xong batch. Tạm nghỉ ${SLEEP_TIME_MS / 1000} giây để tránh quá tải Gemini API... Vui lòng không tắt Terminal!`);
                await sleep(SLEEP_TIME_MS);
            }
        }

        console.log("\n🎉 HOÀN TẤT ĐỒNG BỘ TẤT CẢ DỮ LIỆU LÊN PINECONE!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Lỗi nghiêm trọng trong quá trình Ingest:", error);
        process.exit(1);
    }
}

main();