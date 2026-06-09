const db = require('../config/db'); 
// 2. Định nghĩa pool bằng cách lấy từ đối tượng db
const pool = db.pool;


class User {
    //Create user cho user đăng ký
    static async create(name, email, passwordHash, otp, otpExpires) {
        const [result] = await pool.execute(
            'INSERT INTO users (full_name, email, password, account_status, verification_otp, otp_expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, passwordHash, 'pending', otp, otpExpires]
        );
        return result.insertId;
    }

    //Create user với role cho admin
    static async createWithRole({id, full_name, email, passwordHash, role, otp, otpExpires }) {
        // Lưu ý: account_status để là 'pending' để bắt buộc xác thực email
        const [result] = await pool.execute(
            'INSERT INTO users (user_id, full_name, email, password, role, account_status, verification_otp, otp_expires_at) VALUES (?,?, ?, ?, ?, ?, ?, ?)',
            [id, full_name, email, passwordHash, role, 'pending', otp, otpExpires]
        );
        
        return result;
    }

    static async findByEmail(email) {
        try {
            const [rows] = await pool.execute(
                    'SELECT user_id, full_name, email, password, account_status, role FROM users u WHERE email = ?',
                    [email]
                );
                return rows[0];
            } catch (error) {
                console.error('LỖI CHI TIẾT TRONG findByEmail:', error.message);
                throw error; 
            }
    }

    static async findById(id) {
        const sql = `
            SELECT 
                u.user_id, 
                u.email, 
                u.full_name, 
                u.avatar, 
                u.role, 
                u.bio, 
                u.points,
                u.account_status,
                u.created_at,
               -- Đếm số công thức (có thể thêm điều kiện status = 'public' nếu muốn)
                (SELECT COUNT(*) FROM Recipes r WHERE r.user_id = u.user_id) as recipes_count,
                
                -- Đếm số người theo dõi
                (SELECT COUNT(*) FROM Follows f WHERE f.following_id = u.user_id) as followers_count,
                
                -- Đếm số bài đã lưu
                (SELECT COUNT(*) FROM Saved_Posts s WHERE s.user_id = u.user_id) as saved_count, -- Placeholder tạm thời
                (SELECT COUNT(*) FROM Point_Transactions pt WHERE pt.user_id = u.user_id AND pt.type = 'checkin' AND DATE(pt.created_at) = CURRENT_DATE()) as is_checked_in
            FROM users u 
             WHERE u.user_id = ? AND u.account_status = 'active'
            `;
        const [rows] = await pool.execute(sql, [id]);
        
        if (!rows[0]) return null;

        const user = rows[0];

        return {
            id: user.user_id,
            fullName: user.full_name,
            email: user.email,
            avatar: user.avatar || 'default.png', // Xử lý fallback ở backend hoặc frontend đều được
            bio: user.bio,
            role: user.role, // 'user', 'vip', 'pro'
            points: user.points,
            isCheckedIn: !!user.is_checked_in,
            stats: {
                recipes: user.recipes_count || 0,
                saved: user.saved_count || 0,
                followers: user.followers_count || 0
            },
            joinDate: user.created_at
        };
    }

    // [THÊM MỚI] - Dành riêng cho Admin/System, không filter trạng thái hay role
    static async findByIdForAdmin(id) {
        const sql = `
            SELECT 
                u.user_id, u.email, u.full_name, u.avatar, u.role, u.bio, u.points,
                u.account_status, u.created_at,
                (SELECT COUNT(*) FROM Recipes r WHERE r.user_id = u.user_id) as recipes_count,
                (SELECT COUNT(*) FROM Follows f WHERE f.following_id = u.user_id) as followers_count,
                (SELECT COUNT(*) FROM Saved_Posts s WHERE s.user_id = u.user_id) as saved_count
            FROM users u 
            WHERE u.user_id = ?
            -- KHÔNG CÓ filter account_status = 'active' ở đây
        `;
        const [rows] = await pool.execute(sql, [id]);
        
        if (!rows[0]) return null;
        const user = rows[0];

        return {
            id: user.user_id,
            fullName: user.full_name,
            email: user.email,
            avatar: user.avatar || 'default.png',
            bio: user.bio,
            role: user.role, 
            points: user.points,
            status: user.account_status, // Trả thêm status để admin dễ quản lý
            stats: {
                recipes: user.recipes_count || 0,
                saved: user.saved_count || 0,
                followers: user.followers_count || 0
            },
            joinDate: user.created_at
        };
    }

