// backend/utils/helper.utils.js

/**
 * Hàm phụ trợ chuyển đổi chuỗi gộp tag từ SQL thành mảng object.
 * Tách ra file utils để tái sử dụng cho các model khác nhau (Recipe, Article...).
 * @param {string} rawTags - Chuỗi tag từ SQL có dạng "id1:::name1|||id2:::name2"
 * @returns {Array} Kết quả trả về: [{ tag_id: "id1", name: "name1" }, ...]
 */
const parseTagsData = (rawTags) => {
    if (!rawTags) return [];
    return rawTags.split('|||').map(item => {
        const [tag_id, name] = item.split(':::');
        return { tag_id, name };
    });
};

// ... các code khác của bà trong file này (nếu có) ...

// Nhớ export nó ra ở cuối file
module.exports = {
    parseTagsData,
    // export các hàm khác...
};