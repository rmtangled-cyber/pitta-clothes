// WebAudio で合成する効果音（音源ファイルなし）
let ac = null;
let muted = false;
let noiseBuf = null;

export function initAudio() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
  }
}

export const setMuted = (m) => { muted = m; };
export const isMuted = () => muted;

function ready() {
  return ac && !muted;
}

function noise(dur, freq, gain, q = 1.2) {
  if (!ready()) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq * 1.6, t);
  bp.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  bp.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function tone(freq, delay, dur, type = 'triangle', gain = 0.18, slideTo) {
  if (!ready()) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  fold: () => noise(0.16, 900, 0.6),
  flip: () => noise(0.12, 1500, 0.35),
  rotate: () => { tone(520, 0, 0.06, 'triangle', 0.12); tone(780, 0.05, 0.06, 'triangle', 0.1); },
  reset: () => noise(0.25, 500, 0.4, 0.7),
  perfect: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.3, 'triangle', 0.16)),
  great: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.25, 'triangle', 0.15)),
  good: () => [523, 659].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.14)),
  fail: () => { tone(220, 0, 0.18, 'square', 0.06, 180); tone(160, 0.14, 0.3, 'square', 0.06, 110); },
  tick: () => tone(1250, 0, 0.04, 'square', 0.04),
  end: () => [784, 659, 523, 392].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.15)),
  click: () => tone(880, 0, 0.04, 'triangle', 0.08),
};
