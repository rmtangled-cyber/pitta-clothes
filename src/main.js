import { GARMENTS } from './garments.js';
import {
  createCloth, fold, partition, rotateCloth, flipCloth, bbox, maxLayers, evaluateFit, round1, CELL_CM,
} from './cloth.js';
import { STAGES } from './stages.js';
import { generateRound } from './ta.js';
import { sfx, initAudio, setMuted, isMuted } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { drawMat, drawCloth, drawFoldingPart, drawFoldLine, drawStorage } from './render.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#board');
const ctx = canvas.getContext('2d');

const TA_SECONDS = 90;
const TA_POINTS = { PERFECT: 300, GREAT: 200, GOOD: 100 };
const TA_BONUS = { PERFECT: 5, GREAT: 2, GOOD: 0 };
const BASE_STARS = { PERFECT: 3, GREAT: 2, GOOD: 1 };

let save = loadSave();
setMuted(!!save.muted);

let S = null; // 現在のゲーム状態
const cam = { x: 0, y: 0 };

// ---------- 画面遷移 ----------
const screens = { title: $('#screen-title'), stages: $('#screen-stages'), game: $('#screen-game') };
function show(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
  if (name !== 'game') S = null;
  if (name === 'title') updateTitle();
  if (name === 'stages') renderStageList();
  closeModal();
}

const totalStars = () => STAGES.reduce((a, s) => a + (save.stages[s.id]?.stars || 0), 0);
const starsHtml = (n) => '★'.repeat(n) + `<span class="off">${'★'.repeat(3 - n)}</span>`;

function updateTitle() {
  let t = `★ ${totalStars()} / ${STAGES.length * 3}`;
  if (save.ta.score) t += `　TAベスト ${save.ta.score}点（${save.ta.count}枚）`;
  $('#title-best').textContent = t;
  $('#btn-sound').textContent = isMuted() ? '🔇 効果音 OFF' : '🔊 効果音 ON';
}

function renderStageList() {
  const list = $('#stage-list');
  list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const rec = save.stages[st.id];
    const unlocked = i === 0 || !!save.stages[STAGES[i - 1].id];
    const b = document.createElement('button');
    b.className = 'btn stage-btn';
    b.disabled = !unlocked;
    b.innerHTML =
      `<span class="no">STAGE ${i + 1}</span>` +
      `<span class="nm">${unlocked ? st.name : '？？？'}</span>` +
      `<span class="gm">${unlocked ? st.garment.name : '🔒'}${rec ? `　最少 ${rec.best}手` : ''}</span>` +
      `<span class="stars">${starsHtml(rec?.stars || 0)}</span>`;
    b.onclick = () => { sfx.click(); startPuzzle(i); };
    list.appendChild(b);
  });
  $('#star-total').textContent = `★ ${totalStars()}`;
}

// ---------- ゲーム開始 ----------
function beginRound(garment, storage) {
  const cloth = createCloth(garment);
  Object.assign(S, {
    garment, storage, initial: cloth, cloth, moves: 0,
    drag: null, anim: null, stored: null, shake: 0,
  });
  $('#rank').className = 'rank';
  const b = bbox(cloth);
  cam.x = (b.minX + b.maxX + 1) / 2;
  cam.y = (b.minY + b.maxY + 1) / 2;
}

function startPuzzle(i) {
  const stage = STAGES[i];
  show('game');
  S = { mode: 'puzzle', index: i, stage };
  beginRound(stage.garment, stage.storage);
  $('#game-title').textContent = `${i + 1}. ${stage.name}`;
  $('#btn-skip').classList.add('hidden');
  toast(stage.hint, 4000);
}

function startTA() {
  show('game');
  S = { mode: 'ta', ta: { time: TA_SECONDS, score: 0, count: 0, lastTick: TA_SECONDS }, over: false };
  $('#btn-skip').classList.remove('hidden');
  nextTARound();
  toast('90秒で何枚しまえる？', 2500);
}

