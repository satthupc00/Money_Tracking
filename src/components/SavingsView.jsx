import React, { useState, useMemo } from 'react';
import { Plus, PiggyBank, CalendarDays, Trash2 } from 'lucide-react';
import { calcSaving, formatDate, formatShort, currency } from '../finance.js';
import { Overlay } from './Modals.jsx';

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
// cộng n tháng, giữ ngày (31/1 + 1 tháng -> 28/2 hoặc 29/2)
function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y, m - 1 + n + 1, 0).getDate();
  return toISO(new Date(y, m - 1 + n, Math.min(d, last)));
}
const digits = (s) => String(s || '').replace(/\D/g, '');
const fmtInput = (s) => (digits(s) ? Number(digits(s)).toLocaleString('vi-VN') : '');
const TERMS = [1, 3, 6, 12, 24];

// ---------- Hộp thêm / sửa sổ ----------
function SavingEditor({ book, onSave, onDelete, onClose, sheet }) {
  const [name, setName] = useState(book?.name || '');
  const [amount, setAmount] = useState(book ? fmtInput(String(book.amount)) : '');
  const [start, setStart] = useState(book?.start || todayISO());
  const [end, setEnd] = useState(book?.end || addMonths(todayISO(), 6));
  // kỳ hạn (tháng): nhập ngày kết thúc + số tháng -> tự tính ngày mở sổ
  const [term, setTerm] = useState(() => {
    if (!book) return '6';
    for (let n = 1; n <= 120; n++) if (addMonths(book.start, n) === book.end) return String(n);
    return '';
  });
  const changeEnd = (v) => {
    setEnd(v);
    const n = parseInt(term, 10);
    if (v && n > 0) setStart(addMonths(v, -n));
  };
  const changeTerm = (v) => {
    const t = String(v).replace(/\D/g, '').slice(0, 3);
    setTerm(t);
    const n = parseInt(t, 10);
    if (end && n > 0) setStart(addMonths(end, -n));
  };
  const [rate, setRate] = useState(book ? String(book.rate).replace('.', ',') : '');
  const [confirmDel, setConfirmDel] = useState(false);
  const draft = { name, amount: Number(digits(amount)) || 0, start, end, rate: parseFloat(String(rate).replace(',', '.')) || 0 };
  const r = calcSaving(draft);
  const err = !name.trim() ? 'Nhập tên sổ' : !draft.amount ? 'Nhập số tiền gửi' : !r ? 'Ngày kết thúc phải sau ngày bắt đầu' : !draft.rate ? 'Nhập lãi suất' : '';
  const body = (
    <>
      {sheet && <div className="grab" />}
      <div className="m-h">{book ? 'Sửa sổ tiết kiệm' : 'Thêm sổ tiết kiệm'}</div>
      <label className="sv-f">
        <span>Tên sổ</span>
        <input className="inp" value={name} placeholder="Ví dụ: Sổ Vietin 6 tháng" onChange={(e) => setName(e.target.value)} autoFocus={!sheet} />
      </label>
      <label className="sv-f">
        <span>Số tiền gửi (đồng)</span>
        <input className="inp num money" inputMode="numeric" value={amount} placeholder="500.000.000" onChange={(e) => setAmount(fmtInput(e.target.value))} />
      </label>
      <div className="row">
        <label className="sv-f">
          <span>Ngày kết thúc (đáo hạn)</span>
          <input className="inp num" type="date" value={end} onChange={(e) => changeEnd(e.target.value)} />
        </label>
        <label className="sv-f" style={{ flex: '0 0 110px' }}>
          <span>Kỳ hạn (tháng)</span>
          <input className="inp num" inputMode="numeric" value={term} placeholder="6" onChange={(e) => changeTerm(e.target.value)} />
        </label>
      </div>
      <div className="opt-row">
        {TERMS.map((t) => (
          <button key={t} className={'chip' + (term === String(t) ? ' on' : '')} onClick={() => changeTerm(t)}>
            {t} tháng
          </button>
        ))}
      </div>
      <label className="sv-f">
        <span>Ngày mở sổ {term ? '(tự tính từ ngày kết thúc − kỳ hạn)' : ''}</span>
        <input
          className="inp num"
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setTerm(''); // tự sửa ngày mở sổ -> không còn theo kỳ hạn tròn tháng
          }}
        />
      </label>
      <label className="sv-f">
        <span>Lãi suất (%/năm)</span>
        <input className="inp num" inputMode="decimal" value={rate} placeholder="Ví dụ: 5,2" onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))} />
      </label>
      <div className="sv-result num">
        <div>
          <span>Số ngày gửi</span>
          <b>{r ? `${r.days} ngày` : '—'}</b>
        </div>
        <div>
          <span>Tổng tiền lãi</span>
          <b className="money" style={{ color: 'var(--green)' }}>
            {r ? `${currency(r.interest)} đ` : '—'}
          </b>
        </div>
        <div>
          <span>Lãi trung bình 1 ngày</span>
          <b className="money">{r ? `${currency(r.perDay)} đ` : '—'}</b>
        </div>
        <div>
          <span>Nhận khi đáo hạn</span>
          <b className="money">{r ? `${currency(r.total)} đ` : '—'}</b>
        </div>
      </div>
      {err && <div className="msg error">{err}</div>}
      {confirmDel ? (
        <div className="row">
          <button className="btn" onClick={() => setConfirmDel(false)}>
            Huỷ
          </button>
          <button className="btn-red" onClick={onDelete}>
            Xác nhận xoá sổ
          </button>
        </div>
      ) : (
        <div className="row">
          {book && (
            <button className="btn danger" style={{ flex: 'none', width: 44, padding: 0 }} onClick={() => setConfirmDel(true)} title="Xoá sổ" aria-label="Xoá sổ">
              <Trash2 size={16} />
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn-red" disabled={!!err} onClick={() => onSave({ ...draft, name: name.trim(), id: book?.id || 'sv' + Date.now().toString(36) })}>
            Lưu sổ
          </button>
        </div>
      )}
    </>
  );
  return (
    <Overlay bottom={sheet} top onClose={onClose}>
      {sheet ? <div className="sheet">{body}</div> : <div className="modal">{body}</div>}
    </Overlay>
  );
}

