import React, { useState, useRef, useEffect } from 'react';
import { MONTHS, TOTAL_CATEGORY, UNIT_MULTIPLIER, displayAbbrev, catColor, REAL_CURRENT_YEAR, REAL_CURRENT_MONTH } from '../finance.js';

const TREND_UP = '#3DDC8A';
const TREND_DOWN = '#FF7E80';

// Bảng chi tiết theo tháng. Cột "Mục", hàng tháng và dòng "Tổng" cố định khi cuộn.
// inline = true (PC): bấm đúp vào ô để sửa ngay trong bảng, Enter xuống dòng, Tab sang tháng kế.
// inline = false (điện thoại): chạm vào ô -> onEditRequest mở popup nhập số.
export default function DetailTable({ data, year, categories, monthTotals, onCommit, onEditRequest, inline = false }) {
  const [editing, setEditing] = useState(null); // { key, month }
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const yearData = data[year] || {};

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const isOverridden = (m) => {
    const v = yearData[m]?.[TOTAL_CATEGORY];
    return v !== undefined && v !== null && v !== '';
  };
  const prevValue = (cat, m) => {
    const py = m > 1 ? year : year - 1;
    const pm = m > 1 ? m - 1 : 12;
    return data?.[py]?.[pm]?.[cat];
  };
  const cellColor = (cat, m, v) => {
    if (v === undefined || v === null || v === '') return '#555A63';
    const prev = prevValue(cat, m);
    if (prev === undefined || prev === null || prev === '') return '#E8E9EC';
    if (v > prev) return TREND_UP;
    if (v < prev) return TREND_DOWN;
    return '#E8E9EC';
  };

  const rows = [...categories, TOTAL_CATEGORY];
  const begin = (key, m) => {
    if (key !== TOTAL_CATEGORY && isOverridden(m)) return;
    if (!inline) {
      onEditRequest(key, m);
      return;
    }
    const raw = yearData[m]?.[key];
    setDraft(raw !== undefined && raw !== null ? String(raw / UNIT_MULTIPLIER) : '');
    setEditing({ key, month: m });
  };
  const finish = (move) => {
    if (!editing) return;
    onCommit(editing.key, editing.month, draft);
    const { key, month } = editing;
    setEditing(null);
    if (!move) return;
    // nhảy ô kế tiếp giống Excel
    if (move === 'down') {
      const i = rows.indexOf(key);
      if (i < rows.length - 1) setTimeout(() => begin(rows[i + 1], month), 0);
    } else if (move === 'right' && month < 12) setTimeout(() => begin(key, month + 1), 0);
    else if (move === 'left' && month > 1) setTimeout(() => begin(key, month - 1), 0);
  };
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      finish(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') setEditing(null);
  };
  const curMonth = year === REAL_CURRENT_YEAR ? REAL_CURRENT_MONTH : 0;

  const renderCell = (key, m, content, color, locked, bold) => {
    if (editing && editing.key === key && editing.month === m) {
      return (
        <input
          ref={inputRef}
          className="cell-in"
          value={draft}
          inputMode="decimal"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => finish(null)}
        />
      );
    }
    return (
      <div
        className={'cell money' + (locked ? ' locked' : '')}
        style={{ color, fontWeight: bold ? 800 : undefined }}
        onClick={inline ? undefined : () => begin(key, m)}
        onDoubleClick={inline ? () => begin(key, m) : undefined}
        title={locked ? 'Tháng này đang dùng Tổng ghi đè' : inline ? 'Bấm đúp để sửa (đơn vị nghìn)' : undefined}
      >
        {content}
      </div>
    );
  };

  return (
    <div className="tbl-wrap">
      <table className="det num">
        <thead>
          <tr>
            <th>Mục</th>
            {MONTHS.map((m) => (
              <th key={m} className={m === curMonth ? 'cur' : ''}>
                T{m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat}>
              <td title={cat}>
                <span className="dot" style={{ background: catColor(cat) }} />
                {cat}
              </td>
              {MONTHS.map((m) => {
                const v = yearData[m]?.[cat];
                const locked = isOverridden(m);
                return (
                  <td key={m} className={m === curMonth ? 'cur' : ''}>
                    {renderCell(cat, m, v ? displayAbbrev(v) : locked ? '—' : '-', locked ? '#555A63' : cellColor(cat, m, v), locked)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Tổng</td>
            {monthTotals.map((t, i) => (
              <td key={i}>{renderCell(TOTAL_CATEGORY, i + 1, t ? displayAbbrev(t) : '-', isOverridden(i + 1) ? '#F2B84B' : t ? '#fff' : '#555A63', false, true)}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
