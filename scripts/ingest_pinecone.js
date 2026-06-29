require('dotenv').config();
const db = require('../config/db');
const { syncEntityToPinecone } = require('../services/vectorSync.service');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    try {

        console.log("Đang lấy danh sách ID từ Database...");
        
        const [recipes] = await db.pool.execute("SELECT recipe_id FROM Recipes WHERE status IN ('public', 'hidden')");
        
        const [articles] = await db.pool.execute("SELECT article_id FROM Article_Posts WHERE status IN ('public', 'hidden')");
        
        const [dishes] = await db.pool.execute("SELECT dish_id FROM Dictionary_Dishes");

        const tasks = [
            ...recipes.map(r => ({ id: r.recipe_id, type: 'recipe' })),
            ...articles.map(a => ({ id: a.article_id, type: 'article' })),
            ...dishes.map(d => ({ id: d.dish_id, type: 'dish' }))
        ];

        console.log(`🔍 Tìm thấy tổng cộng ${tasks.length} bản ghi cần đồng bộ:`);
        console.log(`   - ${recipes.length} Recipes`);
        console.log(`   - ${articles.length} Articles`);
        console.log(`   - ${dishes.length} Dishes`);
        
        const BATCH_SIZE = 10;
        const SLEEP_TIME_MS = 61000;

        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            const batch = tasks.slice(i, i + BATCH_SIZE);

            const promises = batch.map(async (task) => {
                try {
                    await syncEntityToPinecone(task.id, task.type, 'upsert');
                } catch (err) {
                    console.error(`❌ Bỏ qua ID ${task.id} do lỗi:`, err.message);
                }
            });

            await Promise.all(promises);

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