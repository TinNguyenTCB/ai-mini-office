// Phong cảnh thành phố bên ngoài – cùng phép chiếu isometric với văn phòng, nét line xanh lá.
//
// Văn phòng là tầng trên cùng của một toà cao ốc: mặt đất thành phố nằm ở z = GZ (thấp hơn sàn ~14 tầng).
// Mọi toà nhà, đường phố, cao tốc đều là khối 3D trong cùng hệ toạ độ thế giới (x, y, z) với văn phòng,
// được chiếu bằng project() nên ăn khớp góc nhìn. Không có đường chân trời: phần xa mờ dần vào bóng tối.
// Thành phố đổi theo ngôn ngữ: vi = Sài Gòn, ja = Tokyo, en = New York.
//
// Hiệu năng: phần đứng yên được vẽ sẵn ra 2 canvas phụ (phía sau / phía trước đường cao tốc),
// đoàn tàu chạy được vẽ trực tiếp giữa hai lớp đó nên bị nhà phía trước che đúng thứ tự.

import { ISO, project } from "./iso.js";
import { getLang } from "./i18n.js";

const GZ = -420;          // cao độ mặt đất thành phố (sàn văn phòng = 0)
const HORIZON = -1500;    // giới hạn độ sâu (x + y) của thành phố – nằm ngoài mép trên màn hình, phần xa mờ dần vào bóng tối
const SPAN = [-1500, 1700];
const LOT = 150, LOT_IN = 110; // ô phố 150, trong đó 110 là đất xây dựng, 40 là đường
const HW = { y: -560, x: -560, z: GZ + 52 }; // hai đường cao tốc trên cao (dọc trục x và trục y)
const OFFICE = { x0: 24, x1: 536, y0: 24, y1: 536 };
const GREEN = "#75d899";
const FILL = "rgba(8, 18, 12, 0.97)";
const TEXT = "#9fe6b4";
// Độ sáng chung của phong cảnh (1 = như thiết kế gốc). Giảm để cảnh nền dịu hơn, không giành sự chú ý của văn phòng.
const DIM = 0.55;
const K = Math.hypot(ISO.kx, ISO.ky);

const S = (x, y, z = 0) => { const p = project(x, y, z); return [p.x, p.y]; };
// Nhà thường: mờ dần về phía chân trời. Công trình biểu tượng (boost > 0) luôn rõ.
const depthAlpha = (d, boost = 0) => (boost > 0
  ? Math.min(0.78, 0.5 + boost)
  : Math.min(0.34, 0.1 + ((d - HORIZON) / 2200) * 0.26) * Math.max(0, Math.min(1, (d - HORIZON) / 700)));

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function curve(p0, c, p1, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

// Điểm thế giới (trên mặt đất) nằm dưới một điểm màn hình – để đặt công trình theo vị trí nhìn thấy.
function groundAt(sx, sy) {
  const a = (sx - ISO.originX) / ISO.kx;          // x - y
  const b = (sy - ISO.originY + GZ) / ISO.ky;     // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

// ---------------------------------------------------------------------------
// "Món" vẽ: một Path2D tô (che phía sau) + một Path2D nét, kèm độ sâu để xếp thứ tự.
// ---------------------------------------------------------------------------
function piece(depth, { alpha = null, boost = 0, width = 0.9, glow = 0, group = "front", fade = false } = {}) {
  const fill = new Path2D(), stroke = new Path2D();
  const it = {
    fill, stroke, depth, group, width, glow, fade, texts: [],
    alpha: alpha ?? depthAlpha(depth, boost),
    line(a, b) { stroke.moveTo(a[0], a[1]); stroke.lineTo(b[0], b[1]); },
    path(pts) { stroke.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) stroke.lineTo(pts[i][0], pts[i][1]); },
    shape(pts, solid = true) {
      for (const p of solid ? [fill, stroke] : [stroke]) {
        p.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
        p.closePath();
      }
    },
    ellipse(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, solid = false) {
      for (const p of solid ? [fill, stroke] : [stroke]) {
        p.moveTo(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry);
        p.ellipse(cx, cy, rx, ry, 0, a0, a1);
      }
    },
    circle(cx, cy, r, solid = false) { it.ellipse(cx, cy, r, r, 0, Math.PI * 2, solid); },
  };
  return it;
}

// Khối hộp isometric (tâm cx, cy; đáy z0; cao h). Vẽ 3 mặt nhìn thấy: trái (+y), phải (+x), nóc.
function isoBox(P, cx, cy, z0, w, d, h, { windows = null, rnd = Math.random, top = true } = {}) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, z1 = z0 + h;
  P.shape([S(x0, y1, z0), S(x1, y1, z0), S(x1, y0, z0), S(x1, y0, z1), S(x0, y0, z1), S(x0, y1, z1)]);
  P.line(S(x1, y1, z0), S(x1, y1, z1));
  if (top) P.path([S(x0, y1, z1), S(x1, y1, z1), S(x1, y0, z1)]);
  if (!windows) return;
  const style = windows === "auto" ? ["floors", "mullions", "dots", "bands"][Math.floor(rnd() * 4)] : windows;
  const faceL = (u, z) => S(x0 + u * w, y1, z), faceR = (u, z) => S(x1, y1 - u * d, z);
  for (const [face, len] of [[faceL, w], [faceR, d]]) {
    if (style === "floors" || style === "bands") {
      const step = style === "bands" ? 18 : 9;
      for (let z = z0 + step; z < z1 - 3; z += step) P.line(face(0.06, z), face(0.94, z));
    }
    if (style === "mullions" || style === "bands") {
      const n = Math.max(2, Math.round(len / (style === "bands" ? 14 : 7)));
      for (let i = 1; i < n; i++) P.line(face(i / n, z0 + 3), face(i / n, z1 - 3));
    }
    if (style === "dots") {
      const n = Math.max(2, Math.round(len / 8));
      for (let z = z0 + 8; z < z1 - 6; z += 10) {
        for (let i = 0; i < n; i++) if (rnd() < 0.38) P.line(face((i + 0.3) / n, z), face((i + 0.7) / n, z));
      }
    }
  }
}

