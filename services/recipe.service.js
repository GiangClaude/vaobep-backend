const path = require('path');
const fsPromises = require('fs').promises; // Dùng promises để xóa file
const db = require('../config/db'); // Kéo db vào để dùng Transaction
const RecipeModel = require('../models/recipe.model');
const UserModel = require('../models/user.model');
const IngredientModel = require('../models/ingredient.model'); 
const UnitModel = require('../models/unit.model');
const TagModel = require('../models/tag.model');
const AppError = require('../utils/AppError');
const { checkRecipeOwner } = require('../utils/recipe.utils');
const { addVectorSyncJob } = require('./vectorQueue.service');
const { deleteCloudinaryImage } = require('../utils/cloudinary');

const {DEFAULT_RECIPE_IMG} = require("../config/constants")
class RecipeService {
    async createRecipe(recipeId, userId, body, files) {
        const connection = await db.pool.getConnection(); // MỞ TRANSACTION
        try {
            await connection.beginTransaction();

            let { title, description, servings, cook_time, cookTime, total_calo, totalCalo, ingredients, instructions, tags, steps } = body;
            
            const finalCookTime = cook_time || cookTime || 60;
            const finalTotalCalo = total_calo || totalCalo || 0;
            const finalServings = servings || 1;
            let finalTags = [];
            let finalInstructions = instructions;

            if (steps) {
                let parsedSteps = [];
                try {
                    parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
                    
                    // Lấy mảng files do Multer xử lý
                    const stepImageFiles = (files && files['step_images']) ? files['step_images'] : [];
                    let fileIndex = 0;

                    parsedSteps = parsedSteps.map(step => {
                        // Nếu frontend đánh dấu có file mới, ta lấy URL từ Multer
                        if (step.hasNewFile && stepImageFiles[fileIndex]) {
                            step.image = stepImageFiles[fileIndex].path;
                            fileIndex++;
                        }
                        delete step.hasNewFile; // Dọn rác trước khi lưu DB
                        return step;
                    });
                    
                    finalInstructions = JSON.stringify(parsedSteps);
                } catch (e) {
                    finalInstructions = typeof steps === 'object' ? JSON.stringify(steps) : steps;
                }
            }

            // Fix lỗi nuốt lỗi JSON
            if (tags) {
                try { finalTags = typeof tags === 'string' ? JSON.parse(tags) : tags; } 
                catch (e) { throw new AppError("Định dạng tags không hợp lệ", 400); }
            }

            let ingredientsList = [];
            if (ingredients) {
                try { ingredientsList = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients; } 
                catch (e) { throw new AppError("Định dạng nguyên liệu (ingredients) không hợp lệ", 400); }
            }

            let coverImageName = null;
            let resultImagesList = [];
            
            // Xử lý mảng files do Multer .any() trả về (định dạng mảng)
            if (files && files.length > 0) {
                files.forEach(file => {
                    if (file.fieldname === 'cover_image') {
                        coverImageName = file.path;
                    } else if (file.fieldname === 'result_images') {
                        resultImagesList.push({ url: file.path, description: "Thành phẩm" });
                    } else if (file.fieldname.startsWith('step_image_')) {
                        // Lấy index từ tên field (vd: step_image_0 -> 0)
                        const stepIndex = parseInt(file.fieldname.split('_')[2]);
                        resultImagesList.push({ url: file.path, description: `Bước ${stepIndex + 1}` });
                    }
                });
            }

            // Ép JSON instructions chỉ lưu text, không lưu rác URL
            let cleanInstructions = [];
            if (steps) {
                const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
                cleanInstructions = parsedSteps.map(s => ({ step: s.step, description: s.description }));
            }
            finalInstructions = JSON.stringify(cleanInstructions);

            // TRUYỀN CONNECTION VÀO MODEL ĐỂ ĐẢM BẢO TRANSACTION

            // TRUYỀN CONNECTION VÀO MODEL ĐỂ ĐẢM BẢO TRANSACTION
            let processedIngredients = [];
            if (ingredientsList && ingredientsList.length > 0) {
                for (const ing of ingredientsList) {
                    // Nhạc trưởng gọi đệ tử đi tìm hoặc tạo ID
                    const ingredient = await IngredientModel.findOrCreate(ing.name, connection);
                    const unitId = await UnitModel.findOrCreate(ing.unit, connection);
                    
                    processedIngredients.push({
                        ingredientId: ingredient.id,
                        unitId: unitId,
                        quantity: parseFloat(ing.amount || ing.quantity)
                    });
                }
            }

            // --- 2. GỌI RECIPE MODEL (Chỉ truyền ID, bỏ Tags ra) ---
            const newRecipe = await RecipeModel.create(connection, {
                recipeId, userId, title, description, instructions: finalInstructions,
                coverImage: coverImageName, servings: finalServings, cookTime: finalCookTime,
                totalCalo: finalTotalCalo, ingredientsData: processedIngredients, 
                status: body.status || 'draft', resultImages: resultImagesList
            });

            // --- 3. XỬ LÝ TAGS BẰNG TAG MODEL ---
            if (finalTags && finalTags.length > 0) {
                // Tái sử dụng hàm đã có sẵn trong TagModel
                await TagModel.addTagsToPost(recipeId, 'recipe', finalTags, connection);
            }

            await connection.commit();

            if (newRecipe.status === 'public' || newRecipe.status === 'hidden') {
                addVectorSyncJob(recipeId, 'recipe', 'upsert');
            }

            return newRecipe;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // async updateRecipe(recipeId, userId, body, files) {
    //     const canEdit = await checkRecipeOwner(recipeId, userId);
    //     if (!canEdit) throw new AppError('Bạn không có quyền chỉnh sửa công thức này!', 403);

    //     const connection = await db.pool.getConnection(); // MỞ TRANSACTION
    //     try {
    //         await connection.beginTransaction();

    //         let { title, description, servings, cookTime, cook_time, totalCalo, total_calo, ingredients, instructions, status, tags, steps, cover_image } = body;

    //         const finalCookTime = cookTime || cook_time || 60;
    //         const finalTotalCalo = totalCalo || total_calo || 0;
    //         const finalServings = servings || 1;
    //         let finalTags = null;

    //         let finalInstructions = instructions;
    //          if (steps) {
    //             let parsedSteps = [];
    //             try {
    //                 parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
    //                 const stepImageFiles = (files && files['step_images']) ? files['step_images'] : [];
    //                 let fileIndex = 0;

    //                 // Lấy recipe cũ để so sánh xem có ảnh nào bị xóa không
    //                 const oldRecipe = await RecipeModel.findById(recipeId);
    //                 let oldParsedSteps = [];
    //                 if (oldRecipe && oldRecipe.instructions) {
    //                     try { oldParsedSteps = JSON.parse(oldRecipe.instructions); } catch(e) {}
    //                 }

    //                 parsedSteps = parsedSteps.map((step, index) => {
    //                     // Trưởng hợp 1: Có upload ảnh mới đè lên
    //                     if (step.hasNewFile && stepImageFiles[fileIndex]) {
    //                         // Xóa ảnh cũ (nếu có) trên Cloudinary
    //                         if (oldParsedSteps[index] && oldParsedSteps[index].image) {
    //                             deleteCloudinaryImage(oldParsedSteps[index].image);
    //                         }
    //                         step.image = stepImageFiles[fileIndex].path;
    //                         fileIndex++;
    //                     } 
    //                     // Trường hợp 2: User bấm nút X xóa ảnh cũ đi (truyền lên rỗng)
    //                     else if (!step.image && oldParsedSteps[index] && oldParsedSteps[index].image) {
    //                         deleteCloudinaryImage(oldParsedSteps[index].image);
    //                     }
                        
    //                     delete step.hasNewFile;
    //                     return step;
    //                 });
    //                 finalInstructions = JSON.stringify(parsedSteps);
    //             } catch (e) {
    //                 finalInstructions = typeof steps === 'object' ? JSON.stringify(steps) : steps;
    //             }
    //         }

    //         // Fix lỗi nuốt lỗi JSON
    //         if (tags !== undefined) {
    //             try { finalTags = typeof tags === 'string' ? JSON.parse(tags) : tags; } 
    //             catch (e) { throw new AppError("Định dạng tags không hợp lệ", 400); }
    //         }

    //         let ingredientsList = [];
    //         if (ingredients) {
    //             try { ingredientsList = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients; } 
    //             catch (e) { throw new AppError("Dữ liệu nguyên liệu lỗi format", 400); }
    //         }


    //         const recipeData = {
    //             title, description, instructions: finalInstructions, servings: finalServings,
    //             cook_time: finalCookTime, total_calo: finalTotalCalo, status: status || 'draft',
                
    //         };

    //         if (cover_image === "") {
    //             recipeData.cover_image = ""; // Nạp chuỗi rỗng vào để Model nhận diện và đổi thành Default
                
    //             // Tiện tay xóa luôn ảnh cũ trên Cloudinary
    //             const oldRecipe = await RecipeModel.findById(recipeId);
    //             if (oldRecipe && oldRecipe.cover_image && oldRecipe.cover_image !== DEFAULT_RECIPE_IMG) {
    //                 deleteCloudinaryImage(oldRecipe.cover_image); 
    //             }
    //         }

    //         let resultImagesList = [];

    //         // 1. Phân loại các file mới gửi lên
    //         if (files && files.length > 0) {
    //             files.forEach(file => {
    //                 if (file.fieldname === 'cover_image') {
    //                     recipeData.cover_image = file.path;
    //                 } else if (file.fieldname.startsWith('step_image_')) {
    //                     const stepIndex = parseInt(file.fieldname.split('_')[2]);
    //                     resultImagesList.push({ url: file.path, description: `Bước ${stepIndex + 1}` });
    //                 }
    //             });
    //         }

    //         // Xóa cover_image cũ nếu có upload cover mới
    //         if (recipeData.cover_image && recipeData.cover_image !== "") {
    //             const oldRecipe = await RecipeModel.findById(recipeId);
    //             if (oldRecipe && oldRecipe.cover_image && oldRecipe.cover_image !== DEFAULT_RECIPE_IMG && recipeData.cover_image !== oldRecipe.cover_image) {
    //                 deleteCloudinaryImage(oldRecipe.cover_image);
    //             }
    //         }

    //         // 2. Xử lý giữ lại các ảnh steps cũ (nếu user không đổi)
    //         let cleanInstructions = [];
    //         if (steps) {
    //             const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
    //             cleanInstructions = parsedSteps.map((s, index) => {
    //                 if (s.existingImage) {
    //                     // Giữ nguyên toàn bộ URL của Cloudinary thay vì cắt chuỗi
    //                     resultImagesList.push({ url: s.existingImage, description: `Bước ${index + 1}` });
    //                 }
    //                 return { step: s.step, description: s.description }; // Trả JSON text sạch
    //             });
    //         }
    //         recipeData.instructions = JSON.stringify(cleanInstructions);

    //         // [MỞ RỘNG] Thêm resultImagesList vào payload gửi qua Model
    //         recipeData.resultImages = resultImagesList;

    //         // FIX: XÓA ẢNH CŨ KHI UPLOAD ẢNH MỚI CHỐNG TRÀN Ổ CỨNG
    //         // if (files && files['cover_image'] && files['cover_image'].length > 0) {
    //         //     const oldRecipe = await RecipeModel.findById(recipeId);
    //         //     if (oldRecipe && oldRecipe.cover_image) {
    //         //         const oldFilePath = path.join(__dirname, '../public/recipes', recipeId.toString(), oldRecipe.cover_image);
    //         //         try { 
    //         //             await fsPromises.unlink(oldFilePath); 
    //         //         } catch (e) {
    //         //             console.warn(`[File System] Không thể xóa ảnh cover cũ của recipe ${recipeId}:`, e.message);
    //         //         } // Soft delete
    //         //     }
    //         //     recipeData.cover_image = files['cover_image'][0].filename;
    //         // }

    //         const mappedIngredients = (ingredientsList || []).map(item => ({
    //             name: item.name,
    //             unit: item.unit, 
    //             quantity: parseFloat(item.amount || item.quantity)
    //         }));

    //         // TRUYỀN CONNECTION VÀO MODEL ĐỂ ĐẢM BẢO TRANSACTION
    //         const result = await RecipeModel.update(recipeId, recipeData, mappedIngredients, finalTags, connection);

    //         await connection.commit();

    //         if (recipeData.status === 'public' || recipeData.status === 'hidden') {
    //             addVectorSyncJob(recipeId, 'recipe', 'upsert');
    //         } else {
    //             addVectorSyncJob(recipeId, 'recipe', 'delete');
    //         }

    //         return result;
    //     } catch (error) {
    //         await connection.rollback();
    //         throw error;
    //     } finally {
    //         connection.release();
    //     }
    // }

    async updateRecipe(recipeId, userId, body, files) {
        const canEdit = await checkRecipeOwner(recipeId, userId);
        if (!canEdit) throw new AppError('Bạn không có quyền chỉnh sửa công thức này!', 403);

        const connection = await db.pool.getConnection(); // MỞ TRANSACTION
        try {
            await connection.beginTransaction();

            let { title, description, servings, cookTime, cook_time, totalCalo, total_calo, ingredients, status, tags, steps, cover_image } = body;

            const finalCookTime = cookTime || cook_time || 60;
            const finalTotalCalo = totalCalo || total_calo || 0;
            const finalServings = servings || 1;
            let finalTags = null;

            // Fix lỗi định dạng Tags & Ingredients
            if (tags !== undefined) {
                try { finalTags = typeof tags === 'string' ? JSON.parse(tags) : tags; } 
                catch (e) { throw new AppError("Định dạng tags không hợp lệ", 400); }
            }

            let ingredientsList = [];
            if (ingredients) {
                try { ingredientsList = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients; } 
                catch (e) { throw new AppError("Dữ liệu nguyên liệu lỗi format", 400); }
            }

            const recipeData = {
                title, description, servings: finalServings,
                cook_time: finalCookTime, total_calo: finalTotalCalo, status: status || 'draft',
            };

            // Lấy Recipe cũ ra trước để lát nữa so sánh dọn rác Cloudinary
            const oldRecipe = await RecipeModel.findById(recipeId);

            // XỬ LÝ ẢNH COVER
            if (cover_image === "") {
                recipeData.cover_image = ""; // Nạp chuỗi rỗng vào để Model nhận diện và đổi thành Default
                if (oldRecipe && oldRecipe.cover_image && oldRecipe.cover_image !== DEFAULT_RECIPE_IMG) {
                    deleteCloudinaryImage(oldRecipe.cover_image); 
                }
            }

            let resultImagesList = [];

            // 1. Lọc lấy các ảnh MỚI TẢI LÊN từ Multer
            if (files && files.length > 0) {
                files.forEach(file => {
                    if (file.fieldname === 'cover_image') {
                        recipeData.cover_image = file.path;
                    } else if (file.fieldname.startsWith('step_image_')) {
                        const stepIndex = parseInt(file.fieldname.split('_')[2]);
                        resultImagesList.push({ url: file.path, description: `Bước ${stepIndex + 1}` });
                    }
                });
            }

            // Xóa ảnh cover cũ nếu có upload ảnh cover mới
            if (recipeData.cover_image && recipeData.cover_image !== "") {
                if (oldRecipe && oldRecipe.cover_image && oldRecipe.cover_image !== DEFAULT_RECIPE_IMG && recipeData.cover_image !== oldRecipe.cover_image) {
                    deleteCloudinaryImage(oldRecipe.cover_image);
                }
            }

            // 2. XỬ LÝ STEPS & GIỮ LẠI ẢNH CŨ
            let cleanInstructions = [];
            if (steps) {
                const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
                cleanInstructions = parsedSteps.map((s, index) => {
                    if (s.existingImage) {
                        // [ĐÃ FIX] Giữ nguyên toàn bộ URL của Cloudinary thay vì cắt chuỗi
                        resultImagesList.push({ url: s.existingImage, description: `Bước ${index + 1}` });
                    }
                    return { step: s.step, description: s.description }; // Trả JSON text sạch
                });
            }
            recipeData.instructions = JSON.stringify(cleanInstructions);
            recipeData.resultImages = resultImagesList; // Gửi list ảnh qua model

            // 3. DỌN RÁC CLOUDINARY (Ảnh của các bước nấu ăn)
            // So sánh danh sách ảnh cũ trong DB với danh sách ảnh mới (resultImagesList)
            // Nếu ảnh cũ không xuất hiện trong danh sách mới -> User đã xóa -> Xóa trên Cloudinary
            if (oldRecipe && oldRecipe.images && oldRecipe.images.length > 0) {
                const newImageUrls = resultImagesList.map(img => img.url);
                oldRecipe.images.forEach(oldImg => {
                    if (!newImageUrls.includes(oldImg.imgLink) && oldImg.imgLink.includes('cloudinary.com')) {
                        deleteCloudinaryImage(oldImg.imgLink);
                    }
                });
            }

            let processedIngredients = [];
            let newIngredientsPending = false;
            if (ingredientsList && ingredientsList.length > 0) {
                for (const item of ingredientsList) {
                    const { name: ingredientName, amount, unit: unitName } = item;
                    
                    // Nhạc trưởng gọi tìm ID
                    const ingredient = await IngredientModel.findOrCreate(ingredientName, connection);
                    const unitId = await UnitModel.findOrCreate(unitName, connection);
                    
                    if (ingredient.status === 'pending') {
                        newIngredientsPending = true;
                    }

                    processedIngredients.push({
                        ingredientId: ingredient.id,
                        unitId: unitId,
                        quantity: parseFloat(amount)
                    });
                }
            }
            // TRUYỀN CONNECTION VÀO MODEL ĐỂ ĐẢM BẢO TRANSACTION
            const result = await RecipeModel.update(recipeId, recipeData, processedIngredients, connection);
            result.notification = newIngredientsPending ? 'Nguyên liệu mới đang chờ duyệt.' : null;

            if (finalTags !== null) {
                // Tái sử dụng hàm updateTagsForPost cực xịn bạn đã có sẵn
                // Hàm này tự động XÓA tag cũ và INSERT tag mới
                await TagModel.updateTagsForPost(recipeId, 'recipe', finalTags, connection);
            }

            await connection.commit();

            // Xử lý AI Vector Sync
            if (recipeData.status === 'public' || recipeData.status === 'hidden') {
                addVectorSyncJob(recipeId, 'recipe', 'upsert');
            } else {
                addVectorSyncJob(recipeId, 'recipe', 'delete');
            }

            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async deleteRecipe(recipeId, userId) {
        const canEdit = await checkRecipeOwner(recipeId, userId);
        if (!canEdit) throw new AppError('Bạn không có quyền xóa công thức này!', 403);
        const oldRecipe = await RecipeModel.findById(recipeId);
        const result = await RecipeModel.deleteById(recipeId);

        if (oldRecipe && oldRecipe.cover_image && oldRecipe.cover_image !== DEFAULT_RECIPE_IMG) {
            deleteCloudinaryImage(oldRecipe.cover_image);
        }

        addVectorSyncJob(recipeId, 'recipe', 'delete');

        return result;
    }

    async changeRecipeStatus(recipeId, userId, status) {
        const validStatuses = ['public', 'hidden', 'draft']; 
        if (!status || !validStatuses.includes(status)) {
            throw new AppError('Trạng thái không hợp lệ! Chỉ chấp nhận: ' + validStatuses.join(', '), 400);
        }

        const canEdit = await checkRecipeOwner(recipeId, userId);
        if (!canEdit) throw new AppError('Bạn không có quyền thay đổi trạng thái bài viết này.', 403);

        const success = await RecipeModel.updateStatus(recipeId, status);
        if (!success) throw new AppError('Không tìm thấy công thức để cập nhật.', 404);

        if (status === 'public' || status === 'hidden') {
            addVectorSyncJob(recipeId, 'recipe', 'upsert');
        } else {
            addVectorSyncJob(recipeId, 'recipe', 'delete');
        }

        return status;
    }

    async searchSimpleRecipes(keyword, userId) {
        // const user = await UserModel.findById(userId);
        // if (!user) throw new AppError('Không tìm thấy người dùng', 404);
        // if (user.role === 'user') throw new AppError('Bạn không có quyền truy cập tính năng này', 403);

        if (!keyword) return [];
        return await RecipeModel.searchSimpleRecipes(keyword);
    }

    // ==========================================
    // CÁC HÀM GET CHUYỂN TỪ CONTROLLER SANG ĐỂ ĐẢM BẢO 3-TIER ARCHITECTURE
    // ==========================================
    async getRecipeById(recipeId) {
        const recipeData = await RecipeModel.findById(recipeId);
        console.log("RecipeService: ", recipeData);
        if (!recipeData) throw new AppError('Không tìm thấy công thức', 404);
        return recipeData;
    }

    async getRecipes(page, limit, filters, currentUserId) {
        return await RecipeModel.getRecipes(page, limit, filters, currentUserId);
    }

    async getRecentlyRecipes(category, tag, currentUserId) {
        console.log('Recently Recipes - Category:', category, 'Tag:', tag, 'Current User ID:', currentUserId);
        const recipes = await RecipeModel.getRecentlyRecipes(category, tag, 10, currentUserId);
        if (!recipes || recipes.length === 0) throw new AppError('Không tìm thấy công thức nào gần đây', 404);
        return recipes;
    }

    async getFeatureRecipes() {
        const recipes = await RecipeModel.getFeatureRecipes();
        if (!recipes || recipes.length === 0) throw new AppError('Không có feature thỏa mãn', 404);
        return recipes;
    }

    async getOwnerRecipe(userId) {
        return await RecipeModel.getOwnerRecipe(userId);
    }

    async getUserRecipe(userId) {
        return await RecipeModel.getUserRecipe(userId);
    }

    async getPreviewComments(recipeId) {
        return await RecipeModel.getPreviewComments(recipeId);
    }

    async getSavedRecipes(userId, sortKey, sortOrder, limit, page) {
        return await RecipeModel.getSavedRecipes(userId, sortKey, sortOrder, limit, page);
    }
}

module.exports = new RecipeService();