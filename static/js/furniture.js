// Nội thất: mỗi món được dựng từ các khối 3D trong hệ toạ độ cục bộ (u, v, z),
// nên khi xoay 90° nó xoay thật trong thế giới isometric chứ không xoay hình 2D.
//
// Quy ước hệ cục bộ: +v là "mặt trước" (phía người dùng đứng/ngồi), +u là bên phải khi nhìn từ mặt trước.

import { ROOM, box, getContext, isoSort, poly, project, screenBounds, shade } from "./iso.js";

// Trạng thái động do mô phỏng cập nhật (màn hình bật, máy in chạy, mực trên bảng...).
export const runtime = {
  tick: 0,
  screenState: () => "off", // "off" | "idle" | "busy" | "typing"
  printerActive: () => false,
  boardInk: 0,
  cabinetOpen: () => false, // ngăn tủ hồ sơ đang kéo ra
  archiveCount: 0,          // số báo cáo đã lưu -> số tập hồ sơ xếp trên nóc tủ
  trashCount: 0,            // số cục giấy trong thùng rác
};

export function rot(item) { return (((item.rotation || 0) % 4) + 4) % 4; }

export function toWorld(r, u, v) {
  switch (r) {
    case 0: return [u, v];
    case 1: return [-v, u];
    case 2: return [-u, -v];
    default: return [v, -u];
  }
}

export function localPoint(item, u, v) {
  const [dx, dy] = toWorld(rot(item), u, v);
  return { x: item.x + dx, y: item.y + dy };
}

// Mặt cục bộ nào đang quay về +y (front) / +x (side) của thế giới, theo từng hướng xoay.
const FRONT_FACE = ["pv", "pu", "nv", "nu"];
const SIDE_FACE = ["pu", "nv", "nu", "pv"];
const FACE_NORMAL = { pv: [0, 1], nv: [0, -1], pu: [1, 0], nu: [-1, 0] };

const resolve = c => (typeof c === "function" ? c() : c);

// ---------------------------------------------------------------------------
// Bộ dựng khối
// ---------------------------------------------------------------------------
function makeBuilder(item) {
  const r = rot(item);
  const prims = [];

  function decalPoints(dec, b) {
    const L = (u, v, z) => {
      const [dx, dy] = toWorld(r, u, v);
      return { x: item.x + dx, y: item.y + dy, z };
    };
    if (dec.face === "top") {
      const z = b.z + b.h + 0.15;
      return {
        visible: true,
        points: [
          L(b.u + dec.u0, b.v + dec.v0, z), L(b.u + dec.u1, b.v + dec.v0, z),
          L(b.u + dec.u1, b.v + dec.v1, z), L(b.u + dec.u0, b.v + dec.v1, z),
        ],
      };
    }
    const [nu, nv] = FACE_NORMAL[dec.face];
    const [wx, wy] = toWorld(r, nu, nv);
    const visible = wx > 0 || wy > 0;
    let pts;
    if (nv !== 0) {
      const v = b.v + nv * (b.d / 2 + 0.2);
      pts = [L(b.u + dec.u0, v, dec.z0), L(b.u + dec.u1, v, dec.z0), L(b.u + dec.u1, v, dec.z1), L(b.u + dec.u0, v, dec.z1)];
    } else {
      const u = b.u + nu * (b.w / 2 + 0.2);
      pts = [L(u, b.v + dec.u0, dec.z0), L(u, b.v + dec.u1, dec.z0), L(u, b.v + dec.u1, dec.z1), L(u, b.v + dec.u0, dec.z1)];
    }
    return { visible, points: pts };
  }

  const api = {
    box(u, v, w, d, h, z, color, opts = {}) {
      const [dx, dy] = toWorld(r, u, v);
      const odd = r % 2 === 1;
      const W = odd ? d : w, D = odd ? w : d;
      const x = item.x + dx, y = item.y + dy;
      const local = { u, v, w, d, h, z };
      prims.push({
        kind: "box", x, y, w: W, d: D, h, z, color,
        faces: opts.faces || {}, edge: !!opts.edge, visible: opts.visible,
        decals: (opts.decals || []).map(dec => ({ ...decalPoints(dec, local), color: dec.color })),
        bounds: { x0: x - W / 2, x1: x + W / 2, y0: y - D / 2, y1: y + D / 2, z0: z, z1: z + h },
      });
    },
    custom(u, v, w, d, z0, z1, draw) {
      const [dx, dy] = toWorld(r, u, v);
      const x = item.x + dx, y = item.y + dy;
      prims.push({
        kind: "custom", draw: () => draw(project(x, y, z0)),
        bounds: { x0: x - w / 2, x1: x + w / 2, y0: y - d / 2, y1: y + d / 2, z0, z1 },
      });
    },
  };
  return { api, prims, r };
}

