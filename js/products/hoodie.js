import * as THREE from 'three';
import { makeGarment, symmetricSilhouette, ellipseCut, GARMENT_COLORS, wrinkles } from './garment.js';
import { fleeceNormal, stitch, createCanvas, canvasTexture, shade } from '../core/textures.js';
import { inflate, tube, curvePoints } from '../core/geometry.js';
import { fabricMaterial, setInner, metalMaterial } from '../core/materials.js';
import { smoothstep } from '../core/math.js';

const NECK_Y = 33.4;
const right = [
  { type: 'cubic', c1: [5, 31.6], c2: [8, 32.6], to: [9, NECK_Y], open: true },
  { type: 'quad', c1: [15.5, 33.2], to: [21.8, 30.4] },
  { type: 'quad', c1: [31.2, 22], to: [33.6, -21.5] },
  { type: 'line', to: [33.2, -29.6] },
  { type: 'line', to: [26.6, -30.1], open: true },
  { type: 'line', to: [26.4, -22.5] },
  { type: 'quad', c1: [24.4, -2], to: [22.6, 12.5] },
  { type: 'quad', c1: [21.9, -8], to: [22.2, -27.5] },
  { type: 'line', to: [21.1, -28.6] },
  { type: 'line', to: [21.1, -34.8] },
  { type: 'line', to: [0, -35], open: true },
];

// Poche kangourou
const PK = { top: -6.5, bottom: -26.3, xTop: 10.5, xBot: 16.2, yTurn: -17.5 };
function pocketSideX(y) {
  if (y < PK.yTurn) return PK.xBot;
  const t = (PK.top - y) / (PK.top - PK.yTurn);
  return PK.xTop + (PK.xBot - PK.xTop) * Math.sin(t * Math.PI / 2);
}
function pocketDist(x, y) {
  return Math.min(PK.top - y, y - PK.bottom, pocketSideX(y) - Math.abs(x));
}

function ribLines(ctx, x0, x1, y0, y1, step = 0.32) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 0.08;
  for (let x = x0; x <= x1; x += step) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
  ctx.restore();
}

