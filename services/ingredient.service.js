const IngredientModel = require('../models/ingredient.model');

class IngredientService {
    async getAllIngredients() {
        return await IngredientModel.getAll();
    }
}

module.exports = new IngredientService();