// Merch Studio — application
import { Viewer } from './core/viewer.js';
import { PRODUCTS, byId, ICONS, SHORT } from './products/index.js';
import { templateSVG, zonePx, downloadText, slug } from './core/templates.js';
import { demoLogo } from './core/demo.js';
import { createCanvas } from './core/textures.js';
import * as store from './core/store.js';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};

const ICON = {
  template: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 9h16M9 9v11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  center: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  restore: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const BACKGROUNDS = [
  { id: 'studio', label: 'Studio', stops: ['#ffffff', '#f1efe9', '#e4e0d8'] },
  { id: 'sand', label: 'Sable', stops: ['#fffaf3', '#f4e6d4', '#e6cfb4'] },
  { id: 'blush', label: 'Poudré', stops: ['#fff6f6', '#f8dfe3', '#eec5cd'] },
  { id: 'sky', label: 'Ciel', stops: ['#f7fbff', '#dfeaf7', '#c4d6ec'] },
  { id: 'mint', label: 'Menthe', stops: ['#f6fff9', '#dcefe3', '#c2dccb'] },
  { id: 'night', label: 'Nuit', stops: ['#4a4b57', '#2a2b33', '#16161b'], dark: true },
  { id: 'transparent', label: 'Transparent', checker: true },
];

// ---------------------------------------------------------------
const viewer = new Viewer($('#viewer'));
const stage = $('#stage');

const S = {
  productId: 'tshirt',
  bg: 'studio',
  customBg: '#e8e2ff',
  autoRotate: false,
  introHidden: false,
  products: {}, // id -> { color, options, zones: { zid: { scale, x, y, rot, hidden } } }
};
const images = {}; // `${pid}:${zid}` -> { img, name }
let globalLogo = null; // { img, name }
let instance = null, product = null, removeAnimator = null;
let activeZone = null;
let rev = 0;
const zoneCache = new Map(); // `${pid}:${zid}` -> { sig, canvas }
const demoCache = new Map();

function pstate(p = product) {
  if (!S.products[p.id]) S.products[p.id] = { color: p.defaultColor, options: {}, zones: {} };
  const ps = S.products[p.id];
  for (const o of p.options || []) if (ps.options[o.id] === undefined) ps.options[o.id] = o.default;
  for (const z of p.zones) if (!ps.zones[z.id]) ps.zones[z.id] = { scale: 1, x: 0, y: 0, rot: 0, hidden: false };
  return ps;
}

// ---------- Images ----------
async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const isSvg = blob.type === 'image/svg+xml';
    let w = img.naturalWidth || 1024, hgt = img.naturalHeight || 1024;
    const max = 2400;
    const scale = isSvg ? max / Math.max(w, hgt) : Math.min(1, max / Math.max(w, hgt));
    const c = createCanvas(w * scale, hgt * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function demoFor(p, z) {
  const k = p.id + ':' + z.id;
  if (!demoCache.has(k)) demoCache.set(k, p.demo ? p.demo(z) : demoLogo(1024));
  return demoCache.get(k);
}

// Source effective d'une zone
function zoneSource(p, z) {
  const ps = pstate(p);
  const own = images[p.id + ':' + z.id];
  if (own) return { img: own.img, kind: 'own', name: own.name };
  if (ps.zones[z.id].hidden || !z.main) return null;
  if (globalLogo) return { img: globalLogo.img, kind: 'logo', name: globalLogo.name };
  return { img: demoFor(p, z), kind: 'demo', name: 'Visuel d\'exemple' };
}

function zoneCanvas(p, z) {
  const src = zoneSource(p, z);
  if (!src) return null;
  const t = pstate(p).zones[z.id];
  const sig = [src.img.width, src.img.height, src.kind, t.scale, t.x, t.y, t.rot, src.img.__id || (src.img.__id = Math.random())].join('|');
  const key = p.id + ':' + z.id;
  const c = zoneCache.get(key);
  if (c && c.sig === sig) return c.canvas;
  const { w, h: hh } = zonePx(z);
  const s = Math.min(1, 2048 / Math.max(w, hh));
  const cw = Math.round(w * s), ch = Math.round(hh * s);
  const canvas = c?.canvas && c.canvas.width === cw && c.canvas.height === ch ? createCanvas(cw, ch) : createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const iw = src.img.width, ih = src.img.height;
  const fit = Math.min(cw / iw, ch / ih) * t.scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(cw / 2 + t.x * cw, ch / 2 + t.y * ch);
  ctx.rotate((t.rot * Math.PI) / 180);
  ctx.drawImage(src.img, (-iw * fit) / 2, (-ih * fit) / 2, iw * fit, ih * fit);
  zoneCache.set(key, { sig, canvas });
  rev++;
  return canvas;
}

// ---------- Mise à jour 3D ----------
let raf = 0, debounceT = 0;
function schedule({ heavy = false } = {}) {
  if (heavy && (product.id === 'sticker' || product.id === 'pin')) {
    clearTimeout(debounceT);
    debounceT = setTimeout(() => schedule(), 140);
    return;
  }
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; apply(); });
}

