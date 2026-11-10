// 最短手数ソルバー（IDA*）。par の算出とテストに使う。ゲーム本体では使わない。
// 回転は手数に数えないので、収納は両方の向きを試す。
import { CELL_CM, round1 } from './cloth.js';

const OFF = 2048;
const K = (x, y) => (x + OFF) * 4096 + (y + OFF);
const X = (k) => Math.floor(k / 4096) - OFF;
const Y = (k) => (k % 4096) - OFF;

function fromGarment(g) {
  const m = new Map();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.mask(x, y)) m.set(K(x, y), 1);
  return m;
}

function bounds(m) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, top = 0;
  for (const [k, c] of m) {
    const x = X(k), y = Y(k);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (c > top) top = c;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, top };
}

function foldCounts(m, axis, line, side) {
  const next = new Map();
  const moving = [];
  for (const [k, c] of m) {
    const v = axis === 'x' ? X(k) : Y(k);
    if (side > 0 ? v >= line : v < line) moving.push(k);
    else next.set(k, c);
  }
  if (!moving.length || !next.size) return null;
  for (const k of moving) {
    const x = X(k), y = Y(k);
    const nk = axis === 'x' ? K(2 * line - 1 - x, y) : K(x, 2 * line - 1 - y);
    next.set(nk, (next.get(nk) || 0) + m.get(k));
  }
  return next;
}

function halvings(n, target) {
  let k = 0;
  while (n > target) { n = Math.ceil(n / 2); k++; }
  return k;
}

function canonical(m, b) {
  const parts = [];
  for (const [k, c] of m) parts.push((X(k) - b.minX) * 10000 + (Y(k) - b.minY) * 10 + c);
  parts.sort((a, b) => a - b);
  return parts.join(',');
}

// storage = { w, d, h }。PERFECT になる最短手数と手順を返す
export function solve(garment, storage, maxDepth = 7) {
  const slackMax = 2 / CELL_CM;
  const orients = [[storage.w, storage.d], [storage.d, storage.w]];
  const isGoal = (b) =>
    round1(b.top * garment.t) <= storage.h + 1e-9 &&
    orients.some(([W, D]) => b.w <= W && b.h <= D && W - b.w + D - b.h <= slackMax);
  const lb = (b) => Math.min(...orients.map(([W, D]) => halvings(b.w, W) + halvings(b.h, D)));

  const start = fromGarment(garment);
  for (let limit = 0; limit <= maxDepth; limit++) {
    const seen = new Map();
    const path = [];
    const dfs = (m, g) => {
      const b = bounds(m);
      if (isGoal(b)) return true;
      if (g + lb(b) > limit) return false;
      if (round1(b.top * garment.t) > storage.h + 1e-9) return false; // 厚さは減らない
      const sig = canonical(m, b);
      if ((seen.get(sig) ?? Infinity) <= g) return false;
      seen.set(sig, g);
      for (const axis of ['x', 'y']) {
        const lo = axis === 'x' ? b.minX : b.minY;
        const hi = axis === 'x' ? b.maxX : b.maxY;
        for (let line = lo + 1; line <= hi; line++) {
          for (const side of [1, -1]) {
            const n = foldCounts(m, axis, line, side);
            if (!n) continue;
            path.push({ axis, line, side });
            if (dfs(n, g + 1)) return true;
            path.pop();
          }
        }
      }
      return false;
    };
    if (dfs(start, 0)) return { moves: limit, path: path.slice() };
  }
  return null;
}
