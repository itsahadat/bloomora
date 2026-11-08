import { canvasTexture } from './Skin.js';
import { starPoints } from './UI.js';

/**
 * Sparkle and glow effect textures, drawn in code: soft white shapes the game tints
 * per use (match pops, specials, rewards, the map halo...). 128x128 each.
 */
const S = 128;
const C = S / 2;

/** A soft white disc fading out to the edge. */
function glow(ctx, r = C, inner = 0) {
  const g = ctx.createRadialGradient(C, C, inner, C, C, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}

/** A thin four-point lens flare: two tapered spikes crossing in the middle. */
function flare(ctx, length, width, angle = 0) {
  ctx.save();
  ctx.translate(C, C);
  ctx.rotate(angle);
  [0, Math.PI / 2].forEach((a) => {
    ctx.save();
    ctx.rotate(a);
    const g = ctx.createLinearGradient(-length, 0, length, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-length, 0);
    ctx.quadraticCurveTo(0, -width, length, 0);
    ctx.quadraticCurveTo(0, width, -length, 0);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

export function ensureFxTextures(scene) {
  // Small twinkle.
  canvasTexture(scene, 'fx-star4', S, S, (ctx) => {
    glow(ctx, 22);
    flare(ctx, 52, 5);
  });

  // Bright star burst: glowing core, long main spikes and short diagonal ones.
  canvasTexture(scene, 'fx-star6', S, S, (ctx) => {
    glow(ctx, 30);
    flare(ctx, 62, 7);
    ctx.globalAlpha = 0.55;
    flare(ctx, 30, 4, Math.PI / 4);
    ctx.globalAlpha = 1;
    const core = ctx.createRadialGradient(C, C, 0, C, C, 10);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, S, S);
  });

  // Soft round glow.
  canvasTexture(scene, 'fx-glow', S, S, (ctx) => glow(ctx, C - 2));

  // A shock ring: a bright soft band with a faint inner haze.
  canvasTexture(scene, 'fx-ring', S, S, (ctx) => {
    const g = ctx.createRadialGradient(C, C, 0, C, C, C - 2);
    g.addColorStop(0, 'rgba(255,255,255,0.25)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.78, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.9, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  });

  // Magic seal: a thin ring with four sharp points (rainbow seed burst).
  canvasTexture(scene, 'fx-magic', S, S, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(C, C, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i += 1) {
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -60);
      ctx.lineTo(6, -34);
      ctx.lineTo(0, -24);
      ctx.lineTo(-6, -34);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  // Twirl: three soft crescent arcs spiralling around the center.
  canvasTexture(scene, 'fx-twirl', S, S, (ctx) => {
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 6;
    [[54, 9, 0.85], [42, 6, 0.6], [30, 4, 0.4]].forEach(([r, w, a], i) => {
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      const start = i * 2.1;
      ctx.arc(C, C, r, start, start + Math.PI * 1.1);
      ctx.stroke();
    });
  });

  // Gold star icon (Quests list).
  canvasTexture(scene, 'ui-star', 64, 64, (ctx) => {
    const pts = starPoints(32, 34, 29, 14);
    const g = ctx.createLinearGradient(0, 4, 0, 62);
    g.addColorStop(0, '#ffe36b');
    g.addColorStop(1, '#f5a814');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#c47a06';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(24, 24, 7, 4, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });
}
