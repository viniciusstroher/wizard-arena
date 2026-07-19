import Phaser from 'phaser';

/** Pose idle compartilhada do mago clássico (pixel art). */
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

/** Skins selecionáveis (clássico + 5 novas). */
export const WIZARD_SKINS = [
  {
    id: 'classic',
    name: 'Clássico',
    idle: WIZARD_IDLE,
    walkL: WIZARD_WALK_L,
    walkR: WIZARD_WALK_R,
  },
  {
    id: 'hooded',
    name: 'Capuz',
    idle: [
      '................',
      '.....HHHH.......',
      '....HHHHHH......',
      '...HHHHHHHH.....',
      '...HHHBHHHH.....',
      '...HHSSSSHH..W..',
      '...HSSEESSH..T..',
      '....SSSSSS...T..',
      '....SKKKKS...T..',
      '...RKKKKKKR..T..',
      '..RRKKKKKKRR.T..',
      '..RRKKKKKKRR.T..',
      '..RR.KKKK.RR....',
      '..LL......LL....',
      '................',
      '................',
    ],
    walkL: [
      '................',
      '.....HHHH.......',
      '....HHHHHH......',
      '...HHHHHHHH.....',
      '...HHHBHHHH.....',
      '...HHSSSSHH..W..',
      '...HSSEESSH..T..',
      '....SSSSSS...T..',
      '....SKKKKS...T..',
      '...RKKKKKKR..T..',
      '..RRKKKKKKRR.T..',
      '..RRKKKKKKRR.T..',
      '..RR.KKKK.RR....',
      '..LL.......L....',
      '.LL.............',
      '................',
    ],
    walkR: [
      '................',
      '.....HHHH.......',
      '....HHHHHH......',
      '...HHHHHHHH.....',
      '...HHHBHHHH.....',
      '...HHSSSSHH..W..',
      '...HSSEESSH..T..',
      '....SSSSSS...T..',
      '....SKKKKS...T..',
      '...RKKKKKKR..T..',
      '..RRKKKKKKRR.T..',
      '..RRKKKKKKRR.T..',
      '..RR.KKKK.RR....',
      '...L......LL....',
      '...........LL...',
      '................',
    ],
  },
  {
    id: 'crowned',
    name: 'Coroa',
    idle: [
      '................',
      '....B.B.B.......',
      '...HHHHHHH......',
      '....HSSSSH...W..',
      '...SSSEESSS..T..',
      '...SSSSSSS...T..',
      '....SKKKKS...T..',
      '...KKKKKKKK..T..',
      '...RKKKKKKR..T..',
      '....KKKKKK...T..',
      '....KK..KK......',
      '....LL..LL......',
      '................',
      '................',
      '................',
      '................',
    ],
    walkL: [
      '................',
      '....B.B.B.......',
      '...HHHHHHH......',
      '....HSSSSH...W..',
      '...SSSEESSS..T..',
      '...SSSSSSS...T..',
      '....SKKKKS...T..',
      '...KKKKKKKK..T..',
      '...RKKKKKKR..T..',
      '....KKKKKK...T..',
      '....KK..KK......',
      '....LL...L......',
      '...LL...........',
      '................',
      '................',
      '................',
    ],
    walkR: [
      '................',
      '....B.B.B.......',
      '...HHHHHHH......',
      '....HSSSSH...W..',
      '...SSSEESSS..T..',
      '...SSSSSSS...T..',
      '....SKKKKS...T..',
      '...KKKKKKKK..T..',
      '...RKKKKKKR..T..',
      '....KKKKKK...T..',
      '....KK..KK......',
      '.....L..LL......',
      '..........LL....',
      '................',
      '................',
      '................',
    ],
  },
  {
    id: 'battle',
    name: 'Batalha',
    idle: [
      '................',
      '.....HHH........',
      '....HHHHH.......',
      '...HBHBHBH......',
      '....HSSSSH...W..',
      '...SSSEESSS..T..',
      '...SSSSSSS...T..',
      '..RRKSKKKSRR.T..',
      '..RRKKKKKKRR.T..',
      '....KKKKKK...T..',
      '....KK..KK......',
      '....LL..LL......',
      '................',
      '................',
      '................',
      '................',
    ],
    walkL: [
      '................',
      '.....HHH........',
      '....HHHHH.......',
      '...HBHBHBH......',
      '....HSSSSH...W..',
      '...SSSEESSS..T..',
      '...SSSSSSS...T..',
      '..RRKSKKKSRR.T..',
      '..RRKKKKKKRR.T..',
      '....KKKKKK...T..',
      '....KK..KK......',
      '....LL...L......',
      '...LL...........',
      '................',
      '................',
      '................',
    ],
    walkR: [
      '................',
      '.....HHH........',
      '....HHHHH.......',
      '...HBHBHBH......',
      '....HSSSSH...W..',
      '...SSSEESSS..T..',
      '...SSSSSSS...T..',
      '..RRKSKKKSRR.T..',
      '..RRKKKKKKRR.T..',
      '....KKKKKK...T..',
      '....KK..KK......',
      '.....L..LL......',
      '..........LL....',
      '................',
      '................',
      '................',
    ],
  },
  {
    id: 'mystic',
    name: 'Místico',
    idle: [
      '.......H........',
      '......HHH.......',
      '.....HHHHH......',
      '....HHHHHHH.....',
      '...HHHHBHHHH....',
      '....HHSSSHH..W..',
      '...HSSEESSH..T..',
      '...SSSSSSS...T..',
      '....SKKKKS...T..',
      '...RKKKKKKR..T..',
      '..RRKKKKKKRR.T..',
      '.RRR.KKKK.RRR...',
      '.RR........RR...',
      '.LL........LL...',
      '................',
      '................',
    ],
    walkL: [
      '.......H........',
      '......HHH.......',
      '.....HHHHH......',
      '....HHHHHHH.....',
      '...HHHHBHHHH....',
      '....HHSSSHH..W..',
      '...HSSEESSH..T..',
      '...SSSSSSS...T..',
      '....SKKKKS...T..',
      '...RKKKKKKR..T..',
      '..RRKKKKKKRR.T..',
      '.RRR.KKKK.RRR...',
      '.RR........RR...',
      '.LL.........L...',
      'LL..............',
      '................',
    ],
    walkR: [
      '.......H........',
      '......HHH.......',
      '.....HHHHH......',
      '....HHHHHHH.....',
      '...HHHHBHHHH....',
      '....HHSSSHH..W..',
      '...HSSEESSH..T..',
      '...SSSSSSS...T..',
      '....SKKKKS...T..',
      '...RKKKKKKR..T..',
      '..RRKKKKKKRR.T..',
      '.RRR.KKKK.RRR...',
      '.RR........RR...',
      '..L........LL...',
      '............LL..',
      '................',
    ],
  },
  {
    id: 'shadow',
    name: 'Sombra',
    idle: [
      '................',
      '....HHHHHH......',
      '...HHHHHHHH.....',
      '..HHHSSSSHHH....',
      '..HHSEEESSHH.W..',
      '..HHSSSSSSHH.T..',
      '...HKKKKKKH..T..',
      '...RKKKKKKR..T..',
      '..RRKKKKKKRR.T..',
      '..RRKKKKKKRR.T..',
      '..RR.KKKK.RR....',
      '..RR......RR....',
      '..LL......LL....',
      '................',
      '................',
      '................',
    ],
    walkL: [
      '................',
      '....HHHHHH......',
      '...HHHHHHHH.....',
      '..HHHSSSSHHH....',
      '..HHSEEESSHH.W..',
      '..HHSSSSSSHH.T..',
      '...HKKKKKKH..T..',
      '...RKKKKKKR..T..',
      '..RRKKKKKKRR.T..',
      '..RRKKKKKKRR.T..',
      '..RR.KKKK.RR....',
      '..RR......RR....',
      '..LL.......L....',
      '.LL.............',
      '................',
      '................',
    ],
    walkR: [
      '................',
      '....HHHHHH......',
      '...HHHHHHHH.....',
      '..HHHSSSSHHH....',
      '..HHSEEESSHH.W..',
      '..HHSSSSSSHH.T..',
      '...HKKKKKKH..T..',
      '...RKKKKKKR..T..',
      '..RRKKKKKKRR.T..',
      '..RRKKKKKKRR.T..',
      '..RR.KKKK.RR....',
      '..RR......RR....',
      '...L......LL....',
      '...........LL...',
      '................',
      '................',
    ],
  },
];