function apply() {
  if (!instance) return;
  const ps = pstate();
  const zones = {};
  for (const z of product.zones) zones[z.id] = zoneCanvas(product, z);
  const res = instance.update({ color: ps.color, options: { ...ps.options }, zones, rev });
  if (res?.rebuilt) {
    viewer.updateBounds();
  }
  viewer.markShadowDirty();
  renderThumbs();
  saveSoon();
}

// ---------- Produits ----------
function selectProduct(id, { initial = false } = {}) {
  const p = byId[id] || PRODUCTS[0];
  S.productId = p.id;
  $('#loader').classList.add('on');
  updateRail();
  $('#product-title').textContent = p.name;
  $('#product-cat').textContent = p.category;
  document.title = `${p.name} — Merch Studio`;
  if (!initial || location.hash) history.replaceState(null, '', '#' + p.id);
  setTimeout(() => {
    try {
      if (instance) {
        removeAnimator?.();
        instance.dispose?.();
      }
      product = p;
      pstate(p);
      activeZone = p.zones.find((z) => z.main)?.id || p.zones[0].id;
      instance = p.create({ viewer });
      removeAnimator = instance.animate ? viewer.addAnimator(instance.animate) : null;
      const ps = pstate();
      const zones = {};
      for (const z of p.zones) zones[z.id] = zoneCanvas(p, z);
      instance.update({ color: ps.color, options: { ...ps.options }, zones, rev });
      viewer.setObject(instance.group, { views: p.views });
      renderViews();
      renderZones();
      renderColors();
      renderOptions();
      saveSoon();
    } catch (e) {
      console.error(e);
      toast('Oups, ce mockup n\'a pas pu être chargé.');
    } finally {
      $('#loader').classList.remove('on');
    }
  }, initial ? 0 : 30);
}

