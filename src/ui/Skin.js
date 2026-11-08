/**
 * Skin: polished UI textures drawn once with the Canvas 2D API (real gradients, soft shadows, gloss).
 * Every texture is cached by name + size, so asking twice is free.
 *
 * Shadowed textures include a margin `M` around the shape; images built from them are
 * centered on the shape itself, so place them like the plain box.
 */
export const M = 14;

export const BUTTON_COLORS = {
  yellow: { light: '#ffeb7a', base: '#ffb81f', dark: '#cf7406', text: '#a24f00' },
  green: { light: '#a8ee70', base: '#4fc12f', dark: '#2c861b', text: '#21650f' },
  blue: { light: '#86dcff', base: '#2e98ef', dark: '#1a5bb0', text: '#154d92' },
  red: { light: '#ff9d88', base: '#ec4a3c', dark: '#a3261c', text: '#861b13' },
  grey: { light: '#f0f0f0', base: '#bdbdbd', dark: '#878787', text: '#666666' },
  purple: { light: '#e1a8ff', base: '#a35cf0', dark: '#6a2bb0', text: '#552090' },
};

export const COLORS = {
  title: '#e07b22',
  titleStroke: '#ffffff',
  text: '#7a4a1e',
  soft: '#9a6b3c',
  muted: '#b08a60',
  good: '#3c9a2f',
  bad: '#d0453a',
};

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  return g;
}

function shadow(ctx, on, { blur = 12, y = 5, color = 'rgba(40, 22, 6, 0.35)' } = {}) {
  ctx.shadowColor = on ? color : 'transparent';
  ctx.shadowBlur = on ? blur : 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = on ? y : 0;
}

/** Make (or reuse) a canvas texture. */
export function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
  return key;
}

// ---------------------------------------------------------------- panels & cards

