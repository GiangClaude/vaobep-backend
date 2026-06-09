class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Cờ đánh dấu các lỗi do logic (không phải lỗi crash server)

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;