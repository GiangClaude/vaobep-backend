const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { syncEntityToPinecone } = require('./vectorSync.service');

const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
};

// Khởi tạo kết nối Redis
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);

// 1. Tạo Hàng đợi (Queue)
const vectorQueue = new Queue('VectorSyncQueue', { connection });

// 2. Tạo Công nhân (Worker) để xử lý các Job trong Hàng đợi
const vectorWorker = new Worker(
    'VectorSyncQueue',
    async (job) => {
        const { entityId, type, action } = job.data;
        // Gọi hàm đồng bộ ở file vectorSync.service.js
        await syncEntityToPinecone(entityId, type, action);
    },
    { 
        connection,
        // CƠ CHẾ BẢO VỆ GEMINI API CHÍNH LÀ ĐÂY:
        limiter: {
            max: 10,       // Xử lý tối đa 10 job...
            duration: 60000 // ...trong mỗi 60.000 ms (1 phút)
        }
    }
);

vectorWorker.on('completed', (job) => {
    console.log(`✅ [Queue] Job ${job.id} hoàn tất: Đã ${job.data.action} ${job.data.type} ID: ${job.data.entityId}`);
});

vectorWorker.on('failed', (job, err) => {
    console.error(`❌ [Queue] Job ${job.id} thất bại (${job.data.type} ${job.data.entityId}):`, err.message);
});

// Hàm gọi từ Controller để đẩy việc vào Hàng đợi
async function addVectorSyncJob(entityId, type, action) {
    try {
        await vectorQueue.add('syncJob', { entityId, type, action }, {
            removeOnComplete: true, // Xong thì xóa cho nhẹ Redis
            attempts: 3,            // Nếu lỗi (mạng, timeout) thì thử lại tối đa 3 lần
            backoff: {
                type: 'exponential',
                delay: 5000         // Lần thử lại sau sẽ chờ lâu hơn (5s, 25s...)
            }
        });
        console.log(`📌 [Queue] Đã đưa ${action} ${type} ID: ${entityId} vào hàng đợi.`);
    } catch (error) {
        console.error('Lỗi khi thêm Job vào Queue:', error);
    }
}

module.exports = {
    addVectorSyncJob
};