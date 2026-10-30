# Deployment guide: Vercel (frontend + backend, free Hobby plan)

The whole app runs as **one Vercel project** on the free Hobby plan:

| Part | How Vercel runs it | Source |
|---|---|---|
| React frontend | Static site built by Vite | `frontend/` → `frontend/dist` |
| FastAPI backend | Python serverless function | `api/index.py` → re-exports `backend/app/main.py` |

Both are served from the **same domain**, so the browser calls `/api/v1/...` with no CORS setup and no API URL to configure. All the configuration is already in the repo; nothing needs editing before deploying.

```
Browser ──► https://<project>.vercel.app/            → frontend/dist (static, CDN)
        └─► https://<project>.vercel.app/api/v1/...   → api/index.py (FastAPI) ──► Elexon BMRS API
```

---

## 1. Is the free plan enough? Known limits

| Topic | Hobby plan | This app | OK? |
|---|---|---|---|
| Python serverless functions | Supported | One function (`api/index.py`) | ✅ |
| Function bundle size | 250 MB unzipped | About 130 MB (pandas about 81 MB, numpy about 34 MB, the rest under 15 MB) | ✅ |
| Function max duration | `maxDuration` up to 60 s on Hobby (set in `vercel.json`) | About 2–4 s on a cold start; about 20–50 ms once warm | ✅ |
| Cold starts | Idle functions are frozen and restart on the next request | First request after idle takes about 3–6 s (Python + pandas import, then 2 Elexon downloads) | ⚠️ Acceptable |
| In-memory cache | Each instance keeps its own memory; it's lost when the instance is recycled | The cache simply refills from Elexon | ⚠️ By design |
| Outbound internet | Allowed | Calls `data.elexon.co.uk` | ✅ |
| Docker | **Not used by Vercel** | Docker remains the local-run method (`docker compose up`) | ℹ️ See note |
| Usage terms | Hobby is for personal, non-commercial projects | A take-home assessment fits | ✅ |
| Cost | Free | No paid add-ons needed | ✅ |

**Docker note:** the brief asks for Docker *and* a Vercel or Heroku deployment. Vercel builds from source, not containers. Docker is therefore what reviewers use to run the app locally; the README already explains this. Say so in the technical video.

**Compared with Render's free plan:** Render would run the Docker image, but free services sleep after 15 minutes idle and take about a minute to wake. Vercel wakes in a few seconds, which suits a demo better.

---

## 2. Files that make it work

| File | Purpose |
|---|---|
| `vercel.json` | Builds the frontend (`cd frontend && npm ci && npm run build`) and serves `frontend/dist`. Gives `api/index.py` a 60 s timeout and bundles `backend/app/**` with it. Rewrites `/api/*` to the function and every other path to `index.html`, so page refreshes on client-side routes work. |
| `api/index.py` | Vercel entry point. Adds `backend/` to Python's import path and exposes `app`. |
| `requirements.txt` (repo root) | Python dependencies Vercel installs for the function. Keep it in sync with `backend/requirements.txt`. |
| `.python-version` | Requests Python 3.12. |
| `.vercelignore` | Keeps `node_modules`, `.venv`, tests and docs out of the upload. |

---

## 3. Step-by-step deployment

### Step 0: Before you start
- [ ] Tests pass: `cd backend && source .venv/bin/activate && pytest -q`
- [ ] Frontend builds: `cd frontend && npm run build`
- [ ] Your git working tree contains no `.env`, `.venv`, `node_modules` or `dist`. They are already listed in `.gitignore`.

### Step 1: Push the code to a public GitHub repo with an anonymous name
The brief asks for an anonymous repo name, e.g. `kjhwr`.
1. On GitHub, go to **New repository**. Name it something like `kjhwr`, make it **Public**, and leave "Add README" unticked.
2. From the project folder:
   ```bash
   cd gridbrick
   git init
   git add .
   git commit -m "GridBrick: wind forecast decision support"
   git branch -M main
   git remote add origin https://github.com/<your-username>/kjhwr.git
   git push -u origin main
   ```
3. Check on GitHub that the `api/`, `backend/` and `frontend/` folders and `vercel.json` are at the repository root.

### Step 2: Create a Vercel account
1. Go to <https://vercel.com/signup> and choose **Continue with GitHub**.
2. Choose the **Hobby** (free) plan when asked.

### Step 3: Import the repository
1. In the Vercel dashboard, click **Add New… → Project**.
2. Under **Import Git Repository**, find your repo (e.g. `kjhwr`) and click **Import**. If it's not listed, click **Adjust GitHub App Permissions** and grant access to that repo.

### Step 4: Configure the project
On the **Configure Project** screen:

| Setting | Value |
|---|---|
| Project Name | Anything neutral, e.g. `kjhwr`. This becomes `kjhwr.vercel.app` |
| Framework Preset | **Other** |
| Root Directory | **`./`** (the repository root, *not* `frontend`) |
| Build and Output Settings | Leave the overrides **off**. `vercel.json` supplies the install command, build command and output directory |
| Environment Variables | None required. Optional overrides are in §5 |