const base = makeGarment({
  id: 'hoodie',
  name: 'Sweat à capuche',
  category: 'Textile',
  colors: GARMENT_COLORS,
  defaultColor: '#2c4a36',
  knit: fleeceNormal,
  knitTile: 1.1,
  normalScale: 0.45,
  zones: [
    { id: 'front', label: 'Devant', side: 'front', cx: 0, cy: 9.5, w: 26, h: 24, main: true, hint: 'Au-dessus de la poche' },
    { id: 'chest', label: 'Cœur', side: 'front', cx: 10.5, cy: 17, w: 9, h: 9, hint: 'Petit logo côté cœur' },
    { id: 'back', label: 'Dos', side: 'back', cx: 0, cy: 3, w: 30, h: 38, hint: 'Grand visuel dos' },
    { id: 'sleeve', label: 'Manche', side: 'front', cx: 28.2, cy: 1, w: 22, h: 5.5, rot: -82, hint: 'Texte le long de la manche' },
  ],
  views: [
    { id: 'front', label: 'Face', az: 0, el: 6 },
    { id: 'three', label: '3/4', az: 32, el: 10 },
    { id: 'back', label: 'Dos', az: 180, el: 8 },
    { id: 'side', label: 'Profil', az: 90, el: 4 },
  ],
  silhouette: () => symmetricSilhouette([0, 31.6], right, 0.45),
  inflate: {
    profileFront: (d) => 2.7 * Math.sqrt(d),
    profileBack: (d) => 2.4 * Math.sqrt(d),
    frontCut: ellipseCut(0, NECK_Y, 9, 6.8),
    zFrontMod: (() => {
      const w = wrinkles(0.55, 1 / 14, -35);
      return (x, y, z, d) => {
        let zz = w(x, y, z, d);
        const pd = pocketDist(x, y);
        zz += 0.45 * smoothstep(-0.2, 0.8, pd);
        // bord-côte resserré
        if (y < -28.4) zz -= 0.35 * smoothstep(-28.4, -29.4, y);
        return zz;
      };
    })(),
    zBackMod: wrinkles(0.45, 1 / 14, -35),
  },
  decorate(ctx, side) {
    const st = { width: 0.1, dash: [0.34, 0.24], light: 'rgba(255,255,255,0.08)' };
    // bord-côte bas + poignets
    ribLines(ctx, -21.2, 21.2, -35, -28.6);
    stitch(ctx, [[-21.4, -28.6], [21.4, -28.6]], st);
    for (const m of [1, -1]) {
      ctx.save();
      ctx.scale(m, 1);
      ctx.beginPath(); ctx.moveTo(26.5, -30.2); ctx.lineTo(33.4, -29.7); ctx.lineTo(33.8, -21.6); ctx.lineTo(26.3, -22.4); ctx.closePath();
      ctx.clip();
      ribLines(ctx, 25, 35, -31, -21, 0.3);
      ctx.restore();
      stitch(ctx, [[m * 26.3, -22.4], [m * 33.7, -21.6]], st);
      // ombre aisselle
      const g = ctx.createRadialGradient(m * 22.5, 12, 0, m * 22.5, 12, 6);
      g.addColorStop(0, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(m * 22.5 - 6, 6, 12, 12);
    }
    if (side === 'front') {
      // poche kangourou
      const pts = [];
      for (let y = PK.top; y >= PK.bottom; y -= 0.4) pts.push([pocketSideX(y), y]);
      const path = [[-PK.xTop, PK.top], [PK.xTop, PK.top], ...pts, [PK.xBot, PK.bottom], [-PK.xBot, PK.bottom], ...pts.slice().reverse().map(([x, y]) => [-x, y])];
      // ombre sous le rabat
      ctx.save();
      ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.lineWidth = 0.35; ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.stroke();
      ctx.restore();
      stitch(ctx, path.map(([x, y]) => [x * 0.985, y - 0.0]), st);
      stitch(ctx, [[-PK.xTop + 0.5, PK.top - 0.6], [PK.xTop - 0.5, PK.top - 0.6]], st);
      // ouvertures latérales : dégradé sombre
      for (const m of [1, -1]) {
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          ctx.strokeStyle = `rgba(0,0,0,${0.09 - i * 0.014})`;
          ctx.lineWidth = 0.25 + i * 0.35;
          ctx.beginPath();
          pts.filter(([, y]) => y > PK.yTurn - 0.5).forEach(([x, y], k) => (k ? ctx.lineTo(m * (x + 0.15 + i * 0.12), y) : ctx.moveTo(m * (x + 0.15 + i * 0.12), y)));
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  },
  build({ group, inf, plain }) {
    // ---- Capuche ----
    const hoodPoly = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const top = Math.sin(a) > 0;
      const rx = 15.8, ry = top ? 17 : 6;
      hoodPoly.push({ x: Math.cos(a) * rx * (top ? 1 - 0.08 * Math.sin(a) ** 4 : 1), y: 33 + Math.sin(a) * ry });
    }
    const HC = { x: 0, y: 36.5, rx: 11.2, ry: 13 };
    const hoodIn = (x, y) => 1 - Math.hypot((x - HC.x) / HC.rx, (y - HC.y) / HC.ry);
    const hood = inflate(hoodPoly, {
      cell: 0.5,
      profileFront: (d) => 1.6 * Math.sqrt(d),
      profileBack: (d) => 2.4 * Math.sqrt(d),
      zFrontMod: (x, y, z) => z - 7.5 * smoothstep(-0.05, 0.35, hoodIn(x, y)) * (0.75 + 0.25 * smoothstep(0, 0.8, hoodIn(x, y))),
    });
    const hc = createCanvas(1024, 1024);
    const ht = canvasTexture(hc);
    const hoodFront = fabricMaterial({ map: ht, normalMap: plain.normalMap, normalScale: 0.4, roughness: 0.95 });
    const hood2 = plain;
    const hoodMesh = new THREE.Mesh(hood.geometry, [hoodFront, hood2]);
    const backZ = inf.sample(0, 31).zb;
    hoodMesh.position.set(0, 0, backZ - 0.5);
    group.add(hoodMesh);

    // Bord de capuche qui descend et se croise devant
    const hz = (x, y) => hood.sample(x, y).zf + hoodMesh.position.z + 0.25;
    const bz = (x, y) => inf.sample(x, y).zf + 0.6;
    const rimCtrl = [];
    rimCtrl.push(new THREE.Vector3(2.8, 26.4, bz(2.8, 26.4)));
    rimCtrl.push(new THREE.Vector3(-4.5, 29.3, bz(-4.5, 29.3)));
    rimCtrl.push(new THREE.Vector3(-8.6, 32.6, bz(-8.6, 32.2) * 0.6 + hz(-10, 33) * 0.4));
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 1.08 - (i / 10) * Math.PI * 1.16;
      const x = HC.x + Math.cos(a) * (HC.rx + 0.5), y = HC.y + Math.sin(a) * (HC.ry + 0.5);
      rimCtrl.push(new THREE.Vector3(x, y, hz(x, y)));
    }
    rimCtrl.push(new THREE.Vector3(8.6, 32.6, bz(8.6, 32.2) * 0.6 + hz(10, 33) * 0.4));
    rimCtrl.push(new THREE.Vector3(4.5, 29.3, bz(4.5, 29.3) + 0.5));
    rimCtrl.push(new THREE.Vector3(-2.8, 26.0, bz(-2.8, 26) + 0.55));
    const rimPts = curvePoints(rimCtrl, 160);
    const rim = new THREE.Mesh(tube(rimPts, { rx: 0.6, ry: 1.3, square: 0.5, radial: 18, up: new THREE.Vector3(0, 0, 1) }), plain);
    group.add(rim);

    // Cordons
    const cordMat = fabricMaterial({ roughness: 0.8, sheen: 0.4 });
    const metal = metalMaterial('silver');
    for (const m of [-1, 1]) {
      const p0 = [m * 3.4, 27.2], p1 = [m * 3.9, 18], p2 = [m * (3.2 + (m > 0 ? 0.8 : 0)), 6.5 + (m > 0 ? -2 : 0)];
      const ctrl = [p0, p1, p2].map(([x, y]) => new THREE.Vector3(x, y, bz(x, y) + 0.1));
      ctrl[0].z += 0.4;
      const pts = curvePoints(ctrl, 50);
      const cord = new THREE.Mesh(tube(pts, { rx: 0.36, ry: 0.36, radial: 12, caps: true }), cordMat);
      group.add(cord);
      const end = pts[pts.length - 1], dir = end.clone().sub(pts[pts.length - 4]).normalize();
      const aglet = new THREE.Mesh(tube([end.clone(), end.clone().addScaledVector(dir, 2.6)], { rx: 0.42, ry: 0.42, radial: 14, caps: true }), metal);
      group.add(aglet);
      // œillet
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.2, 10, 24), metal);
      eye.position.copy(pts[0]).add(new THREE.Vector3(0, 0, 0.15));
      group.add(eye);
    }

    return {
      update(state) {
        const ctx = hc.getContext('2d');
        const S = 1024;
        const { minX, maxX, minY, maxY } = hood.bbox;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = state.color;
        ctx.fillRect(0, 0, S, S);
        const sx = S / (maxX - minX), sy = S / (maxY - minY);
        ctx.setTransform(sx, 0, 0, -sy, -minX * sx, maxY * sy);
        const g = ctx.createRadialGradient(HC.x, HC.y - 2, 2, HC.x, HC.y, HC.ry * 1.05);
        g.addColorStop(0, shade(state.color, 0.35));
        g.addColorStop(0.75, shade(state.color, 0.55));
        g.addColorStop(1, shade(state.color, 0.8));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(HC.x, HC.y, HC.rx + 0.4, HC.ry + 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ht.needsUpdate = true;
        setInner(hoodFront, shade(state.color, 0.6));
        hoodFront.sheenColor.copy(plain.sheenColor);
        cordMat.color.set(state.options?.cords === 'contrast' ? (new THREE.Color(state.color).getHSL({}).l > 0.5 ? '#222222' : '#f2f2ee') : state.color);
        setInner(cordMat, shade(state.color, 0.6));
      },
      dispose() { ht.dispose(); hoodFront.dispose(); cordMat.dispose(); metal.dispose(); },
    };
  },
});

base.options = [
  { id: 'cords', label: 'Cordons', type: 'segmented', default: 'match', choices: [{ value: 'match', label: 'Assortis' }, { value: 'contrast', label: 'Contrastés' }] },
];

export default base;
