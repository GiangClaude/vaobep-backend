
🚀 Hướng dẫn cài đặt (Getting Started)

1. Yêu cầu hệ thống

  - Node.js >= 18.x (Khuyến nghị v20)
  - MySQL >= 8.0
  - Redis Server (Đang chạy ở cổng 6379)

2. Cài đặt chi tiết

Bước 1: Clone kho lưu trữ

git clone <your-repo-url>
cd giangclaude-vaobep-backend

Bước 2: Cài đặt các thư viện (Dependencies)

npm install

Bước 3: Cấu hình biến môi trường (Environment Variables) Tạo file .env từ file
.env.example và điền các thông tin cần thiết:

cp .env.example .env

Bước 4: Khởi chạy server

# Chạy ở môi trường phát triển (Tự động reload bằng nodemon)
npm run dev

# Chạy ở môi trường Production
npm start

Server sẽ chạy mặc định tại: http://localhost:5000

⚙️ Biến môi trường (.env)

Dưới đây là các biến môi trường quan trọng cần cấu hình:

| Biến                                             | Chức năng                                 | Ví dụ                                  |
| :----------------------------------------------- | :---------------------------------------- | :------------------------------------- |
| `PORT`                                           | Cổng chạy server                          | `5000`                                 |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`   | Kết nối CSDL MySQL chính                  | `localhost`, `root`, `...`, `VaoBep`   |
| `CHATBOT_DB_USER`, `CHATBOT_DB_PASSWORD`         | Tài khoản MySQL read-only cho AI sinh SQL | `vaobep_ai_bot`, `toilabot`            |
| `REDIS_URL`                                      | Kết nối Redis cache                       | `redis://localhost:6379`               |
| `JWT_SECRET`                                     | Chữ ký mã hóa Token                       | `your_secret_key`                      |
| `GOOGLE_API_KEY`                                 | Khóa API của Google Gemini                | `AIzaSy...`                            |
| `PINECONE_API_KEY`, `PINECONE_HOST`              | Kết nối Vector DB                         | `pc-api-key`, `...pinecone.io`         |
| `CLOUDINARY_CLOUD_NAME`, `API_KEY`, `API_SECRET` | Cấu hình lưu trữ ảnh Cloudinary           | \-                                     |
| `EMAIL_USER`, `EMAIL_PASS`                       | Tài khoản gửi Email (Nodemailer)          | `your_email@gmail.com`, `App Password` |
