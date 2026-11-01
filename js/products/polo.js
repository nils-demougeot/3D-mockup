import * as THREE from 'three';
import { makeGarment, symmetricSilhouette, segPolyline, ellipseCut, GARMENT_COLORS, collarBand, sizeLabel, wrinkles } from './garment.js';
import { piqueNormal, stitch } from '../core/textures.js';
import { inflate, lathe, deform } from '../core/geometry.js';
import { smoothstep } from '../core/math.js';

const NECK = { x: 7.2, y: 34.4, backY: 33.2 };
const neckBack = [{ type: 'cubic', c1: [4, NECK.backY], c2: [6.4, 33.8], to: [NECK.x, NECK.y], open: true }];
const SLEEVE_A = [34.2, 18.6], SLEEVE_B = [27.4, 10.4];
const right = [
  ...neckBack,
  { type: 'quad', c1: [14, 33.4], to: [20.6, 31.2] },
  { type: 'quad', c1: [28.6, 26.4], to: SLEEVE_A },
  { type: 'line', to: SLEEVE_B, open: true },
  { type: 'quad', c1: [23.8, 13], to: [21.1, 14.4] },
  { type: 'cubic', c1: [20.8, 5], c2: [21.8, -20], to: [22, -36] },
  { type: 'quad', c1: [11, -36.6], to: [0, -36.6], open: true },
];
const PLACKET = { w: 1.6, top: 31.5, bottom: 16.5 };

function sleeveRib(ctx, mirror) {
  const [ax, ay] = SLEEVE_A, [bx, by] = SLEEVE_B;
  let nx = -(by - ay), ny = bx - ax;
  const l = Math.hypot(nx, ny); nx /= l; ny /= l;
  if (nx > 0) { nx = -nx; ny = -ny; }
  const m = mirror ? -1 : 1;
  const off = 2.4;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.09)';
  ctx.lineWidth = 0.07;
  for (let t = 0; t <= 1; t += 0.028) {
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    ctx.beginPath(); ctx.moveTo(m * x, y); ctx.lineTo(m * (x + nx * off), y + ny * off); ctx.stroke();
  }
  ctx.restore();
  stitch(ctx, [[m * (ax + nx * off), ay + ny * off], [m * (bx + nx * off), by + ny * off]], { width: 0.09, dash: [0.3, 0.2] });
}

