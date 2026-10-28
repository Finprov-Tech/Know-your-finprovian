const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./lib/storage');

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'data', 'hr-config.json');
const PORT = process.env.PORT || 3000;
const ON_VERCEL = Boolean(process.env.VERCEL);

// ---------- config & password hashing ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

// HR login comes from environment variables when set (Vercel), otherwise from data/hr-config.json.
function loadConfig() {
  if (process.env.HR_PASSWORD) {
    const { salt, hash } = hashPassword(process.env.HR_PASSWORD);
    return {
      username: process.env.HR_USERNAME || 'hr',
      salt,
      hash,
      sessionSecret:
        process.env.SESSION_SECRET ||
        crypto.createHash('sha256').update('kyf-session:' + process.env.HR_PASSWORD).digest('hex'),
    };
  }
  if (ON_VERCEL) return null; // no disk to keep a generated login on; HR login stays off until HR_PASSWORD is set
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
  if (!cfg || typeof username !== 'string' || typeof password !== 'string') return false;
  const { hash } = hashPassword(password, cfg.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(cfg.hash, 'hex');
  return username.trim().toLowerCase() === cfg.username.toLowerCase() && crypto.timingSafeEqual(a, b);
}

const config = loadConfig();

// ---------- sessions (signed cookie, so it works without server memory) ----------
const COOKIE = 'kyf.sid';
const SESSION_MS = 8 * 60 * 60 * 1000;
const sign = (payload) =>
  crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');

function readSession(req) {
  if (!config) return null;
  const raw = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [payload, sig] = decodeURIComponent(raw.slice(COOKIE.length + 1)).split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

const cookieOpts = { httpOnly: true, sameSite: 'strict', secure: ON_VERCEL, path: '/' };
function startSession(res, user) {
  const payload = Buffer.from(JSON.stringify({ hr: user, exp: Date.now() + SESSION_MS })).toString('base64url');
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, { ...cookieOpts, maxAge: SESSION_MS });
}

// ---------- uploads ----------
// Kept in memory, then handed to the storage backend (disk or Vercel Blob)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG or WEBP images are allowed'), ok);
  },
});

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use((req, _res, next) => {
  req.hr = readSession(req)?.hr || null;
  next();
});

app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.use('/uploads', express.static(store.UPLOAD_DIR || path.join(ROOT, 'uploads'), { maxAge: '7d' }));

const requireHR = (req, res, next) => (req.hr ? next() : res.status(401).json({ error: 'Please sign in as HR' }));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public: booklet content
app.get(
  '/api/finprovians',
  wrap(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await store.readData());
  })
);

// Auth (with a simple per-IP lockout against guessing)
const attempts = new Map();
app.post('/api/login', (req, res) => {
  if (!config) return res.status(503).json({ error: 'HR login is not set up yet (missing HR_PASSWORD).' });
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
  startSession(res, config.username);
  res.json({ ok: true, user: config.username });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie(COOKIE, cookieOpts);
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => res.json({ hr: Boolean(req.hr), user: req.hr }));

// HR: add a finprovian — either a finished poster, or details to build a page from
app.post(
  '/api/finprovians',
  requireHR,
  upload.fields([
    { name: 'poster', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'familyPhoto', maxCount: 1 },
  ]),
  wrap(async (req, res) => {
    const files = req.files || {};
    const has = (f) => Boolean(files[f]);
    const name = String(req.body.name || '').trim().slice(0, 80);
    const role = String(req.body.role || '').trim().slice(0, 80);
    const intro = String(req.body.intro || '').trim().slice(0, 2500);
    const type = req.body.type === 'profile' ? 'profile' : 'poster';

    const fail = (msg) => res.status(400).json({ error: msg });
    if (!name) return fail('Name is required');
    if (type === 'poster' && !has('poster')) return fail('Please upload the poster image');
    if (type === 'profile' && (!has('photo') || !intro)) return fail('A photo and an introduction are required');

    const save = (f) => (has(f) ? store.saveImage(files[f][0]) : null);
    const entry = { id: crypto.randomUUID(), name, role, type, createdAt: new Date().toISOString() };
    if (type === 'poster') entry.image = await save('poster');
    else Object.assign(entry, { photo: await save('photo'), familyPhoto: await save('familyPhoto'), intro });

    const list = await store.readData();
    list.push(entry);
    await store.writeData(list);
    res.status(201).json(entry);
  })
);

// HR: reorder
app.put(
  '/api/finprovians/order',
  requireHR,
  wrap(async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const list = await store.readData();
    const byId = new Map(list.map((e) => [e.id, e]));
    if (ids.length !== list.length || !ids.every((id) => byId.has(id))) {
      return res.status(400).json({ error: 'Order does not match current entries' });
    }
    await store.writeData(ids.map((id) => byId.get(id)));
    res.json({ ok: true });
  })
);

// HR: delete
app.delete(
  '/api/finprovians/:id',
  requireHR,
  wrap(async (req, res) => {
    const list = await store.readData();
    const entry = list.find((e) => e.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    await store.writeData(list.filter((e) => e.id !== entry.id));
    await Promise.all([entry.image, entry.photo, entry.familyPhoto].map((u) => store.removeImage(u)));
    res.json({ ok: true });
  })
);

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Something went wrong' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Know Your Finprovian  ->  http://localhost:${PORT}  (storage: ${store.name})`));
}
module.exports = app;
