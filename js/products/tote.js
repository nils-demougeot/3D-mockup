import * as THREE from 'three';
import { inflate, tube, curvePoints } from '../core/geometry.js';
import { createCanvas, canvasTexture, canvasWeaveNormal, strapNormal, stitch, shade} from '../core/textures.js';
import { fabricMaterial, setInner } from '../core/materials.js';
import { fbm, smoothstep, rng } from '../core/math.js';

const W2 = 19, TOP = 21, BOT = -21;

const COLORS = [
  { name: 'Écru naturel', hex: '#e9dfc9' }, { name: 'Blanc', hex: '#f4f3ef' }, { name: 'Noir', hex: '#1f1f21' },
  { name: 'Marine', hex: '#1f2a44' }, { name: 'Bordeaux', hex: '#6d1f2f' }, { name: 'Vert forêt', hex: '#2c4a36' },
  { name: 'Sauge', hex: '#9aae94' }, { name: 'Moutarde', hex: '#d9a531' }, { name: 'Rose', hex: '#efb7c3' }, { name: 'Bleu', hex: '#3d6fd8' },
];

export default {
  id: 'tote',
  name: 'Tote bag',
  category: 'Textile',
  colors: COLORS,
  defaultColor: '#e9dfc9',
  zones: [
    { id: 'front', label: 'Recto', w: 28, h: 30, main: true, hint: 'Face avant' },
    { id: 'back', label: 'Verso', w: 28, h: 30, hint: 'Face arrière' },
  ],
  options: [
    { id: 'handles', label: 'Anses', type: 'segmented', default: 'match', choices: [{ value: 'match', label: 'Assorties' }, { value: 'natural', label: 'Écru' }, { value: 'black', label: 'Noires' }] },
  ],
  views: [
    { id: 'front', label: 'Face', az: 0, el: 6 },
    { id: 'three', label: '3/4', az: 34, el: 12 },
    { id: 'back', label: 'Verso', az: 180, el: 6 },
    { id: 'top', label: 'Dessus', az: 10, el: 50 },
  ],
  create() {
    const group = new THREE.Group();
    const poly = [];
    const r = 1.2;
    const push = (x, y, open) => poly.push({ x, y, open });
    // haut ouvert (de gauche à droite), puis côté droit, bas, côté gauche
    for (let i = 0; i <= 40; i++) push(-W2 + r + (i / 40) * (2 * W2 - 2 * r), TOP, true);
    for (let i = 1; i <= 6; i++) { const a = Math.PI / 2 - (i / 6) * Math.PI / 2; push(W2 - r + Math.cos(a) * r, TOP - r + Math.sin(a) * r); }
    for (let i = 1; i <= 40; i++) push(W2, TOP - r - (i / 40) * (TOP - BOT - 2 * r));
    for (let i = 1; i <= 6; i++) { const a = -(i / 6) * Math.PI / 2; push(W2 - r + Math.cos(a) * r, BOT + r + Math.sin(a) * r); }
    for (let i = 1; i <= 40; i++) push(W2 - r - (i / 40) * (2 * W2 - 2 * r), BOT);
    for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 - (i / 6) * Math.PI / 2; push(-W2 + r + Math.cos(a) * r, BOT + r + Math.sin(a) * r); }
    for (let i = 1; i <= 40; i++) push(-W2, BOT + r + (i / 40) * (TOP - BOT - 2 * r));
    for (let i = 1; i < 6; i++) { const a = Math.PI - (i / 6) * Math.PI / 2; push(-W2 + r + Math.cos(a) * r, TOP - r + Math.sin(a) * r); }
    poly[poly.length - 1].open = false;
    const fold = (x, y, z, d) => {
      const k = smoothstep(0, 3, d);
      const n = fbm(x / 14, y / 14, 3) * 0.65 + fbm(x / 6 + 3, y / 10, 2) * 0.1;
      // léger pli horizontal sous les anses
      const sag = Math.exp(-((y - 16) ** 2) / 10) * Math.cos(x / 4) * 0.25;
      return z + (n + sag) * k;
    };
    const inf = inflate(poly, {
      cell: 0.5, smooth: 3,
      profileFront: (d) => 0.95 * Math.sqrt(d),
      profileBack: (d) => 0.95 * Math.sqrt(d),
      zFrontMod: fold, zBackMod: (x, y, z, d) => fold(-x + 5, y + 3, z, d),
    });
    const { minX, maxX, minY, maxY, w, h } = inf.bbox;
    const S = 2048;
    const cF = createCanvas(S, S), cB = createCanvas(S, S);
    const tF = canvasTexture(cF), tB = canvasTexture(cB);
    const weave = canvasWeaveNormal().clone();
    weave.repeat.set(w / 0.55, h / 0.55);
    const mF = fabricMaterial({ map: tF, normalMap: weave, normalScale: 0.8, roughness: 0.95, sheen: 0.4 });
    const mB = fabricMaterial({ map: tB, normalMap: weave, normalScale: 0.8, roughness: 0.95, sheen: 0.4 });
    group.add(new THREE.Mesh(inf.geometry, [mF, mB]));

    // Anses
    const strapN = strapNormal().clone();
    strapN.repeat.set(40, 2);
    const strap = fabricMaterial({ normalMap: strapN, normalScale: 0.7, roughness: 0.9, sheen: 0.4 });
    const handles = [];
    for (const side of [1, -1]) {
      const zs = (x, y) => (side > 0 ? inf.sample(x, y).zf + 0.12 : inf.sample(x, y).zb - 0.12);
      const lean = side > 0 ? 1.6 : -2.6;
      const ctrl = [
        [-8.5, 15, zs(-8.5, 15)], [-8.6, 19, zs(-8.6, 19)], [-8.6, 21.5, zs(-8.6, 20.8) + side * 0.15],
        [-8.2, 31, lean * 0.6], [-4.5, 41, lean], [0, 43, lean], [4.5, 41, lean], [8.2, 31, lean * 0.6],
        [8.6, 21.5, zs(8.6, 20.8) + side * 0.15], [8.6, 19, zs(8.6, 19)], [8.5, 15, zs(8.5, 15)],
      ];
      const pts = curvePoints(ctrl.map((p) => new THREE.Vector3(...p)), 160, false, 0.5);
      const g = tube(pts, { rx: 0.11, ry: 1.3, side: (i, T, p) => new THREE.Vector3(0, 0, 1), radial: 16, square: 0.9 });
      const m = new THREE.Mesh(g, strap);
      group.add(m);
      handles.push(m);
    }
    group.position.y = -10;

    const silCache = new WeakMap();
    function compose(side, state) {
      const c = side === 'front' ? cF : cB;
      const ctx = c.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = state.color;
      ctx.fillRect(0, 0, S, S);
      // fibres de coton (surtout visible sur l'écru)
      const rr = rng(side === 'front' ? 3 : 4);
      const dark = new THREE.Color(state.color).getHSL({}).l < 0.35;
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = dark ? `rgba(255,255,255,${0.04 + rr() * 0.05})` : `rgba(80,60,30,${0.05 + rr() * 0.08})`;
        ctx.fillRect(rr() * S, rr() * S, 1 + rr() * 2.5, 1 + rr() * 1.2);
      }
      const sx = S / w, sy = S / h;
      if (side === 'front') ctx.setTransform(sx, 0, 0, -sy, -minX * sx, maxY * sy);
      else ctx.setTransform(-sx, 0, 0, -sy, maxX * sx, maxY * sy);
      // ourlet du haut
      const st = { width: 0.1, dash: [0.38, 0.26], color: 'rgba(0,0,0,0.3)' };
      stitch(ctx, [[-W2, TOP - 2.6], [W2, TOP - 2.6]], st);
      // fixations des anses (carré + croix)
      for (const x of [-8.6, 8.6]) {
        const x0 = x - 1.1, x1 = x + 1.1, y0 = TOP - 2.4, y1 = TOP - 0.4;
        stitch(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0], [x1, y1]], { ...st, dash: [0.25, 0.15] });
        stitch(ctx, [[x1, y0], [x0, y1]], { ...st, dash: [0.25, 0.15] });
      }
      // ombre douce sous les anses + coins
      const g = ctx.createLinearGradient(0, TOP, 0, TOP - 4);
      g.addColorStop(0, 'rgba(0,0,0,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(-W2, TOP - 4, 2 * W2, 4);
      const z = state.zones[side === 'front' ? 'front' : 'back'];
      if (z) {
        ctx.save();
        ctx.translate(0, -1.5);
        ctx.scale(side === 'back' ? -1 : 1, -1);
        ctx.drawImage(z, -14, -15, 28, 30);
        ctx.restore();
      }
      (side === 'front' ? tF : tB).needsUpdate = true;
    }

    return {
      group,
      update(state) {
        compose('front', state);
        compose('back', state);
        const inner = shade(state.color, 0.55);
        [mF, mB, strap].forEach((m) => setInner(m, inner));
        const hc = state.options.handles === 'natural' ? '#e9dfc9' : state.options.handles === 'black' ? '#1f1f21' : state.color;
        strap.color.set(hc);
        setInner(strap, hc);
        const sheen = new THREE.Color(state.color).lerp(new THREE.Color('#fff'), 0.5);
        [mF, mB, strap].forEach((m) => m.sheenColor.copy(sheen));
      },
      dispose() {
        group.traverse((o) => o.isMesh && o.geometry.dispose());
        [tF, tB].forEach((t) => t.dispose());
        [mF, mB, strap].forEach((m) => m.dispose());
      },
    };
  },
};
