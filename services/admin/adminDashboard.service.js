// VỊ TRÍ: backend/services/admin/adminDashboard.service.js
const UserModel = require('../../models/user.model');
const RecipeModel = require('../../models/recipe.model');
const ArticleModel = require('../../models/article.model');
const DictionaryDishModel = require('../../models/dictionaryDish.model');
const IngredientModel = require('../../models/ingredient.model');

class AdminDashboardService {
    /**
     * Lấy toàn bộ số liệu thống kê cho trang Dashboard của Admin
     */
    async getDashboardStats() {
        // Chạy song song các query để tối ưu hiệu suất
        const [
            totalUsers, totalRecipes, totalArticles, 
            totalDishes, totalIngredients, userGrowth, 
            recipeGrowth, recipeDistribution, userRoleDistribution
        ] = await Promise.all([
            UserModel.countUsers(''),
            RecipeModel.countAllRecipes(''),
            ArticleModel.countAllArticles(''),
            DictionaryDishModel.countAllDishes(''),
            IngredientModel.countAllIngredients(''),
            UserModel.getUserGrowthStats(30),
            RecipeModel.getRecipeGrowthStats(30),
            RecipeModel.getRecipeStatusDistribution(),
            UserModel.getUserRoleDistribution()
        ]);

        const avgRecipePerUser = totalUsers > 0 ? (totalRecipes / totalUsers).toFixed(2) : 0;

        return {
            summary: { 
                users: totalUsers, 
                recipes: totalRecipes, 
                articles: totalArticles, 
                ingredients: totalIngredients, 
                dishes: totalDishes, 
                avgRecipePerUser: parseFloat(avgRecipePerUser) 
            },
            charts: { userGrowth, recipeGrowth, recipeDistribution, userRoleDistribution }
        };
    }
}

module.exports = new AdminDashboardService();