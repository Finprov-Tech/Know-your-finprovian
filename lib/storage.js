// Where booklet entries and uploaded images live.
//  - Local disk (default): data/finprovians.json + uploads/   -> for localhost / a VPS
//  - Vercel Blob: used automatically when BLOB_READ_WRITE_TOKEN is set (Vercel has no lasting disk)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'finprovians.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const newName = (mimetype) => `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[mimetype] || ''}`;

// ---------- local disk ----------
const local = {
  name: 'local disk',
  UPLOAD_DIR,
  async readData() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  },
  async writeData(list) {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  },
  async saveImage(file) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const name = newName(file.mimetype);
    fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer);
    return `/uploads/${name}`;
  },
  async removeImage(url) {
    if (typeof url === 'string' && url.startsWith('/uploads/')) {
      fs.rmSync(path.join(UPLOAD_DIR, path.basename(url)), { force: true });
    }
  },
};

// ---------- Vercel Blob ----------
// Each save writes a new, uniquely named JSON snapshot and then removes the older ones.
// Reading picks the newest snapshot, so a CDN-cached old copy is never served.
const DATA_PREFIX = 'data/finprovians-';

const blobStore = () => {
  const blob = require('@vercel/blob');

  async function snapshots() {
    const { blobs } = await blob.list({ prefix: DATA_PREFIX });
    return blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  return {
    name: 'Vercel Blob',
    async readData() {
      const [latest] = await snapshots();
      // First run: start from the entries shipped with the code
      if (!latest) return require('../data/finprovians.json');
      const res = await fetch(latest.url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load booklet data');
      return res.json();
    },
    async writeData(list) {
      const saved = await blob.put(`${DATA_PREFIX}${Date.now()}.json`, JSON.stringify(list, null, 2), {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/json',
      });
      const old = (await snapshots()).filter((b) => b.url !== saved.url).map((b) => b.url);
      if (old.length) await blob.del(old).catch(() => {});
    },
    async saveImage(file) {
      const saved = await blob.put(`uploads/${newName(file.mimetype)}`, file.buffer, {
        access: 'public',
        addRandomSuffix: true,
        contentType: file.mimetype,
      });
      return saved.url;
    },
    async removeImage(url) {
      if (typeof url === 'string' && /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url)) {
        await blob.del(url).catch(() => {});
      }
    },
  };
};

module.exports = process.env.BLOB_READ_WRITE_TOKEN ? blobStore() : local;
