# INCOIS Ocean Explorer

**SIH 2026** — Interactive 3D ocean intelligence platform: an immersive
Three.js globe (frontend) served by a real-data-only FastAPI backend (GODAS,
WW3, INCOIS LAS, Copernicus, Argo, Gliders, OMNI buoys).

> **Data policy — no synthetic data.** Every endpoint serves real model/analysis
> or observation data from locally mirrored caches. When a source is not yet
> provisioned, the API returns `HTTP 503 DATA_NOT_AVAILABLE` instead of
> fabricating values.

## Project layout

```
incois-ocean-explorer/
├── frontend/            React 19 + Vite + Three.js interactive globe
├── backend/             FastAPI data API (real data only)
│   ├── app/             routes, adapters, services
│   ├── scripts/         real-data fetch pipelines
│   └── data/            real cached data (GODAS NetCDF, WW3, GDAC mirrors)
├── docker/ + docker-compose.yml   container builds (backend + frontend)
├── scripts/             out-of-app helpers
└── docs/                architecture, data sources, deployment
```

## 1. Run the backend (port 8000)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- Health: http://localhost:8000/api/health → `{"status":"online",...}`
- API docs: http://localhost:8000/docs
- Real data ships with the bundle: currents (`/api/data?dataset=godas_indian_ocean`)
  and waves (`/api/wave`) work immediately.

## 2. Run the frontend (port 5173)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8000` (see
`frontend/vite.config.ts`). For a different backend, set `VITE_API_BASE_URL`.

## 3. Docker (both services)

```bash
docker compose up --build           # backend :8000, frontend :3000
```

## 4. Production build (frontend)

```bash
cd frontend
npm run build                       # tsc -b && vite build → dist/
npm run preview
```

## 5. Provisioning real data (fetch pipelines)

`backend/scripts/` contains the real-data harvesters. Each caches into
`backend/data/incois/`; the API returns 503 until a source's cache exists:

| Source | Cache | Script |
|--------|-------|--------|
| GODAS reanalysis | `data/model_db/godas/*.nc` | `fetch_godas_sample.py` (ships with bundle) |
| WW3 global waves | `data/model_db/wave/ww3_snapshot.json` | `fetch_ww3_waves.py` |
| Argo GDAC profile index | `data/incois/argo/profiles_index.json` | `fetch_argo_gdac.py` |
| Glider GDAC tracks | `data/incois/gliders/manifest.json` | `fetch_glider_gdac.py` |
| INCOIS LAS (slabs) | `data/incois/las_incois/` | `fetch_las_incois.py` |
| Copernicus GLOBAL_MULTIYEAR_PHY_001_030 | `data/incois/copernicus_phy_001_030/` | `fetch_copernicus.py` |
| INCOIS OMNI buoys | `data/incois/omni/manifest.json` | `fetch_insitu_incois.py` |

## Real data provenance

- **GODAS** — NCEP Global Ocean Data Assimilation System reanalysis (real),
  depth-resolved NetCDF.
- **WW3** — NOAA/NCEP WAVEWATCH III global wave model (real) snapshot.
- **Argo / Gliders** — Ifremer GDAC (`ftp://ftp.ifremer.fr/ifremer/argo`,
  `.../glider/v2/`), positions mirrored as GeoJSON/JSON caches.
- **INCOIS LAS / Copernicus** — slab extracts of
  `las.incois.gov.in` and `GLOBAL_MULTIYEAR_PHY_001_030`.
- **Coastlines** — Natural Earth 50 m, baked into `frontend/public/assets`.

See `docs/ARCHITECTURE.md` and `docs/DATA_SOURCES.md` for details.