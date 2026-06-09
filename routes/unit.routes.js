const express = require('express');
const unitController = require('../controllers/unit.controllers');
const router = express.Router();

router.get('/', unitController.getAllUnits);
module.exports = router;