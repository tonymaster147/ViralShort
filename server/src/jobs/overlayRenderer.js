const path = require('path');
const fs = require('fs');
const { createCanvas } = require('@napi-rs/canvas');

const OVERLAY_DIR = path.join(__dirname, '..', '..', 'uploads', 'overlays');
fs.mkdirSync(OVERLAY_DIR, { recursive: true });

// Render an editor overlay description into a transparent PNG sized to the video.
//
// overlay = {
//   layers: [
//     { type: 'text', x, y, text, color, fontSize, fontWeight, align, rotation, bg },
//     { type: 'sticker', x, y, emoji, size, rotation },
//     { type: 'draw', color, width, points: [{x,y}, ...] },   // x/y normalized 0..1
//   ]
// }
// All x/y/size/fontSize/width are NORMALIZED (fractions of width or height) so the
// same overlay scales to any output resolution.
//
// Returns the PNG file path, or null if there's nothing to draw.
function renderOverlay(overlay, videoWidth, videoHeight) {
  const layers = overlay?.layers || [];
  if (!layers.length) return null;

  const W = videoWidth || 1080;
  const H = videoHeight || 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  for (const layer of layers) {
    try {
      if (layer.type === 'draw') {
        const pts = layer.points || [];
        if (pts.length < 2) continue;
        ctx.strokeStyle = layer.color || '#ffffff';
        ctx.lineWidth = Math.max(1, (layer.width || 0.01) * W);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x * W, pts[0].y * H);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * W, pts[i].y * H);
        ctx.stroke();
      } else if (layer.type === 'text') {
        const fontPx = Math.max(8, (layer.fontSize || 0.06) * H);
        ctx.save();
        ctx.translate(layer.x * W, layer.y * H);
        if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.font = `${layer.fontWeight || 'bold'} ${fontPx}px ${layer.font || 'sans-serif'}`;
        ctx.textAlign = layer.align || 'center';
        ctx.textBaseline = 'middle';
        const text = String(layer.text || '');
        // optional highlight background
        if (layer.bg) {
          const m = ctx.measureText(text);
          const padX = fontPx * 0.3, padY = fontPx * 0.2;
          const w = m.width + padX * 2;
          const h = fontPx + padY * 2;
          const bx = layer.align === 'left' ? 0 : layer.align === 'right' ? -w : -w / 2;
          ctx.fillStyle = layer.bg;
          roundRect(ctx, bx, -h / 2, w, h, fontPx * 0.25);
          ctx.fill();
        }
        // stroke for legibility
        ctx.lineWidth = Math.max(2, fontPx * 0.06);
        ctx.strokeStyle = layer.stroke || 'rgba(0,0,0,0.55)';
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = layer.color || '#ffffff';
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else if (layer.type === 'sticker') {
        const px = Math.max(12, (layer.size || 0.12) * H);
        ctx.save();
        ctx.translate(layer.x * W, layer.y * H);
        if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.font = `${px}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(layer.emoji || '⭐'), 0, 0);
        ctx.restore();
      }
    } catch (e) {
      console.error('[overlay] layer render error:', e.message);
    }
  }

  const outPath = path.join(OVERLAY_DIR, `ov_${Date.now()}_${Math.round(Math.random() * 1e9)}.png`);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  return outPath;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

module.exports = { renderOverlay };