    static async findPublicProfileById(id, currentUserId = null) {
        try {
            const sql = `
                SELECT 
                    u.user_id, 
                    u.full_name, 
                    u.avatar, 
                    u.role, 
                    u.bio, 
                    u.account_status,
                    u.created_at,
                    -- Đếm số công thức PUBLIC
                    (SELECT COUNT(*) FROM Recipes r WHERE r.user_id = u.user_id AND r.status = 'public') as recipes_count,
                    
                    -- Đếm người theo dõi
                    (SELECT COUNT(*) FROM Follows f WHERE f.following_id = u.user_id) as followers_count,
                    
                    -- Đếm số người đang theo dõi
                    (SELECT COUNT(*) FROM Follows f WHERE f.follower_id = u.user_id) as following_count,

                    -- [MỚI] Kiểm tra xem người xem (currentUserId) có đang follow user này không
                    -- Trả về 1 nếu có, 0 nếu không. Nếu currentUserId null thì trả về 0.
                    (SELECT COUNT(*) FROM Follows f2 WHERE f2.follower_id = ? AND f2.following_id = u.user_id) > 0 as is_following

                FROM Users u 
                WHERE u.user_id = ? AND u.account_status = 'active' AND u.role != 'admin'
            `;
            
            // Params: [currentUserId (cho subquery), id (cho where clause)]
            const [rows] = await pool.execute(sql, [currentUserId, id]);
            
            if (!rows[0]) return null;
            const user = rows[0];

            return {
                id: user.user_id,
                fullName: user.full_name,
                avatar: user.avatar || 'default.png',
                bio: user.bio,
                role: user.role,
                // [MỚI] Trả về trạng thái follow
                isFollowing: !!user.is_following, 
                stats: {
                    recipes: user.recipes_count || 0,
                    followers: user.followers_count || 0,
                    following: user.following_count || 0
                },
                joinDate: user.created_at
            };
        } catch (error) {
            console.error('User Model FindPublic Error:', error);
            throw error;
        }
    }

    static async findAuth (userId){
        const sql = "SELECT user_id, email, role, account_status FROM users u WHERE u.user_id = ? AND u.account_status = 'active'";
        const [rows] = await pool.execute(sql, [userId]);
        return rows[0];        
    }