function nextTARound() {
  const r = generateRound();
  beginRound(r.garment, r.storage);
  $('#game-title').textContent = `TA：${r.garment.name}`;
}

// ---------- 操作 ----------
const canAct = () => S && !S.anim && !S.stored && !S.over && !modalOpen();

function foldSpec(p, q) {
  const dx = q.x - p.x, dy = q.y - p.y;
  if (Math.hypot(dx, dy) < 0.8) return null;
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  const pa = axis === 'x' ? p.x : p.y;
  const qa = axis === 'x' ? q.x : q.y;
  const line = Math.round((pa + qa) / 2);
  const side = pa >= line ? 1 : -1;
  const result = fold(S.cloth, axis, line, side);
  if (!result) return null;
  return { axis, line, side, result };
}

function startFold(spec) {
  const { moving, staying } = partition(S.cloth, spec.axis, spec.line, spec.side);
  S.anim = { type: 'fold', t0: performance.now(), dur: 300, spec, moving, staying: { cells: staying } };
  sfx.fold();
}

function doRotate() {
  if (!canAct()) return;
  S.anim = { type: 'rotate', t0: performance.now(), dur: 180, from: S.cloth, result: rotateCloth(S.cloth) };
  sfx.rotate();
}

function doFlip() {
  if (!canAct()) return;
  S.anim = { type: 'flip', t0: performance.now(), dur: 260, from: S.cloth, result: flipCloth(S.cloth) };
  sfx.flip();
}

function doReset() {
  if (!canAct()) return;
  S.cloth = S.initial;
  S.moves = 0;
  sfx.reset();
}

function doSkip() {
  if (!canAct() || S.mode !== 'ta') return;
  S.ta.time = Math.max(0, S.ta.time - 5);
  toast('スキップ −5秒');
  nextTARound();
}

function tryStore() {
  if (!canAct()) return;
  const fit = evaluateFit(S.cloth, S.storage, S.garment.t);
  if (!fit.ok) {
    sfx.fail();
    S.shake = performance.now();
    let msg;
    if (fit.reason === 'overflow') msg = fit.rotatedFits ? 'はみ出してる！ 回転すると入るかも？' : 'はみ出してる！';
    else if (fit.reason === 'thick') msg = `分厚すぎて入らない！（厚さ ${fit.heightCm}cm）`;
    else msg = `ゆるすぎる…（すき間 ${fit.slackCm}cm）`;
    if (S.mode === 'ta') {
      S.ta.time = Math.max(0, S.ta.time - 2);
      msg += '　−2秒';
    }
    toast(msg);
    return;
  }
  S.anim = { type: 'store', t0: performance.now(), dur: 450, fit };
}

function onStored(fit) {
  const rank = fit.rank;
  sfx[rank.toLowerCase()]();
  rankPop(rank);
  const token = S;
  if (S.mode === 'puzzle') {
    const { stage, index } = S;
    const base = BASE_STARS[rank];
    const stars = S.moves > stage.par ? Math.max(1, base - 1) : base;
    const prev = save.stages[stage.id];
    save.stages[stage.id] = {
      stars: Math.max(stars, prev?.stars || 0),
      best: Math.min(S.moves, prev?.best ?? Infinity),
    };
    writeSave(save);
    const moves = S.moves;
    setTimeout(() => {
      if (S !== token) return;
      let note = '';
      if (stars < 3) {
        note = rank !== 'PERFECT'
          ? '<br>すき間 2cm 以内で PERFECT！'
          : `<br>${stage.par}手でできるかな？`;
      }
      const buttons = [];
      if (index < STAGES.length - 1) buttons.push({ label: '次のステージ', cls: 'primary', on: () => startPuzzle(index + 1) });
      buttons.push({ label: 'もう一度', cls: index < STAGES.length - 1 ? '' : 'primary', on: () => startPuzzle(index) });
      buttons.push({ label: 'ステージをえらぶ', cls: 'ghost', on: () => show('stages') });
      openModal(
        index === STAGES.length - 1 && stars === 3 ? '全クリア！' : 'しまえた！',
        `<div class="big-stars stars">${starsHtml(stars)}</div>` +
          `<strong>${rank}</strong>　手数 <strong>${moves}</strong>（目安 ${stage.par}）` +
          `<br>すき間 ${fit.slackCm}cm／厚さ ${fit.heightCm}cm${note}`,
        buttons,
      );
    }, 950);
  } else {
    const pts = TA_POINTS[rank];
    const bonus = TA_BONUS[rank];
    S.ta.score += pts;
    S.ta.count += 1;
    S.ta.time += bonus;
    toast(`+${pts}点${bonus ? `　+${bonus}秒` : ''}`, 900);
    setTimeout(() => {
      if (S === token && !S.over) nextTARound();
    }, 900);
  }
}

