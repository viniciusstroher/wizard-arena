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
    this.levelUpWaitOpen = false;
    this.levelUpSubmitting = false;
    this.levelUpSubmitAt = 0;
    this.levelUpChoiceKey = null;
    this.levelUpSubmittedKey = null;
    this.levelUpChoices = [];
    this.choiceCards = [];
    this.levelUpHint = null;
    this.levelUpDim = null;
    this.levelUpWaitText = null;
    this.eventLog = [];
    this.eventScroll = 0;
    this.disconnectConfirmOpen = false;
    this.leaving = false;
    this.matchEndOpen = false;
    this.lavaFx = [];
    this.selectedSpellSlot = 0;
    this.moveDust = null;
    this.lavaBurn = null;
    this.arenaFireWall = null;
    this.arenaFireEmbers = null;
    this.fireballFx = null;
    this.iceFx = null;
    this.healFx = null;
    this.poisonFx = null;
    this.necroFx = null;
    this.sparkFx = null;
    this.magicFx = null;
    this.meteorFx = null;
    this.meteorTrailAt = new Map();
    this.burstSeen = new Set();
    this.aoeFxAt = new Map();
    this.dashGhosts = [];
    /** Direção de dash pendente até o próximo emit (evita perder toques curtos). */
    this.pendingDash = null;
    this.lastHurtSoundAt = 0;
    this.battleMusic = null;
  }

  create() {
    this.socket = getSocket();
    this.cameras.main.setBackgroundColor('#1a0500');
    this.startBattleMusic();

    this.lavaFloor = this.add
      .tileSprite(640, 360, 1280, 720, 'lava_tile')
      .setDepth(-2)
      .setTileScale(1.35, 1.35);
    this.createLavaEffects();

    this.arenaFloor = this.add.tileSprite(640, 360, 640, 640, 'arena_brick').setDepth(0);
    this.arenaMaskGfx = this.make.graphics({ x: 0, y: 0, add: false });
    this.arenaFloor.setMask(this.arenaMaskGfx.createGeometryMask());

    this.arenaGraphics = this.add.graphics().setDepth(1);
    this.aoeGraphics = this.add.graphics().setDepth(6);
    this.effectGraphics = this.add.graphics().setDepth(5);
    this.createMoveDust();
    this.createLavaBurn();
    this.createArenaFireWall();
    this.createSpellParticleFx();

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
      tab: Phaser.Input.Keyboard.KeyCodes.TAB,
      cast: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });

    this.selectedSpellSlot = 0;
    this.input.keyboard.addCapture('SPACE');
    this.input.keyboard.addCapture('TAB');
    this.input.keyboard.on('keydown', this.onDashKeyDown, this);

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
      this.stopBattleMusic();
      this.socket.off('game_state');
      this.socket.off('game_event');
    });

    // Garante snapshot da arena/spawns mesmo se o state inicial chegou antes da cena
    this.socket.emit('request_state');
  }

  startBattleMusic() {
    if (!this.cache.audio.exists('battle_music')) return;
    this.stopBattleMusic();
    const volRaw = localStorage.getItem('wa_lobby_music_vol');
    const volN = Number(volRaw);
    const volume = Number.isFinite(volN) ? Phaser.Math.Clamp(volN, 0, 1) : 0.2;
    this.battleMusic = this.sound.add('battle_music', {
      loop: true,
      volume,
    });
    const play = () => {
      if (this.battleMusic && !this.battleMusic.isPlaying) {
        this.battleMusic.play();
      }
    };
    if (this.sound.locked) {
      this.sound.once('unlocked', play);
    } else {
      play();
    }
  }

  stopBattleMusic() {
    if (this.battleMusic) {
      this.battleMusic.stop();
      this.battleMusic.destroy();
      this.battleMusic = null;
    }
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

    // Barra de escudo (Barrier) — abaixo da XP, canto superior esquerdo
    this.shieldBarBg = this.add
      .rectangle(20, 56, 220, 12, 0x152033)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
    this.shieldBar = this.add
      .rectangle(20, 56, 220, 12, 0x4a90ff)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);
    this.shieldText = this.add
      .text(24, 56, 'ESCUTO 0', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#dcecff',
      })
      .setScrollFactor(0)
      .setDepth(102)
      .setVisible(false);

    this.levelText = this.add
      .text(24, 72, 'Lv 1', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#f1c40f',
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.scoreText = this.add
      .text(250, 72, '0/0', {
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
    // 1–3 magias, 4 = ultimate, Shift = dash (depois do ultimate, com gap)
    const slotLabels = ['1', '2', '3', '4', 'Shift'];
    for (let i = 0; i < 5; i++) {
      const gapAfterUlt = i === 4 ? 24 : 0;
      const x = 24 + i * 70 + gapAfterUlt;
      const y = this.scale.height - 70;
      const slot = this.add.container(x, y).setScrollFactor(0).setDepth(100);
      const bg = this.add.rectangle(0, 0, 60, 60, 0x1a1430, 0.95).setStrokeStyle(2, 0x6b5cff);
      const icon = this.add.image(0, -4, 'spell_firebolt').setScale(1.35).setVisible(false);
      const key = this.add
        .text(-26, -26, slotLabels[i], {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: i === 4 ? '9px' : '11px',
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
      // Slot 4 = dash (não selecionável como magia)
      if (i < 4) {
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
      case 'damage': {
        // Zona/DoT contínuo: só números flutuantes (evita spam no painel)
        if (!ev.fromHit && !ev.sourceId) return null;
        const target = ev.targetName || (ev.isPlayer ? this.playerName(ev.targetId) : 'Monstro');
        if (ev.sourceId) {
          return `${this.playerName(ev.sourceId)} causou ${ev.amount} em ${target}`;
        }
        return `${target} recebeu ${ev.amount} de dano`;
      }
      case 'level_up':
        return `${this.playerName(ev.playerId)} subiu para Lv ${ev.level}`;
      case 'monster_level_up': {
        const mon = this.state?.monsters?.find((m) => m.entityId === ev.monsterId);
        const label = mon ? this.monsterLabel(mon.type) : 'Monstro';
        return `${label} subiu para Lv ${ev.level}`;
      }
      case 'arena_shrink':
        return 'A arena está encolhendo!';
      case 'meteor_warn':
        return 'Atenção: meteoro se aproxima!';
      case 'meteor_strike':
        return 'Um meteoro atingiu a arena!';
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

  spawnDamageNumber(x, y, amount, isSelf = false) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(amount > 0)) return;
    const jitterX = (Math.random() - 0.5) * 18;
    const startY = y - 34;
    const label = this.add
      .text(x + jitterX, startY, `-${Math.round(amount)}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: isSelf ? '20px' : '17px',
        color: isSelf ? '#ff8a80' : '#ffe066',
        stroke: '#1a0500',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(55)
      .setAlpha(1);

    this.tweens.add({
      targets: label,
      y: startY - 42,
      alpha: 0,
      scale: 1.15,
      duration: 1400,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  spawnLevelUpPopup(x, y, level) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(level > 0)) return;
    const startY = y - 40;
    const label = this.add
      .text(x, startY, `Lv ${level}!`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '18px',
        color: '#ffd166',
        stroke: '#1a0500',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(56)
      .setAlpha(1)
      .setScale(0.85);

    this.tweens.add({
      targets: label,
      y: startY - 52,
      alpha: 0,
      scale: 1.3,
      duration: 1300,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });

    this.magicFx?.emitParticleAt(x, y - 10, 12);
    this.healFx?.emitParticleAt(x, y - 10, 8);
  }

  playDeathSound() {
    if (!this.cache.audio.exists('player_death')) return;
    this.sound.play('player_death', { volume: 0.85 });
  }

  playRoundEndSound() {
    if (!this.cache.audio.exists('round_end')) return;
    this.sound.play('round_end', { volume: 0.9 });
  }

  playRoundStartSound() {
    if (!this.cache.audio.exists('round_start')) return;
    this.sound.play('round_start', { volume: 0.9 });
  }

  playHurtSound() {
    if (!this.cache.audio.exists('player_hurt')) return;
    const now = this.time.now;
    // Evita spam em DoT/lava contínuo
    if (now - this.lastHurtSoundAt < 140) return;
    this.lastHurtSoundAt = now;
    this.sound.play('player_hurt', { volume: 0.75 });
  }

  onState(state) {
    const prevPhase = this.state?.phase;
    this.state = state;
    let roundEnded = false;
    for (const ev of state.events || []) {
      const msg = this.formatGameEvent(ev);
      if (msg) this.pushBoardEvent(msg);
      if (ev.type === 'damage') {
        const isSelf = ev.isPlayer && ev.targetId === this.playerId;
        this.spawnDamageNumber(ev.x, ev.y, ev.amount, isSelf);
        if (isSelf && ev.amount > 0) {
          this.playHurtSound();
        }
      }
      if (ev.type === 'level_up' || ev.type === 'monster_level_up') {
        let x = ev.x;
        let y = ev.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          if (ev.type === 'level_up') {
            const p = state.players?.find((pl) => pl.id === ev.playerId);
            x = p?.x;
            y = p?.y;
          } else {
            const m = state.monsters?.find((mon) => mon.entityId === ev.monsterId);
            x = m?.x;
            y = m?.y;
          }
        }
        this.spawnLevelUpPopup(x, y, ev.level);
      }
      // Fallback: ossos de monstro pelo evento (caso o effect do servidor atrase)
      if (ev.type === 'monster_kill' && Number.isFinite(ev.x) && Number.isFinite(ev.y)) {
        this.ensureCorpseAt(ev.x, ev.y);
      }
      if (ev.type === 'meteor_strike') {
        const me = this.me();
        if (me?.alive && Number.isFinite(ev.x) && Number.isFinite(ev.y)) {
          const d = Math.hypot(me.x - ev.x, me.y - ev.y);
          const r = ev.radius || 80;
          if (d < r * 2.2) {
            this.cameras.main.shake(d < r ? 220 : 120, d < r ? 0.008 : 0.0035);
          }
        }
      }
      if (ev.type === 'player_death' && ev.playerId === this.playerId) {
        this.playDeathSound();
      }
      if (ev.type === 'round_start') {
        this.playRoundStartSound();
      }
      if (ev.type === 'round_win') {
        roundEnded = true;
      }
    }
    // Som do fim do round: no evento round_win, ou ao ir direto a intermission (sem level-up).
    // levelup → intermission é só a liberação pós-habilidades; o som já tocou no round_win.
    if (state.phase === 'intermission' && prevPhase === 'playing') {
      roundEnded = true;
    }
    if (roundEnded) {
      this.playRoundEndSound();
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

  heldMoveDir() {
    if (this.cursors.up.isDown) return 'up';
    if (this.cursors.down.isDown) return 'down';
    if (this.cursors.left.isDown) return 'left';
    if (this.cursors.right.isDown) return 'right';
    return null;
  }

  onDashKeyDown(event) {
    if (event.repeat) return;
    if (this.disconnectConfirmOpen || this.matchEndOpen || this.leaving) return;

    const dirByCode = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
    const dir = dirByCode[event.code];
    const shiftHeld = event.shiftKey || this.cursors.dash?.isDown;

    // Shift + WASD (W/A/S/D apertado com Shift).
    if (dir && shiftHeld) {
      this.pendingDash = dir;
      return;
    }

    // Já andando e aperta Shift (esquerdo ou direito).
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      const held = this.heldMoveDir();
      if (held) this.pendingDash = held;
    }
  }

  detectDash() {
    // Fallback por frame (JustDown) — o keydown já cobre toques curtos via pendingDash.
    const keys = [
      ['up', this.cursors.up],
      ['down', this.cursors.down],
      ['left', this.cursors.left],
      ['right', this.cursors.right],
    ];
    const shiftDown = this.cursors.dash.isDown;
    const shiftJust = Phaser.Input.Keyboard.JustDown(this.cursors.dash);

    for (const [dir, key] of keys) {
      if (shiftDown && Phaser.Input.Keyboard.JustDown(key)) return dir;
      if (shiftJust && key.isDown) return dir;
    }
    return null;
  }

  sendInput() {
    const pointer = this.input.activePointer;
    const levelUpPaused = this.levelUpOpen || this.levelUpWaitOpen || this.levelUpSubmitting;

    // Durante level-up: combate pausado. Quem escolhe usa 1–4 / Tab; quem espera só aguarda.
    if (levelUpPaused) {
      if (this.levelUpOpen && !this.levelUpSubmitting) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.tab)) {
          this.cycleSpellSlot();
          this.updateLevelUpSlotHint();
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.one)) this.submitLevelUpChoice(0);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.two)) this.submitLevelUpChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.three)) this.submitLevelUpChoice(2);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.four)) this.submitLevelUpChoice(3);
      }
      this.socket.emit('player_input', {
        up: false,
        down: false,
        left: false,
        right: false,
        aimX: pointer.worldX,
        aimY: pointer.worldY,
        castSlot: -1,
        dash: null,
      });
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.one)) this.selectedSpellSlot = 0;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.two)) this.selectedSpellSlot = 1;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.three)) this.selectedSpellSlot = 2;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.four)) this.selectedSpellSlot = 3;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.tab)) this.cycleSpellSlot();

    // Hold SPACE to cast (server latches + respects cooldown).
    const castSlot = this.cursors.cast.isDown ? this.selectedSpellSlot : -1;
    const dash = this.pendingDash || this.detectDash();
    if (dash) this.pendingDash = null;

    this.socket.emit('player_input', {
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      aimX: pointer.worldX,
      aimY: pointer.worldY,
      castSlot,
      dash,
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

  createArenaFireWall() {
    this.arenaFireWall = this.add
      .particles(0, 0, 'particle', {
        tint: [0xff1a00, 0xff4400, 0xff7700, 0xffaa22, 0xffdd55],
        speed: { min: 35, max: 85 },
        angle: { min: 250, max: 290 },
        scale: { start: 2.1, end: 0 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 320, max: 620 },
        gravityY: -110,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(2);

    this.arenaFireEmbers = this.add
      .particles(0, 0, 'particle', {
        tint: [0xff6600, 0xff9900, 0xffcc44, 0xffeebb],
        speed: { min: 15, max: 55 },
        angle: { min: 220, max: 320 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.85, end: 0 },
        lifespan: { min: 400, max: 900 },
        gravityY: -40,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(2.5);
  }

  createSpellParticleFx() {
    this.fireballFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0xff2200, 0xff4a00, 0xff8800, 0xffcc33, 0xffee88],
        speed: { min: 20, max: 90 },
        scale: { start: 1.6, end: 0 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 180, max: 380 },
        gravityY: -40,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(24);

    this.iceFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0xffffff, 0xc8f0ff, 0x66ccff, 0x88ddff, 0xaaddff],
        speed: { min: 15, max: 70 },
        scale: { start: 1.35, end: 0 },
        alpha: { start: 0.9, end: 0 },
        lifespan: { min: 220, max: 480 },
        gravityY: 18,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(24);

    this.healFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0x55ff88, 0xa8ffc8, 0xffffff, 0x88ffaa],
        speed: { min: 12, max: 48 },
        angle: { min: 240, max: 300 },
        scale: { start: 1.4, end: 0.2 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 420, max: 780 },
        gravityY: -55,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(26);

    this.poisonFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0x88ff44, 0x66cc33, 0xaaff66, 0x44aa22],
        speed: { min: 8, max: 36 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.8, end: 0 },
        alpha: { start: 0.55, end: 0 },
        lifespan: { min: 500, max: 900 },
        gravityY: -22,
        frequency: -1,
        emitting: false,
      })
      .setDepth(7);

    this.necroFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0x1a001a, 0x4a0080, 0x7b2cff, 0x120018, 0x2a0a3a],
        speed: { min: 20, max: 90 },
        scale: { start: 1.6, end: 0 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 180, max: 420 },
        gravityY: -20,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(26);

    this.sparkFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0xffffff, 0xaadfff, 0xffee88, 0x88ccff],
        speed: { min: 40, max: 160 },
        scale: { start: 1.5, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 120, max: 320 },
        gravityY: 40,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(27);

    this.magicFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0xaa88ff, 0xccbbff, 0xffffff, 0x8866ee],
        speed: { min: 20, max: 90 },
        scale: { start: 1.5, end: 0 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 200, max: 450 },
        gravityY: -30,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(26);

    this.meteorFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0xff2200, 0xff5500, 0xff9900, 0xffcc44, 0xffeebb, 0xffffff],
        speed: { min: 30, max: 180 },
        scale: { start: 2.2, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 220, max: 480 },
        gravityY: 60,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
        maxParticles: 80,
        advance: 0,
      })
      .setDepth(28);
  }

  emitDirectionalTrail(emitter, sprite, x, y, vx, vy, stampKey, count = 3) {
    if (!emitter) return;
    const now = this.time.now;
    if (now - (sprite[stampKey] || 0) < 22) return;
    sprite[stampKey] = now;
    const ang = Phaser.Math.RadToDeg(Math.atan2(vy || 0, vx || 1));
    emitter.setEmitterAngle({ min: ang + 150, max: ang + 210 });
    emitter.setParticleSpeed({ min: 30, max: 90 });
    emitter.emitParticleAt(x, y, count);
    emitter.emitParticleAt(
      x - (vx || 0) * 0.02 + Phaser.Math.Between(-2, 2),
      y - (vy || 0) * 0.02 + Phaser.Math.Between(-2, 2),
      Math.max(1, count - 1)
    );
  }

  ensureProjectileGlow(sprite, x, y, color, radius = 16) {
    if (!sprite.fireGlow) {
      sprite.fireGlow = this.add
        .circle(x, y, radius, color, 0.35)
        .setDepth(23)
        .setBlendMode(Phaser.BlendModes.ADD);
    } else {
      sprite.fireGlow.setFillStyle(color, 0.35);
    }
    const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 55);
    sprite.fireGlow.setPosition(x, y).setVisible(true);
    sprite.fireGlow.setScale(0.95 + 0.35 * pulse);
    sprite.fireGlow.setAlpha(0.28 + 0.22 * pulse);
  }

  emitFireballTrail(sprite, x, y, vx = 0, vy = 0) {
    this.emitDirectionalTrail(this.fireballFx, sprite, x, y, vx, vy, 'lastFireTrailAt', 3);
    this.ensureProjectileGlow(sprite, x, y, 0xff6600, 16);
  }

  emitIceTrail(sprite, x, y, vx = 0, vy = 0) {
    this.emitDirectionalTrail(this.iceFx, sprite, x, y, vx, vy, 'lastIceTrailAt', 2);
    this.ensureProjectileGlow(sprite, x, y, 0x66ccff, 14);
  }

  emitSkullTrail(sprite, x, y, vx = 0, vy = 0) {
    this.emitDirectionalTrail(this.necroFx, sprite, x, y, vx, vy, 'lastSkullTrailAt', 3);
    this.ensureProjectileGlow(sprite, x, y, 0x4a0080, 15);
  }

  burstOnce(key, emitFn) {
    if (this.burstSeen.has(key)) return;
    this.burstSeen.add(key);
    emitFn();
  }

  pruneBurstSeen(activeKeys) {
    for (const key of this.burstSeen) {
      if (!activeKeys.has(key)) this.burstSeen.delete(key);
    }
  }

  burstSpellParticles(e) {
    const spell = e.spellId || e.type;
    const x = e.x ?? e.x1 ?? 0;
    const y = e.y ?? e.y1 ?? 0;
    if (spell === 'firebolt' || spell === 'fireball' || e.type === 'nova' || spell === 'flame_nova') {
      this.fireballFx?.emitParticleAt(x, y, 14);
      this.sparkFx?.emitParticleAt(x, y, 8);
    } else if (spell === 'ice_shard' || e.type === 'freeze') {
      this.iceFx?.emitParticleAt(x, y, 16);
      this.sparkFx?.emitParticleAt(x, y, 6);
    } else if (spell === 'arc_lightning' || spell === 'storm_call' || e.type === 'lightning') {
      this.sparkFx?.emitParticleAt(e.x1 ?? x, e.y1 ?? y, 10);
      this.sparkFx?.emitParticleAt(e.x2 ?? x, e.y2 ?? y, 14);
    } else if (spell === 'skull_bolt') {
      this.necroFx?.emitParticleAt(x, y, 16);
      this.sparkFx?.emitParticleAt(x, y, 6);
    } else if (e.type === 'heal' || spell === 'mend') {
      this.healFx?.emitParticleAt(x, y, 12);
    } else if (e.type === 'blink') {
      this.magicFx?.emitParticleAt(x, y, 14);
    } else if (e.type === 'barrier') {
      this.magicFx?.emitParticleAt(x, y, 10);
      this.sparkFx?.emitParticleAt(x, y, 6);
    } else if (e.type === 'poison_burst' || spell === 'poison_cloud') {
      this.poisonFx?.emitParticleAt(x, y, 18);
    } else if (e.type === 'apocalypse' || e.type === 'meteor_strike' || spell === 'meteor') {
      this.meteorFx?.emitParticleAt(x, y, 14);
      this.fireballFx?.emitParticleAt(x, y, 8);
      this.sparkFx?.emitParticleAt(x, y, 8);
    } else {
      this.sparkFx?.emitParticleAt(x, y, 8);
    }
  }

  /** Posição do meteoro em queda (diagonal) conforme progresso 0..1. */
  meteorFallPose(e, progress) {
    const t = Math.min(1, Math.max(0, progress));
    // Ease-in: acelera perto do chão
    const ease = t * t;
    const startX = e.x - 95;
    const startY = e.y - 320;
    return {
      x: startX + (e.x - startX) * ease,
      y: startY + (e.y - 8 - startY) * ease,
      t: ease,
    };
  }

  emitMeteorTrail(id, x, y, count = 2) {
    if (!this.meteorFx) return;
    const now = this.time.now;
    const last = this.meteorTrailAt.get(id) || 0;
    if (now - last < 48) return;
    this.meteorTrailAt.set(id, now);
    this.meteorFx.setEmitterAngle({ min: 200, max: 250 });
    this.meteorFx.setParticleSpeed({ min: 40, max: 110 });
    this.meteorFx.emitParticleAt(x, y, Math.min(3, count));
  }

  drawMeteorBody(g, x, y, scale, fade, glow = true) {
    if (glow) {
      g.fillStyle(0xff6600, 0.22 * fade);
      g.fillCircle(x, y, 22 * scale);
      g.fillStyle(0xffaa33, 0.3 * fade);
      g.fillCircle(x, y, 14 * scale);
    }
    // Rocha irregular
    g.fillStyle(0x5a3a2a, 0.95 * fade);
    g.fillCircle(x, y, 11 * scale);
    g.fillStyle(0x3d2818, 0.9 * fade);
    g.fillCircle(x - 3 * scale, y + 2 * scale, 6 * scale);
    g.fillStyle(0x8b5a2b, 0.85 * fade);
    g.fillCircle(x + 3 * scale, y - 3 * scale, 5 * scale);
    // Núcleo quente
    g.fillStyle(0xffee88, 0.95 * fade);
    g.fillCircle(x + 1 * scale, y - 1 * scale, 4.5 * scale);
    g.fillStyle(0xffffff, 0.8 * fade);
    g.fillCircle(x + 2 * scale, y - 2 * scale, 2 * scale);
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
    this.drawArenaFireWall(a);
  }

  drawArenaFireWall(a) {
    const t = this.time.now;
    const pulse = 0.55 + 0.45 * Math.sin(t / 110);
    const flicker = 0.65 + 0.35 * Math.sin(t / 65 + 1.3);

    // Base glow — parede de calor na borda
    this.arenaGraphics.lineStyle(22, 0xff2200, 0.18 * flicker);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius + 2);
    this.arenaGraphics.lineStyle(14, 0xff5500, 0.32 * pulse);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius);
    this.arenaGraphics.lineStyle(8, 0xff8800, 0.5 * flicker);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius - 1);
    this.arenaGraphics.lineStyle(3, 0xffdd66, 0.75 * pulse);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius - 2);

    // Línguas de fogo radiais (parede)
    const tongues = Math.max(40, Math.floor(a.radius * 0.7));
    for (let i = 0; i < tongues; i++) {
      const ang = (i / tongues) * Math.PI * 2;
      const wobble = 0.55 + 0.45 * Math.sin(t * 0.014 + i * 2.1);
      const height = (12 + (i % 6) * 2.8 + 8 * Math.sin(t * 0.01 + i * 1.4)) * wobble;
      const baseR = a.radius - 1;
      const tipR = a.radius + height;
      const x0 = a.x + Math.cos(ang) * baseR;
      const y0 = a.y + Math.sin(ang) * baseR;
      const x1 = a.x + Math.cos(ang) * tipR;
      const y1 = a.y + Math.sin(ang) * tipR;
      const midR = (baseR + tipR) * 0.55;
      const xM = a.x + Math.cos(ang) * midR;
      const yM = a.y + Math.sin(ang) * midR;

      this.arenaGraphics.lineStyle(5.5, 0xff3300, 0.35 * wobble);
      this.arenaGraphics.lineBetween(x0, y0, x1, y1);
      this.arenaGraphics.lineStyle(3.2, 0xff8800, 0.55 * wobble);
      this.arenaGraphics.lineBetween(x0, y0, xM, yM);
      this.arenaGraphics.lineStyle(1.6, 0xffee88, 0.8 * wobble);
      this.arenaGraphics.lineBetween(x0, y0, a.x + Math.cos(ang) * (baseR + height * 0.35), a.y + Math.sin(ang) * (baseR + height * 0.35));
    }

    // Partículas subindo ao longo de toda a circunferência
    if (!this.arenaFireWall) return;
    const steps = Math.max(24, Math.floor((Math.PI * 2 * a.radius) / 22));
    const frame = Math.floor(t / 33);
    for (let i = 0; i < steps; i++) {
      if ((i + frame) % 3 !== 0) continue;
      const ang = (i / steps) * Math.PI * 2 + t * 0.0004;
      const jitter = Math.sin(t * 0.02 + i * 0.7) * 3;
      const r = a.radius + jitter;
      const x = a.x + Math.cos(ang) * r;
      const y = a.y + Math.sin(ang) * r;
      this.arenaFireWall.emitParticleAt(x, y, 1);
      if (this.arenaFireEmbers && (i + frame) % 6 === 0) {
        this.arenaFireEmbers.emitParticleAt(x, y, 1);
      }
    }
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
      sprite.shieldBg = this.add
        .rectangle(0, 0, 36, 4, 0x0a1830, 0.75)
        .setDepth(depth + 1)
        .setVisible(false);
      sprite.shieldFg = this.add
        .rectangle(0, 0, 36, 4, 0x4a90ff)
        .setDepth(depth + 2)
        .setVisible(false);
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

      const hasShield = p.alive && p.shield > 0;
      const isSelf = p.id === this.playerId;
      const hpY = p.y - 20;
      const shieldY = hpY - 7;
      const nameY = hasShield ? p.y - 36 : p.y - 28;

      s.nameTag.setText(`${p.name} Lv${p.level || 1}${p.alive ? '' : ' ✝'}`);
      s.nameTag.setColor(isSelf ? '#ffd166' : '#ffffff');
      s.nameTag.setPosition(p.x, nameY);
      s.hpBg.setPosition(p.x, hpY);
      const ratio = p.maxHp ? p.hp / p.maxHp : 0;
      s.hpFg.setPosition(p.x - 18 + 18 * ratio, hpY);
      s.hpFg.width = 36 * ratio;
      s.hpFg.setFillStyle(ratio > 0.35 ? 0x2ecc71 : 0xe74c3c);
      s.hpBg.setVisible(p.alive);
      s.hpFg.setVisible(p.alive);

      if (hasShield) {
        const maxShield = p.maxShield > 0 ? p.maxShield : p.shield;
        const sRatio = Math.min(1, p.shield / maxShield);
        if (!s.shieldBg) {
          s.shieldBg = this.add.rectangle(0, 0, 36, 4, 0x0a1830, 0.75).setDepth(21);
          s.shieldFg = this.add.rectangle(0, 0, 36, 4, 0x4a90ff).setDepth(22);
        }
        s.shieldBg.setPosition(p.x, shieldY).setVisible(true);
        s.shieldFg.setPosition(p.x - 18 + 18 * sRatio, shieldY).setVisible(true);
        s.shieldFg.width = 36 * sRatio;
      } else if (s.shieldBg) {
        s.shieldBg.setVisible(false);
        s.shieldFg.setVisible(false);
      }

      if (!p.alive && !s.corpseDropped) {
        s.corpseDropped = true;
        this.ensureCorpseAt(p.x, p.y);
      }
      if (p.alive) s.corpseDropped = false;

      if (hasShield) {
        const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 140);
        if (!s.shieldRing) {
          s.shieldRing = this.add
            .circle(p.x, p.y, 22, 0x88aaff, 0.15)
            .setStrokeStyle(2, 0x88aaff, 0.85)
            .setDepth(19);
        }
        if (!s.shieldRingOuter) {
          s.shieldRingOuter = this.add
            .circle(p.x, p.y, 28, 0x88aaff, 0)
            .setStrokeStyle(1.5, 0xaaccff, 0.55)
            .setDepth(18);
        }
        s.shieldRing.setPosition(p.x, p.y).setVisible(true);
        s.shieldRing.setScale(0.95 + 0.12 * pulse);
        s.shieldRing.setAlpha(0.35 + 0.25 * pulse);
        s.shieldRingOuter.setPosition(p.x, p.y).setVisible(true);
        s.shieldRingOuter.setScale(1 + 0.08 * pulse);
        s.shieldRingOuter.setAlpha(0.35 + 0.3 * pulse);
      } else {
        if (s.shieldRing) s.shieldRing.setVisible(false);
        if (s.shieldRingOuter) s.shieldRingOuter.setVisible(false);
      }
    }
    for (const [id, s] of this.playerSprites) {
      if (!seen.has(id)) {
        s.destroy();
        s.nameTag.destroy();
        s.hpBg.destroy();
        s.hpFg.destroy();
        s.shieldBg?.destroy();
        s.shieldFg?.destroy();
        s.shieldRing?.destroy();
        s.shieldRingOuter?.destroy();
        s.burnGlow?.destroy();
        this.playerSprites.delete(id);
      }
    }
  }

  monsterTexture(type) {
    const key = `monster_${type}`;
    return this.textures.exists(key) ? key : 'monster';
  }

  monsterLabel(type) {
    const labels = {
      skeleton: 'esqueleto',
      skeleton_archer: 'esqueleto arqueiro',
      wolf: 'lobo',
      giant_spider: 'aranha gigante',
      bat: 'morcego',
      elf: 'elfo',
      beholder: 'beholder',
      dragon: 'dragão',
      lich: 'lich',
    };
    return labels[type] || type;
  }

  renderMonsters() {
    const seen = new Set();
    for (const m of this.state.monsters) {
      seen.add(m.entityId);
      const tex = this.monsterTexture(m.type);
      const s = this.ensureActor(this.monsterSprites, m.entityId, tex, 15);
      if (s.texture.key !== tex) s.setTexture(tex);
      s.clearTint();
      const scale = (m.radius || 14) / 14;
      s.setScale(scale);
      s.setPosition(m.x, m.y);
      this.emitMoveDust(s, m.x, m.y, m.vx, m.vy);
      const tagY = m.y - 26 * scale;
      s.nameTag.setText(`${this.monsterLabel(m.type)} Lv${m.level || 1}`);
      s.nameTag.setPosition(m.x, tagY);
      s.hpBg.setPosition(m.x, tagY + 8);
      const ratio = m.maxHp ? m.hp / m.maxHp : 0;
      s.hpFg.setPosition(m.x - 16 + 16 * ratio, tagY + 8);
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

  projectileTexture(kind) {
    if (kind === 'arrow' && this.textures.exists('proj_arrow')) return 'proj_arrow';
    if ((kind === 'fireball' || kind === 'firebolt') && this.textures.exists('proj_fireball')) {
      return 'proj_fireball';
    }
    if (kind === 'ice_shard' && this.textures.exists('proj_ice_shard')) return 'proj_ice_shard';
    if (kind === 'skull_bolt' && this.textures.exists('proj_skull_bolt')) return 'proj_skull_bolt';
    return 'orb';
  }

  renderProjectiles() {
    const seen = new Set();
    for (const p of this.state.projectiles) {
      seen.add(p.entityId);
      const kind = p.kind || p.spellId || 'orb';
      const tex = this.projectileTexture(kind);
      let s = this.projectileSprites.get(p.entityId);
      if (!s || s.texture.key !== tex) {
        if (s) {
          if (s.fireGlow) {
            s.fireGlow.destroy();
            s.fireGlow = null;
          }
          s.destroy();
        }
        s = this.add.sprite(p.x, p.y, tex).setDepth(25);
        this.projectileSprites.set(p.entityId, s);
      }
      s.setPosition(p.x, p.y);
      if (tex === 'orb') {
        s.setTint(p.color || 0xffffff);
        s.setScale((p.radius || 8) / 6);
        s.setRotation(0);
        s.setBlendMode(Phaser.BlendModes.NORMAL);
        if (s.fireGlow) s.fireGlow.setVisible(false);
      } else if (kind === 'arrow') {
        s.clearTint();
        s.setScale(0.85);
        s.setBlendMode(Phaser.BlendModes.NORMAL);
        s.setRotation(Math.atan2(p.vy || 0, p.vx || 1));
        if (s.fireGlow) s.fireGlow.setVisible(false);
      } else if (kind === 'ice_shard') {
        const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 70);
        s.clearTint();
        s.setBlendMode(Phaser.BlendModes.ADD);
        s.setScale(1.05 + 0.1 * pulse);
        s.setRotation(Math.atan2(p.vy || 0, p.vx || 1) + Math.PI / 2);
        this.emitIceTrail(s, p.x, p.y, p.vx, p.vy);
      } else if (kind === 'skull_bolt') {
        const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 55);
        s.clearTint();
        s.setBlendMode(Phaser.BlendModes.NORMAL);
        s.setScale(1.15 + 0.12 * pulse);
        s.setRotation(Math.sin(this.time.now / 90) * 0.15);
        this.emitSkullTrail(s, p.x, p.y, p.vx, p.vy);
      } else {
        // fireball / firebolt — brilho + rastro de chama
        const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 60);
        s.clearTint();
        s.setBlendMode(Phaser.BlendModes.ADD);
        s.setScale(1.05 + 0.12 * pulse);
        s.setRotation(Math.atan2(p.vy || 0, p.vx || 1) + Math.PI / 2);
        this.emitFireballTrail(s, p.x, p.y, p.vx, p.vy);
      }
    }
    for (const [id, s] of this.projectileSprites) {
      if (!seen.has(id)) {
        if (s.fireGlow) s.fireGlow.destroy();
        s.destroy();
        this.projectileSprites.delete(id);
      }
    }
  }

  renderAoes() {
    this.aoeGraphics.clear();
    const t = this.time.now / 1000;
    for (const a of this.state.aoes) {
      const maxLife = a.maxLife || a.life || 1;
      const lifeFade = Math.min(1, a.life / Math.min(1.2, maxLife));
      const pulse = 0.9 + 0.1 * Math.sin(t * 5 + a.x * 0.01);
      const r = (a.radius || 40) * pulse;
      const color = a.color || 0x88ff44;

      this.aoeGraphics.fillStyle(color, 0.1 * lifeFade);
      this.aoeGraphics.fillCircle(a.x, a.y, r);
      this.aoeGraphics.fillStyle(color, 0.08 * lifeFade);
      this.aoeGraphics.fillCircle(a.x, a.y, r * 0.62);

      for (let ring = 0; ring < 3; ring++) {
        const rr = r * (0.45 + ring * 0.22);
        const rot = t * (1.2 + ring * 0.4) * (ring % 2 === 0 ? 1 : -1);
        this.aoeGraphics.lineStyle(2 - ring * 0.4, color, (0.55 - ring * 0.12) * lifeFade);
        this.aoeGraphics.beginPath();
        for (let i = 0; i <= 18; i++) {
          const ang = rot + (i / 18) * Math.PI * 2;
          const wobble = 1 + 0.06 * Math.sin(ang * 3 + t * 4);
          const px = a.x + Math.cos(ang) * rr * wobble;
          const py = a.y + Math.sin(ang) * rr * wobble;
          if (i === 0) this.aoeGraphics.moveTo(px, py);
          else this.aoeGraphics.lineTo(px, py);
        }
        this.aoeGraphics.closePath();
        this.aoeGraphics.strokePath();
      }

      // Bolhas tóxicas orbitando
      for (let i = 0; i < 6; i++) {
        const ang = t * 1.6 + (i / 6) * Math.PI * 2;
        const dist = r * (0.35 + 0.45 * ((i % 3) / 2));
        const bx = a.x + Math.cos(ang) * dist;
        const by = a.y + Math.sin(ang * 1.1) * dist * 0.85;
        this.aoeGraphics.fillStyle(color, 0.35 * lifeFade);
        this.aoeGraphics.fillCircle(bx, by, 3 + (i % 3));
      }

      if (this.poisonFx && a.entityId != null) {
        const now = this.time.now;
        const last = this.aoeFxAt.get(a.entityId) || 0;
        if (now - last > 70) {
          this.aoeFxAt.set(a.entityId, now);
          this.poisonFx.emitParticleAt(
            a.x + Phaser.Math.Between(-r * 0.5, r * 0.5),
            a.y + Phaser.Math.Between(-r * 0.4, r * 0.4),
            1
          );
        }
      }
    }
    for (const id of this.aoeFxAt.keys()) {
      if (!(this.state.aoes || []).some((a) => a.entityId === id)) this.aoeFxAt.delete(id);
    }
  }

  effectFade(e) {
    const maxLife = e.maxLife || e.life || 0.3;
    return Math.min(1, Math.max(0, e.life / maxLife));
  }

  effectProgress(e) {
    const maxLife = e.maxLife || e.life || 0.3;
    return 1 - Math.min(1, Math.max(0, e.life / maxLife));
  }

  seededRand(seedRef) {
    seedRef.v = (seedRef.v * 1664525 + 1013904223) >>> 0;
    return seedRef.v / 0xffffffff;
  }

  /** Raio em zigue-zague com brilho (seed estável enquanto o efeito vive). */
  drawLightningBolt(e) {
    const g = this.effectGraphics;
    const x1 = e.x1;
    const y1 = e.y1;
    const x2 = e.x2;
    const y2 = e.y2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const fade = this.effectFade(e);
    const color = e.color || 0xaadfff;
    const branches = e.branches ?? 1;
    const seedRef = {
      v: (e.seed ?? (Math.floor(x1) * 73856093) ^ (Math.floor(y1) * 19349663) ^ (Math.floor(x2) * 83492791)) >>> 0,
    };
    const rand = () => this.seededRand(seedRef);

    const buildBolt = (ax, ay, bx, by, segments, jag) => {
      const pts = [{ x: ax, y: ay }];
      const pdx = bx - ax;
      const pdy = by - ay;
      const plen = Math.hypot(pdx, pdy) || 1;
      const pnx = -pdy / plen;
      const pny = pdx / plen;
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const wobble = (rand() - 0.5) * 2 * jag * (1 - Math.abs(t - 0.5) * 0.4);
        pts.push({
          x: ax + pdx * t + pnx * wobble,
          y: ay + pdy * t + pny * wobble,
        });
      }
      pts.push({ x: bx, y: by });
      return pts;
    };

    const strokeBolt = (pts, width, col, alpha) => {
      g.lineStyle(width, col, alpha * fade);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokePath();
    };

    const segs = Math.max(6, Math.round(len / 22));
    const main = buildBolt(x1, y1, x2, y2, segs, 14);
    const dark = e.dark || color === 0x2a0044 || color === 0x1a001a || color === 0x4a0080;
    const glowA = dark ? 0x120018 : 0x2244aa;
    const glowB = dark ? 0x4a0080 : 0x4488ff;
    const core = dark ? 0x9b4dff : 0xffffff;

    strokeBolt(main, 9, glowA, 0.22);
    strokeBolt(main, 7, glowB, 0.35);
    strokeBolt(main, 4, color, 0.75);
    strokeBolt(main, 2, core, 0.95);

    for (let b = 0; b < branches; b++) {
      const idx = 2 + Math.floor(rand() * Math.max(1, main.length - 4));
      const origin = main[idx];
      const side = rand() < 0.5 ? -1 : 1;
      const blen = 18 + rand() * 28;
      const ang = Math.atan2(dy, dx) + side * (0.6 + rand() * 0.7);
      const bx = origin.x + Math.cos(ang) * blen;
      const by = origin.y + Math.sin(ang) * blen;
      const branch = buildBolt(origin.x, origin.y, bx, by, 3, 6);
      strokeBolt(branch, 3, color, 0.5);
      strokeBolt(branch, 1.5, core, 0.85);
    }

    g.fillStyle(core, 0.65 * fade);
    g.fillCircle(x2, y2, 6 + rand() * 4);
    g.fillStyle(color, 0.45 * fade);
    g.fillCircle(x2, y2, 14);
    g.fillStyle(glowB, 0.3 * fade);
    g.fillCircle(x2, y2, 22);
    g.fillStyle(core, 0.5 * fade);
    g.fillCircle(x1, y1, 4);
  }

  drawPentagram(e) {
    const maxLife = e.maxLife || 2.2;
    const fade = Math.min(1, e.life / maxLife);
    const pulse = 0.85 + 0.15 * Math.sin((maxLife - e.life) * 10);
    const radius = (e.radius || 38) * pulse;
    const color = e.color || 0xffffff;
    const rot = (maxLife - e.life) * 0.55;
    const g = this.effectGraphics;

    g.fillStyle(color, 0.1 * fade);
    g.fillCircle(e.x, e.y, radius);
    g.lineStyle(2.5, color, 0.85 * fade);
    g.strokeCircle(e.x, e.y, radius);
    g.lineStyle(1.5, color, 0.45 * fade);
    g.strokeCircle(e.x, e.y, radius * 0.72);

    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + rot + (i * Math.PI * 2) / 5;
      pts.push({
        x: e.x + Math.cos(a) * radius * 0.88,
        y: e.y + Math.sin(a) * radius * 0.88,
      });
    }

    g.lineStyle(2, color, 0.95 * fade);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= 5; i++) {
      const next = pts[(i * 2) % 5];
      g.lineTo(next.x, next.y);
    }
    g.strokePath();

    g.fillStyle(color, 0.35 * fade);
    g.fillCircle(e.x, e.y, 3);
  }

  drawNova(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xff8844;
    const baseR = e.radius || 80;
    const expand = 0.25 + 0.85 * Math.min(1, p * 1.35);
    const r = baseR * expand;

    g.fillStyle(color, 0.22 * fade * (1 - p * 0.5));
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(0xffee88, 0.12 * fade * (1 - p));
    g.fillCircle(e.x, e.y, r * 0.45);

    for (let i = 0; i < 3; i++) {
      const rr = r * (0.55 + i * 0.2);
      const alpha = (0.75 - i * 0.18) * fade;
      g.lineStyle(3 - i, i === 0 ? 0xffee88 : color, alpha);
      g.strokeCircle(e.x, e.y, rr);
    }

    // Línguas de fogo radiais
    const flames = 10;
    for (let i = 0; i < flames; i++) {
      const ang = (i / flames) * Math.PI * 2 + p * 2.2;
      const len = r * (0.7 + 0.3 * Math.sin(p * 8 + i));
      g.lineStyle(2.5, 0xffaa44, 0.55 * fade);
      g.lineBetween(e.x, e.y, e.x + Math.cos(ang) * len, e.y + Math.sin(ang) * len);
      g.fillStyle(0xffee88, 0.45 * fade);
      g.fillCircle(e.x + Math.cos(ang) * len, e.y + Math.sin(ang) * len, 3);
    }
  }

  drawHeal(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0x55ff88;
    const r = (e.radius || 42) * (0.7 + 0.3 * Math.sin(p * Math.PI));

    g.fillStyle(color, 0.12 * fade);
    g.fillCircle(e.x, e.y, r);
    g.lineStyle(2, color, 0.7 * fade);
    g.strokeCircle(e.x, e.y, r * (0.6 + 0.4 * p));

    // Cruzes de cura subindo
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + p * 1.5;
      const orbit = 16 + i * 4;
      const cx = e.x + Math.cos(ang) * orbit;
      const cy = e.y + Math.sin(ang) * orbit - p * 28;
      const s = 5 + (i % 2) * 2;
      g.lineStyle(2.5, 0xffffff, 0.85 * fade);
      g.lineBetween(cx - s, cy, cx + s, cy);
      g.lineBetween(cx, cy - s, cx, cy + s);
      g.lineStyle(1.5, color, 0.9 * fade);
      g.lineBetween(cx - s, cy, cx + s, cy);
      g.lineBetween(cx, cy - s, cx, cy + s);
    }

    g.fillStyle(0xffffff, 0.35 * fade);
    g.fillCircle(e.x, e.y, 4);
  }

  drawBarrier(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0x88aaff;
    const r = (e.radius || 40) * (0.85 + 0.2 * p);
    const rot = p * 2.4;

    g.fillStyle(color, 0.14 * fade);
    g.fillCircle(e.x, e.y, r);
    g.lineStyle(3, color, 0.85 * fade);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(1.5, 0xffffff, 0.45 * fade);
    g.strokeCircle(e.x, e.y, r * 0.78);

    // Hexágono rúnico
    g.lineStyle(2, 0xffffff, 0.7 * fade);
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = rot + (i / 6) * Math.PI * 2;
      const px = e.x + Math.cos(a) * r * 0.72;
      const py = e.y + Math.sin(a) * r * 0.72;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();

    for (let i = 0; i < 6; i++) {
      const a = rot + (i / 6) * Math.PI * 2;
      g.fillStyle(0xffffff, 0.55 * fade);
      g.fillCircle(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 2.5);
    }
  }

  drawBlink(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xaa88ff;
    const phase = e.phase || 'in';
    const expand = phase === 'out' ? 1 + p * 0.8 : Math.max(0.15, 1 - p);
    const r = (e.radius || 36) * expand;

    g.fillStyle(color, 0.18 * fade);
    g.fillCircle(e.x, e.y, r);
    g.lineStyle(3, color, 0.8 * fade);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(1.5, 0xffffff, 0.55 * fade);
    g.strokeCircle(e.x, e.y, r * 0.55);

    // Portal em espiral
    g.lineStyle(2, 0xffffff, 0.4 * fade);
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = t * Math.PI * 4 + p * 6;
      const rr = r * (0.15 + 0.75 * t);
      const px = e.x + Math.cos(a) * rr;
      const py = e.y + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();

    if (e.x2 != null && e.y2 != null && phase === 'out') {
      g.lineStyle(2, color, 0.35 * fade * (1 - p));
      g.lineBetween(e.x, e.y, e.x2, e.y2);
    }
  }

  drawImpact(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xffffff;
    const r = (e.radius || 24) * (0.4 + 0.9 * p);
    const spell = e.spellId || '';

    g.fillStyle(color, 0.28 * fade * (1 - p));
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(0xffffff, 0.35 * fade * (1 - p));
    g.fillCircle(e.x, e.y, r * 0.35);
    g.lineStyle(2.5, color, 0.7 * fade);
    g.strokeCircle(e.x, e.y, r);

    const rays = spell === 'ice_shard' ? 8 : 10;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + p;
      const len = r * (0.7 + 0.5 * p);
      g.lineStyle(2, spell === 'ice_shard' ? 0xffffff : color, 0.55 * fade);
      g.lineBetween(
        e.x + Math.cos(a) * r * 0.2,
        e.y + Math.sin(a) * r * 0.2,
        e.x + Math.cos(a) * len,
        e.y + Math.sin(a) * len
      );
    }
  }

  drawFreeze(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xaaddff;
    const r = (e.radius || 200) * (0.35 + 0.65 * Math.min(1, p * 1.6));
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);

    g.fillStyle(color, 0.1 * fade);
    g.fillCircle(e.x, e.y, r);
    g.lineStyle(3, color, 0.7 * fade);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(1.5, 0xffffff, 0.4 * fade);
    g.strokeCircle(e.x, e.y, r * 0.7);

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + p * 0.4;
      const len = r * (0.55 + rand() * 0.4);
      g.lineStyle(2, 0xffffff, 0.55 * fade);
      g.lineBetween(e.x, e.y, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len);
      // Cristais nas pontas
      const cx = e.x + Math.cos(a) * len;
      const cy = e.y + Math.sin(a) * len;
      g.fillStyle(0xffffff, 0.7 * fade);
      g.fillTriangle(
        cx,
        cy - 6,
        cx - 4,
        cy + 4,
        cx + 4,
        cy + 4
      );
    }

    // Flocos
    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2;
      const d = r * (0.2 + rand() * 0.7);
      g.fillStyle(0xffffff, 0.45 * fade);
      g.fillCircle(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 2);
    }
  }

  drawApocalypse(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xff2200;
    const r = e.radius || 200;
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);

    // Chão em brasa
    g.fillStyle(color, 0.16 * fade);
    g.fillCircle(e.x, e.y, r * (0.5 + 0.5 * Math.min(1, p * 1.2)));
    g.lineStyle(3, 0xff6600, 0.65 * fade);
    g.strokeCircle(e.x, e.y, r * Math.min(1, p * 1.3));

    // Meteoros caindo
    const meteors = 7;
    for (let i = 0; i < meteors; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = r * (0.15 + rand() * 0.75);
      const tx = e.x + Math.cos(ang) * dist;
      const ty = e.y + Math.sin(ang) * dist;
      const fall = Math.min(1, Math.max(0, (p - i * 0.08) * 2.2));
      const sx = tx - 40;
      const sy = ty - 120 + fall * 120;
      g.lineStyle(3, 0xffaa33, 0.7 * fade * fall);
      g.lineBetween(sx, sy - 28, tx, ty);
      g.fillStyle(0xffee88, 0.8 * fade * fall);
      g.fillCircle(sx, sy - 28, 5);
      g.fillStyle(color, 0.45 * fade * fall);
      g.fillCircle(tx, ty, 8 + fall * 10);
      g.lineStyle(2, 0xff8800, 0.5 * fade * fall);
      g.strokeCircle(tx, ty, 16 * fall);
    }

    // Rachaduras
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const len = r * (0.4 + rand() * 0.5) * Math.min(1, p * 1.4);
      g.lineStyle(2, 0xff4400, 0.4 * fade);
      g.lineBetween(e.x, e.y, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len);
    }
  }

  drawStorm(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xffdd33;
    const r = (e.radius || 320) * (0.4 + 0.6 * Math.min(1, p * 1.5));

    g.fillStyle(0x224466, 0.12 * fade);
    g.fillCircle(e.x, e.y, r);
    g.lineStyle(2, color, 0.45 * fade);
    g.strokeCircle(e.x, e.y, r);

    // Nuvem de tempestade
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + p * 3;
      const cx = e.x + Math.cos(a) * 28;
      const cy = e.y - 36 + Math.sin(a * 2) * 6;
      g.fillStyle(0x556688, 0.35 * fade);
      g.fillEllipse(cx, cy, 36, 16);
    }
    g.fillStyle(color, 0.25 * fade);
    g.fillCircle(e.x, e.y - 36, 8);
  }

  drawPoisonBurst(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0x88ff44;
    const r = (e.radius || 90) * (0.3 + 0.7 * p);

    g.fillStyle(color, 0.2 * fade * (1 - p * 0.4));
    g.fillCircle(e.x, e.y, r);
    for (let i = 0; i < 3; i++) {
      g.lineStyle(2, color, (0.6 - i * 0.15) * fade);
      g.strokeCircle(e.x, e.y, r * (0.5 + i * 0.2));
    }
  }

  /** Círculo de atenção + meteoro descendo do céu. */
  drawMeteorWarn(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xff4422;
    const r = e.radius || 78;
    const pulse = 0.85 + 0.15 * Math.sin(this.time.now / 90);
    const flash = 0.55 + 0.45 * Math.sin(this.time.now / 55);
    // Nos últimos 25% do aviso, o chão “aquece” mais
    const imminent = Math.max(0, (p - 0.75) / 0.25);

    g.fillStyle(color, (0.12 + 0.14 * imminent) * fade * pulse);
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(0xffaa33, (0.06 + 0.12 * imminent) * fade * flash);
    g.fillCircle(e.x, e.y, r * 0.55);

    // Sombra projetada no chão (cresce conforme o meteoro se aproxima)
    const shadowR = 10 + p * 22;
    g.fillStyle(0x1a0500, (0.25 + 0.45 * p) * fade);
    g.fillEllipse(e.x, e.y + 4, shadowR * 1.6, shadowR * 0.7);

    g.lineStyle(3.5, color, (0.75 + 0.2 * imminent) * fade * flash);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(2, 0xffee88, 0.55 * fade);
    g.strokeCircle(e.x, e.y, r * 0.78);

    const remain = Math.max(0.05, 1 - p);
    g.lineStyle(4, 0xffffff, 0.8 * fade);
    g.beginPath();
    g.arc(e.x, e.y, r * 0.92, -Math.PI / 2, -Math.PI / 2 + remain * Math.PI * 2, false);
    g.strokePath();

    // Arco rotativo único (mais leve que 3 arcs/frame)
    const a0 = this.time.now / 280;
    g.lineStyle(2.5, 0xffcc66, 0.65 * fade);
    g.beginPath();
    g.arc(e.x, e.y, r * 1.06, a0, a0 + 0.9, false);
    g.strokePath();

    g.lineStyle(2, 0xffffff, 0.7 * fade * flash);
    g.lineBetween(e.x - r * 0.35, e.y, e.x + r * 0.35, e.y);
    g.lineBetween(e.x, e.y - r * 0.35, e.x, e.y + r * 0.35);
    g.strokeCircle(e.x, e.y, 8);

    // Meteoro em queda durante o aviso
    const pose = this.meteorFallPose(e, p);
    const scale = 0.85 + pose.t * 0.85;

    // Cauda de fogo
    const tailLen = 40 + pose.t * 90;
    const dx = 95;
    const dy = 312;
    const tlen = Math.hypot(dx, dy) || 1;
    const backX = pose.x - (dx / tlen) * tailLen;
    const backY = pose.y - (dy / tlen) * tailLen;

    g.lineStyle(12 * scale, 0xff3300, 0.28 * fade);
    g.lineBetween(backX, backY, pose.x, pose.y);
    g.lineStyle(5 * scale, 0xffee88, 0.7 * fade);
    g.lineBetween(
      backX + (pose.x - backX) * 0.35,
      backY + (pose.y - backY) * 0.35,
      pose.x,
      pose.y
    );

    // Faíscas ao longo da cauda
    for (let i = 0; i < 3; i++) {
      const tt = 0.25 + i * 0.22;
      const fx = backX + (pose.x - backX) * tt + Math.sin(this.time.now / 40 + i) * 4;
      const fy = backY + (pose.y - backY) * tt + Math.cos(this.time.now / 35 + i) * 3;
      g.fillStyle(i % 2 ? 0xffee88 : 0xff6600, (0.5 - i * 0.08) * fade);
      g.fillCircle(fx, fy, (3.2 - i * 0.4) * scale);
    }

    this.drawMeteorBody(g, pose.x, pose.y, scale, fade, true);
    this.emitMeteorTrail(e.entityId ?? `${e.x},${e.y}`, pose.x, pose.y, 1 + Math.floor(pose.t * 2));
  }

  /** Impacto: explosão, onda de choque e crater. */
  drawMeteorStrike(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xff2200;
    const r = e.radius || 78;
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);

    // Flash inicial
    const flash = Math.max(0, 1 - p * 3.2);
    if (flash > 0) {
      g.fillStyle(0xffffff, 0.55 * flash * fade);
      g.fillCircle(e.x, e.y, r * (0.4 + flash * 0.5));
      g.fillStyle(0xffee88, 0.35 * flash * fade);
      g.fillCircle(e.x, e.y, r * (0.8 + flash * 0.4));
    }

    // Cratera / solo em brasa
    const groundR = r * (0.75 + 0.35 * Math.min(1, p * 1.6));
    g.fillStyle(0x2a0a00, 0.45 * fade);
    g.fillCircle(e.x, e.y, groundR * 0.85);
    g.fillStyle(color, 0.32 * fade * (1 - p * 0.35));
    g.fillCircle(e.x, e.y, groundR);
    g.fillStyle(0xff8800, 0.18 * fade * (1 - p * 0.5));
    g.fillCircle(e.x, e.y, groundR * 0.55);
    g.lineStyle(3, 0xffaa44, 0.75 * fade);
    g.strokeCircle(e.x, e.y, groundR);

    // Ondas de choque
    for (let i = 0; i < 3; i++) {
      const wave = Math.min(1.4, p * 1.8 + i * 0.18);
      const wr = r * (0.35 + wave * 0.9);
      const wa = (0.7 - i * 0.18) * fade * Math.max(0, 1 - wave * 0.65);
      g.lineStyle(3.5 - i, i === 0 ? 0xffffff : 0xffaa33, wa);
      g.strokeCircle(e.x, e.y, wr);
    }

    // Coluna de fogo
    const columnH = 30 + (1 - p) * 70;
    g.fillStyle(0xff4400, 0.35 * fade * (1 - p * 0.4));
    g.fillEllipse(e.x, e.y - columnH * 0.35, 28 * (1 - p * 0.3), columnH);
    g.fillStyle(0xffcc44, 0.4 * fade * (1 - p * 0.5));
    g.fillEllipse(e.x, e.y - columnH * 0.4, 14, columnH * 0.75);
    g.fillStyle(0xffffff, 0.35 * fade * Math.max(0, 1 - p * 2));
    g.fillEllipse(e.x, e.y - columnH * 0.45, 6, columnH * 0.4);

    // Fragmentos de rocha
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rand() * 0.4;
      const dist = r * (0.25 + rand() * 0.7) * Math.min(1.1, p * 1.7);
      const fx = e.x + Math.cos(a) * dist;
      const fy = e.y + Math.sin(a) * dist * 0.85 - (1 - p) * 12 * rand();
      const sz = 2.5 + rand() * 4;
      g.fillStyle(i % 2 ? 0x6b4423 : 0x3d2818, 0.85 * fade * (1 - p * 0.3));
      g.fillCircle(fx, fy, sz);
    }

    // Raios de explosão
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + p * 0.8;
      const len = r * (0.5 + 0.7 * Math.min(1, p * 1.4)) * (0.7 + (i % 3) * 0.12);
      g.lineStyle(i % 2 ? 3 : 2, i % 3 === 0 ? 0xffee88 : color, 0.65 * fade * (1 - p * 0.4));
      g.lineBetween(
        e.x + Math.cos(a) * 8,
        e.y + Math.sin(a) * 8,
        e.x + Math.cos(a) * len,
        e.y + Math.sin(a) * len
      );
    }

    // Rachaduras no chão
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.35;
      const len = r * (0.4 + (i % 3) * 0.15) * Math.min(1, 0.4 + p);
      g.lineStyle(2, 0xff3300, 0.45 * fade);
      const midX = e.x + Math.cos(a) * len * 0.55;
      const midY = e.y + Math.sin(a) * len * 0.55;
      g.lineBetween(e.x, e.y, midX, midY);
      g.lineBetween(midX, midY, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len);
    }

    // Núcleo do impacto + rocha afundando
    const sink = Math.min(1, p * 1.3);
    this.drawMeteorBody(g, e.x, e.y + sink * 6, 1.35 - sink * 0.35, fade * (1 - sink * 0.4), true);
    g.fillStyle(0xffffff, 0.5 * fade * Math.max(0, 1 - p * 1.8));
    g.fillCircle(e.x, e.y, 22 * Math.max(0.2, 1 - p));

    // Brasas contínuas (mais espaçadas para não saturar o emitter)
    if (this.meteorFx && p < 0.7) {
      const id = `strike:${e.entityId ?? `${e.x},${e.y}`}`;
      const now = this.time.now;
      const last = this.meteorTrailAt.get(id) || 0;
      if (now - last > 70) {
        this.meteorTrailAt.set(id, now);
        this.meteorFx.setEmitterAngle({ min: 220, max: 320 });
        this.meteorFx.setParticleSpeed({ min: 50, max: 140 });
        this.meteorFx.emitParticleAt(
          e.x + Phaser.Math.Between(-r * 0.3, r * 0.3),
          e.y + Phaser.Math.Between(-6, 6),
          2
        );
      }
    }
  }

  renderEffects() {
    this.effectGraphics.clear();
    const seenBlood = new Set();
    const seenBones = new Set();
    const activeBursts = new Set();

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

      const burstKey = `${e.type}:${e.spellId || ''}:${Math.round(e.x)}:${Math.round(e.y)}:${e.seed ?? 0}:${e.phase || ''}`;
      if (
        e.type === 'impact' ||
        e.type === 'nova' ||
        e.type === 'heal' ||
        e.type === 'blink' ||
        e.type === 'barrier' ||
        e.type === 'freeze' ||
        e.type === 'apocalypse' ||
        e.type === 'storm' ||
        e.type === 'poison_burst' ||
        e.type === 'lightning' ||
        e.type === 'meteor_strike'
      ) {
        activeBursts.add(burstKey);
        this.burstOnce(burstKey, () => this.burstSpellParticles(e));
      }

      if (e.type === 'pentagram') {
        this.drawPentagram(e);
      } else if (e.type === 'lightning') {
        this.drawLightningBolt(e);
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
      } else if (e.type === 'nova') {
        this.drawNova(e);
      } else if (e.type === 'heal') {
        this.drawHeal(e);
      } else if (e.type === 'barrier') {
        this.drawBarrier(e);
      } else if (e.type === 'blink') {
        this.drawBlink(e);
      } else if (e.type === 'impact') {
        this.drawImpact(e);
      } else if (e.type === 'freeze') {
        this.drawFreeze(e);
      } else if (e.type === 'apocalypse') {
        this.drawApocalypse(e);
      } else if (e.type === 'meteor_warn') {
        this.drawMeteorWarn(e);
      } else if (e.type === 'meteor_strike') {
        this.drawMeteorStrike(e);
      } else if (e.type === 'storm') {
        this.drawStorm(e);
      } else if (e.type === 'poison_burst') {
        this.drawPoisonBurst(e);
      }
    }

    this.pruneBurstSeen(activeBursts);

    // Limpa trails de meteoros inativos (uma passagem O(n))
    if (this.meteorTrailAt.size) {
      const alive = new Set();
      for (const e of this.state.effects || []) {
        if (e.type === 'meteor_warn' || e.type === 'meteor_strike') {
          const id = String(e.entityId ?? `${e.x},${e.y}`);
          alive.add(id);
          if (e.type === 'meteor_strike') alive.add(`strike:${id}`);
        }
      }
      for (const key of this.meteorTrailAt.keys()) {
        if (!alive.has(key)) this.meteorTrailAt.delete(key);
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

    const showShield = me.alive && me.shield > 0;
    if (showShield) {
      const maxShield = me.maxShield > 0 ? me.maxShield : me.shield;
      const shieldRatio = Math.min(1, me.shield / maxShield);
      this.shieldBarBg.setVisible(true);
      this.shieldBar.setVisible(true);
      this.shieldBar.width = 220 * shieldRatio;
      this.shieldText
        .setVisible(true)
        .setText(`ESCUTO ${Math.ceil(me.shield)} / ${Math.ceil(maxShield)}`);
    } else {
      this.shieldBarBg.setVisible(false);
      this.shieldBar.setVisible(false);
      this.shieldText.setVisible(false);
    }

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

    // Spells (máx. 3 básicas)
    for (let i = 0; i < 3; i++) {
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
    const ultSlot = this.spellSlots[3];
    const ultSelected = this.selectedSpellSlot === 3;
    if (!ult) {
      ultSlot.name.setText('Ult');
      ultSlot.cd.setText('');
      ultSlot.icon.setVisible(false);
      ultSlot.bg.setStrokeStyle(ultSelected ? 3 : 2, ultSelected ? 0xffffff : 0x443866);
      ultSlot.bg.setFillStyle(ultSelected ? 0x2a2250 : 0x1a1430, 0.95);
    } else {
      this.setSpellSlotIcon(ultSlot, ult.id || ult.stats?.id);
      ultSlot.name.setText('ult');
      ultSlot.cd.setText(ult.usedThisRound ? 'X' : 'OK');
      ultSlot.icon.setAlpha(ult.usedThisRound ? 0.4 : 1);
      ultSlot.bg.setStrokeStyle(ultSelected ? 3 : 2, ultSelected ? 0xffffff : ult.stats.color || 0xffaa33);
      ultSlot.bg.setFillStyle(ultSelected ? 0x2a2250 : 0x1a1430, 0.95);
    }

    // Slot depois do ultimate (4): cooldown do dash
    const dashSlot = this.spellSlots[4];
    const dashCd = me.dashCooldown || 0;
    const dashing = !!me.dashing;
    this.setSpellSlotIcon(dashSlot, 'dash');
    dashSlot.name.setText(dashing ? 'dash!' : 'dash');
    dashSlot.cd.setText(dashCd > 0 ? dashCd.toFixed(1) : '');
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
    } else if (
      this.state.phase === 'playing' &&
      this.bannerText.alpha > 0 &&
      !this.levelUpOpen &&
      !this.levelUpWaitOpen
    ) {
      this.bannerText.setAlpha(Math.max(0, this.bannerText.alpha - 0.02));
    }
  }

  choicesKey(choices, choiceSetId, pendingLevelUps = 0) {
    const base =
      choiceSetId != null
        ? `set:${choiceSetId}`
        : (choices || [])
            .map((c) => `${c.kind}:${c.spellId}:${c.fromLevel ?? ''}:${c.toLevel ?? ''}`)
            .join('|');
    return `${base}#${pendingLevelUps}`;
  }

  playersChoosingSpells() {
    return (this.state?.players || []).filter((p) => p.alive && p.pendingLevelUps > 0);
  }

  updateLevelUpUi() {
    const me = this.me();
    if (!me || !this.state) return;

    if (this.state.phase !== 'levelup') {
      if (this.levelUpOpen || this.levelUpWaitOpen) this.hideLevelUp();
      return;
    }

    const choices = me.spellChoices;
    const needs = me.pendingLevelUps > 0 && choices?.length;

    if (!needs) {
      this.levelUpSubmitting = false;
      this.levelUpSubmittedKey = null;
      this.levelUpChoiceKey = null;
      this.levelUpChoices = [];
      this.showLevelUpWait();
      return;
    }

    const key = this.choicesKey(choices, me.choiceSetId, me.pendingLevelUps);

    // Aguardando confirmação do servidor
    if (this.levelUpSubmitting) {
      if (key !== this.levelUpSubmittedKey) {
        // Novo pacote chegou (ou falha re-rollou) — libera e redesenha
        this.levelUpSubmitting = false;
        this.levelUpSubmittedKey = null;
        this.showLevelUp(choices, key);
      } else if (this.time.now - this.levelUpSubmitAt > 2500) {
        // Timeout: redesenha o mesmo pacote para permitir nova tentativa
        this.levelUpSubmitting = false;
        this.levelUpSubmittedKey = null;
        this.showLevelUp(choices, key);
      }
      return;
    }

    if (!this.levelUpOpen || this.levelUpWaitOpen || key !== this.levelUpChoiceKey) {
      this.showLevelUp(choices, key);
    } else {
      this.updateLevelUpSlotHint();
    }
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

  cycleSpellSlot() {
    this.selectedSpellSlot = (this.selectedSpellSlot + 1) % 4;
  }

  updateLevelUpSlotHint() {
    if (!this.levelUpHint || this.levelUpSubmitting) return;
    const slot = this.selectedSpellSlot + 1;
    const me = this.me();
    const timeLeft = me?.choiceTimeLeft;
    const timer =
      timeLeft != null ? `  ·  auto em ${Math.ceil(timeLeft)}s` : '';
    this.levelUpHint.setText(
      `Pressione 1 · 2 · 3 · 4 para escolher  ·  Tab: slot ${slot} → ${(slot % 4) + 1}${timer}`
    );
  }

  submitLevelUpChoice(index) {
    if (this.levelUpSubmitting || !this.levelUpOpen) return;
    const me = this.me();
    const choice = this.levelUpChoices[index];
    if (!me || !choice || !me.choiceSetId) return;

    this.levelUpSubmitting = true;
    this.levelUpSubmitAt = this.time.now;
    this.levelUpSubmittedKey = this.levelUpChoiceKey;

    for (let i = 0; i < this.choiceCards.length; i++) {
      const card = this.choiceCards[i];
      card.disableInteractive();
      card.setAlpha(i === index ? 1 : 0.4);
      if (i === index && card.list?.[0]) {
        card.list[0].setStrokeStyle(3, 0xffffff);
      }
    }
    if (this.levelUpHint) {
      this.levelUpHint.setText('Confirmando escolha…');
    }

    this.socket.emit('choose_spell', {
      index,
      spellId: choice.spellId,
      kind: choice.kind,
      fromLevel: choice.fromLevel,
      choiceSetId: me.choiceSetId,
    });
  }

  fadeInLevelUpOverlay(targets, dimTargetAlpha = 0.7) {
    for (const obj of targets) {
      if (!obj || obj === this.levelUpDim) continue;
      const to = obj.alpha ?? 1;
      obj.setAlpha(0);
      this.tweens.add({
        targets: obj,
        alpha: to,
        duration: 320,
        ease: 'Cubic.Out',
        delay: 80,
      });
    }
    if (this.levelUpDim) {
      this.levelUpDim.setAlpha(0);
      this.tweens.add({
        targets: this.levelUpDim,
        alpha: dimTargetAlpha,
        duration: 380,
        ease: 'Cubic.Out',
      });
    }
  }

  clearLevelUpLayer() {
    if (this.levelUpLayer) {
      for (const child of this.levelUpLayer.list.slice()) {
        this.tweens.killTweensOf(child);
      }
      this.levelUpLayer.removeAll(true);
    }
    this.levelUpDim = null;
    this.levelUpHint = null;
    this.levelUpWaitText = null;
    this.choiceCards = [];
  }

  levelUpWaitMessage(choosers) {
    const names = choosers
      .map((p) => {
        const pts = p.pendingLevelUps || 0;
        return pts > 1 ? `${p.name} (${pts} pts)` : p.name;
      })
      .join(', ');
    const maxLeft = Math.max(
      0,
      ...choosers.map((p) => (p.choiceTimeLeft != null ? p.choiceTimeLeft : 0))
    );
    const hasTimer = choosers.some((p) => p.choiceTimeLeft != null);
    const timerLine = hasTimer ? `\nAuto em ${Math.ceil(maxLeft)}s` : '';
    if (!names) return `Jogador distribuindo pontos de habilidade, aguarde!${timerLine}`;
    return `${choosers.length > 1 ? 'Jogadores' : 'Jogador'} distribuindo pontos de habilidade, aguarde!\n${names}${timerLine}`;
  }

  showLevelUpWait() {
    const choosers = this.playersChoosingSpells();
    const waitKey =
      choosers.map((p) => `${p.id}:${p.pendingLevelUps || 0}`).sort().join(',') || 'none';
    if (this.levelUpWaitOpen && this.levelUpChoiceKey === `wait:${waitKey}`) {
      if (this.levelUpWaitText) {
        this.levelUpWaitText.setText(this.levelUpWaitMessage(choosers));
      }
      return;
    }

    this.levelUpOpen = false;
    this.levelUpWaitOpen = true;
    this.levelUpSubmitting = false;
    this.levelUpChoiceKey = `wait:${waitKey}`;
    this.levelUpChoices = [];
    this.clearLevelUpLayer();
    this.levelUpLayer.setVisible(true);

    const { width, height } = this.scale;
    this.levelUpDim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 1)
      .setInteractive();

    const title = this.add
      .text(width / 2, height / 2 - 24, 'PAUSA', {
        fontFamily: 'Georgia, serif',
        fontSize: '34px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    this.levelUpWaitText = this.add
      .text(width / 2, height / 2 + 28, this.levelUpWaitMessage(choosers), {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '20px',
        color: '#e8dfff',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    this.levelUpLayer.add([this.levelUpDim, title, this.levelUpWaitText]);
    this.fadeInLevelUpOverlay([title, this.levelUpWaitText], 0.72);
  }

  showLevelUp(choices, key = null) {
    const me = this.me();
    this.levelUpOpen = true;
    this.levelUpWaitOpen = false;
    this.levelUpSubmitting = false;
    this.levelUpChoices = choices || [];
    this.levelUpChoiceKey =
      key ?? this.choicesKey(choices, me?.choiceSetId, me?.pendingLevelUps || 0);
    this.clearLevelUpLayer();
    this.levelUpLayer.setVisible(true);

    const { width, height } = this.scale;
    this.levelUpDim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 1)
      .setInteractive();
    const remaining = this.me()?.pendingLevelUps || 1;
    const titleText =
      remaining > 1
        ? `SUBIU DE NÍVEL — ${remaining} pontos de habilidade`
        : 'SUBIU DE NÍVEL — 1 ponto de habilidade';
    const title = this.add
      .text(width / 2, 120, titleText, {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);
    this.levelUpHint = this.add
      .text(width / 2, 158, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#a99bc8',
      })
      .setOrigin(0.5);
    this.updateLevelUpSlotHint();

    this.levelUpLayer.add([this.levelUpDim, title, this.levelUpHint]);

    const fadeTargets = [title, this.levelUpHint];

    choices.forEach((choice, i) => {
      const x = width / 2 + (i - (choices.length - 1) / 2) * 270;
      const y = height / 2 + 30;
      const card = this.add.container(x, y);
      const stroke = choice.kind === 'upgrade' ? 0xf1c40f : choice.def?.color || 0x6b5cff;
      const bg = this.add.rectangle(0, 0, 240, 300, 0x1a1430, 0.98).setStrokeStyle(2, stroke);
      const keyHint = this.add
        .text(-100, -132, `${i + 1}`, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#2a2250',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5);
      const badge = this.add
        .text(0, -128, choice.label || (choice.kind === 'upgrade' ? 'UPGRADE' : 'NOVA'), {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '12px',
          color: choice.kind === 'upgrade' ? '#f1c40f' : '#a99bc8',
        })
        .setOrigin(0.5);

      const iconKey = this.spellIconKey(choice.spellId || choice.def?.id);
      const iconBg = this.add.rectangle(0, -68, 72, 72, 0x0e0a1a, 0.95).setStrokeStyle(2, stroke);
      const icon =
        iconKey && this.textures.exists(iconKey)
          ? this.add.image(0, -68, iconKey).setScale(2)
          : this.add.circle(0, -68, 20, choice.def?.color || 0x6b5cff, 0.9);

      const name = this.add
        .text(0, -12, choice.def?.name || choice.spellId, {
          fontFamily: 'Georgia, serif',
          fontSize: '20px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      const desc = this.add
        .text(0, 48, choice.def?.description || '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '13px',
          color: '#c4b5e0',
          align: 'center',
          wordWrap: { width: 210 },
        })
        .setOrigin(0.5);
      const meta = this.add
        .text(
          0,
          120,
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

      card.add([bg, keyHint, badge, iconBg, icon, name, desc, meta]);
      card.setSize(240, 300);
      // Escolha só por hotkeys 1–4 (sem clique)
      this.levelUpLayer.add(card);
      this.choiceCards.push(card);
      fadeTargets.push(card);
    });

    this.fadeInLevelUpOverlay(fadeTargets, 0.7);
  }

  hideLevelUp() {
    const layer = this.levelUpLayer;
    const kids = layer?.visible ? layer.list.slice() : [];
    this.levelUpOpen = false;
    this.levelUpWaitOpen = false;
    this.levelUpSubmitting = false;
    this.levelUpChoiceKey = null;
    this.levelUpSubmittedKey = null;
    this.levelUpChoices = [];
    this.levelUpHint = null;
    this.levelUpWaitText = null;
    this.choiceCards = [];
    this.levelUpDim = null;

    if (!layer?.visible) return;

    if (kids.length) {
      for (const child of kids) this.tweens.killTweensOf(child);
      this.tweens.add({
        targets: kids,
        alpha: 0,
        duration: 220,
        ease: 'Cubic.In',
        onComplete: () => {
          // Só limpa se nenhum novo overlay foi aberto no meio tempo
          if (!this.levelUpOpen && !this.levelUpWaitOpen) {
            this.clearLevelUpLayer();
            layer.setVisible(false);
          }
        },
      });
    } else {
      this.clearLevelUpLayer();
      layer.setVisible(false);
    }
  }
}
