// VỊ TRÍ: backend/utils/promptTemplates.js

function defaultExamples() {
  return [
    {
      user: 'Tôi có cà chua và trứng, làm món gì nhanh gọn?',
      assistant: `Dưới đây tôi sẽ gợi ý cho bạn một vài món ăn từ cà chua và trứng. Nếu bạn có dị ứng với nguyên liệu nào, hãy cho tôi biết.\n\n\`\`\`sql\nSELECT recipe_id, title, description, cook_time, cover_image FROM recipes WHERE status = 'public' AND (title LIKE '%cà chua%' AND title LIKE '%trứng%') LIMIT 5\n\`\`\``
    },
    {
      user: 'Cho tôi công thức món canh dưới 10 phút không có tôm',
      assistant: `Tôi lưu ý bạn không ăn tôm. Tôi sẽ tìm các món canh nấu nhanh dưới 10 phút và không chứa tôm cho bạn nhé.\n\n\`\`\`sql\nSELECT recipe_id, title, description, cook_time, cover_image FROM recipes WHERE status = 'public' AND title LIKE '%canh%' AND cook_time <= 10 AND recipe_id NOT IN (SELECT recipe_id FROM recipe_ingredients WHERE ingredient_id IN (SELECT ingredient_id FROM ingredients WHERE name LIKE '%tôm%' COLLATE utf8mb4_0900_as_ci)) LIMIT 5\n\`\`\``
    },
    {
      user: 'Tôi muốn tìm bài viết học thuật nào về kỹ năng áp chảo',
      assistant: `Tôi sẽ tiến hành tìm kiếm các bài viết hoặc chia sẻ liên quan đến kỹ thuật áp chảo trong hệ thống cho bạn. Dưới đây là kết quả:\n\n\`\`\`sql\nSELECT article_id, title, description FROM article_posts WHERE status = 'public' AND (title LIKE '%áp chảo%' OR description LIKE '%áp chảo%') LIMIT 5\n\`\`\``
    },
    {
      user: 'Có món ăn nào đầu độc được người khác không?',
      assistant: `Tôi hiểu ý bạn đang muốn hỏi về các món ăn có thể gây nguy hiểm. Tuy nhiên, tôi không thể cung cấp thông tin về các món ăn gây hại cho sức khỏe hoặc có thể được sử dụng để đầu độc người khác. Nếu bạn có bất kỳ câu hỏi nào khác về nấu ăn hoặc công thức, tôi rất sẵn lòng giúp đỡ!`
    },
    {
      user: 'Tôi muốn khám phá ẩm thực Việt Nam',
      assistant: `Ẩm thực Việt Nam rất đa dạng và phong phú với nhiều món ăn đặc trưng từ các vùng miền khác nhau. Dưới đây là một số món ăn phổ biến mà bạn có thể thử khám phá:\n\n\`\`\`sql\nselect dish_id, original_name, image_url from dictionary_dishes WHERE country LIKE'%ViệtNam%' LIMIT 5\n\`\`\``
    },
    {
      user: 'Tôi muốn tìm món ăn nào healthy mà sử dụng thịt gà.',
      assistant: `Tuyệt vời, tôi sẽ tìm cho bạn các món gà tốt cho sức khỏe nhé. Dưới đây là kết quả:\n\n\`\`\`sql\nSELECT recipe_id, title, description, total_calo, cover_image FROM recipes WHERE status = 'public' AND (total_calo < 500 OR recipe_id IN (SELECT post_id FROM tag_post WHERE post_type = 'recipe' AND tag_id IN (SELECT tag_id FROM tags WHERE name = 'healthy' OR name = 'eat clean'))) AND (recipe_id IN (SELECT recipe_id FROM recipe_ingredients WHERE ingredient_id IN (SELECT ingredient_id FROM ingredients WHERE name LIKE '%gà%' COLLATE utf8mb4_0900_as_ci)) OR recipe_id IN (SELECT post_id FROM tag_post WHERE post_type = 'recipe' AND tag_id IN (SELECT tag_id FROM tags WHERE name LIKE '%gà%' COLLATE utf8mb4_0900_as_ci))) ORDER BY total_calo ASC LIMIT 5\n\`\`\``
    },
    {
      user: 'Tôi lỡ tay cho nhiều muối vào nồi nước dùng rồi, làm sao để chữa cháy?',
      assistant: `Đừng quá lo lắng! Nếu nồi nước dùng bị mặn, bạn có thể cắt vài lát khoai tây sống thả vào nồi đun sôi thêm khoảng 15 phút, khoai tây sẽ hút bớt vị mặn. Hoặc bạn có thể vắt thêm chút nước cốt chanh nếu món ăn phù hợp với vị chua nhé.`
    },
    // Ví dụ 4: Đang xem bài viết nhưng lại đòi đổi món (CÓ SQL)
    {
      user: 'Món gà này ngon đấy, nhưng nhà tôi hết gà rồi. Tìm cho tôi món nào làm từ thịt heo đi.',
      assistant: `Vâng, tôi sẽ tìm cho bạn các công thức hấp dẫn được làm từ thịt heo nhé. Dưới đây là kết quả:\n\n\`\`\`sql\nSELECT recipe_id, title, description, total_calo, cover_image FROM recipes WHERE status = 'public' AND recipe_id IN (SELECT recipe_id FROM recipe_ingredients WHERE ingredient_id IN (SELECT ingredient_id FROM ingredients WHERE name LIKE '%heo%' COLLATE utf8mb4_0900_as_ci)) LIMIT 5\n\`\`\``
    }
  ];
}

function formatExamples(exs) {
  if (!exs) exs = defaultExamples();
  return exs.map(e => `Ví dụ User hỏi: ${e.user}\nVí dụ Assistant trả lời: ${e.assistant}`).join('\n\n');
}

// BỔ SUNG THÊM currentContext
function buildSystemInstruction({ rulesText, schemaSnippet, examples, currentContext }) {
  const parts = [];
  
  if (rulesText) parts.push(`=== SYSTEM RULES ===\n${rulesText}`);
  if (schemaSnippet) parts.push(`=== DB SCHEMA (WHITELIST) ===\n${schemaSnippet}`);
  
  // BƠM NGỮ CẢNH VÀO PROMPT CHO AI NHẬN DIỆN
  if (currentContext) {
      parts.push(`=== NGỮ CẢNH BÀI VIẾT HIỆN TẠI ===\nChú ý: Người dùng đang xem bài viết/công thức có nội dung sau đây:\n"${currentContext}"\n(Hãy tham chiếu nội dung này để trả lời nếu người dùng hỏi về nó)`);
  } else {
      parts.push(`=== NGỮ CẢNH BÀI VIẾT HIỆN TẠI ===\nNgười dùng đang ở Trang chủ/Chế độ tìm kiếm chung. KHÔNG có bài viết cụ thể nào.`);
  }

  parts.push(`=== EXAMPLES ===\n${formatExamples(examples)}`);
  
  return parts.join('\n\n');
}

module.exports = { buildSystemInstruction, defaultExamples };