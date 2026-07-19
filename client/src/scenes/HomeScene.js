import Phaser from 'phaser';
import { ensureCharacter } from '../character.js';
import { navigate } from '../router.js';
import { ensureMenuMusic } from '../audio/menuMusic.js';
import { drawMenuBackground, makeMenuButton, updateMenuFlames } from '../ui/menuChrome.js';
import {
  createAmbientCreatures,
  destroyAmbientCreatures,
  updateAmbientCreatures,
} from '../ui/ambientCreatures.js';
import { ensureWizardColorTexture } from '../wizardSkin.js';
import { GalleryModal } from '../ui/GalleryModal.js';
import { ControlsModal } from '../ui/ControlsModal.js';
import { SettingsModal } from '../ui/SettingsModal.js';
import { parseGalleryUrl } from '../ui/galleryUrl.js';

export class HomeScene extends Phaser.Scene {
  constructor() {
    super('Home');
  }

  create() {
    this.character = ensureCharacter();
    drawMenuBackground(this, { subtitle: 'Arena de magos' });
    createAmbientCreatures(this);
    ensureMenuMusic(this);

    const { width, height } = this.scale;
    const panelX = width / 2;
    const panelY = height / 2;

    const tex = ensureWizardColorTexture(this, this.character.color, this.character.skin);
    this.preview = this.add
      .sprite(panelX, panelY - 180, tex)
      .setScale(3.6)
      .setDepth(5);
    const walkKey = `${tex}_walk`;
    if (this.anims.exists(walkKey)) this.preview.play(walkKey);

    this.add
      .text(panelX, panelY - 100, this.character.name, {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(5);

    makeMenuButton(this, panelX, panelY - 20, 'Personagem', 0x6b5cff, () => {
      navigate('/character');
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 40, 'Salas', 0x2ecc71, () => {
      navigate('/matchmaking');
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 100, 'Galeria', 0x443866, () => {
      this.controlsModal?.hide();
      this.settingsModal?.hide();
      this.galleryModal?.show();
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 160, 'Comandos', 0x443866, () => {
      this.galleryModal?.hide();
      this.settingsModal?.hide();
      this.controlsModal?.show();
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 220, 'Config', 0x443866, () => {
      this.galleryModal?.hide();
      this.controlsModal?.hide();
      this.settingsModal?.show();
    }).setDepth(10);

    this.galleryModal = new GalleryModal(this, {
      onOpen: () => {
        this.controlsModal?.hide();
        this.settingsModal?.hide();
      },
    });
    this.controlsModal = new ControlsModal(this, {
      onOpen: () => {
        this.galleryModal?.hide();
        this.settingsModal?.hide();
      },
    });
    this.settingsModal = new SettingsModal(this, {
      onOpen: () => {
        this.galleryModal?.hide();
        this.controlsModal?.hide();
      },
    });
    this._maybeOpenGalleryFromUrl();

    this.add
      .text(panelX, height - 36, 'Personalize seu bruxo e entre em uma sala', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#7a6e96',
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.events.once('shutdown', () => {
      this.galleryModal?.destroy();
      this.galleryModal = null;
      this.controlsModal?.destroy();
      this.controlsModal = null;
      this.settingsModal?.destroy();
      this.settingsModal = null;
      destroyAmbientCreatures(this);
    });
  }

  _maybeOpenGalleryFromUrl() {
    const link = parseGalleryUrl();
    if (!link) return;
    this.time.delayedCall(0, () => {
      this.galleryModal?.show({
        tab: link.tab,
        spellId: link.spellId,
        monsterId: link.monsterId,
      });
    });
  }

  update(_time, delta) {
    updateMenuFlames(this);
    updateAmbientCreatures(this, delta);
  }
}