    static async findByEmailAndOTP(email, otp) {
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM users u WHERE u.email = ? AND u.verification_otp = ?',
                [email, otp]
            );
            return rows[0];
        } catch (error) {
            console.error('Lỗi khi tìm user', error);
            throw error;
        }
    }

    static async findByIdForUpdate(userId, connection) {
        // FOR UPDATE sẽ khóa dòng này lại, các transaction khác phải chờ
        const sql = `SELECT user_id, full_name, email, points, account_status FROM Users u WHERE u.user_id = ? FOR UPDATE`;
        const [rows] = await connection.execute(sql, [userId]);
        return rows[0];
    }

    static async updatePoints(userId, amount, connection) {
        // Sử dụng connection truyền vào (nếu có) hoặc dùng pool mặc định
        const dbExec = connection || pool;
        const sql = `UPDATE Users u SET u.points = u.points + ?  WHERE u.user_id = ? AND u.account_status = 'active' AND u.role != 'admin'`;
        const [result] = await dbExec.execute(sql, [amount, userId]);
        return result.affectedRows > 0;
    }

    static async isUserActive(userId) {
        const sql = `SELECT user_id FROM Users u WHERE u.user_id = ? AND u.account_status = 'active' AND u.role != 'admin'`;
        const [rows] = await pool.execute(sql, [userId]);
        return rows.length > 0;
    }


    static async activateUser(userId) {
        try {
            const [result] = await pool.execute(
                'UPDATE users u SET u.account_status = ?, u.verification_otp = ?, u.otp_expires_at = ? WHERE u.user_id = ?',
                ['active', null, null, userId] // Set active, xóa OTP
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Lỗi khi kích hoạt user:', error);
            throw error;
        }
    }

    static async updateOTP(userId, otp, otpExpires) {
        try{
            console.log(userId, otp, otpExpires)
            const [result] = await pool.execute(
                'UPDATE users u SET u.verification_otp = ?, u.otp_expires_at = ? WHERE u.user_id = ?',
                [otp, otpExpires, userId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Lỗi khi cập nhật OTP:', error);
            throw error;
        }
    }

    static async findPasswordByUserId (userId){
        const sql = "SELECT password FROM users WHERE user_id = ?";
        const [rows] = await pool.execute(sql, [userId]);
        return rows[0] ? rows[0].password : null;
    };

    // Chủ động đổi mk => cần mật khẩu cũ
    // static async updatePassword(userId,  hashedNewPassword) {
    //     const updateSql = "UPDATE users SET password = ? WHERE user_id = ?";
    //     await pool.execute(updateSql, [hashedNewPassword, userId]);
    //     return true;
    // }

    // Quên mật khẩu nên phải đổi
    static async changePassword(userId, hashedNewPassword){
        try {
            const sql = "UPDATE users SET password = ? WHERE user_id = ?";
            await pool.execute(sql, [hashedNewPassword, userId]);
            return true;
        } catch (error) {
            throw error;
        }
    }

    static async clearOTP(userId) {
        try {
            const sql = `
                UPDATE users u
                SET
                    u.verification_otp = NULL,
                    u.otp_expires_at = NULL
                WHERE
                    u.user_id = ?;
            `

            await pool.execute(sql, [userId]);
            return true;
        } catch (error) {
            console.error('Lỗi Model (clearOTP):', error);
            throw new Error(`Xóa otp thất bại: ${error.message}`);
        }
    }

    // Thêm đoạn này vào trong class User (trước dấu đóng '}')
// [CẬP NHẬT] Hàm tìm kiếm user có check trạng thái follow
    static async searchUsers({ keyword, page = 1, limit = 10, sort = 'newest', currentUserId = null }) {
        const offset = (page - 1) * limit;
        const kw = `%${keyword}%`;

        try {
            // Query đếm tổng
            const countSql = `
                SELECT COUNT(*) as total 
                FROM Users u
                WHERE (full_name LIKE ?) AND account_status = 'active'  AND role != 'admin'
            `;
            const [countRows] = await pool.execute(countSql, [kw]);
            const totalItems = countRows[0].total;

            // Xử lý Sort
            let orderBy = 'u.created_at DESC'; 
            if (sort === 'oldest') orderBy = 'u.created_at ASC';
            if (sort === 'most_followed') orderBy = 'followers_count DESC';

            // [MỚI] Thêm subquery check is_following
            const sql = `
                SELECT 
                    u.user_id, 
                    u.full_name, 
                    u.email, 
                    u.avatar, 
                    u.bio, 
                    u.created_at,
                    COUNT(f.follower_id) as followers_count,
                    -- Check trạng thái follow đối với currentUserId
                    (SELECT COUNT(*) FROM Follows f2 WHERE f2.follower_id = ? AND f2.following_id = u.user_id) > 0 as is_following
                FROM Users u
                LEFT JOIN Follows f ON u.user_id = f.following_id
                WHERE (u.full_name LIKE ?) 
                  AND u.account_status = 'active'
                  AND u.role != 'admin'
                GROUP BY u.user_id
                ORDER BY ${orderBy}
                LIMIT ? OFFSET ?
            `;

            // Params: [currentUserId, keyword, keyword, limit, offset]
            const [users] = await pool.query(sql, [currentUserId, kw, parseInt(limit), parseInt(offset)]);

            // Map lại key cho chuẩn boolean
            const formattedUsers = users.map(user => ({
                ...user,
                isFollowing: !!user.is_following // Chuyển 1/0 sang true/false
            }));

            return {
                users: formattedUsers,
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                currentPage: parseInt(page)
            };
        } catch (error) {
            console.error('User Model Search Error:', error);
            throw error;
        }
    }

    // --- THÊM MỚI BẮT ĐẦU ---
/**
     * Cập nhật thông tin profile user (Dynamic Update)
     * @param {string} userId 
     * @param {object} data { fullName, bio, avatar } - Các trường có thể undefined
     */
    static async updateProfile(userId, data) {
        try {
            const updates = [];
            const values = [];

            // Kiểm tra từng trường, nếu có dữ liệu thì push vào mảng updates
            if (data.fullName !== undefined) {
                updates.push("full_name = ?");
                values.push(data.fullName);
            }

            if (data.bio !== undefined) {
                updates.push("bio = ?");
                values.push(data.bio);
            }

            if (data.avatar !== undefined) {
                updates.push("avatar = ?");
                values.push(data.avatar);
            }

            // Luôn cập nhật thời gian update
            updates.push("update_at = NOW()");

            // Nếu không có gì để update (ngoài update_at) thì return sớm
            // (Tuy nhiên controller đã check rồi, đây là check phòng hờ)
            if (updates.length === 1) return 0;

            // Xây dựng câu query
            const sql = `UPDATE Users SET ${updates.join(", ")} WHERE user_id = ?`;
            
            // Push userId vào cuối mảng values (cho dấu ? ở WHERE)
            values.push(userId);

            
            const [result] = await pool.execute(sql, values);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('User Model Update Error:', error);
            throw error;
        }
    }

    //Admin--------------------------------------------------------------------------
    static async getAllUsers(limit, offset, search, sortKey = 'created_at', sortOrder = 'DESC') {
        // Whitelist các cột được phép sort để tránh SQL Injection
        const allowedSorts = ['full_name', 'email', 'created_at', 'role', 'points'];
        const orderBy = allowedSorts.includes(sortKey) ? sortKey : 'created_at';
        const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let query = `SELECT user_id, full_name, email, role, account_status, points, created_at FROM Users`;
        let params = [];
        
        if (search) {
            query += ` WHERE full_name LIKE ? OR email LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
        }
        
        // Dynamic Order By
        query += ` ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`;
        
        params.push(limit.toString(), offset.toString());
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    static async countUsers(search) {
        let query = `SELECT COUNT(*) as total FROM Users`;
        let params = [];
        if (search) {
            query += ` WHERE full_name LIKE ? OR email LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
        }
        const [rows] = await pool.execute(query, params); // Sửa db.execute -> pool.execute
        return rows[0].total;
    }

    static async updateStatus(userId, status){
        const query = `UPDATE Users SET account_status = ? WHERE user_id = ?`;
        const [result] = await pool.execute(query, [status, userId]); // Sửa db.execute -> pool.execute
        return result;
    }

    static async getUserGrowthStats(days = 7) {
        const query = `
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM Users 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `;
        const [rows] = await pool.execute(query, [days]);
        return rows;
    }

    static async getUserRoleDistribution() {
        const query = `
            SELECT role, COUNT(*) as count 
            FROM Users 
            GROUP BY role
        `;
        const [rows] = await pool.execute(query);
        return rows;
    }


    static async adminUpdateUser(userId, { role, status }) {
        // Chỉ update nếu giá trị hợp lệ được truyền vào
        let updates = [];
        let params = [];

        if (role) {
            updates.push('role = ?');
            params.push(role);
        }
        
        if (status) {
            updates.push('account_status = ?');
            params.push(status);
        }

        // Luôn update thời gian
        updates.push('update_at = NOW()');

        // Nếu không có gì để update
        if (updates.length === 1) return true; 

        const sql = `UPDATE Users SET ${updates.join(', ')} WHERE user_id = ?`;
        params.push(userId);

        const [result] = await pool.execute(sql, params);
        return result.affectedRows > 0;
    }

}

module.exports = User;