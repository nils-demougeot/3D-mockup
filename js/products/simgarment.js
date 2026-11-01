// Vêtements issus d'une simulation de tissu (Blender) : patron cousu et drapé sur un mannequin.
// Le GLB contient : panneaux avant/arrière (UV = coordonnées du patron en cm), bande de col,
// des poses d'animation (morph targets, tissu soufflé par le vent) et le buste du mannequin.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { createCanvas, canvasTexture, shade, silhouette, ribNormal } from '../core/textures.js';
import { fabricMaterial, setInner } from '../core/materials.js';

const cache = new Map();
function loadModel(url) {
  if (!cache.has(url)) cache.set(url, new GLTFLoader().loadAsync(url));
  return cache.get(url);
}

// Catmull-Rom sur une suite de poses (clé 0 = pose de base)
function poseWeights(s, n, out) {
  out.fill(0);
  const i = Math.min(n - 1, Math.floor(s));
  const t = s - i;
  const k = [i - 1, i, i + 1, i + 2].map((v) => Math.max(0, Math.min(n, v)));
  const t2 = t * t, t3 = t2 * t;
  const w = [
    (-t3 + 2 * t2 - t) / 2,
    (3 * t3 - 5 * t2 + 2) / 2,
    (-3 * t3 + 4 * t2 + t) / 2,
    (t3 - t2) / 2,
  ];
  for (let j = 0; j < 4; j++) if (k[j] > 0) out[k[j] - 1] += w[j];
  return out;
}

