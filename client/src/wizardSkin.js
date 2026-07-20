import Phaser from 'phaser';

/**
 * Pixel art 24×24 — letras da paleta:
 * H chapéu escuro · A chapéu médio · B fivela/joia
 * S pele · N sombra da pele · E olhos · O branco do olho
 * K manto · C destaque do manto · R manto escuro · P prega interna
 * L botas · F cano/top da bota
 * W ponta do cajado · G brilho da gema · T madeira · D madeira escura
 *
 * Skins = classes de mago (D&D / WoW / Tibia / Ragnarok), compostas por
 * chapéu + corpo + cajado.
 */

const SIZE = 24;
const EMPTY = '.'.repeat(SIZE);

function blank() {
  return Array.from({ length: SIZE }, () => EMPTY);
}

function cloneRows(rows) {
  return rows.map((r) => r);
}

/** Sobrepõe `overlay` em `base`; '.' no overlay preserva o pixel de baixo. */
function stamp(base, overlay) {
  const out = cloneRows(base);
  for (let y = 0; y < SIZE; y++) {
    const o = overlay[y] || EMPTY;
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const ch = o[x] || '.';
      row += ch !== '.' ? ch : out[y][x];
    }
    out[y] = row;
  }
  return out;
}

function rowsFrom(lines) {
  return lines.map((line) => line.padEnd(SIZE, '.').slice(0, SIZE));
}

// ── Corpo (rosto a partir da linha 7; linhas 1–6 livres para o chapéu) ──────

const BODY_IDLE = rowsFrom([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '.......AHSSSSHA..........',
  '......SSSOEEOSSS.........',
  '......SSSSNSSSSS.........',
  '.......CCKKKKCC..........',
  '......RCKKKKKKCR.........',
  '.....RRKKKKBKKKRR........',
  '.....RR.KKPKPK.RR........',
  '.....RR..KKKK..RR........',
  '.....RR........RR........',
  '.....FL........LF........',
  '.....LL........LL........',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
]);

const BODY_WALK_L = rowsFrom([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '.......AHSSSSHA..........',
  '......SSSOEEOSSS.........',
  '......SSSSNSSSSS.........',
  '.......CCKKKKCC..........',
  '......RCKKKKKKCR.........',
  '.....RRKKKKBKKKRR........',
  '.....RR.KKPKPK.RR........',
  '.....RR..KKKK..RR........',
  '.....RR........RR........',
  '.....FL.........F........',
  '....LLL.........L........',
  '...LL....................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
]);

const BODY_WALK_R = rowsFrom([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '.......AHSSSSHA..........',
  '......SSSOEEOSSS.........',
  '......SSSSNSSSSS.........',
  '.......CCKKKKCC..........',
  '......RCKKKKKKCR.........',
  '.....RRKKKKBKKKRR........',
  '.....RR.KKPKPK.RR........',
  '.....RR..KKKK..RR........',
  '.....RR........RR........',
  '......F........LF........',
  '......L........LLL.......',
  '..................LL.....',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
]);

/** Corpo com capuz (chapéu embutido — use hat: none ou só ornamento). */
const BODY_HOOD_IDLE = rowsFrom([
  '........................',
  '.........HHHHH..........',
  '........HHHHHHH.........',
  '.......HHHHHHHHH........',
  '......HHHHHHHHHHH.......',
  '.....HHHHHBHHHHHHH......',
  '.....HHHHSSSSSHHHH......',
  '.....HHHSOEEOSHHH.......',
  '.....HHHSSNSSSHHH.......',
  '......HHCCKKCCHH........',
  '......RCKKKKKKCR........',
  '.....RRKKKKBKKKRR.......',
  '.....RRKKPKPKKKRR.......',
  '.....RR.KKKKKK.RR.......',
  '.....RR........RR.......',
  '.....RR........RR.......',
  '.....FL........LF.......',
  '.....LL........LL.......',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
]);

