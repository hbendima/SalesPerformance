# SalesPerformance

Klium dagelijks verkoop dashboard — Gisteren vs. zelfde weekdag vorige week.

## Structuur

```
backend/   → Express API (Node.js + ODBC → SQL Server ig11)
frontend/  → React/Vite dashboard
```

## Backend starten

```bash
cd backend
cp .env.example .env
npm install
npm start
```

## Frontend starten

```bash
cd frontend
npm install
npm run dev
```

## Endpoints

| Endpoint | Beschrijving |
|---|---|
| `GET /api/sales-performance/summary` | Totaal per dag |
| `GET /api/sales-performance/domains` | Per domein (.be/.nl/.com) |
| `GET /api/sales-performance/top-products` | Top 10 producten per dag |
