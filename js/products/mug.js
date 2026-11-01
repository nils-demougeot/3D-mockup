import * as THREE from 'three';
import { paramSurface, lathe, tube, curvePoints, smoothProfile } from '../core/geometry.js';
import { makeWrap } from './wrap.js';
import { fineGrainNormal } from '../core/textures.js';

const COLORS = [
  { name: 'Blanc', hex: '#f7f6f2' }, { name: 'Noir', hex: '#1c1c1e' }, { name: 'Crème', hex: '#efe6d2' },
  { name: 'Marine', hex: '#1f2a44' }, { name: 'Rouge', hex: '#c8202f' }, { name: 'Sauge', hex: '#9aae94' },
  { name: 'Rose', hex: '#f2b8c6' }, { name: 'Jaune', hex: '#f2c84b' }, { name: 'Bleu', hex: '#3d6fd8' },
];
const INNER = [
  { value: 'same', label: 'Comme l\'extérieur' }, { value: '#f7f6f2', label: 'Blanc' }, { value: '#1c1c1e', label: 'Noir' },
  { value: '#c8202f', label: 'Rouge' }, { value: '#3d6fd8', label: 'Bleu' }, { value: '#f2c84b', label: 'Jaune' },
  { value: '#f2b8c6', label: 'Rose' }, { value: '#2c4a36', label: 'Vert' },
];

// Dimensions (cm) par modèle
const MODELS = {
  ceramic: { R: 4.1, y0: 0.7, y1: 9.15, H: 9.6, wall: 0.32 },
  enamel: { R: 4.2, y0: 0.45, y1: 7.6, H: 8.0, wall: 0.08 },
};

function zonesFor(m) {
  const C = 2 * Math.PI * m.R;
  const h = m.y1 - m.y0;
  return { C, h };
}