/** Wooden frame around warm parchment with a dashed stitch line. */
export function panelTexture(scene, w, h) {
  w = Math.round(w); h = Math.round(h);
  return canvasTexture(scene, `skin-panel-${w}x${h}`, w + M * 2, h + M * 2, (ctx) => {
    const x = M; const y = M;
    shadow(ctx, true, { blur: 18, y: 8, color: 'rgba(30, 15, 0, 0.45)' });
    rr(ctx, x, y, w, h, 22);
    ctx.fillStyle = vgrad(ctx, y, y + h, [[0, '#f3bb73'], [0.5, '#d9934a'], [1, '#b8702f']]);
    ctx.fill();
    shadow(ctx, false);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#8b4f1c';
    ctx.stroke();
    // Light top edge on the wood.
    rr(ctx, x + 4, y + 3, w - 8, h - 8, 19);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 228, 180, 0.7)';
    ctx.stroke();
    // Parchment.
    const b = 13;
    rr(ctx, x + b, y + b, w - b * 2, h - b * 2, 13);
    ctx.fillStyle = vgrad(ctx, y + b, y + h - b, [[0, '#fffaf0'], [1, '#fbe9c4']]);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(150, 90, 35, 0.45)';
    ctx.stroke();
    // Stitched dashed line.
    const d = b + 9;
    rr(ctx, x + d, y + d, w - d * 2, h - d * 2, 8);
    ctx.setLineDash([10, 7]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(196, 140, 80, 0.55)';
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

/** Small wooden HUD card with a label strip on top and a cream window below. */
export function cardTexture(scene, w, h, labelH = 26) {
  w = Math.round(w); h = Math.round(h);
  return canvasTexture(scene, `skin-card-${w}x${h}-${labelH}`, w + M * 2, h + M * 2, (ctx) => {
    const x = M; const y = M;
    shadow(ctx, true, { blur: 10, y: 5 });
    rr(ctx, x, y, w, h, 18);
    ctx.fillStyle = vgrad(ctx, y, y + h, [[0, '#f6c27d'], [1, '#c98140']]);
    ctx.fill();
    shadow(ctx, false);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#8b4f1c';
    ctx.stroke();
    rr(ctx, x + 3, y + 3, w - 6, h - 6, 15);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 232, 190, 0.75)';
    ctx.stroke();
    const b = 8;
    rr(ctx, x + b, y + labelH, w - b * 2, h - labelH - b, 12);
    ctx.fillStyle = vgrad(ctx, y + labelH, y + h - b, [[0, '#f1dcb3'], [0.18, '#fff6e2'], [1, '#fbecc9']]);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(140, 80, 30, 0.45)';
    ctx.stroke();
  });
}

/** Sunken parchment box used inside panels (goal lists etc.). */
export function insetTexture(scene, w, h) {
  w = Math.round(w); h = Math.round(h);
  return canvasTexture(scene, `skin-inset-${w}x${h}`, w + 4, h + 4, (ctx) => {
    rr(ctx, 2, 2, w, h, 18);
    ctx.fillStyle = vgrad(ctx, 2, h, [[0, '#d9b47e'], [0.12, '#ebcf9f'], [1, '#f1dcb1']]);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(150, 95, 40, 0.55)';
    ctx.stroke();
  });
}

/** Cream pill used behind lives / coins counters. */
export function pillTexture(scene, w, h) {
  w = Math.round(w); h = Math.round(h);
  return canvasTexture(scene, `skin-pill-${w}x${h}`, w + M * 2, h + M * 2, (ctx) => {
    shadow(ctx, true, { blur: 8, y: 4 });
    rr(ctx, M, M, w, h, h / 2);
    ctx.fillStyle = vgrad(ctx, M, M + h, [[0, '#fffaf0'], [1, '#f6e2bb']]);
    ctx.fill();
    shadow(ctx, false);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c98140';
    ctx.stroke();
  });
}

// ---------------------------------------------------------------- buttons

/** Glossy candy button. `radius` defaults to a pill. */
export function buttonTexture(scene, w, h, color = 'green', radius = null) {
  w = Math.round(w); h = Math.round(h);
  const c = BUTTON_COLORS[color] ?? BUTTON_COLORS.green;
  const r = radius ?? h / 2;
  return canvasTexture(scene, `skin-btn-${color}-${w}x${h}-${r}`, w + M * 2, h + M * 2, (ctx) => {
    const x = M; const y = M;
    // Darker lip under the button.
    shadow(ctx, true, { blur: 8, y: 4, color: 'rgba(0, 0, 0, 0.3)' });
    rr(ctx, x, y + 3, w, h - 3, r);
    ctx.fillStyle = c.dark;
    ctx.fill();
    shadow(ctx, false);
    // Body.
    rr(ctx, x, y, w, h - 6, r);
    ctx.fillStyle = vgrad(ctx, y, y + h - 6, [[0, c.light], [0.55, c.base], [1, c.base]]);
    ctx.fill();
    // Gloss.
    rr(ctx, x + Math.min(10, w * 0.12), y + 4, w - Math.min(20, w * 0.24), (h - 6) * 0.42, r * 0.8);
    ctx.fillStyle = vgrad(ctx, y + 4, y + 4 + (h - 6) * 0.42, [[0, 'rgba(255,255,255,0.65)'], [1, 'rgba(255,255,255,0.12)']]);
    ctx.fill();
    // Outline.
    rr(ctx, x, y, w, h - 1, r);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = c.dark;
    ctx.stroke();
  });
}

/** Glossy round orb (map level nodes). */
export function orbTexture(scene, size, color = 'green') {
  const c = BUTTON_COLORS[color] ?? BUTTON_COLORS.green;
  return canvasTexture(scene, `skin-orb-${color}-${size}`, size + M * 2, size + M * 2, (ctx) => {
    const cx = M + size / 2; const cy = M + size / 2; const rad = size / 2;
    shadow(ctx, true, { blur: 10, y: 5, color: 'rgba(0,0,0,0.35)' });
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    shadow(ctx, false);
    ctx.beginPath(); ctx.arc(cx, cy + 2, rad - 4, 0, Math.PI * 2);
    ctx.fillStyle = c.dark;
    ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, rad - 5, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
    g.addColorStop(0, c.light); g.addColorStop(0.6, c.base); g.addColorStop(1, c.dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy - rad * 0.42, rad * 0.55, rad * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
  });
}

/** White circle count badge with a brown rim. */
export function badgeTexture(scene, size = 30, fill = '#ffffff', rim = '#c98140') {
  return canvasTexture(scene, `skin-badge-${size}-${fill}-${rim}`, size + 8, size + 8, (ctx) => {
    const c = 4 + size / 2;
    shadow(ctx, true, { blur: 4, y: 2, color: 'rgba(0,0,0,0.25)' });
    ctx.beginPath(); ctx.arc(c, c, size / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    shadow(ctx, false);
    ctx.lineWidth = 2.5; ctx.strokeStyle = rim; ctx.stroke();
  });
}

// ---------------------------------------------------------------- board & effects

/** Cream board tile with a soft inner shade. */
export function tileTexture(scene, size, alt = false) {
  return canvasTexture(scene, `skin-tile-${size}-${alt ? 1 : 0}`, size, size, (ctx) => {
    rr(ctx, 2, 2, size - 4, size - 4, 10);
    ctx.fillStyle = vgrad(ctx, 2, size - 2, alt
      ? [[0, '#fbf0d6'], [1, '#f1dfb8']]
      : [[0, '#fffaf0'], [1, '#f8ebcd']]);
    ctx.fill();
    rr(ctx, 2, size - 10, size - 4, 8, 6);
    ctx.fillStyle = 'rgba(170, 120, 60, 0.12)';
    ctx.fill();
  });
}

/** Radial light rays for the victory screen. */
export function raysTexture(scene, size = 512) {
  return canvasTexture(scene, `skin-rays-${size}`, size, size, (ctx) => {
    const c = size / 2;
    const n = 16;
    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / n / 2.2;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c, a0, a1);
      ctx.closePath();
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255, 250, 200, 0.95)');
      g.addColorStop(0.5, 'rgba(255, 230, 120, 0.45)');
      g.addColorStop(1, 'rgba(255, 220, 90, 0)');
      ctx.fillStyle = g;
      ctx.fill();
    }
    const glow = ctx.createRadialGradient(c, c, 0, c, c, c * 0.55);
    glow.addColorStop(0, 'rgba(255, 255, 220, 0.9)');
    glow.addColorStop(1, 'rgba(255, 240, 150, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Chunky jelly star (victory / results). */
export function bigStarTexture(scene, size = 256, gold = true) {
  return canvasTexture(scene, `skin-star-${size}-${gold ? 'g' : 'x'}`, size, size, (ctx) => {
    const c = size / 2;
    const outer = size * 0.46; const inner = size * 0.24;
    const path = () => {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const rad = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = c + Math.cos(a) * rad; const py = c + 6 + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    shadow(ctx, true, { blur: 10, y: 6, color: 'rgba(80, 40, 0, 0.35)' });
    path();
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = gold ? '#e07a10' : '#9a9a9a';
    ctx.stroke();
    shadow(ctx, false);
    path();
    const g = ctx.createRadialGradient(c - size * 0.1, c - size * 0.15, size * 0.05, c, c, outer);
    if (gold) { g.addColorStop(0, '#fff6a8'); g.addColorStop(0.45, '#ffd23a'); g.addColorStop(1, '#ffa412'); } else { g.addColorStop(0, '#f2f2f2'); g.addColorStop(1, '#c4c4c4'); }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(c - size * 0.08, c - size * 0.12, size * 0.13, size * 0.07, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  });
}

/** Soft dark edges over the whole screen. */
export function vignetteTexture(scene) {
  return canvasTexture(scene, 'skin-vignette', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
    g.addColorStop(0, 'rgba(10, 30, 10, 0)');
    g.addColorStop(1, 'rgba(10, 30, 10, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

/** Simple white UI glyphs drawn on buttons. */
export function glyphTexture(scene, kind) {
  return canvasTexture(scene, `skin-glyph-${kind}`, 64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    shadow(ctx, true, { blur: 0, y: 3, color: 'rgba(0,0,0,0.25)' });
    if (kind === 'pause') {
      rr(ctx, 16, 12, 11, 40, 4); ctx.fill();
      rr(ctx, 37, 12, 11, 40, 4); ctx.fill();
    } else if (kind === 'close-plain') {
      // Plain wood-brown X for panel corners: a soft light emboss under a solid stroke.
      shadow(ctx, true, { blur: 0, y: 2, color: 'rgba(255,255,255,0.9)' });
      ctx.lineWidth = 9; ctx.strokeStyle = '#a8642a';
      ctx.beginPath(); ctx.moveTo(18, 18); ctx.lineTo(46, 46); ctx.moveTo(46, 18); ctx.lineTo(18, 46); ctx.stroke();
    } else if (kind === 'close') {
      ctx.lineWidth = 11; ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(17, 17); ctx.lineTo(47, 47); ctx.moveTo(47, 17); ctx.lineTo(17, 47); ctx.stroke();
    } else if (kind === 'back') {
      ctx.lineWidth = 11; ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(38, 14); ctx.lineTo(20, 32); ctx.lineTo(38, 50); ctx.stroke();
    } else if (kind === 'plus') {
      ctx.lineWidth = 11; ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(32, 14); ctx.lineTo(32, 50); ctx.moveTo(14, 32); ctx.lineTo(50, 32); ctx.stroke();
    } else if (kind === 'gear') {
      ctx.beginPath();
      for (let i = 0; i < 16; i += 1) {
        const rad = i % 2 ? 19 : 26;
        const a = (i / 16) * Math.PI * 2;
        ctx.lineTo(32 + Math.cos(a) * rad, 32 + Math.sin(a) * rad);
      }
      ctx.closePath(); ctx.fill();
      shadow(ctx, false);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(32, 32, 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (kind === 'restart') {
      ctx.lineWidth = 9; ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(32, 34, 17, -Math.PI * 0.35, Math.PI * 1.45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40, 6); ctx.lineTo(52, 22); ctx.lineTo(33, 25); ctx.closePath(); ctx.fill();
    } else if (kind === 'map') {
      ctx.beginPath(); ctx.moveTo(10, 16); ctx.lineTo(24, 10); ctx.lineTo(40, 16); ctx.lineTo(54, 10); ctx.lineTo(54, 48);
      ctx.lineTo(40, 54); ctx.lineTo(24, 48); ctx.lineTo(10, 54); ctx.closePath(); ctx.fill();
      shadow(ctx, false);
      ctx.strokeStyle = 'rgba(0, 80, 160, 0.4)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(24, 10); ctx.lineTo(24, 48); ctx.moveTo(40, 16); ctx.lineTo(40, 54); ctx.stroke();
    }
  });
}
