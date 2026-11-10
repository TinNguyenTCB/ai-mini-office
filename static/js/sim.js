// Mô phỏng nhân viên: mỗi người chạy một "kế hoạch" gồm các bước (đi, chờ, ngồi, nói chuyện...).
// Sự kiện thật từ backend thay kế hoạch; khi rảnh họ tự đi giải lao.
// Chạy theo bước thời gian cố định 60 Hz nên tốc độ không phụ thuộc tần số màn hình.

import { ISO } from "./iso.js";
import { CATALOG, chatPoints, localPoint, rot, runtime, seatPoint, sofaSeats, toWorld, usePoint } from "./furniture.js";
import { findPath, nearestWalkable, reachable } from "./pathfinding.js";
import { project } from "./iso.js";
import { activityLine, handoffLine, names, pickConversation } from "./dialogue.js";
import { t } from "./i18n.js";

export const TICK_HZ = 60;
const sec = s => Math.round(s * TICK_HZ);
const BUSY = new Set(["working", "thinking", "reviewing"]);
export const isBusyStatus = s => BUSY.has(s);

export const ORDER = ["manager", "analyst", "quant", "risk"];
const FALLBACK = { manager: { x: 455, y: 200 }, analyst: { x: 150, y: 360 }, quant: { x: 290, y: 360 }, risk: { x: 430, y: 360 } };
const WINDOW_SPOT = { x: 280, y: 52 };
const WINDOW_LOOK = { x: 280, y: 0 };

let tick = 0;
let layout = [];
let layoutVersion = 0;
let printerUntil = 0;
let cabinetUntil = 0;
export const flags = { breaksPaused: false };
// Hiệu ứng bay trong phòng (cục giấy ném vào thùng rác...). main.js vẽ chúng trên cùng.
export const effects = [];

export const staff = Object.fromEntries(ORDER.map((id, i) => [id, {
  id, name: names()[id], x: FALLBACK[id].x, y: FALLBACK[id].y,
  facing: "S", path: [], plan: [], stepIndex: 0, stepState: null, planKind: "home",
  serverStatus: "idle", serverMessage: "", statusBubble: null, actionBubble: null,
  sitting: false, seatBlend: 0, lift: 0, moving: false, working: false, talking: false,
  holding: null, partner: null, sofaSeat: null, typingUntil: 0, homeVersion: -1,
  nextBreakAt: sec(14 + i * 7 + Math.random() * 8), animationSeed: Math.random() * 280,
}]));
const agents = Object.values(staff);

// Đổi ngôn ngữ -> cập nhật bảng tên trên đầu nhân viên.
export function renameStaff() { for (const a of agents) a.name = names()[a.id]; }

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// 8 hướng theo màn hình: đi dọc trục thế giới sẽ ra các hướng chéo (SE/SW/NE/NW) – đúng kiểu isometric.
const SECTORS = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
export function facingFor(dx, dy) {
  const sx = (dx - dy) * ISO.kx, sy = (dx + dy) * ISO.ky;
  const angle = Math.atan2(sy, sx);
  const idx = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return SECTORS[idx];
}
const faceToward = (a, p) => { if (p && dist(a, p) > 0.5) a.facing = facingFor(p.x - a.x, p.y - a.y); };

export const deskOf = id => layout.find(it => it.type === "desk" && it.assignedTo === id) || null;

