// Usage: npm run set-password -- <username> <new-password>
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 8) {
  console.error('Usage: npm run set-password -- <username> <new-password>   (password: 8+ characters)');
  process.exit(1);
}

const file = path.join(__dirname, '..', 'data', 'hr-config.json');
const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const salt = crypto.randomBytes(16).toString('hex');
Object.assign(cfg, {
  username,
  salt,
  hash: crypto.scryptSync(password, salt, 64).toString('hex'),
  sessionSecret: cfg.sessionSecret || crypto.randomBytes(32).toString('hex'),
});
fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
console.log(`HR login updated for "${username}". Restart the server to apply.`);
