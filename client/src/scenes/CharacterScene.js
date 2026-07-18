import Phaser from 'phaser';
import { ensureCharacter, saveCharacter, WIZARD_COLORS } from '../character.js';
import { navigate } from '../router.js';
import { drawMenuBackground, makeMenuButton, styleDomInput } from '../ui/menuChrome.js';
import { updateWizardPreviewTexture } from '../wizardSkin.js';

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super('Character');
  }

  create() {
    this.character = ensureCharacter();
    this.selectedColor = this.character.color >>> 0;
    this.errorText = null;

    drawMenuBackground(this, { subtitle: 'Personagem' });

    const { width, height } = this.scale;
    const panelX = width / 2;
    const uiDepth = 10;

    const previewKey = updateWizardPreviewTexture(this, this.selectedColor);
    this.preview = this.add
      .sprite(panelX, height / 2 - 150, previewKey)
      .setScale(4)
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
      .text(panelX, height / 2 - 70, 'Nome', {
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
    this.nameInput = this.add.dom(panelX, height / 2 - 30, inputEl).setOrigin(0.5).setDepth(uiDepth);

    this.add
      .text(panelX, height / 2 + 20, 'Cor do bruxo', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.buildPalette(panelX, height / 2 + 70, uiDepth);

    this.errorText = this.add
      .text(panelX, height / 2 + 130, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#ff6b6b',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    makeMenuButton(this, panelX - 90, height / 2 + 190, 'Voltar', 0x443866, () => {
      navigate('/');
    }, 160).setDepth(uiDepth);

    makeMenuButton(this, panelX + 90, height / 2 + 190, 'Salvar', 0x2ecc71, () => {
      this.save();
    }, 160).setDepth(uiDepth);

    this.events.once('shutdown', () => {
      this.nameInput?.destroy();
      this.nameInput = null;
    });
  }

  buildPalette(centerX, y, depth) {
    const size = 28;
    const gap = 10;
    const cols = 8;
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

  selectColor(color) {
    this.selectedColor = color >>> 0;
    updateWizardPreviewTexture(this, this.selectedColor);
    this.preview.setTexture('wizard_preview');
    for (const { color: c, swatch } of this.swatches) {
      swatch.setStrokeStyle(2, 0xffffff, c === this.selectedColor ? 0.95 : 0.2);
    }
  }

  save() {
    const name = String(this.nameInput?.node?.value || '').trim();
    const result = saveCharacter({ name, color: this.selectedColor });
    if (!result.ok) {
      this.errorText.setText(result.error);
      this.nameInput?.node?.focus();
      return;
    }
    this.errorText.setText('');
    navigate('/');
  }
}