function renderRail() {
  const rail = $('#rail');
  rail.innerHTML = '';
  let lastCat = null;
  for (const p of PRODUCTS) {
    if (lastCat && p.category !== lastCat) rail.append(h('span', { class: 'rail-sep' }));
    lastCat = p.category;
    rail.append(h('button', {
      class: 'chip', type: 'button', 'data-id': p.id, title: p.name,
      onclick: () => { if (p.id !== product?.id) selectProduct(p.id); },
    }, h('span', { class: 'dot' }), h('span', { html: ICONS[p.id] }), SHORT[p.id] || p.name));
  }
}
function updateRail() {
  for (const b of document.querySelectorAll('.chip')) {
    const id = b.dataset.id;
    b.setAttribute('aria-current', id === S.productId ? 'true' : 'false');
    b.classList.toggle('custom', Object.keys(images).some((k) => k.startsWith(id + ':')));
  }
  const cur = document.querySelector('.chip[aria-current="true"]');
  cur?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

// ---------- Vues ----------
function renderViews() {
  const bar = $('#views');
  bar.innerHTML = '';
  product.views.forEach((v, i) => {
    bar.append(h('button', {
      type: 'button', class: i === 0 ? 'on' : '',
      onclick: (e) => {
        bar.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
        if (v.set) {
          Object.assign(pstate().options, v.set);
          renderOptions();
          schedule();
        }
        viewer.frame(v);
      },
    }, v.label));
  });
}

// ---------- Zones ----------
const zoneEls = {};
function renderZones() {
  const wrap = $('#zones');
  wrap.innerHTML = '';
  for (const z of product.zones) {
    const { w, h: hh } = zonePx(z);
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', hidden: true });
    file.addEventListener('change', () => { if (file.files[0]) setZoneImage(z, file.files[0]); file.value = ''; });
    const thumb = h('div', { class: 'zone-thumb', title: 'Glisse pour déplacer · molette pour zoomer' });
    const badge = h('span', { class: 'badge' });
    const meta = h('div', { class: 'zone-meta' });
    const removeBtn = h('button', { class: 'mini danger', type: 'button', title: 'Retirer', html: ICON.trash, onclick: (e) => { e.stopPropagation(); removeZone(z); } });
    const restoreBtn = h('button', { class: 'mini', type: 'button', title: 'Remettre le logo', html: ICON.restore + '<span>Logo</span>', onclick: (e) => { e.stopPropagation(); pstate().zones[z.id].hidden = false; refreshZone(z); } });
    const actions = h('div', { class: 'zone-actions' },
      h('button', { class: 'mini', type: 'button', title: 'Télécharger le gabarit SVG pour Figma', html: ICON.template + '<span>Gabarit</span>', onclick: (e) => { e.stopPropagation(); downloadTemplate(z); } }),
      h('button', { class: 'mini solid', type: 'button', html: ICON.upload + '<span>Importer</span>', onclick: (e) => { e.stopPropagation(); setActive(z.id); file.click(); } }),
      restoreBtn, removeBtn,
    );
    const t = pstate().zones[z.id];
    const mkSlider = (label, key, min, max, step, fmt) => {
      const out = h('output');
      const input = h('input', { type: 'range', min, max, step, value: t[key] });
      const sync = () => { input.value = t[key]; out.textContent = fmt(t[key]); input.style.setProperty('--p', ((t[key] - min) / (max - min)) * 100 + '%'); };
      input.addEventListener('input', () => { t[key] = Number(input.value); sync(); schedule({ heavy: true }); });
      sync();
      return { row: h('div', { class: 'slider-row' }, h('span', {}, label), input, out), sync };
    };
    const sScale = mkSlider('Taille', 'scale', 0.1, 2, 0.01, (v) => Math.round(v * 100) + '%');
    const sRot = mkSlider('Rotation', 'rot', -180, 180, 1, (v) => v + '°');
    const adjust = h('div', { class: 'zone-adjust' }, sScale.row, sRot.row,
      h('div', { class: 'adjust-btns' },
        h('button', { class: 'mini', type: 'button', html: ICON.center + '<span>Recentrer</span>', onclick: () => { Object.assign(t, { x: 0, y: 0, scale: 1, rot: 0 }); sScale.sync(); sRot.sync(); schedule({ heavy: true }); } }),
      ));
    const card = h('div', { class: 'zone', 'data-zone': z.id, onclick: () => setActive(z.id) },
      h('div', { class: 'zone-row' },
        thumb,
        h('div', { class: 'zone-info' },
          h('div', { class: 'zone-title' }, z.label, badge),
          meta,
          actions,
        )),
      adjust, file);
    meta.textContent = `${z.w} × ${z.h} cm · ${w} × ${hh} px`;
    meta.title = z.hint || '';
    // glisser-déposer sur la carte
    card.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); card.classList.add('drag'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag'));
    card.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation(); card.classList.remove('drag');
      stage.classList.remove('dragging');
      const f = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
      if (f) setZoneImage(z, f);
    });
    // déplacement dans la vignette
    let drag = null;
    thumb.addEventListener('pointerdown', (e) => {
      if (!zoneSource(product, z)) { setActive(z.id); file.click(); return; }
      const cv = thumb.querySelector('canvas');
      if (!cv) return;
      drag = { x: e.clientX, y: e.clientY, ox: t.x, oy: t.y, w: cv.clientWidth, h: cv.clientHeight };
      thumb.setPointerCapture(e.pointerId);
    });
    thumb.addEventListener('pointermove', (e) => {
      if (!drag) return;
      t.x = Math.max(-1, Math.min(1, drag.ox + (e.clientX - drag.x) / drag.w));
      t.y = Math.max(-1, Math.min(1, drag.oy + (e.clientY - drag.y) / drag.h));
      schedule({ heavy: true });
    });
    const end = () => { drag = null; };
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);
    thumb.addEventListener('wheel', (e) => {
      if (!zoneSource(product, z)) return;
      e.preventDefault();
      t.scale = Math.max(0.1, Math.min(2, t.scale * (e.deltaY < 0 ? 1.05 : 0.95)));
      sScale.sync();
      schedule({ heavy: true });
    }, { passive: false });
    zoneEls[z.id] = { card, thumb, badge, adjust, removeBtn, restoreBtn, sScale, sRot };
    wrap.append(card);
  }
  setActive(activeZone, true);
  renderThumbs();
}

