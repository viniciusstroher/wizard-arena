import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { HomeScene } from './scenes/HomeScene.js';
import { CharacterScene } from './scenes/CharacterScene.js';
import { MatchmakingScene } from './scenes/MatchmakingScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';
import { applyResolution, loadResolutionId } from './settings/resolution.js';
import { bindRouter } from './router.js';
import { ensureCharacter } from './character.js';

ensureCharacter();
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
  scene: [BootScene, HomeScene, CharacterScene, MatchmakingScene, LobbyScene, GameScene],
};

const game = new Phaser.Game(config);
bindRouter(game);

window.addEventListener('resize', () => {
  applyResolution(loadResolutionId(), game);
});
