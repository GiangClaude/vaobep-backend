// utils/paginationHelper.js
const createPagination = (page, limit, totalItems) => {
  const totalPages = Math.ceil(totalItems / limit); // Làm tròn lên

  return {
    currentPage: page,
    limit: limit,
    totalItems: totalItems,
    totalPages: totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

module.exports = {
    createPagination
}