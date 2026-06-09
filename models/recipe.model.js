const { filter } = require('rxjs');
const db = require('../config/db');
const { buildRecipeQuery } = require('../utils/recipe.utils');
const pool = db.pool;
const { v4: uuidv4 } = require('uuid');

const FEATURE_CRITERIA = {
    MIN_LIKES: 2,
    MAX_REPORTS: 2,
    MIN_AVG_RATING: 4.0,
    TIME_FRAME_DAYS: 7 // 7 ngày gần nhất
};

class Recipe{
    // static async create({
    //     recipeId, 
    //     userId, 
    //     title, 
    //     description, 
    //     instructions,  
    //     coverImage, 
    //     servings, 
    //     cookTime, 
    //     totalCalo,
    //     ingredientsData,
    //     status,
    //     resultImages = [],
    //     tags = []
    // }) {
    //     const connection = await pool.getConnection();

    //     try {
    //         // Bắt đầu Transaction (đảm bảo thêm tất cả hoặc không thêm gì cả)
    //         await connection.beginTransaction();

    //         // --- 1. INSERT vào bảng Recipes ---
    //         const sqlRecipe = `
    //             INSERT INTO Recipes 
    //                 (recipe_id, user_id, title, description, instructions, cover_image, status, servings, cook_time, total_calo)
    //             VALUES 
    //                 (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    //         `;
            
    //         console.log("Model - Ingredients nhận được:", ingredientsData);
    //         await connection.execute(sqlRecipe, [
    //             recipeId,
    //             userId,
    //             title,
    //             description,
    //             instructions,
    //             coverImage,
    //             status || 'draft', // Mặc định là public hoặc lấy từ tham số nếu cần
    //             servings,
    //             cookTime,
    //             totalCalo
    //         ]);

    //         console.log("Xử lý nguyên liệu");
    //         // --- 2. XỬ LÝ NGUYÊN LIỆU (Ingredients & Units) ---
    //         if (ingredientsData && ingredientsData.length > 0) {
    //             // Dùng vòng lặp for...of để xử lý tuần tự (await bên trong loop)
    //             for (const ing of ingredientsData) {
                    
    //                 // A. Xử lý tên Nguyên liệu (Ingredient Name -> ID)
    //                 let ingredientId;
    //                 const [foundIng] = await connection.execute(
    //                     `SELECT ingredient_id FROM Ingredients WHERE name = ?`, 
    //                     [ing.name]
    //                 );
    //                 console.log("Tìm nguyên liệu:", ing.name, foundIng);

    //                 if (foundIng.length > 0) {
    //                     ingredientId = foundIng[0].ingredient_id;
    //                 } else {
    //                     // Nếu chưa có, tạo mới với status pending
    //                     const newIngId = uuidv4()
    //                     await connection.execute(
    //                         `INSERT INTO Ingredients (ingredient_id, name, status) VALUES (?, ?, 'pending')`,
    //                         [newIngId, ing.name]
    //                     );
    //                     ingredientId = newIngId;
    //                 }

    //                 // B. Xử lý Đơn vị (Unit Name -> ID)
    //                 // Frontend gửi ing.unit (string), DB cần unit_id
    //                 let unitId;
    //                 const [foundUnit] = await connection.execute(
    //                     `SELECT unit_id FROM Units WHERE name = ?`,
    //                     [ing.unit]
    //                 );
    //                 console.log("Tìm đơn vị:", ing.unit, foundUnit);

    //                 if (foundUnit.length > 0) {
    //                     unitId = foundUnit[0].unit_id;
    //                 } else {
    //                     // Nếu đơn vị chưa có, tạo mới luôn
    //                     const newUnitId = uuidv4();
    //                     await connection.execute(
    //                         `INSERT INTO Units (unit_id, name) VALUES (?, ?)`,
    //                         [newUnitId, ing.unit]
    //                     );
    //                     unitId = newUnitId;
    //                 }

    //                 console.log("Inserting into recipe_ingredients:", recipeId, ingredientId, ing.amount || ing.quantity, unitId);
    //                 // C. Insert vào bảng liên kết Recipe_Ingredients
    //                 await connection.execute(
    //                     `INSERT INTO Recipe_Ingredients (recipe_id, ingredient_id, quantity, unit_id) VALUES (?, ?, ?, ?)`,
    //                     [recipeId, ingredientId, ing.amount || ing.quantity, unitId] 
    //                     // Lưu ý: Frontend có thể gửi 'amount', DB dùng 'quantity'
    //                 );
    //             }
    //         }