// Mái chóp (kim tự tháp) trên khối hộp.
function pyramid(P, cx, cy, z0, w, d, h) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, apex = S(cx, cy, z0 + h);
  P.shape([S(x0, y1, z0), S(x1, y1, z0), S(x1, y0, z0), apex]);
  P.line(S(x1, y1, z0), apex);
}

// Chữ dán lên mặt tường isometric: face "L" (mặt +y, chạy theo x) hoặc "R" (mặt +x, chạy theo -y).
function faceText(P, face, x, y, z, text, size) {
  P.texts.push({ face, x, y, z, text, size });
}

// ---------------------------------------------------------------------------
// Mặt đất, đường phố, đường chân trời, cao tốc
// ---------------------------------------------------------------------------
function groundPiece() {
  const P = piece(-1e9, { alpha: 0.16, width: 0.8, group: "back", fade: true });
  const lim = c => Math.max(SPAN[0], HORIZON - c);
  for (let k = Math.floor(SPAN[0] / LOT); k * LOT < SPAN[1]; k++) {
    for (const off of [LOT_IN + 5, LOT + 5]) {
      const c = k * LOT + off;
      P.line(S(lim(c), c, GZ), S(SPAN[1], c, GZ));
      P.line(S(c, lim(c), GZ), S(c, SPAN[1], GZ));
    }
    // vạch kẻ giữa đường
    const mid = k * LOT + LOT_IN + 25;
    for (let t = lim(mid); t < SPAN[1]; t += 34) {
      P.line(S(t, mid, GZ), S(t + 14, mid, GZ));
      P.line(S(mid, t, GZ), S(mid, t + 14, GZ));
    }
  }
  return P;
}

function highways() {
  const out = [];
  const deck = HW.z;
  // Cao tốc A chạy dọc trục x (y = HW.y), cao tốc B dọc trục y (x = HW.x).
  for (const axis of ["x", "y"]) {
    const P = piece(-900, { alpha: 0.4, width: 0.85, group: "mid", fade: true });
    const fixed = axis === "x" ? HW.y : HW.x;
    const at = (t, off, z) => (axis === "x" ? S(t, fixed + off, z) : S(fixed + off, t, z));
    const t0 = Math.max(SPAN[0], HORIZON - fixed), t1 = SPAN[1];
    // mặt cầu (mặt bên phía người xem + mặt trên)
    if (axis === "x") P.shape([at(t0, 9, deck), at(t1, 9, deck), at(t1, 9, deck - 6), at(t0, 9, deck - 6)]);
    else P.shape([S(fixed + 9, t0, deck), S(fixed + 9, t1, deck), S(fixed + 9, t1, deck - 6), S(fixed + 9, t0, deck - 6)]);
    P.shape([at(t0, -9, deck), at(t1, -9, deck), at(t1, 9, deck), at(t0, 9, deck)]);
    P.line(at(t0, 9, deck + 5), at(t1, 9, deck + 5));
    for (let t = t0; t < t1; t += 10) P.line(at(t, 9, deck), at(t, 9, deck + 5));
    // trụ
    for (let t = Math.ceil(t0 / 110) * 110; t < t1; t += 110) {
      P.shape([at(t - 3, 6, deck - 6), at(t + 3, 6, deck - 6), at(t + 3, 6, GZ), at(t - 3, 6, GZ)]);
    }
    out.push(P);
  }
  return out;
}

// Toà cao ốc chứa văn phòng: hai mặt kính kéo từ sàn (z = -14) xuống mặt đất.
function officeTower() {
  const P = piece(1e9, { alpha: 0.42, width: 0.85, group: "front" });
  const { x0, x1, y0, y1 } = OFFICE, top = -14;
  P.shape([S(x0, y1, top), S(x1, y1, top), S(x1, y0, top), S(x1, y0, GZ), S(x1, y1, GZ), S(x0, y1, GZ)]);
  P.line(S(x1, y1, top), S(x1, y1, GZ));
  for (let z = top - 30; z > GZ + 40; z -= 30) {
    P.line(S(x0, y1, z), S(x1, y1, z));
    P.line(S(x1, y1, z), S(x1, y0, z));
  }
  for (let u = x0 + 32; u < x1; u += 32) P.line(S(u, y1, top - 4), S(u, y1, GZ + 40));
  for (let v = y0 + 32; v < y1; v += 32) P.line(S(x1, v, top - 4), S(x1, v, GZ + 40));
  // sảnh tầng trệt
  P.line(S(x0, y1, GZ + 40), S(x1, y1, GZ + 40));
  P.line(S(x1, y1, GZ + 40), S(x1, y0, GZ + 40));
  P.shape([S(250, y1, GZ), S(310, y1, GZ), S(310, y1, GZ + 30), S(250, y1, GZ + 30)], false);
  P.line(S(280, y1, GZ), S(280, y1, GZ + 30));
  faceText(P, "L", 120, y1, GZ + 47, "MINI CAPITAL", 13);
  faceText(P, "R", x1, 300, -50, "MINI CAPITAL", 11);
  return P;
}


// ---------------------------------------------------------------------------
// Khu phố chung: mỗi ô đất 1–4 toà nhà hình hộp.
// ---------------------------------------------------------------------------
const OFFICE_SCREEN = { x0: 40, x1: 580 }; // bề ngang màn hình mà toà văn phòng chiếm

