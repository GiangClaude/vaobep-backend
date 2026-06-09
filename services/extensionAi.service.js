// backend/services/extensionAi.service.js
const llmProvider = require('./llm.provider');
const { VISION_PROMPT, CONTEXT_PROMPT } = require('../utils/extensionPrompts');
const EXTENSION_MODEL = process.env.EXTENSION_GEMINI_MODEL || 'gemini-2.5-flash-lite';

async function identifyDishFromImage(base64Image, mimeType = 'image/jpeg') {
  const contentsArray = [
    {
      role: 'user',
      parts: [
        { text: VISION_PROMPT },
        { inlineData: { mimeType: mimeType, data: base64Image } }
      ]
    }
  ];

  return await llmProvider.callGemini(contentsArray, '', {
      model: EXTENSION_MODEL,
      temperature: 0.1,
      maxOutputTokens: 500
  });
}

async function answerContextQuestion(contextText, userQuestion) {
  const systemInstruction = CONTEXT_PROMPT.replace('{context_text}', contextText || 'Không có dữ liệu văn bản nào.');
  const contentsArray = [{ role: 'user', parts: [{ text: `Câu hỏi của tôi: ${userQuestion}` }] }];

  return await llmProvider.callGemini(contentsArray, systemInstruction, {
      model: EXTENSION_MODEL,
      temperature: 0.1,
      maxOutputTokens: 500
  });
}

module.exports = { identifyDishFromImage, answerContextQuestion };