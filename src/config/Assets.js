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

// Map and background art (public/assets/map). The keys keep their old names, so the
// scenes didn't change; ART_SCALE turns each big source image into the on-screen size
// the layout was tuned for (a tree drawn at scale 1 is about 200px tall).
const M = 'assets/map';

export const MAP_IMAGES = {
  'bg-grass': `${M}/garden-bg.png`,
  'bg-cloud1': `${M}/cloud.png`,
  'bg-cloud2': `${M}/cloud.png`,
  'bg-cloud3': `${M}/cloud.png`,
  'map-tree': `${M}/tree-round.png`,
  'map-treeLong': `${M}/tree-tall.png`,
  'map-treePine': `${M}/tree-pine.png`,
  'map-treeSmall2': `${M}/tree-small.png`,
  'map-bush1': `${M}/bush-wide.png`,
  'map-bush2': `${M}/bush-round.png`,
  'map-bush3': `${M}/bush-berry.png`,
  'map-bush4': `${M}/grass-tuft.png`,
  'map-fence': `${M}/fence.png`,
  'map-flowers': `${M}/flower-patch.png`,
};

/** Multiply a prop's layout scale by this to get the right size on screen. */
export const ART_SCALE = {
  'bg-cloud1': 0.47,
  'bg-cloud2': 0.42,
  'bg-cloud3': 0.5,
  'map-tree': 0.224,
  'map-treeLong': 0.263,
  'map-treePine': 0.277,
  'map-treeSmall2': 0.157,
  'map-bush1': 0.247,
  'map-bush2': 0.219,
  'map-bush3': 0.259,
  'map-bush4': 0.205,
  'map-fence': 0.226,
  'map-flowers': 0.236,
};

export const artScale = (key) => ART_SCALE[key] ?? 1;

// Sound effects are files in public/assets/sfx or synthesized (see core/Sound.js).
export function preloadMapArt(scene) {
  Object.entries(MAP_IMAGES).forEach(([name, url]) => scene.load.image(name, url));
}