export const DEFAULT_SKIN = 'classic';
export const WIZARD_SKIN_IDS = WIZARD_SKINS.map((s) => s.id);

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

export function normalizeSkinId(skinId) {
  const id = String(skinId || DEFAULT_SKIN);
  return WIZARD_SKIN_IDS.includes(id) ? id : DEFAULT_SKIN;
}

export function getSkin(skinId) {
  const id = normalizeSkinId(skinId);
  return WIZARD_SKINS.find((s) => s.id === id) || WIZARD_SKINS[0];
}

export function colorTextureKey(color, skinId = DEFAULT_SKIN) {
  const skin = normalizeSkinId(skinId);
  const hex = (color >>> 0).toString(16).padStart(6, '0');
  return `wizard_s_${skin}_${hex}`;
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

/** Gera texturas idle/walk do mago na cor/skin dadas (cacheia por par). */
export function ensureWizardColorTexture(scene, color, skinId = DEFAULT_SKIN) {
  const hex = color >>> 0;
  const skin = getSkin(skinId);
  const base = colorTextureKey(hex, skin.id);
  if (scene.textures.exists(base)) return base;

  const palette = paletteFromColor(hex);
  makePixelTexture(scene, base, skin.idle, palette);
  makePixelTexture(scene, `${base}_wL`, skin.walkL, palette);
  makePixelTexture(scene, `${base}_wR`, skin.walkR, palette);

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

/** Textura de preview (sempre regenerada) para o seletor. */
export function updateWizardPreviewTexture(scene, color, skinId = DEFAULT_SKIN, key = 'wizard_preview') {
  const skin = getSkin(skinId);
  const palette = paletteFromColor(color >>> 0);
  makePixelTexture(scene, key, skin.idle, palette);
  return key;
}
