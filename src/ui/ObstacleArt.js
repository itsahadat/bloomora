/**
 * Glossy obstacle art, drawn once at 128px with the Canvas 2D API so it matches the PNG pieces:
 * soft gradients, dark rounded outlines, specular highlights.
 * Call `ensureObstacleArt(scene)` before Board.ensureTextures — the board's flat fallbacks are then skipped.
 */
const S = 128;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([at, c]) => g.addColorStop(at, c));
  return g;
}

function rad(ctx, x, y, r0, r1, stops, ox = 0, oy = 0) {
  const g = ctx.createRadialGradient(x + ox, y + oy, r0, x, y, r1);
  stops.forEach(([at, c]) => g.addColorStop(at, c));
  return g;
}

function make(scene, key, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, S, S);
  const ctx = tex.getContext();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  tex.refresh();
}

/** Seeded random so every texture looks the same on every run. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------- ground

function soil(ctx, dark) {
  const R = rng(dark ? 7 : 3);
  rr(ctx, 4, 4, 120, 120, 22);
  ctx.fillStyle = rad(ctx, 64, 64, 10, 90, dark
    ? [[0, '#a8692f'], [1, '#6e3f17']]
    : [[0, '#e0a865'], [1, '#b17437']], -18, -22);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = dark ? '#4a2a0e' : '#7d4b1f';
  ctx.stroke();
  // Cracks.
  ctx.save();
  rr(ctx, 6, 6, 116, 116, 20);
  ctx.clip();
  ctx.strokeStyle = dark ? 'rgba(45, 22, 6, 0.75)' : 'rgba(110, 62, 22, 0.7)';
  for (let i = 0; i < (dark ? 6 : 4); i += 1) {
    ctx.lineWidth = 3 + R() * 2;
    let x = 14 + R() * 100;
    let y = 14 + R() * 100;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k += 1) {
      x += (R() - 0.5) * 36;
      y += (R() - 0.5) * 36;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Pebbles with a tiny highlight.
  for (let i = 0; i < (dark ? 9 : 7); i += 1) {
    const px = 16 + R() * 96;
    const py = 16 + R() * 96;
    const pr = 3 + R() * 4;
    ctx.fillStyle = dark ? '#8a5a30' : '#c98f52';
    ctx.beginPath(); ctx.ellipse(px, py, pr * 1.3, pr, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 230, 190, 0.6)';
    ctx.beginPath(); ctx.ellipse(px - pr * 0.4, py - pr * 0.4, pr * 0.5, pr * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Top sheen.
  rr(ctx, 12, 8, 104, 22, 11);
  ctx.fillStyle = 'rgba(255, 240, 210, 0.18)';
  ctx.fill();
}

function grass(ctx) {
  const R = rng(11);
  rr(ctx, 4, 4, 120, 120, 22);
  ctx.fillStyle = rad(ctx, 64, 64, 10, 92, [[0, '#b9ef8c'], [1, '#6fbd45']], -18, -22);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#3f8a25';
  ctx.stroke();
  ctx.save();
  rr(ctx, 6, 6, 116, 116, 20);
  ctx.clip();
  for (let i = 0; i < 22; i += 1) {
    const x = 12 + R() * 104;
    const y = 22 + R() * 98;
    const hgt = 10 + R() * 12;
    ctx.fillStyle = R() > 0.5 ? '#5aa83a' : '#8fd664';
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.quadraticCurveTo(x - 1, y - hgt * 0.6, x + (R() - 0.5) * 6, y - hgt);
    ctx.quadraticCurveTo(x + 2, y - hgt * 0.5, x + 3, y);
    ctx.closePath();
    ctx.fill();
  }
  // A few tiny daisies.
  [[34, 40], [92, 76], [56, 98]].forEach(([x, y]) => {
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.2, 2.2, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// ---------------------------------------------------------------- planter crate

function crate(ctx, banded) {
  const x = 8; const y = 8; const w = 112; const h = 112;
  // Shadow + body.
  rr(ctx, x, y + 4, w, h, 16);
  ctx.fillStyle = 'rgba(60, 30, 5, 0.35)';
  ctx.fill();
  rr(ctx, x, y, w, h, 16);
  ctx.fillStyle = banded ? '#7a4519' : '#8f5520';
  ctx.fill();
  // Three planks.
  const plankH = (h - 16) / 3;
  for (let i = 0; i < 3; i += 1) {
    const py = y + 6 + i * (plankH + 2);
    rr(ctx, x + 6, py, w - 12, plankH, 8);
    ctx.fillStyle = lin(ctx, 0, py, 0, py + plankH, banded
      ? [[0, '#d99a58'], [1, '#a8652c']]
      : [[0, '#f0b673'], [1, '#c27c3c']]);
    ctx.fill();
    // Wood grain.
    ctx.strokeStyle = 'rgba(120, 65, 20, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 14, py + plankH * 0.45);
    ctx.bezierCurveTo(x + 40, py + plankH * 0.3, x + 70, py + plankH * 0.7, x + w - 14, py + plankH * 0.5);
    ctx.stroke();
    // Plank highlight.
    rr(ctx, x + 12, py + 3, w - 24, 5, 2.5);
    ctx.fillStyle = 'rgba(255, 236, 200, 0.55)';
    ctx.fill();
  }
  // Nails.
  [[x + 16, y + 16], [x + w - 16, y + 16], [x + 16, y + h - 16], [x + w - 16, y + h - 16]].forEach(([nx, ny]) => {
    ctx.fillStyle = rad(ctx, nx, ny, 0.5, 5, [[0, '#ffffff'], [0.4, '#c9ced4'], [1, '#6b7177']], -1.5, -1.5);
    ctx.beginPath(); ctx.arc(nx, ny, 4.5, 0, Math.PI * 2); ctx.fill();
  });
  if (banded) {
    [y + 26, y + h - 38].forEach((by) => {
      rr(ctx, x - 2, by, w + 4, 14, 5);
      ctx.fillStyle = lin(ctx, 0, by, 0, by + 14, [[0, '#eef2f5'], [0.5, '#a9b4be'], [1, '#6e7a85']]);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#4c5660';
      ctx.stroke();
      [x + 10, x + w / 2, x + w - 10].forEach((rx) => {
        ctx.fillStyle = rad(ctx, rx, by + 7, 0.5, 4, [[0, '#ffffff'], [1, '#7c8791']], -1, -1);
        ctx.beginPath(); ctx.arc(rx, by + 7, 3.5, 0, Math.PI * 2); ctx.fill();
      });
    });
  }
  rr(ctx, x, y, w, h, 16);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#5a2f0c';
  ctx.stroke();
}

// ---------------------------------------------------------------- vines, weed, seed, pot

function leaf(ctx, x, y, len, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, -len * 0.4, 0, len * 0.4, [[0, '#9be86a'], [1, '#3c9a2a']]);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#1f5e14';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(230, 255, 200, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(len * 0.12, 0); ctx.lineTo(len * 0.85, 0); ctx.stroke();
  ctx.restore();
}

function vine(ctx) {
  const paths = [
    [[6, 30], [44, 52], [84, 30], [122, 62]],
    [[6, 98], [46, 74], [82, 98], [122, 66]],
    [[62, 4], [50, 60], [74, 124]],
  ];
  const stroke = (pts, width, color) => {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 4) ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    else ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    ctx.stroke();
  };
  paths.forEach((p) => stroke(p, 15, '#1f5e14'));
  paths.forEach((p) => stroke(p, 10, '#4caf3a'));
  paths.forEach((p) => stroke(p, 3.5, 'rgba(200, 255, 170, 0.75)'));
  [[26, 40, -0.6], [98, 48, 0.5], [30, 86, 0.7], [96, 88, -0.6], [56, 22, 2.3], [70, 108, -2.4]]
    .forEach(([x, y, a]) => leaf(ctx, x, y, 26, a));
  // Little buds.
  [[46, 62], [82, 70]].forEach(([x, y]) => {
    ctx.fillStyle = rad(ctx, x, y, 1, 7, [[0, '#ffd6ec'], [1, '#ff5ea8']], -2, -2);
    ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#a3245e'; ctx.stroke();
  });
}

function weed(ctx) {
  // Thorns first so the bramble ball sits on top of their bases.
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    const bx = 64 + Math.cos(a) * 40; const by = 66 + Math.sin(a) * 40;
    const tx = 64 + Math.cos(a) * 60; const ty = 66 + Math.sin(a) * 60;
    const nx = -Math.sin(a) * 8; const ny = Math.cos(a) * 8;
    ctx.beginPath();
    ctx.moveTo(bx + nx, by + ny); ctx.lineTo(tx, ty); ctx.lineTo(bx - nx, by - ny); ctx.closePath();
    ctx.fillStyle = lin(ctx, bx, by, tx, ty, [[0, '#d8cfa8'], [1, '#fffbe8']]);
    ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#5c5230'; ctx.stroke();
  }
  // Lumpy bramble ball.
  [[64, 66, 44, '#1d4a18'], [50, 56, 26, '#2f6b26'], [80, 58, 24, '#2f6b26'], [64, 82, 26, '#2f6b26']].forEach(([x, y, r, c], i) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? c : rad(ctx, x, y, 2, r, [[0, '#6cbf4a'], [1, c]], -r * 0.35, -r * 0.4);
    ctx.fill();
    if (i === 0) { ctx.lineWidth = 4; ctx.strokeStyle = '#0f2e0c'; ctx.stroke(); }
  });
  // Sly little eyes.
  [[52, 66], [76, 66]].forEach(([x, y]) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(x + 1.5, y + 1, 3.5, 0, Math.PI * 2); ctx.fill();
  });
  ctx.lineWidth = 3; ctx.strokeStyle = '#0f2e0c';
  ctx.beginPath(); ctx.moveTo(44, 56); ctx.lineTo(58, 60); ctx.moveTo(84, 56); ctx.lineTo(70, 60); ctx.stroke();
  // Purple bud.
  ctx.fillStyle = rad(ctx, 90, 34, 1, 11, [[0, '#f0d0ff'], [0.5, '#b36ce8'], [1, '#6a2bb0']], -3, -3);
  ctx.beginPath(); ctx.arc(90, 34, 10, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#3e1470'; ctx.stroke();
  // Sheen.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath(); ctx.ellipse(46, 44, 12, 6, -0.6, 0, Math.PI * 2); ctx.fill();
}

function seed(ctx) {
  // Acorn-like seed pod: glossy body, crosshatched cap, little sprout.
  ctx.beginPath();
  ctx.moveTo(30, 56);
  ctx.bezierCurveTo(28, 98, 52, 120, 64, 122);
  ctx.bezierCurveTo(76, 120, 100, 98, 98, 56);
  ctx.closePath();
  ctx.fillStyle = rad(ctx, 64, 80, 4, 52, [[0, '#f6c27d'], [0.55, '#d0873e'], [1, '#8f4f1a']], -14, -16);
  ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#5a2f0c'; ctx.stroke();
  ctx.fillStyle = 'rgba(255, 245, 220, 0.6)';
  ctx.beginPath(); ctx.ellipse(48, 78, 7, 15, 0.2, 0, Math.PI * 2); ctx.fill();
  // Cap.
  ctx.beginPath();
  ctx.ellipse(64, 52, 42, 20, 0, Math.PI, 0);
  ctx.bezierCurveTo(106, 62, 22, 62, 22, 52);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, 32, 0, 64, [[0, '#a5672f'], [1, '#5e3311']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(40, 18, 2, 0.5)';
  ctx.lineWidth = 2;
  for (let i = -60; i < 80; i += 9) {
    ctx.beginPath(); ctx.moveTo(22 + i, 30); ctx.lineTo(52 + i, 66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(52 + i, 30); ctx.lineTo(22 + i, 66); ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(64, 52, 42, 20, 0, Math.PI, 0);
  ctx.bezierCurveTo(106, 62, 22, 62, 22, 52);
  ctx.closePath();
  ctx.lineWidth = 4; ctx.strokeStyle = '#3e1f06'; ctx.stroke();
  // Sprout.
  ctx.lineWidth = 5; ctx.strokeStyle = '#2f7a1e';
  ctx.beginPath(); ctx.moveTo(64, 34); ctx.quadraticCurveTo(62, 22, 66, 12); ctx.stroke();
  leaf(ctx, 66, 18, 26, -0.5);
  leaf(ctx, 64, 22, 22, Math.PI + 0.5);
}

function pot(ctx) {
  // Terracotta body.
  ctx.beginPath();
  ctx.moveTo(24, 46); ctx.lineTo(104, 46); ctx.lineTo(92, 120); ctx.quadraticCurveTo(64, 126, 36, 120); ctx.closePath();
  ctx.fillStyle = lin(ctx, 24, 0, 104, 0, [[0, '#f29a62'], [0.35, '#e0743c'], [1, '#a84a1f']]);
  ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#6b2a0c'; ctx.stroke();
  ctx.fillStyle = 'rgba(255, 220, 190, 0.45)';
  ctx.beginPath(); ctx.moveTo(34, 52); ctx.lineTo(46, 52); ctx.lineTo(44, 110); ctx.lineTo(38, 110); ctx.closePath(); ctx.fill();
  // Painted band.
  ctx.fillStyle = 'rgba(120, 40, 10, 0.3)';
  ctx.fillRect(30, 80, 68, 6);
  // Rim.
  rr(ctx, 12, 28, 104, 26, 10);
  ctx.fillStyle = lin(ctx, 0, 28, 0, 54, [[0, '#ffb07c'], [1, '#d0622e']]);
  ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#6b2a0c'; ctx.stroke();
  rr(ctx, 20, 31, 56, 6, 3);
  ctx.fillStyle = 'rgba(255, 240, 220, 0.6)';
  ctx.fill();
  // Dry soil on top.
  ctx.beginPath(); ctx.ellipse(64, 31, 44, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = lin(ctx, 0, 22, 0, 40, [[0, '#8a5a30'], [1, '#4a2a0e']]);
  ctx.fill();
  ctx.fillStyle = '#a8703a';
  [[48, 29], [74, 32], [62, 27]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 5, 2, 0, 0, Math.PI * 2); ctx.fill(); });
}

export function ensureObstacleArt(scene) {
  make(scene, 'cell-soil1', (ctx) => soil(ctx, false));
  make(scene, 'cell-soil2', (ctx) => soil(ctx, true));
  make(scene, 'cell-grass', grass);
  make(scene, 'ob-crate1', (ctx) => crate(ctx, false));
  make(scene, 'ob-crate2', (ctx) => crate(ctx, true));
  make(scene, 'ob-vine', vine);
  make(scene, 'ob-weed', weed);
  make(scene, 'item-seed', seed);
  make(scene, 'ob-pot', pot);
}