function drawPrims(prims, r) {
  for (const p of prims) {
    if (p.kind === "custom") { p.draw(); continue; }
    if (p.visible && !p.visible()) continue;
    const base = resolve(p.color);
    if (!base) continue;
    box(p.x, p.y, p.w, p.d, p.h, p.z, {
      top: resolve(p.faces.top) || shade(base, 0.14),
      front: resolve(p.faces[FRONT_FACE[r]]) || base,
      side: resolve(p.faces[SIDE_FACE[r]]) || shade(base, -0.3),
      edge: p.edge ? shade(base, 0.35) : null,
    });
    for (const dec of p.decals) {
      if (!dec.visible) continue;
      const c = resolve(dec.color);
      if (c) poly(dec.points, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Từng món nội thất
// ---------------------------------------------------------------------------
const C = {
  leg: "#2a302c", metal: "#3b4440", desk: "#a8875a", pedestal: "#86694a", drawer: "#6e5539",
  casing: "#1d2421", paper: "#f1f0e8", mug: "#e9e4d8", wood: "#6b5038", chair: "#3b4a44",
};
const BOOK_COLORS = ["#b5523b", "#d0a245", "#4f7cac", "#5b8f5a", "#8a5a9e", "#c97a3c", "#3f7f86", "#a33d5c"];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function screenColor(item) {
  switch (runtime.screenState(item)) {
    case "typing": return runtime.tick % 16 < 8 ? "#66d895" : "#4fbf7f";
    case "busy": return "#4fbf7f";
    case "idle": return "#2c6447";
    default: return "#16201b";
  }
}

function buildDesk(L, item) {
  for (const [u, v] of [[-29, -14], [29, -14], [-29, 14], [29, 14]]) L.box(u, v, 4, 4, 28, 0, C.leg);
  L.box(0, -15, 54, 2, 16, 10, "#6f5940");
  L.box(20, 1, 18, 28, 27, 0, C.pedestal, {
    decals: [
      { face: "pv", u0: -7, u1: 7, z0: 15, z1: 24, color: C.drawer },
      { face: "pv", u0: -7, u1: 7, z0: 3, z1: 12, color: C.drawer },
      { face: "pv", u0: -2, u1: 2, z0: 20, z1: 21.5, color: "#d8c9a6" },
      { face: "pv", u0: -2, u1: 2, z0: 8, z1: 9.5, color: "#d8c9a6" },
    ],
  });
  L.box(0, 0, 64, 34, 3, 28, C.desk, { edge: true });
  // Màn hình
  L.box(-6, -10, 12, 7, 1, 31, C.metal);
  L.box(-6, -11, 3, 2, 8, 32, C.metal);
  // Biểu đồ nến trên màn hình (nến cuối nhấp nháy khi đang làm việc).
  let seed = hash(item.id || "desk");
  const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0) % 1000) / 1000;
  let level = 47;
  const candles = Array.from({ length: 7 }, (_, i) => {
    const move = (rnd() - 0.42) * 5;
    const lo = Math.min(level, level + move), hi = Math.max(level, level + move) + 0.8;
    level = Math.max(43, Math.min(53, level + move));
    return { u0: -12 + i * 3.6, z0: lo, z1: hi, up: move >= 0, last: i === 6 };
  });
  L.box(-6, -10, 32, 3, 20, 38, C.casing, {
    decals: [
      { face: "pv", u0: -14, u1: 14, z0: 40, z1: 56, color: () => screenColor(item) },
      ...candles.map(c => ({
        face: "pv", u0: c.u0, u1: c.u0 + 2, z0: c.z0, z1: c.z1,
        color: () => {
          const st = runtime.screenState(item);
          if (st === "off") return null;
          if (c.last && st !== "idle" && runtime.tick % 40 < 20) return "#f0ffd8";
          return c.up ? "#a8f0a0" : "#f08a7a";
        },
      })),
    ],
  });
  // Bàn phím, chuột, cốc, giấy
  L.box(-6, 6, 22, 7, 1.5, 31, "#2b312e", {
    decals: [{ face: "top", u0: -10, u1: 10, v0: -2.5, v1: 2.5, color: "#5c6660" }],
  });
  L.box(9, 7, 3, 5, 1.2, 31, "#2b312e");
  L.box(24, -6, 5, 5, 7, 31, C.mug, { decals: [{ face: "top", u0: -2, u1: 2, v0: -2, v1: 2, color: "#5a3a22" }] });
  L.box(-25, 5, 11, 14, 1, 31, C.paper);
}

function buildChairParts(L, cu, cv, backSign, color, part) {
  if (part !== "back") {
    L.box(cu, cv, 16, 3, 2, 0, "#262c29");
    L.box(cu, cv, 3, 16, 2, 0, "#262c29");
    L.box(cu, cv, 3, 3, 11, 2, "#262c29");
    L.box(cu, cv, 18, 17, 4, 13, color, { edge: true });
  }
  if (part !== "seat") L.box(cu, cv + backSign * 9.5, 18, 3, 18, 17, shade(color, -0.12), { edge: true });
}

function buildMeeting(L) {
  L.box(0, 0, 34, 22, 2, 0, C.leg);
  L.box(0, 0, 10, 10, 25, 2, C.leg);
  L.box(0, 0, 84, 52, 3, 27, "#8f7350", { edge: true });
  L.box(-14, 5, 16, 11, 1, 30, "#9aa3a0");
  L.box(-14, -1.5, 16, 1.5, 10, 31, "#9aa3a0", {
    decals: [{ face: "pv", u0: -7, u1: 7, z0: 32, z1: 40, color: "#3f8fbf" }],
  });
  L.box(14, 3, 12, 15, 0.8, 30, C.paper);
  L.box(30, -12, 4, 4, 5, 30, C.mug);
  L.box(-32, 12, 4, 4, 5, 30, C.mug);
}

function buildBookshelf(L, item) {
  const W = C.wood;
  L.box(0, -9.5, 64, 3, 84, 0, shade(W, -0.25));
  L.box(-30.5, 0, 3, 22, 84, 0, W);
  L.box(30.5, 0, 3, 22, 84, 0, W);
  L.box(0, 1.5, 58, 19, 5, 0, W);
  L.box(0, 1.5, 58, 19, 2.5, 28, W);
  L.box(0, 1.5, 58, 19, 2.5, 56, W);
  L.box(0, 0, 64, 22, 3, 81, W, { edge: true });
  let seed = hash(item.id || "shelf");
  const rand = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  for (const z of [5, 30.5, 58.5]) {
    let u = -27;
    while (u < 22) {
      const w = 5 + Math.floor(rand() * 3);
      const h = 15 + Math.floor(rand() * 7);
      if (rand() > 0.12) {
        L.box(u + w / 2, -1, w, 13, h, z, BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)]);
      }
      u += w + 1;
    }
  }
}

