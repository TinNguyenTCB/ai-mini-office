// Điểm vào: vẽ văn phòng toàn màn hình, menu, trình sắp xếp nội thất, màn chào, kết nối backend.

import { ISO, bindContext, floorRect, isoSort, line, poly, project, unproject } from "./iso.js";
import {
  CATALOG, DEFAULT_LAYOUT, drawItem, fitsInRoom, footprint, overlapsAny, pickItem, rot, sceneDrawables, seatPoint,
} from "./furniture.js";
import { rebuild, reachable } from "./pathfinding.js";
import {
  ORDER, TICK_HZ, agentDrawables, applyActivity, applyHandoff, applyStatus, bubbleOf, flags, getTick,
  lookAt, runScript, seatEveryone, setLayout, staff, update,
} from "./sim.js";
import { drawAgent, drawOverlay, roleColor } from "./characters.js";
import { DUTIES, TITLES } from "./dialogue.js";
import { renderMarkdown } from "./markdown.js";
import { delay, loadClient, openPledge, playIntro } from "./onboarding.js";
import { cancelDemo, isDemoRunning, runDemo } from "./demo.js";

const $ = id => document.getElementById(id);
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
    if (items.length) return items;
  }
  return defaultLayout();
}
const defaultLayout = () => DEFAULT_LAYOUT.map(it => ({ id: newId(), assignedTo: "", rotation: 0, ...it }));

let layout = loadLayout();

function commitLayout({ persist = true } = {}) {
  rebuild(layout);
  setLayout(layout);
  if (persist && !store.set(LAYOUT_KEY, layout.map(({ _cache, ...rest }) => rest))) {
    setHint("Không lưu được bố trí trên trình duyệt này (localStorage bị chặn).");
  }
  renderEditor();
}

// ===========================================================================
// Khung nhìn: văn phòng (toạ độ logic 620×620) được co giãn vào vùng trống giữa các khung giao diện.
// ===========================================================================
const ROOM_BOX = { x0: 48, y0: -10, x1: 572, y1: 592 }; // vùng logic cần hiển thị (gồm cả bảng tên trên đầu)
const view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };

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
    if (visible($("reportPanel"))) left = $("reportPanel").getBoundingClientRect().right + 8;
    if (visible($("sidePanel"))) right = $("sidePanel").getBoundingClientRect().left - 8;
  }
  const bw = ROOM_BOX.x1 - ROOM_BOX.x0, bh = ROOM_BOX.y1 - ROOM_BOX.y0;
  const availW = Math.max(240, right - left), availH = Math.max(240, bottom - top);
  const scale = Math.min(availW / bw, availH / bh);
  Object.assign(view, {
    dpr, w: W, h: H, scale,
    ox: left + (availW - bw * scale) / 2 - ROOM_BOX.x0 * scale,
    oy: top + (availH - bh * scale) / 2 - ROOM_BOX.y0 * scale,
  });
}
window.addEventListener("resize", layoutView);
new ResizeObserver(layoutView).observe(document.body);

