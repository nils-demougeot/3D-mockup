import * as THREE from 'three';
import { paramSurface, lathe, smoothProfile, tube, curvePoints } from '../core/geometry.js';
import { createCanvas, canvasTexture, inkMask } from '../core/textures.js';
import { METALS } from '../core/materials.js';

const RB = 0.5;          // rayon du corps (cm)
const B0 = 4.3, B1 = 12.3; // corps imprimable (y)
const L = B1 - B0, C = 2 * Math.PI * RB;
const ZONE = { w: 5, h: 0.7 };

const COLORS = [
  { name: 'Blanc', hex: '#f4f4f2' }, { name: 'Noir', hex: '#1c1c1e' }, { name: 'Marine', hex: '#1f2a44' },
  { name: 'Rouge', hex: '#c8202f' }, { name: 'Bleu', hex: '#3d6fd8' }, { name: 'Vert', hex: '#2f8f5b' },
  { name: 'Orange', hex: '#f08a24' }, { name: 'Violet', hex: '#7a3cff' }, { name: 'Rose', hex: '#f2b8c6' }, { name: 'Jaune', hex: '#f2c84b' },
];

export default {
  id: 'pen',
  name: 'Stylo',
  category: 'Goodies',
  colors: COLORS,
  defaultColor: '#1f2a44',
  zones: [
    { id: 'body', label: 'Corps', w: ZONE.w, h: ZONE.h, main: true, hint: 'Texte ou logo horizontal' },
  ],
  options: [
    { id: 'finish', label: 'Finition', type: 'segmented', default: 'gloss', choices: [{ value: 'gloss', label: 'Brillant' }, { value: 'matte', label: 'Soft touch' }, { value: 'alu', label: 'Alu' }] },
    { id: 'trim', label: 'Garnitures', type: 'segmented', default: 'chrome', choices: [{ value: 'chrome', label: 'Chrome' }, { value: 'gold', label: 'Or' }, { value: 'black', label: 'Noir' }] },
    { id: 'print', label: 'Marquage', type: 'segmented', default: 'color', choices: [{ value: 'color', label: 'Quadri' }, { value: 'white', label: 'Blanc' }, { value: 'engrave', label: 'Gravure' }] },
  ],
  views: [
    { id: 'front', label: 'Face', az: 0, el: 8, dist: 0.8 },
    { id: 'three', label: '3/4', az: 30, el: 28 },
    { id: 'logo', label: 'Logo', az: 0, el: 4, dist: 0.55 },
    { id: 'top', label: 'Dessus', az: 0, el: 70 },
  ],
  create() {
    const group = new THREE.Group();
    const pen = new THREE.Group();
    group.add(pen);
    const W = 2048, H = Math.round(2048 * (C / L));
    const canvas = createCanvas(W, H);
    const tex = canvasTexture(canvas);
    const body = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 });
    const plain = new THREE.MeshPhysicalMaterial({ roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 });
    const trim = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.12 });
    const grip = new THREE.MeshPhysicalMaterial({ color: '#1c1c1e', roughness: 0.7 });

    // pointe
    pen.add(new THREE.Mesh(lathe(smoothProfile([[0.001, 0], [0.06, 0.03], [0.1, 0.15], [0.28, 0.9], [0.36, 1.25]], 4), 64), trim));
    // grip strié
    const gp = [];
    for (let i = 0; i <= 60; i++) {
      const y = 1.25 + (i / 60) * 2.8;
      gp.push([0.44 + 0.03 * Math.max(0, Math.sin(i * 1.3)) * (i > 4 && i < 56 ? 1 : 0) - (i < 3 ? (3 - i) * 0.02 : 0), y]);
    }
    pen.add(new THREE.Mesh(lathe(gp, 64), grip));
    // bague
    pen.add(new THREE.Mesh(lathe(smoothProfile([[0.46, 4.05], [0.505, 4.12], [0.505, 4.3]], 3), 64), trim));
    // corps imprimable : u = le long du stylo, v = autour (0.5 = face caméra)
    const wall = paramSurface(64, 96, (u, v, t) => {
      const th = (0.5 - v) * Math.PI * 2;
      t.set(RB * Math.sin(th), B0 + u * L, RB * Math.cos(th));
    });
    pen.add(new THREE.Mesh(wall, body));
    pen.add(new THREE.Mesh(lathe(smoothProfile([[RB, B1], [0.5, 12.6], [0.47, 12.75]], 3), 64), plain));
    pen.add(new THREE.Mesh(lathe([[0.47, 12.75], [0.48, 12.8], [0.48, 13.0], [0.46, 13.05]], 64), trim));
    pen.add(new THREE.Mesh(lathe(smoothProfile([[0.46, 13.05], [0.46, 13.9], [0.42, 14.1], [0.3, 14.15], [0.001, 14.15]], 3), 64), plain));
    // bouton poussoir
    pen.add(new THREE.Mesh(lathe(smoothProfile([[0.24, 14.0], [0.25, 14.6], [0.2, 14.78], [0.001, 14.8]], 3), 48), trim));
    // clip (côté opposé à l'impression, visible en haut)
    const clipPts = curvePoints([[-0.44, 13.9, 0], [-0.68, 13.5, 0], [-0.72, 12.2, 0], [-0.7, 10.2, 0], [-0.6, 9.5, 0]].map((p) => new THREE.Vector3(...p)), 60);
    pen.add(new THREE.Mesh(tube(clipPts, { rx: 0.26, ry: 0.07, side: () => new THREE.Vector3(0, 0, 1), radial: 16, square: 0.85, caps: true }), trim));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), trim);
    ball.position.set(-0.6, 9.5, 0);
    pen.add(ball);

    pen.position.y = -7.4;
    group.rotation.z = -Math.PI / 2;
    group.rotation.y = 0.0;
    const wrapper = new THREE.Group();
    wrapper.add(group);
    wrapper.rotation.z = 0.12;
    // un peu surélevé pour l'ombre
    wrapper.position.y = 0.6;

    const cache = new WeakMap();
    const ink = (zc, col) => {
      if (!cache.has(zc)) cache.set(zc, {});
      const e = cache.get(zc);
      return e[col] || (e[col] = inkMask(zc, col));
    };

    return {
      group: wrapper,
      update(state) {
        const o = state.options;
        const alu = o.finish === 'alu';
        for (const m of [body, plain]) {
          m.roughness = o.finish === 'matte' ? 0.6 : alu ? 0.3 : 0.15;
          m.clearcoat = o.finish === 'gloss' ? 1 : 0;
          m.metalness = alu ? 0.9 : 0;
        }
        plain.color.set(state.color);
        body.color.set('#ffffff');
        const t = METALS[o.trim === 'gold' ? 'gold' : o.trim === 'black' ? 'black' : 'chrome'];
        trim.color.set(t.color);
        trim.roughness = t.roughness;
        // texture
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = state.color;
        ctx.fillRect(0, 0, W, H);
        const zc = state.zones.body;
        if (zc) {
          let img = zc;
          if (o.print === 'white') img = ink(zc, '#ffffff');
          if (o.print === 'engrave') img = ink(zc, alu ? '#d9dadc' : '#e8e4dc');
          const pw = (ZONE.w / L) * W, ph = (ZONE.h / C) * H;
          ctx.drawImage(img, W / 2 - pw / 2, H / 2 - ph / 2, pw, ph);
        }
        tex.needsUpdate = true;
      },
      dispose() {
        wrapper.traverse((o) => o.isMesh && o.geometry.dispose());
        tex.dispose();
        [body, plain, trim, grip].forEach((m) => m.dispose());
      },
    };
  },
};