// Bảng trắng: biểu đồ cột phân bổ danh mục, vẽ dần từng cột khi Giám đốc lập kế hoạch.
const INK_BARS = [
  [-28, 12, "#3a6fb0"], [-21, 20, "#3a6fb0"], [-14, 9, "#2f8a55"], [-7, 24, "#2f8a55"],
  [0, 15, "#d0a245"], [7, 6, "#c0463a"], [14, 18, "#3a6fb0"], [21, 11, "#2f8a55"],
];
function buildWhiteboard(L) {
  for (const u of [-31, 31]) {
    L.box(u, 0, 4, 16, 2, 0, "#8d938f");
    L.box(u, 0, 3, 4, 38, 2, "#9aa09c");
  }
  L.box(0, 0, 70, 3, 36, 36, "#c9ced0", {
    edge: true,
    decals: [
      { face: "pv", u0: -33, u1: 33, z0: 38, z1: 70, color: "#f3f5ef" },
      { face: "pv", u0: -30, u1: 29, z0: 41, z1: 41.8, color: "#5c6660" },
      ...INK_BARS.map(([u0, h, color], i) => ({
        face: "pv", u0, u1: u0 + 5, z0: 42, z1: 42 + h, color: () => (runtime.boardInk > i ? color : null),
      })),
    ],
  });
  L.box(0, 2.5, 50, 3, 1.5, 36, "#9aa09c");
}

