import Phaser from 'phaser';

/** Fundo comum das telas de menu (gradiente + anel + título). */
export function drawMenuBackground(scene, { title = 'WIZARD ARENA', subtitle = null } = {}) {
  const { width, height } = scene.scale;
  const bg = scene.add.graphics();
  bg.fillGradientStyle(0x0b1020, 0x0b1020, 0x1a1040, 0x102030, 1);
  bg.fillRect(0, 0, width, height);

  const ring = scene.add.graphics();
  ring.lineStyle(2, 0x6b5cff, 0.25);
  ring.strokeCircle(width / 2, height / 2 + 40, 220);
  ring.lineStyle(1, 0xff6b4a, 0.15);
  ring.strokeCircle(width / 2, height / 2 + 40, 160);

  const titleText = scene.add
    .text(width / 2, subtitle ? 64 : 72, title, {
      fontFamily: 'Georgia, serif',
      fontSize: '52px',
      color: '#f4e8ff',
      stroke: '#3a2060',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(2);

  if (scene.textures.exists('mana_potion')) {
    const manaPotion = scene.add
      .image(titleText.x + titleText.width / 2 + 10, titleText.y + 4, 'mana_potion')
      .setOrigin(0, 0.5)
      .setScale(1.1)
      .setDepth(2);
    scene.tweens.add({
      targets: manaPotion,
      y: manaPotion.y - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  if (subtitle) {
    scene.add
      .text(width / 2, 110, subtitle, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '18px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5)
      .setDepth(2);
  }
}

export function makeMenuButton(scene, x, y, label, color, onClick, width = 280) {
  const height = 48;
  const container = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, width, height, color, 1).setStrokeStyle(2, 0xffffff, 0.15);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
    })
    .setOrigin(0.5);
  container.add([bg, text]);

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => {
    if (container.enabled !== false) bg.setScale(1.04);
  });
  bg.on('pointerout', () => bg.setScale(1));
  bg.on('pointerup', () => {
    if (container.enabled !== false) onClick();
  });

  container.bg = bg;
  container.label = text;
  container.enabled = true;
  return container;
}

export function setMenuButtonEnabled(btn, enabled) {
  btn.enabled = enabled;
  btn.setAlpha(enabled ? 1 : 0.35);
  btn.bg.setScale(1);
}

export function styleDomInput(el) {
  el.style.cssText = [
    'width: 320px',
    'height: 44px',
    'padding: 0 14px',
    'box-sizing: border-box',
    'font-size: 16px',
    'font-family: Trebuchet MS, sans-serif',
    'border-radius: 8px',
    'border: 1px solid #6b5cff',
    'background: #0e0a1a',
    'color: #f0e8ff',
    'outline: none',
    'text-align: center',
  ].join(';');
}
