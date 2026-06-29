const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const DictionaryDishModel = require('../../models/dictionaryDish.model');
const { addVectorSyncJob } = require('../vectorQueue.service');
const AppError = require('../../utils/AppError');

const { deleteCloudinaryImage } = require('../../utils/cloudinary');
const { DEFAULT_DISH_IMG } = require('../../config/constants');

const generateRandomCoordinates = (baseLat, baseLng, offsetRange = 0.5) => {
    const latOffset = (Math.random() - 0.5) * 2 * offsetRange;
    const lngOffset = (Math.random() - 0.5) * 2 * offsetRange;
    
    return {
        lat: parseFloat((baseLat + latOffset).toFixed(6)),
        lng: parseFloat((baseLng + lngOffset).toFixed(6))
    };
};
class AdminDictionaryService {
    async getDictionaryDishes(page, limit, search, sortKey, sortOrder) {
        const offset = (page - 1) * limit;
        const dishes = await DictionaryDishModel.getAll(limit, offset, search, sortKey, sortOrder);
        const total = await DictionaryDishModel.countAll(search);

        return { dishes, total, totalPages: Math.ceil(total / limit) };
    }

    async createDictionaryDish(adminId, data, fileInfo) {
        const dishId = uuidv4();
        const { original_name, english_name, description, history, country, latitude, longitude, eateries } = data;

        if (!original_name) throw new AppError('Tên món ăn không được để trống', 400);

        let image_url = null;
        if (fileInfo) {
            image_url = fileInfo.path; 
        }

        let finalLat = latitude ? parseFloat(latitude) : null;
        let finalLng = longitude ? parseFloat(longitude) : null;

        if ((!finalLat || !finalLng) && country) {
            const countryCoords = await DictionaryDishModel.getCountryCoordinates(country);
            if (countryCoords && countryCoords.lat && countryCoords.lng) {
                const randomCoords = generateRandomCoordinates(countryCoords.lat, countryCoords.lng, 0.5);
                finalLat = randomCoords.lat;
                finalLng = randomCoords.lng;
            }
        }

        await DictionaryDishModel.createDish({
            dish_id: dishId,
            admin_id: adminId,
            original_name, english_name, description, history, country, image_url,
            latitude: finalLat,
            longitude: finalLng
        });

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

    async updateDictionaryDish(id, data, fileInfo) {
        const { original_name, english_name, description, history, country, latitude, longitude, eateries, image_url } = data;

          let finalLat = latitude ? parseFloat(latitude) : null;
        let finalLng = longitude ? parseFloat(longitude) : null;

        if ((!finalLat || !finalLng) && country && country !== oldDish.country) {
             const countryCoords = await DictionaryDishModel.getCountryCoordinates(country);
             if (countryCoords && countryCoords.lat && countryCoords.lng) {
                 const randomCoords = generateRandomCoordinates(countryCoords.lat, countryCoords.lng, 0.5);
                 finalLat = randomCoords.lat;
                 finalLng = randomCoords.lng;
             }
        } else if (!finalLat || !finalLng) {
            finalLat = oldDish.latitude;
            finalLng = oldDish.longitude;
        }

        let updateData = {
            original_name, english_name, description, history, country,
            latitude: finalLat,
            longitude: finalLng
        };

        const oldDish = await DictionaryDishModel.getById(id);
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

    async deleteDictionaryDish(id) {
        const oldDish = await DictionaryDishModel.getById(id);

        await DictionaryDishModel.deleteDish(id);
        
        if (oldDish && oldDish.image_url && oldDish.image_url !== DEFAULT_DISH_IMG) {
            deleteCloudinaryImage(oldDish.image_url);
        }
        
        addVectorSyncJob(id, 'dish', 'delete');
        return true;
    }

    async getCountries() {
        return await DictionaryDishModel.getAllCountries();
    }
}

module.exports = new AdminDictionaryService();