export function makeSimGarment(cfg) {
  const def = { ...cfg };
  def.options = cfg.noForm ? [
    { id: 'motion', label: 'Mouvement du tissu', type: 'segmented', default: 'on', choices: [{ value: 'on', label: 'Animé' }, { value: 'off', label: 'Figé' }] },
    ...(cfg.options || []),
  ] : [
    { id: 'display', label: 'Présentation', type: 'segmented', default: 'float', rebuild: true, choices: [{ value: 'float', label: 'Flottant' }, { value: 'worn', label: 'Porté (mannequin)' }] },
    { id: 'motion', label: 'Mouvement du tissu', type: 'segmented', default: 'on', choices: [{ value: 'on', label: 'Animé' }, { value: 'off', label: 'Figé' }] },
    { id: 'form', label: 'Mannequin', type: 'segmented', default: 'light', showIf: { display: 'worn' }, choices: [{ value: 'light', label: 'Clair' }, { value: 'dark', label: 'Noir' }, { value: 'wood', label: 'Lin' }] },
    ...(cfg.options || []),
  ];
  def.create = function create() {
    const group = new THREE.Group();
    const S = cfg.texSize ?? 2048;
    const cF = createCanvas(S, S), cB = createCanvas(S, S);
    const RS = 1024;
    const rF = createCanvas(RS, RS), rB = createCanvas(RS, RS);
    const tF = canvasTexture(cF), tB = canvasTexture(cB);
    const trF = canvasTexture(rF, { srgb: false }), trB = canvasTexture(rB, { srgb: false });
    const knit = cfg.knit().clone();
    const matF = fabricMaterial({ map: tF, normalMap: knit, normalScale: cfg.normalScale ?? 0.5, roughness: 1 });
    const matB = fabricMaterial({ map: tB, normalMap: knit, normalScale: cfg.normalScale ?? 0.5, roughness: 1 });
    matF.roughnessMap = trF; matB.roughnessMap = trB;
    const rib = fabricMaterial({ normalMap: ribNormal().clone(), normalScale: 0.6, roughness: 0.95 });
    rib.normalMap.repeat.set(1, 1);
    const plainKnit = cfg.knit().clone();
    plainKnit.repeat.set(40, 40);
    const plain = fabricMaterial({ normalMap: plainKnit, normalScale: cfg.normalScale ?? 0.5, roughness: 0.95 });
    const cord = fabricMaterial({ roughness: 0.75, sheen: 0.4 });
    const strapMat = fabricMaterial({ normalMap: (cfg.strapNormal || cfg.knit)().clone(), normalScale: 0.7, roughness: 0.9, sheen: 0.4 });
    strapMat.normalMap.repeat.set(6, 30);
    const collarMat = fabricMaterial({ normalMap: plainKnit, normalScale: cfg.normalScale ?? 0.5, roughness: 0.95 });
    const metal = new THREE.MeshPhysicalMaterial({ color: '#d8dadd', metalness: 1, roughness: 0.2 });
    const button = new THREE.MeshPhysicalMaterial({ color: '#f5f3ee', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
    const formMat = new THREE.MeshPhysicalMaterial({ color: '#e7e3dc', roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    let meta = null, garment = [], form = null, nPoses = 0, weights = null;
    let t = 0, display = '', motion = true;
    const shadowTick = { n: 0 };

    const ready = loadModel(cfg.model).then((gltf) => {
      const root = gltf.scene;
      root.traverse((o) => {
        if (!o.isMesh) return;
        const name = o.material?.name;
        if (name === 'front') o.material = matF;
        else if (name === 'back') o.material = matB;
        else if (name === 'rib') o.material = rib;
        else if (name === 'hood') o.material = plain;
        else if (name === 'cord') o.material = cord;
        else if (name === 'metal') o.material = metal;
        else if (name === 'collar') o.material = collarMat;
        else if (name === 'strap') o.material = strapMat;
        else if (name === 'button') o.material = button;
        else if (name === 'form') { o.material = formMat; form = o; return; }
        if (o.morphTargetInfluences) { garment.push(o); nPoses = o.morphTargetInfluences.length; }
      });
      meta = root.userData?.bbox ? root.userData : root.children.find((c) => c.userData?.bbox)?.userData;
      if (!meta) {
        root.traverse((o) => { if (!meta && o.userData?.bbox) meta = o.userData; });
      }
      weights = new Float32Array(nPoses);
      const [minX, maxX, minY, maxY] = meta.bbox;
      knit.repeat.set((maxX - minX) / (cfg.knitTile ?? 1.0), (maxY - minY) / (cfg.knitTile ?? 1.0));
      knit.needsUpdate = true;
      group.add(root);
    });

    const silCache = new WeakMap();
    const sil = (zc) => { if (!silCache.has(zc)) silCache.set(zc, silhouette(zc, '#9a9a9a')); return silCache.get(zc); };

    function compose(side, state) {
      const [minX, maxX, minY, maxY] = meta.bbox;
      const w = maxX - minX, h = maxY - minY;
      const c = side === 'front' ? cF : cB, ctx = c.getContext('2d');
      const r = side === 'front' ? rF : rB, rctx = r.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = state.color; ctx.fillRect(0, 0, S, S);
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.fillStyle = '#ececec'; rctx.fillRect(0, 0, RS, RS);
      const set = (cx, size) => {
        const sx = size / w, sy = size / h;
        if (side === 'front') cx.setTransform(sx, 0, 0, -sy, -minX * sx, maxY * sy);
        else cx.setTransform(-sx, 0, 0, -sy, maxX * sx, maxY * sy);
      };
      set(ctx, S); set(rctx, RS);
      cfg.decorate?.(ctx, side, state, meta);
      for (const z of cfg.zones) {
        if (z.side !== side) continue;
        const zc = state.zones[z.id];
        if (!zc) continue;
        for (const [cx, img] of [[ctx, zc], [rctx, sil(zc)]]) {
          cx.save();
          cx.translate(side === 'back' ? -z.cx : z.cx, z.cy);
          cx.scale(side === 'back' ? -1 : 1, -1);
          cx.rotate((-(z.rot || 0) * Math.PI) / 180);
          cx.drawImage(img, -z.w / 2, -z.h / 2, z.w, z.h);
          cx.restore();
        }
      }
      (side === 'front' ? tF : tB).needsUpdate = true;
      (side === 'front' ? trF : trB).needsUpdate = true;
    }

    function applyPose() {
      if (!weights) return;
      const s = nPoses * (0.5 - 0.5 * Math.cos(t));
      poseWeights(s, nPoses, weights);
      for (const m of garment) for (let i = 0; i < nPoses; i++) m.morphTargetInfluences[i] = weights[i];
    }

    return {
      group,
      ready,
      update(state) {
        if (!meta) return {};
        const o = state.options;
        compose('front', state);
        compose('back', state);
        const inner = shade(state.color, 0.6);
        const sheen = new THREE.Color(state.color).lerp(new THREE.Color('#ffffff'), 0.25);
        for (const m of [matF, matB, rib, plain, cord]) { setInner(m, inner); m.sheenColor.copy(sheen); }
        rib.color.set(state.color);
        plain.color.set(state.color);
        const sc = cfg.strapColor ? cfg.strapColor(state) : state.color;
        strapMat.color.set(sc); setInner(strapMat, shade(sc, 0.75)); strapMat.sheenColor.copy(sheen);
        collarMat.color.set(state.color); setInner(collarMat, shade(state.color, 0.85)); collarMat.sheenColor.copy(sheen);
        const light = new THREE.Color(state.color).getHSL({}).l > 0.5;
        cord.color.set(o.cords === 'contrast' ? (light ? '#222222' : '#f2f2ee') : state.color);
        button.color.set(o.buttons === 'white' ? '#f5f3ee' : o.buttons === 'black' ? '#1d1d1f' : state.color);
        motion = o.motion !== 'off';
        let rebuilt = false;
        if ((o.display || 'float') !== display) {
          display = o.display || 'float';
          if (form) { form.visible = display === 'worn'; form.userData.noBounds = display !== 'worn'; }
          group.userData.shadow = cfg.shadow ? cfg.shadow : display === 'worn' ? { gap: 0.02, blur: 1.4, opacity: 0.55 } : { gap: 0.22, blur: 3.2, opacity: 0.38 };
          rebuilt = true;
        }
        formMat.color.set(o.form === 'dark' ? '#2a2a2d' : o.form === 'wood' ? '#cdbb9b' : '#e7e3dc');
        formMat.roughness = o.form === 'wood' ? 0.85 : 0.55;
        if (!motion) { t = 0; applyPose(); }
        return { rebuilt };
      },
      animate(dt) {
        if (!motion || !weights) return false;
        t += dt * (Math.PI / (cfg.period ?? 7));
        applyPose();
        // l'ombre de contact n'a pas besoin d'être recalculée à chaque image
        return (shadowTick.n++ % 4) === 0;
      },
      dispose() {
        group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
        cache.delete(cfg.model);
        [tF, tB, trF, trB].forEach((x) => x.dispose());
        [matF, matB, rib, plain, cord, metal, button, collarMat, strapMat, formMat].forEach((m) => m.dispose());
      },
    };
  };
  return def;
}

// Couture double aiguille parallèle à une polyligne (décalée)
export function offsetLine(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    out.push([pts[i][0] + (nx / l) * off, pts[i][1] + (ny / l) * off]);
  }
  return out;
}