function buildPrinter(L) {
  L.box(0, 0, 44, 32, 22, 0, "#39443e", {
    decals: [
      { face: "pv", u0: -20, u1: -1, z0: 3, z1: 19, color: "#4a5650" },
      { face: "pv", u0: 1, u1: 20, z0: 3, z1: 19, color: "#4a5650" },
    ],
  });
  L.box(0, -1, 38, 28, 13, 22, "#c9cdc5", {
    edge: true,
    decals: [
      { face: "pv", u0: -12, u1: 12, z0: 25, z1: 27.5, color: "#2a2f2c" },
      {
        face: "pv", u0: 13, u1: 16, z0: 30, z1: 32,
        color: () => (runtime.printerActive() ? (runtime.tick % 20 < 10 ? "#8fffa6" : "#e8f77a") : "#4f7a55"),
      },
    ],
  });
  L.box(0, -3, 34, 22, 3, 35, "#e2e5dd");
  L.box(0, 15, 18, 8, 1, 26, C.paper, { visible: () => runtime.printerActive() });
}

function buildWatercooler(L) {
  L.box(0, 0, 24, 24, 34, 0, "#dfe3dc", {
    edge: true,
    decals: [
      { face: "pv", u0: -6, u1: 6, z0: 19, z1: 28, color: "#b9c0b8" },
      { face: "pv", u0: -3, u1: -1, z0: 22, z1: 25, color: "#3a7bd5" },
      { face: "pv", u0: 1, u1: 3, z0: 22, z1: 25, color: "#d5463a" },
    ],
  });
  L.box(0, 0, 8, 8, 3, 34, "#cfd5ce");
  L.box(0, 0, 16, 16, 20, 37, "#8cc6e6", {
    decals: [{ face: "pv", u0: -8, u1: 8, z0: 46, z1: 49, color: "#c3e6f6" }],
  });
}

function buildVending(L) {
  const items = ["#e05a47", "#f2c94c", "#5fb3e0", "#7bc96f", "#e58fb1", "#f29b38", "#9b7be0", "#5ad1b3", "#e05a47"];
  L.box(0, 0, 46, 32, 80, 0, "#2c6f8e", {
    edge: true,
    decals: [
      { face: "pv", u0: -21, u1: 21, z0: 76, z1: 79, color: "#f2c94c" },
      { face: "pv", u0: -20, u1: 8, z0: 24, z1: 74, color: "#152a33" },
      ...items.map((color, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        return { face: "pv", u0: -18 + col * 9, u1: -12 + col * 9, z0: 62 - row * 15, z1: 70 - row * 15, color };
      }),
      { face: "pv", u0: 11, u1: 19, z0: 46, z1: 66, color: "#cfd8d6" },
      { face: "pv", u0: 13, u1: 17, z0: 40, z1: 43, color: "#1e2326" },
      { face: "pv", u0: -16, u1: 4, z0: 8, z1: 16, color: "#0e1418" },
    ],
  });
}

function buildSofa(L) {
  const S = "#4d6a85";
  L.box(0, 0, 84, 34, 12, 0, shade(S, -0.25));
  L.box(0, -12.5, 84, 9, 26, 12, S, { edge: true });
  L.box(-38, 2, 8, 30, 10, 12, S, { edge: true });
  L.box(38, 2, 8, 30, 10, 12, S, { edge: true });
  L.box(-17, 3.5, 32, 25, 6, 12, shade(S, 0.1), { edge: true });
  L.box(17, 3.5, 32, 25, 6, 12, shade(S, 0.1), { edge: true });
  L.box(-26, -5.5, 12, 4, 10, 18, "#d9b44a");
}

function buildPlant(L, item) {
  const variant = hash(item.id || "plant") % 3;
  L.box(0, 0, 16, 16, 14, 0, "#b56a43", {
    edge: true,
    decals: [{ face: "top", u0: -6.5, u1: 6.5, v0: -6.5, v1: 6.5, color: "#4a3626" }],
  });
  L.custom(0, 0, 18, 18, 14, 52, p => drawLeaves(p, variant));
}

