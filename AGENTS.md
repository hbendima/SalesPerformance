# SalesPerformance – Agent Instructions

Klium daily sales dashboard comparing **yesterday vs. same weekday last week**.  
See [README.md](README.md) for setup and endpoint overview.

## Architecture

| Layer | Stack | Port |
|-------|-------|------|
| Backend | Express 5 + `odbc` → SQL Server | 3001 |
| Frontend | React 19 + Vite | 5174 |

Frontend proxies `/api/*` to `http://localhost:3001` (configured in `frontend/vite.config.js`).

## Dev Commands

```bash
# Backend
cd backend && npm start          # production
cd backend && npm run dev        # nodemon (auto-reload)

# Frontend
cd frontend && npm run dev
```

Backend requires a `.env` file (copy from `.env.example`):
- `DB_SERVER` — SQL Server hostname (default: `ig11`)
- `DB_DATABASE` — database name (default: `Klium`)

## Backend Conventions (`backend/src/`)

- **`queryDb(sql)`** — opens a fresh ODBC connection per call (no pooling), runs the query, closes connection. Always `await` it and wrap in try/finally if reusing manually.
- **`safe(obj)`** — **must wrap every query result** before `res.json()`. Converts `BigInt` values (returned by SQL Server aggregates) to `Number`.
- **`getConnectionString()`** — builds the ODBC connection string from env vars. Uses Windows Authentication (`Trusted_Connection=yes`).
- All routes live in `backend/src/routes/salesPerformance.js` under the `/sales-performance/` prefix.

## Database

- SQL Server on `ig11`, database `Klium`
- Main view: `[Klium].[dbo].[V_AS400_ORDT_TEMP_5]`
- Comparison logic: `DATEADD(DAY,-1,GETDATE())` = yesterday, `DATEADD(DAY,-8,GETDATE())` = same weekday last week
- Domains are ordered: `Klium.be` → `Klium.nl` → `Klium.com`

## Frontend Conventions (`frontend/src/`)

- All UI is in a single component: `frontend/src/components/SalesPerformance.jsx`
- Formatting helpers at the top of the file: `EUR()` (€, `nl-BE`), `PCT()` (1 decimal %), `NUM()` (`nl-BE` integer)
- Inline styles only — no CSS framework, no CSS modules
- Labels and UI text are in **Dutch** (`Gisteren`, `Vorige week`, `Revenue`, `GM`, etc.)

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/routes/salesPerformance.js` | All 3 API routes + SQL queries |
| `frontend/src/components/SalesPerformance.jsx` | Entire dashboard UI |
| `frontend/vite.config.js` | Dev server port (5174) + API proxy |
