// Điểm vào: vẽ văn phòng toàn màn hình, menu, trình sắp xếp nội thất, màn chào, kết nối backend.

import { ISO, bindContext, floorRect, isoSort, line, poly, project, unproject } from "./iso.js";
import {
  CATALOG, DEFAULT_LAYOUT, drawItem, drawPaperBall, fitsInRoom, footprint, overlapsAny, pickItem, rot, runtime,
  sceneDrawables, seatPoint, usePoint,
} from "./furniture.js";
import { nearestWalkable, rebuild, reachable } from "./pathfinding.js";
import {
  ORDER, TICK_HZ, agentDrawables, applyActivity, applyHandoff, applyStatus, bubbleOf, effects, fileReportScene, flags,
  getTick, lookAt, printReportScene, renameStaff, runScript, seatEveryone, setLayout, staff, trashReportScene, update,
} from "./sim.js";
import { drawAgent, drawOverlay, roleColor } from "./characters.js";
import { duties, titles } from "./dialogue.js";
import { applyI18n, clientName, fmtDate, fmtDateTime, fmtTime, getLang, LANGS, setLang, t } from "./i18n.js";
import { renderMarkdown } from "./markdown.js";
import { applyIcons, icon, setLabel } from "./icons.js";
import { drawSkyline } from "./skyline.js";
import { delay, loadClient, openPledge, playIntro } from "./onboarding.js";
import { cancelDemo, isDemoRunning, runDemo } from "./demo.js";

const $ = id => document.getElementById(id);
applyIcons();
const canvas = $("officeCanvas");
const ctx = canvas.getContext("2d");
bindContext(ctx);

const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
};

let client = loadClient();

