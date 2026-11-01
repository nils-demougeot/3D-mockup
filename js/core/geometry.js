// Générateurs de géométrie : surfaces paramétriques, tubes/rubans, révolution, "gonflage" de silhouettes
import * as THREE from 'three';

// Moyenne les normales des sommets confondus (coutures, pôles) pour un rendu lisse
export function smoothSeams(geo, eps = 1e-4) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const map = new Map();
  const inv = 1 / eps;
  for (let i = 0; i < pos.count; i++) {
    const key = Math.round(pos.getX(i) * inv) + '_' + Math.round(pos.getY(i) * inv) + '_' + Math.round(pos.getZ(i) * inv);
    let e = map.get(key);
    if (!e) { e = []; map.set(key, e); }
    e.push(i);
  }
  const v = new THREE.Vector3();
  for (const list of map.values()) {
    if (list.length < 2) continue;
    v.set(0, 0, 0);
    for (const i of list) v.x += nor.getX(i), v.y += nor.getY(i), v.z += nor.getZ(i);
    v.normalize();
    for (const i of list) nor.setXYZ(i, v.x, v.y, v.z);
  }
  nor.needsUpdate = true;
  return geo;
}

// Surface paramétrique (u,v) ∈ [0,1]² ; fn(u, v, target:Vector3)
export function paramSurface(nu, nv, fn, { flip = false, smooth = true } = {}) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  const idx = [];
  const p = new THREE.Vector3();
  let k = 0;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      fn(u, v, p);
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      uv[k * 2] = u; uv[k * 2 + 1] = v;
      k++;
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (flip) idx.push(a, d, b, a, c, d);
      else idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (smooth) smoothSeams(g);
  return g;
}

// Surface de révolution autour de Y. profile = [[r, y], ...] (bas -> haut pour une surface extérieure)
// u = angle (u=0.5 face à +Z), v = abscisse curviligne normalisée
export function lathe(profile, radial = 96, opts = {}) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = len[len.length - 1] || 1;
  const vs = len.map((l) => l / total);
  // On échantillonne exactement les points du profil
  const nv = pts.length - 1;
  const geo = paramSurface(radial, nv, (u, v, t) => {
    const j = Math.round(v * nv);
    const th = (u - 0.5) * Math.PI * 2;
    const r = pts[j].x;
    t.set(r * Math.sin(th), pts[j].y, r * Math.cos(th));
  }, opts);
  // remplace v par l'abscisse curviligne
  const uv = geo.attributes.uv;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= radial; i++) uv.setY(j * (radial + 1) + i, vs[j]);
  geo.userData.profileLength = total;
  geo.userData.vs = vs;
  return geo;
}

// Lisse un profil polyligne par Catmull-Rom
export function smoothProfile(points, samples = 8) {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return curve.getPoints((points.length - 1) * samples).map((p) => [p.x, p.y]);
}

