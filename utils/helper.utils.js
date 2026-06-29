
/**
 * Hàm phụ trợ chuyển đổi chuỗi gộp tag từ SQL thành mảng object.
 */
const parseTagsData = (rawTags) => {
    if (!rawTags) return [];
    return rawTags.split('|||').map(item => {
        const [tag_id, name] = item.split(':::');
        return { tag_id, name };
    });
};
module.exports = {
    parseTagsData,
};