import Phaser from 'phaser';

function ensureFlameTextures(scene) {
  if (scene.textures.exists('flame_tongue')) return;

  const makeSoft = (key, w, h, rx, ry, cy) => {
    const tex = scene.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(w / 2, cy, 0, w / 2, cy, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  };

  makeSoft('flame_tongue', 28, 48, 9, 20, 22);
  makeSoft('flame_core', 18, 28, 5, 11, 12);
  makeSoft('flame_ember', 10, 10, 4, 4, 5);
}

/** Cortina de chamas no topo + partículas. */
export function createMenuFlames(scene) {
  ensureFlameTextures(scene);
  const { width, height } = scene.scale;
  const band = height * 0.05;
  scene.topFlameBand = band;
  scene.topFlameWidth = width;

  const glow = scene.add.graphics().setDepth(0.4);
  glow.fillGradientStyle(0xff2200, 0xff2200, 0x1a0800, 0x1a0800, 0.7, 0.7, 0, 0);
  glow.fillRect(0, 0, width, band * 0.55);
  glow.fillGradientStyle(0xff6600, 0xff6600, 0x0b1020, 0x0b1020, 0.35, 0.35, 0, 0);
  glow.fillRect(0, 0, width, band);

  scene.topFlameGfx = scene.add.graphics().setDepth(0.9).setBlendMode(Phaser.BlendModes.ADD);
  const cols = Math.max(28, Math.ceil(width / 22));
  scene.topFlameTongues = [];
  for (let i = 0; i < cols; i++) {
    scene.topFlameTongues.push({
      x: ((i + 0.5) / cols) * width + Phaser.Math.FloatBetween(-8, 8),
      phase: Math.random() * Math.PI * 2,
      speed: 9 + Math.random() * 8,
      baseW: 12 + Math.random() * 18,
      baseH: band * (0.75 + Math.random() * 0.35),
      lean: Phaser.Math.FloatBetween(-0.35, 0.35),
    });
  }

  scene.add
    .particles(0, 0, 'flame_tongue', {
      x: { min: 0, max: width },
      y: { min: -6, max: band * 0.15 },
      lifespan: { min: 320, max: 620 },
      speedY: { min: band * 1.6, max: band * 3.2 },
      speedX: { min: -50, max: 50 },
      accelerationX: { min: -80, max: 80 },
      scale: { start: { min: 0.9, max: 1.7 }, end: 0.15 },
      alpha: { start: { min: 0.55, max: 0.9 }, end: 0 },
      tint: [0xff1a00, 0xff3300, 0xff5500, 0xff7700],
      rotate: { min: -25, max: 25 },
      frequency: 18,
      blendMode: 'ADD',
      advance: 500,
    })
    .setDepth(1);

  scene.add
    .particles(0, 0, 'flame_core', {
      x: { min: 0, max: width },
      y: { min: -2, max: band * 0.1 },
      lifespan: { min: 180, max: 380 },
      speedY: { min: band * 1.2, max: band * 2.4 },
      speedX: { min: -30, max: 30 },
      scale: { start: { min: 0.55, max: 1.15 }, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffffff, 0xfff0a0, 0xffd84a, 0xffaa22],
      rotate: { min: -20, max: 20 },
      frequency: 26,
      blendMode: 'ADD',
      advance: 350,
    })
    .setDepth(1.2);

  scene.add
    .particles(0, 0, 'flame_ember', {
      x: { min: 0, max: width },
      y: { min: 0, max: band * 0.4 },
      lifespan: { min: 450, max: 1100 },
      speedY: { min: band * 0.4, max: band * 1.6 },
      speedX: { min: -70, max: 70 },
      gravityY: -40,
      scale: { start: { min: 0.35, max: 0.9 }, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xff6600, 0xff9900, 0xffcc44, 0xffeebb, 0xffffff],
      frequency: 36,
      blendMode: 'ADD',
      advance: 600,
    })
    .setDepth(1.4);
}

/** Flocos de luz/magia caindo do topo. */
export function createMagicFlakes(scene) {
  if (!scene.textures.exists('particle')) return;
  const { width, height } = scene.scale;
  const fallBand = height * 0.1;

  scene.add
    .particles(0, 0, 'particle', {
      x: { min: 0, max: width },
      y: { min: -10, max: 2 },
      lifespan: { min: 1600, max: 3200 },
      speedY: { min: fallBand / 2.6, max: fallBand / 1.35 },
      speedX: { min: -28, max: 28 },
      gravityY: 6,
      scale: { start: { min: 0.45, max: 1.35 }, end: 0 },
      alpha: { start: { min: 0.3, max: 0.8 }, end: 0 },
      tint: [0xaa88ff, 0xccbbff, 0x6b5cff, 0xffffff, 0xff9ad5, 0x88ddff],
      frequency: 48,
      blendMode: 'ADD',
      advance: 800,
    })
    .setDepth(1);

  scene.add
    .particles(0, 0, 'particle', {
      x: { min: 0, max: width },
      y: { min: -6, max: 0 },
      lifespan: { min: 1000, max: 2000 },
      speedY: { min: fallBand / 2.1, max: fallBand / 1.15 },
      speedX: { min: -14, max: 14 },
      scale: { start: { min: 0.2, max: 0.65 }, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffffff, 0xffeeaa, 0xd4b8ff, 0xa8e8ff],
      frequency: 110,
      blendMode: 'ADD',
      advance: 600,
    })
    .setDepth(1);
}

/** Atualiza o flicker das línguas de fogo (chamar no update da cena). */
export function updateMenuFlames(scene) {
  const g = scene.topFlameGfx;
  const tongues = scene.topFlameTongues;
  if (!g || !tongues) return;

  g.clear();
  const t = scene.time.now * 0.001;
  const band = scene.topFlameBand;

  g.fillStyle(0xff2200, 0.55);
  g.fillRect(0, 0, scene.topFlameWidth, band * 0.22);
  g.fillStyle(0xff6600, 0.4);
  g.fillRect(0, 0, scene.topFlameWidth, band * 0.12);
  g.fillStyle(0xffcc44, 0.35);
  g.fillRect(0, 0, scene.topFlameWidth, band * 0.05);

  for (const f of tongues) {
    const flicker = 0.62 + 0.38 * Math.sin(t * f.speed + f.phase);
    const sway = Math.sin(t * (f.speed * 0.7) + f.phase * 1.7) * 10;
    const tipSway = Math.sin(t * f.speed * 1.35 + f.phase) * 14;
    const h = f.baseH * (0.7 + 0.45 * flicker);
    const w = f.baseW * (0.75 + 0.4 * flicker);
    const x0 = f.x + sway;
    const y0 = 0;
    const xTip = x0 + tipSway + f.lean * h;
    const yTip = Math.min(band * 1.05, h);

    g.fillStyle(0xff2200, 0.5 * flicker);
    g.fillTriangle(x0 - w, y0, x0 + w, y0, xTip, yTip);
    g.fillStyle(0xff6600, 0.55 * flicker);
    g.fillTriangle(x0 - w * 0.65, y0, x0 + w * 0.65, y0, xTip, yTip * 0.92);

    g.fillStyle(0xffcc33, 0.65 * flicker);
    g.fillTriangle(x0 - w * 0.35, y0, x0 + w * 0.35, y0, xTip * 0.15 + x0 * 0.85, yTip * 0.62);
    g.fillStyle(0xfff6c8, 0.55 * flicker);
    g.fillTriangle(x0 - w * 0.16, y0, x0 + w * 0.16, y0, x0 + tipSway * 0.25, yTip * 0.35);

    g.fillStyle(0xffffff, 0.4 * flicker);
    g.fillCircle(xTip, yTip, 1.5 + 2 * flicker);
  }
}

/** Fundo comum das telas de menu (gradiente + fogo + anel + título). */
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

  createMenuFlames(scene);
  createMagicFlakes(scene);

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
