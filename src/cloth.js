// 布モデル。DOM に依存しないので node からもテストできる。
// cloth = { cells: Map<"x,y", Layer[]> }  Layer = { ox, oy, back }（配列は下→上）

export const CELL_CM = 2;

export const key = (x, y) => x + ',' + y;
export function parseKey(k) {
  const i = k.indexOf(',');
  return [Number(k.slice(0, i)), Number(k.slice(i + 1))];
}

export function createCloth(garment) {
  const cells = new Map();
  for (let y = 0; y < garment.h; y++) {
    for (let x = 0; x < garment.w; x++) {
      if (garment.mask(x, y)) cells.set(key(x, y), [{ ox: x, oy: y, back: false }]);
    }
  }
  return { cells };
}

export function bbox(cloth) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of cloth.cells.keys()) {
    const [x, y] = parseKey(k);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function maxLayers(cloth) {
  let m = 0;
  for (const s of cloth.cells.values()) if (s.length > m) m = s.length;
  return m;
}

const isMoving = (x, y, axis, line, side) => {
  const v = axis === 'x' ? x : y;
  return side > 0 ? v >= line : v < line;
};

// 折り線で布を「動く側」と「残る側」に分ける
export function partition(cloth, axis, line, side) {
  const moving = [];
  const staying = new Map();
  for (const [k, stack] of cloth.cells) {
    const [x, y] = parseKey(k);
    if (isMoving(x, y, axis, line, side)) moving.push([x, y, stack]);
    else staying.set(k, stack);
  }
  return { moving, staying };
}

// axis 'x': x = line の縦線で折る / 'y': y = line の横線で折る
// side +1: 座標 >= line の側を折り返す / -1: 座標 < line の側を折り返す
// 片側が空なら折れないので null を返す
export function fold(cloth, axis, line, side) {
  const { moving, staying } = partition(cloth, axis, line, side);
  if (moving.length === 0 || staying.size === 0) return null;
  const next = new Map();
  for (const [k, s] of staying) next.set(k, s.slice());
  for (const [x, y, stack] of moving) {
    const nx = axis === 'x' ? 2 * line - 1 - x : x;
    const ny = axis === 'y' ? 2 * line - 1 - y : y;
    const flipped = stack.slice().reverse().map((l) => ({ ...l, back: !l.back }));
    const k = key(nx, ny);
    const dest = next.get(k);
    next.set(k, dest ? dest.concat(flipped) : flipped);
  }
  return { cells: next };
}

function center(cloth) {
  const b = bbox(cloth);
  return [(b.minX + b.maxX + 1) / 2, (b.minY + b.maxY + 1) / 2];
}

export function translate(cloth, dx, dy) {
  if (!dx && !dy) return cloth;
  const cells = new Map();
  for (const [k, s] of cloth.cells) {
    const [x, y] = parseKey(k);
    cells.set(key(x + dx, y + dy), s);
  }
  return { cells };
}

// 変形後も外接矩形の中心がなるべく動かないように平行移動する
function keepCenter(before, after) {
  const [ax, ay] = center(before);
  const [bx, by] = center(after);
  return translate(after, Math.round(ax - bx), Math.round(ay - by));
}

// 画面上で時計回りに 90°（y は下向き）
export function rotateCloth(cloth) {
  const cells = new Map();
  for (const [k, s] of cloth.cells) {
    const [x, y] = parseKey(k);
    cells.set(key(-y - 1, x), s);
  }
  return keepCenter(cloth, { cells });
}

// 左右に裏返す
export function flipCloth(cloth) {
  const cells = new Map();
  for (const [k, s] of cloth.cells) {
    const [x, y] = parseKey(k);
    cells.set(key(-x - 1, y), s.slice().reverse().map((l) => ({ ...l, back: !l.back })));
  }
  return keepCenter(cloth, { cells });
}

export const RANKS = [
  { rank: 'PERFECT', maxSlack: 2 },
  { rank: 'GREAT', maxSlack: 6 },
  { rank: 'GOOD', maxSlack: 12 },
];

// storage = { w, d: セル数, h: 高さ cm }  thickness = 1 枚あたりの厚さ cm
export function evaluateFit(cloth, storage, thickness) {
  const b = bbox(cloth);
  const heightCm = round1(maxLayers(cloth) * thickness);
  const base = { w: b.w, d: b.h, heightCm };
  if (b.w > storage.w || b.h > storage.d) {
    const rotatedFits = b.h <= storage.w && b.w <= storage.d;
    return { ...base, ok: false, reason: 'overflow', rotatedFits };
  }
  if (heightCm > storage.h + 1e-9) return { ...base, ok: false, reason: 'thick' };
  const slackCm = ((storage.w - b.w) + (storage.d - b.h)) * CELL_CM;
  const r = RANKS.find((r) => slackCm <= r.maxSlack);
  if (!r) return { ...base, ok: false, reason: 'loose', slackCm };
  return { ...base, ok: true, rank: r.rank, slackCm };
}

export const round1 = (v) => Math.round(v * 10) / 10;
export const ceilHalf = (v) => Math.ceil(round1(v) * 2 - 1e-9) / 2;
