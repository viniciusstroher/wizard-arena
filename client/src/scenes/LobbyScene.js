import Phaser from 'phaser';
import { getSocket } from '../net/socket.js';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  create() {
    this.socket = getSocket();
    this.playerName = localStorage.getItem('wa_name') || `Mage${Math.floor(Math.random() * 900 + 100)}`;
    this.joined = false;
    this.ready = false;
    this.lobby = null;
    this.lobbyMusic = null;
    this.lobbyMusicVolume = this.loadLobbyMusicVolume();
    this.saveLobbyMusicVolume(this.lobbyMusicVolume);
    this.settingsModalOpen = false;
    this.settingsModal = null;
    this.volumeSlider = null;

    this.drawBackground();
    this.buildUI();
    this.bindSocket();
    this.startLobbyMusic();

    this.events.once('shutdown', () => {
      this.closeSettingsModal();
      this.stopLobbyMusic();
    });
  }

  loadLobbyMusicVolume() {
    return 0.25;
  }

  saveLobbyMusicVolume(vol) {
    this.lobbyMusicVolume = Phaser.Math.Clamp(vol, 0, 1);
    localStorage.setItem('wa_lobby_music_vol', String(this.lobbyMusicVolume));
    if (this.lobbyMusic) this.lobbyMusic.setVolume(this.lobbyMusicVolume);
  }

  startLobbyMusic() {
    const tracks = ['lobby_music_a', 'lobby_music_b'].filter((key) =>
      this.cache.audio.exists(key)
    );
    if (!tracks.length) return;
    this.stopLobbyMusic();
    const key = tracks[Math.floor(Math.random() * tracks.length)];
    this.lobbyMusic = this.sound.add(key, {
      loop: true,
      volume: this.lobbyMusicVolume,
    });
    const play = () => {
      if (this.lobbyMusic && !this.lobbyMusic.isPlaying) {
        this.lobbyMusic.play();
      }
    };
    if (this.sound.locked) {
      this.sound.once('unlocked', play);
    } else {
      play();
    }
  }

  stopLobbyMusic() {
    if (this.lobbyMusic) {
      this.lobbyMusic.stop();
      this.lobbyMusic.destroy();
      this.lobbyMusic = null;
    }
  }

  drawBackground() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0b1020, 0x0b1020, 0x1a1040, 0x102030, 1);
    bg.fillRect(0, 0, width, height);

    // Arena ring decoration
    const ring = this.add.graphics();
    ring.lineStyle(2, 0x6b5cff, 0.25);
    ring.strokeCircle(width / 2, height / 2 + 40, 220);
    ring.lineStyle(1, 0xff6b4a, 0.15);
    ring.strokeCircle(width / 2, height / 2 + 40, 160);

    this.createTopFlames(width, height);
    this.createMagicFlakes(width, height);

    const title = this.add
      .text(width / 2 - 36, 72, 'WIZARD ARENA', {
        fontFamily: 'Georgia, serif',
        fontSize: '56px',
        color: '#f4e8ff',
        stroke: '#3a2060',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(2);

    const manaPotion = this.add
      .image(title.x + title.width / 2 + 8, title.y + 6, 'mana_potion')
      .setOrigin(0, 0.5)
      .setScale(1.15)
      .setDepth(2);

    this.tweens.add({
      targets: manaPotion,
      y: manaPotion.y - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  ensureFlameTextures() {
    if (this.textures.exists('flame_tongue')) return;

    const makeSoft = (key, w, h, rx, ry, cy) => {
      const tex = this.textures.createCanvas(key, w, h);
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

    // Língua alongada (ponta para baixo no canvas; usada com rotação)
    makeSoft('flame_tongue', 28, 48, 9, 20, 22);
    makeSoft('flame_core', 18, 28, 5, 11, 12);
    makeSoft('flame_ember', 10, 10, 4, 4, 5);
  }

  /** Cortina de chamas no topo: 100% da largura, até 5% da altura. */
  createTopFlames(width, height) {
    this.ensureFlameTextures();
    const band = height * 0.05;
    this.topFlameBand = band;
    this.topFlameWidth = width;

    const glow = this.add.graphics().setDepth(0.4);
    glow.fillGradientStyle(0xff2200, 0xff2200, 0x1a0800, 0x1a0800, 0.7, 0.7, 0, 0);
    glow.fillRect(0, 0, width, band * 0.55);
    glow.fillGradientStyle(0xff6600, 0xff6600, 0x0b1020, 0x0b1020, 0.35, 0.35, 0, 0);
    glow.fillRect(0, 0, width, band);

    // Colunas de línguas desenhadas (flicker por frame)
    this.topFlameGfx = this.add.graphics().setDepth(0.9).setBlendMode(Phaser.BlendModes.ADD);
    const cols = Math.max(28, Math.ceil(width / 22));
    this.topFlameTongues = [];
    for (let i = 0; i < cols; i++) {
      this.topFlameTongues.push({
        x: ((i + 0.5) / cols) * width + Phaser.Math.FloatBetween(-8, 8),
        phase: Math.random() * Math.PI * 2,
        speed: 9 + Math.random() * 8,
        baseW: 12 + Math.random() * 18,
        baseH: band * (0.75 + Math.random() * 0.35),
        lean: Phaser.Math.FloatBetween(-0.35, 0.35),
      });
    }

    // Fumaça/brilho denso da base (topo da tela)
    this.add
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

    // Núcleo amarelo/branco das chamas
    this.add
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

    // Brasas e faíscas
    this.add
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

  drawTopFlames() {
    const g = this.topFlameGfx;
    const tongues = this.topFlameTongues;
    if (!g || !tongues) return;

    g.clear();
    const t = this.time.now * 0.001;
    const band = this.topFlameBand;

    // Base contínua de brasa no topo
    g.fillStyle(0xff2200, 0.55);
    g.fillRect(0, 0, this.topFlameWidth, band * 0.22);
    g.fillStyle(0xff6600, 0.4);
    g.fillRect(0, 0, this.topFlameWidth, band * 0.12);
    g.fillStyle(0xffcc44, 0.35);
    g.fillRect(0, 0, this.topFlameWidth, band * 0.05);

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

      // Envelope vermelho/laranja
      g.fillStyle(0xff2200, 0.5 * flicker);
      g.fillTriangle(x0 - w, y0, x0 + w, y0, xTip, yTip);
      g.fillStyle(0xff6600, 0.55 * flicker);
      g.fillTriangle(x0 - w * 0.65, y0, x0 + w * 0.65, y0, xTip, yTip * 0.92);

      // Núcleo amarelo
      g.fillStyle(0xffcc33, 0.65 * flicker);
      g.fillTriangle(x0 - w * 0.35, y0, x0 + w * 0.35, y0, xTip * 0.15 + x0 * 0.85, yTip * 0.62);
      g.fillStyle(0xfff6c8, 0.55 * flicker);
      g.fillTriangle(x0 - w * 0.16, y0, x0 + w * 0.16, y0, x0 + tipSway * 0.25, yTip * 0.35);

      // Ponta quente
      g.fillStyle(0xffffff, 0.4 * flicker);
      g.fillCircle(xTip, yTip, 1.5 + 2 * flicker);
    }
  }

  update() {
    this.drawTopFlames();
  }

  /** Flocos de luz/magia caindo do topo até ~10% da altura. */
  createMagicFlakes(width, height) {
    const fallBand = height * 0.1;

    this.add
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

    this.add
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

  buildUI() {
    const { width, height } = this.scale;
    const panelX = width / 2;
    const panelY = height / 2 + 10;
    const btnW = 280;
    const btnH = 48;
    const btnGap = 8;

    this.add
      .text(panelX, panelY - 210, 'Lobby', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '22px',
        color: '#e8dfff',
      })
      .setOrigin(0.5);

    this.add
      .text(panelX, panelY - 168, 'Seu nome', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5);

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.maxLength = 16;
    inputEl.value = this.playerName;
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;
    inputEl.placeholder = 'Digite seu nome';
    inputEl.style.cssText = [
      'width: 380px',
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

    this.nameInput = this.add.dom(panelX, panelY - 130, inputEl).setOrigin(0.5);
    this.nameInput.addListener('keydown');
    this.nameInput.on('keydown', (event) => {
      if (event.key === 'Enter') this.joinLobby();
    });

    this.statusText = this.add
      .text(panelX, panelY - 76, 'Digite seu nome e clique em Entrar.', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5);

    // Lista fixa (~4 linhas); scroll automático se passar de 4 jogadores
    const listEl = document.createElement('div');
    listEl.style.cssText = [
      'width: 420px',
      'height: 112px',
      'overflow-y: auto',
      'overflow-x: hidden',
      'box-sizing: border-box',
      'padding: 4px 8px',
      'font-size: 16px',
      'font-family: Trebuchet MS, sans-serif',
      'line-height: 26px',
      'color: #eee6ff',
      'text-align: center',
      'white-space: pre-line',
      'background: transparent',
      'scrollbar-width: thin',
      'scrollbar-color: #6b5cff #1a1430',
    ].join(';');
    this.playersListEl = listEl;
    this.playersListDom = this.add.dom(panelX, panelY + 8, listEl).setOrigin(0.5);
    listEl.textContent = 'Nenhum jogador ainda';

    const btnStartY = panelY + 90;
    const step = btnH + btnGap;
    this.joinBtn = this.makeButton(panelX, btnStartY, 'Entrar', 0x6b5cff, () => this.joinLobby(), btnW);
    this.readyBtn = this.makeButton(panelX, btnStartY + step, 'Ready', 0x2ecc71, () => this.toggleReady(), btnW);
    this.setButtonEnabled(this.readyBtn, false);

    this.botsBtn = this.makeButton(
      panelX,
      btnStartY + step * 2,
      '+ Adicionar Bot',
      0xff8c42,
      () => this.addBot(),
      btnW
    );
    this.setButtonEnabled(this.botsBtn, false);

    this.controlsBtn = this.makeButton(
      panelX,
      btnStartY + step * 3,
      'Comandos',
      0x443866,
      () => this.openControlsModal(),
      btnW
    );

    this.settingsBtn = this.makeButton(
      panelX,
      btnStartY + step * 4,
      'Config',
      0x443866,
      () => this.openSettingsModal(),
      btnW
    );

    this.controlsModalOpen = false;
    this.controlsModal = this.add.container(0, 0).setDepth(400).setVisible(false);
    this.settingsModal = this.add.container(0, 0).setDepth(400).setVisible(false);

    this.hint = this.add
      .text(panelX, height - 36, 'Mín. 2 jogadores ready para iniciar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#7a6e96',
      })
      .setOrigin(0.5);
  }

  openSettingsModal() {
    if (this.settingsModalOpen) return;
    if (this.controlsModalOpen) this.closeControlsModal();
    this.settingsModalOpen = true;

    if (this.nameInput) this.nameInput.setVisible(false);

    const { width, height } = this.scale;
    this.settingsModal.removeAll(true);
    this.settingsModal.setDepth(10000).setVisible(true);
    this.children.bringToTop(this.settingsModal);

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.closeSettingsModal());

    const panel = this.add
      .rectangle(width / 2, height / 2, 420, 260, 0x161228, 0.98)
      .setStrokeStyle(2, 0x6b5cff)
      .setInteractive();

    const title = this.add
      .text(width / 2, height / 2 - 90, 'Configurações', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    const volLabel = this.add
      .text(width / 2, height / 2 - 30, 'Volume da música de fundo', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5);

    const pct = Math.round(this.lobbyMusicVolume * 100);
    this.volumeValueText = this.add
      .text(width / 2, height / 2 + 8, `${pct}%`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '18px',
        color: '#e8dfff',
      })
      .setOrigin(0.5);

    const sliderEl = document.createElement('input');
    sliderEl.type = 'range';
    sliderEl.min = '0';
    sliderEl.max = '100';
    sliderEl.step = '1';
    sliderEl.value = String(pct);
    sliderEl.style.cssText = [
      'width: 280px',
      'height: 28px',
      'accent-color: #6b5cff',
      'cursor: pointer',
    ].join(';');
    sliderEl.addEventListener('input', () => {
      const v = Number(sliderEl.value) / 100;
      this.saveLobbyMusicVolume(v);
      if (this.volumeValueText) {
        this.volumeValueText.setText(`${Math.round(v * 100)}%`);
      }
    });

    this.volumeSlider = this.add.dom(width / 2, height / 2 + 48, sliderEl).setOrigin(0.5);

    const closeBg = this.add
      .rectangle(width / 2, height / 2 + 95, 140, 40, 0x6b5cff, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const closeLabel = this.add
      .text(width / 2, height / 2 + 95, 'Fechar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerover', () => closeBg.setScale(1.04));
    closeBg.on('pointerout', () => closeBg.setScale(1));
    closeBg.on('pointerup', () => this.closeSettingsModal());

    this.settingsModal.add([
      dim,
      panel,
      title,
      volLabel,
      this.volumeValueText,
      closeBg,
      closeLabel,
    ]);
  }

  closeSettingsModal() {
    if (!this.settingsModalOpen && !this.volumeSlider) return;
    this.settingsModalOpen = false;
    if (this.volumeSlider) {
      this.volumeSlider.destroy();
      this.volumeSlider = null;
    }
    if (this.settingsModal) {
      this.settingsModal.removeAll(true);
      this.settingsModal.setVisible(false);
    }
    this.volumeValueText = null;
    if (this.nameInput && !this.controlsModalOpen) this.nameInput.setVisible(true);
  }

  openControlsModal() {
    if (this.controlsModalOpen) return;
    if (this.settingsModalOpen) this.closeSettingsModal();
    this.controlsModalOpen = true;

    // DOM fica acima do canvas — esconde o input enquanto o modal está aberto
    if (this.nameInput) this.nameInput.setVisible(false);

    const { width, height } = this.scale;
    this.controlsModal.removeAll(true);
    this.controlsModal.setDepth(10000).setVisible(true);
    this.children.bringToTop(this.controlsModal);

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.closeControlsModal());

    const panel = this.add
      .rectangle(width / 2, height / 2, 420, 440, 0x161228, 0.98)
      .setStrokeStyle(2, 0x6b5cff);

    const title = this.add
      .text(width / 2, height / 2 - 175, 'Comandos', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    const lines = [
      ['WASD', 'Mover'],
      ['Shift + WASD', 'Dash'],
      ['Mouse', 'Mirar'],
      ['1 – 4', 'Selecionar magia (4 = ultimate)'],
      ['Tab', 'Ciclar magia 1→2→3→4'],
      ['Espaço', 'Usar magia'],
    ];

    const rows = [];
    const startY = height / 2 - 120;
    lines.forEach(([key, action], i) => {
      const y = startY + i * 36;
      const keyText = this.add
        .text(width / 2 - 150, y, key, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '16px',
          color: '#b8a6ff',
        })
        .setOrigin(0, 0.5);
      const actionText = this.add
        .text(width / 2 + 20, y, action, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '16px',
          color: '#e8dfff',
        })
        .setOrigin(0, 0.5);
      rows.push(keyText, actionText);
    });

    const closeBg = this.add
      .rectangle(width / 2, height / 2 + 170, 140, 40, 0x6b5cff, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const closeLabel = this.add
      .text(width / 2, height / 2 + 170, 'Fechar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerover', () => closeBg.setScale(1.04));
    closeBg.on('pointerout', () => closeBg.setScale(1));
    closeBg.on('pointerup', () => this.closeControlsModal());

    this.controlsModal.add([dim, panel, title, ...rows, closeBg, closeLabel]);
  }

  closeControlsModal() {
    this.controlsModalOpen = false;
    this.controlsModal.removeAll(true);
    this.controlsModal.setVisible(false);
    if (this.nameInput) this.nameInput.setVisible(true);
  }

  makeButton(x, y, label, color, onClick, width = 280) {
    const height = 48;
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, color, 1).setStrokeStyle(2, 0xffffff, 0.15);
    const text = this.add
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

  setButtonEnabled(btn, enabled) {
    btn.enabled = enabled;
    btn.setAlpha(enabled ? 1 : 0.35);
    btn.bg.setScale(1);
  }

  bindSocket() {
    this.socket.off('lobby_state');
    this.socket.off('joined');
    this.socket.off('error_msg');
    this.socket.off('game_state');
    this.socket.off('countdown');
    this.socket.off('game_event');

    this.socket.on('lobby_state', (state) => {
      this.lobby = state;
      this.refreshLobby();
    });

    this.socket.on('joined', () => {
      this.joined = true;
      this.setButtonEnabled(this.readyBtn, true);
      this.setButtonEnabled(this.botsBtn, true);
      this.statusText.setText('No lobby. Marque Ready quando estiver preparado.');
    });

    this.socket.on('error_msg', (payload) => {
      this.statusText.setText(payload.message || 'Erro');
    });

    this.socket.on('game_event', (ev) => {
      if (ev.type === 'countdown') {
        this.statusText.setText(`Partida iniciando em ${ev.seconds}...`);
        this.enterGame();
      }
    });

    this.socket.on('game_state', (state) => {
      if (state.phase === 'lobby') return;
      this.enterGame();
    });
  }

  enterGame() {
    if (this.scene.isActive('Game') || this.scene.isSleeping('Game')) return;
    this.stopLobbyMusic();
    this.scene.start('Game', { playerId: this.socket.id });
  }

  joinLobby() {
    const el = this.nameInput.node;
    const name = (el.value || '').trim().slice(0, 16) || this.playerName;
    this.playerName = name;
    localStorage.setItem('wa_name', name);
    el.value = name;
    this.socket.emit('join_lobby', { name });
    this.statusText.setText('Entrando no lobby...');
  }

  toggleReady() {
    if (!this.joined) return;
    this.ready = !this.ready;
    this.socket.emit('set_ready', { ready: this.ready });
    this.readyBtn.label.setText(this.ready ? 'Cancelar Ready' : 'Ready');
    this.readyBtn.bg.setFillStyle(this.ready ? 0xe67e22 : 0x2ecc71);
  }

  addBot() {
    if (!this.joined) return;
    this.socket.emit('add_bots', { count: 1 });
  }

  refreshLobby() {
    if (!this.lobby) return;
    const lines = this.lobby.players.map((p) => {
      const tag = p.isBot ? ' [bot]' : '';
      const ready = p.ready ? '✓ ready' : '… waiting';
      return `${p.name}${tag}  —  ${ready}`;
    });
    const n = this.lobby.players.length;
    if (this.playersListEl) {
      this.playersListEl.textContent = lines.length
        ? lines.join('\n')
        : 'Nenhum jogador ainda';
      this.playersListEl.style.overflowY = n > 4 ? 'auto' : 'hidden';
    }
    const readyCount = this.lobby.players.filter((p) => p.ready).length;
    this.statusText.setText(
      `${n}/${this.lobby.maxPlayers} jogadores · ${readyCount} ready · precisa ${this.lobby.minPlayers}+`
    );
  }
}