// Khối nằm trước toà văn phòng (theo thứ tự vẽ isometric) và chồng lên nó trên màn hình -> bỏ, kẻo che văn phòng.
function inFrontOfOffice(x0, y0, x1, y1) {
  if (!(x0 >= OFFICE.x1 || y0 >= OFFICE.y1)) return false;
  const a = S(x0, y1, 0)[0], b = S(x1, y0, 0)[0];
  return Math.max(a, b) > OFFICE_SCREEN.x0 && Math.min(a, b) < OFFICE_SCREEN.x1;
}

const groupOf = (x1, y1) => (y1 < HW.y - 10 || x1 < HW.x - 10 ? "back" : "front");

function city(rnd, reserved) {
  const out = [];
  const taken = (x0, y0, x1, y1) => reserved.some(r => x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0);
  const nearHighway = (x0, y0, x1, y1) => (y0 < HW.y + 14 && y1 > HW.y - 14) || (x0 < HW.x + 14 && x1 > HW.x - 14);
  for (let i = Math.floor(SPAN[0] / LOT); i * LOT < SPAN[1]; i++) {
    for (let j = Math.floor(SPAN[0] / LOT); j * LOT < SPAN[1]; j++) {
      const lx = i * LOT + 5, ly = j * LOT + 5;
      if (lx + ly + LOT_IN < HORIZON + 60) continue;
      if (lx < OFFICE.x1 + 30 && lx + LOT_IN > OFFICE.x0 - 30 && ly < OFFICE.y1 + 30 && ly + LOT_IN > OFFICE.y0 - 30) continue;
      if (rnd() < 0.08) { out.push(park(lx, ly, rnd)); continue; }
      const split = rnd();
      const parts = split < 0.35 ? [[0, 0, 1, 1]] : split < 0.7 ? [[0, 0, 0.5, 1], [0.5, 0, 1, 1]] : [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]];
      for (const [a, b, c, d] of parts) {
        if (rnd() < 0.25) continue;
        const pad = 5;
        const x0 = lx + a * LOT_IN + pad, x1 = lx + c * LOT_IN - pad, y0 = ly + b * LOT_IN + pad, y1 = ly + d * LOT_IN - pad;
        if (taken(x0, y0, x1, y1) || nearHighway(x0, y0, x1, y1) || inFrontOfOffice(x0, y0, x1, y1)) continue;
        // Phần lớn thấp hơn tầng văn phòng (nhìn xuống mái nhà); thỉnh thoảng có toà cao.
        const h = 24 + Math.pow(rnd(), 1.6) * 220 + (rnd() < 0.1 ? 130 : 0);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const P = piece(cx + cy, { group: groupOf(x1, y1) });
        isoBox(P, cx, cy, GZ, x1 - x0, y1 - y0, h, { windows: "auto", rnd });
        if (rnd() < 0.3) {
          const s = 0.45 + rnd() * 0.25, h2 = 12 + rnd() * 40;
          isoBox(P, cx, cy, GZ + h, (x1 - x0) * s, (y1 - y0) * s, h2, { windows: "floors", rnd });
          if (rnd() < 0.5) P.line(S(cx, cy, GZ + h + h2), S(cx, cy, GZ + h + h2 + 14 + rnd() * 20));
        } else if (rnd() < 0.25) {
          P.line(S(cx, cy, GZ + h), S(cx, cy, GZ + h + 10 + rnd() * 24));
        }
        out.push(P);
      }
    }
  }
  return out;
}

// Công viên: viền ô đất + vài cái cây (tán tròn trên thân).
function park(lx, ly, rnd) {
  const P = piece(lx + ly + LOT_IN, { group: groupOf(lx + LOT_IN, ly + LOT_IN) });
  const a = lx + 6, b = lx + LOT_IN - 6, c = ly + 6, d = ly + LOT_IN - 6;
  P.shape([S(a, c, GZ), S(b, c, GZ), S(b, d, GZ), S(a, d, GZ)], false);
  const trees = [];
  for (let k = 0; k < 7; k++) trees.push([a + 10 + rnd() * (b - a - 20), c + 10 + rnd() * (d - c - 20)]);
  trees.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  for (const [x, y] of trees) {
    const base = S(x, y, GZ), top = S(x, y, GZ + 10);
    P.line(base, top);
    P.circle(top[0], top[1] - 5, 6, true);
  }
  return P;
}

// ---------------------------------------------------------------------------
// Công cụ cho công trình biểu tượng
// ---------------------------------------------------------------------------
function spot(sx, sy) { const g = groundAt(sx, sy); return { ...g, d: g.x + g.y }; }
const footprint = (p, r) => ({ x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r });

// Vòng tròn nằm ngang trong phép chiếu isometric -> elip với các bán trục này (nhân bán kính).
const RX = Math.SQRT2 * ISO.kx, RY = Math.SQRT2 * ISO.ky;
function ring(P, b, z, r) { P.ellipse(b[0], b[1] - z, r * RX, r * RY, 0, Math.PI); }
// Thân tròn có bán kính thay đổi theo độ cao: profile = [[z, r], ...] từ dưới lên.
function lathe(P, b, profile, bands = 0) {
  const left = profile.map(([z, r]) => [b[0] - r * RX, b[1] - z]);
  const right = profile.map(([z, r]) => [b[0] + r * RX, b[1] - z]);
  const [z0, r0] = profile[0];
  const bottom = [];
  for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; bottom.push([b[0] + Math.cos(a) * r0 * RX, b[1] - z0 + Math.sin(a) * r0 * RY]); }
  P.shape([...right, ...left.reverse(), ...bottom.reverse()]);
  if (bands) {
    const zTop = profile[profile.length - 1][0];
    for (let z = z0 + bands; z < zTop - 4; z += bands) {
      let r = 0;
      for (let i = 1; i < profile.length; i++) if (z <= profile[i][0]) { const [za, ra] = profile[i - 1], [zb, rb] = profile[i]; r = ra + ((z - za) / (zb - za)) * (rb - ra); break; }
      ring(P, b, z, r);
    }
  }
}