const BODY_HOOD_WALK_L = rowsFrom([
  '........................',
  '.........HHHHH..........',
  '........HHHHHHH.........',
  '.......HHHHHHHHH........',
  '......HHHHHHHHHHH.......',
  '.....HHHHHBHHHHHHH......',
  '.....HHHHSSSSSHHHH......',
  '.....HHHSOEEOSHHH.......',
  '.....HHHSSNSSSHHH.......',
  '......HHCCKKCCHH........',
  '......RCKKKKKKCR........',
  '.....RRKKKKBKKKRR.......',
  '.....RRKKPKPKKKRR.......',
  '.....RR.KKKKKK.RR.......',
  '.....RR........RR.......',
  '.....RR........RR.......',
  '.....FL.........F.......',
  '....LLL.........L.......',
  '...LL...................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
]);

const BODY_HOOD_WALK_R = rowsFrom([
  '........................',
  '.........HHHHH..........',
  '........HHHHHHH.........',
  '.......HHHHHHHHH........',
  '......HHHHHHHHHHH.......',
  '.....HHHHHBHHHHHHH......',
  '.....HHHHSSSSSHHHH......',
  '.....HHHSOEEOSHHH.......',
  '.....HHHSSNSSSHHH.......',
  '......HHCCKKCCHH........',
  '......RCKKKKKKCR........',
  '.....RRKKKKBKKKRR.......',
  '.....RRKKPKPKKKRR.......',
  '.....RR.KKKKKK.RR.......',
  '.....RR........RR.......',
  '.....RR........RR.......',
  '......F........LF.......',
  '......L........LLL......',
  '..................LL....',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
]);

/** Corpo blindado (battle mage). */
const BODY_ARMOR_IDLE = rowsFrom([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '.......AHSSSSHA..........',
  '......SSSOEEOSSS.........',
  '......SSSSNSSSSS.........',
  '.....BBCCKKKKCCBB........',
  '.....RRKKKKBKKKRR........',
  '.....RRBKKPKPKBRR........',
  '.....RR..KKKK..RR........',
  '.....BB........BB........',
  '.....BB........BB........',
  '.....FL........LF........',
  '.....LL........LL........',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
]);

const BODY_ARMOR_WALK_L = rowsFrom([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '.......AHSSSSHA..........',
  '......SSSOEEOSSS.........',
  '......SSSSNSSSSS.........',
  '.....BBCCKKKKCCBB........',
  '.....RRKKKKBKKKRR........',
  '.....RRBKKPKPKBRR........',
  '.....RR..KKKK..RR........',
  '.....BB........BB........',
  '.....BB........BB........',
  '.....FL.........F........',
  '....LLL.........L........',
  '...LL....................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
]);

const BODY_ARMOR_WALK_R = rowsFrom([
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '.......AHSSSSHA..........',
  '......SSSOEEOSSS.........',
  '......SSSSNSSSSS.........',
  '.....BBCCKKKKCCBB........',
  '.....RRKKKKBKKKRR........',
  '.....RRBKKPKPKBRR........',
  '.....RR..KKKK..RR........',
  '.....BB........BB........',
  '.....BB........BB........',
  '......F........LF........',
  '......L........LLL.......',
  '..................LL.....',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
]);

const BODIES = {
  robe: { idle: BODY_IDLE, walkL: BODY_WALK_L, walkR: BODY_WALK_R },
  hood: { idle: BODY_HOOD_IDLE, walkL: BODY_HOOD_WALK_L, walkR: BODY_HOOD_WALK_R },
  armor: { idle: BODY_ARMOR_IDLE, walkL: BODY_ARMOR_WALK_L, walkR: BODY_ARMOR_WALK_R },
};

// ── Chapéus (só H/A/B/C/G — sem pele; ocupam linhas 1–6) ────────────────────

