// Base commune des vêtements (t-shirt, sweat à capuche, polo)
// Silhouette 2D -> volume "ghost mannequin" gonflé, impression via textures canvas.
import * as THREE from 'three';
import { inflate, tube, smoothSeams } from '../core/geometry.js';
import { createCanvas, canvasTexture, shade, silhouette, ribNormal } from '../core/textures.js';
import { fabricMaterial, setInner } from '../core/materials.js';
import { fbm, smoothstep } from '../core/math.js';

// ---------- Construction de silhouettes symétriques ----------
// segments : [{ type:'line'|'quad'|'cubic', c1, c2, to, open }]
function sampleSeg(from, seg, spacing) {
  const pts = [];
  const P = (t) => {
    if (seg.type === 'quad') {
      const [cx, cy] = seg.c1, [x, y] = seg.to, mt = 1 - t;
      return [mt * mt * from[0] + 2 * mt * t * cx + t * t * x, mt * mt * from[1] + 2 * mt * t * cy + t * t * y];
    }
    if (seg.type === 'cubic') {
      const [ax, ay] = seg.c1, [bx, by] = seg.c2, [x, y] = seg.to, mt = 1 - t;
      return [
        mt ** 3 * from[0] + 3 * mt * mt * t * ax + 3 * mt * t * t * bx + t ** 3 * x,
        mt ** 3 * from[1] + 3 * mt * mt * t * ay + 3 * mt * t * t * by + t ** 3 * y,
      ];
    }
    return [from[0] + (seg.to[0] - from[0]) * t, from[1] + (seg.to[1] - from[1]) * t];
  };
  // longueur approx
  let L = 0, prev = from;
  for (let i = 1; i <= 20; i++) { const p = P(i / 20); L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
  const n = Math.max(2, Math.ceil(L / spacing));
  for (let i = 1; i <= n; i++) pts.push(P(i / n));
  return pts;
}

export function symmetricSilhouette(start, segments, spacing = 0.5) {
  const R = [start], F = [];
  let cur = start;
  for (const s of segments) {
    const pts = sampleSeg(cur, s, spacing);
    for (const p of pts) { R.push(p); F.push(!!s.open); }
    cur = s.to;
  }
  const m = R.length - 1;
  const poly = [];
  for (let i = 0; i <= m; i++) poly.push({ x: R[i][0], y: R[i][1], open: i < m ? F[i] : F[m - 1] });
  for (let k = m - 1; k >= 1; k--) poly.push({ x: -R[k][0], y: R[k][1], open: F[k - 1] });
  return poly;
}

// Polyligne (open) le long d'un ou plusieurs segments, côté droit -> utile pour coutures
export function segPolyline(start, segments, spacing = 0.5) {
  const R = [start];
  let cur = start;
  for (const s of segments) { R.push(...sampleSeg(cur, s, spacing)); cur = s.to; }
  return R;
}

// Fonction de découpe elliptique (positive à l'extérieur de l'ellipse = on garde)
export function ellipseCut(cx, cy, rx, ry) {
  return (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
}

export const GARMENT_COLORS = [
  { name: 'Blanc', hex: '#f4f4f1' },
  { name: 'Noir', hex: '#1d1d1f' },
  { name: 'Gris chiné', hex: '#a9abad' },
  { name: 'Marine', hex: '#1f2a44' },
  { name: 'Bordeaux', hex: '#6d1f2f' },
  { name: 'Rouge', hex: '#c8202f' },
  { name: 'Vert forêt', hex: '#2c4a36' },
  { name: 'Sauge', hex: '#9aae94' },
  { name: 'Bleu ciel', hex: '#a8c8e6' },
  { name: 'Lilas', hex: '#bfaee0' },
  { name: 'Sable', hex: '#d9c7a7' },
  { name: 'Moutarde', hex: '#d9a531' },
];

// ---------- Fabrique de produit vêtement ----------
export function makeGarment(cfg) {
  const def = { ...cfg };
  def.create = function create() {
    const group = new THREE.Group();
    const poly = cfg.silhouette();
    const inf = inflate(poly, { cell: cfg.cell ?? 0.55, ...cfg.inflate });
    const { minX, maxX, minY, maxY, w, h } = inf.bbox;
    const S = cfg.texSize ?? 2048;
    const cF = createCanvas(S, S), cB = createCanvas(S, S);
    const RS = 1024;
    const rF = createCanvas(RS, RS), rB = createCanvas(RS, RS);
    const tF = canvasTexture(cF), tB = canvasTexture(cB);
    const trF = canvasTexture(rF, { srgb: false }), trB = canvasTexture(rB, { srgb: false });
    const knitTile = cfg.knitTile ?? 1.1;
    const knit = cfg.knit().clone();
    knit.repeat.set(w / knitTile, h / knitTile);
    knit.needsUpdate = true;
    const matF = fabricMaterial({ map: tF, normalMap: knit, normalScale: cfg.normalScale ?? 0.55, roughness: 1 });
    const matB = fabricMaterial({ map: tB, normalMap: knit, normalScale: cfg.normalScale ?? 0.55, roughness: 1 });
    matF.roughnessMap = trF;
    matB.roughnessMap = trB;
    const mesh = new THREE.Mesh(inf.geometry, [matF, matB]);
    group.add(mesh);

    // Matériau des finitions (bords-côtes, capuche...) – couleur unie
    const trimKnit = ribNormal().clone();
    const trim = fabricMaterial({ normalMap: trimKnit, normalScale: 0.5, roughness: 0.95 });
    const plain = fabricMaterial({ normalMap: knit.clone(), normalScale: 0.5, roughness: 0.95 });

    const helpers = { group, inf, trim, plain, matF, matB, tube, smoothSeams, fbm, smoothstep };
    const extras = cfg.build ? cfg.build(helpers) : null;

    // centre l'objet
    group.position.set(0, -(minY + maxY) / 2, 0);

    const silCache = new WeakMap();
    function sil(zc) {
      if (!silCache.has(zc)) silCache.set(zc, silhouette(zc, '#9a9a9a'));
      return silCache.get(zc);
    }

    function compose(side, state) {
      const c = side === 'front' ? cF : cB;
      const ctx = c.getContext('2d');
      const r = side === 'front' ? rF : rB;
      const rctx = r.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = state.color;
      ctx.fillRect(0, 0, S, S);
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.fillStyle = '#ececec';
      rctx.fillRect(0, 0, RS, RS);
      const set = (cx, size) => {
        const sx = size / w, sy = size / h;
        if (side === 'front') cx.setTransform(sx, 0, 0, -sy, -minX * sx, maxY * sy);
        else cx.setTransform(-sx, 0, 0, -sy, maxX * sx, maxY * sy);
      };
      set(ctx, S);
      set(rctx, RS);
      cfg.decorate?.(ctx, side, state, inf);
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
      cfg.overlay?.(ctx, side, state, inf);
      (side === 'front' ? tF : tB).needsUpdate = true;
      (side === 'front' ? trF : trB).needsUpdate = true;
    }

    return {
      group,
      update(state) {
        compose('front', state);
        compose('back', state);
        const inner = shade(state.color, 0.62);
        const sheenCol = new THREE.Color(state.color).lerp(new THREE.Color('#ffffff'), 0.25);
        for (const m of [matF, matB, trim, plain]) {
          setInner(m, inner);
          m.sheenColor.copy(sheenCol);
        }
        trim.color.set(state.color);
        plain.color.set(state.color);
        extras?.update?.(state);
      },
      dispose() {
        group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
        [tF, tB, trF, trB].forEach((t) => t.dispose());
        [matF, matB, trim, plain].forEach((m) => m.dispose());
        extras?.dispose?.();
      },
    };
  };
  return def;
}

// Bande de col (bord-côte) le long d'une boucle 3D
// pts: Vector3[], normals: fonction(i, p) -> normale "surface" approx
export function collarBand(pts, { width = 2.2, thickness = 0.55, inward, normalAt, closed = true, square = 0.65 }) {
  const n = pts.length;
  const sides = [], centers = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const T = new THREE.Vector3().subVectors(b, a).normalize();
    const N = normalAt(i, pts[i]);
    const side = new THREE.Vector3().crossVectors(T, N).normalize();
    const toward = inward(i, pts[i]);
    if (side.dot(toward) < 0) side.negate();
    sides.push(side);
    centers.push(pts[i].clone().addScaledVector(side, width / 2 - 0.35).addScaledVector(N, thickness * 0.4));
  }
  return tube(centers, { rx: width / 2, ry: thickness / 2, side: (i) => sides[i], closed, radial: 20, square });
}

// Étiquette de taille cousue dans le dos
export function sizeLabel(text = 'M') {
  const c = createCanvas(256, 160);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f3f1ec';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#2a2a2a';
  ctx.font = '600 30px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MERCH', 128, 62);
  ctx.font = '800 52px Inter, system-ui, sans-serif';
  ctx.fillText(text, 128, 122);
  const t = canvasTexture(c);
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), m);
}

// Plis doux : ondulations basse fréquence + drapé vertical vers l'ourlet
export function wrinkles(amp = 0.35, freq = 1 / 15, hemY = -36) {
  return (x, y, z, d) => {
    const k = smoothstep(0, 4, d);
    const base = fbm(x * freq, y * freq, 2) * amp;
    const drape = Math.sin(x * 0.55 + fbm(x * 0.05, y * 0.05, 2) * 3) * amp * 0.45 * smoothstep(hemY + 30, hemY + 2, y);
    return z + (base + drape) * k;
  };
}