function endTA() {
  S.over = true;
  S.drag = null;
  sfx.end();
  const { score, count } = S.ta;
  const isBest = score > (save.ta.score || 0);
  if (isBest) save.ta = { score, count };
  else if (count > (save.ta.count || 0)) save.ta.count = count;
  writeSave(save);
  openModal(
    'タイムアップ！',
    `<strong style="font-size:2rem">${score}</strong> 点${isBest ? '　🎉 NEW!' : ''}` +
      `<br>しまった服 <strong>${count}</strong> 枚` +
      `<br>ベスト ${save.ta.score}点`,
    [
      { label: 'もう一度', cls: 'primary', on: () => startTA() },
      { label: 'タイトルへ', cls: 'ghost', on: () => show('title') },
    ],
  );
}

// ---------- UI 部品 ----------
let toastTimer = 0;
function toast(msg, ms = 1800) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function rankPop(rank) {
  const el = $('#rank');
  el.className = 'rank';
  void el.offsetWidth;
  el.textContent = rank;
  el.className = `rank show ${rank}`;
}

const modalOpen = () => !$('#modal').classList.contains('hidden');
function openModal(title, html, buttons) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  const box = $('#modal-buttons');
  box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = `btn ${b.cls || ''}`;
    el.textContent = b.label;
    el.onclick = () => { sfx.click(); closeModal(); b.on(); };
    box.appendChild(el);
  }
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  $('#modal').classList.add('hidden');
}

// ---------- 入力 ----------
function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  const v = S.view;
  return { x: (e.clientX - r.left - v.ox) / v.cs, y: (e.clientY - r.top - v.oy) / v.cs };
}

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (!canAct() || !S.view || S.drag) return;
  const p = toWorld(e);
  const b = bbox(S.cloth);
  if (p.x < b.minX - 1.5 || p.x > b.maxX + 2.5 || p.y < b.minY - 1.5 || p.y > b.maxY + 2.5) return;
  S.drag = { p, spec: null, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  if (!S?.drag || e.pointerId !== S.drag.id) return;
  S.drag.spec = foldSpec(S.drag.p, toWorld(e));
});
function endDrag(e, commit) {
  if (!S?.drag || e.pointerId !== S.drag.id) return;
  const spec = S.drag.spec;
  S.drag = null;
  canvas.classList.remove('dragging');
  if (commit && spec && canAct()) startFold(spec);
}
canvas.addEventListener('pointerup', (e) => endDrag(e, true));
canvas.addEventListener('pointercancel', (e) => endDrag(e, false));

$('#btn-puzzle').onclick = () => { initAudio(); sfx.click(); show('stages'); };
$('#btn-ta').onclick = () => { initAudio(); sfx.click(); startTA(); };
$('#btn-sound').onclick = () => {
  initAudio();
  setMuted(!isMuted());
  save.muted = isMuted();
  writeSave(save);
  updateTitle();
  sfx.click();
};
document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => show(b.dataset.back); });
function goBack() {
  if (!S) return;
  show(S.mode === 'puzzle' ? 'stages' : 'title');
}
$('#btn-back').onclick = goBack;
$('#btn-rotate').onclick = doRotate;
$('#btn-flip').onclick = doFlip;
$('#btn-reset').onclick = doReset;
$('#btn-skip').onclick = doSkip;
$('#btn-store').onclick = tryStore;

