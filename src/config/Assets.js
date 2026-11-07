import carrotIcon from '../assets/icon/carrot.svg?url';
import mushroomIcon from '../assets/icon/mushroom.svg?url';

// Glossy 512x512 PNG art in public/assets/art (see docs/art/ASSETS.md).
const ART = 'assets/art';
const ART_PIECES = [
  'rose', 'leaf', 'drop', 'sun', 'berry', 'crystal', 'strawberry', 'apple',
  'lemon', 'blueberry', 'kiwi', 'orange', 'grape', 'watermelon', 'pineapple', 'banana',
];

/** Pieces that still use a code-drawn SVG because no PNG exists for them yet. */
export const JEWEL_ICONS = {
  carrot: carrotIcon,
  mushroom: mushroomIcon,
};

/** Texture key -> art file, for specials and boosters (they replace the code-drawn versions). */
const ART_TEXTURES = {
  'tile-rainbow': 'rainbow-seed',
  'sp-line-h': 'line-h',
  'sp-line-v': 'line-v',
  'sp-bomb': 'bomb',
  'bst-trowel': 'trowel',
  'bst-breeze': 'breeze',
  'bst-swap': 'bee-swap',
  'bst-burst': 'burst-start',
  'bst-moves': 'plus-moves',
};

/**
 * Load every piece icon as a texture named `jewel-<type>`, plus the special / booster art.
 * (load.image, not load.svg: Vite inlines small SVGs as data URLs, which Phaser's SVG loader can't decode.)
 */
export function preloadJewelIcons(scene) {
  ART_PIECES.forEach((type) => {
    if (!scene.textures.exists(`jewel-${type}`)) scene.load.image(`jewel-${type}`, `${ART}/${type}.png`);
  });
  Object.entries(JEWEL_ICONS).forEach(([type, url]) => {
    if (!scene.textures.exists(`jewel-${type}`)) scene.load.image(`jewel-${type}`, url);
  });
  Object.entries(ART_TEXTURES).forEach(([key, file]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, `${ART}/${file}.png`);
  });
}

// Kenney assets (CC0, www.kenney.nl) copied into public/assets/kenney.
const K = 'assets/kenney';

export const KENNEY_IMAGES = {
  'bg-grass': `${K}/bg/grass.png`,
  'bg-cloud1': `${K}/bg/cloud1.png`,
  'bg-cloud2': `${K}/bg/cloud2.png`,
  'bg-cloud3': `${K}/bg/cloud3.png`,
  'btn-green': `${K}/ui/btn_green.png`,
  'btn-yellow': `${K}/ui/btn_yellow.png`,
  'btn-blue': `${K}/ui/btn_blue.png`,
  'btn-red': `${K}/ui/btn_red.png`,
  'round-green': `${K}/ui/round_green.png`,
  'round-yellow': `${K}/ui/round_yellow.png`,
  'round-grey': `${K}/ui/round_grey.png`,
  'round-red': `${K}/ui/round_red.png`,
  'map-tree': `${K}/map/tree.png`,
  'map-treeLong': `${K}/map/treeLong.png`,
  'map-treePine': `${K}/map/treePine.png`,
  'map-treeSmall1': `${K}/map/treeSmall_green1.png`,
  'map-treeSmall2': `${K}/map/treeSmall_green2.png`,
  'map-treeSmall3': `${K}/map/treeSmall_green3.png`,
  'map-bush1': `${K}/map/bush1.png`,
  'map-bush2': `${K}/map/bush2.png`,
  'map-bush3': `${K}/map/bush3.png`,
  'map-bush4': `${K}/map/bush4.png`,
  'map-fence': `${K}/map/fence.png`,
  'ui-star': `${K}/ui/star.png`,
  'ui-star-grey': `${K}/ui/star_grey.png`,
  'icon-repeat': `${K}/ui/icon_repeat.png`,
  'icon-play': `${K}/ui/icon_play.png`,
  'fx-star4': `${K}/fx/star_04.png`,
  'fx-star6': `${K}/fx/star_06.png`,
  'fx-glow': `${K}/fx/circle_05.png`,
  'fx-ring': `${K}/fx/light_01.png`,
  'fx-magic': `${K}/fx/magic_03.png`,
  'fx-twirl': `${K}/fx/twirl_02.png`,
};

// Sound effects and music are synthesized at runtime (see core/Synth.js), so no audio files are loaded.
export function preloadKenney(scene) {
  Object.entries(KENNEY_IMAGES).forEach(([name, url]) => scene.load.image(name, url));
}
