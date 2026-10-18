import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { formatShort } from '../finance.js';
import { LineChart, BarChart3, Layers } from 'lucide-react';
import { lsGet, lsGetJSON, lsSet } from '../platform.js';

// ---- Hằng số biểu đồ (giữ nguyên cảm giác zoom/kéo của bản cũ) ----
const CHART_VIEW_STORAGE_KEY = 'finance-tracker-chart-view-v1';
const AXIS_MIN_WIDTH = 34;
const MIN_SCALE = 1;
const MAX_SCALE_Y = 6;
const DOUBLE_TAP_MAX_INTERVAL = 300;
const DOUBLE_TAP_MAX_DIST = 30;
const MIN_TICK_STEP = 100_000_000;
const Y_TICK_MAX_COUNT = 5;
const RUBBER_BAND_RESISTANCE = 0.35;
const BOUNCE_BACK_MS = 320;
const NICE_STEP_CANDIDATES = [
  1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000, 200_000_000, 500_000_000,
  1_000_000_000, 2_000_000_000, 5_000_000_000, 10_000_000_000, 20_000_000_000, 50_000_000_000,
];
function pickNiceStep(range, maxTicks) {
  for (const step of NICE_STEP_CANDIDATES) if (range / step <= maxTicks) return step;
  let step = NICE_STEP_CANDIDATES[NICE_STEP_CANDIDATES.length - 1];
  while (range / step > maxTicks) step *= 2;
  return step;
}
const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif';
let __measureCtx = null;
function measureTextWidth(text, font) {
  try {
    if (!__measureCtx) __measureCtx = document.createElement('canvas').getContext('2d');
    __measureCtx.font = font;
    return __measureCtx.measureText(text).width;
  } catch (e) {
    return text.length * 6.2;
  }
}
// Nối thẳng giữa các điểm
function linePath(pts) {
  if (pts.length < 2) return '';
  let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) path += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  return path;
}

const RANGES = [
  { key: '1y', label: '1N', pcLabel: '1 năm', months: 12 },
  { key: '3y', label: '3N', pcLabel: '3 năm', months: 36 },
  { key: 'all', label: 'Tất cả', pcLabel: 'Tất cả', months: 0 },
];

// 3 kiểu xem: đường, cột (tổng mỗi tháng), cột chồng (chia màu theo từng mục)
const MODES = [
  { key: 'line', Icon: LineChart, label: 'Đường' },
  { key: 'bar', Icon: BarChart3, label: 'Cột' },
  { key: 'stack', Icon: Layers, label: 'Cột chồng theo mục' },
];