function plinth(P, p, r, h = 6) { isoBox(P, p.x, p.y, GZ, r * 2, r * 2, h); }

// ===========================================================================
// Sài Gòn
// ===========================================================================
function bitexco(p) {
  const P = piece(p.d, { boost: 0.18, glow: 0.1 });
  plinth(P, p, 34, 18);
  const b = S(p.x, p.y, GZ);
  const H = 470;
  lathe(P, b, [[18, 22], [120, 27], [240, 25], [330, 18], [400, 11], [H - 12, 6]], 16);
  // đỉnh cắt vát
  P.shape([[b[0] - 6 * RX, b[1] - (H - 12)], [b[0] + 7 * RX, b[1] - H], [b[0] + 6 * RX, b[1] - (H - 12)]]);
  // sân đỗ trực thăng nhô ra
  const hz = 300, hx = b[0] - 30, hy = b[1] - hz;
  P.ellipse(hx, hy, 22 * RX, 22 * RY, 0, Math.PI * 2, true);
  P.ellipse(hx, hy + 3, 22 * RX, 22 * RY, 0, Math.PI);
  P.line([hx - 3, hy - 2], [hx - 3, hy + 2]); P.line([hx + 3, hy - 2], [hx + 3, hy + 2]); P.line([hx - 3, hy], [hx + 3, hy]);
  P.line([hx + 8, hy + 6], [b[0] - 12, b[1] - hz + 22]);
  return P;
}

function landmark81(p) {
  const P = piece(p.d, { boost: 0.18, glow: 0.1 });
  const cols = [[-12, -12, 300], [12, -12, 400], [-12, 12, 350], [12, 12, 470], [0, 0, 540]];
  cols.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [dx, dy, h] of cols) isoBox(P, p.x + dx, p.y + dy, GZ, 20, 20, h, { windows: "floors" });
  pyramid(P, p.x, p.y, GZ + 540, 20, 20, 22);
  P.line(S(p.x, p.y, GZ + 562), S(p.x, p.y, GZ + 590));
  return P;
}

function benThanh(p) {
  const P = piece(p.d, { boost: 0.15 });
  isoBox(P, p.x, p.y, GZ, 120, 60, 26, { windows: "mullions" });
  pyramid(P, p.x, p.y, GZ + 26, 120, 60, 14);
  const tx = p.x, ty = p.y + 30;
  isoBox(P, tx, ty, GZ, 18, 14, 66);
  pyramid(P, tx, ty, GZ + 66, 18, 14, 18);
  P.line(S(tx, ty, GZ + 84), S(tx, ty, GZ + 92));
  const c = S(tx - 1, ty + 7, GZ + 54);
  P.circle(c[0], c[1], 5);
  P.line(c, [c[0], c[1] - 3.5]); P.line(c, [c[0] + 3, c[1]]);
  faceText(P, "L", p.x - 56, p.y + 30, GZ + 31, "CHỢ BẾN THÀNH", 7);
  return P;
}

function cathedral(p) {
  const P = piece(p.d, { boost: 0.15 });
  isoBox(P, p.x, p.y - 10, GZ, 40, 70, 38, { windows: "mullions" });
  pyramid(P, p.x, p.y - 10, GZ + 38, 40, 70, 16);
  for (const dx of [-14, 14]) {
    const x = p.x + dx, y = p.y + 30;
    isoBox(P, x, y, GZ, 14, 14, 92, { windows: "floors" });
    pyramid(P, x, y, GZ + 92, 14, 14, 40);
    const tip = S(x, y, GZ + 132);
    P.line(tip, [tip[0], tip[1] - 10]); P.line([tip[0] - 3, tip[1] - 6], [tip[0] + 3, tip[1] - 6]);
  }
  const rose = S(p.x, p.y + 37, GZ + 60);
  P.circle(rose[0], rose[1], 4.5);
  return P;
}

// Cầu Ba Son: trụ tháp cong trên cao tốc A, dây văng toả hai phía.
function baSon(t) {
  const P = piece(t + HW.y + 20, { alpha: 0.55, glow: 0.08, group: "front" });
  const base = S(t, HW.y, HW.z), topZ = HW.z + 150;
  const tip = S(t + 8, HW.y, topZ);
  P.shape([...curve([base[0] - 4, base[1]], [base[0] - 10, base[1] - 70], tip, 10), [tip[0] + 5, tip[1] + 2], ...curve([tip[0] + 5, tip[1] + 2], [base[0] + 2, base[1] - 70], [base[0] + 4, base[1]], 10).slice(1)]);
  for (let i = 1; i <= 7; i++) {
    const a = S(t + 6, HW.y, topZ - 10 - i * 7);
    P.line(a, S(t - 20 - i * 24, HW.y, HW.z));
    P.line(a, S(t + 24 + i * 24, HW.y, HW.z));
  }
  return P;
}

// ===========================================================================
// Tokyo
// ===========================================================================

