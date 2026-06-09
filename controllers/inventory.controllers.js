const InventoryService = require('../services/inventory.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/responseHelper');

/**
 * Lấy túi đồ của chính mình (Lấy tất cả)
 */
const getMyInventory = asyncHandler(async (req, res) => {
    const userId = req.user.user_id; 
    console.log(`User ${userId} đang lấy túi đồ cá nhân`);

    // Giao phó logic lấy dữ liệu cho Service
    const inventory = await InventoryService.getMyInventory(userId);

    sendResponse(res, 200, true, 'Success', inventory);
});

/**
 * Lấy túi đồ của người khác (Public)
 */
const getPublicInventory = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    // Xử lý giá trị mặc định ở Controller
    const itemType = req.query.type || 'badge';

    const inventory = await InventoryService.getPublicInventory(userId, itemType);

    sendResponse(res, 200, true, 'Success', inventory);
});

module.exports = {
    getMyInventory,
    getPublicInventory
};