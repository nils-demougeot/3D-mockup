import * as THREE from 'three';
import { createCanvas, canvasTexture, sparkleNormal } from '../core/textures.js';
import { METALS } from '../core/materials.js';
import { lathe, smoothProfile } from '../core/geometry.js';
import { cutShape, planarUV, offsetPoints } from './cutshape.js';

const SIZE = 3.5; // cm
const PAD = 1.25;

export default {
  id: 'pin',
  name: 'Pin\'s',
  category: 'Goodies',
  noColor: true,
  colors: [],
  defaultColor: '#ffffff',
  zones: [
    { id: 'art', label: 'Visuel', w: SIZE, h: SIZE, main: true, transparent: true, hint: 'PNG à fond transparent : le contour métal suit la forme' },
  ],
  options: [
    { id: 'shape', label: 'Forme', type: 'segmented', default: 'diecut', choices: [{ value: 'diecut', label: 'À la forme' }, { value: 'circle', label: 'Rond' }, { value: 'rounded', label: 'Carré arrondi' }] },
    { id: 'metal', label: 'Métal', type: 'swatches', default: 'gold', choices: Object.entries(METALS).filter(([k]) => k !== 'chrome').map(([value, m]) => ({ value, label: m.label, hex: m.color })) },
    { id: 'enamel', label: 'Émail', type: 'segmented', default: 'hard', choices: [{ value: 'hard', label: 'Dur (lisse)' }, { value: 'soft', label: 'Mou (relief)' }, { value: 'glitter', label: 'Pailleté' }] },
    { id: 'rim', label: 'Bordure métal', type: 'range', min: 4, max: 40, step: 1, default: 14, unit: 'px' },
  ],
  views: [
    { id: 'three', label: '3/4', az: 22, el: 24 },
    { id: 'front', label: 'Face', az: 0, el: 6 },
    { id: 'back', label: 'Dos', az: 160, el: 18 },
    { id: 'grazing', label: 'Reflets', az: -45, el: 28 },
  ],
  create() {
    const group = new THREE.Group();
    const holder = new THREE.Group();
    group.add(holder);
    const metal = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.2 });
    const clutch = new THREE.MeshPhysicalMaterial({ color: '#1d1d1f', roughness: 0.5 });
    let faceTex = null, faceMat = null, key = '';

    function rebuild(state) {
      holder.clear();
      const o = state.options;
      const src = state.zones.art || createCanvas(1024, 1024);
      const W = Math.round(src.width * PAD), H = Math.round(src.height * PAD);
      const work = createCanvas(W, H);
      work.getContext('2d').drawImage(src, (W - src.width) / 2, (H - src.height) / 2);
      const rimPx = (o.rim ?? 14) * (src.width / 1024);
      const mode = o.shape || 'diecut';
      const outer = cutShape(work, { mode, offsetPx: rimPx * 2.2 + 2, size: SIZE * PAD });
      const k = outer.k;
      const rimW = rimPx * k * 2.2;
      // contour intérieur (émail)
      let innerPts;
      if (mode === 'diecut') {
        const inner = cutShape(work, { mode, offsetPx: 1, size: SIZE * PAD });
        innerPts = inner.points;
        // si pas de transparence, on rentre le contour extérieur
        if (inner.points.length === outer.points.length && inner.points[0].distanceTo(outer.points[0]) < 1e-6) innerPts = offsetPoints(outer.points, -rimW);
      } else {
        innerPts = offsetPoints(outer.points, -Math.max(rimW, 0.06));
      }
      const T = 0.22; // épaisseur
      const bevel = 0.04;
      const base = new THREE.ExtrudeGeometry(outer.shape, { depth: T, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
      base.translate(0, 0, -T / 2);
      const baseMesh = new THREE.Mesh(base, metal);
      holder.add(baseMesh);
      // face émaillée
      const shape = new THREE.Shape(innerPts);
      const soft = o.enamel === 'soft';
      const face = planarUV(new THREE.ShapeGeometry(shape, 4), W, H, k);
      const zTop = T / 2 + bevel;
      face.translate(0, 0, soft ? zTop - 0.035 : zTop + 0.003);
      if (!soft) {
        // dôme très léger (résine)
        const pa = face.attributes.position;
        let maxR = 0;
        for (let i = 0; i < pa.count; i++) maxR = Math.max(maxR, Math.hypot(pa.getX(i), pa.getY(i)));
        for (let i = 0; i < pa.count; i++) {
          const r = Math.hypot(pa.getX(i), pa.getY(i)) / maxR;
          pa.setZ(i, pa.getZ(i) + 0.02 * (1 - r * r));
        }
        face.computeVertexNormals();
      }
      // texture
      const c = createCanvas(W, H);
      const ctx = c.getContext('2d');
      const mcol = (METALS[o.metal] || METALS.gold).color;
      ctx.fillStyle = mcol;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(work, 0, 0);
      faceTex?.dispose();
      faceTex = canvasTexture(c);
      faceMat?.dispose();
      const glitter = o.enamel === 'glitter';
      faceMat = new THREE.MeshPhysicalMaterial({
        map: faceTex,
        roughness: soft ? 0.35 : 0.12,
        clearcoat: soft ? 0.3 : 1,
        clearcoatRoughness: 0.03,
        normalMap: glitter ? sparkleNormal() : null,
        metalness: glitter ? 0.35 : 0,
      });
      if (glitter) faceMat.normalScale = new THREE.Vector2(0.6, 0.6);
      const faceMesh = new THREE.Mesh(face, faceMat);
      holder.add(faceMesh);
      // dos : tige + fermoir papillon
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 12), metal);
      post.rotation.x = Math.PI / 2;
      post.position.z = -T / 2 - 0.45;
      holder.add(post);
      const clutchGeo = lathe(smoothProfile([[0.06, 0], [0.42, 0.0], [0.5, 0.08], [0.46, 0.18], [0.2, 0.2], [0.12, 0.5], [0.06, 0.52]], 3), 32);
      const cl = new THREE.Mesh(clutchGeo, clutch);
      cl.rotation.x = -Math.PI / 2;
      cl.position.z = -T / 2 - 0.62;
      holder.add(cl);
      // posé légèrement incliné
      holder.rotation.x = -0.32;
      holder.position.y = 0;
    }

    return {
      group,
      update(state) {
        const o = state.options;
        const m = METALS[o.metal] || METALS.gold;
        metal.color.set(m.color);
        metal.roughness = m.roughness;
        const k = [state.zones.art?.width, o.shape, o.rim, o.enamel, o.metal, state.rev, state.zones.art ? 1 : 0].join('|');
        if (k === key) return {};
        key = k;
        rebuild(state);
        return { rebuilt: true };
      },
      dispose() {
        group.traverse((o) => o.isMesh && o.geometry.dispose());
        faceTex?.dispose(); faceMat?.dispose(); metal.dispose(); clutch.dispose();
      },
    };
  },
};
