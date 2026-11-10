import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloth, fold, rotateCloth, flipCloth, bbox, maxLayers, evaluateFit, key } from '../src/cloth.js';
import { GARMENTS } from '../src/garments.js';

const rect = (w, h) => ({ w, h, mask: () => true });

test('fold in half halves the width and doubles layers', () => {
  const c = fold(createCloth(rect(6, 4)), 'x', 3, 1);
  const b = bbox(c);
  assert.equal(b.w, 3);
  assert.equal(b.h, 4);
  assert.equal(maxLayers(c), 2);
});

test('folded layer goes on top, reversed and face down', () => {
  const c = fold(createCloth(rect(4, 1)), 'x', 2, 1);
  const stack = c.cells.get(key(1, 0));
  assert.deepEqual(stack.map((l) => [l.ox, l.back]), [[1, false], [2, true]]);
  const stack0 = c.cells.get(key(0, 0));
  assert.deepEqual(stack0.map((l) => [l.ox, l.back]), [[0, false], [3, true]]);
});

test('folding an already folded stack reverses all of it', () => {
  let c = fold(createCloth(rect(4, 1)), 'x', 2, 1); // [0..1]
  c = fold(c, 'x', 1, -1); // x=0 を右へ
  const stack = c.cells.get(key(1, 0));
  assert.deepEqual(stack.map((l) => l.ox), [1, 2, 3, 0]);
  assert.equal(maxLayers(c), 4);
});

test('uneven fold sticks out past the line', () => {
  const c = fold(createCloth(rect(10, 1)), 'x', 3, 1); // 7 マスを左へ
  const b = bbox(c);
  assert.equal(b.minX, -4);
  assert.equal(b.maxX, 2);
});

test('fold with an empty side is rejected', () => {
  assert.equal(fold(createCloth(rect(4, 4)), 'x', 0, 1), null);
  assert.equal(fold(createCloth(rect(4, 4)), 'x', 9, 1), null);
});

test('rotate swaps dimensions, flip keeps them and turns the cloth over', () => {
  const c = createCloth(GARMENTS.pants);
  const r = rotateCloth(c);
  assert.equal(bbox(r).w, 50);
  assert.equal(bbox(r).h, 20);
  assert.equal(r.cells.size, c.cells.size);
  const f = flipCloth(c);
  assert.equal(bbox(f).w, 20);
  for (const s of f.cells.values()) assert.equal(s[0].back, true);
});

test('evaluateFit ranks', () => {
  const c = createCloth(rect(10, 10)); // 20x20cm, 0.1cm
  const box = (w, d, h = 1) => evaluateFit(c, { w, d, h }, 0.1);
  assert.equal(box(10, 10).rank, 'PERFECT');
  assert.equal(box(11, 10).rank, 'PERFECT');
  assert.equal(box(11, 11).rank, 'GREAT');
  assert.equal(box(13, 13).rank, 'GOOD');
  assert.equal(box(14, 14).reason, 'loose');
  assert.equal(box(9, 10).reason, 'overflow');
  assert.equal(box(10, 10, 0.05).reason, 'thick');
  const r = evaluateFit(createCloth(rect(4, 8)), { w: 8, d: 4, h: 1 }, 0.1);
  assert.equal(r.reason, 'overflow');
  assert.equal(r.rotatedFits, true);
});
