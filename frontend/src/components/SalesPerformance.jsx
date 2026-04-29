import React, { useEffect, useState } from 'react';
import { BarChart, Bar, ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Brush } from 'recharts';

const EUR = (v) =>
  v == null ? '—' : '€\u00a0' + Number(v).toLocaleString('nl-BE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PCT = (v) => (v == null ? '—' : Number(v).toFixed(1) + '\u00a0%');
const NUM = (v) => (v == null ? '—' : Number(v).toLocaleString('nl-BE'));

const DAYS = ['Vandaag', 'Gisteren', 'Vorige week'];

const DAG_STYLE = {
  'Vandaag':     { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', shadow: '0 3px 10px rgba(245,158,11,0.3)' },
  'Gisteren':    { bg: 'linear-gradient(135deg,#4f8ef7,#1a56db)', shadow: '0 3px 10px rgba(79,142,247,0.3)' },
  'Vorige week': { bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', shadow: '0 3px 10px rgba(139,92,246,0.3)' },
};

// 12% = groen, lager = geleidelijk roder, hoger = dieper groen
function gmColor(pct) {
  if (pct == null) return '#374151';
  if (pct < 0) return '#991b1b';
  if (pct >= 12) {
    const t = Math.min((pct - 12) / 15, 1);
    return `hsl(${142 + t * 10}, ${72 + t * 10}%, ${40 - t * 4}%)`;
  }
  const hue = Math.round((pct / 12) * 142); // 0→rood (0°), 12→groen (142°)
  return `hsl(${hue}, 80%, 42%)`;
}

const DOMAIN_COLORS = {
  'Klium.be':  { bg: '#e5e7eb', color: '#111827', bar: '#111827' },
  'Klium.nl':  { bg: '#fff7ed', color: '#c2410c', bar: '#f97316' },
  'Klium.com': { bg: '#e0e7ff', color: '#1e3a8a', bar: '#1e40af' },
};

// ── Month helpers ────────────────────────────────────────
const curYM = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; };
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function fmtMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f0f3fa; font-family: 'Inter', system-ui, sans-serif; }

  /* KPI cards */
  .kpi-card { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease; }
  .kpi-card:hover { transform: translateY(-5px) scale(1.01); box-shadow: 0 16px 40px rgba(15,23,41,0.15) !important; }

  /* Table rows */
  .domain-row { transition: background 0.12s; }
  .domain-row:hover td { background: #f0f4ff !important; }
  .product-row { cursor: pointer; transition: background 0.12s; }
  .product-row:hover td { background: #f0f4ff !important; }
  .product-row:hover .product-hint { opacity: 1 !important; }
  .product-row:active td { background: #e0e7ff !important; }
  .product-hint { opacity: 0; transition: opacity 0.15s; }

  /* Buttons */
  .refresh-btn { transition: all 0.18s ease; }
  .refresh-btn:hover:not(:disabled) { background: rgba(255,255,255,0.18) !important; transform: scale(1.03); box-shadow: 0 6px 20px rgba(0,0,0,0.25) !important; }
  .tab-pill { transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
  .tab-pill:hover { transform: translateY(-2px); }

  /* Animations */
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards; }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes slideUp { from { opacity:0; transform:scale(0.92) translateY(24px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes spin { to { transform:rotate(360deg); } }
  .spinner { animation: spin 0.8s linear infinite; display:inline-block; }
  @keyframes livePulse { 0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,0.6); } 60% { box-shadow:0 0 0 7px rgba(16,185,129,0); } }
  .live-dot { animation: livePulse 2.2s ease infinite; }

  /* Scrollbar */
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:99px; }
  ::-webkit-scrollbar-thumb:hover { background:#9ca3af; }

  /* Stagger */
  .stagger-0 { animation: fadeUp 0.45s ease 0.00s both; }
  .stagger-1 { animation: fadeUp 0.45s ease 0.09s both; }
  .stagger-2 { animation: fadeUp 0.45s ease 0.18s both; }
`;

// ── Delta badge ───────────────────────────────────────────
function Delta({ current, previous }) {
  if (current == null || previous == null || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      background: up ? '#d1fae5' : '#fee2e2',
      color: up ? '#065f46' : '#991b1b',
      borderRadius: 20, padding: '2px 8px',
      fontSize: '0.72rem', fontWeight: 700, marginLeft: 8
    }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── KPI kaart ────────────────────────────────────────────
function KpiCard({ label, value, sub, accentColor, current, previous }) {
  const accent = accentColor || '#4f8ef7';
  return (
    <div className="kpi-card" style={{
      background: `linear-gradient(145deg,#ffffff,#f5f7ff)`,
      borderRadius: 14, padding: '20px 22px',
      minWidth: 160, flex: '1 1 160px',
      boxShadow: `0 2px 12px rgba(15,23,41,0.07), inset 0 1px 0 rgba(255,255,255,0.8)`,
      borderTop: `3px solid ${accent}`,
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', right: -14, top: -14, width: 72, height: 72,
        borderRadius: '50%', background: accent, opacity: 0.07
      }} />
      <div style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 9 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f1729', lineHeight: 1 }}>{value}</span>
        {current != null && previous != null && <Delta current={current} previous={previous} />}
      </div>
      {sub && <div style={{ fontSize: '0.79rem', color: '#6b7280', marginTop: 7, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

// ── Samenvatting blok ────────────────────────────────────
function SummaryBlock({ row, dag, compareRow }) {
  const accentColors = ['#4f8ef7', '#10b981', '#f59e0b', '#8b5cf6'];
  const ds = DAG_STYLE[dag] || DAG_STYLE['Vorige week'];
  // Vandaag is een lopende dag: delta tonen t.o.v. gisteren is misleidend
  const showDelta = compareRow != null && dag !== 'Vandaag';

  if (!row) return (
    <div style={{ color: '#9ca3af', fontStyle: 'italic', padding: '16px 0' }}>Geen data beschikbaar</div>
  );
  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ background: ds.bg, color: '#fff', borderRadius: 8, padding: '5px 14px', fontSize: '0.82rem', fontWeight: 700, boxShadow: ds.shadow }}>
          {dag}
        </div>
        <span style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 500 }}>{row.Datum}</span>
        {dag === 'Vandaag' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', background: '#ecfdf5', color: '#065f46', borderRadius: 99, padding: '2px 9px', fontWeight: 700 }}>
            <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
            lopende dag
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KpiCard label="Revenue" value={EUR(row.Revenue)} accentColor={accentColors[0]}
          current={showDelta ? row.Revenue : null} previous={compareRow?.Revenue} />
        <KpiCard label="GM" value={EUR(row.GM)} accentColor={accentColors[1]}
          sub={PCT(row.GMPct)}
          current={showDelta ? row.GM : null} previous={compareRow?.GM} />
        <KpiCard label="Orders" value={NUM(row.Orders)} accentColor={accentColors[2]}
          sub={`gem. ${EUR(row.GemOrder)}`}
          current={showDelta ? row.Orders : null} previous={compareRow?.Orders} />
        <KpiCard label="Lines" value={NUM(row.Lines)} accentColor={accentColors[3]}
          sub={`gem. ${EUR(row.GemLijn)}`}
          current={showDelta ? row.Lines : null} previous={compareRow?.Lines} />
      </div>
    </div>
  );
}

// ── Domein tabel ─────────────────────────────────────────
function DomainTable({ rows }) {
  if (!rows?.length) return <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Geen data</div>;

  // Aandeel = % van het dagelijks totaal (per Datum)
  const totalByDate = {};
  rows.forEach(r => { totalByDate[r.Datum] = (totalByDate[r.Datum] || 0) + (r.Revenue || 0); });

  const th = { padding: '11px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e5e7eb', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
  const td = { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', verticalAlign: 'middle' };
  const tdr = { ...td, textAlign: 'right' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Dag</th>
            <th style={th}>Domein</th>
            <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
            <th style={{ ...th, minWidth: 120 }}>Aandeel</th>
            <th style={{ ...th, textAlign: 'right' }}>GM €</th>
            <th style={{ ...th, textAlign: 'right' }}>GM %</th>
            <th style={{ ...th, textAlign: 'right' }}>Orders</th>
            <th style={{ ...th, textAlign: 'right' }}>Lines</th>
            <th style={{ ...th, textAlign: 'right' }}>Gem. Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const dc = DOMAIN_COLORS[r.Domain] || { bg: '#f3f4f6', color: '#374151' };
            const barPct = totalByDate[r.Datum] > 0 ? (r.Revenue / totalByDate[r.Datum]) * 100 : 0;
            return (
              <tr className="domain-row" key={i} style={{ background: '#fff' }}>
                <td style={td}>
                  <span style={{ background: (DAG_STYLE[r.Dag] || DAG_STYLE['Vorige week']).bg, color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: '0.74rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.Dag}</span>
                </td>
                <td style={td}>
                  <span style={{ background: dc.bg, color: dc.color, borderRadius: 6, padding: '3px 10px', fontSize: '0.82rem', fontWeight: 700 }}>
                    {r.Domain}
                  </span>
                </td>
                <td style={{ ...tdr, fontWeight: 700, color: '#111' }}>{EUR(r.Revenue)}</td>
                <td style={{ ...td, minWidth: 120 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${barPct}%`, height: '100%', background: dc.bar || dc.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', minWidth: 36, textAlign: 'right' }}>{barPct.toFixed(0)}%</span>
                  </div>
                </td>
                <td style={{ ...tdr, color: '#374151' }}>{EUR(r.GM)}</td>
                <td style={{ ...tdr, color: gmColor(r.GMPct), fontWeight: 700 }}>{PCT(r.GMPct)}</td>
                <td style={tdr}>{NUM(r.Orders)}</td>
                <td style={tdr}>{NUM(r.Lines)}</td>
                <td style={tdr}>{EUR(r.GemOrder)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Product tabel (herbruikbaar voor top-revenue én laagste marge) ──────────
const RANK_MEDAL = ['🥇', '🥈', '🥉'];

function ProductTable({ rows, dag, mode = 'revenue', onSelect }) {
  // mode: 'revenue' = top 10 omzet (gesorteerd desc), 'margin' = laagste marge (gesorteerd asc op GMPct)
  const byDag = (rows || []).filter(r => r.Dag === dag);
  const filtered = mode === 'margin'
    ? [...byDag].sort((a, b) => (a.GMPct ?? 99) - (b.GMPct ?? 99)).slice(0, 10)
    : byDag;
  if (!filtered.length) return <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Geen data</div>;

  const maxRevenue = Math.max(...filtered.map(r => r.Revenue || 0));

  const th = { padding: '11px 14px', textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e5e7eb', fontSize: '0.74rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' };
  const td = { padding: '11px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem', verticalAlign: 'middle' };
  const tdr = { ...td, textAlign: 'right' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 40 }}>#</th>
            <th style={th}>Product</th>
            <th style={{ ...th, minWidth: 130 }}>Revenue</th>
            <th style={{ ...th, textAlign: 'right' }}>Qty</th>
            <th style={{ ...th, textAlign: 'right' }}>GM €</th>
            <th style={{ ...th, textAlign: 'right' }}>GM %</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => {
            const barPct = maxRevenue > 0 ? (r.Revenue / maxRevenue) * 100 : 0;
            const rankIcon = mode === 'revenue' && i < 3
              ? RANK_MEDAL[i]
              : <span style={{ color: '#d1d5db', fontSize: '0.82rem' }}>{i + 1}</span>;
            return (
              <tr className="product-row" key={i} style={{ background: '#fff' }} onClick={() => onSelect?.(r)}>
                <td style={{ ...td, fontWeight: 800, fontSize: '1rem', textAlign: 'center' }}>{rankIcon}</td>
                <td style={{ ...td, color: '#111', fontWeight: 500, maxWidth: 260 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{r.CallName || r.ProductID}</span>
                    <span className="product-hint" style={{ fontSize: '0.68rem', color: '#a5b4fc', fontWeight: 600, background: '#eef2ff', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>details →</span>
                  </span>
                </td>
                <td style={{ ...td, minWidth: 130 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 700, color: '#111', fontSize: '0.88rem' }}>{EUR(r.Revenue)}</span>
                    <div style={{ height: 4, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${barPct}%`, height: '100%', background: 'linear-gradient(90deg,#4f8ef7,#818cf8)', borderRadius: 99 }} />
                    </div>
                  </div>
                </td>
                <td style={tdr}>{NUM(r.Qty)}</td>
                <td style={tdr}>{EUR(r.GM)}</td>
                <td style={{ ...tdr, color: gmColor(r.GMPct), fontWeight: 700 }}>{PCT(r.GMPct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopProductsTable({ rows, dag, onSelect }) {
  return <ProductTable rows={rows} dag={dag} mode="revenue" onSelect={onSelect} />;
}

// ── Grafieken ────────────────────────────────────────────
const DAY_ORDER = { 'Vorige week': 0, 'Gisteren': 1, 'Vandaag': 2 };
const sortDays = (a, b) => (DAY_ORDER[a.dag] ?? 3) - (DAY_ORDER[b.dag] ?? 3);

function DailyRevenueChart({ data, loading }) {
  const [vis, setVis] = useState({ OE: true, Budget: true, Margin: true });
  const toggle = k => setVis(v => ({ ...v, [k]: !v[k] }));

  const fmtEur  = v => v >= 1000 ? `\u20ac${(v/1000).toFixed(0)}k` : `\u20ac${v}`;
  const fmtPct  = v => v != null ? `${Number(v).toFixed(1)}%` : '';

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: '0.88rem' }}>Laden\u2026</div>;
  if (!data?.length) return <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Geen data</div>;

  // KPI totals
  const totalOE  = data.reduce((s, d) => s + (d.OrderEntry || 0), 0);
  const totalBdg = data.reduce((s, d) => s + (d.DailyBudget || 0), 0);
  const daysM    = data.filter(d => d.MarginPct != null);
  const avgM     = daysM.length ? daysM.reduce((s, d) => s + d.MarginPct, 0) / daysM.length : null;
  const ratio    = totalBdg > 0 ? (totalOE / totalBdg) * 100 : null;

  const kpis = [
    { label: 'Order Entry', value: EUR(totalOE), color: '#1e40af' },
    { label: 'Dagbudget',   value: EUR(totalBdg), color: '#f97316' },
    { label: 'Gem. Marge',  value: avgM != null ? PCT(avgM) : '\u2014', color: avgM != null ? gmColor(avgM) : '#9ca3af' },
    { label: 'OE / Budget', value: ratio != null ? `${ratio.toFixed(1)}%` : '\u2014', color: ratio != null ? (ratio >= 100 ? '#10b981' : '#ef4444') : '#9ca3af' },
  ];

  const pills = [
    { key: 'OE',     label: 'Order Entry', color: '#1e40af' },
    { key: 'Budget', label: 'Dagbudget',   color: '#f97316' },
    { key: 'Margin', label: 'Marge %',     color: '#d97706' },
  ];

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: k.label === 'Gem. Marge' || k.label === 'OE / Budget' ? k.color : '#0f1729' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Toggle pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {pills.map(({ key, label, color }) => (
          <button key={key} onClick={() => toggle(key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20,
            border: `1.5px solid ${color}`,
            background: vis[key] ? color : '#fff',
            color: vis[key] ? '#fff' : color,
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.15s ease',
            opacity: vis[key] ? 1 : 0.65,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: vis[key] ? 'rgba(255,255,255,0.8)' : color, display: 'inline-block', flexShrink: 0 }} />
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={290}>
        <ComposedChart data={data} margin={{ top: 8, right: 48, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="Datum" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tickFormatter={fmtEur} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={fmtPct} tick={{ fontSize: 11, fill: '#d97706' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
          <Tooltip
            formatter={(v, n) => {
              if (n === 'Marge %') return [`${Number(v).toFixed(2)}\u00a0%`, n];
              return [`\u20ac\u00a0${Number(v).toLocaleString('nl-BE')}`, n];
            }}
            labelStyle={{ fontWeight: 700, color: '#0f1729', marginBottom: 4 }}
            contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: '0.82rem' }}
            cursor={{ fill: 'rgba(15,23,41,0.04)' }}
          />
          <Brush dataKey="Datum" height={20} stroke="#e5e7eb" fill="#f8fafc" travellerWidth={7} tickFormatter={() => ''} />
          <Bar yAxisId="left"  dataKey="OrderEntry" name="Order Entry" fill="#1e40af" hide={!vis.OE}     maxBarSize={26} radius={[3,3,0,0]} />
          <Bar yAxisId="left"  dataKey="DailyBudget" name="Dagbudget"  fill="#f97316" hide={!vis.Budget} maxBarSize={26} radius={[3,3,0,0]} opacity={0.85} />
          <Line yAxisId="right" type="monotone" dataKey="MarginPct" name="Marge %" stroke="#d97706" strokeWidth={2.5} hide={!vis.Margin}
            dot={{ fill: '#d97706', r: 3, strokeWidth: 1.5, stroke: '#fff' }} activeDot={{ r: 7 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function DomainShareChart({ domains }) {
  const grouped = {};
  domains.forEach(r => {
    if (!grouped[r.Dag]) grouped[r.Dag] = { dag: r.Dag };
    grouped[r.Dag][r.Domain] = r.Revenue || 0;
  });
  const data = Object.values(grouped).sort(sortDays);
  const fmtK = v => `€${(v / 1000).toFixed(0)}k`;
  const fmtTip = (v) => `€${Number(v).toLocaleString('nl-BE')}`;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="dag" tick={{ fontSize: 12, fontWeight: 600, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v, n) => [fmtTip(v), n]} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: '0.85rem' }} cursor={{ fill: '#f8fafc' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.82rem', paddingTop: 8 }} />
        <Bar dataKey="Klium.be"  stackId="a" fill="#111827" maxBarSize={70} />
        <Bar dataKey="Klium.nl"  stackId="a" fill="#f97316" maxBarSize={70} />
        <Bar dataKey="Klium.com" stackId="a" fill="#1e40af" radius={[6, 6, 0, 0]} maxBarSize={70} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Product detail modal ─────────────────────────────────
function ProductModal({ product, allProducts, onClose }) {
  const [callProducts, setCallProducts] = useState([]);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState(null);
  const [brandFilter, setBrandFilter] = useState(null);

  useEffect(() => {
    if (!product) return;
    setCpLoading(true);
    setCpError(null);
    setCallProducts([]);
    setBrandFilter(null);
    fetch(`/api/sales-performance/callname-products?callName=${encodeURIComponent(product.CallName)}&dag=${encodeURIComponent(product.Dag)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (data.error) throw new Error(data.error); setCallProducts(data); })
      .catch(e => setCpError(e.message))
      .finally(() => setCpLoading(false));
  }, [product?.CallName, product?.Dag]);

  if (!product) return null;

  // Aggregeer per dag over alle producten met dezelfde CallName
  const crossDay = DAYS.map(dag => {
    const rows = (allProducts || []).filter(r => r.CallName === product.CallName && r.Dag === dag);
    if (rows.length === 0) return { dag, data: null };
    const rev = rows.reduce((s, r) => s + (r.Revenue || 0), 0);
    const qty = rows.reduce((s, r) => s + (r.Qty || 0), 0);
    const gm  = rows.reduce((s, r) => s + (r.GM || 0), 0);
    return { dag, data: { Revenue: rev, Qty: qty, GM: gm, GMPct: rev > 0 ? (gm / rev) * 100 : 0 } };
  });
  const maxRev = Math.max(...crossDay.map(d => d.data?.Revenue || 0), 1);

  const brands = [...new Set(callProducts.map(p => p.Brand).filter(Boolean))].sort();
  const visibleProducts = brandFilter ? callProducts.filter(p => p.Brand === brandFilter) : callProducts;

  const thO = { padding: '9px 14px', textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e5e7eb', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
  const tdO = { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', verticalAlign: 'middle' };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(15,23,41,0.65)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', animation: 'fadeIn 0.2s ease'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 22, width: '100%', maxWidth: 820,
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(15,23,41,0.38)',
          animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Modal header */}
        <div style={{
          background: 'linear-gradient(135deg,#0f1729 0%,#1a3a6e 70%,#1e4d8c 100%)',
          padding: '24px 28px 22px', position: 'relative', flexShrink: 0
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
            borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>✕</button>

          {/* Dag badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ background: (DAG_STYLE[product.Dag] || DAG_STYLE['Vorige week']).bg, color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
              {product.Dag}
            </span>
          </div>

          {/* CallName als hoofdtitel */}
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>
            {product.CallName || product.ProductID}
          </div>
        </div>

        {/* Scrollbaar gedeelte */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px 26px' }}>
          {/* KPI grid — totalen over hele CallName-groep */}
          {(() => {
            const totRev = callProducts.reduce((s, p) => s + (p.Revenue || 0), 0);
            const totQty = callProducts.reduce((s, p) => s + (p.Qty || 0), 0);
            const totGM  = callProducts.reduce((s, p) => s + (p.GM || 0), 0);
            const totGMPct = totRev > 0 ? (totGM / totRev) * 100 : 0;
            const kpis = cpLoading || callProducts.length === 0
              ? [
                  { label: 'Revenue', value: EUR(product.Revenue), color: '#4f8ef7' },
                  { label: 'Qty', value: NUM(product.Qty), color: '#8b5cf6' },
                  { label: 'GM €', value: EUR(product.GM), color: '#10b981' },
                  { label: 'GM %', value: PCT(product.GMPct), color: gmColor(product.GMPct) },
                ]
              : [
                  { label: 'Revenue', value: EUR(totRev), color: '#4f8ef7' },
                  { label: 'Qty', value: NUM(totQty), color: '#8b5cf6' },
                  { label: 'GM €', value: EUR(totGM), color: '#10b981' },
                  { label: 'GM %', value: PCT(totGMPct), color: gmColor(totGMPct) },
                ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 22 }}>
                {kpis.map(kpi => (
                  <div key={kpi.label} style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 18px', borderLeft: `3px solid ${kpi.color}` }}>
                    <div style={{ fontSize: '0.66rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{kpi.label}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: kpi.label === 'GM %' ? kpi.color : '#0f1729' }}>{kpi.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Producten per CallName */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.9px' }}>
              Producten ({product.Dag})
            </span>
            {brands.length > 1 && brands.map(b => (
              <button key={b} onClick={() => setBrandFilter(brandFilter === b ? null : b)} style={{
                background: brandFilter === b ? '#0f1729' : '#f1f5f9',
                color: brandFilter === b ? '#fff' : '#374151',
                border: 'none', borderRadius: 6, padding: '3px 10px',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}>{b}{brandFilter === b ? ' ✕' : ''}</button>
            ))}
          </div>
          {cpLoading && (
            <div style={{ textAlign: 'center', padding: '18px 0', color: '#9ca3af', fontSize: '0.85rem' }}>Laden…</div>
          )}
          {cpError && (
            <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {cpError}</div>
          )}
          {!cpLoading && !cpError && (
            <div style={{ marginBottom: 22, borderRadius: 10, border: '1px solid #f1f5f9' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thO}>Ref.</th>
                    <th style={thO}>Merk</th>
                    <th style={thO}>Naam</th>
                    <th style={{ ...thO, textAlign: 'right' }}>Qty</th>
                    <th style={{ ...thO, textAlign: 'right' }}>Revenue</th>
                    <th style={{ ...thO, textAlign: 'right' }}>GM %</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.length === 0 && (
                    <tr><td colSpan={6} style={{ ...tdO, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>Geen producten gevonden</td></tr>
                  )}
                  {visibleProducts.map((p, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfd' }}>
                      <td style={{ ...tdO, fontFamily: 'monospace', fontWeight: 700, color: '#1e40af', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{p.ProductID}</td>
                      <td style={{ ...tdO, whiteSpace: 'nowrap' }}>
                        <span style={{ background: '#f1f5f9', color: '#374151', borderRadius: 5, padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600 }}>{p.Brand || '—'}</span>
                      </td>
                      <td style={{ ...tdO, color: '#111' }}>
                        {p.ProductName && <span style={{ fontWeight: 700, color: '#374151', display: 'block', fontSize: '0.8rem' }}>{p.ProductName}</span>}
                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{p.TitleSuffix || '—'}</span>
                      </td>
                      <td style={{ ...tdO, textAlign: 'right', color: '#374151' }}>{NUM(p.Qty)}</td>
                      <td style={{ ...tdO, textAlign: 'right', fontWeight: 700, color: '#0f1729' }}>{EUR(p.Revenue)}</td>
                      <td style={{ ...tdO, textAlign: 'right', fontWeight: 700, color: gmColor(p.GMPct) }}>{PCT(p.GMPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Vergelijking per dag */}
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 12 }}>Vergelijking per dag</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {crossDay.map(({ dag, data }) => {
              const ds = DAG_STYLE[dag] || DAG_STYLE['Vorige week'];
              const barW = data ? (data.Revenue / maxRev) * 100 : 0;
              const isSelected = dag === product.Dag;
              return (
                <div key={dag} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: data ? 1 : 0.38 }}>
                  <div style={{ width: 92, fontSize: '0.78rem', fontWeight: 700, color: '#374151', flexShrink: 0 }}>
                    {isSelected
                      ? <span style={{ background: ds.bg, color: '#fff', borderRadius: 5, padding: '2px 8px', fontSize: '0.74rem' }}>{dag}</span>
                      : dag}
                  </div>
                  <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${barW}%`, height: '100%', borderRadius: 99, background: ds.bg, transition: 'width 0.6s ease 0.1s' }} />
                  </div>
                  <div style={{ width: 90, textAlign: 'right', fontSize: '0.84rem', fontWeight: 700, color: '#0f1729' }}>{data ? EUR(data.Revenue) : '—'}</div>
                  <div style={{ width: 54, textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: data ? gmColor(data.GMPct) : '#d1d5db' }}>{data ? PCT(data.GMPct) : '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sectie titel ─────────────────────────────────────────
function Section({ title, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '36px 0 16px' }}>
      {icon && (
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#4f8ef7,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem', boxShadow: '0 2px 8px rgba(79,142,247,0.35)', flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <span style={{ fontSize: '0.79rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#e5e7eb,transparent)' }} />
    </div>
  );
}

// ── Hoofd component ───────────────────────────────────────
export default function SalesPerformance() {
  const [summary, setSummary] = useState([]);
  const [domains, setDomains] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [drLoading, setDrLoading] = useState(false);
  const [drMonth, setDrMonth] = useState(curYM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [activeTab, setActiveTab] = useState('Vandaag');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d, p] = await Promise.all([
        fetch('/api/sales-performance/summary',      { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/sales-performance/domains',      { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/sales-performance/top-products', { cache: 'no-store' }).then(r => r.json()),
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

  useEffect(() => {
    setDrLoading(true);
    fetch(`/api/sales-performance/daily-revenue?month=${drMonth}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => setDailyRevenue(Array.isArray(data) ? data : []))
      .catch(() => setDailyRevenue([]))
      .finally(() => setDrLoading(false));
  }, [drMonth]);

  const getRow = (dag) => summary.find(r => r.Dag === dag);

  return (
    <>
      <style>{CSS}</style>
      <ProductModal product={selectedProduct} allProducts={topProducts} onClose={() => setSelectedProduct(null)} />
      <div style={{ minHeight: '100vh', background: '#f0f3fa' }}>

        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0f1729 0%, #1a3a6e 60%, #1e4d8c 100%)',
          padding: '28px 32px', position: 'relative', overflow: 'hidden'
        }}>
          {/* decoratieve cirkels */}
          <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', right: 80, bottom: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg,#4f8ef7,#818cf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(79,142,247,0.4)'
                }}>📊</div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
                  Verkoop Performance
                </h1>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', paddingLeft: 48 }}>
                Vandaag · Gisteren · Zelfde weekdag vorige week
                {lastRefresh && (
                  <span style={{ marginLeft: 12, color: 'rgba(255,255,255,0.4)' }}>
                    · Bijgewerkt om {lastRefresh.toLocaleTimeString('nl-BE')}
                  </span>
                )}
              </div>
            </div>
            <button
              className="refresh-btn"
              onClick={load}
              disabled={loading}
              style={{
                padding: '10px 22px', borderRadius: 10,
                border: '1.5px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
                color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1, fontSize: '0.88rem',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <span className={loading ? 'spinner' : ''}>↻</span>
              {loading ? 'Laden…' : 'Vernieuwen'}
            </button>
          </div>
        </div>

        {/* ── Inhoud ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px' }}>

          {error && (
            <div style={{
              background: '#fef2f2', color: '#991b1b', padding: '14px 18px',
              borderRadius: 12, margin: '16px 0', fontWeight: 600,
              border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {loading && !error && (
            <div style={{ textAlign: 'center', padding: 100, color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: 16 }}>
                <span className="spinner">⟳</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Data wordt geladen…</div>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Samenvatting */}
              <Section title="Samenvatting" icon="📈" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                {DAYS.map((dag, idx) => (
                  <div key={dag} className={`stagger-${idx}`} style={{
                    background: 'linear-gradient(160deg,#ffffff 60%,#f5f7ff)',
                    borderRadius: 16, padding: 24,
                    boxShadow: '0 2px 16px rgba(15,23,41,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
                    border: '1px solid rgba(79,142,247,0.08)'
                  }}>
                    <SummaryBlock
                      row={getRow(dag)}
                      dag={dag}
                      compareRow={idx < DAYS.length - 1 ? getRow(DAYS[idx + 1]) : null}
                    />
                  </div>
                ))}
              </div>

              {/* Daily Revenue grafiek */}
              <Section title="Daily Revenue's" icon="📊" />
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(15,23,41,0.07)', border: '1px solid rgba(0,0,0,0.04)' }}>
                {/* Maandnavigatie */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                  <button onClick={() => setDrMonth(m => shiftMonth(m, -1))} style={{
                    background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32,
                    cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: '#374151',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>‹</button>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f1729', minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>
                    {fmtMonth(drMonth)}
                  </span>
                  <button
                    onClick={() => setDrMonth(m => shiftMonth(m, +1))}
                    disabled={drMonth >= curYM()}
                    style={{
                      background: drMonth >= curYM() ? '#f8fafc' : '#f1f5f9',
                      border: 'none', borderRadius: 8, width: 32, height: 32,
                      cursor: drMonth >= curYM() ? 'default' : 'pointer',
                      fontSize: '1.1rem', fontWeight: 700,
                      color: drMonth >= curYM() ? '#d1d5db' : '#374151',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>›</button>
                </div>
                <DailyRevenueChart data={dailyRevenue} loading={drLoading} />
              </div>

              {/* Per domein */}
              <Section title="Per domein" icon="🌐" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(15,23,41,0.07)', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>Revenue per domein</div>
                  <DomainShareChart domains={domains} />
                </div>
                <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(15,23,41,0.07)', border: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                  {['Vandaag', 'Gisteren', 'Vorige week'].map(dag => {
                    const dayDomains = domains.filter(r => r.Dag === dag);
                    const total = dayDomains.reduce((s, r) => s + (r.Revenue || 0), 0);
                    const ds = DAG_STYLE[dag] || DAG_STYLE['Vorige week'];
                    return (
                      <div key={dag}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                          <span style={{ background: ds.bg, color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: '0.74rem', fontWeight: 700 }}>{dag}</span>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111' }}>{EUR(total)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 2, height: 10, borderRadius: 99, overflow: 'hidden' }}>
                          {dayDomains.map(r => {
                            const dc = DOMAIN_COLORS[r.Domain] || { color: '#9ca3af' };
                            const pct = total > 0 ? (r.Revenue / total) * 100 : 0;
                            return <div key={r.Domain} title={`${r.Domain}: ${pct.toFixed(1)}%`} style={{ width: `${pct}%`, background: dc.color, transition: 'width 0.5s ease' }} />;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,41,0.07)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <DomainTable rows={domains} />
              </div>

              {/* Top 10 producten */}
              <Section title="Top 10 producten" icon="🏆" />
              <div style={{
                background: '#fff', borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(15,23,41,0.07)',
                border: '1px solid rgba(0,0,0,0.04)'
              }}>
                <div style={{ padding: '18px 20px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DAYS.map(dag => {
                    const active = activeTab === dag;
                    const ds = DAG_STYLE[dag] || DAG_STYLE['Vorige week'];
                    return (
                      <button
                        key={dag}
                        className="tab-pill"
                        onClick={() => setActiveTab(dag)}
                        style={{
                          padding: '7px 20px', borderRadius: 99, border: 'none', cursor: 'pointer',
                          fontWeight: 700, fontSize: '0.84rem',
                          background: active ? ds.bg : '#f3f4f6',
                          color: active ? '#fff' : '#6b7280',
                          boxShadow: active ? ds.shadow : 'none'
                        }}
                      >{dag}</button>
                    );
                  })}
                </div>
                <div style={{ padding: '12px 0 0' }}>
                  <TopProductsTable rows={topProducts} dag={activeTab} onSelect={setSelectedProduct} />
                </div>
                <div style={{ padding: '8px 16px 14px', fontSize: '0.73rem', color: '#c4c9d8', fontStyle: 'italic' }}>Klik op een rij voor product details</div>
              </div>

              {/* Top 10 laagste marge */}
              <Section title="Top 10 laagste marge" icon="⚠️" />
              <div style={{
                background: '#fff', borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(15,23,41,0.07)',
                border: '1px solid rgba(0,0,0,0.04)'
              }}>
                <div style={{ padding: '18px 20px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DAYS.map(dag => {
                    const active = activeTab === dag;
                    const ds = DAG_STYLE[dag] || DAG_STYLE['Vorige week'];
                    return (
                      <button
                        key={dag}
                        className="tab-pill"
                        onClick={() => setActiveTab(dag)}
                        style={{
                          padding: '7px 20px', borderRadius: 99, border: 'none', cursor: 'pointer',
                          fontWeight: 700, fontSize: '0.84rem',
                          background: active ? ds.bg : '#f3f4f6',
                          color: active ? '#fff' : '#6b7280',
                          boxShadow: active ? ds.shadow : 'none'
                        }}
                      >{dag}</button>
                    );
                  })}
                </div>
                <div style={{ padding: '12px 0 0' }}>
                  <ProductTable rows={topProducts} dag={activeTab} mode="margin" onSelect={setSelectedProduct} />
                </div>
                <div style={{ padding: '8px 16px 14px', fontSize: '0.73rem', color: '#c4c9d8', fontStyle: 'italic' }}>Klik op een rij voor product details</div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
