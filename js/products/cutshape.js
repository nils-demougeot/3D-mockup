// Outils communs stickers / pins : contour d'après la transparence du visuel
import * as THREE from 'three';
import { traceContour, simpleShape } from '../core/contour.js';

/**
 * @param zc     canvas de la zone (design positionné, fond transparent)
 * @param mode   'diecut' | 'circle' | 'rounded' | 'rect' | 'oval'
 * @param offset marge autour du visuel en px (pour diecut) ou fraction (formes simples)
 * @param size   taille monde (cm) du côté du canvas
 * @returns { shape, pointsPx, toWorld, fromWorld, k }
 */
export function cutShape(zc, { mode = 'diecut', offsetPx = 20, size = 8 } = {}) {
  const W = zc.width, H = zc.height;
  const k = size / Math.max(W, H);
  let pts = null;
  if (mode === 'diecut') {
    const r = traceContour(zc, { offsetPx });
    if (r.points && r.hasAlpha) pts = r.points;
  }
  if (!pts) {
    // forme simple autour de la boîte englobante opaque
    const kind = mode === 'diecut' ? 'rounded' : mode;
    pts = simpleShape(kind, W, H, -Math.min(W, H) * 0.005);
  }
  const toWorld = (x, y) => new THREE.Vector2((x - W / 2) * k, (H / 2 - y) * k);
  const v2 = pts.map(([x, y]) => toWorld(x, y));
  if (THREE.ShapeUtils.isClockWise(v2)) v2.reverse();
  const shape = new THREE.Shape(v2);
  return { shape, points: v2, k, W, H };
}

// UV planaires : (x,y) monde -> coordonnées du canvas de zone
export function planarUV(geo, W, H, k) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / (W * k) + 0.5;
    uv[i * 2 + 1] = p.getY(i) / (H * k) + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Remplit la silhouette (forme) dans un canvas aux dimensions du visuel
export function fillShape(ctx, points, k, W, H, color) {
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = p.x / k + W / 2, y = H / 2 - p.y / k;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Décalage d'une liste de points (polygone) vers l'intérieur/extérieur
export function offsetPoints(points, d) {
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n], b = points[i], c = points[(i + 1) % n];
    const t = new THREE.Vector2().subVectors(c, a).normalize();
    // forme anti-horaire : la normale extérieure est (t.y, -t.x)
    out.push(new THREE.Vector2(b.x + t.y * d, b.y - t.x * d));
  }
  return out;
}
