const InventoryModel = require('../models/inventory.model');

class InventoryService {
    async getMyInventory(userId) {
        return await InventoryModel.getUserInventory(userId);
    }

    async getPublicInventory(userId, itemType) {
        return await InventoryModel.getUserInventory(userId, itemType);
    }
}

module.exports = new InventoryService();