// ===========================================================================
// Bố trí nội thất
// ===========================================================================
const LAYOUT_KEY = "ai-office-layout-v2";
const LEGACY_IDS = { researcher: "analyst", coder: "quant", tester: "risk" }; // bản IT cũ -> công ty cổ phiếu
const newId = () => `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function loadLayout() {
  const saved = store.get(LAYOUT_KEY, null);
  if (Array.isArray(saved) && saved.length) {
    const items = saved.filter(it => it && CATALOG[it.type] && Number.isFinite(it.x) && Number.isFinite(it.y))
      .map(it => {
        const who = LEGACY_IDS[it.assignedTo] || it.assignedTo;
        return { id: String(it.id || newId()), type: it.type, x: it.x, y: it.y, rotation: rot(it), assignedTo: staff[who] ? who : "" };
      });
    const seen = new Set();
    for (const it of items) {
      if (it.type !== "desk" || !it.assignedTo) continue;
      if (seen.has(it.assignedTo)) it.assignedTo = ""; else seen.add(it.assignedTo);
    }
    if (items.length) return addFixtures(items);
  }
  return defaultLayout();
}

// Bản cũ chưa có tủ hồ sơ / thùng rác: tự kê thêm một lần cạnh bàn Giám đốc (người dùng xoá sau đó thì thôi).
const FIXTURE_KEY = "ai-office-fixtures-v1";
function addFixtures(items) {
  if (store.get(FIXTURE_KEY, false)) return items;
  store.set(FIXTURE_KEY, true);
  const desk = items.find(it => it.type === "desk" && it.assignedTo === "manager");
  const seat = desk ? seatPoint(desk) : { x: 455, y: 83 };
  const seats = items.filter(it => it.type === "desk").map(seatPoint);
  const fine = (item, list) => {
    if (!fitsInRoom(item) || overlapsAny(item, list)) return false;
    const b = footprint(item); // chừa khoảng trống quanh ghế Giám đốc
    if (Math.hypot(Math.max(b.x0 - seat.x, 0, seat.x - b.x1), Math.max(b.y0 - seat.y, 0, seat.y - b.y1)) < 24) return false;
    rebuild([...list, item]);
    if (!seats.every(p => reachable(seat, p))) return false;
    if (item.type !== "cabinet") return true;
    const use = usePoint(item), w = use && nearestWalkable(use.x, use.y);
    return !!w && Math.hypot(w.x - use.x, w.y - use.y) < 10 && reachable(seat, w);
  };
  let added = false;
  for (const type of ["cabinet", "trash"]) {
    if (items.some(it => it.type === type)) continue;
    const preset = DEFAULT_LAYOUT.find(it => it.type === type);
    const cands = [{ x: preset.x, y: preset.y }];
    for (let x = 40; x <= 520; x += 5) {
      for (let y = 40; y <= 520; y += 5) {
        const d = Math.hypot(x - seat.x, y - seat.y);
        if (d > 25 && d < 170) cands.push({ x, y, d });
      }
    }
    cands.sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
    for (const c of cands.slice(0, 400)) {
      const item = { id: newId(), type, x: c.x, y: c.y, rotation: 0, assignedTo: "" };
      if (fine(item, items)) { items.push(item); added = true; break; }
    }
  }
  if (added) store.set(LAYOUT_KEY, items.map(({ _cache, ...rest }) => rest));
  return items;
}
const defaultLayout = () => DEFAULT_LAYOUT.map(it => ({ id: newId(), assignedTo: "", rotation: 0, ...it }));

let layout = loadLayout();

function commitLayout({ persist = true } = {}) {
  rebuild(layout);
  setLayout(layout);
  if (persist && !store.set(LAYOUT_KEY, layout.map(({ _cache, ...rest }) => rest))) {
    setHint(t("furn.storageFail"));
  }
  renderEditor();
}

// ===========================================================================
// Khung nhìn: văn phòng (toạ độ logic 620×620) được co giãn vào vùng trống giữa các khung giao diện.
// ===========================================================================
const ROOM_BOX = { x0: 48, y0: -10, x1: 572, y1: 592 }; // vùng logic cần hiển thị (gồm cả bảng tên trên đầu)
const view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };
const reportView = { expanded: false };

function visible(el) { return el && !el.hidden && el.getClientRects().length > 0; }

function layoutView() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  let top = 64, bottom = H - 12, left = 12, right = W - 12;
  const task = $("taskbar");
  if (visible(task)) bottom = task.getBoundingClientRect().top - 8;
  if (W > 1000) {
    if (visible($("reportPanel")) && !reportView.expanded) left = $("reportPanel").getBoundingClientRect().right + 8;
    if (visible($("sidePanel"))) right = $("sidePanel").getBoundingClientRect().left - 8;
  }
  const bw = ROOM_BOX.x1 - ROOM_BOX.x0, bh = ROOM_BOX.y1 - ROOM_BOX.y0;
  const availW = Math.max(240, right - left), availH = Math.max(240, bottom - top);
  const scale = Math.min(availW / bw, availH / bh);
  const ox = left + (availW - bw * scale) / 2 - ROOM_BOX.x0 * scale;
  const oy = top + (availH - bh * scale) / 2 - ROOM_BOX.y0 * scale;
  const cx = left + availW / 2, cy = top + availH / 2;
  Object.assign(view, {
    dpr, w: W, h: H, scale, ox, oy, cx, cy, availW, availH,
    home: { x: (cx - ox) / scale, y: (cy - oy) / scale }, // điểm logic nằm giữa vùng trống khi chưa zoom
  });
  if (camera.focus === null) camera.focus = { ...view.home };
  if (camera.follow) camera.targetZoom = followZoom();
  // Cụm nút zoom nằm ở góc trên-phải của vùng trống, né khung bên và các nút 📋 / 👥 khi khung bị thu gọn.
  const zc = $("zoomControls");
  let zRight = right;
  let zLeft = left;
  if (visible($("sideTab"))) zRight = Math.min(zRight, $("sideTab").getBoundingClientRect().left - 8);
  if (visible($("reportTab"))) zLeft = Math.max(zLeft, $("reportTab").getBoundingClientRect().right + 8);
  let zTop = top + 2;
  if (zRight - zc.offsetWidth < zLeft) {
    // Màn hình quá hẹp để xếp cùng hàng với các nút: xuống hàng dưới.
    zRight = W - 12;
    zTop = Math.max($("sideTab").getBoundingClientRect().bottom, $("reportTab").getBoundingClientRect().bottom) + 8;
  }
  zc.style.left = `${Math.max(8, Math.round(zRight - zc.offsetWidth))}px`;
  zc.style.top = `${Math.round(zTop)}px`;
}

// ---------------------------------------------------------------------------
// Camera: phóng to mượt vào một nhân viên (vd. Giám đốc khi chào khách) rồi thu nhỏ về.
// Toạ độ màn hình = tâm vùng trống + (điểm logic − tiêu điểm) × scale × zoom.
// Khi zoom = 1 và tiêu điểm = view.home thì trùng khít với khung nhìn bình thường.
// ---------------------------------------------------------------------------
const camera = { zoom: 1, targetZoom: 1, focus: null, follow: null, manual: null, speed: 2.2, pan: null };
const ZOOM_MIN = 1, ZOOM_MAX = 4;

// Đủ to để nhân vật + bong bóng thoại chiếm khoảng 2/3 chiều cao vùng trống.
function followZoom() {
  return Math.max(1.4, Math.min(3, (view.availH * 0.66) / (210 * view.scale)));
}
function focusTarget() {
  if (!camera.follow) return camera.manual || view.home;
  const a = staff[camera.follow];
  const p = project(a.x, a.y);
  return { x: p.x, y: p.y - 80 }; // hơi cao hơn đầu để chừa chỗ cho bong bóng thoại
}
function zoomTo(id) { camera.follow = id; camera.manual = null; camera.speed = 2.2; camera.targetZoom = followZoom(); }
function zoomOut() { camera.follow = null; camera.manual = null; camera.speed = 2.2; camera.targetZoom = 1; }

// ---- Người dùng tự phóng to / thu nhỏ / kéo ----
// Giữ tiêu điểm trong phạm vi phòng để không kéo văn phòng ra khỏi màn hình.
function clampFocus(f) {
  return { x: Math.max(ROOM_BOX.x0, Math.min(ROOM_BOX.x1, f.x)), y: Math.max(ROOM_BOX.y0, Math.min(ROOM_BOX.y1, f.y)) };
}
// Phóng to/thu nhỏ quanh một điểm màn hình (sx, sy): điểm văn phòng nằm dưới con trỏ đứng yên.
function zoomAt(sx, sy, factor) {
  if (camera.follow) return; // đang có cảnh chào khách thì không giành camera
  const z0 = camera.targetZoom;
  const z1 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z0 * factor));
  if (Math.abs(z1 - z0) < 1e-4) return;
  const f0 = camera.manual || camera.focus;
  const s0 = view.scale * z0, s1 = view.scale * z1;
  const px = f0.x + (sx - view.cx) / s0, py = f0.y + (sy - view.cy) / s0;
  camera.speed = 10;
  camera.targetZoom = z1;
  camera.manual = z1 <= ZOOM_MIN + 1e-3 ? null : clampFocus({ x: px - (sx - view.cx) / s1, y: py - (sy - view.cy) / s1 });
  updateZoomUi();
}
function resetZoom() {
  if (camera.follow) return;
  camera.speed = 6;
  camera.targetZoom = 1;
  camera.manual = null;
  updateZoomUi();
}
function updateZoomUi() {
  $("zoomLevel").textContent = `${Math.round(camera.targetZoom * 100)}%`;
  $("zoomOutBtn").disabled = camera.targetZoom <= ZOOM_MIN + 1e-3;
  $("zoomInBtn").disabled = camera.targetZoom >= ZOOM_MAX - 1e-3;
  canvas.classList.toggle("can-pan", camera.targetZoom > 1.001 && !editor.open);
}

canvas.addEventListener("wheel", event => {
  event.preventDefault();
  const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY; // chuột "theo dòng" (Firefox)
  zoomAt(event.clientX, event.clientY, Math.exp(-delta * 0.0015));
}, { passive: false });
canvas.addEventListener("dblclick", () => { if (!editor.open) resetZoom(); });
canvas.addEventListener("contextmenu", event => { if (camera.pan || camera.targetZoom > 1) event.preventDefault(); });

// Kéo để di chuyển khi đã phóng to: chuột trái (khi không sắp xếp nội thất), hoặc chuột phải/giữa (bất kỳ lúc nào).
function startPan(event) {
  const wantsPan = event.button === 1 || event.button === 2 || (event.button === 0 && !editor.open);
  if (!wantsPan || camera.follow || camera.targetZoom <= 1.001) return false;
  camera.pan = { x: event.clientX, y: event.clientY, id: event.pointerId };
  camera.manual = camera.manual || { ...camera.focus };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-panning");
  return true;
}
function movePan(event) {
  if (!camera.pan) return false;
  const s = view.scale * camera.zoom;
  const next = clampFocus({
    x: camera.manual.x - (event.clientX - camera.pan.x) / s,
    y: camera.manual.y - (event.clientY - camera.pan.y) / s,
  });
  camera.manual = next;
  camera.focus = { ...next }; // kéo thì bám tay ngay, không trễ
  camera.pan.x = event.clientX;
  camera.pan.y = event.clientY;
  return true;
}
function endPan() {
  if (!camera.pan) return false;
  camera.pan = null;
  canvas.classList.remove("is-panning");
  return true;
}

function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * camera.speed); // chào khách: chậm (~1,4 giây); người dùng lăn chuột: nhanh
  const t = focusTarget();
  camera.zoom += (camera.targetZoom - camera.zoom) * k;
  camera.focus.x += (t.x - camera.focus.x) * k;
  camera.focus.y += (t.y - camera.focus.y) * k;
  if (!camera.follow && !camera.manual && Math.abs(camera.zoom - 1) < 0.001) { camera.zoom = 1; camera.focus = { ...view.home }; }
}
window.addEventListener("resize", layoutView);
new ResizeObserver(layoutView).observe(document.body);

// Toạ độ chuột -> toạ độ logic của văn phòng.
function canvasPoint(event) {
  const s = view.scale * camera.zoom;
  return { x: camera.focus.x + (event.clientX - view.cx) / s, y: camera.focus.y + (event.clientY - view.cy) / s };
}

// ===========================================================================
// Vẽ phòng
// ===========================================================================
// Văn bản dán lên tường sau (mặt phẳng y = Y) hoặc tường trái (x = X, chữ chạy theo chiều y giảm).
function wallText(plane, at, text, font, color, { clip = null, offset = 0 } = {}) {
  const len = Math.hypot(ISO.kx, ISO.ky);
  const p = plane === "back" ? project(at.x, at.y, at.z) : project(at.x, at.y, at.z);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (plane === "back") ctx.transform(ISO.kx / len, ISO.ky / len, 0, 1, 0, 0);
  else ctx.transform(ISO.kx / len, -ISO.ky / len, 0, 1, 0, 0);
  if (clip) { ctx.beginPath(); ctx.rect(0, -clip.h, clip.w, clip.h); ctx.clip(); }
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, -offset, 0);
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}

function drawFloor() {
  poly([{ x: 24, y: 24 }, { x: 536, y: 24 }, { x: 536, y: 536 }, { x: 24, y: 536 }], "#101c14", "#53694d");
  poly([{ x: 30, y: 30 }, { x: 530, y: 30 }, { x: 530, y: 530 }, { x: 30, y: 530 }], "#17261b");
  for (let x = 30; x < 530; x += 50) {
    for (let y = 30; y < 530; y += 50) {
      if (((x - 30) / 50 + (y - 30) / 50) % 2 === 0) {
        poly([{ x, y }, { x: x + 50, y }, { x: x + 50, y: y + 50 }, { x, y: y + 50 }], "rgba(102,137,79,0.08)");
      }
    }
  }
  for (let x = 55; x < 536; x += 42) line({ x, y: 30 }, { x, y: 530 }, "rgba(128,164,112,0.12)");
  for (let y = 55; y < 536; y += 42) {
    line({ x: 30, y }, { x: 530, y }, "rgba(8,17,11,0.32)");
    line({ x: 30, y: y + 1 }, { x: 530, y: y + 1 }, "rgba(128,164,112,0.07)");
  }
  poly([{ x: 228, y: 35 }, { x: 332, y: 35 }, { x: 455, y: 350 }, { x: 105, y: 350 }], "rgba(160,207,116,0.09)");
  poly([{ x: 245, y: 42 }, { x: 315, y: 42 }, { x: 385, y: 255 }, { x: 175, y: 255 }], "rgba(188,224,141,0.07)");
  poly([{ x: 24, y: 536 }, { x: 536, y: 536 }, { x: 536, y: 536, z: -14 }, { x: 24, y: 536, z: -14 }], "#1b2b1f", "#506744");
  poly([{ x: 536, y: 24 }, { x: 536, y: 536 }, { x: 536, y: 536, z: -14 }, { x: 536, y: 24, z: -14 }], "#142118", "#506744");
}

// Bảng thị trường minh hoạ trên tường (dữ liệu ngẫu nhiên, mã hư cấu).
const market = {
  series: Array.from({ length: 16 }, () => 0),
  tickers: [["AIX", 52.3], ["MNC", 18.7], ["ORB", 104.0], ["KTE", 33.1], ["LUM", 76.4], ["PXA", 12.9]],
  lastStep: 0,
  tickerOffset: 0,
};
(() => { let v = 50; market.series = market.series.map(() => (v = Math.max(20, Math.min(80, v + (Math.random() - 0.45) * 9)))); })();
function stepMarket(tick) {
  if (tick - market.lastStep < 50) return;
  market.lastStep = tick;
  const last = market.series[market.series.length - 1];
  market.series.push(Math.max(20, Math.min(80, last + (Math.random() - 0.47) * 9)));
  market.series.shift();
  for (const t of market.tickers) t[1] = Math.max(1, t[1] * (1 + (Math.random() - 0.48) * 0.01));
}

function drawWalls(tick) {
  poly([{ x: 24, y: 24 }, { x: 536, y: 24 }, { x: 536, y: 24, z: 120 }, { x: 24, y: 24, z: 120 }], "#24392a", "#58734b");
  poly([{ x: 30, y: 30, z: 8 }, { x: 530, y: 30, z: 8 }, { x: 530, y: 30, z: 116 }, { x: 30, y: 30, z: 116 }], "#1d3022");
  poly([{ x: 24, y: 24 }, { x: 24, y: 536 }, { x: 24, y: 536, z: 120 }, { x: 24, y: 24, z: 120 }], "#2b4230", "#5b7448");
  poly([{ x: 30, y: 30, z: 8 }, { x: 30, y: 530, z: 8 }, { x: 30, y: 530, z: 116 }, { x: 30, y: 30, z: 116 }], "#22362a");

  // Cửa sổ
  const W = (x0, x1, z0, z1, fill, stroke) =>
    poly([{ x: x0, y: 29, z: z0 }, { x: x1, y: 29, z: z0 }, { x: x1, y: 29, z: z1 }, { x: x0, y: 29, z: z1 }], fill, stroke);
  W(205, 355, 49, 105, "#112018", "#718553");
  W(211, 349, 55, 99, "#a8cf83", "#d0e7a2");
  W(211, 349, 55, 62, "#d5eaa6");
  W(278, 283, 55, 99, "#536a45");
  W(211, 349, 76, 80, "#536a45");
  poly([{ x: 205, y: 29, z: 46 }, { x: 355, y: 29, z: 46 }, { x: 355, y: 40, z: 46 }, { x: 205, y: 40, z: 46 }], "#607748", "#a0b877");

  // Bảng thị trường (minh hoạ)
  stepMarket(tick);
  W(390, 528, 52, 108, "#28392c", "#6f8a5a");
  W(393, 525, 63, 105, "#08110c");
  wallText("back", { x: 396, y: 29, z: 98 }, t("wall.market"), "bold 6.5px \"Segoe UI\", sans-serif", "#9fd6a8");
  const min = Math.min(...market.series), max = Math.max(...market.series);
  const zOf = v => 68 + ((v - min) / Math.max(1, max - min)) * 22;
  market.series.forEach((v, i) => {
    if (i === 0) return;
    const prev = market.series[i - 1];
    const x = 398 + i * 7.8;
    const up = v >= prev;
    const z0 = zOf(Math.min(v, prev)), z1 = Math.max(zOf(Math.max(v, prev)), z0 + 1.2);
    line({ x: x + 1.5, y: 29, z: z0 - 2 }, { x: x + 1.5, y: 29, z: z1 + 2 }, up ? "#5fbf74" : "#c8604f");
    W(x, x + 3.2, z0, z1, up ? "#7fe39b" : "#f08a7a");
  });
  // Băng chạy mã cổ phiếu hư cấu
  W(393, 525, 54, 62, "#050a07");
  const tape = market.tickers.map(([s, p], i) => `${s} ${p.toFixed(1)} ${i % 3 === 1 ? "▼" : "▲"}`).join("   ·   ") + "   ·   ";
  market.tickerOffset += 0.25;
  const clipW = 132 * Math.hypot(ISO.kx, ISO.ky);
  const tw = wallText("back", { x: 393, y: 29, z: 56 }, tape, "600 6px Consolas, monospace", "#f2c94c", { clip: { w: clipW, h: 7 }, offset: market.tickerOffset });
  if (tw - market.tickerOffset < clipW) {
    wallText("back", { x: 393, y: 29, z: 56 }, tape, "600 6px Consolas, monospace", "#f2c94c", { clip: { w: clipW, h: 7 }, offset: market.tickerOffset - tw });
  }
  if (market.tickerOffset > tw) market.tickerOffset -= tw;

  // Biển tên công ty trên tường trái
  const P = (y0, y1, z0, z1, fill, stroke) =>
    poly([{ x: 31, y: y0, z: z0 }, { x: 31, y: y1, z: z0 }, { x: 31, y: y1, z: z1 }, { x: 31, y: y0, z: z1 }], fill, stroke);
  P(222, 380, 64, 100, "#0e2617", "#75d899");
  P(354, 374, 72, 94, "#2f8a55");
  wallText("left", { x: 31, y: 372, z: 79 }, "MC", "800 10px \"Segoe UI\", sans-serif", "#04130b");
  wallText("left", { x: 31, y: 346, z: 84 }, "MINI CAPITAL", "800 11px \"Segoe UI\", sans-serif", "#e9f6ec");
  wallText("left", { x: 31, y: 346, z: 73 }, t("wall.tagline"), "600 5.6px \"Segoe UI\", sans-serif", "#9fd6a8");

  // Đồng hồ treo tường – chạy theo giờ thật
  const cx = 180, cz = 92, r = 11, Y = 29;
  const ring = k => Array.from({ length: 16 }, (_, i) => ({ x: cx + Math.cos(i / 16 * Math.PI * 2) * k, y: Y, z: cz + Math.sin(i / 16 * Math.PI * 2) * k }));
  poly(ring(r + 2), "#344831");
  poly(ring(r), "#e7efd3");
  const now = new Date();
  const hand = (frac, len, color, width) => {
    const a = frac * Math.PI * 2;
    line({ x: cx, y: Y, z: cz }, { x: cx + Math.sin(a) * len, y: Y, z: cz + Math.cos(a) * len }, color, width);
  };
  hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12, 6, "#22301f", 2);
  hand((now.getMinutes() + now.getSeconds() / 60) / 60, 8.5, "#22301f", 1.5);
  hand(now.getSeconds() / 60, 9.5, "#c0463a", 1);

  line({ x: 30, y: 31, z: 10 }, { x: 530, y: 31, z: 10 }, "#758d56", 3);
  line({ x: 31, y: 30, z: 10 }, { x: 31, y: 530, z: 10 }, "#758d56", 3);
  line({ x: 30, y: 30, z: 112 }, { x: 530, y: 30, z: 112 }, "#405a3c", 5);
}

// ===========================================================================
// Trình sắp xếp nội thất
// ===========================================================================
const editor = { open: false, placing: null, placingRotation: 0, selectedId: null, drag: null, hover: null, resetArmedUntil: 0 };
const ghost = { id: "ghost", type: "desk", x: 0, y: 0, rotation: 0 };
let drawOrder = [];

const snap = v => Math.round(v / 5) * 5;
const selectedItem = () => layout.find(it => it.id === editor.selectedId) || null;
const validAt = (item, at) => fitsInRoom(item, at) && !overlapsAny(item, layout, at);
function setHint(text) { $("furnitureHint").textContent = text; }

// Bấm vào tủ hồ sơ (khi không sắp xếp nội thất) để mở tủ.
let clickStart = null;
function itemAt(event) {
  const s = canvasPoint(event);
  return pickItem(drawOrder, s.x, s.y, unproject(s.x, s.y));
}
canvas.addEventListener("pointerdown", event => {
  clickStart = !editor.open && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  if (startPan(event)) return;
  if (!editor.open || event.button !== 0) return;
  const s = canvasPoint(event);
  const world = unproject(s.x, s.y);
  if (editor.placing) {
    Object.assign(ghost, { type: editor.placing, rotation: editor.placingRotation, x: snap(world.x), y: snap(world.y) });
    if (!validAt(ghost, ghost)) { setHint(t("furn.cantPlace")); return; }
    const item = { id: newId(), type: ghost.type, x: ghost.x, y: ghost.y, rotation: ghost.rotation, assignedTo: "" };
    layout.push(item);
    editor.selectedId = item.id;
    if (!event.shiftKey) editor.placing = null;
    setHint(event.shiftKey ? t("furn.shiftHint") : t("furn.placed", { label: t(`furn.item.${item.type}`) }));
    commitLayout();
    return;
  }
  const item = pickItem(drawOrder, s.x, s.y, world);
  editor.selectedId = item ? item.id : null;
  if (item) {
    editor.drag = { id: item.id, dx: item.x - world.x, dy: item.y - world.y, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
  }
  renderEditor();
});

canvas.addEventListener("pointermove", event => {
  if (movePan(event)) return;
  if (!editor.open) canvas.classList.toggle("over-cabinet", CLICKABLE.has(itemAt(event)?.type));
  const world = unproject(...Object.values(canvasPoint(event)));
  editor.hover = world;
  if (!editor.drag) return;
  const item = layout.find(it => it.id === editor.drag.id);
  if (!item) return;
  const at = { x: snap(world.x + editor.drag.dx), y: snap(world.y + editor.drag.dy) };
  if ((at.x !== item.x || at.y !== item.y) && validAt(item, at)) {
    item.x = at.x;
    item.y = at.y;
    editor.drag.moved = true;
  }
});

function endDrag() {
  if (!editor.drag) return;
  const moved = editor.drag.moved;
  editor.drag = null;
  canvas.classList.remove("is-dragging");
  if (moved) commitLayout();
}
canvas.addEventListener("pointerup", event => {
  endPan();
  endDrag();
  const c = clickStart;
  clickStart = null;
  if (!c || Math.hypot(event.clientX - c.x, event.clientY - c.y) >= 5) return;
  const type = itemAt(event)?.type;
  if (type === "cabinet") openCabinet();
  else if (type === "printer") openPrinter();
});
canvas.addEventListener("pointercancel", () => { endPan(); endDrag(); });
$("zoomInBtn").addEventListener("click", () => zoomAt(view.cx, view.cy, 1.35));
$("zoomOutBtn").addEventListener("click", () => zoomAt(view.cx, view.cy, 1 / 1.35));
$("zoomReset").addEventListener("click", resetZoom);
document.addEventListener("keydown", event => {
  const tag = document.activeElement?.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || !$("pledge").hidden) return;
  if (event.key === "+" || event.key === "=") zoomAt(view.cx, view.cy, 1.25);
  else if (event.key === "-" || event.key === "_") zoomAt(view.cx, view.cy, 1 / 1.25);
  else if (event.key === "0") resetZoom();
});
canvas.addEventListener("pointerleave", () => { editor.hover = null; });

function rotateSelection() {
  if (editor.placing) { editor.placingRotation = (editor.placingRotation + 1) % 4; renderEditor(); return; }
  const item = selectedItem();
  if (!item) return;
  const turned = { ...item, rotation: (rot(item) + 1) % 4 };
  if (!validAt(turned, turned)) { setHint(t("furn.cantRotate")); return; }
  item.rotation = turned.rotation;
  commitLayout();
}

function deleteSelection() {
  const item = selectedItem();
  if (!item) return;
  layout = layout.filter(it => it !== item);
  editor.selectedId = null;
  setHint(t("furn.deleted", { label: t(`furn.item.${item.type}`) }));
  commitLayout();
}

function furnToggleLabel() {
  setLabel($("furnitureToggle"), editor.open ? "check" : "move", editor.open ? t("furn.done") : t("furn.enable"));
}

function setEditing(on) {
  editor.open = on;
  if (!on) { editor.placing = null; editor.selectedId = null; }
  $("furnitureEditor").hidden = !on;
  $("furnitureToggle").setAttribute("aria-expanded", String(on));
  furnToggleLabel();
  canvas.classList.toggle("is-editing", on);
  renderEditor();
  updateZoomUi();
}

$("furnitureRotate").addEventListener("click", rotateSelection);
$("furnitureDelete").addEventListener("click", deleteSelection);
$("furnitureToggle").addEventListener("click", () => setEditing(!editor.open));
$("furnitureReset").addEventListener("click", () => {
  const btn = $("furnitureReset");
  if (performance.now() > editor.resetArmedUntil) {
    editor.resetArmedUntil = performance.now() + 3000;
    setLabel(btn, "alert", t("furn.confirm"));
    setTimeout(() => { setLabel(btn, "reset", t("furn.reset")); }, 3000);
    return;
  }
  editor.resetArmedUntil = 0;
  setLabel(btn, "reset", t("furn.reset"));
  layout = defaultLayout();
  editor.selectedId = null;
  editor.placing = null;
  setHint(t("furn.restored"));
  commitLayout();
});
$("furnitureAssignment").addEventListener("change", event => {
  const item = selectedItem();
  if (!item || item.type !== "desk") return;
  const who = event.target.value;
  for (const other of layout) if (other.type === "desk" && other.assignedTo === who && who) other.assignedTo = "";
  item.assignedTo = who;
  setHint(who ? t("furn.assigned", { title: titles()[who] }) : t("furn.unassigned"));
  commitLayout();
});
function renderAssignmentOptions() {
  const select = $("furnitureAssignment");
  const value = select.value;
  select.replaceChildren(new Option(t("furn.emptyDesk"), ""), ...ORDER.map(id => new Option(titles()[id], id)));
  select.value = value;
}
renderAssignmentOptions();

function layoutWarnings() {
  const warnings = [];
  for (const id of ORDER) {
    const desk = layout.find(it => it.type === "desk" && it.assignedTo === id);
    if (!desk) warnings.push(t("furn.warn.noDesk", { title: titles()[id] }));
    else if (!reachable(staff[id], seatPoint(desk))) warnings.push(t("furn.warn.blocked", { title: titles()[id] }));
  }
  const has = t => layout.some(it => it.type === t);
  if (!has("whiteboard")) warnings.push(t("furn.warn.noWhiteboard"));
  if (!has("bookshelf")) warnings.push(t("furn.warn.noBookshelf"));
  if (!has("printer")) warnings.push(t("furn.warn.noPrinter"));
  if (!has("cabinet")) warnings.push(t("furn.warn.noCabinet"));
  if (!has("trash")) warnings.push(t("furn.warn.noTrash"));
  return warnings;
}

function renderEditor() {
  $("furnitureCatalog").replaceChildren(...Object.entries(CATALOG).map(([type, def]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `furniture-card${editor.placing === type ? " active" : ""}`;
    setLabel(b, `f-${type}`, t(`furn.item.${type}`));
    b.addEventListener("click", () => {
      editor.placing = editor.placing === type ? null : type;
      editor.selectedId = null;
      setHint(editor.placing ? t("furn.placing", { label: t(`furn.item.${type}`) }) : t("furn.cancelPlace"));
      renderEditor();
    });
    return b;
  }));
  $("furnitureCount").textContent = t("furn.count", { n: layout.length });
  const item = selectedItem();
  $("furnitureRotate").disabled = !item && !editor.placing;
  $("furnitureDelete").disabled = !item;
  setLabel($("furnitureSelection"), item ? `f-${item.type}` : null, item
    ? t("furn.selected", { label: t(`furn.item.${item.type}`), deg: rot(item) * 90 })
    : editor.placing ? t("furn.ready", { label: t(`furn.item.${editor.placing}`), deg: editor.placingRotation * 90 }) : t("furn.none"));
  $("furnitureAssignmentWrap").hidden = !item || item.type !== "desk";
  if (item && item.type === "desk") $("furnitureAssignment").value = item.assignedTo || "";
  canvas.classList.toggle("is-placing", !!editor.placing);
  const warnings = layoutWarnings();
  $("furnitureWarnings").replaceChildren(...warnings.map(w => Object.assign(document.createElement("li"), { textContent: w })));
  $("furnitureWarnings").hidden = !warnings.length;
}

// ===========================================================================
// Vòng lặp vẽ (mô phỏng 60 Hz cố định, vẽ theo tần số màn hình)
// ===========================================================================
const onboarding = { greeting: false };

function render() {
  const tick = getTick();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.45, 0, canvas.width / 2, canvas.height * 0.45, Math.max(canvas.width, canvas.height) * 0.7);
  g.addColorStop(0, "#0f1f15");
  g.addColorStop(1, "#040806");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const s = view.scale * camera.zoom;
  ctx.setTransform(view.dpr * s, 0, 0, view.dpr * s,
    view.dpr * (view.cx - camera.focus.x * s), view.dpr * (view.cy - camera.focus.y * s));

  drawSkyline(ctx, tick); // phong cảnh thành phố bên ngoài (đổi theo ngôn ngữ)
  drawFloor();
  drawWalls(tick);

  if (editor.open) {
    for (let v = 30; v <= 530; v += 50) {
      line({ x: v, y: 30 }, { x: v, y: 530 }, "rgba(168,239,155,0.10)");
      line({ x: 30, y: v }, { x: 530, y: v }, "rgba(168,239,155,0.10)");
    }
  }

  if (onboarding.greeting) lookAt(staff.manager, ["analyst", "quant", "risk"]);
  drawOrder = isoSort([
    ...sceneDrawables(layout),
    ...agentDrawables(a => drawAgent(a, project(a.x, a.y), tick)),
  ]);
  for (const d of drawOrder) d.draw();

  // Cục giấy đang bay theo đường parabol vào thùng rác.
  for (const e of effects) {
    const k = Math.min(1, (tick - e.start) / e.ticks);
    const x = e.from.x + (e.to.x - e.from.x) * k;
    const y = e.from.y + (e.to.y - e.from.y) * k - e.peak * 4 * k * (1 - k);
    drawPaperBall(ctx, x, y, 4.4 - k * 1.4, tick * 0.35);
  }

  if (editor.open) drawEditorOverlay();

  const taken = [];
  [...Object.values(staff)]
    .sort((a, b) => b.x + b.y - (a.x + a.y))
    .forEach(a => drawOverlay(a, project(a.x, a.y), bubbleOf(a), taken));
}

function drawEditorOverlay() {
  const sel = selectedItem();
  if (sel) {
    floorRect(footprint(sel), "rgba(168,239,155,0.10)", "#a8ef9b", [5, 4]);
    if (sel.type === "desk") {
      const seat = project(seatPoint(sel).x, seatPoint(sel).y);
      ctx.fillStyle = sel.assignedTo ? roleColor(sel.assignedTo) : "#a8ef9b";
      ctx.beginPath(); ctx.arc(seat.x, seat.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const desk of layout.filter(it => it.type === "desk")) {
    const owner = desk.assignedTo && staff[desk.assignedTo];
    const seat = seatPoint(desk);
    if (owner && Math.hypot(owner.x - seat.x, owner.y - seat.y) < 20) continue;
    const p = project(desk.x, desk.y, 62);
    const label = owner ? owner.name : t("furn.emptyLabel");
    ctx.font = "600 9px \"Segoe UI\", system-ui, sans-serif";
    ctx.textAlign = "center";
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = "rgba(5,14,9,.8)";
    ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - 11, w, 13, 6); ctx.fill();
    ctx.fillStyle = owner ? roleColor(desk.assignedTo) : "#9ab6a0";
    ctx.fillText(label, p.x, p.y - 1.5);
  }
  if (editor.placing && editor.hover) {
    Object.assign(ghost, { type: editor.placing, rotation: editor.placingRotation, x: snap(editor.hover.x), y: snap(editor.hover.y) });
    const ok = validAt(ghost, ghost);
    floorRect(footprint(ghost), ok ? "rgba(117,216,153,0.18)" : "rgba(224,103,90,0.25)", ok ? "#75d899" : "#e0675a", [4, 3]);
    drawItem(ghost, 0.6);
  }
}

const STEP_MS = 1000 / TICK_HZ;
let lastFrame = performance.now();
let accumulator = 0;
function frame(now) {
  const dt = Math.min(250, now - lastFrame);
  accumulator += dt;
  lastFrame = now;
  while (accumulator >= STEP_MS) { update(); accumulator -= STEP_MS; }
  updateCamera(dt / 1000);
  render();
  requestAnimationFrame(frame);
}

// ===========================================================================
// Khung giao diện: menu, khung thu gọn, đội ngũ, nhật ký, báo cáo, thông báo
// ===========================================================================
const UI_KEY = "ai-office-ui";
const ui = store.get(UI_KEY, { report: window.innerWidth > 1000, side: window.innerWidth > 1000 });

function applyPanels() {
  $("reportPanel").hidden = !ui.report;
  $("sidePanel").hidden = !ui.side;
  $("reportTab").hidden = ui.report;
  $("sideTab").hidden = ui.side;
  $("showReport").checked = ui.report;
  $("showSide").checked = ui.side;
  store.set(UI_KEY, ui);
  layoutView();
}
document.querySelectorAll("[data-collapse]").forEach(btn => btn.addEventListener("click", () => {
  if (btn.dataset.collapse === "report") setExpanded(false);
  ui[btn.dataset.collapse] = false;
  applyPanels();
}));
$("reportTab").addEventListener("click", () => { ui.report = true; applyPanels(); });
$("sideTab").addEventListener("click", () => { ui.side = true; applyPanels(); });
$("showReport").addEventListener("change", e => { ui.report = e.target.checked; if (!ui.report) setExpanded(false); applyPanels(); });
$("showSide").addEventListener("change", e => { ui.side = e.target.checked; applyPanels(); });

function setDrawer(open) {
  $("drawer").hidden = !open;
  $("menuButton").setAttribute("aria-expanded", String(open));
  $("menuButton").innerHTML = icon(open ? "close" : "menu");
  if (!open && editor.open) setEditing(false);
}
$("menuButton").addEventListener("click", () => setDrawer($("drawer").hidden));
$("drawerClose").addEventListener("click", () => setDrawer(false));

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("cabinet").hidden) { closeCabinet(); return; }
  if (event.key === "Escape" && !$("printer").hidden) { closePrinter(); return; }
  if (event.key === "Escape" && reportView.expanded) { setExpanded(false); return; }
  const tag = document.activeElement?.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
  if (!$("pledge").hidden) return;
  if (editor.open) {
    if (event.key === "r" || event.key === "R") { rotateSelection(); event.preventDefault(); return; }
    if (event.key === "Delete" || event.key === "Backspace") { deleteSelection(); event.preventDefault(); return; }
    if (event.key === "Escape" && (editor.placing || editor.selectedId)) { editor.placing = null; editor.selectedId = null; renderEditor(); return; }
  }
  if (event.key === "Escape" && !$("drawer").hidden) setDrawer(false);
});

let toastTimer = null;
function toast(text, ms = 3500, iconName = null) {
  const el = $("toast");
  setLabel(el, iconName, text);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}


function renderTeam() {
  $("teamList").replaceChildren(...ORDER.map(id => {
    const a = staff[id];
    const li = document.createElement("li");
    li.className = `team-row status-${a.serverStatus}`;
    li.innerHTML = `<span class="team-dot"></span><div class="team-info"><strong></strong><small></small></div><span class="pill"></span>`;
    li.querySelector(".team-dot").style.background = roleColor(id);
    li.querySelector("strong").textContent = titles()[id];
    li.querySelector("small").textContent = a.serverStatus !== "idle" && a.serverMessage ? a.serverMessage : duties()[id];
    li.querySelector(".pill").textContent = t(`team.status.${a.serverStatus}`);
    return li;
  }));
}

function log(text, tone = "") {
  const list = $("activityLog");
  list.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  if (tone) li.className = tone;
  const time = document.createElement("time");
  time.textContent = fmtTime();
  li.append(time, document.createTextNode(text));
  list.prepend(li);
  while (list.children.length > 80) list.lastChild.remove();
}

// ===========================================================================
// Báo cáo: xem, phóng to, lưu vào tủ hồ sơ, xoá (Giám đốc vo giấy ném vào thùng rác)
// ===========================================================================
const REPORT_KEY = "ai-office-last-report";
const ARCHIVE_KEY = "ai-office-archive";
const ARCHIVE_MAX = 50;
const reportId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const report = { id: null, text: "", meta: null }; // báo cáo đang hiển thị (chỉ báo cáo hợp lệ mới có id)

let archive = store.get(ARCHIVE_KEY, []);
if (!Array.isArray(archive)) archive = [];
archive = archive.filter(e => e && typeof e.text === "string" && e.id);
runtime.archiveCount = archive.length;
const archived = id => archive.find(e => e.id === id) || null;

function showReport(text, meta = null, { error = false, id = null, persist = false } = {}) {
  const body = $("reportBody");
  body.classList.toggle("error", error);
  if (!text) {
    body.innerHTML = `<p class="placeholder" data-i18n="report.placeholder">${t("report.placeholder")}</p>`;
  } else if (error) {
    body.textContent = text;
  } else {
    body.innerHTML = renderMarkdown(text);
  }
  body.scrollTop = 0;
  body.dataset.raw = error ? "" : text || "";
  Object.assign(report, text && !error ? { id: id || reportId(), text, meta } : { id: null, text: "", meta: null });
  if (persist && report.id) store.set(REPORT_KEY, { id: report.id, text, meta });
  $("copyResult").disabled = !body.dataset.raw;
  $("reportMeta").hidden = !meta;
  if (meta) $("reportMeta").textContent = meta;
  if (!ui.report && text) { ui.report = true; applyPanels(); }
  renderReportActions();
}
$("copyResult").addEventListener("click", async () => {
  const btn = $("copyResult");
  try { await navigator.clipboard.writeText($("reportBody").dataset.raw || ""); setLabel(btn, "check", t("report.copied")); }
  catch { setLabel(btn, "alert", t("report.copyFail")); }
  setTimeout(() => { setLabel(btn, "copy", t("report.copy")); }, 1800);
});

// Tiêu đề: dòng tiêu đề Markdown đầu tiên, nếu không có thì dòng chữ đầu tiên.
function reportTitle(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const heading = lines.find(l => /^#{1,6}\s/.test(l));
  const raw = (heading || lines[0] || "").replace(/^#{1,6}\s+/, "").replace(/[*_`>#|]/g, "").trim();
  return raw.length > 90 ? `${raw.slice(0, 88)}…` : raw || t("report.untitled");
}

