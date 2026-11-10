// Canvas 描画。座標系: スクリーン = origin + ワールド(セル) * cs
import { parseKey, key, CELL_CM } from './cloth.js';

export const INK = '#4a3b45';

const hexToRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// レイヤーの色（裏地は白っぽく、重なるほど少し暗く）
export function layerColor(garment, layer, count = 1, lift = 0) {
  const cache = garment._cache || (garment._cache = new Map());
  const k = `${layer.ox},${layer.oy},${layer.back ? 1 : 0},${count},${Math.round(lift * 10)}`;
  let c = cache.get(k);
  if (!c) {
    let base = hexToRgb(garment.pattern(layer.ox, layer.oy, layer.back));
    if (layer.back) base = mix(base, [255, 255, 255], 0.35);
    base = mix(base, [40, 25, 35], Math.min(0.32, (count - 1) * 0.055));
    if (lift > 0) base = mix(base, [255, 255, 255], lift);
    c = rgb(base);
    cache.set(k, c);
  }
  return c;
}

// カッティングマット風の背景（1 マス 2cm、10cm ごとに太線）
export function drawMat(ctx, area, originX, originY, cs) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  ctx.fillStyle = '#e9f0e4';
  ctx.fillRect(area.x, area.y, area.w, area.h);
  const x0 = Math.floor((area.x - originX) / cs), x1 = Math.ceil((area.x + area.w - originX) / cs);
  const y0 = Math.floor((area.y - originY) / cs), y1 = Math.ceil((area.y + area.h - originY) / cs);
  const major = 10 / CELL_CM;
  for (const strong of [false, true]) {
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) {
      if ((((x % major) + major) % major === 0) !== strong) continue;
      const sx = Math.round(originX + x * cs) + 0.5;
      ctx.moveTo(sx, area.y);
      ctx.lineTo(sx, area.y + area.h);
    }
    for (let y = y0; y <= y1; y++) {
      if ((((y % major) + major) % major === 0) !== strong) continue;
      const sy = Math.round(originY + y * cs) + 0.5;
      ctx.moveTo(area.x, sy);
      ctx.lineTo(area.x + area.w, sy);
    }
    ctx.strokeStyle = strong ? 'rgba(80,120,90,0.32)' : 'rgba(80,120,90,0.13)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCloth(ctx, cloth, garment, originX, originY, cs, opts = {}) {
  const { alpha = 1, shadow = true, outline = true } = opts;
  const cells = cloth.cells;
  ctx.save();
  ctx.globalAlpha = alpha;
  const pad = 0.6;
  if (shadow) {
    ctx.fillStyle = 'rgba(40,30,40,0.16)';
    const off = Math.max(2, cs * 0.35);
    for (const k of cells.keys()) {
      const [x, y] = parseKey(k);
      ctx.fillRect(originX + x * cs + off, originY + y * cs + off, cs + pad, cs + pad);
    }
  }
  for (const [k, stack] of cells) {
    const [x, y] = parseKey(k);
    ctx.fillStyle = layerColor(garment, stack[stack.length - 1], stack.length);
    ctx.fillRect(originX + x * cs, originY + y * cs, cs + pad, cs + pad);
  }
  if (outline) {
    const edge = new Path2D();
    const crease = new Path2D();
    for (const [k, stack] of cells) {
      const [x, y] = parseKey(k);
      const top = stack[stack.length - 1];
      const sx = originX + x * cs, sy = originY + y * cs;
      const sides = [
        [x + 1, y, sx + cs, sy, sx + cs, sy + cs],
        [x, y + 1, sx, sy + cs, sx + cs, sy + cs],
        [x - 1, y, sx, sy, sx, sy + cs],
        [x, y - 1, sx, sy, sx + cs, sy],
      ];
      sides.forEach(([nx, ny, ax, ay, bx, by], i) => {
        const n = cells.get(key(nx, ny));
        if (!n) {
          edge.moveTo(ax, ay);
          edge.lineTo(bx, by);
        } else if (i < 2) {
          const t2 = n[n.length - 1];
          const adjacent = Math.abs(t2.ox - top.ox) + Math.abs(t2.oy - top.oy) === 1 && t2.back === top.back;
          if (!adjacent || Math.abs(n.length - stack.length) > 0) {
            crease.moveTo(ax, ay);
            crease.lineTo(bx, by);
          }
        }
      });
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(74,59,69,0.35)';
    ctx.lineWidth = Math.max(1, cs * 0.1);
    ctx.stroke(crease);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, cs * 0.2);
    ctx.stroke(edge);
  }
  ctx.restore();
}

