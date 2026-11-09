// Phép chiếu isometric + các hàm vẽ khối cơ bản dùng chung cho cả văn phòng.

export const ISO = Object.freeze({ originX: 310, originY: 110, kx: 0.495, ky: 0.44 });
// Phòng nằm trong toạ độ thế giới [min, max] trên cả hai trục; tường ở x = wall và y = wall.
export const ROOM = Object.freeze({ min: 30, max: 530, wall: 24 });

let ctx = null;
export function bindContext(context) { ctx = context; }
export function getContext() { return ctx; }

export function project(x, y, z = 0) {
  return { x: ISO.originX + (x - y) * ISO.kx, y: ISO.originY + (x + y) * ISO.ky - z };
}

// Điểm trên màn hình -> điểm trên mặt sàn (z = 0).
export function unproject(sx, sy) {
  const a = (sx - ISO.originX) / ISO.kx; // x - y
  const b = (sy - ISO.originY) / ISO.ky; // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

// ---------- màu ----------
const shadeCache = new Map();
export function shade(hex, amount) {
  if (!hex || hex[0] !== "#") return hex;
  const key = hex + amount;
  let out = shadeCache.get(key);
  if (!out) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
    out = `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
    shadeCache.set(key, out);
  }
  return out;
}

// ---------- vẽ ----------
export function poly(points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  points.forEach((pt, i) => {
    const p = project(pt.x, pt.y, pt.z || 0);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

export function line(a, b, color, width = 1) {
  const p = project(a.x, a.y, a.z || 0);
  const q = project(b.x, b.y, b.z || 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.stroke();
}

// Hộp trục thẳng: chỉ 3 mặt nhìn thấy được trong góc nhìn này là đỉnh, mặt +y ("front") và mặt +x ("side").
export function box(x, y, w, d, h, z, colors) {
  const x0 = x - w / 2, x1 = x + w / 2, y0 = y - d / 2, y1 = y + d / 2, z1 = z + h;
  poly([{ x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y1, z }, { x: x1, y: y0, z }], colors.side);
  poly([{ x: x0, y: y1, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y1, z }, { x: x0, y: y1, z }], colors.front);
  poly(
    [{ x: x0, y: y0, z: z1 }, { x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }],
    colors.top, colors.edge || null
  );
}

export function floorShadow(x, y, rx, ry, alpha = 0.3) {
  const p = project(x, y, 0);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Viền chữ nhật trên mặt sàn (dùng cho vùng chọn / bóng xem trước).
export function floorRect(b, fill, stroke, dash = null) {
  ctx.save();
  if (dash) ctx.setLineDash(dash);
  poly(
    [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }],
    fill, stroke, 2
  );
  ctx.restore();
}

// Khung bao trên màn hình của một khối 3D – dùng để chọn đồ bằng chuột.
export function screenBounds(b) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0 || 0, b.z1 || 0]) {
    const p = project(x, y, z);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

// ---------- sắp xếp chiều sâu ----------
// Mỗi phần tử có bounds {x0,x1,y0,y1,z0,z1} và layer (dùng khi hai khối chồng lấn đáy).
// Trả về thứ tự vẽ từ xa đến gần bằng sắp xếp topo – đúng cả với đồ lớn, khác với x+y của tâm.
const EPS = 0.01;
function compare(a, b) {
  const A = a.bounds, B = b.bounds;
  const overlapX = A.x0 < B.x1 - EPS && B.x0 < A.x1 - EPS;
  const overlapY = A.y0 < B.y1 - EPS && B.y0 < A.y1 - EPS;
  if (overlapX && overlapY) {
    if (A.z1 <= B.z0 + EPS) return -1;
    if (B.z1 <= A.z0 + EPS) return 1;
    if ((a.layer || 0) !== (b.layer || 0)) return (a.layer || 0) < (b.layer || 0) ? -1 : 1;
    return 0;
  }
  const aBehind = A.x1 <= B.x0 + EPS || A.y1 <= B.y0 + EPS;
  const bBehind = B.x1 <= A.x0 + EPS || B.y1 <= A.y0 + EPS;
  if (aBehind && !bBehind) return -1;
  if (bBehind && !aBehind) return 1;
  return 0;
}

export function isoSort(items) {
  const n = items.length;
  const before = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const rel = compare(items[i], items[j]);
      if (rel < 0) before[j].push(i);
      else if (rel > 0) before[i].push(j);
    }
  }
  const depth = it => (it.bounds.x0 + it.bounds.x1 + it.bounds.y0 + it.bounds.y1) / 2 + (it.bounds.z0 || 0) * 0.01;
  const order = [...items.keys()].sort((i, j) => depth(items[i]) - depth(items[j]));
  const state = new Uint8Array(n);
  const out = [];
  const visit = i => {
    if (state[i]) return;
    state[i] = 1;
    for (const k of before[i]) visit(k);
    out.push(items[i]);
  };
  order.forEach(visit);
  return out;
}
