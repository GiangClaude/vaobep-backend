const fs = require('fs').promises;
const path = require('path');
const ArticleModel = require('../../models/article.model');
const { addVectorSyncJob } = require('../vectorQueue.service');
const AppError = require('../../utils/AppError');

class AdminArticleService {
    async getArticles(page, limit, search, statusFilter, sortKey, sortOrder) {
        const offset = (page - 1) * limit;

        const articles = await ArticleModel.getArticlesByAdmin(limit, offset, search, statusFilter, sortKey, sortOrder);
        const total = await ArticleModel.countArticlesByAdmin(search, statusFilter);

        return {
            articles,
            total,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getArticleDetail(id) {
        const article = await ArticleModel.findById(id);
        if (!article) throw new AppError('Không tìm thấy bài viết', 404);
        return article;
    }

    async updateArticleStatus(id, status) {
        const validStatuses = ['public', 'draft', 'hidden', 'banned'];
        if (!validStatuses.includes(status)) throw new AppError('Trạng thái không hợp lệ', 400);
        
        await ArticleModel.updateStatus(id, status);
        
        if (status === 'public' || status === 'hidden') {
            addVectorSyncJob(id, 'article', 'upsert');
        } else {
            addVectorSyncJob(id, 'article', 'delete');
        }
        
        return status;
    }

    async deleteArticle(id) {
        try {
            await ArticleModel.deleteById(id);
            
            // Xóa thư mục chứa ảnh của bài viết
            const targetDir = path.join(__dirname, '../../../public/articles', id);
            try {
                await fs.rm(targetDir, { recursive: true, force: true });
            } catch (fsError) {
                console.warn(`[Cảnh báo] Không thể xóa thư mục ảnh của article ${id}:`, fsError.message);
            }
            
            addVectorSyncJob(id, 'article', 'delete');
            
            return true;
        } catch (error) {
            if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                throw new AppError('Không thể xóa bài viết này vì đang có dữ liệu tương tác (Bình luận, Lưu, ...). Vui lòng ẩn thay vì xóa.', 400);
            }
            console.error('Lỗi xóa bài viết:', error);
            throw error;
        }
    }
}

module.exports = new AdminArticleService();