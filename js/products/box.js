import * as THREE from 'three';
import { createCanvas, canvasTexture, paintKraft, corrugatedTexture, kraftNormal, crumpleNormal } from '../core/textures.js';
import { paramSurface } from '../core/geometry.js';
import { fbm, smoothstep } from '../core/math.js';

const W = 30, D = 22, H = 10, T = 0.35; // cm
const PX = 40; // px / cm

const STOCKS = { kraft: '#c49a6c', white: '#f4f2ee', black: '#1d1d1f' };

const FACES = {
  top: { w: W, h: D },
  front: { w: W, h: H },
  back: { w: W, h: H },
  left: { w: D, h: H },
  right: { w: D, h: H },
  inside: { w: W, h: D },
  floor: { w: W, h: D },
};

export default {
  id: 'box',
  name: 'Boîte welcome pack',
  category: 'Packaging',
  colors: [
    { name: 'Kraft', hex: '#c49a6c' }, { name: 'Blanc', hex: '#f4f2ee' }, { name: 'Noir', hex: '#1d1d1f' },
    { name: 'Marine', hex: '#1f2a44' }, { name: 'Rouge', hex: '#c8202f' }, { name: 'Vert forêt', hex: '#2c4a36' },
    { name: 'Rose', hex: '#f2b8c6' }, { name: 'Sauge', hex: '#9aae94' }, { name: 'Jaune', hex: '#f2c84b' }, { name: 'Lilas', hex: '#bfaee0' },
  ],
  colorLabel: 'Couleur du carton / fond imprimé',
  defaultColor: '#c49a6c',
  zones: [
    { id: 'top', label: 'Dessus (couvercle)', w: W, h: D, main: true, hint: 'Face principale' },
    { id: 'front', label: 'Face avant', w: W, h: H, hint: 'Tranche avant' },
    { id: 'left', label: 'Côté gauche', w: D, h: H },
    { id: 'right', label: 'Côté droit', w: D, h: H },
    { id: 'back', label: 'Face arrière', w: W, h: H },
    { id: 'inside', label: 'Intérieur du couvercle', w: W, h: D, hint: 'Message de bienvenue, visible à l\'ouverture' },
    { id: 'floor', label: 'Fond intérieur', w: W, h: D, hint: 'Visible sans papier de soie' },
  ],
  options: [
    { id: 'open', label: 'Ouverture du couvercle', type: 'range', min: 0, max: 100, step: 1, default: 0, unit: '%' },
    { id: 'ink', label: 'Rendu de l\'encre', type: 'segmented', default: 'auto', choices: [{ value: 'auto', label: 'Auto' }, { value: 'normal', label: 'Opaque' }, { value: 'multiply', label: 'Multiply (kraft)' }] },
    { id: 'interior', label: 'Intérieur', type: 'segmented', default: 'white', choices: [{ value: 'kraft', label: 'Kraft' }, { value: 'white', label: 'Blanc' }, { value: 'black', label: 'Noir' }, { value: 'same', label: 'Comme dehors' }] },
    { id: 'tissue', label: 'Papier de soie', type: 'swatches', default: '#f6d4dc', choices: [{ value: 'none', label: 'Aucun' }, { value: '#f6d4dc', label: 'Rose' }, { value: '#ffffff', label: 'Blanc' }, { value: '#1d1d1f', label: 'Noir' }, { value: '#e9dfc9', label: 'Écru' }, { value: '#bcd3f0', label: 'Bleu' }] },
  ],
  views: [
    { id: 'three', label: '3/4', az: 32, el: 28 },
    { id: 'front', label: 'Face', az: 0, el: 12 },
    { id: 'top', label: 'Dessus', az: 0, el: 72 },
    { id: 'side', label: 'Côté', az: 90, el: 16 },
    { id: 'open', label: 'Ouverte', az: 14, el: 30, dist: 1.4, target: [0, 0.28, 0], set: { open: 100 } },
  ],
  create() {
    const group = new THREE.Group();
    const canv = {}, tex = {}, mats = {};
    const kn = kraftNormal().clone();
    kn.repeat.set(3, 3);
    for (const [id, f] of Object.entries(FACES)) {
      canv[id] = createCanvas(f.w * PX, f.h * PX);
      tex[id] = canvasTexture(canv[id]);
      mats[id] = new THREE.MeshPhysicalMaterial({ map: tex[id], roughness: 0.82, normalMap: kn });
      mats[id].normalScale.set(0.25, 0.25);
    }
    const edge = new THREE.MeshStandardMaterial({ map: corrugatedTexture(), roughness: 0.9 });
    const innerC = createCanvas(512, 512);
    const innerT = canvasTexture(innerC);
    const inner = new THREE.MeshPhysicalMaterial({ map: innerT, roughness: 0.85, normalMap: kn });
    inner.normalScale.set(0.25, 0.25);
    const bottomC = createCanvas(512, 512);
    const bottomT = canvasTexture(bottomC);
    const bottomMat = new THREE.MeshPhysicalMaterial({ map: bottomT, roughness: 0.9 });

    // panneau = boîte fine ; mats = [+x, -x, +y, -y, +z, -z]
    const panel = (w, h, d, m, pos) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(...pos);
      return mesh;
    };
    const E = edge;
    // fond
    group.add(panel(W, T, D, [E, E, mats.floor, bottomMat, E, E], [0, T / 2, 0]));
    // parois
    group.add(panel(W, H, T, [E, E, E, E, mats.front, inner], [0, H / 2, D / 2 - T / 2]));
    group.add(panel(W, H, T, [E, E, E, E, inner, mats.back], [0, H / 2, -D / 2 + T / 2]));
    group.add(panel(T, H, D - 2 * T, [inner, mats.left, E, E, E, E], [-W / 2 + T / 2, H / 2, 0]));
    group.add(panel(T, H, D - 2 * T, [mats.right, inner, E, E, E, E], [W / 2 - T / 2, H / 2, 0]));
    // couvercle articulé à l'arrière
    const lid = new THREE.Group();
    lid.position.set(0, H, -D / 2);
    const lidTop = panel(W + 0.3, T, D + 0.15, [E, E, mats.top, mats.inside, E, E], [0, T / 2, (D + 0.15) / 2]);
    lid.add(lidTop);
    // rabat avant (rentre dans la boîte)
    const flapH = H * 0.72;
    lid.add(panel(W - 2 * T - 0.25, flapH, T, [E, E, E, E, inner, inner], [0, -flapH / 2, D - T * 1.6]));
    // oreilles latérales
    for (const s of [-1, 1]) {
      const shp = new THREE.Shape();
      shp.moveTo(0, 0); shp.lineTo(D - 3, 0); shp.lineTo(D - 3.8, -H * 0.62); shp.lineTo(1.5, -H * 0.62); shp.closePath();
      const g = new THREE.ExtrudeGeometry(shp, { depth: T, bevelEnabled: false });
      g.rotateY(-Math.PI / 2);
      const m = new THREE.Mesh(g, inner);
      m.position.set(s * (W / 2 - T * 1.6) + (s > 0 ? T / 2 : T / 2), 0, 1.4);
      lid.add(m);
    }
    group.add(lid);
    // papier de soie
    const tissueMat = new THREE.MeshPhysicalMaterial({ color: '#f6d4dc', roughness: 0.65, sheen: 1, sheenRoughness: 0.4, normalMap: crumpleNormal(), side: THREE.DoubleSide });
    tissueMat.normalScale.set(0.9, 0.9);
    const iw = W - 2 * T - 0.1, id = D - 2 * T - 0.1;
    const tissue = new THREE.Mesh(paramSurface(90, 70, (u, v, t) => {
      const x = (u - 0.5) * iw, z = (v - 0.5) * id;
      const edgeD = Math.min(u, 1 - u, v, 1 - v);
      const rise = (1 - smoothstep(0, 0.12, edgeD)) * H * 0.35;
      const y = H * 0.45 + fbm(u * 3.5, v * 3, 3) * 0.9 + rise + Math.sin(u * 7 + fbm(u, v, 2) * 4) * 0.18;
      const pull = (1 - smoothstep(0, 0.12, edgeD)) * 0.6;
      t.set(x * (1 - pull * 0.03), y, z * (1 - pull * 0.03));
    }, { flip: true }), tissueMat);
    tissue.userData.castShadow = false;
    group.add(tissue);
    group.position.set(0, -H / 2, 0);

    let target = 0.3, current = -1;
    const MAX = THREE.MathUtils.degToRad(112);
    const apply = () => { lid.rotation.x = -current * MAX; };

    function paintStock(ctx, w, h, color, seed) {
      if (color === STOCKS.kraft) paintKraft(ctx, 0, 0, w, h, color, seed);
      else {
        ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
        // léger grain
        ctx.save();
        for (let i = 0; i < (w * h) / 600; i++) {
          ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.025)`;
          ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
        }
        ctx.restore();
      }
    }

    return {
      group,
      update(state) {
        const o = state.options;
        const isKraft = state.color.toLowerCase() === STOCKS.kraft;
        const mode = o.ink === 'multiply' || (o.ink !== 'normal' && isKraft) ? 'multiply' : 'source-over';
        const interior = o.interior === 'same' ? state.color : STOCKS[o.interior || 'white'];
        let seed = 1;
        for (const [id, f] of Object.entries(FACES)) {
          const c = canv[id], ctx = c.getContext('2d');
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
          const bg = id === 'inside' || id === 'floor' ? interior : state.color;
          paintStock(ctx, c.width, c.height, bg, seed++);
          const zc = state.zones[id];
          if (zc) {
            ctx.save();
            ctx.globalCompositeOperation = bg === STOCKS.kraft ? mode : 'source-over';
            // face intérieure du couvercle : retournée pour être lisible couvercle ouvert
            if (id === 'inside') { ctx.translate(c.width, c.height); ctx.scale(-1, -1); }
            ctx.drawImage(zc, 0, 0, c.width, c.height);
            ctx.restore();
          }
          tex[id].needsUpdate = true;
        }
        const ictx = innerC.getContext('2d');
        paintStock(ictx, 512, 512, interior, 99);
        innerT.needsUpdate = true;
        const bctx = bottomC.getContext('2d');
        paintStock(bctx, 512, 512, state.color, 77);
        bottomT.needsUpdate = true;
        tissue.visible = o.tissue && o.tissue !== 'none';
        if (tissue.visible) tissueMat.color.set(o.tissue);
        target = (o.open ?? 0) / 100;
        if (current < 0) { current = target; apply(); }
      },
      animate(dt) {
        if (Math.abs(current - target) < 0.0005) return false;
        current += (target - current) * Math.min(1, dt * 7);
        if (Math.abs(current - target) < 0.001) current = target;
        apply();
        return true;
      },
      dispose() {
        group.traverse((o) => o.isMesh && o.geometry.dispose());
        Object.values(tex).forEach((t) => t.dispose());
        Object.values(mats).forEach((m) => m.dispose());
        [innerT, bottomT].forEach((t) => t.dispose());
        [edge, inner, bottomMat, tissueMat].forEach((m) => m.dispose());
      },
    };
  },
};