    //         if (tags && tags.length > 0) {
    //             const tagSql = `INSERT INTO tag_post (tag_id, post_id, post_type) VALUES (?, ?, 'recipe')`;
    //             for (const tagId of tags) {
    //                 // tagId ở đây là ID của tag mà user chọn
    //                 await connection.execute(tagSql, [tagId, recipeId]);
    //             }
    //         }

    //         // --- 3. INSERT bảng Recipe_Images ---
    //         // Sửa lại cột imgLink cho đúng với file SQL của bạn
    //         if (resultImages && resultImages.length > 0) {
    //             const imgSql = `
    //                 INSERT INTO Recipe_Images (img_id, recipe_id, imgLink, description) 
    //                 VALUES (?, ?, ?, ?)
    //             `;

    //             for (const img of resultImages) {
    //                 const newImgId = uuidv4();
    //                 await connection.execute(imgSql, [
    //                     newImgId, 
    //                     recipeId, 
    //                     img.url, 
    //                     img.description
    //                 ]);
    //             }
    //         }

    //         // Commit Transaction
    //         await connection.commit();

    //         return {
    //             recipe_id: recipeId,
    //             title: title
    //         };

    //     } catch (err) {
    //         // Nếu có lỗi, rollback toàn bộ thao tác
    //         await connection.rollback();
    //         throw err;
    //     } finally {
    //         connection.release();
    //     }
    // }
    // static async update(recipeId, recipeData, ingredientList, tagList) {
    //     const connection = await pool.getConnection();
    //     let newIngredientsPending = false;
    //     let totalCalo = recipeData.total_calo || 0; // Lấy calo từ input người dùng update

    //     try {
    //         await connection.beginTransaction();

    //         // 1. UPDATE bảng Recipes (Giữ nguyên logic của bạn)
    //         const recipeKeys = Object.keys(recipeData).filter(key => recipeData[key] !== undefined);
    //         if (recipeKeys.length > 0) {
    //             const setClauses = recipeKeys.map(key => `\`${key}\` = ?`);
    //             setClauses.push('update_at = NOW()');
    //             const queryValues = recipeKeys.map(key => recipeData[key]);
    //             queryValues.push(recipeId);

    //             const updateQuery = `UPDATE Recipes SET ${setClauses.join(', ')} WHERE recipe_id = ?`;
    //             await connection.execute(updateQuery, queryValues);
    //         }

    //         // 2. XỬ LÝ NGUYÊN LIỆU (QUAN TRỌNG)
    //         // Xóa nguyên liệu cũ
    //         await connection.execute('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);

    //         if (ingredientList && ingredientList.length > 0) {
    //             const processedIngredients = await Promise.all(ingredientList.map(async (item) => {
    //                 const { name: ingredientName, quantity, unit: unitName } = item; // Lấy unitName thay vì unitId

    //                 // A. Xử lý Ingredients (Tìm hoặc Tạo)
    //                 let ingredientId;
    //                 let ingredientStatus = 'approved';

    //                 let [foundIng] = await connection.execute(
    //                     `SELECT ingredient_id, status FROM Ingredients WHERE name = ?`, 
    //                     [ingredientName]
    //                 );

    //                 if (foundIng.length > 0) {
    //                     ingredientId = foundIng[0].ingredient_id;
    //                     ingredientStatus = foundIng[0].status;
    //                 } else {
    //                     const [newIng] = await connection.execute(
    //                         `INSERT INTO Ingredients (name, status) VALUES (?, 'pending')`,
    //                         [ingredientName]
    //                     );
    //                     // Lấy ID vừa insert (cần check lại hàm insert của bạn trả về gì, thường là insertId với auto_increment hoặc phải query lại nếu dùng UUID)
    //                     // Vì bạn dùng UUID default trong DB, insertId sẽ không hoạt động nếu DB tự sinh UUID.
    //                     // Tốt nhất là generate UUID từ code JS:
    //                     /* const newUuid = uuidv4(); 
    //                     await connection.execute(..., [newUuid, ingredientName]); 
    //                     ingredientId = newUuid; 
    //                     */
    //                 // Để đơn giản và khớp với code cũ của bạn, tôi giả sử bạn query lại:
    //                 const [reQuery] = await connection.execute(`SELECT ingredient_id FROM Ingredients WHERE name = ?`, [ingredientName]);
    //                 ingredientId = reQuery[0].ingredient_id;
    //                 ingredientStatus = 'pending';
    //                 }