function tokyoTower(p) {
  const P = piece(p.d, { boost: 0.18, glow: 0.1 });
  plinth(P, p, 46, 8);
  const b = S(p.x, p.y, GZ + 8), H = 400;
  const legL = curve([b[0] - 46, b[1]], [b[0] - 14, b[1] - 190], [b[0] - 5, b[1] - 0.8 * H], 12);
  const legR = curve([b[0] + 46, b[1]], [b[0] + 14, b[1] - 190], [b[0] + 5, b[1] - 0.8 * H], 12);
  const legM = curve([b[0] + 4, b[1] + 14], [b[0] + 2, b[1] - 190], [b[0], b[1] - 0.8 * H], 12); // chân phía trước (góc nhìn chéo)
  P.shape([...legL, [b[0] - 2, b[1] - H + 24], [b[0] + 2, b[1] - H + 24], ...[...legR].reverse(), legM[0]]);
  P.path(legM);
  P.line([b[0], b[1] - H + 24], [b[0], b[1] - H]);
  for (let i = 0; i < 11; i++) {
    const a = legL[i], c = legR[i + 1], m = legM[i], n = legM[i + 1], e = legR[i], f = legL[i + 1];
    P.line(a, n); P.line(m, f); P.line(m, c); P.line(e, n);
  }
  for (const [z, half] of [[0.42 * H, 26], [0.75 * H, 10]]) {
    const y = b[1] - z;
    P.shape([[b[0] - half, y], [b[0], y + half * 0.45], [b[0] + half, y], [b[0] + half, y - 10], [b[0], y - 10 - half * 0.45], [b[0] - half, y - 10]]);
    P.path([[b[0] - half, y - 10], [b[0], y - 10 + half * 0.45], [b[0] + half, y - 10]]);
    P.line([b[0], y + half * 0.45], [b[0], y - 10 + half * 0.45]);
  }
  return P;
}

function skytree(p) {
  const P = piece(p.d, { boost: 0.18, glow: 0.1 });
  plinth(P, p, 34, 10);
  const b = S(p.x, p.y, GZ + 10), H = 560;
  lathe(P, b, [[0, 34], [0.3 * H, 12], [0.66 * H, 10]], 0);
  for (let z = 12; z < 0.64 * H; z += 14) {
    const r = z < 0.3 * H ? 34 - (z / (0.3 * H)) * 22 : 12 - ((z - 0.3 * H) / (0.36 * H)) * 2;
    P.line([b[0] - r * RX, b[1] - z], [b[0] + r * RX * 0.4, b[1] - z - 14]);
    P.line([b[0] + r * RX, b[1] - z], [b[0] - r * RX * 0.4, b[1] - z - 14]);
  }
  lathe(P, b, [[0.66 * H, 16], [0.7 * H, 16]], 0);
  lathe(P, b, [[0.7 * H, 7], [0.84 * H, 6]], 0);
  lathe(P, b, [[0.84 * H, 11], [0.87 * H, 11]], 0);
  P.shape([[b[0] - 3, b[1] - 0.87 * H], [b[0] - 1, b[1] - H], [b[0] + 1, b[1] - H], [b[0] + 3, b[1] - 0.87 * H]]);
  return P;
}

function torii(p) {
  const P = piece(p.d, { boost: 0.2 });
  for (const dx of [-24, 24]) isoBox(P, p.x + dx, p.y, GZ, 5, 5, 70);
  P.shape([S(p.x - 32, p.y, GZ + 56), S(p.x + 32, p.y, GZ + 56), S(p.x + 32, p.y, GZ + 61), S(p.x - 32, p.y, GZ + 61)]);
  const top = [S(p.x - 44, p.y, GZ + 76), ...curve(S(p.x - 30, p.y, GZ + 72), S(p.x, p.y, GZ + 69), S(p.x + 30, p.y, GZ + 72), 6), S(p.x + 44, p.y, GZ + 76)];
  P.shape([...top, ...[...top].reverse().map(([x, y]) => [x, y + 6])]);
  return P;
}

function pagoda(p) {
  const P = piece(p.d, { boost: 0.16 });
  let z = GZ, w = 46;
  for (let i = 0; i < 5; i++) {
    isoBox(P, p.x, p.y, z, w - 10, w - 10, 16, { top: false });
    const zr = z + 16, o = w / 2 + 6;
    P.shape([S(p.x - o, p.y + o, zr), S(p.x + o, p.y + o, zr), S(p.x + o, p.y - o, zr), S(p.x + o - 4, p.y - o + 4, zr + 6), S(p.x, p.y, zr + 12), S(p.x - o + 4, p.y + o - 4, zr + 6)]);
    P.line(S(p.x + o, p.y + o, zr), S(p.x, p.y, zr + 12));
    z += 22; w -= 6;
  }
  const tip = S(p.x, p.y, z + 4);
  P.line(tip, [tip[0], tip[1] - 30]);
  for (let k = 0; k < 6; k++) P.line([tip[0] - 3, tip[1] - 6 - k * 4], [tip[0] + 3, tip[1] - 6 - k * 4]);
  return P;
}

