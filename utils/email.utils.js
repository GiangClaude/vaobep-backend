const nodemailer = require('nodemailer')

//Tạo hàm test
const createTestTransporter = async () => {
    const testAccount = await nodemailer.createTestAccount();

    return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: testAccount.user, // Tên user Ethereal
            pass: testAccount.pass, // Mật khẩu Ethereal
        },
        tls: {
            rejectUnauthorized: false 
        }
    });
};

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true cho port 465

    tls: {
        rejectUnauthorized: false
    },
    
    auth: {
        user: process.env.EMAIL_USER, // Gmail của bạn
        pass: process.env.EMAIL_PASS, // Mật khẩu ứng dụng 16 ký tự
    },
})

// Hàm gửi mail
const sendEmail = async(toEmail, subject, htmlContent) => {
    try {

        const info = await transporter.sendMail({
            from: '"Vao Bep" <no-reply@vaobep.com>',
            to: toEmail,
            subject: subject,
            html: htmlContent
        })

        console.log('Message sent: %s', info.messageId);

        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

        return {
            success: true,
            // url: nodemailer.getTestMessageUrl(info)
        }
    } catch (error) {
        console.error('Error sending email: ', error);
        return {success: false};
    }
};

const sendVerificationEmail = (toEmail, otp) => {
    const subject = "MÃ XÁC THỰC TÀI KHOẢN VÀO BẾP";
    const html = `
        <p> Cảm ơn bạn đã đăng ký </p>
        <p>Mã OTP của bạn là: <b>${otp}</b></p>
        <p>Mã này sẽ hết hạn sau 10 phút. 
        Vui lòng không chia sẻ otp với bất kỳ ai</p>
    `;
    return sendEmail(toEmail, subject, html);
};

// Hàm gửi email cho Quên mật khẩu (Template mới)
const sendPasswordResetEmail = (toEmail, otp) => {
    const subject = "YÊU CẦU ĐẶT LẠI MẬT KHẨU VÀO BẾP";
    const html = `
        <h3>Chào bạn,</h3>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
        <p>Mã OTP để xác thực là: <b>${otp}</b></p>
        <p>Mã này sẽ hết hạn sau 10 phút. Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email.</p>
        <p>Xin cảm ơn,</p>
        <p>Đội ngũ Vao Bep</p>
    `;
    return sendEmail(toEmail, subject, html);
};

module.exports = { 
    sendVerificationEmail,
    sendEmail,
    sendPasswordResetEmail
};