const def = makeGarment({
  id: 'polo',
  name: 'Polo',
  category: 'Textile',
  colors: GARMENT_COLORS,
  defaultColor: '#1f2a44',
  knit: piqueNormal,
  knitTile: 0.9,
  normalScale: 0.7,
  zones: [
    { id: 'chest', label: 'Cœur', side: 'front', cx: 10.8, cy: 18.5, w: 9, h: 9, main: true, hint: 'Logo brodé ou imprimé côté cœur' },
    { id: 'back', label: 'Dos', side: 'back', cx: 0, cy: 4, w: 30, h: 36, hint: 'Grand visuel dos' },
    { id: 'front', label: 'Devant droit', side: 'front', cx: -10.8, cy: 18.5, w: 9, h: 9, hint: 'Côté opposé au cœur' },
    { id: 'sleeve', label: 'Manche', side: 'front', cx: 27.2, cy: 19.4, w: 6, h: 6, rot: -36, hint: 'Manche gauche' },
  ],
  views: [
    { id: 'front', label: 'Face', az: 0, el: 6 },
    { id: 'three', label: '3/4', az: 30, el: 10 },
    { id: 'back', label: 'Dos', az: 180, el: 6 },
    { id: 'chest', label: 'Logo', az: 18, el: 8, dist: 0.5, target: [0.17, 0.33, 0] },
  ],
  silhouette: () => symmetricSilhouette([0, NECK.backY], right, 0.45),
  inflate: {
    profileFront: (d) => 2.65 * Math.sqrt(d),
    profileBack: (d) => 2.35 * Math.sqrt(d),
    frontCut: ellipseCut(0, NECK.y, NECK.x, 4.2),
    zFrontMod: (() => {
      const w = wrinkles(0.4);
      return (x, y, z, d) => {
        let zz = w(x, y, z, d);
        // patte de boutonnage légèrement en relief
        const inP = Math.min(PLACKET.w - Math.abs(x), PLACKET.top - y, y - PLACKET.bottom);
        zz += 0.18 * smoothstep(-0.15, 0.25, inP);
        return zz;
      };
    })(),
    zBackMod: wrinkles(0.35),
  },
  decorate(ctx, side) {
    const st = { width: 0.09, dash: [0.3, 0.2] };
    for (const off of [1.6]) stitch(ctx, [[-22, -36.6 + off], [22, -36.6 + off]], st);
    sleeveRib(ctx, false); sleeveRib(ctx, true);
    for (const m of [1, -1]) {
      const g = ctx.createRadialGradient(m * 21.5, 14.6, 0, m * 21.5, 14.6, 5);
      g.addColorStop(0, 'rgba(0,0,0,0.13)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(m * 21.5 - 5, 9.6, 10, 10);
      // fentes côté
      stitch(ctx, [[m * 21.4, -36.4], [m * 21.3, -32.5]], { width: 0.08, dash: [0.25, 0.18] });
    }
    if (side === 'front') {
      const { w, top, bottom } = PLACKET;
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.moveTo(-w, top); ctx.lineTo(-w, bottom); ctx.lineTo(w, bottom); ctx.lineTo(w, top); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.25, top); ctx.lineTo(0.25, bottom + 0.1); ctx.stroke();
      ctx.restore();
      stitch(ctx, [[-w - 0.35, top], [-w - 0.35, bottom - 0.35], [w + 0.35, bottom - 0.35], [w + 0.35, top]], st);
    }
  },
  build({ group, inf, trim, plain }) {
    // Pied de col (tour de cou)
    const loop = [];
    for (let i = 0; i <= 30; i++) {
      const a = Math.PI + (i / 30) * Math.PI;
      const x = Math.cos(a) * NECK.x, y = NECK.y + Math.sin(a) * 4.2;
      loop.push(new THREE.Vector3(x, y, inf.sample(x * 0.99, y).zf));
    }
    const back = segPolyline([0, NECK.backY], neckBack, 0.4);
    const backFull = [...back.slice().reverse().map(([x, y]) => [-x, y]), ...back.slice(1)];
    for (let i = backFull.length - 2; i >= 1; i--) {
      const [x, y] = backFull[i];
      loop.push(new THREE.Vector3(x, y, inf.sample(x, y - 0.05).zb));
    }
    const center = new THREE.Vector3(0, NECK.y - 1, 0);
    const band = collarBand(loop, {
      width: 3.4, thickness: 0.5,
      inward: (i, p) => center.clone().sub(p).setY(4),
      normalAt: (i, p) => {
        const w = Math.min(1, Math.max(0, (Math.abs(p.x) - 4) / 3.2));
        const n = p.z > 0 ? new THREE.Vector3(0, 0.5, 1) : new THREE.Vector3(0, 0.15, -1);
        return n.normalize().lerp(new THREE.Vector3(0, 0.6, 0.3), w * w).normalize();
      },
    });
    trim.normalMap.repeat.set(60, 1);
    group.add(new THREE.Mesh(band, trim));

    // Rabats du col (posés sur les épaules et la poitrine)
    for (const m of [1, -1]) {
      const pts = [];
      const ctrl = [[0.6, 31.2], [2.6, 32.9], [5.2, 34.6], [7.6, 35.6], [9.6, 35.2], [11.4, 33.4], [9.6, 30.2], [7.4, 27], [6.6, 25.6], [4.2, 27.6], [2, 29.6]];
      const curve = new THREE.SplineCurve(ctrl.map(([x, y]) => new THREE.Vector2(x, y)));
      curve.getSpacedPoints(80).slice(0, -1).forEach((p) => pts.push({ x: m * p.x, y: p.y }));
      const wing = inflate(pts, { cell: 0.22, smooth: 0.6, profileFront: (d) => 0.32 * Math.sqrt(d), profileBack: (d) => 0.12 * Math.sqrt(d), groups: false });
      deform(wing.geometry, (v) => {
        const s = inf.sample(v.x, v.y);
        const roll = smoothstep(31, 35.5, v.y) * 1.2;
        const base = Math.max(s.zf, 0) + 0.45 + roll;
        v.z = base + v.z;
        // remonte vers le cou (le col s'enroule)
        if (v.y > 34) v.z -= (v.y - 34) * 1.6 * smoothstep(5, 9, Math.abs(v.x));
      });
      const mesh = new THREE.Mesh(wing.geometry, plain);
      group.add(mesh);
    }

    // Boutons
    const btnGeo = lathe([[0.001, 0.12], [0.35, 0.1], [0.5, 0.16], [0.56, 0.08], [0.55, 0.0], [0.001, 0.0]].reverse(), 32);
    const btnMat = new THREE.MeshPhysicalMaterial({ color: '#f5f3ee', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
    for (const y of [28.2, 22.3]) {
      const b = new THREE.Mesh(btnGeo, btnMat);
      b.rotation.x = Math.PI / 2;
      b.position.set(0, y, inf.sample(0, y).zf + 0.15);
      group.add(b);
      // trous
      for (const [dx, dy] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) {
        const h = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), new THREE.MeshBasicMaterial({ color: '#555' }));
        h.position.set(dx, y + dy, b.position.z + 0.125);
        group.add(h);
      }
    }
    const label = sizeLabel('M');
    label.position.set(0, NECK.backY - 1.5, inf.sample(0, NECK.backY - 1.6).zb + 0.25);
    group.add(label);
    return {
      update(state) {
        const opt = state.options?.buttons || 'match';
        btnMat.color.set(opt === 'white' ? '#f5f3ee' : opt === 'black' ? '#1d1d1f' : state.color);
      },
    };
  },
});

def.options = [
  { id: 'buttons', label: 'Boutons', type: 'segmented', default: 'match', choices: [{ value: 'match', label: 'Assortis' }, { value: 'white', label: 'Blancs' }, { value: 'black', label: 'Noirs' }] },
];

export default def;
