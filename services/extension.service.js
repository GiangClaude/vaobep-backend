const ExtensionModel = require('../models/extension.model');
const extensionAiService = require('./extensionAi.service');
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
        
        const searchTerm = `%${query.trim()}%`;
        return await ExtensionModel.searchRecipesByTitle(searchTerm, 5);
    }

    /**
     * 3. Nhận diện hình ảnh và tìm công thức tương ứng
     * - Làm sạch chuỗi base64
     * - Gọi AI lấy tên món
     * - Truy vấn DB tìm món đó
     */
    async identifyImage(image) {
        if (!image) throw new AppError('Thiếu ảnh', 400);

        // Dọn dẹp chuỗi base64
        const base64Data = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

        // Gọi AI nhận diện tên món
        const dishName = await extensionAiService.identifyDishFromImage(base64Data);
        
        // Truy vấn Database
        const searchTerm = `%${dishName.replace(/["']/g, '').trim()}%`; 
        const recipes = await ExtensionModel.searchRecipesByTitle(searchTerm, 3);

        return { dishName, recipes };
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