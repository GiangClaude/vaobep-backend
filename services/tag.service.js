const TagModel = require('../models/tag.model');

class TagService {
    async getAllTags() {
        return await TagModel.getAll();
    }
}

module.exports = new TagService();