const HATS = {
  none: blank(),
  pointed: rowsFrom([
    '...........H............',
    '..........HHH...........',
    '.........HHHHH..........',
    '........HHHHHHH.........',
    '.......HHHHHHHHH........',
    '......HHHHHBHHHHH.......',
  ]),
  tall: rowsFrom([
    '...........H............',
    '..........HHH...........',
    '..........HHH...........',
    '.........HHHHH..........',
    '........HHHHHHH.........',
    '.......HHHHBHHHH........',
  ]),
  hood_top: rowsFrom([
    '.........HHHHH..........',
    '........HHHHHHH.........',
    '.......HHHHHHHHH........',
    '......HHHHHHHHHHH.......',
    '.....HHHHHBHHHHHHH......',
  ]),
  crown: rowsFrom([
    '.......B.B.B.B..........',
    '......BBHBHBHBB.........',
    '.....BBHHHHHHHBB........',
    '......AHHHHHHHA.........',
    '.......AAAAAAA..........',
  ]),
  circlet: rowsFrom([
    '........................',
    '........................',
    '........................',
    '......B.BHB.B...........',
    '.......AHHHHA...........',
    '.......AAAAAA...........',
  ]),
  skullcap: rowsFrom([
    '........................',
    '........................',
    '.........HHHH...........',
    '........HHHHHH..........',
    '.......AHHHHHHA.........',
    '.......AAAAAAA..........',
  ]),
  wide_brim: rowsFrom([
    '........................',
    '........................',
    '....HHHHHHHHHHHHH.......',
    '.....HHHHHHHHHHH........',
    '......HHHHBHHHH.........',
    '.......AAAAAAA..........',
  ]),
  antlers: rowsFrom([
    '.....B.....B............',
    '....B.B...B.B...........',
    '.....B.HHH.B............',
    '......HHHHHHH...........',
    '.....HHHHBHHHH..........',
    '......AAAAAAA...........',
  ]),
  feathers: rowsFrom([
    '....C..H..C.............',
    '.....CHHHC..............',
    '......HHHHH.............',
    '.....HHHHHHH............',
    '....HHHHBHHHH...........',
    '.....AAAAAAA............',
  ]),
  mitre: rowsFrom([
    '..........BB............',
    '.........HHHH...........',
    '........HHHHHH..........',
    '.......HHHHHHHH.........',
    '......HHHHBHHHHH........',
    '.......AAAAAAA..........',
  ]),
  horned: rowsFrom([
    '....B..........B........',
    '.....B.HHHHHH.B.........',
    '......HHHHHHHH..........',
    '.....HHHHHHHHHH.........',
    '....HHHHHHHHHHHH........',
    '.....AAAAAAAAAA.........',
  ]),
  crystal: rowsFrom([
    '.........G.G............',
    '........BHBHB...........',
    '.......HHHHHHH..........',
    '......HHHHBHHHH.........',
    '.....AHHHHHHHHA.........',
    '......AAAAAAA...........',
  ]),
  runic: rowsFrom([
    '......B.H.B.H...........',
    '.....HBHBHBHBH..........',
    '......HHHHHHHH..........',
    '.....HHHHBHHHHH.........',
    '......AAAAAAA...........',
  ]),
  bandana: rowsFrom([
    '........................',
    '........................',
    '........................',
    '......RRRRRRRR..........',
    '.....RRHHHHHHRR.........',
    '......AAAAAAA...........',
  ]),
  veil: rowsFrom([
    '........................',
    '.........AAAA...........',
    '........AHHHHA..........',
    '.......AHHHHHHA.........',
    '......AHHHHHHHHA........',
    '.......AAAAAAA..........',
  ]),
};

// ── Cajados ─────────────────────────────────────────────────────────────────

