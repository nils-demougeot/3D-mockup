import { makeSimGarment } from './simgarment.js';
import { GARMENT_COLORS } from './garment.js';
import { piqueNormal, stitch } from '../core/textures.js';
import { hems, inset } from './tshirt.js';

const PL = { w: 1.7, top: 65.5, bottom: 50.5 };

export default makeSimGarment({
  id: 'polo',
  name: 'Polo',
  category: 'Textile',
  model: 'assets/models/polo.glb',
  colors: GARMENT_COLORS,
  defaultColor: '#1f2a44',
  knit: piqueNormal,
  knitTile: 0.9,
  normalScale: 0.65,
  period: 8,
  options: [
    { id: 'buttons', label: 'Boutons', type: 'segmented', default: 'match', choices: [{ value: 'match', label: 'Assortis' }, { value: 'white', label: 'Blancs' }, { value: 'black', label: 'Noirs' }] },
  ],
  zones: [
    { id: 'chest', label: 'Cœur', side: 'front', cx: 10.8, cy: 52.5, w: 9, h: 9, main: true, hint: 'Logo brodé ou imprimé côté cœur' },
    { id: 'back', label: 'Dos', side: 'back', cx: 0, cy: 40, w: 30, h: 36, hint: 'Grand visuel dos' },
    { id: 'front', label: 'Devant droit', side: 'front', cx: -10.8, cy: 52.5, w: 9, h: 9, hint: 'Côté opposé au cœur' },
    { id: 'sleeve', label: 'Manche', side: 'front', cx: 34, cy: 52, w: 6, h: 6, rot: -47, hint: 'Manche gauche' },
  ],
  views: [
    { id: 'three', label: '3/4', az: 28, el: 8 },
    { id: 'front', label: 'Face', az: 0, el: 4 },
    { id: 'back', label: 'Dos', az: 180, el: 6 },
    { id: 'logo', label: 'Logo', az: 16, el: 6, dist: 0.45, target: [0.2, 0.42, 0.1] },
  ],
  decorate(ctx, side, state, meta) {
    const segs = side === 'front' ? meta.segsFront : meta.segsBack;
    hems(ctx, segs, ['hem'], [1.6]);
    // bord-côte des manches
    for (const n of ['cuff_r', 'cuff_l']) {
      const p = segs[n];
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.09)';
      ctx.lineWidth = 0.07;
      const q = inset(p, 2.4);
      for (let t = 0; t <= 1; t += 0.03) {
        const a = [p[0][0] + (p[1][0] - p[0][0]) * t, p[0][1] + (p[1][1] - p[0][1]) * t];
        const b = [q[0][0] + (q[1][0] - q[0][0]) * t, q[0][1] + (q[1][1] - q[0][1]) * t];
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.restore();
      stitch(ctx, q, { width: 0.09, dash: [0.3, 0.2] });
    }
    for (const m of [1, -1]) stitch(ctx, [[m * 26.2, -3.4], [m * 26.2, 0.6]], { width: 0.08, dash: [0.25, 0.18] });
    if (side !== 'front') return;
    const { w, top, bottom } = PL;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 0.08;
    ctx.beginPath(); ctx.moveTo(-w, top); ctx.lineTo(-w, bottom); ctx.lineTo(w, bottom); ctx.lineTo(w, top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.25, top); ctx.lineTo(0.25, bottom + 0.1); ctx.stroke();
    const g = ctx.createLinearGradient(w, 0, w + 0.8, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(w, bottom, 0.8, top - bottom);
    ctx.restore();
    stitch(ctx, [[-w - 0.35, top], [-w - 0.35, bottom - 0.35], [w + 0.35, bottom - 0.35], [w + 0.35, top]], { width: 0.09, dash: [0.3, 0.2] });
  },
});