function nearestItem(a, types) {
  let best = null, bestD = Infinity;
  for (const it of layout) {
    if (!types.includes(it.type)) continue;
    const p = usePoint(it);
    if (!p || !reachable(a, p)) continue;
    const d = dist(a, p);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
}

function homeTarget(a) {
  const desk = deskOf(a.id);
  return desk ? seatPoint(desk) : nearestWalkable(FALLBACK[a.id].x, FALLBACK[a.id].y) || FALLBACK[a.id];
}

function besideDesk(id) {
  const desk = deskOf(id);
  if (desk) {
    for (const u of [42, -42]) {
      const p = localPoint(desk, u, 48);
      const w = nearestWalkable(p.x, p.y);
      if (w && dist(w, p) < 12) return w;
    }
    const s = seatPoint(desk);
    return nearestWalkable(s.x + 18, s.y + 18);
  }
  const t = staff[id];
  return nearestWalkable(t.x + 22, t.y + 10);
}

// ---------------------------------------------------------------------------
// Bước của kế hoạch
// ---------------------------------------------------------------------------
const go = (to, o = {}) => ({ type: "go", to, ...o });
const wait = (seconds, o = {}) => ({ type: "wait", ticks: sec(seconds), ...o });
const slide = (to, o = {}) => ({ type: "slide", to, ...o });
const home = (o = {}) => ({ type: "home", ...o });

function setPlan(a, kind, steps) {
  if (a.partner && kind !== "break") releasePartner(a);
  a.sofaSeat = null;
  a.planKind = kind;
  a.plan = steps;
  a.stepIndex = 0;
  a.stepState = null;
  a.path = [];
  a.actionBubble = null;
  a.talking = false;
  a.sitting = false;
}

function releasePartner(a) {
  const p = a.partner && staff[a.partner];
  a.partner = null;
  if (p && p.partner === a.id) {
    p.partner = null;
    if (p.planKind === "break") setPlan(p, "home", [home()]);
  }
}

function nextStep(a) {
  a.stepIndex++;
  a.stepState = null;
}

function enterStep(a, s) {
  a.stepState = { start: tick };
  a.holdStart = tick; // cho các cử chỉ có diễn biến theo thời gian (vo giấy, ném)
  a.actionBubble = s.bubble ? { text: typeof s.bubble === "function" ? s.bubble() : s.bubble, tone: s.tone || "ok" } : null;
  a.holding = s.holding ?? null;
  a.sitting = !!s.sit;
  a.talking = !!s.speak;
  if (s.onStart) s.onStart(a);
  if (s.type === "go") {
    const target = s.to();
    a.stepState.target = target;
    a.path = target ? findPath(a, target) : [];
  } else if (s.type === "slide") {
    a.stepState.target = s.to();
  } else if (s.type === "home") {
    // Mọi kế hoạch đều kết thúc bằng việc về chỗ: từ đây người này được coi là "ở nhà" (rảnh thì được đi giải lao).
    if (a.partner) releasePartner(a);
    a.planKind = "home";
    a.homeVersion = -1;
  }
}

function followPath(a, fast) {
  if (!a.path.length) return true;
  const t = a.path[0];
  const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
  const speed = fast ? 1.45 : 0.95;
  if (d <= speed) { a.x = t.x; a.y = t.y; a.path.shift(); } else { a.x += (dx / d) * speed; a.y += (dy / d) * speed; }
  if (d > 0.01) a.facing = facingFor(dx, dy);
  a.moving = true;
  return a.path.length === 0;
}

function applyFace(a, face) {
  if (!face) return;
  if (typeof face === "string") { a.facing = face; return; }
  const p = typeof face === "function" ? face() : face;
  if (p) faceToward(a, p);
}

function runPlan(a) {
  const s = a.plan[a.stepIndex];
  if (!s) { setPlan(a, "home", [home()]); return; }
  if (!a.stepState) enterStep(a, s);

  switch (s.type) {
    case "go":
      if (!a.stepState.target || followPath(a, s.fast)) nextStep(a);
      break;
    case "slide": {
      const t = a.stepState.target;
      if (!t) { nextStep(a); break; }
      const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
      if (d <= 0.7) { a.x = t.x; a.y = t.y; nextStep(a); } else { a.x += (dx / d) * 0.7; a.y += (dy / d) * 0.7; a.moving = true; a.facing = facingFor(dx, dy); }
      break;
    }
    case "wait":
      applyFace(a, s.face);
      if (s.speak) a.talking = tick - a.stepState.start < s.ticks - sec(0.6);
      if (s.ink && (tick - a.stepState.start) % 28 === 0) runtime.boardInk = Math.min(8, runtime.boardInk + 1);
      if (tick - a.stepState.start >= s.ticks || (s.until && s.until(a))) nextStep(a);
      break;
    case "chat":
      chatTick(a, s);
      break;
    case "home":
      homeTick(a, s);
      break;
    case "do":
      s.fn(a);
      nextStep(a);
      break;
  }
}

function homeTick(a, s) {
  if (a.path.length) { followPath(a, s.fast); return; }
  const target = homeTarget(a);
  if (dist(a, target) > 3 && a.homeVersion !== layoutVersion) {
    a.homeVersion = layoutVersion;
    a.path = findPath(a, target);
    return;
  }
  const desk = deskOf(a.id);
  if (desk && dist(a, target) <= 3) {
    a.sitting = true;
    a.holding = null;
    faceToward(a, desk);
  } else {
    a.sitting = false;
    if (dist(a, target) <= 3) { a.facing = "S"; a.holding = null; }
  }
}

const atHome = a => a.planKind === "home" && a.path.length === 0 && dist(a, homeTarget(a)) <= 3;

// ---------------------------------------------------------------------------
// Tán gẫu: hai người dùng chung một kịch bản hội thoại và lần lượt nói từng câu.
// ---------------------------------------------------------------------------
function chatTick(a, s) {
  const c = s.convo;
  const other = staff[s.other];
  applyFace(a, other);
  if (a.partner !== s.other) { nextStep(a); return; }
  const otherReady = other.plan[other.stepIndex]?.type === "chat" && !other.moving;
  if (!otherReady) {
    a.actionBubble = null;
    a.talking = false;
    if (tick - a.stepState.start > sec(15)) nextStep(a); // đợi mãi không thấy -> về
    return;
  }
  if (s.me === 0 && tick >= c.nextAt) {
    c.index++;
    if (c.index < c.lines.length) c.nextAt = tick + sec(1.8 + c.lines[c.index][1].length * 0.045);
  }
  if (c.index >= c.lines.length) {
    a.actionBubble = null;
    a.talking = false;
    if (tick >= c.nextAt + sec(0.8)) nextStep(a);
    return;
  }
  if (c.index < 0) return;
  const [who, text] = c.lines[c.index];
  const mine = who === s.me;
  a.actionBubble = mine ? { text, tone: "speech" } : null;
  a.talking = mine && tick < c.nextAt - sec(0.5);
}

function startChat(a, b, [pa, pb]) {
  const convo = { lines: pickConversation(a.id, b.id), index: -1, nextAt: 0 };
  const plan = (other, spot, me) => [
    go(() => spot, { bubble: t("sim.goChat") }),
    { type: "chat", convo, me, other: other.id },
    home(),
  ];
  setPlan(a, "break", plan(b, pa, 0));
  setPlan(b, "break", plan(a, pb, 1));
  a.partner = b.id;
  b.partner = a.id;
  b.nextBreakAt = tick + sec(30 + Math.random() * 30);
}

// ---------------------------------------------------------------------------
// Giải lao
// ---------------------------------------------------------------------------
function freeForBreak(a) {
  return atHome(a) && !BUSY.has(a.serverStatus) && !a.partner;
}

function tryBreak(a) {
  a.nextBreakAt = tick + sec(28 + Math.random() * 35);
  if (flags.breaksPaused) return;
  if (agents.filter(o => o.planKind === "break").length >= 2) return;
  const say = kind => activityLine(kind, a.id);

  const options = [];
  const drink = nearestItem(a, ["vending", "watercooler"]);
  if (drink) options.push(() => [
    go(() => usePoint(drink), { bubble: t("sim.getWater") }),
    wait(1.5, { face: drink }),
    wait(4.5, { holding: "cup", face: "S", bubble: say("coffee"), tone: "speech", speak: true }),
    home({ holding: "cup" }),
  ]);
  const shelf = nearestItem(a, ["bookshelf"]);
  if (shelf) options.push(() => [
    go(() => usePoint(shelf), { bubble: t("sim.findDocs") }),
    wait(2, { face: shelf }),
    wait(5, { holding: "book", face: "S", bubble: `📖 ${say("read")}` }),
    home({ holding: "book" }),
  ]);
  const windowSpot = nearestWalkable(WINDOW_SPOT.x, WINDOW_SPOT.y);
  if (windowSpot && reachable(a, windowSpot)) options.push(() => [
    go(() => windowSpot, { bubble: t("sim.toWindow") }),
    wait(5, { face: WINDOW_LOOK, bubble: say("window"), tone: "speech", speak: true }),
    home(),
  ]);

  const sofa = layout.find(it => it.type === "sofa" && usePoint(it) && reachable(a, usePoint(it)));
  if (sofa) {
    const seats = sofaSeats(sofa);
    const k = seats.findIndex((_, i) => !agents.some(o => o.sofaSeat === `${sofa.id}:${i}`));
    if (k >= 0) {
      const seat = seats[k];
      const [fx, fy] = toWorld(rot(sofa), 0, 1);
      const front = { x: seat.x + fx * 32, y: seat.y + fy * 32 };
      const claim = x => { x.sofaSeat = `${sofa.id}:${k}`; };
      options.push(() => [
        go(() => nearestWalkable(front.x, front.y), { bubble: t("sim.sitRest"), onStart: claim }),
        slide(() => seat, { onStart: claim }),
        wait(7, { sit: true, bubble: `😌 ${say("sofa")}`, onStart: x => { claim(x); x.facing = facingFor(fx, fy); } }),
        slide(() => nearestWalkable(front.x, front.y)),
        home(),
      ]);
    }
  }

  const partner = agents.find(o => o !== a && freeForBreak(o));
  const table = layout.find(it => it.type === "meeting");
  let spots = table ? chatPoints(table).map(p => nearestWalkable(p.x, p.y)) : null;
  if (!spots || spots.some(p => !p || !reachable(a, p))) {
    const c = nearestWalkable(a.x + 30, a.y + 30);
    spots = c ? [c, nearestWalkable(c.x + 30, c.y)] : null;
  }
  if (partner && spots && spots[1] && reachable(partner, spots[1])) {
    const chat = () => { startChat(a, partner, spots); return null; };
    options.push(chat, chat); // trò chuyện thường xuyên hơn
  }

  if (!options.length) return;
  const steps = options[Math.floor(Math.random() * options.length)]();
  if (steps) setPlan(a, "break", steps);
}

// ---------------------------------------------------------------------------
// Sự kiện từ backend
// ---------------------------------------------------------------------------
function workSteps(a, status) {
  if (a.id === "manager" && status === "thinking") {
    const board = nearestItem(a, ["whiteboard"]);
    if (board) return [
      go(() => usePoint(board), { bubble: t("sim.planInvest"), fast: true, onStart: () => { runtime.boardInk = 0; } }),
      wait(4.5, { face: board, bubble: t("sim.assign"), ink: true }),
      home({ fast: true }),
    ];
  }
  if (a.id === "analyst" && status === "working") {
    const shelf = nearestItem(a, ["bookshelf"]);
    if (shelf) return [
      go(() => usePoint(shelf), { bubble: t("sim.findReports"), fast: true }),
      wait(3, { face: shelf, bubble: t("sim.readAnnual") }),
      home({ fast: true, holding: "book" }),
    ];
  }
  return [home({ fast: true })];
}

export function applyStatus(id, status, message, { animate = true } = {}) {
  const a = staff[id];
  if (!a) return;
  const prev = a.serverStatus;
  a.serverStatus = status;
  a.serverMessage = message || "";
  if (BUSY.has(status)) {
    a.statusBubble = { text: a.serverMessage, tone: "work" };
    if (animate && prev !== status) setPlan(a, "work", workSteps(a, status));
  } else if (status === "done") {
    a.statusBubble = { text: t("sim.done"), tone: "ok", until: tick + sec(4) };
  } else if (status === "error") {
    a.statusBubble = { text: a.serverMessage, tone: "error", until: tick + sec(8) };
  } else {
    a.statusBubble = null; // rảnh thì không cần bong bóng – bảng "Đội ngũ" đã ghi trạng thái
    a.nextBreakAt = Math.max(a.nextBreakAt, tick + sec(8));
  }
}

export function applyActivity(id, kind, message) {
  const a = staff[id];
  if (!a || !BUSY.has(a.serverStatus)) return;
  if (kind === "thinking") {
    a.statusBubble = { text: t("sim.thinking"), tone: "work" };
  } else if (kind === "tool" || kind === "tool_error") {
    // Đang tra dữ liệu thị trường: kính lúp + nhìn màn hình (gõ phím)
    a.typingUntil = tick + sec(3);
    a.statusBubble = { text: `${kind === "tool" ? "🔎" : "⚠️"} ${message}`, tone: kind === "tool" ? "work" : "error", until: tick + sec(6) };
  } else {
    a.typingUntil = tick + sec(4);
    a.statusBubble = { text: `⌨️ ${message || t("sim.writing")}`, tone: "work", until: tick + sec(5) };
  }
}

export function applyHandoff(fromId, toId) {
  const a = staff[fromId], b = staff[toId];
  if (!a || !b) return;
  const steps = [];
  if (toId === "manager") {
    const printer = nearestItem(a, ["printer"]);
    if (printer) steps.push(
      go(() => usePoint(printer), { bubble: t("sim.print"), fast: true }),
      wait(2.5, { face: printer, bubble: t("sim.printing"), onStart: () => { printerUntil = tick + sec(2.5); } }),
    );
  }
  steps.push(
    go(() => besideDesk(toId), { bubble: t("sim.handoffTo", { name: b.name }), fast: true, holding: "paper" }),
    wait(3, {
      face: () => staff[toId], holding: "paper", tone: "speech", speak: true,
      bubble: handoffLine(`${fromId}>${toId}`) || t("sim.handoffDefault"),
    }),
    home(),
  );
  setPlan(a, "handoff", steps);
}

// ---------------------------------------------------------------------------
// Kịch bản (màn chào hỏi...): danh sách hành động tuần tự cho một nhân viên.
//   { goto: {x,y} } | { say, seconds, face, gesture } | { waitUntil: () => bool, face, gesture, say }
//   { call: fn }    | { home: true }
// ---------------------------------------------------------------------------
export function runScript(id, actions) {
  const a = staff[id];
  const steps = actions.map(act => {
    if (act.goto) return go(() => nearestWalkable(act.goto.x, act.goto.y), { bubble: act.say, fast: act.fast });
    if (act.waitUntil) return { type: "wait", ticks: Infinity, until: act.waitUntil, face: act.face, holding: act.gesture, bubble: act.say, tone: "speech" };
    if (act.call) return { type: "do", fn: act.call };
    if (act.home) return home();
    return wait(act.seconds ?? Math.max(2.4, act.say.length * 0.06), {
      bubble: act.say, tone: "speech", speak: true, face: act.face, holding: act.gesture,
    });
  });
  setPlan(a, "script", steps);
}

// ---------------------------------------------------------------------------
// Tủ hồ sơ & thùng rác: Giám đốc cất báo cáo / vo giấy ném vào thùng rác.
// ---------------------------------------------------------------------------
const nearestOfType = (a, type) => layout.filter(it => it.type === type)
  .sort((p, q) => dist(a, p) - dist(a, q))[0] || null;

// Cất báo cáo: cầm tập giấy ra tủ, kéo ngăn, bỏ vào rồi về chỗ. onFiled chạy lúc đóng ngăn.
export function fileReportScene(onFiled) {
  const a = staff.manager;
  const cab = nearestOfType(a, "cabinet");
  const spot = cab && usePoint(cab) && nearestWalkable(usePoint(cab).x, usePoint(cab).y);
  if (!cab || !spot || !reachable(a, spot)) { onFiled?.(); return false; }
  setPlan(a, "script", [
    go(() => spot, { bubble: t("sim.toCabinet"), fast: true, holding: "paper" }),
    wait(0.5, { face: cab, holding: "paper", onStart: () => { cabinetUntil = tick + sec(2.2); } }),
    wait(1.4, { face: cab, holding: "paper", bubble: t("sim.filing"), tone: "speech", speak: true }),
    { type: "do", fn: () => onFiled?.() },
    wait(0.5, { face: cab }),
    home(),
  ]);
  return true;
}

// Điểm ném: đứng cách thùng rác ~50 đơn vị, ưu tiên phía chỗ ngồi của Giám đốc.
function throwSpot(a, bin) {
  const from = homeTarget(a);
  if (dist(from, bin) <= 95 && reachable(a, from)) return from; // thùng ở gần: ném luôn từ chỗ ngồi
  const dx = from.x - bin.x, dy = from.y - bin.y, d = Math.hypot(dx, dy) || 1;
  for (const r of [50, 42, 60, 34]) {
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) {
      const ang = Math.atan2(dy, dx) + turn;
      const p = nearestWalkable(bin.x + Math.cos(ang) * r, bin.y + Math.sin(ang) * r);
      if (p && Math.abs(dist(p, bin) - r) < 12 && reachable(a, p)) return p;
    }
  }
  return null;
}

