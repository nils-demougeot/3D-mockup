import * as THREE from 'three';
import { paramSurface, tube, curvePoints } from '../core/geometry.js';
import { createCanvas, canvasTexture, strapNormal, stitch, shade } from '../core/textures.js';
import { fabricMaterial, setInner, METALS } from '../core/materials.js';

const W = 3, L = 12.5, TH = 0.16; // cm
const R_CORNER = 0.35;

const COLORS = [
  { name: 'Rouge', hex: '#d0202f' }, { name: 'Noir', hex: '#1d1d1f' }, { name: 'Blanc', hex: '#f4f4f1' },
  { name: 'Marine', hex: '#1f2a44' }, { name: 'Orange', hex: '#f0762a' }, { name: 'Jaune', hex: '#f2c84b' },
  { name: 'Vert', hex: '#2f8f5b' }, { name: 'Bleu', hex: '#3d6fd8' }, { name: 'Violet', hex: '#7a3cff' }, { name: 'Rose', hex: '#f08cb0' },
];

// centre de la sangle (légère torsion + courbure, comme si elle pendait)
function frame(t) {
  const a = 0.38 * (t - 0.45) ** 2 * Math.sign(t - 0.45) * 2.2; // torsion
  const c = new THREE.Vector3(0.25 * Math.sin(t * 2.2), t * L, 0.55 * Math.sin(t * Math.PI) - 0.2 * t);
  const side = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const normal = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
  return { c, side, normal };
}
function surf(s, t, off, target) {
  const f = frame(t);
  return target.copy(f.c).addScaledVector(f.side, (s - 0.5) * W).addScaledVector(f.normal, off);
}

