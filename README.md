<div align="center">

# Memory Lane

**Old Photo Restoration Studio**

A React single-page app that repairs damaged photographs on the user's own device, with an
optional cloud-AI upgrade for extreme damage.

**Live site:** https://meriiieriii.github.io/memory/

*React 18 · React Router 6 · Firebase Auth · Vite 5 · Canvas image engine · Node API proxy*

</div>

---

## What it does

Old scans and inherited prints usually arrive with several defects at once: soft focus, grain,
faded contrast, a sepia cast and physical damage. Memory Lane treats each as a separate,
measurable problem and offers a one-click repair for every one of them, plus full manual
control when the automatic guess is wrong.

| Feature | What happens |
|---|---|
| **Auto-Fix blurry photo** | Estimates the blur, reverses it with Richardson-Lucy deconvolution, then a detail pass. Noise and deblur are forced to 100. |
| **Restore black & white** | Colourise, detail, deblur and noise are all forced to 100, with Natural / Warm / Vivid styles. |
| **Remove item** | Brush or magic-wand selection, then the area behind it is rebuilt by inpainting. |
| **Remove background** | Border-connected flood matting, with a **Transparent** or pure **White** fill option. |
| **Compare** | Always-available split view against the original — draggable, keyboard accessible. |
| **Undo / Redo** | 8-step snapshot history (`Ctrl+Z` / `Ctrl+Y`). |
| **Tone and detail** | Auto-detected damage chips plus colourise, deblur, detail, noise and sharpen sliders. |

**Privacy model:** every edit happens in the browser through the Canvas 2D API. Nothing is
uploaded by default. The two AI pages send the photo to a cloud provider *only* when the user
opens them, and the API token is held by the local Node server — never in the bundle.

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 18.3.1 + React DOM |
| Routing | react-router-dom 6.26.2 |
| Auth | Firebase 10.14.1 (email/password, modular SDK) |
| Build | Vite 5.4.21 + @vitejs/plugin-react |
| Image engine | 10 vanilla ES modules on `window.MRL` (~6,000 lines, zero dependencies) |
| Backend | Node 20 built-in `http` (3 API routes + static hosting) |
| Styling | Hand-written CSS (2,139 lines, sepia/ink design system) |

## Run it locally

Two servers. Open both, then use the URLs below.

```bash
# 1) React dev server (hot reload)
cd react-app
npm install
npm run dev

# 2) API server + production hosting (separate terminal)
node server.js
```

| URL | What it is |
|---|---|
| `http://localhost:5173/editor` | Dev build with hot reload |
| `http://localhost:3000/editor` | Production build, served by `server.js` |
| `http://localhost:3000/login` | Sign in / create account |

**Cloud AI (optional):** copy `.env.example` to `.env` and paste a Replicate token. Without it
the offline editor still works completely; `server.js` returns a readable error instead of
calling the API. The token is gitignored and must never be committed.

> **Windows tip:** if the site shows a white screen, an old `node` process is usually still
> holding port 5173. Kill node processes, then start the servers again.

## Repository structure

```
dart/
├── react-app/            THE ACTUAL APPLICATION (React + Vite)
│   └── src/
│       ├── pages/        Home, Login, Editor, Enhance, CloudRestore
│       ├── components/   Chrome (nav + account menu), RequireAuth
│       ├── lib/mrl/      The image engine: deblur, adjust, colorize,
│       │                 bgremove, inpaint, editor, history, sample,
│       │                 enhance, cloud-restore
│       ├── auth.jsx      AuthProvider + useAuth + logout
│       ├── firebase.js   Firebase initialisation
│       └── styles.css    Design system (2,139 lines)
├── server.js             API proxy (Replicate) + static hosting (port 3000)
├── js/, css/, *.html     LEGACY multi-page version (kept as reference only)
├── .github/workflows/    GitHub Pages deployment
├── .env.example          Environment template (no secrets)
└── .gitignore            Ignores .env, node_modules, dist, docs
```

> **Important:** the root `index.html`, `editor.html`, `login.html` and the `js/` folder are the
> **original pre-React implementation**, kept only as a reference. Double-clicking them opens
> that old version — it does *not* contain the React changes. The current app is the React
> project in `react-app/` and must be run through the commands above.

## The image engine

Ten dependency-free ES modules that register themselves on `window.MRL`. Each page imports
the modules it needs and calls an `init*()` function once the DOM is ready.

| Module | Responsibility |
|---|---|
| `deblur.js` | Blur estimation and **Richardson-Lucy deconvolution** |
| `adjust.js` | Tone analysis and the cleanup pipeline (tone → noise → sharpen → colourise → deblur) |
| `colorize.js` | Monochrome colourisation with skin/sky/foliage priors |
| `bgremove.js` | Border-connected flood matting, transparent or white fill |
| `inpaint.js` | Object removal (diffusion + patch matching) and the magic wand |
| `editor.js` | The editor controller: state machine, events, public `editorAPI` |
| `history.js` | 8-step canvas snapshot history |
| `sample.js` | Procedurally drawn demo artwork — the repo ships no sample images |
| `enhance.js`, `cloud-restore.js` | Cloud AI page wiring |

React and the engine meet at exactly one seam: `window.MRL.editorAPI`
(`setMode`, `autoFixBlurry`, `restoreBw`, `removeBackground`, `hasImage`, `hint`).

## Authentication

Firebase email/password, integrated in React throughout:

- `firebase.js` initialises the app with `browserLocalPersistence`
- `auth.jsx` exposes `{ user, loading, logout }` via `AuthProvider` / `useAuth`
- `RequireAuth` guards every route except `/login` and restores the original destination after sign-in
- `LoginPage.jsx` handles sign-in, registration and human-readable error messages
- `Chrome.jsx` renders the account icon (top right) whose popup shows the email and **Log out**

## Deployment

The live site is published with **GitHub Pages** by the workflow in
`.github/workflows/deploy.yml`, which builds the app with a `/memory/` asset prefix, adds a
`404.html` copy as an SPA fallback, and deploys `react-app/dist`.

The app routes with `HashRouter`, so every screen lives under the hash
(`https://meriiieriii.github.io/memory/#/login`). This keeps the deployed site working on any
refresh or deep link, because GitHub Pages does not rewrite unknown paths to `404.html`.

**Live site:** https://meriiieriii.github.io/memory/

Every push to `main` redeploys automatically.

### Note on the live site

GitHub Pages hosts static files only, so two things behave differently there:

1. **Cloud AI is disabled** — the `/api` routes need `server.js` running. Use it locally.
2. **Firebase sign-in** works on the Pages URL: `meriiieriii.github.io` is already listed under
   *Authentication → Settings → Authorized domains* in the Firebase console. Email/password
   sign-in was verified end to end from the live origin.

## Verification

- Engine modules pass `node --check`; production build compiles cleanly (68 modules, no errors)
- Route-level code splitting: initial bundle reduced from ~506 kB to ~416 kB, with the editor
  chunk (≈66 kB) loaded on demand
- Login/logout verified end to end in a real browser session
- Deblur verified with `js/test-deblur.js`: detail is measurably restored compared to the blurred input

---

<div align="center">
Built as a school project with React, plain JavaScript and the Canvas API.
</div>