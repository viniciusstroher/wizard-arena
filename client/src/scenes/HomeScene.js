import Phaser from 'phaser';
import { ensureCharacter } from '../character.js';
import { navigate } from '../router.js';
import { ensureMenuMusic } from '../audio/menuMusic.js';
import { drawMenuBackground, makeMenuButton, updateMenuFlames } from '../ui/menuChrome.js';
import { ensureWizardColorTexture } from '../wizardSkin.js';

export class HomeScene extends Phaser.Scene {
  constructor() {
    super('Home');
  }

  create() {
    this.character = ensureCharacter();
    drawMenuBackground(this, { subtitle: 'Arena de magos' });
    ensureMenuMusic(this);

    const { width, height } = this.scale;
    const panelX = width / 2;
    const panelY = height / 2 + 20;

    const tex = ensureWizardColorTexture(this, this.character.color);
    this.preview = this.add
      .sprite(panelX, panelY - 120, tex)
      .setScale(3.2)
      .setDepth(5);
    const walkKey = `${tex}_walk`;
    if (this.anims.exists(walkKey)) this.preview.play(walkKey);

    this.add
      .text(panelX, panelY - 40, this.character.name, {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(5);

    makeMenuButton(this, panelX, panelY + 40, 'Personagem', 0x6b5cff, () => {
      navigate('/character');
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 100, 'Salas', 0x2ecc71, () => {
      navigate('/matchmaking');
    }).setDepth(10);

    this.add
      .text(panelX, height - 36, 'Personalize seu bruxo e entre em uma sala', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#7a6e96',
      })
      .setOrigin(0.5)
      .setDepth(5);
  }

  update() {
    updateMenuFlames(this);
  }
}
