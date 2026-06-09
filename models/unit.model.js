const db = require('../config/db');
const pool = db.pool;

class Unit {
    static async getAllUnits() {
        const [rows] = await pool.execute('SELECT * FROM Units');
        return rows;
    }
}

module.exports = Unit;