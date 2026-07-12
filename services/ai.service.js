const fs = require('fs');
const path = require('path');
const { buildSystemInstruction } = require('../utils/promptTemplates');
const vs = require('./vectorstore.service');
const llmProvider = require('./llm.provider');
const aiHistory = require('./aiHistory.service');
const AppError = require('../utils/AppError');
const RecipeModel = require('../models/recipe.model');
const LANGFUSE_BASE = process.env.LANGFUSE_BASE_URL;
const LANGFUSE_KEY = process.env.LANGFUSE_SECRET_KEY;

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
      
      rawSql = rawSql.replace(/utf8_unicode_ci/gi, 'utf8mb4_general_ci');
      rawSql = rawSql.replace(/utf8_general_ci/gi, 'utf8mb4_general_ci');
  }
  
  if (rawSql && rawSql.endsWith(';')) rawSql = rawSql.slice(0, -1);
  return rawSql;
}

async function generateResponse({ userId, message, sessionId, rules, currentContext }) {
  const rulesText = rules || '';
  let schemaSnippet = '';
  
  try {
    const schemaPath = path.join(__dirname, '..', 'config', 'chatbot.schema.md');
    if (fs.existsSync(schemaPath)) schemaSnippet = fs.readFileSync(schemaPath, 'utf8');
  } catch (e) { console.error("Lỗi đọc schema:", e.message); }

  let chatHistory = await aiHistory.getHistory(sessionId, userId);
  
  chatHistory.push({ role: 'user', parts: [{ text: message }] });
  if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

  const systemInstructionText = buildSystemInstruction({ rulesText, schemaSnippet, examples: null, currentContext });

  console.log(`💬 Đang gửi lên AI... Session: ${sessionId || userId} | Độ dài lịch sử: ${chatHistory.length}`);
  
  let modelText;
  try {
    modelText = await llmProvider.callGemini(chatHistory, systemInstructionText);
  } catch (err) {
    console.error('LLM call failed:', err.message);
    chatHistory.pop(); 
    if (err.message.includes('429') || err.message.includes('Quota')) {
        throw new AppError('Hệ thống AI đang tạm thời quá tải. Bạn vui lòng thử lại sau ít phút nha!', 429);
    }
    
    throw new AppError('Đã mất kết nối với Trợ lý AI. Đang tiến hành khắc phục!', 500);
  }

  chatHistory.push({ role: 'model', parts: [{ text: modelText }] });
  await aiHistory.saveHistory(sessionId, userId, chatHistory);

  const sql = extractSQL(modelText);
  return { text: modelText, sql, executeSql: false, retrievalCount: 0 };
}

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

async function analyzeMenuWithAI(menuData) {
    const systemInstruction = `Bạn là một Chuyên gia Dinh dưỡng hàng đầu... (Viết ngắn gọn khoảng 150-200 chữ).`;
    const contents = [{ role: "user", parts: [{ text: `Nhận xét thực đơn:\n${JSON.stringify(menuData)}` }] }];
    
    return await llmProvider.callGemini(contents, systemInstruction, { 
        model: process.env.EXTENSION_GEMINI_MODEL || 'gemini-2.5-flash-lite',
        temperature: 0.4 
    });
}

async function generateMenuWithRAG(prompt, days) {
    const emb = await getEmbedding(prompt);
    
    const filter = {
        type: { "$eq": "recipe" },
        status: { "$eq": "public" }
    };

     let topK = Math.ceil(days * 3 * 2 * 1.05);
    
      // Đảm bảo tối thiểu lấy 20 món (để AI có đủ data trộn ngẫu nhiên)
      topK = Math.max(10, topK); 
      
      // Đảm bảo tối đa lấy 500 món (tránh vượt giới hạn topK của Pinecone và Token của Gemini)
      topK = Math.min(topK, 500); 

      topK = Math.round(topK); // Làm tròn số lượng món ăn cần lấy
    
    const matches = await vs.retrieve(emb, topK, filter);
    if (!matches || matches.length === 0) throw new Error("Không tìm thấy món ăn phù hợp.");

    const recipeContext = matches.map(m => `- ID: ${m.id} | Tên: ${m.metadata?.title}`).join('\n');
    
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
              "servings_multiplier": 1.0
            }
          ]
        }
      ]
    }
  ]
