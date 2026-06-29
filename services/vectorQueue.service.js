const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { syncEntityToPinecone } = require('./vectorSync.service');

const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
};

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);

const vectorQueue = new Queue('VectorSyncQueue', { connection });

const vectorWorker = new Worker(
    'VectorSyncQueue',
    async (job) => {
        const { entityId, type, action } = job.data;
        await syncEntityToPinecone(entityId, type, action);
    },
    { 
        connection,
        //xử lý tối đa 10 limiter trong 60p
        limiter: {
            max: 10,       
            duration: 60000 
        }
    }
);

vectorWorker.on('completed', (job) => {
    console.log(`[Queue] Job ${job.id} hoàn tất: Đã ${job.data.action} ${job.data.type} ID: ${job.data.entityId}`);
});

vectorWorker.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job.id} thất bại (${job.data.type} ${job.data.entityId}):`, err.message);
});

async function addVectorSyncJob(entityId, type, action) {
    try {
        await vectorQueue.add('syncJob', { entityId, type, action }, {
            removeOnComplete: true, 
            attempts: 3,           
            backoff: {
                type: 'exponential',
                delay: 5000        
            }
        });
        console.log(`[Queue] Đã đưa ${action} ${type} ID: ${entityId} vào hàng đợi.`);
    } catch (error) {
        console.error('Lỗi khi thêm Job vào Queue:', error);
    }
}

module.exports = {
    addVectorSyncJob
};