import Phaser from 'phaser';
import { Board } from '../board/Board.js';
import { LEVELS } from '../levels/LevelData.js';

export class GameSceneMinimal extends Phaser.Scene {
  constructor() {
    super('GameSceneMinimal');
    this.board = null;
    this.levelIndex = 0;
    this.currentLevel = LEVELS[0];
  }

  create() {
    this.cameras.main.setBackgroundColor('#f4f5d9');
    
    this.board = new Board(this);
    this.board.createBoard();
    
    this.add.text(this.scale.width * 0.5, 52, `Level ${this.currentLevel.id}: ${this.currentLevel.name}`, {
      fontSize: '24px',
      color: '#36614b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }
}

