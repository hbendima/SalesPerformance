import React, { useEffect, useState } from 'react';

const EUR = (v) =>
  v == null ? '—' : '€\u00a0' + Number(v).toLocaleString('nl-BE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PCT = (v) => (v == null ? '—' : Number(v).toFixed(1) + '\u00a0%');
const NUM = (v) => (v == null ? '—' : Number(v).toLocaleString('nl-BE'));

const DAYS = ['Gisteren', 'Vorige week'];

// ── KPI kaart ────────────────────────────────────────────
function KpiCard({ label, value, sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 22px',
      minWidth: 150, flex: '1 1 150px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.08)'
    }}>
      <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.82rem', color: '#666', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Samenvatting blok ────────────────────────────────────
function SummaryBlock({ row, dag }) {
  const color = dag === 'Gisteren' ? '#1a1a2e' : '#4a4a6a';
  if (!row) return (
    <div style={{ color: '#bbb', fontStyle: 'italic', padding: '16px 0' }}>Geen data beschikbaar</div>
  );
  return (
    <div>
      <div style={{ display: 'inline-block', background: color, color: '#fff', borderRadius: 6, padding: '3px 12px', fontSize: '0.82rem', fontWeight: 700, marginBottom: 14 }}>
        {dag} &mdash; {row.Datum}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard label="Revenue"    value={EUR(row.Revenue)} />
        <KpiCard label="GM €"       value={EUR(row.GM)} sub={PCT(row.GMPct)} />
        <KpiCard label="Orders"     value={NUM(row.Orders)} sub={`gem. ${EUR(row.GemOrder)}`} />
        <KpiCard label="Lines"      value={NUM(row.Lines)} sub={`gem. ${EUR(row.GemLijn)}`} />
      </div>
    </div>
  );
}

// ── Domein tabel ─────────────────────────────────────────
function DomainTable({ rows }) {
  if (!rows?.length) return <div style={{ color: '#bbb', fontStyle: 'italic' }}>Geen data</div>;

  const th = { padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e8e8e8', fontSize: '0.8rem', fontWeight: 700, color: '#666', whiteSpace: 'nowrap' };
  const td = { padding: '9px 14px', borderBottom: '1px solid #f2f2f2', fontSize: '0.92rem' };
  const tdr = { ...td, textAlign: 'right' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={th}>Dag</th>
            <th style={th}>Domein</th>
            <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
            <th style={{ ...th, textAlign: 'right' }}>GM €</th>
            <th style={{ ...th, textAlign: 'right' }}>GM %</th>
            <th style={{ ...th, textAlign: 'right' }}>Orders</th>
            <th style={{ ...th, textAlign: 'right' }}>Lines</th>
            <th style={{ ...th, textAlign: 'right' }}>Gem. Order</th>
            <th style={{ ...th, textAlign: 'right' }}>Gem. Lijn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={td}>
                <span style={{
                  background: r.Dag === 'Gisteren' ? '#1a1a2e' : '#e0e0ec',
                  color: r.Dag === 'Gisteren' ? '#fff' : '#444',
                  borderRadius: 5, padding: '2px 9px', fontSize: '0.76rem', fontWeight: 700
                }}>{r.Dag}</span>
              </td>
              <td style={{ ...td, fontWeight: 600 }}>{r.Domain}</td>
              <td style={tdr}>{EUR(r.Revenue)}</td>
              <td style={tdr}>{EUR(r.GM)}</td>
              <td style={{ ...tdr, color: r.GMPct < 20 ? '#c62828' : r.GMPct > 35 ? '#2e7d32' : '#333', fontWeight: 600 }}>{PCT(r.GMPct)}</td>
              <td style={tdr}>{NUM(r.Orders)}</td>
              <td style={tdr}>{NUM(r.Lines)}</td>
              <td style={tdr}>{EUR(r.GemOrder)}</td>
              <td style={tdr}>{EUR(r.GemLijn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Top 10 tabel ─────────────────────────────────────────
function TopProductsTable({ rows, dag }) {
  const filtered = (rows || []).filter(r => r.Dag === dag);
  if (!filtered.length) return <div style={{ color: '#bbb', fontStyle: 'italic' }}>Geen data</div>;

  const th = { padding: '9px 12px', textAlign: 'left', borderBottom: '2px solid #e8e8e8', fontSize: '0.78rem', fontWeight: 700, color: '#666' };
  const td = { padding: '8px 12px', borderBottom: '1px solid #f2f2f2', fontSize: '0.88rem' };
  const tdr = { ...td, textAlign: 'right' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ ...th, width: 32 }}>#</th>
            <th style={th}>Merk</th>
            <th style={th}>Product</th>
            <th style={{ ...th, textAlign: 'right' }}>Qty</th>
            <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
            <th style={{ ...th, textAlign: 'right' }}>GM €</th>
            <th style={{ ...th, textAlign: 'right' }}>GM %</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ ...td, color: '#bbb', fontWeight: 700, fontSize: '0.82rem' }}>{i + 1}</td>
              <td style={{ ...td, color: '#555' }}>{r.Brand}</td>
              <td style={td} title={r.ProductID}>{r.CallName || r.ProductID}</td>
              <td style={tdr}>{NUM(r.Qty)}</td>
              <td style={tdr}>{EUR(r.Revenue)}</td>
              <td style={tdr}>{EUR(r.GM)}</td>
              <td style={{ ...tdr, color: r.GMPct < 0 ? '#c62828' : r.GMPct > 35 ? '#2e7d32' : '#333', fontWeight: 600 }}>{PCT(r.GMPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sectie titel ─────────────────────────────────────────
function Section({ title }) {
  return (
    <div style={{
      fontSize: '0.78rem', fontWeight: 800, color: '#888', textTransform: 'uppercase',
      letterSpacing: '1px', margin: '32px 0 14px', paddingBottom: 8,
      borderBottom: '2px solid #e8e8e8'
    }}>{title}</div>
  );
}

// ── Hoofd component ───────────────────────────────────────
export default function SalesPerformance() {
  const [summary, setSummary] = useState([]);
  const [domains, setDomains] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [activeTab, setActiveTab] = useState('Gisteren');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d, p] = await Promise.all([
        fetch('/api/sales-performance/summary').then(r => r.json()),
        fetch('/api/sales-performance/domains').then(r => r.json()),
        fetch('/api/sales-performance/top-products').then(r => r.json()),
      ]);
      if (s.error) throw new Error(s.error);
      setSummary(s);
      setDomains(d);
      setTopProducts(p);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getRow = (dag) => summary.find(r => r.Dag === dag);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#111', marginBottom: 4 }}>
            Verkoop Performance
          </h1>
          <div style={{ color: '#888', fontSize: '0.88rem' }}>
            Gisteren vs. zelfde weekdag vorige week
            {lastRefresh && <span style={{ marginLeft: 10 }}>· {lastRefresh.toLocaleTimeString('nl-BE')}</span>}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: '#1a1a2e', color: '#fff', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            fontSize: '0.9rem'
          }}
        >
          {loading ? 'Laden…' : '↻ Vernieuwen'}
        </button>
      </div>

      {/* Fout */}
      {error && (
        <div style={{ background: '#fdecea', color: '#c62828', padding: '14px 18px', borderRadius: 10, margin: '16px 0', fontWeight: 600 }}>
          Fout: {error}
        </div>
      )}

      {/* Inhoud */}
      {loading && !error && (
        <div style={{ textAlign: 'center', padding: 80, color: '#bbb', fontSize: '1.1rem' }}>
          Data wordt geladen…
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Samenvatting */}
          <Section title="Samenvatting" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {DAYS.map(dag => <SummaryBlock key={dag} row={getRow(dag)} dag={dag} />)}
          </div>

          {/* Per domein */}
          <Section title="Per domein" />
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <DomainTable rows={domains} />
          </div>

          {/* Top 10 producten */}
          <Section title="Top 10 producten" />
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {DAYS.map(dag => (
                <button
                  key={dag}
                  onClick={() => setActiveTab(dag)}
                  style={{
                    padding: '6px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.85rem',
                    background: activeTab === dag ? '#1a1a2e' : '#e8e8e8',
                    color: activeTab === dag ? '#fff' : '#555'
                  }}
                >{dag}</button>
              ))}
            </div>
            <TopProductsTable rows={topProducts} dag={activeTab} />
          </div>
        </>
      )}
    </div>
  );
}