// Nút xoá cần bấm 2 lần (trong 3 giây) để tránh xoá nhầm.
function armOnce(btn, label, run) {
  if (btn.dataset.armed === "1") { btn.dataset.armed = ""; btn.classList.remove("armed"); run(); return; }
  btn.dataset.armed = "1";
  btn.classList.add("armed");
  const normal = btn.innerHTML;
  setLabel(btn, "alert", label);
  setTimeout(() => {
    if (btn.dataset.armed !== "1") return;
    btn.dataset.armed = "";
    btn.classList.remove("armed");
    btn.innerHTML = normal;
    delete btn.dataset.label;
  }, 3000);
}

function renderReportActions() {
  $("reportFoot").hidden = !report.id;
  const save = $("saveReport"), del = $("deleteReport");
  const saved = !!(report.id && archived(report.id));
  save.disabled = saved;
  save.classList.toggle("is-saved", saved);
  setLabel(save, saved ? "check" : "save", saved ? t("report.saved") : t("report.save"));
  if (del.dataset.armed !== "1") setLabel(del, "trash", t("report.delete"));
  const exp = $("reportExpand");
  const key = reportView.expanded ? "report.shrink" : "report.expand";
  exp.innerHTML = icon(reportView.expanded ? "shrink" : "expand");
  exp.title = t(key);
  exp.setAttribute("aria-label", t(key));
  exp.setAttribute("aria-pressed", String(reportView.expanded));
}

