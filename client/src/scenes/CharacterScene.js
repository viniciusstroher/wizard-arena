import Phaser from 'phaser';
import { ensureCharacter, saveCharacter, WIZARD_COLORS } from '../character.js';
import { navigate } from '../router.js';
import { ensureMenuMusic } from '../audio/menuMusic.js';
import {
  drawMenuBackground,
  makeMenuButton,
  styleDomInput,
  updateMenuFlames,
} from '../ui/menuChrome.js';
import {
  updateWizardPreviewTexture,
  WIZARD_SKINS,
} from '../wizardSkin.js';

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super('Character');
  }

  create() {
    this.character = ensureCharacter();
    this.selectedColor = this.character.color >>> 0;
    this.selectedSkin = this.character.skin || 'classic';
    this.errorText = null;

    drawMenuBackground(this, { subtitle: 'Personagem' });
    ensureMenuMusic(this);

    const { width, height } = this.scale;
    const panelX = width / 2;
    const uiDepth = 10;

    const previewKey = updateWizardPreviewTexture(this, this.selectedColor, this.selectedSkin);
    this.preview = this.add
      .sprite(panelX, height / 2 - 210, previewKey)
      .setScale(3.6)
      .setDepth(uiDepth);

    this.tweens.add({
      targets: this.preview,
      y: this.preview.y - 8,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(panelX, height / 2 - 145, 'Skin do bruxo', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.buildSkinPicker(panelX, height / 2 - 100, uiDepth);

    this.add
      .text(panelX, height / 2 - 40, 'Nome', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.maxLength = 16;
    inputEl.value = this.character.name;
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;
    inputEl.placeholder = 'Digite seu nome';
    styleDomInput(inputEl);
    this.nameInput = this.add.dom(panelX, height / 2, inputEl).setOrigin(0.5).setDepth(uiDepth);

    this.add
      .text(panelX, height / 2 + 45, 'Cor do bruxo', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.buildPalette(panelX, height / 2 + 105, uiDepth);

    this.errorText = this.add
      .text(panelX, height / 2 + 185, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#ff6b6b',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    makeMenuButton(this, panelX - 90, height / 2 + 240, 'Voltar', 0x443866, () => {
      navigate('/');
    }, 160).setDepth(uiDepth);

    makeMenuButton(this, panelX + 90, height / 2 + 240, 'Salvar', 0x2ecc71, () => {
      this.save();
    }, 160).setDepth(uiDepth);

    this.events.once('shutdown', () => {
      this.nameInput?.destroy();
      this.nameInput = null;
    });
  }

  buildSkinPicker(centerX, y, depth) {
    const gap = 88;
    const totalW = (WIZARD_SKINS.length - 1) * gap;
    const startX = centerX - totalW / 2;

    this.skinButtons = [];
    WIZARD_SKINS.forEach((skin, i) => {
      const x = startX + i * gap;
      const selected = skin.id === this.selectedSkin;
      const key = updateWizardPreviewTexture(
        this,
        this.selectedColor,
        skin.id,
        `wizard_skin_pick_${skin.id}`
      );

      const frame = this.add
        .rectangle(x, y, 64, 64, 0x1a1430, 0.85)
        .setStrokeStyle(2, 0xffffff, selected ? 0.95 : 0.2)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });

      const sprite = this.add
        .sprite(x, y - 4, key)
        .setScale(2)
        .setDepth(depth + 1);

      const label = this.add
        .text(x, y + 40, skin.name, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: selected ? '#f4e8ff' : '#9a8bb8',
        })
        .setOrigin(0.5)
        .setDepth(depth);

      const pick = () => this.selectSkin(skin.id);
      frame.on('pointerup', pick);
      sprite.setInteractive({ useHandCursor: true }).on('pointerup', pick);

      this.skinButtons.push({ skinId: skin.id, frame, sprite, label });
    });
  }

  buildPalette(centerX, y, depth) {
    const size = 26;
    const gap = 8;
    const cols = 10;
    const rows = Math.ceil(WIZARD_COLORS.length / cols);
    const totalW = cols * size + (cols - 1) * gap;
    const totalH = rows * size + (rows - 1) * gap;
    const startX = centerX - totalW / 2 + size / 2;
    const startY = y - totalH / 2 + size / 2;

    this.swatches = [];
    WIZARD_COLORS.forEach((color, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (size + gap);
      const cy = startY + row * (size + gap);
      const swatch = this.add
        .rectangle(x, cy, size, size, color, 1)
        .setStrokeStyle(2, 0xffffff, this.selectedColor === color ? 0.95 : 0.2)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });
      swatch.on('pointerup', () => this.selectColor(color));
      this.swatches.push({ color, swatch });
    });
  }

  refreshPreviews() {
    updateWizardPreviewTexture(this, this.selectedColor, this.selectedSkin);
    this.preview.setTexture('wizard_preview');

    for (const btn of this.skinButtons) {
      const key = updateWizardPreviewTexture(
        this,
        this.selectedColor,
        btn.skinId,
        `wizard_skin_pick_${btn.skinId}`
      );
      btn.sprite.setTexture(key);
    }
  }

  selectSkin(skinId) {
    this.selectedSkin = skinId;
    this.refreshPreviews();
    for (const btn of this.skinButtons) {
      const selected = btn.skinId === this.selectedSkin;
      btn.frame.setStrokeStyle(2, 0xffffff, selected ? 0.95 : 0.2);
      btn.label.setColor(selected ? '#f4e8ff' : '#9a8bb8');
    }
  }

  selectColor(color) {
    this.selectedColor = color >>> 0;
    this.refreshPreviews();
    for (const { color: c, swatch } of this.swatches) {
      swatch.setStrokeStyle(2, 0xffffff, c === this.selectedColor ? 0.95 : 0.2);
    }
  }

  save() {
    const name = String(this.nameInput?.node?.value || '').trim();
    const result = saveCharacter({
      name,
      color: this.selectedColor,
      skin: this.selectedSkin,
    });
    if (!result.ok) {
      this.errorText.setText(result.error);
      this.nameInput?.node?.focus();
      return;
    }
    this.errorText.setText('');
    navigate('/');
  }

  update() {
    updateMenuFlames(this);
  }
}
