const fs = require('fs');
const path = require('path');

function loadRules(req, res, next) {
  try {
    const rulesPath = path.join(__dirname, '..', 'config', 'chatbot.rules.md');
    const text = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '';
    req.rules = text;
    next();
  } catch (err) {
    console.error('Failed to load rules:', err.message);
    req.rules = '';
    next();
  }
}

module.exports = { loadRules };