// 折っている途中の布（moving = [[x, y, stack], ...]）
export function drawFoldingPart(ctx, moving, garment, spec, progress, originX, originY, cs) {
  const ang = Math.PI * progress;
  const c = Math.cos(ang);
  const lift = Math.sin(ang) * 0.18;
  const size = Math.max(0.5, Math.abs(c) * cs);
  ctx.save();
  // 持ち上がった布の影
  ctx.fillStyle = `rgba(40,30,40,${0.1 + 0.12 * Math.sin(ang)})`;
  const so = cs * (0.4 + Math.sin(ang) * 1.2);
  const rects = [];
  for (const [x, y, stack] of moving) {
    const layer = c >= 0 ? stack[stack.length - 1] : { ...stack[0], back: !stack[0].back };
    let rx, ry, rw, rh;
    if (spec.axis === 'x') {
      const nc = spec.line + (x + 0.5 - spec.line) * c;
      rx = originX + nc * cs - size / 2; ry = originY + y * cs; rw = size; rh = cs;
    } else {
      const nc = spec.line + (y + 0.5 - spec.line) * c;
      rx = originX + x * cs; ry = originY + nc * cs - size / 2; rw = cs; rh = size;
    }
    rects.push([rx, ry, rw, rh, layerColor(garment, layer, stack.length, lift)]);
    ctx.fillRect(rx + so, ry + so, rw + 0.6, rh + 0.6);
  }
  for (const [rx, ry, rw, rh, col] of rects) {
    ctx.fillStyle = col;
    ctx.fillRect(rx, ry, rw + 0.6, rh + 0.6);
  }
  ctx.restore();
}

export function drawFoldLine(ctx, spec, b, originX, originY, cs) {
  ctx.save();
  ctx.setLineDash([cs * 0.8, cs * 0.5]);
  ctx.strokeStyle = '#e0457b';
  ctx.lineWidth = Math.max(2, cs * 0.22);
  ctx.beginPath();
  if (spec.axis === 'x') {
    const sx = originX + spec.line * cs;
    ctx.moveTo(sx, originY + (b.minY - 2) * cs);
    ctx.lineTo(sx, originY + (b.maxY + 3) * cs);
  } else {
    const sy = originY + spec.line * cs;
    ctx.moveTo(originX + (b.minX - 2) * cs, sy);
    ctx.lineTo(originX + (b.maxX + 3) * cs, sy);
  }
  ctx.stroke();
  ctx.restore();
}

// 収納（引き出し）
export function drawStorage(ctx, rect, highlight) {
  const fw = Math.max(5, Math.min(14, rect.w * 0.06));
  ctx.save();
  ctx.fillStyle = 'rgba(40,30,40,0.18)';
  roundRect(ctx, rect.x - fw + 4, rect.y - fw + 6, rect.w + fw * 2, rect.h + fw * 2, fw);
  ctx.fill();
  ctx.fillStyle = '#c28f5c';
  roundRect(ctx, rect.x - fw, rect.y - fw, rect.w + fw * 2, rect.h + fw * 2, fw);
  ctx.fill();
  ctx.fillStyle = '#9c6c3f';
  ctx.fillRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
  ctx.fillStyle = highlight ? '#fff7d6' : '#f8efdf';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = 'rgba(156,108,63,0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rect.x + 0.75, rect.y + 0.75, rect.w - 1.5, rect.h - 1.5);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
