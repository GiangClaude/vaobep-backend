const mysql = require('mysql2/promise'); 

// Cấu hình kết nối database từ biến môi trường
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
    rejectUnauthorized: false
    }
});

const chatbotPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.CHATBOT_DB_USER, 
    password: process.env.CHATBOT_DB_PASSWORD, 
    database: process.env.CHATBOT_DB_NAME,
    port: process.env.DB_PORT, 
    waitForConnections: true,
    connectionLimit: 5, 
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

// Hàm kiểm tra kết nối
async function testDbConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to MySQL database!');
        connection.release(); 
    } catch (error) {
        console.error('Error connecting to MySQL database:', error.message);
        process.exit(1); // Thoát ứng dụng nếu không kết nối được DB
    }
}


module.exports = {
    testDbConnection,
    pool,
    chatbotPool
};