function setExpanded(on) {
  if (reportView.expanded === on) return;
  reportView.expanded = on;
  if (on && !ui.report) { ui.report = true; applyPanels(); }
  $("reportPanel").classList.toggle("expanded", on);
  $("reportBackdrop").hidden = !on;
  renderReportActions();
  layoutView();
}
$("reportExpand").addEventListener("click", () => setExpanded(!reportView.expanded));
$("reportBackdrop").addEventListener("click", () => setExpanded(false));

// Các cảnh của Giám đốc không chen ngang màn chào khách.
const managerFree = () => !onboarding.greeting;

function saveReport() {
  if (!report.id || archived(report.id)) return;
  if (archive.length >= ARCHIVE_MAX) { toast(t("cabinet.full", { n: archive.length }), 4500, "alert"); return; }
  const entry = { id: report.id, title: reportTitle(report.text), text: report.text, meta: report.meta, savedAt: Date.now() };
  archive.unshift(entry);
  if (!store.set(ARCHIVE_KEY, archive)) { archive.shift(); toast(t("cabinet.storageFail"), 5000, "alert"); return; }
  renderReportActions();
  renderCabinet();
  toast(t("report.toastSaved"), 3500, "cabinet");
  log(t("log.filed", { title: entry.title }), "job");
  const filed = () => { runtime.archiveCount = archive.length; };
  if (managerFree()) fileReportScene(filed); else filed();
}

