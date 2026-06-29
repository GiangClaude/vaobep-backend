const ReportModel = require('../../models/report.model');
const RecipeModel = require('../../models/recipe.model');
const ArticleModel = require('../../models/article.model');
const { addVectorSyncJob } = require('../vectorQueue.service');

class AdminReportService {
    async getReports() {
        return await ReportModel.getPendingReports();
    }

    async processReport(report_id, action, post_id, post_type) {
        await ReportModel.resolveReport(report_id);

        if (action === 'hide_content') {
            if (post_type === 'recipe') {
                await RecipeModel.updateStatus(post_id, 'hidden');
                addVectorSyncJob(post_id, 'recipe', 'upsert');
            } 
            else if (post_type === 'article') {
                await ArticleModel.updateStatus(post_id, 'hidden');
                addVectorSyncJob(post_id, 'article', 'upsert'); 
            }
            return 'Report resolved & Content hidden';
        }

        return 'Report resolved (Ignored)';
    }
}

module.exports = new AdminReportService();