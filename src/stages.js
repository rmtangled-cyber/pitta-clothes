// パズルステージ。収納サイズは「想定の折り方」から自動で計算する（必ず解ける）。
// par はソルバーで求めた最短手数（test/stages.test.mjs で検証）。
import { GARMENTS } from './garments.js';
import { createCloth, fold, bbox, maxLayers, ceilHalf } from './cloth.js';

const f = (axis, line, side) => ({ axis, line, side });

const DEFS = [
  { id: 'hanky-half', name: 'はじめての半分', garment: 'hanky', par: 1,
    hint: '布の端をつかんで、折りたい方へドラッグ！',
    folds: [f('y', 6, 1)] },
  { id: 'hanky-quarter', name: '四つ折り', garment: 'hanky', par: 2,
    hint: '縦にも横にも折れるよ。',
    folds: [f('y', 6, 1), f('x', 6, 1)] },
  { id: 'towel-thirds', name: '三つ折り', garment: 'faceTowel', par: 2,
    hint: '半分じゃない位置でも折れる。マス目（1マス2cm）を数えよう。',
    folds: [f('y', 14, -1), f('y', 28, 1)] },
  { id: 'towel-shelf', name: 'タオル棚', garment: 'faceTowel', par: 3,
    hint: '折りすぎると分厚くなって入らない！',
    folds: [f('y', 14, -1), f('y', 28, 1), f('x', 9, 1)] },
  { id: 'tee-sleeves', name: '袖をたたむ', garment: 'tshirt', par: 2,
    hint: '両わきを袖ごと内側へ。',
    folds: [f('x', 13, -1), f('x', 33, 1)] },
  { id: 'skirt', name: 'スカート', garment: 'skirt', par: 2,
    hint: '台形は一番広いところで測ろう。',
    folds: [f('x', 15, 1), f('y', 13, 1)] },
  { id: 'tee-classic', name: 'Tシャツ定番', garment: 'tshirt', par: 3,
    hint: '両わきを袖ごと折って、最後に半分。',
    folds: [f('x', 15, -1), f('x', 31, 1), f('y', 17, 1)] },
  { id: 'pants', name: 'ズボン', garment: 'pants', par: 3,
    hint: '縦半分にしてから、たけを三つ折り。',
    folds: [f('x', 10, 1), f('y', 17, -1), f('y', 34, 1)] },
  { id: 'bath-towel', name: 'バスタオル', garment: 'bathTowel', par: 4,
    hint: '大きな布も手順は同じ。',
    folds: [f('x', 10, -1), f('x', 20, 1), f('y', 30, 1), f('y', 15, 1)] },
  { id: 'pants-wide', name: '横長の引き出し', garment: 'pants', par: 3, rotateStorage: true,
    hint: '向きが合わない？ 回転ボタン（R）を使おう。',
    folds: [f('x', 10, 1), f('y', 25, 1), f('y', 13, 1)] },
  { id: 'tee-compact', name: '小さな引き出し', garment: 'tshirt', par: 4,
    hint: '1マスのずれも見逃さないで。',
    folds: [f('x', 20, -1), f('x', 33, 1), f('y', 12, -1), f('y', 24, 1)] },
  { id: 'long-shirt', name: '長袖シャツ', garment: 'longShirt', par: 4,
    hint: '長い袖をどう処理する？',
    folds: [f('x', 18, -1), f('x', 44, 1), f('x', 25, -1), f('x', 37, 1), f('y', 18, 1)] },
];

export function storageFromFolds(garment, folds) {
  let c = createCloth(garment);
  for (const s of folds) {
    c = fold(c, s.axis, s.line, s.side);
    if (!c) throw new Error('invalid fold in stage definition');
  }
  const b = bbox(c);
  return { w: b.w, d: b.h, h: ceilHalf(maxLayers(c) * garment.t) };
}

export const STAGES = DEFS.map((d) => {
  const garment = GARMENTS[d.garment];
  let storage = storageFromFolds(garment, d.folds);
  if (d.rotateStorage) storage = { w: storage.d, d: storage.w, h: storage.h };
  return { ...d, garment, storage };
});
