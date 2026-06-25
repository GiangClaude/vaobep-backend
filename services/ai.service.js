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

  if (rawSql) {
      rawSql = rawSql.replace(/utf8mb4_0900_as_ci/gi, 'utf8mb4_general_ci');
      rawSql = rawSql.replace(/utf8mb4_0900_ai_ci/gi, 'utf8mb4_general_ci');
      
      // Bonus: Đề phòng AI lỡ sinh ra collation utf8_... cũ của MySQL 5.x
      rawSql = rawSql.replace(/utf8_unicode_ci/gi, 'utf8mb4_general_ci');
      rawSql = rawSql.replace(/utf8_general_ci/gi, 'utf8mb4_general_ci');
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
   // Kiểm tra nếu lỗi là do hết Quota (429) của Gemini
    if (err.message.includes('429') || err.message.includes('Quota')) {
        // Ném ra AppError với message thân thiện cho user và HTTP status 429
        throw new AppError('Hệ thống AI đang tạm thời quá tải. Bà vui lòng thử lại sau ít phút nha!', 429);
    }
    
    // Ném ra lỗi chung cho các trường hợp rớt mạng, lỗi key,...
    throw new AppError('Đã mất kết nối với Trợ lý AI. Đang tiến hành khắc phục!', 500);
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

// backend/services/ai.service.js

/**
 * Tự động tạo thực đơn bằng công nghệ RAG (Retrieval-Augmented Generation).
 * Hàm này lấy yêu cầu của user, tìm món ăn phù hợp trong VectorDB, 
 * và ép AI trả về đúng cấu trúc JSON cây menu chuẩn (Days -> Meals -> Recipes).
 */
async function generateMenuWithRAG(prompt) {
    // 1. Lấy embedding từ câu prompt của user
    const emb = await getEmbedding(prompt);
    
    // 2. Tìm kiếm các món ăn phù hợp trong Vector Database
    const matches = await vs.retrieve(emb, 20);
    if (!matches || matches.length === 0) throw new Error("Không tìm thấy món ăn phù hợp.");

    // 3. Tạo context chứa danh sách món ăn để AI lựa chọn
    const recipeContext = matches.map(m => `- ID: ${m.id} | Tên: ${m.metadata?.title}`).join('\n');
    
    // 4. Thiết lập System Instruction: Ép cấu trúc JSON chuẩn xác
    const systemInstruction = `Bạn là hệ thống lên thực đơn tự động.
Nhiệm vụ của bạn là tạo ra một thực đơn dựa TRÊN DANH SÁCH MÓN ĂN được cung cấp.
QUY TẮC QUAN TRỌNG:
- TUYỆT ĐỐI KHÔNG tự tạo day_id hay meal_id.
- meal_type chỉ được phép dùng 1 trong 4 giá trị: 'breakfast', 'lunch', 'dinner', 'snack'.
- recipe_id BẮT BUỘC phải lấy từ ID tương ứng trong "Danh sách món". Không được tự bịa ID.
- servings_multiplier là kiểu số thực (vd: 1.0, 1.5).

Bạn PHẢI trả về ĐÚNG cấu trúc JSON mảng các ngày (Days) như mẫu sau:
[
  {
    "title": "Ngày 1",
    "meals": [
      {
        "meal_type": "breakfast",
        "title": "Bữa sáng",
        "note": "Ghi chú nếu cần thiết",
        "recipes": [
          {
            "recipe_id": "ID-lấy-từ-danh-sách-món",
            "title": "tiêu đề của recipe",
            "cover_image": "recipe.cover_image",
            "total_calo": "recipe.total_calo",
            "servings_multiplier": 1.0
          }
        ]
      }
    ]
  }
]
Chỉ trả về mảng JSON thuần túy, không kèm theo bất kỳ văn bản giải thích nào khác.`;

    // 5. Khởi tạo thông điệp cho user
    const userMessage = `Danh sách món:\n${recipeContext}\n\nYêu cầu: ${prompt}`;

    const contents = [{ role: "user", parts: [{ text: userMessage }] }];
    
    // 6. Gọi AI với temperature thấp (0.2) để ưu tiên tính chính xác, giảm sự sáng tạo bay bổng
    const aiText = await llmProvider.callGemini(contents, systemInstruction, { temperature: 0.2 });

    // 7. Làm sạch chuỗi trả về để loại bỏ markdown block (```json ... ```)
    const cleanJson = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // 8. Chuyển string thành JSON Object
    return JSON.parse(cleanJson);
}

async function generateSummary(contextText) {
    const systemInstruction = `Bạn là chuyên gia dinh dưỡng. Tóm tắt nội dung ngắn gọn bằng Markdown. Đọc kỹ và dựa vào thêm các thông tin bên ngoài, đưa ra các lưu ý cần chú ý khi áp dụng công thức.`;
    const contents = [{ role: 'user', parts: [{ text: `Văn bản:\n${contextText}` }] }];
    
    return await llmProvider.callGemini(contents, systemInstruction, { 
        model: process.env.EXTENSION_GEMINI_MODEL || 'gemini-2.5-flash-lite',
        temperature: 0.3 
    });
}

// BẮT ĐẦU ĐOẠN THÊM MỚI (Cho chức năng phân tích bài đăng - Tag & Calo)
async function analyzePostContent(postData, availableTags) {
    const { title, description, ingredients, instructions } = postData;
    
    // 1. Tạo chuỗi danh sách tag để đưa vào Prompt
    const tagsString = availableTags.join(', ');

    // 2. Xây dựng System Instruction cực kỳ khắt khe
    const systemInstruction = `Bạn là một Chuyên gia dinh dưỡng và Quản lý nội dung ẩm thực.
NHIỆM VỤ: Đọc thông tin bài đăng về món ăn, sau đó đánh giá xem thông tin có đủ để tính calo không. Nếu đủ, hãy tính tổng calo, chia nhỏ thành phần, và chọn tối đa 5 Tags phù hợp nhất.

LUẬT BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ):
1. KIỂM TRA ĐẦU VÀO: Nếu người dùng không cung cấp nguyên liệu (ingredients) hoặc cách làm cụ thể, BẠN KHÔNG ĐƯỢC PHÉP tự bịa ra nguyên liệu để tính toán. Hãy lập tức trả về "is_sufficient": false.
2. CHỈ ĐƯỢC CHỌN TAG TỪ DANH SÁCH SAU: [${tagsString}]. Tuyệt đối không tự tạo tag ngoài danh sách này.
3. TRẢ VỀ JSON THUẦN TÚY: Chỉ trả về định dạng JSON, không kèm bất kỳ văn bản giải thích nào ở ngoài cấu trúc JSON.

CẤU TRÚC JSON BẮT BUỘC TRẢ VỀ:
{
  "is_sufficient": boolean (true nếu đủ thông tin nguyên liệu, false nếu không đủ),
  "message": "Thông báo ngắn gọn (VD: Phân tích thành công / Không đủ thông tin nguyên liệu...)",
  "suggested_tags": ["tag1", "tag2"], (Rỗng nếu is_sufficient = false)
  "total_calories": number, (Bằng 0 nếu is_sufficient = false)
  "calorie_breakdown": [ (Rỗng nếu is_sufficient = false)
    {"item": "Tên nguyên liệu/Nhóm", "calories": number}
  ],
  "reasoning": "Giải thích ngắn gọn tại sao tính ra calo như vậy dựa trên phương pháp chế biến và nguyên liệu.",
  "disclaimer": "Lưu ý: Lượng calo do AI ước tính dựa trên nguyên liệu cơ bản và chỉ mang tính tham khảo."
}`;

    // 3. Gom dữ liệu người dùng gửi vào nội dung user
    const userContent = `
        Tên món: ${title || 'Không có'}
        Mô tả: ${description || 'Không có'}
        Nguyên liệu: ${ingredients || 'Không có'}
        Cách làm: ${instructions || 'Không có'}
    `;

    const contents = [{ role: 'user', parts: [{ text: userContent }] }];

    // 4. Gọi LLM với temperature thấp (0.1) để đảm bảo độ chính xác của JSON và logic tính toán
    const aiText = await llmProvider.callGemini(contents, systemInstruction, { 
        model: process.env.EXTENSION_GEMINI_MODEL || 'gemini-2.5-flash', // Dùng flash thường cho tính toán tốt hơn flash-lite
        temperature: 0.1 
    });

    // 5. Làm sạch chuỗi kết quả (Xóa block markdown ```json) giống hàm generateMenuWithRAG
    const cleanJson = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    try {
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Lỗi parse JSON từ AI phân tích bài viết:", aiText);
        throw new Error("AI trả về sai định dạng dữ liệu.");
    }
}
// KẾT THÚC ĐOẠN THÊM MỚI

const clearChatHistory = async (sessionId, userId) => {
    await aiHistory.clearHistory(sessionId, userId);
};

module.exports = { 
  generateResponse, logSqlExecution, getEmbedding, 
  clearChatHistory, analyzeMenuWithAI, generateMenuWithRAG, generateSummary,
  analyzePostContent
};