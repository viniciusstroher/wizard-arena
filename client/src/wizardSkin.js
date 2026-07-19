import Phaser from 'phaser';

/**
 * Pixel art 24×24 — letras da paleta:
 * H chapéu escuro · A chapéu médio · B fivela/joia
 * S pele · N sombra da pele · E olhos · O branco do olho
 * K manto · C destaque do manto · R manto escuro · P prega interna
 * L botas · F cano/top da bota
 * W ponta do cajado · G brilho da gema · T madeira · D madeira escura
 *
 * Cajados por skin:
 * classic  — orbe redonda em haste reta
 * hooded   — galho torto com cristal pendente
 * crowned  — cetro real com joias
 * battle   — lança de guerra com lâmina e anéis
 * mystic   — crescente lunar com gema flutuante
 * shadow   — foice óssea com crânio
 */

/** Pose idle compartilhada do mago clássico (pixel art). */
export const WIZARD_IDLE = [
  '........................',
  '...........H............',
  '..........HHH...........',
  '.........HHHHH..........',
  '........HHHHHHH.........',
  '.......HHHHHHHHH........',
  '......HHHHHBHHHHH....G..',
  '.......AAHSSSSHA....WWW.',
  '......SSSOEEOSSS.....T..',
  '......SSSSNSSSSS.....T..',
  '.......CCKKKKCC......T..',
  '......RCKKKKKKCR.....T..',
  '.....RRKKKKBKKKRR....T..',
  '.....RR.KKPKPK.RR....T..',
  '.....RR..KKKK..RR....T..',
  '.....RR........RR....D..',
  '.....FL........LF.......',
  '.....LL........LL.......',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

export const WIZARD_WALK_L = [
  '........................',
  '...........H............',
  '..........HHH...........',
  '.........HHHHH..........',
  '........HHHHHHH.........',
  '.......HHHHHHHHH........',
  '......HHHHHBHHHHH....G..',
  '.......AAHSSSSHA....WWW.',
  '......SSSOEEOSSS.....T..',
  '......SSSSNSSSSS.....T..',
  '.......CCKKKKCC......T..',
  '......RCKKKKKKCR.....T..',
  '.....RRKKKKBKKKRR....T..',
  '.....RR.KKPKPK.RR....T..',
  '.....RR..KKKK..RR....T..',
  '.....RR........RR....D..',
  '.....FL.........F.......',
  '....LLL.........L.......',
  '...LL...................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

export const WIZARD_WALK_R = [
  '........................',
  '...........H............',
  '..........HHH...........',
  '.........HHHHH..........',
  '........HHHHHHH.........',
  '.......HHHHHHHHH........',
  '......HHHHHBHHHHH....G..',
  '.......AAHSSSSHA....WWW.',
  '......SSSOEEOSSS.....T..',
  '......SSSSNSSSSS.....T..',
  '.......CCKKKKCC......T..',
  '......RCKKKKKKCR.....T..',
  '.....RRKKKKBKKKRR....T..',
  '.....RR.KKPKPK.RR....T..',
  '.....RR..KKKK..RR....T..',
  '.....RR........RR....D..',
  '......F........LF.......',
  '......L........LLL......',
  '..................LL....',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
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
    // Cajado: galho torto com cristal pendente
    idle: [
      '........................',
      '.........HHHHH..........',
      '........HHHHHHH.........',
      '.......HHHHHHHHH........',
      '......HHHHHHHHHHH.......',
      '.....HHHHHBHHHHHHH......',
      '.....HHHHSSSSSHHHH..W...',
      '.....HHHSOEEOSHHH..WT...',
      '.....HHHSSNSSSHHH...T...',
      '......HHCCKKCCHH....T...',
      '......RCKKKKKKCR....T...',
      '.....RRKKKKBKKKRR...T...',
      '.....RRKKPKPKKKRR..T....',
      '.....RR.KKKKKK.RR..T....',
      '.....RR........RR..TG...',
      '.....RR........RR...G...',
      '.....FL........LF.......',
      '.....LL........LL.......',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkL: [
      '........................',
      '.........HHHHH..........',
      '........HHHHHHH.........',
      '.......HHHHHHHHH........',
      '......HHHHHHHHHHH.......',
      '.....HHHHHBHHHHHHH......',
      '.....HHHHSSSSSHHHH..W...',
      '.....HHHSOEEOSHHH..WT...',
      '.....HHHSSNSSSHHH...T...',
      '......HHCCKKCCHH....T...',
      '......RCKKKKKKCR....T...',
      '.....RRKKKKBKKKRR...T...',
      '.....RRKKPKPKKKRR..T....',
      '.....RR.KKKKKK.RR..T....',
      '.....RR........RR..TG...',
      '.....RR........RR...G...',
      '.....FL.........F.......',
      '....LLL.........L.......',
      '...LL...................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkR: [
      '........................',
      '.........HHHHH..........',
      '........HHHHHHH.........',
      '.......HHHHHHHHH........',
      '......HHHHHHHHHHH.......',
      '.....HHHHHBHHHHHHH......',
      '.....HHHHSSSSSHHHH..W...',
      '.....HHHSOEEOSHHH..WT...',
      '.....HHHSSNSSSHHH...T...',
      '......HHCCKKCCHH....T...',
      '......RCKKKKKKCR....T...',
      '.....RRKKKKBKKKRR...T...',
      '.....RRKKPKPKKKRR..T....',
      '.....RR.KKKKKK.RR..T....',
      '.....RR........RR..TG...',
      '.....RR........RR...G...',
      '......F........LF.......',
      '......L........LLL......',
      '..................LL....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
  },
  {
    id: 'crowned',
    name: 'Coroa',
    // Cajado: cetro real com joias e anéis dourados
    idle: [
      '........................',
      '.......B.B.B.B..........',
      '......BBHBHBHBB.........',
      '.....BBHHHHHHHBB....B...',
      '......AHHHHHHHA....BWB..',
      '.......AHSSSSHA.....T...',
      '......SSSOEEOSSS...BTB..',
      '......SSSSNSSSSS....T...',
      '.......CKBKBKC......T...',
      '......RCKKKKKKCR....T...',
      '......CCKKKKKKCC...BTB..',
      '.....RR.KKPKPK.RR...T...',
      '.....RR..KKKK..RR...T...',
      '.....RR........RR...D...',
      '......K........K........',
      '.....FL........LF.......',
      '.....LL........LL.......',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkL: [
      '........................',
      '.......B.B.B.B..........',
      '......BBHBHBHBB.........',
      '.....BBHHHHHHHBB....B...',
      '......AHHHHHHHA....BWB..',
      '.......AHSSSSHA.....T...',
      '......SSSOEEOSSS...BTB..',
      '......SSSSNSSSSS....T...',
      '.......CKBKBKC......T...',
      '......RCKKKKKKCR....T...',
      '......CCKKKKKKCC...BTB..',
      '.....RR.KKPKPK.RR...T...',
      '.....RR..KKKK..RR...T...',
      '.....RR........RR...D...',
      '......K........K........',
      '.....FL.........F.......',
      '....LLL.........L.......',
      '...LL...................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkR: [
      '........................',
      '.......B.B.B.B..........',
      '......BBHBHBHBB.........',
      '.....BBHHHHHHHBB....B...',
      '......AHHHHHHHA....BWB..',
      '.......AHSSSSHA.....T...',
      '......SSSOEEOSSS...BTB..',
      '......SSSSNSSSSS....T...',
      '.......CKBKBKC......T...',
      '......RCKKKKKKCR....T...',
      '......CCKKKKKKCC...BTB..',
      '.....RR.KKPKPK.RR...T...',
      '.....RR..KKKK..RR...T...',
      '.....RR........RR...D...',
      '......K........K........',
      '......F........LF.......',
      '......L........LLL......',
      '..................LL....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
  },
  {
    id: 'battle',
    name: 'Batalha',
    // Cajado: lança de guerra com lâmina e empunhadura
    idle: [
      '........................',
      '..........HHH.......B...',
      '.........HHHHH.....BBB..',
      '........HBHBHBH.....W...',
      '.......HBHHHHHBH....T...',
      '......HBHHHHHHHBH...T...',
      '.......AHSSSSHA....BTB..',
      '......SSSOEEOSSS....T...',
      '......SSSSNSSSSS....T...',
      '.....BBCCKKKKCCBB...T...',
      '.....RRKKKKBKKKRR..BTB..',
      '.....RRBKKPKPKBRR...T...',
      '.....RR..KKKK..RR...T...',
      '.....BB........BB...T...',
      '.....BB........BB...D...',
      '.....FL........LF.......',
      '.....LL........LL.......',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkL: [
      '........................',
      '..........HHH.......B...',
      '.........HHHHH.....BBB..',
      '........HBHBHBH.....W...',
      '.......HBHHHHHBH....T...',
      '......HBHHHHHHHBH...T...',
      '.......AHSSSSHA....BTB..',
      '......SSSOEEOSSS....T...',
      '......SSSSNSSSSS....T...',
      '.....BBCCKKKKCCBB...T...',
      '.....RRKKKKBKKKRR..BTB..',
      '.....RRBKKPKPKBRR...T...',
      '.....RR..KKKK..RR...T...',
      '.....BB........BB...T...',
      '.....BB........BB...D...',
      '.....FL.........F.......',
      '....LLL.........L.......',
      '...LL...................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkR: [
      '........................',
      '..........HHH.......B...',
      '.........HHHHH.....BBB..',
      '........HBHBHBH.....W...',
      '.......HBHHHHHBH....T...',
      '......HBHHHHHHHBH...T...',
      '.......AHSSSSHA....BTB..',
      '......SSSOEEOSSS....T...',
      '......SSSSNSSSSS....T...',
      '.....BBCCKKKKCCBB...T...',
      '.....RRKKKKBKKKRR..BTB..',
      '.....RRBKKPKPKBRR...T...',
      '.....RR..KKKK..RR...T...',
      '.....BB........BB...T...',
      '.....BB........BB...D...',
      '......F........LF.......',
      '......L........LLL......',
      '..................LL....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
  },
  {
    id: 'mystic',
    name: 'Místico',
    // Cajado: crescente lunar com gema flutuante
    idle: [
      '............H.......G...',
      '...........HHH.....W.W..',
      '..........HHHHH.....W...',
      '.........HHHHHHH....T...',
      '........HHHHBHHHH..GTG..',
      '.......AHHHSSSHHHA..T...',
      '......HHHSOEEOSHHH..T...',
      '......HHHSSNSSSHHH..T...',
      '.......HHCCKKCCHH...T...',
      '......RRCKKKKKCRR...T...',
      '.....RRRKKKBKKKRRR.BTB..',
      '....RRR.KKPKPK.RRR..T...',
      '...RRR...KKKK...RRR.T...',
      '...RR..........RR...D...',
      '..RR............RR......',
      '..FL............LF......',
      '..LL............LL......',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkL: [
      '............H.......G...',
      '...........HHH.....W.W..',
      '..........HHHHH.....W...',
      '.........HHHHHHH....T...',
      '........HHHHBHHHH..GTG..',
      '.......AHHHSSSHHHA..T...',
      '......HHHSOEEOSHHH..T...',
      '......HHHSSNSSSHHH..T...',
      '.......HHCCKKCCHH...T...',
      '......RRCKKKKKCRR...T...',
      '.....RRRKKKBKKKRRR.BTB..',
      '....RRR.KKPKPK.RRR..T...',
      '...RRR...KKKK...RRR.T...',
      '...RR..........RR...D...',
      '..RR............RR......',
      '..FL.............F......',
      '.LLL.............L......',
      'LL......................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkR: [
      '............H.......G...',
      '...........HHH.....W.W..',
      '..........HHHHH.....W...',
      '.........HHHHHHH....T...',
      '........HHHHBHHHH..GTG..',
      '.......AHHHSSSHHHA..T...',
      '......HHHSOEEOSHHH..T...',
      '......HHHSSNSSSHHH..T...',
      '.......HHCCKKCCHH...T...',
      '......RRCKKKKKCRR...T...',
      '.....RRRKKKBKKKRRR.BTB..',
      '....RRR.KKPKPK.RRR..T...',
      '...RRR...KKKK...RRR.T...',
      '...RR..........RR...D...',
      '..RR............RR......',
      '...F............LF......',
      '...L............LLL.....',
      '...................LL...',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
  },
  {
    id: 'shadow',
    name: 'Sombra',
    // Cajado: foice óssea com crânio
    idle: [
      '........................',
      '........HHHHHH.....WBW..',
      '.......HHHHHHHH....BDB..',
      '......HHHHHHHHHH....B...',
      '.....HHHHHHHHHHHH...T...',
      '....HHHHNSSSSNHHHH..T...',
      '....HHHHOEEOOHHHH..WT...',
      '....HHHHSSNSSHHHH.W.T...',
      '.....HHHCCKKCCHHH...T...',
      '.....RRCKKKKKCRR....T...',
      '....RRRKKKKBKKKRRR..D...',
      '....RRRKKPKPKKKRRR.DT...',
      '....RRR..KKKK..RRR..D...',
      '....RR..........RR......',
      '....RR..........RR......',
      '....FL..........LF......',
      '....LL..........LL......',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkL: [
      '........................',
      '........HHHHHH.....WBW..',
      '.......HHHHHHHH....BDB..',
      '......HHHHHHHHHH....B...',
      '.....HHHHHHHHHHHH...T...',
      '....HHHHNSSSSNHHHH..T...',
      '....HHHHOEEOOHHHH..WT...',
      '....HHHHSSNSSHHHH.W.T...',
      '.....HHHCCKKCCHHH...T...',
      '.....RRCKKKKKCRR....T...',
      '....RRRKKKKBKKKRRR..D...',
      '....RRRKKPKPKKKRRR.DT...',
      '....RRR..KKKK..RRR..D...',
      '....RR..........RR......',
      '....RR..........RR......',
      '....FL...........F......',
      '...LLL...........L......',
      '..LL....................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    walkR: [
      '........................',
      '........HHHHHH.....WBW..',
      '.......HHHHHHHH....BDB..',
      '......HHHHHHHHHH....B...',
      '.....HHHHHHHHHHHH...T...',
      '....HHHHNSSSSNHHHH..T...',
      '....HHHHOEEOOHHHH..WT...',
      '....HHHHSSNSSHHHH.W.T...',
      '.....HHHCCKKCCHHH...T...',
      '.....RRCKKKKKCRR....T...',
      '....RRRKKKKBKKKRRR..D...',
      '....RRRKKPKPKKKRRR.DT...',
      '....RRR..KKKK..RRR..D...',
      '....RR..........RR......',
      '....RR..........RR......',
      '.....F..........LF......',
      '.....L..........LLL.....',
      '....................LL..',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
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
  const robeLight = lighten(accent, 0.22);
  const robeFold = shade(accent, 0.55);
  const hat = shade(accent, 0.42);
  const hatMid = shade(accent, 0.58);
  const boots = shade(accent, 0.3);
  const bootCuff = shade(accent, 0.48);
  const buckle = lighten(accent, 0.55);
  const staffTip = lighten(accent, 0.35);
  const gemGlow = lighten(accent, 0.72);
  return {
    H: hat,
    A: hatMid,
    B: buckle,
    S: 0xe8c39e,
    N: 0xc49a6c,
    E: 0x1a1a1a,
    O: 0xf5f0e6,
    K: robe,
    C: robeLight,
    R: robeDark,
    P: robeFold,
    L: boots,
    F: bootCuff,
    W: staffTip,
    G: gemGlow,
    T: 0x5d4037,
    D: 0x3e2723,
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
  // v3: grade 24×24 — invalida cache de texturas antigas
  return `wizard_s3_${skin}_${hex}`;
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
