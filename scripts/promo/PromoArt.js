import { makeGameLogo } from '../../src/ui/UI.js';
import { raysTexture } from '../../src/ui/Skin.js';
import { mascotTexture } from '../../src/ui/Mascot.js';
import { GAME_TITLE } from '../../src/config/Constants.js';

/**
 * Store and portal art (covers, feature graphic) drawn from the game's own textures.
 * Dev tool only: scripts/promo/make-promo.mjs loads it in the running dev build.
 * Only the title is text; the top-left corner stays clear (CrazyGames puts badges there).
 */
const FRUITS = ['strawberry', 'lemon', 'blueberry', 'rose', 'kiwi', 'orange', 'grape', 'sun', 'apple', 'drop'];

export function renderPromo(scene, W, H) {
  return new Promise((resolve) => {
    const root = scene.add.container(0, 0);
    root.removeFromDisplayList();
    const short = Math.min(W, H);
    const portrait = H > W * 1.1;
    const square = !portrait && W < H * 1.3;

    const bgTex = scene.textures.get('bg-grass').getSourceImage();
    root.add(scene.add.image(W / 2, H / 2, 'bg-grass').setScale(Math.max(W / bgTex.width, H / bgTex.height)));

    const logoY = portrait ? H * 0.3 : H * 0.36;
    const rays = Math.max(W, H) * 1.3;
    root.add(scene.add.image(W / 2, logoY, raysTexture(scene, 512)).setDisplaySize(rays, rays).setAlpha(0.6));

    // A curved row of fruit tiles under the title, like a board peeking up.
    const tile = short * (portrait ? 0.16 : 0.15);
    const count = portrait ? 5 : square ? 4 : Math.min(7, Math.floor(W / (tile * 1.15)));
    const rowY = portrait ? H * 0.58 : square ? H * 0.66 : H * 0.72;
    const rowX = square ? W * 0.42 : W / 2;
    for (let i = 0; i < count; i += 1) {
      const t = i - (count - 1) / 2;
      const x = rowX + t * tile * 1.12;
      const y = rowY + t * t * tile * 0.09;
      const g = scene.add.graphics({ x, y });
      g.fillStyle(0x6b3d17, 0.3).fillRoundedRect(-tile / 2 + 4, -tile / 2 + 8, tile, tile, tile * 0.22);
      g.fillStyle(0xfff4dc, 1).fillRoundedRect(-tile / 2, -tile / 2, tile, tile, tile * 0.22);
      g.setAngle(t * 4);
      root.add(g);
      root.add(scene.add.image(x, y, `jewel-${FRUITS[i % FRUITS.length]}`).setDisplaySize(tile * 0.78, tile * 0.78).setAngle(t * 4));
    }
    if (portrait) {
      // Second row for the tall cover.
      for (let i = 0; i < 4; i += 1) {
        const t = i - 1.5;
        const x = W / 2 + t * tile * 1.12;
        const y = rowY + tile * 1.18;
        const g = scene.add.graphics();
        g.fillStyle(0x6b3d17, 0.3).fillRoundedRect(x - tile / 2 + 4, y - tile / 2 + 8, tile, tile, tile * 0.22);
        g.fillStyle(0xfff4dc, 1).fillRoundedRect(x - tile / 2, y - tile / 2, tile, tile, tile * 0.22);
        root.add(g);
        root.add(scene.add.image(x, y, `jewel-${FRUITS[(i + 5) % FRUITS.length]}`).setDisplaySize(tile * 0.78, tile * 0.78));
      }
    }

    const logoSize = Math.min(W * (portrait || square ? 0.15 : 0.11), H * 0.2);
    const { logo } = makeGameLogo(scene, W / 2, logoY, GAME_TITLE, logoSize);
    root.add(logo);

    const bea = short * (portrait ? 0.3 : square ? 0.26 : 0.3);
    root.add(scene.add.image(W - bea * 0.56, H - bea * 0.56, mascotTexture(scene)).setDisplaySize(bea, bea).setAngle(-8));

    const rt = scene.add.renderTexture(0, 0, W, H).setOrigin(0).setVisible(false);
    rt.draw(root);
    rt.snapshot((image) => {
      resolve(image?.src ?? null);
      root.destroy(true);
      rt.destroy();
    });
  });
}
