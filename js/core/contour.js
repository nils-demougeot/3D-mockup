// Extraction du contour d'une image (transparence) -> forme vectorielle
// Utilisé pour les stickers découpés à la forme et les pins.
import * as THREE from 'three';
import { createCanvas } from './textures.js';

// Distance euclidienne exacte (Felzenszwalb & Huttenlocher)
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
// Retourne la distance (en px) de chaque pixel au pixel "plein" le plus proche
export function distanceTransform(mask, w, h) {
  const INF = 1e20;
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = mask[i] ? 0 : INF;
  const m = Math.max(w, h);
  const f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]);
  }
  return grid;
}

// Bouche les trous intérieurs d'un masque binaire
function fillHoles(mask, w, h) {
  const out = new Uint8Array(w * h).fill(1);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (out[i] === 1 && !mask[i]) { out[i] = 0; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return out;
}

// Marching squares sur un champ scalaire -> boucles fermées (coordonnées grille)
function marchingLoops(field, w, h, level) {
  const segs = new Map(); // clé d'arête -> [voisins]
  const pts = new Map();
  const key = (i, j, dir) => (j * w + i) * 2 + dir; // dir 0: horizontal (i,j)-(i+1,j), 1: vertical (i,j)-(i,j+1)
  const pos = (i, j, dir) => {
    const k = key(i, j, dir);
    if (!pts.has(k)) {
      const a = field[j * w + i];
      const b = dir === 0 ? field[j * w + i + 1] : field[(j + 1) * w + i];
      const t = (level - a) / (b - a);
      pts.set(k, dir === 0 ? [i + t, j] : [i, j + t]);
    }
    return k;
  };
  const link = (a, b) => {
    if (!segs.has(a)) segs.set(a, []);
    if (!segs.has(b)) segs.set(b, []);
    segs.get(a).push(b); segs.get(b).push(a);
  };
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const v0 = field[j * w + i] > level, v1 = field[j * w + i + 1] > level;
    const v2 = field[(j + 1) * w + i + 1] > level, v3 = field[(j + 1) * w + i] > level;
    const c = (v0 ? 1 : 0) | (v1 ? 2 : 0) | (v2 ? 4 : 0) | (v3 ? 8 : 0);
    if (c === 0 || c === 15) continue;
    const eT = () => pos(i, j, 0), eR = () => pos(i + 1, j, 1), eB = () => pos(i, j + 1, 0), eL = () => pos(i, j, 1);
    switch (c) {
      case 1: case 14: link(eL(), eT()); break;
      case 2: case 13: link(eT(), eR()); break;
      case 3: case 12: link(eL(), eR()); break;
      case 4: case 11: link(eR(), eB()); break;
      case 6: case 9: link(eT(), eB()); break;
      case 7: case 8: link(eL(), eB()); break;
      case 5: link(eL(), eT()); link(eR(), eB()); break;
      case 10: link(eT(), eR()); link(eL(), eB()); break;
    }
  }
  const visited = new Set();
  const loops = [];
  for (const start of segs.keys()) {
    if (visited.has(start)) continue;
    const loop = [];
    let prev = -1, cur = start;
    while (cur !== undefined && !visited.has(cur)) {
      visited.add(cur);
      loop.push(pts.get(cur));
      const nb = segs.get(cur);
      const next = nb.find((x) => x !== prev && !visited.has(x));
      prev = cur; cur = next;
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

function area(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function chaikin(pts, iter = 2) {
  for (let k = 0; k < iter; k++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]);
      out.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}

function resample(pts, count) {
  const L = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1], b = pts[i % pts.length];
    L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = L[L.length - 1];
  const out = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const s = (k / count) * total;
    while (L[j + 1] < s) j++;
    const a = pts[j], b = pts[(j + 1) % pts.length];
    const t = (s - L[j]) / (L[j + 1] - L[j] || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/**
 * Contour extérieur d'un canvas (pixels opaques), éventuellement dilaté.
 * @returns {points: [[x,y]] en px du canvas source, hasAlpha}
 */
export function traceContour(src, { offsetPx = 0, maxDim = 320, threshold = 0.5 } = {}) {
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  const pad = Math.ceil(offsetPx * scale) + 4;
  const w = Math.round(src.width * scale) + pad * 2, h = Math.round(src.height * scale) + pad * 2;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, pad, pad, src.width * scale, src.height * scale);
  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  let opaque = 0, transparent = 0;
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    mask[i] = a > threshold * 255 ? 1 : 0;
    if (a > 250) opaque++; else if (a < 5) transparent++;
  }
  // pixels internes au cadre (hors marge) totalement opaques -> pas de transparence exploitable
  const innerCount = Math.round(src.width * scale) * Math.round(src.height * scale);
  const hasAlpha = opaque < innerCount * 0.98 && opaque > 10;
  const filled = fillHoles(mask, w, h);
  const dist = distanceTransform(filled, w, h);
  // champ : r - distance (positif à l'intérieur de la forme dilatée)
  const r = Math.max(0.6, offsetPx * scale);
  const inside = distanceTransform(filled.map((v) => 1 - v), w, h);
  const field = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) field[i] = filled[i] ? r + inside[i] : r - dist[i];
  const loops = marchingLoops(field, w, h, 0.0);
  if (!loops.length) return { points: null, hasAlpha };
  let best = loops[0], bestA = 0;
  for (const l of loops) { const a = Math.abs(area(l)); if (a > bestA) { bestA = a; best = l; } }
  let pts = resample(best, Math.min(900, Math.max(120, Math.round(best.length * 1.2))));
  pts = chaikin(pts, 1);
  pts = resample(pts, Math.min(600, Math.max(120, Math.round(pts.length / 2))));
  // retour aux coordonnées du canvas source
  pts = pts.map(([x, y]) => [(x - pad) / scale, (y - pad) / scale]);
  if (area(pts) < 0) pts.reverse();
  return { points: pts, hasAlpha };
}

// Formes simples (en px dans un canvas w×h)
export function simpleShape(kind, w, h, pad = 0, radius = 0.18) {
  const pts = [];
  const cx = w / 2, cy = h / 2;
  const rw = w / 2 + pad, rh = h / 2 + pad;
  if (kind === 'circle' || kind === 'oval') {
    const r = Math.min(rw, rh);
    const ax = kind === 'circle' ? r : rw, ay = kind === 'circle' ? r : rh;
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * ax, cy + Math.sin(a) * ay]);
    }
  } else {
    const rr = kind === 'rect' ? Math.min(rw, rh) * 0.04 : Math.min(rw, rh) * radius * 2;
    const x0 = cx - rw, y0 = cy - rh, x1 = cx + rw, y1 = cy + rh;
    const corner = (x, y, a0) => {
      for (let i = 0; i <= 12; i++) {
        const a = a0 + (i / 12) * Math.PI / 2;
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
      }
    };
    corner(x1 - rr, y1 - rr, 0);
    corner(x0 + rr, y1 - rr, Math.PI / 2);
    corner(x0 + rr, y0 + rr, Math.PI);
    corner(x1 - rr, y0 + rr, Math.PI * 1.5);
  }
  if (area(pts) < 0) pts.reverse();
  return pts;
}

// Convertit des points px (y vers le bas) en THREE.Shape (unités monde, y vers le haut)
export function pointsToShape(pts, map) {
  const s = new THREE.Shape();
  const v = pts.map(([x, y]) => map(x, y));
  // THREE attend un contour anti-horaire (y vers le haut)
  if (THREE.ShapeUtils.isClockWise(v)) v.reverse();
  s.setFromPoints(v);
  return s;
}