function deleteReport(id) {
  if (!id) return;
  if (archived(id)) {
    archive = archive.filter(e => e.id !== id);
    store.set(ARCHIVE_KEY, archive);
    runtime.archiveCount = archive.length;
  }
  if (report.id === id) {
    showReport("");
    try { localStorage.removeItem(REPORT_KEY); } catch { /* bỏ qua */ }
  }
  renderCabinet();
  toast(t("report.toastDeleted"), 3500, "trash");
  if (managerFree()) trashReportScene();
}
$("saveReport").addEventListener("click", saveReport);
$("deleteReport").addEventListener("click", () => {
  const btn = $("deleteReport");
  armOnce(btn, t("report.confirmDelete"), () => {
    setLabel(btn, "trash", t("report.delete"));
    deleteReport(report.id);
  });
});

// ---- Tủ hồ sơ ----
function renderCabinet() {
  $("cabinetCount").textContent = t("cabinet.count", { n: archive.length, max: ARCHIVE_MAX });
  const list = $("cabinetList");
  if (!archive.length) {
    list.replaceChildren(Object.assign(document.createElement("li"), { className: "cabinet-empty", textContent: t("cabinet.empty") }));
    return;
  }
  list.replaceChildren(...archive.map(entry => {
    const li = document.createElement("li");
    li.className = `cabinet-item${entry.id === report.id ? " current" : ""}`;
    li.dataset.id = entry.id;
    li.innerHTML = `<span class="folder">${icon("folder")}</span><div class="info"><strong></strong><small></small></div>
      <div class="actions"><button class="secondary small" type="button" data-act="view"></button><button class="danger small" type="button" data-act="delete"></button></div>`;
    li.querySelector("strong").textContent = entry.title;
    if (entry.id === report.id) li.querySelector("strong").append(Object.assign(document.createElement("span"), { className: "tag", textContent: `· ${t("cabinet.current")}` }));
    li.querySelector("small").textContent = `${fmtDateTime(new Date(entry.savedAt))}${entry.meta ? ` · ${entry.meta}` : ""}`;
    li.querySelector("small").title = entry.meta || "";
    const viewBtn = li.querySelector('[data-act="view"]');
    setLabel(viewBtn, "eye", t("cabinet.view"));
    viewBtn.addEventListener("click", () => {
      showReport(entry.text, entry.meta || t("report.fromArchive", { time: fmtDateTime(new Date(entry.savedAt)) }), { id: entry.id });
      closeCabinet();
      setExpanded(true);
    });
    const del = li.querySelector('[data-act="delete"]');
    setLabel(del, "trash", t("cabinet.delete"));
    del.addEventListener("click", () => armOnce(del, t("cabinet.confirm"), () => {
      li.classList.add("leaving");
      setTimeout(() => deleteReport(entry.id), 320);
    }));
    return li;
  }));
}
function openCabinet() {
  if (!$("pledge").hidden || editor.open) return;
  renderCabinet();
  $("cabinet").hidden = false;
  $("cabinetClose").focus();
}
function closeCabinet() { $("cabinet").hidden = true; }
$("openCabinet").addEventListener("click", openCabinet);
$("cabinetClose").addEventListener("click", closeCabinet);
$("cabinet").addEventListener("click", event => { if (event.target === $("cabinet")) closeCabinet(); });

