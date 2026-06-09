const db = require('../config/db');

async function execute(sql, options = {}) {

  console.log("=== EXECUTING DATABASE QUERY ===", sql);
  
  const timeout = options.timeout || 2000;
  const maxRows = options.maxRows || 200;

  const pool = db.chatbotPool;

  const queryPromise = (async () => {
    const [rows] = await pool.execute(sql);
    return Array.isArray(rows) ? rows.slice(0, maxRows) : rows;
  })();

  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), timeout));

  return Promise.race([queryPromise, timeoutPromise]);
}

module.exports = { execute };
