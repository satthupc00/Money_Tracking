import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, List, Pencil, Plus } from 'lucide-react';
import { MONTHS, TOTAL_CATEGORY, catColor, currency, displayAbbrev, formatShort, formatPct, REAL_CURRENT_YEAR, REAL_CURRENT_MONTH } from '../finance.js';
import { lsGet, lsSet } from '../platform.js';

// Mục "Chi tiết" cho điện thoại / Fold: 2 cách xem
//  - Theo tháng: mỗi tháng 1 thẻ (tổng, tăng/giảm, thanh cơ cấu), chạm để mở danh sách mục và sửa
//  - Theo mục: mỗi mục 1 dòng (số hiện tại, biểu đồ nhỏ 12 tháng), chạm để mở lưới 12 tháng và sửa
// layout = 'split' (màn trong Fold): danh sách bên trái, chi tiết đang chọn bên phải
export default function DetailView({ data, year, categories, monthTotals, onYear, onEdit, onQuick, onManage, layout = 'list' }) {
  const [view, setView] = useState(() => (lsGet('mmt-detail-view') === 'cat' ? 'cat' : 'month'));
  useEffect(() => lsSet('mmt-detail-view', view), [view]);
  const yd = data[year] || {};
  const prevOf = (m) => (m > 1 ? data?.[year]?.[m - 1] : data?.[year - 1]?.[12]);
  const isOverridden = (m) => yd[m]?.[TOTAL_CATEGORY] !== undefined && yd[m]?.[TOTAL_CATEGORY] !== '';

  // các tháng hiển thị: tháng có số liệu, cộng thêm tháng hiện tại nếu đang xem năm nay (để nhập nhanh)
  const months = useMemo(() => {
    const list = MONTHS.filter((m) => monthTotals[m - 1] > 0);
    if (year === REAL_CURRENT_YEAR && !list.includes(REAL_CURRENT_MONTH)) list.push(REAL_CURRENT_MONTH);
    return list.sort((a, b) => b - a);
  }, [monthTotals, year]);
  const latest = months.find((m) => monthTotals[m - 1] > 0) || months[0];

  const [openMonth, setOpenMonth] = useState(null);
  const [openCat, setOpenCat] = useState(null);
  useEffect(() => {
    setOpenMonth(layout === 'split' ? latest : null);
    setOpenCat(layout === 'split' ? categories[0] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, layout]);

  const Delta = ({ cur, prev, pct }) => {
    if (!cur || !prev) return null;
    const d = cur - prev;
    const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    return (
      <span className={'dv-d ' + cls}>
        {d > 0 ? '▲' : d < 0 ? '▼' : '='} <span className="money">{pct ? formatPct((d / prev) * 100) : formatShort(Math.abs(d))}</span>
      </span>
    );
  };

  const header = (
    <div className="dv-head">
      <div className="yearsel" style={{ marginLeft: -6 }}>
        <button onClick={() => onYear(-1)} aria-label="Năm trước">
          <ChevronLeft size={18} />
        </button>
        <span>{year}</span>
        <button onClick={() => onYear(1)} aria-label="Năm sau">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="seg">
        <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>
          Theo tháng
        </button>
        <button className={view === 'cat' ? 'on' : ''} onClick={() => setView('cat')}>
          Theo mục
        </button>
      </div>
      <button className="ibtn" onClick={onManage} title="Quản lý mục" aria-label="Quản lý mục">
        <List size={18} />
      </button>
    </div>
  );

  // ---------- Theo tháng ----------
  const monthRows = (m) => {
    const md = yd[m] || {};
    const pm = prevOf(m) || {};
    return (
      <div className="dv-rows num">
        {categories.map((c) => (
          <button key={c} className="dv-r" onClick={() => !isOverridden(m) && onEdit(c, m)} disabled={isOverridden(m)}>
            <i style={{ background: catColor(c) }} />
            <span className="n">{c}</span>
            <Delta cur={md[c]} prev={pm[c]} />
            <span className="v money">{md[c] ? displayAbbrev(md[c]) : <span className="muted">—</span>}</span>
            <Pencil size={14} className="pen" />
          </button>
        ))}
        <button className="dv-r tot" onClick={() => onEdit(TOTAL_CATEGORY, m)}>
          <span className="n">{isOverridden(m) ? 'Tổng (đang ghi đè)' : 'Ghi đè tổng tháng'}</span>
          <span className="v money" style={{ color: isOverridden(m) ? 'var(--warn)' : undefined }}>
            {isOverridden(m) ? displayAbbrev(yd[m][TOTAL_CATEGORY]) : ''}
          </span>
          <Pencil size={14} className="pen" />
        </button>
        <button className="btn" style={{ marginTop: 8, width: '100%' }} onClick={() => onQuick({ year, month: m })}>
          <Plus size={14} /> Nhập cả tháng {m}
        </button>
      </div>
    );
  };
  const monthHead = (m, open, onClick) => {
    const t = monthTotals[m - 1];
    const pt = (() => {
      const p = prevOf(m);
      if (!p) return 0;
      if (p[TOTAL_CATEGORY] !== undefined) return Number(p[TOTAL_CATEGORY]) || 0;
      return Object.entries(p).reduce((s, [k, v]) => (k === TOTAL_CATEGORY ? s : s + (Number(v) || 0)), 0);
    })();
    const md = yd[m] || {};
    return (
      <button className="dv-mh" onClick={onClick}>
        <div className="h">
          <span className="m">Tháng {m}</span>
          {t > 0 && pt > 0 && (
            <span className={'delta num ' + (t >= pt ? 'up' : 'down')}>
              {t >= pt ? '▲' : '▼'} {formatPct((Math.abs(t - pt) / pt) * 100)}
            </span>
          )}
          <span className="t num money">{t > 0 ? displayAbbrev(t) : <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>Chưa nhập</span>}</span>
          {layout !== 'split' && <ChevronDown size={16} className={'chev' + (open ? ' open' : '')} />}
        </div>
        {t > 0 && (
          <div className="dv-bar">
            {categories
              .filter((c) => md[c] > 0)
              .map((c) => (
                <i key={c} style={{ flex: md[c], background: catColor(c) }} />
              ))}
          </div>
        )}
      </button>
    );
  };

  // ---------- Theo mục ----------
  const spark = (c) => {
    const vals = MONTHS.map((m) => Number(yd[m]?.[c]) || 0);
    const v = vals.filter((x) => x > 0);
    if (v.length < 2) return <svg width="70" height="26" />;
    const hi = Math.max(...v);
    const lo = Math.min(...v);
    let d = '';
    vals.forEach((x, i) => {
      if (!x) return;
      const X = (i * 70) / 11;
      const Y = 24 - (hi > lo ? (x - lo) / (hi - lo) : 0.5) * 22;
      d += (d ? 'L' : 'M') + X.toFixed(1) + ',' + Y.toFixed(1);
    });
    return (
      <svg width="70" height="26" style={{ flex: 'none' }}>
        <path d={d} fill="none" stroke={catColor(c)} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  };
  const catHead = (c, open, onClick) => {
    const v = yd[latest]?.[c];
    const pv = prevOf(latest)?.[c];
    return (
      <button className="dv-ch" onClick={onClick}>
        <i style={{ background: catColor(c) }} />
        <div className="info">
          <div className="n">{c}</div>
          <div className="s num">
            <Delta cur={v} prev={pv} /> <span className="muted">so tháng trước</span>
          </div>
        </div>
        {spark(c)}
        <b className="v num money">{v ? formatShort(v) : '—'}</b>
      </button>
    );
  };
  const catGrid = (c) => (
    <div className="dv-grid num">
      {MONTHS.map((m) => {
        const v = yd[m]?.[c];
        const cur = year === REAL_CURRENT_YEAR && m === REAL_CURRENT_MONTH;
        return (
          <button key={m} className={'g' + (cur ? ' cur' : '') + (v ? '' : ' empty')} onClick={() => !isOverridden(m) && onEdit(c, m)}>
            <span className="mm">T{m}</span>
            <span className="vv money">{v ? formatShort(v) : '—'}</span>
          </button>
        );
      })}
    </div>
  );
  const totalCard = latest && monthTotals[latest - 1] > 0 && (
    <div className="card dv-tot">
      <div className="muted" style={{ fontSize: 12 }}>
        Tổng · T{latest}/{year}
      </div>
      <div className="num money" style={{ fontSize: 22, fontWeight: 800 }}>
        {currency(monthTotals[latest - 1])} đ
      </div>
    </div>
  );

  // ---------- bố cục 2 cột (Fold mở) ----------
  if (layout === 'split') {
    const left =
      view === 'month'
        ? months.map((m) => (
            <div key={m} className={'card dv-item' + (openMonth === m ? ' on' : '')}>
              {monthHead(m, openMonth === m, () => setOpenMonth(m))}
            </div>
          ))
        : categories.map((c) => (
            <div key={c} className={'card dv-item' + (openCat === c ? ' on' : '')}>
              {catHead(c, openCat === c, () => setOpenCat(c))}
            </div>
          ));
    const right =
      view === 'month' ? (
        openMonth && (
          <div className="card dv-detail">
            <div className="muted">
              Tháng {openMonth}/{year}
            </div>
            <div className="num money" style={{ fontSize: 24, fontWeight: 800 }}>
              {monthTotals[openMonth - 1] > 0 ? currency(monthTotals[openMonth - 1]) + ' đ' : 'Chưa nhập'}
            </div>
            {monthRows(openMonth)}
          </div>
        )
      ) : (
        openCat && (
          <div className="card dv-detail">
            <div className="row" style={{ gap: 8 }}>
              <i style={{ flex: 'none', width: 10, height: 10, borderRadius: 3, background: catColor(openCat) }} />
              <b style={{ fontSize: 15 }}>{openCat}</b>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Chạm vào 1 tháng để sửa (đơn vị nghìn)
            </div>
            {catGrid(openCat)}
          </div>
        )
      );
    return (
      <>
        <div className="col">
          {header}
          <div className="dv-list">{left}</div>
        </div>
        <div className="col" style={{ paddingLeft: 0, paddingTop: 50 }}>
          <div className="dv-list">{right}</div>
        </div>
      </>
    );
  }

  // ---------- bố cục 1 cột (điện thoại) ----------
  return (
    <div className="dv">
      {header}
      <div className="dv-list">
        {view === 'month'
          ? months.map((m) => (
              <div key={m} className={'card dv-item' + (openMonth === m ? ' on' : '')}>
                {monthHead(m, openMonth === m, () => setOpenMonth((o) => (o === m ? null : m)))}
                {openMonth === m && monthRows(m)}
              </div>
            ))
          : [
              <React.Fragment key="tot">{totalCard}</React.Fragment>,
              ...categories.map((c) => (
                <div key={c} className={'card dv-item' + (openCat === c ? ' on' : '')}>
                  {catHead(c, openCat === c, () => setOpenCat((o) => (o === c ? null : c)))}
                  {openCat === c && catGrid(c)}
                </div>
              )),
            ]}
        {view === 'month' && months.length === 0 && <div className="muted" style={{ padding: 16, textAlign: 'center' }}>Năm {year} chưa có số liệu</div>}
      </div>
    </div>
  );
}
