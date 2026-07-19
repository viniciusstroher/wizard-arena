/**
 * Modal com a lista de comandos do jogo.
 */
export class ControlsModal {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ onOpen?: () => void, onClose?: () => void }} [options]
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.onOpen = options.onOpen || null;
    this.onClose = options.onClose || null;
    this.open = false;
    this.container = scene.add.container(0, 0).setDepth(400).setVisible(false);
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
    this.container.setDepth(10000).setVisible(true);
    this.scene.children.bringToTop(this.container);

    const dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.hide());

    const panel = this.scene.add
      .rectangle(width / 2, height / 2, 420, 460, 0x161228, 0.98)
      .setStrokeStyle(2, 0x6b5cff)
      .setInteractive();

    const title = this.scene.add
      .text(width / 2, height / 2 - 175, 'Comandos', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    const lines = [
      ['WASD', 'Mover'],
      ['Shift + WASD', 'Dash'],
      ['Mouse', 'Mirar'],
      ['1 – 4', 'Selecionar (projéteis: autocast)'],
      ['Tab', 'Ciclar magia 1→2→3→4'],
      ['Espaço', 'Magia de área / ultimate'],
      ['E / H / B', 'Escudo / Heal / Blink'],
    ];

    const rows = [];
    const startY = height / 2 - 130;
    lines.forEach(([key, action], i) => {
      const y = startY + i * 34;
      rows.push(
        this.scene.add
          .text(width / 2 - 150, y, key, {
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '16px',
            color: '#b8a6ff',
          })
          .setOrigin(0, 0.5),
        this.scene.add
          .text(width / 2 + 20, y, action, {
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '16px',
            color: '#e8dfff',
          })
          .setOrigin(0, 0.5)
      );
    });

    const closeBg = this.scene.add
      .rectangle(width / 2, height / 2 + 170, 140, 40, 0x6b5cff, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const closeLabel = this.scene.add
      .text(width / 2, height / 2 + 170, 'Fechar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerover', () => closeBg.setScale(1.04));
    closeBg.on('pointerout', () => closeBg.setScale(1));
    closeBg.on('pointerup', () => this.hide());

    this.container.add([dim, panel, title, ...rows, closeBg, closeLabel]);
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.container.removeAll(true);
    this.container.setVisible(false);
    this.onClose?.();
  }

  destroy() {
    this.hide();
    this.container.destroy(true);
    this.container = null;
  }
}
