import { makeSimGarment } from './simgarment.js';
import { GARMENT_COLORS } from './garment.js';
import { fleeceNormal, stitch } from '../core/textures.js';
import { hems } from './tshirt.js';

// Poche kangourou (coordonnées du patron, cm)
const PK = { top: 22, bottom: 1.2, xTop: 11, xBot: 16.5, yTurn: 11 };
const sideX = (y) => (y < PK.yTurn ? PK.xBot : PK.xTop + (PK.xBot - PK.xTop) * Math.sin(((PK.top - y) / (PK.top - PK.yTurn)) * Math.PI / 2));

function ribs(ctx, x0, x1, y0, y1, step = 0.32) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 0.08;
  for (let x = x0; x <= x1; x += step) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
  ctx.restore();
}

export default makeSimGarment({
  id: 'hoodie',
  name: 'Sweat à capuche',
  category: 'Textile',
  model: 'assets/models/hoodie.glb',
  colors: GARMENT_COLORS,
  defaultColor: '#2c4a36',
  knit: fleeceNormal,
  knitTile: 1.1,
  normalScale: 0.45,
  period: 9,
  options: [
    { id: 'cords', label: 'Cordons', type: 'segmented', default: 'match', choices: [{ value: 'match', label: 'Assortis' }, { value: 'contrast', label: 'Contrastés' }] },
  ],
  zones: [
    { id: 'front', label: 'Devant', side: 'front', cx: 0, cy: 38, w: 26, h: 24, main: true, hint: 'Au-dessus de la poche' },
    { id: 'chest', label: 'Cœur', side: 'front', cx: 10.5, cy: 49, w: 9, h: 9, hint: 'Petit logo côté cœur' },
    { id: 'back', label: 'Dos', side: 'back', cx: 0, cy: 36, w: 30, h: 38, hint: 'Grand visuel dos' },
    { id: 'sleeve', label: 'Manche', side: 'front', cx: 41, cy: 41, w: 24, h: 6, rot: -47, hint: 'Texte le long de la manche' },
  ],
  views: [
    { id: 'three', label: '3/4', az: 28, el: 8 },
    { id: 'front', label: 'Face', az: 0, el: 4 },
    { id: 'back', label: 'Dos', az: 180, el: 6 },
    { id: 'side', label: 'Profil', az: 90, el: 4 },
  ],
  decorate(ctx, side, state, meta) {
    const segs = side === 'front' ? meta.segsFront : meta.segsBack;
    // bord-côte du bas et des poignets
    ribs(ctx, -26, 26, -6.5, 0.5);
    stitch(ctx, [[-26, 0.4], [26, 0.4]], { width: 0.1, dash: [0.34, 0.24] });
    for (const n of ['cuff_r', 'cuff_l']) {
      const [a, b] = [segs[n][0], segs[n][segs[n].length - 1]];
      const dx = 0.682 * (n === 'cuff_r' ? 1 : -1), dy = -0.731;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0] - dx * 7, b[1] - dy * 7); ctx.lineTo(a[0] - dx * 7, a[1] - dy * 7); ctx.closePath();
      ctx.clip();
      ctx.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
      ribs(ctx, -8, 8, -9, 9, 0.3);
      ctx.restore();
      stitch(ctx, [[a[0] - dx * 7, a[1] - dy * 7], [b[0] - dx * 7, b[1] - dy * 7]], { width: 0.1, dash: [0.34, 0.24] });
    }
    hems(ctx, segs, ['neck_r', 'neck_l'], [0.7], [0, 0]);
    if (side !== 'front') return;
    const pts = [];
    for (let y = PK.top; y >= PK.bottom; y -= 0.4) pts.push([sideX(y), y]);
    const path = [[-PK.xTop, PK.top], [PK.xTop, PK.top], ...pts, [-PK.xBot, PK.bottom], ...pts.slice().reverse().map(([x, y]) => [-x, y])];
    ctx.save();
    ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.lineWidth = 0.35; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.stroke();
    ctx.restore();
    stitch(ctx, path.map(([x, y]) => [x * 0.985, y]), { width: 0.1, dash: [0.34, 0.24] });
    stitch(ctx, [[-PK.xTop + 0.5, PK.top - 0.6], [PK.xTop - 0.5, PK.top - 0.6]], { width: 0.1, dash: [0.34, 0.24] });
    for (const m of [1, -1]) {
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.1 - i * 0.015})`;
        ctx.lineWidth = 0.25 + i * 0.35;
        ctx.beginPath();
        pts.filter(([, y]) => y > PK.yTurn - 0.5).forEach(([x, y], k) => (k ? ctx.lineTo(m * (x + 0.15 + i * 0.12), y) : ctx.moveTo(m * (x + 0.15 + i * 0.12), y)));
        ctx.stroke();
      }
      ctx.restore();
    }
  },
});
