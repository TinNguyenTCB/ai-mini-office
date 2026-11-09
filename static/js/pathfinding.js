// Lưới đi lại dựng từ vị trí nội thất thật + A* (8 hướng) + làm mượt đường bằng line-of-sight.
// Thay cho đồ thị nút cố định cũ: giờ nhân viên luôn đi vòng qua đồ đạc, kể cả đồ vừa kéo thả.

import { ROOM } from "./iso.js";
import { footprint } from "./furniture.js";

const CELL = 10;
const N = Math.round((ROOM.max - ROOM.min) / CELL);
const INFLATE = 9; // bán kính "thân người"
const WALL_GAP = 8;

const blocked = new Uint8Array(N * N);
const component = new Int32Array(N * N);

const idx = (i, j) => j * N + i;
const clampCell = v => Math.max(0, Math.min(N - 1, v));
const cellOf = (x, y) => [clampCell(Math.floor((x - ROOM.min) / CELL)), clampCell(Math.floor((y - ROOM.min) / CELL))];
const centerOf = (i, j) => ({ x: ROOM.min + i * CELL + CELL / 2, y: ROOM.min + j * CELL + CELL / 2 });

export function rebuild(items) {
  blocked.fill(0);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const c = centerOf(i, j);
      if (c.x < ROOM.min + WALL_GAP || c.y < ROOM.min + WALL_GAP || c.x > ROOM.max - WALL_GAP || c.y > ROOM.max - WALL_GAP) {
        blocked[idx(i, j)] = 1;
      }
    }
  }
  for (const item of items) {
    const b = footprint(item);
    const [i0, j0] = cellOf(b.x0 - INFLATE, b.y0 - INFLATE);
    const [i1, j1] = cellOf(b.x1 + INFLATE, b.y1 + INFLATE);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const c = centerOf(i, j);
        if (c.x > b.x0 - INFLATE && c.x < b.x1 + INFLATE && c.y > b.y0 - INFLATE && c.y < b.y1 + INFLATE) {
          blocked[idx(i, j)] = 1;
        }
      }
    }
  }
  labelComponents();
}

function labelComponents() {
  component.fill(-1);
  let label = 0;
  const queue = new Int32Array(N * N);
  for (let start = 0; start < N * N; start++) {
    if (blocked[start] || component[start] >= 0) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    component[start] = label;
    while (head < tail) {
      const cur = queue[head++];
      const i = cur % N, j = (cur / N) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const k = idx(ni, nj);
        if (!blocked[k] && component[k] < 0) { component[k] = label; queue[tail++] = k; }
      }
    }
    label++;
  }
}

export function isWalkable(x, y) {
  if (x < ROOM.min || y < ROOM.min || x >= ROOM.max || y >= ROOM.max) return false;
  const [i, j] = cellOf(x, y);
  return !blocked[idx(i, j)];
}

function nearestCell(x, y, wantComponent = -1) {
  const [si, sj] = cellOf(x, y);
  const seen = new Uint8Array(N * N);
  const queue = [[si, sj]];
  seen[idx(si, sj)] = 1;
  for (let h = 0; h < queue.length; h++) {
    const [i, j] = queue[h];
    const k = idx(i, j);
    if (!blocked[k] && (wantComponent < 0 || component[k] === wantComponent)) return [i, j];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N || seen[idx(ni, nj)]) continue;
      seen[idx(ni, nj)] = 1;
      queue.push([ni, nj]);
    }
  }
  return null;
}

export function nearestWalkable(x, y) {
  const c = nearestCell(x, y);
  return c ? centerOf(c[0], c[1]) : null;
}

// Hai điểm có đi tới nhau được không (cùng một vùng liên thông)?
export function reachable(a, b) {
  const ca = nearestCell(a.x, a.y), cb = cellOf(b.x, b.y);
  if (!ca || blocked[idx(cb[0], cb[1])]) return false;
  return component[idx(ca[0], ca[1])] === component[idx(cb[0], cb[1])];
}

function lineClear(a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / 3));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    if (!isWalkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node, f) {
    const a = this.a; a.push([f, node]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top[1];
  }
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

// Trả về danh sách điểm cần đi qua (không gồm điểm xuất phát). Mảng rỗng nếu đã ở đích.
export function findPath(from, to) {
  const start = nearestCell(from.x, from.y);
  if (!start) return [];
  const comp = component[idx(start[0], start[1])];
  const goalCell = nearestCell(to.x, to.y, comp);
  if (!goalCell) return [];
  const [gi, gj] = goalCell;
  const startK = idx(start[0], start[1]), goalK = idx(gi, gj);

  const g = new Float32Array(N * N).fill(Infinity);
  const prev = new Int32Array(N * N).fill(-1);
  const closed = new Uint8Array(N * N);
  const h = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
  const open = new Heap();
  g[startK] = 0;
  open.push(startK, h(start[0], start[1]));
  while (open.size) {
    const cur = open.pop();
    if (cur === goalK) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const i = cur % N, j = (cur / N) | 0;
    for (const [di, dj, cost] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const k = idx(ni, nj);
      if (blocked[k] || closed[k]) continue;
      if (di && dj && (blocked[idx(i + di, j)] || blocked[idx(i, j + dj)])) continue; // không cắt góc
      const ng = g[cur] + cost;
      if (ng < g[k]) { g[k] = ng; prev[k] = cur; open.push(k, ng + h(ni, nj)); }
    }
  }
  if (goalK !== startK && prev[goalK] < 0) return [];

  const cells = [];
  for (let k = goalK; k !== -1; k = prev[k]) cells.unshift(centerOf(k % N, (k / N) | 0));
  const exactOk = isWalkable(to.x, to.y) && component[idx(...cellOf(to.x, to.y))] === comp;
  const end = exactOk ? { x: to.x, y: to.y } : cells[cells.length - 1];
  const raw = [{ x: from.x, y: from.y }, ...cells.slice(1, -1), end];
  if (!isWalkable(from.x, from.y)) raw.splice(1, 0, cells[0]); // đang kẹt trong đồ: bước ra trước đã

  // Làm mượt: nối thẳng tới điểm xa nhất còn nhìn thấy.
  const out = [];
  let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1;
    while (j > i + 1 && !lineClear(raw[i], raw[j])) j--;
    out.push(raw[j]);
    i = j;
  }
  return out.filter((p, k) => k > 0 || Math.hypot(p.x - from.x, p.y - from.y) > 0.5);
}
