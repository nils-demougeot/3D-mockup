// Textures procédurales (tissus, carton, métal...) + utilitaires canvas
import * as THREE from 'three';
import { makeNoise2D, fbm, rng, clamp } from './math.js';

export function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

let maxAniso = 8;
export function setMaxAnisotropy(a) { maxAniso = a; }

export function canvasTexture(canvas, { srgb = true, repeat = null, wrap = false, flipY = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  t.flipY = flipY;
  if (wrap || repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.needsUpdate = true;
  return t;
}

// Convertit une carte de hauteur (Float32Array size*size, valeurs ~0..1) en normal map (tileable)
export function heightToNormalCanvas(h, size, strength = 2) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1; // canvas y vers le bas -> inversion
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function sampleHeight(size, fn) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = fn(x / size, y / size);
  return h;
}

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export function normalTexture(key, size, fn, strength) {
  return cached('n:' + key, () => {
    const t = canvasTexture(heightToNormalCanvas(sampleHeight(size, fn), size, strength), { srgb: false, wrap: true });
    return t;
  });
}

// Jersey (maille du t-shirt) : colonnes de petits "V"
export function jerseyNormal() {
  const n = makeNoise2D(3);
  return normalTexture('jersey', 256, (u, v) => {
    const cols = 8, rows = 10;
    const cu = (u * cols) % 1, cv = (v * rows) % 1;
    // deux jambes inclinées
    const leg = (cx, slope) => {
      const dx = cu - cx - (cv - 0.5) * slope;
      return Math.exp(-(dx * dx) / 0.018);
    };
    const hgt = Math.max(leg(0.3, 0.35), leg(0.7, -0.35)) * (0.75 + 0.25 * Math.sin(cv * Math.PI));
    return hgt + n(u * 40, v * 40) * 0.08;
  }, 3.2);
}

// Piqué (polo) : nid d'abeille
export function piqueNormal() {
  const n = makeNoise2D(5);
  return normalTexture('pique', 256, (u, v) => {
    const k = 10;
    const x = u * k, y = v * k;
    const a = Math.abs(Math.sin(x * Math.PI)) * Math.abs(Math.sin(y * Math.PI + (Math.floor(x) % 2) * Math.PI / 2));
    return Math.pow(a, 0.6) + n(u * 50, v * 50) * 0.06;
  }, 3.5);
}

// Molleton (sweat) : maille fine et légèrement duveteuse
export function fleeceNormal() {
  const n = makeNoise2D(9);
  return normalTexture('fleece', 256, (u, v) => {
    const cols = 10, rows = 12;
    const cu = (u * cols) % 1, cv = (v * rows) % 1;
    const leg = (cx, slope) => { const dx = cu - cx - (cv - 0.5) * slope; return Math.exp(-(dx * dx) / 0.025); };
    return Math.max(leg(0.3, 0.3), leg(0.7, -0.3)) * 0.7 + fbm(u * 24, v * 24, 3, n) * 0.35;
  }, 2.6);
}

// Toile de coton (tote bag) : armure toile
export function canvasWeaveNormal() {
  const n = makeNoise2D(13);
  return normalTexture('canvasweave', 256, (u, v) => {
    const k = 16;
    const x = u * k, y = v * k;
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const warpUp = (ix + iy) % 2 === 0;
    const warp = Math.sin(fx * Math.PI) ** 0.8 * (warpUp ? 1 : 0.55) * (0.85 + 0.15 * Math.sin(fy * Math.PI));
    const weft = Math.sin(fy * Math.PI) ** 0.8 * (warpUp ? 0.55 : 1) * (0.85 + 0.15 * Math.sin(fx * Math.PI));
    return Math.max(warp, weft) + n(u * 64, v * 64) * 0.1 + fbm(u * 8, v * 8, 2, n) * 0.08;
  }, 3.0);
}

// Côtes (bord-côte) : rayures verticales
export function ribNormal() {
  return normalTexture('rib', 128, (u, v) => {
    const s = Math.sin(u * Math.PI * 2 * 8);
    return Math.pow(Math.abs(s), 0.5) * Math.sign(s) * 0.5 + 0.5;
  }, 2.2);
}

// Sangle tissée (porte-clé flamme, anses)
export function strapNormal() {
  const n = makeNoise2D(17);
  return normalTexture('strap', 256, (u, v) => {
    const k = 24;
    const fx = (u * k) % 1;
    const fy = (v * k * 0.6) % 1;
    return Math.sin(fx * Math.PI) * 0.7 + Math.sin(fy * Math.PI) * 0.25 + n(u * 80, v * 80) * 0.05;
  }, 2.4);
}

// Paillettes / grain holographique
export function sparkleNormal() {
  return cached('sparkle', () => {
    const size = 512;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, size, size);
    const r = rng(42);
    for (let i = 0; i < 9000; i++) {
      const x = r() * size, y = r() * size, s = 1 + r() * 2.2;
      const a = r() * Math.PI * 2, t = 0.25 + r() * 0.6;
      const nx = Math.cos(a) * t, ny = Math.sin(a) * t, nz = Math.sqrt(1 - t * t);
      ctx.fillStyle = `rgb(${(nx * 0.5 + 0.5) * 255 | 0},${(ny * 0.5 + 0.5) * 255 | 0},${(nz * 0.5 + 0.5) * 255 | 0})`;
      ctx.fillRect(x, y, s, s);
    }
    return canvasTexture(c, { srgb: false, wrap: true });
  });
}

