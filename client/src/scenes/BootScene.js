import Phaser from 'phaser';
import { ensureCharacter } from '../character.js';
import { getRoute, goToRoute } from '../router.js';

/** Draw a pixel-art texture from a char grid + palette. `.` = transparent. */
function makePixelTexture(scene, key, rows, palette, scale = 2) {
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

/** Copy grid into a mutable char matrix. */
function gridToMatrix(rows) {
  return rows.map((r) => r.split(''));
}

function matrixToGrid(matrix) {
  return matrix.map((row) => row.join(''));
}

function blankMatrix(h, w) {
  return Array.from({ length: h }, () => Array(w).fill('.'));
}

function findContentBounds(src) {
  const h = src.length;
  const w = src[0].length;
  let first = h;
  let last = 0;
  for (let y = 0; y < h; y++) {
    if (src[y].some((c) => c !== '.')) {
      if (y < first) first = y;
      last = y;
    }
  }
  if (first > last) return { first: 0, last: h - 1, mid: Math.floor(w / 2) };
  return { first, last, mid: Math.floor(w / 2) };
}

/**
 * Offset lower-body + arm pixels to fake a walk / limb cycle.
 * side: -1 left, +1 right. intensity: 1 = normal, 2 = extended stride.
 * bounce: vertical body bob for more readable motion.
 */
function makeWalkPose(rows, side, intensity = 1, bounce = 0) {
  const src = gridToMatrix(rows);
  const h = src.length;
  const w = src[0].length;
  const dst = blankMatrix(h, w);
  const { first, last, mid } = findContentBounds(src);
  const legFrom = Math.max(0, last - 4);
  const armFrom = first + Math.floor((last - first) * 0.32);
  const armTo = Math.max(armFrom, legFrom - 1);
  const step = intensity >= 2 ? 2 : 1;
  const bob = bounce;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = src[y][x];
      if (ch === '.') continue;
      let nx = x;
      let ny = y + bob;
      const left = x < mid;
      if (y >= legFrom) {
        if (side < 0) {
          nx = x + (left ? -step : step);
          ny = y + bob + (left ? 1 : -1);
        } else {
          nx = x + (left ? step : -step);
          ny = y + bob + (left ? -1 : 1);
        }
      } else if (y >= armFrom && y <= armTo) {
        // Braços em contrafase das pernas (mais amplitude)
        if (side < 0) {
          nx = x + (left ? step : -step);
          ny = y + bob + (left ? -1 : 0);
        } else {
          nx = x + (left ? -step : step);
          ny = y + bob + (left ? 0 : -1);
        }
        // ponta da arma / asa externa se estende
        if (!left && intensity >= 2) nx += 1;
      } else if (y <= first + 2) {
        // Cabeça balança + leve bob
        nx = x + (side < 0 ? -1 : 1);
        ny = y + bob;
      } else if (y < armFrom) {
        // tronco segue o bob
        ny = y + bob;
      }
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && dst[ny][nx] === '.') {
        dst[ny][nx] = ch;
      } else if (y >= 0 && y < h && dst[y][x] === '.') {
        dst[y][x] = ch;
      }
    }
  }
  return matrixToGrid(dst);
}

/** Respiração: sobe o tronco, alarga o peito e agita asas/topo. */
function makeIdlePose(rows, phase = 1) {
  const src = gridToMatrix(rows);
  const h = src.length;
  const w = src[0].length;
  const dst = blankMatrix(h, w);
  const { first, last, mid } = findContentBounds(src);
  const chestTo = first + Math.floor((last - first) * 0.55);
  const wingBand = first + 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = src[y][x];
      if (ch === '.') continue;
      let nx = x;
      let ny = y;
      if (phase === 1) {
        if (y >= first && y <= chestTo) {
          ny = y - 1;
          if (x === mid || x === mid - 1 || x === mid + 1) {
            nx = x + (x < mid ? -1 : x > mid ? 1 : 0);
          }
        }
        // asas / ombros laterais sobem um pouco
        if (y <= wingBand && (x <= mid - 3 || x >= mid + 3)) {
          ny = Math.max(0, y - 1);
          nx = x + (x < mid ? -1 : 1);
        }
      } else if (phase === 2) {
        // exalar: tronco desce leve, laterais recolhem
        if (y >= first && y <= chestTo) {
          ny = Math.min(h - 1, y + 1);
          if (x === mid - 2 || x === mid + 2) {
            nx = x + (x < mid ? 1 : -1);
          }
        }
      }
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && dst[ny][nx] === '.') {
        dst[ny][nx] = ch;
      } else if (y >= 0 && y < h && dst[y][x] === '.') {
        dst[y][x] = ch;
      }
    }
  }
  return matrixToGrid(dst);
}

/** Avanço / windup de ataque — lunge + elevação do braço/arma. */
function makeAttackPose(rows) {
  const src = gridToMatrix(rows);
  const h = src.length;
  const w = src[0].length;
  const dst = blankMatrix(h, w);
  const { first, last, mid } = findContentBounds(src);
  const armFrom = first + Math.floor((last - first) * 0.28);
  const armTo = first + Math.floor((last - first) * 0.72);
  const legFrom = Math.max(0, last - 3);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = src[y][x];
      if (ch === '.') continue;
      let nx = x + 1;
      let ny = y;
      if (y >= armFrom && y <= armTo && x >= mid) {
        nx = x + 3;
        ny = y - 1;
      } else if (y < first + 3) {
        nx = x + 2;
        ny = y - 1;
      } else if (y >= legFrom) {
        // perna traseira ancora, dianteira avança
        nx = x + (x >= mid ? 2 : 0);
        ny = y + (x < mid ? 1 : 0);
      } else {
        nx = x + 1;
      }
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && dst[ny][nx] === '.') {
        dst[ny][nx] = ch;
      } else if (dst[y][Math.min(w - 1, x + 1)] === '.') {
        dst[y][Math.min(w - 1, x + 1)] = ch;
      } else if (dst[y][x] === '.') {
        dst[y][x] = ch;
      }
    }
  }
  return matrixToGrid(dst);
}

/** Recuo ao tomar dano — comprime, puxa para trás e achata. */
function makeHurtPose(rows) {
  const src = gridToMatrix(rows);
  const h = src.length;
  const w = src[0].length;
  const dst = blankMatrix(h, w);
  const { first, last, mid } = findContentBounds(src);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = src[y][x];
      if (ch === '.') continue;
      let nx = x - 1;
      let ny = y;
      if (y >= first && y <= last) {
        ny = Math.min(h - 1, y + 1);
        // squash horizontal leve no tronco
        if (y < last - 1) {
          nx = x - 1 + (x < mid ? 0 : x > mid ? 0 : 0);
          if (x === mid - 1) nx = x;
          if (x === mid + 1) nx = x;
        }
      }
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && dst[ny][nx] === '.') {
        dst[ny][nx] = ch;
      } else if (dst[y][x] === '.') {
        dst[y][x] = ch;
      }
    }
  }
  return matrixToGrid(dst);
}