    //                 if (ingredientStatus === 'pending') newIngredientsPending = true;

    //                 // B. Xử lý Units (Tìm hoặc Tạo - Logic còn thiếu ở code cũ)
    //                 let unitId;
    //                 const [foundUnit] = await connection.execute(
    //                     `SELECT unit_id FROM Units WHERE name = ?`,
    //                     [unitName]
    //                 );

    //                 if (foundUnit.length > 0) {
    //                     unitId = foundUnit[0].unit_id;
    //                 } else {
    //                     // Tạo mới Unit
    //                     await connection.execute(`INSERT INTO Units (name) VALUES (?)`, [unitName]);
    //                     // Lại query lấy UUID (do DB tự sinh)
    //                     const [reQueryUnit] = await connection.execute(`SELECT unit_id FROM Units WHERE name = ?`, [unitName]);
    //                     unitId = reQueryUnit[0].unit_id;
    //                 }

    //                 return {
    //                     ingredientId,
    //                     quantity,
    //                     unitId
    //                 };
    //             }));

    //             // C. Insert Bulk vào recipe_ingredients
    //             const ingredientPlaceholders = processedIngredients.map(() => '(?, ?, ?, ?)');
    //             const ingredientParams = processedIngredients.flatMap(item => 
    //                 [recipeId, item.ingredientId, item.quantity, item.unitId]
    //             );

    //             if (ingredientPlaceholders.length > 0) {
    //                 const ingredientSql = `
    //                     INSERT INTO recipe_ingredients 
    //                     (recipe_id, ingredient_id, quantity, unit_id) 
    //                     VALUES ${ingredientPlaceholders.join(', ')}
    //                 `;
    //                 await connection.execute(ingredientSql, ingredientParams);
    //             }
    //         }

    //         if (tagList) { // Chỉ xử lý nếu frontend có gửi field tags lên
    //             // B1: Xóa hết các liên kết tag cũ của bài viết này
    //             await connection.execute(
    //                 `DELETE FROM tag_post WHERE post_id = ? AND post_type = 'recipe'`, 
    //                 [recipeId]
    //             );

    //             // B2: Insert lại các tag mới
    //             if (tagList.length > 0) {
    //                 const tagSql = `INSERT INTO tag_post (tag_id, post_id, post_type) VALUES (?, ?, 'recipe')`;
    //                 for (const tagId of tagList) {
    //                      await connection.execute(tagSql, [tagId, recipeId]);
    //                 }
    //             }
    //         }

    //         await connection.commit();

    //         return { 
    //             success: true, 
    //             message: 'Cập nhật công thức thành công!',
    //             notification: newIngredientsPending ? 'Nguyên liệu mới đang chờ duyệt.' : null 
    //         };

    //     } catch (error) {
    //         await connection.rollback();
    //         console.error('Lỗi Model Update:', error);
    //         throw error;
    //     } finally {
    //         if (connection) connection.release();
    //     }
    // }

    // --- BẢN CHUẨN HÓA KHỚP VỚI SERVICE ---

