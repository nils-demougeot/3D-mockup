import { makeSimGarment, offsetLine } from './simgarment.js';
import { GARMENT_COLORS } from './garment.js';
import { jerseyNormal, stitch } from '../core/textures.js';

// décale une polyligne vers un point (pour placer les surpiqûres côté tissu)
export function inset(pts, d, toward = [0, 35]) {
  const a = offsetLine(pts, d), b = offsetLine(pts, -d);
  const m = (p) => p.reduce((s, q) => s + Math.hypot(q[0] - toward[0], q[1] - toward[1]), 0);
  return m(a) < m(b) ? a : b;
}
export function hems(ctx, segs, names, offsets, toward) {
  const st = { width: 0.09, dash: [0.32, 0.22], light: 'rgba(255,255,255,0.10)' };
  for (const n of names) {
    const p = segs[n];
    if (!p) continue;
    for (const off of offsets) stitch(ctx, inset(p, off, toward), st);
  }
}

export default makeSimGarment({
  id: 'tshirt',
  name: 'T-shirt',
  category: 'Textile',
  model: 'assets/models/tshirt.glb',
  colors: GARMENT_COLORS,
  defaultColor: '#f4f4f1',
  knit: jerseyNormal,
  knitTile: 1.0,
  period: 8,
  zones: [
    { id: 'front', label: 'Devant', side: 'front', cx: 0, cy: 37, w: 28, h: 35, main: true, hint: 'Grand visuel poitrine' },
    { id: 'chest', label: 'Cœur', side: 'front', cx: 10.5, cy: 51, w: 9, h: 9, hint: 'Petit logo côté cœur' },
    { id: 'back', label: 'Dos', side: 'back', cx: 0, cy: 41, w: 30, h: 38, hint: 'Grand visuel dos' },
    { id: 'sleeve', label: 'Manche', side: 'front', cx: 33.5, cy: 53, w: 7, h: 7, rot: -47, hint: 'Manche gauche' },
  ],
  views: [
    { id: 'three', label: '3/4', az: 28, el: 8 },
    { id: 'front', label: 'Face', az: 0, el: 4 },
    { id: 'back', label: 'Dos', az: 180, el: 6 },
    { id: 'side', label: 'Profil', az: 90, el: 4 },
  ],
  decorate(ctx, side, state, meta) {
    const segs = side === 'front' ? meta.segsFront : meta.segsBack;
    hems(ctx, segs, ['hem'], [1.5, 2.1]);
    hems(ctx, segs, ['cuff_r', 'cuff_l'], [1.4, 2.0]);
    hems(ctx, segs, ['neck_r', 'neck_l'], [0.6], [0, 0]);
  },
});
