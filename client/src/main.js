import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';
import { applyResolution, loadResolutionId } from './settings/resolution.js';

applyResolution(loadResolutionId());

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#0b1020',
  dom: {
    createContainer: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, LobbyScene, GameScene],
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  applyResolution(loadResolutionId(), game);
});