Then click **Deploy**.

> ⚠️ The Root Directory **must** be the repo root. If you set it to `frontend`, Vercel ignores `api/` and the backend won't be deployed.

### Step 5: Watch the build
The build log should show, roughly in order:
1. `npm ci` and `vite build` finishing with a `✓ built` message.
2. The Python function being built: dependencies installed from `requirements.txt`, then `api/index.py` bundled.
3. **Deployment completed**.

It takes about 1–3 minutes. If it fails, see §6.

### Step 6: Verify the deployment
Replace `<app>` with your domain, e.g. `kjhwr.vercel.app`.

| Check | Expected |
|---|---|
| `https://<app>/api/v1/health` | `{"status":"ok"}` |
| `https://<app>/api/v1/overview` | JSON with `kpis.mae_mw ≈ 2013`. The first call takes a few seconds |
| `https://<app>/api/v1/docs` | Swagger UI listing 6 endpoints |
| `https://<app>/` | Overview page with KPIs and the chart |
| `https://<app>/forecasts?date=2026-01-28`, then refresh the page | The page reloads without a 404, which confirms the SPA rewrite works |
| Click cutoff preset **09:20** on the Forecast vs Actual page | "Forecast run used" changes from 09:30 to 07:30 |
| **Export CSV** | A file downloads |
| The dark/light toggle | Theme switches and persists after a reload |

From the terminal:
```bash
curl -s https://<app>/api/v1/health
curl -s "https://<app>/api/v1/accuracy?cutoff=10:00" | head -c 300
```

### Step 7: Final submission checks
- [ ] Open the app URL in an **incognito** window. The brief requires checking access this way.
- [ ] Add the URL to `README.md`: replace `<add Vercel URL>`, then commit and push. Vercel redeploys automatically.
- [ ] Check that the GitHub repo is public by opening it in incognito.
- [ ] Before recording the video, load each page once so the function is warm.

---

## 4. Updating the app later
- Every `git push` to `main` triggers a **production** deployment automatically.
- Pushes to other branches or pull requests create **preview** URLs. These work the same way because frontend and API share each preview's domain.
- To roll back, go to **Deployments**, open a previous deployment's **⋯** menu and choose **Promote to Production**.

### Optional: deploy from the CLI instead
```bash
npm i -g vercel
cd gridbrick
vercel login
vercel            # first run: link/create the project, accept the detected settings → preview deploy
vercel --prod     # production deploy
vercel logs <deployment-url>   # view function logs
```

---

## 5. Optional environment variables
To set these, go to **Project → Settings → Environment Variables**, then redeploy. None are required.

| Name | Default | When to change |
|---|---|---|
| `CACHE_TTL_S` | `3600` | Longer cache lifetime per warm instance |
| `HTTP_TIMEOUT_S` | `30` | If Elexon is slow |
| `HTTP_MAX_RETRIES` | `3` | Retry count for Elexon 429, 5xx and network errors |
| `ELEXON_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1` | Only if Elexon moves its API |

`CORS_ORIGINS` isn't needed on Vercel, because the frontend and API share one origin.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/api/v1/health` returns **404** | Root Directory was set to `frontend`, or `api/` wasn't pushed | Set **Settings → General → Root Directory** to the repo root, check `api/index.py` is on GitHub, then redeploy |
| `/api/...` returns the HTML page instead of JSON | The rewrite order was changed | In `vercel.json`, the `/api/(.*)` rewrite must come **before** `/(.*)` |
| **500** with `ModuleNotFoundError: app` | `backend/app` wasn't bundled | Make sure `vercel.json` has `"includeFiles": "backend/app/**"` and `.vercelignore` doesn't exclude `backend/app` |
| **500** with `ModuleNotFoundError: pandas` (or similar) | Root `requirements.txt` is missing a package | Add it to the **root** `requirements.txt`, not only `backend/requirements.txt` |
| Build error: function size exceeds 250 MB | Extra heavy packages were added | Keep the root `requirements.txt` minimal (no pytest or uvicorn there) |
| UI shows "Elexon data is temporarily unavailable" (503) | Elexon was slow or down | Click **Retry**. Check `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream` directly |
| First load takes several seconds | Cold start plus the first Elexon download | Expected. Warm the app before demos |
| Function timeout (504) | Elexon is very slow | `maxDuration` is already 60 s, the Hobby maximum. Retry later |
| Refreshing `/accuracy` shows a 404 | The SPA fallback rewrite is missing | Make sure `{ "source": "/(.*)", "destination": "/index.html" }` is in `vercel.json` |

To see logs, go to **Project → Deployments → (deployment) → Functions / Logs**, or run `vercel logs <url>`.

---

## 7. Local run, for reference
Local runs don't involve Vercel:
```bash
docker compose up --build                     # frontend :5173, backend :8000
# or: uvicorn app.main:app --port 8000 (backend/)  +  npm run dev (frontend/)
```
