const ExtensionModel = require('../models/extension.model');
const extensionAiService = require('./extensionAi.service');
const aiService = require('./ai.service'); 
const vs = require('./vectorstore.service'); 
const AppError = require('../utils/AppError');

class ExtensionService {
    /**
     * 1. Lấy món ăn ngẫu nhiên cho màn hình chính Extension
     */
    async suggestRecipes() {
        return await ExtensionModel.getRandomRecipes(3);
    }

    /**
     * 2. Tìm kiếm công thức theo text bôi đen
     */
    async searchRecipes(query) {
        if (!query) throw new AppError('Thiếu từ khóa tìm kiếm', 400);
        
        const embedding = await aiService.getEmbedding(query);
const filter = {
            type: { "$eq": "recipe" },
            status: { "$eq": "public" }
        };
        const matches = await vs.retrieve(embedding, 5, filter);

        if (!matches || matches.length === 0) return [];

        const recipeIds = matches.map(m => m.id);

        return await ExtensionModel.getRecipesByIds(recipeIds);
    }

    /**
     * 3. Nhận diện hình ảnh và tìm công thức tương ứng
     */
    async identifyImage(image) {
        if (!image) throw new AppError('Thiếu ảnh', 400);

        const base64Data = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

        const dishName = await extensionAiService.identifyDishFromImage(base64Data);
        const cleanDishName = dishName.replace(/["']/g, '').trim();

        const recipes = await this.searchRecipes(cleanDishName);

        return { dishName: cleanDishName, recipes };
    }

    /**
     * 4. Trả lời câu hỏi dựa trên text bóc từ Web
     */
    async askContext(context, question) {
        if (!question) throw new AppError('Thiếu câu hỏi', 400);

        const answer = await extensionAiService.answerContextQuestion(context, question);
        return answer;
    }
}

module.exports = new ExtensionService();