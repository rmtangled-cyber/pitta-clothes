// ベスト記録の保存（localStorage が使えない環境でも動くように）
const KEY = 'pitta-clothes-v1';

const empty = () => ({ stages: {}, ta: { score: 0, count: 0 }, muted: false });

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    return { ...empty(), ...d, ta: { ...empty().ta, ...(d.ta || {}) } };
  } catch {
    return empty();
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 保存できなくても遊べる */
  }
}