// Toạ độ chuột -> toạ độ logic của văn phòng.
function canvasPoint(event) {
  return { x: (event.clientX - view.ox) / view.scale, y: (event.clientY - view.oy) / view.scale };
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
  wallText("back", { x: 396, y: 29, z: 98 }, "THỊ TRƯỜNG · minh hoạ", "bold 6.5px \"Segoe UI\", sans-serif", "#9fd6a8");
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
  wallText("left", { x: 31, y: 346, z: 73 }, "Nghiên cứu & quản lý cổ phiếu", "600 5.6px \"Segoe UI\", sans-serif", "#9fd6a8");

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

canvas.addEventListener("pointerdown", event => {
  if (!editor.open) return;
  const s = canvasPoint(event);
  const world = unproject(s.x, s.y);
  if (editor.placing) {
    Object.assign(ghost, { type: editor.placing, rotation: editor.placingRotation, x: snap(world.x), y: snap(world.y) });
    if (!validAt(ghost, ghost)) { setHint("Không đặt được ở đây: chồng lên đồ khác hoặc ra ngoài phòng."); return; }
    const item = { id: newId(), type: ghost.type, x: ghost.x, y: ghost.y, rotation: ghost.rotation, assignedTo: "" };
    layout.push(item);
    editor.selectedId = item.id;
    if (!event.shiftKey) editor.placing = null;
    setHint(event.shiftKey ? "Giữ Shift để đặt tiếp món tương tự." : `Đã đặt ${CATALOG[item.type].label.toLowerCase()}. Kéo để di chuyển, R để xoay.`);
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
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", () => { editor.hover = null; });

function rotateSelection() {
  if (editor.placing) { editor.placingRotation = (editor.placingRotation + 1) % 4; renderEditor(); return; }
  const item = selectedItem();
  if (!item) return;
  const turned = { ...item, rotation: (rot(item) + 1) % 4 };
  if (!validAt(turned, turned)) { setHint("Không xoay được: sẽ chạm đồ khác hoặc tường."); return; }
  item.rotation = turned.rotation;
  commitLayout();
}

function deleteSelection() {
  const item = selectedItem();
  if (!item) return;
  layout = layout.filter(it => it !== item);
  editor.selectedId = null;
  setHint(`Đã xoá ${CATALOG[item.type].label.toLowerCase()}.`);
  commitLayout();
}

function setEditing(on) {
  editor.open = on;
  if (!on) { editor.placing = null; editor.selectedId = null; }
  $("furnitureEditor").hidden = !on;
  $("furnitureToggle").setAttribute("aria-expanded", String(on));
  $("furnitureToggle").textContent = on ? "✓ Xong sắp xếp" : "Bật chế độ sắp xếp";
  canvas.classList.toggle("is-editing", on);
  renderEditor();
}

$("furnitureRotate").addEventListener("click", rotateSelection);
$("furnitureDelete").addEventListener("click", deleteSelection);
$("furnitureToggle").addEventListener("click", () => setEditing(!editor.open));
$("furnitureReset").addEventListener("click", () => {
  const btn = $("furnitureReset");
  if (performance.now() > editor.resetArmedUntil) {
    editor.resetArmedUntil = performance.now() + 3000;
    btn.textContent = "Bấm lần nữa để xác nhận";
    setTimeout(() => { btn.textContent = "↺ Mặc định"; }, 3000);
    return;
  }
  editor.resetArmedUntil = 0;
  btn.textContent = "↺ Mặc định";
  layout = defaultLayout();
  editor.selectedId = null;
  editor.placing = null;
  setHint("Đã khôi phục bố trí mặc định.");
  commitLayout();
});
$("furnitureAssignment").addEventListener("change", event => {
  const item = selectedItem();
  if (!item || item.type !== "desk") return;
  const who = event.target.value;
  for (const other of layout) if (other.type === "desk" && other.assignedTo === who && who) other.assignedTo = "";
  item.assignedTo = who;
  setHint(who ? `${TITLES[who]} sẽ ngồi ở bàn này.` : "Bàn đã trống.");
  commitLayout();
});
for (const id of ORDER) $("furnitureAssignment").append(new Option(TITLES[id], id));

function layoutWarnings() {
  const warnings = [];
  for (const id of ORDER) {
    const desk = layout.find(it => it.type === "desk" && it.assignedTo === id);
    if (!desk) warnings.push(`${TITLES[id]} chưa có bàn – sẽ đứng chờ ở khu trống.`);
    else if (!reachable(staff[id], seatPoint(desk))) warnings.push(`Ghế của ${TITLES[id]} đang bị chặn lối đi.`);
  }
  const has = t => layout.some(it => it.type === t);
  if (!has("whiteboard")) warnings.push("Không có bảng trắng: Giám đốc sẽ lập kế hoạch tại bàn.");
  if (!has("bookshelf")) warnings.push("Không có kệ sách: Chuyên viên phân tích sẽ tra cứu tại bàn.");
  if (!has("printer")) warnings.push("Không có máy in: Quản trị rủi ro sẽ nộp báo cáo trực tiếp.");
  return warnings;
}

function renderEditor() {
  $("furnitureCatalog").replaceChildren(...Object.entries(CATALOG).map(([type, def]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `furniture-card${editor.placing === type ? " active" : ""}`;
    b.textContent = `${def.icon} ${def.label}`;
    b.addEventListener("click", () => {
      editor.placing = editor.placing === type ? null : type;
      editor.selectedId = null;
      setHint(editor.placing ? `Đang đặt ${def.label.toLowerCase()}: bấm lên sàn (R để xoay, Shift để đặt nhiều).` : "Đã huỷ đặt đồ.");
      renderEditor();
    });
    return b;
  }));
  $("furnitureCount").textContent = `(${layout.length} món)`;
  const item = selectedItem();
  $("furnitureRotate").disabled = !item && !editor.placing;
  $("furnitureDelete").disabled = !item;
  $("furnitureSelection").textContent = item
    ? `${CATALOG[item.type].icon} ${CATALOG[item.type].label} · hướng ${rot(item) * 90}°`
    : editor.placing ? `Sẵn sàng đặt: ${CATALOG[editor.placing].label} · hướng ${editor.placingRotation * 90}°` : "Chưa chọn món nào.";
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
  const k = view.dpr * view.scale;
  ctx.setTransform(k, 0, 0, k, view.dpr * view.ox, view.dpr * view.oy);

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
    const label = owner ? owner.name : "Bàn trống";
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
  accumulator += Math.min(250, now - lastFrame);
  lastFrame = now;
  while (accumulator >= STEP_MS) { update(); accumulator -= STEP_MS; }
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
document.querySelectorAll("[data-collapse]").forEach(btn => btn.addEventListener("click", () => { ui[btn.dataset.collapse] = false; applyPanels(); }));
$("reportTab").addEventListener("click", () => { ui.report = true; applyPanels(); });
$("sideTab").addEventListener("click", () => { ui.side = true; applyPanels(); });
$("showReport").addEventListener("change", e => { ui.report = e.target.checked; applyPanels(); });
$("showSide").addEventListener("change", e => { ui.side = e.target.checked; applyPanels(); });

function setDrawer(open) {
  $("drawer").hidden = !open;
  $("menuButton").setAttribute("aria-expanded", String(open));
  $("menuButton").textContent = open ? "✕" : "☰";
  if (!open && editor.open) setEditing(false);
}
$("menuButton").addEventListener("click", () => setDrawer($("drawer").hidden));
$("drawerClose").addEventListener("click", () => setDrawer(false));

document.addEventListener("keydown", event => {
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
function toast(text, ms = 3500) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

const STATUS_LABEL = { idle: "Rảnh", thinking: "Lập kế hoạch", working: "Đang làm", reviewing: "Viết báo cáo", done: "Xong", error: "Lỗi" };

function renderTeam() {
  $("teamList").replaceChildren(...ORDER.map(id => {
    const a = staff[id];
    const li = document.createElement("li");
    li.className = `team-row status-${a.serverStatus}`;
    li.innerHTML = `<span class="team-dot"></span><div class="team-info"><strong></strong><small></small></div><span class="pill"></span>`;
    li.querySelector(".team-dot").style.background = roleColor(id);
    li.querySelector("strong").textContent = TITLES[id];
    li.querySelector("small").textContent = a.serverStatus !== "idle" && a.serverMessage ? a.serverMessage : DUTIES[id];
    li.querySelector(".pill").textContent = STATUS_LABEL[a.serverStatus] || a.serverStatus;
    return li;
  }));
}

function log(text, tone = "") {
  const list = $("activityLog");
  list.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  if (tone) li.className = tone;
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString("vi-VN", { hour12: false });
  li.append(time, document.createTextNode(text));
  list.prepend(li);
  while (list.children.length > 80) list.lastChild.remove();
}

const REPORT_KEY = "ai-office-last-report";
function showReport(text, meta = null, { error = false } = {}) {
  const body = $("reportBody");
  body.classList.toggle("error", error);
  if (!text) {
    body.innerHTML = '<p class="placeholder">Báo cáo sẽ xuất hiện ở đây sau khi Giám đốc đầu tư thẩm định và ký duyệt.</p>';
  } else if (error) {
    body.textContent = text;
  } else {
    body.innerHTML = renderMarkdown(text);
  }
  body.dataset.raw = error ? "" : text || "";
  $("copyResult").disabled = !body.dataset.raw;
  $("reportMeta").hidden = !meta;
  if (meta) $("reportMeta").textContent = meta;
  if (!ui.report && text) { ui.report = true; applyPanels(); }
}
$("copyResult").addEventListener("click", async () => {
  const btn = $("copyResult");
  try { await navigator.clipboard.writeText($("reportBody").dataset.raw || ""); btn.textContent = "Đã chép ✓"; }
  catch { btn.textContent = "Không chép được"; }
  setTimeout(() => { btn.textContent = "Sao chép"; }, 1800);
});

function renderClient() {
  $("clientBadge").hidden = !client;
  if (client) $("clientBadge").textContent = `👤 Quý khách ${client.name}`;
  $("clientInfo").textContent = client
    ? `Quý khách ${client.name} · ký ngày ${new Date(client.signedAt).toLocaleDateString("vi-VN")} · ${client.docNo}`
    : "Chưa ký đơn cam kết.";
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

const net = { socket: null, connected: false, busy: false, retry: 1000, modelsLoaded: false, submitting: false, jobStartedAt: 0, lastPrompt: "" };

function idleStatus() {
  if (OFFLINE) setStatus("Bản xem thử trên GitHub Pages – chưa có máy chủ AI. “Giao việc” sẽ chạy mô phỏng với dữ liệu hư cấu.", "busy");
  else if (net.connected) setStatus(client ? `Sẵn sàng phục vụ Quý khách ${client.name}.` : "Đã kết nối.", "ok");
}

function setStatus(text, tone = "") {
  $("statusMessage").textContent = text;
  $("statusTag").dataset.tone = tone;
}

function refreshControls() {
  const btn = $("missionButton");
  const busy = net.busy || isDemoRunning();
  btn.disabled = !client || busy || net.submitting || (!OFFLINE && (!net.connected || !net.modelsLoaded));
  btn.textContent = busy ? "⏳ Đang làm…" : net.submitting ? "Đang gửi…" : OFFLINE ? "Giao việc (mô phỏng)" : "Giao việc";
  btn.title = !client ? "Vui lòng ký Đơn cam kết trước" : "";
  $("connDot").dataset.on = String(net.connected);
  $("connText").textContent = OFFLINE ? "Bản xem thử" : net.connected ? "Đã kết nối" : "Mất kết nối";
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
      if (msg.result && !$("reportBody").dataset.raw) showReport(msg.result, "Báo cáo gần nhất trên máy chủ");
      setStatus(msg.busy ? "Văn phòng đang xử lý một nhiệm vụ." : client ? `Sẵn sàng phục vụ Quý khách ${client.name}.` : "Đã kết nối.", msg.busy ? "busy" : "ok");
      renderTeam();
      break;
    case "status":
      applyStatus(msg.agent, msg.status, msg.message);
      renderTeam();
      if (msg.status !== "idle") log(`${TITLES[msg.agent] || msg.agent}: ${msg.message}`, msg.status === "error" ? "error" : "");
      break;
    case "activity":
      applyActivity(msg.agent, msg.kind, msg.message);
      break;
    case "handoff":
      applyHandoff(msg.from, msg.to);
      log(`${TITLES[msg.from]} → ${TITLES[msg.to]}: bàn giao${msg.message ? ` “${msg.message}”` : ""}`, "handoff");
      break;
    case "job":
      if (msg.state === "started") {
        setBusy(true);
        net.jobStartedAt = Date.now();
        setStatus(`Đã nhận nhiệm vụ: ${msg.prompt}`, "busy");
        log(`Nhiệm vụ mới: ${msg.prompt}`, "job");
      } else if (msg.state === "finished") {
        setBusy(false);
        const secs = Math.round((Date.now() - net.jobStartedAt) / 1000);
        const meta = `Gửi: Quý khách ${client?.name || "—"} · ${new Date().toLocaleString("vi-VN")} · ${msg.demo ? "MÔ PHỎNG" : `${modelLabel("leaderSelect")} + ${modelLabel("workerSelect")}`} · ${secs}s`;
        showReport(msg.result || "", meta);
        store.set(REPORT_KEY, { text: msg.result || "", meta });
        setStatus("Hoàn thành! Báo cáo đầu tư ở khung bên trái.", "ok");
        log("Giám đốc đầu tư đã ký duyệt báo cáo.", "job");
        runScript("manager", [
          { say: client ? `Báo cáo đã sẵn sàng, mời Quý khách ${client.name} xem.` : "Báo cáo đã sẵn sàng!", face: "S", gesture: "wave", seconds: 3.5 },
          { home: true },
        ]);
      } else if (msg.state === "failed") {
        setBusy(false);
        showReport(`Nhiệm vụ thất bại:\n${msg.error}`, null, { error: true });
        setStatus(`Lỗi: ${msg.error}`, "error");
        log(`Nhiệm vụ thất bại: ${msg.error}`, "error");
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
    try { handleMessage(JSON.parse(event.data)); } catch (error) { console.error("Tin nhắn không hợp lệ", error); }
  };
  socket.onclose = () => {
    net.connected = false;
    refreshControls();
    setStatus(`Mất kết nối backend – thử lại sau ${Math.round(net.retry / 1000)} giây… (vẫn có thể chạy mô phỏng trong menu ☰)`, "error");
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
    for (const [selectId, role] of [["leaderSelect", "leader"], ["workerSelect", "team"]]) {
      const select = $(selectId);
      select.replaceChildren(...data.models.map(m => {
        const opt = new Option(m.available ? m.label : `${m.label} (thiếu API key)`, m.id);
        opt.disabled = !m.available;
        return opt;
      }));
      const want = [saved[role], data.defaults[role]].find(id => data.models.some(m => m.id === id && m.available));
      if (want) select.value = want;
      else { const first = data.models.find(m => m.available); if (first) select.value = first.id; }
    }
    net.modelsLoaded = data.models.some(m => m.available);
    if (!net.modelsLoaded) setStatus("Chưa có API key nào trong .env – thêm key rồi khởi động lại backend.", "error");
  } catch (error) {
    net.modelsLoaded = false;
    setStatus(`Không tải được danh sách model: ${error.message}`, "error");
  }
  refreshControls();
}
for (const [selectId, role] of [["leaderSelect", "leader"], ["workerSelect", "team"]]) {
  $(selectId).addEventListener("change", () => store.set(MODEL_KEY, { ...store.get(MODEL_KEY, {}), [role]: $(selectId).value }));
}

async function startMission() {
  const prompt = $("taskInput").value.trim();
  if (!client) { setStatus("Quý khách cần ký Đơn cam kết trước khi giao việc.", "error"); return; }
  if (!prompt) { setStatus("Hãy nhập yêu cầu cho văn phòng trước đã.", "error"); $("taskInput").focus(); return; }
  if (net.busy || net.submitting || isDemoRunning()) return;
  if (OFFLINE) {
    toast("▶ Bản xem thử: chạy mô phỏng – không gọi AI, dữ liệu hư cấu");
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
      body: JSON.stringify({ prompt, client_name: client.name, manager_choice: $("leaderSelect").value, worker_choice: $("workerSelect").value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = typeof body.detail === "string" ? body.detail : `HTTP ${res.status}`;
      setStatus(`Không giao được việc: ${detail}`, "error");
      log(`Không giao được việc: ${detail}`, "error");
    } else {
      net.lastPrompt = prompt;
    }
  } catch (error) {
    setStatus(`Không gửi được tới backend: ${error.message}`, "error");
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
  toast("▶ Đang chạy mô phỏng – không gọi API, dữ liệu hư cấu");
  runDemo(handleMessage, client?.name || "Khách").finally(refreshControls);
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
    { goto: GREET_SPOT, say: "Ồ, có khách!" },
    { say: "Xin chào! Chào mừng Quý khách đến với Mini Capital.", face: "S", gesture: "wave" },
    { say: "Tôi là Giám đốc đầu tư. Đội ngũ AI của chúng tôi nghiên cứu cổ phiếu theo yêu cầu của Quý khách.", face: "S" },
    { say: "Trước khi bắt đầu, mời Quý khách đọc và ký Đơn cam kết.", face: "S", seconds: 2.6 },
    { call: () => readyForPledge() },
    { waitUntil: () => signedDone, face: "S", say: "Mời Quý khách xem kỹ các điều khoản…" },
  ]);
  await ready;
  const signed = await openPledge({ mode: "sign" });
  signedDone = true;
  client = signed;
  renderClient();
  log(`Quý khách ${client.name} đã ký Đơn cam kết (${client.docNo}).`, "job");
  toast(`✅ Đã ký cam kết – chào mừng Quý khách ${client.name}!`);
  runScript("manager", [
    { say: `Cảm ơn Quý khách ${client.name}! Rất hân hạnh được đồng hành cùng Quý khách.`, face: "S", gesture: "wave" },
    { say: "Mời Quý khách giao nhiệm vụ ở khung phía dưới.", face: "S", seconds: 3 },
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
  toast(`👋 Chào mừng Quý khách ${client.name} quay lại!`);
  runScript("manager", [
    { say: `Chào mừng Quý khách ${client.name} quay lại!`, face: "S", gesture: "wave", seconds: 3.2 },
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
  log(`Quý khách ${client.name} đã ký Đơn cam kết (${client.docNo}).`, "job");
  toast(`✅ Văn phòng sẽ làm việc với Quý khách ${client.name}`);
  runScript("manager", [{ say: `Rất vui được làm việc với Quý khách ${client.name}!`, face: "S", gesture: "wave", seconds: 3 }, { home: true }]);
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
// Khởi động
// ===========================================================================
commitLayout({ persist: false });
seatEveryone();
applyPanels();
renderTeam();
renderClient();
log("Văn phòng mở cửa.", "");
const lastReport = store.get(REPORT_KEY, null);
if (lastReport?.text) showReport(lastReport.text, lastReport.meta);
layoutView();
if (OFFLINE) {
  for (const id of ["leaderSelect", "workerSelect"]) {
    $(id).replaceChildren(new Option("Không có máy chủ AI – chế độ mô phỏng", ""));
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
window.office = { staff, get layout() { return layout; }, ISO, simulate: handleMessage, cancelDemo };
