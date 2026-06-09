const WHITELIST_TABLES = new Set([
  'recipes','ingredients','recipe_ingredients','tags','tag_post','units','dictionary_dishes','article_posts','recipe_post_links'
]);

function validateSQL(sql) {
  if (!sql || typeof sql !== 'string') return { valid: false, reason: 'Empty SQL' };

  const s = sql.trim().toLowerCase();
  // Disallow semicolons (multiple statements)
  if (s.includes(';')) return { valid: false, reason: 'Multiple statements not allowed' };

  // Must start with select
  if (!s.startsWith('select')) return { valid: false, reason: 'Only SELECT queries allowed' };

  // Disallow dangerous keywords
  const forbidden = ['insert','update','delete','drop','alter','create','truncate','grant','revoke','information_schema','procedure','function'];
  for (const kw of forbidden) {
    if (s.includes(kw)) return { valid: false, reason: `Forbidden keyword: ${kw}` };
  }

  // Extract table names from FROM / JOIN clauses (simple regex)
  const tableRegex = /\bfrom\s+([`"]?)([a-z0-9_]+)\1|\bjoin\s+([`"]?)([a-z0-9_]+)\3/gi;
  const tables = new Set();
  let m;
  while ((m = tableRegex.exec(sql)) !== null) {
    const name = (m[2] || m[4] || '').toLowerCase();
    if (name) tables.add(name);
  }

  // If no tables detected, be conservative
  if (tables.size === 0) return { valid: false, reason: 'No table found in query' };

  // Ensure all referenced tables are whitelisted
  for (const t of tables) {
    if (!WHITELIST_TABLES.has(t)) return { valid: false, reason: `Table not allowed: ${t}` };
  }

  return { valid: true, tables: Array.from(tables) };
}

module.exports = { validateSQL };