// Xoá báo cáo: cầm tờ báo cáo, vo tròn trước mặt, quay sang ném vào thùng rác.
export function trashReportScene() {
  const a = staff.manager;
  const bin = nearestOfType(a, "trash");
  const spot = bin ? throwSpot(a, bin) : null;
  const steps = [];
  if (spot) steps.push(go(() => spot, { fast: true, holding: "paper" }));
  steps.push(
    wait(1.3, { face: "S", holding: "paper", bubble: t("sim.trashSay"), tone: "speech", speak: true }),
    wait(1.4, { face: "S", holding: "crumple", bubble: t("sim.crumple"), tone: "speech" }),
  );
  if (spot) {
    const flight = sec(0.65);
    steps.push(
      wait(0.35, { face: bin, holding: "ball" }),
      {
        type: "do", fn: me => {
          me.holdStart = tick;
          const dir = project(bin.x, bin.y).x >= project(me.x, me.y).x ? 1 : -1;
          const h = project(me.x, me.y);
          effects.push({
            kind: "paperBall", start: tick, ticks: flight,
            from: { x: h.x + dir * 9, y: h.y - 58 },
            to: (() => { const q = project(bin.x, bin.y, CATALOG.trash.h - 6); return { x: q.x, y: q.y }; })(),
            peak: 34, onLand: () => { runtime.trashCount = Math.min(5, runtime.trashCount + 1); },
          });
        },
      },
      wait(0.65, { face: bin, holding: "throw" }),
      wait(1.6, { face: bin, bubble: t("sim.score"), tone: "speech", speak: true }),
    );
  } else {
    steps.push(wait(1.2, { face: "S", holding: "ball", bubble: t("sim.pocket"), tone: "speech", speak: true }));
  }
  steps.push(home());
  setPlan(a, "script", steps);
}

