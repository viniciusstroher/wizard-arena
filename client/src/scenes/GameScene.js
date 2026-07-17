import Phaser from 'phaser';
import { getSocket } from '../net/socket.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.playerId = data.playerId;
    this.state = null;
    this.playerSprites = new Map();
    this.monsterSprites = new Map();
    this.projectileSprites = new Map();
    this.rockSprites = new Map();
    this.bloodSprites = new Map();
    this.boneSprites = new Map();
    this.localCorpses = [];
    this.aoeGraphics = null;
    this.arenaGraphics = null;
    this.effectGraphics = null;
    this.levelUpOpen = false;
    this.choiceCards = [];
    this.eventLog = [];
    this.eventScroll = 0;
    this.disconnectConfirmOpen = false;
    this.leaving = false;
    this.matchEndOpen = false;
    this.lavaFx = [];
    this.selectedSpellSlot = 0;
    this.moveDust = null;
    this.lavaBurn = null;
    this.dashGhosts = [];
    /** Janela (ms) para double-tap / re-tap WASD. */
    this.dashDoubleTapMs = 420;
    this.dashLastTap = { up: 0, down: 0, left: 0, right: 0 };
    this.dashLastRelease = { up: 0, down: 0, left: 0, right: 0 };
    this.dashWasDown = { up: false, down: false, left: false, right: false };
    /** Última direção cardinal de movimento (fallback do Shift). */
    this.lastMoveDir = 'up';
  }

  create() {
    this.socket = getSocket();
    this.cameras.main.setBackgroundColor('#1a0500');

    this.lavaFloor = this.add
      .tileSprite(640, 360, 1280, 720, 'lava_tile')
      .setDepth(-2)
      .setTileScale(1.35, 1.35);
    this.createLavaEffects();

    this.arenaFloor = this.add.tileSprite(640, 360, 640, 640, 'arena_brick').setDepth(0);
    this.arenaMaskGfx = this.make.graphics({ x: 0, y: 0, add: false });
    this.arenaFloor.setMask(this.arenaMaskGfx.createGeometryMask());

    this.arenaGraphics = this.add.graphics().setDepth(1);
    this.aoeGraphics = this.add.graphics();
    this.effectGraphics = this.add.graphics();
    this.createMoveDust();
    this.createLavaBurn();

    this.createHud();
    this.createEventBoard();
    this.createDisconnectUi();
    this.createMatchEndUi();
    this.cursors = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      ult: Phaser.Input.Keyboard.KeyCodes.R,
      cast: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });

    this.selectedSpellSlot = 0;
    this.input.keyboard.addCapture('SPACE');

    this.input.on('wheel', (_pointer, _gos, _dx, dy) => {
      this.onEventBoardWheel(dy);
    });

    this.socket.off('game_state');
    this.socket.off('game_event');
    this.socket.on('game_state', (state) => this.onState(state));
    this.socket.on('game_event', (ev) => {
      if (ev.type === 'countdown') {
        const nextRound = (this.state?.round ?? 0) + 1;
        this.bannerText.setText(`Round ${nextRound}\nComeça em ${ev.seconds}`);
        this.bannerText.setAlpha(1);
      }
    });

    this.events.on('shutdown', () => {
      this.socket.off('game_state');
      this.socket.off('game_event');
    });

    // Garante snapshot da arena/spawns mesmo se o state inicial chegou antes da cena
    this.socket.emit('request_state');
  }

  createHud() {
    const { width } = this.scale;

    this.hpBarBg = this.add.rectangle(20, 20, 220, 18, 0x221833).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.hpBar = this.add.rectangle(20, 20, 220, 18, 0xe74c3c).setOrigin(0, 0).setScrollFactor(0).setDepth(101);
    this.hpText = this.add
      .text(24, 21, 'HP 100', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#fff',
      })
      .setScrollFactor(0)
      .setDepth(102);

    this.xpBarBg = this.add.rectangle(20, 42, 220, 10, 0x221833).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.xpBar = this.add.rectangle(20, 42, 0, 10, 0xf1c40f).setOrigin(0, 0).setScrollFactor(0).setDepth(101);
    this.levelText = this.add
      .text(24, 54, 'Lv 1', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#f1c40f',
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.scoreText = this.add
      .text(250, 54, '0/0', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#7dcea0',
      })
      .setScrollFactor(0)
      .setDepth(102);

    this.timerText = this.add
      .text(width / 2, 16, '5:00', {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.roundText = this.add
      .text(width / 2, 48, 'Round 1', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#a99bc8',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.bannerText = this.add
      .text(width / 2, 120, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '36px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0);

    this.spellSlots = [];
    const slotLabels = ['1', '2', '3', '4', 'R', 'WASD'];
    for (let i = 0; i < 6; i++) {
      const x = 24 + i * 70;
      const y = this.scale.height - 70;
      const slot = this.add.container(x, y).setScrollFactor(0).setDepth(100);
      const bg = this.add.rectangle(0, 0, 60, 60, 0x1a1430, 0.95).setStrokeStyle(2, 0x6b5cff);
      const icon = this.add.image(0, -4, 'spell_firebolt').setScale(1.35).setVisible(false);
      const key = this.add
        .text(-26, -26, slotLabels[i], {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: i === 5 ? '9px' : '11px',
          color: '#9a8bb8',
        })
        .setOrigin(0);
      const name = this.add
        .text(0, 18, '-', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '9px',
          color: '#eee',
          align: 'center',
        })
        .setOrigin(0.5);
      const cd = this.add
        .text(22, -22, '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '10px',
          color: '#ffcc66',
        })
        .setOrigin(1, 0);
      slot.add([bg, icon, key, name, cd]);
      slot.bg = bg;
      slot.icon = icon;
      slot.name = name;
      slot.cd = cd;
      slot.slotIndex = i;
      // Slot 5 = dash (não selecionável como magia)
      if (i < 5) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          if (this.disconnectConfirmOpen || this.leaving) return;
          this.selectedSpellSlot = i;
        });
      }
      this.spellSlots.push(slot);
    }

    this.scoreboard = this.add
      .text(width - 20, 62, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#d8ceef',
        align: 'right',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.levelUpLayer = this.add.container(0, 0).setDepth(300).setScrollFactor(0).setVisible(false);
  }

  createEventBoard() {
    const boardW = 300;
    const boardH = 168;
    const x = 16;
    // Acima dos slots de magia (y ≈ height - 70)
    const y = this.scale.height - 275;

    this.eventBoardMaxVisible = 10;
    this.eventBoardLineH = 14;
    this.eventBoardBounds = { x, y, w: boardW, h: boardH };

    this.eventBoardBg = this.add
      .rectangle(x, y, boardW, boardH, 0x0e0a1a, 0.82)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6b5cff, 0.45)
      .setScrollFactor(0)
      .setDepth(100);

    this.eventBoardTitle = this.add
      .text(x + 10, y + 6, 'Eventos', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#a99bc8',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.eventBoardHint = this.add
      .text(x + boardW - 10, y + 6, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#7a6e96',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.eventBoardLines = [];
    for (let i = 0; i < this.eventBoardMaxVisible; i++) {
      const line = this.add
        .text(x + 10, y + 24 + i * this.eventBoardLineH, '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '12px',
          color: '#e8dfff',
        })
        .setScrollFactor(0)
        .setDepth(101);
      this.eventBoardLines.push(line);
    }

    this.pushBoardEvent('Partida iniciada');
  }

  createDisconnectUi() {
    const { width } = this.scale;
    const btnW = 120;
    const btnH = 32;
    const x = width - 20 - btnW / 2;
    const y = 36;

    this.disconnectBtn = this.add.container(x, y).setScrollFactor(0).setDepth(110);
    const bg = this.add.rectangle(0, 0, btnW, btnH, 0xc0392b, 0.95).setStrokeStyle(1, 0xffffff, 0.2);
    const label = this.add
      .text(0, 0, 'Desconectar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.disconnectBtn.add([bg, label]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setScale(1.04));
    bg.on('pointerout', () => bg.setScale(1));
    bg.on('pointerup', () => this.openDisconnectConfirm());

    this.disconnectModal = this.add.container(0, 0).setDepth(400).setScrollFactor(0).setVisible(false);
  }

  openDisconnectConfirm() {
    if (this.disconnectConfirmOpen || this.leaving || this.matchEndOpen) return;
    this.disconnectConfirmOpen = true;

    const { width, height } = this.scale;
    this.disconnectModal.removeAll(true);
    this.disconnectModal.setVisible(true);

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65);
    const panel = this.add.rectangle(width / 2, height / 2, 380, 180, 0x161228, 0.98).setStrokeStyle(2, 0x6b5cff);
    const title = this.add
      .text(width / 2, height / 2 - 48, 'Desconectar da partida?', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(width / 2, height / 2 - 12, 'Tem certeza que deseja sair?', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#a99bc8',
      })
      .setOrigin(0.5);

    const yesBg = this.add.rectangle(width / 2 - 80, height / 2 + 48, 130, 40, 0xc0392b, 1).setStrokeStyle(1, 0xffffff, 0.15);
    const yesLabel = this.add
      .text(width / 2 - 80, height / 2 + 48, 'Sim', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    yesBg.setInteractive({ useHandCursor: true });
    yesBg.on('pointerover', () => yesBg.setScale(1.04));
    yesBg.on('pointerout', () => yesBg.setScale(1));
    yesBg.on('pointerup', () => this.confirmDisconnect());

    const noBg = this.add.rectangle(width / 2 + 80, height / 2 + 48, 130, 40, 0x443866, 1).setStrokeStyle(1, 0xffffff, 0.15);
    const noLabel = this.add
      .text(width / 2 + 80, height / 2 + 48, 'Não', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    noBg.setInteractive({ useHandCursor: true });
    noBg.on('pointerover', () => noBg.setScale(1.04));
    noBg.on('pointerout', () => noBg.setScale(1));
    noBg.on('pointerup', () => this.closeDisconnectConfirm());

    this.disconnectModal.add([dim, panel, title, subtitle, yesBg, yesLabel, noBg, noLabel]);
  }

  closeDisconnectConfirm() {
    this.disconnectConfirmOpen = false;
    this.disconnectModal.removeAll(true);
    this.disconnectModal.setVisible(false);
  }

  confirmDisconnect() {
    if (this.leaving) return;
    this.leaving = true;
    this.closeDisconnectConfirm();
    this.pushBoardEvent('Você desconectou da partida');
    this.socket.emit('leave_lobby');
    this.time.delayedCall(450, () => {
      this.scene.start('Lobby');
    });
  }

  createMatchEndUi() {
    this.matchEndModal = this.add.container(0, 0).setDepth(450).setScrollFactor(0).setVisible(false);
  }

  showMatchEndOverlay(state) {
    if (this.matchEndOpen || this.leaving) return;
    this.matchEndOpen = true;
    this.closeDisconnectConfirm();

    const { width, height } = this.scale;
    this.matchEndModal.removeAll(true);
    this.matchEndModal.setVisible(true);

    const ranking = [...(state.players || [])].sort(
      (a, b) =>
        (b.score || 0) - (a.score || 0) ||
        (b.kills || 0) - (a.kills || 0) ||
        (a.deaths || 0) - (b.deaths || 0) ||
        (b.level || 0) - (a.level || 0)
    );
    const winner = ranking.find((p) => p.id === state.winnerId) || ranking[0] || null;
    const rows = ranking
      .map((p, i) => {
        const mark = p.id === winner?.id ? '★' : `${i + 1}.`;
        return `${mark} ${p.name}  ${p.kills || 0}K / ${p.deaths || 0}M  ·  ${p.score || 0} pts`;
      })
      .join('\n');

    const panelH = Math.min(420, 210 + ranking.length * 22);
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    const panel = this.add
      .rectangle(width / 2, height / 2, 460, panelH, 0x161228, 0.98)
      .setStrokeStyle(2, 0xf1c40f);
    const title = this.add
      .text(width / 2, height / 2 - panelH / 2 + 36, winner ? `${winner.name} venceu!` : 'Partida encerrada', {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#f1c40f',
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(width / 2, height / 2 - panelH / 2 + 68, 'Placar final', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#a99bc8',
      })
      .setOrigin(0.5);
    const board = this.add
      .text(width / 2, height / 2 - 10, rows || 'Sem jogadores', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#e8dfff',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);

    const btnY = height / 2 + panelH / 2 - 42;
    const lobbyBg = this.add.rectangle(width / 2, btnY, 180, 44, 0x6b5cff, 1).setStrokeStyle(1, 0xffffff, 0.2);
    const lobbyLabel = this.add
      .text(width / 2, btnY, 'Ir ao Lobby', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    lobbyBg.setInteractive({ useHandCursor: true });
    lobbyBg.on('pointerover', () => lobbyBg.setScale(1.04));
    lobbyBg.on('pointerout', () => lobbyBg.setScale(1));
    lobbyBg.on('pointerup', () => this.goToLobbyFromMatchEnd());

    this.matchEndModal.add([dim, panel, title, subtitle, board, lobbyBg, lobbyLabel]);
    this.bannerText.setAlpha(0);
  }

  goToLobbyFromMatchEnd() {
    if (this.leaving) return;
    this.leaving = true;
    this.socket.emit('leave_lobby');
    this.time.delayedCall(300, () => {
      this.scene.start('Lobby');
    });
  }

  pushBoardEvent(message) {
    if (!message) return;
    this.eventLog.push(message);
    if (this.eventLog.length > 80) {
      this.eventLog.splice(0, this.eventLog.length - 80);
    }
    this.eventScroll = 0;
    this.refreshEventBoard();
  }

  onEventBoardWheel(dy) {
    if (this.eventLog.length <= this.eventBoardMaxVisible) return;
    const pointer = this.input.activePointer;
    const b = this.eventBoardBounds;
    if (!b) return;
    if (pointer.x < b.x || pointer.x > b.x + b.w || pointer.y < b.y || pointer.y > b.y + b.h) {
      return;
    }
    const maxScroll = this.eventLog.length - this.eventBoardMaxVisible;
    if (dy > 0) this.eventScroll = Math.min(maxScroll, this.eventScroll + 1);
    else if (dy < 0) this.eventScroll = Math.max(0, this.eventScroll - 1);
    this.refreshEventBoard();
  }

  refreshEventBoard() {
    if (!this.eventBoardLines) return;
    const max = this.eventBoardMaxVisible;
    const total = this.eventLog.length;
    const overflow = total > max;
    const maxScroll = overflow ? total - max : 0;
    this.eventScroll = Phaser.Math.Clamp(this.eventScroll, 0, maxScroll);

    const end = total - this.eventScroll;
    const start = Math.max(0, end - max);
    const slice = this.eventLog.slice(start, end);

    for (let i = 0; i < max; i++) {
      this.eventBoardLines[i].setText(slice[i] || '');
    }

    if (this.eventBoardHint) {
      this.eventBoardHint.setText(overflow ? `↕ ${total}` : '');
    }
  }

  playerName(id) {
    const p = this.state?.players?.find((pl) => pl.id === id);
    return p?.name || 'Jogador';
  }

  formatGameEvent(ev) {
    switch (ev.type) {
      case 'countdown':
        return `Começa em ${ev.seconds}s`;
      case 'round_start':
        return `Round ${ev.round} iniciado`;
      case 'round_win':
        return `${this.playerName(ev.playerId)} venceu o round ${ev.round}`;
      case 'player_kill':
        return `${this.playerName(ev.killerId)} eliminou ${this.playerName(ev.victimId)}`;
      case 'player_death':
        return ev.reason === 'time'
          ? `${this.playerName(ev.playerId)} morreu (tempo)`
          : `${this.playerName(ev.playerId)} morreu`;
      case 'monster_kill':
        return `${this.playerName(ev.killerId)} derrotou um monstro`;
      case 'level_up':
        return `${this.playerName(ev.playerId)} subiu para Lv ${ev.level}`;
      case 'phoenix':
        return `${this.playerName(ev.playerId)} renasceu (Fênix)`;
      case 'arena_shrink':
        return 'A arena está encolhendo!';
      case 'match_end': {
        const winner = this.state?.players?.find((p) => p.id === ev.winnerId);
        return winner ? `${winner.name} venceu a partida!` : 'Partida encerrada';
      }
      case 'player_left':
        if (ev.playerId === this.playerId) return null;
        return `${ev.name || 'Jogador'} saiu da partida`;
      default:
        return null;
    }
  }

  onState(state) {
    const prevPhase = this.state?.phase;
    this.state = state;
    for (const ev of state.events || []) {
      const msg = this.formatGameEvent(ev);
      if (msg) this.pushBoardEvent(msg);
      // Fallback: ossos de monstro pelo evento (caso o effect do servidor atrase)
      if (ev.type === 'monster_kill' && Number.isFinite(ev.x) && Number.isFinite(ev.y)) {
        this.ensureCorpseAt(ev.x, ev.y);
      }
    }
    if (
      state.phase === 'countdown' &&
      prevPhase &&
      prevPhase !== 'countdown' &&
      prevPhase !== 'lobby'
    ) {
      this.clearLocalCorpses();
    }
    if (state.phase === 'ended') {
      this.showMatchEndOverlay(state);
    }
  }

  ensureCorpseAt(x, y) {
    const near = (this.state?.effects || []).some(
      (e) => e.type === 'bones' && Math.hypot(e.x - x, e.y - y) < 28
    );
    if (near) return;
    if (this.localCorpses.some((c) => Math.hypot(c.x - x, c.y - y) < 28)) return;
    if (!this.textures.exists('bones_pile') || !this.textures.exists('skull')) return;

    const scale = 0.85 + Math.random() * 0.35;
    const rot = (Math.random() - 0.5) * 0.6;
    const pile = this.add
      .image(x, y + 2, 'bones_pile')
      .setDepth(2)
      .setScale(scale)
      .setAlpha(0.95);
    const skull = this.add
      .image(x + (Math.random() - 0.5) * 6, y - 6 + (Math.random() - 0.5) * 3, 'skull')
      .setDepth(2.1)
      .setScale(scale * 0.95)
      .setRotation(rot)
      .setAlpha(0.98);
    this.localCorpses.push({ x, y, pile, skull });
  }

  clearLocalCorpses() {
    for (const c of this.localCorpses) {
      c.pile.destroy();
      c.skull.destroy();
    }
    this.localCorpses = [];
  }

  update(_time, delta) {
    if (this.lavaFloor) {
      const t = delta * 0.012;
      this.lavaFloor.tilePositionX += t;
      this.lavaFloor.tilePositionY += t * 0.55;
    }

    if (!this.state || this.leaving) return;

    if (!this.disconnectConfirmOpen && !this.matchEndOpen) {
      this.sendInput();
    }
    this.renderArena();
    this.renderRocks();
    this.renderPlayers();
    this.renderMonsters();
    this.renderProjectiles();
    this.renderAoes();
    this.renderEffects();
    this.updateHud();
    this.updateLevelUpUi();
    this.handleBanners();
  }

  currentMoveDir() {
    const { up, down, left, right } = this.cursors;
    const u = up.isDown;
    const d = down.isDown;
    const l = left.isDown;
    const r = right.isDown;
    if (u && !d) return 'up';
    if (d && !u) return 'down';
    if (l && !r) return 'left';
    if (r && !l) return 'right';
    return null;
  }

  aimDashDir(pointer) {
    const me = this.me();
    if (!me) return this.lastMoveDir;
    const dx = pointer.worldX - me.x;
    const dy = pointer.worldY - me.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'down' : 'up';
  }

  detectDash(pointer) {
    const now = this.time.now;
    const windowMs = this.dashDoubleTapMs;
    const keys = [
      ['up', this.cursors.up],
      ['down', this.cursors.down],
      ['left', this.cursors.left],
      ['right', this.cursors.right],
    ];

    for (const [dir, key] of keys) {
      const down = key.isDown;
      if (this.dashWasDown[dir] && !down) this.dashLastRelease[dir] = now;
      this.dashWasDown[dir] = down;
    }

    const held = this.currentMoveDir();
    if (held) this.lastMoveDir = held;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.dash)) {
      return held || this.lastMoveDir || this.aimDashDir(pointer);
    }

    for (const [dir, key] of keys) {
      if (!Phaser.Input.Keyboard.JustDown(key)) continue;
      const lastTap = this.dashLastTap[dir] || 0;
      const lastRelease = this.dashLastRelease[dir] || 0;
      this.dashLastTap[dir] = now;
      // Double-tap clássico OU re-tap rápido após soltar (dash enquanto anda).
      if (
        (lastTap > 0 && now - lastTap <= windowMs) ||
        (lastRelease > 0 && now - lastRelease <= windowMs)
      ) {
        this.dashLastTap[dir] = 0;
        this.dashLastRelease[dir] = 0;
        return dir;
      }
    }
    return null;
  }

  sendInput() {
    const pointer = this.input.activePointer;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.one)) this.selectedSpellSlot = 0;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.two)) this.selectedSpellSlot = 1;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.three)) this.selectedSpellSlot = 2;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.four)) this.selectedSpellSlot = 3;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.ult)) this.selectedSpellSlot = 4;

    const castSlot = Phaser.Input.Keyboard.JustDown(this.cursors.cast)
      ? this.selectedSpellSlot
      : -1;

    this.socket.emit('player_input', {
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      aimX: pointer.worldX,
      aimY: pointer.worldY,
      castSlot,
      dash: this.detectDash(pointer),
    });
  }

  me() {
    return this.state?.players?.find((p) => p.id === this.playerId);
  }

  createMoveDust() {
    this.moveDust = this.add
      .particles(0, 0, 'particle', {
        tint: [0x9a9a9a, 0xb0b0b0, 0x7a7a7a, 0xc4c4c4],
        speed: { min: 18, max: 48 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.7, end: 0 },
        lifespan: { min: 280, max: 520 },
        gravityY: -12,
        frequency: -1,
        emitting: false,
      })
      .setDepth(3);
  }

  createLavaBurn() {
    this.lavaBurn = this.add
      .particles(0, 0, 'particle', {
        tint: [0xff2200, 0xff5500, 0xff9900, 0xffdd44],
        speed: { min: 28, max: 70 },
        angle: { min: 240, max: 300 },
        scale: { start: 1.35, end: 0 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 220, max: 420 },
        gravityY: -90,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(21);
  }

  isOnLava(x, y) {
    const a = this.state?.arena;
    if (!a) return false;
    return Math.hypot(x - a.x, y - a.y) > a.radius;
  }

  /** Chamas + tint enquanto estiver na lava (fora do anel seguro). */
  updateLavaBurn(sprite, x, y, onFire) {
    if (!onFire) {
      if (sprite.burnGlow) sprite.burnGlow.setVisible(false);
      return;
    }

    const now = this.time.now;
    const pulse = 0.5 + 0.5 * Math.sin(now / 70);
    const tint = Phaser.Display.Color.GetColor(
      255,
      Math.floor(50 + 90 * pulse),
      Math.floor(10 + 20 * pulse)
    );
    sprite.setTint(tint);

    if (!sprite.burnGlow) {
      sprite.burnGlow = this.add
        .circle(x, y, 18, 0xff6600, 0.25)
        .setDepth(19)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    sprite.burnGlow.setPosition(x, y + 2).setVisible(true);
    sprite.burnGlow.setScale(0.9 + 0.25 * pulse);
    sprite.burnGlow.setAlpha(0.2 + 0.25 * pulse);

    if (!this.lavaBurn) return;
    if (now - (sprite.lastBurnAt || 0) < 28) return;
    sprite.lastBurnAt = now;

    this.lavaBurn.setEmitterAngle({ min: 240, max: 300 });
    this.lavaBurn.setParticleSpeed({ min: 30, max: 75 });
    this.lavaBurn.emitParticleAt(x + Phaser.Math.Between(-7, 7), y + 6, 2);
    this.lavaBurn.emitParticleAt(x + Phaser.Math.Between(-4, 4), y - 2, 2);
  }

  /** Poeira no extremo oposto ao vetor de velocidade (rastro atrás do movimento). */
  emitMoveDust(sprite, x, y, vx = 0, vy = 0) {
    if (!this.moveDust) return;
    const speed = Math.hypot(vx || 0, vy || 0);
    if (!Number.isFinite(speed) || speed < 25) return;

    const now = this.time.now;
    const gap = speed > 120 ? 14 : 22;
    if (now - (sprite.lastDustAt || 0) < gap) return;
    sprite.lastDustAt = now;

    const nx = vx / speed;
    const ny = vy / speed;
    // Extremidade do vetor de aceleração: atrás do personagem, nos pés
    const dustX = x - nx * 12;
    const dustY = y - ny * 10 + 8;
    const backAngle = Phaser.Math.RadToDeg(Math.atan2(ny, nx)) + 180;

    this.moveDust.setEmitterAngle({ min: backAngle - 50, max: backAngle + 50 });
    this.moveDust.setParticleSpeed({
      min: 20 + speed * 0.12,
      max: 50 + speed * 0.22,
    });
    const count = speed > 140 ? 5 : speed > 90 ? 4 : 3;
    this.moveDust.emitParticleAt(dustX, dustY, count);
  }

  createLavaEffects() {
    if (!this.anims.exists('lava_bubble')) {
      this.anims.create({
        key: 'lava_bubble',
        frames: [
          { key: 'lava_bubble_0' },
          { key: 'lava_bubble_1' },
          { key: 'lava_bubble_2' },
          { key: 'lava_bubble_1' },
        ],
        frameRate: 6,
        repeat: -1,
      });
    }
    if (!this.anims.exists('lava_gas')) {
      this.anims.create({
        key: 'lava_gas',
        frames: [{ key: 'lava_gas_0' }, { key: 'lava_gas_1' }, { key: 'lava_gas_2' }, { key: 'lava_gas_1' }],
        frameRate: 5,
        repeat: -1,
      });
    }

    const cx = 640;
    const cy = 360;
    const minR = 340; // fora da arena inicial
    const maxR = 520;
    const poolCount = 10 + Math.floor(Math.random() * 8);
    const bubbleCount = 18 + Math.floor(Math.random() * 14);
    const gasCount = 14 + Math.floor(Math.random() * 12);

    const placeOutside = () => {
      const angle = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    };

    for (let i = 0; i < poolCount; i++) {
      const { x, y } = placeOutside();
      const s = this.add
        .image(x, y, 'lava_pool')
        .setDepth(-1)
        .setScale(0.7 + Math.random() * 1.1)
        .setAlpha(0.75 + Math.random() * 0.25)
        .setRotation(Math.random() * Math.PI);
      this.lavaFx.push({ sprite: s, kind: 'pool', homeX: x, homeY: y });
      this.tweens.add({
        targets: s,
        scaleX: s.scaleX * 1.08,
        scaleY: s.scaleY * 0.92,
        duration: 700 + Math.random() * 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    for (let i = 0; i < bubbleCount; i++) {
      const { x, y } = placeOutside();
      const s = this.add.sprite(x, y, 'lava_bubble_0').setDepth(-1).setScale(0.9 + Math.random() * 1.4);
      s.play('lava_bubble');
      s.anims.timeScale = 0.55 + Math.random() * 0.9;
      this.lavaFx.push({ sprite: s, kind: 'bubble', homeX: x, homeY: y });
      this.tweens.add({
        targets: s,
        y: y - 6 - Math.random() * 10,
        alpha: { from: 0.55, to: 1 },
        duration: 500 + Math.random() * 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 800,
      });
    }

    for (let i = 0; i < gasCount; i++) {
      const { x, y } = placeOutside();
      const s = this.add
        .sprite(x, y, 'lava_gas_0')
        .setDepth(-1)
        .setScale(1.2 + Math.random() * 1.8)
        .setAlpha(0);
      s.play('lava_gas');
      s.anims.timeScale = 0.5 + Math.random() * 1.1;
      this.lavaFx.push({ sprite: s, kind: 'gas', homeX: x, homeY: y });

      const rise = 28 + Math.random() * 40;
      const dur = 1400 + Math.random() * 1600;
      this.tweens.add({
        targets: s,
        y: y - rise,
        alpha: { from: 0, to: 0.55 },
        duration: dur,
        repeat: -1,
        ease: 'Quad.easeOut',
        delay: Math.random() * 1200,
        onRepeat: () => {
          s.x = x + (Math.random() - 0.5) * 12;
          s.y = y;
          s.setAlpha(0);
        },
        onUpdate: (tween) => {
          // somece no topo do trajeto
          if (tween.progress > 0.55) {
            s.setAlpha(Math.max(0, 0.55 * (1 - (tween.progress - 0.55) / 0.45)));
          }
        },
      });
    }
  }

  updateLavaEffects(arena) {
    for (const fx of this.lavaFx) {
      const dist = Math.hypot(fx.homeX - arena.x, fx.homeY - arena.y);
      const outside = dist > arena.radius + 8;
      fx.sprite.setVisible(outside);
    }
  }

  renderRocks() {
    const rocks = this.state.rocks || [];
    const seen = new Set();
    const variants = {
      stone: ['rock_stone_0', 'rock_stone_1', 'rock_stone_2'],
      rock: ['rock_rock_0', 'rock_rock_1', 'rock_rock_2'],
      boulder: ['rock_boulder_0', 'rock_boulder_1', 'rock_boulder_2'],
    };

    const hashId = (id) => {
      let h = 0;
      const s = String(id);
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h;
    };

    for (const rock of rocks) {
      seen.add(rock.id);
      let s = this.rockSprites.get(rock.id);
      if (!s) {
        const list = variants[rock.type] || variants.rock;
        const h = hashId(rock.id);
        const key = list[h % list.length];
        if (!this.textures.exists(key)) continue;
        const baseScale = rock.type === 'boulder' ? 1.2 : rock.type === 'rock' ? 1.08 : 1;
        const scaleJitter = 0.9 + ((h >>> 8) % 25) / 100;
        s = this.add
          .image(rock.x, rock.y, key)
          .setDepth(5)
          .setOrigin(0.5, 0.7)
          .setScale(baseScale * scaleJitter)
          .setFlipX((h & 1) === 1)
          .setRotation((((h >>> 3) % 21) - 10) * 0.02);
        this.rockSprites.set(rock.id, s);
      } else {
        s.setPosition(rock.x, rock.y);
      }
    }

    for (const [id, s] of this.rockSprites) {
      if (!seen.has(id)) {
        s.destroy();
        this.rockSprites.delete(id);
      }
    }
  }

  renderArena() {
    const a = this.state.arena;
    const diameter = Math.max(2, a.radius * 2);

    this.updateLavaEffects(a);

    this.arenaFloor.setPosition(a.x, a.y);
    this.arenaFloor.setSize(diameter, diameter);

    this.arenaMaskGfx.clear();
    this.arenaMaskGfx.fillStyle(0xffffff, 1);
    this.arenaMaskGfx.fillCircle(a.x, a.y, a.radius);

    this.arenaGraphics.clear();

    // Borda quente da lava sob o anel
    this.arenaGraphics.lineStyle(10, 0xff6b1a, 0.35);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius + 6);

    // Safe ring
    this.arenaGraphics.lineStyle(4, 0x6b5cff, 0.9);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius);

    // Danger outside hint
    this.arenaGraphics.lineStyle(2, 0xff4a4a, 0.35);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius + 18);
  }

  ensureActor(map, id, texture, depth = 10) {
    let sprite = map.get(id);
    if (!sprite) {
      sprite = this.add.sprite(0, 0, texture).setDepth(depth);
      sprite.nameTag = this.add
        .text(0, 0, '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: '#fff',
          stroke: '#000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(depth + 1);
      sprite.hpBg = this.add.rectangle(0, 0, 36, 5, 0x000000, 0.6).setDepth(depth + 1);
      sprite.hpFg = this.add.rectangle(0, 0, 36, 5, 0x2ecc71).setDepth(depth + 2);
      map.set(id, sprite);
    }
    return sprite;
  }

  wizardTexture(type) {
    const key = `wizard_${type}`;
    return this.textures.exists(key) ? key : 'wizard';
  }

  spawnDashGhost(texture, x, y, scaleX, scaleY, tint) {
    const ghost = this.add
      .sprite(x, y, texture)
      .setDepth(19)
      .setAlpha(0.55)
      .setScale(scaleX, scaleY)
      .setTint(tint || 0xffffff);
    this.dashGhosts.push({ sprite: ghost, life: 0.22, maxLife: 0.22 });
  }

  updateDashGhosts(dt) {
    for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
      const g = this.dashGhosts[i];
      g.life -= dt;
      if (g.life <= 0) {
        g.sprite.destroy();
        this.dashGhosts.splice(i, 1);
        continue;
      }
      const t = g.life / g.maxLife;
      g.sprite.setAlpha(0.55 * t);
      g.sprite.setScale(g.sprite.scaleX * (1 + 0.01), g.sprite.scaleY * (1 + 0.01));
    }
  }

  renderPlayers() {
    const seen = new Set();
    const dt = this.game.loop.delta / 1000;
    this.updateDashGhosts(dt);

    for (const p of this.state.players) {
      seen.add(p.id);
      const tex = this.wizardTexture(p.wizardType);
      const s = this.ensureActor(this.playerSprites, p.id, tex, 20);
      if (s.texture.key !== tex) s.setTexture(tex);
      s.clearTint();
      s.setPosition(p.x, p.y);
      s.setAlpha(p.alive ? 1 : 0.25);

      const baseScale = p.id === this.playerId ? 1.15 : 1;
      if (p.dashing && p.alive) {
        const horiz = Math.abs(p.dashDx || p.vx) >= Math.abs(p.dashDy || p.vy);
        if (horiz) s.setScale(baseScale * 1.55, baseScale * 0.7);
        else s.setScale(baseScale * 0.7, baseScale * 1.55);
        s.setTint(0xffffff);
        const now = this.time.now;
        if (!s.lastDashGhostAt || now - s.lastDashGhostAt > 28) {
          s.lastDashGhostAt = now;
          const backX = p.x - (p.dashDx || 0) * 10;
          const backY = p.y - (p.dashDy || 0) * 10;
          this.spawnDashGhost(tex, backX, backY, s.scaleX, s.scaleY, p.color || 0xffffff);
        }
        if (!s.wasDashing) {
          s.wasDashing = true;
          if (p.id === this.playerId) this.cameras.main.shake(60, 0.0025);
        }
      } else {
        s.setScale(baseScale);
        s.wasDashing = false;
      }

      if (p.stun) s.setAngle(Math.sin(this.time.now / 40) * 8);
      else s.setAngle(0);
      const onLava = p.alive && this.isOnLava(p.x, p.y);
      if (p.alive && !onLava) {
        const dustVx = p.dashing ? (p.vx || 0) * 1.4 : p.vx;
        const dustVy = p.dashing ? (p.vy || 0) * 1.4 : p.vy;
        this.emitMoveDust(s, p.x, p.y, dustVx, dustVy);
      }
      this.updateLavaBurn(s, p.x, p.y, onLava);

      s.nameTag.setText(p.name + (p.alive ? '' : ' ✝'));
      s.nameTag.setPosition(p.x, p.y - 28);
      s.hpBg.setPosition(p.x, p.y - 20);
      const ratio = p.maxHp ? p.hp / p.maxHp : 0;
      s.hpFg.setPosition(p.x - 18 + 18 * ratio, p.y - 20);
      s.hpFg.width = 36 * ratio;
      s.hpFg.setFillStyle(ratio > 0.35 ? 0x2ecc71 : 0xe74c3c);
      s.hpBg.setVisible(p.alive);
      s.hpFg.setVisible(p.alive);

      if (!p.alive && !s.corpseDropped) {
        s.corpseDropped = true;
        this.ensureCorpseAt(p.x, p.y);
      }
      if (p.alive) s.corpseDropped = false;

      if (p.shield > 0 && p.alive) {
        if (!s.shieldRing) {
          s.shieldRing = this.add.circle(p.x, p.y, 20, 0x88aaff, 0.15).setStrokeStyle(2, 0x88aaff, 0.8).setDepth(19);
        }
        s.shieldRing.setPosition(p.x, p.y).setVisible(true);
      } else if (s.shieldRing) {
        s.shieldRing.setVisible(false);
      }
    }
    for (const [id, s] of this.playerSprites) {
      if (!seen.has(id)) {
        s.destroy();
        s.nameTag.destroy();
        s.hpBg.destroy();
        s.hpFg.destroy();
        s.shieldRing?.destroy();
        s.burnGlow?.destroy();
        this.playerSprites.delete(id);
      }
    }
  }

  monsterTexture(type) {
    const key = `monster_${type}`;
    return this.textures.exists(key) ? key : 'monster';
  }

  renderMonsters() {
    const seen = new Set();
    for (const m of this.state.monsters) {
      seen.add(m.entityId);
      const tex = this.monsterTexture(m.type);
      const s = this.ensureActor(this.monsterSprites, m.entityId, tex, 15);
      if (s.texture.key !== tex) s.setTexture(tex);
      s.clearTint();
      s.setPosition(m.x, m.y);
      this.emitMoveDust(s, m.x, m.y, m.vx, m.vy);
      s.nameTag.setText(m.type);
      s.nameTag.setPosition(m.x, m.y - 26);
      s.hpBg.setPosition(m.x, m.y - 18);
      const ratio = m.maxHp ? m.hp / m.maxHp : 0;
      s.hpFg.setPosition(m.x - 16 + 16 * ratio, m.y - 18);
      s.hpFg.width = 32 * ratio;
      s.hpFg.setFillStyle(0xe67e22);
    }
    for (const [id, s] of this.monsterSprites) {
      if (!seen.has(id)) {
        this.ensureCorpseAt(s.x, s.y);
        s.destroy();
        s.nameTag.destroy();
        s.hpBg.destroy();
        s.hpFg.destroy();
        this.monsterSprites.delete(id);
      }
    }
  }

  renderProjectiles() {
    const seen = new Set();
    for (const p of this.state.projectiles) {
      seen.add(p.entityId);
      let s = this.projectileSprites.get(p.entityId);
      if (!s) {
        s = this.add.sprite(p.x, p.y, 'orb').setDepth(25);
        this.projectileSprites.set(p.entityId, s);
      }
      s.setPosition(p.x, p.y);
      s.setTint(p.color);
      s.setScale((p.radius || 8) / 6);
    }
    for (const [id, s] of this.projectileSprites) {
      if (!seen.has(id)) {
        s.destroy();
        this.projectileSprites.delete(id);
      }
    }
  }

  renderAoes() {
    this.aoeGraphics.clear();
    for (const a of this.state.aoes) {
      this.aoeGraphics.fillStyle(a.color, 0.18);
      this.aoeGraphics.fillCircle(a.x, a.y, a.radius);
      this.aoeGraphics.lineStyle(2, a.color, 0.5);
      this.aoeGraphics.strokeCircle(a.x, a.y, a.radius);
    }
  }

  renderEffects() {
    this.effectGraphics.clear();
    const seenBlood = new Set();
    const seenBones = new Set();

    for (const e of this.state.effects || []) {
      if (e.type === 'blood') {
        seenBlood.add(e.entityId);
        let s = this.bloodSprites.get(e.entityId);
        if (!s) {
          const key = `blood_${e.variant ?? 0}`;
          s = this.add
            .image(e.x, e.y, this.textures.exists(key) ? key : 'blood_0')
            .setDepth(2)
            .setRotation(e.rotation || 0)
            .setScale(e.scale || 1);
          this.bloodSprites.set(e.entityId, s);
        }
        const fade = e.life < 2 ? e.life / 2 : 1;
        s.setAlpha(0.75 * fade);
        continue;
      }

      if (e.type === 'bones') {
        seenBones.add(e.entityId);
        let pack = this.boneSprites.get(e.entityId);
        if (!pack) {
          const scale = e.scale || 1;
          const pile = this.add
            .image(e.x, e.y + 2, 'bones_pile')
            .setDepth(2)
            .setScale(scale)
            .setAlpha(0.95);
          const skull = this.add
            .image(e.x + (e.skullOffsetX || 0), e.y + (e.skullOffsetY || -6), 'skull')
            .setDepth(2.1)
            .setScale(scale * 0.95)
            .setRotation(e.rotation || 0)
            .setAlpha(0.98);
          pack = { pile, skull };
          this.boneSprites.set(e.entityId, pack);
        }
        continue;
      }

      if (e.type === 'lightning') {
        this.effectGraphics.lineStyle(2, e.color || 0xffee55, 0.9);
        this.effectGraphics.lineBetween(e.x1, e.y1, e.x2, e.y2);
      } else if (e.type === 'dash') {
        const dx = e.dx || 0;
        const dy = e.dy || 0;
        const len = 28;
        const fade = Math.min(1, e.life / 0.18);
        this.effectGraphics.lineStyle(3, e.color || 0xffffff, 0.55 * fade);
        this.effectGraphics.lineBetween(e.x - dx * len, e.y - dy * len, e.x + dx * 8, e.y + dy * 8);
        this.effectGraphics.fillStyle(e.color || 0xffffff, 0.1 * fade);
        this.effectGraphics.fillEllipse(
          e.x - dx * 6,
          e.y - dy * 6,
          Math.abs(dx) > 0 ? 36 : 14,
          Math.abs(dy) > 0 ? 36 : 14
        );
      } else if (e.type === 'nova' || e.type === 'blink' || e.type === 'heal' || e.type === 'barrier') {
        this.effectGraphics.lineStyle(2, e.color || 0xffffff, 0.7);
        this.effectGraphics.strokeCircle(e.x, e.y, e.radius || 30);
        this.effectGraphics.fillStyle(e.color || 0xffffff, 0.12);
        this.effectGraphics.fillCircle(e.x, e.y, e.radius || 24);
      }
    }

    for (const [id, s] of this.bloodSprites) {
      if (!seenBlood.has(id)) {
        s.destroy();
        this.bloodSprites.delete(id);
      }
    }
    for (const [id, pack] of this.boneSprites) {
      if (!seenBones.has(id)) {
        pack.pile.destroy();
        pack.skull.destroy();
        this.boneSprites.delete(id);
      }
    }
  }

  updateHud() {
    const me = this.me();
    if (!me) return;

    const hpRatio = me.alive ? me.hp / me.maxHp : 0;
    this.hpBar.width = 220 * hpRatio;
    this.hpText.setText(me.alive ? `HP ${Math.ceil(me.hp)} / ${me.maxHp}` : 'MORTO — próximo round');

    const xpRatio = me.xpToNext ? Math.min(1, me.xp / me.xpToNext) : 0;
    this.xpBar.width = 220 * xpRatio;
    this.levelText.setText(`Lv ${me.level}  ·  XP ${me.xp}/${me.xpToNext}`);
    this.scoreText.setText(`·  ${me.kills || 0}/${me.deaths || 0}  (${me.score || 0} pts)`);
    this.scoreText.setX(this.levelText.x + this.levelText.width + 8);

    const roundDuration = this.state.roundDuration ?? this.state.matchDuration ?? 60;
    const remain = Math.max(0, roundDuration - (this.state.roundTime || 0));
    const m = Math.floor(remain / 60);
    const s = Math.floor(remain % 60);
    this.timerText.setText(`${m}:${String(s).padStart(2, '0')}`);
    const maxRounds = this.state.maxRounds || '?';
    const displayRound =
      this.state.phase === 'countdown' ? Math.max(1, (this.state.round || 0) + 1) : this.state.round || 1;
    const shrinksDone = this.state.arena?.shrinksDone ?? 0;
    const shrinkTimes = this.state.arena?.shrinkTimes ?? 0;
    let zoneLabel = 'posicionando';
    if (this.state.phase !== 'countdown') {
      zoneLabel =
        shrinkTimes > 0 && shrinksDone >= shrinkTimes
          ? 'zona final'
          : `zona em ${Math.max(0, Math.ceil(this.state.arena.nextShrinkAt - this.state.roundTime))}s`;
    }
    this.roundText.setText(`Round ${displayRound}/${maxRounds} · ${zoneLabel}`);

    // Spells
    for (let i = 0; i < 4; i++) {
      const slot = this.spellSlots[i];
      const spell = me.spells[i];
      const selected = this.selectedSpellSlot === i;
      if (!spell) {
        slot.name.setText('-');
        slot.cd.setText('');
        slot.icon.setVisible(false);
        slot.bg.setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : 0x443866);
        slot.bg.setFillStyle(selected ? 0x2a2250 : 0x1a1430, 0.95);
        continue;
      }
      this.setSpellSlotIcon(slot, spell.id || spell.stats?.id);
      slot.name.setText(`Lv${spell.level}`);
      slot.cd.setText(spell.cooldownLeft > 0 ? spell.cooldownLeft.toFixed(1) : 'OK');
      slot.icon.setAlpha(spell.cooldownLeft > 0 ? 0.45 : 1);
      slot.bg.setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : spell.stats.color || 0x6b5cff);
      slot.bg.setFillStyle(selected ? 0x2a2250 : 0x1a1430, 0.95);
    }
    const ult = me.ultimate;
    const ultSlot = this.spellSlots[4];
    const ultSelected = this.selectedSpellSlot === 4;
    if (!ult) {
      ultSlot.name.setText('Ult');
      ultSlot.cd.setText('');
      ultSlot.icon.setVisible(false);
      ultSlot.bg.setStrokeStyle(ultSelected ? 3 : 2, ultSelected ? 0xffffff : 0x443866);
      ultSlot.bg.setFillStyle(ultSelected ? 0x2a2250 : 0x1a1430, 0.95);
    } else {
      this.setSpellSlotIcon(ultSlot, ult.id || ult.stats?.id);
      ultSlot.name.setText(ult.stats.passive ? 'passivo' : 'ult');
      ultSlot.cd.setText(ult.usedThisRound ? 'X' : 'OK');
      ultSlot.icon.setAlpha(ult.usedThisRound ? 0.4 : 1);
      ultSlot.bg.setStrokeStyle(ultSelected ? 3 : 2, ultSelected ? 0xffffff : ult.stats.color || 0xffaa33);
      ultSlot.bg.setFillStyle(ultSelected ? 0x2a2250 : 0x1a1430, 0.95);
    }

    const dashSlot = this.spellSlots[5];
    const dashCd = me.dashCooldown || 0;
    const dashing = !!me.dashing;
    this.setSpellSlotIcon(dashSlot, 'dash');
    dashSlot.name.setText(dashing ? 'dash!' : 'dash');
    dashSlot.cd.setText(dashCd > 0 ? dashCd.toFixed(1) : 'OK');
    dashSlot.icon.setAlpha(dashCd > 0 && !dashing ? 0.45 : 1);
    dashSlot.bg.setStrokeStyle(2, dashing ? 0xffffff : dashCd > 0 ? 0x665544 : 0xd4c48a);
    dashSlot.bg.setFillStyle(dashing ? 0x2a2250 : 0x1a1430, 0.95);

    const board = [...this.state.players]
      .sort(
        (a, b) =>
          (b.score || 0) - (a.score || 0) ||
          (b.kills || 0) - (a.kills || 0) ||
          (a.deaths || 0) - (b.deaths || 0)
      )
      .map(
        (p) =>
          `${p.alive ? '●' : '○'} ${p.name}  ${p.kills || 0}/${p.deaths || 0}  ${p.score || 0}pts`
      )
      .join('\n');
    this.scoreboard.setText(board);
  }

  handleBanners() {
    if (!this.state || this.matchEndOpen) return;
    if (this.state.phase === 'countdown') {
      const nextRound = (this.state.round || 0) + 1;
      const sec = Math.max(1, Math.ceil(this.state.countdown || 0));
      this.bannerText.setText(`Round ${nextRound}\nComeça em ${sec}`);
      this.bannerText.setAlpha(1);
    } else if (this.state.phase === 'intermission') {
      const w = this.state.players.find((p) => p.id === this.state.winnerId);
      this.bannerText.setText(
        w
          ? `${w.name} venceu o round!\nPróximo em ${Math.ceil(this.state.intermissionTimer)}s`
          : `Round encerrado\nPróximo em ${Math.ceil(this.state.intermissionTimer)}s`
      );
      this.bannerText.setAlpha(1);
    } else if (
      (this.state.phase === 'playing' || this.state.phase === 'levelup') &&
      this.me() &&
      !this.me().alive
    ) {
      this.bannerText.setText('Você morreu\nRevive no próximo round');
      this.bannerText.setAlpha(1);
    } else if (this.state.phase === 'playing' && this.bannerText.alpha > 0 && !this.levelUpOpen) {
      this.bannerText.setAlpha(Math.max(0, this.bannerText.alpha - 0.02));
    }
  }

  updateLevelUpUi() {
    const me = this.me();
    if (!me) return;

    const needs = me.pendingLevelUps > 0 && me.spellChoices?.length;
    if (!needs) {
      if (this.levelUpOpen) this.hideLevelUp();
      return;
    }
    if (!this.levelUpOpen) this.showLevelUp(me.spellChoices);
  }

  spellIconKey(spellId) {
    return spellId ? `spell_${spellId}` : null;
  }

  setSpellSlotIcon(slot, spellId) {
    const key = this.spellIconKey(spellId);
    if (key && this.textures.exists(key)) {
      slot.icon.setTexture(key).setVisible(true);
    } else {
      slot.icon.setVisible(false);
    }
  }

  showLevelUp(choices) {
    this.levelUpOpen = true;
    this.levelUpLayer.removeAll(true);
    this.levelUpLayer.setVisible(true);

    const { width, height } = this.scale;
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65);
    const title = this.add
      .text(width / 2, 140, 'SUBIU DE NÍVEL — escolha uma magia', {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    this.levelUpLayer.add([dim, title]);
    this.choiceCards = [];

    choices.forEach((choice, i) => {
      const x = width / 2 + (i - 1) * 260;
      const y = height / 2 + 20;
      const card = this.add.container(x, y);
      const stroke = choice.kind === 'upgrade' ? 0xf1c40f : choice.def?.color || 0x6b5cff;
      const bg = this.add.rectangle(0, 0, 230, 280, 0x1a1430, 0.98).setStrokeStyle(2, stroke);
      const badge = this.add
        .text(0, -118, choice.label || (choice.kind === 'upgrade' ? 'UPGRADE' : 'NOVA'), {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '12px',
          color: choice.kind === 'upgrade' ? '#f1c40f' : '#a99bc8',
        })
        .setOrigin(0.5);

      const iconKey = this.spellIconKey(choice.spellId || choice.def?.id);
      const iconBg = this.add.rectangle(0, -62, 72, 72, 0x0e0a1a, 0.95).setStrokeStyle(2, stroke);
      const icon =
        iconKey && this.textures.exists(iconKey)
          ? this.add.image(0, -62, iconKey).setScale(2)
          : this.add.circle(0, -62, 20, choice.def?.color || 0x6b5cff, 0.9);

      const name = this.add
        .text(0, -10, choice.def?.name || choice.spellId, {
          fontFamily: 'Georgia, serif',
          fontSize: '20px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      const desc = this.add
        .text(0, 42, choice.def?.description || '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '13px',
          color: '#c4b5e0',
          align: 'center',
          wordWrap: { width: 200 },
        })
        .setOrigin(0.5);
      const meta = this.add
        .text(
          0,
          110,
          choice.kind === 'upgrade'
            ? `Lv ${choice.fromLevel} → ${choice.toLevel}`
            : choice.def?.type === 'ultimate'
              ? 'Ultimate · 1x / round'
              : `Dano ${choice.def?.damage ?? '-'} · CD ${choice.def?.cooldown ?? '-'}s`,
          {
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '13px',
            color: '#ffcc66',
            align: 'center',
          }
        )
        .setOrigin(0.5);

      card.add([bg, badge, iconBg, icon, name, desc, meta]);
      card.setSize(230, 280);
      card.setInteractive(new Phaser.Geom.Rectangle(-115, -140, 230, 280), Phaser.Geom.Rectangle.Contains);
      card.on('pointerover', () => bg.setScale(1.03));
      card.on('pointerout', () => bg.setScale(1));
      card.on('pointerup', () => {
        this.socket.emit('choose_spell', { index: i });
        this.hideLevelUp();
      });
      this.levelUpLayer.add(card);
      this.choiceCards.push(card);
    });
  }

  hideLevelUp() {
    this.levelUpOpen = false;
    this.levelUpLayer.removeAll(true);
    this.levelUpLayer.setVisible(false);
  }
}