function renderThumbs() {
  if (!product) return;
  for (const z of product.zones) {
    const el = zoneEls[z.id];
    if (!el) continue;
    const src = zoneSource(product, z);
    const cv = zoneCache.get(product.id + ':' + z.id)?.canvas;
    el.thumb.innerHTML = '';
    el.thumb.classList.toggle('movable', !!src);
    const ratio = z.w / z.h;
    const tw = ratio >= 1 ? 72 : 72 * ratio, th = ratio >= 1 ? 72 / ratio : 72;
    const c = createCanvas(Math.max(4, tw * 2), Math.max(4, th * 2));
    c.style.width = tw + 'px'; c.style.height = th + 'px';
    if (src && cv) c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
    el.thumb.append(c);
    if (!src) {
      c.style.outlineColor = 'rgba(0,0,0,.15)';
    }
    el.badge.textContent = src?.kind === 'logo' ? 'Mon logo' : src?.kind === 'demo' ? 'Exemple' : '';
    el.badge.className = 'badge ' + (src?.kind || '');
    el.badge.hidden = !src || src.kind === 'own';
    el.adjust.hidden = !src;
    el.removeBtn.hidden = !src;
    el.restoreBtn.hidden = !(z.main && !src && !images[product.id + ':' + z.id]);
    el.sScale.sync(); el.sRot.sync();
  }
}

function setActive(id, silent) {
  activeZone = id;
  for (const [zid, el] of Object.entries(zoneEls)) el.card.classList.toggle('active', zid === id);
  if (!silent) $('#drop-zone-name').textContent = '« ' + (product.zones.find((z) => z.id === id)?.label || '') + ' »';
}

async function setZoneImage(z, blob, name = blob.name || 'Image collée') {
  try {
    const img = await loadImage(blob);
    images[product.id + ':' + z.id] = { img, name };
    const t = pstate().zones[z.id];
    Object.assign(t, { scale: 1, x: 0, y: 0, rot: 0, hidden: false });
    store.set(`img:${product.id}:${z.id}`, { blob, name });
    refreshZone(z);
    updateRail();
    toast(`Visuel appliqué sur « ${z.label} »`);
  } catch (e) {
    console.error(e);
    toast('Image illisible. Essaie un PNG ou JPG.');
  }
}

function removeZone(z) {
  const k = product.id + ':' + z.id;
  if (images[k]) {
    delete images[k];
    store.del(`img:${k}`);
  } else {
    pstate().zones[z.id].hidden = true;
  }
  refreshZone(z);
  updateRail();
}

function refreshZone() {
  schedule();
}

function downloadTemplate(z) {
  const svg = templateSVG(product, z);
  downloadText(svg, `gabarit-${slug(product.name)}-${slug(z.label)}.svg`);
  toast('Gabarit téléchargé : glisse-le dans Figma');
}

// ---------- Couleurs ----------
function renderColors() {
  const sec = $('#color-section');
  sec.hidden = !!product.noColor;
  if (product.noColor) return;
  $('#color-title').textContent = product.colorLabel || 'Couleur';
  const wrap = $('#swatches');
  wrap.innerHTML = '';
  const ps = pstate();
  const set = (hex, name) => {
    ps.color = hex;
    $('#color-name').textContent = name || hex.toUpperCase();
    wrap.querySelectorAll('.sw').forEach((b) => b.setAttribute('aria-checked', b.dataset.hex === hex ? 'true' : 'false'));
    schedule();
  };
  for (const c of product.colors) {
    wrap.append(h('button', { class: 'sw', type: 'button', role: 'radio', title: c.name, 'data-hex': c.hex, style: `background:${c.hex}`, onclick: () => set(c.hex, c.name) }));
  }
  const input = h('input', { type: 'color', value: ps.color, 'aria-label': 'Couleur personnalisée' });
  input.addEventListener('input', () => set(input.value, 'Personnalisée ' + input.value.toUpperCase()));
  wrap.append(h('label', { class: 'sw custom', title: 'Couleur personnalisée' }, input));
  const cur = product.colors.find((c) => c.hex === ps.color);
  $('#color-name').textContent = cur ? cur.name : ps.color.toUpperCase();
  wrap.querySelectorAll('.sw').forEach((b) => b.setAttribute('aria-checked', b.dataset.hex === ps.color ? 'true' : 'false'));
}