function drawLeaves(p, variant) {
  const ctx = getContext();
  const stems = [
    [[0, -2, -2, -33], [-2, -3, -16, -22], [2, -3, 16, -26], [0, -3, 1, -40], [0, -3, -19, -14]],
    [[0, -2, -8, -26], [0, -2, 9, -28], [0, -2, 0, -34], [0, -2, -14, -14], [0, -2, 14, -15]],
    [[0, -2, 0, -46], [0, -2, -4, -38], [0, -2, 5, -40]],
  ][variant];
  const leaves = [
    [[-18, -25], [-6, -35], [8, -29], [15, -22], [-20, -16], [-2, -42]],
    [[-12, -28], [5, -31], [-4, -36], [-17, -16], [11, -18], [0, -24]],
    [[-4, -48], [-8, -40], [3, -44], [4, -36], [-6, -30], [2, -26]],
  ][variant];
  ctx.strokeStyle = "#3f6f45";
  ctx.lineWidth = 2.5;
  for (const [sx, sy, ex, ey] of stems) {
    ctx.beginPath();
    ctx.moveTo(p.x + sx, p.y + sy);
    ctx.quadraticCurveTo(p.x + (sx + ex) / 2, p.y + (sy + ey) / 2 - 3, p.x + ex, p.y + ey);
    ctx.stroke();
  }
  leaves.forEach(([x, y], i) => {
    ctx.fillStyle = i % 2 ? "#6fa65a" : "#88bd68";
    ctx.fillRect(Math.round(p.x + x), Math.round(p.y + y), 9, 6);
    ctx.fillStyle = "#4f8a4a";
    ctx.fillRect(Math.round(p.x + x), Math.round(p.y + y + 4), 9, 2);
  });
}

// Tủ hồ sơ 4 ngăn bằng kim loại: ngăn trên cùng trượt ra khi Giám đốc cất báo cáo,
// trên nóc tủ xếp chồng các tập hồ sơ theo số báo cáo đã lưu.
const FOLDER_COLORS = ["#d9b44a", "#4f7cac", "#c0463a", "#5b8f5a", "#8a5a9e"];
function buildCabinet(L) {
  const body = "#7c8884";
  L.box(0, 0, 28, 22, 2, 0, "#3a4240");
  L.box(0, 0, 28, 22, 56, 2, body, {
    edge: true,
    decals: [0, 1, 2, 3].flatMap(i => {
      const z0 = 4 + i * 13.5;
      return [
        { face: "pv", u0: -12.5, u1: 12.5, z0, z1: z0 + 12, color: "#8d9995" },
        { face: "pv", u0: -4, u1: 4, z0: z0 + 8, z1: z0 + 10.5, color: "#efe9d6" },
        { face: "pv", u0: -3, u1: 3, z0: z0 + 3.5, z1: z0 + 5, color: "#3a4240" },
      ];
    }),
  });
  // Ngăn kéo trên cùng (khi mở) + giấy bên trong
  L.box(0, 17, 24, 12, 11, 45, "#8d9995", {
    visible: () => runtime.cabinetOpen(),
    decals: [
      { face: "top", u0: -10, u1: 10, v0: -5, v1: 5, color: "#5e6a66" },
      { face: "top", u0: -8, u1: 8, v0: -4, v1: 3, color: "#f1f0e8" },
      { face: "pv", u0: -3, u1: 3, z0: 49, z1: 50.5, color: "#3a4240" },
    ],
  });
  FOLDER_COLORS.forEach((color, i) => {
    L.box(i % 2 ? 1.5 : -1, 0, 20, 15, 1.8, 58 + i * 1.9, color, { visible: () => runtime.archiveCount > i });
  });
}

// Thùng rác lưới nhỏ cạnh bàn; cục giấy vo tròn chất dần lên miệng thùng.
function buildTrash(L) {
  L.box(0, 0, 14, 14, 18, 0, "#3f4b47", {
    edge: true,
    decals: [
      { face: "top", u0: -5.5, u1: 5.5, v0: -5.5, v1: 5.5, color: "#1c2422" },
      ...[-4, 0, 4].map(u => ({ face: "pv", u0: u - 0.6, u1: u + 0.6, z0: 2, z1: 16, color: "#566561" })),
      ...[-4, 0, 4].map(u => ({ face: "pu", u0: u - 0.6, u1: u + 0.6, z0: 2, z1: 16, color: "#566561" })),
    ],
  });
  L.custom(0, 0, 14, 14, 18, 26, p => drawPaperBalls(p, runtime.trashCount));
}