const CLICKABLE = new Set(["cabinet", "printer"]);

// ---- Máy in: chọn hồ sơ đã lưu, Giám đốc ra máy in, rồi mở hộp thoại in của trình duyệt ----
const printSel = new Set();
let printing = false;

function renderPrinter() {
  for (const id of [...printSel]) if (!archived(id)) printSel.delete(id);
  $("printerCount").textContent = t("printer.count", { n: archive.length, k: printSel.size });
  const go = $("printerGo"), all = $("printerAll");
  go.disabled = !printSel.size || printing;
  setLabel(go, "f-printer", printSel.size ? t("printer.go", { k: printSel.size }) : t("printer.pick"));
  all.hidden = !archive.length;
  const full = archive.length && printSel.size === archive.length;
  setLabel(all, full ? "close" : "check", full ? t("printer.none") : t("printer.all"));
  const list = $("printerList");
  if (!archive.length) {
    list.replaceChildren(Object.assign(document.createElement("li"), { className: "cabinet-empty", textContent: t("printer.empty") }));
    return;
  }
  list.replaceChildren(...archive.map(entry => {
    const li = document.createElement("li");
    const on = printSel.has(entry.id);
    li.className = `cabinet-item print-item${on ? " selected" : ""}`;
    li.innerHTML = `<input type="checkbox"><span class="folder">${icon("report")}</span><div class="info"><strong></strong><small></small></div>`;
    const box = li.querySelector("input");
    box.checked = on;
    box.setAttribute("aria-label", entry.title);
    li.querySelector("strong").textContent = entry.title;
    li.querySelector("small").textContent = `${fmtDateTime(new Date(entry.savedAt))}${entry.meta ? ` · ${entry.meta}` : ""}`;
    li.querySelector("small").title = entry.meta || "";
    const toggle = () => { if (printSel.has(entry.id)) printSel.delete(entry.id); else printSel.add(entry.id); renderPrinter(); };
    box.addEventListener("click", event => { event.stopPropagation(); toggle(); });
    li.addEventListener("click", toggle);
    return li;
  }));
}
function openPrinter() {
  if (!$("pledge").hidden || editor.open) return;
  closeCabinet();
  renderPrinter();
  $("printer").hidden = false;
  $("printerClose").focus();
}
function closePrinter() { $("printer").hidden = true; }
$("printerClose").addEventListener("click", closePrinter);
$("printer").addEventListener("click", event => { if (event.target === $("printer")) closePrinter(); });
$("printerAll").addEventListener("click", () => {
  if (printSel.size === archive.length) printSel.clear(); else archive.forEach(e => printSel.add(e.id));
  renderPrinter();
});
$("printerGo").addEventListener("click", () => {
  const entries = archive.filter(e => printSel.has(e.id));
  if (!entries.length) return;
  if (printing) { toast(t("printer.busy"), 2500, "alert"); return; }
  printing = true;
  closePrinter();
  toast(t("printer.toast", { k: entries.length }), 3000, "f-printer");
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    printing = false;
    entries.forEach(e => log(t("log.printed", { title: e.title }), "job"));
    setTimeout(() => printDocument(entries), 0); // ra khỏi vòng cập nhật trước khi mở hộp thoại in (chặn luồng)
  };
  if (!managerFree() || !printReportScene(entries.length, go)) go();
  setTimeout(go, 15000); // phòng khi Giám đốc bị kẹt đường
});

