// Hằng số + hàm tính toán dùng chung
// data shape: { [year]: { [month]: { [category]: amount } } }
// categoriesByYear shape: { [year]: string[] }

export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
export const TOTAL_CATEGORY = 'Tổng tài sản'; // ô "Tổng" ghi đè thủ công cho cả tháng
export const UNIT_MULTIPLIER = 1000; // người dùng nhập số đã rút gọn 3 số 0 (200 -> 200.000)
export const DEFAULT_CATEGORIES = ['Tiền mặt', 'Tài khoản ngân hàng', 'Tiết kiệm', 'Ví điện tử', 'Vàng'];
export const DEFAULT_GOAL = 2_000_000_000;

const now = new Date();
export const REAL_CURRENT_YEAR = now.getFullYear();
export const REAL_CURRENT_MONTH = now.getMonth() + 1;

export const currency = (n) => (n || 0).toLocaleString('vi-VN');
// hiển thị đúng số người dùng đã nhập (đơn vị nghìn), không tự thêm số 0
export const displayAbbrev = (realValue) => currency(Math.round((realValue || 0) / UNIT_MULTIPLIER));

// Format gọn: >=1 tỷ -> "1,234 tỷ", >=1tr -> "12,5tr", >=1k -> "12k"
export function formatShort(n, digits = 3) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) {
    let s = (abs / 1e9).toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    return `${sign}${s.replace('.', ',')} tỷ`;
  }
  if (abs >= 1e6) {
    const s = (abs / 1e6).toFixed(1).replace(/\.0$/, '');
    return `${sign}${s.replace('.', ',')}tr`;
  }
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}k`;
  return `${sign}${abs}`;
}
export const formatPct = (p) => `${p >= 0 ? '' : '−'}${Math.abs(p).toFixed(1).replace('.', ',')}%`;

// Bảng màu rực (theo bộ màu Mondiro) cho từng mục, cố định theo tên
const PALETTE = ['#3D9BFF', '#7B5CFF', '#22C3A6', '#F2B84B', '#FF5FA2', '#8FD14F', '#5AC8FA', '#FF8A3D', '#C9CDD4', '#E5383B', '#B47BFF', '#2FD1C5'];
let colorMap = {};
// Gán màu theo thứ tự xuất hiện của các mục (qua mọi năm) để các mục không bị trùng màu
export function setCategoryOrder(names) {
  const next = {};
  names.forEach((n, i) => (next[n] = PALETTE[i % PALETTE.length]));
  colorMap = next;
}
export function catColor(name) {
  if (colorMap[name]) return colorMap[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// Danh sách mục của 1 năm: năm chưa có danh sách riêng thì lấy theo năm gần nhất trước đó
export function categoriesFor(categoriesByYear, yr) {
  const list = categoriesByYear[yr];
  if (list && list.length) return list;
  const prevYears = Object.keys(categoriesByYear)
    .map(Number)
    .filter((y) => y < yr && categoriesByYear[y] && categoriesByYear[y].length)
    .sort((a, b) => b - a);
  if (prevYears.length) return categoriesByYear[prevYears[0]];
  return DEFAULT_CATEGORIES;
}

export function totalFor(data, categoriesByYear, yr, m) {
  const monthData = data?.[yr]?.[m];
  if (!monthData) return 0;
  const override = monthData[TOTAL_CATEGORY];
  if (override !== undefined && override !== null && override !== '') return Number(override) || 0;
  return categoriesFor(categoriesByYear, yr).reduce((s, cat) => s + (Number(monthData[cat]) || 0), 0);
}

// Toàn bộ dòng thời gian: từ năm sớm nhất có dữ liệu tới hết năm hiện tại
export function buildTimeline(data, categoriesByYear) {
  const years = Object.keys(data)
    .map(Number)
    .filter((y) => !isNaN(y));
  const minYear = years.length ? Math.min(...years) : REAL_CURRENT_YEAR;
  const maxYear = Math.max(REAL_CURRENT_YEAR, years.length ? Math.max(...years) : REAL_CURRENT_YEAR);
  const months = [];
  const values = [];
  for (let y = minYear; y <= maxYear; y++) {
    for (let m = 1; m <= 12; m++) {
      months.push({ year: y, month: m });
      values.push(totalFor(data, categoriesByYear, y, m));
    }
  }
  return { months, values };
}

// Số liệu tóm tắt cho thẻ tổng quan
export function computeSummary(timeline, goal) {
  const { months, values } = timeline;
  let L = -1;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] > 0) {
      L = i;
      break;
    }
  }
  if (L < 0) return null;
  const cur = values[L];
  let P = -1;
  for (let i = L - 1; i >= 0; i--) {
    if (values[i] > 0) {
      P = i;
      break;
    }
  }
  const prev = P >= 0 ? { value: values[P], ...months[P], diff: cur - values[P], pct: ((cur - values[P]) / values[P]) * 100 } : null;
  const Y = L - 12;
  const yearAgo = Y >= 0 && values[Y] > 0 ? { value: values[Y], ...months[Y], diff: cur - values[Y], pct: ((cur - values[Y]) / values[Y]) * 100 } : null;

  // giá trị đầu năm = tháng 12 năm trước (nếu có), không thì tháng sớm nhất có dữ liệu trong năm
  const yr = months[L].year;
  let start = null;
  const dec = months.findIndex((x) => x.year === yr - 1 && x.month === 12);
  if (dec >= 0 && values[dec] > 0) start = values[dec];
  else {
    for (let i = 0; i <= L; i++) if (months[i].year === yr && values[i] > 0) { start = values[i]; break; }
  }
  const ytd = start ? { start, pct: ((cur - start) / start) * 100 } : null;

  // dự đoán ngày đạt mục tiêu: hồi quy tuyến tính trên 12 tháng gần nhất có dữ liệu
  let goalInfo = null;
  if (goal > 0) {
    const pts = [];
    for (let i = Math.max(0, L - 12); i <= L; i++) if (values[i] > 0) pts.push([i, values[i]]);
    let eta = null;
    if (cur >= goal) eta = 'done';
    else if (pts.length >= 3) {
      const n = pts.length;
      const sx = pts.reduce((s, p) => s + p[0], 0);
      const sy = pts.reduce((s, p) => s + p[1], 0);
      const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0);
      const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
      const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
      if (slope > 0) {
        const k = Math.ceil((goal - cur) / slope);
        const base = months[L];
        const total = base.year * 12 + (base.month - 1) + k;
        eta = k > 600 ? null : { year: Math.floor(total / 12), month: (total % 12) + 1, perMonth: slope };
      }
    }
    goalInfo = { goal, pct: Math.min(100, (cur / goal) * 100), remain: Math.max(0, goal - cur), eta };
  }
  return { index: L, value: cur, ...months[L], prev, yearAgo, ytd, goal: goalInfo };
}
