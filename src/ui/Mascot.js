import { canvasTexture } from './Skin.js';

/** Bea the garden bee: Bloomora's mascot, drawn once into a canvas texture. */
export function mascotTexture(scene) {
  return canvasTexture(scene, 'mascot-bea', 256, 256, (ctx) => {
    const ellipse = (x, y, rx, ry, fill, stroke, lw = 0, rot = 0) => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
    };
    const outline = '#5a3414';

    // Wings.
    ellipse(70, 92, 44, 30, 'rgba(200,236,255,0.92)', '#7fb8d8', 6, -0.6);
    ellipse(186, 92, 44, 30, 'rgba(200,236,255,0.92)', '#7fb8d8', 6, 0.6);
    ellipse(62, 86, 18, 9, 'rgba(255,255,255,0.8)', null, 0, -0.6);
    ellipse(178, 84, 18, 9, 'rgba(255,255,255,0.8)', null, 0, 0.6);

    // Antennae with little pink blossoms.
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.strokeStyle = outline;
    ctx.beginPath(); ctx.moveTo(104, 80); ctx.quadraticCurveTo(92, 48, 76, 34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(152, 80); ctx.quadraticCurveTo(164, 48, 180, 34); ctx.stroke();
    [[76, 30], [180, 30]].forEach(([x, y]) => {
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 8, 8, '#ff7eb6');
      }
      ellipse(x, y, 6, 6, '#ffd84a');
    });

    // Round body with stripes (clipped to the body).
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(128, 150, 84, 78, 0, 0, Math.PI * 2);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, 72, 0, 228);
    grad.addColorStop(0, '#ffe36e');
    grad.addColorStop(1, '#ffb81f');
    ctx.fillStyle = grad;
    ctx.fillRect(40, 70, 180, 170);
    ctx.fillStyle = '#5a3414';
    ctx.fillRect(40, 186, 180, 16);
    ctx.fillRect(40, 214, 180, 16);
    ctx.restore();
    ellipse(128, 150, 84, 78, null, outline, 8);
    ellipse(96, 104, 26, 13, 'rgba(255,255,255,0.55)', null, 0, -0.4);

    // Face.
    [[100, 140], [156, 140]].forEach(([x, y]) => {
      ellipse(x, y, 19, 22, '#ffffff', outline, 5);
      ellipse(x + 3, y + 4, 11, 13, '#2b1a0c');
      ellipse(x + 7, y - 2, 5, 5, '#ffffff');
    });
    ellipse(78, 170, 13, 8, 'rgba(255,120,150,0.7)');
    ellipse(178, 170, 13, 8, 'rgba(255,120,150,0.7)');
    ctx.lineWidth = 6;
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.arc(128, 162, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  });
}

/** Bea, bobbing gently. `size` is her displayed width. */
export function addMascot(scene, x, y, size = 110) {
  const bea = scene.add.image(x, y, mascotTexture(scene)).setDisplaySize(size, size);
  scene.tweens.add({ targets: bea, y: y - size * 0.08, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return bea;
}
