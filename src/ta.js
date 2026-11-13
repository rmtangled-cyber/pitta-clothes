// タイムアタックの出題。服にランダムな折りを適用した結果を収納サイズにするので必ず解ける。
import { GARMENTS } from './garments.js';
import { createCloth, fold, bbox, maxLayers, ceilHalf } from './cloth.js';

const POOL = ['hanky', 'faceTowel', 'faceTowel', 'tshirt', 'tshirt', 'pants', 'skirt', 'longShirt', 'bathTowel'];

export function generateRound(rand = Math.random) {
  const garment = GARMENTS[POOL[Math.floor(rand() * POOL.length)]];
  let cloth = createCloth(garment);
  const want = garment.id === 'hanky' ? 1 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 3);
  let done = 0;
  for (let tries = 0; done < want && tries < 40; tries++) {
    const b = bbox(cloth);
    const preferX = b.w >= b.h ? 0.7 : 0.3;
    const axis = rand() < preferX ? 'x' : 'y';
    const lo = axis === 'x' ? b.minX : b.minY;
    const n = axis === 'x' ? b.w : b.h;
    if (n < 8) continue;
    const line = lo + Math.round(n * (0.3 + 0.4 * rand()));
    const side = rand() < 0.5 ? 1 : -1;
    const next = fold(cloth, axis, line, side);
    if (!next) continue;
    const nb = bbox(next);
    if ((axis === 'x' ? nb.w : nb.h) >= n || nb.w < 4 || nb.h < 4) continue;
    cloth = next;
    done++;
  }
  const b = bbox(cloth);
  let storage = { w: b.w, d: b.h, h: ceilHalf(maxLayers(cloth) * garment.t) };
  if (rand() < 0.3 && storage.w !== storage.d) storage = { w: storage.d, d: storage.w, h: storage.h };
  return { garment, storage };
}