// Mọi người cùng quay về một điểm (vd. nhìn Giám đốc phát biểu).
export function lookAt(point, ids = ORDER) {
  for (const id of ids) {
    const a = staff[id];
    if (a.planKind === "home" && !a.moving) faceToward(a, point);
  }
}

// ---------------------------------------------------------------------------
// Vòng cập nhật + bố trí
// ---------------------------------------------------------------------------
runtime.printerActive = () => tick < printerUntil;
runtime.cabinetOpen = () => tick < cabinetUntil;
runtime.screenState = item => {
  const owner = item.assignedTo && staff[item.assignedTo];
  if (!owner) return "off";
  const busy = BUSY.has(owner.serverStatus);
  const seated = owner.seatBlend > 0.5 && deskOf(owner.id) === item;
  if (busy && seated) return tick < owner.typingUntil ? "typing" : "busy";
  if (busy || seated) return "idle";
  return "off";
};

export function setLayout(items) {
  layout = items;
  layoutVersion++;
  for (const a of agents) {
    const s = a.plan[a.stepIndex];
    if (s?.type === "go" && a.stepState?.target) a.path = findPath(a, a.stepState.target);
    if (s?.type === "home") { a.path = []; a.homeVersion = -1; }
  }
}

// Đặt mọi người ngồi sẵn vào bàn (không cần đi bộ) – dùng khi mở trang.
export function seatEveryone() {
  for (const a of agents) {
    const t = homeTarget(a);
    a.x = t.x; a.y = t.y; a.path = [];
    setPlan(a, "home", [home()]);
  }
}

export function update() {
  tick++;
  runtime.tick = tick;
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (tick - e.start >= e.ticks) { e.onLand?.(); effects.splice(i, 1); }
  }
  for (const a of agents) {
    a.moving = false;
    if (a.planKind === "home" && tick >= a.nextBreakAt && freeForBreak(a)) tryBreak(a);
    runPlan(a);
    a.seatBlend = Math.max(0, Math.min(1, a.seatBlend + (a.sitting ? 0.08 : -0.12)));
    a.lift = a.seatBlend * 3;
    a.working = BUSY.has(a.serverStatus) && a.seatBlend > 0.5;
    if (a.statusBubble?.until && tick > a.statusBubble.until) {
      a.statusBubble = BUSY.has(a.serverStatus) ? { text: a.serverMessage, tone: "work" } : null;
    }
  }
}

export function bubbleOf(a) {
  return a.actionBubble || a.statusBubble;
}

export function agentDrawables(draw) {
  return agents.map(a => ({
    agent: a, layer: 1,
    bounds: { x0: a.x - 5, x1: a.x + 5, y0: a.y - 5, y1: a.y + 5, z0: 0, z1: 70 },
    draw: () => draw(a),
  }));
}

export const getTick = () => tick;
