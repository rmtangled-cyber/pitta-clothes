import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/stages.js';
import { solve } from '../src/solver.js';
import { generateRound } from '../src/ta.js';
import { createCloth, fold, evaluateFit } from '../src/cloth.js';

for (const s of STAGES) {
  test(`stage ${s.id}: intended folds are PERFECT and par is the true minimum`, () => {
    let c = createCloth(s.garment);
    for (const f of s.folds) c = fold(c, f.axis, f.line, f.side);
    if (s.rotateStorage) {
      const r = evaluateFit(c, s.storage, s.garment.t);
      assert.equal(r.rotatedFits, true);
    } else {
      assert.equal(evaluateFit(c, s.storage, s.garment.t).rank, 'PERFECT');
    }
    const sol = solve(s.garment, s.storage, s.par);
    assert.ok(sol, 'solvable within par');
    assert.equal(sol.moves, s.par);
  });
}

test('time attack rounds are reasonable', () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const { garment, storage } = generateRound(rand);
    assert.ok(storage.w >= 4 && storage.d >= 4, garment.id);
    assert.ok(storage.h > 0);
  }
});