    static async create(connection, {
        recipeId, userId, title, description, instructions, coverImage, 
        servings, cookTime, totalCalo, ingredientsData, status, resultImages = [], tags = []
    }) {
        // Sử dụng connection từ Service truyền vào, nếu không có thì dùng pool tạm (fallback)
        const executor = connection || pool;

        // BỎ beginTransaction ở đây vì Service đã lo việc đó!

        // --- 1. INSERT vào bảng Recipes ---
        const sqlRecipe = `
            INSERT INTO Recipes 
                (recipe_id, user_id, title, description, instructions, cover_image, status, servings, cook_time, total_calo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await executor.execute(sqlRecipe, [
            recipeId, userId, title, description, instructions, coverImage,
            status || 'draft', servings, cookTime, totalCalo
        ]);

        // --- 2. XỬ LÝ NGUYÊN LIỆU (Ingredients & Units) ---
        if (ingredientsData && ingredientsData.length > 0) {
            for (const ing of ingredientsData) {
                // A. Xử lý tên Nguyên liệu
                let ingredientId;
                const [foundIng] = await executor.execute(
                    `SELECT ingredient_id FROM Ingredients WHERE name = ?`, [ing.name]
                );

                if (foundIng.length > 0) {
                    ingredientId = foundIng[0].ingredient_id;
                } else {
                    const newIngId = uuidv4()
                    await executor.execute(
                        `INSERT INTO Ingredients (ingredient_id, name, status) VALUES (?, ?, 'pending')`,
                        [newIngId, ing.name]
                    );
                    ingredientId = newIngId;
                }

                // B. Xử lý Đơn vị
                let unitId;
                const [foundUnit] = await executor.execute(
                    `SELECT unit_id FROM Units WHERE name = ?`, [ing.unit]
                );

                if (foundUnit.length > 0) {
                    unitId = foundUnit[0].unit_id;
                } else {
                    const newUnitId = uuidv4();
                    await executor.execute(
                        `INSERT INTO Units (unit_id, name) VALUES (?, ?)`,
                        [newUnitId, ing.unit]
                    );
                    unitId = newUnitId;
                }

                // C. Insert vào bảng liên kết Recipe_Ingredients
                await executor.execute(
                    `INSERT INTO Recipe_Ingredients (recipe_id, ingredient_id, quantity, unit_id) VALUES (?, ?, ?, ?)`,
                    [recipeId, ingredientId, ing.amount || ing.quantity, unitId] 
                );
            }
        }

        // --- Xử lý Tags ---
        if (tags && tags.length > 0) {
            const tagSql = `INSERT INTO tag_post (tag_id, post_id, post_type) VALUES (?, ?, 'recipe')`;
            for (const tagId of tags) {
                await executor.execute(tagSql, [tagId, recipeId]);
            }
        }

        // --- 3. INSERT bảng Recipe_Images ---
        if (resultImages && resultImages.length > 0) {
            const imgSql = `INSERT INTO Recipe_Images (img_id, recipe_id, imgLink, description) VALUES (?, ?, ?, ?)`;
            for (const img of resultImages) {
                const newImgId = uuidv4();
                await executor.execute(imgSql, [newImgId, recipeId, img.url, img.description]);
            }
        }

        // BỎ commit() và rollback() ở đây, Service sẽ lo!

        return { recipe_id: recipeId, title: title };
    }


    static async update(recipeId, recipeData, ingredientList, tagList, connection) {
        // Nhận connection ở vị trí số 5 từ Service truyền qua
        const executor = connection || pool;
        let newIngredientsPending = false;

        // BỎ beginTransaction()

        // 1. UPDATE bảng Recipes
        const recipeKeys = Object.keys(recipeData).filter(key => recipeData[key] !== undefined);
        if (recipeKeys.length > 0) {
            const setClauses = recipeKeys.map(key => `\`${key}\` = ?`);
            setClauses.push('update_at = NOW()');
            const queryValues = recipeKeys.map(key => recipeData[key]);
            queryValues.push(recipeId);

