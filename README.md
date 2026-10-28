# Know Your Finprovian

A flip-through booklet introducing new Finprov team members, plus an HR-only desk for adding people.

**Stack:** Node.js + Express, plain HTML/CSS/JS, [StPageFlip](https://github.com/Nodlik/StPageFlip) for the page-turn effect. No build step, no database. Entries live in `data/finprovians.json`.

## Run it

```bash
npm install
npm start            # http://localhost:3000
```

- Booklet: `http://localhost:3000/`
- HR desk: `http://localhost:3000/admin`

## HR login

On first start the server creates `data/hr-config.json` with a default login:

| username | password       |
|----------|----------------|
| `hr`     | `Finprov@2026` |

**Change it before sharing the site:**

```bash
npm run set-password -- hr "YourNewStrongPassword"
# then restart the server
```

The password is stored as a salted scrypt hash. Five wrong attempts lock that IP out for 5 minutes.

## Adding a finprovian (HR desk)

- **Upload a poster**: for a finished designed poster (JPG/PNG/WEBP).
- **Build a page**: name, role, portrait, optional family photo, and an introduction. The page is laid out in the booklet's poster style. Long text shrinks to fit.

New people go to the end of the booklet. Use ↑ / ↓ to reorder and **Remove** to delete. Images are downscaled in the browser before upload.

## Files

```
server.js                  Express server, auth, API
public/index.html          Booklet
public/admin.html          HR desk
public/js/booklet.js       Flipbook setup, contents, lightbox
public/js/pages.js         Shared page renderer (booklet + HR preview)
public/css/styles.css      All styles
public/pages/              Web-optimised copies of the original posters
uploads/                   Images added through the HR desk
data/finprovians.json      Booklet entries, in order
scripts/prepare-assets.py  One-time: regenerate public/pages from Assets/
```

## Hosting on Vercel

Vercel has no lasting disk, so the app switches to **Vercel Blob** storage automatically whenever `BLOB_READ_WRITE_TOKEN` is set. The first time it runs it starts from the entries in `data/finprovians.json`; after that, HR changes are saved in Blob.

1. Vercel → **Add New → Project** → import this repo (preset: Express, no build settings needed).
2. Project → **Storage → Create → Blob** → connect it to the project (adds `BLOB_READ_WRITE_TOKEN`).
3. Project → **Settings → Environment Variables**:
   - `HR_PASSWORD`: the HR login password (required; HR login stays off without it)
   - `SESSION_SECRET`: any long random string
   - `HR_USERNAME`: optional, defaults to `hr`
4. Redeploy so the variables take effect.

Uploads are downscaled in the browser to fit Vercel's 4.5 MB request limit.

## Hosting on a VPS / panel

Run `npm install && npm start` (e.g. under pm2) without `BLOB_READ_WRITE_TOKEN`: entries and images are stored on disk in `data/` and `uploads/`. Back both up. Login comes from `data/hr-config.json` (or `HR_PASSWORD` if set). Behind HTTPS the login cookie is marked secure only on Vercel; set `secure: true` in `cookieOpts` in `server.js` for other HTTPS hosts.

To move from Vercel to a VPS, download the latest `data/finprovians-*.json` and the `uploads/` images from the Blob store; entries added on Vercel point at their Blob URLs, which keep working as long as the Blob store exists.
