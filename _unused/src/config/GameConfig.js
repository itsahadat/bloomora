import Phaser from 'phaser';

export const gameConfig = {
  type: Phaser.AUTO,
  width: 430,
  height: 760,
  parent: 'game-root',
  backgroundColor: '#fffaf0',
  transparent: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};
