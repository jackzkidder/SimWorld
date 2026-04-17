# SimWorld

> Run the future before it happens.

SimWorld runs large-scale agent-based simulations to predict how audiences will react to scenarios — product launches, policy changes, crisis communications, campaign messaging — before you ship them into the real world.

**Website:** https://teal-kitsune-2dabd2.netlify.app
**Downloads:** https://github.com/jackzkidder/SimWorld/releases/latest

---

## Download

Pre-built installers for the latest release:

| Platform | File |
|----------|------|
| Windows  | `SimWorld_x.y.z_x64-setup.exe` |
| macOS (Apple Silicon) | `SimWorld_x.y.z_aarch64.dmg` |
| macOS (Intel) | `SimWorld_x.y.z_x64.dmg` |
| Linux | `SimWorld_x.y.z_amd64.AppImage` · `.deb` · `.rpm` |

Grab the one that matches your OS at [Releases](https://github.com/jackzkidder/SimWorld/releases/latest).

---

## Repository layout

This is a monorepo with three deployable pieces:

```
.
├── simworld/
│   ├── frontend/    Next.js 14 UI, bundled as a Tauri 2 desktop app
│   ├── backend/     FastAPI service (agent orchestration, LLM, billing)
│   └── website/     Marketing landing page (static HTML, deployed to Netlify)
├── .github/
│   └── workflows/   CI — release.yml builds Tauri installers on tag push
└── README.md
```

### `simworld/frontend` — desktop app

- **Framework:** Next.js 14 (App Router) + React 18
- **Shell:** Tauri 2 (Rust)
- **UI:** Tailwind CSS, Framer Motion, d3, Recharts
- **Build modes:**
  - `npm run dev` — Next dev server at localhost:3000
  - `npm run tauri:dev` — Tauri in dev mode (hot-reload desktop app)
  - `npm run tauri:build` — production installers for the current OS
  - `npm run build:desktop` — static Next export consumed by Tauri

### `simworld/backend` — API

- **Framework:** FastAPI + Uvicorn (Python 3.11)
- **Deployment:** Fly.io (`fly.toml` included)
- **Services:** Supabase (auth, storage), Stripe (billing), LLM provider (simulation)
- See `simworld/backend/README` and `simworld/DEPLOY.md` for setup.

### `simworld/website` — marketing

- Plain HTML/CSS/JS + [anime.js](https://animejs.com) for motion
- Netlify Forms for email capture (zero backend)
- Deploy: drag the `simworld/website/` folder onto https://app.netlify.com/drop

---

## Development

### Prerequisites

- **Node.js** ≥ 20
- **Rust** stable (via [rustup](https://rustup.rs))
- **Python** ≥ 3.11 (backend only)
- Platform toolchain for Tauri — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)

### Run the desktop app locally

```bash
cd simworld/frontend
npm install
npm run tauri:dev
```

First run pulls Rust crates and compiles the Tauri shell (~5 min). Subsequent runs are fast.

### Run the backend locally

```bash
cd simworld/backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in keys
uvicorn app.main:app --reload
```

---

## Releases

Releases are cut by pushing a tag matching `v*`:

```bash
git tag v0.2.0
git push origin v0.2.0
```

This triggers `.github/workflows/release.yml`, which builds installers for Windows, macOS (Apple Silicon + Intel), and Linux in parallel and attaches them to a new GitHub Release.

Before tagging, bump the version in:

- `simworld/frontend/package.json`
- `simworld/frontend/src-tauri/tauri.conf.json`
- `simworld/frontend/src-tauri/Cargo.toml`
- `VERSION` constant in `simworld/website/index.html`

---

## License

All rights reserved. Contact the maintainer for licensing.