const STAFFS = {
  orb: rowsFrom([
    '....................G...',
    '...................WWW..',
    '....................T...',
    '....................T...',
    '....................T...',
    '....................T...',
    '....................T...',
    '....................T...',
    '....................T...',
    '....................D...',
  ]),
  crystal: rowsFrom([
    '...................W....',
    '..................WT....',
    '...................T....',
    '...................T....',
    '...................T....',
    '..................T.....',
    '..................T.....',
    '..................TG....',
    '...................G....',
  ]),
  scepter: rowsFrom([
    '...................B....',
    '..................BWB...',
    '...................T....',
    '..................BTB...',
    '...................T....',
    '...................T....',
    '..................BTB...',
    '...................T....',
    '...................D....',
  ]),
  spear: rowsFrom([
    '..................B.....',
    '.................BBB....',
    '..................W.....',
    '..................T.....',
    '..................T.....',
    '.................BTB....',
    '..................T.....',
    '..................T.....',
    '..................T.....',
    '..................D.....',
  ]),
  moon: rowsFrom([
    '..................G.....',
    '.................W.W....',
    '..................W.....',
    '..................T.....',
    '.................GTG....',
    '..................T.....',
    '..................T.....',
    '.................BTB....',
    '..................T.....',
    '..................D.....',
  ]),
  scythe: rowsFrom([
    '.................WBW....',
    '.................BDB....',
    '..................B.....',
    '..................T.....',
    '..................T.....',
    '.................WT.....',
    '................W.T.....',
    '..................T.....',
    '..................D.....',
    '.................DT.....',
    '..................D.....',
  ]),
  flame: rowsFrom([
    '..................G.....',
    '.................WGW....',
    '..................W.....',
    '..................B.....',
    '..................T.....',
    '..................T.....',
    '..................T.....',
    '..................T.....',
    '..................D.....',
  ]),
  ice: rowsFrom([
    '.................GOG....',
    '..................G.....',
    '.................WTW....',
    '..................T.....',
    '..................T.....',
    '..................T.....',
    '..................T.....',
    '..................D.....',
  ]),
  book: rowsFrom([
    '.................BBB....',
    '.................BWB....',
    '.................BBB....',
    '..................T.....',
    '..................T.....',
    '..................T.....',
    '..................D.....',
  ]),
  totem: rowsFrom([
    '.................BGB....',
    '..................B.....',
    '.................BTB....',
    '..................T.....',
    '.................BTB....',
    '..................T.....',
    '..................T.....',
    '..................D.....',
  ]),
  bone: rowsFrom([
    '.................WOW....',
    '..................O.....',
    '..................T.....',
    '.................DTD....',
    '..................T.....',
    '..................T.....',
    '..................D.....',
  ]),
  lightning: rowsFrom([
    '..................G.....',
    '.................W.G....',
    '..................W.....',
    '.................G.T....',
    '..................T.....',
    '..................T.....',
    '..................T.....',
    '..................D.....',
  ]),
  nature: rowsFrom([
    '.................CGC....',
    '..................C.....',
    '.................WTW....',
    '..................T.....',
    '.................CTC....',
    '..................T.....',
    '..................T.....',
    '..................D.....',
  ]),
  void: rowsFrom([
    '.................BDB....',
    '..................B.....',
    '.................WBW....',
    '..................T.....',
    '..................T.....',
    '.................DTD....',
    '..................T.....',
    '..................D.....',
  ]),
  holy: rowsFrom([
    '..................G.....',
    '.................BGB....',
    '..................B.....',
    '..................T.....',
    '.................BTB....',
    '..................T.....',
    '..................T.....',
    '..................D.....',
  ]),
};

/** Alinha overlay verticalmente a partir de `y0`. */
function placeAt(overlay, y0, x0 = 0) {
  const out = blank();
  for (let y = 0; y < overlay.length; y++) {
    const ty = y0 + y;
    if (ty < 0 || ty >= SIZE) continue;
    const src = overlay[y];
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const sx = x - x0;
      const ch = sx >= 0 && sx < src.length ? src[sx] : '.';
      row += ch !== '.' ? ch : '.';
    }
    out[ty] = row;
  }
  return out;
}

function composeFrames(hatId, staffId, bodyId = 'robe') {
  const body = BODIES[bodyId] || BODIES.robe;
  const hat = HATS[hatId] || HATS.none;
  const staff = STAFFS[staffId] || STAFFS.orb;

  // Chapéu nas linhas 1–6; cajado à direita a partir da linha do ombro
  const hatLayer = placeAt(hat, 1, 0);
  const staffLayer = placeAt(staff, bodyId === 'hood' ? 5 : 6, 0);

  const build = (bodyRows) => stamp(stamp(bodyRows, hatLayer), staffLayer);
  return {
    idle: build(body.idle),
    walkL: build(body.walkL),
    walkR: build(body.walkR),
  };
}

/**
 * 25 classes de mago — nomes de D&D, WoW, Tibia ou Ragnarok.
 * `source` é só metadado de UI.
 */
