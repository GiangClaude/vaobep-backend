const mysql = require('mysql2/promise'); // Sử dụng phiên bản promise-based

// Cấu hình kết nối database từ biến môi trường
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const chatbotPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.CHATBOT_DB_USER, // <-- Lấy đúng user bot
    password: process.env.CHATBOT_DB_PASSWORD, // <-- Lấy đúng pass bot
    database: process.env.CHATBOT_DB_NAME
});

// Hàm kiểm tra kết nối
async function testDbConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to MySQL database!');
        connection.release(); // Trả lại kết nối vào pool
    } catch (error) {
        console.error('Error connecting to MySQL database:', error.message);
        process.exit(1); // Thoát ứng dụng nếu không kết nối được DB
    }
}

// Các hàm CRUD cơ bản (ví dụ cho một bảng 'users')
async function getAllUsers() {
    const [rows] = await pool.execute('SELECT * FROM users');
    return rows;
}

async function getUserById(id) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0]; // Trả về user đầu tiên hoặc undefined nếu không tìm thấy
}

async function createUser(name, email) {
    const [result] = await pool.execute('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
    return result.insertId; // Trả về ID của bản ghi mới được tạo
}

async function updateUser(id, name, email) {
    const [result] = await pool.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, id]);
    return result.affectedRows; // Trả về số lượng hàng bị ảnh hưởng
}

async function deleteUser(id) {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows;
}

module.exports = {
    testDbConnection,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    // Bạn có thể export pool trực tiếp nếu muốn thực hiện các query phức tạp hơn
    pool,
    chatbotPool
};