const MenuService = require('../services/menu.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/responseHelper');

const createMenu = asyncHandler(async (req, res) => {
    const userId = req.user?.user_id; 
    const menuData = req.body;

    const newMenu = await MenuService.createMenu(userId, menuData);

    sendResponse(res, 201, true, 'Tạo thực đơn thành công!', newMenu);
});

const getUserMenus = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const menus = await MenuService.getUserMenus(userId);

    sendResponse(res, 200, true, 'Lấy danh sách thực đơn thành công', menus);
});

const getMenuById = asyncHandler(async (req, res) => {
    const { menuId } = req.params;
    const menu = await MenuService.getMenuById(menuId);

    sendResponse(res, 200, true, 'Success', menu);
});

const updateMenu = asyncHandler(async (req, res) => {
    const { menuId } = req.params;
    const userId = req.user.user_id;
    const menuData = req.body;

    await MenuService.updateMenu(menuId, userId, menuData);

    sendResponse(res, 200, true, 'Cập nhật thực đơn thành công!');
});

const deleteMenu = asyncHandler(async (req, res) => {
    const { menuId } = req.params;
    const userId = req.user.user_id;

    await MenuService.deleteMenu(menuId, userId);

    sendResponse(res, 200, true, 'Đã xóa thực đơn!');
});

const getShoppingList = asyncHandler(async (req, res) => {
    const { menuId } = req.params;
    const list = await MenuService.getShoppingList(menuId);

    sendResponse(res, 200, true, 'Success', list);
});

const getPublicMenus = asyncHandler(async (req, res) => {
    const menus = await MenuService.getPublicMenus();
    sendResponse(res, 200, true, 'Success', menus);
});

const cloneMenu = asyncHandler(async (req, res) => {
    const { menuId } = req.params;
    const userId = req.user.user_id;

    const clonedMenu = await MenuService.cloneMenu(menuId, userId);

    sendResponse(res, 201, true, 'Nhân bản thực đơn thành công!', clonedMenu);
});

const getPublicMenusByUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const menus = await MenuService.getPublicMenusByUser(userId);
    sendResponse(res, 200, true, 'Success', menus);
});

const consultMenuAI = asyncHandler(async (req, res) => {
    const aiResponseText = await MenuService.consultMenuAI(req.body);
    sendResponse(res, 200, true, 'Success', aiResponseText);
});

const generateMenuAI = asyncHandler(async (req, res) => {
    const { prompt } = req.body;
    const daysData = await MenuService.generateMenuAI(prompt);
    sendResponse(res, 200, true, 'Success', daysData);
});

module.exports = {
    createMenu, getUserMenus, getMenuById, updateMenu, deleteMenu,
    getShoppingList, getPublicMenus, cloneMenu, getPublicMenusByUser,
    consultMenuAI, generateMenuAI
};