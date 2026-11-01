import { makeSimGarment } from './simgarment.js';
import { canvasWeaveNormal, strapNormal, stitch } from '../core/textures.js';
import { rng } from '../core/math.js';

const COLORS = [
  { name: 'Écru naturel', hex: '#e9dfc9' }, { name: 'Blanc', hex: '#f4f3ef' }, { name: 'Noir', hex: '#1f1f21' },
  { name: 'Marine', hex: '#1f2a44' }, { name: 'Bordeaux', hex: '#6d1f2f' }, { name: 'Vert forêt', hex: '#2c4a36' },
  { name: 'Sauge', hex: '#9aae94' }, { name: 'Moutarde', hex: '#d9a531' }, { name: 'Rose', hex: '#efb7c3' }, { name: 'Bleu', hex: '#3d6fd8' },
];

export default makeSimGarment({
  id: 'tote',
  name: 'Tote bag',
  category: 'Textile',
  model: 'assets/models/tote.glb',
  noForm: true,
  colors: COLORS,
  defaultColor: '#e9dfc9',
  knit: canvasWeaveNormal,
  strapNormal,
  knitTile: 0.55,
  normalScale: 0.8,
  period: 7,
  shadow: { gap: 0.12, blur: 2.6, opacity: 0.4 },
  strapColor: (s) => (s.options.handles === 'natural' ? '#e9dfc9' : s.options.handles === 'black' ? '#1f1f21' : s.color),
  options: [
    { id: 'handles', label: 'Anses', type: 'segmented', default: 'match', choices: [{ value: 'match', label: 'Assorties' }, { value: 'natural', label: 'Écru' }, { value: 'black', label: 'Noires' }] },
  ],
  zones: [
    { id: 'front', label: 'Recto', side: 'front', cx: 0, cy: 19.5, w: 28, h: 30, main: true, hint: 'Face avant' },
    { id: 'back', label: 'Verso', side: 'back', cx: 0, cy: 19.5, w: 28, h: 30, hint: 'Face arrière' },
  ],
  views: [
    { id: 'front', label: 'Face', az: 0, el: 4 },
    { id: 'three', label: '3/4', az: 30, el: 10 },
    { id: 'back', label: 'Verso', az: 180, el: 4 },
    { id: 'top', label: 'Dessus', az: 10, el: 50 },
  ],
  decorate(ctx, side, state) {
    // fibres de coton
    const r = rng(side === 'front' ? 3 : 4);
    const dark = parseInt(state.color.slice(1, 3), 16) < 80;
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = dark ? `rgba(255,255,255,${0.04 + r() * 0.05})` : `rgba(80,60,30,${0.05 + r() * 0.08})`;
      ctx.fillRect(-19.5 + r() * 39, -0.5 + r() * 43, 0.04 + r() * 0.08, 0.03 + r() * 0.04);
    }
    const st = { width: 0.1, dash: [0.38, 0.26], color: 'rgba(0,0,0,0.3)' };
    stitch(ctx, [[-19.5, 39.4], [19.5, 39.4]], st);
    for (const x of [-9, 9]) {
      const x0 = x - 1.1, x1 = x + 1.1, y0 = 39.6, y1 = 41.6;
      stitch(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0], [x1, y1]], { ...st, dash: [0.25, 0.15] });
      stitch(ctx, [[x1, y0], [x0, y1]], { ...st, dash: [0.25, 0.15] });
    }
  },
});
