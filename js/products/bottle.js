import * as THREE from 'three';
import { paramSurface, lathe, smoothProfile, tube, curvePoints } from '../core/geometry.js';
import { makeWrap } from './wrap.js';
import { powderNormal, bambooTexture, brushedRoughness, silhouette, inkMask } from '../core/textures.js';

const R = 3.6;
const Y0 = 1.3, Y1 = 17.6;
const C = 2 * Math.PI * R;

const COLORS = [
  { name: 'Noir', hex: '#1c1c1e' }, { name: 'Blanc', hex: '#f3f2ee' }, { name: 'Marine', hex: '#1f2a44' },
  { name: 'Vert forêt', hex: '#2c4a36' }, { name: 'Sauge', hex: '#9aae94' }, { name: 'Bleu ciel', hex: '#a8c8e6' },
  { name: 'Corail', hex: '#ef6f5e' }, { name: 'Lilas', hex: '#bfaee0' }, { name: 'Sable', hex: '#d9c7a7' }, { name: 'Moutarde', hex: '#d9a531' },
];

export default {
  id: 'bottle',
  name: 'Gourde isotherme',
  category: 'Goodies',
  colors: COLORS,
  defaultColor: '#2c4a36',
  zones: [
    { id: 'front', label: 'Face avant', w: 6.5, h: 12, main: true, hint: 'Logo principal' },
    { id: 'back', label: 'Dos', w: 6.5, h: 12, hint: 'Face opposée' },
    { id: 'wrap', label: 'Tour complet', w: 21, h: 15.5, hint: 'Visuel panoramique (sous les faces)' },
  ],
  options: [
    { id: 'finish', label: 'Finition', type: 'segmented', default: 'powder', choices: [{ value: 'powder', label: 'Mat (poudre)' }, { value: 'gloss', label: 'Brillant' }, { value: 'steel', label: 'Inox brossé' }] },
    { id: 'print', label: 'Marquage', type: 'segmented', default: 'color', choices: [{ value: 'color', label: 'Impression' }, { value: 'engrave', label: 'Gravure laser' }] },
    { id: 'cap', label: 'Bouchon', type: 'segmented', default: 'bamboo', choices: [{ value: 'bamboo', label: 'Bambou' }, { value: 'steel', label: 'Inox' }, { value: 'black', label: 'Noir' }, { value: 'match', label: 'Assorti' }] },
  ],
  views: [
    { id: 'front', label: 'Face', az: 0, el: 10 },
    { id: 'three', label: '3/4', az: 35, el: 16 },
    { id: 'back', label: 'Dos', az: 180, el: 10 },
    { id: 'top', label: 'Dessus', az: 15, el: 55 },
  ],
  create() {
    const group = new THREE.Group();
    const wrap = makeWrap({
      circumference: C, height: Y1 - Y0, W: 2048, H: 1536,
      zones: [
        { id: 'wrap', u: 0.5, v: 0.5, w: 21, h: 15.5 },
        { id: 'front', u: 0.5, v: 0.55, w: 6.5, h: 12 },
        { id: 'back', u: 0.0, v: 0.55, w: 6.5, h: 12 },
      ],
    });
    const mask = makeWrap({
      circumference: C, height: Y1 - Y0, W: 1024, H: 768,
      zones: [
        { id: 'wrap', u: 0.5, v: 0.5, w: 21, h: 15.5 },
        { id: 'front', u: 0.5, v: 0.55, w: 6.5, h: 12 },
        { id: 'back', u: 0.0, v: 0.55, w: 6.5, h: 12 },
      ],
    });
    mask.texture.colorSpace = THREE.NoColorSpace;
    const powder = powderNormal().clone();
    powder.repeat.set(6, 9);
    const bodyMat = new THREE.MeshPhysicalMaterial({ roughness: 0.5, normalMap: powder });
    bodyMat.normalScale.set(0.35, 0.35);
    const wallMat = new THREE.MeshPhysicalMaterial({ map: wrap.texture, roughness: 0.5, normalMap: powder, metalnessMap: mask.texture, metalness: 1 });
    wallMat.normalScale.set(0.35, 0.35);
    const steel = new THREE.MeshPhysicalMaterial({ color: '#d4d7db', metalness: 1, roughness: 0.3, roughnessMap: brushedRoughness() });
    const bamboo = new THREE.MeshPhysicalMaterial({ map: bambooTexture(), roughness: 0.6, clearcoat: 0.3 });
    const capMat = new THREE.MeshPhysicalMaterial({ color: '#1c1c1e', roughness: 0.45 });
    const darkPlastic = new THREE.MeshPhysicalMaterial({ color: '#202022', roughness: 0.55 });

    // Corps
    const bottom = lathe(smoothProfile([[0.001, 0.05], [2.9, 0.05], [3.3, 0.12], [3.52, 0.4], [3.6, 0.85], [R, Y0]], 5), 128);
    const wall = paramSurface(160, 8, (u, v, t) => {
      const th = (u - 0.5) * Math.PI * 2;
      t.set(R * Math.sin(th), Y0 + (Y1 - Y0) * v, R * Math.cos(th));
    });
    const shoulder = lathe(smoothProfile([[R, Y1], [R, 17.9], [3.6, 18.4], [3.45, 19.6], [3.0, 20.7], [2.55, 21.5], [2.42, 22.1], [2.42, 22.7]], 6), 128);
    const bodyParts = [new THREE.Mesh(bottom, bodyMat), new THREE.Mesh(wall, wallMat), new THREE.Mesh(shoulder, bodyMat)];
    bodyParts.forEach((m) => group.add(m));
    // Bague acier sous le bouchon
    const ring = new THREE.Mesh(lathe([[2.42, 22.7], [2.5, 22.75], [2.5, 23.1], [2.42, 23.15]], 96), steel);
    group.add(ring);
    // Bouchon
    const capGeo = lathe(smoothProfile([[2.55, 23.15], [2.62, 23.4], [2.62, 26.6], [2.5, 27.15], [2.1, 27.35], [0.001, 27.4]], 5), 96);
    const cap = new THREE.Mesh(capGeo, bamboo);
    group.add(cap);
    // Joint
    const seal = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.06, 8, 96), darkPlastic);
    seal.rotation.x = Math.PI / 2; seal.position.y = 23.18;
    group.add(seal);
    // Anse de transport
    const loopPts = curvePoints([[-1.3, 27.2, 0], [-1.25, 28.6, 0], [0, 29.4, 0], [1.25, 28.6, 0], [1.3, 27.2, 0]].map((p) => new THREE.Vector3(...p)), 60);
    const loop = new THREE.Mesh(tube(loopPts, { rx: 0.55, ry: 0.32, side: () => new THREE.Vector3(0, 0, 1), radial: 18, square: 0.5 }), steel);
    group.add(loop);
    group.position.y = -14.5;

    const silCache = new WeakMap();
    const silFor = (zc, color) => {
      const k = zc;
      const key = color;
      if (!silCache.has(k)) silCache.set(k, {});
      const e = silCache.get(k);
      if (!e[key]) e[key] = key === '#000000' ? silhouette(zc, color) : inkMask(zc, color);
      return e[key];
    };

    return {
      group,
      update(state) {
        const o = state.options;
        const finish = o.finish || 'powder';
        const isSteel = finish === 'steel';
        const base = isSteel ? '#cfd2d6' : state.color;
        for (const m of [bodyMat, wallMat]) {
          m.roughness = finish === 'gloss' ? 0.16 : isSteel ? 0.32 : 0.55;
          m.clearcoat = finish === 'gloss' ? 1 : 0;
          m.normalScale.setScalar(finish === 'powder' ? 0.12 : 0.02);
          m.roughnessMap = isSteel ? brushedRoughness() : null;
          m.needsUpdate = true;
        }
        bodyMat.color.set(base);
        bodyMat.metalness = isSteel ? 1 : 0;
        const engrave = o.print === 'engrave';
        // Gravure : le motif révèle l'inox brut
        let zones = state.zones;
        if (engrave) {
          zones = {};
          for (const k in state.zones) zones[k] = state.zones[k] ? silFor(state.zones[k], isSteel ? '#8f9297' : '#d3d5d8') : null;
        }
        wrap.draw({ zones }, { background: base });
        let maskZones = {};
        if (engrave) maskZones = zones;
        else if (isSteel) for (const k in state.zones) maskZones[k] = state.zones[k] ? silFor(state.zones[k], '#000000') : null;
        mask.draw({ zones: maskZones }, { background: isSteel ? '#ffffff' : '#000000' });
        // le masque doit être blanc là où c'est métallique
        if (engrave && !isSteel) {
          const ctx = mask.canvas.getContext('2d');
          ctx.globalCompositeOperation = 'source-over';
          // les silhouettes gris clair -> blanc
          const img = ctx.getImageData(0, 0, mask.canvas.width, mask.canvas.height);
          for (let i = 0; i < img.data.length; i += 4) { const v = img.data[i] > 40 ? 255 : 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; }
          ctx.putImageData(img, 0, 0);
          mask.texture.needsUpdate = true;
        }
        wallMat.metalness = 1;
        const capStyle = o.cap || 'bamboo';
        cap.material = capStyle === 'bamboo' ? bamboo : capStyle === 'steel' ? steel : capMat;
        capMat.color.set(capStyle === 'black' ? '#1c1c1e' : base);
        capMat.metalness = capStyle === 'match' && isSteel ? 1 : 0;
        loop.material = capStyle === 'bamboo' || capStyle === 'steel' ? steel : capMat;
      },
      dispose() {
        group.traverse((o) => o.isMesh && o.geometry.dispose());
        wrap.texture.dispose(); mask.texture.dispose();
        [bodyMat, wallMat, steel, bamboo, capMat, darkPlastic].forEach((m) => m.dispose());
      },
    };
  },
};
