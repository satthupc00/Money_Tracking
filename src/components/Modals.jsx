import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Trash2, GripVertical, Eye, EyeOff, Download, Upload, Copy, LogOut, RefreshCw } from 'lucide-react';
import { UNIT_MULTIPLIER, TOTAL_CATEGORY, categoriesFor, currency, formatShort, catColor } from '../finance.js';
import { MonthPicker } from './MixView.jsx';
import { isNativeApp } from '../platform.js';

export function Overlay({ bottom, top, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className={'overlay' + (bottom ? ' bottom' : '') + (top ? ' top' : '')} onPointerDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      {children}
    </div>
  );
}
function Head({ title, onClose }) {
  return (
    <div className="m-h">
      <span>{title}</span>
      <button className="ibtn" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
        <X size={18} />
      </button>
    </div>
  );
}
const parseK = (s) => {
  const t = String(s || '').trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  return isNaN(n) ? null : Math.round(n * UNIT_MULTIPLIER);
};

// ---------- Popup sửa 1 ô (điện thoại) ----------
export function EditCellModal({ label, month, year, initial, onSave, onClose }) {
  const [v, setV] = useState(initial);
  const ref = useRef(null);
  useEffect(() => {
    ref.current && (ref.current.focus(), ref.current.select());
  }, []);
  const preview = parseK(v);
  return (
    <Overlay onClose={onClose}>
      <div className="modal" style={{ width: 320 }}>
        <Head title={label} onClose={onClose} />
        <div className="m-sub">
          Tháng {month}/{year} · đơn vị nghìn
        </div>
        <input
          ref={ref}
          className="inp num"
          style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, height: 50 }}
          value={v}
          inputMode="decimal"
          placeholder="Để trống = xoá"
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSave(v)}
        />
        <div className="muted num" style={{ textAlign: 'center', minHeight: 18 }}>
          {preview !== null ? `= ${currency(preview)} đ` : ''}
        </div>
        <div className="row">
          <button className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn-red" onClick={() => onSave(v)}>
            Lưu
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- Nhập nhanh cả tháng ----------
export function QuickEntry({ data, categoriesByYear, initialYm, onSave, onClose, sheet }) {
  const [ym, setYm] = useState(initialYm);
  const cats = categoriesFor(categoriesByYear, ym.year);
  const prevYm = ym.month > 1 ? { year: ym.year, month: ym.month - 1 } : { year: ym.year - 1, month: 12 };
  const prevData = data?.[prevYm.year]?.[prevYm.month] || {};
  const [drafts, setDrafts] = useState({});
  useEffect(() => {
    const md = data?.[ym.year]?.[ym.month] || {};
    const d = {};
    cats.forEach((c) => (d[c] = md[c] !== undefined ? String(md[c] / UNIT_MULTIPLIER) : ''));
    setDrafts(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym.year, ym.month]);
  const copyPrev = () => {
    setDrafts((d) => {
      const n = { ...d };
      cats.forEach((c) => {
        if (!n[c] && prevData[c] !== undefined) n[c] = String(prevData[c] / UNIT_MULTIPLIER);
      });
      return n;
    });
  };
  const total = cats.reduce((s, c) => s + (parseK(drafts[c]) || 0), 0);
  const overridden = data?.[ym.year]?.[ym.month]?.[TOTAL_CATEGORY] !== undefined;
  const body = (
    <>
      {sheet && <div className="grab" />}
      <div className="m-h">
        <span>Nhập số dư</span>
        <MonthPicker ym={ym} onChange={setYm} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted" style={{ flex: 'none', fontSize: 12 }}>
          Đơn vị nghìn · để trống = chưa nhập
        </span>
        <button className="btn" style={{ flex: 'none', height: 30 }} onClick={copyPrev} title="Điền các ô trống bằng số của tháng trước">
          <Copy size={14} /> Chép từ T{prevYm.month}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', minHeight: 0 }}>
        {cats.map((c, i) => (
          <label className="field" key={c}>
            <span className="dot" style={{ width: 8, height: 8, borderRadius: 2, background: catColor(c), flex: 'none' }} />
            <span className="n">{c}</span>
            {prevData[c] !== undefined && <span className="o num money">T{prevYm.month}: {formatShort(prevData[c])}</span>}
            <input
              className="num money"
              inputMode="decimal"
              autoFocus={i === 0 && !sheet}
              value={drafts[c] || ''}
              placeholder="—"
              onChange={(e) => setDrafts((d) => ({ ...d, [c]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      {overridden && <div className="msg" style={{ color: 'var(--warn)' }}>Tháng này đang dùng ô Tổng ghi đè, tổng hiển thị sẽ theo ô đó.</div>}
      <div className="row" style={{ justifyContent: 'space-between', color: 'var(--muted)' }}>
        <span style={{ flex: 'none' }}>Tổng tạm tính</span>
        <b className="num money" style={{ flex: 'none', color: '#fff', fontSize: 15 }}>
          {currency(total)} đ
        </b>
      </div>
      <button className="btn-red wide" onClick={() => onSave(ym, drafts)}>
        Lưu tháng {ym.month}/{ym.year}
      </button>
    </>
  );
  return (
    <Overlay bottom={sheet} onClose={onClose}>
      {sheet ? <div className="sheet">{body}</div> : <div className="modal wide">{body}</div>}
    </Overlay>
  );
}

// ---------- Quản lý mục (giữ & kéo để sắp xếp) ----------
export function ManageCategories({ year, categories, onReorder, onRename, onDelete, onCreate, onCopyTo, onClose }) {
  const [newName, setNewName] = useState('');
  const [copyYear, setCopyYear] = useState(String(year + 1));
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [editing, setEditing] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [drag, setDrag] = useState(null); // { from, over, dy }
  const listRef = useRef(null);
  const st = useRef({});

  // Pointer Events: chạm giữ ~300ms (cảm ứng) hoặc kéo > 4px (chuột) để nhấc hàng lên
  const down = (i, e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const s = st.current;
    s.i = i;
    s.x = e.clientX;
    s.y = e.clientY;
    s.id = e.pointerId;
    s.engaged = false;
    s.type = e.pointerType;
    s.el = e.currentTarget;
    clearTimeout(s.timer);
    if (e.pointerType !== 'mouse') {
      s.timer = setTimeout(() => engage(), 300);
    }
  };
  const engage = () => {
    const s = st.current;
    const rows = listRef.current ? Array.from(listRef.current.children) : [];
    s.pitch = rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : 50;
    s.engaged = true;
    try {
      s.el.setPointerCapture(s.id);
    } catch (e) {
      /* ignore */
    }
    if (navigator.vibrate) navigator.vibrate(12);
    setDrag({ from: s.i, over: s.i, dy: 0 });
  };
  const move = (e) => {
    const s = st.current;
    if (s.i === undefined) return;
    const dy = e.clientY - s.y;
    if (!s.engaged) {
      if (s.type === 'mouse' && Math.hypot(e.clientX - s.x, dy) > 4) engage();
      else if (s.type !== 'mouse' && Math.hypot(e.clientX - s.x, dy) > 10) clearTimeout(s.timer);
      if (!st.current.engaged) return;
    }
    const over = Math.min(categories.length - 1, Math.max(0, s.i + Math.round(dy / (s.pitch || 50))));
    setDrag({ from: s.i, over, dy });
  };
  const up = () => {
    const s = st.current;
    clearTimeout(s.timer);
    const wasEngaged = s.engaged;
    if (drag && drag.over !== drag.from) onReorder(drag.from, drag.over);
    setDrag(null);
    const i = s.i;
    st.current = {};
    if (!wasEngaged && i !== undefined) {
      setEditing(i);
      setDraftName(categories[i]);
    }
  };

  const create = () => {
    const t = newName.trim();
    if (!t) return;
    if (t === TOTAL_CATEGORY || categories.includes(t)) {
      setMsg({ type: 'error', text: 'Tên mục đã có' });
      return;
    }
    onCreate(t);
    setNewName('');
    setMsg({ type: '', text: '' });
  };

  return (
    <Overlay onClose={onClose}>
      <div className="modal">
        <Head title="Quản lý mục" onClose={onClose} />
        <div className="m-sub">Áp dụng cho năm {year} · chạm để đổi tên · giữ và kéo để sắp xếp</div>
        <div className="mlist" ref={listRef} style={{ overflowY: drag ? 'hidden' : 'auto' }}>
          {categories.map((cat, i) => {
            let ty = 0;
            const lifted = drag && drag.from === i;
            if (drag) {
              const p = st.current.pitch || 50;
              if (lifted) ty = drag.dy;
              else if (drag.from < drag.over && i > drag.from && i <= drag.over) ty = -p;
              else if (drag.from > drag.over && i >= drag.over && i < drag.from) ty = p;
            }
            return (
              <div
                key={cat}
                className={'mrow' + (lifted ? ' lifted' : '')}
                style={{ transform: ty ? `translateY(${ty}px)` : undefined, transition: lifted ? 'none' : 'transform var(--t-med) var(--ease-out)' }}
              >
                {editing === i ? (
                  <input
                    className="inp"
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => {
                      onRename(i, draftName);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                  />
                ) : (
                  <div className="title" onPointerDown={(e) => down(i, e)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                    <GripVertical size={16} className="grip" />
                    <span className="dot" style={{ width: 8, height: 8, borderRadius: 2, background: catColor(cat), flex: 'none' }} />
                    <span>{cat}</span>
                  </div>
                )}
                <button className="ibtn" style={{ borderRadius: 10 }} onClick={() => setConfirmDel(cat)} title="Xoá mục" aria-label={`Xoá ${cat}`}>
                  <Trash2 size={16} color="#FF7E80" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="row">
          <input className="inp" value={newName} placeholder="Tên mục mới" onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <button className="btn-red" style={{ flex: 'none', height: 42, width: 46, padding: 0 }} onClick={create} disabled={!newName.trim()} title="Thêm mục">
            <Plus size={18} />
          </button>
        </div>
        <div className="m-sec">
          <div className="t">Sao chép danh sách mục sang năm khác</div>
          <div className="row">
            <input className="inp num" type="number" inputMode="numeric" value={copyYear} onChange={(e) => setCopyYear(e.target.value)} placeholder="Năm" />
            <button
              className="btn"
              style={{ flex: 'none', height: 42 }}
              onClick={() => {
                const t = parseInt(copyYear, 10);
                if (!t || t === year) return setMsg({ type: 'error', text: 'Chọn một năm khác' });
                onCopyTo(t);
                setMsg({ type: 'success', text: `Đã sao chép mục sang năm ${t}` });
              }}
            >
              Sao chép
            </button>
          </div>
        </div>
        {msg.text && <div className={'msg ' + msg.type}>{msg.text}</div>}
        {confirmDel && (
          <div className="card" style={{ background: 'var(--chrome)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <b>Xoá mục "{confirmDel}"?</b>
            <span className="muted">Toàn bộ số liệu của mục này trong năm {year} sẽ bị xoá.</span>
            <div className="row">
              <button className="btn" onClick={() => setConfirmDel(null)}>
                Huỷ
              </button>
              <button
                className="btn-red"
                onClick={() => {
                  onDelete(confirmDel);
                  setConfirmDel(null);
                }}
              >
                Xoá
              </button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ---------- Đăng nhập đồng bộ ----------
export function LoginModal({ onSubmit, onClose, sheet }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await onSubmit(email, pw, signup);
    setBusy(false);
    if (res) setErr(res);
  };
  const body = (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sheet && <div className="grab" />}
      <Head title={signup ? 'Tạo tài khoản đồng bộ' : 'Đăng nhập để đồng bộ'} onClose={onClose} />
      <div className="m-sub">Dùng cùng 1 tài khoản trên điện thoại và PC để dữ liệu tự cập nhật giữa các máy.</div>
      <input className="inp" type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!sheet} />
      <div className="inp-wrap">
        <input className="inp" type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} placeholder="Mật khẩu tài khoản" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button type="button" className="ibtn" onClick={() => setShow((v) => !v)} title="Hiện/ẩn mật khẩu">
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {err && <div className="msg error">{err}</div>}
      <button className="btn-red wide" disabled={busy || !email || !pw}>
        {busy ? 'Đang xử lý…' : signup ? 'Tạo tài khoản' : 'Đăng nhập'}
      </button>
      <button type="button" className="btn" onClick={() => setSignup((v) => !v)}>
        {signup ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Tạo mới'}
      </button>
    </form>
  );
  return (
    <Overlay bottom={sheet} onClose={onClose}>
      {sheet ? <div className="sheet">{body}</div> : <div className="modal">{body}</div>}
    </Overlay>
  );
}

// ---------- Quên mã PIN / mật khẩu ----------
export function ForgotModal({ pc, user, onVerify, onWipe, onClose }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const what = pc ? 'mật khẩu' : 'mã PIN';
  return (
    <Overlay top onClose={onClose}>
      <div className="modal">
        <Head title={`Quên ${what}`} onClose={onClose} />
        {user ? (
          <>
            <div className="muted">
              Nhập mật khẩu tài khoản đồng bộ <b style={{ color: 'var(--text)' }}>{user.email}</b> để đặt lại {what}.
            </div>
            <input className="inp" type="password" placeholder="Mật khẩu tài khoản" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
            {err && <div className="msg error">{err}</div>}
            <button
              className="btn-red wide"
              disabled={!pw || busy}
              onClick={async () => {
                setBusy(true);
                const r = await onVerify(pw);
                setBusy(false);
                if (r) setErr(r);
              }}
            >
              {busy ? 'Đang kiểm tra…' : `Đặt lại ${what}`}
            </button>
          </>
        ) : (
          <>
            <div className="muted">
              Máy này chưa đăng nhập tài khoản đồng bộ nên không thể xác minh. Cách duy nhất là xoá khoá cùng toàn bộ dữ liệu trên máy này. Nếu bạn có file sao lưu, có thể nhập lại sau.
            </div>
            {!confirmWipe ? (
              <button className="btn danger wide" onClick={() => setConfirmWipe(true)}>
                Xoá khoá và dữ liệu trên máy này
              </button>
            ) : (
              <div className="row">
                <button className="btn" onClick={() => setConfirmWipe(false)}>
                  Huỷ
                </button>
                <button className="btn-red" onClick={onWipe}>
                  Xác nhận xoá
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}

// ---------- Chọn dữ liệu khi lần đầu đăng nhập mà cả máy và tài khoản đều có số liệu ----------
export function ConflictModal({ localInfo, remoteInfo, onPick }) {
  return (
    <Overlay>
      <div className="modal">
        <div className="m-h">Chọn dữ liệu để dùng</div>
        <div className="muted">Máy này và tài khoản đồng bộ đều đã có số liệu, nhưng khác nhau. Bạn muốn giữ bản nào? Bản còn lại sẽ bị thay thế.</div>
        <button className="btn wide" style={{ height: 'auto', padding: 12, flexDirection: 'column', alignItems: 'flex-start' }} onClick={() => onPick('remote')}>
          <b>Dùng dữ liệu trên tài khoản</b>
          <span className="muted num" style={{ fontSize: 12 }}>{remoteInfo}</span>
        </button>
        <button className="btn wide" style={{ height: 'auto', padding: 12, flexDirection: 'column', alignItems: 'flex-start' }} onClick={() => onPick('local')}>
          <b>Dùng dữ liệu trên máy này</b>
          <span className="muted num" style={{ fontSize: 12 }}>{localInfo}</span>
        </button>
      </div>
    </Overlay>
  );
}

// ---------- Cài đặt ----------
const LOCK_OPTIONS = [
  { v: 0, l: 'Ngay' },
  { v: 1, l: '1 phút' },
  { v: 5, l: '5 phút' },
  { v: 15, l: '15 phút' },
  { v: -1, l: 'Không' },
];
export function SettingsModal(props) {
  const { pc, user, goal, onGoal, hasLock, onChangeLock, verifyLock, biometric, setBiometric, lockDelay, setLockDelay, invertZoom, setInvertZoom, onLogin, onLogout, onExport, onImport, version, onCheckUpdate, updateText, onClose } = props;
  const [goalDraft, setGoalDraft] = useState(goal ? String(goal / 1e9).replace('.', ',') : '');
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [ioMsg, setIoMsg] = useState({ type: '', text: '' });
  const fileRef = useRef(null);
  const what = pc ? 'mật khẩu' : 'mã PIN';
  const digitsOnly = (s) => (pc ? s : s.replace(/\D/g, '').slice(0, 10));

  const saveLock = () => {
    if (hasLock && !verifyLock(cur)) return setMsg({ type: 'error', text: `${pc ? 'Mật khẩu' : 'Mã PIN'} hiện tại không đúng` });
    if (!pc && !/^\d{4,10}$/.test(nw)) return setMsg({ type: 'error', text: 'Mã PIN gồm 4–10 chữ số' });
    if (pc && !nw) return setMsg({ type: 'error', text: 'Hãy nhập mật khẩu mới' });
    if (nw !== cf) return setMsg({ type: 'error', text: 'Nhập lại không khớp' });
    onChangeLock(nw);
    setCur('');
    setNw('');
    setCf('');
    setMsg({ type: 'success', text: `Đã đổi ${what}` });
  };

  return (
    <Overlay onClose={onClose}>
      <div className="modal wide">
        <Head title="Cài đặt" onClose={onClose} />

        <div className="m-sec" style={{ borderTop: 0, paddingTop: 0 }}>
          <div className="t">Đồng bộ</div>
          {user ? (
            <div className="row">
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Đã đăng nhập: <b>{user.email}</b>
              </span>
              <button className="btn" style={{ flex: 'none' }} onClick={onLogout}>
                <LogOut size={14} /> Đăng xuất
              </button>
            </div>
          ) : (
            <button className="btn-red wide" onClick={onLogin}>
              Đăng nhập để đồng bộ
            </button>
          )}
        </div>

        <div className="m-sec">
          <div className="t">Mục tiêu tài sản</div>
          <div className="row">
            <div className="inp-wrap" style={{ flex: 1 }}>
              <input className="inp num" inputMode="decimal" value={goalDraft} placeholder="Ví dụ: 2 hoặc 2,5" onChange={(e) => setGoalDraft(e.target.value)} />
              <span className="muted" style={{ position: 'absolute', right: 12 }}>tỷ</span>
            </div>
            <button
              className="btn"
              style={{ flex: 'none', height: 42 }}
              onClick={() => {
                const n = parseFloat(goalDraft.replace(',', '.'));
                onGoal(isNaN(n) || n <= 0 ? 0 : Math.round(n * 1e9));
              }}
            >
              Lưu
            </button>
          </div>
          <span className="muted" style={{ fontSize: 11 }}>Để trống hoặc 0 để ẩn thẻ mục tiêu.</span>
        </div>

        <div className="m-sec">
          <div className="t">Bảo mật</div>
          {hasLock && (
            <input className="inp" type="password" inputMode={pc ? undefined : 'numeric'} placeholder={`${pc ? 'Mật khẩu' : 'Mã PIN'} hiện tại`} value={cur} onChange={(e) => setCur(digitsOnly(e.target.value))} />
          )}
          <div className="row">
            <input className="inp" type="password" inputMode={pc ? undefined : 'numeric'} placeholder={`${pc ? 'Mật khẩu' : 'Mã PIN'} mới`} value={nw} onChange={(e) => setNw(digitsOnly(e.target.value))} />
            <input className="inp" type="password" inputMode={pc ? undefined : 'numeric'} placeholder="Nhập lại" value={cf} onChange={(e) => setCf(digitsOnly(e.target.value))} />
          </div>
          {msg.text && <div className={'msg ' + msg.type}>{msg.text}</div>}
          <button className="btn" onClick={saveLock}>
            {hasLock ? `Đổi ${what}` : `Đặt ${what}`}
          </button>
          {!pc && isNativeApp() && (
            <button className="toggle" onClick={() => setBiometric(!biometric)}>
              <span className="tx">
                <b>Mở khoá bằng vân tay</b>
                <span>Mã PIN vẫn dùng được khi vân tay không nhận</span>
              </span>
              <span className={'sw' + (biometric ? ' on' : '')} />
            </button>
          )}
          <div className="toggle" style={{ cursor: 'default' }}>
            <span className="tx">
              <b>Tự khoá khi rời app</b>
              <span>Khoá lại sau khi chuyển app / thu nhỏ cửa sổ quá thời gian này</span>
            </span>
          </div>
          <div className="opt-row">
            {LOCK_OPTIONS.map((o) => (
              <button key={o.v} className={'chip' + (lockDelay === o.v ? ' on' : '')} onClick={() => setLockDelay(o.v)}>
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {!pc && (
          <div className="m-sec">
            <div className="t">Biểu đồ</div>
            <button className="toggle" onClick={() => setInvertZoom(!invertZoom)}>
              <span className="tx">
                <b>Đảo chiều zoom 1 ngón</b>
                <span>Chạm 2 lần rồi giữ kéo để zoom: đảo chiều kéo to/nhỏ</span>
              </span>
              <span className={'sw' + (invertZoom ? ' on' : '')} />
            </button>
          </div>
        )}

        <div className="m-sec">
          <div className="t">Sao lưu & khôi phục</div>
          <div className="row">
            <button
              className="btn"
              onClick={async () => {
                const r = await onExport();
                setIoMsg(r);
              }}
            >
              <Download size={15} /> Xuất file
            </button>
            <button className="btn" onClick={() => fileRef.current && fileRef.current.click()}>
              <Upload size={15} /> Nhập file
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = '';
              if (f) setIoMsg(await onImport(f));
            }}
          />
          {ioMsg.text && <div className={'msg ' + ioMsg.type}>{ioMsg.text}</div>}
        </div>

        <div className="m-sec">
          <div className="t">Phiên bản</div>
          <div className="row">
            <span style={{ flex: 1 }} className="num">
              Mon Money Tracking v{version}
              <br />
              <span className="muted" style={{ fontSize: 12 }}>{updateText}</span>
            </span>
            <button className="btn" style={{ flex: 'none' }} onClick={onCheckUpdate}>
              <RefreshCw size={14} /> Kiểm tra cập nhật
            </button>
          </div>
        </div>
        <div className="credit" style={{ textAlign: 'right' }}>Created by Mondiro</div>
      </div>
    </Overlay>
  );
}
