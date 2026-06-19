# Function: Khai báo môi trường Node.js phiên bản 20 (bản Alpine siêu nhẹ) làm nền tảng
FROM node:20-alpine

# Function: Thiết lập thư mục làm việc mặc định bên trong máy chủ ảo là /app
WORKDIR /app

# Function: Copy các file định nghĩa thư viện từ máy bà vào máy chủ trước để tối ưu tốc độ build
COPY package*.json ./

# Function: Chạy lệnh cài đặt toàn bộ thư viện cần thiết (như express, mysql2, cors...)
RUN npm install

# Function: Copy toàn bộ mã nguồn còn lại của hệ thống bách khoa toàn thư món ăn vào máy chủ
COPY . .

# Function: Cố định cổng mạng là 8080 để khớp hoàn toàn với yêu cầu của Google Cloud Run
ENV PORT=8080
EXPOSE 8080

# Function: Thực thi lệnh khởi động server (tương đương lệnh "node server.js" trong package.json)
CMD ["npm", "start"]