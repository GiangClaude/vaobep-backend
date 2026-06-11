// VỊ TRÍ: backend/services/admin/adminDictionary.service.js
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const DictionaryDishModel = require('../../models/dictionaryDish.model');
const { addVectorSyncJob } = require('../vectorQueue.service');
const AppError = require('../../utils/AppError');

const { deleteCloudinaryImage } = require('../../utils/cloudinary');
const { DEFAULT_DISH_IMG } = require('../../config/constants');

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
            // Cloudinary trả về link nằm ở .path, không cần fs.mkdir hay fs.rename nữa!
            image_url = fileInfo.path; 
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
        const { original_name, english_name, description, history, country, latitude, longitude, eateries, image_url } = data;

        let updateData = {
            original_name, english_name, description, history, country,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null
        };

        const oldDish = await DictionaryDishModel.findById(id);
        if (image_url === "") {
            updateData.image_url = "";
            if (oldDish && oldDish.image_url && oldDish.image_url !== DEFAULT_DISH_IMG) {
                deleteCloudinaryImage(oldDish.image_url);
            }
        }

         if (fileInfo) {
            if (oldDish && oldDish.image_url && oldDish.image_url !== DEFAULT_DISH_IMG) {
                deleteCloudinaryImage(oldDish.image_url);
            }
            updateData.image_url = fileInfo.path;
        }
        
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
        const oldDish = await DictionaryDishModel.findById(id);

        await DictionaryDishModel.deleteDish(id);
        
        if (oldDish && oldDish.image_url && oldDish.image_url !== DEFAULT_DISH_IMG) {
            deleteCloudinaryImage(oldDish.image_url);
        }
        
        addVectorSyncJob(id, 'dish', 'delete');
        return true;
    }
}

module.exports = new AdminDictionaryService();