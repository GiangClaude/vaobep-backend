const TagService = require('../services/tag.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/responseHelper');

const getAllTags = asyncHandler(async (req, res, next) => {
    const tags = await TagService.getAllTags();

    sendResponse(res, 200, true, 'Success', tags);
});

module.exports = {
    getAllTags
};