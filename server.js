require('dotenv').config(); 
require('./services/vectorQueue.service');

const express = require('express');
const cors = require('cors');
const db = require('./config/db'); // Import module database
const path = require('path');
const app = express();
const port = process.env.PORT || 5000; // Cổng cho backend
const AppError = require('./utils/AppError');
const errorHandler = require('./middlewares/error.middleware');


const allowedOrigins = [
    'http://localhost:3000',      // Frontend React chạy local
    'http://127.0.0.1:3000',
    'chrome-extension://*'         // Mở cho Extension của trình duyệt (Nếu có ID cụ thể thì điền ID vào)
];

app.use(cors({
    origin: function (origin, callback) {
        // Cho phép các request không có origin (ví dụ: mobile app, postman, curl) hoặc origin hợp lệ
        if (!origin || allowedOrigins.some(o => origin.match(new RegExp(o.replace('*', '.*'))))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true // Cho phép gửi cookie/token
}));

// Sử dụng express.json() để parse body của request dưới dạng JSON
// VỊ TRÍ: backend/server.js (Chỗ cấu hình middleware)
const extensionRoutes = require('./routes/extension.routes');
app.use('/api/extension', express.json({ limit: '10mb' }), extensionRoutes);


app.use(express.json({ limit: '500kb' })); 
app.use(express.urlencoded({ limit: '500kb', extended: true }));

// Cho phép xem file public/user
app.use('/uploads', express.static(path.join(__dirname, 'public/user')));
app.use('/public', express.static(path.join(__dirname, 'public')));

const authRoutes = require('./routes/auth.routes');
const recipeRoutes = require('./routes/recipe.routes');
const articleRoutes = require('./routes/article.routes');
const userRoutes = require('./routes/user.routes');
const ingredientRoutes = require('./routes/ingredients.routes');
const menuRoutes = require('./routes/menu.routes');
const unitRoutes = require('./routes/unit.routes');
const adminRoutes = require('./routes/admin.routes');
const tagRoutes = require('./routes/tag.routes');
const interactionRoutes = require('./routes/interaction.routes');
const dictionaryDishRoutes = require('./routes/dictionaryDish.routes');
// const chatbotRoutes = require('./routes/chatbot.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const rewardRoutes = require('./routes/reward.routes');
const inventoryRoutes = require('./routes/inventory.routes');

const AiRoutes = require('./routes/ai.routes');
// const recipeAiRoutes = require('./routes/recipeAi.routes');
// Kiểm tra kết nối database khi khởi động server
db.testDbConnection();

// Route Xác thực
app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/user', userRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/interaction', interactionRoutes);
app.use('/api/dictionary-dishes', dictionaryDishRoutes);
// Chatbot route
app.use('/api/ai', AiRoutes);

// Function xử lý hiển thị lời chào ở trang gốc của server
app.get('/', (req, res) => {
    res.status(200).json({ message: "Chào mừng bạn đến với Backend VaoBep!" });
});

app.use((req, res, next) => {
    next(new AppError(`Không tìm thấy đường dẫn ${req.originalUrl} trên máy chủ`, 404));
});

app.use(errorHandler);

// Khởi động server
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});