// Biển quảng cáo: bảng đứng trên cột (chữ dán theo mặt L/R) hoặc biển dọc kiểu Nhật.
function billboard(p, text, { size = 9, vertical = false, z = 120, face = "L" } = {}) {
  const P = piece(p.d + 1, { boost: 0.2 });
  if (vertical) {
    const h = [...text].length * (size + 2) + 8, w = size + 8;
    isoBox(P, p.x, p.y, GZ, 4, 4, z);
    const c = S(p.x, p.y + 6, GZ + z);
    P.shape([[c[0] - w / 2, c[1] - h], [c[0] + w / 2, c[1] - h], [c[0] + w / 2, c[1]], [c[0] - w / 2, c[1]]]);
    P.shape([[c[0] - w / 2 + 2, c[1] - h + 2], [c[0] + w / 2 - 2, c[1] - h + 2], [c[0] + w / 2 - 2, c[1] - 2], [c[0] - w / 2 + 2, c[1] - 2]], false);
    P.texts.push({ screen: true, x: c[0], y: c[1] - h + 4, text, size });
    return P;
  }
  const len = text.length * size * 0.66 + 14, hgt = size + 10;
  for (const t of [-len / 3, len / 3]) {
    if (face === "L") isoBox(P, p.x + t, p.y, GZ, 3, 3, z); else isoBox(P, p.x, p.y + t, GZ, 3, 3, z);
  }
  const corner = (u, zz) => (face === "L" ? S(p.x - len / 2 + u, p.y + 2, GZ + zz) : S(p.x + 2, p.y + len / 2 - u, GZ + zz));
  P.shape([corner(0, z), corner(len, z), corner(len, z + hgt), corner(0, z + hgt)]);
  P.shape([corner(2, z + 2), corner(len - 2, z + 2), corner(len - 2, z + hgt - 2), corner(2, z + hgt - 2)], false);
  P.texts.push({ face, x: face === "L" ? p.x : p.x + 2, y: face === "L" ? p.y + 2 : p.y, z: GZ + z + hgt / 2 - size * 0.38, text, size, center: true });
  return P;
}

// ===========================================================================
// New York
// ===========================================================================
function liberty(p) {
  const P = piece(p.d, { boost: 0.2, glow: 0.1 });
  isoBox(P, p.x, p.y, GZ, 110, 110, 8);
  isoBox(P, p.x, p.y, GZ + 8, 56, 56, 30, { windows: "mullions" });
  isoBox(P, p.x, p.y, GZ + 38, 34, 34, 70, { windows: "bands" });
  isoBox(P, p.x, p.y, GZ + 108, 26, 26, 10);
  const b = S(p.x, p.y, GZ + 118), k = 1.5;
  const Q = pts => pts.map(([dx, dy]) => [b[0] + dx * k, b[1] - dy * k]);
  P.shape(Q([[-13, 0], [-11, 40], [-9, 72], [-5, 82], [6, 82], [9, 70], [12, 38], [14, 0]]));
  for (const s of [-6, 0, 6]) P.path(curve(...Q([[s, 0], [s * 1.4, 40], [s * 0.5, 76]]), 6));
  const head = Q([[0, 89]])[0];
  P.circle(head[0], head[1], 6 * k, true);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + 0.25 + (i / 6) * (Math.PI - 0.5);
    P.line([head[0] + Math.cos(a) * 6 * k, head[1] - 2 + Math.sin(a) * 6 * k], [head[0] + Math.cos(a) * 14 * k, head[1] - 2 + Math.sin(a) * 14 * k]);
  }
  P.shape(Q([[5, 80], [11, 112], [15, 111], [9, 79]]));
  P.shape(Q([[9, 112], [17, 112], [15, 118], [11, 118]]));
  P.path(Q([[13, 118], [9, 124], [13, 133], [17, 124], [13, 118]]));
  P.shape(Q([[-13, 54], [-20, 46], [-14, 30], [-7, 38]]));
  return P;
}

function empireState(p) {
  const P = piece(p.d, { boost: 0.18, glow: 0.1 });
  const steps = [[70, 60], [54, 310], [40, 400], [28, 440], [18, 470], [9, 500]];
  let z = GZ;
  for (const [w, top] of steps) {
    isoBox(P, p.x, p.y, z, w, w, GZ + top - z, { windows: "mullions" });
    z = GZ + top;
  }
  P.line(S(p.x, p.y, z), S(p.x, p.y, z + 40));
  return P;
}

function chrysler(p) {
  const P = piece(p.d, { boost: 0.18, glow: 0.1 });
  isoBox(P, p.x, p.y, GZ, 46, 46, 330, { windows: "mullions" });
  // vương miện hình vòm nhiều lớp trên hai mặt nhìn thấy
  for (let i = 0; i < 5; i++) {
    const half = 20 - i * 4, z = GZ + 330 + i * 15;
    isoBox(P, p.x, p.y, z, half * 2, half * 2, 15, { top: false });
    for (const face of ["L", "R"]) {
      const pts = [];
      for (let s = 0; s <= 8; s++) {
        const u = -half + (s / 8) * half * 2, zz = z + 4 + Math.sin((s / 8) * Math.PI) * 9;
        pts.push(face === "L" ? S(p.x + u, p.y + half, zz) : S(p.x + half, p.y - u, zz));
      }
      P.path(pts);
    }
  }
  const tip = S(p.x, p.y, GZ + 405);
  P.line(tip, [tip[0], tip[1] - 46]);
  return P;
}

function oneWtc(p) {
  const P = piece(p.d, { boost: 0.18, glow: 0.1 });
  isoBox(P, p.x, p.y, GZ, 60, 60, 40, { windows: "mullions" });
  // thân thon dần: đáy vuông lớn, đỉnh vuông nhỏ – mặt kính là các tam giác
  const zb = GZ + 40, zt = GZ + 520, B = 30, T = 18;
  const bl = S(p.x - B, p.y + B, zb), bf = S(p.x + B, p.y + B, zb), br = S(p.x + B, p.y - B, zb);
  const tl = S(p.x - T, p.y + T, zt), tf = S(p.x + T, p.y + T, zt), tr = S(p.x + T, p.y - T, zt), tb = S(p.x - T, p.y - T, zt);
  P.shape([bl, bf, br, tr, tb, tl]);
  P.path([tl, tf, tr]);
  P.line(bf, tf);
  P.line(bl, tf); P.line(bf, tl); P.line(bf, tr); P.line(br, tf);
  P.line(S(p.x, p.y, zt), S(p.x, p.y, zt + 90));
  return P;
}

