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
    this.aoeGraphics = null;
    this.arenaGraphics = null;
    this.effectGraphics = null;
    this.levelUpOpen = false;
    this.choiceCards = [];
    this.eventLog = [];
    this.eventScroll = 0;
    this.disconnectConfirmOpen = false;
    this.leaving = false;
  }

  create() {
    this.socket = getSocket();
    this.cameras.main.setBackgroundColor('#0b1020');

    this.arenaGraphics = this.add.graphics();
    this.aoeGraphics = this.add.graphics();
    this.effectGraphics = this.add.graphics();

    this.createHud();
    this.createEventBoard();
    this.createDisconnectUi();
    this.cursors = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      ult: Phaser.Input.Keyboard.KeyCodes.R,
    });

    this.castSlot = -1;
    this.input.on('pointerdown', () => {
      if (this.disconnectConfirmOpen || this.leaving) return;
      // Clique também lança a magia do slot 0 se nenhum número for pressionado
      if (this.castSlot < 0) this.castSlot = 0;
    });

    this.input.on('wheel', (_pointer, _gos, _dx, dy) => {
      this.onEventBoardWheel(dy);
    });

    this.socket.off('game_state');
    this.socket.off('game_event');
    this.socket.on('game_state', (state) => this.onState(state));
    this.socket.on('game_event', (ev) => {
      if (ev.type === 'countdown') {
        this.bannerText.setText(`Começa em ${ev.seconds}`);
        this.bannerText.setAlpha(1);
        this.pushBoardEvent(`Partida começa em ${ev.seconds}s`);
      }
    });

    this.events.on('shutdown', () => {
      this.socket.off('game_state');
      this.socket.off('game_event');
    });
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
    for (let i = 0; i < 5; i++) {
      const x = 24 + i * 70;
      const y = this.scale.height - 70;
      const slot = this.add.container(x, y).setScrollFactor(0).setDepth(100);
      const bg = this.add.rectangle(0, 0, 60, 60, 0x1a1430, 0.95).setStrokeStyle(2, 0x6b5cff);
      const key = this.add
        .text(-22, -22, i < 4 ? String(i + 1) : 'R', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: '#9a8bb8',
        })
        .setOrigin(0);
      const name = this.add
        .text(0, 0, '-', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '10px',
          color: '#eee',
          align: 'center',
          wordWrap: { width: 54 },
        })
        .setOrigin(0.5);
      const cd = this.add
        .text(0, 20, '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: '#ffcc66',
        })
        .setOrigin(0.5);
      slot.add([bg, key, name, cd]);
      slot.bg = bg;
      slot.name = name;
      slot.cd = cd;
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
    if (this.disconnectConfirmOpen || this.leaving) return;
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
    this.state = state;
    for (const ev of state.events || []) {
      const msg = this.formatGameEvent(ev);
      if (msg) this.pushBoardEvent(msg);
    }
    if (state.phase === 'ended') {
      const winner = state.players.find((p) => p.id === state.winnerId);
      this.bannerText.setText(winner ? `${winner.name} venceu!` : 'Tempo esgotado — todos morreram');
      this.bannerText.setAlpha(1);
      this.time.delayedCall(5000, () => {
        this.scene.start('Lobby');
      });
    }
  }

  update() {
    if (!this.state || this.leaving) return;

    if (!this.disconnectConfirmOpen) {
      this.sendInput();
    }
    this.renderArena();
    this.renderPlayers();
    this.renderMonsters();
    this.renderProjectiles();
    this.renderAoes();
    this.renderEffects();
    this.updateHud();
    this.updateLevelUpUi();
    this.handleBanners();
  }

  sendInput() {
    const pointer = this.input.activePointer;
    let castSlot = -1;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.one)) castSlot = 0;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.two)) castSlot = 1;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.three)) castSlot = 2;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.four)) castSlot = 3;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.ult)) castSlot = 4;
    if (this.castSlot >= 0) {
      castSlot = this.castSlot;
      this.castSlot = -1;
    }

    this.socket.emit('player_input', {
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      aimX: pointer.worldX,
      aimY: pointer.worldY,
      castSlot,
    });
  }

  me() {
    return this.state?.players?.find((p) => p.id === this.playerId);
  }

  renderArena() {
    const a = this.state.arena;
    this.arenaGraphics.clear();

    // Floor
    this.arenaGraphics.fillStyle(0x12182a, 1);
    this.arenaGraphics.fillCircle(a.x, a.y, a.radius);

    // Safe ring
    this.arenaGraphics.lineStyle(4, 0x6b5cff, 0.9);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius);

    // Danger outside hint
    this.arenaGraphics.lineStyle(2, 0xff4a4a, 0.25);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius + 18);

    // Inner pattern
    this.arenaGraphics.lineStyle(1, 0xffffff, 0.05);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius * 0.5);
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

  renderPlayers() {
    const seen = new Set();
    for (const p of this.state.players) {
      seen.add(p.id);
      const s = this.ensureActor(this.playerSprites, p.id, 'wizard', 20);
      s.setPosition(p.x, p.y);
      s.setTint(p.color);
      s.setAlpha(p.alive ? 1 : 0.25);
      s.setScale(p.id === this.playerId ? 1.15 : 1);
      if (p.stun) s.setAngle(Math.sin(this.time.now / 40) * 8);
      else s.setAngle(0);

      s.nameTag.setText(p.name + (p.alive ? '' : ' ✝'));
      s.nameTag.setPosition(p.x, p.y - 28);
      s.hpBg.setPosition(p.x, p.y - 20);
      const ratio = p.maxHp ? p.hp / p.maxHp : 0;
      s.hpFg.setPosition(p.x - 18 + 18 * ratio, p.y - 20);
      s.hpFg.width = 36 * ratio;
      s.hpFg.setFillStyle(ratio > 0.35 ? 0x2ecc71 : 0xe74c3c);
      s.hpBg.setVisible(p.alive);
      s.hpFg.setVisible(p.alive);

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
    for (const e of this.state.effects || []) {
      if (e.type === 'lightning') {
        this.effectGraphics.lineStyle(2, e.color || 0xffee55, 0.9);
        this.effectGraphics.lineBetween(e.x1, e.y1, e.x2, e.y2);
      } else if (e.type === 'nova' || e.type === 'blink' || e.type === 'heal' || e.type === 'barrier') {
        this.effectGraphics.lineStyle(2, e.color || 0xffffff, 0.7);
        this.effectGraphics.strokeCircle(e.x, e.y, e.radius || 30);
        this.effectGraphics.fillStyle(e.color || 0xffffff, 0.12);
        this.effectGraphics.fillCircle(e.x, e.y, e.radius || 24);
      }
    }
  }

  updateHud() {
    const me = this.me();
    if (!me) return;

    const hpRatio = me.hp / me.maxHp;
    this.hpBar.width = 220 * hpRatio;
    this.hpText.setText(`HP ${Math.ceil(me.hp)} / ${me.maxHp}`);

    const xpRatio = me.xpToNext ? Math.min(1, me.xp / me.xpToNext) : 0;
    this.xpBar.width = 220 * xpRatio;
    this.levelText.setText(`Lv ${me.level}  ·  XP ${me.xp}/${me.xpToNext}`);

    const remain = Math.max(0, this.state.matchDuration - this.state.matchTime);
    const m = Math.floor(remain / 60);
    const s = Math.floor(remain % 60);
    this.timerText.setText(`${m}:${String(s).padStart(2, '0')}`);
    this.roundText.setText(`Round ${this.state.round} · zona em ${Math.max(0, Math.ceil(this.state.arena.nextShrinkAt - this.state.roundTime))}s`);

    // Spells
    for (let i = 0; i < 4; i++) {
      const slot = this.spellSlots[i];
      const spell = me.spells[i];
      if (!spell) {
        slot.name.setText('-');
        slot.cd.setText('');
        slot.bg.setStrokeStyle(2, 0x443866);
        continue;
      }
      slot.name.setText(`${spell.stats.name}\nLv${spell.level}`);
      slot.cd.setText(spell.cooldownLeft > 0 ? spell.cooldownLeft.toFixed(1) : 'OK');
      slot.bg.setStrokeStyle(2, spell.stats.color || 0x6b5cff);
    }
    const ult = me.ultimate;
    const ultSlot = this.spellSlots[4];
    if (!ult) {
      ultSlot.name.setText('Ultimate\n(Lv4)');
      ultSlot.cd.setText('');
      ultSlot.bg.setStrokeStyle(2, 0x443866);
    } else {
      ultSlot.name.setText(ult.stats.name);
      ultSlot.cd.setText(ult.usedThisRound ? 'usado' : ult.stats.passive ? 'passivo' : 'PRONTO');
      ultSlot.bg.setStrokeStyle(2, ult.stats.color || 0xffaa33);
    }

    const board = [...this.state.players]
      .sort((a, b) => b.score - a.score)
      .map((p) => `${p.alive ? '●' : '○'} ${p.name}  Lv${p.level}  ${p.kills}K  ${p.score}`)
      .join('\n');
    this.scoreboard.setText(board);
  }

  handleBanners() {
    if (!this.state) return;
    if (this.state.phase === 'intermission') {
      const w = this.state.players.find((p) => p.id === this.state.winnerId);
      this.bannerText.setText(
        w
          ? `${w.name} venceu o round!\nPróximo em ${Math.ceil(this.state.intermissionTimer)}s`
          : `Round encerrado\nPróximo em ${Math.ceil(this.state.intermissionTimer)}s`
      );
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
      const bg = this.add.rectangle(0, 0, 230, 280, 0x1a1430, 0.98).setStrokeStyle(2, choice.kind === 'upgrade' ? 0xf1c40f : 0x6b5cff);
      const badge = this.add
        .text(0, -110, choice.label || (choice.kind === 'upgrade' ? 'UPGRADE' : 'NOVA'), {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '12px',
          color: choice.kind === 'upgrade' ? '#f1c40f' : '#a99bc8',
        })
        .setOrigin(0.5);
      const name = this.add
        .text(0, -70, choice.def?.name || choice.spellId, {
          fontFamily: 'Georgia, serif',
          fontSize: '22px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      const desc = this.add
        .text(0, 10, choice.def?.description || '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          color: '#c4b5e0',
          align: 'center',
          wordWrap: { width: 200 },
        })
        .setOrigin(0.5);
      const meta = this.add
        .text(
          0,
          100,
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

      card.add([bg, badge, name, desc, meta]);
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