// Métal brossé (lignes horizontales) – utilisé en roughness map
export function brushedRoughness() {
  return cached('brushed', () => {
    const w = 512, h = 512;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(90,90,90)';
    ctx.fillRect(0, 0, w, h);
    const r = rng(8);
    for (let i = 0; i < 1800; i++) {
      const y = r() * h, g = 60 + r() * 80;
      ctx.strokeStyle = `rgba(${g},${g},${g},${0.25 + r() * 0.4})`;
      ctx.lineWidth = 0.6 + r();
      ctx.beginPath();
      const x = r() * w;
      ctx.moveTo(x - 400, y); ctx.lineTo(x + 400, y + (r() - 0.5) * 1.5);
      ctx.stroke();
    }
    return canvasTexture(c, { srgb: false, wrap: true });
  });
}

export function brushedNormal() {
  const n = makeNoise2D(21);
  return normalTexture('brushedN', 256, (u, v) => n(u * 2, v * 260) * 0.5 + n(u * 6, v * 520) * 0.25, 1.2);
}

// Grain fin générique (céramique, plastique)
export function fineGrainNormal() {
  const n = makeNoise2D(31);
  return normalTexture('grain', 256, (u, v) => fbm(u * 32, v * 32, 3, n), 0.8);
}

// Poudre époxy (gourde) : peau d'orange légère
export function powderNormal() {
  const n = makeNoise2D(37);
  return normalTexture('powder', 256, (u, v) => fbm(u * 18, v * 18, 4, n), 1.4);
}

// Fibres de carton kraft — dessine directement sur un contexte 2D
export function paintKraft(ctx, x, y, w, h, base = '#c49a6c', seed = 1) {
  ctx.save();
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  const r = rng(seed);
  const area = w * h;
  const count = Math.min(9000, area / 90);
  for (let i = 0; i < count; i++) {
    const px = x + r() * w, py = y + r() * h;
    const len = 2 + r() * 10, a = r() * Math.PI;
    const light = r() > 0.5;
    ctx.strokeStyle = light ? `rgba(255,240,215,${0.05 + r() * 0.1})` : `rgba(70,40,15,${0.05 + r() * 0.12})`;
    ctx.lineWidth = 0.5 + r() * 0.8;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    ctx.stroke();
  }
  // taches douces
  for (let i = 0; i < count / 40; i++) {
    const px = x + r() * w, py = y + r() * h, rad = 6 + r() * 30;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
    const dark = r() > 0.5;
    g.addColorStop(0, dark ? 'rgba(90,55,20,0.03)' : 'rgba(255,235,200,0.035)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}

export function kraftNormal() {
  const n = makeNoise2D(41);
  return normalTexture('kraft', 256, (u, v) => fbm(u * 20, v * 20, 4, n) * 0.6 + n(u * 90, v * 90) * 0.15, 1.2);
}

// Tranche de carton ondulé
export function corrugatedTexture() {
  return cached('corrugated', () => {
    const c = createCanvas(256, 64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b48a5a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#8a6438';
    ctx.fillRect(0, 0, 256, 6);
    ctx.fillRect(0, 58, 256, 6);
    ctx.strokeStyle = '#7a5530';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 2) {
      const y = 32 + Math.sin((x / 256) * Math.PI * 2 * 10) * 22;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    return canvasTexture(c, { wrap: true });
  });
}

// Bambou (bouchon de gourde)
export function bambooTexture() {
  return cached('bamboo', () => {
    const w = 512, h = 512;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');
    const n = makeNoise2D(55);
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const grain = Math.sin(u * 140 + n(u * 3, v * 40) * 3) * 0.5 + 0.5;
      const t = 0.75 + grain * 0.12 + n(u * 20, v * 4) * 0.06;
      const i = (y * w + x) * 4;
      img.data[i] = clamp(214 * t, 0, 255);
      img.data[i + 1] = clamp(170 * t, 0, 255);
      img.data[i + 2] = clamp(112 * t, 0, 255);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvasTexture(c, { wrap: true });
  });
}

// Papier de soie froissé
export function crumpleNormal() {
  const n = makeNoise2D(61);
  return normalTexture('crumple', 512, (u, v) => {
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const f = 3 * 2 ** i;
      s += Math.abs(n(u * f + i * 7, v * f)) / (i + 1);
    }
    return s;
  }, 4);
}

// ---------- Utilitaires de dessin ----------

export function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Ligne de couture pointillée
export function stitch(ctx, pts, { color = 'rgba(0,0,0,0.28)', width = 2, dash = [7, 5], light = 'rgba(255,255,255,0.12)' } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  if (light) {
    ctx.strokeStyle = light;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + 1, y + 1) : ctx.moveTo(x + 1, y + 1)));
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

// Couleur : utilitaires
export function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}
export function shade(hex, f) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, clamp(hsl.l * f, 0, 1));
  return '#' + c.getHexString();
}
export function luminance(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

// Dessine un canvas de zone (design déjà positionné) dans un rectangle, avec rotation
export function drawZone(ctx, zoneCanvas, cx, cy, w, h, rot = 0, mode = 'source-over', alpha = 1) {
  if (!zoneCanvas) return;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(zoneCanvas, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// Silhouette (masque) d'un canvas : remplit les pixels opaques avec une couleur
export function silhouette(src, color) {
  const c = createCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// Masque "gravure / marquage 1 couleur" : zones encrées = pixels opaques et pas trop clairs
export function inkMask(src, color, { keepLight = false } = {}) {
  const c = createCanvas(src.width, src.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const [r, g, b] = hexToRgb(color);
  // si l'image est quasi entièrement claire (logo blanc), on garde tout ce qui est opaque
  let dark = 0, opaque = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] > 128) { opaque++; if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] < 200) dark++; }
  }
  const allLight = keepLight || dark < opaque * 0.05;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    const k = allLight ? 1 : 1 - Math.min(1, Math.max(0, (lum - 0.62) / 0.25));
    d[i + 3] = d[i + 3] * k;
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
