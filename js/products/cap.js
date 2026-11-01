import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/DecalGeometry.js';
import { paramSurface, tube } from '../core/geometry.js';
import { createCanvas, canvasTexture, stitch, shade, heightToNormalCanvas, fleeceNormal } from '../core/textures.js';
import { fabricMaterial, setInner } from '../core/materials.js';
import { GARMENT_COLORS } from './garment.js';

const A = 9.5, B = 10.4;           // demi-axes de la base (x, z)
const SHIFT = 2.8;                  // recul du sommet
const TH_M = (80 * Math.PI) / 180; // demi-ouverture de la visière
const OPEN = { du: 0.048, dv: 0.27 }; // ouverture arrière (snapback)

function crownH(th) { return 11.0 - 1.9 * (1 - Math.cos(th)) / 2; }
function crownPoint(u, v, t, scale = 1) {
  const th = (u - 0.5) * Math.PI * 2;
  const phi = v * Math.PI / 2;
  const front = (1 + Math.cos(th)) / 2;
  const rad = Math.pow(Math.cos(phi), 0.62 + 0.3 * (1 - front));
  // creux des coutures (6 panneaux, couture au centre avant)
  let dent = 0;
  for (let k = -3; k <= 3; k++) {
    const d = th - (k * Math.PI) / 3;
    dent += Math.exp(-(d * d) / 0.0016);
  }
  const s = scale * (1 - 0.011 * dent * Math.min(1, v * 4)) * (1 + 0.012 * Math.sin(3 * th) ** 2);
  t.set(A * rad * Math.sin(th) * s, crownH(th) * Math.pow(Math.sin(phi), 0.85) * (scale > 0.99 ? 1 : 0.985), B * rad * Math.cos(th) * s - SHIFT * Math.sin(phi) ** 2);
  return t;
}

function embroideryNormal(src) {
  const S = 512;
  const scale = S / Math.max(src.width, src.height);
  const w = Math.max(8, Math.round(src.width * scale)), h = Math.max(8, Math.round(src.height * scale));
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.filter = 'blur(2px)';
  ctx.drawImage(src, 0, 0, w, h);
  const a = ctx.getImageData(0, 0, w, h).data;
  const sz = Math.max(w, h);
  const hm = new Float32Array(sz * sz);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const al = a[(y * w + x) * 4 + 3] / 255;
    const lum = (a[(y * w + x) * 4] + a[(y * w + x) * 4 + 1] + a[(y * w + x) * 4 + 2]) / 765;
    const dir = lum > 0.5 ? x - y : x + y; // direction de point différente selon la couleur
    hm[y * sz + x] = al * 0.7 + al * 0.25 * Math.sin(dir * 1.9);
  }
  const n = heightToNormalCanvas(hm, sz, 2.2);
  const out = createCanvas(w, h);
  out.getContext('2d').drawImage(n, 0, 0);
  return out;
}