/** Idle + walk + attack + hurt frames e animações Phaser para um tipo de monstro. */
function registerMonsterSprite(scene, type, idle, palette) {
  const base = `monster_${type}`;
  const idleBreath = makeIdlePose(idle, 1);
  const idleExhale = makeIdlePose(idle, 2);
  const walkL = makeWalkPose(idle, -1, 1, 0);
  const walkR = makeWalkPose(idle, 1, 1, 0);
  const walkL2 = makeWalkPose(idleBreath, -1, 2, -1);
  const walkR2 = makeWalkPose(idleBreath, 1, 2, -1);
  const attack = makeAttackPose(idle);
  const hurt = makeHurtPose(idle);

  makePixelTexture(scene, base, idle, palette);
  makePixelTexture(scene, `${base}_i2`, idleBreath, palette);
  makePixelTexture(scene, `${base}_i3`, idleExhale, palette);
  makePixelTexture(scene, `${base}_wL`, walkL, palette);
  makePixelTexture(scene, `${base}_wR`, walkR, palette);
  makePixelTexture(scene, `${base}_wL2`, walkL2, palette);
  makePixelTexture(scene, `${base}_wR2`, walkR2, palette);
  makePixelTexture(scene, `${base}_atk`, attack, palette);
  makePixelTexture(scene, `${base}_hurt`, hurt, palette);

  const walkKey = `${base}_walk`;
  if (!scene.anims.exists(walkKey)) {
    scene.anims.create({
      key: walkKey,
      frames: [
        { key: base },
        { key: `${base}_wL` },
        { key: `${base}_wL2` },
        { key: `${base}_i2` },
        { key: `${base}_wR` },
        { key: `${base}_wR2` },
      ],
      frameRate: 12,
      repeat: -1,
    });
  }

  const idleKey = `${base}_idle`;
  if (!scene.anims.exists(idleKey)) {
    scene.anims.create({
      key: idleKey,
      frames: [
        { key: base },
        { key: `${base}_i2` },
        { key: base },
        { key: `${base}_i3` },
      ],
      frameRate: 4,
      repeat: -1,
    });
  }

  const attackKey = `${base}_attack`;
  if (!scene.anims.exists(attackKey)) {
    scene.anims.create({
      key: attackKey,
      frames: [
        { key: `${base}_i2` },
        { key: `${base}_atk` },
        { key: `${base}_atk` },
        { key: `${base}_wR` },
        { key: base },
      ],
      frameRate: 14,
      repeat: 0,
    });
  }

  const hurtKey = `${base}_hurt`;
  if (!scene.anims.exists(hurtKey)) {
    scene.anims.create({
      key: hurtKey,
      frames: [
        { key: `${base}_hurt` },
        { key: `${base}_hurt` },
        { key: `${base}_i3` },
        { key: base },
      ],
      frameRate: 16,
      repeat: 0,
    });
  }
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('lava_tile', '/assets/lava.png');
    this.load.audio('player_death', '/assets/death-bong.mp3');
    this.load.audio('round_end', '/assets/death-bong.mp3');
    this.load.audio('round_start', '/assets/death-bong.mp3');
    this.load.audio('player_hurt', '/assets/soco_8rPimgT.mp3');
    this.load.audio('kiko_laugh', '/assets/a-risada-do-kiko.mp3');
    this.load.audio('madruga_nossa', '/assets/seu-madruga-nossa.mp3');
    this.load.audio('lobby_music_a', '/assets/tavern-festival.mp3');
    this.load.audio('lobby_music_b', '/assets/tavern-festival-1.mp3');
    // this.load.audio('battle_music', '/assets/pao-queijo-escuridao.mp3');
    this.load.audio('battle_music_a', '/assets/Gaita da Batalha.mp3');
    this.load.audio('battle_music_b', '/assets/Marcha dos Orcs.mp3');
    this.load.audio('boss_music', '/assets/Trono Despedaçado.mp3');
  }

  create() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Player body
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 14);
    g.lineStyle(3, 0x111111, 0.35);
    g.strokeCircle(16, 16, 14);
    g.generateTexture('wizard', 32, 32);

    // Fallback / legacy monster key
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(14, 14, 12);
    g.fillStyle(0x222222, 1);
    g.fillCircle(10, 11, 2);
    g.fillCircle(18, 11, 2);
    g.generateTexture('monster', 28, 28);

    // Projectile
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('orb', 12, 12);

    // Particle
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture('particle', 6, 6);

    g.destroy();

    this.createWizardSprites();
    this.createMonsterSprites();
    this.createProjectileSprites();
    this.createManaPotionSprite();
    this.createArenaDirtTexture();
    this.createArenaGrassTexture();
    this.createArenaIceTexture();
    this.createArenaWoodTexture();
    this.createArenaSeaTexture();
    this.createArenaDesertTexture();
    this.createArenaSwampTexture();
    this.createArenaVolcanoTexture();
    this.createArenaRuinsTexture();
    this.createArenaCrystalTexture();
    this.createExpandedArenaFloors();
    this.createIronBlockTexture();
    this.createLavaTextures();
    this.createRockSprites();
    this.createFurnitureSprites();
    this.createShellSprites();
    this.createCactusSprites();
    this.createPuddleSprites();
    this.createVolcanoSprites();
    this.createRuinsSprites();
    this.createCrystalSprites();
    this.createTreeSprites();
    this.createBloodSprites();
    this.createBonesSprites();
    this.createLootBagSprite();
    this.createCoinSprite();
    this.createSpellIcons();
    ensureCharacter();
    goToRoute(this.game, getRoute());
  }

  createProjectileSprites() {
    // Arrow pointing right (rotated toward velocity on render)
    makePixelTexture(
      this,
      'proj_arrow',
      [
        '............',
        '............',
        '.........T..',
        '........TT..',
        '..WWWWWWTTT.',
        '.WMMMMMMTTT.',
        '..WWWWWWTTT.',
        '........TT..',
        '.........T..',
        '............',
        '............',
        '............',
      ],
      {
        W: 0xe8dcc0,
        M: 0xb8956a,
        T: 0x8a8a92,
      },
      2
    );

    // Fireball — núcleo quente + língua de fogo (apontando para cima; rotacionada no render)
    makePixelTexture(
      this,
      'proj_fireball',
      [
        '................',
        '......YYYY......',
        '....YYWWWWYY....',
        '...YWWWWWWWWY...',
        '...YWWWWWWWWY...',
        '....YYWWWWYY....',
        '.....OYYYYO.....',
        '.....OOYYOO.....',
        '......ORRO......',
        '......ORRO......',
        '.......RR.......',
        '.......RR.......',
        '.......R........',
        '........R.......',
        '................',
        '................',
      ],
      {
        W: 0xfff6c8,
        Y: 0xffd84a,
        O: 0xff8a12,
        R: 0xff3b00,
      },
      2
    );

    // Ice shard — cristal pontiagudo (apontando para cima; rotacionado no render)
    makePixelTexture(
      this,
      'proj_ice_shard',
      [
        '................',
        '.......WW.......',
        '......WCCW......',
        '.....WCCCCW.....',
        '....WCCBBCCW....',
        '...WCBBBBBCW....',
        '...WCBBBBBBCW...',
        '...WCBBWWBBCW...',
        '....WCBBBCW.....',
        '....WCBBCW......',
        '.....WCCW.......',
        '......WCW.......',
        '.......W........',
        '................',
        '................',
        '................',
      ],
      {
        W: 0xe8f7ff,
        C: 0x8ad8ff,
        B: 0x3a9fd4,
      },
      2
    );

    // Skull bolt — caveira com raios negros
    makePixelTexture(
      this,
      'proj_skull_bolt',
      [
        '................',
        '..L..........L..',
        '...L...WW...L...',
        '....L.WBBW.L....',
        '.....WBEBEW.....',
        '.....WBBBBW.....',
        '......WBBW......',
        '.....WWTTWW.....',
        '......WTTW......',
        '....L..WW..L....',
        '...L........L...',
        '..L..........L..',
        '.L............L.',
        '................',
        '................',
        '................',
      ],
      {
        W: 0xe8e0d0,
        B: 0x2a2430,
        E: 0x7b2cff,
        T: 0xc8b8a0,
        L: 0x120018,
      },
      2
    );
  }

  createSpellIcons() {
    // 16×16 pixel icons — key = spell_<id>
    const icons = {
      firebolt: {
        rows: [
          '................',
          '..........YY....',
          '.........YOOY...',
          '........YORROY..',
          '.......YORRRROY.',
          '......YORRDRROY.',
          '.....YORRDDDROY.',
          '....YORRDDDDROY.',
          '...YORRRDDDRROY.',
          '..YYORRRRRRROY..',
          '.YOOORRRRRROY...',
          'YOOOOOOOOOY.....',
          '.YYOOOOOYY......',
          '...YYYYY........',
          '................',
          '................',
        ],
        palette: { Y: 0xffe066, O: 0xff8844, R: 0xff4422, D: 0xaa2200 },
      },
      ice_shard: {
        rows: [
          '................',
          '.......CC.......',
          '......CWCC......',
          '.....CWWWC......',
          '....CWWWWWC.....',
          '...CCWWBWWCC....',
          '..CWWWWWWWWC....',
          '.CWWWCWCWWWC....',
          '..CWWWWWWWC.....',
          '...CCWWWCC......',
          '....CWWWC.......',
          '.....CWC........',
          '......C.........',
          '................',
          '................',
          '................',
        ],
        palette: { C: 0x3a8ecc, W: 0xaaddff, B: 0xffffff },
      },
      arc_lightning: {
        rows: [
          '................',
          '.......YY.......',
          '......YLLY......',
          '.....YLLY.......',
          '....YLLY........',
          '...YLLLLYY......',
          '....YYLLLY......',
          '.....YLLY.......',
          '....YLLY........',
          '...YLLLLY.......',
          '....YYLY........',
          '.....YLY........',
          '......YY........',
          '................',
          '................',
          '................',
        ],
        palette: { Y: 0x66bbff, L: 0xffffff },
      },
      flame_nova: {
        rows: [
          '................',
          '....OOYOO.......',
          '..OORRRRROO.....',
          '.ORRYYYYRRRO....',
          '.ORY......YRO...',
          'ORY........YRO..',
          'ORY...DD...YRO..',
          'ORY...DD...YRO..',
          '.ORY......YRO...',
          '.ORRYYYYRRRO....',
          '..OORRRRROO.....',
          '....OOYOO.......',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { O: 0xff6622, R: 0xff4422, Y: 0xffcc44, D: 0xaa2200 },
      },
      firebreath: {
        rows: [
          '................',
          'Y...............',
          'OY..............',
          'ROY.............',
          'RROY..Y.........',
          'RRROY.YOY.......',
          'RRRROYOOROY.....',
          'RRRRROOORROY....',
          'RRRROYOOROY.....',
          'RRROY.YOY.......',
          'RROY..Y.........',
          'ROY.............',
          'OY..............',
          'Y...............',
          '................',
          '................',
        ],
        palette: { Y: 0xffe066, O: 0xff8844, R: 0xff4422 },
      },
      mend: {
        rows: [
          '................',
          '......GGGG......',
          '......GLLG......',
          '......GLLG......',
          '..GGGGGLLGGGGG..',
          '..GLLLLLLLLLLG..',
          '..GLLWWWWWWLLG..',
          '..GLLWWWWWWLLG..',
          '..GLLLLLLLLLLG..',
          '..GGGGGLLGGGGG..',
          '......GLLG......',
          '......GLLG......',
          '......GGGG......',
          '................',
          '................',
          '................',
        ],
        palette: { G: 0x1e8449, L: 0x55ff88, W: 0xd5f5e3 },
      },
      poison_cloud: {
        rows: [
          '................',
          '....GG..GGG.....',
          '...GLLGGLLLG....',
          '..GLWWLLLLWWLG..',
          '.GLWLLLLLLLLWLG.',
          '.GLLLLPPPLLLLG..',
          '..GLLPPPPPLLG...',
          '..GLLLPPPLLLG...',
          '...GGLLLLLGG....',
          '....GG.G.GG.....',
          '.....G...G......',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { G: 0x3d7a1f, L: 0x88ff44, W: 0xc8ffa0, P: 0x5a2a6a },
      },
      blink: {
        rows: [
          '................',
          '......PP........',
          '.....PWWP.......',
          '....PWLLWP......',
          '...PWLLLLWP.....',
          '..PWLL..LLWP....',
          '.PWLL....LLWP...',
          '..PWLL..LLWP....',
          '...PWLLLLWP.....',
          '....PWLLWP......',
          '.....PWWP.......',
          '......PP........',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { P: 0x6b3fa0, W: 0xddbbff, L: 0xaa88ff },
      },
      barrier: {
        rows: [
          '................',
          '....BBBBBBB.....',
          '...BLLLLLLLB....',
          '..BLWWWWWLLB....',
          '..BLWBBBWWLB....',
          '..BLWBLBWWLB....',
          '..BLWBBBWWLB....',
          '..BLWWWWWLLB....',
          '..BLLLLLLLLB....',
          '...BLLLLLLB.....',
          '....BLLLLB......',
          '.....BLB........',
          '......B.........',
          '................',
          '................',
          '................',
        ],
        palette: { B: 0x3a5a9a, L: 0x88aaff, W: 0xddeeff },
      },
      skull_bolt: {
        rows: [
          '................',
          '..N..........N..',
          '...N..WWWW..N...',
          '....N.WBBW.N....',
          '.....WBEBEW.....',
          '.....WBBBBW.....',
          '......WBBW......',
          '.....WWTTWW.....',
          '......WTTW......',
          '....N..WW..N....',
          '...N........N...',
          '..N..........N..',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { W: 0xe8e0d0, B: 0x2a2430, E: 0x9b4dff, T: 0xc8b8a0, N: 0x1a001a },
      },
      apocalypse: {
        rows: [
          '................',
          '........YY......',
          '.......YOOY.....',
          '......YORROY....',
          '.....YORRRROY...',
          '....YORRDDROY...',
          '...YYORRRRROY...',
          '..YOOORRRROY....',
          '.YMMMMMMMMY.....',
          'YMMMMMMMMMMY....',
          '.YMMDDDDMMY.....',
          '..YMMMMMMY......',
          '...YYYYYY.......',
          '................',
          '................',
          '................',
        ],
        palette: { Y: 0xffee66, O: 0xff6622, R: 0xff2200, D: 0x881100, M: 0x5a3a2a },
      },
      time_freeze: {
        rows: [
          '................',
          '.....CCCCC......',
          '....CWWWWWC.....',
          '...CWBBBBBCW....',
          '..CWBWWWWWBWC...',
          '..CWBWYYYWWBC...',
          '..CWBWYYYWWBC...',
          '..CWBWWYWWWBC...',
          '..CWBWWWWWWBC...',
          '...CWBBBBBCW....',
          '....CWWWWWC.....',
          '.....CCCCC......',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { C: 0x4a8aaa, W: 0xaaddff, B: 0x2a4a66, Y: 0xffffff },
      },
      storm_call: {
        rows: [
          '................',
          '..YY....YY..YY..',
          '.YLLY..YLLYYLLY.',
          '.YLLY..YLLYYLLY.',
          '..YLY...YLY.YLY.',
          '..YLYY..YLY.YLY.',
          '.YLLLY.YLLY.YLY.',
          '.YLLY..YLY..YLY.',
          '..YLY...YY...YY.',
          '..YY....Y.......',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { Y: 0xffdd33, L: 0xffffff },
      },
      electric_bolt: {
        rows: [
          '................',
          '.......WW.......',
          '......WLLW......',
          '.....WLLYW......',
          '....WLLY........',
          '...WLLYYWW......',
          '....WWLLLYW.....',
          '.....WLLYW......',
          '....WLLY........',
          '...WLLLLW.......',
          '....WWLYW.......',
          '.....WLY........',
          '......WW........',
          '................',
          '................',
          '................',
        ],
        palette: { W: 0x7cf0ff, L: 0xffffff, Y: 0xb388ff },
      },
      electric_storm: {
        rows: [
          '................',
          '..CC.CCC.CC.CC..',
          '.CYYCCCYYYCCYC..',
          '.CYCCCCYCCCCYC..',
          '..C..W.C..W.C...',
          '.....W....W.....',
          '....WLW..WLW....',
          '...WLLW.WLLW....',
          '....WLW..W.W....',
          '.....W....W.....',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { C: 0x3a4a6a, Y: 0x556688, W: 0x7cf0ff, L: 0xffffff },
      },
      dash: {
        rows: [
          '................',
          '................',
          '....WW..........',
          '...WYYW.........',
          '..WYYYYW........',
          '.WYYYYYYWWWWWWW.',
          'WYYYYYYYYYYYYYYW',
          '.WYYYYYYWWWWWWW.',
          '..WYYYYW........',
          '...WYYW.........',
          '....WW..........',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { W: 0xf5f0e0, Y: 0xd4c48a },
      },
      skull_wave: {
        rows: [
          '................',
          '.N....WWWW....N.',
          '..N..WBBBBW..N..',
          '...N.WBEBEW.N...',
          '....NWBBBBWN....',
          '.....WWTTWW.....',
          '....N.WTTW.N....',
          '...N...WW...N...',
          '..N..........N..',
          '.N....N..N....N.',
          '......N..N......',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { W: 0xe8e0d0, B: 0x2a2430, E: 0x9b4dff, T: 0xc8b8a0, N: 0x4a0080 },
      },
      soul_rend: {
        rows: [
          '................',
          '......PP........',
          '.....PWWP.......',
          '....PWLLWP......',
          '...PWL..LWP.....',
          '..PWL.RR.LWP....',
          '.PWL.RRRR.LWP...',
          '..PWL.RR.LWP....',
          '...PWL..LWP.....',
          '....PWLLWP......',
          '.....PWWP.......',
          '......PP........',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { P: 0x4a235a, W: 0xd7bde2, L: 0x8e44ad, R: 0xc0392b },
      },
      void_collapse: {
        rows: [
          '................',
          '......VV........',
          '....VVVVVV......',
          '...VWWWWWWV.....',
          '..VWBBBBBBWV....',
          '.VWBB....BBWV...',
          '.VWB..KK..BWV...',
          '.VWBB....BBWV...',
          '..VWBBBBBBWV....',
          '...VWWWWWWV.....',
          '....VVVVVV......',
          '......VV........',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { V: 0x1a0033, W: 0x5b2c6f, B: 0x2e1a47, K: 0xffffff },
      },
      death_knell: {
        rows: [
          '................',
          '.......YY.......',
          '......YYYY......',
          '.......YY.......',
          '......NNNN......',
          '.....NWWWWN.....',
          '....NWWWWWWN....',
          '...NWWBBBBWWN...',
          '...NWWBBBBWWN...',
          '....NWWWWWWN....',
          '.....NWWWWN.....',
          '......NNNN......',
          '.......NN.......',
          '................',
          '................',
          '................',
        ],
        palette: { Y: 0xf7dc6f, N: 0x2a0044, W: 0x7d3c98, B: 0x1a001a },
      },
      cataclysm_beam: {
        rows: [
          '................',
          '.......YY.......',
          '......YYYY......',
          '.....YYLLYY.....',
          '....YYLLLLYY....',
          '...YYLLLLLLYY...',
          '..YYLLYYYYLLYY..',
          '.YYLLY....YLLYY.',
          '..YYLLYYYYLLYY..',
          '...YYLLLLLLYY...',
          '....YYLLLLYY....',
          '.....YYLLYY.....',
          '......YYYY......',
          '.......YY.......',
          '................',
          '................',
        ],
        palette: { Y: 0xf4d03f, L: 0xfff8dc },
      },
      blood_pact: {
        rows: [
          '................',
          '......RR........',
          '.....RRRR.......',
          '....RRWWRR......',
          '...RRWWWWRR.....',
          '..RRWWDDWWRR....',
          '..RRWDDDDWRR....',
          '...RRWDDWRR.....',
          '....RRWWRR......',
          '.....RRRR.......',
          '......RR........',
          '......DD........',
          '.....DDDD.......',
          '................',
          '................',
          '................',
        ],
        palette: { R: 0xc0392b, W: 0xf5b7b1, D: 0x641e16 },
      },
      abyss_nova: {
        rows: [
          '................',
          '....NN..NN......',
          '..NNPPPPPPNN....',
          '.NPPWWWWWWPPN...',
          '.NPW......WPN...',
          'NPW...KK...WPN..',
          'NPW...KK...WPN..',
          '.NPW......WPN...',
          '.NPPWWWWWWPPN...',
          '..NNPPPPPPNN....',
          '....NN..NN......',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { N: 0x1a0033, P: 0x4a0080, W: 0x7d3c98, K: 0xd7bde2 },
      },
      frost_apocalypse: {
        rows: [
          '................',
          '........CC......',
          '.......CWWC.....',
          '......CWBBC.....',
          '.....CWBBBBC....',
          '....CWBWWWBBC...',
          '...CCWBWWWWBCC..',
          '..CIIIIIIIIIC...',
          '.CIIIIIIIIIIIC..',
          '..CIIBBBBIIIC...',
          '...CIIIIIIIC....',
          '....CCCCCC......',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { C: 0x5dade2, W: 0xd6eaf8, B: 0x2874a6, I: 0x85c1e9 },
      },
      plague_burst: {
        rows: [
          '................',
          '....GG..GGG.....',
          '...GLLGGLLLG....',
          '..GLWWLLLLWWLG..',
          '.GLWLLPPPLLLWLG.',
          '.GLLLPPPPPLLLG..',
          '..GLLPPPPPLLG...',
          '..GGLLPPPLGG....',
          '...G.GLLG.G.....',
          '....G..G..G.....',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { G: 0x196f3d, L: 0x58d68d, W: 0xd5f5e3, P: 0x5b2c6f },
      },
      infernal_judgment: {
        rows: [
          '................',
          '.......WW.......',
          '......WYYW......',
          '.....WYYYYW.....',
          '....WYYOOYYW....',
          '...WYYOOOOYYW...',
          '..WYYOORROOYYW..',
          '...WYYOOOOYYW...',
          '....WYYOOYYW....',
          '.....WYYYYW.....',
          '......WRRW......',
          '.....WRRRRW.....',
          '....WRRRRRRW....',
          '................',
          '................',
          '................',
        ],
        palette: { W: 0xffee88, Y: 0xffaa33, O: 0xff6622, R: 0xff2200 },
      },
      shadow_eclipse: {
        rows: [
          '................',
          '......NNNN......',
          '....NNWWWWNN....',
          '...NWWBBBBWWN...',
          '..NWBB....BBWN..',
          '.NWB..KKKK..BWN.',
          '.NWB.KKKKKK.BWN.',
          '.NWB..KKKK..BWN.',
          '..NWBB....BBWN..',
          '...NWWBBBBWWN...',
          '....NNWWWWNN....',
          '......NNNN......',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { N: 0x0d0d12, W: 0x2c2c3a, B: 0x1c1c28, K: 0x6c3483 },
      },
      acid_bolt: {
        rows: [
          '................',
          '..........GG....',
          '.........GLLG...',
          '........GLPPLG..',
          '.......GLPPPPLG.',
          '......GLPPDPPLG.',
          '.....GLPPDDDPLG.',
          '....GLPPDDDDPLG.',
          '...GLPPPADDPLG..',
          '..GGGLPPPPPLG...',
          '.GLLLPPPPPLG....',
          'GLLLLLLLLG......',
          '.GGLLLLGG.......',
          '...GGGGG........',
          '................',
          '................',
        ],
        palette: { G: 0x3d7a1f, L: 0x88ff44, P: 0x58d68d, D: 0x1e8449, A: 0xc8ffa0 },
      },
      frost_breath: {
        rows: [
          '................',
          'C...............',
          'WC..............',
          'BWC.............',
          'BBWC..C.........',
          'BBBWC.CWC.......',
          'BBBBWCWWBWC.....',
          'BBBBBWWWBBCW....',
          'BBBBWCWWBWC.....',
          'BBBWC.CWC.......',
          'BBWC..C.........',
          'BWC.............',
          'WC..............',
          'C...............',
          '................',
          '................',
        ],
        palette: { C: 0x85c1e9, W: 0xd6eaf8, B: 0x5dade2 },
      },
      bone_volley: {
        rows: [
          '................',
          '.N....WWWW....N.',
          '..N..WBBBBW..N..',
          '...N.WBEBEW.N...',
          '....NWBBBBWN....',
          '.....WWTTWW.....',
          '....N.WTTW.N....',
          '...N...WW...N...',
          '..N..........N..',
          '.N....N..N....N.',
          '......N..N......',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { W: 0xece5d0, B: 0x3a3430, E: 0xff6644, T: 0xd5d0c0, N: 0xb0a890 },
      },
      hex_bolt: {
        rows: [
          '................',
          '.......PP.......',
          '......PLLP......',
          '.....PLLYP......',
          '....PLLY........',
          '...PLLYYPP......',
          '....PPLLLYP.....',
          '.....PLLYP......',
          '....PLLY........',
          '...PLLLLP.......',
          '....PPLYP.......',
          '.....PLY........',
          '......PP........',
          '................',
          '................',
          '................',
        ],
        palette: { P: 0xaa44ff, L: 0xffffff, Y: 0xd7bde2 },
      },
      magma_surge: {
        rows: [
          '................',
          '....OOYOO.......',
          '..OORRRRROO.....',
          '.ORRYYYYRRRO....',
          '.ORY......YRO...',
          'ORY...MM...YRO..',
          'ORY...MM...YRO..',
          'ORY........YRO..',
          '.ORY......YRO...',
          '.ORRYYYYRRRO....',
          '..OORRRRROO.....',
          '....OOYOO.......',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { O: 0xff6622, R: 0xff4422, Y: 0xffcc44, M: 0xaa2200 },
      },
      soul_lance: {
        rows: [
          '................',
          '.......WW.......',
          '......WLLW......',
          '.....WLPPLW.....',
          '....WLP..PLW....',
          '...WLP....PLW...',
          '..WLP......PLW..',
          '...WLP....PLW...',
          '....WLP..PLW....',
          '.....WLPPLW.....',
          '......WLLW......',
          '.......WW.......',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { W: 0xd7bde2, L: 0xaf7ac5, P: 0x6c3483 },
      },
      entropy_pulse: {
        rows: [
          '................',
          '....VV..VV......',
          '..VVPPPPPPVV....',
          '.VPPWWWWWWPPV...',
          '.VPW......WPV...',
          'VPW...KK...WPV..',
          'VPW...KK...WPV..',
          '.VPW......WPV...',
          '.VPPWWWWWWPPV...',
          '..VVPPPPPPVV....',
          '....VV..VV......',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { V: 0x4a235a, P: 0x6c3483, W: 0x9b59b6, K: 0xffffff },
      },
      solar_judgment: {
        rows: [
          '................',
          '.......WW.......',
          '......WYYW......',
          '.....WYYYYW.....',
          '....WYYOOYYW....',
          '...WYYOOOOYYW...',
          '..WYYOORROOYYW..',
          '...WYYOOOOYYW...',
          '....WYYOOYYW....',
          '.....WYYYYW.....',
          '......WRRW......',
          '.....WRRRRW.....',
          '....WRRRRRRW....',
          '................',
          '................',
          '................',
        ],
        palette: { W: 0xfff8dc, Y: 0xf4d03f, O: 0xffaa33, R: 0xe67e22 },
      },
      crystal_bolt: {
        rows: [
          '................',
          '..........CC....',
          '.........CWLC...',
          '........CWLLLC..',
          '.......CWLPPLIC.',
          '......CWLP.PLIC.',
          '.....CWLP...PLIC',
          '....CWLP....PLIC',
          '...CWLPP...PLIC.',
          '..CCWLPPLICIC...',
          '.CWWWLLLICC.....',
          'CWWWWWWWCC......',
          '.CCWWWWCC.......',
          '...CCCCC........',
          '................',
          '................',
        ],
        palette: { C: 0x5dade2, W: 0xd6eaf8, L: 0xffffff, P: 0xaed6f1, I: 0x85c1e9 },
      },
      thorn_nova: {
        rows: [
          '................',
          '....G..G..G.....',
          '..G.GGGGGG.G....',
          '.GGGLYYYLGGG....',
          '..GLYY..YYLG.G..',
          'G.GLY....YLG.G..',
          '..GLY.TT.YLG....',
          'G.GLY....YLG.G..',
          '..GLYY..YYLG....',
          '.GGGLYYYLGGG....',
          '..G.GGGGGG.G....',
          '....G..G..G.....',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { G: 0x145a32, L: 0x27ae60, Y: 0x58d68d, T: 0xaaff44 },
      },
      rift_lance: {
        rows: [
          '................',
          '.......PP.......',
          '......PLLP......',
          '.....PLVVLP.....',
          '....PLV..VLP....',
          '...PLV....VLP...',
          '..PLV......VLP..',
          '...PLV....VLP...',
          '....PLV..VLP....',
          '.....PLVVLP.....',
          '......PWWP......',
          '.....PWWWWP.....',
          '....PWWWWWWP....',
          '................',
          '................',
          '................',
        ],
        palette: { P: 0x6c3483, L: 0x9b59b6, V: 0xd2b4de, W: 0xffffff },
      },
      tidal_crush: {
        rows: [
          '................',
          '....BB..BB......',
          '..BBWWWWWWBB....',
          '.BWWCCCCCCWWB...',
          '.BWCC....CCWB...',
          'BWC...DD...CWB..',
          'BWC...DD...CWB..',
          '.BWCC....CCWB...',
          '.BWWCCCCCCWWB...',
          '..BBWWWWWWBB....',
          '....BB..BB......',
          '......WW........',
          '.....WWWW.......',
          '................',
          '................',
          '................',
        ],
        palette: { B: 0x0e2f44, W: 0x5dade2, C: 0x2e86c1, D: 0x88eeff },
      },
    };

    for (const [id, { rows, palette }] of Object.entries(icons)) {
      // sanitize accidental spaces
      const clean = rows.map((r) => r.replace(/ /g, '.'));
      makePixelTexture(this, `spell_${id}`, clean, palette, 2);
    }

    // Cadeado para slots de habilidade bloqueados por nível
    makePixelTexture(
      this,
      'icon_lock',
      [
        '................',
        '................',
        '.....LLLL.......',
        '....L....L......',
        '....L....L......',
        '....L....L......',
        '...BBBBBBBB.....',
        '...BWWWWWWB.....',
        '...BWWKKWWB.....',
        '...BWWKKWWB.....',
        '...BWWWWWWB.....',
        '...BWWWWWWB.....',
        '...BBBBBBBB.....',
        '................',
        '................',
        '................',
      ],
      { L: 0xc9b896, B: 0xd4a017, W: 0xf1c40f, K: 0x5d4e37 },
      2
    );
  }

  createRockSprites() {
    // D=sombra, L=base, M=meio, H=highlight, C=fenda
    const grey = { D: 0x2a2a32, L: 0x555562, M: 0x7a7a88, H: 0xb0b0bc, C: 0x3a3a44 };
    const slate = { D: 0x1e2a32, L: 0x4a5c68, M: 0x6e8490, H: 0xa8bcc4, C: 0x2e3e48 };
    const basalt = { D: 0x1a1a22, L: 0x3e3e4a, M: 0x5c5c6a, H: 0x8e8e9c, C: 0x282834 };
    const granite = { D: 0x2e2828, L: 0x6a5e5a, M: 0x8e8078, H: 0xc4b4a4, C: 0x3e3634 };
    const moss = { D: 0x243028, L: 0x4a5a48, M: 0x6e7e62, H: 0xa0b088, C: 0x2e3a30 };
    const icePale = { D: 0x2a4a62, L: 0x6a9ab8, M: 0x9ec8e0, H: 0xe8f6ff, C: 0x3a6078 };
    const iceBlue = { D: 0x1e3a58, L: 0x4a7a9a, M: 0x7ab0d0, H: 0xd0ecff, C: 0x2e5070 };
    const iceDeep = { D: 0x183048, L: 0x3e6a88, M: 0x68a0c0, H: 0xc0e4f8, C: 0x284860 };

    // Pedras pequenas: seixo / lasca alongada / ponta
    makePixelTexture(
      this,
      'rock_stone_0',
      [
        '..........',
        '...DDD....',
        '..DLHMD...',
        '.DLMMMMLD.',
        '.DLMMCMDD.',
        '..DLMMD...',
        '...DDD....',
        '..........',
      ],
      grey,
      3
    );
    makePixelTexture(
      this,
      'rock_stone_1',
      [
        '..........',
        '..DDDDDD..',
        '.DLMHMMLD.',
        '.DLMMMCLD.',
        '..DDDDDD..',
        '..........',
        '..........',
        '..........',
      ],
      slate,
      3
    );
    makePixelTexture(
      this,
      'rock_stone_2',
      [
        '..........',
        '....DD....',
        '...DLHD...',
        '..DLMMMD..',
        '.DLMMMCLD.',
        '..DLMMD...',
        '...DDD....',
        '..........',
      ],
      granite,
      3
    );

    // Rochas médias: bloco / torre / musgo largo
    makePixelTexture(
      this,
      'rock_rock_0',
      [
        '..............',
        '...DDDDDDD....',
        '..DLMHMMLD....',
        '.DLMMMMMMCD...',
        '.DLMHMMMMMLD..',
        '.DDLMMMMMLD...',
        '..DDLCLLDD....',
        '...DDDDDD.....',
        '..............',
        '..............',
      ],
      grey,
      3
    );
    makePixelTexture(
      this,
      'rock_rock_1',
      [
        '..............',
        '.....DD.......',
        '....DLHD......',
        '...DLMMMD.....',
        '..DLMHMMLD....',
        '.DLMMMMMCLD...',
        '.DLMHMMMMLD...',
        '..DLMMMMLD....',
        '...DDDDDD.....',
        '..............',
      ],
      basalt,
      3
    );
    makePixelTexture(
      this,
      'rock_rock_2',
      [
        '..............',
        '..DDDDDDDDD...',
        '.DLMHMHMMMLD..',
        '.DLMMMMMCMLD..',
        '..DLMMMMMLD...',
        '...DDLCLDD....',
        '....DDDD......',
        '..............',
        '..............',
        '..............',
      ],
      moss,
      3
    );

    // Pedrões: irregular / largo / rachado
    makePixelTexture(
      this,
      'rock_boulder_0',
      [
        '................',
        '....DDDDDD......',
        '..DDLMHMMLDD....',
        '.DLMMMMMMMMLD...',
        '.DLMHMMMMMHMLD..',
        'DLMMMMMCMMMMLD..',
        'DLMHMMMMMMMMLD..',
        '.DDLMMMMMMMLD...',
        '..DLMMMMMMLD....',
        '...DDLCLLDD.....',
        '....DDDD.D......',
        '................',
        '................',
        '................',
      ],
      slate,
      3
    );
    makePixelTexture(
      this,
      'rock_boulder_1',
      [
        '................',
        '...DDDDDDDDD....',
        '.DDLMHMHMMMLD...',
        'DLMMMMMMMMMMLD..',
        'DLMHMMMMMHMMLD..',
        'DLMMMMMCMMMMLD..',
        'DDLMHMMMMMMMLD..',
        '.DLMMMMMMMMLD...',
        '..DDLCLLLDD.....',
        '...DDDDDDD......',
        '................',
        '................',
        '................',
        '................',
      ],
      basalt,
      3
    );
    makePixelTexture(
      this,
      'rock_boulder_2',
      [
        '................',
        '.....DDDDD......',
        '...DDLHMMLD.....',
        '..DLMHMMMMLD....',
        '.DLMMMMMCMMMLD..',
        '.DLMHMMMMMHMLD..',
        '.DLMMMMMMMMMLD..',
        '..DLMMMCMMLD....',
        '...DLMMMMLD.....',
        '....DDLCLDD.....',
        '.....DDDD.......',
        '.......D........',
        '................',
        '................',
      ],
      granite,
      3
    );

    // Pedras de gelo — mesmas formas, paleta azul-clara
    makePixelTexture(
      this,
      'rock_ice_stone_0',
      [
        '..........',
        '...DDD....',
        '..DLHMD...',
        '.DLMMMMLD.',
        '.DLMMCMDD.',
        '..DLMMD...',
        '...DDD....',
        '..........',
      ],
      icePale,
      3
    );
    makePixelTexture(
      this,
      'rock_ice_stone_1',
      [
        '..........',
        '..DDDDDD..',
        '.DLMHMMLD.',
        '.DLMMMCLD.',
        '..DDDDDD..',
        '..........',
        '..........',
        '..........',
      ],
      iceBlue,
      3
    );
    makePixelTexture(
      this,
      'rock_ice_stone_2',
      [
        '..........',
        '....DD....',
        '...DLHD...',
        '..DLMMMD..',
        '.DLMMMCLD.',
        '..DLMMD...',
        '...DDD....',
        '..........',
      ],
      iceDeep,
      3
    );
    makePixelTexture(
      this,
      'rock_ice_rock_0',
      [
        '..............',
        '...DDDDDDD....',
        '..DLMHMMLD....',
        '.DLMMMMMMCD...',
        '.DLMHMMMMMLD..',
        '.DDLMMMMMLD...',
        '..DDLCLLDD....',
        '...DDDDDD.....',
        '..............',
        '..............',
      ],
      icePale,
      3
    );
    makePixelTexture(
      this,
      'rock_ice_rock_1',
      [
        '..............',
        '.....DD.......',
        '....DLHD......',
        '...DLMMMD.....',
        '..DLMHMMLD....',
        '.DLMMMMMCLD...',
        '.DLMHMMMMLD...',
        '..DLMMMMLD....',
        '...DDDDDD.....',
        '..............',
      ],
      iceBlue,
      3
    );
    makePixelTexture(
      this,
      'rock_ice_rock_2',
      [
        '..............',
        '..DDDDDDDDD...',
        '.DLMHMHMMMLD..',
        '.DLMMMMMCMLD..',
        '..DLMMMMMLD...',
        '...DDLCLDD....',
        '....DDDD......',
        '..............',
        '..............',
        '..............',
      ],
      iceDeep,
      3
    );
    makePixelTexture(
      this,
      'rock_ice_boulder_0',
      [
        '................',
        '....DDDDDD......',
        '..DDLMHMMLDD....',
        '.DLMMMMMMMMLD...',
        '.DLMHMMMMMHMLD..',
        'DLMMMMMCMMMMLD..',
        'DLMHMMMMMMMMLD..',
        '.DDLMMMMMMMLD...',
        '..DLMMMMMMLD....',
        '...DDLCLLDD.....',
        '....DDDD.D......',
        '................',
        '................',
        '................',
      ],
      iceBlue,
      3
    );
    makePixelTexture(
      this,
      'rock_ice_boulder_1',
      [
        '................',
        '...DDDDDDDDD....',
        '.DDLMHMHMMMLD...',
        'DLMMMMMMMMMMLD..',
        'DLMHMMMMMHMMLD..',
        'DLMMMMMCMMMMLD..',
        'DDLMHMMMMMMMLD..',
        '.DLMMMMMMMMLD...',
        '..DDLCLLLDD.....',
        '...DDDDDDD......',
        '................',
        '................',
        '................',
        '................',
      ],
      iceDeep,
      3
    );
    makePixelTexture(
      this,
      'rock_ice_boulder_2',
      [
        '................',
        '.....DDDDD......',
        '...DDLHMMLD.....',
        '..DLMHMMMMLD....',
        '.DLMMMMMCMMMLD..',
        '.DLMHMMMMMHMLD..',
        '.DLMMMMMMMMMLD..',
        '..DLMMMCMMLD....',
        '...DLMMMMLD.....',
        '....DDLCLDD.....',
        '.....DDDD.......',
        '.......D........',
        '................',
        '................',
      ],
      icePale,
      3
    );
  }

  createFurnitureSprites() {
    // D=sombra, L=base, M=meio, H=highlight, C=fenda/detalhe, M=madeira, S=assento
    const oak = { D: 0x2a1a10, L: 0x6a4428, M: 0x8a5a34, H: 0xc49a5a, C: 0x3e2818, S: 0xa07040 };
    const pine = { D: 0x2e2214, L: 0x7a5a30, M: 0x9a7440, H: 0xd4b070, C: 0x4a3420, S: 0xb88850 };
    const walnut = { D: 0x1e140c, L: 0x4a3020, M: 0x6a4830, H: 0x9a6a48, C: 0x2e1e14, S: 0x7a5038 };
    const crate = { D: 0x241810, L: 0x5a3e24, M: 0x7a5430, H: 0xb88850, C: 0x3a2818, S: 0x8a6440 };

    // Cadeira (pequena)
    makePixelTexture(
      this,
      'furn_chair_0',
      [
        '..........',
        '..HH......',
        '..MMH.....',
        '..MMC.....',
        '..MMM.....',
        '.SMMMS....',
        '.DLLLD....',
        '..L..L....',
        '..L..L....',
        '..........',
      ],
      oak,
      3
    );
    makePixelTexture(
      this,
      'furn_chair_1',
      [
        '..........',
        '...HH.....',
        '..HMMH....',
        '..MCMC....',
        '.SMMMS....',
        '.DLLLD....',
        '..L..L....',
        '..L..L....',
        '..........',
        '..........',
      ],
      pine,
      3
    );
    makePixelTexture(
      this,
      'furn_chair_2',
      [
        '..........',
        '.HH.HH....',
        '.MM.MM....',
        '.MCMC.....',
        'SMMMMS....',
        'DLLLLD....',
        '.L..L.....',
        '.L..L.....',
        '..........',
        '..........',
      ],
      walnut,
      3
    );

    // Caixa / barril
    makePixelTexture(
      this,
      'furn_crate_0',
      [
        '............',
        '..DDDDDDD...',
        '.DLHHHHHLD..',
        '.DLMMMMMLD..',
        '.DLMCMMCLD..',
        '.DLMMMMMLD..',
        '.DLHHHHHLD..',
        '..DDDDDDD...',
        '............',
        '............',
      ],
      crate,
      3
    );
    makePixelTexture(
      this,
      'furn_crate_1',
      [
        '............',
        '...DDDDD....',
        '..DLHHHLD...',
        '.DLMMMMMLD..',
        '.DLMHMHMLD..',
        '.DLMMMMMLD..',
        '..DLHHHLD...',
        '...DDDDD....',
        '............',
        '............',
      ],
      oak,
      3
    );
    makePixelTexture(
      this,
      'furn_crate_2',
      [
        '............',
        '..DDDDDD....',
        '.DLHHHHLD...',
        '.DLMMMMLD...',
        '.DLCMMCLD...',
        '.DLMMMMLD...',
        '.DLHHHHLD...',
        '..DDDDDD....',
        '............',
        '............',
      ],
      pine,
      3
    );

    // Mesa
    makePixelTexture(
      this,
      'furn_table_0',
      [
        '..............',
        '.HHHHHHHHHHH..',
        '.MMMMMMMMMMM..',
        '.DLLLLLLLLLD..',
        '..L......L....',
        '..L......L....',
        '..L......L....',
        '..D......D....',
        '..............',
        '..............',
      ],
      oak,
      3
    );
    makePixelTexture(
      this,
      'furn_table_1',
      [
        '..............',
        '..HHHHHHHHH...',
        '..MMMMMCMMM...',
        '..DLLLLLLLD...',
        '...L.....L....',
        '...L.....L....',
        '...L.....L....',
        '...D.....D....',
        '..............',
        '..............',
      ],
      pine,
      3
    );
    makePixelTexture(
      this,
      'furn_table_2',
      [
        '..............',
        '.HHHHHHHHHH...',
        '.MMMHCMMMMM...',
        '.DLLLLLLLLD...',
        '..L..L...L....',
        '..L..L...L....',
        '..L......L....',
        '..D......D....',
        '..............',
        '..............',
      ],
      walnut,
      3
    );

    // Armário / estante (grande)
    makePixelTexture(
      this,
      'furn_cabinet_0',
      [
        '................',
        '..DDDDDDDDDD....',
        '.DLHHHHHHHHLD...',
        '.DLMMMMMMMMLD...',
        '.DLMHCCHMMMLD...',
        '.DLMMMMMMMMLD...',
        '.DLMHCCHMMMLD...',
        '.DLMMMMMMMMLD...',
        '.DLHHHHHHHHLD...',
        '..DDDDDDDDDD....',
        '................',
        '................',
        '................',
        '................',
      ],
      walnut,
      3
    );
    makePixelTexture(
      this,
      'furn_cabinet_1',
      [
        '................',
        '...DDDDDDDD.....',
        '..DLHHHHHHLD....',
        '.DLMMMMMMMMLD...',
        '.DLMHMMMMHMLD...',
        '.DLMMCMMCMLD....',
        '.DLMHMMMMHMLD...',
        '.DLMMMMMMMMLD...',
        '..DLHHHHHHLD....',
        '...DDDDDDDD.....',
        '................',
        '................',
        '................',
        '................',
      ],
      oak,
      3
    );
    makePixelTexture(
      this,
      'furn_cabinet_2',
      [
        '................',
        '..DDDDDDDDD.....',
        '.DLHHHHHHHLD....',
        '.DLMMMMMMMLD....',
        '.DLCMMMMMCLD....',
        '.DLMMMMMMMLD....',
        '.DLCMMMMMCLD....',
        '.DLMMMMMMMLD....',
        '.DLHHHHHHHLD....',
        '..DDDDDDDDD.....',
        '................',
        '................',
        '................',
        '................',
      ],
      pine,
      3
    );
  }

  createShellSprites() {
    // D=sombra, L=base, M=meio, H=highlight, C=abertura/detalhe, P=pérola
    const pink = { D: 0x5a3048, L: 0xc87898, M: 0xe8a0b8, H: 0xffd0e0, C: 0x8a4868, P: 0xfff0f8 };
    const cream = { D: 0x5a4830, L: 0xd4b888, M: 0xf0d8a8, H: 0xfff4d8, C: 0x8a7048, P: 0xfffaf0 };
    const coral = { D: 0x6a2830, L: 0xd86860, M: 0xf09080, H: 0xffc8b8, C: 0x943840, P: 0xffe8e0 };
    const teal = { D: 0x284858, L: 0x68a0b0, M: 0x90c8d4, H: 0xd0eef4, C: 0x3a6878, P: 0xf0fcff };

    // Concha pequena
    makePixelTexture(
      this,
      'shell_shell_0',
      [
        '..........',
        '....HH....',
        '...HMMH...',
        '..HMCMH...',
        '.HLMMMMLH.',
        '..DLMMD...',
        '...DDD....',
        '..........',
      ],
      pink,
      3
    );
    makePixelTexture(
      this,
      'shell_shell_1',
      [
        '..........',
        '...HHH....',
        '..HMMMH...',
        '.HLMCMLH..',
        '..DLMMD...',
        '...DDD....',
        '..........',
        '..........',
      ],
      cream,
      3
    );
    makePixelTexture(
      this,
      'shell_shell_2',
      [
        '..........',
        '....HH....',
        '...HMH....',
        '..HMCMH...',
        '.HLMMMML..',
        '..DLMPD...',
        '...DDD....',
        '..........',
      ],
      coral,
      3
    );

    // Caramujo / búzio
    makePixelTexture(
      this,
      'shell_conch_0',
      [
        '..............',
        '......HH......',
        '.....HMMH.....',
        '....HMCMH.....',
        '...HLMMMMLH...',
        '..HLMMMMMML...',
        '..DLMHMMMCD...',
        '...DLMMMD.....',
        '....DDDDD.....',
        '..............',
      ],
      cream,
      3
    );
    makePixelTexture(
      this,
      'shell_conch_1',
      [
        '..............',
        '.....HH.......',
        '....HMMH......',
        '...HMCMH......',
        '..HLMMMMLH....',
        '.HLMMMMMMH....',
        '.DLMHMMMPD....',
        '..DLMMMD......',
        '...DDDDD......',
        '..............',
      ],
      pink,
      3
    );
    makePixelTexture(
      this,
      'shell_conch_2',
      [
        '..............',
        '......HHH.....',
        '.....HMMMH....',
        '....HMCMMH....',
        '...HLMMMMML...',
        '..HLMMMMMML...',
        '..DLMHMMMCD...',
        '...DLMMMD.....',
        '....DDDD......',
        '..............',
      ],
      teal,
      3
    );

    // Vieira / ostra grande
    makePixelTexture(
      this,
      'shell_clam_0',
      [
        '................',
        '.....HHHHH......',
        '...HHMMMMMHH....',
        '..HLMMMMMMMLH...',
        '.HLMMHCCHMMMLH..',
        '.HLMMMMMMMMMLH..',
        '..DLMHMMMMMLD...',
        '...DLMMMMMLD....',
        '....DDDDDDD.....',
        '................',
        '................',
        '................',
      ],
      coral,
      3
    );
    makePixelTexture(
      this,
      'shell_clam_1',
      [
        '................',
        '....HHHHHH......',
        '...HMMMHMMH.....',
        '..HLMMMMMMMLH...',
        '.HLMMHCCHMMML...',
        '.HLMMMMMPMMMLH..',
        '..DLMHMMMMMLD...',
        '...DLMMMMMLD....',
        '....DDDDDD......',
        '................',
        '................',
        '................',
      ],
      cream,
      3
    );
    makePixelTexture(
      this,
      'shell_clam_2',
      [
        '................',
        '.....HHHH.......',
        '...HHMMMMHH.....',
        '..HLMMMMMMMLH...',
        '.HLMMHCCHMMMH...',
        '.HLMMMMMMMMMLH..',
        '..DLMHMMMMMLD...',
        '...DLMMMMMLD....',
        '....DDDDDD......',
        '................',
        '................',
        '................',
      ],
      teal,
      3
    );
  }

  createTreeSprites() {
    // T=tronco, D=sombra folha, L=folha escura, M=folha, H=highlight, F=fruta
    const pine = { T: 0x5a3a22, D: 0x1e3a18, L: 0x2e5a28, M: 0x3e7a34, H: 0x5aaa48 };
    const oak = { T: 0x6a4428, D: 0x2a4a20, L: 0x3a6a2c, M: 0x4a8a38, H: 0x6aba50, F: 0xc44a3a };
    const bush = { T: 0x4a3420, D: 0x244820, L: 0x366830, M: 0x488840, H: 0x68a850 };

    makePixelTexture(
      this,
      'tree_pine_0',
      [
        '........HH........',
        '.......HMMH.......',
        '......HMMMMH......',
        '.....LMMMMMML.....',
        '....LMMMHMMMML....',
        '...LMMMMMMMMMML...',
        '....LMMMMMMML.....',
        '.....LMMMMML......',
        '......DDTTDD......',
        '........TT........',
        '........TT........',
        '.......TTTT.......',
      ],
      pine,
      2
    );
    makePixelTexture(
      this,
      'tree_pine_1',
      [
        '.........H........',
        '.......HMMH.......',
        '......HMMMMH......',
        '.....LMMMMMML.....',
        '....LMMMMMMMML....',
        '...LMMMHMMMMMML...',
        '....LMMMMMMML.....',
        '.....DDMMMMDD.....',
        '.......LTTL.......',
        '........TT........',
        '........TT........',
        '.......TTTT.......',
      ],
      pine,
      2
    );
    makePixelTexture(
      this,
      'tree_oak_0',
      [
        '......HHHHHH......',
        '....HHMMMMMMHH....',
        '...HMMMHFHMMMH....',
        '..LMMMMMMMMMMMML..',
        '..LMMMHMMMMHMMML..',
        '..LMMMMMMMMMMMML..',
        '...LMMMMMMMMML....',
        '....DDLMMLDD......',
        '.......TT.........',
        '.......TT.........',
        '......TTTT........',
        '..................',
      ],
      oak,
      2
    );
    makePixelTexture(
      this,
      'tree_oak_1',
      [
        '.....HHHHHHHH.....',
        '...HHMMMMMMMMHH...',
        '..HMMMHMMMHMMMMH..',
        '.LMMMMFMMMMFMMMML.',
        '.LMMMMMMMMMMMMMML.',
        '..LMMMHMMMMHMMML..',
        '...LMMMMMMMMML....',
        '....DDLTTLDD......',
        '.......TT.........',
        '.......TT.........',
        '......TTTT........',
        '..................',
      ],
      oak,
      2
    );
    makePixelTexture(
      this,
      'tree_bush_0',
      [
        '..................',
        '......HHHH........',
        '....HHMMMMHH......',
        '...HMMMHMMMML.....',
        '...LMMMMMMMML.....',
        '....LMMMMMML......',
        '.....DDTTDD.......',
        '.......TT.........',
        '..................',
        '..................',
        '..................',
        '..................',
      ],
      bush,
      2
    );
    makePixelTexture(
      this,
      'tree_bush_1',
      [
        '..................',
        '.....HHHHH........',
        '...HHMMMMMHH......',
        '..HMMMHMMMMML.....',
        '..LMMMMMMMMML.....',
        '...LMMMMMMML......',
        '....DDLTLDD.......',
        '.......TT.........',
        '..................',
        '..................',
        '..................',
        '..................',
      ],
      bush,
      2
    );

    // Árvores de pântano — troncos tortos, folhas esverdeadas/acinzentadas
    const mangrove = { T: 0x3a2a18, D: 0x1a3020, L: 0x2a4830, M: 0x3a6840, H: 0x5a8860, R: 0x4a3820 };
    const swampOak = { T: 0x4a3420, D: 0x1e3424, L: 0x2e5030, M: 0x3e7040, H: 0x589858, F: 0x6a8a40 };
    const swampBush = { T: 0x3a2818, D: 0x203828, L: 0x305038, M: 0x487048, H: 0x689060 };

    makePixelTexture(
      this,
      'tree_mangrove_0',
      [
        '.......HHH........',
        '......HMMMH.......',
        '.....LMMMMML......',
        '....LMMMHMMML.....',
        '.....LMMMMML......',
        '......DDTTDD......',
        '.....R..TT..R.....',
        '....R...TT...R....',
        '........TT........',
        '.......TTTT.......',
        '......R....R......',
        '..................',
      ],
      mangrove,
      2
    );
    makePixelTexture(
      this,
      'tree_mangrove_1',
      [
        '........HH........',
        '......HMMMH.......',
        '.....LMMMMML......',
        '....LMMMMMMMML....',
        '.....LMMHMMML.....',
        '......DDTTDD......',
        '....R...TT...R....',
        '...R....TT....R...',
        '........TT........',
        '.......TTTT.......',
        '.....R......R.....',
        '..................',
      ],
      mangrove,
      2
    );
    makePixelTexture(
      this,
      'tree_swamp_oak_0',
      [
        '.....HHHHHH.......',
        '...HHMMMMMMHH.....',
        '..HMMMHMMHMMMH....',
        '.LMMMMMMMMMMMML...',
        '.LMMMHMMMMHMMML...',
        '..LMMMMMMMMMML....',
        '...DDLMMLDD.......',
        '......TT..........',
        '.....RTT..........',
        '......TTTT........',
        '....R.............',
        '..................',
      ],
      swampOak,
      2
    );
    makePixelTexture(
      this,
      'tree_swamp_oak_1',
      [
        '....HHHHHHHH......',
        '..HHMMMMMMMMHH....',
        '.HMMMHMMMHMMMMH...',
        'LMMMMFMMMMFMMMML..',
        'LMMMMMMMMMMMMMML..',
        '.LMMMHMMMMHMMML...',
        '..LMMMMMMMMML.....',
        '...DDLTTLDD.......',
        '......TT..........',
        '......TT.R........',
        '.....TTTT.........',
        '..........R.......',
      ],
      swampOak,
      2
    );
    makePixelTexture(
      this,
      'tree_swamp_bush_0',
      [
        '..................',
        '.....HHHH.........',
        '...HHMMMMHH.......',
        '..HMMMHMMMML......',
        '..LMMMMMMMML......',
        '...LMMMMMML.......',
        '....DDTTDD........',
        '......TT..........',
        '..................',
        '..................',
        '..................',
        '..................',
      ],
      swampBush,
      2
    );
    makePixelTexture(
      this,
      'tree_swamp_bush_1',
      [
        '..................',
        '....HHHHH.........',
        '..HHMMMMMHH.......',
        '.HMMMHMMMMML......',
        '.LMMMMMMMMML......',
        '..LMMMMMMML.......',
        '...DDLTLDD........',
        '......TT..........',
        '..................',
        '..................',
        '..................',
        '..................',
      ],
      swampBush,
      2
    );
  }

  createBonesSprites() {
    // Pilha de ossos (chão)
    makePixelTexture(
      this,
      'bones_pile',
      [
        '................',
        '................',
        '......W.........',
        '...W.WCW.W......',
        '..WCW..WCW......',
        '.W..WWWW..W.....',
        '..WC.DD.CW......',
        '.W.WWWWWW.W.....',
        '..W.CWWC.W......',
        '...WW..WW.......',
        '................',
        '................',
      ],
      { W: 0xe8e0d0, C: 0xc8c0b0, D: 0xa09080 },
      2
    );
    // Caveira
    makePixelTexture(
      this,
      'skull',
      [
        '........',
        '.WWWWWW.',
        'WWWWWWWW',
        'W.BWW.BW',
        'WWWWWWWW',
        '.WWDDWW.',
        '..WDDW..',
        '...WW...',
      ],
      { W: 0xf0ebe0, B: 0x1a1410, D: 0xc8b8a8 },
      2
    );
  }

  createLootBagSprite() {
    makePixelTexture(
      this,
      'loot_bag',
      [
        '..............',
        '.....YYYY.....',
        '....YWWWWY....',
        '...BBBBBBBB...',
        '..BBRRRRRRBB..',
        '.BRRRRRRRRRRB.',
        '.BRRRGGGRRRRB.',
        '.BRRGGGGGRRRB.',
        '.BRRRGGGRRRRB.',
        '.BRRRRRRRRRRB.',
        '..BBRRRRRRBB..',
        '...BBBBBBBB...',
        '..............',
        '..............',
      ],
      { B: 0x3d2410, R: 0xa86b32, G: 0xffd84a, Y: 0xffe066, W: 0xfff2a8 },
      3
    );
  }

  createCoinSprite() {
    makePixelTexture(
      this,
      'coin',
      [
        '............',
        '....YYYY....',
        '...YWWWWY...',
        '..YWGGGGWY..',
        '.YWGGGGGGWY.',
        '.YWGGYYGGWY.',
        '.YWGGYYGGWY.',
        '.YWGGGGGGWY.',
        '..YWGGGGWY..',
        '...YWWWWY...',
        '....YYYY....',
        '............',
      ],
      { Y: 0xe8b020, W: 0xffe066, G: 0xd4a017 },
      3
    );
  }

  createBloodSprites() {
    makePixelTexture(
      this,
      'blood_0',
      [
        '........',
        '..RR....',
        '.RRRR...',
        '.RRDRR..',
        '..RRRR..',
        '...RR...',
        '........',
        '........',
      ],
      { R: 0x8b0000, D: 0x5a0000 },
      2
    );
    makePixelTexture(
      this,
      'blood_1',
      [
        '........',
        '...R.R..',
        '..RRRR..',
        '.RRDRRR.',
        '..RRRR..',
        '.R..R...',
        '........',
        '........',
      ],
      { R: 0xa00000, D: 0x4a0000 },
      2
    );
    makePixelTexture(
      this,
      'blood_2',
      [
        '........',
        '..RRR...',
        '.RRDRR..',
        '.RRRRRR.',
        '..RDRR..',
        '...RR...',
        '........',
        '........',
      ],
      { R: 0x9b1b1b, D: 0x3d0000 },
      2
    );
  }

  createLavaTextures() {
    // Fundo: tile seamless (lava.png) — LINEAR evita costuras duras ao repetir
    if (this.textures.exists('lava_tile')) {
      this.textures.get('lava_tile').setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Bolhas de lava (3 frames)
    const bubbleFrames = [
      [[8, 8, 4], [8, 8, 2]],
      [[8, 8, 6], [8, 7, 3], [8, 6, 1]],
      [[8, 8, 7], [8, 7, 4], [8, 5, 2], [8, 4, 1]],
    ];
    bubbleFrames.forEach((rings, i) => {
      g.clear();
      for (const [cx, cy, r] of rings) {
        g.fillStyle(i === rings.length - 1 && r <= 2 ? 0xffe066 : 0xff6b1a, 1);
        g.fillCircle(cx, cy, r);
      }
      if (i === 2) {
        g.fillStyle(0x3a0800, 1);
        g.fillCircle(8, 8, 3);
      }
      g.generateTexture(`lava_bubble_${i}`, 16, 16);
    });

    // Gases (fumaça/vapor) — 3 frames
    makePixelTexture(
      this,
      'lava_gas_0',
      [
        '........',
        '...GG...',
        '..GYYG..',
        '.GYYYYG.',
        '..GYYG..',
        '...GG...',
        '........',
        '........',
      ],
      { G: 0x6b4a2a, Y: 0xc4a574 },
      2
    );
    makePixelTexture(
      this,
      'lava_gas_1',
      [
        '....G...',
        '...GYG..',
        '..GYYYG.',
        '.GYYYYG.',
        '..GYYG..',
        '...GY...',
        '....G...',
        '........',
      ],
      { G: 0x5a3d22, Y: 0xb89560 },
      2
    );
    makePixelTexture(
      this,
      'lava_gas_2',
      [
        '...G.G..',
        '..GYGYG.',
        '.GYYYYG.',
        '..GYYG..',
        '...GYG..',
        '....G...',
        '........',
        '........',
      ],
      { G: 0x4a321c, Y: 0xa88855 },
      2
    );

    // Cratera / poça de lava (decoração)
    makePixelTexture(
      this,
      'lava_pool',
      [
        '................',
        '......DDDD......',
        '....DDRRRRDD....',
        '...DRROOOORRD...',
        '..DRROYYYORRD...',
        '..DROYYYYYORD...',
        '.DRROYYYYYORRD..',
        '.DROYYYYYYYORD..',
        '.DROYYYYYYYORD..',
        '.DRROYYYYYORRD..',
        '..DROYYYYYORD...',
        '..DRROYYYORRD...',
        '...DRROOOORRD...',
        '....DDRRRRDD....',
        '......DDDD......',
        '................',
      ],
      {
        D: 0x2a0600,
        R: 0x8b1a00,
        O: 0xe85d04,
        Y: 0xffc857,
      },
      2
    );

    g.destroy();
    for (const key of ['lava_bubble_0', 'lava_bubble_1', 'lava_bubble_2']) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  createArenaDirtTexture() {
    // Tile 64×64 seamless — terra batida com manchas, pedrinhas e rachaduras
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0x6b4e2e, // terra escura
      0x7a5a34, // terra média
      0x8b6a3c, // terra clara
      0x5c4026, // sombra
      0x9a7a48, // pó seco
      0x4a3420, // fenda
      0x6e5a38, // pedrinha
      0x8a744c, // seixo claro
      0x5a6a3a, // musgo / erva seca
      0xa08050, // areia
    ];

    // Hash determinístico (tiling-friendly com coords wrap)
    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };

    const wrap = (v, m) => ((v % m) + m) % m;

    // Valor suave 0..1 com wrap (value noise 8×8 cells)
    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 19, tw), wrap(y + 11, th));
        const n3 = valueAt(wrap(x + 37, tw), wrap(y + 23, th));
        const h = hash(x, y);

        let tone;
        if (n1 < 0.28) tone = tones[3]; // sombra
        else if (n1 < 0.45) tone = tones[0];
        else if (n1 < 0.62) tone = tones[1];
        else if (n1 < 0.78) tone = tones[2];
        else if (n1 < 0.9) tone = tones[4];
        else tone = tones[9]; // areia

        // Manchas mais claras / escuras
        if (n2 > 0.82) tone = tones[4];
        if (n2 < 0.18) tone = tones[3];

        // Speckle fino de grão
        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[2];
        if ((h & 63) === 13) tone = tones[0];

        // Rachaduras (linhas escuras) — padrão que envolve o tile
        const crack =
          Math.abs(n3 - n1) < 0.045 && (hash(wrap(x + y, tw), wrap(y * 3, th)) & 3) !== 0;
        if (crack && n1 > 0.32 && n1 < 0.78) tone = tones[5];

        // Pedrinhas
        if ((h & 127) === 21) tone = tones[6];
        if ((h & 127) === 42) tone = tones[7];

        // Toques de erva seca / musgo
        if (n2 > 0.88 && (h & 7) === 3) tone = tones[8];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    // Manchas maiores (toroidal) — pedaços de terra diferente
    const patches = [
      { x: 8, y: 12, r: 7, c: 0x8b6a3c },
      { x: 40, y: 20, r: 6, c: 0x5c4026 },
      { x: 22, y: 44, r: 8, c: 0x7a5a34 },
      { x: 52, y: 50, r: 5, c: 0x9a7a48 },
      { x: 58, y: 8, r: 4, c: 0x6b4e2e },
      { x: 12, y: 56, r: 5, c: 0xa08050 },
    ];
    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.55 : 0.85);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    // Pedrinhas / cascalho em clusters
    const pebbles = [
      [10, 18], [11, 19], [28, 8], [45, 30], [46, 31], [33, 52],
      [60, 40], [3, 35], [18, 38], [50, 12], [7, 48], [38, 42],
    ];
    for (const [px, py] of pebbles) {
      g.fillStyle(0x6e5a38, 1);
      g.fillRect(px, py, 2, 1);
      g.fillStyle(0x8a744c, 1);
      g.fillRect(px, py, 1, 1);
    }

    g.generateTexture('arena_brick', tw, th);
    g.destroy();
    this.textures.get('arena_brick').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  createIronBlockTexture() {
    // Bloco de ferro 16×16 — chanfro, rebites e placa metálica
    makePixelTexture(
      this,
      'iron_block',
      [
        '................',
        '.HHHHHHHHHHHHHH.',
        '.HMMMMMMMMMMMMD.',
        '.HMCCCCCCCCCCMD.',
        '.HMCMMMMMMMMCMD.',
        '.HMCMRRMMRRMCMD.',
        '.HMCMMMMMMMMCMD.',
        '.HMCMMMMMMMMCMD.',
        '.HMCMMMMMMMMCMD.',
        '.HMCMMMMMMMMCMD.',
        '.HMCMRRMMRRMCMD.',
        '.HMCMMMMMMMMCMD.',
        '.HMCCCCCCCCCCMD.',
        '.HMMMMMMMMMMMMD.',
        '.HDDDDDDDDDDDDD.',
        '................',
      ],
      {
        H: 0xd0d4dc, // highlight
        M: 0x8a909c, // metal
        C: 0x6a707c, // placa
        R: 0x3a3e48, // rebite
        D: 0x2e323a, // sombra
      },
      2
    );
  }

  createArenaGrassTexture() {
    // Tile 64×64 seamless — grama com variações, terra e pedrinhas
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0x3a6b2a, // grama escura
      0x4a8a34, // grama média
      0x5caa3c, // grama clara
      0x2e5420, // sombra
      0x6aba48, // broto / sol
      0x6b4e2e, // terra
      0x8b6a3c, // terra clara
      0x6e5a38, // pedrinha
      0x8a744c, // seixo
      0x7a9a40, // erva seca
    ];

    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };

    const wrap = (v, m) => ((v % m) + m) % m;

    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 19, tw), wrap(y + 11, th));
        const n3 = valueAt(wrap(x + 37, tw), wrap(y + 23, th));
        const h = hash(x, y);

        let tone;
        if (n1 < 0.22) tone = tones[3];
        else if (n1 < 0.4) tone = tones[0];
        else if (n1 < 0.6) tone = tones[1];
        else if (n1 < 0.78) tone = tones[2];
        else if (n1 < 0.9) tone = tones[4];
        else tone = tones[9];

        if (n2 > 0.84) tone = tones[4];
        if (n2 < 0.16) tone = tones[3];

        // Clareiras de terra
        if (n3 > 0.86 && n1 > 0.35 && n1 < 0.7) tone = tones[5];
        if (n3 > 0.92) tone = tones[6];

        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[2];
        if ((h & 63) === 13) tone = tones[0];

        // Filetes de folha / lâmina
        const blade =
          Math.abs(n3 - n1) < 0.04 && (hash(wrap(x + y, tw), wrap(y * 3, th)) & 3) !== 0;
        if (blade && n1 > 0.3 && n1 < 0.8) tone = tones[0];

        if ((h & 127) === 21) tone = tones[7];
        if ((h & 127) === 42) tone = tones[8];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    const patches = [
      { x: 10, y: 14, r: 7, c: 0x4a8a34 },
      { x: 42, y: 22, r: 6, c: 0x2e5420 },
      { x: 24, y: 46, r: 8, c: 0x5caa3c },
      { x: 50, y: 48, r: 5, c: 0x6b4e2e },
      { x: 56, y: 10, r: 4, c: 0x3a6b2a },
      { x: 14, y: 54, r: 5, c: 0x6aba48 },
    ];
    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.55 : 0.85);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    const pebbles = [
      [10, 18], [11, 19], [28, 8], [45, 30], [46, 31], [33, 52],
      [60, 40], [3, 35], [18, 38], [50, 12], [7, 48], [38, 42],
    ];
    for (const [px, py] of pebbles) {
      g.fillStyle(0x6e5a38, 1);
      g.fillRect(px, py, 2, 1);
      g.fillStyle(0x8a744c, 1);
      g.fillRect(px, py, 1, 1);
    }

    g.generateTexture('arena_grass', tw, th);
    g.destroy();
    this.textures.get('arena_grass').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  createArenaIceTexture() {
    // Tile 64×64 seamless — gelo com veios, brilho e pedrinhas congeladas
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0x3a6a88, // gelo escuro
      0x5a8eb0, // gelo médio
      0x7ab4d0, // gelo claro
      0x2a4a68, // sombra
      0xa8d8f0, // brilho / neve
      0x4a7898, // veia
      0x8ec4dc, // cristal
      0xc8e8f8, // highlight
      0x6a9cbc, // gelo azulado
      0xb0dcf0, // neve pó
    ];

    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };

    const wrap = (v, m) => ((v % m) + m) % m;

    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 19, tw), wrap(y + 11, th));
        const n3 = valueAt(wrap(x + 37, tw), wrap(y + 23, th));
        const h = hash(x, y);

        let tone;
        if (n1 < 0.22) tone = tones[3];
        else if (n1 < 0.4) tone = tones[0];
        else if (n1 < 0.58) tone = tones[1];
        else if (n1 < 0.74) tone = tones[2];
        else if (n1 < 0.88) tone = tones[8];
        else tone = tones[4];

        if (n2 > 0.84) tone = tones[4];
        if (n2 < 0.16) tone = tones[3];

        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[2];
        if ((h & 63) === 13) tone = tones[0];

        // Veios de gelo (rachaduras claras)
        const vein =
          Math.abs(n3 - n1) < 0.04 && (hash(wrap(x + y, tw), wrap(y * 3, th)) & 3) !== 0;
        if (vein && n1 > 0.3 && n1 < 0.8) tone = tones[5];

        // Cristais / brilhos
        if ((h & 127) === 21) tone = tones[6];
        if ((h & 127) === 42) tone = tones[7];
        if (n2 > 0.9 && (h & 7) === 3) tone = tones[9];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    const patches = [
      { x: 10, y: 14, r: 7, c: 0x5a8eb0 },
      { x: 42, y: 22, r: 6, c: 0x2a4a68 },
      { x: 24, y: 46, r: 8, c: 0x7ab4d0 },
      { x: 50, y: 48, r: 5, c: 0xa8d8f0 },
      { x: 56, y: 10, r: 4, c: 0x3a6a88 },
      { x: 14, y: 54, r: 5, c: 0xc8e8f8 },
    ];
    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.55 : 0.85);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    const crystals = [
      [10, 18], [11, 19], [28, 8], [45, 30], [46, 31], [33, 52],
      [60, 40], [3, 35], [18, 38], [50, 12], [7, 48], [38, 42],
    ];
    for (const [px, py] of crystals) {
      g.fillStyle(0x8ec4dc, 1);
      g.fillRect(px, py, 2, 1);
      g.fillStyle(0xe8f6ff, 1);
      g.fillRect(px, py, 1, 1);
    }

    g.generateTexture('arena_ice', tw, th);
    g.destroy();
    this.textures.get('arena_ice').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  createArenaWoodTexture() {
    // Tile 64×64 seamless — tábuas de madeira com veios e nós
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0x5a3a22, // tábua escura
      0x6e4a2a, // tábua média
      0x8a5e34, // tábua clara
      0x3e2814, // sombra / junta
      0xa07040, // destaque
      0x4a3018, // veia
      0x7a5230, // nó
      0xb88850, // brilho
      0x644028, // tábua média-escura
      0x9a6840, // pó / desgaste
    ];

    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };

    const wrap = (v, m) => ((v % m) + m) % m;

    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    const plankH = 16;

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const plank = Math.floor(y / plankH);
        const localY = y % plankH;
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 19, tw), wrap(y + 11, th));
        const h = hash(x + plank * 17, y);

        let tone;
        if (n1 < 0.25) tone = tones[0];
        else if (n1 < 0.45) tone = tones[8];
        else if (n1 < 0.65) tone = tones[1];
        else if (n1 < 0.82) tone = tones[2];
        else tone = tones[4];

        // Offset por tábua para quebrar o padrão
        if ((plank & 1) === 1 && n1 > 0.4 && n1 < 0.7) tone = tones[1];

        if (n2 > 0.86) tone = tones[9];
        if (n2 < 0.14) tone = tones[0];

        // Juntas horizontais entre tábuas
        if (localY === 0 || localY === plankH - 1) tone = tones[3];
        // Junta vertical deslocada por fileira
        const seamX = wrap(plank * 23 + 8, tw);
        if (x === seamX || x === wrap(seamX + 32, tw)) tone = tones[3];

        // Veios longitudinais
        if ((h & 63) === 11 && localY > 2 && localY < plankH - 2) tone = tones[5];
        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[2];

        // Nós de madeira
        if ((h & 255) === 37) tone = tones[6];
        if ((h & 255) === 91) tone = tones[7];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    // Nós maiores
    const knots = [
      [12, 8], [40, 22], [28, 40], [52, 54], [6, 48], [48, 10],
    ];
    for (const [kx, ky] of knots) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy > 5) continue;
          const px = wrap(kx + dx, tw);
          const py = wrap(ky + dy, th);
          g.fillStyle(dx === 0 && dy === 0 ? 0x3e2814 : 0x6a4830, 1);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    g.generateTexture('arena_wood', tw, th);
    g.destroy();
    this.textures.get('arena_wood').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  createArenaSeaTexture() {
    // Tile 64×64 seamless — areia submarina com ondulações e pedrinhas
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0x3a6a78, // areia azulada escura
      0x4a8490, // areia média
      0x68a8b0, // areia clara
      0x2a4858, // sombra / fossa
      0x88c8c8, // brilho / água rasa
      0x5a9098, // ondulação
      0xc8b898, // areia bege
      0xa8d0c8, // highlight água
      0x487888, // fundo médio
      0xd8c8a8, // grão claro
    ];

    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };

    const wrap = (v, m) => ((v % m) + m) % m;

    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 19, tw), wrap(y + 11, th));
        const n3 = valueAt(wrap(x + 37, tw), wrap(y + 23, th));
        const h = hash(x, y);

        let tone;
        if (n1 < 0.22) tone = tones[3];
        else if (n1 < 0.4) tone = tones[0];
        else if (n1 < 0.58) tone = tones[8];
        else if (n1 < 0.74) tone = tones[1];
        else if (n1 < 0.88) tone = tones[2];
        else tone = tones[4];

        if (n2 > 0.84) tone = tones[4];
        if (n2 < 0.16) tone = tones[3];

        // Faixas de areia bege
        if (n3 > 0.82 && n1 > 0.35 && n1 < 0.75) tone = tones[6];
        if (n3 > 0.9) tone = tones[9];

        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[2];
        if ((h & 63) === 13) tone = tones[0];

        // Ondulações de luz na água
        const ripple =
          Math.abs(n3 - n1) < 0.035 && (hash(wrap(x + y, tw), wrap(y * 3, th)) & 3) !== 0;
        if (ripple && n1 > 0.3 && n1 < 0.8) tone = tones[5];

        // Grãos / pedrinhas
        if ((h & 127) === 21) tone = tones[6];
        if ((h & 127) === 42) tone = tones[7];
        if (n2 > 0.9 && (h & 7) === 3) tone = tones[9];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    const patches = [
      { x: 10, y: 14, r: 7, c: 0x4a8490 },
      { x: 42, y: 22, r: 6, c: 0x2a4858 },
      { x: 24, y: 46, r: 8, c: 0x68a8b0 },
      { x: 50, y: 48, r: 5, c: 0xc8b898 },
      { x: 56, y: 10, r: 4, c: 0x3a6a78 },
      { x: 14, y: 54, r: 5, c: 0xa8d0c8 },
    ];
    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.55 : 0.85);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    const pebbles = [
      [10, 18], [11, 19], [28, 8], [45, 30], [46, 31], [33, 52],
      [60, 40], [3, 35], [18, 38], [50, 12], [7, 48], [38, 42],
    ];
    for (const [px, py] of pebbles) {
      g.fillStyle(0xc8b898, 1);
      g.fillRect(px, py, 2, 1);
      g.fillStyle(0xe8d8b8, 1);
      g.fillRect(px, py, 1, 1);
    }

    g.generateTexture('arena_sea', tw, th);
    g.destroy();
    this.textures.get('arena_sea').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  createArenaDesertTexture() {
    // Tile 64×64 seamless — areia dourada com dunas e pedrinhas
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0xc4a06a, // areia base
      0xd8b878, // areia clara
      0xa88850, // areia escura
      0x8a6c3a, // sombra de duna
      0xe8d0a0, // highlight
      0xb89860, // tom médio
      0xf0e0b8, // brilho quente
      0x9a7848, // grão escuro
      0xccc090, // areia pálida
      0x705830, // pedra/sombra
    ];

    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };

    const wrap = (v, m) => ((v % m) + m) % m;

    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 17, tw), wrap(y + 9, th));
        const n3 = valueAt(wrap(x + 31, tw), wrap(y + 21, th));
        const h = hash(x, y);

        let tone;
        if (n1 < 0.2) tone = tones[3];
        else if (n1 < 0.38) tone = tones[2];
        else if (n1 < 0.55) tone = tones[0];
        else if (n1 < 0.72) tone = tones[5];
        else if (n1 < 0.88) tone = tones[1];
        else tone = tones[4];

        // Faixas de duna
        if (n2 > 0.82) tone = tones[4];
        if (n2 < 0.18) tone = tones[3];
        if (n3 > 0.86 && n1 > 0.3 && n1 < 0.7) tone = tones[8];
        if (n3 > 0.92) tone = tones[6];

        if ((h & 31) === 0) tone = tones[5];
        if ((h & 47) === 7) tone = tones[1];
        if ((h & 63) === 13) tone = tones[7];

        // Grãos
        if ((h & 127) === 21) tone = tones[6];
        if ((h & 127) === 42) tone = tones[9];
        if (n2 > 0.9 && (h & 7) === 3) tone = tones[4];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    const patches = [
      { x: 12, y: 16, r: 7, c: 0xd8b878 },
      { x: 40, y: 24, r: 6, c: 0x8a6c3a },
      { x: 26, y: 48, r: 8, c: 0xe8d0a0 },
      { x: 52, y: 50, r: 5, c: 0xa88850 },
      { x: 54, y: 12, r: 4, c: 0xc4a06a },
      { x: 16, y: 56, r: 5, c: 0xf0e0b8 },
    ];
    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.55 : 0.85);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    const pebbles = [
      [10, 18], [11, 19], [28, 8], [45, 30], [46, 31], [33, 52],
      [60, 40], [3, 35], [18, 38], [50, 12], [7, 48], [38, 42],
    ];
    for (const [px, py] of pebbles) {
      g.fillStyle(0x8a6c3a, 1);
      g.fillRect(px, py, 2, 1);
      g.fillStyle(0xb89860, 1);
      g.fillRect(px, py, 1, 1);
    }

    g.generateTexture('arena_desert', tw, th);
    g.destroy();
    this.textures.get('arena_desert').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  createArenaSwampTexture() {
    // Tile 64×64 seamless — lama escura, musgo e manchas de água
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0x2a3a22, // musgo escuro
      0x3a4e2e, // musgo médio
      0x4a6238, // musgo claro
      0x1e2e1a, // sombra
      0x5a7840, // broto pálido
      0x3a3020, // lama
      0x4a3e28, // lama clara
      0x243830, // água rasa
      0x1a2a28, // água escura
      0x6a5a38, // raiz / madeira
    ];

    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };

    const wrap = (v, m) => ((v % m) + m) % m;

    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 19, tw), wrap(y + 11, th));
        const n3 = valueAt(wrap(x + 37, tw), wrap(y + 23, th));
        const h = hash(x, y);

        let tone;
        if (n1 < 0.2) tone = tones[3];
        else if (n1 < 0.38) tone = tones[0];
        else if (n1 < 0.55) tone = tones[1];
        else if (n1 < 0.72) tone = tones[2];
        else if (n1 < 0.88) tone = tones[4];
        else tone = tones[5];

        // Manchas de lama
        if (n2 > 0.8 && n1 > 0.25 && n1 < 0.75) tone = tones[5];
        if (n2 > 0.9) tone = tones[6];
        if (n2 < 0.15) tone = tones[3];

        // Poças rasas no chão (decorativas — as sólidas são sprites)
        if (n3 > 0.88) tone = tones[7];
        if (n3 > 0.94) tone = tones[8];

        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[2];
        if ((h & 63) === 13) tone = tones[0];
        if ((h & 127) === 21) tone = tones[9];
        if ((h & 127) === 42) tone = tones[6];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    const patches = [
      { x: 14, y: 18, r: 8, c: 0x243830 },
      { x: 42, y: 28, r: 7, c: 0x1a2a28 },
      { x: 28, y: 50, r: 9, c: 0x3a3020 },
      { x: 52, y: 48, r: 6, c: 0x4a6238 },
      { x: 50, y: 14, r: 5, c: 0x2a3a22 },
      { x: 18, y: 54, r: 6, c: 0x1e2e1a },
    ];
    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.55 : 0.85);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    const twigs = [
      [10, 20], [11, 21], [30, 10], [46, 32], [47, 33], [34, 54],
      [58, 42], [4, 36], [20, 40], [52, 14], [8, 50], [40, 44],
    ];
    for (const [px, py] of twigs) {
      g.fillStyle(0x4a3e28, 1);
      g.fillRect(px, py, 2, 1);
      g.fillStyle(0x6a5a38, 1);
      g.fillRect(px, py, 1, 1);
    }

    g.generateTexture('arena_swamp', tw, th);
    g.destroy();
    this.textures.get('arena_swamp').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  createArenaVolcanoTexture() {
    // Tile 64×64 seamless — basalto escuro com veios de brasa
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0x1a1410, // basalto quase preto
      0x2a2018, // basalto
      0x3a2a20, // basalto médio
      0x12100c, // sombra
      0x4a3428, // pedra quente
      0x6a2818, // brasa escura
      0xa83818, // brasa
      0xe86820, // lava
      0xf0a040, // highlight quente
      0x5a4030, // cinza vulcânica
    ];

    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };
    const wrap = (v, m) => ((v % m) + m) % m;
    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 17, tw), wrap(y + 9, th));
        const n3 = valueAt(wrap(x + 31, tw), wrap(y + 21, th));
        const h = hash(x, y);

        let tone;
        if (n1 < 0.2) tone = tones[3];
        else if (n1 < 0.38) tone = tones[0];
        else if (n1 < 0.55) tone = tones[1];
        else if (n1 < 0.72) tone = tones[2];
        else if (n1 < 0.88) tone = tones[4];
        else tone = tones[9];

        if (n2 > 0.86) tone = tones[5];
        if (n2 > 0.93) tone = tones[6];
        if (n3 > 0.9 && n1 > 0.35 && n1 < 0.7) tone = tones[7];
        if (n3 > 0.95) tone = tones[8];

        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[2];
        if ((h & 63) === 13) tone = tones[0];
        if ((h & 127) === 21) tone = tones[5];
        if ((h & 127) === 42) tone = tones[9];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    const patches = [
      { x: 12, y: 16, r: 7, c: 0xa83818 },
      { x: 40, y: 24, r: 6, c: 0x1a1410 },
      { x: 26, y: 48, r: 8, c: 0x6a2818 },
      { x: 52, y: 50, r: 5, c: 0xe86820 },
      { x: 54, y: 12, r: 4, c: 0x2a2018 },
      { x: 16, y: 56, r: 5, c: 0xf0a040 },
    ];
    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.55 : 0.85);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    g.generateTexture('arena_volcano', tw, th);
    g.destroy();
    this.textures.get('arena_volcano').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  createArenaRuinsTexture() {
    // Tile 64×64 seamless — pedra antiga rachada e musgo
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0x4a4638, // pedra escura
      0x6a6450, // pedra
      0x8a8468, // pedra clara
      0x3a3628, // sombra
      0xa09a78, // highlight
      0x3a4a30, // musgo
      0x5a6a48, // musgo claro
      0x2e2a20, // rachadura
      0x706858, // tijolo antigo
      0x98906e, // pó / areia
    ];

    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };
    const wrap = (v, m) => ((v % m) + m) % m;
    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 19, tw), wrap(y + 11, th));
        const n3 = valueAt(wrap(x + 37, tw), wrap(y + 23, th));
        const h = hash(x, y);

        // Grade de lajes
        const tileX = x % 16;
        const tileY = y % 16;
        const seam = tileX === 0 || tileY === 0 || tileX === 15 || tileY === 15;

        let tone;
        if (n1 < 0.22) tone = tones[3];
        else if (n1 < 0.4) tone = tones[0];
        else if (n1 < 0.6) tone = tones[1];
        else if (n1 < 0.78) tone = tones[2];
        else if (n1 < 0.9) tone = tones[4];
        else tone = tones[8];

        if (seam) tone = tones[7];
        if (n2 > 0.84) tone = tones[5];
        if (n2 > 0.92) tone = tones[6];
        if (n3 > 0.9) tone = tones[9];
        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[2];
        if ((h & 63) === 13) tone = tones[0];
        if ((h & 127) === 21) tone = tones[5];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    const patches = [
      { x: 14, y: 18, r: 6, c: 0x3a4a30 },
      { x: 42, y: 28, r: 7, c: 0x2e2a20 },
      { x: 28, y: 50, r: 8, c: 0x8a8468 },
      { x: 52, y: 48, r: 5, c: 0x5a6a48 },
      { x: 50, y: 14, r: 5, c: 0x4a4638 },
      { x: 18, y: 54, r: 6, c: 0xa09a78 },
    ];
    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.55 : 0.85);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    g.generateTexture('arena_ruins', tw, th);
    g.destroy();
    this.textures.get('arena_ruins').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  createArenaCrystalTexture() {
    // Tile 64×64 seamless — caverna escura com brilho violeta/ciano
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tones = [
      0x141820, // pedra de caverna
      0x1e2430, // pedra
      0x2a3240, // pedra clara
      0x0c1018, // sombra
      0x3a4458, // highlight
      0x3a2860, // violeta
      0x5a40a0, // cristal
      0x80c0e8, // brilho ciano
      0xc090ff, // brilho lilás
      0x243048, // veia mineral
    ];

    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };
    const wrap = (v, m) => ((v % m) + m) % m;
    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 17, tw), wrap(y + 9, th));
        const n3 = valueAt(wrap(x + 31, tw), wrap(y + 21, th));
        const h = hash(x, y);

        let tone;
        if (n1 < 0.2) tone = tones[3];
        else if (n1 < 0.38) tone = tones[0];
        else if (n1 < 0.55) tone = tones[1];
        else if (n1 < 0.72) tone = tones[2];
        else if (n1 < 0.88) tone = tones[4];
        else tone = tones[9];

        if (n2 > 0.86) tone = tones[5];
        if (n2 > 0.93) tone = tones[6];
        if (n3 > 0.9 && n1 > 0.3 && n1 < 0.75) tone = tones[7];
        if (n3 > 0.95) tone = tones[8];

        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[2];
        if ((h & 63) === 13) tone = tones[0];
        if ((h & 127) === 21) tone = tones[5];
        if ((h & 127) === 42) tone = tones[7];

        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    const patches = [
      { x: 12, y: 16, r: 6, c: 0x5a40a0 },
      { x: 40, y: 24, r: 5, c: 0x80c0e8 },
      { x: 26, y: 48, r: 7, c: 0x3a2860 },
      { x: 52, y: 50, r: 5, c: 0xc090ff },
      { x: 54, y: 12, r: 4, c: 0x1e2430 },
      { x: 16, y: 56, r: 5, c: 0x2a3240 },
    ];
    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.5 : 0.8);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    g.generateTexture('arena_crystal', tw, th);
    g.destroy();
    this.textures.get('arena_crystal').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /**
   * Gera tile seamless 64×64 a partir de paleta (mesmas regras dos arenas legados).
   * @param {string} key
   * @param {number[]} tones — 10 cores
   * @param {{x:number,y:number,r:number,c:number}[]} [patches]
   */
  createArenaFloorFromPalette(key, tones, patches = []) {
    const tw = 64;
    const th = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const hash = (x, y) => {
      let n = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      n = (n ^ (n >>> 13)) * 1274126177;
      return (n ^ (n >>> 16)) >>> 0;
    };
    const wrap = (v, m) => ((v % m) + m) % m;
    const cell = 8;
    const valueAt = (x, y) => {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const g00 = (hash(wrap(gx, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g10 = (hash(wrap(gx + 1, tw / cell), wrap(gy, th / cell)) & 255) / 255;
      const g01 = (hash(wrap(gx, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const g11 = (hash(wrap(gx + 1, tw / cell), wrap(gy + 1, th / cell)) & 255) / 255;
      const a = g00 + (g10 - g00) * sx;
      const b = g01 + (g11 - g01) * sx;
      return a + (b - a) * sy;
    };

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const n1 = valueAt(x, y);
        const n2 = valueAt(wrap(x + 17, tw), wrap(y + 9, th));
        const n3 = valueAt(wrap(x + 31, tw), wrap(y + 21, th));
        const h = hash(x, y);
        let tone;
        if (n1 < 0.2) tone = tones[3];
        else if (n1 < 0.38) tone = tones[0];
        else if (n1 < 0.55) tone = tones[1];
        else if (n1 < 0.72) tone = tones[2];
        else if (n1 < 0.88) tone = tones[4];
        else tone = tones[5];
        if (n2 > 0.88) tone = tones[6];
        if (n2 > 0.94) tone = tones[7];
        if (n3 > 0.92) tone = tones[8];
        if ((h & 31) === 0) tone = tones[1];
        if ((h & 47) === 7) tone = tones[9] ?? tones[2];
        g.fillStyle(tone, 1);
        g.fillRect(x, y, 1, 1);
      }
    }

    for (const p of patches) {
      for (let dy = -p.r; dy <= p.r; dy++) {
        for (let dx = -p.r; dx <= p.r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const px = wrap(p.x + dx, tw);
          const py = wrap(p.y + dy, th);
          const edge = d2 / (p.r * p.r);
          if (edge > 0.55 && (hash(px, py) & 3) !== 0) continue;
          g.fillStyle(p.c, edge > 0.35 ? 0.5 : 0.8);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    g.generateTexture(key, tw, th);
    g.destroy();
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /** Expansão de terrenos (+20 + +15) com as mesmas regras de tile procedural. */
  createExpandedArenaFloors() {
    const floors = [
      ['arena_snow', [0xe8eef5, 0xf5f8fc, 0xd0d8e4, 0xb8c4d4, 0xffffff, 0xc8d4e4, 0xa8b8cc, 0x90a4bc, 0xdde6f0, 0x7a8ea8], [{ x: 20, y: 22, r: 6, c: 0xffffff }, { x: 48, y: 40, r: 5, c: 0xd0d8e4 }]],
      ['arena_tundra', [0xb8c8b0, 0xd0dcc8, 0x98a890, 0x7a8a70, 0xe0e8d8, 0xa8b898, 0xc0d0b8, 0x889878, 0xd8e4cc, 0x6a7a60], [{ x: 16, y: 30, r: 5, c: 0xd0dcc8 }, { x: 44, y: 18, r: 4, c: 0xe0e8d8 }]],
      ['arena_cave', [0x2a3038, 0x3a424c, 0x1a1e24, 0x101418, 0x4a5460, 0x242a32, 0x5a6470, 0x181c22, 0x6a7480, 0x0c1014], [{ x: 28, y: 24, r: 5, c: 0x3a424c }, { x: 50, y: 48, r: 6, c: 0x1a1e24 }]],
      ['arena_dungeon', [0x3a3a42, 0x4a4a54, 0x2a2a32, 0x1c1c22, 0x5a5a66, 0x34343c, 0x6a6a78, 0x222228, 0x787888, 0x141418], [{ x: 12, y: 12, r: 4, c: 0x4a4a54 }, { x: 40, y: 40, r: 5, c: 0x2a2a32 }]],
      ['arena_graveyard', [0x3a4238, 0x4a5448, 0x2a3228, 0x1a2018, 0x5a6458, 0x343c30, 0x6a7468, 0x222820, 0x788078, 0x121610], [{ x: 22, y: 36, r: 5, c: 0x4a5448 }, { x: 50, y: 20, r: 4, c: 0x2a3228 }]],
      ['arena_hell', [0x4a1410, 0x6a2018, 0x2a0c08, 0x180604, 0x8a3020, 0x3a100c, 0xaa4422, 0xc05030, 0xff6622, 0x100402], [{ x: 18, y: 20, r: 6, c: 0xaa4422 }, { x: 46, y: 44, r: 7, c: 0x6a2018 }]],
      ['arena_sky', [0x7eb8e8, 0xa0d0f5, 0x5a98d0, 0x3a78b0, 0xc8e8ff, 0x88c0e8, 0xffffff, 0xd8f0ff, 0x4a88c0, 0xb0dcff], [{ x: 24, y: 18, r: 8, c: 0xffffff }, { x: 48, y: 42, r: 6, c: 0xd8f0ff }]],
      ['arena_mushroom', [0x4a3a58, 0x6a5080, 0x2a2038, 0x1a1428, 0x8a70a8, 0x3a2a48, 0xb090c8, 0x705090, 0xd0b0e0, 0x181028], [{ x: 20, y: 28, r: 5, c: 0xb090c8 }, { x: 44, y: 16, r: 4, c: 0x8a70a8 }]],
      ['arena_jungle', [0x145a32, 0x1e8449, 0x0a3018, 0x062010, 0x27ae60, 0x0e4020, 0x58d68d, 0x0a2814, 0x82e0aa, 0x041808], [{ x: 16, y: 22, r: 6, c: 0x1e8449 }, { x: 42, y: 48, r: 5, c: 0x145a32 }]],
      ['arena_mountain', [0x6a7078, 0x8a9098, 0x4a5058, 0x323840, 0xaab0b8, 0x5a6068, 0xc0c6cc, 0x404850, 0xd8dce0, 0x282e34], [{ x: 30, y: 20, r: 6, c: 0x8a9098 }, { x: 14, y: 46, r: 5, c: 0x4a5058 }]],
      ['arena_beach', [0xe8d4a8, 0xf5e6c8, 0xd0b888, 0xb89868, 0xfff4dc, 0xdcc898, 0xa88858, 0xc8b078, 0xf0e0b8, 0x887848], [{ x: 18, y: 40, r: 5, c: 0x7eb8e8 }, { x: 50, y: 24, r: 4, c: 0xf5e6c8 }]],
      ['arena_coral', [0x2a6a8a, 0x3a8ab0, 0x1a4a68, 0x0e3048, 0x5ab0d0, 0x245870, 0xe74c3c, 0xf1948a, 0x48c9b0, 0x163848], [{ x: 22, y: 26, r: 5, c: 0xe74c3c }, { x: 46, y: 44, r: 5, c: 0x48c9b0 }]],
      ['arena_ashland', [0x3a2a20, 0x4a3830, 0x2a1c14, 0x181008, 0x5a4840, 0x322820, 0x6e2c00, 0xa04000, 0x7a6860, 0x100c08], [{ x: 28, y: 32, r: 6, c: 0x6e2c00 }, { x: 12, y: 14, r: 4, c: 0x4a3830 }]],
      ['arena_enchanted', [0x3a2858, 0x5a40a0, 0x241848, 0x140c28, 0x80c0e8, 0x342060, 0xc090ff, 0x7dcea0, 0xd2b4de, 0x1a1030], [{ x: 20, y: 20, r: 5, c: 0xc090ff }, { x: 48, y: 40, r: 6, c: 0x80c0e8 }]],
      ['arena_blood', [0x4a1010, 0x6a1818, 0x2a0808, 0x180404, 0x8a2020, 0x3a0c0c, 0xc0392b, 0x922b21, 0xe74c3c, 0x100202], [{ x: 24, y: 28, r: 6, c: 0xc0392b }, { x: 50, y: 16, r: 5, c: 0x6a1818 }]],
      ['arena_shadow', [0x140018, 0x220028, 0x0a0010, 0x050008, 0x3a1048, 0x180020, 0x5a2080, 0x2c003e, 0x8e44ad, 0x080010], [{ x: 30, y: 30, r: 6, c: 0x5a2080 }, { x: 14, y: 48, r: 4, c: 0x2c003e }]],
      ['arena_temple', [0xc4a060, 0xd8b878, 0xa88848, 0x7a6028, 0xe8d090, 0xb89858, 0xf4d03f, 0x8a7030, 0xffe8a8, 0x5a4818], [{ x: 20, y: 20, r: 5, c: 0xd8b878 }, { x: 44, y: 44, r: 5, c: 0xa88848 }]],
      ['arena_sewer', [0x3a4230, 0x4a5440, 0x2a3220, 0x1a2010, 0x5a6450, 0x343c28, 0x556b2f, 0x334018, 0x6a7858, 0x121608], [{ x: 18, y: 36, r: 5, c: 0x334018 }, { x: 46, y: 18, r: 6, c: 0x4a5440 }]],
      ['arena_meadow', [0x7dcea0, 0xa9dfbf, 0x58d68d, 0x27ae60, 0xd5f5e3, 0x6fcf9a, 0xf9e79f, 0x1e8449, 0x82e0aa, 0x145a32], [{ x: 24, y: 24, r: 5, c: 0xf9e79f }, { x: 48, y: 40, r: 4, c: 0xa9dfbf }]],
      ['arena_lava_field', [0x3a1808, 0x5a280c, 0x2a1004, 0x180802, 0x8a3a10, 0x4a2008, 0xe67e22, 0xff6622, 0xcb4335, 0x100401], [{ x: 22, y: 22, r: 7, c: 0xe67e22 }, { x: 46, y: 46, r: 6, c: 0xff6622 }]],
      // Expansão +15 terrenos
      ['arena_glacier', [0xb8d4e8, 0xd0e8f5, 0x88b8d0, 0x5a90b0, 0xe8f4fc, 0xa0c8e0, 0xffffff, 0x70a8c8, 0xc8e0f0, 0x3a7088], [{ x: 18, y: 22, r: 7, c: 0xffffff }, { x: 44, y: 46, r: 6, c: 0x88b8d0 }]],
      ['arena_oasis', [0xc8b070, 0xe0d090, 0x3a8a50, 0x2a6038, 0xf0e0a8, 0xa89858, 0x58d68d, 0x7dcea0, 0xd4c080, 0x1e8449], [{ x: 22, y: 28, r: 6, c: 0x58d68d }, { x: 48, y: 18, r: 5, c: 0xe0d090 }]],
      ['arena_canyon', [0xb85a28, 0xd47840, 0x8a4018, 0x5a280c, 0xe89858, 0xa05020, 0xf0b070, 0x6a3010, 0xc86830, 0x3a1808], [{ x: 16, y: 36, r: 6, c: 0x8a4018 }, { x: 42, y: 20, r: 5, c: 0xd47840 }]],
      ['arena_marsh', [0x4a5a28, 0x6a7a38, 0x2a3a18, 0x1a2410, 0x8a9a48, 0x3a4a20, 0x3a6a58, 0x2a5040, 0x5a7040, 0x142010], [{ x: 20, y: 30, r: 6, c: 0x3a6a58 }, { x: 46, y: 42, r: 5, c: 0x6a7a38 }]],
      ['arena_aurora', [0x1a2040, 0x2a3058, 0x101828, 0x080c18, 0x3a4870, 0x1e2848, 0x58d68d, 0xc39bd3, 0x85c1e9, 0x0c1020], [{ x: 24, y: 18, r: 7, c: 0x58d68d }, { x: 48, y: 44, r: 6, c: 0xc39bd3 }]],
      ['arena_obsidian', [0x14181c, 0x222830, 0x0a0c10, 0x040608, 0x323840, 0x181c22, 0x4a5060, 0x1a2030, 0x5a6880, 0x020304], [{ x: 28, y: 26, r: 5, c: 0x4a5060 }, { x: 12, y: 48, r: 4, c: 0x222830 }]],
      ['arena_sandstone', [0xd4a574, 0xe8c090, 0xb88850, 0x8a6030, 0xf5d8a8, 0xc49860, 0xa07038, 0xf0c878, 0xdeba88, 0x6a4820], [{ x: 20, y: 22, r: 5, c: 0xe8c090 }, { x: 44, y: 40, r: 5, c: 0xb88850 }]],
      ['arena_storm', [0x3a4a68, 0x5a6a88, 0x2a3450, 0x1a2438, 0x7a8aa8, 0x344058, 0xc0d0e8, 0xf0f4ff, 0x4a80c0, 0x121828], [{ x: 18, y: 20, r: 6, c: 0xc0d0e8 }, { x: 46, y: 46, r: 5, c: 0x5a6a88 }]],
      ['arena_garden', [0x5aad70, 0x7dcea0, 0x3a8a50, 0x286038, 0xa9dfbf, 0x4a9a60, 0xf1948a, 0xf5b7b1, 0xf9e79f, 0x1e8449], [{ x: 22, y: 24, r: 5, c: 0xf1948a }, { x: 48, y: 40, r: 4, c: 0xf9e79f }]],
      ['arena_battlefield', [0x5a4030, 0x6a5040, 0x3a2818, 0x241808, 0x7a6050, 0x4a3428, 0x7b241c, 0x922b21, 0x8a7060, 0x181008], [{ x: 26, y: 30, r: 6, c: 0x7b241c }, { x: 14, y: 16, r: 4, c: 0x6a5040 }]],
      ['arena_library', [0x6a4020, 0x8a5830, 0x4a2810, 0x2a1808, 0xa87040, 0x5a3418, 0xc49058, 0xd4a878, 0x3a2010, 0x1a1008], [{ x: 16, y: 20, r: 4, c: 0x8a5830 }, { x: 40, y: 44, r: 5, c: 0x4a2810 }]],
      ['arena_catacomb', [0x6a6860, 0x8a8880, 0x4a4840, 0x323028, 0xa8a498, 0x5a5850, 0xc8c4b8, 0x404038, 0xd8d4c8, 0x242220], [{ x: 24, y: 28, r: 5, c: 0xc8c4b8 }, { x: 48, y: 18, r: 4, c: 0x4a4840 }]],
      ['arena_abyss', [0x0c2848, 0x143860, 0x081828, 0x040c18, 0x1e4a78, 0x102038, 0x48c9b0, 0x5dade2, 0x1a5276, 0x020810], [{ x: 20, y: 26, r: 6, c: 0x48c9b0 }, { x: 46, y: 44, r: 5, c: 0x143860 }]],
      ['arena_bramble', [0x1e4a28, 0x2e6a38, 0x123018, 0x0a2010, 0x3e8a48, 0x1a3a20, 0x58a060, 0x0e2814, 0x6ab070, 0x081808], [{ x: 18, y: 22, r: 5, c: 0x2e6a38 }, { x: 44, y: 46, r: 6, c: 0x123018 }]],
      ['arena_saltflat', [0xe8e0d0, 0xf5f0e4, 0xd0c8b8, 0xb8b0a0, 0xffffff, 0xdcd4c4, 0xc8c0b0, 0xa8a090, 0xf0e8dc, 0x908878], [{ x: 22, y: 24, r: 6, c: 0xffffff }, { x: 48, y: 42, r: 5, c: 0xd0c8b8 }]],
    ];
    for (const [key, tones, patches] of floors) {
      this.createArenaFloorFromPalette(key, tones, patches);
    }
  }

  createCactusSprites() {
    // D=sombra, L=verde escuro, M=verde médio, H=highlight, S=areia/base, F=flor
    const green = { D: 0x1a3a18, L: 0x2e6b28, M: 0x4a9a3a, H: 0x7ec85a, S: 0xa88850, F: 0xe878a0 };
    const sage = { D: 0x243828, L: 0x3a6a40, M: 0x5a9a58, H: 0x8ccc78, S: 0xb89860, F: 0xf0a060 };
    const olive = { D: 0x2a3a10, L: 0x4a6820, M: 0x6a9030, H: 0x9cbc50, S: 0xc4a06a, F: 0xffd060 };

    // Cacto pequeno (barrel / stub)
    makePixelTexture(
      this,
      'cactus_small_0',
      [
        '..........',
        '...HHH....',
        '..HMMMH...',
        '..HMMMM...',
        '..LMMMM...',
        '..LMMML...',
        '...LLL....',
        '...SSS....',
        '..........',
        '..........',
      ],
      green,
      3
    );
    makePixelTexture(
      this,
      'cactus_small_1',
      [
        '..........',
        '....HH....',
        '...HMMH...',
        '...HMMM...',
        '...LMMM...',
        '...LMML...',
        '....LL....',
        '...SSS....',
        '..........',
        '..........',
      ],
      sage,
      3
    );
    makePixelTexture(
      this,
      'cactus_small_2',
      [
        '..........',
        '...HFH....',
        '..HMMMH...',
        '..HMMMM...',
        '..LMMMM...',
        '..LMMML...',
        '...LLL....',
        '...SSS....',
        '..........',
        '..........',
      ],
      olive,
      3
    );

    // Cacto médio (com um braço)
    makePixelTexture(
      this,
      'cactus_med_0',
      [
        '..............',
        '.....HH.......',
        '....HMMH......',
        '....HMMM......',
        '..HH.LMMM.....',
        '.HMMHLMMM.....',
        '.HMMMLMMM.....',
        '..LL.LMMM.....',
        '.....LMML.....',
        '......LL......',
        '.....SSS......',
        '..............',
      ],
      green,
      3
    );
    makePixelTexture(
      this,
      'cactus_med_1',
      [
        '..............',
        '......HH......',
        '.....HMMH.....',
        '.....HMMM.....',
        '.....LMMM.HH..',
        '.....LMMM.HMM.',
        '.....LMMMLHMM.',
        '.....LMMM.LL..',
        '.....LMML.....',
        '......LL......',
        '.....SSS......',
        '..............',
      ],
      sage,
      3
    );
    makePixelTexture(
      this,
      'cactus_med_2',
      [
        '..............',
        '.....HFH......',
        '....HMMH......',
        '....HMMM......',
        '..HH.LMMM.....',
        '.HMMHLMMM.....',
        '.HMMMLMMM.....',
        '..LL.LMML.....',
        '.....LML......',
        '......LL......',
        '.....SSS......',
        '..............',
      ],
      olive,
      3
    );

    // Cacto alto (dois braços)
    makePixelTexture(
      this,
      'cactus_tall_0',
      [
        '................',
        '.......HH.......',
        '......HMMH......',
        '......HMMM......',
        '..HH..LMMM......',
        '.HMMH.LMMM......',
        '.HMMMHLMMM.HH...',
        '..LL.MLMMM.HMM..',
        '.....MLMMM.HMM..',
        '.....MLMMM.LL...',
        '.....MLMML......',
        '......LLL.......',
        '......SSS.......',
        '................',
      ],
      green,
      3
    );
    makePixelTexture(
      this,
      'cactus_tall_1',
      [
        '................',
        '.......HH.......',
        '......HMMH......',
        '......HMMM......',
        '......LMMM..HH..',
        '..HH..LMMM.HMMH.',
        '.HMMH.LMMM.HMMM.',
        '.HMMMHLMMM..LL..',
        '..LL.MLMMM......',
        '.....MLMML......',
        '.....MLML.......',
        '......LLL.......',
        '......SSS.......',
        '................',
      ],
      sage,
      3
    );
    makePixelTexture(
      this,
      'cactus_tall_2',
      [
        '................',
        '.......HF.......',
        '......HMMH......',
        '......HMMM......',
        '..HH..LMMM......',
        '.HMMH.LMMM.HH...',
        '.HMMMHLMMM.HMM..',
        '..LL.MLMMM.HMM..',
        '.....MLMMM.LL...',
        '.....MLMML......',
        '......LML.......',
        '......LLL.......',
        '......SSS.......',
        '................',
      ],
      olive,
      3
    );
  }

  createPuddleSprites() {
    // D=borda lama, L=água escura, M=água média, H=brilho, R=reflexo
    const murky = { D: 0x2a2418, L: 0x1a3830, M: 0x2a5848, H: 0x4a8870, R: 0x6aaa90 };
    const deep = { D: 0x221c14, L: 0x142828, M: 0x204040, H: 0x386858, R: 0x589878 };
    const algae = { D: 0x2e2818, L: 0x1e3a28, M: 0x2e5a38, H: 0x4a7a50, R: 0x6a9a68 };

    makePixelTexture(
      this,
      'puddle_small_0',
      [
        '..........',
        '..DDDDD...',
        '.DLMMMHD..',
        '.DMMRRMMD.',
        '.DHMMMMD..',
        '..DDDDD...',
        '..........',
        '..........',
        '..........',
        '..........',
      ],
      murky,
      3
    );
    makePixelTexture(
      this,
      'puddle_small_1',
      [
        '..........',
        '...DDDD...',
        '..DLMMHD..',
        '.DMMRRMMD.',
        '..DHMMMD..',
        '...DDDD...',
        '..........',
        '..........',
        '..........',
        '..........',
      ],
      deep,
      3
    );
    makePixelTexture(
      this,
      'puddle_small_2',
      [
        '..........',
        '..DDDDD...',
        '.DLMMRHD..',
        '.DMMHMMMD.',
        '.DHMMMMD..',
        '..DDDDD...',
        '..........',
        '..........',
        '..........',
        '..........',
      ],
      algae,
      3
    );

    makePixelTexture(
      this,
      'puddle_med_0',
      [
        '..............',
        '...DDDDDD.....',
        '..DLMMMMHD....',
        '.DLMMRRMMMHD..',
        '.DMMMMMMMMMD..',
        '.DHMMRRMMMMD..',
        '..DHMMMMMHD...',
        '...DDDDDD.....',
        '..............',
        '..............',
        '..............',
        '..............',
      ],
      murky,
      3
    );
    makePixelTexture(
      this,
      'puddle_med_1',
      [
        '..............',
        '....DDDDD.....',
        '..DDLMMMHD....',
        '.DLMMRRMMHD...',
        '.DMMMMMMMMMD..',
        '.DHMMRRMMMD...',
        '..DHMMMMHD....',
        '....DDDDD.....',
        '..............',
        '..............',
        '..............',
        '..............',
      ],
      deep,
      3
    );
    makePixelTexture(
      this,
      'puddle_med_2',
      [
        '..............',
        '...DDDDDD.....',
        '..DLMRMMHD....',
        '.DLMMMMMMMHD..',
        '.DMMHRRMMMMD..',
        '.DHMMMMMMMD...',
        '..DHMMMMHD....',
        '...DDDDDD.....',
        '..............',
        '..............',
        '..............',
        '..............',
      ],
      algae,
      3
    );

    makePixelTexture(
      this,
      'puddle_large_0',
      [
        '................',
        '....DDDDDDD.....',
        '...DLMMMMMHD....',
        '..DLMMRRMMMMHD..',
        '.DLMMMMMMMMMMD..',
        '.DMMMMHRRMMMMD..',
        '.DHMMMMMMMMMHD..',
        '..DHMMRRMMMHD...',
        '...DHMMMMMHD....',
        '....DDDDDDD.....',
        '................',
        '................',
        '................',
        '................',
      ],
      murky,
      3
    );
    makePixelTexture(
      this,
      'puddle_large_1',
      [
        '................',
        '.....DDDDDD.....',
        '...DDLMMMMHD....',
        '..DLMMRRMMMHD...',
        '.DLMMMMMMMMMMD..',
        '.DMMHRRMMMMMMD..',
        '.DHMMMMMMMMMHD..',
        '..DHMMRRMMHD....',
        '...DHMMMMHD.....',
        '.....DDDDDD.....',
        '................',
        '................',
        '................',
        '................',
      ],
      deep,
      3
    );
    makePixelTexture(
      this,
      'puddle_large_2',
      [
        '................',
        '....DDDDDDD.....',
        '...DLMRMMMHD....',
        '..DLMMMMMMMMHD..',
        '.DLMMHRRMMMMMD..',
        '.DMMMMMMMMMMMD..',
        '.DHMMMMRRMMMHD..',
        '..DHMMMMMMHD....',
        '...DHMMMMHD.....',
        '....DDDDDDD.....',
        '................',
        '................',
        '................',
        '................',
      ],
      algae,
      3
    );
  }

  createVolcanoSprites() {
    // D=sombra, L=escuro, M=médio, H=highlight, E=brasa, C=fissura
    const hot = { D: 0x1a100c, L: 0x2a1a14, M: 0x3a2820, H: 0x5a4030, E: 0xe86820, C: 0xa83818 };
    const magma = { D: 0x120c08, L: 0x241810, M: 0x3a2418, H: 0x6a4028, E: 0xf0a040, C: 0xc85018 };
    const black = { D: 0x0a0a0c, L: 0x141418, M: 0x222228, H: 0x3a3a48, E: 0x5a2860, C: 0x1a1a22 };

    makePixelTexture(
      this,
      'volc_ember_0',
      [
        '..........',
        '...DDD....',
        '..DLHMD...',
        '.DLMEMMLD.',
        '.DLMMCMLD.',
        '..DLMMD...',
        '...DDD....',
        '..........',
      ],
      hot,
      3
    );
    makePixelTexture(
      this,
      'volc_ember_1',
      [
        '..........',
        '..DDDDDD..',
        '.DLMHMELD.',
        '.DLMMMCLD.',
        '..DDDDDD..',
        '..........',
        '..........',
        '..........',
      ],
      magma,
      3
    );
    makePixelTexture(
      this,
      'volc_ember_2',
      [
        '..........',
        '....DD....',
        '...DLHD...',
        '..DLMEMD..',
        '.DLMMCMLD.',
        '..DLMMD...',
        '...DDD....',
        '..........',
      ],
      hot,
      3
    );

    makePixelTexture(
      this,
      'volc_lava_0',
      [
        '............',
        '...DDDDDD...',
        '..DLMHMMLD..',
        '.DLMEMMMMLD.',
        '.DLMMCMMMHD.',
        '.DHMMMMEMLD.',
        '..DLMMMMLD..',
        '...DDDDDD...',
        '............',
        '............',
      ],
      magma,
      3
    );
    makePixelTexture(
      this,
      'volc_lava_1',
      [
        '............',
        '....DDDD....',
        '...DLHMHD...',
        '..DLMEMMMLD.',
        '.DLMMCMMMHD.',
        '.DHMMMMEMLD.',
        '..DDLMMMLD..',
        '...DDDDDD...',
        '............',
        '............',
      ],
      hot,
      3
    );
    makePixelTexture(
      this,
      'volc_lava_2',
      [
        '............',
        '..DDDDDDD...',
        '.DLMHMMMELD.',
        '.DLMEMMMMLD.',
        '.DHMMCMMMHD.',
        '..DLMMMMLD..',
        '...DDDDDD...',
        '............',
        '............',
        '............',
      ],
      magma,
      3
    );

    makePixelTexture(
      this,
      'volc_obsidian_0',
      [
        '................',
        '.....DDDDD......',
        '...DDLHMMLD.....',
        '..DLMHMMMMLD....',
        '.DLMMMMHCMMMLD..',
        '.DLMHMMMMMHMLD..',
        '.DLMMMMMMMMMLD..',
        '..DLMMMCMMLD....',
        '...DLMMMMLD.....',
        '....DDLCLDD.....',
        '.....DDDD.......',
        '................',
        '................',
        '................',
      ],
      black,
      3
    );
    makePixelTexture(
      this,
      'volc_obsidian_1',
      [
        '................',
        '...DDDDDDDDD....',
        '.DDLMHMHMMMLD...',
        'DLMMMMMMMMMMLD..',
        'DLMHMMMMMHMMLD..',
        'DLMMMMHCMMMMLD..',
        'DDLMHMMMMMMMLD..',
        '.DLMMMMMMMMLD...',
        '..DDLCLLLDD.....',
        '...DDDDDDD......',
        '................',
        '................',
        '................',
        '................',
      ],
      black,
      3
    );
    makePixelTexture(
      this,
      'volc_obsidian_2',
      [
        '................',
        '....DDDDDDD.....',
        '..DDLMHMMMLD....',
        '.DLMHMMMMMMLD...',
        '.DLMMMMHCMMMLD..',
        '.DHMMMMMMMHMLD..',
        '..DLMMMMMMMLD...',
        '...DLMMMMLD.....',
        '....DDLCLDD.....',
        '.....DDDD.......',
        '................',
        '................',
        '................',
        '................',
      ],
      black,
      3
    );
  }

  createRuinsSprites() {
    // D=sombra, L=escuro, M=pedra, H=claro, G=musgo, C=rachadura
    const stone = { D: 0x2a2618, L: 0x4a4638, M: 0x6a6450, H: 0x8a8468, G: 0x3a4a30, C: 0x3a3628 };
    const mossy = { D: 0x242018, L: 0x3a4a30, M: 0x5a6a48, H: 0x7a8a60, G: 0x2a3a22, C: 0x2e2a20 };
    const pale = { D: 0x3a3628, L: 0x6a6450, M: 0x8a8468, H: 0xa09a78, G: 0x5a6a48, C: 0x4a4638 };

    makePixelTexture(
      this,
      'ruin_rubble_0',
      [
        '..........',
        '...DDD....',
        '..DLHMD...',
        '.DLMMMGLD.',
        '.DLMMCMLD.',
        '..DLMMD...',
        '...DDD....',
        '..........',
      ],
      stone,
      3
    );
    makePixelTexture(
      this,
      'ruin_rubble_1',
      [
        '..........',
        '..DDDDDD..',
        '.DLMHMGLD.',
        '.DLMMMCLD.',
        '..DDDDDD..',
        '..........',
        '..........',
        '..........',
      ],
      mossy,
      3
    );
    makePixelTexture(
      this,
      'ruin_rubble_2',
      [
        '..........',
        '....DD....',
        '...DLHD...',
        '..DLMMGD..',
        '.DLMMCMLD.',
        '..DLMMD...',
        '...DDD....',
        '..........',
      ],
      pale,
      3
    );

    makePixelTexture(
      this,
      'ruin_pillar_0',
      [
        '............',
        '...HHHHHH...',
        '...HMMMHH...',
        '....LMML....',
        '....LMML....',
        '....LMGL....',
        '....LMML....',
        '....LMCL....',
        '....LMML....',
        '...DDDDDD...',
        '..DDDDDDDD..',
        '............',
      ],
      stone,
      3
    );
    makePixelTexture(
      this,
      'ruin_pillar_1',
      [
        '............',
        '..HHHHHHHH..',
        '..HHMMMHHH..',
        '...LMMMML...',
        '...LMMMGL...',
        '...LMMMML...',
        '...LMCMCL...',
        '...LMMMML...',
        '...LMMMML...',
        '..DDDDDDDD..',
        '.DDDDDDDDDD.',
        '............',
      ],
      mossy,
      3
    );
    makePixelTexture(
      this,
      'ruin_pillar_2',
      [
        '............',
        '....HHHH....',
        '...HHMMHH...',
        '...LMMMML...',
        '...LMMMML...',
        '...LMGGML...',
        '...LMMMML...',
        '...LMCMML...',
        '...LMMMML...',
        '...DDDDDD...',
        '..DDDDDDDD..',
        '............',
      ],
      pale,
      3
    );

    makePixelTexture(
      this,
      'ruin_statue_0',
      [
        '................',
        '......HHHH......',
        '.....HMMMHH.....',
        '.....HMHMHH.....',
        '......LMML......',
        '.....LLMMMLL....',
        '....LMMMMMML....',
        '....LMMGGMML....',
        '....LMMMMMML....',
        '.....LMCMML.....',
        '.....LMMMML.....',
        '....DDDDDDDD....',
        '...DDDDDDDDDD...',
        '................',
      ],
      stone,
      3
    );
    makePixelTexture(
      this,
      'ruin_statue_1',
      [
        '................',
        '.....HHHHHH.....',
        '....HHMMMMHH....',
        '....HHMHMHHH....',
        '.....LLMMML.....',
        '....LMMMMMML....',
        '...LMMMGMMMML...',
        '...LMMMMMMMML...',
        '...LMMCMCMMML...',
        '....LMMMMMML....',
        '....LMMMMMML....',
        '...DDDDDDDDDD...',
        '..DDDDDDDDDDDD..',
        '................',
      ],
      mossy,
      3
    );
    makePixelTexture(
      this,
      'ruin_statue_2',
      [
        '................',
        '......HHHH......',
        '.....HMMMMH.....',
        '.....HMHHMH.....',
        '......LMML......',
        '.....LMMMML.....',
        '....LMMGGMML....',
        '....LMMMMMML....',
        '....LMMCMMML....',
        '.....LMMMML.....',
        '.....LMMMML.....',
        '....DDDDDDDD....',
        '...DDDDDDDDDD...',
        '................',
      ],
      pale,
      3
    );
  }

  createCrystalSprites() {
    // D=sombra, L=base escura, M=cristal, H=brilho, C=núcleo, G=reflexo
    const amethyst = { D: 0x1a1028, L: 0x2a1848, M: 0x5a40a0, H: 0xc090ff, C: 0x80c0e8, G: 0xe8d0ff };
    const cyan = { D: 0x102028, L: 0x183848, M: 0x40a0c0, H: 0xa0e8ff, C: 0xc090ff, G: 0xe0f8ff };
    const rose = { D: 0x281018, L: 0x481828, M: 0xa04070, H: 0xffa0c8, C: 0xc090ff, G: 0xffd0e8 };

    makePixelTexture(
      this,
      'crystal_small_0',
      [
        '..........',
        '....H.....',
        '...HMH....',
        '..HMCMH...',
        '..LMMML...',
        '...LDD....',
        '..........',
        '..........',
      ],
      amethyst,
      3
    );
    makePixelTexture(
      this,
      'crystal_small_1',
      [
        '..........',
        '...H.H....',
        '..HMCMH...',
        '..HMMMH...',
        '...LDL....',
        '..........',
        '..........',
        '..........',
      ],
      cyan,
      3
    );
    makePixelTexture(
      this,
      'crystal_small_2',
      [
        '..........',
        '....G.....',
        '...HMH....',
        '..HMCMH...',
        '.LHMMMHL..',
        '..LDDDL...',
        '..........',
        '..........',
      ],
      rose,
      3
    );

    makePixelTexture(
      this,
      'crystal_med_0',
      [
        '............',
        '.....H......',
        '....HMH.....',
        '...HMCMH....',
        '..LHMMMHL...',
        '..LHMMMHL...',
        '...LMMML....',
        '....LDD.....',
        '............',
        '............',
      ],
      amethyst,
      3
    );
    makePixelTexture(
      this,
      'crystal_med_1',
      [
        '............',
        '....H.G.....',
        '...HMCMH....',
        '..LHMMMHL...',
        '..LHMMMHL...',
        '...HMMMH....',
        '...LDDDL....',
        '............',
        '............',
        '............',
      ],
      cyan,
      3
    );
    makePixelTexture(
      this,
      'crystal_med_2',
      [
        '............',
        '.....G......',
        '....HMH.....',
        '...HMCMH....',
        '..GHMMMHG...',
        '..LHMMMHL...',
        '...LMMML....',
        '....LDD.....',
        '............',
        '............',
      ],
      rose,
      3
    );

    makePixelTexture(
      this,
      'crystal_large_0',
      [
        '................',
        '.......H........',
        '......HMH.......',
        '.....HMCMH......',
        '....LHMMMHL.....',
        '...LHMMMMMHL....',
        '...LHMMMMMHL....',
        '....LHMMMHL.....',
        '.....LMMML......',
        '......LDD.......',
        '................',
        '................',
        '................',
        '................',
      ],
      amethyst,
      3
    );
    makePixelTexture(
      this,
      'crystal_large_1',
      [
        '................',
        '......H.G.......',
        '.....HMCMH......',
        '....LHMMMHL.....',
        '...LHMMMMMHL....',
        '...GHMMMMMHG....',
        '....LHMMMHL.....',
        '.....HMMMH......',
        '......LDD.......',
        '................',
        '................',
        '................',
        '................',
        '................',
      ],
      cyan,
      3
    );
    makePixelTexture(
      this,
      'crystal_large_2',
      [
        '................',
        '.......G........',
        '......HMH.......',
        '.....HMCMH......',
        '....GHMMMHG.....',
        '...LHMMMMMHL....',
        '...LHMMMMMHL....',
        '....LHMMMHL.....',
        '.....LMMML......',
        '.....LDDDL......',
        '................',
        '................',
        '................',
        '................',
      ],
      rose,
      3
    );
  }

  /** Title decoration: blue mana potion flask. */
  createManaPotionSprite() {
    makePixelTexture(
      this,
      'mana_potion',
      [
        '................',
        '......KKKK......',
        '......KCCK......',
        '......KCCK......',
        '.....GGGGGG.....',
        '....G......G....',
        '...G..LLLL..G...',
        '...G.LMMMML.G...',
        '..G.LMMMMMML.G..',
        '..G.LMMMMMML.G..',
        '..G.LMMMMMML.G..',
        '..G.LMMMMMML.G..',
        '..G..LMMMML..G..',
        '...G..LLLL..G...',
        '....G......G....',
        '.....GGGGGG.....',
        '................',
      ],
      {
        K: 0x5a3a1a, // rolha / rolha escura
        C: 0x8b5a2b, // rolha clara
        G: 0xc8e8ff, // vidro
        L: 0x3a7cff, // mana (claro)
        M: 0x1e4fd6, // mana (escuro)
      },
      3
    );
  }

  createWizardSprites() {
    // Shared pose: pointed hat, face, robe, boots + staff on the side
    const idle = [
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

    // Left foot planted forward/down, right tucked
    const walkL = [
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

    // Right foot planted forward/down, left tucked
    const walkR = [
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

    const schools = {
      crimson: {
        H: 0x8b1a1a,
        B: 0xf1c40f,
        S: 0xe8c39e,
        E: 0x1a1a1a,
        K: 0xc0392b,
        R: 0x922b21,
        L: 0x5d1a14,
        W: 0xf39c12,
        T: 0x6e2c00,
      },
      azure: {
        H: 0x1a3a6b,
        B: 0xaed6f1,
        S: 0xf5cba7,
        E: 0x1a1a1a,
        K: 0x3498db,
        R: 0x1f618d,
        L: 0x154360,
        W: 0x5dade2,
        T: 0x5d4037,
      },
      emerald: {
        H: 0x145a32,
        B: 0xf7dc6f,
        S: 0xedbb99,
        E: 0x1a1a1a,
        K: 0x27ae60,
        R: 0x1e8449,
        L: 0x0e3d22,
        W: 0x58d68d,
        T: 0x5d4037,
      },
      amber: {
        H: 0x7d3c00,
        B: 0xf9e79f,
        S: 0xf0b27a,
        E: 0x1a1a1a,
        K: 0xe67e22,
        R: 0xba4a00,
        L: 0x6e2c00,
        W: 0xf4d03f,
        T: 0x4e342e,
      },
      necromancer: {
        H: 0x1a0a22,
        B: 0x7b2cff,
        S: 0xc8b8a8,
        E: 0x4a0080,
        K: 0x3a2048,
        R: 0x1e1028,
        L: 0x120818,
        W: 0x9b4dff,
        T: 0x2a1838,
      },
    };

    for (const [type, palette] of Object.entries(schools)) {
      const base = `wizard_${type}`;
      makePixelTexture(this, base, idle, palette);
      makePixelTexture(this, `${base}_wL`, walkL, palette);
      makePixelTexture(this, `${base}_wR`, walkR, palette);

      const walkKey = `${base}_walk`;
      if (!this.anims.exists(walkKey)) {
        this.anims.create({
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
    }
  }

  createMonsterSprites() {
    // Imp — small red demon with horns + claws + belly shade
    registerMonsterSprite(
      this,
      'imp',
      [
        '................',
        '....HY....YH....',
        '...HYH....HYH...',
        '..HRRRRRRRRRRH..',
        '.HRRRRRRRRRRRRH.',
        '.HRRYBRRRBYRRRH.',
        '.HRRRWRRRRWRRRH.',
        '..HRRDDDDDRRH...',
        '...HRRDRDRRH.C..',
        '....HDDDDDH.C...',
        '...HRRC..CRRH...',
        '..HRR......RRH..',
        '.HRC........CRH.',
        '.C...Y....Y...C.',
        '................',
        '................',
      ],
      {
        H: 0x6b1a00,
        R: 0xe74c3c,
        D: 0xa93226,
        Y: 0xf1c40f,
        B: 0x1a1a1a,
        W: 0xff8a7a,
        C: 0xc0392b,
      }
    );

    // Slime — round green blob with shine, bubbles + drip
    registerMonsterSprite(
      this,
      'slime',
      [
        '................',
        '......GGGG......',
        '....GGLLLLGG....',
        '...GLLWWLLLLG...',
        '..GLLLWWLHLLLG..',
        '..GLLBBLLBBLLG..',
        '..GLLLWHLWLLLG..',
        '..GLLLLHLLLLLG..',
        '...GDLLLLLLDG...',
        '....GGDDDDGG....',
        '.....GGGGGG.....',
        '....G.GG.GG.G...',
        '.....G..G..G....',
        '......GG.GG.....',
        '................',
        '................',
      ],
      {
        G: 0x27ae60,
        L: 0x58d68d,
        D: 0x1e8449,
        W: 0xd5f5e3,
        B: 0x1a1a1a,
        H: 0x82e0aa,
      }
    );

    // Wraith — floating purple spirit with veil trails + core glow
    registerMonsterSprite(
      this,
      'wraith',
      [
        '................',
        '.....LLLLL......',
        '....LPPPPPL.....',
        '...LPPWPPWPL....',
        '...LPPCPPCPL....',
        '....LPPHPPL.....',
        '.....LCHCL......',
        '....LPPPPPL.....',
        '...LPPPLPPPL....',
        '..LPP.LP.LPPL...',
        '.LP..L.P.L..PL..',
        'LP..L..L..L..PL.',
        'L..L...L...L..L.',
        '....L.....L.....',
        '................',
        '................',
      ],
      {
        P: 0x8e44ad,
        L: 0xbb8fce,
        W: 0xf5eef8,
        C: 0x5dade2,
        H: 0xd2b4de,
      }
    );

    // Goblin — small green skirmisher with big ears + dagger
    registerMonsterSprite(
      this,
      'goblin',
      [
        '................',
        '.EE..........EE.',
        '.EGG........GGE.',
        '..EGGGGGGGGGGE..',
        '..EGGWYGGYWGE...',
        '...EGGHGGGHGE...',
        '...EGGDMMDGGE.S.',
        '....EGGGGGGE.S..',
        '.....EG..GE.S...',
        '....EGG..GGE....',
        '...EGG....GGE...',
        '..EGD......DGE..',
        '..E..........E..',
        '................',
        '................',
        '................',
      ],
      {
        E: 0x6b8e23,
        G: 0x9acd32,
        D: 0x556b2f,
        Y: 0xf1c40f,
        W: 0xf5f5dc,
        M: 0x8b4513,
        H: 0xb4d96a,
        S: 0xc0c0c0,
      }
    );

    // Orc — bulky green bruiser with tusks + armor plates
    registerMonsterSprite(
      this,
      'orc',
      [
        '................',
        '....OOOOOOOO....',
        '...OOLLLLLLOO...',
        '..OOLWLLLWLOO...',
        '..OOLHLHLHLHOO..',
        '..OOTLLLLLTTOO..',
        '...OLLAALAALO...',
        '..OOLLLLLLLOO...',
        '.OOOLLLLLLLOOO..',
        '.OOL.AA..AA.OO..',
        '.OO........OO...',
        'OO..........OO..',
        'OD..........DO..',
        '................',
        '................',
        '................',
      ],
      {
        O: 0x1e5c2a,
        L: 0x3d8b4a,
        W: 0xf5eef8,
        T: 0xf5f5dc,
        H: 0x58b86a,
        A: 0x6b5b3a,
        D: 0x143d1c,
      }
    );

    // Skeleton — melee undead with rusty blade + ribs
    registerMonsterSprite(
      this,
      'skeleton',
      [
        '................',
        '.....WWWWWW.....',
        '....WWBWWBWW....',
        '....WWHWWWHW....',
        '.....WWDDWW.....',
        '......WDDW......',
        '....RR.WW.RR....',
        '...RWWWDWDWWW...',
        '..R.WW.WW.WW....',
        '....WW....WW....',
        '....WD....DW....',
        '....W......W....',
        '................',
        '................',
        '................',
        '................',
      ],
      {
        W: 0xf0ebe0,
        B: 0x1a1410,
        D: 0xc8b8a8,
        R: 0x8a6a4a,
        H: 0xffffff,
      }
    );

    // Skeleton archer — ranged-only with bow + quiver detail
    registerMonsterSprite(
      this,
      'skeleton_archer',
      [
        '................',
        '.....WWWWWW.....',
        '....WWBWWBWW....',
        '....WWHWWWHW....',
        '.....WWDDWW.....',
        '..M...WDDW......',
        '.M.M.WWWDWW.A...',
        'M...WW.WW.WWA...',
        '.....WW..WW.A...',
        '.....WD..DW.Q...',
        '.....W....W.....',
        '.....W....W.....',
        '................',
        '................',
        '................',
        '................',
      ],
      {
        W: 0xe8e0d0,
        B: 0x1a1410,
        D: 0xb8a898,
        M: 0x6b4e2e,
        A: 0xc8b8a0,
        H: 0xffffff,
        Q: 0x8a6a4a,
      }
    );

    // Wolf — lean brown hunter with snout, fangs + bristled back
    registerMonsterSprite(
      this,
      'wolf',
      [
        '................',
        '...EE.A..A.EE...',
        '..EFF......FFE..',
        '..EFFFFFFFFFFE..',
        '..EFWBFFFFBWFE..',
        '...EFHFFFFHFE...',
        '....EFTFTFE.....',
        '...EFFFFFFFE....',
        '..EFHEA.AEHFE...',
        '.EF.AA....AA.FE.',
        'EF..........FE..',
        'T.A........A.T..',
        '................',
        '................',
        '................',
        '................',
      ],
      {
        E: 0x5c4030,
        F: 0x8b7355,
        W: 0xf5eef8,
        B: 0x1a1410,
        T: 0x3e2a1a,
        H: 0xa89070,
        A: 0x6b5344,
      }
    );

    // Giant spider — dark arachnid with many legs + abdomen pattern
    registerMonsterSprite(
      this,
      'giant_spider',
      [
        '................',
        'L..L........L..L',
        '.L..L......L..L.',
        '..L..DDDDDD..L..',
        '...LDDRRDDDL....',
        '..LDDRWWRRDDL...',
        '.LDDRRHHRRRDDL..',
        'LDDRRRRRRRRRDL..',
        '.L.DRRARRARD.L..',
        'L...DR....RD...L',
        '.....D....D.....',
        '....L......L....',
        '...L........L...',
        '..L..........L..',
        '................',
        '................',
      ],
      {
        D: 0x1a0f1c,
        R: 0x4a2048,
        W: 0xe74c3c,
        L: 0x2d1b2e,
        H: 0x6a3068,
        A: 0x7a2850,
      }
    );

    // Bat — small flying skirmisher with fangs + wing membrane detail
    registerMonsterSprite(
      this,
      'bat',
      [
        '................',
        'WW.W......W.WW..',
        '.WWHBBBBBBHWW...',
        'W.WBBHBBHBBW.W..',
        '...BBEYYEEBB....',
        '...BBBTBBTBB....',
        '....BBHHBB......',
        '....B....B......',
        '...W.W..W.W.....',
        '..W........W....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
      ],
      {
        B: 0x3a2a22,
        W: 0x5a4030,
        E: 0xf1c40f,
        Y: 0x1a1410,
        H: 0x7a5848,
        T: 0xf0ebe0,
      }
    );

    // Elf — nimble forest archer with pointed ears + bow + cloak
    registerMonsterSprite(
      this,
      'elf',
      [
        '................',
        '....N......N....',
        '...NHHHHHHHN....',
        '...HSSSSSSSH....',
        '...HSBEESBSH.A..',
        '....HSSWSSH.A...',
        '....HGGGGGH.A...',
        '...HGGCGCGGH....',
        '..HG.GGGG.GH.M..',
        '..HG......GH.M..',
        '..LL......LL....',
        '..L........L....',
        '................',
        '................',
        '................',
        '................',
      ],
      {
        N: 0xd4c48a,
        H: 0xc9a66b,
        S: 0xf0d0a8,
        B: 0x1a1a1a,
        E: 0x2ecc71,
        G: 0x3d8b4a,
        L: 0x5c4030,
        A: 0xc8e6a0,
        M: 0x6b4e2e,
        W: 0xffe8c8,
        C: 0x2d6b3a,
      }
    );

    // Beholder — olho central + pedúnculos + iris
    registerMonsterSprite(
      this,
      'beholder',
      [
        '................',
        '..E..E....E..E..',
        '..PE.P....P.EP..',
        '...PPPPPPPPPP...',
        '..PPYYYYYYYYPP..',
        '.PPYWWWWWWWWYPP.',
        '.PPYWBBBBBBWYPP.',
        '.PPYWBYCCYBWYPP.',
        '.PPYWBBBBBBWYPP.',
        '..PPYWWWWWWYPP..',
        '..PPPYYYYYYPPP..',
        '...PPPDDDDPPP...',
        '....PPPHHPPP....',
        '.....P....P.....',
        '................',
        '................',
      ],
      {
        P: 0x7d3c98,
        Y: 0xf4d03f,
        W: 0xfdfefe,
        B: 0x1a1a2e,
        D: 0x5b2c6f,
        E: 0xe74c3c,
        C: 0x5dade2,
        H: 0x9b59b6,
      }
    );

    // Dragon — corpo vermelho + asas + chifres + escama + fogo no peito
    registerMonsterSprite(
      this,
      'dragon',
      [
        '................',
        '..HY........YH..',
        '.HR..........RH.',
        '..RRW.TT..W.RR..',
        '.WRRRRRRRRRRRRW.',
        'WRRRYBRRRRBYRRRW',
        '.RRRRHRRRRHRRR..',
        '..RRRDDTDDRRR...',
        '.WWRRRDRDRRWW...',
        'WWRR.T....T.RRWW',
        '.RR...TT...RR...',
        '.R.R......R.R...',
        '..C.Y....Y.C....',
        '................',
        '................',
        '................',
      ],
      {
        R: 0xc0392b,
        D: 0x7b241c,
        Y: 0xf1c40f,
        B: 0x1a1a1a,
        W: 0xe67e22,
        H: 0x922b21,
        T: 0xff6644,
        C: 0xa93226,
      }
    );

    // Lich — capuz + crânio + orbe de gelo + runas no manto
    registerMonsterSprite(
      this,
      'lich',
      [
        '................',
        '.....HHHHH......',
        '....HNNNNNH.....',
        '...HNSSSSSNH....',
        '...HNSBEESNH.C..',
        '....HNSWSNH.COC.',
        '....HNNNNNH.C...',
        '...HPPPRPPPH....',
        '..HPPRPPPPRPPH..',
        '..HP.RPPPPR.PH..',
        '..LL..R..R..LL..',
        '..L........L....',
        '................',
        '................',
        '................',
        '................',
      ],
      {
        H: 0x2c3e50,
        N: 0x1a252f,
        S: 0xd5dbdb,
        B: 0x1a1a1a,
        E: 0x5dade2,
        P: 0x5d6d7e,
        L: 0x34495e,
        C: 0x66ccff,
        W: 0xffffff,
        O: 0xaaddff,
        R: 0x85c1e9,
      }
    );

    // Fire Elemental — chama viva com núcleo branco + faíscas
    registerMonsterSprite(
      this,
      'fire_elemental',
      [
        '......Y.........',
        '.....YOOY.Y.....',
        '....YORROYOO....',
        '...YORRRROYOY...',
        '..YORRWWWRROY...',
        '.YORRWBWBWRROY..',
        '.YORRRWWWRRROY..',
        '..YORRRHRRROY...',
        '...YORRDDROY....',
        '....YORRROY.....',
        '.....YOOY.......',
        '....Y.YY.Y......',
        '...Y..Y...Y.....',
        '..Y........Y....',
        '................',
        '................',
      ],
      {
        Y: 0xffe066,
        O: 0xff8844,
        R: 0xff4422,
        D: 0xaa2200,
        W: 0xfff5d6,
        B: 0x1a1a1a,
        H: 0xffaa66,
      }
    );

    // Demon — chifres, asas e olhos elétricos + garras
    registerMonsterSprite(
      this,
      'demon',
      [
        '................',
        '.H..........H...',
        '.HR........RH...',
        '..R.WWWWWW.R....',
        '..WRRRRRRRRW....',
        '.WRRBEYYEBRRW...',
        '.WRRRRHHHRRRW...',
        '..WRRDDDDRRW....',
        '.WWRRRDRDRRWW...',
        'WWRR......RRWW..',
        '.RR...AA...RR...',
        '.R.R......R.R...',
        '..LC......CL....',
        '................',
        '................',
        '................',
      ],
      {
        H: 0x4a0a12,
        R: 0x8b1a2b,
        D: 0x3d0a14,
        W: 0x2a0a18,
        B: 0x1a0508,
        E: 0x7cf0ff,
        Y: 0xffffff,
        L: 0x5a1020,
        A: 0xff4466,
        C: 0x6a1428,
      }
    );

    // Grim Reaper — capuz negro + foice + olhos violeta + véu
    registerMonsterSprite(
      this,
      'grim_reaper',
      [
        '................',
        '....HHHHHH......',
        '...HNNNNNNH..B..',
        '..HNSSSSSNH.BB..',
        '..HNSVVVSNH.BB..',
        '..HNSWSWSNH.B...',
        '..HNNNNNNNH.B...',
        '..HPPPRPPPH.B...',
        '..HPPPPPPPH.B...',
        '..HP.PPPP.PH....',
        '..LL......LL....',
        '..L........L....',
        '................',
        '................',
        '................',
        '................',
      ],
      {
        H: 0x1a0a28,
        N: 0x0d0618,
        S: 0xc8c0d0,
        V: 0xaa44ff,
        P: 0x2a1040,
        L: 0x1a0a28,
        B: 0x6e6e78,
        W: 0xe8e0f0,
        R: 0x5a2080,
      }
    );

    // Bruxo — chapéu pontudo + orbe de fogo + barba
    registerMonsterSprite(
      this,
      'bruxo',
      [
        '................',
        '......HH........',
        '.....HRRH.......',
        '....HRRRRH......',
        '...HRRWWWRH..F..',
        '...HRRBEBRH.FOF.',
        '....HRWRWRH..F..',
        '....HPPPPPH.....',
        '...HPPPRPPPH....',
        '...HP.PPP.PH....',
        '...LL......LL...',
        '...L........L...',
        '................',
        '................',
        '................',
        '................',
      ],
      {
        H: 0x3d1a0a,
        R: 0x6b2d12,
        W: 0xd4a574,
        B: 0x1a1a1a,
        E: 0xff4422,
        P: 0x5a2810,
        L: 0x2a1208,
        F: 0xff6622,
        O: 0xffee66,
      }
    );

    this.registerCatalogMonsterSprites();
  }

  /** Sprites procedurais para o catálogo expandido (normal / elite / boss). */
  registerCatalogMonsterSprites() {
    // Templates com shading (B/D/L/H), olhos (E/W), acentos (A) e silhueta legível.
    const humanoid = [
      '................',
      '....D.BBBB.D....',
      '....DBLLLLBD....',
      '...DBLWEWEWLBD..',
      '...DBLLHHLHLBD..',
      '....DBAAAAAABD..',
      '...DBBBBBBAAAB..',
      '..DBBLA.A.ALBD..',
      '..DBB.ABB.ABBD..',
      '..DBB.....BBD...',
      '..DDD.....DDD...',
      '..D.D.....D.D...',
      '................',
      '................',
      '................',
      '................',
    ];
    const beast = [
      '................',
      '..A.DBB..BBD.A..',
      '..DBLLBBBBLLBD..',
      '.DBLWEWWWEWLBD..',
      '.DBLLHHLHHLLBD..',
      '..DBAAAAAAAABD..',
      '...DBBBBBBBBD...',
      '..DBB.AA.AABB...',
      '.DBBLA....ALBD..',
      '.DDD......DDD...',
      'D.D.A....A.D.D..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];
    const winged = [
      '................',
      'AA.A......A.AA..',
      '.AADBBBBBBDAA...',
      'A.AABLLLLLBAA.A.',
      '...DBLWEWELBD...',
      '...DBLLHHLHBD...',
      '....DBAAAABD....',
      '...AABBAABBA....',
      '..AADD....DDAA..',
      '..D.D......D.D..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];
    const bulk = [
      '................',
      '....DBBBBBBBD...',
      '...DBLLLLLLLBD..',
      '..DBLWEWWWEWLBD.',
      '..DBLLHHLHHLLBD.',
      '..DBAAAAAAAAABD.',
      '...DBBBBBBBBBD..',
      '..DBBLA..ALBBD..',
      '.DBBB......BBBD.',
      '.DDDD.A..A.DDDD.',
      'D.DD........DD.D',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];
    const serpent = [
      '................',
      '.....DBBBBBD....',
      '....DBLWEWLBD...',
      '...DBLLHHLHBD...',
      '..DBBAAAAABBD...',
      '.DBBLA..AABB....',
      'DBB......BBD.A..',
      '.DBB....BBD.....',
      '..DBBBBBBD......',
      '...DAAAAAD......',
      '....DDDDD.......',
      '......A.........',
      '................',
      '................',
      '................',
      '................',
    ];
    const templates = { humanoid, beast, winged, bulk, serpent };

    const entries = [
      ['cyclops', 'bulk', 0xc4a35a, 0x8a6e30, 0xe8d090, 0xffee88, 0x5a4020],
      ['minotaur', 'beast', 0x8b4513, 0x5c2e0a, 0xc47a3a, 0xffdd66, 0x3a1a08],
      ['harpy', 'winged', 0xd4a0c8, 0x9a6088, 0xf0c0e0, 0xffeeaa, 0x6a4060],
      ['kobold', 'humanoid', 0xc97840, 0x8a5020, 0xe8a060, 0xffee66, 0x5a3010],
      ['zombie', 'humanoid', 0x6b8f5a, 0x3e5a30, 0x8fb87a, 0xaaff66, 0x2a3a20],
      ['mummy', 'humanoid', 0xd4c48a, 0xa09050, 0xe8dcb0, 0xffeeaa, 0x6a6030],
      ['ghoul', 'humanoid', 0x8fbc8f, 0x5a8a5a, 0xb8d8b8, 0x88ff88, 0x3a5a3a],
      ['ratman', 'beast', 0x7a6a5a, 0x4a3a2a, 0xa09080, 0xffcc66, 0x2a2018],
      ['scorpion', 'beast', 0xc45c26, 0x8a3a10, 0xe88040, 0xffee44, 0x5a2008],
      ['venom_snake', 'serpent', 0x3d8b40, 0x246028, 0x58b860, 0xaaff44, 0x143818],
      ['cultist', 'humanoid', 0x5c2d6e, 0x3a1848, 0x8a50a0, 0xff66ff, 0x201028],
      ['gargoyle', 'winged', 0x6e6e78, 0x444450, 0x9a9aa8, 0x88ddff, 0x2a2a32],
      ['pixie', 'winged', 0xff88cc, 0xc05090, 0xffb0e0, 0xffffaa, 0x803060],
      ['dwarf_guard', 'humanoid', 0xb87333, 0x7a4a18, 0xd49850, 0xffdd66, 0x4a2808],
      ['bandit', 'humanoid', 0x8b5a2b, 0x5a3818, 0xb88850, 0xffcc66, 0x3a2010],
      ['pirate', 'humanoid', 0x2f4f6f, 0x1a3048, 0x5080a0, 0xffee88, 0x102030],
      ['giant_toad', 'bulk', 0x4a7c59, 0x2a4a34, 0x6aaa80, 0xaaff66, 0x1a3020],
      ['wasp', 'winged', 0xf0c040, 0xb08820, 0xffe080, 0x222222, 0x6a5010],
      ['crab', 'beast', 0xd35400, 0x8a3400, 0xf08040, 0xffee66, 0x5a2000],
      ['yeti_cub', 'beast', 0xe8eef5, 0xb0b8c8, 0xffffff, 0x4488ff, 0x788090],
      ['shadow_wolf', 'beast', 0x2c2c3a, 0x141420, 0x4a4a60, 0xaa66ff, 0x0a0a12],
      ['cave_troll', 'bulk', 0x5a6e4a, 0x344030, 0x7a9470, 0xffcc44, 0x202818],
      ['swamp_slug', 'serpent', 0x556b2f, 0x334018, 0x789050, 0xaaff44, 0x1a2410],
      ['desert_scavenger', 'beast', 0xc2a05a, 0x8a7030, 0xe0c880, 0xffee66, 0x5a4820],
      ['gnoll', 'beast', 0xb8860b, 0x7a5808, 0xd4a830, 0xffee66, 0x4a3404],
      ['ice_imp', 'winged', 0x7ec8e3, 0x4090b0, 0xb0e8f8, 0xffffff, 0x286078],
      ['ancient_scarab', 'beast', 0x1a5c3a, 0x0e3820, 0x2e8a58, 0xffee44, 0x0a2418],
      ['death_knight', 'humanoid', 0x3a3a5c, 0x1e1e38, 0x5a5a88, 0x88aaff, 0x101020],
      ['frost_mage', 'humanoid', 0x5dade2, 0x2e6f9a, 0x85c1e9, 0xffffff, 0x1a4060],
      ['venom_hydra', 'serpent', 0x27ae60, 0x145a32, 0x58d68d, 0xaaff44, 0x0e3820],
      ['stone_golem', 'bulk', 0x7f8c8d, 0x4d5656, 0xb2babb, 0xffee88, 0x2c3333],
      ['blood_succubus', 'winged', 0xc0392b, 0x7b241c, 0xe74c3c, 0xffeeaa, 0x4a1410],
      ['nightmare_steed', 'beast', 0x1a0a20, 0x0a0410, 0x3a2040, 0xff4466, 0x050208],
      ['bone_whelp', 'winged', 0xd5d0c0, 0x9a9588, 0xece8dc, 0xff6644, 0x5a5648],
      ['abyss_watcher', 'bulk', 0x4a0080, 0x280048, 0x7a20b0, 0xff66ff, 0x140020],
      ['crystal_elemental', 'bulk', 0xaed6f1, 0x5dade2, 0xd6eaf8, 0xffffff, 0x2e86c1],
      ['plague_doctor', 'humanoid', 0x2c3e2d, 0x1a2418, 0x4a6a4a, 0x88ff44, 0x101810],
      ['war_troll', 'bulk', 0x4a6741, 0x2a3e24, 0x6a9070, 0xffcc44, 0x182018],
      ['shadow_assassin', 'humanoid', 0x1c1c28, 0x0c0c14, 0x3a3a50, 0xaa66ff, 0x06060a],
      ['storm_elemental', 'winged', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x154360],
      ['magma_golem', 'bulk', 0xe67e22, 0x935116, 0xf5b041, 0xffee66, 0x6e2c00],
      ['forest_guardian', 'bulk', 0x1e8449, 0x0e4a28, 0x2ecc71, 0xffee66, 0x0a2a18],
      ['void_stalker', 'beast', 0x2c003e, 0x140020, 0x5a2080, 0xff44aa, 0x0a0012],
      ['ice_wyrm', 'serpent', 0xaed6f1, 0x5dade2, 0xd6eaf8, 0xffffff, 0x2e86c1],
      ['necromancer', 'humanoid', 0x4a235a, 0x2a1238, 0x7d3c98, 0xaa66ff, 0x180c20],
      ['frost_dragon', 'winged', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x1a5276],
      ['bone_dragon', 'winged', 0xece5d0, 0xb0a890, 0xfff8e8, 0xff6644, 0x6a6450],
      ['kraken', 'bulk', 0x1a5276, 0x0e2f44, 0x2e86c1, 0x88eeff, 0x0a1e30],
      ['hydra_boss', 'serpent', 0x196f3d, 0x0e3d22, 0x27ae60, 0xaaff44, 0x0a2414],
      ['medusa', 'humanoid', 0x58d68d, 0x1e8449, 0x82e0aa, 0xffee66, 0x145a32],
      ['phoenix', 'winged', 0xff6b35, 0xc0392b, 0xff9f1c, 0xffee66, 0x7b241c],
      ['titan', 'bulk', 0xf5cba7, 0xc49a6c, 0xfdebd0, 0xffee88, 0x7a5a3a],
      ['void_lord', 'bulk', 0x1a0033, 0x0a0018, 0x4a0080, 0xff44ff, 0x05000c],
      ['ancient_treant', 'bulk', 0x145a32, 0x0a3018, 0x1e8449, 0xaaff66, 0x062010],
      ['sand_worm', 'serpent', 0xd4a017, 0x8a6808, 0xf4d03f, 0xffee88, 0x5a4408],
      ['flame_lord', 'bulk', 0xcb4335, 0x7b241c, 0xe74c3c, 0xffee66, 0x4a1410],
      ['frost_lich', 'humanoid', 0x85c1e9, 0x2e86c1, 0xd6eaf8, 0xffffff, 0x1a5276],
      ['plague_queen', 'winged', 0x7d3c98, 0x4a235a, 0xbb8fce, 0x88ff44, 0x2a1238],
      ['storm_giant', 'bulk', 0x5d6d7e, 0x2e4050, 0x85929e, 0xaaddff, 0x1a2830],
      ['cerberus', 'beast', 0x641e16, 0x3a100c, 0x922b21, 0xff6644, 0x200808],
      ['basilisk', 'serpent', 0x117a65, 0x0a4034, 0x1abc9c, 0xaaff66, 0x062820],
      ['djinn', 'winged', 0xf4d03f, 0xb7950b, 0xf9e79f, 0xffffff, 0x7d6608],
      ['archdemon', 'bulk', 0x7b241c, 0x4a1410, 0xc0392b, 0xffee44, 0x2a0c08],
      ['world_serpent', 'serpent', 0x0e6655, 0x064034, 0x16a085, 0xaaffcc, 0x042820],
      // Expansão +50
      ['frogman', 'humanoid', 0x3d9970, 0x246048, 0x5ecf9a, 0xaaff66, 0x184030],
      ['porcupine', 'beast', 0x8b7355, 0x5a4830, 0xb89870, 0xffee66, 0x3a3020],
      ['dune_viper', 'serpent', 0xc9a227, 0x8a7010, 0xe8c850, 0xffee44, 0x5a4808],
      ['moss_sprite', 'winged', 0x7dcea0, 0x3a8a60, 0xa9dfbf, 0xffffaa, 0x286048],
      ['scrap_golem', 'bulk', 0x7f8c8d, 0x4d5656, 0xb2babb, 0xffee88, 0x2c3333],
      ['raven_scout', 'winged', 0x2c3e50, 0x1a2530, 0x5d6d7e, 0xffee66, 0x0e161e],
      ['bog_witch_apprentice', 'humanoid', 0x6c3483, 0x3a1848, 0x9b59b6, 0xff66ff, 0x201028],
      ['crystal_bat', 'winged', 0xaed6f1, 0x5dade2, 0xd6eaf8, 0xffffff, 0x2e86c1],
      ['iron_boar', 'beast', 0x566573, 0x2c3e50, 0x85929e, 0xffcc44, 0x1a2530],
      ['sand_archer', 'humanoid', 0xd4a017, 0x8a6808, 0xf4d03f, 0xffee88, 0x5a4408],
      ['frost_sprite', 'winged', 0xd6eaf8, 0x85c1e9, 0xffffff, 0xaaddff, 0x5dade2],
      ['cave_crawler', 'beast', 0x5d4037, 0x3e2723, 0x8d6e63, 0xffcc66, 0x2a1810],
      ['marsh_lurker', 'bulk', 0x4a6741, 0x2a3e24, 0x6a9070, 0xaaff66, 0x182018],
      ['ember_whelp', 'winged', 0xe67e22, 0xa04000, 0xf5b041, 0xffee66, 0x6e2c00],
      ['bone_picker', 'beast', 0xd5d0c0, 0x9a9588, 0xece8dc, 0xff6644, 0x5a5648],
      ['thorn_bush', 'bulk', 0x1e8449, 0x0e4a28, 0x2ecc71, 0xaaff66, 0x0a2a18],
      ['ash_rat', 'beast', 0x6e2c00, 0x3e1800, 0xa04000, 0xff6622, 0x2a1000],
      ['coral_crab', 'beast', 0xe74c3c, 0x922b21, 0xf1948a, 0xffee66, 0x641e16],
      ['wind_sylph', 'winged', 0xaed6f1, 0x5dade2, 0xd6eaf8, 0xffffff, 0x2874a6],
      ['tomb_guard', 'humanoid', 0xb7950b, 0x7d6608, 0xd4ac0d, 0xffee88, 0x5a4808],
      ['spore_fungus', 'bulk', 0xa569bd, 0x6c3483, 0xd2b4de, 0x88ff44, 0x4a235a],
      ['glacier_cub', 'beast', 0xd4e6f1, 0xaed6f1, 0xffffff, 0x4488ff, 0x85c1e9],
      ['night_owl', 'winged', 0x1c2833, 0x0e141a, 0x566573, 0xffee66, 0x0a1016],
      ['brimstone_imp', 'winged', 0xcb4335, 0x7b241c, 0xe74c3c, 0xffee44, 0x4a1410],
      ['reed_stalker', 'humanoid', 0x7d6608, 0x4a3c04, 0xb7950b, 0xffee66, 0x2a2404],
      ['thunder_hawk', 'winged', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x154360],
      ['blood_ogre', 'bulk', 0x922b21, 0x641e16, 0xc0392b, 0xff6644, 0x3a100c],
      ['mirage_dancer', 'humanoid', 0xf5b041, 0xb7950b, 0xf9e79f, 0xffffff, 0x7d6608],
      ['frost_berserker', 'humanoid', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x1a5276],
      ['venom_alchemist', 'humanoid', 0x1e8449, 0x0e4a28, 0x58d68d, 0xaaff44, 0x0a2a18],
      ['obsidian_guardian', 'bulk', 0x1c2833, 0x0a1016, 0x566573, 0xffee88, 0x05080c],
      ['soul_harvester', 'humanoid', 0x4a235a, 0x2a1238, 0x7d3c98, 0xaa66ff, 0x180c20],
      ['lava_serpent', 'serpent', 0xd35400, 0x8a3400, 0xe67e22, 0xffee66, 0x5a2000],
      ['mirror_wraith', 'humanoid', 0xd5d8dc, 0x95a5a6, 0xf4f6f7, 0x88ddff, 0x5d6d7e],
      ['plague_rat_king', 'beast', 0x6e2c00, 0x3e1800, 0xa04000, 0x88ff44, 0x2a1000],
      ['storm_rider', 'winged', 0x2874a6, 0x154360, 0x5dade2, 0xffffff, 0x0e2f44],
      ['ironbark_treant', 'bulk', 0x145a32, 0x0a3018, 0x1e8449, 0xaaff66, 0x062010],
      ['crimson_cultist', 'humanoid', 0xc0392b, 0x7b241c, 0xe74c3c, 0xffeeaa, 0x4a1410],
      ['void_imp_lord', 'winged', 0x2c003e, 0x140020, 0x8e44ad, 0xff44aa, 0x0a0012],
      ['sapphire_drake', 'winged', 0x1a5276, 0x0e2f44, 0x5dade2, 0xffffff, 0x0a1e30],
      ['eclipse_sphinx', 'beast', 0xf4d03f, 0xb7950b, 0xf9e79f, 0xffffff, 0x7d6608],
      ['magma_colossus', 'bulk', 0xa04000, 0x6e2c00, 0xe67e22, 0xffee66, 0x3e1800],
      ['arctic_leviathan', 'serpent', 0x85c1e9, 0x2e86c1, 0xd6eaf8, 0xffffff, 0x1a5276],
      ['blight_emperor', 'humanoid', 0x196f3d, 0x0e3d22, 0x58d68d, 0xaaff44, 0x0a2414],
      ['chronomancer', 'humanoid', 0xaf7ac5, 0x6c3483, 0xd2b4de, 0xff66ff, 0x4a235a],
      ['dread_naga', 'serpent', 0x117a65, 0x0a4034, 0x1abc9c, 0xaaff66, 0x062820],
      ['solar_phoenix', 'winged', 0xff9f1c, 0xc0392b, 0xff6b35, 0xffee66, 0x7b241c],
      ['abyssal_kraken', 'bulk', 0x0e2f44, 0x061820, 0x1a5276, 0x88eeff, 0x040c12],
      ['bone_emperor', 'humanoid', 0xece5d0, 0xb0a890, 0xfff8e8, 0xff6644, 0x6a6450],
      ['world_ender', 'bulk', 0x1a0033, 0x0a0018, 0x4a0080, 0xff44ff, 0x05000c],
      // Expansão 2 +50
      ['mushroom_brute', 'bulk', 0xc0392b, 0x7b241c, 0xe74c3c, 0xffee66, 0x4a1410],
      ['salt_golem', 'bulk', 0xf5e6c8, 0xc4b090, 0xfff8e8, 0xffee88, 0x8a7850],
      ['fox_trickster', 'beast', 0xe67e22, 0xa04000, 0xf5b041, 0xffee66, 0x6e2c00],
      ['quill_hunter', 'beast', 0x6e4a2e, 0x3e2818, 0xa07850, 0xffcc66, 0x2a1810],
      ['peat_zombie', 'humanoid', 0x4a5c3a, 0x2a3820, 0x6a8050, 0xaaff66, 0x1a2410],
      ['lantern_spirit', 'winged', 0xf4d03f, 0xb7950b, 0xf9e79f, 0xffffff, 0x7d6608],
      ['cliff_goat', 'beast', 0xb0a090, 0x706050, 0xd0c0b0, 0xffee66, 0x403830],
      ['reef_shark', 'serpent', 0x5d8aa8, 0x2e5068, 0x85b0c8, 0xaaddff, 0x1a3040],
      ['dust_mephit', 'winged', 0xc2a05a, 0x8a7030, 0xe0c880, 0xffee66, 0x5a4820],
      ['bark_spider', 'beast', 0x5d4037, 0x3e2723, 0x8d6e63, 0xffcc66, 0x2a1810],
      ['snow_hare', 'beast', 0xf0f4f8, 0xb0b8c8, 0xffffff, 0x4488ff, 0x788090],
      ['torch_bearer', 'humanoid', 0xd35400, 0x8a3400, 0xf08040, 0xffee66, 0x5a2000],
      ['bog_mosquito', 'winged', 0x556b2f, 0x334018, 0x789050, 0xaaff44, 0x1a2410],
      ['rune_scribe', 'humanoid', 0x5b2c6f, 0x3a1848, 0x8e44ad, 0xff66ff, 0x201028],
      ['clay_soldier', 'humanoid', 0xa07850, 0x6a5030, 0xc09870, 0xffee66, 0x403020],
      ['pearl_diver', 'humanoid', 0x48c9b0, 0x1a8a70, 0x76d7c4, 0xffffff, 0x0e5a48],
      ['night_panther', 'beast', 0x1c1c28, 0x0c0c14, 0x3a3a50, 0xaa66ff, 0x06060a],
      ['hive_drone', 'winged', 0xf1c40f, 0xb7950b, 0xf9e79f, 0x222222, 0x7d6608],
      ['frost_toad', 'bulk', 0x85c1e9, 0x2e86c1, 0xd6eaf8, 0xffffff, 0x1a5276],
      ['scrap_bandit', 'humanoid', 0x7f8c8d, 0x4d5656, 0xb2babb, 0xffee88, 0x2c3333],
      ['vine_creeper', 'serpent', 0x27ae60, 0x145a32, 0x58d68d, 0xaaff44, 0x0e3820],
      ['cinder_sprite', 'winged', 0xe74c3c, 0x922b21, 0xf1948a, 0xffee66, 0x641e16],
      ['tunnel_mole', 'beast', 0x6d4c41, 0x3e2723, 0x8d6e63, 0xffcc66, 0x2a1810],
      ['glass_imp', 'winged', 0xd5f5e3, 0x7dcea0, 0xeafaf1, 0xffffff, 0x27ae60],
      ['thunder_boar', 'beast', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x154360],
      ['blood_knight', 'humanoid', 0x922b21, 0x641e16, 0xc0392b, 0xff6644, 0x3a100c],
      ['sand_djinni', 'winged', 0xd4a017, 0x8a6808, 0xf4d03f, 0xffffff, 0x5a4408],
      ['poison_archer', 'humanoid', 0x1e8449, 0x0e4a28, 0x58d68d, 0xaaff44, 0x0a2a18],
      ['jade_golem', 'bulk', 0x117a65, 0x0a4034, 0x1abc9c, 0xaaff66, 0x062820],
      ['shadow_priest', 'humanoid', 0x2c003e, 0x140020, 0x5a2080, 0xff44aa, 0x0a0012],
      ['bladed_mantis', 'beast', 0x27ae60, 0x145a32, 0x58d68d, 0xaaff44, 0x0e3820],
      ['storm_witch', 'humanoid', 0x2874a6, 0x154360, 0x5dade2, 0xffffff, 0x0e2f44],
      ['furnace_beast', 'bulk', 0xcb4335, 0x7b241c, 0xe74c3c, 0xffee66, 0x4a1410],
      ['crystal_archer', 'humanoid', 0xaed6f1, 0x5dade2, 0xd6eaf8, 0xffffff, 0x2e86c1],
      ['void_hound', 'beast', 0x1a0033, 0x0a0018, 0x4a0080, 0xff44ff, 0x05000c],
      ['plague_swarm', 'winged', 0x6e2c00, 0x3e1800, 0xa04000, 0x88ff44, 0x2a1000],
      ['iron_sentinel', 'bulk', 0x566573, 0x2c3e50, 0x85929e, 0xffcc44, 0x1a2530],
      ['aurora_mage', 'humanoid', 0xaf7ac5, 0x6c3483, 0xd2b4de, 0xff66ff, 0x4a235a],
      ['ash_wyvern', 'winged', 0x6e2c00, 0x3e1800, 0xe67e22, 0xffee66, 0x2a1000],
      ['bone_reaver', 'humanoid', 0xece5d0, 0xb0a890, 0xfff8e8, 0xff6644, 0x6a6450],
      ['tempest_queen', 'winged', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x1a5276],
      ['forge_titan', 'bulk', 0xa04000, 0x6e2c00, 0xe67e22, 0xffee66, 0x3e1800],
      ['coral_empress', 'humanoid', 0xe74c3c, 0x922b21, 0xf1948a, 0xffee66, 0x641e16],
      ['nightmare_king', 'bulk', 0x1a0a20, 0x0a0410, 0x3a2040, 0xff4466, 0x050208],
      ['elder_beholder', 'bulk', 0x7d3c98, 0x4a235a, 0xbb8fce, 0xff66ff, 0x2a1238],
      ['doom_hydra', 'serpent', 0x145a32, 0x0a3018, 0x27ae60, 0xaaff44, 0x062010],
      ['astral_serpent', 'serpent', 0xaf7ac5, 0x6c3483, 0xd2b4de, 0xff66ff, 0x4a235a],
      ['war_god_avatar', 'bulk', 0xb9770e, 0x7d6608, 0xd4ac0d, 0xffee88, 0x5a4808],
      ['necrotic_colossus', 'bulk', 0xd5d0c0, 0x9a9588, 0xece8dc, 0xff6644, 0x5a5648],
      ['chaos_primordial', 'bulk', 0x6c3483, 0x4a235a, 0x9b59b6, 0xff44ff, 0x2a1238],
      // Expansão 3 +100
      ['pebble_sprite', 'winged', 0x95a5a6, 0x5d6d7e, 0xbdc3c7, 0xffee88, 0x2c3e50],
      ['reed_rat', 'beast', 0x7d6608, 0x4a3c04, 0xb7950b, 0xffee66, 0x2a2404],
      ['tide_urchin', 'beast', 0x5d8aa8, 0x2e5068, 0x85b0c8, 0xaaddff, 0x1a3040],
      ['cinder_moth', 'winged', 0xe67e22, 0xa04000, 0xf5b041, 0xffee66, 0x6e2c00],
      ['pine_sprite', 'winged', 0x1e8449, 0x0e4a28, 0x2ecc71, 0xaaff66, 0x0a2a18],
      ['copper_goblin', 'humanoid', 0xb87333, 0x7a4a18, 0xd49850, 0xffdd66, 0x4a2808],
      ['mist_wisp', 'winged', 0xd5d8dc, 0x95a5a6, 0xf4f6f7, 0x88ddff, 0x5d6d7e],
      ['brine_crab', 'beast', 0x48c9b0, 0x1a8a70, 0x76d7c4, 0xffffff, 0x0e5a48],
      ['soot_imp', 'winged', 0x566573, 0x2c3e50, 0x85929e, 0xff6622, 0x1a2530],
      ['thistle_boar', 'beast', 0x6e4a2e, 0x3e2818, 0xa07850, 0xffcc66, 0x2a1810],
      ['kelp_strider', 'serpent', 0x117a65, 0x0a4034, 0x1abc9c, 0xaaff66, 0x062820],
      ['ember_gnat', 'winged', 0xcb4335, 0x7b241c, 0xe74c3c, 0xffee44, 0x4a1410],
      ['chalk_golem_cub', 'bulk', 0xf5e6c8, 0xc4b090, 0xfff8e8, 0xffee88, 0x8a7850],
      ['dusk_ferret', 'beast', 0x5d4037, 0x3e2723, 0x8d6e63, 0xffcc66, 0x2a1810],
      ['bog_newt', 'beast', 0x556b2f, 0x334018, 0x789050, 0xaaff44, 0x1a2410],
      ['crystal_mite', 'beast', 0xaed6f1, 0x5dade2, 0xd6eaf8, 0xffffff, 0x2e86c1],
      ['rust_scorpion', 'beast', 0xa04000, 0x6e2c00, 0xe67e22, 0xffee66, 0x3e1800],
      ['pollen_pixie', 'winged', 0xf9e79f, 0xb7950b, 0xfef9e7, 0xffffff, 0x7d6608],
      ['shale_basher', 'bulk', 0x7f8c8d, 0x4d5656, 0xb2babb, 0xffee88, 0x2c3333],
      ['frost_vole', 'beast', 0xd4e6f1, 0xaed6f1, 0xffffff, 0x4488ff, 0x85c1e9],
      ['tar_slug', 'serpent', 0x1c1c28, 0x0c0c14, 0x3a3a50, 0xff6622, 0x06060a],
      ['spark_sprite', 'winged', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x154360],
      ['dune_jackal', 'beast', 0xd4a017, 0x8a6808, 0xf4d03f, 0xffee88, 0x5a4408],
      ['lichen_troll_cub', 'bulk', 0x4a6741, 0x2a3e24, 0x6a9070, 0xaaff66, 0x182018],
      ['ivory_skeleton', 'humanoid', 0xf5eef0, 0xc8b8c0, 0xffffff, 0xff6644, 0x8a7880],
      ['mangrove_croco', 'serpent', 0x145a32, 0x0a3018, 0x1e8449, 0xaaff66, 0x062010],
      ['storm_finch', 'winged', 0x2874a6, 0x154360, 0x5dade2, 0xffffff, 0x0e2f44],
      ['ash_cult_initiate', 'humanoid', 0x6e2c00, 0x3e1800, 0xa04000, 0xff6622, 0x2a1000],
      ['prism_moth', 'winged', 0xaf7ac5, 0x6c3483, 0xd2b4de, 0xffffff, 0x4a235a],
      ['geyser_toad', 'bulk', 0x48c9b0, 0x1a8a70, 0x76d7c4, 0xaaff66, 0x0e5a48],
      ['carrion_vulture', 'winged', 0x6e4a2e, 0x3e2818, 0xa07850, 0xff6644, 0x2a1810],
      ['magma_grub', 'beast', 0xcb4335, 0x7b241c, 0xe74c3c, 0xffee66, 0x4a1410],
      ['void_mote', 'winged', 0x2c003e, 0x140020, 0x5a2080, 0xff44aa, 0x0a0012],
      ['salt_wraith', 'humanoid', 0xf5e6c8, 0xc4b090, 0xfff8e8, 0x88ddff, 0x8a7850],
      ['iron_tick', 'beast', 0x566573, 0x2c3e50, 0x85929e, 0xffcc44, 0x1a2530],
      ['glacier_imp', 'winged', 0x85c1e9, 0x2e86c1, 0xd6eaf8, 0xffffff, 0x1a5276],
      ['thorn_imp', 'winged', 0x27ae60, 0x145a32, 0x58d68d, 0xaaff44, 0x0e3820],
      ['cave_bat_swarm', 'winged', 0x2c3e50, 0x1a2530, 0x5d6d7e, 0xffee66, 0x0e161e],
      ['scrap_wolf', 'beast', 0x7f8c8d, 0x4d5656, 0xb2babb, 0xffee88, 0x2c3333],
      ['coral_snake', 'serpent', 0xe74c3c, 0x922b21, 0xf1948a, 0xffee66, 0x641e16],
      ['rune_imp', 'winged', 0x5b2c6f, 0x3a1848, 0x8e44ad, 0xff66ff, 0x201028],
      ['peat_slime', 'bulk', 0x4a5c3a, 0x2a3820, 0x6a8050, 0xaaff66, 0x1a2410],
      ['wind_razor', 'winged', 0xaed6f1, 0x5dade2, 0xd6eaf8, 0xffffff, 0x2874a6],
      ['blood_leech', 'serpent', 0x922b21, 0x641e16, 0xc0392b, 0xff6644, 0x3a100c],
      ['frost_archer_novice', 'humanoid', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x1a5276],
      ['shade_larva', 'beast', 0x1a0a20, 0x0a0410, 0x3a2040, 0xaa66ff, 0x050208],
      ['pyre_cultist', 'humanoid', 0xcb4335, 0x7b241c, 0xe74c3c, 0xffeeaa, 0x4a1410],
      ['quartz_beetle', 'beast', 0xd5d8dc, 0x95a5a6, 0xf4f6f7, 0x88ddff, 0x5d6d7e],
      ['acid_alchemist', 'humanoid', 0x1e8449, 0x0e4a28, 0x58d68d, 0xaaff44, 0x0a2a18],
      ['frost_wyvern', 'winged', 0x85c1e9, 0x2e86c1, 0xd6eaf8, 0xffffff, 0x1a5276],
      ['bone_chanter', 'humanoid', 0xece5d0, 0xb0a890, 0xfff8e8, 0xff6644, 0x6a6450],
      ['hex_witch', 'humanoid', 0x6c3483, 0x3a1848, 0x9b59b6, 0xff66ff, 0x201028],
      ['magma_brute', 'bulk', 0xa04000, 0x6e2c00, 0xe67e22, 0xffee66, 0x3e1800],
      ['storm_centurion', 'humanoid', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x154360],
      ['obsidian_raptor', 'beast', 0x1c2833, 0x0a1016, 0x566573, 0xffee88, 0x05080c],
      ['venom_naga', 'serpent', 0x27ae60, 0x145a32, 0x58d68d, 0xaaff44, 0x0e3820],
      ['crystal_guardian', 'bulk', 0xaed6f1, 0x5dade2, 0xd6eaf8, 0xffffff, 0x2e86c1],
      ['shadow_duelist', 'humanoid', 0x1c1c28, 0x0c0c14, 0x3a3a50, 0xaa66ff, 0x06060a],
      ['pyre_drake', 'winged', 0xcb4335, 0x7b241c, 0xe74c3c, 0xffee66, 0x4a1410],
      ['glacier_knight', 'humanoid', 0x85c1e9, 0x2e86c1, 0xd6eaf8, 0xffffff, 0x1a5276],
      ['plague_harpy', 'winged', 0x196f3d, 0x0e3d22, 0x58d68d, 0xaaff44, 0x0a2414],
      ['rune_golem', 'bulk', 0x5b2c6f, 0x3a1848, 0x8e44ad, 0xff66ff, 0x201028],
      ['blood_panther', 'beast', 0x922b21, 0x641e16, 0xc0392b, 0xff6644, 0x3a100c],
      ['arcane_archer', 'humanoid', 0xaf7ac5, 0x6c3483, 0xd2b4de, 0xff66ff, 0x4a235a],
      ['furnace_golem', 'bulk', 0xe67e22, 0x935116, 0xf5b041, 0xffee66, 0x6e2c00],
      ['void_serpent', 'serpent', 0x1a0033, 0x0a0018, 0x4a0080, 0xff44ff, 0x05000c],
      ['jade_monk', 'humanoid', 0x117a65, 0x0a4034, 0x1abc9c, 0xaaff66, 0x062820],
      ['thunder_drake', 'winged', 0x5dade2, 0x2874a6, 0xaed6f1, 0xffffff, 0x154360],
      ['mirror_knight', 'humanoid', 0xd5d8dc, 0x95a5a6, 0xf4f6f7, 0x88ddff, 0x5d6d7e],
      ['blight_treant', 'bulk', 0x145a32, 0x0a3018, 0x1e8449, 0xaaff66, 0x062010],
      ['ash_assassin', 'humanoid', 0x6e2c00, 0x3e1800, 0xa04000, 0xff6622, 0x2a1000],
      ['sapphire_witch', 'humanoid', 0x1a5276, 0x0e2f44, 0x5dade2, 0xffffff, 0x0a1e30],
      ['iron_hydra', 'serpent', 0x566573, 0x2c3e50, 0x85929e, 0xffcc44, 0x1a2530],
      ['soul_thief', 'humanoid', 0x4a235a, 0x2a1238, 0x7d3c98, 0xaa66ff, 0x180c20],
      ['cinder_titan_spawn', 'bulk', 0xcb4335, 0x7b241c, 0xe74c3c, 0xffee66, 0x4a1410],
      ['aurora_serpent', 'serpent', 0xaf7ac5, 0x6c3483, 0xd2b4de, 0xff66ff, 0x4a235a],
      ['grave_sentinel', 'bulk', 0xd5d0c0, 0x9a9588, 0xece8dc, 0xff6644, 0x5a5648],
      ['night_reaver', 'beast', 0x1a0a20, 0x0a0410, 0x3a2040, 0xff4466, 0x050208],
      ['ember_witch', 'humanoid', 0xe67e22, 0xa04000, 0xf5b041, 0xffee66, 0x6e2c00],
      ['toxin_archer', 'humanoid', 0x1e8449, 0x0e4a28, 0x58d68d, 0xaaff44, 0x0a2a18],
      ['acid_sovereign', 'serpent', 0x1e8449, 0x0e4a28, 0x58d68d, 0xaaff44, 0x0a2a18],
      ['frost_empress', 'winged', 0x85c1e9, 0x2e86c1, 0xd6eaf8, 0xffffff, 0x1a5276],
      ['bone_overlord', 'humanoid', 0xece5d0, 0xb0a890, 0xfff8e8, 0xff6644, 0x6a6450],
      ['hex_archon', 'humanoid', 0x6c3483, 0x4a235a, 0x9b59b6, 0xff44ff, 0x2a1238],
      ['magma_tyrant', 'bulk', 0xa04000, 0x6e2c00, 0xe67e22, 0xffee66, 0x3e1800],
      ['storm_colossus', 'bulk', 0x5d6d7e, 0x2e4050, 0x85929e, 0xaaddff, 0x1a2830],
      ['void_matriarch', 'winged', 0x1a0033, 0x0a0018, 0x4a0080, 0xff44ff, 0x05000c],
      ['plague_sovereign', 'humanoid', 0x196f3d, 0x0e3d22, 0x58d68d, 0xaaff44, 0x0a2414],
      ['solar_phoenix_lord', 'winged', 0xff9f1c, 0xc0392b, 0xff6b35, 0xffee66, 0x7b241c],
      ['abyss_leviathan', 'serpent', 0x0e2f44, 0x061820, 0x1a5276, 0x88eeff, 0x040c12],
      ['jade_emperor', 'bulk', 0x117a65, 0x0a4034, 0x1abc9c, 0xaaff66, 0x062820],
      ['crimson_warlord', 'humanoid', 0xc0392b, 0x7b241c, 0xe74c3c, 0xffeeaa, 0x4a1410],
      ['necrotic_queen', 'winged', 0x7d3c98, 0x4a235a, 0xbb8fce, 0x88ff44, 0x2a1238],
      ['entropy_dragon', 'winged', 0x6c3483, 0x4a235a, 0x9b59b6, 0xff44ff, 0x2a1238],
      ['iron_behemoth', 'bulk', 0x566573, 0x2c3e50, 0x85929e, 0xffcc44, 0x1a2530],
      ['mire_hydra_king', 'serpent', 0x145a32, 0x0a3018, 0x27ae60, 0xaaff44, 0x062010],
      ['astral_tyrant', 'bulk', 0xaf7ac5, 0x6c3483, 0xd2b4de, 0xff66ff, 0x4a235a],
      ['forge_emperor', 'bulk', 0xb9770e, 0x7d6608, 0xd4ac0d, 0xffee88, 0x5a4808],
      ['shadow_primordial', 'bulk', 0x1a0a20, 0x0a0410, 0x3a2040, 0xff4466, 0x050208],
      ['tide_kraken_lord', 'bulk', 0x1a5276, 0x0e2f44, 0x2e86c1, 0x88eeff, 0x0a1e30],
      // Expansão 4 +100
      ['amber_mite', 'beast', 0xd4a017, 0x74580c, 0xffd01d, 0xffff24, 0x4a3808],
      ['fog_hare', 'beast', 0xd5d8dc, 0x757679, 0xffffff, 0xffffff, 0x4a4b4d],
      ['driftwood_crab', 'beast', 0x8b7355, 0x4c3f2e, 0xb4956e, 0xfeb888, 0x30281d],
      ['pollen_moth', 'winged', 0xf9e79f, 0x887f57, 0xffffce, 0xfffffe, 0x575037],
      ['basalt_cub', 'bulk', 0x2c3e50, 0x18222c, 0x395068, 0x666380, 0x0f151c],
      ['reed_imp', 'winged', 0x7d6608, 0x443804, 0xa2840a, 0xeaa30c, 0x2b2302],
      ['snow_finch', 'winged', 0xeaf2f8, 0x808588, 0xffffff, 0xffffff, 0x515456],
      ['salt_scorpion', 'beast', 0xf5e6c8, 0x867e6e, 0xffffff, 0xffffff, 0x555046],
      ['moss_newt', 'beast', 0x556b2f, 0x2e3a19, 0x6e8b3d, 0xaaab4b, 0x1d2510],
      ['copper_tick', 'beast', 0xb87333, 0x653f1c, 0xef9542, 0xffb851, 0x402811],
      ['tide_sprite', 'winged', 0x48c9b0, 0x276e60, 0x5dffe4, 0x73ffff, 0x19463d],
      ['ash_vole', 'beast', 0x6e2c00, 0x3c1800, 0x8f3900, 0xb24600, 0x260f00],
      ['bramble_boar', 'beast', 0x6e4a2e, 0x3c2819, 0x8f603b, 0xb27649, 0x261910],
      ['chalk_imp', 'winged', 0xf5e6c8, 0x867e6e, 0xffffff, 0xffffff, 0x555046],
      ['mire_slug', 'serpent', 0x4a6741, 0x283823, 0x608554, 0x76a468, 0x192416],
      ['gust_sylph', 'winged', 0xaed6f1, 0x5f7584, 0xe2ffff, 0xffffff, 0x3c4a54],
      ['onyx_beetle', 'beast', 0x1c2833, 0x0f161c, 0x243442, 0x2e4051, 0x090e11],
      ['peat_rat', 'beast', 0x5d4037, 0x33231e, 0x785347, 0xb66658, 0x201613],
      ['glint_pixie', 'winged', 0xd2b4de, 0x73637a, 0xffeaff, 0xffffff, 0x493e4d],
      ['dune_scarab', 'beast', 0xc9a227, 0x6e5915, 0xffd232, 0xffff3e, 0x46380d],
      ['frost_gnat', 'winged', 0x85c1e9, 0x496a80, 0xacfaff, 0xf6ffff, 0x2e4351],
      ['root_crawler', 'beast', 0x1e8449, 0x104828, 0x27ab5e, 0x32d374, 0x0a2e19],
      ['cinder_toad', 'bulk', 0xe67e22, 0x7e4512, 0xffa32c, 0xffc936, 0x502c0b],
      ['pearl_slug', 'serpent', 0xf5eef8, 0x868288, 0xffffff, 0xffffff, 0x555356],
      ['rune_mite', 'beast', 0xaf7ac5, 0x60436c, 0xe39eff, 0xffc3ff, 0x3d2a44],
      ['shadow_vole', 'beast', 0x2c2c3a, 0x18181f, 0x39394b, 0x66465c, 0x0f0f14],
      ['coral_urchin', 'bulk', 0xe74c3c, 0x7f2921, 0xff624e, 0xff7960, 0x501a15],
      ['pine_imp', 'winged', 0x145a32, 0x0b311b, 0x1a7541, 0x229050, 0x071f11],
      ['slag_imp', 'winged', 0x935116, 0x502c0c, 0xbf691c, 0xeb8123, 0x331c07],
      ['ice_tick', 'beast', 0xd6eaf8, 0x758088, 0xffffff, 0xffffff, 0x4a5156],
      ['bog_finch', 'winged', 0x7dcea0, 0x447158, 0xa2ffd0, 0xeaffff, 0x2b4838],
      ['quartz_mite', 'beast', 0xaed6f1, 0x5f7584, 0xe2ffff, 0xffffff, 0x3c4a54],
      ['dust_jackal', 'beast', 0xc2a05a, 0x6a5831, 0xfcd075, 0xffff90, 0x43381f],
      ['kelp_newt', 'beast', 0x117a65, 0x094337, 0x169e83, 0x3bc3a1, 0x052a23],
      ['ember_vole', 'beast', 0xcb4335, 0x6f241d, 0xff5744, 0xff6b54, 0x471712],
      ['thorn_mite', 'beast', 0x27ae60, 0x155f34, 0x32e27c, 0x3eff99, 0x0d3c21],
      ['mist_imp', 'winged', 0x95a5a6, 0x515a5b, 0xc1d6d7, 0xeeffff, 0x34393a],
      ['shale_tick', 'beast', 0x7f8c8d, 0x454d4d, 0xa5b6b7, 0xebe0e1, 0x2c3131],
      ['aurora_moth', 'winged', 0xaf7ac5, 0x60436c, 0xe39eff, 0xffc3ff, 0x3d2a44],
      ['blood_mite', 'beast', 0xc0392b, 0x691f17, 0xf94a37, 0xff5b44, 0x43130f],
      ['salt_newt', 'beast', 0xf5e6c8, 0x867e6e, 0xffffff, 0xffffff, 0x555046],
      ['vine_imp', 'winged', 0x1abc9c, 0x0e6755, 0x21f4ca, 0x2bfff9, 0x094136],
      ['glacier_mite', 'beast', 0x5dade2, 0x335f7c, 0x78e0ff, 0xb6ffff, 0x203c4f],
      ['scrap_tick', 'beast', 0x85929e, 0x495056, 0xacbdcd, 0xf6e9fc, 0x2e3337],
      ['void_gnat', 'winged', 0x4a0080, 0x280046, 0x6000a6, 0x7600cc, 0x19002c],
      ['marsh_imp', 'winged', 0x556b2f, 0x2e3a19, 0x6e8b3d, 0xaaab4b, 0x1d2510],
      ['crystal_finch', 'winged', 0xd6eaf8, 0x758088, 0xffffff, 0xffffff, 0x4a5156],
      ['pyre_mite', 'beast', 0xe74c3c, 0x7f2921, 0xff624e, 0xff7960, 0x501a15],
      ['amber_golem', 'bulk', 0xd4a017, 0x74580c, 0xffd01d, 0xffff24, 0x4a3808],
      ['fog_wraith', 'humanoid', 0xd5d8dc, 0x757679, 0xffffff, 0xffffff, 0x4a4b4d],
      ['drift_krakenling', 'bulk', 0x1a5276, 0x0e2d40, 0x216a99, 0x2b83bc, 0x091c29],
      ['pollen_witch', 'humanoid', 0xf9e79f, 0x887f57, 0xffffce, 0xfffffe, 0x575037],
      ['basalt_guardian', 'bulk', 0x2c3e50, 0x18222c, 0x395068, 0x666380, 0x0f151c],
      ['reed_naga', 'serpent', 0x7d6608, 0x443804, 0xa2840a, 0xeaa30c, 0x2b2302],
      ['snow_berserker', 'humanoid', 0xeaf2f8, 0x808588, 0xffffff, 0xffffff, 0x515456],
      ['salt_goliath', 'bulk', 0xf5e6c8, 0x867e6e, 0xffffff, 0xffffff, 0x555046],
      ['moss_treant', 'bulk', 0x556b2f, 0x2e3a19, 0x6e8b3d, 0xaaab4b, 0x1d2510],
      ['copper_sentinel', 'bulk', 0xb87333, 0x653f1c, 0xef9542, 0xffb851, 0x402811],
      ['tide_witch', 'humanoid', 0x48c9b0, 0x276e60, 0x5dffe4, 0x73ffff, 0x19463d],
      ['ash_assassin_adept', 'humanoid', 0x6e2c00, 0x3c1800, 0x8f3900, 0xb24600, 0x260f00],
      ['bramble_hydra', 'serpent', 0x6e4a2e, 0x3c2819, 0x8f603b, 0xb27649, 0x261910],
      ['chalk_mage', 'humanoid', 0xf5e6c8, 0x867e6e, 0xffffff, 0xffffff, 0x555046],
      ['mire_hydra', 'serpent', 0x4a6741, 0x283823, 0x608554, 0x76a468, 0x192416],
      ['gust_djinn', 'winged', 0xaed6f1, 0x5f7584, 0xe2ffff, 0xffffff, 0x3c4a54],
      ['onyx_knight', 'humanoid', 0x1c2833, 0x0f161c, 0x243442, 0x2e4051, 0x090e11],
      ['peat_necromancer', 'humanoid', 0x5d4037, 0x33231e, 0x785347, 0xb66658, 0x201613],
      ['glint_sphinx', 'beast', 0xd2b4de, 0x73637a, 0xffeaff, 0xffffff, 0x493e4d],
      ['dune_wyrm', 'serpent', 0xc9a227, 0x6e5915, 0xffd232, 0xffff3e, 0x46380d],
      ['frost_centurion', 'humanoid', 0x85c1e9, 0x496a80, 0xacfaff, 0xf6ffff, 0x2e4351],
      ['root_guardian', 'bulk', 0x1e8449, 0x104828, 0x27ab5e, 0x32d374, 0x0a2e19],
      ['cinder_drake', 'winged', 0xe67e22, 0x7e4512, 0xffa32c, 0xffc936, 0x502c0b],
      ['pearl_siren', 'humanoid', 0xf5eef8, 0x868288, 0xffffff, 0xffffff, 0x555356],
      ['rune_archon_adept', 'humanoid', 0xaf7ac5, 0x60436c, 0xe39eff, 0xffc3ff, 0x3d2a44],
      ['shadow_duelist_elite', 'humanoid', 0x2c2c3a, 0x18181f, 0x39394b, 0x66465c, 0x0f0f14],
      ['coral_hydra', 'serpent', 0xe74c3c, 0x7f2921, 0xff624e, 0xff7960, 0x501a15],
      ['pine_treant', 'bulk', 0x145a32, 0x0b311b, 0x1a7541, 0x229050, 0x071f11],
      ['slag_golem', 'bulk', 0x935116, 0x502c0c, 0xbf691c, 0xeb8123, 0x331c07],
      ['ice_wyvern_adept', 'winged', 0xd6eaf8, 0x758088, 0xffffff, 0xffffff, 0x4a5156],
      ['bog_alchemist', 'humanoid', 0x7dcea0, 0x447158, 0xa2ffd0, 0xeaffff, 0x2b4838],
      ['quartz_guardian', 'bulk', 0xaed6f1, 0x5f7584, 0xe2ffff, 0xffffff, 0x3c4a54],
      ['amber_sovereign', 'bulk', 0xd4a017, 0x74580c, 0xffd01d, 0xffff24, 0x4a3808],
      ['fog_matriarch', 'winged', 0xd5d8dc, 0x757679, 0xffffff, 0xffffff, 0x4a4b4d],
      ['drift_kraken_king', 'bulk', 0x1a5276, 0x0e2d40, 0x216a99, 0x2b83bc, 0x091c29],
      ['pollen_empress', 'winged', 0xf9e79f, 0x887f57, 0xffffce, 0xfffffe, 0x575037],
      ['basalt_colossus', 'bulk', 0x2c3e50, 0x18222c, 0x395068, 0x666380, 0x0f151c],
      ['reed_hydra_queen', 'serpent', 0x7d6608, 0x443804, 0xa2840a, 0xeaa30c, 0x2b2302],
      ['snow_emperor', 'humanoid', 0xeaf2f8, 0x808588, 0xffffff, 0xffffff, 0x515456],
      ['salt_tyrant', 'bulk', 0xf5e6c8, 0x867e6e, 0xffffff, 0xffffff, 0x555046],
      ['moss_world_tree', 'bulk', 0x556b2f, 0x2e3a19, 0x6e8b3d, 0xaaab4b, 0x1d2510],
      ['copper_behemoth', 'bulk', 0xb87333, 0x653f1c, 0xef9542, 0xffb851, 0x402811],
      ['tide_leviathan', 'serpent', 0x48c9b0, 0x276e60, 0x5dffe4, 0x73ffff, 0x19463d],
      ['ash_warlord', 'humanoid', 0x6e2c00, 0x3c1800, 0x8f3900, 0xb24600, 0x260f00],
      ['bramble_primordial', 'bulk', 0x6e4a2e, 0x3c2819, 0x8f603b, 0xb27649, 0x261910],
      ['chalk_archon', 'humanoid', 0xf5e6c8, 0x867e6e, 0xffffff, 0xffffff, 0x555046],
      ['mire_sovereign', 'serpent', 0x4a6741, 0x283823, 0x608554, 0x76a468, 0x192416],
      ['gust_storm_lord', 'winged', 0xaed6f1, 0x5f7584, 0xe2ffff, 0xffffff, 0x3c4a54],
      ['onyx_overlord', 'humanoid', 0x1c2833, 0x0f161c, 0x243442, 0x2e4051, 0x090e11],
      ['peat_bone_king', 'humanoid', 0x5d4037, 0x33231e, 0x785347, 0xb66658, 0x201613],
      ['glint_astral_lord', 'winged', 0xd2b4de, 0x73637a, 0xffeaff, 0xffffff, 0x493e4d],
      ['dune_sand_emperor', 'serpent', 0xc9a227, 0x6e5915, 0xffd232, 0xffff3e, 0x46380d],
      // Expansão 5 +100 (variantes)
      ['orc_recruit', 'beast', 0x3d8b4a, 0x1f4826, 0x4eb15e, 0x5ed772, 0x132c17],
      ['goblin_scout', 'humanoid', 0xa8c734, 0x57671b, 0xd7fe42, 0xffff50, 0x353f10],
      ['slime_spawn', 'bulk', 0x44ff66, 0x238435, 0x57ff82, 0x69ff9e, 0x155120],
      ['wolf_pup', 'beast', 0x8b7355, 0x483b2c, 0xb1936c, 0xd7b283, 0x2c241b],
      ['skeleton_recruit', 'humanoid', 0xe8e0d0, 0x78746c, 0xffffff, 0xffffff, 0x4a4742],
      ['bat_hatchling', 'winged', 0x4a3728, 0x261c14, 0x5e4633, 0x72553e, 0x17110c],
      ['imp_whelp', 'winged', 0xff4422, 0x842311, 0xff572b, 0xff6934, 0x51150a],
      ['elf_apprentice', 'humanoid', 0x6bbf59, 0x37632e, 0x88f471, 0xa5ff89, 0x223d1c],
      ['zombie_thrall', 'humanoid', 0x6b8f5a, 0x374a2e, 0x88b773, 0xa5dd8b, 0x222d1c],
      ['mummy_servant', 'humanoid', 0xd4c48a, 0x6e6547, 0xfffab0, 0xffffd5, 0x433e2c],
      ['ghoul_scavenger', 'humanoid', 0x8fbc8f, 0x4a614a, 0xb7f0b7, 0xddffdd, 0x2d3c2d],
      ['kobold_miner', 'humanoid', 0xc97840, 0x683e21, 0xff9951, 0xffba63, 0x402614],
      ['bandit_thug', 'humanoid', 0x8b5a2b, 0x482e16, 0xb17337, 0xd78b42, 0x2c1c0d],
      ['pirate_deckhand', 'humanoid', 0x2f4f6f, 0x182939, 0x3c658e, 0x487aac, 0x0f1923],
      ['cyclops_youth', 'bulk', 0xc4a35a, 0x65542e, 0xfad073, 0xfffc8b, 0x3e341c],
      ['minotaur_calf', 'beast', 0x8b4513, 0x482309, 0xb15818, 0xd76a1d, 0x2c1606],
      ['harpy_fledgling', 'winged', 0xd4a0c8, 0x6e5368, 0xffccff, 0xfff8ff, 0x433340],
      ['scorpion_nymph', 'beast', 0xc45c26, 0x652f13, 0xfa7530, 0xff8e3a, 0x3e1d0c],
      ['cultist_initiate', 'humanoid', 0x5c2d6e, 0x2f1739, 0x75398c, 0x8e45aa, 0x1d0e23],
      ['gargoyle_shard', 'winged', 0x6e6e78, 0x39393e, 0x8c8c99, 0xaaaaba, 0x232326],
      ['pixie_spark', 'winged', 0xff88cc, 0x84466a, 0xffaeff, 0xffd2ff, 0x512b41],
      ['gnoll_pup', 'beast', 0xb8860b, 0x5f4505, 0xebab0e, 0xffcf11, 0x3a2a03],
      ['ratman_squeaker', 'beast', 0x7a6a5a, 0x3f372e, 0x9c8773, 0xbda48b, 0x27211c],
      ['crab_hatchling', 'beast', 0xd35400, 0x6d2b00, 0xff6b00, 0xff8200, 0x431a00],
      ['wasp_drone', 'winged', 0xf0c040, 0x7c6321, 0xfff551, 0xffff63, 0x4c3d14],
      ['toad_tadpole', 'bulk', 0x4a7c59, 0x26402e, 0x5e9e71, 0x72c089, 0x17271c],
      ['dwarf_squire', 'humanoid', 0xb87333, 0x5f3b1a, 0xeb9341, 0xffb24f, 0x3a2410],
      ['wraith_shade', 'humanoid', 0x8866ff, 0x463584, 0xae82ff, 0xd29eff, 0x2b2051],
      ['frogman_poliwog', 'humanoid', 0x3d9970, 0x1f4f3a, 0x4ec38f, 0x5eedad, 0x133023],
      ['porcupine_kit', 'beast', 0x8b7355, 0x483b2c, 0xb1936c, 0xd7b283, 0x2c241b],
      ['raven_chick', 'winged', 0x2c3e50, 0x162029, 0x384f66, 0x44607c, 0x0e1319],
      ['boar_piglet', 'beast', 0x566573, 0x2c343b, 0x6e8193, 0x859cb2, 0x1b2024],
      ['owl_fledgling', 'winged', 0x1c2833, 0x0e141a, 0x233341, 0x2b3e4f, 0x080c10],
      ['fox_kit', 'beast', 0xe67e22, 0x774111, 0xffa12b, 0xffc334, 0x49280a],
      ['shark_pup', 'beast', 0x5d8aa8, 0x304757, 0x77b0d7, 0x90d5ff, 0x1d2c35],
      ['hive_larva', 'beast', 0xf1c40f, 0x7d6507, 0xfffa13, 0xffff17, 0x4d3e04],
      ['yeti_whelp', 'beast', 0xe8eef5, 0x787b7f, 0xffffff, 0xffffff, 0x4a4c4e],
      ['spiderling', 'beast', 0x2d1b2e, 0x170e17, 0x39223a, 0x452947, 0x0e080e],
      ['snake_hatchling', 'serpent', 0x3d8b40, 0x1f4821, 0x4eb151, 0x5ed763, 0x132c14],
      ['desert_jackal_pup', 'beast', 0xc2a05a, 0x64532e, 0xf8cc73, 0xfff88b, 0x3e331c],
      ['troll_runt', 'bulk', 0x5a6e4a, 0x2e3926, 0x738c5e, 0x8baa72, 0x1c2317],
      ['slug_nymph', 'serpent', 0x556b2f, 0x2c3718, 0x6c883c, 0x83a548, 0x1b220f],
      ['ice_imp_spark', 'winged', 0x7ec8e3, 0x416876, 0xa1ffff, 0xc3ffff, 0x284048],
      ['scarab_larva', 'beast', 0x1a5c3a, 0x0d2f1e, 0x21754a, 0x288e59, 0x081d12],
      ['bone_shardling', 'winged', 0xd5d0c0, 0x6e6c63, 0xfffff5, 0xffffff, 0x44423d],
      ['ember_spark', 'winged', 0xe67e22, 0x774111, 0xffa12b, 0xffc334, 0x49280a],
      ['ash_rat_pup', 'beast', 0x6e2c00, 0x391600, 0x8c3800, 0xaa4400, 0x230e00],
      ['coral_crab_hatch', 'beast', 0xe74c3c, 0x78271f, 0xff614c, 0xff755d, 0x491813],
      ['orc_war_chief', 'beast', 0x3d8b4a, 0x1f4826, 0x4eb15e, 0x5ed772, 0x132c17],
      ['goblin_raid_captain', 'humanoid', 0xa8c734, 0x57671b, 0xd7fe42, 0xffff50, 0x353f10],
      ['slime_overseer', 'bulk', 0x44ff66, 0x238435, 0x57ff82, 0x69ff9e, 0x155120],
      ['wolf_alpha', 'beast', 0x8b7355, 0x483b2c, 0xb1936c, 0xd7b283, 0x2c241b],
      ['skeleton_captain', 'humanoid', 0xe8e0d0, 0x78746c, 0xffffff, 0xffffff, 0x4a4742],
      ['bat_matriarch', 'winged', 0x4a3728, 0x261c14, 0x5e4633, 0x72553e, 0x17110c],
      ['imp_taskmaster', 'winged', 0xff4422, 0x842311, 0xff572b, 0xff6934, 0x51150a],
      ['elf_blademaster', 'humanoid', 0x6bbf59, 0x37632e, 0x88f471, 0xa5ff89, 0x223d1c],
      ['zombie_warlord', 'humanoid', 0x6b8f5a, 0x374a2e, 0x88b773, 0xa5dd8b, 0x222d1c],
      ['mummy_pharaoh_guard', 'humanoid', 0xd4c48a, 0x6e6547, 0xfffab0, 0xffffd5, 0x433e2c],
      ['ghoul_packleader', 'humanoid', 0x8fbc8f, 0x4a614a, 0xb7f0b7, 0xddffdd, 0x2d3c2d],
      ['kobold_trapmaster', 'humanoid', 0xc97840, 0x683e21, 0xff9951, 0xffba63, 0x402614],
      ['bandit_kingpin', 'humanoid', 0x8b5a2b, 0x482e16, 0xb17337, 0xd78b42, 0x2c1c0d],
      ['pirate_captain', 'humanoid', 0x2f4f6f, 0x182939, 0x3c658e, 0x487aac, 0x0f1923],
      ['cyclops_champion', 'bulk', 0xc4a35a, 0x65542e, 0xfad073, 0xfffc8b, 0x3e341c],
      ['minotaur_arena_lord', 'beast', 0x8b4513, 0x482309, 0xb15818, 0xd76a1d, 0x2c1606],
      ['harpy_stormcaller', 'winged', 0xd4a0c8, 0x6e5368, 0xffccff, 0xfff8ff, 0x433340],
      ['scorpion_broodmother', 'beast', 0xc45c26, 0x652f13, 0xfa7530, 0xff8e3a, 0x3e1d0c],
      ['cultist_hierophant', 'humanoid', 0x5c2d6e, 0x2f1739, 0x75398c, 0x8e45aa, 0x1d0e23],
      ['gargoyle_sentinel', 'winged', 0x6e6e78, 0x39393e, 0x8c8c99, 0xaaaaba, 0x232326],
      ['pixie_queen_guard', 'winged', 0xff88cc, 0x84466a, 0xffaeff, 0xffd2ff, 0x512b41],
      ['gnoll_packlord', 'beast', 0xb8860b, 0x5f4505, 0xebab0e, 0xffcf11, 0x3a2a03],
      ['ratman_warlord', 'beast', 0x7a6a5a, 0x3f372e, 0x9c8773, 0xbda48b, 0x27211c],
      ['crab_shellbreaker', 'beast', 0xd35400, 0x6d2b00, 0xff6b00, 0xff8200, 0x431a00],
      ['wasp_hivequeen_guard', 'winged', 0xf0c040, 0x7c6321, 0xfff551, 0xffff63, 0x4c3d14],
      ['toad_bog_king', 'bulk', 0x4a7c59, 0x26402e, 0x5e9e71, 0x72c089, 0x17271c],
      ['dwarf_warcaptain', 'humanoid', 0xb87333, 0x5f3b1a, 0xeb9341, 0xffb24f, 0x3a2410],
      ['wraith_reaper', 'humanoid', 0x8866ff, 0x463584, 0xae82ff, 0xd29eff, 0x2b2051],
      ['frost_mage_adept', 'humanoid', 0x5dade2, 0x305975, 0x77ddff, 0x90ffff, 0x1d3748],
      ['death_knight_vanguard', 'humanoid', 0x3a3a5c, 0x1e1e2f, 0x4a4a75, 0x59598e, 0x12121d],
      ['shadow_assassin_master', 'humanoid', 0x1c1c28, 0x0e0e14, 0x232333, 0x2b2b3e, 0x08080c],
      ['stone_golem_warden', 'bulk', 0x7f8c8d, 0x424849, 0xa2b3b4, 0xc4d9da, 0x282c2d],
      ['orc_warchief_king', 'beast', 0x3d8b4a, 0x1f4826, 0x4eb15e, 0x5ed772, 0x132c17],
      ['goblin_warlord_king', 'humanoid', 0xa8c734, 0x57671b, 0xd7fe42, 0xffff50, 0x353f10],
      ['slime_emperor', 'bulk', 0x44ff66, 0x238435, 0x57ff82, 0x69ff9e, 0x155120],
      ['wolf_dire_king', 'beast', 0x8b7355, 0x483b2c, 0xb1936c, 0xd7b283, 0x2c241b],
      ['skeleton_bone_king', 'humanoid', 0xe8e0d0, 0x78746c, 0xffffff, 0xffffff, 0x4a4742],
      ['imp_hell_overlord', 'winged', 0xff4422, 0x842311, 0xff572b, 0xff6934, 0x51150a],
      ['elf_forest_sovereign', 'humanoid', 0x6bbf59, 0x37632e, 0x88f471, 0xa5ff89, 0x223d1c],
      ['zombie_plague_king', 'humanoid', 0x6b8f5a, 0x374a2e, 0x88b773, 0xa5dd8b, 0x222d1c],
      ['mummy_pharaoh', 'humanoid', 0xd4c48a, 0x6e6547, 0xfffab0, 0xffffd5, 0x433e2c],
      ['cyclops_mountain_king', 'bulk', 0xc4a35a, 0x65542e, 0xfad073, 0xfffc8b, 0x3e341c],
      ['minotaur_labyrinth_king', 'beast', 0x8b4513, 0x482309, 0xb15818, 0xd76a1d, 0x2c1606],
      ['harpy_sky_empress', 'winged', 0xd4a0c8, 0x6e5368, 0xffccff, 0xfff8ff, 0x433340],
      ['cultist_dark_messiah', 'humanoid', 0x5c2d6e, 0x2f1739, 0x75398c, 0x8e45aa, 0x1d0e23],
      ['gargoyle_cathedral_lord', 'winged', 0x6e6e78, 0x39393e, 0x8c8c99, 0xaaaaba, 0x232326],
      ['gnoll_war_khan', 'beast', 0xb8860b, 0x5f4505, 0xebab0e, 0xffcf11, 0x3a2a03],
      ['pirate_sea_emperor', 'humanoid', 0x2f4f6f, 0x182939, 0x3c658e, 0x487aac, 0x0f1923],
      ['bandit_crime_emperor', 'humanoid', 0x8b5a2b, 0x482e16, 0xb17337, 0xd78b42, 0x2c1c0d],
      ['dwarf_forge_king', 'humanoid', 0xb87333, 0x5f3b1a, 0xeb9341, 0xffb24f, 0x3a2410],
      ['ratman_underking', 'beast', 0x7a6a5a, 0x3f372e, 0x9c8773, 0xbda48b, 0x27211c],
      ['scorpion_dune_emperor', 'beast', 0xc45c26, 0x652f13, 0xfa7530, 0xff8e3a, 0x3e1d0c],
      // Expansão 6 +200 (variantes)
      ['amber_mite_junior', 'beast', 0xe0ac23, 0x7b5f13, 0xffdc29, 0xffff24, 0x503e0e],
      ['ash_rat_runt', 'beast', 0x7a380c, 0x451f07, 0xac4c0c, 0xff6622, 0x301606],
      ['ash_vole_cadet', 'beast', 0x7a380c, 0x431f07, 0x9b450c, 0xb24600, 0x2c1506],
      ['aurora_moth_rookie', 'winged', 0xbb86d1, 0x674a73, 0xefaaff, 0xffc3ff, 0x43304a],
      ['bandit_page', 'humanoid', 0x976637, 0x613f1f, 0xc4945c, 0xffcc66, 0x402616],
      ['bark_spider_acolyte', 'beast', 0x694c43, 0x452e2a, 0x997a6f, 0xffcc66, 0x301e16],
      ['bat_squire', 'winged', 0x564334, 0x2d231b, 0x6a523f, 0xff6644, 0x1d1612],
      ['blood_leech_larva', 'serpent', 0x9e372d, 0x6b251d, 0xcc4537, 0xff6644, 0x401612],
      ['blood_mite_junior', 'beast', 0xcc4537, 0x70261e, 0xff5643, 0xff5b44, 0x491915],
      ['boar_piglet_runt', 'beast', 0x62717f, 0x333b42, 0x7a8d9f, 0x859cb2, 0x21262a],
      ['bog_finch_cadet', 'winged', 0x89daac, 0x4b785f, 0xaeffdc, 0xeaffff, 0x314e3e],
      ['bog_mosquito_rookie', 'winged', 0x61773b, 0x3a471f, 0x849c5c, 0xaaff44, 0x202a16],
      ['bog_newt_page', 'beast', 0x61773b, 0x3a471f, 0x849c5c, 0xaaff44, 0x202a16],
      ['bone_picker_acolyte', 'beast', 0xe1dccc, 0xa19c8f, 0xf8f4e8, 0xff6644, 0x605c4e],
      ['bone_shardling_squire', 'winged', 0xe1dccc, 0x75736a, 0xffffff, 0xffffff, 0x4a4843],
      ['bramble_boar_larva', 'beast', 0x7a563a, 0x432f20, 0x9b6c47, 0xb27649, 0x2c1f16],
      ['brimstone_imp_junior', 'winged', 0xd74f41, 0x822b23, 0xf35848, 0xffee44, 0x501a16],
      ['brine_crab_runt', 'beast', 0x54d5bc, 0x219177, 0x82e3d0, 0xffffff, 0x14604e],
      ['carrion_vulture_cadet', 'winged', 0x7a563a, 0x452f1f, 0xac845c, 0xff6644, 0x301e16],
      ['cave_bat_swarm_rookie', 'winged', 0x384a5c, 0x212c37, 0x69798a, 0xffee66, 0x141c24],
      ['cave_crawler_page', 'beast', 0x694c43, 0x452e2a, 0x997a6f, 0xffcc66, 0x301e16],
      ['cave_troll_acolyte', 'bulk', 0x667a56, 0x3b4737, 0x86a07c, 0xffcc44, 0x262e1e],
      ['chalk_imp_squire', 'winged', 0xfff2d4, 0x8d8575, 0xffffff, 0xffffff, 0x5b564c],
      ['cinder_moth_larva', 'winged', 0xf28a2e, 0xa74707, 0xffbc4d, 0xffee66, 0x743206],
      ['cinder_sprite_junior', 'winged', 0xf35848, 0x993228, 0xfda096, 0xffee66, 0x6a241c],
      ['cinder_toad_runt', 'bulk', 0xf28a2e, 0x854c19, 0xffaf38, 0xffc936, 0x563211],
      ['clay_soldier_cadet', 'humanoid', 0xac845c, 0x715737, 0xcca47c, 0xffee66, 0x463626],
      ['cliff_goat_rookie', 'beast', 0xbcac9c, 0x776757, 0xdcccbc, 0xffee66, 0x463e36],
      ['copper_goblin_page', 'humanoid', 0xc47f3f, 0x81511f, 0xe0a45c, 0xffdd66, 0x502e0e],
      ['copper_tick_acolyte', 'beast', 0xc47f3f, 0x6c4623, 0xfba14e, 0xffb851, 0x462e17],
      ['coral_crab_squire', 'beast', 0xf35848, 0x993228, 0xfda096, 0xffee66, 0x6a241c],
      ['coral_crab_hatch_larva', 'beast', 0xf35848, 0x7f2e26, 0xff6d58, 0xff755d, 0x4f1e19],
      ['coral_snake_junior', 'serpent', 0xf35848, 0x993228, 0xfda096, 0xffee66, 0x6a241c],
      ['coral_urchin_runt', 'bulk', 0xf35848, 0x863028, 0xff6e5a, 0xff7960, 0x56201b],
      ['crab_cadet', 'beast', 0xdf600c, 0x913b07, 0xfc8c4c, 0xffee66, 0x602606],
      ['crystal_bat_rookie', 'winged', 0xbae2fd, 0x64b4e9, 0xe2f6ff, 0xffffff, 0x348cc7],
      ['crystal_finch_page', 'winged', 0xe2f6ff, 0x7c878f, 0xffffff, 0xffffff, 0x50575c],
      ['crystal_mite_acolyte', 'beast', 0xbae2fd, 0x64b4e9, 0xe2f6ff, 0xffffff, 0x348cc7],
      ['cultist_squire', 'humanoid', 0x68397a, 0x411f4f, 0x965cac, 0xff66ff, 0x26162e],
      ['cyclops_larva', 'bulk', 0xd0af66, 0x917537, 0xf4dc9c, 0xffee88, 0x604626],
      ['driftwood_crab_junior', 'beast', 0x977f61, 0x534635, 0xc0a17a, 0xfeb888, 0x362e23],
      ['dune_jackal_runt', 'beast', 0xe0ac23, 0x916f0f, 0xffdc4b, 0xffee88, 0x604a0e],
      ['dune_scarab_cadet', 'beast', 0xd5ae33, 0x75601c, 0xffde3e, 0xffff3e, 0x4c3e13],
      ['dune_viper_rookie', 'serpent', 0xd5ae33, 0x917717, 0xf4d45c, 0xffee44, 0x604e0e],
      ['dusk_ferret_page', 'beast', 0x694c43, 0x452e2a, 0x997a6f, 0xffcc66, 0x301e16],
      ['dust_jackal_acolyte', 'beast', 0xceac66, 0x715f38, 0xffdc81, 0xffff90, 0x493e25],
      ['dust_mephit_squire', 'winged', 0xceac66, 0x917737, 0xecd48c, 0xffee66, 0x604e26],
      ['dwarf_guard_larva', 'humanoid', 0xc47f3f, 0x81511f, 0xe0a45c, 0xffdd66, 0x502e0e],
      ['elf_junior', 'humanoid', 0x77cb65, 0x3e6a35, 0x94ff7d, 0xa5ff89, 0x284322],
      ['ember_gnat_runt', 'winged', 0xd74f41, 0x822b23, 0xf35848, 0xffee44, 0x501a16],
      ['ember_vole_cadet', 'beast', 0xd74f41, 0x762b24, 0xff6350, 0xff6b54, 0x4d1d18],
      ['fog_hare_rookie', 'beast', 0xe1e4e8, 0x7c7d80, 0xffffff, 0xffffff, 0x505153],
      ['fox_trickster_page', 'beast', 0xf28a2e, 0xa74707, 0xffbc4d, 0xffee66, 0x743206],
      ['frogman_acolyte', 'humanoid', 0x49a57c, 0x2b674f, 0x6adba6, 0xaaff66, 0x1e4636],
      ['frogman_poliwog_squire', 'humanoid', 0x49a57c, 0x265641, 0x5acf9b, 0x5eedad, 0x193629],
      ['frost_gnat_larva', 'winged', 0x91cdf5, 0x507187, 0xb8ffff, 0xf6ffff, 0x344957],
      ['frost_sprite_junior', 'winged', 0xe2f6ff, 0x8cc8f0, 0xffffff, 0xaaddff, 0x63b3e8],
      ['frost_toad_runt', 'bulk', 0x91cdf5, 0x358dc8, 0xe2f6ff, 0xffffff, 0x20587c],
      ['frost_vole_cadet', 'beast', 0xe0f2fd, 0xb5ddf8, 0xffffff, 0x4488ff, 0x8bc7ef],
      ['gargoyle_rookie', 'winged', 0x7a7a84, 0x4b4b57, 0xa6a6b4, 0x88ddff, 0x303038],
      ['geyser_toad_page', 'bulk', 0x54d5bc, 0x219177, 0x82e3d0, 0xaaff66, 0x14604e],
      ['ghoul_acolyte', 'humanoid', 0x9bc89b, 0x619161, 0xc4e4c4, 0x88ff88, 0x406040],
      ['giant_toad_squire', 'bulk', 0x568865, 0x31513b, 0x76b68c, 0xaaff66, 0x203626],
      ['glacier_imp_larva', 'winged', 0x91cdf5, 0x358dc8, 0xe2f6ff, 0xffffff, 0x20587c],
      ['glacier_mite_junior', 'beast', 0x69b9ee, 0x3a6683, 0x84ecff, 0xb6ffff, 0x264255],
      ['glass_imp_runt', 'winged', 0xe1ffef, 0x84d5a7, 0xf6fffd, 0xffffff, 0x2db466],
      ['glint_pixie_cadet', 'winged', 0xdec0ea, 0x7a6a81, 0xfff6ff, 0xffffff, 0x4f4453],
      ['gnoll_rookie', 'beast', 0xc49217, 0x815f0f, 0xe0b43c, 0xffee66, 0x503a0a],
      ['goblin_page', 'humanoid', 0xb4d340, 0x5e6e22, 0xe3ff4e, 0xffff50, 0x3b4516],
      ['gust_sylph_acolyte', 'winged', 0xbae2fd, 0x667c8b, 0xeeffff, 0xffffff, 0x42505a],
      ['harpy_squire', 'winged', 0xe0acd4, 0xa1678f, 0xfcccec, 0xffeeaa, 0x704666],
      ['ice_imp_larva', 'winged', 0x8ad4ef, 0x4797b7, 0xbcf4ff, 0xffffff, 0x2e667e],
      ['ice_tick_junior', 'beast', 0xe2f6ff, 0x7c878f, 0xffffff, 0xffffff, 0x50575c],
      ['imp_runt', 'winged', 0xff502e, 0x8b2a18, 0xff6337, 0xff6934, 0x571b10],
      ['iron_boar_cadet', 'beast', 0x62717f, 0x334557, 0x919eaa, 0xffcc44, 0x202b36],
      ['iron_tick_rookie', 'beast', 0x62717f, 0x334557, 0x919eaa, 0xffcc44, 0x202b36],
      ['ivory_skeleton_page', 'humanoid', 0xfffafc, 0xcfbfc7, 0xffffff, 0xff6644, 0x907e86],
      ['kelp_newt_acolyte', 'beast', 0x1d8671, 0x104a3e, 0x22aa8f, 0x3bc3a1, 0x0b3029],
      ['kelp_strider_squire', 'serpent', 0x1d8671, 0x11473b, 0x26c8a8, 0xaaff66, 0x0c2e26],
      ['kobold_larva', 'humanoid', 0xd5844c, 0x915727, 0xf4ac6c, 0xffee66, 0x603616],
      ['lantern_spirit_junior', 'winged', 0xffdc4b, 0xbe9c12, 0xfff3ab, 0xffffff, 0x836c0e],
      ['magma_grub_runt', 'beast', 0xd74f41, 0x822b23, 0xf35848, 0xffee66, 0x501a16],
      ['mangrove_croco_cadet', 'serpent', 0x20663e, 0x11371f, 0x2a9055, 0xaaff66, 0x0c2616],
      ['marsh_imp_rookie', 'winged', 0x61773b, 0x354120, 0x7a9749, 0xaaab4b, 0x232b16],
      ['marsh_lurker_page', 'bulk', 0x56734d, 0x31452b, 0x769c7c, 0xaaff66, 0x1e261e],
      ['minotaur_acolyte', 'beast', 0x97511f, 0x633511, 0xd08646, 0xffdd66, 0x40200e],
      ['mire_slug_squire', 'serpent', 0x56734d, 0x2f3f2a, 0x6c9160, 0x76a468, 0x1f2a1c],
      ['mist_imp_larva', 'winged', 0xa1b1b2, 0x586162, 0xcde2e3, 0xeeffff, 0x3a3f40],
      ['mist_wisp_junior', 'winged', 0xe1e4e8, 0x9cacad, 0xffffff, 0x88ddff, 0x637384],
      ['moss_newt_runt', 'beast', 0x61773b, 0x354120, 0x7a9749, 0xaaab4b, 0x232b16],
      ['moss_sprite_cadet', 'winged', 0x89daac, 0x419167, 0xb5ebcb, 0xffffaa, 0x2e664e],
      ['mummy_rookie', 'humanoid', 0xe0d096, 0xa79757, 0xf4e8bc, 0xffeeaa, 0x706636],
      ['mushroom_brute_page', 'bulk', 0xcc4537, 0x822b23, 0xf35848, 0xffee66, 0x501a16],
      ['night_owl_acolyte', 'winged', 0x28343f, 0x151b21, 0x62717f, 0xffee66, 0x10161c],
      ['night_panther_squire', 'beast', 0x282834, 0x13131b, 0x46465c, 0xaa66ff, 0x0c0c10],
      ['onyx_beetle_larva', 'beast', 0x28343f, 0x161d23, 0x30404e, 0x2e4051, 0x0f1417],
      ['aurora_moth_veteran', 'winged', 0xa772bd, 0x5b3e67, 0xdb96f7, 0xffc3ff, 0x392640],
      ['bandit_champion', 'humanoid', 0x835223, 0x553313, 0xb08048, 0xffcc66, 0x361c0c],
      ['bark_spider_sentinel', 'beast', 0x55382f, 0x39221e, 0x85665b, 0xffcc66, 0x26140c],
      ['bat_raider', 'winged', 0x422f20, 0x21170f, 0x563e2b, 0xff6644, 0x130c08],
      ['blood_leech_marshal', 'serpent', 0x8a2319, 0x5f1911, 0xb83123, 0xff6644, 0x360c08],
      ['blood_mite_prime', 'beast', 0xb83123, 0x641a12, 0xf1422f, 0xff5b44, 0x3f0f0b],
      ['boar_piglet_guardian', 'beast', 0x4e5d6b, 0x272f36, 0x66798b, 0x859cb2, 0x171c20],
      ['bog_finch_warder', 'winged', 0x75c698, 0x3f6c53, 0x9af7c8, 0xeaffff, 0x274434],
      ['bog_mosquito_veteran', 'winged', 0x4d6327, 0x2e3b13, 0x708848, 0xaaff44, 0x16200c],
      ['bog_newt_champion', 'beast', 0x4d6327, 0x2e3b13, 0x708848, 0xaaff44, 0x16200c],
      ['bone_picker_sentinel', 'beast', 0xcdc8b8, 0x959083, 0xe4e0d4, 0xff6644, 0x565244],
      ['bone_shardling_raider', 'winged', 0xcdc8b8, 0x69675e, 0xf7f7ed, 0xffffff, 0x403e39],
      ['bramble_boar_marshal', 'beast', 0x664226, 0x372314, 0x875833, 0xb27649, 0x22150c],
      ['brimstone_imp_prime', 'winged', 0xc33b2d, 0x761f17, 0xdf4434, 0xffee44, 0x46100c],
      ['brine_crab_guardian', 'beast', 0x40c1a8, 0x15856b, 0x6ecfbc, 0xffffff, 0x0a5644],
      ['carrion_vulture_warder', 'winged', 0x664226, 0x392313, 0x987048, 0xff6644, 0x26140c],
      ['cave_bat_swarm_veteran', 'winged', 0x243648, 0x15202b, 0x556576, 0xffee66, 0x0a121a],
      ['cave_crawler_champion', 'beast', 0x55382f, 0x39221e, 0x85665b, 0xffcc66, 0x26140c],
      ['cave_troll_sentinel', 'bulk', 0x526642, 0x2f3b2b, 0x728c68, 0xffcc44, 0x1c2414],
      ['chalk_imp_raider', 'winged', 0xeddec0, 0x817969, 0xf7f7f7, 0xffffff, 0x514c42],
      ['cinder_moth_marshal', 'winged', 0xde761a, 0x9b3b00, 0xeda839, 0xffee66, 0x6a2800],
      ['cinder_sprite_prime', 'winged', 0xdf4434, 0x8d261c, 0xe98c82, 0xffee66, 0x601a12],
      ['cinder_toad_guardian', 'bulk', 0xde761a, 0x79400d, 0xf79b24, 0xffc936, 0x4c2807],
      ['clay_soldier_warder', 'humanoid', 0x987048, 0x654b2b, 0xb89068, 0xffee66, 0x3c2c1c],
      ['cliff_goat_veteran', 'beast', 0xa89888, 0x6b5b4b, 0xc8b8a8, 0xffee66, 0x3c342c],
      ['copper_goblin_champion', 'humanoid', 0xb06b2b, 0x754513, 0xcc9048, 0xffdd66, 0x462404],
      ['copper_tick_sentinel', 'beast', 0xb06b2b, 0x603a17, 0xe78d3a, 0xffb851, 0x3c240d],
      ['coral_crab_raider', 'beast', 0xdf4434, 0x8d261c, 0xe98c82, 0xffee66, 0x601a12],
      ['coral_crab_hatch_marshal', 'beast', 0xdf4434, 0x73221a, 0xf75944, 0xff755d, 0x45140f],
      ['coral_snake_prime', 'serpent', 0xdf4434, 0x8d261c, 0xe98c82, 0xffee66, 0x601a12],
      ['coral_urchin_guardian', 'bulk', 0xdf4434, 0x7a241c, 0xf75a46, 0xff7960, 0x4c1611],
      ['crab_warder', 'beast', 0xcb4c00, 0x852f00, 0xe87838, 0xffee66, 0x561c00],
      ['crystal_bat_veteran', 'winged', 0xa6cee9, 0x58a8dd, 0xcee2f0, 0xffffff, 0x2a82bd],
      ['crystal_finch_champion', 'winged', 0xcee2f0, 0x707b83, 0xf7f7f7, 0xffffff, 0x464d52],
      ['crystal_mite_sentinel', 'beast', 0xa6cee9, 0x58a8dd, 0xcee2f0, 0xffffff, 0x2a82bd],
      ['cultist_raider', 'humanoid', 0x542566, 0x351343, 0x824898, 0xff66ff, 0x1c0c24],
      ['cyclops_marshal', 'bulk', 0xbc9b52, 0x85692b, 0xe0c888, 0xffee88, 0x563c1c],
      ['driftwood_crab_prime', 'beast', 0x836b4d, 0x473a29, 0xac8d66, 0xfeb888, 0x2c2419],
      ['dune_jackal_guardian', 'beast', 0xcc980f, 0x856303, 0xecc837, 0xffee88, 0x564004],
      ['dune_scarab_warder', 'beast', 0xc19a1f, 0x695410, 0xf7ca2a, 0xffff3e, 0x423409],
      ['dune_viper_veteran', 'serpent', 0xc19a1f, 0x856b0b, 0xe0c048, 0xffee44, 0x564404],
      ['dusk_ferret_champion', 'beast', 0x55382f, 0x39221e, 0x85665b, 0xffcc66, 0x26140c],
      ['dust_jackal_sentinel', 'beast', 0xba9852, 0x65532c, 0xf4c86d, 0xffff90, 0x3f341b],
      ['dust_mephit_raider', 'winged', 0xba9852, 0x856b2b, 0xd8c078, 0xffee66, 0x56441c],
      ['dwarf_guard_marshal', 'humanoid', 0xb06b2b, 0x754513, 0xcc9048, 0xffdd66, 0x462404],
      ['elf_prime', 'humanoid', 0x63b751, 0x325e29, 0x80ec69, 0xa5ff89, 0x1e3918],
      ['ember_gnat_guardian', 'winged', 0xc33b2d, 0x761f17, 0xdf4434, 0xffee44, 0x46100c],
      ['ember_vole_warder', 'beast', 0xc33b2d, 0x6a1f18, 0xf74f3c, 0xff6b54, 0x43130e],
      ['fog_hare_veteran', 'beast', 0xcdd0d4, 0x707174, 0xf7f7f7, 0xffffff, 0x464749],
      ['fox_trickster_champion', 'beast', 0xde761a, 0x9b3b00, 0xeda839, 0xffee66, 0x6a2800],
      ['frogman_sentinel', 'humanoid', 0x359168, 0x1f5b43, 0x56c792, 0xaaff66, 0x143c2c],
      ['frogman_poliwog_raider', 'humanoid', 0x359168, 0x1a4a35, 0x46bb87, 0x5eedad, 0x0f2c1f],
      ['frost_gnat_marshal', 'winged', 0x7db9e1, 0x44657b, 0xa4f2f7, 0xf6ffff, 0x2a3f4d],
      ['frost_sprite_prime', 'winged', 0xcee2f0, 0x80bce4, 0xf7f7f7, 0xaaddff, 0x59a9de],
      ['frost_toad_guardian', 'bulk', 0x7db9e1, 0x2981bc, 0xcee2f0, 0xffffff, 0x164e72],
      ['frost_vole_warder', 'beast', 0xccdee9, 0xa9d1ec, 0xf7f7f7, 0x4488ff, 0x81bde5],
      ['gargoyle_veteran', 'winged', 0x666670, 0x3f3f4b, 0x9292a0, 0x88ddff, 0x26262e],
      ['geyser_toad_champion', 'bulk', 0x40c1a8, 0x15856b, 0x6ecfbc, 0xaaff66, 0x0a5644],
      ['ghoul_sentinel', 'humanoid', 0x87b487, 0x558555, 0xb0d0b0, 0x88ff88, 0x365636],
      ['giant_toad_raider', 'bulk', 0x427451, 0x25452f, 0x62a278, 0xaaff66, 0x162c1c],
      ['glacier_imp_marshal', 'winged', 0x7db9e1, 0x2981bc, 0xcee2f0, 0xffffff, 0x164e72],
      ['glacier_mite_prime', 'beast', 0x55a5da, 0x2e5a77, 0x70d8f7, 0xb6ffff, 0x1c384b],
      ['glass_imp_guardian', 'winged', 0xcdeddb, 0x78c99b, 0xe2f2e9, 0xffffff, 0x23aa5c],
      ['glint_pixie_warder', 'winged', 0xcaacd6, 0x6e5e75, 0xf7e2f7, 0xffffff, 0x453a49],
      ['blood_leech_tyrant', 'serpent', 0x80190f, 0x59130b, 0xae2719, 0xff6644, 0x310703],
      ['blood_mite_colossus', 'beast', 0xae2719, 0x5e140c, 0xe73825, 0xff5b44, 0x3a0a06],
      ['boar_piglet_patriarch', 'beast', 0x445361, 0x212930, 0x5c6f81, 0x859cb2, 0x12171b],
      ['bog_finch_matriarch', 'winged', 0x6bbc8e, 0x39664d, 0x90edbe, 0xeaffff, 0x223f2f],
      ['bog_mosquito_duke', 'winged', 0x43591d, 0x28350d, 0x667e3e, 0xaaff44, 0x111b07],
      ['bog_newt_baron', 'beast', 0x43591d, 0x28350d, 0x667e3e, 0xaaff44, 0x111b07],
      ['bone_picker_ascendant', 'beast', 0xc3beae, 0x8f8a7d, 0xdad6ca, 0xff6644, 0x514d3f],
      ['bone_shardling_paragon', 'winged', 0xc3beae, 0x636158, 0xedede3, 0xffffff, 0x3b3934],
      ['bramble_boar_tyrant', 'beast', 0x5c381c, 0x311d0e, 0x7d4e29, 0xb27649, 0x1d1007],
      ['brimstone_imp_colossus', 'winged', 0xb93123, 0x701911, 0xd53a2a, 0xffee44, 0x410b07],
      ['brine_crab_patriarch', 'beast', 0x36b79e, 0x0f7f65, 0x64c5b2, 0xffffff, 0x05513f],
      ['carrion_vulture_matriarch', 'winged', 0x5c381c, 0x331d0d, 0x8e663e, 0xff6644, 0x210f07],
      ['cave_bat_swarm_duke', 'winged', 0x1a2c3e, 0x0f1a25, 0x4b5b6c, 0xffee66, 0x050d15],
      ['cave_crawler_baron', 'beast', 0x4b2e25, 0x331c18, 0x7b5c51, 0xffcc66, 0x210f07],
      ['cave_troll_ascendant', 'bulk', 0x485c38, 0x293525, 0x68825e, 0xffcc44, 0x171f0f],
      ['chalk_imp_paragon', 'winged', 0xe3d4b6, 0x7b7363, 0xededed, 0xffffff, 0x4c473d],
      ['cinder_moth_tyrant', 'winged', 0xd46c10, 0x953500, 0xe39e2f, 0xffee66, 0x652300],
      ['cinder_sprite_colossus', 'winged', 0xd53a2a, 0x872016, 0xdf8278, 0xffee66, 0x5b150d],
      ['cinder_toad_patriarch', 'bulk', 0xd46c10, 0x733a07, 0xed911a, 0xffc936, 0x472302],
      ['clay_soldier_matriarch', 'humanoid', 0x8e663e, 0x5f4525, 0xae865e, 0xffee66, 0x372717],
      ['cliff_goat_duke', 'beast', 0x9e8e7e, 0x655545, 0xbeae9e, 0xffee66, 0x372f27],
      ['copper_goblin_baron', 'humanoid', 0xa66121, 0x6f3f0d, 0xc2863e, 0xffdd66, 0x411f00],
      ['copper_tick_ascendant', 'beast', 0xa66121, 0x5a3411, 0xdd8330, 0xffb851, 0x371f08],
      ['coral_crab_paragon', 'beast', 0xd53a2a, 0x872016, 0xdf8278, 0xffee66, 0x5b150d],
      ['coral_crab_hatch_tyrant', 'beast', 0xd53a2a, 0x6d1c14, 0xed4f3a, 0xff755d, 0x400f0a],
      ['coral_snake_colossus', 'serpent', 0xd53a2a, 0x872016, 0xdf8278, 0xffee66, 0x5b150d],
      ['coral_urchin_patriarch', 'bulk', 0xd53a2a, 0x741e16, 0xed503c, 0xff7960, 0x47110c],
      ['crab_matriarch', 'beast', 0xc14200, 0x7f2900, 0xde6e2e, 0xffee66, 0x511700],
      ['crystal_bat_duke', 'winged', 0x9cc4df, 0x52a2d7, 0xc4d8e6, 0xffffff, 0x257db8],
      ['crystal_finch_baron', 'winged', 0xc4d8e6, 0x6a757d, 0xededed, 0xffffff, 0x41484d],
      ['crystal_mite_ascendant', 'beast', 0x9cc4df, 0x52a2d7, 0xc4d8e6, 0xffffff, 0x257db8],
      ['cultist_paragon', 'humanoid', 0x4a1b5c, 0x2f0d3d, 0x783e8e, 0xff66ff, 0x17071f],
      ['cyclops_tyrant', 'bulk', 0xb29148, 0x7f6325, 0xd6be7e, 0xffee88, 0x513717],
      ['driftwood_crab_colossus', 'beast', 0x796143, 0x413423, 0xa2835c, 0xfeb888, 0x271f14],
      ['dune_jackal_patriarch', 'beast', 0xc28e05, 0x7f5d00, 0xe2be2d, 0xffee88, 0x513b00],
      ['dune_scarab_matriarch', 'beast', 0xb79015, 0x634e0a, 0xedc020, 0xffff3e, 0x3d2f04],
      ['dune_viper_duke', 'serpent', 0xb79015, 0x7f6505, 0xd6b63e, 0xffee44, 0x513f00],
      ['dusk_ferret_baron', 'beast', 0x4b2e25, 0x331c18, 0x7b5c51, 0xffcc66, 0x210f07],
      ['dust_jackal_ascendant', 'beast', 0xb08e48, 0x5f4d26, 0xeabe63, 0xffff90, 0x3a2f16],
      ['dust_mephit_paragon', 'winged', 0xb08e48, 0x7f6525, 0xceb66e, 0xffee66, 0x513f17],
    ];

    const clampCh = (n) => Math.min(255, Math.max(0, n | 0));
    for (const [type, template, body, dark, light, eye, accent] of entries) {
      if (this.textures.exists(`monster_${type}`)) continue;
      // Highlight derivado da cor clara para volume extra nos templates.
      const hi =
        (clampCh(((light >> 16) & 0xff) + 40) << 16) |
        (clampCh(((light >> 8) & 0xff) + 40) << 8) |
        clampCh((light & 0xff) + 40);
      registerMonsterSprite(this, type, templates[template], {
        B: body,
        D: dark,
        L: light,
        E: eye,
        W: 0xf5f5f5,
        A: accent,
        H: hi,
      });
    }
  }
}
