import * as THREE from 'three';
import { makeGarment, symmetricSilhouette, segPolyline, ellipseCut, GARMENT_COLORS, collarBand, sizeLabel, wrinkles } from './garment.js';
import { jerseyNormal, stitch } from '../core/textures.js';

const NECK = { x: 8, y: 33.8, backY: 32.4, frontRx: 8, frontRy: 9.8 };
const neckBack = [{ type: 'cubic', c1: [4.5, NECK.backY], c2: [7.2, 33.2], to: [NECK.x, NECK.y], open: true }];
const SLEEVE_A = [33.5, 20.2], SLEEVE_B = [26.4, 11.8];

const right = [
  ...neckBack,
  { type: 'quad', c1: [14, 32.9], to: [20.5, 31] },
  { type: 'quad', c1: [28.2, 26.6], to: SLEEVE_A },
  { type: 'line', to: SLEEVE_B, open: true },
  { type: 'quad', c1: [23.5, 13.4], to: [21, 14.6] },
  { type: 'cubic', c1: [20.8, 5], c2: [21.6, -20], to: [21.8, -35.6] },
  { type: 'quad', c1: [11, -36.3], to: [0, -36.3], open: true },
];

function sleeveHem(ctx, mirror, off) {
  const [ax, ay] = SLEEVE_A, [bx, by] = SLEEVE_B;
  let nx = -(by - ay), ny = bx - ax;
  const l = Math.hypot(nx, ny); nx /= l; ny /= l;
  if (nx > 0) { nx = -nx; ny = -ny; }
  const m = mirror ? -1 : 1;
  stitch(ctx, [[m * (ax + nx * off), ay + ny * off], [m * (bx + nx * off), by + ny * off]], { width: 0.09, dash: [0.32, 0.22], light: 'rgba(255,255,255,0.10)' });
}

function softShade(ctx, x, y, r, a = 0.14) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export default makeGarment({
  id: 'tshirt',
  name: 'T-shirt',
  category: 'Textile',
  colors: GARMENT_COLORS,
  defaultColor: '#f4f4f1',
  knit: jerseyNormal,
  knitTile: 1.0,
  zones: [
    { id: 'front', label: 'Devant', side: 'front', cx: 0, cy: -1, w: 28, h: 35, main: true, hint: 'Grand visuel poitrine' },
    { id: 'chest', label: 'Cœur', side: 'front', cx: 10.5, cy: 16, w: 9, h: 9, hint: 'Petit logo côté cœur' },
    { id: 'back', label: 'Dos', side: 'back', cx: 0, cy: 3.5, w: 30, h: 38, hint: 'Grand visuel dos' },
    { id: 'sleeve', label: 'Manche', side: 'front', cx: 26.6, cy: 19.6, w: 6.5, h: 6.5, rot: -36, hint: 'Manche gauche' },
  ],
  views: [
    { id: 'front', label: 'Face', az: 0, el: 6 },
    { id: 'three', label: '3/4', az: 32, el: 10 },
    { id: 'back', label: 'Dos', az: 180, el: 6 },
    { id: 'side', label: 'Profil', az: 90, el: 4 },
  ],
  silhouette: () => symmetricSilhouette([0, NECK.backY], right, 0.45),
  inflate: {
    profileFront: (d) => 2.65 * Math.sqrt(d),
    profileBack: (d) => 2.35 * Math.sqrt(d),
    frontCut: ellipseCut(0, NECK.y, NECK.frontRx, NECK.frontRy),
    zFrontMod: wrinkles(0.5),
    zBackMod: wrinkles(0.4),
  },
  decorate(ctx, side) {
    // ombrages doux (aisselles)
    softShade(ctx, 21.5, 14.8, 5, 0.12);
    softShade(ctx, -21.5, 14.8, 5, 0.12);
    // ourlet bas double aiguille
    for (const off of [1.5, 2.1]) stitch(ctx, [[-21.8, -36.3 + off], [21.8, -36.3 + off]], { width: 0.09, dash: [0.32, 0.22], light: 'rgba(255,255,255,0.10)' });
    for (const m of [false, true]) for (const off of [1.4, 2.0]) sleeveHem(ctx, m, off);
    if (side === 'front') {
      // couture sous le col
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const a = Math.PI + (i / 40) * Math.PI;
        pts.push([Math.cos(a) * (NECK.frontRx + 0.55), NECK.y + Math.sin(a) * (NECK.frontRy + 0.55)]);
      }
      stitch(ctx, pts, { width: 0.09, dash: [0.3, 0.2] });
    } else {
      const pts = segPolyline([0, NECK.backY], neckBack, 0.4).map(([x, y]) => [x, y - 0.9]);
      stitch(ctx, [...pts.slice().reverse().map(([x, y]) => [-x, y]), ...pts], { width: 0.09, dash: [0.3, 0.2] });
    }
  },
  build({ group, inf, trim }) {
    // Boucle du col : partie avant (bord de l'encolure) + partie arrière
    const loop = [];
    const N = 46;
    for (let i = 0; i <= N; i++) {
      const a = Math.PI + (i / N) * Math.PI;
      const x = Math.cos(a) * NECK.frontRx, y = NECK.y + Math.sin(a) * NECK.frontRy;
      const s = inf.sample(x * 0.995, y);
      loop.push(new THREE.Vector3(x, y, s.zf));
    }
    const back = segPolyline([0, NECK.backY], neckBack, 0.4);
    const backFull = [...back.slice().reverse().map(([x, y]) => [-x, y]), ...back.slice(1)];
    // de droite à gauche
    for (let i = backFull.length - 2; i >= 1; i--) {
      const [x, y] = backFull[i];
      const s = inf.sample(x, y - 0.05);
      loop.push(new THREE.Vector3(x, y, s.zb));
    }
    const center = new THREE.Vector3(0, NECK.y - 2, 1.5);
    const band = collarBand(loop, {
      width: 2.1, thickness: 0.6,
      inward: (i, p) => center.clone().sub(p).setY(Math.max(0.5, center.y - p.y + 3)),
      normalAt: (i, p) => {
        const w = Math.min(1, Math.max(0, (Math.abs(p.x) - 4.5) / 3.5));
        const n = p.z > 0 ? new THREE.Vector3(0, 0.35, 1) : new THREE.Vector3(0, 0.25, -1);
        return n.normalize().lerp(new THREE.Vector3(0, 1, 0), w * w).normalize();
      },
    });
    trim.normalMap.repeat.set(70, 1);
    const collar = new THREE.Mesh(band, trim);
    group.add(collar);
    // Étiquette
    const label = sizeLabel('M');
    const sb = inf.sample(0, NECK.backY - 1.6);
    label.position.set(0, NECK.backY - 1.3, sb.zb + 0.25);
    label.rotation.x = -0.15;
    group.add(label);
    return {};
  },
});
