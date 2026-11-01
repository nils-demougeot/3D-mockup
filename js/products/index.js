// Registre des produits + icônes
import tshirt from './tshirt.js';
import hoodie from './hoodie.js';
import polo from './polo.js';
import cap from './cap.js';
import tote from './tote.js';
import mug from './mug.js';
import bottle from './bottle.js';
import pen from './pen.js';
import pin from './pin.js';
import sticker from './sticker.js';
import keychain from './keychain.js';
import box from './box.js';
import { demoSticker, demoText, demoLogo } from '../core/demo.js';

const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONS = {
  tshirt: I('<path d="M8.5 3.5 3.5 6l1.8 4 2.2-.9V20.5h9V9.1l2.2.9 1.8-4-5-2.5c-.4 1.3-1.8 2.2-3.5 2.2s-3.1-.9-3.5-2.2Z"/>'),
  hoodie: I('<path d="M9 5.5c0-2 1.3-3 3-3s3 1 3 3"/><path d="M9 5.5 4.5 8 3.5 19h2.8l.7-8v10h10V11l.7 8h2.8l-1-11L15 5.5"/><path d="M10.5 7.5l.2 4M13.5 7.5l-.2 4M9 15h6"/>'),
  polo: I('<path d="M8.5 3.5 3.5 6l1.8 4 2.2-.9V20.5h9V9.1l2.2.9 1.8-4-5-2.5"/><path d="m8.5 3.5 2 3.5L12 5l1.5 2 2-3.5M12 7v4"/>'),
  cap: I('<path d="M3.5 15.5c0-5 3.8-9 8.5-9s8.5 4 8.5 9Z"/><path d="M12 15.5h8.5c1.5 0 2.2 1.6.8 2.3-1.6.7-4.3.9-7.3.4"/><path d="M12 6.5v-1"/>'),
  tote: I('<path d="M4.5 8.5h15l-1 12h-13Z"/><path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5"/>'),
  mug: I('<path d="M4.5 6.5h11v10a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3Z"/><path d="M15.5 9h1.5a2.5 2.5 0 0 1 0 5h-1.5"/>'),
  bottle: I('<path d="M10 2.5h4v3h-4z"/><path d="M10 5.5c0 1.5-2.5 2-2.5 4.5v10.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V10c0-2.5-2.5-3-2.5-4.5"/><path d="M7.5 12h9"/>'),
  pen: I('<path d="m4 20 1.2-4.2L16.5 4.5a2 2 0 0 1 2.9 2.9L8.2 18.8Z"/><path d="m14.5 6.5 3 3M15 4l1.5-1.5"/>'),
  pin: I('<circle cx="12" cy="11" r="7"/><path d="M12 7.5l1.1 2.3 2.5.3-1.8 1.8.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.8 2.5-.3Z"/><path d="M12 18v3.5"/>'),
  sticker: I('<path d="M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v9l-6.5 6.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z"/><path d="M20.5 14H16a2 2 0 0 0-2 2v4.5"/>'),
  keychain: I('<circle cx="12" cy="5.5" r="3"/><path d="M9.5 9.5h5v11a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5Z"/><path d="M10.5 12h3"/>'),
  box: I('<path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9Z"/><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9"/>'),
};

// Démos spécifiques (quand aucun visuel n'est importé)
pen.demo = () => demoText(1600, 300, 'MON ASSO • 2026', '#ffffff');
sticker.demo = () => demoSticker();
pin.demo = () => demoSticker();
keychain.demo = (zone) => {
  const c = document.createElement('canvas');
  c.width = 300; c.height = 1250;
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.translate(150, 700);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 150px "Inter", system-ui, sans-serif';
  ctx.fillText(zone.id === 'back' ? 'BIENVENUE' : 'MON ASSO', 0, 0);
  ctx.restore();
  const logo = demoLogo(512, { a: '#ffffff', b: '#ffffff', ink: '#d0202f' });
  ctx.drawImage(logo, 50, 1010, 200, 200);
  return c;
};

export const PRODUCTS = [tshirt, hoodie, polo, cap, tote, mug, bottle, pen, keychain, pin, sticker, box];
export const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export const SHORT = {
  tshirt: 'T-shirt', hoodie: 'Hoodie', polo: 'Polo', cap: 'Casquette', tote: 'Tote bag', mug: 'Mug',
  bottle: 'Gourde', pen: 'Stylo', keychain: 'Porte-clé', pin: 'Pin\'s', sticker: 'Sticker', box: 'Welcome box',
};