// ---------- Options ----------
function renderOptions() {
  const wrap = $('#options');
  wrap.innerHTML = '';
  const opts = product.options || [];
  $('#options-section').hidden = !opts.length;
  const ps = pstate();
  for (const o of opts) {
    if (o.showIf && !Object.entries(o.showIf).every(([k, v]) => ps.options[k] === v)) continue;
    const box = h('div', { class: 'opt' }, h('label', { class: 'opt-label' }, o.label));
    const setVal = (v, heavy) => {
      ps.options[o.id] = v;
      if (opts.some((x) => x.showIf && x.showIf[o.id] !== undefined)) renderOptions();
      schedule({ heavy });
    };
    if (o.type === 'segmented') {
      const seg = h('div', { class: 'seg', role: 'radiogroup' });
      for (const c of o.choices) {
        seg.append(h('button', {
          type: 'button', class: ps.options[o.id] === c.value ? 'on' : '',
          onclick: (e) => { seg.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); setVal(c.value); },
        }, c.label));
      }
      box.append(seg);
    } else if (o.type === 'select') {
      const sel = h('select', {}, ...o.choices.map((c) => h('option', { value: c.value, selected: ps.options[o.id] === c.value }, c.label)));
      sel.addEventListener('change', () => setVal(sel.value));
      box.append(sel);
    } else if (o.type === 'range') {
      const out = h('output');
      const input = h('input', { type: 'range', min: o.min, max: o.max, step: o.step, value: ps.options[o.id] });
      const sync = () => { out.textContent = input.value + (o.unit || ''); input.style.setProperty('--p', ((input.value - o.min) / (o.max - o.min)) * 100 + '%'); };
      input.addEventListener('input', () => { sync(); ps.options[o.id] = Number(input.value); schedule({ heavy: true }); });
      sync();
      box.querySelector('label').append(' ');
      box.append(h('div', { class: 'slider-row', style: 'grid-template-columns: 1fr 52px' }, input, out));
    } else if (o.type === 'swatches') {
      const sw = h('div', { class: 'swatches' });
      for (const c of o.choices) {
        const isSame = c.value === 'same' || c.value === 'none';
        const bg = c.hex || (isSame ? null : c.value);
        sw.append(h('button', {
          type: 'button', class: 'sw' + (c.value === 'none' ? ' none' : ''), title: c.label, 'aria-checked': ps.options[o.id] === c.value ? 'true' : 'false',
          style: bg ? `background:${bg}` : (c.value === 'same' ? `background: linear-gradient(135deg, ${ps.color} 50%, #fff 50%)` : ''),
          onclick: (e) => { sw.querySelectorAll('.sw').forEach((b) => b.setAttribute('aria-checked', 'false')); e.currentTarget.setAttribute('aria-checked', 'true'); setVal(c.value); },
        }));
      }
      box.append(sw);
    }
    wrap.append(box);
  }
}