export default {
  id: 'cap',
  name: 'Casquette',
  category: 'Textile',
  colors: GARMENT_COLORS,
  defaultColor: '#1d1d1f',
  zones: [
    { id: 'front', label: 'Face avant', w: 11, h: 5.5, main: true, hint: 'Logo frontal' },
    { id: 'side', label: 'Côté gauche', w: 5, h: 3.5, hint: 'Petit logo latéral' },
    { id: 'back', label: 'Arrière', w: 7, h: 2.4, hint: 'Au-dessus de la fermeture' },
  ],
  options: [
    { id: 'style', label: 'Modèle', type: 'segmented', default: 'classic', rebuild: true, choices: [{ value: 'classic', label: 'Classique' }, { value: 'trucker', label: 'Trucker (filet)' }] },
    { id: 'finish', label: 'Marquage', type: 'segmented', default: 'embroidery', choices: [{ value: 'embroidery', label: 'Broderie 3D' }, { value: 'print', label: 'Impression' }] },
    { id: 'visor', label: 'Visière', type: 'segmented', default: 'curved', rebuild: true, choices: [{ value: 'curved', label: 'Incurvée' }, { value: 'flat', label: 'Plate' }] },
    { id: 'under', label: 'Dessous visière', type: 'swatches', default: 'same', choices: [{ value: 'same', label: 'Assorti' }, { value: '#1d1d1f', label: 'Noir' }, { value: '#2f5d3a', label: 'Vert' }, { value: '#c8202f', label: 'Rouge' }, { value: '#f4f4f1', label: 'Blanc' }] },
  ],
  views: [
    { id: 'three', label: '3/4', az: 35, el: 14 },
    { id: 'front', label: 'Face', az: 0, el: 10 },
    { id: 'side', label: 'Côté', az: 90, el: 8 },
    { id: 'back', label: 'Arrière', az: 180, el: 12 },
  ],
  create() {
    const group = new THREE.Group();
    const S = 2048;
    const crownCanvas = createCanvas(S, S / 2);
    const crownTex = canvasTexture(crownCanvas);
    const alphaCanvas = createCanvas(1024, 512);
    const alphaTex = canvasTexture(alphaCanvas, { srgb: false });
    const visorCanvas = createCanvas(1024, 512);
    const visorTex = canvasTexture(visorCanvas);
    const knit = fleeceNormal().clone();
    knit.repeat.set(60, 14);
    const crownMat = fabricMaterial({ map: crownTex, normalMap: knit, normalScale: 0.5, roughness: 0.95 });
    crownMat.alphaMap = alphaTex;
    crownMat.alphaTest = 0.5;
    crownMat.side = THREE.DoubleSide;
    const visorMat = fabricMaterial({ map: visorTex, normalMap: knit, normalScale: 0.45, roughness: 0.92 });
    const underMat = fabricMaterial({ normalMap: knit, normalScale: 0.45, roughness: 0.95 });
    const plain = fabricMaterial({ normalMap: knit, normalScale: 0.45, roughness: 0.92 });
    const buckle = new THREE.MeshPhysicalMaterial({ color: '#202022', roughness: 0.35 });
    const decalMats = {};
    let built = '';
    let decals = {};
    let crown = null;

    function buildVisor(flat) {
      const k = flat ? 0.0 : 0.05, tilt = flat ? 0.4 : 1.3, L = 7.4;
      const P = (s, t, off, target) => {
        const th = (s - 0.5) * 2 * TH_M;
        const w = Math.pow(Math.cos((th / TH_M) * Math.PI / 2), 0.55);
        const ix = A * 0.985 * Math.sin(th), iz = B * 0.985 * Math.cos(th);
        const ox = A * 1.06 * Math.sin(th), oz = (B + L) * Math.cos(th);
        const tt = t * w;
        const x = ix + (ox - ix) * tt, z = iz + (oz - iz) * tt;
        const y = 0.35 - k * x * x * Math.pow(tt, 0.7) - tilt * tt;
        return target.set(x, y + off, z);
      };
      const top = paramSurface(80, 24, (s, t, v) => P(s, t, 0.16, v), { flip: true });
      const bot = paramSurface(80, 24, (s, t, v) => P(s, t, -0.16, v));
      const edge = [];
      for (let i = 0; i <= 120; i++) edge.push(P(i / 120, 1, 0, new THREE.Vector3()));
      const g = new THREE.Group();
      g.add(new THREE.Mesh(top, visorMat));
      g.add(new THREE.Mesh(bot, underMat));
      g.add(new THREE.Mesh(tube(edge, { rx: 0.17, ry: 0.17, radial: 12 }), plain));
      return g;
    }

    function build(style, visor) {
      built = style + visor;
      group.clear();
      const crownGeo = paramSurface(160, 48, (u, v, t) => crownPoint(u, v, t));
      crown = new THREE.Mesh(crownGeo, crownMat);
      group.add(crown);
      // bouton sommet
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), plain);
      const tp = crownPoint(0.5, 1, new THREE.Vector3());
      top.position.copy(tp).add(new THREE.Vector3(0, 0.05, 0));
      top.scale.set(1, 0.42, 1);
      top.rotation.x = -0.18;
      group.add(top);
      // bande de serrage arrière
      const strap = paramSurface(30, 4, (u, v, t) => {
        const th = Math.PI + (u - 0.5) * 2 * Math.PI * OPEN.du * 1.35;
        t.set(A * 1.012 * Math.sin(th), 0.1 + v * 1.7, B * 1.012 * Math.cos(th));
      }, { flip: true });
      const strapMesh = new THREE.Mesh(strap, plain);
      group.add(strapMesh);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.25), buckle);
      bk.position.set(-1.2, 0.95, -B * 1.025 - 0.08);
      group.add(bk);
      group.add(buildVisor(visor === 'flat'));
      // décalcomanies (logos)
      crown.updateMatrixWorld(true);
      decals = {};
      const mk = (id, pos, rot, size) => {
        const geo = new DecalGeometry(crown, pos, rot, size);
        if (!decalMats[id]) {
          decalMats[id] = new THREE.MeshPhysicalMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.6, sheen: 0.5, sheenRoughness: 0.5 });
        }
        const m = new THREE.Mesh(geo, decalMats[id]);
        m.renderOrder = 2;
        m.userData.castShadow = false;
        decals[id] = m;
        group.add(m);
      };
      mk('front', new THREE.Vector3(0, 5.2, B), new THREE.Euler(-0.12, 0, 0), new THREE.Vector3(11, 5.5, 8));
      mk('side', new THREE.Vector3(A, 4.6, -1.2), new THREE.Euler(0, Math.PI / 2, 0), new THREE.Vector3(5, 3.5, 6));
      mk('back', new THREE.Vector3(0, 4.7, -B), new THREE.Euler(0, Math.PI, 0), new THREE.Vector3(7, 2.4, 6));
      // intérieur (sommet légèrement plus bas pour éviter les chevauchements)
      group.position.y = -5;
    }

    function drawCrown(state) {
      const ctx = crownCanvas.getContext('2d');
      const W = S, H = S / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = state.color;
      ctx.fillRect(0, 0, W, H);
      const trucker = state.options.style === 'trucker';
      // filet : panneaux arrière plus clairs/texturés
      if (trucker) {
        ctx.fillStyle = shade(state.color, 0.9);
        ctx.fillRect(0, 0, W * (1 / 3 - 0.005), H);
        ctx.fillRect(W * (2 / 3 + 0.005), 0, W * (1 / 3), H);
      }
      // coutures (doubles piqûres)
      for (let k = 0; k <= 6; k++) {
        const x = (k / 6) * W;
        for (const off of [-9, 9]) stitch(ctx, [[x + off, H], [x + off * 0.4, 40]], { width: 2.4, dash: [10, 7], color: 'rgba(0,0,0,0.35)', light: 'rgba(255,255,255,0.10)' });
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x - 2, 0, 4, H);
      }
      // œillets brodés
      for (let k = 0; k < 6; k++) {
        const x = ((k + 0.5) / 6) * W, y = H * 0.24;
        if (Math.abs(k + 0.5 - 3) < 1) continue; // pas sur l'avant
        ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.fillStyle = shade(state.color, 0.7); ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = shade(state.color, 1.25); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fill();
      }
      // bas : ruban
      const g = ctx.createLinearGradient(0, H, 0, H - 30);
      g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, H - 30, W, 30);
      crownTex.needsUpdate = true;
      // alpha : ouverture arrière + filet
      const a = alphaCanvas.getContext('2d');
      const AW = 1024, AH = 512;
      a.setTransform(1, 0, 0, 1, 0, 0);
      a.fillStyle = '#fff';
      a.fillRect(0, 0, AW, AH);
      if (trucker) {
        a.fillStyle = '#000';
        const cell = 8;
        for (let y = 26; y < AH - 22; y += cell) for (let x = 0; x < AW; x += cell) {
          const u = x / AW;
          if (u > 1 / 3 - 0.012 && u < 2 / 3 + 0.012) continue;
          if (Math.abs(u - Math.round(u * 6) / 6) < 0.006) continue;
          const ox = (Math.floor(y / cell) % 2) * cell / 2;
          a.beginPath(); a.arc(x + ox, y, 2.6, 0, Math.PI * 2); a.fill();
        }
      }
      a.fillStyle = '#000';
      for (const cx of [0, AW]) {
        a.beginPath();
        a.ellipse(cx, AH, OPEN.du * AW, OPEN.dv * AH, 0, 0, Math.PI * 2);
        a.fill();
      }
      alphaTex.needsUpdate = true;
    }

    function drawVisor(state) {
      const ctx = visorCanvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = state.color;
      ctx.fillRect(0, 0, 1024, 512);
      for (let r = 0; r < 7; r++) {
        const y = 512 * (0.05 + r * 0.115);
        const pts = [];
        for (let i = 0; i <= 50; i++) pts.push([i * 1024 / 50, y]);
        stitch(ctx, pts, { width: 2.2, dash: [8, 5], color: 'rgba(0,0,0,0.3)', light: 'rgba(255,255,255,0.08)' });
      }
      visorTex.needsUpdate = true;
    }

    const embCache = new WeakMap();
    return {
      group,
      update(state) {
        const o = state.options;
        let rebuilt = false;
        if (built !== (o.style || 'classic') + (o.visor || 'curved')) { build(o.style || 'classic', o.visor || 'curved'); rebuilt = true; }
        drawCrown(state);
        drawVisor(state);
        const inner = shade(state.color, 0.55);
        for (const m of [crownMat, visorMat, underMat, plain]) {
          setInner(m, inner);
          m.sheenColor.copy(new THREE.Color(state.color).lerp(new THREE.Color('#fff'), 0.2));
        }
        plain.color.set(state.color);
        const under = o.under === 'same' || !o.under ? state.color : o.under;
        underMat.color.set(under);
        setInner(underMat, under);
        for (const id of ['front', 'side', 'back']) {
          const d = decals[id];
          const zc = state.zones[id];
          d.visible = !!zc;
          if (!zc) continue;
          const mat = d.material;
          if (mat.map?.image !== zc) {
            mat.map?.dispose();
            mat.map = canvasTexture(zc);
          } else mat.map.needsUpdate = true;
          if (o.finish === 'embroidery') {
            let n = embCache.get(zc);
            if (!n) { n = canvasTexture(embroideryNormal(zc), { srgb: false }); embCache.set(zc, n); }
            mat.normalMap = n;
            mat.normalScale = new THREE.Vector2(1.4, 1.4);
            mat.roughness = 0.5;
            mat.sheen = 0.8;
          } else {
            mat.normalMap = null;
            mat.roughness = 0.75;
            mat.sheen = 0.2;
          }
          mat.needsUpdate = true;
        }
        return { rebuilt };
      },
      dispose() {
        group.traverse((o) => o.isMesh && o.geometry.dispose());
        [crownTex, alphaTex, visorTex].forEach((t) => t.dispose());
        [crownMat, visorMat, underMat, plain, buckle, ...Object.values(decalMats)].forEach((m) => m.dispose());
      },
    };
  },
};
