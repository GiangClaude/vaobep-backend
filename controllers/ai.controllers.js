const aiService = require('../services/ai.service');
const sqlValidator = require('../services/sqlValidator.service');
const sqlExecutor = require('../services/sqlExecutor.service');
const crypto = require('crypto');
const TagModel = require('../models/tag.model'); 
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/responseHelper');
let cachedTags = null;

async function fetchAllTagsFromDB() {
    const tags = await TagModel.getAll();
    return tags.map(t => t.name); 
}

const handleChat = asyncHandler(async (req, res) => {
    let { userId, message, sessionId, executeSql, currentContext } = req.body;

    if (!cachedTags) {
        try {
            cachedTags = await fetchAllTagsFromDB();
        } catch (e) {
            cachedTags = [];
        }
    }

    if (!sessionId && !userId) {
        sessionId = crypto.randomBytes(16).toString('hex');
    }

    const clientIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || null;
    const userAgent = req.get('user-agent') || null;

    if (!message) throw new AppError('Missing message', 400);

    const tagListString = cachedTags.join(', ');
    const extraRule = `\nQUAN TRỌNG: CSDL có các tag sau: [${tagListString}]. Chỉ linh hoạt dùng các tag này cho tìm kiếm SQL.`;
    const finalRules = (req.rules || '') + extraRule;

    // AI Service giờ đây sẽ tự lo việc kết hợp currentContext (nếu có) vào Prompt
    const aiResult = await aiService.generateResponse({ 
        userId, message, sessionId, rules: finalRules, clientIp, userAgent, currentContext 
    });

    // Nếu trả về SQL (Thường là khi không có currentContext, user muốn tìm kiếm)
    if (aiResult && aiResult.sql) {
        const sqlToRun = (req.body.sql) ? req.body.sql : aiResult.sql;
        if (sqlToRun) {
            const validation = sqlValidator.validateSQL(sqlToRun);
            if (!validation.valid) {
                return sendResponse(res, 200, true, 'Validation failed', { text: aiResult.text, sql: aiResult.sql, validation });
            }

            const rows = await sqlExecutor.execute(sqlToRun, { timeout: 2000, maxRows: 200 });
            try {
                await aiService.logSqlExecution({ userId, sessionId, sql: sqlToRun, rowCount: rows.length || 0, clientIp, userAgent, retrievalCount: aiResult.retrievalCount || 0 });
            } catch (e) { }
            return sendResponse(res, 200, true, null, { text: aiResult.text, sql: aiResult.sql, data: rows });
        }
        return sendResponse(res, 200, true, null, { text: aiResult.text, sql: aiResult.sql, executeRecommended: true });
    }

    // Trả về Text thường (Khi trả lời ngữ cảnh công thức hoặc trò chuyện thường)
    return sendResponse(res, 200, true, 'Chat thành công', { text: aiResult.text });
});

const summarizeContext = asyncHandler(async (req, res) => {
    const { contextText } = req.body;
    if (!contextText) throw new AppError('Thiếu dữ liệu văn bản cần tóm tắt (contextText)', 400);

    const summary = await aiService.generateSummary(contextText);
    return sendResponse(res, 200, true, null, { data: summary });
});

const clearHistory = asyncHandler(async (req, res) => {
    const { sessionId, userId } = req.body;
    if (sessionId || userId) await aiService.clearChatHistory(sessionId, userId);
    return sendResponse(res, 200, true, 'Đã xóa lịch sử', null);
});

module.exports = { handleChat, summarizeContext, clearHistory };