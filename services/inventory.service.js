const InventoryModel = require('../models/inventory.model');

class InventoryService {
    async getMyInventory(userId) {
        // Không truyền tham số thứ 2 -> lấy tất cả các loại item
        return await InventoryModel.getUserInventory(userId);
    }

    async getPublicInventory(userId, itemType) {
        return await InventoryModel.getUserInventory(userId, itemType);
    }
}

module.exports = new InventoryService();