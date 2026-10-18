import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { catColor, formatShort, formatPct, categoriesFor, TOTAL_CATEGORY } from '../finance.js';

// Lấy cơ cấu các mục của 1 tháng (bỏ mục bằng 0, sắp xếp lớn -> nhỏ)
export function mixOf(data, categoriesByYear, yr, m) {
  const md = data?.[yr]?.[m] || {};
  const cats = categoriesFor(categoriesByYear, yr);
  const ent = cats.map((c) => [c, Number(md[c]) || 0]).filter((e) => e[1] > 0);
  ent.sort((a, b) => b[1] - a[1]);
  const tot = ent.reduce((s, e) => s + e[1], 0);
  return { ent, tot, overridden: md[TOTAL_CATEGORY] !== undefined };
}

export function Donut({ ent, tot, size = 210 }) {
  let a = -Math.PI / 2;
  const R = 92;
  const r = 62;
  const p = (ang, rr) => [100 + rr * Math.cos(ang), 100 + rr * Math.sin(ang)];
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="num">
      {ent.length === 0 && <circle cx="100" cy="100" r="77" fill="none" stroke="#363A42" strokeWidth="30" />}
      {ent.length === 1 && <circle cx="100" cy="100" r="77" fill="none" stroke={catColor(ent[0][0])} strokeWidth="30" />}
      {ent.length > 1 &&
        ent.map(([k, v]) => {
          const da = (v / tot) * Math.PI * 2;
          const a2 = a + da;
          const big = da > Math.PI ? 1 : 0;
          const gap = Math.min(0.012, da / 4);
          const [x1, y1] = p(a, R);
          const [x2, y2] = p(a2 - gap, R);
          const [x3, y3] = p(a2 - gap, r);
          const [x4, y4] = p(a, r);
          const d = `M${x1},${y1}A${R},${R} 0 ${big} 1 ${x2},${y2}L${x3},${y3}A${r},${r} 0 ${big} 0 ${x4},${y4}Z`;
          a = a2;
          return <path key={k} d={d} fill={catColor(k)} />;
        })}
      <text x="100" y="94" textAnchor="middle" fill="#8D929C" fontSize="11">
        Tổng
      </text>
      <text className="money" x="100" y="115" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800">
        {formatShort(tot)}
      </text>
    </svg>
  );
}

export function Legend({ ent, tot, onPick }) {
  return (
    <div className="legend">
      {ent.map(([k, v]) => (
        <button key={k} className="lg num" onClick={() => onPick && onPick(k)} title="Xem biểu đồ riêng của mục này">
          <i style={{ background: catColor(k) }} />
          <span className="n">{k}</span>
          <span className="v money">{formatShort(v)}</span>
          <span className="p">{formatPct((v / tot) * 100)}</span>
        </button>
      ))}
      {ent.length === 0 && <div className="muted" style={{ padding: 8 }}>Tháng này chưa có số liệu</div>}
    </div>
  );
}

export function MonthPicker({ ym, onChange }) {
  const step = (d) => {
    let m = ym.month + d;
    let y = ym.year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    onChange({ year: y, month: m });
  };
  return (
    <div className="yearsel">
      <button onClick={() => step(-1)} aria-label="Tháng trước" title="Tháng trước">
        <ChevronLeft size={18} />
      </button>
      <span className="num">T{ym.month}/{ym.year}</span>
      <button onClick={() => step(1)} aria-label="Tháng sau" title="Tháng sau">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// Biểu đồ đường nhỏ của 1 mục qua các tháng (mở khi bấm vào 1 mục trong Cơ cấu)
export function CategoryHistory({ name, data, timeline }) {
  const pts = useMemo(() => timeline.months.map((ym) => ({ ...ym, v: Number(data?.[ym.year]?.[ym.month]?.[name]) || 0 })), [name, data, timeline]);
  const first = pts.findIndex((p) => p.v > 0);
  let last = -1;
  for (let i = pts.length - 1; i >= 0; i--) if (pts[i].v > 0) { last = i; break; }
  if (first < 0) return <div className="muted">Mục này chưa có số liệu</div>;
  const sl = pts.slice(first, last + 1);
  const W = 460, H = 200, pl = 8, pr = 8, pt = 22, pb = 24;
  const vals = sl.map((p) => p.v);
  const hi = Math.max(...vals) * 1.1 || 1;
  const X = (i) => pl + (i * (W - pl - pr)) / Math.max(1, sl.length - 1);
  const Y = (v) => pt + (1 - v / hi) * (H - pt - pb);
  const color = catColor(name);
  let d = '';
  sl.forEach((p, i) => (d += `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`));
  const maxI = vals.indexOf(Math.max(...vals));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} className="num">
      <path d={`${d}L${X(sl.length - 1)},${H - pb}L${X(0)},${H - pb}Z`} fill={color} opacity=".14" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" />
      {sl.map((p, i) => (p.month === 1 || i === 0 ? <text key={i} x={X(i)} y={H - 6} fontSize="11" fill="#F2B84B" fontWeight="700" textAnchor={i === 0 ? 'start' : 'middle'}>{p.year}</text> : null))}
      <circle cx={X(maxI)} cy={Y(vals[maxI])} r="4" fill="#fff" />
      <text className="money" x={Math.min(Math.max(X(maxI), 40), W - 40)} y={Y(vals[maxI]) - 8} fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">{formatShort(vals[maxI])}</text>
      <circle cx={X(sl.length - 1)} cy={Y(vals[vals.length - 1])} r="4" fill={color} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