// ---------- Arrière-plans ----------
function bgDef() {
  if (S.bg === 'custom') {
    const c = S.customBg;
    return { id: 'custom', stops: [shadeHex(c, 1.08), c, shadeHex(c, 0.88)], dark: lum(c) < 0.4 };
  }
  return BACKGROUNDS.find((b) => b.id === S.bg) || BACKGROUNDS[0];
}
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f), g = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f);
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
function applyBg() {
  const b = bgDef();
  stage.classList.toggle('checker', !!b.checker);
  stage.classList.toggle('dark', !!b.dark);
  stage.style.setProperty('--stage-bg', b.checker ? '#fff' : `radial-gradient(120% 90% at 50% 30%, ${b.stops[0]} 0%, ${b.stops[1]} 55%, ${b.stops[2]} 100%)`);
  viewer.setShadowOpacity(b.dark ? 0.85 : 0.62);
  document.querySelectorAll('.bg-dot').forEach((d) => d.setAttribute('aria-checked', d.dataset.bg === S.bg ? 'true' : 'false'));
}
function renderBgPicker() {
  const wrap = $('#bg-picker');
  wrap.innerHTML = '';
  for (const b of BACKGROUNDS) {
    const style = b.checker
      ? 'background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/10px 10px'
      : `background: radial-gradient(circle at 40% 35%, ${b.stops[0]}, ${b.stops[2]})`;
    wrap.append(h('button', { class: 'bg-dot', type: 'button', role: 'radio', 'data-bg': b.id, title: b.label, style, onclick: () => { S.bg = b.id; applyBg(); saveSoon(); } }));
  }
  const input = h('input', { type: 'color', value: S.customBg, 'aria-label': 'Fond personnalisé' });
  input.addEventListener('input', () => { S.customBg = input.value; S.bg = 'custom'; applyBg(); saveSoon(); });
  wrap.append(h('label', { class: 'bg-dot custom', 'data-bg': 'custom', title: 'Couleur personnalisée' }, input));
  applyBg();
}
function paintBg(ctx, w, hh) {
  const b = bgDef();
  if (b.checker) return;
  const r = Math.hypot(w, hh) * 0.62;
  const g = ctx.createRadialGradient(w / 2, hh * 0.3, 0, w / 2, hh * 0.3, r);
  g.addColorStop(0, b.stops[0]); g.addColorStop(0.55, b.stops[1]); g.addColorStop(1, b.stops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, hh);
}

// ---------- Export ----------
function download(canvas, name) {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }, 'image/png');
}
function exportScale() {
  const w = $('#viewer').clientWidth, hh = $('#viewer').clientHeight;
  return Math.max(1, Math.min(4, 3200 / Math.max(w, hh)));
}
async function doExport(kind) {
  $('#export-menu').hidden = true;
  const name = `mockup-${slug(product.name)}`;
  const rot = viewer.controls.autoRotate;
  viewer.controls.autoRotate = false;
  try {
    if (kind === 'png' || kind === 'png-transparent') {
      const c = await viewer.snapshot({ scale: exportScale(), background: kind === 'png' ? paintBg : null });
      download(c, `${name}.png`);
      toast('Image exportée ✨');
    } else if (kind === 'sheet') {
      const views = product.views.slice(0, 4);
      const saved = { p: viewer.camera.position.clone(), t: viewer.controls.target.clone() };
      const shots = [];
      for (const v of views) {
        viewer.frame(v, false);
        if (v.set) { /* les vues qui changent des options ne sont pas rejouées ici */ }
        shots.push(await viewer.snapshot({ scale: exportScale() * 0.75, background: null }));
      }
      viewer.camera.position.copy(saved.p);
      viewer.controls.target.copy(saved.t);
      viewer.controls.update();
      const tw = shots[0].width, th = shots[0].height, gap = Math.round(tw * 0.02);
      const out = createCanvas(tw * 2 + gap * 3, th * 2 + gap * 3 + Math.round(th * 0.12));
      const ctx = out.getContext('2d');
      paintBg(ctx, out.width, out.height);
      if (bgDef().checker) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height); }
      shots.forEach((s, i) => ctx.drawImage(s, gap + (i % 2) * (tw + gap), gap + Math.floor(i / 2) * (th + gap)));
      const fy = th * 2 + gap * 2 + Math.round(th * 0.07);
      ctx.fillStyle = bgDef().dark ? '#ffffff' : '#17161c';
      ctx.font = `800 ${Math.round(th * 0.05)}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(product.name, gap * 2, fy);
      ctx.font = `500 ${Math.round(th * 0.03)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.globalAlpha = 0.6;
      ctx.fillText('Mockup réalisé avec Merch Studio', out.width - gap * 2, fy);
      download(out, `${name}-planche.png`);
      toast('Planche exportée ✨');
    }
  } finally {
    viewer.controls.autoRotate = rot;
  }
}

// ---------- Logo global ----------
async function setLogo(blob, name = blob.name || 'Logo') {
  try {
    const img = await loadImage(blob);
    globalLogo = { img, name };
    store.set('img:logo', { blob, name });
    updateLogoBtn();
    zoneCache.clear();
    schedule();
    toast('Logo appliqué sur tous les produits');
  } catch (e) {
    toast('Image illisible. Essaie un PNG ou JPG.');
  }
}
function updateLogoBtn() {
  const th = $('#logo-thumb');
  if (globalLogo) {
    th.classList.add('has');
    th.style.backgroundImage = `url(${globalLogo.img.toDataURL('image/png')})`;
    $('#logo-label').textContent = 'Mon logo';
    $('#btn-logo').title = 'Changer de logo (Maj+clic pour le retirer)';
  } else {
    th.classList.remove('has');
    th.style.backgroundImage = '';
    $('#logo-label').textContent = 'Ajouter mon logo';
  }
}

