// Visuels de démonstration générés à la volée (remplacés par tes propres fichiers)
import { createCanvas } from './textures.js';

const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function curvedText(ctx, text, cx, cy, r, start, size, color, inside = false) {
  ctx.save();
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + size * 0.08);
  const total = widths.reduce((a, b) => a + b, 0);
  let ang = start - (total / r) / 2 * (inside ? -1 : 1);
  for (let i = 0; i < chars.length; i++) {
    const a = ang + (widths[i] / 2 / r) * (inside ? -1 : 1);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + (inside ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    ang += (widths[i] / r) * (inside ? -1 : 1);
  }
  ctx.restore();
}

function star(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Badge rond façon logo d'asso
export function demoLogo(size = 1024, { a = '#ff5b3a', b = '#7a3cff', ink = '#ffffff', name = 'MON ASSO' } = {}) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const s = size / 1024;
  const cx = size / 2, cy = size / 2;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.beginPath(); ctx.arc(cx, cy, 500 * s, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 14 * s; ctx.strokeStyle = ink;
  ctx.beginPath(); ctx.arc(cx, cy, 440 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 5 * s;
  ctx.beginPath(); ctx.arc(cx, cy, 300 * s, 0, Math.PI * 2); ctx.stroke();
  curvedText(ctx, name, cx, cy, 370 * s, -Math.PI / 2, 92 * s, ink);
  curvedText(ctx, '★ EST. 2026 ★', cx, cy, 370 * s, Math.PI / 2, 62 * s, ink, true);
  // monogramme
  ctx.fillStyle = ink;
  ctx.font = `900 ${300 * s}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('A', cx, cy + 18 * s);
  star(ctx, cx + 150 * s, cy - 150 * s, 42 * s, ink);
  return c;
}

// Forme découpée (sticker / pin) avec transparence
export function demoSticker(size = 1024) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const s = size / 1024, cx = size / 2, cy = size / 2;
  ctx.beginPath();
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const r = (400 + Math.sin(a * 12) * 34) * s;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#ffcf3a'); g.addColorStop(0.5, '#ff5b3a'); g.addColorStop(1, '#ff2d87');
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, 290 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1b2f';
  ctx.font = `900 ${150 * s}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('HELLO', cx, cy - 40 * s);
  ctx.font = `800 ${74 * s}px ${FONT}`;
  ctx.fillStyle = '#ff2d87';
  ctx.fillText('MON ASSO', cx, cy + 85 * s);
  star(ctx, cx - 190 * s, cy - 200 * s, 30 * s, '#ffcf3a');
  star(ctx, cx + 200 * s, cy + 190 * s, 24 * s, '#7a3cff');
  return c;
}

// Bandeau horizontal (mug, stylo, gourde)
export function demoWide(w = 2000, h = 800, { a = '#ff5b3a', b = '#7a3cff', name = 'MON ASSO', tagline = 'ensemble, plus loin' } = {}) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const logo = demoLogo(1024, { a, b });
  const L = h * 0.82;
  ctx.drawImage(logo, w * 0.07, (h - L) / 2, L, L);
  ctx.fillStyle = '#1b1b2f';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${h * 0.22}px ${FONT}`;
  ctx.fillText(name, w * 0.07 + L + h * 0.12, h * 0.42);
  ctx.font = `600 ${h * 0.1}px ${FONT}`;
  ctx.fillStyle = a;
  ctx.fillText(tagline.toUpperCase(), w * 0.07 + L + h * 0.13, h * 0.66);
  return c;
}

// Texte seul (stylo)
export function demoText(w = 1600, h = 260, text = 'MON ASSO • 2026', color = '#ffffff') {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${h * 0.5}px ${FONT}`;
  ctx.fillText(text, w / 2, h / 2 + h * 0.04);
  return c;
}