const SKIN_DEFS = [
  { id: 'magician', name: 'Magician', source: 'Ragnarok', hat: 'pointed', staff: 'orb', body: 'robe' },
  { id: 'wizard', name: 'Wizard', source: 'D&D', hat: 'tall', staff: 'crystal', body: 'robe' },
  { id: 'sorcerer', name: 'Sorcerer', source: 'D&D', hat: 'circlet', staff: 'flame', body: 'robe' },
  { id: 'warlock', name: 'Warlock', source: 'WoW', hat: 'horned', staff: 'void', body: 'hood' },
  { id: 'necromancer', name: 'Necromancer', source: 'Tibia', hat: 'none', staff: 'scythe', body: 'hood' },
  { id: 'druid', name: 'Druid', source: 'D&D', hat: 'antlers', staff: 'nature', body: 'robe' },
  { id: 'shaman', name: 'Shaman', source: 'WoW', hat: 'feathers', staff: 'totem', body: 'robe' },
  { id: 'priest', name: 'Priest', source: 'WoW', hat: 'mitre', staff: 'holy', body: 'robe' },
  { id: 'illusionist', name: 'Illusionist', source: 'D&D', hat: 'veil', staff: 'moon', body: 'robe' },
  { id: 'evoker', name: 'Evoker', source: 'WoW', hat: 'crystal', staff: 'lightning', body: 'robe' },
  { id: 'conjurer', name: 'Conjurer', source: 'D&D', hat: 'wide_brim', staff: 'crystal', body: 'robe' },
  { id: 'enchanter', name: 'Enchanter', source: 'D&D', hat: 'circlet', staff: 'orb', body: 'robe' },
  { id: 'archmage', name: 'Archmage', source: 'D&D', hat: 'crystal', staff: 'scepter', body: 'robe' },
  { id: 'pyromancer', name: 'Pyromancer', source: 'Fantasy', hat: 'pointed', staff: 'flame', body: 'robe' },
  { id: 'cryomancer', name: 'Cryomancer', source: 'Fantasy', hat: 'none', staff: 'ice', body: 'hood' },
  { id: 'geomancer', name: 'Geomancer', source: 'Ragnarok', hat: 'skullcap', staff: 'totem', body: 'robe' },
  { id: 'high_wizard', name: 'High Wizard', source: 'Ragnarok', hat: 'tall', staff: 'scepter', body: 'robe' },
  { id: 'sage', name: 'Sage', source: 'Ragnarok', hat: 'wide_brim', staff: 'book', body: 'robe' },
  { id: 'runemaster', name: 'Runemaster', source: 'Tibia', hat: 'runic', staff: 'crystal', body: 'robe' },
  { id: 'elementalist', name: 'Elementalist', source: 'Fantasy', hat: 'circlet', staff: 'lightning', body: 'robe' },
  { id: 'mystic', name: 'Mystic', source: 'Fantasy', hat: 'hood_top', staff: 'moon', body: 'hood' },
  { id: 'shadow_priest', name: 'Shadow Priest', source: 'WoW', hat: 'none', staff: 'void', body: 'hood' },
  { id: 'battlemage', name: 'Battle Mage', source: 'Tibia', hat: 'bandana', staff: 'spear', body: 'armor' },
  { id: 'witch', name: 'Witch', source: 'Fantasy', hat: 'wide_brim', staff: 'nature', body: 'robe' },
  { id: 'chronomancer', name: 'Chronomancer', source: 'Fantasy', hat: 'crystal', staff: 'orb', body: 'robe' },
];

/** IDs antigos → nova classe (compatibilidade com personagens salvos). */
const SKIN_ALIASES = {
  classic: 'magician',
  hooded: 'enchanter',
  crowned: 'archmage',
  battle: 'battlemage',
  shadow: 'shadow_priest',
};

export const WIZARD_SKINS = SKIN_DEFS.map((def) => {
  const frames = composeFrames(def.hat, def.staff, def.body);
  return {
    id: def.id,
    name: def.name,
    source: def.source,
    idle: frames.idle,
    walkL: frames.walkL,
    walkR: frames.walkR,
  };
});

export const DEFAULT_SKIN = 'magician';
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
  let id = String(skinId || DEFAULT_SKIN);
  if (SKIN_ALIASES[id]) id = SKIN_ALIASES[id];
  return WIZARD_SKIN_IDS.includes(id) ? id : DEFAULT_SKIN;
}

export function getSkin(skinId) {
  const id = normalizeSkinId(skinId);
  return WIZARD_SKINS.find((s) => s.id === id) || WIZARD_SKINS[0];
}

export function colorTextureKey(color, skinId = DEFAULT_SKIN) {
  const skin = normalizeSkinId(skinId);
  const hex = (color >>> 0).toString(16).padStart(6, '0');
  // v4: classes de mago compostas — invalida cache antigo
  return `wizard_s4_${skin}_${hex}`;
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
