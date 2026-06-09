// backend/services/ai.service.js
const fs = require('fs');
const path = require('path');
const { buildSystemInstruction } = require('../utils/promptTemplates');
const vs = require('./vectorstore.service');
const llmProvider = require('./llm.provider');
const aiHistory = require('./aiHistory.service');

const LANGFUSE_BASE = process.env.LANGFUSE_BASE_URL;
const LANGFUSE_KEY = process.env.LANGFUSE_SECRET_KEY;

// Hàm lưu log Langfuse (giữ nguyên)
async function logToLangfuse(payload) {
  try {
    if (!LANGFUSE_BASE || !LANGFUSE_KEY) return;
    const url = `${LANGFUSE_BASE.replace(/\/$/, '')}/v1/events`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LANGFUSE_KEY}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) console.error('Langfuse log failed:', res.status);
  } catch (err) {}
}

async function logSqlExecution({ userId, sessionId, sql, rowCount, clientIp, userAgent, retrievalCount }) {
  try {
    const payload = { type: 'sql_execution', userId, sessionId, sql, rowCount, retrievalCount: retrievalCount || 0, clientIp, userAgent, timestamp: new Date().toISOString() };
    await logToLangfuse(payload);
  } catch (e) {}
}

// Giữ nguyên hàm extractSQL
function extractSQL(text) {
  const sqlBlock = /```sql\s*([\s\S]*?)```/i.exec(text);
  let rawSql = null;
  if (sqlBlock) {
    rawSql = sqlBlock[1].trim();
  } else {
    const selectMatch = /(^|\n)(select[\s\S]*?)(\n|$)/i.exec(text);
    if (selectMatch) {
      const candidate = selectMatch[2].trim();
      if (/\bfrom\b/i.test(candidate)) rawSql = candidate;
    }
  }
  if (rawSql && rawSql.endsWith(';')) rawSql = rawSql.slice(0, -1);
  return rawSql;
}

// 1. HÀM CHAT TỔNG HỢP (Xử lý DB Query & Chat thường)
async function generateResponse({ userId, message, sessionId, rules, currentContext }) {
  const rulesText = rules || '';
  let schemaSnippet = '';
  
  try {
    const schemaPath = path.join(__dirname, '..', 'config', 'chatbot.schema.md');
    if (fs.existsSync(schemaPath)) schemaSnippet = fs.readFileSync(schemaPath, 'utf8');
  } catch (e) { console.error("Lỗi đọc schema:", e.message); }

  // Lấy lịch sử từ AI History Service
  let chatHistory = await aiHistory.getHistory(sessionId, userId);
  
  // Thêm câu của user
  chatHistory.push({ role: 'user', parts: [{ text: message }] });
  if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

  const systemInstructionText = buildSystemInstruction({ rulesText, schemaSnippet, examples: null, currentContext });

  console.log(`💬 Đang gửi lên AI... Session: ${sessionId || userId} | Độ dài lịch sử: ${chatHistory.length}`);
  
  let modelText;
  try {
    // SỬ DỤNG LLM PROVIDER THAY VÌ FETCH
    modelText = await llmProvider.callGemini(chatHistory, systemInstructionText);
  } catch (err) {
    console.error('LLM call failed:', err.message);
    chatHistory.pop(); // Xóa câu lỗi
    return { text: `Lỗi kết nối với Trợ lý AI: ${err.message}`, sql: null, executeSql: false };
  }

  // Thêm câu trả lời của AI và lưu lại
  chatHistory.push({ role: 'model', parts: [{ text: modelText }] });
  await aiHistory.saveHistory(sessionId, userId, chatHistory);

  const sql = extractSQL(modelText);
  return { text: modelText, sql, executeSql: false, retrievalCount: 0 };
}

// 2. HÀM LẤY VECTOR EMBEDDING (Vẫn giữ fetch vì nó gọi model embedContent, không phải generateContent)
async function getEmbedding(text) {
  const model = process.env.EMBEDDING_MODEL; 
  if (!model || !process.env.GOOGLE_API_KEY) throw new Error('Missing embedding model or API key');
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent?key=${process.env.GOOGLE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text: text }] } })
  });
  
  if (!res.ok) throw new Error('Embedding call failed');
  const j = await res.json();
  if (j.embedding && j.embedding.values) return j.embedding.values;
  throw new Error('Unknown embedding response format');
}

// 3. CÁC TÍNH NĂNG AI KHÁC (Đã dùng LLM Provider)
async function analyzeMenuWithAI(menuData) {
    const systemInstruction = `Bạn là một Chuyên gia Dinh dưỡng hàng đầu... (Viết ngắn gọn khoảng 150-200 chữ).`;
    const contents = [{ role: "user", parts: [{ text: `Nhận xét thực đơn:\n${JSON.stringify(menuData)}` }] }];
    
    return await llmProvider.callGemini(contents, systemInstruction, { 
        model: process.env.EXTENSION_GEMINI_MODEL || 'gemini-2.5-flash-lite',
        temperature: 0.4 
    });
}

async function generateMenuWithRAG(prompt) {
    const emb = await getEmbedding(prompt);
    const matches = await vs.retrieve(emb, 20);
    if (!matches || matches.length === 0) throw new Error("Không tìm thấy món ăn phù hợp.");

    const recipeContext = matches.map(m => `- ID: ${m.id} | Tên: ${m.metadata?.title}`).join('\n');
    const systemInstruction = `Bạn là hệ thống lên thực đơn tự động...\nĐịnh dạng JSON:[{"day_id":"uuid","title":"Ngày 1",...}]`;
    const userMessage = `Danh sách món:\n${recipeContext}\n\nYêu cầu: ${prompt}\nChỉ trả JSON.`;

    const contents = [{ role: "user", parts: [{ text: userMessage }] }];
    const aiText = await llmProvider.callGemini(contents, systemInstruction, { temperature: 0.2 });

    const cleanJson = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
}

async function generateSummary(contextText) {
    const systemInstruction = `Bạn là chuyên gia dinh dưỡng. Tóm tắt nội dung ngắn gọn bằng Markdown.`;
    const contents = [{ role: 'user', parts: [{ text: `Văn bản:\n${contextText}` }] }];
    
    return await llmProvider.callGemini(contents, systemInstruction, { 
        model: process.env.EXTENSION_GEMINI_MODEL || 'gemini-2.5-flash-lite',
        temperature: 0.3 
    });
}

const clearChatHistory = async (sessionId, userId) => {
    await aiHistory.clearHistory(sessionId, userId);
};

module.exports = { 
  generateResponse, logSqlExecution, getEmbedding, 
  clearChatHistory, analyzeMenuWithAI, generateMenuWithRAG, generateSummary
};