// Cầu Brooklyn trên cao tốc A: hai tháp đá có vòm nhọn + cáp võng.
function brooklyn(t) {
  const P = piece(t + HW.y + 20, { alpha: 0.55, glow: 0.08, group: "front" });
  const towers = [t - 110, t + 110];
  const towerTop = HW.z + 70;
  for (const tx of towers) {
    isoBox(P, tx, HW.y, GZ, 18, 30, towerTop - GZ);
    for (const off of [-7, 7]) {
      const a = S(tx + 9, HW.y + off, HW.z + 5), top = S(tx + 9, HW.y + off, HW.z + 46);
      P.path([a, [a[0], top[1] + 8], [top[0] + (off < 0 ? 3 : -3), top[1]], [a[0] + (off < 0 ? 6 : -6), top[1] + 8]]);
    }
  }
  const zTop = towerTop + 6;
  const cable = [];
  for (let s = 0; s <= 16; s++) {
    const u = s / 16, x = towers[0] + u * (towers[1] - towers[0]);
    cable.push([x, HW.z + 8 + (zTop - HW.z - 8) * (4 * (u - 0.5) * (u - 0.5))]);
  }
  P.path(cable.map(([x, z]) => S(x, HW.y + 9, z)));
  for (const [x, z] of cable) P.line(S(x, HW.y + 9, z), S(x, HW.y + 9, HW.z + 5));
  for (const [from, to] of [[towers[0], towers[0] - 170], [towers[1], towers[1] + 170]]) {
    P.path(curve(S(from, HW.y + 9, zTop), S((from + to) / 2, HW.y + 9, HW.z + 20), S(to, HW.y + 9, HW.z + 5), 10));
  }
  return P;
}

// ---------------------------------------------------------------------------
// Bố trí từng thành phố (vị trí đặt theo điểm màn hình của chân công trình)
// ---------------------------------------------------------------------------
function cityPieces(lang) {
  const L = [];
  const reserved = [];
  const put = (sx, sy, r, make) => { const p = spot(sx, sy); reserved.push(footprint(p, r)); L.push(make(p)); return p; };
  // t trên cao tốc A sao cho điểm đó hiện ở hoành độ màn hình sx.
  const tOnA = sx => (sx - ISO.originX) / ISO.kx + HW.y;
  if (lang === "ja") {
    put(-40, 560, 50, tokyoTower);
    put(660, 520, 40, skytree);
    put(-250, 640, 30, torii);
    put(860, 620, 34, pagoda);
    put(-150, 600, 10, p => billboard(p, "寿司", { vertical: true, z: 70, size: 11 }));
    put(760, 600, 10, p => billboard(p, "ラーメン", { vertical: true, z: 60, size: 10 }));
    put(560, 640, 10, p => billboard(p, "カラオケ", { vertical: true, z: 50, size: 9 }));
    put(-330, 520, 30, p => billboard(p, "東京", { z: 110, size: 16 }));
    put(980, 560, 30, p => billboard(p, "居酒屋", { z: 40, size: 11, face: "R" }));
    put(-120, 700, 30, p => billboard(p, "新宿 SHINJUKU", { z: 20, size: 8 }));
  } else if (lang === "en") {
    put(-230, 640, 60, liberty);
    put(-20, 520, 34, oneWtc);
    put(660, 520, 40, empireState);
    put(820, 600, 30, chrysler);
    L.push(brooklyn(tOnA(1060)));
    put(-380, 540, 30, p => billboard(p, "BROADWAY", { z: 140, size: 13 }));
    put(940, 520, 30, p => billboard(p, "TIMES SQ", { z: 150, size: 12, face: "R" }));
    put(-80, 690, 20, p => billboard(p, "NYC", { z: 30, size: 14 }));
    put(560, 650, 20, p => billboard(p, "DELI", { z: 28, size: 11, face: "R" }));
    put(-470, 660, 20, p => billboard(p, "5th AVE", { z: 22, size: 9 }));
  } else {
    put(-50, 560, 40, bitexco);
    put(650, 500, 30, landmark81);
    put(-280, 640, 66, benThanh);
    put(850, 610, 44, cathedral);
    L.push(baSon(tOnA(990)));
    put(760, 560, 20, p => billboard(p, "SÀI GÒN", { z: 150, size: 14, face: "R" }));
    put(-160, 690, 20, p => billboard(p, "PHỞ 24", { z: 26, size: 11 }));
    put(560, 650, 20, p => billboard(p, "CÀ PHÊ", { z: 26, size: 11, face: "R" }));
    put(-430, 560, 20, p => billboard(p, "Đ. NGUYỄN HUỆ", { z: 18, size: 8 }));
    put(1000, 640, 20, p => billboard(p, "Q.1 · TP.HCM", { z: 18, size: 8, face: "R" }));
  }
  return { pieces: L, reserved };
}

// Đoàn tàu: các toa hình hộp chạy dọc cao tốc (dựng lại mỗi khung vì vị trí đổi liên tục).
const TRAIN = { vi: { cars: 3, len: 44, nose: false }, ja: { cars: 4, len: 50, nose: true }, en: { cars: 4, len: 40, nose: false } };
function drawTrain(ctx, kind, axis, t) {
  const P = piece(0, { alpha: 0.65, width: 0.9 });
  const fixed = axis === "x" ? HW.y : HW.x;
  const z = HW.z + 1;
  const lim = HORIZON - fixed;
  // Toa sau vẽ trước (xa người xem hơn)
  for (let i = kind.cars - 1; i >= 0; i--) {
    const a = t - i * (kind.len + 3), b = a - kind.len;
    if (b < lim) continue; // đã quá đường chân trời
    const cx = (a + b) / 2;
    const [bx, by, w, d] = axis === "x" ? [cx, fixed, kind.len, 12] : [fixed, cx, 12, kind.len];
    isoBox(P, bx, by, z, w, d, 11, { windows: "mullions" });
    if (kind.nose && i === 0) {
      const pt = (along, off, zz) => (axis === "x" ? S(along, fixed + off, zz) : S(fixed + off, along, zz));
      P.shape([pt(a, -6, z + 11), pt(a, 6, z + 11), pt(a, 6, z), pt(a + 16, 0, z + 2)]);
      P.line(pt(a, 6, z + 11), pt(a + 16, 0, z + 2));
    }
  }
  paint(ctx, P);
}