export default function Chart({ months, values, stacks = null, goal = 0, invertZoom = false, title = 'Biến động', pc = false, labelSize = 14 }) {
  const [mode, setMode] = useState(() => {
    const m = lsGet('mmt-chart-mode');
    return MODES.some((x) => x.key === m) ? m : 'line';
  });
  useEffect(() => lsSet('mmt-chart-mode', mode), [mode]);
  const isBar = mode !== 'line';
  const padT = 26;
  const padB = 46; // chỗ cho nhãn tháng + nhãn năm dưới trục hoành
  const N = months.length;
  const maxScaleX = Math.max(1, N / 3); // zoom vào tối đa còn ~3 tháng

  const plotAreaRef = useRef(null);
  const [plotWidth, setPlotWidth] = useState(240);
  const [plotHeightPx, setPlotHeightPx] = useState(210);

  // ---- Lưu & khôi phục vị trí/độ zoom giữa các lần mở app ----
  const savedRef = useRef(undefined);
  if (savedRef.current === undefined) {
    const v = lsGetJSON(CHART_VIEW_STORAGE_KEY);
    savedRef.current = typeof v?.scaleX === 'number' && typeof v?.panX === 'number' ? v : null;
  }
  const [scaleX, setScaleX] = useState(() => savedRef.current?.scaleX ?? 1);
  const [panX, setPanX] = useState(() => savedRef.current?.panX ?? 0);
  const [scaleY, setScaleY] = useState(() => savedRef.current?.scaleY ?? 1);
  const [panYValue, setPanYValue] = useState(() => savedRef.current?.panYValue ?? 0);
  const [bouncing, setBouncing] = useState(false);
  const [animating, setAnimating] = useState(false); // chuyển mượt khi bấm chọn khoảng 1N/3N/Tất cả
  const needsDefaultPanRef = useRef(!savedRef.current);

  useEffect(() => {
    lsSet(CHART_VIEW_STORAGE_KEY, JSON.stringify({ scaleX, panX, scaleY, panYValue }));
  }, [scaleX, panX, scaleY, panYValue]);

  useLayoutEffect(() => {
    const el = plotAreaRef.current;
    if (!el) return;
    const measure = () => {
      if (el.offsetWidth > 0) {
        setPlotWidth(el.offsetWidth);
        if (needsDefaultPanRef.current && N > 0) {
          // mở lần đầu -> canh về ~12 tháng gần nhất
          needsDefaultPanRef.current = false;
          const s = Math.min(maxScaleX, Math.max(1, N / 12));
          setScaleX(s);
          setPanX(-Math.max(0, el.offsetWidth * s - el.offsetWidth));
        }
      }
      if (el.offsetHeight > 0) setPlotHeightPx(el.offsetHeight);
    };
    measure();
    // đo lại vài lần lúc WebView vừa mở, layout có thể ổn định trễ
    const timers = [50, 150, 350, 700, 1200].map((ms) => setTimeout(measure, ms));
    let raf2;
    const raf1 = requestAnimationFrame(() => (raf2 = requestAnimationFrame(measure)));
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else window.addEventListener('resize', measure);
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', measure);
    };
  }, [N, maxScaleX]);

  // ---- Khoảng giá trị trục Y ----
  const hasAnyData = values.some((v) => v > 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values.filter((v) => v > 0), maxVal);
  const rawChartMax = maxVal * 1.15;
  // biểu đồ cột luôn tính từ 0 để chiều cao cột phản ánh đúng giá trị
  const rawChartMin = hasAnyData && !isBar ? Math.max(0, minVal * 0.85) : 0;
  const tickStep = pickNiceStep(Math.max(1, rawChartMax - rawChartMin), 8);
  const chartMax = Math.max(tickStep, Math.ceil(rawChartMax / tickStep) * tickStep);
  let chartMin = Math.floor(rawChartMin / tickStep) * tickStep;
  if (chartMin >= chartMax) chartMin = Math.max(0, chartMax - tickStep);

  const plotH = Math.max(1, plotHeightPx - padT - padB);
  const gestureRef = useRef({ mode: null });

  const clampPan = useCallback(
    (val, scale) => {
      const maxOffset = Math.max(0, plotWidth * scale - plotWidth);
      return Math.min(0, Math.max(-maxOffset, val));
    },
    [plotWidth]
  );
  const rubberBandPan = useCallback(
    (val, scale) => {
      const maxOffset = Math.max(0, plotWidth * scale - plotWidth);
      if (val > 0) return val * RUBBER_BAND_RESISTANCE;
      if (val < -maxOffset) return -maxOffset + (val + maxOffset) * RUBBER_BAND_RESISTANCE;
      return val;
    },
    [plotWidth]
  );

  const effectiveWidth = plotWidth * scaleX;
  const step0 = Math.max(1, effectiveWidth - 28) / Math.max(1, N - 1);
  const barW = Math.max(3, Math.min(44, step0 * 0.62));
  const innerPadX = isBar ? Math.max(14, barW / 2 + 4) : 14; // chừa chỗ để cột đầu/cuối không bị cắt
  const usableWidth = Math.max(1, effectiveWidth - innerPadX * 2);
  const fullRangeY = Math.max(1, chartMax - chartMin);
  const viewRangeY = fullRangeY / scaleY;
  const maxPanY = Math.max(0, (fullRangeY - viewRangeY) / 2);
  const clampPanY = useCallback((val, maxOff) => Math.min(maxOff, Math.max(-maxOff, val)), []);
  const centerY = (chartMax + chartMin) / 2 + panYValue;
  const viewMinY = centerY - viewRangeY / 2;
  const viewMaxY = centerY + viewRangeY / 2;
  const yOf = (val) => (viewMaxY > viewMinY ? padT + plotH - ((val - viewMinY) / (viewMaxY - viewMinY)) * plotH : padT + plotH);

  const points = useMemo(
    () =>
      months.map((ym, i) => {
        const x = innerPadX + (usableWidth / Math.max(1, N - 1)) * i;
        const val = values[i];
        const y = viewMaxY > viewMinY ? padT + plotH - ((val - viewMinY) / (viewMaxY - viewMinY)) * plotH : padT + plotH;
        return { x, y, val, m: ym.month, yr: ym.year };
      }),
    [usableWidth, months, values, viewMaxY, viewMinY, plotH, N]
  );
  const yearBoundaryX = useMemo(() => {
    const xs = [];
    points.forEach((p, i) => {
      if (i > 0 && p.m === 1) xs.push(p.x - usableWidth / Math.max(1, N - 1) / 2);
    });
    return xs;
  }, [points, usableWidth, N]);
  const yearLabels = useMemo(() => {
    const byYear = {};
    points.forEach((p) => {
      if (!byYear[p.yr]) byYear[p.yr] = { minX: p.x, maxX: p.x };
      else {
        byYear[p.yr].minX = Math.min(byYear[p.yr].minX, p.x);
        byYear[p.yr].maxX = Math.max(byYear[p.yr].maxX, p.x);
      }
    });
    return Object.keys(byYear).map((yr) => ({ year: yr, x: (byYear[yr].minX + byYear[yr].maxX) / 2, minX: byYear[yr].minX, maxX: byYear[yr].maxX }));
  }, [points]);
  // Nhãn năm dính (sticky) 2 chiều theo hướng cuộn
  const YEAR_LABEL_MARGIN = 26;
  const stickyYearLabels = useMemo(() => {
    const viewLeft = -panX;
    const viewRight = -panX + plotWidth;
    return yearLabels.map((yl) => {
      let pinned;
      if (viewLeft > yl.x) pinned = Math.min(viewLeft + YEAR_LABEL_MARGIN, yl.maxX - YEAR_LABEL_MARGIN);
      else if (viewRight < yl.x) pinned = Math.max(viewRight - YEAR_LABEL_MARGIN, yl.minX + YEAR_LABEL_MARGIN);
      else pinned = yl.x;
      return { ...yl, displayX: pinned + panX };
    });
  }, [yearLabels, panX, plotWidth]);

  const [selectedIdx, setSelectedIdx] = useState(null);
  const earliestPoint = useMemo(() => points.find((p) => p.val > 0) || null, [points]);
  const selectedLabelInfo = useMemo(() => {
    if (selectedIdx === null || !points[selectedIdx]) return null;
    const p = points[selectedIdx];
    const text = p.val > 0 ? formatShort(p.val) : 'Chưa nhập';
    const subtext = `Tháng ${p.m}/${p.yr}`;
    const textW = Math.max(measureTextWidth(text, `700 17px ${FONT}`), measureTextWidth(subtext, `600 12px ${FONT}`));
    const boxW = textW + 22;
    const boxH = 46;
    const cx = Math.min(Math.max(p.x, boxW / 2 + 2), effectiveWidth - boxW / 2 - 2);
    const py = p.val > 0 ? p.y : padT + plotH / 2;
    const above = py > padT + boxH + 6;
    const cy = above ? py - 16 - boxH / 2 : py + 16 + boxH / 2;
    return { text, subtext, cx, cy, boxW, boxH };
  }, [selectedIdx, points, effectiveWidth, plotH]);

  // Chỉ nối line giữa các tháng liên tiếp đã có dữ liệu
  const segments = useMemo(() => {
    const segs = [];
    let cur = [];
    points.forEach((p) => {
      if (p.val > 0) cur.push(p);
      else if (cur.length) {
        segs.push(cur);
        cur = [];
      }
    });
    if (cur.length) segs.push(cur);
    return segs.filter((s) => s.length >= 2);
  }, [points]);
  const baseY = padT + plotH;

  const visibleMonthLabel = useMemo(() => {
    const font = `500 10px ${FONT}`;
    const flags = new Array(points.length).fill(false);
    let lastRight = -Infinity;
    points.forEach((p, i) => {
      const w = measureTextWidth(`T${p.m}`, font);
      if (p.x - w / 2 >= lastRight + 6) {
        flags[i] = true;
        lastRight = p.x + w / 2;
      }
    });
    return flags;
  }, [points]);

  // Nhãn số trên điểm: kiểm tra va chạm 2D giữa các khối chữ, quét trái sang phải
  const visibleLabel = useMemo(() => {
    const font = `700 ${labelSize}px ${FONT}`;
    const GAP = 4;
    const LABEL_H = labelSize + 3;
    const flags = new Array(points.length).fill(false);
    const xs = new Array(points.length).fill(0);
    const shown = [];
    points.forEach((p, i) => {
      if (p.val <= 0) return;
      if (p.x < -panX - 1 || p.x > -panX + plotWidth + 1) return; // điểm nằm ngoài khung nhìn
      const w = measureTextWidth(formatShort(p.val), font);
      // giữ nhãn nằm trọn trong khung nhìn (không bị cắt ở mép trái/phải)
      const cx = Math.min(Math.max(p.x, -panX + w / 2 + 2), -panX + plotWidth - w / 2 - 2);
      xs[i] = cx;
      const box = { left: cx - w / 2 - GAP / 2, right: cx + w / 2 + GAP / 2, top: p.y - 12 - LABEL_H, bottom: p.y - 12 };
      if (shown.some((b) => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top)) return;
      flags[i] = true;
      shown.push(box);
    });
    return { flags, xs };
  }, [points, labelSize, panX, plotWidth]);

  const tickStepY = Math.max(MIN_TICK_STEP / Y_TICK_MAX_COUNT, pickNiceStep(viewRangeY, Y_TICK_MAX_COUNT));
  const tickVals = [];
  {
    const lastTick = Math.floor(viewMaxY / tickStepY) * tickStepY;
    for (let v = lastTick; v >= viewMinY - tickStepY * 0.001; v -= tickStepY) tickVals.push(v);
    if (tickVals.length === 0) tickVals.push(viewMinY);
  }
  const tickKey = tickVals.join(',');
  const axisWidth = useMemo(() => {
    let maxW = 0;
    tickVals.forEach((tv) => (maxW = Math.max(maxW, measureTextWidth(formatShort(tv), `500 10px ${FONT}`))));
    return Math.max(AXIS_MIN_WIDTH, Math.ceil(maxW) + 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickKey]);

  const snapChartBack = useCallback(() => {
    setPanX((prev) => {
      const clamped = clampPan(prev, scaleX);
      if (clamped !== prev) {
        setBouncing(true);
        setTimeout(() => setBouncing(false), BOUNCE_BACK_MS);
        return clamped;
      }
      return prev;
    });
  }, [clampPan, scaleX]);

  // ---- Zoom quanh 1 điểm (dùng chung cho chuột) ----
  const zoomAt = (clientX, clientY, fx, fy) => {
    const rect = plotAreaRef.current.getBoundingClientRect();
    if (fx !== 1) {
      const focal = (clientX - rect.left - panX) / scaleX;
      const s = Math.min(maxScaleX, Math.max(MIN_SCALE, scaleX * fx));
      setScaleX(s);
      setPanX(clampPan(clientX - rect.left - focal * s, s));
    }
    if (fy !== 1) {
      const yRel = clientY - rect.top - padT;
      const valFocal = viewMinY + (viewMaxY - viewMinY) * (1 - yRel / plotH);
      const s = Math.min(MAX_SCALE_Y, Math.max(MIN_SCALE, scaleY * fy));
      const newRange = fullRangeY / s;
      const newMaxPan = Math.max(0, (fullRangeY - newRange) / 2);
      setScaleY(s);
      setPanYValue(clampPanY(valFocal + newRange * (yRel / plotH - 0.5) - (chartMax + chartMin) / 2, newMaxPan));
    }
  };

  // ---- Chọn nhanh khoảng thời gian ----
  const applyRange = (r) => {
    const s = r.months ? Math.min(maxScaleX, Math.max(1, N / r.months)) : 1;
    setAnimating(true);
    setTimeout(() => setAnimating(false), 380);
    setScaleX(s);
    setPanX(-Math.max(0, plotWidth * s - plotWidth));
    setScaleY(1);
    setPanYValue(0);
    setSelectedIdx(null);
  };
  const activeRange = RANGES.find((r) => {
    const s = r.months ? Math.min(maxScaleX, Math.max(1, N / r.months)) : 1;
    return Math.abs(s - scaleX) < 0.02 && scaleY === 1;
  });

  // ---------------- Cảm ứng ----------------
  const onTouchStart = (e) => {
    const g = gestureRef.current;
    if (e.touches.length === 2) {
      const [t0, t1] = e.touches;
      g.mode = 'pinch';
      g.startDistX = Math.abs(t0.clientX - t1.clientX) || 1;
      g.startDistY = Math.abs(t0.clientY - t1.clientY) || 1;
      g.startScaleX = scaleX;
      g.startScaleY = scaleY;
      const rect = plotAreaRef.current.getBoundingClientRect();
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      g.rectLeft = rect.left;
      g.rectTop = rect.top;
      g.focalX = (midX - rect.left - panX) / scaleX;
      g.focalVal = viewMinY + (viewMaxY - viewMinY) * (1 - (midY - rect.top - padT) / plotH);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const t = e.touches[0];
      const isDoubleTap = now - (g.lastTapUpTime || 0) < DOUBLE_TAP_MAX_INTERVAL && Math.hypot(t.clientX - (g.lastTapUpX || 0), t.clientY - (g.lastTapUpY || 0)) < DOUBLE_TAP_MAX_DIST;
      if (isDoubleTap && plotAreaRef.current) {
        // double-tap rồi giữ kéo: kéo ngang = zoom trục X, kéo dọc = zoom trục Y, kéo chéo = cả 2
        g.mode = 'zoomDrag';
        g.startTouchX = t.clientX;
        g.startTouchY = t.clientY;
        g.startScaleX = scaleX;
        g.startScaleY = scaleY;
        const rect = plotAreaRef.current.getBoundingClientRect();
        g.rectLeft = rect.left;
        g.rectTop = rect.top;
        g.focalX = (t.clientX - rect.left - panX) / scaleX;
        g.focalVal = viewMinY + (viewMaxY - viewMinY) * (1 - (t.clientY - rect.top - padT) / plotH);
        g.anchorX = t.clientX;
        g.anchorY = t.clientY;
        g.lastTapUpTime = 0;
      } else {
        g.mode = 'pan';
        g.startTouchX = t.clientX;
        g.startPanX = panX;
        g.startTouchY = t.clientY;
        g.startPanY = panYValue;
        g.tapStartX = t.clientX;
        g.tapStartY = t.clientY;
        g.tapStartTime = now;
        g.moved = false;
      }
    }
    setBouncing(false);
  };
  const applyZoom = (newScaleX, newScaleY, anchorX, anchorY) => {
    const g = gestureRef.current;
    setScaleX(newScaleX);
    setPanX(clampPan(anchorX - g.rectLeft - g.focalX * newScaleX, newScaleX));
    setScaleY(newScaleY);
    const newRangeY = fullRangeY / newScaleY;
    const newMaxPanY = Math.max(0, (fullRangeY - newRangeY) / 2);
    const yRel = anchorY - g.rectTop - padT;
    setPanYValue(clampPanY(g.focalVal + newRangeY * (yRel / plotH - 0.5) - (chartMax + chartMin) / 2, newMaxPanY));
  };
  const onTouchMove = (e) => {
    const g = gestureRef.current;
    if (g.mode === 'pinch' && e.touches.length === 2) {
      const [t0, t1] = e.touches;
      const ratioX = Math.max(Math.abs(t0.clientX - t1.clientX), 12) / Math.max(g.startDistX, 12);
      const ratioY = Math.max(Math.abs(t0.clientY - t1.clientY), 12) / Math.max(g.startDistY, 12);
      applyZoom(
        Math.min(maxScaleX, Math.max(MIN_SCALE, g.startScaleX * ratioX)),
        Math.min(MAX_SCALE_Y, Math.max(MIN_SCALE, g.startScaleY * ratioY)),
        (t0.clientX + t1.clientX) / 2,
        (t0.clientY + t1.clientY) / 2
      );
    } else if (g.mode === 'zoomDrag' && e.touches.length === 1) {
      const rawDx = e.touches[0].clientX - g.startTouchX;
      const rawDy = e.touches[0].clientY - g.startTouchY;
      const dx = invertZoom ? -rawDx : rawDx;
      const dy = invertZoom ? -rawDy : rawDy;
      applyZoom(
        Math.min(maxScaleX, Math.max(MIN_SCALE, g.startScaleX * Math.pow(1.01, dx))),
        Math.min(MAX_SCALE_Y, Math.max(MIN_SCALE, g.startScaleY * Math.pow(1.01, -dy))),
        g.anchorX,
        g.anchorY
      );
    } else if (g.mode === 'pan' && e.touches.length === 1) {
      const t = e.touches[0];
      if (Math.abs(t.clientX - g.tapStartX) > 8 || Math.abs(t.clientY - g.tapStartY) > 8) g.moved = true;
      const dx = t.clientX - g.startTouchX;
      const dy = t.clientY - g.startTouchY;
      if (scaleX > 1) setPanX(rubberBandPan(g.startPanX + dx, scaleX));
      if (scaleY > 1 && plotH > 0) setPanYValue(clampPanY(g.startPanY + (dy / plotH) * viewRangeY, maxPanY));
    }
  };
  const nearestIndex = (clientX) => {
    const rect = plotAreaRef.current.getBoundingClientRect();
    const localX = clientX - rect.left - panX;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - localX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };
  const onTouchEnd = (e) => {
    const g = gestureRef.current;
    if (g.mode === 'pan' && !g.moved && Date.now() - g.tapStartTime < 350 && plotAreaRef.current) {
      // chạm nhẹ -> chọn điểm gần nhất theo trục ngang, chạm lại đúng điểm đó thì tắt
      const i = nearestIndex(g.tapStartX);
      setSelectedIdx((prev) => (prev === i ? null : i));
      const ct = e.changedTouches && e.changedTouches[0];
      g.lastTapUpTime = Date.now();
      g.lastTapUpX = ct ? ct.clientX : g.tapStartX;
      g.lastTapUpY = ct ? ct.clientY : g.tapStartY;
    }
    if (e.touches.length === 0) {
      g.mode = null;
      snapChartBack();
    } else if (e.touches.length === 1) {
      g.mode = 'pan';
      g.startTouchX = e.touches[0].clientX;
      g.startPanX = panX;
      g.startTouchY = e.touches[0].clientY;
      g.startPanY = panYValue;
    }
  };

  // ---------------- Chuột (PC) ----------------
  // lăn chuột = zoom ngang quanh con trỏ, Shift + lăn = zoom dọc, Ctrl + lăn = cả 2, lăn ngang = cuộn
  const wheelRef = useRef(null);
  wheelRef.current = (e) => {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      setPanX((p) => clampPan(p - e.deltaX, scaleX));
      return;
    }
    const f = Math.exp(-e.deltaY * 0.0015);
    if (e.ctrlKey) zoomAt(e.clientX, e.clientY, f, f);
    else if (e.shiftKey) zoomAt(e.clientX, e.clientY, 1, f);
    else zoomAt(e.clientX, e.clientY, f, 1);
  };
  useEffect(() => {
    const el = plotAreaRef.current;
    if (!el) return;
    const h = (e) => wheelRef.current(e);
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, []);
  const [grabbing, setGrabbing] = useState(false);
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const g = gestureRef.current;
    g.mouse = { x: e.clientX, y: e.clientY, panX, panY: panYValue, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setBouncing(false);
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    const g = gestureRef.current;
    if (g.mouse) {
      const dx = e.clientX - g.mouse.x;
      const dy = e.clientY - g.mouse.y;
      if (!g.mouse.moved && Math.hypot(dx, dy) > 4) {
        g.mouse.moved = true;
        setGrabbing(true);
      }
      if (g.mouse.moved) {
        if (scaleX > 1) setPanX(rubberBandPan(g.mouse.panX + dx, scaleX));
        if (scaleY > 1 && plotH > 0) setPanYValue(clampPanY(g.mouse.panY + (dy / plotH) * viewRangeY, maxPanY));
        return;
      }
    }
    setSelectedIdx(nearestIndex(e.clientX)); // rê chuột để xem số từng tháng
  };
  const onPointerUp = (e) => {
    if (e.pointerType !== 'mouse') return;
    gestureRef.current.mouse = null;
    setGrabbing(false);
    snapChartBack();
  };
  const onPointerLeave = (e) => {
    if (e.pointerType === 'mouse' && !gestureRef.current.mouse) setSelectedIdx(null);
  };

  const goalY = goal > 0 ? yOf(goal) : null;
  const showGoal = goalY !== null && goalY >= padT - 2 && goalY <= baseY;
  const transition = bouncing || animating ? `transform ${BOUNCE_BACK_MS}ms var(--ease-out)` : 'none';

  return (
    <div className="chart-wrap">
      <div className="card-h">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <div className="seg" style={{ marginLeft: 'auto' }}>
          {MODES.map((m) => (
            <button key={m.key} className={mode === m.key ? 'on' : ''} onClick={() => setMode(m.key)} title={'Kiểu ' + m.label.toLowerCase()} aria-label={'Kiểu ' + m.label.toLowerCase()} style={{ padding: '3px 7px', display: 'grid', placeItems: 'center' }}>
              <m.Icon size={15} />
            </button>
          ))}
        </div>
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r.key} className={activeRange === r ? 'on' : ''} onClick={() => applyRange(r)} title={`Xem ${r.pcLabel.toLowerCase()}`}>
              {pc ? r.pcLabel : r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-row">
        <div className="chart-axis" style={{ width: axisWidth }}>
          {tickVals.map((tv, i) => (
            <div key={i} className="money" style={{ top: yOf(tv) - 7 }}>
              {formatShort(tv)}
            </div>
          ))}
        </div>
        <div
          ref={plotAreaRef}
          className={'chart-plot' + (grabbing ? ' grabbing' : '')}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onDoubleClick={() => applyRange(RANGES[0])}
        >
          <svg width={effectiveWidth} height={plotHeightPx} className="num" style={{ transform: `translateX(${panX}px)`, transition }}>
            <defs>
              <linearGradient id="mmtBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#F04447" />
                <stop offset="1" stopColor="#A8262A" />
              </linearGradient>
              <linearGradient id="mmtArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E5383B" stopOpacity=".32" />
                <stop offset="1" stopColor="#E5383B" stopOpacity="0" />
              </linearGradient>
            </defs>
            {tickVals.map((tv, i) => (
              <line key={i} x1={0} x2={effectiveWidth} y1={yOf(tv)} y2={yOf(tv)} stroke="#33363d" strokeWidth={1} />
            ))}
            {yearBoundaryX.map((x, i) => (
              <line key={i} x1={x} x2={x} y1={padT} y2={baseY} stroke="#4a4e57" strokeWidth={1.2} strokeDasharray="4 4" />
            ))}
            {earliestPoint && !isBar && (
              <g>
                <line x1={0} x2={effectiveWidth} y1={earliestPoint.y} y2={earliestPoint.y} stroke="#F2B84B" strokeOpacity=".55" strokeWidth={1.1} strokeDasharray="5 4" />
                <text className="money" x={4 - panX} y={earliestPoint.y - 5} fontSize={10} fontWeight={600} fill="#F2B84B">
                  {formatShort(earliestPoint.val)}
                </text>
              </g>
            )}
            {showGoal && (
              <g>
                <line x1={0} x2={effectiveWidth} y1={goalY} y2={goalY} stroke="#3DDC8A" strokeOpacity=".7" strokeWidth={1.2} strokeDasharray="6 4" />
                <text className="money" x={plotWidth - panX - 6} y={goalY - 5} fontSize={10} fontWeight={700} fill="#3DDC8A" textAnchor="end">
                  Mục tiêu {formatShort(goal)}
                </text>
              </g>
            )}
            {points.map((p, i) =>
              visibleMonthLabel[i] ? (
                <text key={i} x={p.x} y={plotHeightPx - 26} fontSize={10} fontWeight={500} fill="#8D929C" textAnchor="middle">
                  T{p.m}
                </text>
              ) : null
            )}
            {!isBar && segments.map((seg, i) => (
              <path key={'a' + i} d={`${linePath(seg)} L ${seg[seg.length - 1].x} ${baseY} L ${seg[0].x} ${baseY} Z`} fill="url(#mmtArea)" />
            ))}
            {!isBar && segments.map((seg, i) => (
              <path key={'l' + i} d={linePath(seg)} fill="none" stroke="#E5383B" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {isBar &&
              points.map((p, i) => {
                if (p.val <= 0) return null;
                const x = p.x - barW / 2;
                const rx = Math.min(4, barW / 4);
                const sel = selectedIdx === i;
                const st = mode === 'stack' && stacks && stacks[i];
                if (!st) {
                  return (
                    <rect key={'b' + i} x={x} y={p.y} width={barW} height={Math.max(0, baseY - p.y)} rx={rx} fill={sel ? '#FF5A5D' : 'url(#mmtBar)'} />
                  );
                }
                // cột chồng: xếp các mục từ dưới lên, tỉ lệ theo tổng của tháng
                let acc = 0;
                const h = Math.max(0, baseY - p.y);
                const tot = st.reduce((a, e) => a + e.value, 0) || 1;
                return (
                  <g key={'s' + i} opacity={selectedIdx === null || sel ? 1 : 0.55}>
                    <clipPath id={'cb' + i}>
                      <rect x={x} y={p.y} width={barW} height={h} rx={rx} />
                    </clipPath>
                    <g clipPath={`url(#cb${i})`}>
                      {st.map((e) => {
                        const sh = (e.value / tot) * h;
                        const y = baseY - acc - sh;
                        acc += sh;
                        return <rect key={e.name} x={x} y={y} width={barW} height={sh + 0.5} fill={e.color} />;
                      })}
                    </g>
                  </g>
                );
              })}
            {points.map((p, i) =>
              p.val > 0 ? (
                <g key={i}>
                  {!isBar && <circle cx={p.x} cy={p.y} r={3.4} fill="#E5383B" stroke="#26292F" strokeWidth={1.8} />}
                  {visibleLabel.flags[i] && selectedIdx !== i && (
                    <text className="money" x={visibleLabel.xs[i]} y={p.y - (isBar ? 7 : 12)} fontSize={labelSize} fontWeight={700} fill="#E8E9EC" textAnchor="middle">
                      {formatShort(p.val)}
                    </text>
                  )}
                </g>
              ) : (
                <circle key={i} cx={p.x} cy={baseY} r={2} fill="#3f434b" />
              )
            )}
            {selectedIdx !== null && points[selectedIdx] && selectedLabelInfo && (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={points[selectedIdx].x} x2={points[selectedIdx].x} y1={padT} y2={baseY} stroke="#E8E9EC" strokeOpacity=".8" strokeWidth={1.2} strokeDasharray="4 3" />
                {points[selectedIdx].val > 0 && !isBar && <circle cx={points[selectedIdx].x} cy={points[selectedIdx].y} r={5.5} fill="#E5383B" stroke="#fff" strokeWidth={2} />}
                <rect
                  x={selectedLabelInfo.cx - selectedLabelInfo.boxW / 2}
                  y={selectedLabelInfo.cy - selectedLabelInfo.boxH / 2}
                  width={selectedLabelInfo.boxW}
                  height={selectedLabelInfo.boxH}
                  rx={8}
                  fill="rgba(31,33,38,0.96)"
                  stroke="#E5383B"
                  strokeWidth={1}
                />
                <text className="money" x={selectedLabelInfo.cx} y={selectedLabelInfo.cy - 2} fontSize={17} fontWeight={700} fill="#fff" textAnchor="middle">
                  {selectedLabelInfo.text}
                </text>
                <text x={selectedLabelInfo.cx} y={selectedLabelInfo.cy + 16} fontSize={12} fontWeight={600} fill="#8D929C" textAnchor="middle">
                  {selectedLabelInfo.subtext}
                </text>
              </g>
            )}
          </svg>
          {/* lớp nhãn năm dính mép, không cuộn theo biểu đồ */}
          <svg width={plotWidth} height={plotHeightPx} style={{ pointerEvents: 'none' }}>
            {stickyYearLabels.map((yl, i) => (
              <text key={i} x={yl.displayX} y={plotHeightPx - 8} fontSize={13} fontWeight={700} fill="#F2B84B" textAnchor="middle">
                {yl.year}
              </text>
            ))}
          </svg>
        </div>
      </div>
      {mode === 'stack' && stacks && (() => {
        // chú thích màu: theo tháng đang chọn, không thì tháng mới nhất có dữ liệu
        let idx = selectedIdx !== null && stacks[selectedIdx] ? selectedIdx : -1;
        if (idx < 0) for (let k = stacks.length - 1; k >= 0; k--) if (stacks[k] && stacks[k].length) { idx = k; break; }
        if (idx < 0) return null;
        const st = [...stacks[idx]].reverse();
        return (
          <div className="stack-legend num">
            <span className="muted">T{months[idx].month}/{months[idx].year}:</span>
            {st.map((e) => (
              <span key={e.name}>
                <i style={{ background: e.color }} />
                {e.name}
                {selectedIdx === idx && <b className="money"> {formatShort(e.value)}</b>}
              </span>
            ))}
          </div>
        );
      })()}
      {pc && <div className="chart-hint">Lăn chuột: zoom ngang · Shift+lăn: zoom dọc · Kéo: di chuyển · Nhấp đúp: về 1 năm</div>}
    </div>
  );
}
