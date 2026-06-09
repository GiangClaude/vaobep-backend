<!-- VỊ TRÍ: backend/config/chatbot.schema.md -->

# DATABASE SCHEMA (WHITELIST ONLY)
Chỉ sử dụng các bảng và cột dưới đây để tạo câu lệnh SQL.

1. Bảng `recipes` (Công thức nấu ăn)
- recipe_id (PK)
- title (Tên món ăn)
- description (Mô tả)
- cover_image (Ảnh minh họa)
- cook_time (Thời gian nấu - phút)
- total_calo (Tổng calo)
- is_trusted (Huy hiệu đáng tin cậy: 1=Có, 0=Không)
- status (Trạng thái. CHỈ LẤY: 'public')
- rating_avg_score (Đánh giá trung bình )
2. Bảng `ingredients` (Nguyên liệu)
- ingredient_id (PK)
- name (Tên nguyên liệu, VD: 'tôm', 'hành lá', 'thịt heo')


3. Bảng `recipe_ingredients` (Nguyên liệu của công thức)
- recipe_id (FK to recipes)
- ingredient_id (FK to ingredients)
- quantity (Số lượng)
- unit_id (Đơn vị)

4. Bảng `units` (Đơn vị đo lường)
- unit_id (PK)
- name (Tên đơn vị, VD: 'gam', 'kg', 'muỗng')

5. Bảng `tags` (Nhãn phân loại món ăn)
- tag_id (PK)
- name (Tên tag, VD: 'Ăn kiêng', 'Ăn sáng')
- tag_type (Loại tag: 'meal_time', 'occasion', 'other', 'ingredient', 'method', 'cuisine', 'taste', 'appliance', 'dish_type')

6. Bảng `tag_post` (Gắn tag cho bài viết/công thức)
- tag_id (FK to tags)
- post_id (FK to recipes/article_posts)
- post_type ('recipe', 'article')

7. Bảng `dictionary_dishes` (Từ điển món ăn)
- dish_id (PK)
- original_name (Tên món)
- description (Mô tả)
- country (Quốc gia)
- image_url (Ảnh)

8. Bảng `article_posts` (Bài viết blog/mẹo vặt)
- article_id (PK)
- title (Tiêu đề)
- description (Mô tả)
- status (Trạng thái. CHỈ LẤY: 'public')
- cover_image(ảnh)
9. Bảng `recipe_post_links` (Liên kết công thức và bài viết)
- source_recipe_id
- linked_post_id
- linked_post_type