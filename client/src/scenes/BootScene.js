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

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('lava_tile', '/assets/lava.png');
    this.load.audio('player_death', '/assets/meda1real.mp3');
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
    this.createLavaTextures();
    this.createRockSprites();
    this.createBloodSprites();
    this.createBonesSprites();
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
      phoenix: {
        rows: [
          '................',
          '..YY......YY....',
          '.YOOY....YOOY...',
          'YORROY..YORROY..',
          '.YORRYYYYORROY..',
          '..YORRDDDRROY...',
          '...YORWWWROY....',
          '....YOWWWOY.....',
          '.....YWWWY......',
          '....YYOOYY......',
          '...YOOOOOOY.....',
          '..YOOY..YOOY....',
          '.YOOY....YOOY...',
          '................',
          '................',
          '................',
        ],
        palette: { Y: 0xffee55, O: 0xff8833, R: 0xff4400, D: 0xaa2200, W: 0xffcc88 },
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
  }

  createRockSprites() {
    // D=sombra, L=base, M=meio, H=highlight, C=fenda
    const grey = { D: 0x2a2a32, L: 0x555562, M: 0x7a7a88, H: 0xb0b0bc, C: 0x3a3a44 };
    const slate = { D: 0x1e2a32, L: 0x4a5c68, M: 0x6e8490, H: 0xa8bcc4, C: 0x2e3e48 };
    const basalt = { D: 0x1a1a22, L: 0x3e3e4a, M: 0x5c5c6a, H: 0x8e8e9c, C: 0x282834 };
    const granite = { D: 0x2e2828, L: 0x6a5e5a, M: 0x8e8078, H: 0xc4b4a4, C: 0x3e3634 };
    const moss = { D: 0x243028, L: 0x4a5a48, M: 0x6e7e62, H: 0xa0b088, C: 0x2e3a30 };

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
    const pose = [
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
    };

    for (const [type, palette] of Object.entries(schools)) {
      makePixelTexture(this, `wizard_${type}`, pose, palette);
    }
  }

  createMonsterSprites() {
    // Imp — small red demon with horns
    makePixelTexture(
      this,
      'monster_imp',
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
    makePixelTexture(
      this,
      'monster_slime',
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
    makePixelTexture(
      this,
      'monster_wraith',
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
    makePixelTexture(
      this,
      'monster_goblin',
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
    makePixelTexture(
      this,
      'monster_orc',
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
    makePixelTexture(
      this,
      'monster_skeleton',
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
    makePixelTexture(
      this,
      'monster_skeleton_archer',
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
    makePixelTexture(
      this,
      'monster_wolf',
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
    makePixelTexture(
      this,
      'monster_giant_spider',
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
    makePixelTexture(
      this,
      'monster_bat',
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
    makePixelTexture(
      this,
      'monster_elf',
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
    makePixelTexture(
      this,
      'monster_beholder',
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
    makePixelTexture(
      this,
      'monster_dragon',
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
    makePixelTexture(
      this,
      'monster_lich',
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
  }
}