// ---------- Toast ----------
let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2400);
}

// ---------- Sauvegarde ----------
let saveT = 0;
function saveSoon() {
  clearTimeout(saveT);
  saveT = setTimeout(() => store.set('settings', JSON.parse(JSON.stringify(S))), 400);
}

async function restore() {
  const saved = await store.get('settings');
  if (saved && typeof saved === 'object') Object.assign(S, saved, { products: saved.products || {} });
  const ks = (await store.keys()) || [];
  for (const k of ks) {
    if (typeof k !== 'string' || !k.startsWith('img:')) continue;
    const v = await store.get(k);
    if (!v?.blob) continue;
    try {
      const img = await loadImage(v.blob);
      if (k === 'img:logo') globalLogo = { img, name: v.name };
      else images[k.slice(4)] = { img, name: v.name };
    } catch { /* ignore */ }
  }
}

// ---------- Événements globaux ----------
function bindEvents() {
  $('#btn-rotate').addEventListener('click', () => {
    S.autoRotate = !S.autoRotate;
    viewer.controls.autoRotate = S.autoRotate;
    $('#btn-rotate').setAttribute('aria-pressed', S.autoRotate);
    saveSoon();
  });
  $('#btn-export').addEventListener('click', (e) => { e.stopPropagation(); $('#export-menu').hidden = !$('#export-menu').hidden; });
  document.addEventListener('click', (e) => { if (!e.target.closest('.export')) $('#export-menu').hidden = true; });
  document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => doExport(b.dataset.export)));
  $('#btn-help').addEventListener('click', () => $('#help').showModal());
  $('#help').addEventListener('click', (e) => { if (e.target === $('#help')) $('#help').close(); });
  $('#btn-logo').addEventListener('click', (e) => {
    if (e.shiftKey && globalLogo) {
      globalLogo = null; store.del('img:logo'); updateLogoBtn(); zoneCache.clear(); schedule(); toast('Logo retiré');
      return;
    }
    $('#logo-input').click();
  });
  $('#logo-input').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) setLogo(f); e.target.value = ''; });
  $('#intro-close').addEventListener('click', () => { S.introHidden = true; $('#intro').classList.add('hidden'); saveSoon(); });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm(`Réinitialiser « ${product.name} » (visuels, couleur, options) ?`)) return;
    for (const z of product.zones) { const k = product.id + ':' + z.id; if (images[k]) { delete images[k]; store.del('img:' + k); } }
    delete S.products[product.id];
    selectProduct(product.id);
  });
  // coller depuis Figma / presse-papiers
  document.addEventListener('paste', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (!item) { toast('Le presse-papiers ne contient pas d\'image'); return; }
    e.preventDefault();
    const z = product.zones.find((zz) => zz.id === activeZone) || product.zones[0];
    setZoneImage(z, item.getAsFile(), 'Image collée');
  });
  // glisser-déposer sur la scène
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    dragDepth++;
    setActive(activeZone);
    stage.classList.add('dragging');
  });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) stage.classList.remove('dragging'); });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    stage.classList.remove('dragging');
    const f = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
    if (!f) return;
    const z = product.zones.find((zz) => zz.id === activeZone) || product.zones[0];
    setZoneImage(z, f);
  });
  // raccourcis
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'r' || e.key === 'R') $('#btn-rotate').click();
    const n = Number(e.key);
    if (n >= 1 && n <= 9) $('#views').children[n - 1]?.click();
  });
}

// ---------- Démarrage ----------
(async function start() {
  renderRail();
  bindEvents();
  await restore();
  renderBgPicker();
  updateLogoBtn();
  viewer.controls.autoRotate = S.autoRotate;
  $('#btn-rotate').setAttribute('aria-pressed', S.autoRotate);
  if (S.introHidden) $('#intro').classList.add('hidden');
  const fromHash = location.hash.slice(1);
  selectProduct(byId[fromHash] ? fromHash : S.productId, { initial: true });
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (byId[id] && id !== product?.id) selectProduct(id); });
  window.__merch = { viewer, S, selectProduct };
})();
