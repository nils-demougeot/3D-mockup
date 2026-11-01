import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { createCanvas, canvasTexture, silhouette, brushedRoughness } from '../core/textures.js';
import { holoMaterial } from '../core/materials.js';
import { cutShape, planarUV, fillShape } from './cutshape.js';

const SIZE = 8; // cm (côté du visuel)
const PAD = 1.3; // marge de travail autour du visuel

export default {
  id: 'sticker',
  name: 'Sticker',
  category: 'Papeterie',
  noColor: true,
  colors: [],
  defaultColor: '#ffffff',
  zones: [
    { id: 'art', label: 'Visuel', w: SIZE, h: SIZE, main: true, transparent: true, hint: 'PNG à fond transparent : la découpe suit la forme' },
  ],
  options: [
    { id: 'shape', label: 'Découpe', type: 'segmented', default: 'diecut', choices: [{ value: 'diecut', label: 'À la forme' }, { value: 'circle', label: 'Rond' }, { value: 'rounded', label: 'Carré arrondi' }, { value: 'rect', label: 'Rectangle' }] },
    { id: 'border', label: 'Marge blanche', type: 'range', min: 0, max: 60, step: 1, default: 22, unit: 'px', showIf: { shape: 'diecut' } },
    { id: 'finish', label: 'Finition', type: 'select', default: 'gloss', choices: [{ value: 'gloss', label: 'Vinyle brillant' }, { value: 'matte', label: 'Vinyle mat' }, { value: 'holo', label: 'Holographique (total)' }, { value: 'holo-white', label: 'Holographique (sur le blanc)' }, { value: 'glitter', label: 'Pailleté' }, { value: 'clear', label: 'Transparent' }] },
    { id: 'support', label: 'Présentation', type: 'segmented', default: 'float', rebuild: true, choices: [{ value: 'float', label: 'Coin décollé' }, { value: 'laptop', label: 'Sur un laptop' }] },
  ],
  views: [
    { id: 'three', label: '3/4', az: 18, el: 34, dist: 0.8 },
    { id: 'top', label: 'Dessus', az: 0, el: 78, dist: 0.8 },
    { id: 'grazing', label: 'Reflets', az: -40, el: 30, dist: 0.8 },
    { id: 'low', label: 'Rasant', az: 35, el: 12 },
  ],
  create() {
    const group = new THREE.Group();
    const holder = new THREE.Group();
    group.add(holder);
    let topTex = null, holoTex = null;
    const paper = new THREE.MeshPhysicalMaterial({ color: '#f4f4f2', roughness: 0.7 });
    let topMat = null;
    const laptopMat = new THREE.MeshPhysicalMaterial({ color: '#4a4c52', metalness: 0.85, roughness: 0.38, roughnessMap: brushedRoughness() });
    let key = '';
    let laptop = null;

    function buildLaptop() {
      const g = new THREE.Group();
      const lid = new THREE.Mesh(new RoundedBoxGeometry(32, 21.5, 0.6, 6, 0.6), laptopMat);
      lid.position.set(0, 0, -0.32);
      g.add(lid);
      return g;
    }

    function rebuild(state) {
      const o = state.options;
      const zc = state.zones.art;
      holder.clear();
      // canvas de travail avec marge
      const src = zc || createCanvas(1024, 1024);
      const W = Math.round(src.width * PAD), H = Math.round(src.height * PAD);
      const work = createCanvas(W, H);
      work.getContext('2d').drawImage(src, (W - src.width) / 2, (H - src.height) / 2);
      const mode = o.shape || 'diecut';
      const sizeWorld = SIZE * PAD;
      const cs = cutShape(work, { mode, offsetPx: (o.border ?? 22) * (src.width / 1024), size: sizeWorld });
      const { shape, points, k } = cs;
      const depth = 0.035;
      const body = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
      const face = planarUV(new THREE.ShapeGeometry(shape, 4), W, H, k);
      face.translate(0, 0, depth + 0.002);
      // texture de face : blanc (ou transparent) sous le visuel
      const c = createCanvas(W, H);
      const ctx = c.getContext('2d');
      const clear = o.finish === 'clear';
      if (!clear) fillShape(ctx, points, k, W, H, '#ffffff');
      ctx.drawImage(work, 0, 0);
      topTex?.dispose();
      topTex = canvasTexture(c);
      // masque holo
      const hc = createCanvas(W / 2, H / 2);
      const hctx = hc.getContext('2d');
      hctx.fillStyle = '#ffffff';
      hctx.fillRect(0, 0, hc.width, hc.height);
      if (o.finish === 'holo-white') {
        // holo là où le visuel est transparent ou blanc
        const s = createCanvas(W, H);
        const sctx = s.getContext('2d', { willReadFrequently: true });
        sctx.drawImage(work, 0, 0);
        const img = sctx.getImageData(0, 0, W, H);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const white = Math.min(d[i], d[i + 1], d[i + 2]) > 225;
          const a = white ? 0 : d[i + 3];
          d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = a;
        }
        sctx.putImageData(img, 0, 0);
        hctx.drawImage(s, 0, 0, hc.width, hc.height);
      }
      holoTex?.dispose();
      holoTex = canvasTexture(hc, { srgb: false });
      topMat?.dispose();
      const finish = o.finish || 'gloss';
      if (finish === 'holo' || finish === 'holo-white' || finish === 'glitter') {
        topMat = holoMaterial({ map: topTex, holoMap: holoTex, glitter: finish === 'glitter', strength: finish === 'glitter' ? 0.75 : 1 });
      } else {
        topMat = new THREE.MeshPhysicalMaterial({
          map: topTex,
          roughness: finish === 'matte' ? 0.55 : 0.28,
          clearcoat: finish === 'matte' ? 0 : 1,
          clearcoatRoughness: 0.04,
          transparent: clear, alphaTest: clear ? 0.02 : 0,
        });
      }
      const bodyMat = clear ? new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.9, roughness: 0.1, thickness: 0.03, transparent: true, opacity: 0.25 }) : paper;
      const bodyMesh = new THREE.Mesh(body, bodyMat);
      const faceMesh = new THREE.Mesh(face, topMat);
      const sticker = new THREE.Group();
      sticker.add(bodyMesh, faceMesh);
      // présentation
      const float = (o.support || 'float') === 'float';
      if (float) {
        // coin inférieur droit décollé + légère courbure
        let maxS = -Infinity;
        const dir = new THREE.Vector2(1, -1).normalize();
        for (const p of points) maxS = Math.max(maxS, p.dot(dir));
        const s0 = maxS - 2.0, R = 1.1;
        for (const g of [body, face]) {
          const pa = g.attributes.position;
          for (let i = 0; i < pa.count; i++) {
            const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
            const s = x * dir.x + y * dir.y;
            if (s > s0) {
              const e = s - s0;
              const ang = e / R;
              const cl = Math.min(ang, Math.PI * 0.62);
              const sNew = s0 + Math.sin(cl) * (R - z) + (ang - cl) * R * Math.cos(cl);
              const zNew = R - Math.cos(cl) * (R - z) + (ang - cl) * R * Math.sin(cl);
              pa.setXYZ(i, x + dir.x * (sNew - s), y + dir.y * (sNew - s), zNew);
            }
          }
          pa.needsUpdate = true;
          g.computeVertexNormals();
        }
        sticker.rotation.x = -Math.PI / 2;
        sticker.position.y = 0.0;
        holder.add(sticker);
      } else {
        laptop = buildLaptop();
        holder.add(laptop);
        sticker.position.set(5.5, -1.5, 0.0);
        sticker.rotation.z = -0.18;
        holder.add(sticker);
        holder.rotation.x = 0;
      }
      if (float) {
        holder.rotation.x = 0;
      } else {
        holder.rotation.x = -Math.PI / 2 + 0.0;
      }
      group.rotation.x = 0;
    }

    return {
      group,
      update(state) {
        const o = state.options;
        const k = [state.zones.art?.width, o.shape, o.border, o.finish, o.support, state.zones.art ? 1 : 0, state.rev].join('|');
        if (k === key) return {};
        key = k;
        rebuild(state);
        return { rebuilt: true };
      },
      dispose() {
        group.traverse((o) => o.isMesh && o.geometry.dispose());
        topTex?.dispose(); holoTex?.dispose(); topMat?.dispose(); paper.dispose(); laptopMat.dispose();
      },
    };
  },
};