            const updateQuery = `UPDATE Recipes SET ${setClauses.join(', ')} WHERE recipe_id = ?`;
            await executor.execute(updateQuery, queryValues);
        }

        // 2. XỬ LÝ NGUYÊN LIỆU
        await executor.execute('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);

        if (ingredientList && ingredientList.length > 0) {
            const processedIngredients = await Promise.all(ingredientList.map(async (item) => {
                const { name: ingredientName, quantity, unit: unitName } = item;

                // A. Xử lý Ingredients
                let ingredientId;
                let ingredientStatus = 'approved';

                let [foundIng] = await executor.execute(
                    `SELECT ingredient_id, status FROM Ingredients WHERE name = ?`, [ingredientName]
                );

                if (foundIng.length > 0) {
                    ingredientId = foundIng[0].ingredient_id;
                    ingredientStatus = foundIng[0].status;
                } else {
                    const newIngId = uuidv4();
                    await executor.execute(
                        `INSERT INTO Ingredients (ingredient_id, name, status) VALUES (?, ?, 'pending')`,
                        [newIngId, ingredientName]
                    );
                    ingredientId = newIngId;
                    ingredientStatus = 'pending';
                }

                if (ingredientStatus === 'pending') newIngredientsPending = true;

                // B. Xử lý Units
                let unitId;
                const [foundUnit] = await executor.execute(
                    `SELECT unit_id FROM Units WHERE name = ?`, [unitName]
                );

                if (foundUnit.length > 0) {
                    unitId = foundUnit[0].unit_id;
                } else {
                    const newUnitId = uuidv4();
                    await executor.execute(`INSERT INTO Units (unit_id, name) VALUES (?, ?)`, [newUnitId, unitName]);
                    unitId = newUnitId;
                }

                return { ingredientId, quantity, unitId };
            }));

            // C. Insert Bulk
            const ingredientPlaceholders = processedIngredients.map(() => '(?, ?, ?, ?)');
            const ingredientParams = processedIngredients.flatMap(item => 
                [recipeId, item.ingredientId, item.quantity, item.unitId]
            );

            if (ingredientPlaceholders.length > 0) {
                const ingredientSql = `
                    INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id) 
                    VALUES ${ingredientPlaceholders.join(', ')}
                `;
                await executor.execute(ingredientSql, ingredientParams);
            }
        }

        // 3. XỬ LÝ TAGS
        if (tagList) { 
            await executor.execute(
                `DELETE FROM tag_post WHERE post_id = ? AND post_type = 'recipe'`, [recipeId]
            );

            if (tagList.length > 0) {
                const tagSql = `INSERT INTO tag_post (tag_id, post_id, post_type) VALUES (?, ?, 'recipe')`;
                for (const tagId of tagList) {
                     await executor.execute(tagSql, [tagId, recipeId]);
                }
            }
        }

        // BỎ commit(), rollback() và finally{} ở đây!

        return { 
            success: true, 
            message: 'Cập nhật công thức thành công!',
            notification: newIngredientsPending ? 'Nguyên liệu mới đang chờ duyệt.' : null 
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
                'DELETE FROM Menu_Recipes WHERE recipe_id = ?',
                [recipeId]
            );

            await connection.execute(
                'DELETE FROM Likes WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );

            await connection.execute(
                'DELETE FROM Comments WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );
            await connection.execute(
                'DELETE FROM Ratings WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );
            await connection.execute(
                'DELETE FROM Reports WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );
            await connection.execute(
                'DELETE FROM Saved_Posts WHERE post_id = ? AND post_type = ?',
                [recipeId, postType]
            );

           const [deleteResult] = await connection.execute(
                'DELETE FROM Recipes WHERE recipe_id = ?',
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
                FROM Recipes R
                JOIN Users U ON R.user_id = U.user_id
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
                    RI.quantity, 
                    I.name AS ingredient_name,
                    U.name AS unit_name,
                    U.unit_id
                FROM recipe_ingredients RI
                JOIN Ingredients I ON RI.ingredient_id = I.ingredient_id
                JOIN Units U ON RI.unit_id = U.unit_id
                WHERE RI.recipe_id = ?
            `;
            
            let [ingredientRows] = await pool.execute(ingredientSql, [recipeId]);
            recipe.ingredients = ingredientRows;

            // --- Query 3: Lấy thông tin Tags ---
            const tagSql = `
                SELECT T.tag_id, T.name 
                FROM Tags T
                JOIN tag_post TP ON T.tag_id = TP.tag_id
                WHERE TP.post_id = ? AND TP.post_type = 'recipe'
            `;
            const [tagRows] = await pool.execute(tagSql, [recipeId]);
            recipe.tags = tagRows || [];

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
                FROM Recipes r
                JOIN Users u ON r.user_id = u.user_id
                LEFT JOIN tag_post tp ON r.recipe_id = tp.post_id AND tp.post_type = 'recipe'
                LEFT JOIN Tags t ON tp.tag_id = t.tag_id
                WHERE r.status = 'public' 
                AND (r.title LIKE ? OR u.full_name LIKE ? OR t.name LIKE ?)
                GROUP BY r.recipe_id, u.full_name
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

    static async getRecipes(page, limit, filters = {}, currentUserId = null) {
        const limitNum = parseInt(limit, 10) || 12;
        const pageNum = parseInt(page, 10) || 1;
        const skip = (pageNum - 1) * limitNum;

        const queryParts = buildRecipeQuery(filters);
        const filterParams = queryParts.params || [];

        // 1. SELECT: BỎ "comment_data" đi. Giữ lại ingredient_names để hiện preview
        const selectFragment = `
            SELECT 
                R.*, 
                U.user_id AS author_id,
                U.full_name AS author_name,
                U.avatar AS author_avatar,
                GROUP_CONCAT(DISTINCT I.name SEPARATOR ',') as ingredient_names,
                EXISTS(
                        SELECT 1 FROM Likes L 
                        WHERE L.post_id = R.recipe_id AND L.post_type = 'recipe' AND L.user_id = ?
                    ) as is_liked,

                    -- Kiểm tra đã Save chưa (Trả về 1 hoặc 0)
                EXISTS(
                        SELECT 1 FROM Saved_Posts S 
                        WHERE S.post_id = R.recipe_id AND S.post_type = 'recipe' AND S.user_id = ?
                ) as is_saved
            FROM Recipes AS R
            LEFT JOIN Users AS U ON R.user_id = U.user_id 
        `;

        // 2. JOIN: BỎ "LEFT JOIN Comments" và "LEFT JOIN Users Commenter"
        const dataFetchJoins = `
            LEFT JOIN Recipe_Ingredients RI_Data ON R.recipe_id = RI_Data.recipe_id
            LEFT JOIN Ingredients I ON RI_Data.ingredient_id = I.ingredient_id
        `;

        const allJoins = queryParts.joinClauses.join(' ') + ' ' + dataFetchJoins;
        const whereString = ' WHERE ' + queryParts.whereClauses.join(' AND ');
        
        // 3. GROUP BY: Bỏ U.full_name, U.avatar nếu server không bắt lỗi strict, 
        // nhưng cứ để cho an toàn. Bỏ các trường comment.
        const groupByString = ' GROUP BY R.recipe_id, U.full_name, U.avatar ';
        const orderLimitOffset = ' ORDER BY R.created_at DESC LIMIT ? OFFSET ?';

        try {
            // --- COUNT ---
            const countFragment = 'SELECT COUNT(DISTINCT R.recipe_id) AS total FROM Recipes AS R ';
            const [countResult] = await pool.query(
                countFragment + queryParts.joinClauses.join(' ') + whereString,
                filterParams
            );
            const totalItems = Number(countResult[0]?.total || 0);

            // --- DATA ---
            const finalQuery = selectFragment + allJoins + whereString + groupByString + orderLimitOffset;
            const finalParams = [currentUserId, currentUserId, ...filterParams, limitNum, skip];
            
            const [result] = await pool.query(finalQuery, finalParams);
            // console.log("Debug getRecipes - Raw Result:", result);
            const formattedResult = result.map(row => ({
                    ...row,
                    is_liked: !!row.is_liked,
                    is_saved: !!row.is_saved
                }));

            // console.log("Debug getRecipes - Formatted Result:", formattedResult);
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
            const sql = `
            SELECT 
                R.*, 
                U.full_name as author_name, 
                U.avatar as author_avatar,
                GROUP_CONCAT(DISTINCT I.name SEPARATOR ',') as ingredient_names,
                
                (EXISTS(SELECT 1 FROM Likes WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_liked,
                (EXISTS(SELECT 1 FROM Saved_Posts WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_saved,

                GROUP_CONCAT(
                    DISTINCT CONCAT(Commenter.full_name, ':::', C.content) 
                    SEPARATOR '|||'
                ) as comment_data

            FROM Recipes R
            JOIN Users U ON R.user_id = U.user_id
            
            -- Join Ingredients (Giữ nguyên)
            LEFT JOIN recipe_ingredients RI ON R.recipe_id = RI.recipe_id
            LEFT JOIN Ingredients I ON RI.ingredient_id = I.ingredient_id
            
            -- Join Comments (MỚI)
            -- Lưu ý điều kiện post_type = 'recipe'
            LEFT JOIN Comments C ON R.recipe_id = C.post_id AND C.post_type = 'recipe'
            -- Join User lần 2 (đặt tên là Commenter) để lấy tên người bình luận
            LEFT JOIN Users Commenter ON C.user_id = Commenter.user_id

            WHERE R.status = 'public'
            GROUP BY R.recipe_id
            ORDER BY R.created_at DESC 
            LIMIT ?
            `;

            const sqlParams = [limit.toString()];
            
            const [result] = await pool.execute(sql, [currentUserId, currentUserId, ...sqlParams]);

            return result.map(row => ({
                ...row,
                is_liked: !!row.is_liked,
                is_saved: !!row.is_saved
            }));

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
                
                (EXISTS(SELECT 1 FROM Likes WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_liked,
                (EXISTS(SELECT 1 FROM Saved_Posts WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_saved,

                GROUP_CONCAT(
                    DISTINCT CONCAT(Commenter.full_name, ':::', C.content) 
                    SEPARATOR '|||'
                ) as comment_data

            FROM Recipes R
            JOIN Users U ON R.user_id = U.user_id
            
            -- Join Ingredients (Giữ nguyên)
            LEFT JOIN recipe_ingredients RI ON R.recipe_id = RI.recipe_id
            LEFT JOIN Ingredients I ON RI.ingredient_id = I.ingredient_id
            
            -- Join Comments (MỚI)
            -- Lưu ý điều kiện post_type = 'recipe'
            LEFT JOIN Comments C ON R.recipe_id = C.post_id AND C.post_type = 'recipe'
            -- Join User lần 2 (đặt tên là Commenter) để lấy tên người bình luận
            LEFT JOIN Users Commenter ON C.user_id = Commenter.user_id

            WHERE R.status = 'public' and R.user_id = ?
            GROUP BY R.recipe_id
            ORDER BY R.created_at DESC 
            `
            const [result] = await pool.execute(sql, [userId, userId, userId]);
            return result;
        } catch (error) {
            console.error('Lỗi Model (getOwnerRecipe):', error);
            throw new Error(`Lấy recipe thất bại: ${error.message}`);
        }
    }

    static async getUserRecipe(userId){
         try {
            const sql = `
                SELECT * FROM recipes
                WHERE user_id = ? AND status = "public"
            `
            const [result] = await pool.execute(sql, [userId]);
            return result;
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
                FROM Comments C
                JOIN Users U ON C.user_id = U.user_id
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
                UPDATE Recipes 
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
            FROM Recipes r
            JOIN Users u ON r.user_id = u.user_id
        `;
        let params = [];

        if (search) {
            query += ` WHERE r.title LIKE ? OR u.full_name LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`;
        console.log("Admin Query:", query);
        params.push(limit.toString(), offset.toString());

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    static async getRecipeStatusDistribution() {
        const query = `
            SELECT status, COUNT(*) as count 
            FROM Recipes 
            GROUP BY status
        `;
        const [rows] = await pool.execute(query);
        return rows;
    }

    // 2. [SỬA LỖI] Đếm tổng số recipe
    static async countAllRecipes(search) {
        let query = `SELECT COUNT(*) as total FROM Recipes`;
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
        
        // Mapping sortKey sang tên cột trong DB
        const sortMapping = {
            'time': 'R.created_at',
            'like': 'R.like_count',
            'rating': 'R.rating_avg_score'
        };

        // Mặc định sắp xếp theo thời gian tạo giảm dần nếu không chọn gì
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
                    (EXISTS(SELECT 1 FROM Likes WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_liked,
                (EXISTS(SELECT 1 FROM Saved_Posts WHERE post_id = R.recipe_id AND post_type = 'recipe' AND user_id = ?)) as is_saved
                FROM Saved_Posts SP
                JOIN Recipes R ON SP.post_id = R.recipe_id
                JOIN Users U ON R.user_id = U.user_id
                WHERE SP.user_id = ? AND SP.post_type = 'recipe'
                ${orderByClause}
                LIMIT ? OFFSET ?
            `;

            const [recipes] = await pool.execute(sql, [userId, userId, userId, limit.toString(), offset.toString()]);

            const formattedRecipes = recipes.map(row => ({
                ...row,
                is_liked: Boolean(row.is_liked), // Hoặc !!row.is_liked
                is_saved: Boolean(row.is_saved)
            }));

            // Đếm tổng số lượng để phân trang
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

    static async getRecipeGrowthStats(days = 30) {
        const query = `
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM Recipes 
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

        const sql = `UPDATE Recipes SET ${updates.join(', ')} WHERE recipe_id = ?`;
        params.push(recipeId);

        const [result] = await pool.execute(sql, params);
        return result.affectedRows > 0;
    }
    
}

module.exports = Recipe;