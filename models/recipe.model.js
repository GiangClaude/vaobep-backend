const { filter } = require('rxjs');
const db = require('../config/db');
const pool = db.pool;
const { v4: uuidv4 } = require('uuid');
const {parseTagsData} = require('../utils/helper.utils')
const { buildRecipeQuery } = require('../utils/recipe.utils');
const FEATURE_CRITERIA = {
    MIN_LIKES: 2,
    MAX_REPORTS: 2,
    MIN_AVG_RATING: 4.0,
    TIME_FRAME_DAYS: 7 // 7 ngày gần nhất
};
const { DEFAULT_RECIPE_IMG } = require('../config/constants');
class Recipe{
    static async create(connection, {
        recipeId, userId, title, description, instructions, coverImage, 
        servings, cookTime, totalCalo, ingredientsData, status, resultImages = []
    }) {
        const executor = connection || pool;

        if (!coverImage || String(coverImage).trim() === '') {
            coverImage = DEFAULT_RECIPE_IMG;
        }

        const sqlRecipe = `
            INSERT INTO recipes 
                (recipe_id, user_id, title, description, instructions, cover_image, status, servings, cook_time, total_calo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await executor.execute(sqlRecipe, [
            recipeId, userId, title, description, instructions, coverImage,
            status || 'draft', servings, cookTime, totalCalo
        ]);

        if (ingredientsData && ingredientsData.length > 0) {
            for (const ing of ingredientsData) {
                await executor.execute(
                    `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id) VALUES (?, ?, ?, ?)`,
                    [recipeId, ing.ingredientId, ing.quantity, ing.unitId] 
                );
            }
        }

        if (resultImages && resultImages.length > 0) {
            const imgSql = `INSERT INTO recipe_images (img_id, recipe_id, imgLink, description) VALUES (?, ?, ?, ?)`;
            for (const img of resultImages) {
                const newImgId = uuidv4();
                await executor.execute(imgSql, [newImgId, recipeId, img.url, img.description]);
            }
        }


        return { recipe_id: recipeId, title: title };
    }
    static async update(recipeId, recipeData, ingredientList, connection) {
        const executor = connection || pool;

        const imgKey = recipeData.hasOwnProperty('cover_image') ? 'cover_image' : 
                       recipeData.hasOwnProperty('coverImage') ? 'coverImage' : null;

        if (imgKey) {
            if (!recipeData[imgKey] || String(recipeData[imgKey]).trim() === '') {
                recipeData[imgKey] = DEFAULT_RECIPE_IMG;
            }
        }

        const resultImagesToSave = recipeData.resultImages;
        delete recipeData.resultImages; 

        const recipeKeys = Object.keys(recipeData).filter(key => recipeData[key] !== undefined);
        if (recipeKeys.length > 0) {
            const setClauses = recipeKeys.map(key => `\`${key}\` = ?`);
            setClauses.push('update_at = NOW()');
            const queryValues = recipeKeys.map(key => recipeData[key]);
            queryValues.push(recipeId);

            const updateQuery = `UPDATE recipes SET ${setClauses.join(', ')} WHERE recipe_id = ?`;
            await executor.execute(updateQuery, queryValues);
        }

        await executor.execute('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);

        if (ingredientList && ingredientList.length > 0) {
            const ingredientPlaceholders = ingredientList.map(() => '(?, ?, ?, ?)');
            const ingredientParams = ingredientList.flatMap(item => 
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

        if (resultImagesToSave) {
            await executor.execute('DELETE FROM recipe_images WHERE recipe_id = ?', [recipeId]);
            if (resultImagesToSave.length > 0) {
                const imgSql = `INSERT INTO recipe_images (img_id, recipe_id, imgLink, description) VALUES (?, ?, ?, ?)`;
                for (const img of resultImagesToSave) {
                    await executor.execute(imgSql, [uuidv4(), recipeId, img.url, img.description]);
                }
            }
        }

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
    static async findById(recipeId) {
        if (!recipeId) {
            return null;
        }

        try {
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
            
            let [recipeRows] = await pool.execute(recipeSql, [recipeId]);

            if (recipeRows.length === 0) {
                return null; 
            }
            const recipe = recipeRows[0];

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

    static async searchSimpleRecipes(keyword) {
        try {
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

    static async getRecipes(page, limit, filters = {}, currentUserId = null) {
        const limitNum = parseInt(limit, 10) || 12;
        const pageNum = parseInt(page, 10) || 1;    
        const skip = (pageNum - 1) * limitNum;      

        const queryParts = buildRecipeQuery(filters);
        const filterParams = queryParts.params || [];

        let tagCount = 0;
        if (filters.tags) {
            if (Array.isArray(filters.tags)) {
                tagCount = filters.tags.length;
            } else if (typeof filters.tags === 'string' && filters.tags.trim() !== '') {
                tagCount = filters.tags.split(',').filter(Boolean).length;
            }
        }

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

        const dataFetchJoins = `
            LEFT JOIN recipe_ingredients RI_Data ON R.recipe_id = RI_Data.recipe_id
            LEFT JOIN ingredients I ON RI_Data.ingredient_id = I.ingredient_id
            
            -- Thực hiện liên kết lấy dữ liệu tags độc lập hoàn toàn với việc lọc
            LEFT JOIN tag_post TP_out ON R.recipe_id = TP_out.post_id AND TP_out.post_type = 'recipe'
            LEFT JOIN tags T_out ON TP_out.tag_id = T_out.tag_id
        `;

        const allJoins = queryParts.joinClauses.join(' ') + ' ' + dataFetchJoins;
        const whereString = ' WHERE ' + queryParts.whereClauses.join(' AND ');
        const groupByString = ' GROUP BY R.recipe_id, U.user_id, U.full_name, U.avatar ';
        
        let havingString = '';
        if (tagCount > 0) {
            havingString = ' HAVING COUNT(DISTINCT TP.tag_id) = ? ';
        }

        const orderLimitOffset = ` ORDER BY R.created_at DESC LIMIT ${limitNum} OFFSET ${skip}`;

        try {
            let countQuery = '';
            let countParams = [...filterParams];

            if (tagCount > 0) {
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

            const finalQuery = selectFragment + allJoins + whereString + groupByString + havingString + orderLimitOffset;
            
            const finalParams = [currentUserId, currentUserId, ...filterParams];
            if (tagCount > 0) {
                finalParams.push(tagCount);
            }
            
            const [result] = await pool.query(finalQuery, finalParams);
            
            const formattedResult = result.map(row => {
                const { raw_tags, ...rest } = row;
                return {
                    ...rest,
                    is_liked: !!row.is_liked,
                    is_saved: !!row.is_saved,
                    tags: parseTagsData(raw_tags)
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

    static async countAllRecipes(search) {
        let query = `SELECT COUNT(*) as total FROM recipes`;
        let params = [];
        if (search) {
            query += ` WHERE title LIKE ?`;
            params.push(`%${search}%`);
        }
        const [rows] = await pool.execute(query, params); 
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

        if (is_trust !== undefined && is_trust !== null) {
            updates.push('is_trusted = ?');
            params.push(is_trust);
        }

        updates.push('update_at = NOW()');

        if (updates.length === 1) return true; 

        const sql = `UPDATE recipes SET ${updates.join(', ')} WHERE recipe_id = ?`;
        params.push(recipeId);

        const [result] = await pool.execute(sql, params);
        return result.affectedRows > 0;
    }
    
}

module.exports = Recipe;