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
        CONVERT(DATE,DATEADD(DAY,-1,GETDATE())),
        CONVERT(DATE,DATEADD(DAY,-8,GETDATE()))
    )
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
        CONVERT(DATE,DATEADD(DAY,-1,GETDATE())),
        CONVERT(DATE,DATEADD(DAY,-8,GETDATE()))
    )
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
    SELECT Dag,Datum,ProductID,Brand,CallName,Orders,Qty,Revenue,GM,GMPct
    FROM (
      SELECT
        CASE
          WHEN CONVERT(DATE,[OrderDate])=CONVERT(DATE,DATEADD(DAY,-1,GETDATE())) THEN 'Gisteren'
          WHEN CONVERT(DATE,[OrderDate])=CONVERT(DATE,DATEADD(DAY,-8,GETDATE())) THEN 'Vorige week'
        END                                                       AS Dag,
        CONVERT(DATE,[OrderDate])                                 AS Datum,
        [ProductID],[Brand],[CallName],
        COUNT(DISTINCT [OrderID])                                 AS Orders,
        SUM([OrderAmount])                                        AS Qty,
        ROUND(SUM([TotalPrice]),2)                                AS Revenue,
        ROUND(SUM([TotalPrice])-SUM([TotalCost]),2)               AS GM,
        CASE WHEN SUM([TotalPrice])<>0
             THEN ROUND((SUM([TotalPrice])-SUM([TotalCost]))/SUM([TotalPrice])*100,2)
             ELSE 0 END                                           AS GMPct,
        ROW_NUMBER() OVER (
          PARTITION BY CONVERT(DATE,[OrderDate])
          ORDER BY SUM([TotalPrice]) DESC
        )                                                         AS Rank
      FROM [Klium].[dbo].[V_AS400_ORDT_TEMP_5]
      WHERE CONVERT(DATE,[OrderDate]) IN (
          CONVERT(DATE,DATEADD(DAY,-1,GETDATE())),
          CONVERT(DATE,DATEADD(DAY,-8,GETDATE()))
      )
        AND [ProductType]='PRODUCT'
      GROUP BY CONVERT(DATE,[OrderDate]),[ProductID],[Brand],[CallName]
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

module.exports = router;