const BALL_SPOTS = [[-2, -1], [3, 0], [0, -4], [-4, -3], [2, -6]];
function drawPaperBalls(p, n) {
  const ctx = getContext();
  for (let i = 0; i < Math.min(n, BALL_SPOTS.length); i++) {
    const [dx, dy] = BALL_SPOTS[i];
    drawPaperBall(ctx, p.x + dx, p.y + dy, 3, i * 1.7);
  }
}

// Cục giấy vo tròn (dùng chung cho thùng rác và cục giấy đang bay).
export function drawPaperBall(ctx, x, y, r, spin = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = "#f4f1e6";
  ctx.strokeStyle = "#a9a493";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const rr = r * (k % 2 ? 0.82 : 1.05);
    if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(r * 0.1, r * 0.25); ctx.lineTo(r * 0.5, -r * 0.3);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Danh mục
// ---------------------------------------------------------------------------
export const CATALOG = {
  desk: { label: "Bàn làm việc", icon: "🖥️", w: 64, d: 34, h: 58, seat: { u: 0, v: 42 }, build: buildDesk },
  meeting: { label: "Bàn họp", icon: "🗂️", w: 84, d: 52, h: 42, chat: [{ u: -58, v: 0 }, { u: 58, v: 0 }], build: buildMeeting },
  bookshelf: { label: "Kệ sách", icon: "📚", w: 64, d: 22, h: 84, use: { u: 0, v: 34 }, build: buildBookshelf },
  whiteboard: { label: "Bảng trắng", icon: "📋", w: 70, d: 6, h: 72, use: { u: 0, v: 28 }, build: buildWhiteboard },
  printer: { label: "Máy in", icon: "🖨️", w: 44, d: 32, h: 38, use: { u: 0, v: 34 }, build: buildPrinter },
  watercooler: { label: "Cây nước", icon: "🚰", w: 26, d: 26, h: 57, use: { u: 0, v: 28 }, build: buildWatercooler },
  vending: { label: "Máy bán nước", icon: "🥤", w: 46, d: 32, h: 80, use: { u: 0, v: 32 }, build: buildVending },
  sofa: { label: "Sofa", icon: "🛋️", w: 84, d: 34, h: 38, use: { u: 0, v: 36 }, seats: [{ u: -18, v: 4 }, { u: 18, v: 4 }], build: buildSofa },
  plant: { label: "Cây cảnh", icon: "🪴", w: 22, d: 22, h: 52, build: buildPlant },
  cabinet: { label: "Tủ hồ sơ", icon: "🗄️", w: 28, d: 22, h: 68, use: { u: -34, v: 26 }, build: buildCabinet },
  trash: { label: "Thùng rác", icon: "🗑️", w: 14, d: 14, h: 26, build: buildTrash },
  chair: {
    label: "Ghế", icon: "🪑", w: 22, d: 22, h: 36,
    build: L => buildChairParts(L, 0, 0, -1, C.chair, "all"),
  },
};

export const DEFAULT_LAYOUT = [
  { type: "whiteboard", x: 120, y: 38, rotation: 0 },
  { type: "bookshelf", x: 41, y: 110, rotation: 3 },
  { type: "bookshelf", x: 41, y: 185, rotation: 3 },
  { type: "plant", x: 185, y: 44 },
  { type: "printer", x: 385, y: 47, rotation: 0 },
  { type: "desk", x: 455, y: 125, rotation: 2, assignedTo: "manager" },
  { type: "cabinet", x: 512, y: 52, rotation: 0 },
  { type: "trash", x: 410, y: 150, rotation: 0 },
  { type: "desk", x: 150, y: 275, rotation: 0, assignedTo: "analyst" },
  { type: "plant", x: 220, y: 262 },
  { type: "desk", x: 290, y: 275, rotation: 0, assignedTo: "quant" },
  { type: "desk", x: 430, y: 275, rotation: 0, assignedTo: "risk" },
  { type: "vending", x: 47, y: 410, rotation: 3 },
  { type: "watercooler", x: 44, y: 470, rotation: 3 },
  { type: "plant", x: 42, y: 514 },
  { type: "meeting", x: 270, y: 440, rotation: 0 },
  { type: "sofa", x: 465, y: 420, rotation: 0 },
  { type: "plant", x: 514, y: 514 },
];

// ---------------------------------------------------------------------------
// Hình học
// ---------------------------------------------------------------------------
export function footprint(item, at = item) {
  const def = CATALOG[item.type];
  const odd = rot(item) % 2 === 1;
  const W = odd ? def.d : def.w, D = odd ? def.w : def.d;
  return { x0: at.x - W / 2, x1: at.x + W / 2, y0: at.y - D / 2, y1: at.y + D / 2, z0: 0, z1: def.h };
}

export function fitsInRoom(item, at = item) {
  const b = footprint(item, at);
  return b.x0 >= ROOM.min && b.y0 >= ROOM.min && b.x1 <= ROOM.max && b.y1 <= ROOM.max;
}

export function overlapsAny(item, items, at = item, margin = 2) {
  const a = footprint(item, at);
  return items.some(other => {
    if (other === item || other.id === item.id) return false;
    const b = footprint(other);
    return a.x0 < b.x1 + margin && b.x0 < a.x1 + margin && a.y0 < b.y1 + margin && b.y0 < a.y1 + margin;
  });
}

export const seatPoint = item => (CATALOG[item.type].seat ? localPoint(item, CATALOG[item.type].seat.u, CATALOG[item.type].seat.v) : null);
export const usePoint = item => (CATALOG[item.type].use ? localPoint(item, CATALOG[item.type].use.u, CATALOG[item.type].use.v) : null);
export const chatPoints = item => (CATALOG[item.type].chat || []).map(p => localPoint(item, p.u, p.v));
export const sofaSeats = item => (CATALOG[item.type].seats || []).map(p => localPoint(item, p.u, p.v));

// ---------------------------------------------------------------------------
// Bộ đệm khối đã dựng + drawable cho cảnh
// ---------------------------------------------------------------------------
function cached(item, slot, build) {
  const key = `${item.x},${item.y},${rot(item)}`;
  item._cache ??= {};
  const hit = item._cache[slot];
  if (hit && hit.key === key) return hit.prims;
  const { api, prims, r } = makeBuilder(item);
  build(api, item);
  const sorted = isoSort(prims);
  item._cache[slot] = { key, prims: sorted, r };
  return sorted;
}

export function drawItem(item, alpha = 1) {
  const prims = cached(item, "main", CATALOG[item.type].build);
  const ctx = getContext();
  ctx.save();
  ctx.globalAlpha = alpha;
  drawPrims(prims, rot(item));
  ctx.restore();
}

export function sceneDrawables(items) {
  const out = [];
  for (const item of items) {
    out.push({ item, bounds: footprint(item), layer: 0, draw: () => drawItem(item) });
    if (item.type === "desk") {
      const color = item.chairColor || C.chair;
      for (const part of ["seat", "back"]) {
        const prims = cached(item, part, L => buildChairParts(L, 0, CATALOG.desk.seat.v, 1, color, part));
        const bounds = prims.reduce((b, p) => ({
          x0: Math.min(b.x0, p.bounds.x0), x1: Math.max(b.x1, p.bounds.x1),
          y0: Math.min(b.y0, p.bounds.y0), y1: Math.max(b.y1, p.bounds.y1),
          z0: Math.min(b.z0, p.bounds.z0), z1: Math.max(b.z1, p.bounds.z1),
        }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity });
        out.push({ item, bounds, layer: 0, draw: () => drawPrims(prims, rot(item)) });
      }
    }
  }
  return out;
}

// Chọn món đồ dưới con trỏ: ưu tiên món được vẽ sau cùng (gần người xem nhất).
// Trước tiên thử đúng ô sàn dưới chuột, sau đó mới tới khung bao trên màn hình (đồ cao).
export function pickItem(drawOrder, sx, sy, ground) {
  for (let i = drawOrder.length - 1; i >= 0; i--) {
    const d = drawOrder[i];
    if (!d.item) continue;
    const b = footprint(d.item);
    if (ground.x >= b.x0 && ground.x <= b.x1 && ground.y >= b.y0 && ground.y <= b.y1) return d.item;
  }
  for (let i = drawOrder.length - 1; i >= 0; i--) {
    const d = drawOrder[i];
    if (!d.item) continue;
    const s = screenBounds(footprint(d.item));
    if (sx >= s.minX && sx <= s.maxX && sy >= s.minY && sy <= s.maxY) return d.item;
  }
  return null;
}
