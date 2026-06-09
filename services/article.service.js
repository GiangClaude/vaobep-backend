const fsPromises = require('fs').promises; // SỬ DỤNG PROMISES
const path = require('path');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { addVectorSyncJob } = require('./vectorQueue.service');
const ArticleModel = require('../models/article.model');
const TagModel = require('../models/tag.model');
const InteractionModel = require('../models/interaction.model');
const RecipeLinkModel = require('../models/recipe_link.model');
const fs = require('fs'); // Giữ lại cho existsSync nếu cần, nhưng ưu tiên try-catch với promise

const checkArticleOwner = async (articleId, userId) => {
    try {
        const sql = 'SELECT user_id FROM Article_Posts WHERE article_id = ?';
        const [owner] = await db.pool.execute(sql, [articleId]);
        if (owner.length === 0) return false;
        return owner[0].user_id === userId;
    } catch (error) {
        console.error("Lỗi khi kiểm tra quyền sở hữu article:", error);
        return false;     
    }
};

class ArticleService {
    // ... (Giữ nguyên hàm createArticle)
    async createArticle(userId, articleId, body, files) {
        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();

            const { title, description, content, status, read_time, recipeIds } = body;

            let parsedTags = [];
            if (body.tags) parsedTags = typeof body.tags === 'string' ? JSON.parse(body.tags) : body.tags;

            let parsedRecipeIds = [];
            if (recipeIds) parsedRecipeIds = typeof recipeIds === 'string' ? JSON.parse(recipeIds) : recipeIds;

            let coverImageName = null;
            if (files && files['cover_image'] && files['cover_image'].length > 0) {
                coverImageName = files['cover_image'][0].filename;
            }

            await ArticleModel.create(connection, { 
                articleId, userId, title, description, content, 
                coverImage: coverImageName, status: status || 'draft', readTime: read_time || 1 
            });

            if (parsedTags.length > 0) await TagModel.addTagsToPost(articleId, 'article', parsedTags, connection);
            if (parsedRecipeIds.length > 0) await RecipeLinkModel.addLinks(connection, parsedRecipeIds, articleId, 'article');

            await connection.commit();

            const finalStatus = status || 'draft';
            if (finalStatus === 'public' || finalStatus === 'hidden') {
                addVectorSyncJob(articleId, 'article', 'upsert');
            }

            return { article_id: articleId };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    async updateArticle(articleId, userId, userRole, body, files) {
        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();

            const article = await ArticleModel.findById(articleId);
            if (!article) {
                await connection.rollback();
                throw new AppError('Không tìm thấy bài viết!', 404);
            }
            if (article.status === 'banned') {
                await connection.rollback();
                throw new AppError('Bài viết đã bị khóa vi phạm, không thể chỉnh sửa!', 403);
            }

            const isOwner = await checkArticleOwner(articleId, userId);
            if (!isOwner && userRole !== 'admin') {
                await connection.rollback();
                throw new AppError('Bạn không có quyền chỉnh sửa bài viết này!', 403);
            }

            const { title, description, content, status, read_time, recipeIds } = body;
            let updateData = { title, description, content, status, read_time };

            if (files && files['cover_image'] && files['cover_image'].length > 0) {
                const newImageName = files['cover_image'][0].filename;
                if (article.cover_image) {
                    const oldFilePath = path.join(__dirname, '../public/articles', articleId, article.cover_image);
                    // Dùng Promise không chặn luồng Node.js
                    try { await fsPromises.unlink(oldFilePath); } catch (err) {
                        console.warn(`[File System] Không thể xóa ảnh cover cũ của article ${articleId}:`, err.message);
                    } 
                }
                updateData.cover_image = newImageName;
            }

            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            await ArticleModel.update(connection, articleId, updateData);

            if (body.tags !== undefined) {
                let parsedTags = typeof body.tags === 'string' ? JSON.parse(body.tags) : body.tags;
                await TagModel.updateTagsForPost(articleId, 'article', parsedTags, connection);
            }

            if (recipeIds !== undefined) {
                let parsedRecipeIds = typeof recipeIds === 'string' ? JSON.parse(recipeIds) : recipeIds;
                await RecipeLinkModel.updateLinks(connection, articleId, 'article', parsedRecipeIds);
            }

            await connection.commit();

            if (updateData.status === 'public' || updateData.status === 'hidden') {
                addVectorSyncJob(articleId, 'article', 'upsert');
            } else if (updateData.status) {
                addVectorSyncJob(articleId, 'article', 'delete');
            } else {
                addVectorSyncJob(articleId, 'article', 'upsert');
            }

            return true;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    async deleteArticle(articleId, userId, userRole) {
        const isOwner = await checkArticleOwner(articleId, userId);
        if (!isOwner && userRole !== 'admin') {
            throw new AppError('Bạn không có quyền xóa bài viết này!', 403);
        }

        const articleDir = path.join(__dirname, '../public/articles', articleId);
        // Dùng Promise xóa folder
        try { 
            await fsPromises.rm(articleDir, { recursive: true, force: true }); 
        } catch (err) {
            console.warn(`[File System] Không thể xóa thư mục của article ${articleId}:`, err.message);
        }

        await ArticleModel.deleteById(articleId);
        addVectorSyncJob(articleId, 'article', 'delete');
        return true;
    }

    // ... (Toàn bộ các hàm getPublicArticles, getFeaturedArticles, getOwnerArticles, getArticleById, getSavedArticles bên dưới giữ nguyên 100% của bạn)
    async getPublicArticles(query, userId) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 5;
        const offset = (page - 1) * limit;
        const keyword = query.q || ""; 
        const sort = query.sort || "newest"; 

        let tagIds = [];
        if (query.tags) {
            tagIds = Array.isArray(query.tags) ? query.tags : query.tags.split(',').filter(id => id.trim() !== "");
        }

        const [articles, totalItems] = await Promise.all([
            ArticleModel.getPublicArticles({ limit, offset, keyword, tagIds, sort }),
            ArticleModel.countPublicArticles({ keyword, tagIds })
        ]);

        const articlesWithDetails = await Promise.all(articles.map(async (article) => {
            const [tags, linkedRecipes] = await Promise.all([
                TagModel.getTagsByPostId(article.article_id),
                RecipeLinkModel.getRecipesByPost(userId, article.article_id, 'article')
            ]);
            return { ...article, tags, linked_recipes: linkedRecipes };
        }));

        if (userId && articlesWithDetails.length > 0) {
            const postIds = articlesWithDetails.map(a => a.article_id);
            const interactionStates = await InteractionModel.getBatchInteractionState(userId, postIds, 'article');
            articlesWithDetails.forEach(article => {
                const state = interactionStates[article.article_id];
                article.is_liked = state ? state.liked : false;
                article.is_saved = state ? state.saved : false;
            });
        }

        return { articlesWithDetails, page, limit, totalItems };
    }

    async getFeaturedArticles(queryLimit, userId) {
        const limit = parseInt(queryLimit) || 10;
        const articles = await ArticleModel.getFeaturedArticles(limit);

        const articlesWithTags = await Promise.all(articles.map(async (article) => {
            const [tags, linkedRecipes] = await Promise.all([
                TagModel.getTagsByPostId(article.article_id),
                RecipeLinkModel.getRecipesByPost(userId, article.article_id, 'article')
            ]);
            return { ...article, tags, linked_recipes: linkedRecipes };
        }));

        if (userId && articlesWithTags.length > 0) {
            const postIds = articlesWithTags.map(a => a.article_id);
            const interactionStates = await InteractionModel.getBatchInteractionState(userId, postIds, 'article');
            
            articlesWithTags.forEach(article => {
                const state = interactionStates[article.article_id];
                article.is_liked = state ? state.liked : false;
                article.is_saved = state ? state.saved : false;
            });
        }

        return articlesWithTags;
    }

    async getOwnerArticles(userId) {
        const articles = await ArticleModel.getOwnerArticles(userId);
        const articlesWithTags = await Promise.all(articles.map(async (article) => {
            const [tags, linkedRecipes] = await Promise.all([
                TagModel.getTagsByPostId(article.article_id),
                RecipeLinkModel.getRecipesByPost(userId, article.article_id, 'article')
            ]);
            return { ...article, tags, linked_recipes: linkedRecipes };
        }));

        if (userId && articlesWithTags.length > 0) {
            const postIds = articlesWithTags.map(a => a.article_id);
            const interactionStates = await InteractionModel.getBatchInteractionState(userId, postIds, 'article');
            
            articlesWithTags.forEach(article => {
                const state = interactionStates[article.article_id];
                article.is_liked = state ? state.liked : false;
                article.is_saved = state ? state.saved : false;
            });
        }

        return articlesWithTags;
    }

    async getArticleById(articleId, userId) {
        const article = await ArticleModel.findById(articleId);

        if (!article) throw new AppError('Không tìm thấy bài viết!', 404);
        if (article.status === 'banned') throw new AppError('Bài viết này đã bị khóa do vi phạm nội quy!', 403);

        const [tags, commentsData, linkedRecipes, interactionState] = await Promise.all([
            TagModel.getTagsByPostId(articleId),
            InteractionModel.getComments(articleId, 'article', 1, 10),
            RecipeLinkModel.getRecipesByPost(userId, articleId, 'article'),
            InteractionModel.getBatchInteractionState(userId, [articleId], 'article')
        ]);
        
        const state = interactionState ? interactionState[articleId] : null;
        article.tags = tags;
        article.comments = commentsData.comments;
        article.total_comments = article.commentCount;
        article.linked_recipes = linkedRecipes;
        article.is_liked = state ? state.liked : false;
        article.is_saved = state ? state.saved : false;

        return article;
    }

    async getSavedArticles(userId, query) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 6;
        const offset = (page - 1) * limit;

        const [articles, totalItems] = await Promise.all([
            ArticleModel.getSavedArticlesByUser({ userId, limit, offset }),
            ArticleModel.countSavedArticlesByUser(userId)
        ]);

        const articlesWithDetails = await Promise.all(articles.map(async (article) => {
            const tags = await TagModel.getTagsByPostId(article.article_id);
            return { ...article, tags };
        }));

        if (articlesWithDetails.length > 0) {
            const postIds = articlesWithDetails.map(a => a.article_id);
            const interactionStates = await InteractionModel.getBatchInteractionState(userId, postIds, 'article');
            articlesWithDetails.forEach(article => {
                const state = interactionStates[article.article_id];
                article.is_liked = state ? state.liked : false;
                article.is_saved = state ? state.saved : true; 
            });
        }

        return { articlesWithDetails, page, limit, totalItems };
    }
}

module.exports = new ArticleService();