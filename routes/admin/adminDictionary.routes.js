const express = require('express');
const router = express.Router();
const adminDictionaryController = require('../../controllers/admin/adminDictionary.controller');
const { verifyAdminMiddleware } = require('../../utils/auth.utils');
const { uploadDictionary } = require('../../config/multer.config');

router.use(verifyAdminMiddleware);

router.get('/', adminDictionaryController.getDictionaryDishes);
router.post('/', uploadDictionary.single('image_url'), adminDictionaryController.createDictionaryDish);
router.put('/:id', uploadDictionary.single('image_url'), adminDictionaryController.updateDictionaryDish);
router.delete('/:id', adminDictionaryController.deleteDictionaryDish);

module.exports = router;
