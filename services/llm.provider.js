// backend/services/llm.provider.js
const { getAvailableKey } = require('./apiKey.service');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

class LLMProvider {
    /**
     * Hàm gọi Gemini API chuẩn hóa
     * @param {Array} contents - Mảng lịch sử chat [{ role: 'user', parts: [{ text: '...' }] }]
     * @param {String} systemInstructionText - Luật cho AI (Prompt hệ thống)
     * @param {Object} options - { temperature, maxOutputTokens, model }
     */
    async callGemini(contents, systemInstructionText = '', options = {}) {
        const apiKey = await getAvailableKey();
        const model = options.model || DEFAULT_MODEL;

        if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

        const body = {
            contents: contents,
            generationConfig: {
                maxOutputTokens: options.maxOutputTokens || 8192,
                temperature: options.temperature !== undefined ? options.temperature : 0.2
            }
        };

        // Nếu có System Instruction thì mới gắn vào
        if (systemInstructionText) {
            body.systemInstruction = {
                parts: [{ text: systemInstructionText }]
            };
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`LLM API Error (${res.status}): ${errorText}`);
        }

        const json = await res.json();
        try {
            return json.candidates[0].content.parts[0].text;
        } catch (err) {
            throw new Error('Lỗi khi đọc text từ LLM: ' + JSON.stringify(json));
        }
    }
}

module.exports = new LLMProvider();