Chỉ trả về mảng JSON thuần túy, không kèm theo bất kỳ văn bản giải thích nào khác.`;

    const userMessage = `Danh sách món:\n${recipeContext}\n\nYêu cầu: ${prompt} cho ${days} ngày.`;
    const contents = [{ role: "user", parts: [{ text: userMessage }] }];
    
    console.log("Gửi lên AI để tạo thực đơn với RAG. Prompt:", userMessage);
    const aiText = await llmProvider.callGemini(contents, systemInstruction, { temperature: 0.2 });

    const cleanJson = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    let menuData;
    try {
        menuData = JSON.parse(cleanJson);
    } catch (err) {
        console.error("Lỗi parse JSON từ AI:", cleanJson);
        throw new Error("AI trả về sai định dạng dữ liệu thực đơn.");
    }

    // 3. MAP DỮ LIỆU TỪ DATABASE THÔNG QUA RECIPE MODEL
    const recipeIds = [];
    menuData.forEach(day => {
        day.meals?.forEach(meal => {
            meal.recipes?.forEach(recipe => {
                if (recipe.recipe_id && !recipeIds.includes(recipe.recipe_id)) {
                    recipeIds.push(recipe.recipe_id);
                }
            });
        });
    });

    if (recipeIds.length > 0) {
        try {
            const recipesInfo = await RecipeModel.getBasicInfoByIds(recipeIds);
            
            const recipeMap = {};
            recipesInfo.forEach(row => {
                recipeMap[row.recipe_id] = row;
            });

            menuData.forEach(day => {
                day.meals?.forEach(meal => {
                    meal.recipes?.forEach(recipe => {
                        const realData = recipeMap[recipe.recipe_id];
                        recipe.cover_image = realData?.cover_image || "";
                        recipe.total_calo = realData?.total_calo || 0;
                    });
                });
            });
            console.log("Đã ánh xạ Cover Image và Total Calo thành công từ DB.");
        } catch (dbErr) {
            console.error("Lỗi ánh xạ dữ liệu menu từ db:", dbErr);
        }
    }

    return menuData;
}

async function generateSummary(contextText) {
    const systemInstruction = `Bạn là chuyên gia dinh dưỡng. Tóm tắt nội dung ngắn gọn bằng Markdown. Đọc kỹ và dựa vào thêm các thông tin bên ngoài, đưa ra các lưu ý cần chú ý khi áp dụng công thức.`;
    const contents = [{ role: 'user', parts: [{ text: `Văn bản:\n${contextText}` }] }];
    return await llmProvider.callGemini(contents, systemInstruction, { 
        model: process.env.EXTENSION_GEMINI_MODEL || 'gemini-2.5-flash-lite',
        temperature: 0.3 
    });
}

async function analyzePostContent(postData, availableTags) {
    const { title, description, ingredients, instructions } = postData;
    
    const tagsString = availableTags.join(', ');

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

    const userContent = `
        Tên món: ${title || 'Không có'}
        Mô tả: ${description || 'Không có'}
        Nguyên liệu: ${ingredients || 'Không có'}
        Cách làm: ${instructions || 'Không có'}
    `;

    const contents = [{ role: 'user', parts: [{ text: userContent }] }];

    const aiText = await llmProvider.callGemini(contents, systemInstruction, { 
        temperature: 0.1 
    });

    const cleanJson = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    try {
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Lỗi parse JSON từ AI phân tích bài viết:", aiText);
        throw new Error("AI trả về sai định dạng dữ liệu.");
    }
}

const clearChatHistory = async (sessionId, userId) => {
    await aiHistory.clearHistory(sessionId, userId);
};

module.exports = { 
  generateResponse, logSqlExecution, getEmbedding, 
  clearChatHistory, analyzeMenuWithAI, generateMenuWithRAG, generateSummary,
  analyzePostContent
};