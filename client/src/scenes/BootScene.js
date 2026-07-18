import Phaser from 'phaser';

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

/** Offset lower-body pixels to fake a walk / limb cycle. side: -1 left, +1 right. */
function makeWalkPose(rows, side) {
  const h = rows.length;
  const w = rows[0].length;
  const src = rows.map((r) => r.split(''));
  const dst = Array.from({ length: h }, () => Array(w).fill('.'));
  let last = 0;
  for (let y = 0; y < h; y++) {
    if (src[y].some((c) => c !== '.')) last = y;
  }
  const fromRow = Math.max(0, last - 3);
  const mid = Math.floor(w / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = src[y][x];
      if (ch === '.') continue;
      let nx = x;
      let ny = y;
      if (y >= fromRow) {
        const left = x < mid;
        if (side < 0) {
          nx = x + (left ? -1 : 1);
          ny = y + (left ? 1 : -1);
        } else {
          nx = x + (left ? 1 : -1);
          ny = y + (left ? -1 : 1);
        }
      }
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && dst[ny][nx] === '.') {
        dst[ny][nx] = ch;
      }
    }
  }
  return dst.map((row) => row.join(''));
}

/** Idle + walk frames + Phaser anim for a monster type. */
function registerMonsterSprite(scene, type, idle, palette) {
  const base = `monster_${type}`;
  makePixelTexture(scene, base, idle, palette);
  makePixelTexture(scene, `${base}_wL`, makeWalkPose(idle, -1), palette);
  makePixelTexture(scene, `${base}_wR`, makeWalkPose(idle, 1), palette);

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
      frameRate: 8,
      repeat: -1,
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
    this.load.audio('battle_music', '/assets/pao-queijo-escuridao.mp3');
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
    this.createLavaTextures();
    this.createRockSprites();
    this.createFurnitureSprites();
    this.createShellSprites();
    this.createCactusSprites();
    this.createTreeSprites();
    this.createBloodSprites();
    this.createBonesSprites();
    this.createLootBagSprite();
    this.createCoinSprite();
    this.createSpellIcons();
    this.scene.start('Lobby');
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
    // Imp — small red demon with horns
    registerMonsterSprite(
      this,
      'imp',
      [
        '................',
        '....H......H....',
        '...HH......HH...',
        '..HRRRRRRRRRRH..',
        '.HRRRRRRRRRRRRH.',
        '.HRRYBRRRBYRRRH.',
        '.HRRRRRRRRRRRRH.',
        '..HRRDDDDRRRH...',
        '...HRRRRRRRH....',
        '....HDDDDDH.....',
        '...HRR...RRH....',
        '..HRR.....RRH...',
        '.HRR.......RRH..',
        '................',
        '................',
        '................',
      ],
      {
        H: 0x6b1a00,
        R: 0xe74c3c,
        D: 0xa93226,
        Y: 0xf1c40f,
        B: 0x1a1a1a,
      }
    );

    // Slime — round green blob
    registerMonsterSprite(
      this,
      'slime',
      [
        '................',
        '................',
        '......GGGG......',
        '....GGLLLLGG....',
        '...GLLWWLLLLG...',
        '..GLLLWWLLLLLG..',
        '..GLLBBLLBBLLG..',
        '..GLLLLLLLLLLG..',
        '..GLLLLLLLLLLG..',
        '...GDLLLLLLDG...',
        '....GGDDDDGG....',
        '.....GGGGGG.....',
        '......G..G......',
        '................',
        '................',
        '................',
      ],
      {
        G: 0x27ae60,
        L: 0x58d68d,
        D: 0x1e8449,
        W: 0xd5f5e3,
        B: 0x1a1a1a,
      }
    );

    // Wraith — floating purple spirit
    registerMonsterSprite(
      this,
      'wraith',
      [
        '................',
        '.....LLLLL......',
        '....LPPPPPL.....',
        '...LPPWPPWPL....',
        '...LPPCPPCPL....',
        '....LPPPPPL.....',
        '.....LPPPL......',
        '....LPPPPPL.....',
        '...LPPPLPPPL....',
        '..LPP..P..PPL...',
        '.LP.........PL..',
        'LP...........PL.',
        '................',
        '................',
        '................',
        '................',
      ],
      {
        P: 0x8e44ad,
        L: 0xbb8fce,
        W: 0xf5eef8,
        C: 0x5dade2,
      }
    );

    // Goblin — small green skirmisher with big ears
    registerMonsterSprite(
      this,
      'goblin',
      [
        '................',
        '.EE..........EE.',
        '.EGG........GGE.',
        '..EGGGGGGGGGGE..',
        '..EGGWYGGYWGE...',
        '...EGGGGGGGGE...',
        '...EGGDMMDGGE...',
        '....EGGGGGGE....',
        '.....EG..GE.....',
        '....EGG..GGE....',
        '...EGG....GGE...',
        '..EGG......GGE..',
        '................',
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
      }
    );

    // Orc — bulky green bruiser with tusks
    registerMonsterSprite(
      this,
      'orc',
      [
        '................',
        '....OOOOOOOO....',
        '...OOLLLLLLOO...',
        '..OOLWLLLWLOO...',
        '..OOLLLLLLLOO...',
        '..OOTLLLLLTTOO..',
        '...OLLLLLLLO....',
        '..OOLLLLLLLOO...',
        '.OOOLLLLLLLOOO..',
        '.OOL......LOO...',
        '.OO........OO...',
        'OO..........OO..',
        'OO..........OO..',
        '................',
        '................',
        '................',
      ],
      {
        O: 0x1e5c2a,
        L: 0x3d8b4a,
        W: 0xf5eef8,
        T: 0xf5f5dc,
      }
    );

    // Skeleton — melee undead with rusty blade
    registerMonsterSprite(
      this,
      'skeleton',
      [
        '................',
        '.....WWWWWW.....',
        '....WWBWWBWW....',
        '....WWWWWWWW....',
        '.....WWDDWW.....',
        '......WDDW......',
        '....RR.WW.RR....',
        '...RWWWWWWWW....',
        '..R.WW.WW.WW....',
        '....WW....WW....',
        '....WW....WW....',
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
      }
    );

    // Skeleton archer — ranged-only with bow
    registerMonsterSprite(
      this,
      'skeleton_archer',
      [
        '................',
        '.....WWWWWW.....',
        '....WWBWWBWW....',
        '....WWWWWWWW....',
        '.....WWDDWW.....',
        '..M...WDDW......',
        '.M.M.WWWWWW.A...',
        'M...WW.WW.WWA...',
        '.....WW..WW.A...',
        '.....WW..WW.....',
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
      }
    );

    // Wolf — lean brown hunter
    registerMonsterSprite(
      this,
      'wolf',
      [
        '................',
        '................',
        '...EE......EE...',
        '..EFF......FFE..',
        '..EFFFFFFFFFFE..',
        '..EFWBFFFFBWFE..',
        '...EFFFFFFFFE...',
        '....EFFFFFE.....',
        '...EFFFFFFFE....',
        '..EF.E..E.FE....',
        '.EF........FE...',
        'EF..........FE..',
        'T............T..',
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
      }
    );

    // Giant spider — dark arachnid with many legs
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
        '.LDDRRRRRRRDL...',
        'LDDRRRRRRRRRDL..',
        '.L.DRRRRRRRD.L..',
        'L...DR....RD...L',
        '.....D....D.....',
        '....L......L....',
        '...L........L...',
        '................',
        '................',
        '................',
      ],
      {
        D: 0x1a0f1c,
        R: 0x4a2048,
        W: 0xe74c3c,
        L: 0x2d1b2e,
      }
    );

    // Bat — small flying skirmisher
    registerMonsterSprite(
      this,
      'bat',
      [
        '................',
        '................',
        'WW..........WW..',
        '.WW.BBBBBB.WW...',
        '..WBBBBBBBBW....',
        '...BBEYYEEBB....',
        '...BBBBBBBB.....',
        '....BB..BB......',
        '....B....B......',
        '................',
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
      }
    );

    // Elf — nimble forest archer with pointed ears + bow
    registerMonsterSprite(
      this,
      'elf',
      [
        '................',
        '....N......N....',
        '...NHHHHHHHN....',
        '...HSSSSSSSH....',
        '...HSBEESBSH.A..',
        '....HSSSSSH.A...',
        '....HGGGGGH.A...',
        '...HGGGGGGGH....',
        '..HG.GGGG.GH.M..',
        '..HG......GH.M..',
        '..LL......LL....',
        '................',
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
      }
    );

    // Beholder — olho central + pedúnculos
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
        '.PPYWBYYYYBWYPP.',
        '.PPYWBBBBBBWYPP.',
        '..PPYWWWWWWYPP..',
        '..PPPYYYYYYPPP..',
        '...PPPDDDDPPP...',
        '....PPPPPPPP....',
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
      }
    );

    // Dragon — corpo vermelho + asas + chifres
    registerMonsterSprite(
      this,
      'dragon',
      [
        '................',
        '..H..........H..',
        '.HR..........RH.',
        '..RRW......WRR..',
        '.WRRRRRRRRRRRRW.',
        'WRRRYBRRRRBYRRRW',
        '.RRRRRRRRRRRRR..',
        '..RRRDDDDRRR....',
        '.WWRRRRRRRRWW...',
        'WWRR......RRWW..',
        '.RR........RR...',
        '.R.R......R.R...',
        '................',
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
      }
    );

    // Lich — capuz + crânio + orbe de gelo
    registerMonsterSprite(
      this,
      'lich',
      [
        '................',
        '.....HHHHH......',
        '....HNNNNNH.....',
        '...HNSSSSSNH....',
        '...HNSBEESNH.C..',
        '....HNSSSNH.C...',
        '....HNNNNNH.C...',
        '...HPPPPPPPH....',
        '..HPPPPPPPPPH...',
        '..HP.PPPPP.PH...',
        '..LL......LL....',
        '................',
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
      }
    );

    // Fire Elemental — chama viva com núcleo branco
    registerMonsterSprite(
      this,
      'fire_elemental',
      [
        '................',
        '......YY........',
        '.....YOOY.......',
        '....YORROY.Y....',
        '...YORRRROYOO...',
        '..YORRWWWRROY...',
        '.YORRWBWBWRROY..',
        '.YORRRWWWRRROY..',
        '..YORRRRRRROY...',
        '...YORRDDROY....',
        '....YORRROY.....',
        '.....YOOY.......',
        '....Y.YY.Y......',
        '...Y......Y.....',
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
      }
    );

    // Demon — chifres, asas e olhos elétricos
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
        '.WRRRRRRRRRRW...',
        '..WRRDDDDRRW....',
        '.WWRRRRRRRRWW...',
        'WWRR......RRWW..',
        '.RR........RR...',
        '.R.R......R.R...',
        '..L........L....',
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
      }
    );

    // Grim Reaper — capuz negro + foice + olhos violeta
    registerMonsterSprite(
      this,
      'grim_reaper',
      [
        '................',
        '....HHHHHH......',
        '...HNNNNNNH..B..',
        '..HNSSSSSNH.BB..',
        '..HNSVVVSNH.BB..',
        '..HNSSSSSNH.B...',
        '..HNNNNNNNH.B...',
        '..HPPPPPPPH.B...',
        '..HPPPPPPPH.B...',
        '..HP.PPPP.PH....',
        '..LL......LL....',
        '................',
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
      }
    );

    // Bruxo — chapéu pontudo + orbe de fogo
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
        '....HRRRRH...F..',
        '....HPPPPPH.....',
        '...HPPPPPPPH....',
        '...HP.PPP.PH....',
        '...LL......LL...',
        '................',
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
  }
}
