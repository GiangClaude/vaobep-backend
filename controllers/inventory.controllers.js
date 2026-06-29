const InventoryService = require('../services/inventory.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/responseHelper');

const getMyInventory = asyncHandler(async (req, res) => {
    const userId = req.user.user_id; 
    const inventory = await InventoryService.getMyInventory(userId);
    sendResponse(res, 200, true, 'Success', inventory);
});

const getPublicInventory = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const itemType = req.query.type || 'badge';
    const inventory = await InventoryService.getPublicInventory(userId, itemType);
    sendResponse(res, 200, true, 'Success', inventory);
});

module.exports = {
    getMyInventory,
    getPublicInventory
};