// Tube / ruban le long d'une polyligne 3D, section elliptique ou "carrée arrondie"
// opts: rx, ry (ou fonctions de t), side: fn(i, T) -> Vector3 (direction de rx), up, radial, square (0=ellipse,1=rectangle), caps, closed
export function tube(points, opts = {}) {
  const { radial = 16, square = 0, caps = false, closed = false } = opts;
  const n = points.length;
  const rxf = typeof opts.rx === 'function' ? opts.rx : () => opts.rx ?? 0.5;
  const ryf = typeof opts.ry === 'function' ? opts.ry : () => opts.ry ?? opts.rx ?? 0.5;
  const T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    T.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  // repère : direction latérale fournie, sinon transport parallèle
  if (opts.side) {
    for (let i = 0; i < n; i++) {
      const s = opts.side(i, T[i], points[i]).clone();
      s.sub(T[i].clone().multiplyScalar(s.dot(T[i]))).normalize();
      N.push(s);
      B.push(new THREE.Vector3().crossVectors(T[i], s).normalize());
    }
  } else {
    let up = (opts.up || new THREE.Vector3(0, 1, 0)).clone();
    if (Math.abs(up.dot(T[0])) > 0.95) up = new THREE.Vector3(1, 0, 0);
    let prevN = up.sub(T[0].clone().multiplyScalar(up.dot(T[0]))).normalize();
    for (let i = 0; i < n; i++) {
      const nn = prevN.clone().sub(T[i].clone().multiplyScalar(prevN.dot(T[i]))).normalize();
      N.push(nn);
      B.push(new THREE.Vector3().crossVectors(T[i], nn).normalize());
      prevN = nn;
    }
  }
  const lens = [0];
  for (let i = 1; i < n; i++) lens.push(lens[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = lens[n - 1] || 1;
  const e = 1 - square * 0.85;
  const sp = (x) => Math.sign(x) * Math.pow(Math.abs(x), e);
  const rings = n;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < rings; i++) {
    const t = lens[i] / total;
    const rx = rxf(t, i), ry = ryf(t, i);
    for (let r = 0; r <= radial; r++) {
      const a = (r / radial) * Math.PI * 2;
      const c = sp(Math.cos(a)), s = sp(Math.sin(a));
      const p = points[i].clone().addScaledVector(N[i], c * rx).addScaledVector(B[i], s * ry);
      pos.push(p.x, p.y, p.z);
      uv.push(t, r / radial);
    }
  }
  const ringCount = closed ? rings : rings - 1;
  for (let i = 0; i < ringCount; i++) {
    const i2 = (i + 1) % rings;
    for (let r = 0; r < radial; r++) {
      const a = i * (radial + 1) + r, b = a + 1, c = i2 * (radial + 1) + r, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (caps && !closed) {
    for (const [ri, dir] of [[0, -1], [rings - 1, 1]]) {
      const center = pos.length / 3;
      const p = points[ri];
      pos.push(p.x + T[ri].x * 0.0001 * dir, p.y, p.z);
      uv.push(ri === 0 ? 0 : 1, 0.5);
      for (let r = 0; r < radial; r++) {
        const a = ri * (radial + 1) + r, b = a + 1;
        if (dir < 0) idx.push(center, b, a); else idx.push(center, a, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  smoothSeams(g);
  g.userData.length = total;
  return g;
}

// Polyligne d'une courbe Catmull-Rom 3D
export function curvePoints(ctrl, count = 64, closed = false, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(ctrl.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed, 'catmullrom', tension);
  return c.getSpacedPoints(count);
}

// Polyligne d'une THREE.Shape / Path
export function shapePoints(shape, spacing = 0.5) {
  const len = shape.getLength();
  const n = Math.max(16, Math.ceil(len / spacing));
  const pts = shape.getSpacedPoints(n);
  pts.pop(); // dernier = premier
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

// ------------------------------------------------------------------
// "Gonflage" d'une silhouette 2D en volume doux (vêtements, sacs...)
// poly : [{x, y, open?}] – open = le segment i -> i+1 est une ouverture (bas, manches, col)
// Les ouvertures restent "épaisses" (non refermées), ce qui laisse voir l'intérieur.
// ------------------------------------------------------------------
export function inflate(poly, opts = {}) {
  const {
    cell = 0.6,
    profileFront = (d) => Math.min(d, 4),
    profileBack = profileFront,
    frontCut = null,
    backCut = null,
    zFrontMod = null,
    zBackMod = null,
    groups = true,
  } = opts;
  const n = poly.length;
  const ax = new Float64Array(n), ay = new Float64Array(n), bx = new Float64Array(n), by = new Float64Array(n);
  const open = new Uint8Array(n);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    ax[i] = a.x; ay[i] = a.y; bx[i] = b.x; by[i] = b.y; open[i] = a.open ? 1 : 0;
    minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x); minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
  }
  const info = { d: 0, dc: 0, inside: false };
  function dist(x, y) {
    let md = Infinity, mdc = Infinity, inside = false;
    for (let i = 0; i < n; i++) {
      const x1 = ax[i], y1 = ay[i], x2 = bx[i], y2 = by[i];
      const dx = x2 - x1, dy = y2 - y1;
      const l2 = dx * dx + dy * dy || 1e-12;
      let t = ((x - x1) * dx + (y - y1) * dy) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x1 + dx * t - x, ey = y1 + dy * t - y;
      const d2 = ex * ex + ey * ey;
      if (d2 < md) md = d2;
      if (!open[i] && d2 < mdc) mdc = d2;
      if ((y1 > y) !== (y2 > y) && x < (dx * (y - y1)) / (dy || 1e-12) + x1) inside = !inside;
    }
    info.d = Math.sqrt(md); info.dc = Math.sqrt(mdc); info.inside = inside;
    return info;
  }
  const x0 = minX - cell * 1.5, y0 = minY - cell * 1.5;
  const nx = Math.ceil((maxX - minX) / cell) + 3, ny = Math.ceil((maxY - minY) / cell) + 3;
  const W = nx + 1, H = ny + 1;
  const sd = new Float32Array(W * H), dz = new Float32Array(W * H);
  const gx = (k) => x0 + (k % W) * cell, gy = (k) => y0 + Math.floor(k / W) * cell;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    const r = dist(x0 + i * cell, y0 + j * cell);
    sd[k] = r.inside ? r.d : -r.d;
    dz[k] = r.dc;
  }
  // Lissage du champ de distance (évite les arêtes vives sur l'axe médian)
  const blurR = Math.max(1, Math.round((opts.smooth ?? 2.2) / cell));
  const dzs = new Float32Array(dz);
  const tmp = new Float32Array(W * H);
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < H; j++) {
      let acc = 0, cnt = 0;
      for (let i = -blurR; i <= blurR; i++) if (i >= 0 && i < W) { acc += dzs[j * W + i]; cnt++; }
      for (let i = 0; i < W; i++) {
        tmp[j * W + i] = acc / cnt;
        const out = i - blurR, inn = i + blurR + 1;
        if (out >= 0) { acc -= dzs[j * W + out]; cnt--; }
        if (inn < W) { acc += dzs[j * W + inn]; cnt++; }
      }
    }
    for (let i = 0; i < W; i++) {
      let acc = 0, cnt = 0;
      for (let j = -blurR; j <= blurR; j++) if (j >= 0 && j < H) { acc += tmp[j * W + i]; cnt++; }
      for (let j = 0; j < H; j++) {
        dzs[j * W + i] = acc / cnt;
        const out = j - blurR, inn = j + blurR + 1;
        if (out >= 0) { acc -= tmp[out * W + i]; cnt--; }
        if (inn < H) { acc += tmp[inn * W + i]; cnt++; }
      }
    }
  }
  for (let k = 0; k < W * H; k++) dz[k] = Math.min(dz[k], dzs[k]);
  function dzAt(x, y) {
    const fx = Math.min(W - 1.001, Math.max(0, (x - x0) / cell)), fy = Math.min(H - 1.001, Math.max(0, (y - y0) / cell));
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const k = j * W + i;
    const b = (dzs[k] * (1 - tx) + dzs[k + 1] * tx) * (1 - ty) + (dzs[k + W] * (1 - tx) + dzs[k + W + 1] * tx) * ty;
    return Math.min(dist(x, y).dc, b);
  }
  const spanX = maxX - minX, spanY = maxY - minY;
  const positions = [], uvs = [], indices = [];
  const groupInfo = [];

  function buildSide(isFront) {
    const cut = isFront ? frontCut : backCut;
    const field = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) field[k] = cut ? Math.min(sd[k], cut(gx(k), gy(k))) : sd[k];
    const prof = isFront ? profileFront : profileBack;
    const mod = isFront ? zFrontMod : zBackMod;
    const vid = new Int32Array(W * H).fill(-1);
    const eid = new Map();
    const startIndex = indices.length;
    const addVertex = (x, y, d) => {
      let z = prof(d, x, y);
      if (mod) z = mod(x, y, z, d);
      if (!isFront) z = -z;
      positions.push(x, y, z);
      const u = (x - minX) / spanX, v = (y - minY) / spanY;
      uvs.push(isFront ? u : 1 - u, v);
      return positions.length / 3 - 1;
    };
    const getV = (k) => {
      if (vid[k] < 0) vid[k] = addVertex(gx(k), gy(k), dz[k]);
      return vid[k];
    };
    const getE = (key, ka, kb) => {
      let id = eid.get(key);
      if (id === undefined) {
        const fa = field[ka], fb = field[kb];
        const t = fa / (fa - fb);
        const x = gx(ka) + (gx(kb) - gx(ka)) * t, y = gy(ka) + (gy(kb) - gy(ka)) * t;
        id = addVertex(x, y, dzAt(x, y));
        eid.set(key, id);
      }
      return id;
    };
    const poly = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k0 = j * W + i, k1 = k0 + 1, k2 = k0 + W + 1, k3 = k0 + W;
      const f0 = field[k0] > 0, f1 = field[k1] > 0, f2 = field[k2] > 0, f3 = field[k3] > 0;
      if (!f0 && !f1 && !f2 && !f3) continue;
      poly.length = 0;
      const C = [k0, k1, k2, k3], F = [f0, f1, f2, f3];
      const keys = [k0 * 2, k1 * 2 + 1, k3 * 2, k0 * 2 + 1];
      for (let c = 0; c < 4; c++) {
        const c2 = (c + 1) & 3;
        if (F[c]) poly.push(getV(C[c]));
        if (F[c] !== F[c2]) poly.push(getE(keys[c], C[c], C[c2]));
      }
      for (let t = 1; t < poly.length - 1; t++) {
        if (isFront) indices.push(poly[0], poly[t], poly[t + 1]);
        else indices.push(poly[0], poly[t + 1], poly[t]);
      }
    }
    groupInfo.push([startIndex, indices.length - startIndex]);
  }
  buildSide(true);
  buildSide(false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  if (groups) {
    geo.addGroup(groupInfo[0][0], groupInfo[0][1], 0);
    geo.addGroup(groupInfo[1][0], groupInfo[1][1], 1);
  }
  geo.computeVertexNormals();
  smoothSeams(geo, 1e-3);

  const bbox = { minX, minY, maxX, maxY, w: spanX, h: spanY };
  // Hauteur de la surface avant/arrière en un point (pour poser des détails dessus)
  function sample(x, y) {
    const dcs = dzAt(x, y);
    const r = dist(x, y);
    let zf = profileFront(dcs, x, y);
    if (zFrontMod) zf = zFrontMod(x, y, zf, dcs);
    let zb = profileBack(dcs, x, y);
    if (zBackMod) zb = zBackMod(x, y, zb, dcs);
    return { zf, zb: -zb, inside: r.inside, d: r.d, dc: r.dc };
  }
  return { geometry: geo, bbox, sample };
}

// Applique une fonction de déformation sur une géométrie
export function deform(geo, fn) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v, i);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  smoothSeams(geo, 1e-3);
  return geo;
}
