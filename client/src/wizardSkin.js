import Phaser from 'phaser';

/** Pose idle compartilhada do mago (pixel art). */
export const WIZARD_IDLE = [
  '................',
  '......H.........',
  '.....HHH........',
  '....HHHHH.......',
  '...HHHBHHH......',
  '....HSSSSH...W..',
  '...SSSEESSS..T..',
  '...SSSSSSS...T..',
  '....SKKKKS...T..',
  '...RKKKKKKR..T..',
  '..RRKKKKKKRR.T..',
  '..RR.KKKK.RR.T..',
  '..RR......RR.T..',
  '..LL......LL....',
  '................',
  '................',
];

export const WIZARD_WALK_L = [
  '................',
  '......H.........',
  '.....HHH........',
  '....HHHHH.......',
  '...HHHBHHH......',
  '....HSSSSH...W..',
  '...SSSEESSS..T..',
  '...SSSSSSS...T..',
  '....SKKKKS...T..',
  '...RKKKKKKR..T..',
  '..RRKKKKKKRR.T..',
  '..RR.KKKK.RR.T..',
  '..RR......RR.T..',
  '..LL.......L....',
  '.LL.............',
  '................',
];

export const WIZARD_WALK_R = [
  '................',
  '......H.........',
  '.....HHH........',
  '....HHHHH.......',
  '...HHHBHHH......',
  '....HSSSSH...W..',
  '...SSSEESSS..T..',
  '...SSSSSSS...T..',
  '....SKKKKS...T..',
  '...RKKKKKKR..T..',
  '..RRKKKKKKRR.T..',
  '..RR.KKKK.RR.T..',
  '..RR......RR.T..',
  '...L......LL....',
  '...........LL...',
  '................',
];

const SCHOOL_COLORS = {
  crimson: 0xff5555,
  azure: 0x55aaff,
  emerald: 0x55ff99,
  amber: 0xffaa33,
  necromancer: 0x8844cc,
};

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function mix(a, b, t) {
  return clampByte(a + (b - a) * t);
}

function shade(color, factor) {
  const c = Phaser.Display.Color.IntegerToColor(color >>> 0);
  return Phaser.Display.Color.GetColor(
    clampByte(c.red * factor),
    clampByte(c.green * factor),
    clampByte(c.blue * factor)
  );
}

function lighten(color, amount) {
  const c = Phaser.Display.Color.IntegerToColor(color >>> 0);
  return Phaser.Display.Color.GetColor(
    mix(c.red, 255, amount),
    mix(c.green, 255, amount),
    mix(c.blue, 255, amount)
  );
}

/** Monta paleta do mago a partir de uma cor principal (manto/chapéu). */
export function paletteFromColor(color) {
  const accent = color >>> 0;
  const robe = accent;
  const robeDark = shade(accent, 0.72);
  const hat = shade(accent, 0.45);
  const boots = shade(accent, 0.32);
  const buckle = lighten(accent, 0.55);
  const staffTip = lighten(accent, 0.35);
  return {
    H: hat,
    B: buckle,
    S: 0xe8c39e,
    E: 0x1a1a1a,
    K: robe,
    R: robeDark,
    L: boots,
    W: staffTip,
    T: 0x5d4037,
  };
}

export function nearestWizardType(color) {
  const c = Phaser.Display.Color.IntegerToColor(color >>> 0);
  let best = 'crimson';
  let bestDist = Infinity;
  for (const [type, hex] of Object.entries(SCHOOL_COLORS)) {
    const o = Phaser.Display.Color.IntegerToColor(hex);
    const d =
      (c.red - o.red) ** 2 + (c.green - o.green) ** 2 + (c.blue - o.blue) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = type;
    }
  }
  return best;
}

export function colorTextureKey(color) {
  return `wizard_c_${(color >>> 0).toString(16).padStart(6, '0')}`;
}

function makePixelTexture(scene, key, rows, palette, scale = 2) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const h = rows.length;
  const w = rows[0].length;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || !(ch in palette)) continue;
      g.fillStyle(palette[ch], 1);
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  g.generateTexture(key, w * scale, h * scale);
  g.destroy();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Gera texturas idle/walk do mago na cor dada (cacheia por cor). */
export function ensureWizardColorTexture(scene, color) {
  const hex = color >>> 0;
  const base = colorTextureKey(hex);
  if (scene.textures.exists(base)) return base;

  const palette = paletteFromColor(hex);
  makePixelTexture(scene, base, WIZARD_IDLE, palette);
  makePixelTexture(scene, `${base}_wL`, WIZARD_WALK_L, palette);
  makePixelTexture(scene, `${base}_wR`, WIZARD_WALK_R, palette);

  const walkKey = `${base}_walk`;
  if (!scene.anims.exists(walkKey)) {
    scene.anims.create({
      key: walkKey,
      frames: [
        { key: base },
        { key: `${base}_wL` },
        { key: base },
        { key: `${base}_wR` },
      ],
      frameRate: 9,
      repeat: -1,
    });
  }

  return base;
}

/** Textura de preview (sempre regenerada) para o seletor de cor. */
export function updateWizardPreviewTexture(scene, color) {
  const key = 'wizard_preview';
  const palette = paletteFromColor(color >>> 0);
  makePixelTexture(scene, key, WIZARD_IDLE, palette);
  return key;
}
