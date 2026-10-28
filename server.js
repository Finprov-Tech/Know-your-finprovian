const express = require('express');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'finprovians.json');
const CONFIG_FILE = path.join(ROOT, 'data', 'hr-config.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT = process.env.PORT || 3000;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- config & password hashing ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    const { salt, hash } = hashPassword('Finprov@2026');
    const cfg = {
      username: 'hr',
      salt,
      hash,
      sessionSecret: crypto.randomBytes(32).toString('hex'),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
    console.warn('\n  Created default HR login  ->  username: hr   password: Finprov@2026');
    console.warn('  Change it with:  npm run set-password -- <username> <new-password>\n');
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function checkPassword(cfg, username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') return false;
  const { hash } = hashPassword(password, cfg.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(cfg.hash, 'hex');
  return username.trim().toLowerCase() === cfg.username.toLowerCase() && crypto.timingSafeEqual(a, b);
}

const config = loadConfig();

// ---------- data ----------
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeData = (list) => {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, DATA_FILE);
};

// ---------- uploads ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG or WEBP images are allowed'), ok);
  },
});

function removeUpload(url) {
  if (typeof url === 'string' && url.startsWith('/uploads/')) {
    fs.rm(path.join(UPLOAD_DIR, path.basename(url)), { force: true }, () => {});
  }
}

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(
  session({
    name: 'kyf.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 },
  })
);

app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.get('/vendor/page-flip.js', (_req, res) =>
  res.sendFile(path.join(ROOT, 'node_modules', 'page-flip', 'dist', 'js', 'page-flip.browser.js'))
);

const requireHR = (req, res, next) =>
  req.session.hr ? next() : res.status(401).json({ error: 'Please sign in as HR' });

// Public: booklet content
app.get('/api/finprovians', (_req, res) => res.json(readData()));

// Auth (with a simple per-IP lockout against guessing)
const attempts = new Map();
app.post('/api/login', (req, res) => {
  const key = req.ip;
  const rec = attempts.get(key) || { count: 0, until: 0 };
  if (rec.until > Date.now()) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }
  const { username, password } = req.body || {};
  if (!checkPassword(config, username, password)) {
    rec.count += 1;
    if (rec.count >= 5) Object.assign(rec, { count: 0, until: Date.now() + 5 * 60 * 1000 });
    attempts.set(key, rec);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  attempts.delete(key);
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.hr = config.username;
    res.json({ ok: true, user: config.username });
  });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json({ hr: Boolean(req.session.hr), user: req.session.hr || null }));

// HR: add a finprovian — either a finished poster, or details to build a page from
app.post(
  '/api/finprovians',
  requireHR,
  upload.fields([
    { name: 'poster', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'familyPhoto', maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files || {};
    const url = (f) => (files[f] ? `/uploads/${files[f][0].filename}` : null);
    const name = String(req.body.name || '').trim().slice(0, 80);
    const role = String(req.body.role || '').trim().slice(0, 80);
    const intro = String(req.body.intro || '').trim().slice(0, 2500);
    const type = req.body.type === 'profile' ? 'profile' : 'poster';

    const fail = (msg) => {
      ['poster', 'photo', 'familyPhoto'].forEach((f) => removeUpload(url(f)));
      res.status(400).json({ error: msg });
    };
    if (!name) return fail('Name is required');
    if (type === 'poster' && !url('poster')) return fail('Please upload the poster image');
    if (type === 'profile' && (!url('photo') || !intro)) return fail('A photo and an introduction are required');

    const entry = { id: crypto.randomUUID(), name, role, type, createdAt: new Date().toISOString() };
    if (type === 'poster') entry.image = url('poster');
    else Object.assign(entry, { photo: url('photo'), familyPhoto: url('familyPhoto'), intro });

    const list = readData();
    list.push(entry);
    writeData(list);
    res.status(201).json(entry);
  }
);

// HR: reorder
app.put('/api/finprovians/order', requireHR, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const list = readData();
  const byId = new Map(list.map((e) => [e.id, e]));
  if (ids.length !== list.length || !ids.every((id) => byId.has(id))) {
    return res.status(400).json({ error: 'Order does not match current entries' });
  }
  writeData(ids.map((id) => byId.get(id)));
  res.json({ ok: true });
});

// HR: delete
app.delete('/api/finprovians/:id', requireHR, (req, res) => {
  const list = readData();
  const entry = list.find((e) => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  writeData(list.filter((e) => e.id !== entry.id));
  [entry.image, entry.photo, entry.familyPhoto].forEach(removeUpload);
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Something went wrong' });
});

app.listen(PORT, () => console.log(`Know Your Finprovian  ->  http://localhost:${PORT}`));
