import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Settings, RefreshCw, LineChart, Table2, PieChart, Plus, List, Download, X } from 'lucide-react';
import Chart from './components/Chart.jsx';
import DetailTable from './components/DetailTable.jsx';
import DetailView from './components/DetailView.jsx';
import LockScreen from './components/LockScreen.jsx';
import Logo from './components/Logo.jsx';
import { Donut, Legend, MonthPicker, CategoryHistory, mixOf } from './components/MixView.jsx';
import { Overlay, EditCellModal, QuickEntry, ManageCategories, LoginModal, ForgotModal, ConflictModal, SettingsModal } from './components/Modals.jsx';
import {
  MONTHS, TOTAL_CATEGORY, UNIT_MULTIPLIER, DEFAULT_GOAL, REAL_CURRENT_YEAR, REAL_CURRENT_MONTH,
  categoriesFor, totalFor, buildTimeline, setCategoryOrder, computeSummary, formatShort, formatPct, currency, catColor,
} from './finance.js';
import { isNativeApp, isElectron, lsGet, lsSet, lsGetJSON, hashSecret, legacyHash, checkForUpdate, installUpdate } from './platform.js';
import { APP_VERSION } from './config.js';
import * as sync from './sync.js';
import { SEED_DATA as DEMO_DATA, SEED_CATEGORIES_BY_YEAR as DEMO_CATEGORIES_BY_YEAR } from './seedData.js';

// Bản xem thử dùng số liệu giả và KHÔNG đồng bộ (tránh đẩy số giả lên tài khoản thật)
const DEMO_MODE = !isNativeApp() && !isElectron() && (import.meta.env.DEV || import.meta.env.VITE_DEMO === '1' || /[?&]demo\b/.test(window.location.search));

// ---------- khoá lưu trên máy (giữ tên cũ của bản 1.x để không mất dữ liệu) ----------
const STORAGE_KEY = 'finance-tracker-data-v1';
const CAT_BY_YEAR_STORAGE_KEY = 'finance-tracker-categories-by-year-v1';
const LEGACY_PASS_KEY = 'finance-tracker-pass-v1';
const BIOMETRIC_KEY = 'finance-tracker-biometric-v1';
const INVERT_ZOOM_KEY = 'finance-tracker-invert-zoom-v1';
const LOCK_KEY = 'mmt-lock-v2';
const LOCK_LEN_KEY = 'mmt-lock-len';
const GOAL_KEY = 'mmt-goal';
const INACTIVITY_LOCK_MS = 5 * 60 * 1000;

// JSON có sắp xếp key: để so sánh dữ liệu trên máy với trên mây không bị lệch thứ tự key
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
const pickPayload = (o) => ({ data: o.data || {}, categoriesByYear: o.categoriesByYear || {}, goal: typeof o.goal === 'number' ? o.goal : DEFAULT_GOAL });
const hasAnyData = (data) => Object.values(data || {}).some((y) => Object.values(y || {}).some((m) => Object.keys(m || {}).length > 0));
function describe(payload, at) {
  const tl = buildTimeline(payload.data, payload.categoriesByYear);
  const s = computeSummary(tl, 0);
  const parts = [];
  if (s) parts.push(`Mới nhất T${s.month}/${s.year}: ${formatShort(s.value)}`);
  if (at) parts.push('sửa lúc ' + new Date(at).toLocaleString('vi-VN'));
  return parts.join(' · ') || 'Chưa có số liệu';
}

