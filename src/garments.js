// 服の形（1 マス = 2cm）と柄。
// pattern(x, y, back) は元の座標の色を返す。back=true のときは裏地（プリントなし）。

const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

export const GARMENTS = {
  hanky: {
    id: 'hanky', name: 'ハンカチ', w: 12, h: 12, t: 0.1,
    mask: () => true,
    pattern(x, y) {
      if (x === 0 || y === 0 || x === 11 || y === 11) return '#e0708a';
      return ((x >> 1) + (y >> 1)) % 2 ? '#fbd3dc' : '#f7b9c8';
    },
  },

  faceTowel: {
    id: 'faceTowel', name: 'フェイスタオル', w: 18, h: 42, t: 0.3,
    mask: () => true,
    pattern(x, y) {
      if (y === 0 || y === 41) return '#6fb3d9';
      if (y === 3 || y === 4 || y === 37 || y === 38) return '#ffffff';
      return '#8cc8e8';
    },
  },

  bathTowel: {
    id: 'bathTowel', name: 'バスタオル', w: 30, h: 60, t: 0.5,
    mask: () => true,
    pattern(x, y) {
      if (y === 0 || y === 59) return '#e2b65a';
      if ((y >= 5 && y <= 7) || (y >= 52 && y <= 54)) return '#e8a948';
      if (y === 9 || y === 50) return '#fff6dc';
      return '#f6d77a';
    },
  },

  tshirt: {
    id: 'tshirt', name: 'Tシャツ', w: 46, h: 34, t: 0.4,
    mask(x, y) {
      if (y <= 1 && x >= 19 && x <= 26) return false; // 首まわり
      if (x >= 10 && x <= 35) return true; // 胴
      return y <= 9; // 袖
    },
    pattern(x, y, back) {
      const rib = '#d4673c';
      if ((x === 0 || x === 45) && y <= 9) return rib; // 袖口
      if (y >= 32) return rib; // 裾
      if (y <= 2 && x >= 18 && x <= 27) return rib; // 首のリブ
      if (!back) {
        const d = Math.hypot(x + 0.5 - 23, y + 0.5 - 13);
        if (d < 2.2) return '#f6c945';
        if (d < 4.6) return '#fff3c4';
      }
      return '#f08a5d';
    },
  },

  longShirt: {
    id: 'longShirt', name: '長袖シャツ', w: 62, h: 36, t: 0.3,
    mask(x, y) {
      if (y <= 1 && x >= 27 && x <= 34) return false; // 襟元
      if (x >= 18 && x <= 43) return true;
      return y <= 7;
    },
    pattern(x, y, back) {
      if ((x <= 1 || x >= 60) && y <= 7) return '#9fb9de'; // カフス
      if (y <= 2 && x >= 25 && x <= 36) return '#ffffff'; // 襟
      if (!back && (x === 30 || x === 31)) {
        if (x === 30 && y % 5 === 3) return '#7d93b3'; // ボタン
        return '#f4f8fd'; // 前立て
      }
      return x % 4 === 0 ? '#a9c4e8' : '#dbe8f7';
    },
  },

  pants: {
    id: 'pants', name: 'ズボン', w: 20, h: 50, t: 0.6,
    mask(x, y) {
      if (y <= 14) return true;
      return x <= 8 || x >= 11;
    },
    pattern(x, y, back) {
      if (y <= 1) return '#3b5a89'; // ウエスト
      if (y >= 47) return '#3d5d8c'; // 裾
      if (!back) {
        if ((x === 9 || x === 10) && y <= 10) return '#3d5d8c'; // 前あき
        if (inRect(x, y, 1, 3, 4, 6) && !inRect(x, y, 2, 3, 3, 5)) return '#d9a441'; // ポケットのステッチ
        if (inRect(x, y, 15, 3, 18, 6) && !inRect(x, y, 16, 3, 17, 5)) return '#d9a441';
      }
      return '#4a6fa5';
    },
  },

  skirt: {
    id: 'skirt', name: 'スカート', w: 30, h: 25, t: 0.4,
    mask(x, y) {
      const half = 10 + Math.round((y * 5) / 24);
      return x >= 15 - half && x <= 14 + half;
    },
    pattern(x, y) {
      if (y <= 1) return '#4f8a66';
      return x % 3 === 0 ? '#5a9e75' : '#6fb58a';
    },
  },
};
