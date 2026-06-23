const { filter } = require('rxjs');
const db = require('../config/db');
const { buildRecipeQuery } = require('../utils/recipe.utils');
const pool = db.pool;
const { v4: uuidv4 } = require('uuid');
const {parseTagsData} = require('../utils/helper.utils')
const FEATURE_CRITERIA = {
    MIN_LIKES: 2,
    MAX_REPORTS: 2,
    MIN_AVG_RATING: 4.0,
    TIME_FRAME_DAYS: 7 // 7 ngày gần nhất
};
const { DEFAULT_RECIPE_IMG } = require('../config/constants');
class Recipe{
    // static async create(connection, {
    //     recipeId, userId, title, description, instructions, coverImage, 
    //     servings, cookTime, totalCalo, ingredientsData, status, resultImages = [], tags = []
    // }) {
    //     const executor = connection || pool;

    //     // 🔥 LOGIC ẢNH MẶC ĐỊNH: Bắt mọi trường hợp null, undefined, hoặc chuỗi rỗng
    //     if (!coverImage || String(coverImage).trim() === '') {
    //         coverImage = DEFAULT_RECIPE_IMG;
    //     }

    //     // --- 1. INSERT vào bảng Recipes ---
    //     const sqlRecipe = `
    //         INSERT INTO recipes 
    //             (recipe_id, user_id, title, description, instructions, cover_image, status, servings, cook_time, total_calo)
    //         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    //     `;
        
    //     await executor.execute(sqlRecipe, [
    //         recipeId, userId, title, description, instructions, coverImage,
    //         status || 'draft', servings, cookTime, totalCalo
    //     ]);

    //     // --- 2. XỬ LÝ NGUYÊN LIỆU (Ingredients & Units) ---
    //     if (ingredientsData && ingredientsData.length > 0) {
    //         for (const ing of ingredientsData) {
    //             // A. Xử lý tên Nguyên liệu
    //             let ingredientId;
    //             const [foundIng] = await executor.execute(
    //                 `SELECT ingredient_id FROM ingredients WHERE name = ?`, [ing.name]
    //             );

    //             if (foundIng.length > 0) {
    //                 ingredientId = foundIng[0].ingredient_id;
    //             } else {
    //                 const newIngId = uuidv4();
    //                 // 🛠️ Đã fix lỗi typo: tngredients -> ingredients
    //                 await executor.execute(
    //                     `INSERT INTO ingredients (ingredient_id, name, status) VALUES (?, ?, 'pending')`,
    //                     [newIngId, ing.name]
    //                 );
    //                 ingredientId = newIngId;
    //             }

    //             // B. Xử lý Đơn vị
    //             let unitId;
    //             const [foundUnit] = await executor.execute(
    //                 `SELECT unit_id FROM units WHERE name = ?`, [ing.unit]
    //             );

    //             if (foundUnit.length > 0) {
    //                 unitId = foundUnit[0].unit_id;
    //             } else {
    //                 const newUnitId = uuidv4();
    //                 await executor.execute(
    //                     `INSERT INTO units (unit_id, name) VALUES (?, ?)`,
    //                     [newUnitId, ing.unit]
    //                 );
    //                 unitId = newUnitId;
    //             }

    //             // C. Insert vào bảng liên kết Recipe_Ingredients
    //             await executor.execute(
    //                 `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id) VALUES (?, ?, ?, ?)`,
    //                 [recipeId, ingredientId, ing.quantity, unitId] 
    //             );
    //         }
    //     }

    //     // --- Xử lý Tags ---
    //     if (tags && tags.length > 0) {
    //         const tagSql = `INSERT INTO tag_post (tag_id, post_id, post_type) VALUES (?, ?, 'recipe')`;
    //         for (const tagId of tags) {
    //             await executor.execute(tagSql, [tagId, recipeId]);
    //         }
    //     }

    //     // --- 3. INSERT bảng Recipe_Images ---
    //     if (resultImages && resultImages.length > 0) {
    //         const imgSql = `INSERT INTO recipe_images (img_id, recipe_id, imgLink, description) VALUES (?, ?, ?, ?)`;
    //         for (const img of resultImages) {
    //             const newImgId = uuidv4();
    //             await executor.execute(imgSql, [newImgId, recipeId, img.url, img.description]);
    //         }
    //     }

    //     return { recipe_id: recipeId, title: title };
    // }

