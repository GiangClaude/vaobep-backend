// VỊ TRÍ TẠO FILE MỚI: backend/controllers/extension.controllers.js

const db = require('../config/db'); // Dùng pool DB hiện có của bạn
const extensionAiService = require('../services/extensionAi.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/responseHelper');

// 1. Lấy 3 món ăn ngẫu nhiên (Cho màn hình chính của Extension)
const suggestRecipes = asyncHandler(async (req, res) => {
  const sql = `
    SELECT recipe_id, title, cover_image, cook_time, total_calo 
    FROM recipes 
    WHERE status = 'public' 
    ORDER BY RAND() 
    LIMIT 3
  `;
  const [rows] = await db.pool.execute(sql);
  sendResponse(res, 200, true, 'Success', rows);
});

// 2. Tìm kiếm theo text bôi đen (Không dùng AI, query LIKE trực tiếp)
const searchRecipes = asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!query) throw new AppError('Thiếu từ khóa tìm kiếm', 400);

  const sql = `
    SELECT recipe_id, title, cover_image, cook_time, total_calo
    FROM recipes 
    WHERE status = 'public' AND title LIKE ? 
    ORDER BY RAND()
    LIMIT 5
  `;
  const searchTerm = `%${query.trim()}%`;
  const [rows] = await db.pool.execute(sql, [searchTerm]);

  sendResponse(res, 200, true, 'Success', rows);
});

// 3. Phân tích ảnh -> Lấy tên món -> Truy vấn DB (Kết hợp AI + DB trong 1 lần gọi)
const identifyImage = asyncHandler(async (req, res) => {
  const { image } = req.body; // Chuỗi base64
  if (!image) throw new AppError('Thiếu ảnh', 400);

  // Dọn dẹp chuỗi base64 nếu Frontend lỡ gửi kèm header 'data:image/jpeg;base64,'
  const base64Data = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

  // Bước 1: Gọi AI nhận diện tên món
  const dishName = await extensionAiService.identifyDishFromImage(base64Data);
  
  // Bước 2: Dùng tên món đó truy vấn ngay Database để tìm công thức liên quan
  const sql = `
    SELECT recipe_id, title, cover_image, cook_time, total_calo 
    FROM recipes 
    WHERE status = 'public' AND title LIKE ? 
    LIMIT 3
  `;
  const searchTerm = `%${dishName.replace(/["']/g, '').trim()}%`; 
  const [recipes] = await db.pool.execute(sql, [searchTerm]);

  sendResponse(res, 200, true, 'Success', { dishName, recipes }, null);
});

// 4. Trả lời câu hỏi dựa trên text bóc từ Web
const askContext = asyncHandler(async (req, res) => {
  const { context, question } = req.body;
  if (!question) throw new AppError('Thiếu câu hỏi', 400);

  // Gọi AI (Gửi cả text bóc được từ web và câu hỏi)
  const answer = await extensionAiService.answerContextQuestion(context, question);
  sendResponse(res, 200, true, 'Success', { text: answer });
});

module.exports = { suggestRecipes, searchRecipes, identifyImage, askContext };