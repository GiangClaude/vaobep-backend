const extensionService = require('../services/extension.service')
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/responseHelper');

const suggestRecipes = asyncHandler(async (req, res) => {
  const recipes = await extensionService.suggestRecipes();
  sendResponse(res, 200, true, 'Success', recipes);
});

// 2. Tìm kiếm theo text bôi đen
const searchRecipes = asyncHandler(async (req, res) => {
  const { query } = req.body;
  
  const recipes = await extensionService.searchRecipes(query);
  sendResponse(res, 200, true, 'Success', recipes);
});

// 3. Phân tích ảnh -> Lấy tên món -> Truy vấn DB
const identifyImage = asyncHandler(async (req, res) => {
  const { image } = req.body;
  
  const result = await extensionService.identifyImage(image);
  sendResponse(res, 200, true, 'Success', result, null);
});

// 4. Trả lời câu hỏi dựa trên text bóc từ Web
const askContext = asyncHandler(async (req, res) => {
  const { context, question } = req.body;
  
  const answer = await extensionService.askContext(context, question);
  sendResponse(res, 200, true, 'Success', { text: answer });
});
module.exports = { 
  suggestRecipes, 
  searchRecipes, 
  identifyImage, 
  askContext 
};