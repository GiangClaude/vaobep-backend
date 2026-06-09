// backend/utils/responseHelper.js
const sendResponse = (res, statusCode, success, message, data = null, meta = null) => {
    const responsePayload = {
        success,
        message: message || (success ? 'Operation successful' : 'Operation failed')
    };

    if (data !== null) responsePayload.data = data;
    if (meta !== null) responsePayload.meta = meta;

    return res.status(statusCode).json(responsePayload);
};
// {
//   "success": true,               // Bắt buộc: true | false
//   "message": "Thành công",       // Tùy chọn: Chuỗi thông báo
//   "data": { ... } | [ ... ],     // Bắt buộc nếu có dữ liệu (có thể là null)
//   "meta": {                      // Tùy chọn: Dành cho phân trang (pagination)
//      "page": 1,
//      "limit": 10,
//      "totalItems": 50,
//      "totalPages": 5
//   }
// }
module.exports = { sendResponse };