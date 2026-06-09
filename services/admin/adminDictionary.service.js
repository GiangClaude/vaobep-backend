// VỊ TRÍ: backend/services/admin/adminDictionary.service.js
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const DictionaryDishModel = require('../../models/dictionaryDish.model');
const { addVectorSyncJob } = require('../vectorQueue.service');
const AppError = require('../../utils/AppError');

class AdminDictionaryService {
    /**
     * Lấy danh sách từ điển
     */
    async getDictionaryDishes(page, limit, search, sortKey, sortOrder) {
        const offset = (page - 1) * limit;
        const dishes = await DictionaryDishModel.getAll(limit, offset, search, sortKey, sortOrder);
        const total = await DictionaryDishModel.countAll(search);

        return { dishes, total, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Tạo mới món ăn vào từ điển
     */
    async createDictionaryDish(adminId, data, fileInfo) {
        const dishId = uuidv4();
        const { original_name, english_name, description, history, country, latitude, longitude, eateries } = data;

        if (!original_name) throw new AppError('Tên món ăn không được để trống', 400);

        let image_url = null;
        if (fileInfo) {
            image_url = fileInfo.filename;
            const tempPath = fileInfo.path;
            const targetDir = path.join(__dirname, '../../../public/dictionarydish', dishId);
            const targetPath = path.join(targetDir, image_url);
            try {
                // Tạo thư mục nếu chưa có và di chuyển file ảnh
                await fs.mkdir(targetDir, { recursive: true });
                await fs.rename(tempPath, targetPath);
            } catch (fsError) {
                console.warn(`[Cảnh báo] Lỗi di chuyển ảnh từ điển cho dish ${dishId}:`, fsError.message);
            }
        }

        await DictionaryDishModel.createDish({
            dish_id: dishId,
            admin_id: adminId,
            original_name, english_name, description, history, country, image_url,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null
        });

        // Xử lý danh sách quán ăn
        if (eateries) {
            try {
                const parsedEateries = JSON.parse(eateries);
                if (parsedEateries.length > 0) {
                    const eateriesData = parsedEateries.map(e => ({ eatery_id: uuidv4(), name: e.name, address: e.address }));
                    await DictionaryDishModel.addEateries(dishId, eateriesData);
                }
            } catch (err) {
                throw new AppError('Dữ liệu danh sách quán ăn (eateries) không đúng định dạng JSON', 400);
            }
        }

        addVectorSyncJob(dishId, 'dish', 'upsert');
        return dishId;
    }

    /**
     * Cập nhật món ăn
     */
    async updateDictionaryDish(id, data, fileInfo) {
        const { original_name, english_name, description, history, country, latitude, longitude, eateries } = data;

        let updateData = {
            original_name, english_name, description, history, country,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null
        };

        if (fileInfo) updateData.image_url = fileInfo.filename;
        
        // Lọc bỏ các trường undefined
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        await DictionaryDishModel.updateDish(id, updateData);

        if (eateries) {
            try {
                const parsedEateries = JSON.parse(eateries);
                await DictionaryDishModel.deleteEateriesByDishId(id);
                if (parsedEateries.length > 0) {
                    const eateriesData = parsedEateries.map(e => ({ eatery_id: uuidv4(), name: e.name, address: e.address }));
                    await DictionaryDishModel.addEateries(id, eateriesData);
                }
            } catch (err) {
                throw new AppError('Dữ liệu danh sách quán ăn (eateries) không đúng định dạng JSON', 400);
            }
        }

        addVectorSyncJob(id, 'dish', 'upsert');
        return true;
    }

    /**
     * Xóa món ăn
     */
    async deleteDictionaryDish(id) {
        await DictionaryDishModel.deleteDish(id);
        
        const targetDir = path.join(__dirname, '../../../public/dictionarydish', id);
        try {
            await fs.rm(targetDir, { recursive: true, force: true });
        } catch (fsError) {
            console.warn(`[Cảnh báo] Không thể xóa thư mục ảnh từ điển ${id}:`, fsError.message);
        }
        
        addVectorSyncJob(id, 'dish', 'delete');
        return true;
    }
}

module.exports = new AdminDictionaryService();