const escHtml = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const PRINT_CSS = `
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1d2a22; font: 10.5pt/1.55 "Be Vietnam Pro", "Segoe UI", "Yu Gothic UI", "Meiryo", Arial, sans-serif; }
  .doc { break-after: page; }
  .doc:last-child { break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #2f7d4f; padding-bottom: 6px; }
  .brand { font-weight: 800; letter-spacing: .14em; color: #2f7d4f; font-size: 13pt; }
  .brand small { display: block; letter-spacing: .02em; font-weight: 500; color: #5b6b61; font-size: 8.5pt; }
  .kind { font-size: 9pt; color: #5b6b61; text-transform: uppercase; letter-spacing: .08em; }
  h1.title { font-size: 17pt; margin: 14px 0 8px; line-height: 1.3; }
  table.info { border-collapse: collapse; margin: 0 0 14px; font-size: 9pt; color: #3c4a41; }
  table.info td { padding: 2px 14px 2px 0; border: 0; }
  table.info td:first-child { color: #6b7a70; }
  .body h1 { font-size: 14pt; } .body h2 { font-size: 12.5pt; } .body h3 { font-size: 11pt; }
  .body h1, .body h2, .body h3 { color: #24603d; margin: 14px 0 6px; break-after: avoid; }
  .body p, .body li { orphans: 3; widows: 3; }
  .body table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 9pt; break-inside: avoid; }
  .body th, .body td { border: 1px solid #b9c7bd; padding: 4px 6px; text-align: left; vertical-align: top; }
  .body th { background: #e8f1ea; }
  .body code { font-family: Consolas, monospace; font-size: 9pt; background: #f0f3f1; padding: 0 3px; }
  .body blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid #9cc4a9; color: #3c4a41; }
  footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #c9d4cc; font-size: 8pt; color: #6b7a70; }
`;

function printDocument(entries) {
  const now = fmtDateTime();
  const who = client ? clientName(client.name) : "";
  const pages = entries.map(e => {
    const rows = [
      who && [t("print.client"), who],
      [t("print.saved"), fmtDateTime(new Date(e.savedAt))],
      [t("print.printed"), now],
      e.meta && [t("print.info"), e.meta],
    ].filter(Boolean).map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`).join("");
    return `<article class="doc">
      <header><div class="brand">MINI CAPITAL<small>${escHtml(t("brand.tagline"))}</small></div><div class="kind">${escHtml(t("print.kind"))}</div></header>
      <h1 class="title">${escHtml(e.title)}</h1>
      <table class="info">${rows}</table>
      <div class="body">${renderMarkdown(e.text)}</div>
      <footer>${escHtml(t("print.footer"))}</footer>
    </article>`;
  }).join("");
  const title = entries.length === 1 ? `Mini Capital - ${entries[0].title}` : `Mini Capital - ${t("print.kind")} (${entries.length})`;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
  frame.srcdoc = `<!doctype html><html lang="${getLang()}"><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${pages}</body></html>`;
  frame.addEventListener("load", () => {
    const w = frame.contentWindow;
    const cleanup = () => setTimeout(() => frame.remove(), 500);
    w.addEventListener("afterprint", cleanup, { once: true });
    w.focus();
    w.print();
    setTimeout(() => frame.isConnected && frame.remove(), 60000);
  }, { once: true });
  document.body.append(frame);
}

function renderClient() {
  $("clientBadge").hidden = !client;
  if (client) setLabel($("clientBadge"), "user", t("client.badge", { name: client.name }));
  $("clientInfo").textContent = client
    ? t("client.info", { name: client.name, date: fmtDate(new Date(client.signedAt)), no: client.docNo })
    : t("client.unsigned");
  $("viewPledge").disabled = !client;
  refreshControls();
}

// ===========================================================================
// Kết nối backend
// ===========================================================================
// Chọn máy chủ AI:
//  - ?api=https://... trên URL  -> dùng máy chủ đó (khi sau này backend được triển khai lên mạng)
//  - trang do chính backend phục vụ (cổng 8000) -> cùng nguồn
//  - GitHub Pages / mở file trực tiếp -> KHÔNG có backend: chạy chế độ xem thử (mô phỏng)
//  - trường hợp khác (vd. Live Server) -> backend ở localhost:8000
const API_PARAM = new URLSearchParams(location.search).get("api");
const STATIC_HOST = location.protocol === "file:" || /\.github\.io$/i.test(location.hostname);
const SAME_ORIGIN = location.protocol.startsWith("http") && (location.port === "8000" || !location.port) && !STATIC_HOST;
const API_BASE = API_PARAM ? API_PARAM.replace(/\/+$/, "")
  : SAME_ORIGIN ? ""
    : STATIC_HOST ? null
      : "http://localhost:8000";
const OFFLINE = API_BASE === null;
const WS_URL = OFFLINE ? null
  : API_BASE ? API_BASE.replace(/^http/, "ws") + "/ws"
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

const net = { models: null, socket: null, connected: false, busy: false, retry: 1000, modelsLoaded: false, submitting: false, jobStartedAt: 0, lastPrompt: "" };

function idleStatus() {
  if (OFFLINE) setStatus(t("status.offline"), "busy");
  else if (net.connected) setStatus(client ? t("status.ready", { client: clientName(client.name) }) : t("status.connected"), "ok");
}

function setStatus(text, tone = "") {
  $("statusMessage").textContent = text;
  $("statusTag").dataset.tone = tone;
}

function refreshControls() {
  const btn = $("missionButton");
  const busy = net.busy || isDemoRunning();
  btn.disabled = !client || busy || net.submitting || (!OFFLINE && (!net.connected || !net.modelsLoaded));
  setLabel(btn, busy || net.submitting ? "spinner" : "send", busy ? t("task.busy") : net.submitting ? t("task.sending") : OFFLINE ? t("task.sendDemo") : t("task.send"));
  btn.title = !client ? t("task.needPledge") : "";
  $("connDot").dataset.on = String(net.connected);
  $("connText").textContent = OFFLINE ? t("conn.preview") : net.connected ? t("conn.on") : t("conn.off");
  $("runDemo").disabled = busy;
}

function setBusy(busy) {
  net.busy = busy;
  refreshControls();
}

function modelLabel(selectId) {
  const s = $(selectId);
  return s.selectedOptions[0]?.text || s.value;
}

function handleMessage(msg) {
  switch (msg.type) {
    case "snapshot":
      setBusy(msg.busy);
      for (const [id, st] of Object.entries(msg.agents || {})) applyStatus(id, st.status, st.message, { animate: false });
      if (msg.result && !$("reportBody").dataset.raw) showReport(msg.result, t("report.fromServer"));
      if (msg.busy) setStatus(t("status.busy"), "busy"); else idleStatus();
      renderTeam();
      break;
    case "status":
      applyStatus(msg.agent, msg.status, msg.message);
      renderTeam();
      if (msg.status !== "idle") log(`${titles()[msg.agent] || msg.agent}: ${msg.message}`, msg.status === "error" ? "error" : "");
      break;
    case "activity":
      applyActivity(msg.agent, msg.kind, msg.message);
      if (msg.kind === "tool" || msg.kind === "tool_error") {
        log(`${titles()[msg.agent] || msg.agent}: ${msg.kind === "tool" ? "🔎" : "⚠️"} ${msg.message}`, msg.kind === "tool" ? "tool" : "error");
      }
      break;
    case "handoff":
      applyHandoff(msg.from, msg.to);
      log(t("log.handoff", { from: titles()[msg.from], to: titles()[msg.to], msg: msg.message ? ` “${msg.message}”` : "" }), "handoff");
      break;
    case "job":
      if (msg.state === "started") {
        setBusy(true);
        net.jobStartedAt = Date.now();
        setStatus(t("status.accepted", { prompt: msg.prompt }), "busy");
        log(t("log.newJob", { prompt: msg.prompt }), "job");
      } else if (msg.state === "finished") {
        setBusy(false);
        const secs = Math.round((Date.now() - net.jobStartedAt) / 1000);
        const meta = t("report.meta", {
          client: client ? clientName(client.name) : "—",
          time: fmtDateTime(),
          models: msg.demo ? t("report.demoTag") : `${modelLabel("leaderSelect")} + ${modelLabel("workerSelect")}`,
          secs,
        });
        showReport(msg.result || "", meta, { persist: true });
        setStatus(t("status.done"), "ok");
        log(t("log.approved"), "job");
        runScript("manager", [
          { say: client ? t("greet.reportReady", { client: clientName(client.name) }) : t("greet.reportReadyAnon"), face: "S", gesture: "wave", seconds: 3.5 },
          { home: true },
        ]);
      } else if (msg.state === "failed") {
        setBusy(false);
        showReport(t("report.failed", { error: msg.error }), null, { error: true });
        setStatus(t("status.error", { error: msg.error }), "error");
        log(t("log.failed", { error: msg.error }), "error");
      }
      break;
  }
}

function connect() {
  const socket = new WebSocket(WS_URL);
  net.socket = socket;
  socket.onopen = () => {
    net.connected = true;
    net.retry = 1000;
    refreshControls();
    if (!net.modelsLoaded) loadModels();
  };
  socket.onmessage = event => {
    try { handleMessage(JSON.parse(event.data)); } catch (error) { console.error("Invalid message", error); }
  };
  socket.onclose = () => {
    net.connected = false;
    refreshControls();
    setStatus(t("status.disconnected", { s: Math.round(net.retry / 1000) }), "error");
    setTimeout(connect, net.retry);
    net.retry = Math.min(net.retry * 2, 10000);
  };
}

const MODEL_KEY = "ai-office-models";
async function loadModels() {
  try {
    const res = await fetch(`${API_BASE}/api/models`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let saved = store.get(MODEL_KEY, {});
    const defaultsKey = `${data.defaults.leader}|${data.defaults.team}`;
    if (saved.defaults !== defaultsKey) { saved = { defaults: defaultsKey }; store.set(MODEL_KEY, saved); }
    net.models = data.models;
    renderModels();
    for (const [selectId, role] of [["leaderSelect", "leader"], ["workerSelect", "team"]]) {
      const select = $(selectId);
      const want = [saved[role], data.defaults[role]].find(id => data.models.some(m => m.id === id && m.available));
      if (want) select.value = want;
      else { const first = data.models.find(m => m.available); if (first) select.value = first.id; }
    }
    net.modelsLoaded = data.models.some(m => m.available);
    if (!net.modelsLoaded) setStatus(t("status.noKeys"), "error");
  } catch (error) {
    net.modelsLoaded = false;
    setStatus(t("status.modelsFail", { error: error.message }), "error");
  }
  refreshControls();
}
// Vẽ lại danh sách model (giữ lựa chọn hiện tại) – gọi cả khi đổi ngôn ngữ.
function renderModels() {
  if (!net.models) return;
  for (const selectId of ["leaderSelect", "workerSelect"]) {
    const select = $(selectId);
    const current = select.value;
    select.replaceChildren(...net.models.map(m => {
      const opt = new Option(m.available ? m.label : `${m.label} ${t("models.noKey")}`, m.id);
      opt.disabled = !m.available;
      return opt;
    }));
    if (net.models.some(m => m.id === current && m.available)) select.value = current;
  }
}
for (const [selectId, role] of [["leaderSelect", "leader"], ["workerSelect", "team"]]) {
  $(selectId).addEventListener("change", () => store.set(MODEL_KEY, { ...store.get(MODEL_KEY, {}), [role]: $(selectId).value }));
}

async function startMission() {
  const prompt = $("taskInput").value.trim();
  if (!client) { setStatus(t("status.needPledge"), "error"); return; }
  if (!prompt) { setStatus(t("status.emptyPrompt"), "error"); $("taskInput").focus(); return; }
  if (net.busy || net.submitting || isDemoRunning()) return;
  if (OFFLINE) {
    toast(t("toast.demoOffline"), 3500, "play");
    runDemo(handleMessage, client.name, prompt).finally(refreshControls);
    refreshControls();
    return;
  }
  net.submitting = true;
  refreshControls();
  try {
    const res = await fetch(`${API_BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, language: getLang(), client_name: client.name, manager_choice: $("leaderSelect").value, worker_choice: $("workerSelect").value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = typeof body.detail === "string" ? body.detail : `HTTP ${res.status}`;
      setStatus(t("status.rejected", { detail }), "error");
      log(t("status.rejected", { detail }), "error");
    } else {
      net.lastPrompt = prompt;
    }
  } catch (error) {
    setStatus(t("status.sendFail", { error: error.message }), "error");
  } finally {
    net.submitting = false;
    refreshControls();
  }
}

$("missionButton").addEventListener("click", startMission);
$("taskInput").addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); startMission(); }
});