// ---------- bố cục theo kích thước màn hình ----------
function useLayoutMode() {
  const calc = () => {
    if (isElectron()) return 'pc';
    const w = window.innerWidth;
    if (!isNativeApp() && w >= 1024) return 'pc';
    if (w >= 600) return 'fold';
    return 'phone';
  };
  const [mode, setMode] = useState(calc);
  useEffect(() => {
    const on = () => setMode(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return mode;
}

function loadInitialData() {
  const stored = lsGetJSON(STORAGE_KEY);
  if (stored) return { data: stored, categoriesByYear: lsGetJSON(CAT_BY_YEAR_STORAGE_KEY, {}) };
  // Số liệu mẫu (giả) chỉ dùng khi chạy thử trên trình duyệt (npm run dev hoặc thêm ?demo vào link)
  if (DEMO_MODE) return { data: DEMO_DATA, categoriesByYear: DEMO_CATEGORIES_BY_YEAR };
  return { data: {}, categoriesByYear: {} };
}

export default function App() {
  const mode = useLayoutMode();
  const pc = mode === 'pc';
  const native = isNativeApp();

  // ---------------- dữ liệu ----------------
  const initial = useMemo(loadInitialData, []);
  const [data, setData] = useState(initial.data);
  const [categoriesByYear, setCategoriesByYear] = useState(initial.categoriesByYear);
  const [goal, setGoal] = useState(() => {
    const g = lsGet(GOAL_KEY);
    return g === null ? DEFAULT_GOAL : Number(g) || 0;
  });
  const [year, setYear] = useState(REAL_CURRENT_YEAR);
  const [tab, setTab] = useState('overview');
  const [privacy, setPrivacy] = useState(() => lsGet('mmt-privacy') === '1');
  const [invertZoom, setInvertZoom] = useState(() => lsGet(INVERT_ZOOM_KEY) === 'on');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const showToast = useCallback((t) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => lsSet('mmt-privacy', privacy ? '1' : '0'), [privacy]);
  useEffect(() => lsSet(INVERT_ZOOM_KEY, invertZoom ? 'on' : 'off'), [invertZoom]);

  // thứ tự màu cố định theo danh sách mục qua các năm
  useMemo(() => {
    const seen = [];
    Object.keys(categoriesByYear)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((y) => (categoriesByYear[y] || []).forEach((c) => !seen.includes(c) && seen.push(c)));
    setCategoryOrder(seen);
  }, [categoriesByYear]);
  const timeline = useMemo(() => buildTimeline(data, categoriesByYear), [data, categoriesByYear]);
  const summary = useMemo(() => computeSummary(timeline, goal), [timeline, goal]);
  // dữ liệu cho biểu đồ cột chồng: mỗi tháng = danh sách mục (dưới -> trên), tháng ghi đè Tổng thì không chia
  const stacks = useMemo(
    () =>
      timeline.months.map(({ year: y, month: m }) => {
        const md = data?.[y]?.[m];
        if (!md || md[TOTAL_CATEGORY] !== undefined) return null;
        return categoriesFor(categoriesByYear, y)
          .map((c) => ({ name: c, value: Number(md[c]) || 0, color: catColor(c) }))
          .filter((e) => e.value > 0);
      }),
    [timeline, data, categoriesByYear]
  );
  const currentCategories = useMemo(() => categoriesFor(categoriesByYear, year), [categoriesByYear, year]);
  const monthTotals = useMemo(() => MONTHS.map((m) => totalFor(data, categoriesByYear, year, m)), [data, categoriesByYear, year]);
  const latestYm = summary ? { year: summary.year, month: summary.month } : { year: REAL_CURRENT_YEAR, month: REAL_CURRENT_MONTH };
  const [mixYm, setMixYm] = useState(null);
  const mixMonth = mixYm || latestYm;
  const mix = useMemo(() => mixOf(data, categoriesByYear, mixMonth.year, mixMonth.month), [data, categoriesByYear, mixMonth.year, mixMonth.month]);

  // ---------------- khoá app ----------------
  const [lockHash, setLockHash] = useState(() => lsGet(LOCK_KEY) || lsGet(LEGACY_PASS_KEY));
  const [pinLength, setPinLength] = useState(() => Number(lsGet(LOCK_LEN_KEY)) || 0);
  const [unlocked, setUnlocked] = useState(false);
  const [biometric, setBiometric] = useState(() => lsGet(BIOMETRIC_KEY) !== 'off');
  const [lockDelay, setLockDelay] = useState(() => {
    const v = lsGet('mmt-lock-delay');
    return v === null ? (isElectron() ? 5 : 0) : Number(v);
  });
  useEffect(() => lsSet(BIOMETRIC_KEY, biometric ? 'on' : 'off'), [biometric]);
  useEffect(() => lsSet('mmt-lock-delay', String(lockDelay)), [lockDelay]);
  const saveLock = useCallback((hash, len) => {
    lsSet(LOCK_KEY, hash);
    lsSet(LEGACY_PASS_KEY, null);
    lsSet(LOCK_LEN_KEY, len ? String(len) : null);
    setLockHash(hash);
    setPinLength(len || 0);
  }, []);
  const verifyLock = useCallback(
    (s) => {
      if (!lockHash) return true;
      if (/^[0-9a-f]{64}$/.test(lockHash)) return hashSecret(s) === lockHash;
      return legacyHash(s) === lockHash;
    },
    [lockHash]
  );

  // Tự khoá: rời app (tắt màn hình / chuyển app / thu nhỏ) quá lockDelay phút, hoặc 5 phút không thao tác
  useEffect(() => {
    if (!unlocked || !lockHash || lockDelay < 0) return;
    let last = Date.now();
    let hiddenAt = null;
    const mark = () => (last = Date.now());
    const bioActive = () => (window.__mmtBioUntil || 0) > Date.now(); // đang/vừa hiện hộp thoại vân tay
    const away = () => {
      if (bioActive()) return;
      hiddenAt = Date.now();
      if (lockDelay === 0) setUnlocked(false);
    };
    const back = () => {
      if (bioActive()) {
        hiddenAt = null;
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt >= lockDelay * 60000) setUnlocked(false);
      hiddenAt = null;
      mark();
    };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const onVis = () => (document.visibilityState === 'hidden' ? away() : back());
    document.addEventListener('visibilitychange', onVis);
    const timer = setInterval(() => {
      if (Date.now() - last > Math.max(INACTIVITY_LOCK_MS, lockDelay * 60000)) setUnlocked(false);
    }, 15000);
    // visibilitychange đôi khi không bắn khi Activity Android bị pause -> dùng thêm @capacitor/app
    let removeNative = null;
    if (native) {
      import('@capacitor/app')
        .then(({ App: CapApp }) => CapApp.addListener('appStateChange', ({ isActive }) => (isActive ? back() : away())))
        .then((sub) => (removeNative = () => sub.remove()))
        .catch(() => {});
    }
    return () => {
      evs.forEach((e) => window.removeEventListener(e, mark));
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(timer);
      if (removeNative) removeNative();
    };
  }, [unlocked, lockHash, lockDelay, native]);

  // ---------------- đồng bộ ----------------
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('local'); // local | pending | synced | error
  const [conflict, setConflict] = useState(null);
  const payload = useMemo(() => ({ data, categoriesByYear, goal }), [data, categoriesByYear, goal]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const syncRef = useRef({ lastJson: stableStringify(pickPayload(payload)), ready: false, timer: null, uid: null });
  const deviceId = useMemo(() => sync.getDeviceId(), []);

  const adoptRemote = useCallback((remote, uid) => {
    const p = pickPayload(remote);
    syncRef.current.lastJson = stableStringify(p);
    setData(p.data);
    setCategoriesByYear(p.categoriesByYear);
    setGoal(p.goal);
    lsSet('mmt-dirty', '0');
    lsSet('mmt-updated-at', String(remote.updatedAt || Date.now()));
    lsSet('mmt-synced-uid', uid);
    setSyncStatus('synced');
  }, []);
  const pushNow = useCallback(
    (uid) => {
      const p = pickPayload(payloadRef.current);
      const json = stableStringify(p);
      syncRef.current.lastJson = json;
      setSyncStatus('pending');
      sync
        .pushState(uid, { ...p, updatedAt: Date.now(), deviceId })
        .then(() => {
          if (syncRef.current.lastJson === json) {
            lsSet('mmt-dirty', '0');
            lsSet('mmt-synced-uid', uid);
            setSyncStatus('synced');
          }
        })
        .catch(() => setSyncStatus('error'));
    },
    [deviceId]
  );

  useEffect(() => {
    if (DEMO_MODE) return;
    let unsub = null;
    sync
      .watchAuth((u) => setUser(u))
      .then((f) => (unsub = f))
      .catch(() => setSyncStatus('error'));
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    const s = syncRef.current;
    s.ready = false;
    s.uid = user ? user.uid : null;
    if (!user) {
      setSyncStatus('local');
      return;
    }
    setSyncStatus('pending');
    let unsub = null;
    let cancelled = false;
    const uid = user.uid;
    sync
      .watchState(
        uid,
        (remote, meta) => {
          if (meta.hasPendingWrites) return;
          const local = pickPayload(payloadRef.current);
          const localJson = stableStringify(local);
          const dirty = lsGet('mmt-dirty') === '1';
          const localAt = Number(lsGet('mmt-updated-at')) || 0;
          if (!s.ready) {
            // lần đầu nhận dữ liệu sau khi đăng nhập
            s.ready = true;
            if (!remote) {
              if (hasAnyData(local.data)) pushNow(uid);
              else {
                lsSet('mmt-synced-uid', uid);
                setSyncStatus('synced');
              }
              return;
            }
            const remoteJson = stableStringify(pickPayload(remote));
            if (remoteJson === localJson) {
              s.lastJson = localJson;
              lsSet('mmt-dirty', '0');
              lsSet('mmt-synced-uid', uid);
              setSyncStatus('synced');
              return;
            }
            if (!hasAnyData(local.data)) return adoptRemote(remote, uid);
            if (lsGet('mmt-synced-uid') !== uid) {
              setConflict({ remote, uid });
              return;
            }
            if (dirty && localAt > (remote.updatedAt || 0)) pushNow(uid);
            else adoptRemote(remote, uid);
            return;
          }
          // các lần sau: thay đổi từ máy khác
          if (!remote || remote.deviceId === deviceId) return;
          if (stableStringify(pickPayload(remote)) === s.lastJson) return;
          if (dirty && localAt > (remote.updatedAt || 0)) return;
          adoptRemote(remote, uid);
          showToast('Đã cập nhật dữ liệu từ máy khác');
        },
        () => setSyncStatus('error')
      )
      .then((f) => {
        if (cancelled) f();
        else unsub = f;
      })
      .catch(() => setSyncStatus('error'));
    return () => {
      cancelled = true;
      unsub && unsub();
    };
  }, [user, adoptRemote, pushNow, deviceId, showToast]);

  // lưu trên máy + đẩy lên mây mỗi khi dữ liệu đổi
  useEffect(() => {
    lsSet(STORAGE_KEY, JSON.stringify(data));
    lsSet(CAT_BY_YEAR_STORAGE_KEY, JSON.stringify(categoriesByYear));
    lsSet(GOAL_KEY, String(goal));
    const s = syncRef.current;
    const json = stableStringify(pickPayload(payload));
    if (json === s.lastJson) return;
    lsSet('mmt-dirty', '1');
    lsSet('mmt-updated-at', String(Date.now()));
    if (!s.uid || !s.ready || conflict) return;
    setSyncStatus('pending');
    clearTimeout(s.timer);
    s.timer = setTimeout(() => pushNow(s.uid), 800);
  }, [payload, data, categoriesByYear, goal, conflict, pushNow]);

  // ---------------- cập nhật app ----------------
  const [update, setUpdate] = useState({ status: 'idle' }); // idle | checking | latest | available | downloading | error
  const [bannerHidden, setBannerHidden] = useState(false);
  const runCheck = useCallback(
    async (manual) => {
      setUpdate((u) => ({ ...u, status: 'checking' }));
      try {
        const r = await checkForUpdate();
        setUpdate(r);
        if (manual) showToast(r.status === 'available' ? `Có bản mới v${r.version}` : 'Bạn đang dùng bản mới nhất');
        if (r.status === 'available') setBannerHidden(false);
      } catch (e) {
        setUpdate({ status: 'error' });
        if (manual) showToast('Không kiểm tra được cập nhật (mất mạng?)');
      }
    },
    [showToast]
  );
  useEffect(() => {
    const t = setTimeout(() => runCheck(false), 2500);
    return () => clearTimeout(t);
  }, [runCheck]);
  const doUpdate = async () => {
    const info = update;
    setUpdate({ ...info, status: 'downloading', progress: 0 });
    try {
      await installUpdate(info, (p) => setUpdate((u) => ({ ...u, progress: p })));
      setUpdate({ ...info, status: 'available' });
    } catch (e) {
      setUpdate({ ...info, status: 'available' });
      showToast('Tải bản cập nhật lỗi, thử lại sau');
    }
  };
  const updateText =
    update.status === 'checking' ? 'Đang kiểm tra…' : update.status === 'latest' ? 'Đã là bản mới nhất' : update.status === 'available' ? `Có bản mới v${update.version}` : update.status === 'downloading' ? `Đang tải… ${Math.round(update.progress || 0)}%` : update.status === 'error' ? 'Không kiểm tra được' : '';

  // ---------------- sửa dữ liệu ----------------
  const commitValue = useCallback(
    (key, month, raw, yr = year) => {
      const t = String(raw ?? '').trim().replace(/\./g, '').replace(',', '.');
      setData((prev) => {
        const next = { ...prev, [yr]: { ...(prev[yr] || {}) } };
        const mo = { ...(next[yr][month] || {}) };
        if (t === '') delete mo[key];
        else {
          const n = parseFloat(t);
          if (isNaN(n)) return prev;
          mo[key] = Math.round(n * UNIT_MULTIPLIER);
        }
        next[yr][month] = mo;
        return next;
      });
    },
    [year]
  );
  const updateCats = useCallback(
    (updater) => setCategoriesByYear((prev) => ({ ...prev, [year]: updater([...categoriesFor(prev, year)]) })),
    [year]
  );
  const renameInData = (yr, from, to) =>
    setData((prev) => {
      const yd = { ...(prev[yr] || {}) };
      for (const m of Object.keys(yd)) {
        const mo = { ...yd[m] };
        if (Object.prototype.hasOwnProperty.call(mo, from)) {
          if (to) mo[to] = mo[from];
          delete mo[from];
        }
        yd[m] = mo;
      }
      return { ...prev, [yr]: yd };
    });

  // ---------------- modal ----------------
  const [modal, setModal] = useState(null); // { type, ...props }
  const close = useCallback(() => setModal(null), []);
  const openQuick = () => {
    let ym = { year: REAL_CURRENT_YEAR, month: REAL_CURRENT_MONTH };
    if (summary) {
      const next = summary.month === 12 ? { year: summary.year + 1, month: 1 } : { year: summary.year, month: summary.month + 1 };
      const nextIdx = next.year * 12 + next.month;
      ym = nextIdx <= REAL_CURRENT_YEAR * 12 + REAL_CURRENT_MONTH ? next : { year: summary.year, month: summary.month };
    }
    setModal({ type: 'quick', ym });
  };
  const saveQuick = (ym, drafts) => {
    const cats = categoriesFor(categoriesByYear, ym.year);
    if (!categoriesByYear[ym.year] || !categoriesByYear[ym.year].length) setCategoriesByYear((p) => ({ ...p, [ym.year]: [...cats] }));
    cats.forEach((c) => commitValue(c, ym.month, drafts[c] || '', ym.year));
    close();
    showToast(`Đã lưu tháng ${ym.month}/${ym.year}`);
  };

  // ---------------- sao lưu ----------------
  const doExport = async () => {
    const text = JSON.stringify({ data, categoriesByYear, goal }, null, 2);
    const filename = `mon-money-tracking-${new Date().toISOString().slice(0, 10)}.json`;
    if (native) {
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const w = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: 'Sao lưu Mon Money Tracking', url: w.uri });
        return { type: 'success', text: 'Chọn nơi lưu file (Drive, Files, email…)' };
      } catch (e) {
        return { type: 'error', text: 'Xuất file lỗi: ' + (e && e.message ? e.message : String(e)) };
      }
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { type: 'success', text: `Đã xuất ${filename}` };
  };
  const doImport = (file) =>
    new Promise((resolve) => {
      const r = new FileReader();
      r.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (!parsed || typeof parsed.data !== 'object') return resolve({ type: 'error', text: 'File sao lưu không hợp lệ' });
          setData(parsed.data || {});
          if (parsed.categoriesByYear && typeof parsed.categoriesByYear === 'object') setCategoriesByYear(parsed.categoriesByYear);
          else if (Array.isArray(parsed.categories)) setCategoriesByYear({ [year]: parsed.categories });
          if (typeof parsed.goal === 'number') setGoal(parsed.goal);
          resolve({ type: 'success', text: 'Đã khôi phục dữ liệu từ file' });
        } catch (e) {
          resolve({ type: 'error', text: 'File sao lưu không hợp lệ' });
        }
      };
      r.readAsText(file);
    });

  // ---------------- hành động chung ----------------
  const onSyncDot = () => {
    if (DEMO_MODE) return showToast('Bản xem thử dùng số liệu giả, không đồng bộ');
    if (!user) setModal({ type: 'login' });
    else showToast(({ synced: 'Đã đồng bộ', pending: 'Đang đồng bộ…', error: 'Lỗi đồng bộ, sẽ thử lại', local: 'Chỉ lưu trên máy' }[syncStatus] || '') + ' · ' + user.email);
  };
  const doLogin = async (email, pw, signup) => {
    try {
      if (signup) await sync.signUp(email, pw);
      else await sync.signIn(email, pw);
      close();
      showToast('Đã đăng nhập, đang đồng bộ…');
      return null;
    } catch (e) {
      return sync.authErrorText(e);
    }
  };
  const syncTitle = { synced: 'Đã đồng bộ', pending: 'Đang đồng bộ…', error: 'Lỗi đồng bộ', local: 'Chưa đăng nhập · chỉ lưu trên máy' }[syncStatus] + (user ? ' · ' + user.email : '');
  const goYear = (d) => setYear((y) => y + d);

  // ---------------- phím tắt PC ----------------
  useEffect(() => {
    if (!pc) return;
    const k = (e) => {
      if (!unlocked || modal) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openQuick();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setPrivacy((v) => !v);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  // ---------------- các khối giao diện ----------------
  const SyncDot = (
    <button className={'syncdot ' + syncStatus} title={syncTitle} aria-label={'Đồng bộ: ' + syncTitle} onClick={onSyncDot}>
      <i />
    </button>
  );
  const EyeBtn = (
    <button className={'ibtn' + (privacy ? ' on' : '')} onClick={() => setPrivacy((v) => !v)} title={privacy ? 'Hiện số tiền (Ctrl+H)' : 'Ẩn số tiền (Ctrl+H)'} aria-label="Ẩn/hiện số tiền">
      {privacy ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
  const SettingsBtn = (
    <button className="ibtn" onClick={() => setModal({ type: 'settings' })} title="Cài đặt" aria-label="Cài đặt">
      <Settings size={18} />
    </button>
  );
  const updClass = 'upd ' + (update.status === 'checking' || update.status === 'downloading' ? 'checking' : update.status === 'latest' ? 'latest' : update.status === 'available' ? 'available' : '');
  const UpdBtn = (
    <button className={updClass} onClick={() => (update.status === 'available' ? doUpdate() : runCheck(true))} title={'Kiểm tra cập nhật' + (updateText ? ' · ' + updateText : '')} aria-label="Kiểm tra cập nhật">
      <RefreshCw size={18} />
      {!pc && update.status === 'latest' && <small>latest</small>}
    </button>
  );
  const Banner =
    update.status === 'available' || update.status === 'downloading'
      ? !bannerHidden && (
          <div className="banner">
            <Download size={16} color="var(--green)" />
            <span className="sp">{update.status === 'downloading' ? `Đang tải bản v${update.version}… ${Math.round(update.progress || 0)}%` : `Có bản mới v${update.version}`}</span>
            {update.status === 'available' && (
              <button className="go" onClick={doUpdate}>
                Cập nhật
              </button>
            )}
            <button className="x" onClick={() => setBannerHidden(true)} aria-label="Ẩn">
              <X size={16} />
            </button>
          </div>
        )
      : null;

  const Delta = ({ d, label }) =>
    d ? (
      <span className={'delta num ' + (d.diff > 0 ? 'up' : d.diff < 0 ? 'down' : 'flat')}>
        {d.diff > 0 ? '▲' : d.diff < 0 ? '▼' : '='} <span className="money">{formatShort(Math.abs(d.diff))}</span> · {formatPct(d.pct)} {label}
      </span>
    ) : null;

  const Hero = summary && (
    <div className="hero fx-rise">
      <div className="lbl">
        Tổng tài sản · Tháng {summary.month}/{summary.year}
      </div>
      <div className="big num money">
        {currency(summary.value)}
        <span>đ</span>
      </div>
      <div className="chips">
        <Delta d={summary.prev} label={summary.prev ? `so T${summary.prev.month}` : ''} />
        <Delta d={summary.yearAgo} label={`so T${summary.month}/${summary.year - 1}`} />
      </div>
    </div>
  );
  const goalMeta = summary?.goal
    ? summary.goal.eta === 'done'
      ? 'Đã đạt mục tiêu'
      : summary.goal.eta
      ? `Dự kiến đạt ~ T${summary.goal.eta.month}/${summary.goal.eta.year}`
      : 'Chưa đủ dữ liệu để dự đoán'
    : '';
  const GoalCard = summary?.goal && (
    <div className="card goal fx-rise" style={{ animationDelay: '60ms' }}>
      <div className="card-h" style={{ marginBottom: 0 }}>
        <span>Mục tiêu {formatShort(summary.goal.goal)}</span>
        <span className="num muted" style={{ fontWeight: 600 }}>
          {Math.floor(summary.goal.pct)}%
        </span>
      </div>
      <div className="bar">
        <i style={{ width: summary.goal.pct + '%' }} />
      </div>
      <div className="meta num">
        <span>
          {summary.goal.remain > 0 ? (
            <>
              Còn thiếu <b className="money" style={{ color: 'var(--text)' }}>{formatShort(summary.goal.remain)}</b>
            </>
          ) : (
            'Đã vượt mục tiêu'
          )}
        </span>
        <span>{goalMeta}</span>
      </div>
    </div>
  );
  const ChartCard = (
    <div className="card fx-rise" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animationDelay: '120ms' }}>
      <Chart months={timeline.months} values={timeline.values} stacks={stacks} goal={goal} invertZoom={invertZoom} pc={pc} labelSize={pc ? 13 : 14} title={pc ? 'Biến động tổng tài sản' : 'Biến động'} />
    </div>
  );
  const editRequest = (key, m) => {
    const raw = data?.[year]?.[m]?.[key];
    setModal({ type: 'cell', key, month: m, initial: raw !== undefined ? String(raw / UNIT_MULTIPLIER) : '' });
  };
  const detailProps = {
    data,
    year,
    categories: currentCategories,
    monthTotals,
    onYear: goYear,
    onEdit: editRequest,
    onQuick: (ym) => setModal({ type: 'quick', ym }),
    onManage: () => setModal({ type: 'manage' }),
  };
  const DetailMobile = <DetailView {...detailProps} />;
  const DetailCard = (
    <div className="card fx-rise" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '10px 0 0' }}>
      <div className="card-h" style={{ padding: '0 12px' }}>
        {pc ? (
          <span>Chi tiết {year}</span>
        ) : (
          <div className="yearsel" style={{ marginLeft: -8 }}>
            <button onClick={() => goYear(-1)} aria-label="Năm trước">
              <ChevronLeft size={18} />
            </button>
            <span>Năm {year}</span>
            <button onClick={() => goYear(1)} aria-label="Năm sau">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
        <div className="row" style={{ flex: 'none', gap: 8 }}>
          {pc && <span className="muted" style={{ fontWeight: 500, fontSize: 11.5 }}>Bấm đúp để sửa · Enter/Tab nhảy ô · đơn vị nghìn</span>}
          <button className="btn" style={{ height: 30, fontSize: 12 }} onClick={() => setModal({ type: 'manage' })}>
            <List size={14} /> Quản lý mục
          </button>
        </div>
      </div>
      <DetailTable
        data={data}
        year={year}
        categories={currentCategories}
        monthTotals={monthTotals}
        inline={pc}
        onCommit={(key, m, raw) => commitValue(key, m, raw)}
        onEditRequest={(key, m) => {
          const raw = data?.[year]?.[m]?.[key];
          setModal({ type: 'cell', key, month: m, initial: raw !== undefined ? String(raw / UNIT_MULTIPLIER) : '' });
        }}
      />
    </div>
  );
  const MixCards = (
    <>
      <div className="card fx-rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 'none' }}>
        <div className="card-h" style={{ alignSelf: 'stretch' }}>
          <span>Cơ cấu tài sản</span>
          <MonthPicker ym={mixMonth} onChange={setMixYm} />
        </div>
        <Donut ent={mix.ent} tot={mix.tot} size={mode === 'phone' ? 200 : 230} />
      </div>
      <div className="card fx-rise" style={{ flex: 1, minHeight: 0, overflow: 'auto', animationDelay: '60ms' }}>
        <Legend ent={mix.ent} tot={mix.tot} onPick={(name) => setModal({ type: 'history', name })} />
      </div>
    </>
  );
  const Empty = (
    <div className="empty">
      <Logo size={72} />
      <h2>Chưa có số liệu</h2>
      <p>Nhập số dư tháng đầu tiên, nhập lại file sao lưu, hoặc đăng nhập để lấy dữ liệu đã đồng bộ.</p>
      <div className="row">
        <button className="btn-red" onClick={openQuick}>
          <Plus size={16} /> Nhập tháng
        </button>
        {!user && (
          <button className="btn" onClick={() => setModal({ type: 'login' })}>
            Đăng nhập đồng bộ
          </button>
        )}
        <button className="btn" onClick={() => setModal({ type: 'settings' })}>
          Nhập file sao lưu
        </button>
      </div>
      {pc && (
        <p style={{ fontSize: 12 }}>
          <kbd>Ctrl</kbd> + <kbd>N</kbd> nhập tháng · <kbd>Ctrl</kbd> + <kbd>H</kbd> ẩn số tiền
        </p>
      )}
    </div>
  );

  // ---------------- bố cục ----------------
  let body;
  if (pc) {
    const latestMix = mixOf(data, categoriesByYear, latestYm.year, latestYm.month);
    body = (
      <>
        <header className="top">
          <div className="brand">
            <Logo className="brand-icon" />
            <div className="brand-name">
              <span>
                <span className="m">Mon</span> <span className="a">Money Tracking</span>
              </span>
              {update.status === 'latest' && <span className="latest">latest</span>}
            </div>
          </div>
          <div className="mid">
            <div className="yearsel">
              <button onClick={() => goYear(-1)} title="Năm trước" aria-label="Năm trước">
                <ChevronLeft size={18} />
              </button>
              <span>Năm {year}</span>
              <button onClick={() => goYear(1)} title="Năm sau" aria-label="Năm sau">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="tools">
            <button className="btn-red" onClick={openQuick} title="Nhập số dư tháng mới (Ctrl+N)">
              <Plus size={16} /> Nhập tháng
            </button>
            {SyncDot}
            {EyeBtn}
            {SettingsBtn}
            {UpdBtn}
          </div>
        </header>
        {Banner}
        <div className="pc-body">
          <aside className="side">
            {summary ? (
              <>
                <div className="sec">
                  <div className="ttl">
                    Tổng tài sản · T{summary.month}/{summary.year}
                  </div>
                  <div className="num money" style={{ fontSize: 24, fontWeight: 800 }}>
                    {currency(summary.value)} đ
                  </div>
                  <div className="chips" style={{ marginTop: 6 }}>
                    <Delta d={summary.prev} label="" />
                    <Delta d={summary.yearAgo} label="1 năm" />
                  </div>
                  {summary.ytd && (
                    <div className="kpis" style={{ marginTop: 10 }}>
                      <div className="kpi">
                        <div className="l">Đầu năm</div>
                        <div className="v num money">{formatShort(summary.ytd.start)}</div>
                      </div>
                      <div className="kpi">
                        <div className="l">Từ đầu năm</div>
                        <div className="v num" style={{ color: summary.ytd.pct >= 0 ? 'var(--green)' : '#FF7E80' }}>
                          {summary.ytd.pct >= 0 ? '+' : ''}
                          {formatPct(summary.ytd.pct)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {summary.goal && (
                  <div className="sec goal">
                    <div className="ttl" style={{ marginBottom: 0 }}>
                      Mục tiêu
                      <button onClick={() => setModal({ type: 'settings' })}>Sửa</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span className="money">{formatShort(summary.goal.goal)}</span>
                      <span className="num muted">{Math.floor(summary.goal.pct)}%</span>
                    </div>
                    <div className="bar">
                      <i style={{ width: summary.goal.pct + '%' }} />
                    </div>
                    <div className="meta num">
                      <span>{summary.goal.remain > 0 ? <>Còn <span className="money">{formatShort(summary.goal.remain)}</span></> : 'Đã đạt'}</span>
                      <span>{summary.goal.eta && summary.goal.eta !== 'done' ? `~ T${summary.goal.eta.month}/${summary.goal.eta.year}` : ''}</span>
                    </div>
                  </div>
                )}
                <div className="ttl" style={{ padding: '12px 14px 0', margin: 0, color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cơ cấu · T{latestYm.month}</span>
                  <span className="num">{latestMix.ent.length} mục</span>
                </div>
                <div className="cats">
                  {latestMix.ent.map(([c, v]) => (
                    <button key={c} className="cat num" onClick={() => setModal({ type: 'history', name: c })} title="Xem biểu đồ riêng của mục này">
                      <i style={{ background: catColor(c) }} />
                      <span className="n">{c}</span>
                      <span className="v money">{formatShort(v)}</span>
                      <span className="b">
                        <u style={{ width: (v / latestMix.tot) * 100 + '%', background: catColor(c) }} />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="sec muted">Chưa có số liệu</div>
            )}
          </aside>
          <main className="main" style={summary ? undefined : { display: 'flex' }}>
            {summary ? (
              <>
                {ChartCard}
                {DetailCard}
              </>
            ) : (
              Empty
            )}
          </main>
        </div>
        <footer className="foot">
          <span>{syncTitle}</span>
          <span className="sp" />
          <span className="num">v{APP_VERSION}</span>
          <span className="credit">Created by Mondiro</span>
        </footer>
      </>
    );
  } else {
    const leftTop =
      tab === 'detail' ? null : tab === 'mix' ? null : summary ? (
        <span className="muted num" style={{ paddingLeft: 8, fontWeight: 600 }}>
          T{summary.month}/{summary.year}
        </span>
      ) : null;
    const top = (
      <div className="a-top">
        <div className="left">{leftTop}</div>
        {SyncDot}
        {EyeBtn}
        {mode === 'fold' ? null : SettingsBtn}
        {UpdBtn}
      </div>
    );
    if (mode === 'fold') {
      const railBtn = (key, Icon, label) => (
        <button className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
          <Icon size={20} />
          {label}
        </button>
      );
      const foldTab = tab;
      body = (
        <>
          {top}
          {Banner}
          <div className="inner">
            <div className="rail">
              <button className="add" onClick={openQuick} title="Nhập tháng mới" aria-label="Nhập tháng mới">
                <Plus size={22} />
              </button>
              {railBtn('overview', LineChart, 'Tổng quan')}
              {railBtn('detail', Table2, 'Chi tiết')}
              {railBtn('mix', PieChart, 'Cơ cấu')}
              <button style={{ marginTop: 'auto' }} onClick={() => setModal({ type: 'settings' })}>
                <Settings size={20} />
                Cài đặt
              </button>
            </div>
            {!summary ? (
              <div className="col" style={{ gridColumn: '2 / 4' }}>{Empty}</div>
            ) : foldTab === 'detail' ? (
              <DetailView {...detailProps} layout="split" />
            ) : foldTab === 'mix' ? (
              <>
                <div className="col">{MixCards.props.children[0]}</div>
                <div className="col" style={{ paddingLeft: 0 }}>
                  {MixCards.props.children[1]}
                </div>
              </>
            ) : (
              <>
                <div className="col">
                  {Hero}
                  {GoalCard}
                  {ChartCard}
                </div>
                <div className="col" style={{ paddingLeft: 0 }}>
                  {DetailMobile}
                </div>
              </>
            )}
          </div>
          <div className="credit" style={{ position: 'absolute', right: 14, bottom: 'calc(6px + var(--safe-bottom))' }}>
            Created by Mondiro
          </div>
        </>
      );
    } else {
      const navBtn = (key, Icon, label) => (
        <button className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
          <Icon size={20} />
          {label}
        </button>
      );
      body = (
        <>
          {top}
          {Banner}
          <div className="a-body">
            {!summary ? (
              Empty
            ) : tab === 'detail' ? (
              DetailMobile
            ) : tab === 'mix' ? (
              MixCards
            ) : (
              <>
                {Hero}
                {GoalCard}
                {ChartCard}
              </>
            )}
          </div>
          <div className="credit a-credit">Created by Mondiro</div>
          <nav className="nav">
            {navBtn('overview', LineChart, 'Tổng quan')}
            {navBtn('detail', Table2, 'Chi tiết')}
            <button className="add" onClick={openQuick} title="Nhập tháng mới" aria-label="Nhập tháng mới">
              <Plus size={24} />
            </button>
            {navBtn('mix', PieChart, 'Cơ cấu')}
            <button onClick={() => setModal({ type: 'settings' })}>
              <Settings size={20} />
              Cài đặt
            </button>
          </nav>
        </>
      );
    }
  }

  const sheet = !pc;
  return (
    <div className={`app mode-${mode}${privacy ? ' priv' : ''}`}>
      {body}

      {modal?.type === 'cell' && (
        <EditCellModal
          label={modal.key === TOTAL_CATEGORY ? 'Tổng (ghi đè cả tháng)' : modal.key}
          month={modal.month}
          year={year}
          initial={modal.initial}
          onClose={close}
          onSave={(v) => {
            commitValue(modal.key, modal.month, v);
            close();
          }}
        />
      )}
      {modal?.type === 'quick' && <QuickEntry data={data} categoriesByYear={categoriesByYear} initialYm={modal.ym} sheet={sheet} onClose={close} onSave={saveQuick} />}
      {modal?.type === 'manage' && (
        <ManageCategories
          year={year}
          categories={currentCategories}
          onClose={close}
          onReorder={(from, to) =>
            updateCats((list) => {
              const [m] = list.splice(from, 1);
              list.splice(to, 0, m);
              return list;
            })
          }
          onRename={(i, name) => {
            const t = (name || '').trim();
            const orig = currentCategories[i];
            if (!t || t === orig || t === TOTAL_CATEGORY || currentCategories.includes(t)) return;
            updateCats((list) => list.map((c, j) => (j === i ? t : c)));
            renameInData(year, orig, t);
          }}
          onDelete={(cat) => {
            updateCats((list) => list.filter((c) => c !== cat));
            renameInData(year, cat, null);
          }}
          onCreate={(name) => updateCats((list) => [...list, name])}
          onCopyTo={(t) => setCategoriesByYear((p) => ({ ...p, [t]: [...currentCategories] }))}
        />
      )}
      {modal?.type === 'history' && (
        <Overlay onClose={close}>
          <div className="modal wide">
            <div className="m-h">
              <span className="row" style={{ gap: 8 }}>
                <span style={{ flex: 'none', width: 10, height: 10, borderRadius: 3, background: catColor(modal.name) }} />
                <span>{modal.name}</span>
              </span>
              <button className="ibtn" onClick={close} aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="m-sub">Số dư của mục này qua các tháng</div>
            <CategoryHistory name={modal.name} data={data} timeline={timeline} />
          </div>
        </Overlay>
      )}
      {modal?.type === 'login' && <LoginModal sheet={sheet} onClose={close} onSubmit={doLogin} />}
      {modal?.type === 'forgot' && (
        <ForgotModal
          pc={pc}
          user={user}
          onClose={close}
          onVerify={async (pw) => {
            try {
              await sync.verifyAccountPassword(pw);
              saveLock(null, 0);
              setUnlocked(false);
              close();
              return null;
            } catch (e) {
              return sync.authErrorText(e);
            }
          }}
          onWipe={() => {
            saveLock(null, 0);
            setData({});
            setCategoriesByYear({});
            lsSet('mmt-synced-uid', null);
            close();
          }}
        />
      )}
      {modal?.type === 'settings' && (
        <SettingsModal
          pc={pc}
          user={user}
          goal={goal}
          onGoal={(g) => {
            setGoal(g);
            showToast(g ? `Mục tiêu mới: ${formatShort(g)}` : 'Đã ẩn mục tiêu');
          }}
          hasLock={!!lockHash}
          verifyLock={verifyLock}
          onChangeLock={(s) => saveLock(hashSecret(s), pc ? 0 : s.length)}
          biometric={biometric}
          setBiometric={setBiometric}
          lockDelay={lockDelay}
          setLockDelay={setLockDelay}
          invertZoom={invertZoom}
          setInvertZoom={setInvertZoom}
          onLogin={() => setModal({ type: 'login' })}
          onLogout={async () => {
            await sync.signOut();
            showToast('Đã đăng xuất, dữ liệu vẫn còn trên máy');
          }}
          onExport={doExport}
          onImport={doImport}
          version={APP_VERSION}
          updateText={updateText}
          onCheckUpdate={() => runCheck(true)}
          onClose={close}
        />
      )}
      {conflict && (
        <ConflictModal
          localInfo={describe(pickPayload(payload), Number(lsGet('mmt-updated-at')) || 0)}
          remoteInfo={describe(pickPayload(conflict.remote), conflict.remote.updatedAt)}
          onPick={(which) => {
            const { remote, uid } = conflict;
            setConflict(null);
            if (which === 'remote') adoptRemote(remote, uid);
            else pushNow(uid);
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}

      {!unlocked && (
        <LockScreen
          key={lockHash ? 'unlock' : 'setup'}
          pc={pc}
          mode={lockHash ? 'unlock' : 'setup'}
          lockHash={lockHash}
          pinLength={pinLength}
          biometricEnabled={biometric}
          onSetLock={saveLock}
          onUpgradeHash={(h, len) => saveLock(h, pc ? 0 : len)}
          onUnlocked={() => setUnlocked(true)}
          onForgot={() => setModal({ type: 'forgot' })}
        />
      )}
    </div>
  );
}