export default {
  id: 'mug',
  name: 'Mug',
  category: 'Goodies',
  colors: COLORS,
  defaultColor: '#f7f6f2',
  zones: [
    { id: 'front', label: 'Face avant', w: 9, h: 7.8, main: true, hint: 'Visible anse à droite' },
    { id: 'back', label: 'Face arrière', w: 9, h: 7.8, hint: 'Visible anse à gauche' },
    { id: 'wrap', label: 'Tour complet', w: 20, h: 8.4, hint: 'Visuel panoramique (sous les faces)' },
  ],
  options: [
    { id: 'model', label: 'Modèle', type: 'segmented', default: 'ceramic', rebuild: true, choices: [{ value: 'ceramic', label: 'Céramique' }, { value: 'enamel', label: 'Émaillé' }] },
    { id: 'inner', label: 'Intérieur & anse', type: 'swatches', default: 'same', choices: INNER },
    { id: 'finish', label: 'Finition', type: 'segmented', default: 'gloss', choices: [{ value: 'gloss', label: 'Brillant' }, { value: 'matte', label: 'Mat' }] },
  ],
  views: [
    { id: 'front', label: 'Face', az: 0, el: 14 },
    { id: 'three', label: '3/4', az: -40, el: 18 },
    { id: 'back', label: 'Arrière', az: 180, el: 14 },
    { id: 'top', label: 'Dessus', az: 20, el: 62 },
  ],
  create() {
    const group = new THREE.Group();
    const grain = fineGrainNormal().clone();
    grain.repeat.set(6, 6);
    const outer = new THREE.MeshPhysicalMaterial({ roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, normalMap: grain });
    outer.normalScale.set(0.05, 0.05);
    const inner = new THREE.MeshPhysicalMaterial({ roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
    const wallMat = new THREE.MeshPhysicalMaterial({ roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
    const rimMetal = new THREE.MeshPhysicalMaterial({ color: '#2a2c33', metalness: 0.6, roughness: 0.35 });
    let model = null, wrap = null;

    function build(name) {
      model = name;
      group.clear();
      const m = MODELS[name];
      const { C, h } = zonesFor(m);
      wrap?.texture.dispose();
      const zw = (cm) => cm; // largeur en cm
      wrap = makeWrap({
        circumference: C, height: h, W: 2048, H: 1024,
        zones: [
          { id: 'wrap', u: 0.5, v: 0.5, w: zw(Math.min(20, C - 5.5)), h: Math.min(8.4, h - 0.2) },
          { id: 'front', u: 0.75, v: 0.5, w: 9, h: Math.min(7.8, h - 0.4) },
          { id: 'back', u: 0.25, v: 0.5, w: 9, h: Math.min(7.8, h - 0.4) },
        ],
      });
      wallMat.map = wrap.texture;
      wallMat.needsUpdate = true;
      const R = m.R;
      // paroi imprimable : u=0 au niveau de l'anse (+X)
      const wall = paramSurface(160, 6, (u, v, t) => {
        const th = Math.PI / 2 + u * Math.PI * 2;
        t.set(R * Math.sin(th), m.y0 + (m.y1 - m.y0) * v, R * Math.cos(th));
      });
      group.add(new THREE.Mesh(wall, wallMat));
      if (name === 'ceramic') {
        const foot = lathe(smoothProfile([[0.001, 0], [3.55, 0], [3.85, 0.08], [4.02, 0.3], [4.09, 0.5], [R, m.y0]], 4), 128);
        group.add(new THREE.Mesh(foot, outer));
        const top = lathe(smoothProfile([[R, m.y1], [R, 9.42], [4.04, 9.58], [3.9, 9.6], [3.8, 9.48], [3.78, 9.2], [3.78, 1.4], [3.6, 0.9], [3.1, 0.72], [0.001, 0.7]], 4), 128);
        group.add(new THREE.Mesh(top, inner));
        const ctrl = [[3.95, 7.9, 0], [5.6, 8.35, 0], [7.3, 7.7, 0], [7.7, 5.6, 0], [6.9, 3.4, 0], [5.2, 2.5, 0], [3.95, 2.4, 0]];
        const pts = curvePoints(ctrl.map((p) => new THREE.Vector3(...p)), 90);
        const handle = new THREE.Mesh(tube(pts, { rx: (t) => 0.82 - 0.12 * Math.sin(t * Math.PI), ry: 0.5, side: () => new THREE.Vector3(0, 0, 1), radial: 24, square: 0.35 }), inner);
        group.add(handle);
      } else {
        // mug émaillé type camping
        const foot = lathe(smoothProfile([[0.001, 0.02], [3.9, 0.02], [4.12, 0.12], [4.19, 0.3], [R, m.y0]], 4), 128);
        group.add(new THREE.Mesh(foot, outer));
        const top = lathe([[R, m.y1], [R, 7.82], [R - m.wall, 7.82], [R - m.wall, 0.45], [3.8, 0.2], [0.001, 0.18]], 128);
        group.add(new THREE.Mesh(top, inner));
        const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.13, 16, 128), rimMetal);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 7.9;
        group.add(rim);
        const ctrl = [[4.0, 7.1, 0], [6.4, 7.3, 0], [7.1, 6.0, 0], [6.6, 3.6, 0], [5.2, 2.4, 0], [4.0, 2.1, 0]];
        const pts = curvePoints(ctrl.map((p) => new THREE.Vector3(...p)), 90);
        const handle = new THREE.Mesh(tube(pts, { rx: 0.75, ry: 0.13, side: () => new THREE.Vector3(0, 0, 1), radial: 20, square: 0.8 }), inner);
        group.add(handle);
        const handleRim = new THREE.Mesh(tube(pts, { rx: 0.8, ry: 0.08, side: () => new THREE.Vector3(0, 0, 1), radial: 12, square: 0.9 }), rimMetal);
        handleRim.scale.setScalar(1.0);
        group.add(handleRim);
      }
      group.position.y = -m.H / 2;
    }

    return {
      group,
      update(state) {
        let rebuilt = false;
        const name = state.options.model || 'ceramic';
        if (name !== model) { build(name); rebuilt = true; }
        const innerCol = state.options.inner === 'same' || !state.options.inner ? state.color : state.options.inner;
        const rough = state.options.finish === 'matte' ? 0.55 : 0.12;
        const cc = state.options.finish === 'matte' ? 0.0 : 1;
        for (const mm of [outer, inner, wallMat]) { mm.roughness = rough; mm.clearcoat = cc; }
        outer.color.set(state.color);
        inner.color.set(innerCol);
        wallMat.color.set('#ffffff');
        wrap.draw(state, { background: state.color });
        return { rebuilt };
      },
      dispose() {
        group.traverse((o) => o.isMesh && o.geometry.dispose());
        wrap?.texture.dispose();
        [outer, inner, wallMat, rimMetal].forEach((m) => m.dispose());
      },
    };
  },
};
