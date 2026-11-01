// Composition d'impression "enveloppante" pour objets cylindriques (mug, gourde, stylo)
import { createCanvas, canvasTexture } from '../core/textures.js';

/**
 * Canvas couvrant u∈[0,1] (tour complet) × v∈[0,1] (hauteur imprimable).
 * zones : [{ id, u, v, w, h }] – u,v = centre (0..1), w,h en cm
 */
export function makeWrap({ circumference, height, W = 2048, H = 1024, zones }) {
  const canvas = createCanvas(W, H);
  const texture = canvasTexture(canvas);
  const pxu = W / circumference, pxv = H / height;
  function draw(state, { background, before, after, mode = 'source-over' } = {}) {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, W, H); } else ctx.clearRect(0, 0, W, H);
    before?.(ctx, W, H);
    for (const z of zones) {
      const zc = state.zones[z.id];
      if (!zc) continue;
      const w = z.w * pxu, h = z.h * pxv;
      const cx = z.u * W, cy = (1 - z.v) * H;
      for (const off of [-W, 0, W]) {
        if (cx + off + w / 2 < 0 || cx + off - w / 2 > W) continue;
        ctx.save();
        ctx.globalCompositeOperation = z.mode || mode;
        ctx.drawImage(zc, cx + off - w / 2, cy - h / 2, w, h);
        ctx.restore();
      }
    }
    after?.(ctx, W, H);
    texture.needsUpdate = true;
  }
  return { canvas, texture, draw, pxu, pxv };
}