    // THAY THẾ TOÀN BỘ HÀM CREATE CŨ
    static async create(connection, {
        recipeId, userId, title, description, instructions, coverImage, 
        servings, cookTime, totalCalo, ingredientsData, status, resultImages = []
    }) {
        const executor = connection || pool;

        if (!coverImage || String(coverImage).trim() === '') {
            coverImage = DEFAULT_RECIPE_IMG;
        }

        // --- 1. INSERT bảng Recipes ---
        const sqlRecipe = `
            INSERT INTO recipes 
                (recipe_id, user_id, title, description, instructions, cover_image, status, servings, cook_time, total_calo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await executor.execute(sqlRecipe, [
            recipeId, userId, title, description, instructions, coverImage,
            status || 'draft', servings, cookTime, totalCalo
        ]);

        // --- 2. INSERT bảng Recipe_Ingredients ---
        // (Dữ liệu lúc này đã là mảng các ID chuẩn chỉnh do Service truyền vào)
        if (ingredientsData && ingredientsData.length > 0) {
            for (const ing of ingredientsData) {
                await executor.execute(
                    `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id) VALUES (?, ?, ?, ?)`,
                    [recipeId, ing.ingredientId, ing.quantity, ing.unitId] 
                );
            }
        }

        // --- 3. INSERT bảng Recipe_Images ---
        if (resultImages && resultImages.length > 0) {
            const imgSql = `INSERT INTO recipe_images (img_id, recipe_id, imgLink, description) VALUES (?, ?, ?, ?)`;
            for (const img of resultImages) {
                const newImgId = uuidv4();
                await executor.execute(imgSql, [newImgId, recipeId, img.url, img.description]);
            }
        }

        // Tags đã bị xóa khỏi đây vì Service đã gọi TagModel xử lý riêng.

        return { recipe_id: recipeId, title: title };
    }


    // static async update(recipeId, recipeData, ingredientList, tagList, connection) {
    //     const executor = connection || pool;
    //     let newIngredientsPending = false;

    //     // 🔥 LOGIC ẢNH MẶC ĐỊNH CHO UPDATE
    //     // Tùy thuộc vào việc controller của bạn truyền key vào là 'coverImage' hay 'cover_image'
    //     const imgKey = recipeData.hasOwnProperty('cover_image') ? 'cover_image' : 
    //                    recipeData.hasOwnProperty('coverImage') ? 'coverImage' : null;

    //     // Nếu FE có gửi yêu cầu cập nhật ảnh (imgKey != null)
    //     if (imgKey) {
    //         // Nếu gửi lên là null, undefined, hoặc chuỗi rỗng -> Tráo thành Default
    //         if (!recipeData[imgKey] || String(recipeData[imgKey]).trim() === '') {
    //             recipeData[imgKey] = DEFAULT_RECIPE_IMG;
    //         }
    //     }

    //     // [SỬA LỖI] Bóc tách mảng ảnh ra và xóa khỏi object trước khi build SQL động
    //     const resultImagesToSave = recipeData.resultImages;
    //     delete recipeData.resultImages; 

    //     // 1. UPDATE bảng Recipes
    //     const recipeKeys = Object.keys(recipeData).filter(key => recipeData[key] !== undefined);
    //     if (recipeKeys.length > 0) {
    //         const setClauses = recipeKeys.map(key => `\`${key}\` = ?`);
    //         setClauses.push('update_at = NOW()');
    //         const queryValues = recipeKeys.map(key => recipeData[key]);
    //         queryValues.push(recipeId);

    //         // 🛠️ Đã fix lỗi đánh máy: sET -> SET
    //         const updateQuery = `UPDATE recipes SET ${setClauses.join(', ')} WHERE recipe_id = ?`;
    //         await executor.execute(updateQuery, queryValues);
    //     }

    //     // 2. XỬ LÝ NGUYÊN LIỆU
    //     await executor.execute('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);

    //     if (ingredientList && ingredientList.length > 0) {
    //         const processedIngredients = [];

    //         // Chuyển từ Promise.all sang for...of để xử lý tuần tự, tránh lỗi Duplicate Entry khi Insert đồng thời
    //         for (const item of ingredientList) {
    //             const { name: ingredientName, quantity, unit: unitName } = item;

    //             // A. Xử lý Ingredients
    //             let ingredientId;
    //             let ingredientStatus = 'approved';

    //             let [foundIng] = await executor.execute(
    //                 `SELECT ingredient_id, status FROM ingredients WHERE name = ?`, [ingredientName]
    //             );

    //             if (foundIng.length > 0) {
    //                 ingredientId = foundIng[0].ingredient_id;
    //                 ingredientStatus = foundIng[0].status;
    //             } else {
    //                 const newIngId = uuidv4();
    //                 await executor.execute(
    //                     `INSERT INTO ingredients (ingredient_id, name, status) VALUES (?, ?, 'pending')`,
    //                     [newIngId, ingredientName]
    //                 );
    //                 ingredientId = newIngId;
    //                 ingredientStatus = 'pending';
    //             }

    //             if (ingredientStatus === 'pending') newIngredientsPending = true;

    //             // B. Xử lý Units
    //             let unitId;
    //             const [foundUnit] = await executor.execute(
    //                 `SELECT unit_id FROM units WHERE name = ?`, [unitName]
    //             );

    //             if (foundUnit.length > 0) {
    //                 unitId = foundUnit[0].unit_id;
    //             } else {
    //                 const newUnitId = uuidv4();
    //                 await executor.execute(`INSERT INTO units (unit_id, name) VALUES (?, ?)`, [newUnitId, unitName]);
    //                 unitId = newUnitId;
    //             }

    //             // Đẩy kết quả đã xử lý tuần tự vào mảng để chờ Insert Bulk
    //             processedIngredients.push({ ingredientId, quantity, unitId });
    //         }

    //         // C. Insert Bulk
    //         const ingredientPlaceholders = processedIngredients.map(() => '(?, ?, ?, ?)');
    //         const ingredientParams = processedIngredients.flatMap(item => 
    //             [recipeId, item.ingredientId, item.quantity, item.unitId]
    //         );

    //         if (ingredientPlaceholders.length > 0) {
    //             const ingredientSql = `
    //                 INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id) 
    //                 VALUES ${ingredientPlaceholders.join(', ')}
    //             `;
    //             await executor.execute(ingredientSql, ingredientParams);
    //         }
    //     }

    //     // 3. XỬ LÝ HÌNH ẢNH CỦA CÁC BƯỚC NẤU (recipe_images)
    //     if (resultImagesToSave) {
    //         await executor.execute('DELETE FROM recipe_images WHERE recipe_id = ?', [recipeId]);
    //         if (resultImagesToSave.length > 0) {
    //             const imgSql = `INSERT INTO recipe_images (img_id, recipe_id, imgLink, description) VALUES (?, ?, ?, ?)`;
    //             for (const img of resultImagesToSave) {
    //                 await executor.execute(imgSql, [uuidv4(), recipeId, img.url, img.description]);
    //             }
    //         }
    //     }

    //     // 3. XỬ LÝ TAGS
    //     if (tagList) { 
    //         await executor.execute(
    //             `DELETE FROM tag_post WHERE post_id = ? AND post_type = 'recipe'`, [recipeId]
    //         );

    //         if (tagList.length > 0) {
    //             const tagSql = `INSERT INTO tag_post (tag_id, post_id, post_type) VALUES (?, ?, 'recipe')`;
    //             for (const tagId of tagList) {
    //                  await executor.execute(tagSql, [tagId, recipeId]);
    //             }
    //         }
    //     }

    //     return { 
    //         success: true, 
    //         message: 'Cập nhật công thức thành công!',
    //         notification: newIngredientsPending ? 'Nguyên liệu mới đang chờ duyệt.' : null 
    //     };
    // }

    // THAY THẾ TOÀN BỘ HÀM UPDATE CŨ
    // LƯU Ý: Đã bỏ tham số `tagList` ra khỏi hàm
    static async update(recipeId, recipeData, ingredientList, connection) {
        const executor = connection || pool;

        // XỬ LÝ ẢNH MẶC ĐỊNH CHO UPDATE
        const imgKey = recipeData.hasOwnProperty('cover_image') ? 'cover_image' : 
                       recipeData.hasOwnProperty('coverImage') ? 'coverImage' : null;

        if (imgKey) {
            if (!recipeData[imgKey] || String(recipeData[imgKey]).trim() === '') {
                recipeData[imgKey] = DEFAULT_RECIPE_IMG;
            }
        }

        // Bóc tách mảng ảnh ra trước khi build SQL động
        const resultImagesToSave = recipeData.resultImages;
        delete recipeData.resultImages; 

        // --- 1. UPDATE BẢNG RECIPES ---
        const recipeKeys = Object.keys(recipeData).filter(key => recipeData[key] !== undefined);
        if (recipeKeys.length > 0) {
            const setClauses = recipeKeys.map(key => `\`${key}\` = ?`);
            setClauses.push('update_at = NOW()');
            const queryValues = recipeKeys.map(key => recipeData[key]);
            queryValues.push(recipeId);

            const updateQuery = `UPDATE recipes SET ${setClauses.join(', ')} WHERE recipe_id = ?`;
            await executor.execute(updateQuery, queryValues);
        }

        // --- 2. CẬP NHẬT RECIPE_INGREDIENTS ---
        await executor.execute('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);

        if (ingredientList && ingredientList.length > 0) {
            // Data truyền vào giờ đã là ID chuẩn xác từ Service
            const ingredientPlaceholders = ingredientList.map(() => '(?, ?, ?, ?)');
            const ingredientParams = ingredientList.flatMap(item => 
                [recipeId, item.ingredientId, item.quantity, item.unitId]
            );

            if (ingredientPlaceholders.length > 0) {
                console.log("RecipeModel: ", ingredientParams);
                const ingredientSql = `
                    INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id) 
                    VALUES ${ingredientPlaceholders.join(', ')}
                `;
                await executor.execute(ingredientSql, ingredientParams);
            }
        }

        // --- 3. CẬP NHẬT RECIPE_IMAGES ---
        if (resultImagesToSave) {
            await executor.execute('DELETE FROM recipe_images WHERE recipe_id = ?', [recipeId]);
            if (resultImagesToSave.length > 0) {
                const imgSql = `INSERT INTO recipe_images (img_id, recipe_id, imgLink, description) VALUES (?, ?, ?, ?)`;
                for (const img of resultImagesToSave) {
                    await executor.execute(imgSql, [uuidv4(), recipeId, img.url, img.description]);
                }
            }
        }

        // Xóa sạch logic xử lý Tags ở đây vì Service đã lo.

        return { 
            success: true, 
            message: 'Cập nhật công thức thành công!'
        };
    }

    static async deleteById(recipeId){
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const postType = 'recipe';

            await connection.execute(
                'DELETE FROM recipe_ingredients WHERE recipe_id = ?',
                [recipeId]
            );
            await connection.execute(
                'DELETE FROM menu_recipes WHERE recipe_id = ?',
                [recipeId]
            );

            await connection.execute(
                'DELETE FROM likes WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );

            await connection.execute(
                'DELETE FROM comments WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );
            await connection.execute(
                'DELETE FROM ratings WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );
            await connection.execute(
                'DELETE FROM reports WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );
            await connection.execute(
                'DELETE FROM saved_posts WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );

           const [deleteResult] = await connection.execute(
                'DELETE FROM recipes WHERE recipe_id = ?',
                [recipeId]
            ); 

            if (deleteResult.affectedRows === 0) {
                await connection.rollback();
                throw new Error('Không tìm thấy công thức để xóa.');
            }

            // 5. Commit Transaction
            await connection.commit();
            return {
                success: true,
                message: "Đã xóa thành công!"
            };            
        } catch (error) {
            await connection.rollback();
            console.error('Lỗi Model (deleteById):', error);
            throw new Error(`Xóa thất bại: ${error.message}`); 
        } finally {
            if (connection) connection.release();
        }
    }


    /**
     * LẤY CHI TIẾT CÔNG THỨC NẤU ĂN
     * Đã tối ưu: Dùng trực tiếp pool thay vì xin connection riêng
     */
    static async findById(recipeId) {
        if (!recipeId) {
            console.log("RecipeModel: Không có recipeId");
            return null;
        }

        try {
            // --- Query 1: Lấy thông tin Recipe và User ---
            const recipeSql = `
                SELECT 
                    R.*, 
                    U.user_id AS author_id,
                    U.full_name AS author_name, 
                    U.avatar AS author_avatar
                FROM recipes R
                JOIN users U ON R.user_id = U.user_id
                WHERE R.recipe_id = ? 
            `;
            
            // Dùng pool.execute thay cho connection.execute
            let [recipeRows] = await pool.execute(recipeSql, [recipeId]);

            if (recipeRows.length === 0) {
                return null; 
            }
            const recipe = recipeRows[0];

            // --- Query 2: Lấy thông tin Nguyên liệu ---
            const ingredientSql = `
                SELECT 
                    I.ingredient_id,
                    RI.quantity, 
                    I.name AS ingredient_name,
                    U.name AS unit_name,
                    U.unit_id
                FROM recipe_ingredients RI
                JOIN ingredients I ON RI.ingredient_id = I.ingredient_id
                JOIN units U ON RI.unit_id = U.unit_id
                WHERE RI.recipe_id = ?
            `;
            
            let [ingredientRows] = await pool.execute(ingredientSql, [recipeId]);
            recipe.ingredients = ingredientRows;

            // --- Query 3: Lấy thông tin Tags ---
            const tagSql = `
                SELECT T.tag_id, T.name 
                FROM tags T
                JOIN tag_post TP ON T.tag_id = TP.tag_id
                WHERE TP.post_id = ? AND TP.post_type = 'recipe'
            `;
            const [tagRows] = await pool.execute(tagSql, [recipeId]);
            recipe.tags = tagRows || [];

            const imgSql = `SELECT imgLink, description FROM recipe_images WHERE recipe_id = ?`;
            const [imgRows] = await pool.execute(imgSql, [recipeId]);
            recipe.images = imgRows || [];

            return recipe;



        } catch (error) {
            console.error('Lỗi Model (findById):', error);
            throw error;
        }
    }

        /**
     * Hàm tìm kiếm nhanh Recipe để phục vụ việc gắn link vào Article
     * Trả về: Tên món, Tác giả, Tag, Cover Image
     */
    static async searchSimpleRecipes(keyword) {
        try {
            // Giải thích: 
            // 1. Join Users để lấy tên tác giả (full_name)
            // 2. Left Join tag_post và Tags để lấy danh sách tên tag
            // 3. Group by để mỗi Recipe chỉ hiện 1 dòng duy nhất
            const sql = `
                SELECT 
                    r.recipe_id, 
                    r.title, 
                    r.cover_image, 
                    u.full_name AS author_name,
                    u.avatar AS author_avatar,
                    u.user_id,
                    GROUP_CONCAT(t.name SEPARATOR ', ') AS tags
                FROM recipes r
                JOIN users u ON r.user_id = u.user_id
                LEFT JOIN tag_post tp ON r.recipe_id = tp.post_id AND tp.post_type = 'recipe'
                LEFT JOIN tags t ON tp.tag_id = t.tag_id
                WHERE r.status = 'public' 
                AND (r.title LIKE ? OR u.full_name LIKE ? OR t.name LIKE ?)
                GROUP BY r.recipe_id, r.title, r.cover_image, u.full_name, u.avatar, u.user_id
                LIMIT 20
            `;

            const searchVal = `%${keyword}%`;
            const [rows] = await pool.execute(sql, [searchVal, searchVal, searchVal]);
            
            return rows;
        } catch (error) {
            console.error("Lỗi Recipe.searchSimpleRecipes:", error);
            throw error;
        }
    }

/**
     * Lấy danh sách công thức nấu ăn có phân trang, bộ lọc và kiểm tra trạng thái tương tác của người dùng hiện tại.
     * Đã cập nhật logic HAVING COUNT để bắt buộc công thức phải chứa TẤT CẢ các thẻ tag được chọn trong bộ lọc.
     */
/**
     * Lấy danh sách công thức nấu ăn kèm theo phân trang, bộ lọc nâng cao và danh sách thẻ tags của từng món.
     * Hàm này tự động kiểm tra trạng thái tương tác (Like/Save) của người dùng hiện tại nếu có.
     * * @param {number} page - Trang hiện tại cần lấy dữ liệu
     * @param {number} limit - Số lượng bản ghi tối đa trên một trang
     * @param {object} filters - Object chứa các điều kiện lọc (tags, keyword, minRating...)
     * @param {string|null} currentUserId - ID của người dùng đang đăng nhập hệ thống
     * @returns {object} Trả về đối tượng gồm mảng danh sách recipes và tổng số lượng bản ghi totalItems
     */
    static async getRecipes(page, limit, filters = {}, currentUserId = null) {
        const limitNum = parseInt(limit, 10) || 12; // Ép kiểu số lượng bản ghi
        const pageNum = parseInt(page, 10) || 1;    // Ép kiểu số trang
        const skip = (pageNum - 1) * limitNum;      // Tính số bản ghi cần bỏ qua cho OFFSET

        // 1. Sử dụng bộ công cụ để phân rã bộ lọc thành cấu trúc SQL động chuẩn SOLID
        const queryParts = buildRecipeQuery(filters);
        const filterParams = queryParts.params || [];

        // Tính toán chính xác số lượng tag đang thực hiện lọc
        let tagCount = 0;
        if (filters.tags) {
            if (Array.isArray(filters.tags)) {
                tagCount = filters.tags.length;
            } else if (typeof filters.tags === 'string' && filters.tags.trim() !== '') {
                tagCount = filters.tags.split(',').filter(Boolean).length;
            }
        }

        // 2. Thiết lập chuỗi SELECT mảnh: Gộp dữ liệu tags thành chuỗi định dạng id:::name|||id:::name
        const selectFragment = `
            SELECT 
                R.*, 
                U.user_id AS author_id,
                U.full_name AS author_name,
                U.avatar AS author_avatar,
                GROUP_CONCAT(DISTINCT I.name SEPARATOR ',') as ingredient_names,
                
                -- Thực hiện gộp cặp dữ liệu ID và Tên của Tag để trả về phía sau
                GROUP_CONCAT(
                    DISTINCT CONCAT(T_out.tag_id, ':::', T_out.name) 
                    SEPARATOR '|||'
                ) as raw_tags,

                EXISTS(
                    SELECT 1 FROM likes L 
                    WHERE L.post_id = R.recipe_id AND L.post_type = 'recipe' AND L.user_id = ?
                ) as is_liked,

                EXISTS(
                    SELECT 1 FROM saved_posts S 
                    WHERE S.post_id = R.recipe_id AND S.post_type = 'recipe' AND S.user_id = ?
                ) as is_saved
            FROM recipes AS R
            LEFT JOIN Users AS U ON R.user_id = U.user_id 
        `;

        // 3. Thiết lập chuỗi JOIN mảnh: Gắn thêm liên kết bảng tag độc lập để hiển thị dữ liệu
        const dataFetchJoins = `
            LEFT JOIN recipe_ingredients RI_Data ON R.recipe_id = RI_Data.recipe_id
            LEFT JOIN ingredients I ON RI_Data.ingredient_id = I.ingredient_id
            
            -- Thực hiện liên kết lấy dữ liệu tags độc lập hoàn toàn với việc lọc
            LEFT JOIN tag_post TP_out ON R.recipe_id = TP_out.post_id AND TP_out.post_type = 'recipe'
            LEFT JOIN tags T_out ON TP_out.tag_id = T_out.tag_id
        `;

        // Tổ hợp toàn bộ các mệnh đề JOIN và WHERE từ bộ công cụ chuyển qua
        const allJoins = queryParts.joinClauses.join(' ') + ' ' + dataFetchJoins;
        const whereString = ' WHERE ' + queryParts.whereClauses.join(' AND ');
        const groupByString = ' GROUP BY R.recipe_id, U.user_id, U.full_name, U.avatar ';
        
        // Mệnh đề HAVING đảm bảo món ăn chứa ĐỦ tập hợp các thẻ tag yêu cầu
        let havingString = '';
        if (tagCount > 0) {
            havingString = ' HAVING COUNT(DISTINCT TP.tag_id) = ? ';
        }

        const orderLimitOffset = ` ORDER BY R.created_at DESC LIMIT ${limitNum} OFFSET ${skip}`;

        try {
            // --- TIẾN HÀNH QUERIES COUNT (ĐẾM TỔNG PHÂN TRANG) ---
            let countQuery = '';
            let countParams = [...filterParams];

            if (tagCount > 0) {
                // Sử dụng Subquery kết hợp HAVING COUNT khi hệ thống đang lọc theo thẻ tag
                countQuery = `
                    SELECT COUNT(*) AS total FROM (
                        SELECT 1 FROM recipes AS R
                        ${queryParts.joinClauses.join(' ')}
                        ${whereString}
                        GROUP BY R.recipe_id
                        HAVING COUNT(DISTINCT TP.tag_id) = ?
                    ) AS temp_count
                `;
                countParams.push(tagCount);
            } else {
                const countFragment = 'SELECT COUNT(DISTINCT R.recipe_id) AS total FROM recipes AS R ';
                countQuery = countFragment + queryParts.joinClauses.join(' ') + whereString;
            }

            const [countResult] = await pool.query(countQuery, countParams);
            const totalItems = Number(countResult[0]?.total || 0);

            // --- TIẾN HÀNH QUERIES FETCH DATA (LẤY DỮ LIỆU THỰC TẾ) ---
            const finalQuery = selectFragment + allJoins + whereString + groupByString + havingString + orderLimitOffset;
            
            // Sắp xếp thứ tự truyền tham số chính xác theo các dấu chấm hỏi "?" trong chuỗi SQL
            const finalParams = [currentUserId, currentUserId, ...filterParams];
            if (tagCount > 0) {
                finalParams.push(tagCount);
            }
            
            const [result] = await pool.query(finalQuery, finalParams);
            
            // 4. Xử lý map dữ liệu kết quả: Chuyển chuỗi thô từ DB thành mảng Object thông qua file helper mới
            const formattedResult = result.map(row => {
                const { raw_tags, ...rest } = row;
                return {
                    ...rest,
                    is_liked: !!row.is_liked,
                    is_saved: !!row.is_saved,
                    tags: parseTagsData(raw_tags) // Gọi hàm tiện ích dùng chung để bóc tách thẻ tags
                };
            });

            return {
                recipes: formattedResult,
                totalItems: totalItems
            };
        } catch (error) {
            console.error("Lỗi SQL getRecipes:", error);
            throw error;
        }
    }

    static async getRecentlyRecipes(category, tag, limit = 10, currentUserId = null) {
        try {
            const parsedLimit = parseInt(limit, 10) || 10; 

            const sql = `
            SELECT 
                R.*, 
                U.full_name as author_name, 
                U.avatar as author_avatar,
                GROUP_CONCAT(DISTINCT I.name SEPARATOR ',') as ingredient_names,
                
                (EXISTS(SELECT 1 FROM likes WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_liked,
                (EXISTS(SELECT 1 FROM saved_posts WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_saved,

                GROUP_CONCAT(
                    DISTINCT CONCAT(Commenter.full_name, ':::', C.content) 
                    SEPARATOR '|||'
                ) as comment_data,
                
                -- Nối tag_id và name lại với nhau
                GROUP_CONCAT(
                    DISTINCT CONCAT(T.tag_id, ':::', T.name) 
                    SEPARATOR '|||'
                ) as raw_tags

            FROM recipes R
            JOIN users U ON R.user_id = U.user_id
            
            LEFT JOIN recipe_ingredients RI ON R.recipe_id = RI.recipe_id
            LEFT JOIN ingredients I ON RI.ingredient_id = I.ingredient_id
            
            LEFT JOIN comments C ON R.recipe_id = C.post_id AND C.post_type = 'recipe'
            LEFT JOIN users Commenter ON C.user_id = Commenter.user_id
            
            LEFT JOIN tag_post TP ON R.recipe_id = TP.post_id AND TP.post_type = 'recipe'
            LEFT JOIN tags T ON TP.tag_id = T.tag_id

            WHERE R.status = 'public'
            GROUP BY R.recipe_id, U.full_name, U.avatar 
            ORDER BY R.created_at DESC 
            LIMIT ${parsedLimit}
            `;

            
            const [result] = await pool.execute(sql, [currentUserId, currentUserId]);

            // Dùng hàm parseTagsData để biến raw_tags thành mảng objects
            return result.map(row => {
                const { raw_tags, ...rest } = row;
                return {
                    ...rest,
                    is_liked: !!row.is_liked,
                    is_saved: !!row.is_saved,
                    tags: parseTagsData(raw_tags)
                };
            });

        } catch (err){
            console.log(err.message);
            throw err;
        }
    }

    static async getFeatureRecipes(limit = 10) {
        try {
            const criteria = FEATURE_CRITERIA;

            const sql = `
                SELECT * FROM recipes
                WHERE status = 'public'
                AND like_count >= ?
                AND report_count < ?
                AND rating_avg_score >= ?
                ORDER BY report_count ASC, rating_avg_score DESC, created_at DESC, like_count DESC 
                LIMIT 5;
            `

            const sqlParams = [
                criteria.MIN_LIKES,
                criteria.MAX_REPORTS,
                criteria.MIN_AVG_RATING,
            ];

            const [result] = await pool.execute(sql, sqlParams);
            return result;
        } catch(err) {
            console.log(err.message);
            throw err;
        }
    }

    static async getOwnerRecipe(userId){
        try {
            const sql = `
                SELECT 
                R.*, 
                U.full_name as author_name, 
                U.avatar as author_avatar,
                GROUP_CONCAT(DISTINCT I.name SEPARATOR ',') as ingredient_names,
                
                (EXISTS(SELECT 1 FROM likes WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_liked,
                (EXISTS(SELECT 1 FROM saved_posts WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_saved,

                GROUP_CONCAT(
                    DISTINCT CONCAT(Commenter.full_name, ':::', C.content) 
                    SEPARATOR '|||'
                ) as comment_data,
                
                -- Nối tag_id và name lại với nhau
                GROUP_CONCAT(
                    DISTINCT CONCAT(T.tag_id, ':::', T.name) 
                    SEPARATOR '|||'
                ) as raw_tags

            FROM recipes R
            JOIN users U ON R.user_id = U.user_id
            
            LEFT JOIN recipe_ingredients RI ON R.recipe_id = RI.recipe_id
            LEFT JOIN ingredients I ON RI.ingredient_id = I.ingredient_id
            
            LEFT JOIN comments C ON R.recipe_id = C.post_id AND C.post_type = 'recipe'
            LEFT JOIN users Commenter ON C.user_id = Commenter.user_id
            
            LEFT JOIN tag_post TP ON R.recipe_id = TP.post_id AND TP.post_type = 'recipe'
            LEFT JOIN tags T ON TP.tag_id = T.tag_id

            WHERE R.user_id = ?
            GROUP BY R.recipe_id, U.full_name, U.avatar
            ORDER BY R.created_at DESC 
            `
            const [result] = await pool.execute(sql, [userId, userId, userId]);
            
            return result.map(row => {
                const { raw_tags, ...rest } = row;
                return {
                    ...rest,
                    is_liked: !!row.is_liked,
                    is_saved: !!row.is_saved,
                    tags: parseTagsData(raw_tags)
                };
            });
        } catch (error) {
            console.error('Lỗi Model (getOwnerRecipe):', error);
            throw new Error(`Lấy recipe thất bại: ${error.message}`);
        }
    }

    static async getUserRecipe(userId){
         try {
            const sql = `
                SELECT 
                    R.*,
                    GROUP_CONCAT(
                        DISTINCT CONCAT(T.tag_id, ':::', T.name) 
                        SEPARATOR '|||'
                    ) as raw_tags
                FROM recipes R
                LEFT JOIN tag_post TP ON R.recipe_id = TP.post_id AND TP.post_type = 'recipe'
                LEFT JOIN tags T ON TP.tag_id = T.tag_id
                WHERE R.user_id = ? AND R.status = "public"
                GROUP BY R.recipe_id
                ORDER BY R.created_at DESC
            `
            const [result] = await pool.execute(sql, [userId]);
            
            return result.map(row => {
                const { raw_tags, ...rest } = row;
                return {
                    ...rest,
                    tags: parseTagsData(raw_tags)
                };
            });
        } catch (error) {
            console.error('Lỗi Model (getUserRecipe):', error);
            throw new Error(`Lấy recipe thất bại: ${error.message}`);
        }
    }

    static async getPreviewComments(recipeId) {
        try {
            // Chỉ lấy content và tên user, avatar user
            // Giới hạn LIMIT 2 và sắp xếp mới nhất
            const sql = `
                SELECT 
                    C.content, 
                    C.created_at,
                    U.full_name AS user_name,
                    U.avatar AS user_avatar
                FROM comments C
                JOIN users U ON C.user_id = U.user_id
                WHERE C.post_id = ? 
                  AND C.post_type = 'recipe'
                ORDER BY C.created_at DESC
                LIMIT 2
            `;

            const [comments] = await pool.execute(sql, [recipeId]);
            return comments;
        } catch (error) {
            console.error('Lỗi Model (getPreviewComments):', error);
            throw error;
        }
    }

    static async updateStatus(recipeId, newStatus) {
        try {
            const sql = `
                UPDATE recipes 
                SET status = ?, update_at = NOW() 
                WHERE recipe_id = ?
            `;
            const [result] = await pool.execute(sql, [newStatus, recipeId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Lỗi Model (updateStatus):', error);
            throw error;
        }
    }

    static async getAllRecipesForAdmin(limit, offset, search, sortKey = 'created_at', sortOrder = 'DESC') {
        const allowedSorts = ['title', 'created_at', 'total_calo', 'status'];
        const orderBy = allowedSorts.includes(sortKey) ? `r.${sortKey}` : 'r.created_at';
        const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let query = `
            SELECT r.recipe_id, r.title, r.status, r.created_at, r.total_calo, 
                   u.full_name as author_name 
            FROM recipes r
            JOIN users u ON r.user_id = u.user_id
        `;
        let params = [];

        if (search) {
            query += ` WHERE r.title LIKE ? OR u.full_name LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY ${orderBy} ${orderDir} LIMIT ${parseInt(limit) || 10} OFFSET ${parseInt(offset) || 0}`;

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    static async getRecipeStatusDistribution() {
        const query = `
            SELECT status, COUNT(*) as count 
            FROM recipes 
            GROUP BY status
        `;
        const [rows] = await pool.execute(query);
        return rows;
    }

    // 2. [SỬA LỖI] Đếm tổng số recipe
    static async countAllRecipes(search) {
        let query = `SELECT COUNT(*) as total FROM recipes`;
        let params = [];
        if (search) {
            query += ` WHERE title LIKE ?`;
            params.push(`%${search}%`);
        }
        const [rows] = await pool.execute(query, params); // Sửa db.execute -> pool.execute
        return rows[0].total;
    }


    static async getSavedRecipes(userId, sortKey, sortOrder, limit = 10, page = 1) {
        const offset = (page - 1) * limit;
        
        const sortMapping = {
            'time': 'R.created_at',
            'like': 'R.like_count',
            'rating': 'R.rating_avg_score'
        };

        let orderByClause = 'ORDER BY R.created_at DESC';
        
        if (sortKey && sortMapping[sortKey] && sortOrder) {
            const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
            orderByClause = `ORDER BY ${sortMapping[sortKey]} ${direction}`;
        }

        try {
            const sql = `
                SELECT 
                    R.*, 
                    U.full_name AS author_name, 
                    U.avatar AS author_avatar,
                    (EXISTS(SELECT 1 FROM likes WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_liked,
                    (EXISTS(SELECT 1 FROM saved_posts WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_saved,
                    
                    GROUP_CONCAT(
                        DISTINCT CONCAT(T.tag_id, ':::', T.name) 
                        SEPARATOR '|||'
                    ) as raw_tags
                    
                FROM saved_posts SP
                JOIN recipes R ON SP.post_id = R.recipe_id
                JOIN users U ON R.user_id = U.user_id
                
                LEFT JOIN tag_post TP ON R.recipe_id = TP.post_id AND TP.post_type = 'recipe'
                LEFT JOIN tags T ON TP.tag_id = T.tag_id
                
                WHERE SP.user_id = ? AND SP.post_type = 'recipe'
                GROUP BY R.recipe_id, U.full_name, U.avatar
                ${orderByClause}
                LIMIT ${parseInt(limit) || 10} OFFSET ${parseInt(offset) || 0}
            `;

            const [recipes] = await pool.execute(sql, [userId, userId, userId]);

            const formattedRecipes = recipes.map(row => {
                const { raw_tags, ...rest } = row;
                return {
                    ...rest,
                    is_liked: Boolean(row.is_liked),
                    is_saved: Boolean(row.is_saved),
                    tags: parseTagsData(raw_tags)
                };
            });

            const [countResult] = await pool.execute(
                `SELECT COUNT(*) as total 
                 FROM Saved_Posts SP 
                 JOIN Recipes R ON SP.post_id = R.recipe_id
                 WHERE SP.user_id = ? AND SP.post_type = 'recipe'`,
                [userId]
            );

            return {
                recipes: formattedRecipes,
                total: countResult[0].total
            };
        } catch (error) {
            console.error('Lỗi Model (getSavedRecipes):', error);
            throw error;
        }
    }

    //ADMIN SECTION

    static async getRecipeGrowthStats(days = 30) {
        const query = `
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM recipes 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `;
        const [rows] = await pool.execute(query, [days]);
        return rows;
    }

    static async adminUpdate(recipeId, { status, is_trust }) {
        const updates = [];
        const params = [];

        if (status) {
            updates.push('status = ?');
            params.push(status);
        }

        // Kiểm tra is_trust có tồn tại (0 hoặc 1)
        if (is_trust !== undefined && is_trust !== null) {
            updates.push('is_trusted = ?');
            params.push(is_trust);
        }

        updates.push('update_at = NOW()');

        if (updates.length === 1) return true; // Không có gì update

        const sql = `UPDATE recipes SET ${updates.join(', ')} WHERE recipe_id = ?`;
        params.push(recipeId);

        const [result] = await pool.execute(sql, params);
        return result.affectedRows > 0;
    }
    
}

module.exports = Recipe;