export default {
  id: 'keychain',
  name: 'Porte-clé flamme',
  category: 'Goodies',
  colors: COLORS,
  defaultColor: '#d0202f',
  zones: [
    { id: 'front', label: 'Recto', w: W, h: L, main: true, hint: 'Texte ou logo vertical (lisible de bas en haut ou tourné)' },
    { id: 'back', label: 'Verso', w: W, h: L, hint: 'Face arrière' },
  ],
  options: [
    { id: 'weave', label: 'Fabrication', type: 'segmented', default: 'woven', choices: [{ value: 'woven', label: 'Tissé' }, { value: 'printed', label: 'Imprimé satin' }] },
    { id: 'ring', label: 'Anneau', type: 'segmented', default: 'silver', choices: [{ value: 'silver', label: 'Argent' }, { value: 'gold', label: 'Or' }, { value: 'black', label: 'Noir' }] },
    { id: 'stitch', label: 'Surpiqûres', type: 'segmented', default: 'on', choices: [{ value: 'on', label: 'Oui' }, { value: 'off', label: 'Non' }] },
  ],
  views: [
    { id: 'front', label: 'Face', az: 0, el: 6 },
    { id: 'three', label: '3/4', az: 32, el: 14 },
    { id: 'back', label: 'Verso', az: 180, el: 6 },
    { id: 'ring', label: 'Anneau', az: 40, el: 20, dist: 0.45, target: [0, 0.75, 0] },
  ],
  create() {
    const group = new THREE.Group();
    const CW = 512, CH = Math.round(512 * L / W);
    const cF = createCanvas(CW, CH), cB = createCanvas(CW, CH);
    const tF = canvasTexture(cF), tB = canvasTexture(cB);
    const weave = strapNormal().clone();
    weave.repeat.set(3, 12);
    const mF = fabricMaterial({ map: tF, normalMap: weave, normalScale: 0.7, roughness: 0.75, sheen: 0.6 });
    const mB = fabricMaterial({ map: tB, normalMap: weave, normalScale: 0.7, roughness: 0.75, sheen: 0.6 });
    const plain = fabricMaterial({ normalMap: weave, normalScale: 0.7, roughness: 0.75, sheen: 0.6 });
    // alpha : coins arrondis en bas
    const ac = createCanvas(256, 1024);
    const actx = ac.getContext('2d');
    actx.fillStyle = '#000'; actx.fillRect(0, 0, 256, 1024);
    actx.fillStyle = '#fff';
    const r = (R_CORNER / W) * 256;
    actx.beginPath();
    actx.moveTo(0, 0); actx.lineTo(256, 0); actx.lineTo(256, 1024 - r);
    actx.arcTo(256, 1024, 256 - r, 1024, r); actx.lineTo(r, 1024); actx.arcTo(0, 1024, 0, 1024 - r, r);
    actx.closePath(); actx.fill();
    const alpha = canvasTexture(ac, { srgb: false });
    for (const m of [mF, mB]) { m.alphaMap = alpha; m.alphaTest = 0.5; m.side = THREE.FrontSide; }

    const front = paramSurface(24, 120, (s, t, v) => surf(s, t, TH / 2, v));
    const back = paramSurface(24, 120, (s, t, v) => surf(1 - s, t, -TH / 2, v));
    group.add(new THREE.Mesh(front, mF), new THREE.Mesh(back, mB));
    // tranche : contour en tube
    const edge = [];
    const add = (s, t) => edge.push(surf(s, t, 0, new THREE.Vector3()));
    for (let i = 0; i <= 60; i++) add(1, 1 - i / 60 * (1 - R_CORNER / L));
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; add(1 - (R_CORNER - Math.cos(a) * R_CORNER) / W, (R_CORNER - Math.sin(a) * R_CORNER) / L); }
    for (let i = 1; i < 20; i++) add(1 - (R_CORNER + (i / 20) * (W - 2 * R_CORNER)) / W, 0);
    for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + (i / 8) * Math.PI / 2; add((R_CORNER + Math.cos(a) * R_CORNER) / W, (R_CORNER - Math.sin(a) * R_CORNER) / L); }
    for (let i = 0; i <= 60; i++) add(0, R_CORNER / L + (i / 60) * (1 - R_CORNER / L));
    const edgeMesh = new THREE.Mesh(tube(edge, { rx: TH / 2, ry: TH / 2, radial: 8, side: (i, T) => frame(0.5).normal }), plain);
    group.add(edgeMesh);
    // boucle repliée autour de l'anneau
    const top = frame(1);
    const ringR = 1.35, wire = 0.085;
    const ringCenter = top.c.clone().add(new THREE.Vector3(0, 0.75 + ringR, -0.05));
    const loopCtrl = [
      top.c.clone().addScaledVector(top.normal, 0.0).add(new THREE.Vector3(0, -0.3, 0)),
      top.c.clone().add(new THREE.Vector3(0, 0.25, 0.12)),
      top.c.clone().add(new THREE.Vector3(0, 0.62, 0.14)),
      top.c.clone().add(new THREE.Vector3(0, 0.78, -0.05)),
      top.c.clone().add(new THREE.Vector3(0, 0.6, -0.26)),
      top.c.clone().add(new THREE.Vector3(0, 0.1, -0.3)),
      top.c.clone().add(new THREE.Vector3(0, -1.6, -0.24)),
    ];
    const loopPts = curvePoints(loopCtrl, 60);
    const loop = new THREE.Mesh(tube(loopPts, { rx: W / 2, ry: TH / 2, side: () => top.side, radial: 16, square: 0.92 }), plain);
    group.add(loop);
    // anneau brisé (2 spires)
    const metal = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.18 });
    const ring = new THREE.Group();
    for (let k = 0; k < 2; k++) {
      const pts = [];
      for (let i = 0; i <= 140; i++) {
        const a = (i / 140) * Math.PI * 2 * (k ? 0.92 : 1) + (k ? 0.3 : 0);
        pts.push(new THREE.Vector3(0, Math.sin(a - Math.PI / 2) * ringR, Math.cos(a - Math.PI / 2) * ringR).add(new THREE.Vector3((k - 0.5) * wire * 2.05, 0, 0)));
      }
      ring.add(new THREE.Mesh(tube(pts, { rx: wire, ry: wire, radial: 10, caps: true }), metal));
    }
    ring.position.copy(ringCenter);
    ring.rotation.y = 0.25;
    group.add(ring);
    group.position.y = -(L + 2.5) / 2;

    function compose(c, t, zc, state, mirror) {
      const ctx = c.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = state.color;
      ctx.fillRect(0, 0, CW, CH);
      const px = CW / W;
      if (zc) ctx.drawImage(zc, 0, 0, CW, CH);
      if (state.options.stitch !== 'off') {
        const st = { width: 4, dash: [14, 9], color: 'rgba(0,0,0,0.42)', light: 'rgba(255,255,255,0.22)' };
        const i = 0.17 * px;
        stitch(ctx, [[i, 1.9 * px], [i, CH - i], [CW - i, CH - i], [CW - i, 1.9 * px]], st);
        // couture de la boucle (carré + croix)
        const y0 = 0.25 * px, y1 = 1.6 * px;
        stitch(ctx, [[i, y0], [CW - i, y0], [CW - i, y1], [i, y1], [i, y0], [CW - i, y1]], st);
        stitch(ctx, [[CW - i, y0], [i, y1]], st);
      }
      t.needsUpdate = true;
    }

    return {
      group,
      update(state) {
        compose(cF, tF, state.zones.front, state, false);
        compose(cB, tB, state.zones.back, state, true);
        plain.color.set(state.color);
        const inner = shade(state.color, 0.7);
        [mF, mB, plain].forEach((m) => { setInner(m, inner); m.sheenColor.set('#ffffff').lerp(new THREE.Color(state.color), 0.8); });
        const satin = state.options.weave === 'printed';
        [mF, mB, plain].forEach((m) => { m.normalScale.setScalar(satin ? 0.25 : 0.8); m.roughness = satin ? 0.5 : 0.8; m.sheen = satin ? 0.6 : 0.3; });
        const M = METALS[state.options.ring === 'gold' ? 'gold' : state.options.ring === 'black' ? 'black' : 'silver'];
        metal.color.set(M.color);
      },
      dispose() {
        group.traverse((o) => o.isMesh && o.geometry.dispose());
        [tF, tB, alpha].forEach((t) => t.dispose());
        [mF, mB, plain, metal].forEach((m) => m.dispose());
      },
    };
  },
};
