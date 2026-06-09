const UnitModel = require('../models/unit.model');

class UnitService {
    async getAllUnits() {
        return await UnitModel.getAllUnits();
    }
}

module.exports = new UnitService();