window.addEventListener('keydown', (e) => {
  if (!S || modalOpen()) return;
  const k = e.key.toLowerCase();
  if (k === 'r') doRotate();
  else if (k === 'f') doFlip();
  else if (k === 'backspace') { e.preventDefault(); doReset(); }
  else if (k === 'enter' || k === ' ') { e.preventDefault(); tryStore(); }
  else if (k === 'escape') goBack();
});

// ---------- ループ ----------
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function update(now, dt) {
  const a = S.anim;
  if (a && now - a.t0 >= a.dur) {
    S.anim = null;
    if (a.type === 'fold') {
      S.cloth = a.spec.result;
      S.moves += 1;
    } else if (a.type === 'rotate' || a.type === 'flip') {
      S.cloth = a.result;
    } else if (a.type === 'store') {
      S.stored = a.fit;
      onStored(a.fit);
    }
  }
  if (!S.drag && !S.anim && !S.stored) {
    const b = bbox(S.cloth);
    const k = Math.min(1, dt * 7);
    cam.x += ((b.minX + b.maxX + 1) / 2 - cam.x) * k;
    cam.y += ((b.minY + b.maxY + 1) / 2 - cam.y) * k;
  }
  if (S.mode === 'ta' && !S.over && !modalOpen() && S.anim?.type !== 'store') {
    S.ta.time -= dt;
    const sec = Math.ceil(S.ta.time);
    if (sec < S.ta.lastTick) {
      S.ta.lastTick = sec;
      if (sec <= 10 && sec > 0) sfx.tick();
    }
    if (S.ta.time <= 0) {
      S.ta.time = 0;
      S.anim = null;
      endTA();
    }
  }
}

function layout() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  let main, panel;
  if (W >= H * 1.05) {
    const pw = Math.round(Math.max(170, W * 0.32));
    main = { x: 0, y: 0, w: W - pw, h: H };
    panel = { x: W - pw, y: 0, w: pw, h: H };
  } else {
    const ph = Math.round(Math.max(150, H * 0.32));
    main = { x: 0, y: 0, w: W, h: H - ph };
    panel = { x: 0, y: H - ph, w: W, h: ph };
  }
  const g = S.garment, st = S.storage;
  const M = Math.max(g.w, g.h);
  const cs = Math.max(2, Math.min(main.w / (M + 4), main.h / (M + 4), panel.w / (st.w + 4), (panel.h - 40) / (st.d + 3)));
  return { W, H, main, panel, cs };
}

function updateHud() {
  const st = S.storage;
  const shown = S.drag?.spec ? S.drag.spec.result : S.cloth;
  const b = bbox(shown);
  const h = round1(maxLayers(shown) * S.garment.t);
  const cls = (ok) => (ok ? 'ok' : 'ng');
  const cur =
    `<span class="${cls(b.w <= st.w)}">${b.w * CELL_CM}</span>×` +
    `<span class="${cls(b.h <= st.d)}">${b.h * CELL_CM}</span>cm　厚さ ` +
    `<span class="${cls(h <= st.h)}">${h}</span>cm`;
  const box = `${st.w * CELL_CM}×${st.d * CELL_CM}cm　高さ ${st.h}cm`;
  let info, warn = false;
  if (S.mode === 'puzzle') info = `手数 ${S.moves}／目安 ${S.stage.par}`;
  else {
    info = `⏱ ${Math.ceil(S.ta.time)}　${S.ta.score}点`;
    warn = S.ta.time <= 10;
  }
  const sig = cur + box + info + warn;
  if (sig === S.hudSig) return;
  S.hudSig = sig;
  $('#cur-size').innerHTML = cur;
  $('#box-size').textContent = box;
  const pill = $('#game-info');
  pill.textContent = info;
  pill.classList.toggle('warn', warn);
}

