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

## Hosting notes

Back up `data/` and `uploads/`: they hold everything HR adds. If you host it behind HTTPS, set `cookie.secure: true` in `server.js`.
