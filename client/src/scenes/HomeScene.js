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
import { openLeaderboardModal } from '../ui/leaderboardModal.js';
import { openFeaturesModal } from '../ui/featuresModal.js';
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
    const panelY = height / 2 - 10;
    this.leaderboardModal = null;
    this.featuresModal = null;

    const tex = ensureWizardColorTexture(this, this.character.color, this.character.skin);
    this.preview = this.add
      .sprite(panelX, panelY - 200, tex)
      .setScale(3.4)
      .setDepth(5);
    const walkKey = `${tex}_walk`;
    if (this.anims.exists(walkKey)) this.preview.play(walkKey);

    this.add
      .text(panelX, panelY - 125, this.character.name, {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(5);

    const closeOverlays = () => {
      this.galleryModal?.hide();
      this.controlsModal?.hide();
      this.settingsModal?.hide();
      this.leaderboardModal?.close();
      this.leaderboardModal = null;
      this.featuresModal?.close();
      this.featuresModal = null;
    };

    makeMenuButton(this, panelX, panelY - 50, 'Jogar !', 0x2ecc71, () => {
      navigate('/matchmaking');
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 5, 'Personagem', 0x6b5cff, () => {
      navigate('/character');
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 60, 'Leaderboard', 0xc9a227, () => {
      closeOverlays();
      this.leaderboardModal = openLeaderboardModal();
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 115, 'Features', 0x2a8f9e, () => {
      closeOverlays();
      this.featuresModal = openFeaturesModal();
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 170, 'Galeria', 0x443866, () => {
      closeOverlays();
      this.galleryModal?.show();
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 225, 'Comandos', 0x443866, () => {
      closeOverlays();
      this.controlsModal?.show();
    }).setDepth(10);

    makeMenuButton(this, panelX, panelY + 280, 'Config', 0x443866, () => {
      closeOverlays();
      this.settingsModal?.show();
    }).setDepth(10);

    this.galleryModal = new GalleryModal(this, {
      onOpen: () => {
        this.controlsModal?.hide();
        this.settingsModal?.hide();
        this.leaderboardModal?.close();
        this.leaderboardModal = null;
        this.featuresModal?.close();
        this.featuresModal = null;
      },
    });
    this.controlsModal = new ControlsModal(this, {
      onOpen: () => {
        this.galleryModal?.hide();
        this.settingsModal?.hide();
        this.leaderboardModal?.close();
        this.leaderboardModal = null;
        this.featuresModal?.close();
        this.featuresModal = null;
      },
    });
    this.settingsModal = new SettingsModal(this, {
      onOpen: () => {
        this.galleryModal?.hide();
        this.controlsModal?.hide();
        this.leaderboardModal?.close();
        this.leaderboardModal = null;
        this.featuresModal?.close();
        this.featuresModal = null;
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
      this.leaderboardModal?.close();
      this.leaderboardModal = null;
      this.featuresModal?.close();
      this.featuresModal = null;
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
        floorId: link.floorId,
      });
    });
  }

  update(_time, delta) {
    updateMenuFlames(this);
    updateAmbientCreatures(this, delta);
  }
}