function draw(now) {
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.round(canvas.clientWidth * dpr), ch = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const L = layout();
  const { main, panel, cs } = L;
  let ox = main.x + main.w / 2 - cam.x * cs;
  const oy = main.y + main.h / 2 - cam.y * cs;
  S.view = { ox, oy, cs };

  ctx.clearRect(0, 0, L.W, L.H);
  drawMat(ctx, main, ox, oy, cs);

  // 収納パネル
  ctx.fillStyle = '#f3e6d3';
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.fillStyle = '#ead9c4';
  if (panel.x > 0) ctx.fillRect(panel.x, panel.y, 2, panel.h);
  else ctx.fillRect(panel.x, panel.y, panel.w, 2);
  const st = S.storage;
  const bw = st.w * cs, bh = st.d * cs;
  const box = { x: panel.x + (panel.w - bw) / 2, y: panel.y + 34 + (panel.h - 34 - bh) / 2, w: bw, h: bh };
  ctx.fillStyle = '#8a7a82';
  ctx.font = '800 13px "M PLUS Rounded 1c", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`収納  ${st.w * CELL_CM} × ${st.d * CELL_CM} cm`, panel.x + panel.w / 2, panel.y + 22);
  drawStorage(ctx, box, !!S.stored);

  // 収納先での原点（布の外接矩形を箱の中央に）
  const storedOrigin = (cloth) => {
    const b = bbox(cloth);
    return [box.x + (bw - b.w * cs) / 2 - b.minX * cs, box.y + (bh - b.h * cs) / 2 - b.minY * cs];
  };

  if (S.shake) {
    const t = (now - S.shake) / 350;
    if (t >= 1) S.shake = 0;
    else ox += Math.sin(t * 30) * cs * 0.6 * (1 - t);
  }

  const a = S.anim;
  const g = S.garment;
  if (S.stored) {
    const [sx, sy] = storedOrigin(S.cloth);
    drawCloth(ctx, S.cloth, g, sx, sy, cs, { shadow: false });
  } else if (a?.type === 'store') {
    const t = ease(Math.min(1, (now - a.t0) / a.dur));
    const [sx, sy] = storedOrigin(S.cloth);
    drawCloth(ctx, S.cloth, g, ox + (sx - ox) * t, oy + (sy - oy) * t, cs, { shadow: t < 0.9 });
  } else if (a?.type === 'fold') {
    const t = ease(Math.min(1, (now - a.t0) / a.dur));
    drawCloth(ctx, a.staying, g, ox, oy, cs);
    drawFoldingPart(ctx, a.moving, g, a.spec, t, ox, oy, cs);
  } else if (a?.type === 'rotate' || a?.type === 'flip') {
    const t = ease(Math.min(1, (now - a.t0) / a.dur));
    const b = bbox(a.from);
    const cx = ox + ((b.minX + b.maxX + 1) / 2) * cs, cy = oy + ((b.minY + b.maxY + 1) / 2) * cs;
    ctx.save();
    ctx.translate(cx, cy);
    let target = a.from;
    if (a.type === 'rotate') ctx.rotate((t * Math.PI) / 2);
    else {
      const c = Math.cos(t * Math.PI);
      ctx.scale(Math.max(0.02, Math.abs(c)), 1);
      if (c < 0) target = a.result;
    }
    ctx.translate(-cx, -cy);
    drawCloth(ctx, target, g, ox, oy, cs);
    ctx.restore();
  } else if (S.drag?.spec) {
    const spec = S.drag.spec;
    drawCloth(ctx, S.cloth, g, ox, oy, cs, { alpha: 0.3, shadow: false, outline: false });
    drawCloth(ctx, spec.result, g, ox, oy, cs, { alpha: 0.92 });
    drawFoldLine(ctx, spec, bbox(S.cloth), ox, oy, cs);
  } else {
    drawCloth(ctx, S.cloth, g, ox, oy, cs);
  }

  updateHud();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S) {
    update(now, dt);
    if (S) draw(now);
  }
  requestAnimationFrame(frame);
}

updateTitle();
requestAnimationFrame(frame);

// デバッグ／自動テスト用
window.__pitta = { get state() { return S; }, GARMENTS, STAGES };
