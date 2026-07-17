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
    this.createBruxaoSprite();
    this.createArenaBrickTexture();
    this.createLavaTextures();
    this.createRockSprites();
    this.scene.start('Lobby');
  }

  createRockSprites() {
    // Pedra pequena
    makePixelTexture(
      this,
      'rock_stone',
      [
        '........',
        '..DDDD..',
        '.DLLLLD.',
        '.DLHHLD.',
        '.DLLLLD.',
        '..DDDD..',
        '........',
        '........',
      ],
      { D: 0x4a4a52, L: 0x7a7a84, H: 0xa8a8b0 },
      3
    );

    // Rocha média
    makePixelTexture(
      this,
      'rock_rock',
      [
        '............',
        '....DDDD....',
        '..DDLLLLDD..',
        '.DLLHHHHLLD.',
        '.DLHHHHHHLD.',
        '.DLLHHHHLLD.',
        '..DDLLLLDD..',
        '....DDDD....',
        '............',
        '............',
        '............',
        '............',
      ],
      { D: 0x3d3d45, L: 0x6e6e78, H: 0x9a9aa4 },
      3
    );

    // Pedrão
    makePixelTexture(
      this,
      'rock_boulder',
      [
        '................',
        '......DDDD......',
        '....DDLLLLDD....',
        '...DLLHHHHLLD...',
        '..DLHHHHHHHHLD..',
        '.DLHHHHHHHHHHLD.',
        '.DLHHHHHHHHHHLD.',
        '.DLLHHHHHHHHLLD.',
        '..DLHHHHHHHHLD..',
        '...DLLHHHHLLD...',
        '....DDLLLLDD....',
        '......DDDD......',
        '................',
        '................',
        '................',
        '................',
      ],
      { D: 0x2f2f36, L: 0x5c5c66, H: 0x8a8a96 },
      3
    );
  }

  createLavaTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Tile de lava (fluxo)
    const tw = 64;
    const th = 64;
    g.clear();
    g.fillStyle(0x3a0800, 1);
    g.fillRect(0, 0, tw, th);
    const blobs = [
      [4, 8, 22, 14, 0x8b1a00],
      [28, 4, 18, 16, 0xb83b00],
      [40, 30, 20, 18, 0x7a1500],
      [8, 36, 24, 16, 0xc44a00],
      [32, 44, 16, 12, 0x5c1000],
      [18, 22, 14, 10, 0xe85d04],
      [48, 12, 12, 10, 0xff7a18],
      [2, 50, 14, 10, 0xd35400],
    ];
    for (const [x, y, w, h, c] of blobs) {
      g.fillStyle(c, 1);
      g.fillEllipse(x + w / 2, y + h / 2, w, h);
    }
    // Brilhos quentes
    g.fillStyle(0xffc857, 0.85);
    g.fillEllipse(22, 28, 8, 5);
    g.fillEllipse(50, 48, 7, 4);
    g.fillEllipse(12, 54, 6, 3);
    g.generateTexture('lava_tile', tw, th);

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
    for (const key of ['lava_tile', 'lava_bubble_0', 'lava_bubble_1', 'lava_bubble_2']) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  createArenaBrickTexture() {
    const tw = 64;
    const th = 32;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Argamassa
    g.fillStyle(0xcfd3da, 1);
    g.fillRect(0, 0, tw, th);

    const brickW = 30;
    const brickH = 14;

    const drawBrick = (x, y, w = brickW) => {
      if (w <= 0) return;
      g.fillStyle(0xf4f6fa, 1);
      g.fillRect(x, y, w, brickH);
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(x, y, w, 2);
      g.fillStyle(0xe2e6ee, 1);
      g.fillRect(x, y + brickH - 2, w, 2);
    };

    // Fileira 1 — alinhada
    drawBrick(1, 1);
    drawBrick(33, 1);
    // Fileira 2 — deslocada (padrão tijolo, tile contínuo)
    drawBrick(0, 17, 15);
    drawBrick(17, 17);
    drawBrick(49, 17, 15);

    g.generateTexture('arena_brick', tw, th);
    g.destroy();
    this.textures.get('arena_brick').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /** Title mascot: Ronaldinho smile + Gandalf robe/beard. */
  createBruxaoSprite() {
    makePixelTexture(
      this,
      'bruxao',
      [
        '........................',
        '..........HH............',
        '.........HHHH...........',
        '........HHHHHH..........',
        '.......HHHHHHHH.........',
        '......HHHHHHHHHH........',
        '.....HHHHBBBBHHHH.......',
        '......HHFFFFFFHH........',
        '.....SFFFFFFFFFFS.......',
        '....SSNENFFFFNENSS......', // sobrancelhas + olhos
        '....SSFFFFFFFFFFSS......',
        '....SSDDDDDDDDDDSS......', // sorriso largo
        '....SS.DDDGGDDD.SS......', // gap estilo Ronaldinho
        '.....SFFFFFFFFFFS.......',
        '......FFFFFFFFFFF.......',
        '......FFFFFFFFFFF.......',
        '.....RFFFFFFFFFFFR......',
        '....RRFFFFFFFFFFFRR.....',
        '...RRRR.FFFFFF.RRRR.....',
        '..RRRRR........RRRRR.C..',
        '..RRRR..........RRRR.C..',
        '..RRRR..........RRRR.C..',
        '..RRRR..........RRRR.C..',
        '..RRR............RRR.C..',
        '..LLL............LLL.Y..',
        '........................',
        '........................',
        '........................',
      ],
      {
        H: 0xb8c4d4, // chapéu cinza Gandalf
        B: 0x6e4a2e, // faixa do chapéu
        S: 0xc68642, // pele Ronaldinho
        N: 0x5c3a1e, // sobrancelha
        E: 0x1a1a1a, // olhos
        D: 0xfff8e7, // dentes
        G: 0x2a1a10, // gap do sorriso
        F: 0xe8eef5, // barba / cabelo branco
        R: 0x6b7280, // robe cinza
        C: 0x8b5a2b, // cajado
        Y: 0xf1c40f, // ponta do cajado
        L: 0x3d3d3d, // botas
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
  }
}
