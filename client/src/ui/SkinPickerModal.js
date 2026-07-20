import { updateWizardPreviewTexture, WIZARD_SKINS } from '../wizardSkin.js';

/**
 * Modal com as 25 skins de classes de mago.
 * Abre a partir do preview/skin na tela de personagem.
 */
export class SkinPickerModal {
  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   getColor: () => number,
   *   getSelectedSkin: () => string,
   *   onSelect: (skinId: string) => void,
   *   onOpen?: () => void,
   *   onClose?: () => void,
   * }} options
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.getColor = options.getColor || (() => 0xff5555);
    this.getSelectedSkin = options.getSelectedSkin || (() => 'magician');
    this.onSelect = options.onSelect || null;
    this.onOpen = options.onOpen || null;
    this.onClose = options.onClose || null;

    this.open = false;
    this.container = scene.add.container(0, 0).setDepth(400).setVisible(false);
    this.cells = [];
  }

  isOpen() {
    return this.open;
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.onOpen?.();

    const { width, height } = this.scene.scale;
    this.container.removeAll(true);
    this.cells = [];
    this.container.setDepth(10000).setVisible(true);
    this.scene.children.bringToTop(this.container);

    const dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.hide());

    const cols = 5;
    const rows = Math.ceil(WIZARD_SKINS.length / cols);
    const cellW = 100;
    const cellH = 96;
    const gapX = 8;
    const gapY = 8;
    const gridW = cols * cellW + (cols - 1) * gapX;
    const gridH = rows * cellH + (rows - 1) * gapY;
    const panelW = Math.min(width - 40, gridW + 48);
    const panelH = Math.min(height - 40, gridH + 100);

    const panel = this.scene.add
      .rectangle(width / 2, height / 2, panelW, panelH, 0x161228, 0.98)
      .setStrokeStyle(2, 0x6b5cff)
      .setInteractive();

    const title = this.scene.add
      .text(width / 2, height / 2 - panelH / 2 + 28, 'Escolher classe', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    const subtitle = this.scene.add
      .text(width / 2, height / 2 - panelH / 2 + 52, 'D&D · WoW · Tibia · Ragnarok', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5);

    const closeBtn = this.scene.add
      .text(width / 2 + panelW / 2 - 22, height / 2 - panelH / 2 + 18, '✕', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '20px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerup', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#c4b5e0'));

    const items = [dim, panel, title, subtitle, closeBtn];

    const selected = this.getSelectedSkin();
    const color = this.getColor() >>> 0;
    const gridLeft = width / 2 - gridW / 2 + cellW / 2;
    const gridTop = height / 2 - panelH / 2 + 84 + cellH / 2;

    WIZARD_SKINS.forEach((skin, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gridLeft + col * (cellW + gapX);
      const y = gridTop + row * (cellH + gapY);
      const isSelected = skin.id === selected;

      const key = updateWizardPreviewTexture(
        this.scene,
        color,
        skin.id,
        `wizard_skin_modal_${skin.id}`
      );

      const frame = this.scene.add
        .rectangle(x, y, cellW, cellH, 0x1a1430, 0.92)
        .setStrokeStyle(2, isSelected ? 0x6dffb0 : 0xffffff, isSelected ? 0.95 : 0.18)
        .setInteractive({ useHandCursor: true });

      const sprite = this.scene.add.sprite(x, y - 14, key).setScale(1.65);

      const name = this.scene.add
        .text(x, y + 28, skin.name, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: isSelected ? '#f4e8ff' : '#c4b5e0',
          align: 'center',
          wordWrap: { width: cellW - 8 },
        })
        .setOrigin(0.5);

      const source = this.scene.add
        .text(x, y + 44, skin.source || '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '9px',
          color: '#6b6088',
        })
        .setOrigin(0.5);

      const pick = () => {
        this.onSelect?.(skin.id);
        this.hide();
      };
      frame.on('pointerup', pick);
      sprite.setInteractive({ useHandCursor: true }).on('pointerup', pick);
      frame.on('pointerover', () => {
        if (skin.id !== this.getSelectedSkin()) frame.setStrokeStyle(2, 0x6b5cff, 0.7);
      });
      frame.on('pointerout', () => {
        const sel = skin.id === this.getSelectedSkin();
        frame.setStrokeStyle(2, sel ? 0x6dffb0 : 0xffffff, sel ? 0.95 : 0.18);
      });

      items.push(frame, sprite, name, source);
      this.cells.push({ skinId: skin.id, frame, sprite, name, source });
    });

    this.container.add(items);
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.container.removeAll(true);
    this.cells = [];
    this.container.setVisible(false);
    this.onClose?.();
  }

  destroy() {
    this.hide();
    this.container.destroy(true);
  }
}