$("runDemo").addEventListener("click", () => {
  if (net.busy) return;
  setDrawer(false);
  toast(t("toast.demo"), 3500, "play");
  runDemo(handleMessage, client?.name || t("client.guest")).finally(refreshControls);
  refreshControls();
});

// ===========================================================================
// Màn chào + Đơn cam kết
// ===========================================================================
const GREET_SPOT = { x: 330, y: 495 };

async function firstVisit({ withIntro = true } = {}) {
  flags.breaksPaused = true;
  if (withIntro) {
    document.body.classList.add("booting");
    await playIntro();
  }
  document.body.classList.remove("booting");
  layoutView();
  await delay(1200);

  // Giám đốc rời bàn, ra giữa phòng chào khách.
  let readyForPledge;
  const ready = new Promise(r => { readyForPledge = r; });
  let signedDone = false;
  onboarding.greeting = true;
  runScript("manager", [
    { goto: GREET_SPOT, say: t("greet.ohGuest") },
    { call: () => zoomTo("manager") },
    { say: t("greet.hello"), face: "S", gesture: "wave", seconds: 3.6 },
    { say: t("greet.intro"), face: "S" },
    { say: t("greet.pledge"), face: "S", seconds: 2.6 },
    { call: () => readyForPledge() },
    { waitUntil: () => signedDone, face: "S", say: t("greet.readTerms") },
  ]);
  await ready;
  const signed = await openPledge({ mode: "sign" });
  signedDone = true;
  client = signed;
  renderClient();
  log(t("log.signed", { client: clientName(client.name), no: client.docNo }), "job");
  toast(t("toast.signed", { client: clientName(client.name) }), 3500, "check");
  runScript("manager", [
    { say: t("greet.thanks", { client: clientName(client.name) }), face: "S", gesture: "wave" },
    { say: t("greet.giveTask"), face: "S", seconds: 3 },
    { call: () => { zoomOut(); updateZoomUi(); } },
    { home: true },
  ]);
  await delay(4000);
  onboarding.greeting = false;
  flags.breaksPaused = false;
  idleStatus();
  $("taskInput").focus();
}

async function returningVisit() {
  document.body.classList.remove("booting");
  layoutView();
  await delay(900);
  toast(t("toast.welcomeBack", { client: clientName(client.name) }), 3500, "smile");
  runScript("manager", [
    { say: t("greet.welcomeBack", { client: clientName(client.name) }), face: "S", gesture: "wave", seconds: 3.2 },
    { home: true },
  ]);
}

$("viewPledge").addEventListener("click", () => { if (client) { setDrawer(false); openPledge({ mode: "view", client }); } });
$("resignPledge").addEventListener("click", async () => {
  setDrawer(false);
  const signed = await openPledge({ mode: "resign" });
  if (!signed) return;
  client = signed;
  renderClient();
  log(t("log.signed", { client: clientName(client.name), no: client.docNo }), "job");
  toast(t("toast.resigned", { client: clientName(client.name) }), 3500, "check");
  runScript("manager", [{ say: t("greet.resigned", { client: clientName(client.name) }), face: "S", gesture: "wave", seconds: 3 }, { home: true }]);
});
$("replayIntro").addEventListener("click", async () => {
  setDrawer(false);
  if (client) {
    document.body.classList.add("booting");
    await playIntro();
    await returningVisit();
  } else {
    await firstVisit();
  }
});

// ===========================================================================
// Ngôn ngữ
// ===========================================================================
const langSelect = $("langSelect");
langSelect.replaceChildren(...LANGS.map(l => new Option(l.label, l.code)));
langSelect.value = getLang();
langSelect.addEventListener("change", () => setLang(langSelect.value));

window.addEventListener("langchange", () => {
  langSelect.value = getLang();
  renameStaff();
  renderAssignmentOptions();
  renderModels();
  if (OFFLINE) for (const id of ["leaderSelect", "workerSelect"]) $(id).options[0].text = t("models.offline");
  furnToggleLabel();
  renderEditor();
  renderTeam();
  renderClient();
  renderReportActions();
  if (!$("cabinet").hidden) renderCabinet();
  if (!$("printer").hidden) renderPrinter();
  if (!net.busy && !isDemoRunning()) idleStatus();
});

// ===========================================================================
// Khởi động
// ===========================================================================
applyI18n();
furnToggleLabel();
setStatus(t("status.connecting"));
$("connText").textContent = t("conn.connecting");
commitLayout({ persist: false });
seatEveryone();
applyPanels();
renderTeam();
renderClient();
log(t("log.open"), "");
const lastReport = store.get(REPORT_KEY, null);
if (lastReport?.text) showReport(lastReport.text, lastReport.meta, { id: lastReport.id || null, persist: !lastReport.id });
layoutView();
if (OFFLINE) {
  for (const id of ["leaderSelect", "workerSelect"]) {
    $(id).replaceChildren(new Option(t("models.offline"), ""));
    $(id).disabled = true;
  }
  idleStatus();
  refreshControls();
} else {
  connect();
}
requestAnimationFrame(frame);
if (client) returningVisit(); else firstVisit();

// office.simulate({...}) cho phép thử luồng sự kiện mà không cần gọi LLM thật.
// screenOf(x, y, z): toạ độ màn hình của một điểm trong phòng (cho kiểm thử tự động).
window.office = {
  staff, get layout() { return layout; }, ISO, simulate: handleMessage, cancelDemo,
  screenOf(x, y, z = 0) {
    const p = project(x, y, z), s = view.scale * camera.zoom;
    return { x: view.cx + (p.x - camera.focus.x) * s, y: view.cy + (p.y - camera.focus.y) * s };
  },
};
