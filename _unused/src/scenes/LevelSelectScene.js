import Phaser from 'phaser';
import { LEVELS } from '../levels/LevelData.js';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#f7fbe9');

    const frame = this.add.graphics();
    frame.fillStyle(0xeef8d9, 1);
    frame.fillRoundedRect(width * 0.08, width * 0.08, width * 0.84, height * 0.84, 28);

    this.add.text(width * 0.5, 60, 'Select a Level', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#265f46',
    }).setOrigin(0.5);

    const cardContainer = this.add.container(width * 0.5, 180);

    const cardsPerRow = 2;
    const cardWidth = 140;
    const cardHeight = 160;
    const spacing = 40;

    LEVELS.forEach((level, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      const x = (col - (cardsPerRow - 1) / 2) * (cardWidth + spacing);
      const y = row * (cardHeight + spacing);

      const card = this.add.container(x, y);

      const cardBg = this.add.graphics();
      cardBg.fillStyle(0xf7f4e7, 1);
      cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
      cardBg.lineStyle(2, 0xdce9b7, 1);
      cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

      const levelNum = this.add.text(0, -50, `Level ${level.id}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '18px',
        color: '#2d6c52',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const levelName = this.add.text(0, -20, level.name, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '16px',
        color: '#5a7d69',
      }).setOrigin(0.5);

      const levelMoves = this.add.text(0, 15, `Moves: ${level.moves}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#516d5b',
      }).setOrigin(0.5);

      card.add([cardBg, levelNum, levelName, levelMoves]);
      card.setSize(cardWidth, cardHeight);
      card.setInteractive({ useHandCursor: true });

      card.on('pointerdown', () => {
        this.scene.stop('LevelSelectScene');
        this.scene.start('GameScene', { levelIndex: index });
      });

      cardContainer.add(card);
    });

    const backButton = this.add.container(width * 0.5, height - 80);
    const backBg = this.add.graphics();
    backBg.fillStyle(0x88d39a, 1);
    backBg.fillRoundedRect(-52, -18, 104, 36, 16);
    const backLabel = this.add.text(0, 0, 'Back', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    backButton.add([backBg, backLabel]);
    backButton.setSize(104, 36);
    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.stop('LevelSelectScene');
      this.scene.start('MenuScene');
    });
  }
}
