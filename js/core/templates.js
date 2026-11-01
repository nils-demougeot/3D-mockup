// Génération des gabarits SVG (importables dans Figma : glisser-déposer le fichier)

// Résolution conseillée par zone (px/cm), bornée pour rester léger
export function zonePx(zone) {
  const ppc = Math.min(300, Math.round(2400 / Math.max(zone.w, zone.h)));
  return { ppc, w: Math.round(zone.w * ppc), h: Math.round(zone.h * ppc) };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function templateSVG(product, zone) {
  const { w, h, ppc } = zonePx(zone);
  const u = Math.max(w, h) / 1000; // unité visuelle
  const fs = Math.max(14, Math.round(22 * u));
  const sw = Math.max(2, 2.5 * u);
  const m = Math.round(Math.min(w, h) * 0.05);
  const accent = '#7a3cff';
  const extra = [];
  const label = (x, y, text, anchor = 'middle', size = fs, color = accent) =>
    `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="600" fill="${color}" text-anchor="${anchor}">${esc(text)}</text>`;
  const vline = (x, dash = true, col = accent) => `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${col}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${8 * u} ${6 * u}"` : ''}/>`;
  const hline = (y, dash = true, col = accent) => `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${col}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${8 * u} ${6 * u}"` : ''}/>`;
  const key = `${product.id}:${zone.id}`;

  if (key === 'mug:wrap') {
    // la zone fait 20 cm, centrée à l'opposé de l'anse ; faces visibles à ±6,4 cm
    const off = (2 * Math.PI * 4.1 * 0.25) / zone.w;
    const xa = w * (0.5 + off), xb = w * (0.5 - off);
    extra.push(vline(xa, true, '#ff5b3a'), vline(xb, true, '#ff5b3a'));
    extra.push(label(xa, h * 0.5, 'Face visible anse à droite', 'middle', fs, '#ff5b3a'));
    extra.push(label(xb, h * 0.5, 'Face visible anse à gauche', 'middle', fs, '#ff5b3a'));
    extra.push(label(w / 2, h - m * 1.6, 'Centre = côté opposé à l\'anse · les bords touchent l\'anse'));
  }
  if (key === 'bottle:wrap') {
    extra.push(vline(w / 2, true, '#ff5b3a'));
    extra.push(label(w / 2, h * 0.5, 'Face avant', 'middle', fs, '#ff5b3a'));
    extra.push(label(m, h * 0.5, 'Dos', 'start', fs, '#ff5b3a'), label(w - m, h * 0.5, 'Dos', 'end', fs, '#ff5b3a'));
  }
  if (product.id === 'keychain') {
    const y = (1.9 / zone.h) * h;
    extra.push(`<rect x="0" y="0" width="${w}" height="${y}" fill="#7a3cff" fill-opacity="0.12"/>`, hline(y));
    extra.push(label(w / 2, y * 0.55, 'Couture', 'middle', fs * 0.8));
  }
  if (product.id === 'box' && (zone.id === 'top' || zone.id === 'floor')) {
    extra.push(label(w / 2, m * 1.6, '↑ Arrière (charnière)'), label(w / 2, h - m * 0.8, '↓ Avant (face avant de la boîte)'));
  }
  if (product.id === 'box' && zone.id === 'inside') {
    extra.push(label(w / 2, m * 1.6, '↑ Bord libre du couvercle'), label(w / 2, h - m * 0.8, '↓ Charnière (lisible couvercle ouvert)'));
  }
  if (zone.transparent) {
    extra.push(`<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.42}" fill="none" stroke="#ff5b3a" stroke-width="${sw}" stroke-dasharray="${4 * u} ${6 * u}"/>`);
    extra.push(label(w / 2, h - m * 0.8, 'Fond transparent : la découpe suit la forme de ton visuel', 'middle', fs * 0.85, '#ff5b3a'));
  }
  if (product.id === 'cap' && zone.id === 'front') {
    extra.push(`<path d="M ${m} ${h - m} Q ${w / 2} ${-h * 0.15} ${w - m} ${h - m}" fill="none" stroke="#ff5b3a" stroke-width="${sw}" stroke-dasharray="${8 * u} ${6 * u}"/>`);
    extra.push(label(w / 2, h - m * 1.2, 'Zone conseillée (panneau avant arrondi)', 'middle', fs * 0.8, '#ff5b3a'));
  }

  const title = `${product.name} · ${zone.label}`;
  const dims = `${zone.w} × ${zone.h} cm · ${w} × ${h} px (${Math.round(ppc * 2.54)} dpi)`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <title>${esc(title)}</title>
  <g id="GUIDES - a masquer avant export">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#f6f3ff"/>
    <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${accent}" stroke-opacity="0.7" stroke-width="${sw}" stroke-dasharray="${10 * u} ${8 * u}" rx="${4 * u}"/>
    <line x1="${w / 2}" y1="${m}" x2="${w / 2}" y2="${h - m}" stroke="${accent}" stroke-opacity="0.25" stroke-width="${sw * 0.7}"/>
    <line x1="${m}" y1="${h / 2}" x2="${w - m}" y2="${h / 2}" stroke="${accent}" stroke-opacity="0.25" stroke-width="${sw * 0.7}"/>
    ${extra.join('\n    ')}
    ${label(m * 1.2, m * 2.2, title, 'start', fs * 1.1)}
    ${label(m * 1.2, m * 2.2 + fs * 1.4, dims, 'start', fs * 0.8, '#6b6880')}
    ${label(m * 1.2, h - m * 1.6 - (extra.length ? fs * 1.4 : 0), 'Masque le groupe GUIDES puis exporte le frame en PNG', 'start', fs * 0.75, '#6b6880')}
  </g>
  <g id="TON DESIGN ICI"></g>
</svg>`;
}

export function downloadText(text, filename, type = 'image/svg+xml') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