// ---------- Danh sách sổ ----------
export default function SavingsView({ savings, onChange, sheet }) {
  const [editing, setEditing] = useState(null); // null | 'new' | book
  const rows = useMemo(
    () =>
      savings
        .map((b) => ({ b, r: calcSaving(b) }))
        .filter((x) => x.r)
        .sort((x, y) => (x.r.matured - y.r.matured) || x.b.end.localeCompare(y.b.end)),
    [savings]
  );
  const active = rows.filter((x) => !x.r.matured);
  const sum = (arr, k) => arr.reduce((s, x) => s + (k === 'amount' ? Number(x.b.amount) || 0 : x.r[k]), 0);

  return (
    <div className="sv">
      <div className="card sv-sum">
        <div className="sv-sum-h">
          <PiggyBank size={18} color="var(--red)" />
          <b>Sổ tiết kiệm</b>
          <span className="muted num" style={{ marginLeft: 'auto', fontSize: 12 }}>
            {active.length} sổ đang gửi
          </span>
        </div>
        <div className="sv-kpis num">
          <div>
            <span>Tổng tiền gửi</span>
            <b className="money">{formatShort(sum(active, 'amount'))}</b>
          </div>
          <div>
            <span>Tổng lãi sẽ nhận</span>
            <b className="money" style={{ color: 'var(--green)' }}>
              {formatShort(sum(active, 'interest'))}
            </b>
          </div>
          <div>
            <span>Lãi TB / ngày</span>
            <b className="money">{currency(sum(active, 'perDay'))} đ</b>
          </div>
        </div>
      </div>
      <button className="btn-red wide" onClick={() => setEditing('new')}>
        <Plus size={16} /> Thêm sổ tiết kiệm
      </button>
      <div className="sv-list">
        {rows.map(({ b, r }) => (
          <button key={b.id} className={'card sv-card' + (r.matured ? ' done' : '')} onClick={() => setEditing(b)}>
            <div className="sv-c-h">
              <b className="n">{b.name}</b>
              <span className={'sv-badge' + (r.matured ? ' done' : '')}>{r.matured ? 'Đã đáo hạn' : `Còn ${r.remaining} ngày`}</span>
            </div>
            <div className="sv-c-amt num">
              <b className="money">{currency(Number(b.amount))} đ</b>
              <span className="muted"> · {String(b.rate).replace('.', ',')}%/năm</span>
            </div>
            <div className="sv-c-date num muted">
              <CalendarDays size={13} /> {formatDate(b.start)} → {formatDate(b.end)} · {r.days} ngày
            </div>
            <div className="sv-prog">
              <i style={{ width: Math.round(r.progress * 100) + '%' }} />
            </div>
            <div className="sv-grid num">
              <div>
                <span>Tổng tiền lãi</span>
                <b className="money" style={{ color: 'var(--green)' }}>
                  {currency(r.interest)} đ
                </b>
              </div>
              <div>
                <span>Lãi TB / ngày</span>
                <b className="money">{currency(r.perDay)} đ</b>
              </div>
              <div>
                <span>Lãi đã có đến nay</span>
                <b className="money">{currency(r.accrued)} đ</b>
              </div>
              <div>
                <span>Nhận khi đáo hạn</span>
                <b className="money">{currency(r.total)} đ</b>
              </div>
            </div>
          </button>
        ))}
        {rows.length === 0 && (
          <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
            Chưa có sổ nào. Bấm "Thêm sổ tiết kiệm" để nhập sổ đầu tiên.
          </div>
        )}
      </div>
      {editing && (
        <SavingEditor
          sheet={sheet}
          book={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDelete={() => {
            onChange(savings.filter((x) => x.id !== editing.id));
            setEditing(null);
          }}
          onSave={(b) => {
            onChange(editing === 'new' ? [...savings, b] : savings.map((x) => (x.id === b.id ? b : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
