// VỊ TRÍ: backend/services/admin/adminReport.service.js
const ReportModel = require('../../models/report.model');
const RecipeModel = require('../../models/recipe.model');
const ArticleModel = require('../../models/article.model');
const { addVectorSyncJob } = require('../vectorQueue.service');

class AdminReportService {
    /**
     * Lấy danh sách các report đang chờ duyệt
     */
    async getReports() {
        return await ReportModel.getPendingReports();
    }

    /**
     * Xử lý một report (Bỏ qua hoặc Ẩn nội dung)
     */
    async processReport(report_id, action, post_id, post_type) {
        // Đánh dấu là đã giải quyết
        await ReportModel.resolveReport(report_id);

        if (action === 'hide_content') {
            if (post_type === 'recipe') {
                await RecipeModel.updateStatus(post_id, 'hidden');
                addVectorSyncJob(post_id, 'recipe', 'upsert'); // Cập nhật Vector DB
            } 
            else if (post_type === 'article') {
                await ArticleModel.updateStatus(post_id, 'hidden');
                addVectorSyncJob(post_id, 'article', 'upsert'); // Cập nhật Vector DB
            }
            return 'Report resolved & Content hidden';
        }

        return 'Report resolved (Ignored)';
    }
}

module.exports = new AdminReportService();