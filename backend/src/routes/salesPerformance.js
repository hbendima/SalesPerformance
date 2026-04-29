const express = require('express');
const odbc = require('odbc');
const router = express.Router();

function getConnectionString() {
  const server = process.env.DB_SERVER || 'ig11';
  const database = process.env.DB_DATABASE || 'Klium';
  return `DRIVER={SQL Server};SERVER=${server};DATABASE=${database};Trusted_Connection=yes;`;
}

async function queryDb(sql) {
  const connection = await odbc.connect(getConnectionString());
  try {
    return await connection.query(sql);
  } finally {
    await connection.close();
  }
}

// BigInt-safe serialisatie
function safe(obj) {
  if (Array.isArray(obj)) return obj.map(safe);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = typeof v === 'bigint' ? Number(v) : safe(v);
    }
    return out;
  }
  return obj;
}

// ── 1. Samenvatting ──────────────────────────────────────
router.get('/sales-performance/summary', async (req, res) => {
  const sql = `
    SELECT
      CASE
        WHEN CONVERT(DATE,[OrderDate]) = CONVERT(DATE,GETDATE())              THEN 'Vandaag'
        WHEN CONVERT(DATE,[OrderDate]) = CONVERT(DATE,DATEADD(DAY,-1,GETDATE())) THEN 'Gisteren'
        WHEN CONVERT(DATE,[OrderDate]) = CONVERT(DATE,DATEADD(DAY,-8,GETDATE())) THEN 'Vorige week'
      END                                                         AS Dag,
      CONVERT(DATE,[OrderDate])                                   AS Datum,
      COUNT(DISTINCT [OrderID])                                   AS Orders,
      SUM([LineCountOE])                                          AS Lines,
      ROUND(SUM([TotalPrice]),2)                                  AS Revenue,
      ROUND(SUM([TotalPrice])-SUM([TotalCost]),2)                 AS GM,
      CASE WHEN SUM([TotalPrice])<>0
           THEN ROUND((SUM([TotalPrice])-SUM([TotalCost]))/SUM([TotalPrice])*100,2)
           ELSE 0 END                                             AS GMPct,
      ROUND(SUM([TotalPrice])/NULLIF(COUNT(DISTINCT [OrderID]),0),2) AS GemOrder,
      ROUND(SUM([TotalPrice])/NULLIF(SUM([LineCountOE]),0),2)       AS GemLijn
    FROM [Klium].[dbo].[V_AS400_ORDT_TEMP_5]
    WHERE CONVERT(DATE,[OrderDate]) IN (
        CONVERT(DATE,GETDATE()),
        CONVERT(DATE,DATEADD(DAY,-1,GETDATE())),
        CONVERT(DATE,DATEADD(DAY,-8,GETDATE()))
    )
      AND [HGSG] NOT IN (9990)
    GROUP BY CONVERT(DATE,[OrderDate])
    ORDER BY Datum DESC
  `;
  try {
    res.json(safe(await queryDb(sql)));
  } catch (err) {
    console.error('summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. Per domein ─────────────────────────────────────────
router.get('/sales-performance/domains', async (req, res) => {
  const sql = `
    SELECT
      CASE
        WHEN CONVERT(DATE,[OrderDate]) = CONVERT(DATE,GETDATE())              THEN 'Vandaag'
        WHEN CONVERT(DATE,[OrderDate]) = CONVERT(DATE,DATEADD(DAY,-1,GETDATE())) THEN 'Gisteren'
        WHEN CONVERT(DATE,[OrderDate]) = CONVERT(DATE,DATEADD(DAY,-8,GETDATE())) THEN 'Vorige week'
      END                                                         AS Dag,
      CONVERT(DATE,[OrderDate])                                   AS Datum,
      [Domain],
      COUNT(DISTINCT [OrderID])                                   AS Orders,
      SUM([LineCountOE])                                          AS Lines,
      ROUND(SUM([TotalPrice]),2)                                  AS Revenue,
      ROUND(SUM([TotalPrice])-SUM([TotalCost]),2)                 AS GM,
      CASE WHEN SUM([TotalPrice])<>0
           THEN ROUND((SUM([TotalPrice])-SUM([TotalCost]))/SUM([TotalPrice])*100,2)
           ELSE 0 END                                             AS GMPct,
      ROUND(SUM([TotalPrice])/NULLIF(COUNT(DISTINCT [OrderID]),0),2) AS GemOrder,
      ROUND(SUM([TotalPrice])/NULLIF(SUM([LineCountOE]),0),2)       AS GemLijn
    FROM [Klium].[dbo].[V_AS400_ORDT_TEMP_5]
    WHERE CONVERT(DATE,[OrderDate]) IN (
        CONVERT(DATE,GETDATE()),
        CONVERT(DATE,DATEADD(DAY,-1,GETDATE())),
        CONVERT(DATE,DATEADD(DAY,-8,GETDATE()))
    )
      AND [HGSG] NOT IN (9990)
    GROUP BY CONVERT(DATE,[OrderDate]),[Domain]
    ORDER BY
      Datum DESC,
      CASE
        WHEN [Domain]='Klium.be'  THEN 1
        WHEN [Domain]='Klium.nl'  THEN 2
        WHEN [Domain]='Klium.com' THEN 3
        ELSE 4
      END
  `;
  try {
    res.json(safe(await queryDb(sql)));
  } catch (err) {
    console.error('domains error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 3. Top 10 producten ───────────────────────────────────
router.get('/sales-performance/top-products', async (req, res) => {
  const sql = `
    SELECT Dag,Datum,Brand,CallName,Orders,Qty,Revenue,GM,GMPct
    FROM (
      SELECT
        CASE
          WHEN CONVERT(DATE,[OrderDate])=CONVERT(DATE,GETDATE())              THEN 'Vandaag'
          WHEN CONVERT(DATE,[OrderDate])=CONVERT(DATE,DATEADD(DAY,-1,GETDATE())) THEN 'Gisteren'
          WHEN CONVERT(DATE,[OrderDate])=CONVERT(DATE,DATEADD(DAY,-8,GETDATE())) THEN 'Vorige week'
        END                                                       AS Dag,
        CONVERT(DATE,[OrderDate])                                 AS Datum,
        MIN(v.[Brand])                                            AS Brand,
        v.[CallName],
        COUNT(DISTINCT v.[OrderID])                               AS Orders,
        SUM(v.[OrderAmount])                                      AS Qty,
        ROUND(SUM(v.[TotalPrice]),2)                              AS Revenue,
        ROUND(SUM(v.[TotalPrice])-SUM(v.[TotalCost]),2)           AS GM,
        CASE WHEN SUM(v.[TotalPrice])<>0
             THEN ROUND((SUM(v.[TotalPrice])-SUM(v.[TotalCost]))/SUM(v.[TotalPrice])*100,2)
             ELSE 0 END                                           AS GMPct,
        ROW_NUMBER() OVER (
          PARTITION BY CONVERT(DATE,v.[OrderDate])
          ORDER BY SUM(v.[TotalPrice]) DESC
        )                                                         AS Rank
      FROM [Klium].[dbo].[V_AS400_ORDT_TEMP_5] v
      WHERE CONVERT(DATE,v.[OrderDate]) IN (
          CONVERT(DATE,GETDATE()),
          CONVERT(DATE,DATEADD(DAY,-1,GETDATE())),
          CONVERT(DATE,DATEADD(DAY,-8,GETDATE()))
      )
        AND v.[ProductType]='PRODUCT'
        AND v.[HGSG] NOT IN (9990)
      GROUP BY CONVERT(DATE,v.[OrderDate]),v.[CallName]
    ) ranked
    WHERE Rank<=10
    ORDER BY Datum DESC,Revenue DESC
  `;
  try {
    res.json(safe(await queryDb(sql)));
  } catch (err) {
    console.error('top-products error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 4. Orderlijnen per product ────────────────────────────
router.get('/sales-performance/product-orders', async (req, res) => {
  const { productId, dag } = req.query;

  const dagDateMap = {
    'Vandaag':     'CONVERT(DATE,GETDATE())',
    'Gisteren':    'CONVERT(DATE,DATEADD(DAY,-1,GETDATE()))',
    'Vorige week': 'CONVERT(DATE,DATEADD(DAY,-8,GETDATE()))',
  };

  if (!productId || !dagDateMap[dag]) {
    return res.status(400).json({ error: 'Ongeldige parameters' });
  }

  const dateExpr = dagDateMap[dag];
  const sql = `
    SELECT
      [InvoiceID]                                                       AS Referentie,
      [Company]                                                         AS Klant,
      SUM([OrderAmount])                                                AS Qty,
      ROUND(SUM([TotalPrice]),2)                                        AS Revenue,
      ROUND(SUM([TotalPrice])-SUM([TotalCost]),2)                       AS GM,
      CASE WHEN SUM([TotalPrice])<>0
           THEN ROUND((SUM([TotalPrice])-SUM([TotalCost]))/SUM([TotalPrice])*100,2)
           ELSE 0 END                                                   AS GMPct
    FROM [Klium].[dbo].[V_AS400_ORDT_TEMP_5]
    WHERE [ProductID] = ?
      AND CONVERT(DATE,[OrderDate]) = ${dateExpr}
      AND [HGSG] NOT IN (9990)
    GROUP BY [InvoiceID],[Company]
    ORDER BY Revenue DESC
  `;

  let connection;
  try {
    connection = await odbc.connect(getConnectionString());
    const result = await connection.query(sql, [productId]);
    res.set('Cache-Control', 'no-store');
    res.json(safe(result));
  } catch (err) {
    console.error('product-orders error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// ── 5. Individuele producten per CallName ─────────────────
router.get('/sales-performance/callname-products', async (req, res) => {
  const { callName, dag } = req.query;

  const dagDateMap = {
    'Vandaag':     'CONVERT(DATE,GETDATE())',
    'Gisteren':    'CONVERT(DATE,DATEADD(DAY,-1,GETDATE()))',
    'Vorige week': 'CONVERT(DATE,DATEADD(DAY,-8,GETDATE()))',
  };

  if (!callName || !dagDateMap[dag]) {
    return res.status(400).json({ error: 'Ongeldige parameters' });
  }

  const dateExpr = dagDateMap[dag];
  const sql = `
    SELECT
      RTRIM(v.[ProductID])                                              AS ProductID,
      v.[Brand]                                                         AS Brand,
      n.[productname]                                                   AS ProductName,
      n.[title_suffix]                                                  AS TitleSuffix,
      SUM(v.[OrderAmount])                                              AS Qty,
      ROUND(SUM(v.[TotalPrice]),2)                                      AS Revenue,
      ROUND(SUM(v.[TotalPrice])-SUM(v.[TotalCost]),2)                   AS GM,
      CASE WHEN SUM(v.[TotalPrice])<>0
           THEN ROUND((SUM(v.[TotalPrice])-SUM(v.[TotalCost]))/SUM(v.[TotalPrice])*100,2)
           ELSE 0 END                                                   AS GMPct
    FROM [Klium].[dbo].[V_AS400_ORDT_TEMP_5] v
    LEFT JOIN [Klium].[dbo].[PS_NAMEBUILDER] n ON n.[reference] = RTRIM(v.[ProductID])
    WHERE v.[CallName] = ?
      AND CONVERT(DATE,v.[OrderDate]) = ${dateExpr}
      AND v.[ProductType]='PRODUCT'
      AND v.[HGSG] NOT IN (9990)
    GROUP BY RTRIM(v.[ProductID]),v.[Brand],n.[productname],n.[title_suffix]
    ORDER BY Revenue DESC
  `;

  let connection;
  try {
    connection = await odbc.connect(getConnectionString());
    const result = await connection.query(sql, [callName]);
    res.set('Cache-Control', 'no-store');
    res.json(safe(result));
  } catch (err) {
    console.error('callname-products error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// ── 6. Daily Revenue ──────────────────────────────────────
router.get('/sales-performance/daily-revenue', async (req, res) => {
  // Optionele ?month=YYYY-MM param; standaard = huidige maand t/m vandaag
  const monthParam = req.query.month;
  let dateFilter;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const start = `CONVERT(DATE,'${monthParam}-01')`;
    // Huidige maand → t/m vandaag; andere maanden → volledige maand
    const curYM = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })();
    if (monthParam === curYM) {
      dateFilter = `[C].[Date] >= ${start} AND [C].[Date] <= CAST(GETDATE() AS DATE)`;
    } else {
      dateFilter = `[C].[Date] >= ${start} AND [C].[Date] < DATEADD(MONTH,1,${start})`;
    }
  } else {
    dateFilter = `[C].[Date] >= DATEADD(MONTH,DATEDIFF(MONTH,0,GETDATE()),0) AND [C].[Date] <= CAST(GETDATE() AS DATE)`;
  }

  const sql = `
    SELECT
      FORMAT([C].[Date], 'd/MMM', 'nl-BE')                        AS Datum,
      ISNULL(ROUND([OE].[OE], 0), 0)                              AS OrderEntry,
      ISNULL(ROUND([B].[DailyBudget], 0), 0)                      AS DailyBudget,
      CASE WHEN [OE].[OE] IS NOT NULL
           THEN ROUND([OE].[GM OE%] * 100, 2) ELSE NULL END       AS MarginPct
    FROM [Klium].[dbo].[Z_CALENDAR] [C]
    LEFT JOIN [Klium].[dbo].[V_OE_TEMP_0] [OE]
      ON  [C].[Date] = [OE].[OrderDate]
    LEFT JOIN [Klium].[dbo].[V_BUDGET_2] [B]
      ON  [C].[FirstOfMonth] = [B].[Date]
    WHERE ${dateFilter}
    ORDER BY [C].[Date] ASC
  `;
  try {
    res.set('Cache-Control', 'no-store');
    res.json(safe(await queryDb(sql)));
  } catch (err) {
    console.error('daily-revenue error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