// ---------------------------------------------------------------------------
// Vẽ
// ---------------------------------------------------------------------------
function paintTexts(ctx, P) {
  if (!P.texts.length) return;
  const base = ctx.getTransform();
  ctx.globalAlpha = Math.min(0.95, P.alpha + 0.25) * DIM;
  ctx.fillStyle = TEXT;
  for (const tx of P.texts) {
    ctx.font = `700 ${tx.size}px "Be Vietnam Pro", "Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif`;
    ctx.setTransform(base);
    if (tx.screen) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      [...tx.text].forEach((ch, i) => ctx.fillText(ch, tx.x, tx.y + (i + 0.5) * (tx.size + 2)));
      continue;
    }
    const [px, py] = S(tx.x, tx.y, tx.z);
    ctx.translate(px, py);
    if (tx.face === "L") ctx.transform(ISO.kx / K, ISO.ky / K, 0, 1, 0, 0);
    else ctx.transform(ISO.kx / K, -ISO.ky / K, 0, 1, 0, 0);
    ctx.textAlign = tx.center ? "center" : "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(tx.text, 0, 0);
  }
  ctx.setTransform(base);
}

// Nét mờ dần về phía xa: x + y nhỏ hơn = cao hơn trên màn hình.
function fadeStroke(ctx) {
  const far = S(0, HORIZON + 150, GZ)[1], near = S(0, HORIZON + 900, GZ)[1];
  const g = ctx.createLinearGradient(0, far, 0, near);
  g.addColorStop(0, "rgba(117,216,153,0)");
  g.addColorStop(1, GREEN);
  return g;
}

function paint(ctx, P) {
  ctx.strokeStyle = P.fade ? fadeStroke(ctx) : GREEN;
  ctx.globalAlpha = 1;
  ctx.fillStyle = FILL;
  ctx.fill(P.fill);
  if (P.glow) {
    ctx.globalAlpha = P.glow * DIM;
    ctx.lineWidth = P.width * 3.5;
    ctx.stroke(P.stroke);
  }
  ctx.globalAlpha = P.alpha * DIM;
  ctx.lineWidth = P.width;
  ctx.stroke(P.stroke);
  paintTexts(ctx, P);
}

const SEEDS = { vi: 7341, ja: 2207, en: 9113 };
const cache = new Map();

function build(lang) {
  const rnd = rng(SEEDS[lang] || SEEDS.vi);
  const { pieces, reserved } = cityPieces(lang);
  // Công trình biểu tượng nằm sau cao tốc thì xếp vào lớp sau.
  for (const P of pieces) if (P.group === "front" && P.depth < HW.y * 2) P.group = "back";
  const all = [groundPiece(), ...highways(), ...pieces, ...city(rnd, reserved), officeTower()];
  all.sort((a, b) => a.depth - b.depth);
  return {
    back: all.filter(P => P.group === "back"),
    mid: all.filter(P => P.group === "mid"),
    front: all.filter(P => P.group === "front"),
    train: TRAIN[lang] || TRAIN.vi,
  };
}

// Canvas phụ: chỉ vẽ lại khi đổi ngôn ngữ / camera / kích thước.
const layers = { back: { canvas: null, key: "" }, front: { canvas: null, key: "" } };

function cached(slot, ctx, key, draw) {
  const L = layers[slot];
  const { width, height } = ctx.canvas;
  if (!L.canvas || L.canvas.width !== width || L.canvas.height !== height) {
    L.canvas = Object.assign(document.createElement("canvas"), { width, height });
    L.key = "";
  }
  if (L.key !== key) {
    const c = L.canvas.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, width, height);
    c.setTransform(ctx.getTransform());
    c.strokeStyle = GREEN;
    c.lineJoin = "round";
    c.lineCap = "round";
    draw(c);
    L.key = key;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(L.canvas, 0, 0);
  ctx.restore();
}

export function drawSkyline(ctx, tick) {
  const lang = getLang();
  let c = cache.get(lang);
  if (!c) { c = build(lang); cache.set(lang, c); }
  const m = ctx.getTransform();
  const key = `${lang}|${ctx.canvas.width}x${ctx.canvas.height}|${m.a.toFixed(4)}|${m.e.toFixed(1)}|${m.f.toFixed(1)}`;

  cached("back", ctx, key, cx => {
    for (const P of c.back) paint(cx, P);
    for (const P of c.mid) paint(cx, P);
  });

  ctx.save();
  ctx.strokeStyle = GREEN;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Hai đoàn tàu trên hai cao tốc, chạy về phía người xem
  const len = SPAN[1] - SPAN[0] + 600;
  drawTrain(ctx, c.train, "x", SPAN[0] + ((tick * 1.1) % len));
  drawTrain(ctx, c.train, "y", SPAN[0] + ((tick * 0.9 + len / 2) % len));
  ctx.restore();

  cached("front", ctx, key, cx => { for (const P of c.front) paint(cx, P); });
}
