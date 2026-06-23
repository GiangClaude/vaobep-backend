const db = require('../config/db');
const pool = db.pool;
const { v4: uuidv4 } = require('uuid');

class Unit {
    static async getAllUnits() {
        const [rows] = await pool.execute('SELECT * FROM units');
        return rows;
    }

    static async findOrCreate(name, connection) {
        const executor = connection || pool;
        
        const [foundUnit] = await executor.execute(
            `SELECT unit_id FROM units WHERE name = ?`, 
            [name]
        );

        if (foundUnit.length > 0) {
            return foundUnit[0].unit_id;
        } else {
            const newId = uuidv4();
            await executor.execute(
                `INSERT INTO units (unit_id, name) VALUES (?, ?)`,
                [newId, name]
            );
            return newId;
        }
    }
}

module.exports = Unit;