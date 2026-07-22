import Phaser from 'phaser';
import { getSocket } from '../net/socket.js';
import { navigate } from '../router.js';
import { monsterLabel as monsterLabelOf } from '../catalog/monsterLabels.js';
import { spellDisplayName } from '../catalog/galleryCatalog.js';
import {
  spellElementIconKey,
  spellElementLabel,
  spellElementColor,
} from '../catalog/spellElements.js';
import {
  getCombatStatusEffect,
  getFloorStatusEffect,
  getGaleStatusEffect,
  getLavaStatusEffect,
  PLAYER_RADIUS,
} from '../catalog/statusEffects.js';
import { stopMenuMusic, getMenuMusicVolume } from '../audio/menuMusic.js';
import { ensureWizardColorTexture } from '../wizardSkin.js';
import { ensureCharacter, saveCharacter } from '../character.js';
import { addItemToBag, createItem, normalizeInventory, firstEmptyBagIndex } from '../inventory.js';

/** Parede mágica circular na borda da arena (só visual). */
const ARENA_BORDER_FX_ENABLED = true;

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
    this.treeSprites = new Map();
    this.bloodSprites = new Map();
    this.boneSprites = new Map();
    this.lootBagSprites = new Map();
    this.coinSprites = new Map();
    this.localCorpses = [];
    this.aoeGraphics = null;
    this.arenaGraphics = null;
    this.effectGraphics = null;
    this.levelUpOpen = false;
    this.levelUpSubmitting = false;
    this.levelUpSubmitAt = 0;
    this.levelUpChoiceKey = null;
    this.levelUpSubmittedKey = null;
    this.levelUpChoices = [];
    this.choiceCards = [];
    this.levelUpHint = null;
    this.levelUpCountdown = null;
    this.levelUpPointsText = null;
    this.disconnectConfirmOpen = false;
    this.leaving = false;
    this.matchEndOpen = false;
    this.lavaFx = [];
    this.selectedSpellSlot = 0;
    this.moveDust = null;
    this.lavaBurn = null;
    this.arenaFireWall = null;
    this.arenaFireEmbers = null;
    this.conjureFx = null;
    this.conjureEmbers = null;
    this.arenaIronSprites = [];
    this.fireballFx = null;
    this.iceFx = null;
    this.healFx = null;
    this.mistFx = null;
    this.windFx = null;
    this.poisonFx = null;
    this.necroFx = null;
    this.sparkFx = null;
    this.magicFx = null;
    this.meteorFx = null;
    this.meteorTrailAt = new Map();
    this.burstSeen = new Set();
    this.aoeFxAt = new Map();
    this.dashGhosts = [];
    this.pendingBarrier = false;
    this.pendingMend = false;
    this.pendingBlink = false;
    /** Direção de dash pendente até o próximo emit (evita perder toques curtos). */
    this.pendingDash = null;
    this.lastHurtSoundAt = 0;
    this.battleMusic = null;
    /** Key da faixa de combate atual (`battle_music_*` ou `boss_music`). */
    this.battleMusicKey = null;
    this.aimCursor = null;
    /** Ordenação do placar: 'damage' | 'kills' */
    this.scoreboardSort = 'damage';
    /** Labels de magia não-projétil acima de jogadores/bots/mobs. */
    this.spellCastLabels = [];
    /** Spotlight de abertura de round (preto + foco no jogador). */
    this.roundSpotlight = null;
    this.roundSpotlightBg = null;
    this.roundSpotlightHole = null;
    this.roundSpotlightRim = null;
    this.roundSpotlightMask = null;
    /** Tipo de chão já exibido (para crossfade entre rounds). */
    this.displayedFloorType = null;
    this.floorTransition = null;
    /** Notificações de loot coletado (fila com fade). */
    this.lootNotifications = [];
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
    this.arenaFloorMask = this.arenaMaskGfx.createGeometryMask();
    this.arenaFloor.setMask(this.arenaFloorMask);
    this.arenaFloorNext = this.add
      .tileSprite(640, 360, 640, 640, 'arena_brick')
      .setDepth(0)
      .setAlpha(0);
    this.arenaFloorNext.setMask(this.arenaFloorMask);

    this.arenaGraphics = this.add.graphics().setDepth(1);
    // Acima do chão/rochas, abaixo dos jogadores — AoEs (veneno/fogo) bem visíveis
    this.aoeGraphics = this.add.graphics().setDepth(12);
    this.effectGraphics = this.add.graphics().setDepth(14);
    this.createMoveDust();
    this.createLavaBurn();
    this.createArenaFireWall();
    this.createConjureFx();
    this.createSpellParticleFx();

    this.createHud();
    this.createDisconnectUi();
    this.createMatchEndUi();
    this.createRoundSpotlight();
    this.setupAimCursor();
    this.cursors = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      /** Escudo inato — tecla própria (não usa D, que é andar para a direita). */
      barrier: Phaser.Input.Keyboard.KeyCodes.E,
      /** Heal inato. */
      mend: Phaser.Input.Keyboard.KeyCodes.H,
      /** Blink inato. */
      blink: Phaser.Input.Keyboard.KeyCodes.B,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      tab: Phaser.Input.Keyboard.KeyCodes.TAB,
    });

    this.selectedSpellSlot = 0;
    this.input.keyboard.addCapture('TAB');
    this.input.keyboard.on('keydown', this.onDashKeyDown, this);
    this.input.keyboard.on('keydown-ESC', this.onEscapeKey, this);
    this.input.keyboard.on('keydown-ENTER', this.onDisconnectEnterKey, this);

    this.input.on('wheel', (_pointer, _gos, _dx, dy) => {
      if (this.onMatchEndKillWheel(dy)) return;
      this.onSpellSlotWheel(dy);
    });

    this.socket.off('game_state');
    this.socket.off('game_event');
    this.socket.on('game_state', (state) => this.onState(state));
    this.socket.on('game_event', (ev) => {
      if (ev.type === 'countdown') {
        const bossSoon = !!this.state?.bossRound || !!this.state?.pendingBossFight;
        const labelRound = bossSoon
          ? this.state?.round || 1
          : (this.state?.round ?? 0) + 1;
        this.bannerText.setText(
          bossSoon
            ? `BOSS FIGHT\nRound ${labelRound}`
            : `Round ${labelRound}\nComeçando`
        );
        this.bannerText.setAlpha(1);
      }
    });

    this.events.on('shutdown', () => {
      this.stopBattleMusic();
      this.clearAimCursor();
      this.clearMatchEndKillScroll();
      this.arenaFireWall?.destroy();
      this.arenaFireEmbers?.destroy();
      this.conjureFx?.destroy();
      this.conjureEmbers?.destroy();
      this.destroyRoundSpotlight();
      this.arenaFireWall = null;
      this.arenaFireEmbers = null;
      this.conjureFx = null;
      this.conjureEmbers = null;
      for (const s of this.arenaIronSprites) s.destroy();
      this.arenaIronSprites = [];
      for (const n of this.lootNotifications) {
        n.textObj?.destroy();
      }
      this.lootNotifications = [];
      this.input.keyboard.off('keydown', this.onDashKeyDown, this);
      this.input.keyboard.off('keydown-ESC', this.onEscapeKey, this);
      this.input.keyboard.off('keydown-ENTER', this.onDisconnectEnterKey, this);
      this.socket.off('game_state');
      this.socket.off('game_event');
    });

    // Garante snapshot da arena/spawns mesmo se o state inicial chegou antes da cena
    this.socket.emit('request_state');
  }

  ensureCrosshairTexture() {
    // Sempre regenera: evita PNG preto antigo preso no cache do Phaser/HMR
    if (this.textures.exists('aim_crosshair')) {
      this.textures.remove('aim_crosshair');
    }
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const cx = 32;
    const cy = 32;
    g.lineStyle(5, 0x000000, 0.9);
    g.strokeCircle(cx, cy, 22);
    g.lineBetween(cx - 26, cy, cx - 8, cy);
    g.lineBetween(cx + 8, cy, cx + 26, cy);
    g.lineBetween(cx, cy - 26, cx, cy - 8);
    g.lineBetween(cx, cy + 8, cx, cy + 26);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(cx, cy, 22);
    g.lineBetween(cx - 25, cy, cx - 8, cy);
    g.lineBetween(cx + 8, cy, cx + 25, cy);
    g.lineBetween(cx, cy - 25, cx, cy - 8);
    g.lineBetween(cx, cy + 8, cx, cy + 25);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy, 2);
    g.generateTexture('aim_crosshair', 64, 64);
    g.destroy();
    return this.textures.exists('aim_crosshair');
  }

  setupAimCursor() {
    this.input.setDefaultCursor('none');
    if (!this.ensureCrosshairTexture()) return;
    this.aimCursor = this.add
      .image(0, 0, 'aim_crosshair')
      .setDepth(100000)
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(40, 40)
      .setVisible(true);
    this.input.on('pointermove', this.syncAimCursor, this);
    this.syncAimCursor(this.input.activePointer);
  }

  syncAimCursor(pointer) {
    if (!this.aimCursor) return;
    const p = pointer || this.input.activePointer;
    if (!p) return;
    this.aimCursor.setPosition(p.x, p.y);
    this.aimCursor.setVisible(true);
  }

  clearAimCursor() {
    this.input.off('pointermove', this.syncAimCursor, this);
    this.input.setDefaultCursor('default');
    if (this.aimCursor) {
      this.aimCursor.destroy();
      this.aimCursor = null;
    }
  }

  /** @param {boolean} [boss] toca Trono Despedaçado na boss fight */
  startBattleMusic(boss = false) {
    stopMenuMusic();
    let key = null;
    if (boss && this.cache.audio.exists('boss_music')) {
      key = 'boss_music';
    } else {
      const tracks = ['battle_music_a', 'battle_music_b'].filter((k) =>
        this.cache.audio.exists(k)
      );
      if (!tracks.length) return;
      key = tracks[Math.floor(Math.random() * tracks.length)];
    }
    if (this.battleMusic?.isPlaying && this.battleMusicKey === key) return;
    this.stopBattleMusic();
    const volume = getMenuMusicVolume();
    this.battleMusicKey = key;
    this.battleMusic = this.sound.add(key, {
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

  /** Troca para boss music / volta às faixas normais conforme o estado. */
  syncBattleMusic() {
    const wantBoss =
      !!this.state?.bossRound &&
      (this.state.phase === 'playing' || this.state.phase === 'levelup');
    if (wantBoss) {
      if (this.battleMusicKey !== 'boss_music') this.startBattleMusic(true);
      return;
    }
    if (this.battleMusicKey === 'boss_music' || !this.battleMusic) {
      this.startBattleMusic(false);
    }
  }

  stopBattleMusic() {
    if (this.battleMusic) {
      this.battleMusic.stop();
      this.battleMusic.destroy();
      this.battleMusic = null;
    }
    this.battleMusicKey = null;
  }

  createHud() {
    const { width, height } = this.scale;

    // Box do canto superior esquerdo (estilo painéis do lobby/matchmaking)
    this.hudPanel = this.add
      .rectangle(12, 12, 256, 96, 0x161228, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b5cff)
      .setScrollFactor(0)
      .setDepth(99);

    this.modeText = this.add
      .text(24, 16, 'PVP', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ff6b6b',
      })
      .setScrollFactor(0)
      .setDepth(102);

    this.roundHudText = this.add
      .text(56, 16, '· Round 1', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#a99bc8',
      })
      .setScrollFactor(0)
      .setDepth(102);

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
      .text(24, 56, 'ESCUDO 0', {
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
    this.lootText = this.add
      .text(24, 94, 'Loot 0', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#e8c84a',
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.goldText = this.add
      .text(100, 94, 'Gold 0', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffd76a',
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.mapText = this.add
      .text(24, 112, 'Mapa —', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#a99bc8',
      })
      .setScrollFactor(0)
      .setDepth(102);

    // Status recebidos (slow, terreno, etc.) — abaixo do mapa
    this.statusSlots = [];
    this.statusTooltipEffect = null;
    for (let i = 0; i < 8; i++) {
      const slot = this.add.container(28 + i * 36, 96).setScrollFactor(0).setDepth(102).setVisible(false);
      const bg = this.add.rectangle(0, 0, 30, 30, 0x1a1430, 0.95).setStrokeStyle(1, 0x6b5cff);
      const icon = this.add.image(0, -3, 'spell_ice_shard').setDisplaySize(18, 18);
      const cd = this.add
        .text(0, 12, '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '9px',
          color: '#dcecff',
        })
        .setOrigin(0.5, 0);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => this.showStatusTooltip(i));
      bg.on('pointerout', () => this.hideStatusTooltip(i));
      slot.add([bg, icon, cd]);
      this.statusSlots.push({ container: slot, bg, icon, cd, effect: null });
    }

    this.statusTooltip = this.add.container(0, 0).setScrollFactor(0).setDepth(220).setVisible(false);
    this.statusTooltipBg = this.add
      .rectangle(0, 0, 200, 56, 0x120e22, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x8b7cff);
    this.statusTooltipTitle = this.add
      .text(8, 6, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#f4e8ff',
        wordWrap: { width: 184 },
      })
      .setOrigin(0, 0);
    this.statusTooltipBody = this.add
      .text(8, 24, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#c8bdd8',
        wordWrap: { width: 184 },
      })
      .setOrigin(0, 0);
    this.statusTooltip.add([this.statusTooltipBg, this.statusTooltipTitle, this.statusTooltipBody]);

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

    this.bossFightText = this.add
      .text(width / 2, height / 2, 'BOSS FIGHT!', {
        fontFamily: 'Georgia, serif',
        fontSize: '64px',
        color: '#ff3344',
        stroke: '#1a0000',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(250)
      .setAlpha(0)
      .setScale(0.85);

    this.spellSlots = [];
    // Linha de cima: 1–3 magias + 4 ultimate
    // Linha de baixo: Shift = dash, E = escudo (lv1), H = heal (lv1), B = blink (lv5)
    const slotLabels = ['1', '2', '3', '4', 'Shift', 'E', 'H', 'B'];
    const slotSize = 60;
    const slotGap = 10;
    const colPitch = slotSize + slotGap;
    const rowPitch = slotSize + 8;
    const baseX = 24 + slotSize / 2;
    const bottomY = this.scale.height - 36;
    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = i < 4 ? 0 : 1;
      const x = baseX + col * colPitch;
      const y = bottomY - (1 - row) * rowPitch;
      const slot = this.add.container(x, y).setScrollFactor(0).setDepth(100);
      const bg = this.add.rectangle(0, 0, 60, 60, 0x1a1430, 0.95).setStrokeStyle(2, 0x6b5cff);
      const icon = this.add.image(0, -4, 'spell_firebolt').setScale(1.35).setVisible(false);
      const key = this.add
        .text(-26, -26, slotLabels[i], {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: i >= 4 ? '9px' : '11px',
          color: '#9a8bb8',
        })
        .setOrigin(0);
      const elementIcon = this.add
        .image(-20, -16, 'element_arcane')
        .setDisplaySize(12, 12)
        .setVisible(false);
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
      const lock =
        i === 5 || i === 6 || i === 7
          ? this.add.image(0, -2, 'icon_lock').setScale(1.15).setVisible(false).setDepth(1)
          : null;
      slot.add(
        lock
          ? [bg, icon, lock, key, elementIcon, name, cd]
          : [bg, icon, key, elementIcon, name, cd]
      );
      slot.bg = bg;
      slot.icon = icon;
      slot.elementIcon = elementIcon;
      slot.lock = lock;
      slot.name = name;
      slot.cd = cd;
      slot.slotIndex = i;
      if (i < 4) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          if (this.disconnectConfirmOpen || this.leaving) return;
          this.selectedSpellSlot = i;
        });
      } else if (i === 5) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          if (this.disconnectConfirmOpen || this.leaving) return;
          this.pendingBarrier = true;
        });
      } else if (i === 6) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          if (this.disconnectConfirmOpen || this.leaving) return;
          this.pendingMend = true;
        });
      } else if (i === 7) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          if (this.disconnectConfirmOpen || this.leaving) return;
          this.pendingBlink = true;
        });
      }
      this.spellSlots.push(slot);
    }

    this.createScoreboard(width);

    this.levelUpLayer = this.add.container(0, 0).setDepth(300).setScrollFactor(0).setVisible(false);
  }

  createScoreboard(width) {
    const panelW = 340;
    const panelX = width - 12 - panelW;
    const panelY = 12;
    const maxRows = 8;

    this.scoreboardPanel = this.add
      .rectangle(panelX, panelY, panelW, 80, 0x161228, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b5cff)
      .setScrollFactor(0)
      .setDepth(99);

    this.scoreboardTitle = this.add
      .text(panelX + 12, panelY + 10, 'Placar', {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        color: '#f4e8ff',
      })
      .setScrollFactor(0)
      .setDepth(102);

    const makeSortBtn = (x, label, mode) => {
      const btn = this.add.container(x, panelY + 18).setScrollFactor(0).setDepth(102);
      const bg = this.add.rectangle(0, 0, 64, 22, 0x1a1430, 0.95).setStrokeStyle(1, 0x6b5cff);
      const text = this.add
        .text(0, 0, label, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: '#c4b5e0',
        })
        .setOrigin(0.5);
      btn.add([bg, text]);
      btn.bg = bg;
      btn.label = text;
      btn.mode = mode;
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => {
        if (this.scoreboardSort === mode) return;
        this.scoreboardSort = mode;
        this.refreshScoreboardSortButtons();
        this.updateScoreboard();
      });
      return btn;
    };

    // Botões alinhados à direita do painel (centro do rect = posição do container)
    this.scoreboardSortBtns = [
      makeSortBtn(panelX + panelW - 114, 'Dano', 'damage'),
      makeSortBtn(panelX + panelW - 44, 'Mortes', 'kills'),
    ];

    this.scoreboardHeader = this.add
      .text(panelX + 12, panelY + 36, 'Jogador', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '10px',
        color: '#7a6d9a',
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.scoreboardHeaderStats = this.add
      .text(panelX + panelW - 12, panelY + 36, 'K/M  Mob  Loot  Gold  Dmg  Pts', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '10px',
        color: '#7a6d9a',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(102);

    this.scoreboardRows = [];
    for (let i = 0; i < maxRows; i++) {
      const y = panelY + 52 + i * 18;
      const name = this.add
        .text(panelX + 12, y, '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '12px',
          color: '#d8ceef',
        })
        .setScrollFactor(0)
        .setDepth(102)
        .setVisible(false);
      const stats = this.add
        .text(panelX + panelW - 12, y, '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '12px',
          color: '#d8ceef',
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(102)
        .setVisible(false);
      this.scoreboardRows.push({ name, stats });
    }

    this.scoreboardLayout = { panelX, panelY, panelW, maxRows, rowH: 18 };
    this.refreshScoreboardSortButtons();
  }

  refreshScoreboardSortButtons() {
    if (!this.scoreboardSortBtns) return;
    for (const btn of this.scoreboardSortBtns) {
      const active = btn.mode === this.scoreboardSort;
      btn.bg.setFillStyle(active ? 0x6b5cff : 0x1a1430, 0.95);
      btn.bg.setStrokeStyle(1, active ? 0xffffff : 0x6b5cff, active ? 0.35 : 1);
      btn.label.setColor(active ? '#ffffff' : '#c4b5e0');
    }
  }

  updateScoreboard() {
    if (!this.state?.players || !this.scoreboardRows) return;

    const { panelX, panelY, panelW, maxRows, rowH } = this.scoreboardLayout;
    const sortBy = this.scoreboardSort;

    const ranked = [...this.state.players].sort((a, b) => {
      if (sortBy === 'damage') {
        return (
          (b.damageDealt || 0) - (a.damageDealt || 0) ||
          (b.kills || 0) - (a.kills || 0) ||
          (a.deaths || 0) - (b.deaths || 0) ||
          (b.score || 0) - (a.score || 0)
        );
      }
      // Mortes = abates (kills) — maior → menor
      return (
        (b.kills || 0) - (a.kills || 0) ||
        (b.damageDealt || 0) - (a.damageDealt || 0) ||
        (a.deaths || 0) - (b.deaths || 0) ||
        (b.score || 0) - (a.score || 0)
      );
    });

    const count = Math.min(ranked.length, maxRows);
    for (let i = 0; i < maxRows; i++) {
      const row = this.scoreboardRows[i];
      const p = ranked[i];
      if (!p) {
        row.name.setVisible(false);
        row.stats.setVisible(false);
        continue;
      }
      const mine = p.id === this.playerId;
      const color = mine ? '#f1c40f' : p.alive ? '#d8ceef' : '#7a6d9a';
      const y = panelY + 52 + i * rowH;
      row.name
        .setText(`${p.alive ? '●' : '○'} ${(p.name || '?').slice(0, 12)}`)
        .setColor(color)
        .setPosition(panelX + 12, y)
        .setVisible(true);
      row.stats
        .setText(
          `${p.kills || 0}/${p.deaths || 0}  ${p.monsterKills || 0}  ${p.loot || 0}  ${p.gold || 0}  ${p.damageDealt || 0}  ${p.score || 0}`
        )
        .setColor(color)
        .setPosition(panelX + panelW - 12, y)
        .setVisible(true);
    }

    const panelH = 52 + count * rowH + 12;
    this.scoreboardPanel.setPosition(panelX, panelY);
    this.scoreboardPanel.setSize(panelW, Math.max(72, panelH));
    this.scoreboardPanel.setStrokeStyle(2, 0x6b5cff);
    this.layoutDisconnectButton();
  }

  createDisconnectUi() {
    const btnW = 120;
    const btnH = 32;
    this.disconnectBtnSize = { w: btnW, h: btnH };

    this.disconnectBtn = this.add.container(0, 0).setScrollFactor(0).setDepth(110);
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

    this.layoutDisconnectButton();
    this.disconnectModal = this.add.container(0, 0).setDepth(400).setScrollFactor(0).setVisible(false);
  }

  layoutDisconnectButton() {
    if (!this.disconnectBtn || !this.scoreboardPanel || !this.scoreboardLayout) return;
    const { panelX, panelW } = this.scoreboardLayout;
    const { w: btnW, h: btnH } = this.disconnectBtnSize;
    const panelH = this.scoreboardPanel.height || 72;
    const gap = 8;
    const x = panelX + panelW - btnW / 2;
    const y = this.scoreboardLayout.panelY + panelH + gap + btnH / 2;
    this.disconnectBtn.setPosition(x, y);
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
    this.socket.emit('leave_lobby');
    this.time.delayedCall(450, () => {
      navigate('/matchmaking');
    });
  }

  createMatchEndUi() {
    this.matchEndModal = this.add.container(0, 0).setDepth(450).setScrollFactor(0).setVisible(false);
  }

  handleLootItems(items) {
    try {
      const character = ensureCharacter();
      let inventory = normalizeInventory(character.inventory);
      let addedAny = false;
      let inventoryFull = false;

      for (const { itemId, qty } of items) {
        for (let i = 0; i < qty; i++) {
          const item = createItem(itemId);
          if (!item) continue;
          // Check if bag has ANY free slot before attempting
          if (firstEmptyBagIndex(inventory.bag) < 0) {
            inventoryFull = true;
            break;
          }
          const result = addItemToBag(inventory, item);
          if (!result.ok) {
            inventoryFull = true;
            break;
          }
          inventory = result.inventory;
          addedAny = true;
          this.lootNotifications.push({
            name: item.name,
            color: item.color,
            addedAt: this.time.now,
            textObj: null,
          });
        }
        if (inventoryFull) break;
      }

      if (addedAny) {
        character.inventory = inventory;
        saveCharacter(character);
      }

      if (inventoryFull) {
        this.showFloatingMessage('Inventário cheio!', 0xff6b6b);
      }
    } catch { /* silencioso */ }
  }

  showFloatingMessage(text, color) {
    const me = this.state?.players?.find((p) => p.id === this.playerId);
    if (!me) return;
    const msg = this.add.text(me.x, me.y - 40, text, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      color: '#' + (color >>> 0).toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: msg,
      y: me.y - 80,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => msg.destroy(),
    });
  }

  collectMatchItems(state) {
    try {
      const me = (state.players || []).find((p) => p.id === this.playerId);
      if (!me || !me.collectedItems || !me.collectedItems.length) return;

      const character = ensureCharacter();
      let inventory = normalizeInventory(character.inventory);
      let addedCount = 0;

      for (const { itemId, qty } of me.collectedItems) {
        for (let i = 0; i < qty; i++) {
          const item = createItem(itemId);
          if (!item) continue;
          const result = addItemToBag(inventory, item);
          if (!result.ok) break;
          inventory = result.inventory;
          addedCount++;
        }
      }

      if (addedCount > 0) {
        character.inventory = inventory;
        saveCharacter(character);
      }
    } catch { /* Silencioso em caso de erro no inventário */ }
  }

  showMatchEndOverlay(state) {
    if (this.matchEndOpen || this.leaving) return;
    this.matchEndOpen = true;
    this.closeDisconnectConfirm();

    this.collectMatchItems(state);

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
    const me = ranking.find((p) => p.id === this.playerId) || null;
    const roundReached = state.round || 0;
    const resultLabel = 'PARTIDA ENCERRADA';
    const resultColor = '#c4b5e0';
    const resultStroke = 0x6b5cff;

    const header = 'Jogador          K/M   Mob  Loot  Gold   Dano   Pts';
    const rows = ranking
      .map((p, i) => {
        const mark = p.id === winner?.id ? '★' : `${i + 1}.`;
        const name = `${mark} ${(p.name || 'Wizard').slice(0, 12)}`.padEnd(16, ' ');
        const km = `${p.kills || 0}/${p.deaths || 0}`.padStart(5, ' ');
        const mob = String(p.monsterKills || 0).padStart(5, ' ');
        const loot = String(p.loot || 0).padStart(5, ' ');
        const gold = String(p.gold || 0).padStart(5, ' ');
        const dmg = String(p.damageDealt || 0).padStart(6, ' ');
        const pts = String(p.score || 0).padStart(5, ' ');
        return `${name}${km} ${mob} ${loot} ${gold} ${dmg} ${pts}`;
      })
      .join('\n');

    const killStats = state.monsterKillStats || { total: 0, byType: [] };
    const killEntries = Array.isArray(killStats.byType) ? killStats.byType : [];
    const killTotal = killStats.total || 0;
    const myElement = me?.elementDamage || {};
    const takenStats = myElement.taken || { total: me?.damageTaken || 0, byElement: [] };
    const dealtStats = myElement.dealt || { total: me?.damageDealt || 0, byElement: [] };
    const takenEntries = Array.isArray(takenStats.byElement) ? takenStats.byElement : [];
    const dealtEntries = Array.isArray(dealtStats.byElement) ? dealtStats.byElement : [];
    const killCols = 3;
    const killRowH = 24;
    const boardH = Math.max(22, ranking.length * 22);
    const topBlockH = 148 + boardH;
    const panelW = 640;
    const maxPanelH = height - 40;
    const footerH = 70;
    const titleKillH = 28;
    const elementRowH = 36;
    const elementSectionH = 22 + elementRowH + 22 + elementRowH;
    const availKillH = Math.max(
      killRowH * 3,
      maxPanelH - topBlockH - footerH - titleKillH - elementSectionH - 8
    );
    const killContentRows = Math.max(1, Math.ceil(Math.max(1, killEntries.length) / killCols));
    const killContentH = killEntries.length === 0 ? killRowH : killContentRows * killRowH;
    const killViewportH = Math.min(availKillH, Math.max(killRowH, killContentH));
    const killSectionH = elementSectionH + titleKillH + killViewportH + 8;
    const panelH = Math.min(maxPanelH, topBlockH + killSectionH + footerH);
    const panelTop = height / 2 - panelH / 2;
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    const panel = this.add
      .rectangle(width / 2, height / 2, panelW, panelH, 0x161228, 0.98)
      .setStrokeStyle(2, resultStroke);
    const title = this.add
      .text(width / 2, panelTop + 36, resultLabel, {
        fontFamily: 'Georgia, serif',
        fontSize: '34px',
        color: resultColor,
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(
        width / 2,
        panelTop + 68,
        roundReached > 0 ? `Round ${roundReached} alcançado` : 'Todos morreram',
        {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          color: '#a99bc8',
        }
      )
      .setOrigin(0.5);
    const lootGained = me?.loot || 0;
    const goldGained = me?.gold || 0;
    const goldLine = this.add
      .text(
        width / 2,
        panelTop + 90,
        `Você levou ${lootGained} loot · ${goldGained} gold`,
        {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#ffd76a',
        }
      )
      .setOrigin(0.5);
    const boardHeader = this.add
      .text(width / 2, panelTop + 116, header, {
        fontFamily: 'Consolas, Monaco, monospace',
        fontSize: '13px',
        color: '#7a6d9a',
        align: 'left',
      })
      .setOrigin(0.5, 0);
    const board = this.add
      .text(width / 2, panelTop + 138, rows || 'Sem jogadores', {
        fontFamily: 'Consolas, Monaco, monospace',
        fontSize: '14px',
        color: '#e8dfff',
        align: 'left',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);

    this.clearMatchEndKillScroll();

    const killTop = panelTop + topBlockH + 4;
    const killNeedsScroll = killContentH > killViewportH;
    const modalItems = [dim, panel, title, subtitle, goldLine, boardHeader, board];

    const addElementDamageBlock = (y, label, total, entries, accent) => {
      modalItems.push(
        this.add
          .text(width / 2, y, `${label}: ${Math.round(total || 0)}`, {
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '13px',
            fontStyle: 'bold',
            color: accent,
          })
          .setOrigin(0.5, 0)
      );
      const rowY = y + 22;
      if (!entries.length) {
        modalItems.push(
          this.add
            .text(width / 2, rowY, '—', {
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '12px',
              color: '#7a6d9a',
            })
            .setOrigin(0.5, 0.5)
        );
        return;
      }
      const slotW = Math.min(68, (panelW - 48) / entries.length);
      const rowW = slotW * entries.length;
      const rowLeft = width / 2 - rowW / 2;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const cx = rowLeft + i * slotW + slotW / 2;
        const isOther = entry.element === 'other';
        const iconKey = isOther ? null : spellElementIconKey(entry.element);
        if (iconKey && this.textures.exists(iconKey)) {
          modalItems.push(this.add.image(cx - 14, rowY, iconKey).setDisplaySize(16, 16));
        } else if (isOther) {
          modalItems.push(
            this.add
              .text(cx - 14, rowY, '·', {
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '16px',
                color: '#a99bc8',
              })
              .setOrigin(0.5)
          );
        }
        const pctColor = isOther
          ? '#a99bc8'
          : `#${spellElementColor(entry.element).toString(16).padStart(6, '0')}`;
        modalItems.push(
          this.add
            .text(cx + (iconKey || isOther ? 2 : 0), rowY, `${entry.pct ?? 0}%`, {
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '13px',
              fontStyle: 'bold',
              color: pctColor,
            })
            .setOrigin(iconKey || isOther ? 0 : 0.5, 0.5)
        );
      }
    };

    addElementDamageBlock(
      killTop,
      'Dano recebido',
      takenStats.total ?? me?.damageTaken ?? 0,
      takenEntries,
      '#ff8a80'
    );
    addElementDamageBlock(
      killTop + 22 + elementRowH,
      'Dano causado',
      dealtStats.total ?? me?.damageDealt ?? 0,
      dealtEntries,
      '#6dffb0'
    );

    const killTitle = this.add
      .text(
        width / 2,
        killTop + elementSectionH,
        killNeedsScroll
          ? `Monstros derrotados: ${killTotal}  ·  ↕ scroll`
          : `Monstros derrotados: ${killTotal}`,
        {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#c4b5e0',
        }
      )
      .setOrigin(0.5, 0);
    modalItems.push(killTitle);

    const colW = (panelW - 56) / killCols;
    const listLeft = width / 2 - panelW / 2 + 24;
    const listTop = killTop + elementSectionH + 26;
    const listWidth = panelW - 48;

    if (killEntries.length === 0) {
      const empty = this.add
        .text(width / 2, listTop + 4, 'Nenhum monstro derrotado', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '13px',
          color: '#7a6d9a',
        })
        .setOrigin(0.5, 0);
      modalItems.push(empty);
    } else {
      const listContainer = this.add.container(listLeft, listTop);
      for (let i = 0; i < killEntries.length; i++) {
        const entry = killEntries[i];
        const col = i % killCols;
        const row = Math.floor(i / killCols);
        const x = col * colW;
        const y = row * killRowH + killRowH / 2;
        const tex = this.monsterTexture(entry.type);
        const icon = this.add.image(x + 12, y, tex).setDisplaySize(20, 20);
        const tierTag =
          entry.tier === 'boss' ? ' (boss)' : entry.tier === 'elite' ? ' (elite)' : '';
        const label = this.add
          .text(x + 28, y, `${this.monsterLabel(entry.type)}${tierTag}  ×${entry.count}`, {
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '13px',
            color: '#e8dfff',
          })
          .setOrigin(0, 0.5);
        listContainer.add([icon, label]);
      }

      const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
      maskGfx.fillStyle(0xffffff, 1);
      maskGfx.fillRect(listLeft, listTop, listWidth, killViewportH);
      listContainer.setMask(maskGfx.createGeometryMask());

      const trackX = listLeft + listWidth - 4;
      const track = this.add.rectangle(trackX, listTop + killViewportH / 2, 4, killViewportH, 0xffffff, 0.08);
      const thumbH = killNeedsScroll
        ? Math.max(18, (killViewportH / killContentH) * killViewportH)
        : killViewportH;
      const thumb = this.add
        .rectangle(trackX, listTop, 4, thumbH, 0x6b5cff, killNeedsScroll ? 0.85 : 0)
        .setOrigin(0.5, 0);

      this.matchEndKillScroll = {
        container: listContainer,
        maskGfx,
        y0: listTop,
        scroll: 0,
        maxScroll: Math.max(0, killContentH - killViewportH),
        viewportH: killViewportH,
        contentH: killContentH,
        thumb,
        thumbH,
        trackTop: listTop,
      };

      modalItems.push(listContainer, track, thumb);
    }

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

    modalItems.push(lobbyBg, lobbyLabel);
    this.matchEndModal.add(modalItems);
    this.bannerText.setAlpha(0);
  }

  clearMatchEndKillScroll() {
    if (this.matchEndKillScroll?.maskGfx) {
      this.matchEndKillScroll.container?.clearMask(true);
      this.matchEndKillScroll.maskGfx.destroy();
    }
    this.matchEndKillScroll = null;
  }

  onMatchEndKillWheel(dy) {
    const s = this.matchEndKillScroll;
    if (!this.matchEndOpen || !s || s.maxScroll <= 0 || !dy) return false;
    s.scroll = Phaser.Math.Clamp(s.scroll + Math.sign(dy) * 28, 0, s.maxScroll);
    s.container.y = s.y0 - s.scroll;
    if (s.thumb && s.maxScroll > 0) {
      const t = s.scroll / s.maxScroll;
      const travel = s.viewportH - s.thumbH;
      s.thumb.y = s.trackTop + t * travel;
    }
    return true;
  }

  goToLobbyFromMatchEnd() {
    if (this.leaving) return;
    this.leaving = true;
    this.clearMatchEndKillScroll();
    this.socket.emit('leave_lobby');
    this.time.delayedCall(300, () => {
      navigate('/matchmaking');
    });
  }

  onSpellSlotWheel(dy) {
    if (!dy) return;
    if (this.leaving || this.disconnectConfirmOpen || this.matchEndOpen) return;
    // Scroll para baixo = próxima magia; para cima = anterior
    this.cycleSpellSlot(dy > 0 ? 1 : -1);
  }

  spawnDamageNumber(x, y, amount, isSelf = false, isCrit = false) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(amount > 0)) return;
    const jitterX = (Math.random() - 0.5) * 18;
    const startY = y - 34;
    const label = this.add
      .text(x + jitterX, startY, `-${Math.round(amount)}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: isCrit ? (isSelf ? '24px' : '22px') : isSelf ? '20px' : '17px',
        color: isCrit ? '#ffb347' : isSelf ? '#ff8a80' : '#ffe066',
        stroke: '#1a0500',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(55)
      .setAlpha(1);

    this.tweens.add({
      targets: label,
      y: startY - (isCrit ? 52 : 42),
      alpha: 0,
      scale: isCrit ? 1.35 : 1.15,
      duration: 1400,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });

    if (isCrit) this.spawnCriticalPopup(x, y);
  }

  spawnHealNumber(x, y, amount, isSelf = false) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(amount > 0)) return;
    const jitterX = (Math.random() - 0.5) * 18;
    const startY = y - 34;
    const label = this.add
      .text(x + jitterX, startY, `+${Math.round(amount)}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: isSelf ? '20px' : '17px',
        color: isSelf ? '#7dffb0' : '#a8ffc8',
        stroke: '#052014',
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

  spawnCriticalPopup(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const startY = y - 52;
    const label = this.add
      .text(x, startY, 'critical!', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#ff6b2c',
        stroke: '#1a0500',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(57)
      .setAlpha(1)
      .setScale(0.75);

    this.tweens.add({
      targets: label,
      y: startY - 56,
      alpha: 0,
      scale: 1.35,
      duration: 1100,
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

  /** Nome da magia acima do caster por 2s (não-projéteis). */
  spawnSpellCastLabel(ev) {
    if (!ev?.spellId || ev.casterId == null) return;
    const name = spellDisplayName(ev.spellId);
    if (!name) return;

    // Substitui label anterior do mesmo caster
    for (let i = this.spellCastLabels.length - 1; i >= 0; i--) {
      const item = this.spellCastLabels[i];
      if (item.casterId === ev.casterId && item.isPlayer === !!ev.isPlayer) {
        item.label.destroy();
        this.spellCastLabels.splice(i, 1);
      }
    }

    const colorNum = (Number(ev.color) || 0xffffff) >>> 0;
    const colorHex = `#${colorNum.toString(16).padStart(6, '0')}`;
    const x = Number.isFinite(ev.x) ? ev.x : 0;
    const y = Number.isFinite(ev.y) ? ev.y - 48 : 0;
    const label = this.add
      .text(x, y, name, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: colorHex,
        stroke: '#12080a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(58)
      .setAlpha(1);

    this.spellCastLabels.push({
      label,
      casterId: ev.casterId,
      isPlayer: !!ev.isPlayer,
      expiresAt: this.time.now + 2000,
    });
  }

  updateSpellCastLabels() {
    if (!this.spellCastLabels?.length) return;
    const now = this.time.now;
    const players = this.state?.players || [];
    const monsters = this.state?.monsters || [];

    for (let i = this.spellCastLabels.length - 1; i >= 0; i--) {
      const item = this.spellCastLabels[i];
      const left = item.expiresAt - now;
      if (left <= 0) {
        item.label.destroy();
        this.spellCastLabels.splice(i, 1);
        continue;
      }

      let x = item.label.x;
      let y = item.label.y;
      if (item.isPlayer) {
        const p = players.find((pl) => pl.id === item.casterId);
        if (p) {
          x = p.x;
          y = p.y - (p.shield > 0 ? 50 : 42);
        }
      } else {
        const m = monsters.find((mon) => mon.entityId === item.casterId);
        if (m) {
          const scale = Math.max(0.85, ((m.radius || 14) / 14) * 1.3);
          x = m.x;
          y = m.y - (m.shield > 0 ? 48 : 40) * scale;
        }
      }

      const alpha = left < 400 ? left / 400 : 1;
      item.label.setPosition(x, y).setAlpha(alpha);
    }
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

  playReprovado() {
    if (!this.cache.audio.exists('reprovado')) return;
    this.sound.play('reprovado', { volume: 0.9 });
  }

  onState(state) {
    const prevPhase = this.state?.phase;
    const prevBossRound = !!this.state?.bossRound;
    this.state = state;
    if (prevBossRound !== !!state.bossRound || prevPhase !== state.phase) {
      this.syncBattleMusic();
    }
    let roundEnded = false;
    for (const ev of state.events || []) {
      if (ev.type === 'damage') {
        const isSelf = ev.isPlayer && ev.targetId === this.playerId;
        this.spawnDamageNumber(ev.x, ev.y, ev.amount, isSelf, !!ev.crit);
        if (isSelf && ev.amount > 0) {
          this.playHurtSound();
        }
      }
      if (ev.type === 'heal') {
        const isSelf = ev.playerId === this.playerId;
        this.spawnHealNumber(ev.x, ev.y, ev.amount, isSelf);
        if (isSelf && Number.isFinite(ev.x) && Number.isFinite(ev.y)) {
          this.healFx?.emitParticleAt(ev.x, ev.y, 10);
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
      if (ev.type === 'spell_cast') {
        this.spawnSpellCastLabel(ev);
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
        this.clearFloorDebris();
        this.syncBattleMusic();
        const newFloor = state.arena?.floorType;
        if (newFloor && this.displayedFloorType && newFloor !== this.displayedFloorType) {
          this.beginArenaFloorTransition(this.displayedFloorType, newFloor, ev.round);
        } else if (newFloor && !this.displayedFloorType) {
          this.displayedFloorType = newFloor;
        }
        if (ev.round === 1 && prevPhase === 'countdown') {
          this.beginRoundSpotlightReveal();
        }
        if (ev.bossRound) this.showBossFightAlert();
      }
      if (ev.type === 'round_win') {
        roundEnded = true;
      }
      if (ev.type === 'loot_pickup' && ev.items && ev.playerId === this.playerId && !this._processedLootAt?.has(ev._at)) {
        if (!this._processedLootAt) this._processedLootAt = new Set();
        this._processedLootAt.add(ev._at);
        this.handleLootItems(ev.items);
      }
    }
    // Limpa set de loot processado ao fim do round para nao crescer infinito
    if (state.phase === 'countdown' && prevPhase !== 'countdown') {
      this._processedLootAt?.clear();
    }
    // Som do fim do round: no evento round_win.
    if (roundEnded) {
      this.playRoundEndSound();
    }
    if (state.phase === 'countdown' && prevPhase === 'lobby') {
      this.beginRoundSpotlight();
    } else if (
      state.phase === 'countdown' &&
      !prevPhase &&
      this.roundSpotlight &&
      !this.roundSpotlight.active &&
      this.roundSpotlight.mode === 'idle'
    ) {
      // Estado inicial já em countdown (reload / late join)
      this.beginRoundSpotlight();
    }
    if (state.phase === 'ended') {
      this.showMatchEndOverlay(state);
    }
  }

  ensureCorpseAt(x, y) {
    // Não espalhar corpos fora do combate (countdown / intermissão / fim)
    const phase = this.state?.phase;
    if (phase && phase !== 'playing' && phase !== 'levelup') return;

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
      if (c.pile) this.tweens.killTweensOf(c.pile);
      if (c.skull) this.tweens.killTweensOf(c.skull);
      c.pile?.destroy();
      c.skull?.destroy();
    }
    this.localCorpses = [];
  }

  /** Corpos locais (jogadores) somem ao tocar a lava da arena. */
  cullLocalCorpsesInLava() {
    const arena = this.state?.arena;
    if (!arena || !this.localCorpses.length) return;

    const keep = [];
    for (const c of this.localCorpses) {
      if (c.melting) {
        keep.push(c);
        continue;
      }
      if (Math.hypot(c.x - arena.x, c.y - arena.y) <= arena.radius) {
        keep.push(c);
        continue;
      }
      c.melting = true;
      keep.push(c);
      const targets = [c.pile, c.skull].filter(Boolean);
      if (!targets.length) continue;
      this.tweens.add({
        targets,
        alpha: 0,
        y: '+=10',
        duration: 280,
        ease: 'Quad.easeIn',
        onComplete: () => {
          c.pile?.destroy();
          c.skull?.destroy();
          this.localCorpses = this.localCorpses.filter((x) => x !== c);
        },
      });
    }
    this.localCorpses = keep;
  }

  /** Limpa corpos locais, sangue, ossos, loot e moedas do chão (início de rodada). */
  clearFloorDebris() {
    this.clearLocalCorpses();
    for (const s of this.bloodSprites.values()) s.destroy();
    this.bloodSprites.clear();
    for (const pack of this.boneSprites.values()) {
      pack.pile?.destroy();
      pack.skull?.destroy();
    }
    this.boneSprites.clear();
    for (const s of this.lootBagSprites.values()) {
      this.tweens.killTweensOf(s);
      s.destroy();
    }
    this.lootBagSprites.clear();
    for (const s of this.coinSprites.values()) {
      this.tweens.killTweensOf(s);
      s.destroy();
    }
    this.coinSprites.clear();
  }

  update(_time, delta) {
    if (this.aimCursor) this.syncAimCursor(this.input.activePointer);

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
    this.cullLocalCorpsesInLava();
    this.renderRocks();
    this.renderTrees();
    this.renderPlayers();
    this.renderMonsters();
    this.renderProjectiles();
    this.renderAoes();
    this.renderEffects();
    this.renderLootBags();
    this.renderCoins();
    this.updateRoundSpotlight();
    this.updateFloorTransition();
    this.updateSpellCastLabels();
    this.updateHud();
    this.updateLootNotifications();
    this.updateLevelUpUi();
    this.handleBanners();
  }

  /** Overlay preto com furo no jogador local (abertura de round). */
  createRoundSpotlight() {
    const { width, height } = this.scale;
    this.roundSpotlight = {
      active: false,
      mode: 'idle', // idle | hold | reveal
      alpha: 0,
      holeR: 64,
      revealStartedAt: 0,
      revealDuration: 1400,
    };

    // Preto no mundo (mesmas coords do jogador) — cobre arena/HUD abaixo do banner
    this.roundSpotlightBg = this.add
      .rectangle(width / 2, height / 2, width * 2.2, height * 2.2, 0x000000, 1)
      .setDepth(140)
      .setVisible(false)
      .setAlpha(0);

    this.roundSpotlightHole = this.make.graphics({ x: 0, y: 0, add: false });
    this.roundSpotlightMask = this.roundSpotlightHole.createGeometryMask();
    this.roundSpotlightMask.invertAlpha = true;
    this.roundSpotlightBg.setMask(this.roundSpotlightMask);

    this.roundSpotlightRim = this.add.graphics().setDepth(141).setVisible(false);
  }

  destroyRoundSpotlight() {
    this.roundSpotlightBg?.clearMask(true);
    this.roundSpotlightBg?.destroy();
    this.roundSpotlightRim?.destroy();
    this.roundSpotlightHole?.destroy();
    this.roundSpotlightBg = null;
    this.roundSpotlightRim = null;
    this.roundSpotlightHole = null;
    this.roundSpotlightMask = null;
    this.roundSpotlight = null;
  }

  beginRoundSpotlight() {
    if (!this.roundSpotlight) this.createRoundSpotlight();
    const s = this.roundSpotlight;
    s.active = true;
    s.mode = 'hold';
    s.alpha = 1;
    s.holeR = 72;
    s.revealStartedAt = 0;
    this.roundSpotlightBg?.setVisible(true).setAlpha(1);
    this.roundSpotlightRim?.setVisible(true);
  }

  /** Fade-out do preto + abertura do foco quando o round começa de verdade. */
  beginRoundSpotlightReveal() {
    if (!this.roundSpotlight) this.createRoundSpotlight();
    const s = this.roundSpotlight;
    if (!s.active && s.alpha <= 0) {
      this.beginRoundSpotlight();
    }
    s.active = true;
    s.mode = 'reveal';
    s.revealStartedAt = this.time.now;
    s.revealDuration = 1400;
    if (s.alpha < 0.2) s.alpha = 1;
    this.roundSpotlightBg?.setVisible(true);
    this.roundSpotlightRim?.setVisible(true);
  }

  updateRoundSpotlight() {
    const s = this.roundSpotlight;
    if (!s || !this.roundSpotlightBg || !this.roundSpotlightHole) return;

    if (!s.active && s.alpha <= 0.01) {
      this.roundSpotlightBg.setVisible(false).setAlpha(0);
      this.roundSpotlightRim?.setVisible(false).clear();
      return;
    }

    const me = this.me();
    const { width, height } = this.scale;
    const hx = me?.x ?? width / 2;
    const hy = (me?.y ?? height / 2) - 8;

    if (s.mode === 'hold') {
      s.alpha = 1;
      s.holeR = 72 * (1 + 0.05 * Math.sin(this.time.now / 220));
    } else if (s.mode === 'reveal') {
      const p = Phaser.Math.Clamp(
        (this.time.now - s.revealStartedAt) / s.revealDuration,
        0,
        1
      );
      const ease = 1 - Math.pow(1 - p, 3);
      s.alpha = 1 - ease;
      s.holeR = 72 + ease * 900;
      if (p >= 1) {
        s.active = false;
        s.mode = 'idle';
        s.alpha = 0;
        s.holeR = 72;
        this.roundSpotlightBg.setVisible(false).setAlpha(0);
        this.roundSpotlightRim.setVisible(false).clear();
        return;
      }
    }

    const rx = s.holeR * 0.95;
    const ry = s.holeR * 1.2;

    this.roundSpotlightHole.clear();
    this.roundSpotlightHole.fillStyle(0xffffff, 1);
    this.roundSpotlightHole.fillEllipse(hx, hy, rx * 2, ry * 2);

    this.roundSpotlightBg.setVisible(true).setAlpha(s.alpha);

    const rim = this.roundSpotlightRim;
    rim.clear();
    if (s.alpha > 0.02) {
      rim.setVisible(true);
      const a = s.alpha;
      rim.lineStyle(12, 0x1a0840, 0.4 * a);
      rim.strokeEllipse(hx, hy, rx * 2 + 14, ry * 2 + 14);
      rim.lineStyle(6, 0x3a1878, 0.45 * a);
      rim.strokeEllipse(hx, hy, rx * 2 + 6, ry * 2 + 6);
      rim.lineStyle(2.2, 0x88aacc, 0.55 * a);
      rim.strokeEllipse(hx, hy, rx * 2, ry * 2);
    }
  }

  heldMoveDir() {
    if (this.cursors.up.isDown) return 'up';
    if (this.cursors.down.isDown) return 'down';
    if (this.cursors.left.isDown) return 'left';
    if (this.cursors.right.isDown) return 'right';
    return null;
  }

  onEscapeKey(event) {
    if (event?.repeat) return;
    if (this.leaving || this.matchEndOpen) return;
    if (this.disconnectConfirmOpen) {
      this.confirmDisconnect();
      return;
    }
    this.openDisconnectConfirm();
  }

  onDisconnectEnterKey(event) {
    if (event?.repeat) return;
    if (!this.disconnectConfirmOpen || this.leaving || this.matchEndOpen) return;
    this.confirmDisconnect();
  }

  onDashKeyDown(event) {
    if (event.repeat) return;
    if (this.disconnectConfirmOpen || this.matchEndOpen || this.leaving) return;
    const dirByCode = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
    const dir = dirByCode[event.code];
    const shiftHeld = event.shiftKey || this.cursors.dash?.isDown;

    // Inatas: teclas dedicadas; latch para não perder toque curto.
    if (event.code === 'KeyE') this.pendingBarrier = true;
    if (event.code === 'KeyH') this.pendingMend = true;
    if (event.code === 'KeyB') this.pendingBlink = true;

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
    // Escolha ao vivo: combate continua — 1–4 escolhem a magia enquanto o painel está aberto
    if (this.levelUpOpen && !this.levelUpSubmitting) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.tab)) {
        this.cycleSpellSlot();
        this.updateLevelUpSlotHint();
      }
      if (Phaser.Input.Keyboard.JustDown(this.cursors.one)) this.submitLevelUpChoice(0);
      else if (Phaser.Input.Keyboard.JustDown(this.cursors.two)) this.submitLevelUpChoice(1);
      else if (Phaser.Input.Keyboard.JustDown(this.cursors.three)) this.submitLevelUpChoice(2);
      else if (Phaser.Input.Keyboard.JustDown(this.cursors.four)) this.submitLevelUpChoice(3);
    } else if (!this.levelUpOpen) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.one)) this.selectedSpellSlot = 0;
      if (Phaser.Input.Keyboard.JustDown(this.cursors.two)) this.selectedSpellSlot = 1;
      if (Phaser.Input.Keyboard.JustDown(this.cursors.three)) this.selectedSpellSlot = 2;
      if (Phaser.Input.Keyboard.JustDown(this.cursors.four)) this.selectedSpellSlot = 3;
      if (Phaser.Input.Keyboard.JustDown(this.cursors.tab)) this.cycleSpellSlot();
    }

    // Magias equipadas + escudo/heal: autocast. Blink só por hotkey (B) ou clique no slot.
    // 1–4 / Tab só destacam o slot na UI.
    const castSlot = this.selectedSpellSlot;
    const dash = this.pendingDash || this.detectDash();
    if (dash) this.pendingDash = null;
    this.pendingBarrier = false;
    this.pendingMend = false;
    const barrier = true;
    const mend = true;
    const blink = !!this.pendingBlink || Phaser.Input.Keyboard.JustDown(this.cursors.blink);
    this.pendingBlink = false;

    this.socket.emit('player_input', {
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      aimX: pointer.worldX,
      aimY: pointer.worldY,
      castSlot,
      dash,
      barrier,
      mend,
      blink,
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
    if (!ARENA_BORDER_FX_ENABLED) return;
    // Parede circular de energia mágica — partículas suaves na borda
    this.arenaFireWall = this.add
      .particles(0, 0, 'particle', {
        tint: [0x4a2080, 0x6b40a8, 0x4488aa],
        speed: { min: 10, max: 28 },
        angle: { min: 250, max: 290 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.35, end: 0 },
        lifespan: { min: 700, max: 1200 },
        gravityY: -25,
        frequency: -1,
        emitting: false,
        blendMode: 'NORMAL',
      })
      .setDepth(2);

    this.arenaFireEmbers = this.add
      .particles(0, 0, 'particle', {
        tint: [0x5a3088, 0x5070a0, 0x8860b0],
        speed: { min: 6, max: 18 },
        angle: { min: 210, max: 330 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.28, end: 0 },
        lifespan: { min: 900, max: 1500 },
        gravityY: -12,
        frequency: -1,
        emitting: false,
        blendMode: 'NORMAL',
      })
      .setDepth(2.5);
  }

  /** Partículas de conjuração — mesma paleta da borda da arena, subindo do chão. */
  createConjureFx() {
    this.conjureFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0x4a2080, 0x6b40a8, 0x4488aa, 0x88aacc],
        speed: { min: 28, max: 70 },
        angle: { min: 255, max: 285 },
        scale: { start: 1.05, end: 0 },
        alpha: { start: 0.55, end: 0 },
        lifespan: { min: 420, max: 780 },
        gravityY: -55,
        frequency: -1,
        emitting: false,
        blendMode: 'NORMAL',
      })
      .setDepth(11);

    this.conjureEmbers = this.add
      .particles(0, 0, 'particle', {
        tint: [0x5a3088, 0x5070a0, 0x8860b0, 0xaad0e8],
        speed: { min: 16, max: 42 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.65, end: 0 },
        alpha: { start: 0.4, end: 0 },
        lifespan: { min: 500, max: 900 },
        gravityY: -35,
        frequency: -1,
        emitting: false,
        blendMode: 'NORMAL',
      })
      .setDepth(12);
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

    this.mistFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0x6b2cff, 0xaa66ff, 0xcc99ff, 0x8844dd, 0x5522aa],
        speed: { min: 6, max: 28 },
        angle: { min: 0, max: 360 },
        scale: { start: 2.4, end: 0 },
        alpha: { start: 0.55, end: 0 },
        lifespan: { min: 520, max: 980 },
        gravityY: -18,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(7);

    this.windFx = this.add
      .particles(0, 0, 'particle', {
        tint: [0xffffff, 0xc8e8ff, 0xa8d8ff, 0x88c8ff, 0xe8f4ff],
        speed: { min: 90, max: 220 },
        angle: { min: -12, max: 12 },
        scale: { start: 1.6, end: 0.15 },
        alpha: { start: 0.7, end: 0 },
        lifespan: { min: 280, max: 520 },
        gravityY: 0,
        frequency: -1,
        emitting: false,
        blendMode: 'ADD',
      })
      .setDepth(8);

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

  /** Rastro de escapamento do buscapé — chama atrás do foguete. */
  emitRocketTrail(sprite, x, y, vx = 0, vy = 0) {
    if (!this.fireballFx) return;
    const now = this.time.now;
    if (now - (sprite.lastRocketTrailAt || 0) < 18) {
      this.ensureProjectileGlow(sprite, x, y, 0xff6622, 18);
      return;
    }
    sprite.lastRocketTrailAt = now;
    const speed = Math.hypot(vx || 0, vy || 0) || 1;
    const bx = x - ((vx || 0) / speed) * 10;
    const by = y - ((vy || 0) / speed) * 10;
    const ang = Phaser.Math.RadToDeg(Math.atan2(vy || 0, vx || 1));
    this.fireballFx.setEmitterAngle({ min: ang + 155, max: ang + 205 });
    this.fireballFx.setParticleSpeed({ min: 40, max: 110 });
    this.fireballFx.emitParticleAt(bx, by, 4);
    this.sparkFx?.emitParticleAt(bx, by, 1);
    this.ensureProjectileGlow(sprite, x, y, 0xff6622, 18);
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
    if (
      spell === 'firebolt' ||
      spell === 'fireball' ||
      spell === 'firebreath' ||
      spell === 'tiro_de_buscape' ||
      spell === 'rocket' ||
      e.type === 'nova' ||
      e.type === 'firebreath' ||
      spell === 'flame_nova'
    ) {
      const isRocket = spell === 'tiro_de_buscape' || spell === 'rocket';
      this.fireballFx?.emitParticleAt(
        x,
        y,
        e.type === 'firebreath' ? 22 : isRocket ? 26 : 14
      );
      this.sparkFx?.emitParticleAt(
        x,
        y,
        e.type === 'firebreath' ? 12 : isRocket ? 18 : 8
      );
      if (isRocket) this.meteorFx?.emitParticleAt(x, y, 10);
    } else if (spell === 'ice_shard' || spell === 'water_orb' || e.type === 'freeze') {
      this.iceFx?.emitParticleAt(x, y, 16);
      this.sparkFx?.emitParticleAt(x, y, 6);
    } else if (spell === 'vine_spike') {
      this.poisonFx?.emitParticleAt?.(x, y, 14);
      this.sparkFx?.emitParticleAt(x, y, 6);
    } else if (
      spell === 'arc_lightning' ||
      spell === 'storm_call' ||
      spell === 'electric_bolt' ||
      spell === 'electric_storm' ||
      e.type === 'lightning' ||
      e.type === 'sky_lightning' ||
      e.type === 'electric_storm'
    ) {
      this.sparkFx?.emitParticleAt(e.x1 ?? x, e.y1 ?? y, 10);
      this.sparkFx?.emitParticleAt(e.x2 ?? x, e.y2 ?? y, 16);
      if (e.type === 'sky_lightning' || e.type === 'electric_storm') {
        this.sparkFx?.emitParticleAt(e.x2 ?? e.x ?? x, e.y2 ?? e.y ?? y, 20);
      }
    } else if (spell === 'skull_bolt') {
      this.necroFx?.emitParticleAt(x, y, 16);
      this.sparkFx?.emitParticleAt(x, y, 6);
    } else if (
      e.type === 'boss_nova' ||
      e.type === 'boss_strike' ||
      spell === 'soul_rend' ||
      spell === 'void_collapse' ||
      spell === 'death_knell' ||
      spell === 'cataclysm_beam' ||
      spell === 'blood_pact' ||
      spell === 'abyss_nova' ||
      spell === 'frost_apocalypse' ||
      spell === 'plague_burst' ||
      spell === 'infernal_judgment' ||
      spell === 'shadow_eclipse'
    ) {
      this.necroFx?.emitParticleAt(x, y, 20);
      this.sparkFx?.emitParticleAt(x, y, 14);
      this.magicFx?.emitParticleAt(x, y, 10);
      if (spell === 'frost_apocalypse') this.iceFx?.emitParticleAt(x, y, 16);
      if (spell === 'infernal_judgment' || spell === 'blood_pact') {
        this.fireballFx?.emitParticleAt(x, y, 16);
      }
      if (spell === 'plague_burst') this.poisonFx?.emitParticleAt?.(x, y, 14);
    } else if (e.type === 'heal' || e.type === 'mass_heal_strike' || spell === 'mend') {
      this.healFx?.emitParticleAt(x, y, e.type === 'mass_heal_strike' ? 22 : 12);
      if (e.type === 'mass_heal_strike') {
        this.magicFx?.emitParticleAt(x, y, 10);
      }
    } else if (
      e.type === 'cooldown_mist_strike' ||
      e.type === 'cooldown_mist'
    ) {
      this.mistFx?.emitParticleAt(x, y, e.type === 'cooldown_mist_strike' ? 26 : 14);
      this.magicFx?.emitParticleAt(x, y, 8);
    } else if (e.type === 'gale_strike') {
      const deg = Phaser.Math.RadToDeg(e.angle || 0);
      this.windFx?.setEmitterAngle({ min: deg - 14, max: deg + 14 });
      this.windFx?.setParticleSpeed({ min: 120, max: 260 });
      this.windFx?.emitParticleAt(x, y, 28);
      this.magicFx?.emitParticleAt(x, y, 6);
    } else if (e.type === 'lever_pulled') {
      this.magicFx?.emitParticleAt(x, y, 16);
      this.sparkFx?.emitParticleAt(x, y, 10);
      this.healFx?.emitParticleAt(x, y, 8);
    } else if (e.type === 'blink') {
      this.magicFx?.emitParticleAt(x, y, 14);
    } else if (e.type === 'barrier') {
      this.magicFx?.emitParticleAt(x, y, 10);
      this.sparkFx?.emitParticleAt(x, y, 6);
    } else if (e.type === 'poison_burst' || spell === 'poison_cloud') {
      this.poisonFx?.emitParticleAt(x, y, 18);
    } else if (e.type === 'apocalypse') {
      this.fireballFx?.emitParticleAt(x, y, 22);
      this.meteorFx?.emitParticleAt(x, y, 12);
      this.sparkFx?.emitParticleAt(x, y, 16);
      this.magicFx?.emitParticleAt(x, y, 8);
    } else if (e.type === 'meteor_strike' || spell === 'meteor') {
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
      ice_stone: ['rock_ice_stone_0', 'rock_ice_stone_1', 'rock_ice_stone_2'],
      ice_rock: ['rock_ice_rock_0', 'rock_ice_rock_1', 'rock_ice_rock_2'],
      ice_boulder: ['rock_ice_boulder_0', 'rock_ice_boulder_1', 'rock_ice_boulder_2'],
      chair: ['furn_chair_0', 'furn_chair_1', 'furn_chair_2'],
      crate: ['furn_crate_0', 'furn_crate_1', 'furn_crate_2'],
      table: ['furn_table_0', 'furn_table_1', 'furn_table_2'],
      cabinet: ['furn_cabinet_0', 'furn_cabinet_1', 'furn_cabinet_2'],
      shell: ['shell_shell_0', 'shell_shell_1', 'shell_shell_2'],
      conch: ['shell_conch_0', 'shell_conch_1', 'shell_conch_2'],
      clam: ['shell_clam_0', 'shell_clam_1', 'shell_clam_2'],
      cactus_small: ['cactus_small_0', 'cactus_small_1', 'cactus_small_2'],
      cactus: ['cactus_med_0', 'cactus_med_1', 'cactus_med_2'],
      cactus_tall: ['cactus_tall_0', 'cactus_tall_1', 'cactus_tall_2'],
      puddle_small: ['puddle_small_0', 'puddle_small_1', 'puddle_small_2'],
      puddle: ['puddle_med_0', 'puddle_med_1', 'puddle_med_2'],
      puddle_large: ['puddle_large_0', 'puddle_large_1', 'puddle_large_2'],
      ember_stone: ['volc_ember_0', 'volc_ember_1', 'volc_ember_2'],
      lava_rock: ['volc_lava_0', 'volc_lava_1', 'volc_lava_2'],
      obsidian: ['volc_obsidian_0', 'volc_obsidian_1', 'volc_obsidian_2'],
      rubble: ['ruin_rubble_0', 'ruin_rubble_1', 'ruin_rubble_2'],
      broken_pillar: ['ruin_pillar_0', 'ruin_pillar_1', 'ruin_pillar_2'],
      statue: ['ruin_statue_0', 'ruin_statue_1', 'ruin_statue_2'],
      crystal_small: ['crystal_small_0', 'crystal_small_1', 'crystal_small_2'],
      crystal: ['crystal_med_0', 'crystal_med_1', 'crystal_med_2'],
      crystal_large: ['crystal_large_0', 'crystal_large_1', 'crystal_large_2'],
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
        const isFurniture = ['chair', 'crate', 'table', 'cabinet'].includes(rock.type);
        const isCactus = ['cactus_small', 'cactus', 'cactus_tall'].includes(rock.type);
        const isPuddle = ['puddle_small', 'puddle', 'puddle_large'].includes(rock.type);
        const isPillar = rock.type === 'broken_pillar' || rock.type === 'statue';
        const isCrystal = ['crystal_small', 'crystal', 'crystal_large'].includes(rock.type);
        const isBoulder =
          rock.type === 'boulder' ||
          rock.type === 'ice_boulder' ||
          rock.type === 'cabinet' ||
          rock.type === 'clam' ||
          rock.type === 'cactus_tall' ||
          rock.type === 'puddle_large' ||
          rock.type === 'obsidian' ||
          rock.type === 'statue' ||
          rock.type === 'crystal_large';
        const isRock =
          rock.type === 'rock' ||
          rock.type === 'ice_rock' ||
          rock.type === 'table' ||
          rock.type === 'conch' ||
          rock.type === 'cactus' ||
          rock.type === 'puddle' ||
          rock.type === 'lava_rock' ||
          rock.type === 'broken_pillar' ||
          rock.type === 'crystal';
        const baseScale = isBoulder ? 1.2 : isRock ? 1.08 : rock.type === 'crate' ? 1.04 : 1;
        const scaleJitter = 0.9 + ((h >>> 8) % 25) / 100;
        // Poças no chão; cactos/pilares/cristais retos; móveis quase retos; pedras giram
        const rot = isPuddle
          ? (((h >>> 3) % 9) - 4) * 0.04
          : isCactus || isPillar || isCrystal
            ? (((h >>> 3) % 5) - 2) * 0.012
            : isFurniture
              ? (((h >>> 3) % 5) - 2) * 0.015
              : (((h >>> 3) % 21) - 10) * 0.02;
        s = this.add
          .image(rock.x, rock.y, key)
          .setDepth(isPuddle ? 4 : 5)
          .setOrigin(0.5, isPuddle ? 0.5 : 0.7)
          .setScale(baseScale * scaleJitter)
          .setFlipX((h & 1) === 1)
          .setRotation(rot);
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

  renderTrees() {
    const trees = this.state.trees || [];
    const seen = new Set();
    const variants = {
      pine: ['tree_pine_0', 'tree_pine_1'],
      oak: ['tree_oak_0', 'tree_oak_1'],
      bush: ['tree_bush_0', 'tree_bush_1'],
      mangrove: ['tree_mangrove_0', 'tree_mangrove_1'],
      swamp_oak: ['tree_swamp_oak_0', 'tree_swamp_oak_1'],
      swamp_bush: ['tree_swamp_bush_0', 'tree_swamp_bush_1'],
    };

    const hashId = (id) => {
      let h = 0;
      const s = String(id);
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h;
    };

    for (const tree of trees) {
      seen.add(tree.id);
      let s = this.treeSprites.get(tree.id);
      if (!s) {
        const list = variants[tree.type] || variants.oak;
        const h = hashId(tree.id);
        const key = list[h % list.length];
        if (!this.textures.exists(key)) continue;
        const baseScale =
          tree.type === 'oak' || tree.type === 'swamp_oak'
            ? 1.15
            : tree.type === 'pine' || tree.type === 'mangrove'
              ? 1.05
              : 0.95;
        const scaleJitter = 0.9 + ((h >>> 8) % 25) / 100;
        const scale = baseScale * scaleJitter * 1.35;
        const flip = (h & 1) === 1;

        // Contorno/sombra no chão + silhueta escura atrás (contraste na grama)
        const padW = (tree.radius || 14) * 2.6;
        const padH = (tree.radius || 14) * 1.25;
        const pad = this.add.ellipse(0, 2, padW, padH, 0x101808, 0.55);
        const outline = this.add
          .image(0, 0, key)
          .setOrigin(0.5, 0.9)
          .setScale(scale * 1.12)
          .setTint(0x0a1208)
          .setAlpha(0.95)
          .setFlipX(flip);
        const img = this.add
          .image(0, 0, key)
          .setOrigin(0.5, 0.9)
          .setScale(scale)
          .setFlipX(flip);

        s = this.add.container(tree.x, tree.y, [pad, outline, img]).setDepth(6);
        this.treeSprites.set(tree.id, s);
      } else {
        s.setPosition(tree.x, tree.y);
      }
    }

    for (const [id, s] of this.treeSprites) {
      if (!seen.has(id)) {
        s.destroy();
        this.treeSprites.delete(id);
      }
    }
  }

  floorTextureKey(floorType) {
    const floorTextures = {
      grass: 'arena_grass',
      ice: 'arena_ice',
      wood: 'arena_wood',
      sea: 'arena_sea',
      desert: 'arena_desert',
      swamp: 'arena_swamp',
      volcano: 'arena_volcano',
      ruins: 'arena_ruins',
      crystal: 'arena_crystal',
      snow: 'arena_snow',
      tundra: 'arena_tundra',
      cave: 'arena_cave',
      dungeon: 'arena_dungeon',
      graveyard: 'arena_graveyard',
      hell: 'arena_hell',
      sky: 'arena_sky',
      mushroom: 'arena_mushroom',
      jungle: 'arena_jungle',
      mountain: 'arena_mountain',
      beach: 'arena_beach',
      coral: 'arena_coral',
      ashland: 'arena_ashland',
      enchanted: 'arena_enchanted',
      blood: 'arena_blood',
      shadow: 'arena_shadow',
      temple: 'arena_temple',
      sewer: 'arena_sewer',
      meadow: 'arena_meadow',
      lava_field: 'arena_lava_field',
      glacier: 'arena_glacier',
      oasis: 'arena_oasis',
      canyon: 'arena_canyon',
      marsh: 'arena_marsh',
      aurora: 'arena_aurora',
      obsidian: 'arena_obsidian',
      sandstone: 'arena_sandstone',
      storm: 'arena_storm',
      garden: 'arena_garden',
      battlefield: 'arena_battlefield',
      library: 'arena_library',
      catacomb: 'arena_catacomb',
      abyss: 'arena_abyss',
      bramble: 'arena_bramble',
      saltflat: 'arena_saltflat',
      crystal_cave: 'arena_crystal_cave',
      bat_cave: 'arena_bat_cave',
      vampire_castle: 'arena_vampire_castle',
      throne_hall: 'arena_throne_hall',
      crypt: 'arena_crypt',
      dirt: 'arena_brick',
    };
    return floorTextures[floorType] || 'arena_brick';
  }

  beginArenaFloorTransition(fromType, toType, round = null) {
    const toKey = this.floorTextureKey(toType);
    if (!this.textures.exists(toKey) || !this.arenaFloorNext) return;

    this.floorTransition = {
      active: true,
      fromType,
      toType,
      startedAt: this.time.now,
      duration: 1200,
    };

    this.arenaFloorNext.setTexture(toKey);
    this.arenaFloorNext.setAlpha(0);
    this.arenaFloorNext.tilePositionX = 0;
    this.arenaFloorNext.tilePositionY = 0;

    const mapName = this.arenaMapName(toType);
    const roundLine = round != null ? `Round ${round}\n` : '';
    this.bannerText.setText(`${roundLine}Mapa ${mapName}`);
    this.bannerText.setAlpha(1);

    this.tweens.killTweensOf(this.mapText);
    this.mapText.setColor('#c4b5ff');
    this.tweens.add({
      targets: this.mapText,
      scale: 1.08,
      duration: 180,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.mapText.setScale(1);
        this.mapText.setColor('#a99bc8');
      },
    });

    this.tweens.killTweensOf(this.arenaGraphics);
    this.tweens.add({
      targets: this.arenaGraphics,
      alpha: { from: 1, to: 0.55 },
      duration: 120,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  updateFloorTransition() {
    const tr = this.floorTransition;
    if (!tr?.active || !this.arenaFloorNext) return;

    const p = Phaser.Math.Clamp((this.time.now - tr.startedAt) / tr.duration, 0, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    this.arenaFloor.setAlpha(1 - ease);
    this.arenaFloorNext.setAlpha(ease);
    this.arenaFloorNext.tilePositionX = ease * 56;
    this.arenaFloorNext.tilePositionY = ease * 28;

    if (p >= 1) {
      const key = this.floorTextureKey(tr.toType);
      this.arenaFloor.setTexture(key).setAlpha(1);
      this.arenaFloor.tilePositionX = this.arenaFloorNext.tilePositionX;
      this.arenaFloor.tilePositionY = this.arenaFloorNext.tilePositionY;
      this.arenaFloorNext.setAlpha(0);
      this.arenaFloorNext.tilePositionX = 0;
      this.arenaFloorNext.tilePositionY = 0;
      this.displayedFloorType = tr.toType;
      tr.active = false;
    }
  }

  arenaMapName(floorType) {
    const names = {
      dirt: 'Terra',
      grass: 'Floresta',
      ice: 'Gelo',
      wood: 'Madeira',
      sea: 'Mar',
      desert: 'Deserto',
      swamp: 'Pântano',
      volcano: 'Vulcão',
      ruins: 'Ruínas',
      crystal: 'Cristal',
      snow: 'Neve',
      tundra: 'Tundra',
      cave: 'Caverna',
      dungeon: 'Masmorra',
      graveyard: 'Cemitério',
      hell: 'Inferno',
      sky: 'Céu',
      mushroom: 'Cogumelos',
      jungle: 'Selva',
      mountain: 'Montanha',
      beach: 'Praia',
      coral: 'Recife',
      ashland: 'Cinzas',
      enchanted: 'Encantado',
      blood: 'Sangue',
      shadow: 'Sombras',
      temple: 'Templo',
      sewer: 'Esgoto',
      meadow: 'Prado',
      lava_field: 'Campo de Lava',
      glacier: 'Geleira',
      oasis: 'Oásis',
      canyon: 'Cânion',
      marsh: 'Charco',
      aurora: 'Aurora',
      obsidian: 'Obsidiana',
      sandstone: 'Arenito',
      storm: 'Tempestade',
      garden: 'Jardim',
      battlefield: 'Campo de Batalha',
      library: 'Biblioteca',
      catacomb: 'Catacumba',
      abyss: 'Abismo',
      bramble: 'Espinhos',
      saltflat: 'Salina',
      crystal_cave: 'Caverna de Cristal',
      bat_cave: 'Caverna dos Morcegos',
      vampire_castle: 'Castelo Vampírico',
      throne_hall: 'Salão do Trono',
      crypt: 'Cripta',
    };
    return names[floorType] || 'Arena';
  }

  showStatusTooltip(index) {
    const slot = this.statusSlots?.[index];
    const eff = slot?.effect;
    if (!eff || !this.statusTooltip) return;
    this.statusTooltipEffect = index;
    this.statusTooltipTitle.setText(eff.name || 'Efeito');
    this.statusTooltipBody.setText(eff.description || '');
    const pad = 8;
    const titleH = this.statusTooltipTitle.height;
    const bodyH = this.statusTooltipBody.height;
    const w = Math.max(
      160,
      Math.min(220, Math.max(this.statusTooltipTitle.width, this.statusTooltipBody.width) + pad * 2)
    );
    this.statusTooltipTitle.setWordWrapWidth(w - pad * 2);
    this.statusTooltipBody.setWordWrapWidth(w - pad * 2);
    this.statusTooltipBody.setY(6 + titleH + 4);
    const h = 6 + this.statusTooltipTitle.height + 4 + this.statusTooltipBody.height + 8;
    this.statusTooltipBg.setSize(w, h);
    this.statusTooltipBg.setStrokeStyle(1, eff.color ?? 0x8b7cff);
    const { width, height } = this.scale;
    let x = slot.container.x + 18;
    let y = slot.container.y + 18;
    if (x + w > width - 8) x = Math.max(8, slot.container.x - w - 4);
    if (y + h > height - 8) y = Math.max(8, slot.container.y - h - 4);
    this.statusTooltip.setPosition(x, y).setVisible(true);
  }

  hideStatusTooltip(index) {
    if (this.statusTooltipEffect !== index && this.statusTooltipEffect != null) return;
    this.statusTooltipEffect = null;
    this.statusTooltip?.setVisible(false);
  }

  refreshStatusTooltip() {
    if (this.statusTooltipEffect == null) return;
    const slot = this.statusSlots?.[this.statusTooltipEffect];
    if (!slot?.effect) {
      this.hideStatusTooltip(this.statusTooltipEffect);
      return;
    }
    const eff = slot.effect;
    const sameText =
      this.statusTooltipTitle.text === (eff.name || 'Efeito') &&
      this.statusTooltipBody.text === (eff.description || '');
    if (sameText && this.statusTooltip.visible) {
      const { width, height } = this.scale;
      const w = this.statusTooltipBg.width;
      const h = this.statusTooltipBg.height;
      let x = slot.container.x + 18;
      let y = slot.container.y + 18;
      if (x + w > width - 8) x = Math.max(8, slot.container.x - w - 4);
      if (y + h > height - 8) y = Math.max(8, slot.container.y - h - 4);
      this.statusTooltip.setPosition(x, y);
      return;
    }
    this.showStatusTooltip(this.statusTooltipEffect);
  }

  /** Ventania ativa cobrindo o jogador local. */
  activeGaleOnMe(me) {
    if (!me?.alive) return null;
    for (const e of this.state?.effects || []) {
      if (e.type !== 'gale_strike') continue;
      const r = Number(e.radius) || 0;
      if (Math.hypot((e.x || 0) - me.x, (e.y || 0) - me.y) <= r + PLAYER_RADIUS) {
        return e;
      }
    }
    return null;
  }

  renderArena() {
    const a = this.state.arena;
    const diameter = Math.max(2, a.radius * 2);

    this.updateLavaEffects(a);

    const floorKey = this.floorTextureKey(a.floorType);
    const transitioning = !!this.floorTransition?.active;
    if (
      !transitioning &&
      this.textures.exists(floorKey) &&
      this.arenaFloor.texture.key !== floorKey
    ) {
      this.arenaFloor.setTexture(floorKey);
      this.displayedFloorType = a.floorType;
    } else if (!this.displayedFloorType && a.floorType) {
      this.displayedFloorType = a.floorType;
    }

    this.arenaFloor.setPosition(a.x, a.y);
    this.arenaFloorNext?.setPosition(a.x, a.y);
    // Keep TileSprite at max size; only the mask shrinks. Resizing every frame
    // shifts UV from the top-left and makes the floor look like it's crawling.
    if (diameter > this.arenaFloor.width) {
      this.arenaFloor.setSize(diameter, diameter);
      this.arenaFloorNext?.setSize(diameter, diameter);
    }

    this.arenaMaskGfx.clear();
    this.arenaMaskGfx.fillStyle(0xffffff, 1);
    this.arenaMaskGfx.fillCircle(a.x, a.y, a.radius);

    this.arenaGraphics.clear();
    this.drawArenaIronRim(a);
    this.drawArenaFireWall(a);
  }

  /** Margem de blocos de ferro no perímetro da plataforma. */
  drawArenaIronRim(a) {
    if (!this.textures.exists('iron_block')) return;

    const blockPx = 32; // textura 16×16 × scale 2
    const rimInset = 10; // centro do bloco um pouco para dentro da borda
    const scale = 0.72;
    const spacing = blockPx * scale * 0.92;
    const r = Math.max(8, a.radius - rimInset);
    const count = Math.max(12, Math.floor((Math.PI * 2 * r) / spacing));

    while (this.arenaIronSprites.length < count) {
      const sprite = this.add
        .image(0, 0, 'iron_block')
        .setDepth(1)
        .setOrigin(0.5, 0.5)
        .setVisible(false);
      this.arenaIronSprites.push(sprite);
    }

    for (let i = 0; i < this.arenaIronSprites.length; i++) {
      const sprite = this.arenaIronSprites[i];
      if (i >= count) {
        sprite.setVisible(false);
        continue;
      }
      const ang = (i / count) * Math.PI * 2;
      sprite.setVisible(true);
      sprite.setPosition(a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r);
      // Face externa alinhada à circunferência
      sprite.setRotation(ang + Math.PI / 2);
      sprite.setScale(scale);
    }
  }

  drawArenaFireWall(a) {
    if (!ARENA_BORDER_FX_ENABLED) return;
    const t = this.time.now;
    // Ritmo lento e contraste baixo — menos “luz neon”
    const pulse = 0.78 + 0.22 * Math.sin(t / 420);
    const flicker = 0.82 + 0.18 * Math.sin(t / 360 + 1.1);
    const spin = t * 0.00012;

    // Halo externo — campo de energia
    this.arenaGraphics.lineStyle(18, 0x1a0840, 0.12 * flicker);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius + 3);
    this.arenaGraphics.lineStyle(12, 0x3a1878, 0.14 * pulse);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius + 1);
    this.arenaGraphics.lineStyle(8, 0x5a3098, 0.18 * flicker);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius);
    this.arenaGraphics.lineStyle(4, 0x3a6a88, 0.2 * pulse);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius - 1);
    this.arenaGraphics.lineStyle(1.5, 0x88aacc, 0.28 * flicker);
    this.arenaGraphics.strokeCircle(a.x, a.y, a.radius - 2);

    // Arcos rotativos (anel mágico)
    const arcs = 4;
    for (let k = 0; k < arcs; k++) {
      const start = spin * (k % 2 === 0 ? 1 : -1) + (k / arcs) * Math.PI * 2;
      const sweep = 0.45 + 0.1 * Math.sin(t * 0.0025 + k);
      this.arenaGraphics.lineStyle(2.2, k % 2 === 0 ? 0x7a48b0 : 0x4a88a8, 0.22 * pulse);
      this.arenaGraphics.beginPath();
      this.arenaGraphics.arc(a.x, a.y, a.radius + 2, start, start + sweep, false);
      this.arenaGraphics.strokePath();
    }

    // Raios de energia radiais (parede)
    const tongues = Math.max(22, Math.floor(a.radius * 0.4));
    for (let i = 0; i < tongues; i++) {
      const ang = (i / tongues) * Math.PI * 2 + spin * 0.25;
      const wobble = 0.7 + 0.3 * Math.sin(t * 0.004 + i * 2.1);
      const height = (6 + (i % 5) * 1.4 + 3.5 * Math.sin(t * 0.003 + i * 1.4)) * wobble;
      const baseR = a.radius - 1;
      const tipR = a.radius + height;
      const x0 = a.x + Math.cos(ang) * baseR;
      const y0 = a.y + Math.sin(ang) * baseR;
      const midR = (baseR + tipR) * 0.55;
      const xM = a.x + Math.cos(ang) * midR;
      const yM = a.y + Math.sin(ang) * midR;
      const x1 = a.x + Math.cos(ang) * tipR;
      const y1 = a.y + Math.sin(ang) * tipR;

      this.arenaGraphics.lineStyle(3.5, 0x3a1878, 0.16 * wobble);
      this.arenaGraphics.lineBetween(x0, y0, x1, y1);
      this.arenaGraphics.lineStyle(2.0, 0x3a6a88, 0.22 * wobble);
      this.arenaGraphics.lineBetween(x0, y0, xM, yM);
      this.arenaGraphics.lineStyle(1.0, 0x88aacc, 0.28 * wobble);
      this.arenaGraphics.lineBetween(
        x0,
        y0,
        a.x + Math.cos(ang) * (baseR + height * 0.35),
        a.y + Math.sin(ang) * (baseR + height * 0.35)
      );
    }

    // Partículas de energia ao longo da circunferência (esparsas)
    if (!this.arenaFireWall) return;
    const steps = Math.max(16, Math.floor((Math.PI * 2 * a.radius) / 36));
    const frame = Math.floor(t / 90);
    for (let i = 0; i < steps; i++) {
      if ((i + frame) % 5 !== 0) continue;
      const ang = (i / steps) * Math.PI * 2 + spin;
      const jitter = Math.sin(t * 0.006 + i * 0.7) * 2;
      const r = a.radius + jitter;
      const x = a.x + Math.cos(ang) * r;
      const y = a.y + Math.sin(ang) * r;
      this.arenaFireWall.emitParticleAt(x, y, 1);
      if (this.arenaFireEmbers && (i + frame) % 10 === 0) {
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

  wizardTexture(type, color, skin) {
    if (color != null && Number.isFinite(Number(color))) {
      return ensureWizardColorTexture(this, Number(color) >>> 0, skin);
    }
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
      const tex = this.wizardTexture(p.wizardType, p.color, p.skin);
      const s = this.ensureActor(this.playerSprites, p.id, tex, 20);
      s.clearTint();
      s.setAlpha(p.alive ? 1 : 0.25);

      const speed = Math.hypot(p.vx || 0, p.vy || 0);
      const walking = p.alive && !p.dashing && !p.stun && speed > 18;
      const walkKey = `${tex}_walk`;
      if (walking && this.anims.exists(walkKey)) {
        if (s.anims.currentAnim?.key !== walkKey || !s.anims.isPlaying) {
          s.play(walkKey);
        }
        s.anims.timeScale = Phaser.Math.Clamp(speed / 110, 0.75, 1.7);
        const bob = Math.sin(this.time.now / 65) * 1.4;
        s.setPosition(p.x, p.y + bob);
      } else {
        if (s.anims?.isPlaying) s.anims.stop();
        if (s.texture.key !== tex) s.setTexture(tex);
        s.setPosition(p.x, p.y);
      }

      if (Math.abs(p.vx || 0) > 12) s.setFlipX(p.vx < 0);

      const baseScale = p.id === this.playerId ? 1.5 : 1.35;
      if (p.dashing && p.alive) {
        if (s.anims?.isPlaying) s.anims.stop();
        if (s.texture.key !== tex) s.setTexture(tex);
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
      const burning = p.alive && (Number(p.burnTimer) || 0) > 0;
      if (p.alive && !onLava) {
        const dustVx = p.dashing ? (p.vx || 0) * 1.4 : p.vx;
        const dustVy = p.dashing ? (p.vy || 0) * 1.4 : p.vy;
        this.emitMoveDust(s, p.x, p.y, dustVx, dustVy);
      }
      // Lava ou queimadura (Flame Nova): mesmo feedback visual de fogo
      this.updateLavaBurn(s, p.x, p.y, onLava || burning);

      const hasShield = p.alive && p.shield > 0;
      const isSelf = p.id === this.playerId;
      const hpY = p.y - 32;
      const shieldY = hpY - 7;
      const nameY = hasShield ? p.y - 50 : p.y - 42;

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
            .circle(p.x, p.y, 30, 0x88aaff, 0.15)
            .setStrokeStyle(2, 0x88aaff, 0.85)
            .setDepth(19);
        }
        if (!s.shieldRingOuter) {
          s.shieldRingOuter = this.add
            .circle(p.x, p.y, 36, 0x88aaff, 0)
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
    return monsterLabelOf(type);
  }

  renderMonsters() {
    const seen = new Set();
    const VISUAL_SCALE = 1.3;
    for (const m of this.state.monsters) {
      seen.add(m.entityId);
      const tex = this.monsterTexture(m.type);
      const s = this.ensureActor(this.monsterSprites, m.entityId, tex, 15);
      const scale = ((m.radius || 14) / 14) * VISUAL_SCALE;
      s.setScale(scale);

      if (s.prevHp != null && m.hp < s.prevHp) {
        s.hurtUntil = this.time.now + 240;
      }
      s.prevHp = m.hp;

      const speed = Math.hypot(m.vx || 0, m.vy || 0);
      const walking = speed > 16;
      const walkKey = `${tex}_walk`;
      const idleKey = `${tex}_idle`;
      const attackKey = `${tex}_attack`;
      const hurtKey = `${tex}_hurt`;
      const hurting = s.hurtUntil != null && this.time.now < s.hurtUntil;
      const attacking = m.pose === 'attack';
      const current = s.anims?.currentAnim?.key;

      if (hurting && this.anims.exists(hurtKey)) {
        if (current !== hurtKey || !s.anims.isPlaying) s.play(hurtKey);
        s.setTint(0xff7777);
      } else if (attacking && this.anims.exists(attackKey)) {
        if (current !== attackKey || !s.anims.isPlaying) s.play(attackKey);
        s.clearTint();
      } else if (walking && this.anims.exists(walkKey)) {
        if (current !== walkKey || !s.anims.isPlaying) s.play(walkKey);
        s.anims.timeScale = Phaser.Math.Clamp(speed / 100, 0.7, 1.8);
        s.clearTint();
      } else if (this.anims.exists(idleKey)) {
        if (current !== idleKey || !s.anims.isPlaying) s.play(idleKey);
        s.clearTint();
      } else {
        if (s.anims?.isPlaying) s.anims.stop();
        if (s.texture.key !== tex) s.setTexture(tex);
        s.clearTint();
      }

      if (s.walkPhase == null) s.walkPhase = Math.random() * Math.PI * 2;
      const bobAmp = walking ? 1.4 : 0.7;
      const bob =
        Math.sin(this.time.now / (walking ? 70 : 140) + s.walkPhase) * bobAmp * scale;
      s.setPosition(m.x, m.y + bob);

      if (Math.abs(m.vx || 0) > 10) s.setFlipX(m.vx < 0);

      this.emitMoveDust(s, m.x, m.y, m.vx, m.vy);
      const hasShield = (m.shield || 0) > 0;
      const tagY = m.y - (hasShield ? 36 : 28) * scale;
      const tier =
        m.isBoss ? '★ ' : m.isElite ? '◆ ' : '';
      s.nameTag.setText(`${tier}${this.monsterLabel(m.type)} Lv${m.level || 1}`);
      s.nameTag.setPosition(m.x, tagY);
      s.hpBg.setPosition(m.x, tagY + 8);
      const ratio = m.maxHp ? m.hp / m.maxHp : 0;
      s.hpFg.setPosition(m.x - 16 + 16 * ratio, tagY + 8);
      s.hpFg.width = 32 * ratio;
      s.hpFg.setFillStyle(m.isBoss ? 0xc0392b : m.isElite ? 0x8e44ad : 0xe67e22);

      if (hasShield) {
        const maxShield = m.maxShield > 0 ? m.maxShield : m.shield;
        const sRatio = Math.min(1, m.shield / maxShield);
        const shieldY = tagY + 14;
        if (!s.shieldBg) {
          s.shieldBg = this.add.rectangle(0, 0, 32, 3, 0x0a1830, 0.75).setDepth(21);
          s.shieldFg = this.add.rectangle(0, 0, 32, 3, 0x4a90ff).setDepth(22);
        }
        s.shieldBg.setPosition(m.x, shieldY).setVisible(true);
        s.shieldFg.setPosition(m.x - 16 + 16 * sRatio, shieldY).setVisible(true);
        s.shieldFg.width = 32 * sRatio;

        const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 140);
        const ringR = Math.max(28, (m.radius || 14) * VISUAL_SCALE + 10);
        if (!s.shieldRing) {
          s.shieldRing = this.add
            .circle(m.x, m.y, ringR, 0x88aaff, 0.15)
            .setStrokeStyle(2, 0x88aaff, 0.85)
            .setDepth(14);
        }
        if (!s.shieldRingOuter) {
          s.shieldRingOuter = this.add
            .circle(m.x, m.y, ringR + 6, 0x88aaff, 0)
            .setStrokeStyle(1.5, 0xaaccff, 0.55)
            .setDepth(13);
        }
        s.shieldRing.setPosition(m.x, m.y).setVisible(true);
        s.shieldRing.setScale(0.95 + 0.12 * pulse);
        s.shieldRing.setAlpha(0.35 + 0.25 * pulse);
        s.shieldRingOuter.setPosition(m.x, m.y).setVisible(true);
        s.shieldRingOuter.setScale(1 + 0.08 * pulse);
        s.shieldRingOuter.setAlpha(0.35 + 0.3 * pulse);
      } else {
        if (s.shieldBg) s.shieldBg.setVisible(false);
        if (s.shieldFg) s.shieldFg.setVisible(false);
        if (s.shieldRing) s.shieldRing.setVisible(false);
        if (s.shieldRingOuter) s.shieldRingOuter.setVisible(false);
      }
    }
    for (const [id, s] of this.monsterSprites) {
      if (!seen.has(id)) {
        // Cadáveres vêm do servidor (bones) / evento monster_kill — não recriar aqui,
        // senão o wipe entre rounds espalha corpos de novo no chão.
        s.destroy();
        s.nameTag.destroy();
        s.hpBg.destroy();
        s.hpFg.destroy();
        s.shieldBg?.destroy();
        s.shieldFg?.destroy();
        s.shieldRing?.destroy();
        s.shieldRingOuter?.destroy();
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
    if (
      (kind === 'rocket' || kind === 'tiro_de_buscape') &&
      this.textures.exists('proj_rocket')
    ) {
      return 'proj_rocket';
    }
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
      } else if (kind === 'rocket' || kind === 'tiro_de_buscape') {
        const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 40);
        s.clearTint();
        s.setBlendMode(Phaser.BlendModes.NORMAL);
        s.setScale(1.15 + 0.12 * pulse);
        s.setRotation(Math.atan2(p.vy || 0, p.vx || 1) + Math.PI / 2);
        this.emitRocketTrail(s, p.x, p.y, p.vx, p.vy);
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
    this.aoeGraphics.setBlendMode(Phaser.BlendModes.NORMAL);
    const t = this.time.now / 1000;
    const aoes = this.state.aoes || [];
    for (const a of aoes) {
      if (a.spellId === 'flame_nova') {
        this.drawGroundFireAoe(a, t);
        continue;
      }
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
      if (!aoes.some((a) => a.entityId === id)) this.aoeFxAt.delete(id);
    }
  }

  /** Fração 0–1 do crescimento do fogo (centro → raio máximo). */
  aoeExpandFactor(a) {
    const expandTime = Number(a.expandTime) || 0;
    if (expandTime <= 0) return 1;
    const maxLife = a.maxLife || a.life || 1;
    const age = Math.max(0, maxLife - (a.life || 0));
    const t = Math.min(1, age / expandTime);
    return t * t * (3 - 2 * t);
  }

  /** Fogo no chão: nasce no centro e cresce até o raio máximo. */
  drawGroundFireAoe(a, t) {
    const g = this.aoeGraphics;
    const maxLife = a.maxLife || a.life || 1;
    const lifeFade = Math.min(1, Math.max(0.25, (a.life || 0) / Math.min(1.2, maxLife)));
    const pulse = 0.94 + 0.06 * Math.sin(t * 8 + (a.x || 0) * 0.02);
    const expand = this.aoeExpandFactor(a);
    const fullR = a.radius || 110;
    const r = Math.max(4, fullR * pulse * expand);
    if (expand < 0.02) return;

    g.setBlendMode(Phaser.BlendModes.ADD);

    // Núcleo branco-quente no centro (origem do fogo)
    g.fillStyle(0xffeeaa, 0.55 * lifeFade * (1.1 - expand * 0.3));
    g.fillCircle(a.x, a.y, Math.max(3, r * 0.12));
    g.fillStyle(0xffaa33, 0.4 * lifeFade);
    g.fillCircle(a.x, a.y, r * 0.28);
    g.fillStyle(0xff6622, 0.38 * lifeFade);
    g.fillCircle(a.x, a.y, r * 0.55);
    g.fillStyle(0xff2200, 0.32 * lifeFade);
    g.fillCircle(a.x, a.y, r);

    // Fatias radiais saindo do centro
    const wedges = 18;
    for (let i = 0; i < wedges; i++) {
      const flicker = 0.65 + 0.35 * Math.sin(t * 11 + i * 1.9);
      const a0 = (i / wedges) * Math.PI * 2 + t * 0.7;
      const a1 = ((i + 0.72) / wedges) * Math.PI * 2 + t * 0.7;
      const len = r * (0.7 + 0.3 * flicker);
      const x1 = a.x + Math.cos(a0) * len;
      const y1 = a.y + Math.sin(a0) * len;
      const x2 = a.x + Math.cos(a1) * len;
      const y2 = a.y + Math.sin(a1) * len;
      g.fillStyle(i % 2 === 0 ? 0xff4422 : 0xff8800, 0.55 * lifeFade * flicker);
      g.fillTriangle(a.x, a.y, x1, y1, x2, y2);
      g.fillStyle(0xffee66, 0.4 * lifeFade * flicker);
      g.fillTriangle(
        a.x,
        a.y,
        a.x + Math.cos(a0) * len * 0.45,
        a.y + Math.sin(a0) * len * 0.45,
        a.x + Math.cos(a1) * len * 0.45,
        a.y + Math.sin(a1) * len * 0.45
      );
    }

    // Anel de frente de fogo na borda em expansão
    g.lineStyle(4, 0xffee66, 0.85 * lifeFade * (0.5 + 0.5 * expand));
    g.strokeCircle(a.x, a.y, r * 0.98);
    g.lineStyle(2, 0xff5522, 0.5 * lifeFade);
    g.strokeCircle(a.x, a.y, r * 0.55);

    const tongues = 14;
    for (let i = 0; i < tongues; i++) {
      const ang = (i / tongues) * Math.PI * 2 + t * 1.2 + Math.sin(t * 5 + i) * 0.12;
      const len = r * (0.75 + 0.25 * Math.sin(t * 10 + i * 1.4));
      g.lineStyle(4, 0xff3300, 0.65 * lifeFade);
      g.lineBetween(a.x, a.y, a.x + Math.cos(ang) * len, a.y + Math.sin(ang) * len);
      g.lineStyle(2, 0xffee88, 0.85 * lifeFade);
      g.lineBetween(a.x, a.y, a.x + Math.cos(ang) * len * 0.7, a.y + Math.sin(ang) * len * 0.7);
      g.fillStyle(0xffffff, 0.6 * lifeFade);
      g.fillCircle(a.x + Math.cos(ang) * len, a.y + Math.sin(ang) * len, 2.5 + expand);
    }

    g.setBlendMode(Phaser.BlendModes.NORMAL);

    if (this.fireballFx && a.entityId != null) {
      const now = this.time.now;
      const last = this.aoeFxAt.get(a.entityId) || 0;
      if (now - last > 40) {
        this.aoeFxAt.set(a.entityId, now);
        // Partículas na frente de expansão + núcleo
        this.fireballFx.emitParticleAt(a.x, a.y, 2);
        for (let n = 0; n < 4; n++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = r * (0.55 + Math.random() * 0.45);
          const px = a.x + Math.cos(ang) * dist;
          const py = a.y + Math.sin(ang) * dist;
          this.fireballFx.emitParticleAt(px, py, 2);
          this.sparkFx?.emitParticleAt(px, py, 1);
        }
      }
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

  /** Raio caindo do céu — brilho vertical, impacto no chão e flash. */
  drawSkyLightning(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0x7cf0ff;
    const x2 = e.x2 ?? e.x ?? 0;
    const y2 = e.y2 ?? e.y ?? 0;
    const x1 = e.x1 ?? x2;
    const y1 = e.y1 ?? y2 - 320;

    // Coluna de luz no céu (antes / durante o raio)
    const columnFade = fade * (0.35 + 0.65 * (1 - Math.abs(p - 0.35)));
    g.fillStyle(0x2244aa, 0.08 * columnFade);
    g.fillRect(x2 - 10, y1, 20, y2 - y1);
    g.fillStyle(color, 0.1 * columnFade);
    g.fillRect(x2 - 4, y1, 8, y2 - y1);

    this.drawLightningBolt({
      ...e,
      type: 'lightning',
      x1,
      y1,
      x2,
      y2,
      color,
      branches: e.branches ?? 4,
    });

    // Impacto no solo
    const crack = 18 + 22 * fade;
    g.lineStyle(2.5, color, 0.55 * fade);
    g.lineBetween(x2 - crack, y2 + 2, x2 + crack, y2 + 2);
    g.lineStyle(1.5, 0xffffff, 0.7 * fade);
    g.lineBetween(x2 - crack * 0.55, y2 + 2, x2 + crack * 0.55, y2 + 2);

    g.fillStyle(0xffffff, 0.35 * fade);
    g.fillCircle(x2, y2, 10 + 8 * (1 - p));
    g.fillStyle(color, 0.22 * fade);
    g.fillCircle(x2, y2, 28 + 12 * (1 - p));
    g.lineStyle(2, color, 0.5 * fade);
    g.strokeCircle(x2, y2, 20 + 16 * p);

    // Flash do céu no topo
    if (e.flash !== false) {
      g.fillStyle(0xffffff, 0.18 * fade * (1 - p));
      g.fillEllipse(x1, y1 + 12, 48, 18);
      g.fillStyle(color, 0.2 * fade);
      g.fillEllipse(x1, y1 + 12, 28, 10);
    }
  }

  /** Nuvem de tempestade elétrica + anel de área. */
  drawElectricStorm(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const prog = this.effectProgress(e);
    const color = e.color || 0x88bbff;
    const r = (e.radius || 130) * (0.55 + 0.45 * Math.min(1, prog * 1.8));
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);

    // Solo carregado
    g.fillStyle(0x102038, 0.28 * fade);
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(color, 0.08 * fade);
    g.fillCircle(e.x, e.y, r * 0.7);
    g.lineStyle(2.5, color, 0.55 * fade);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(1.5, 0xffffff, 0.35 * fade);
    g.strokeCircle(e.x, e.y, r * 0.82);

    // Anéis elétricos pulsando
    for (let i = 0; i < 3; i++) {
      const t = (prog * 2 + i * 0.33) % 1;
      g.lineStyle(2, color, (0.45 - t * 0.35) * fade);
      g.strokeCircle(e.x, e.y, r * (0.25 + t * 0.75));
    }

    // Nuvens densas acima da área
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + prog * 2.2;
      const distN = 10 + (i % 3) * 18;
      const cx = e.x + Math.cos(a) * distN;
      const cy = e.y - 48 - Math.sin(a * 1.7) * 8;
      g.fillStyle(0x1a2438, 0.45 * fade);
      g.fillEllipse(cx, cy, 44 + (i % 3) * 6, 18);
      g.fillStyle(0x3a4a6a, 0.35 * fade);
      g.fillEllipse(cx + 6, cy - 4, 30, 12);
    }

    // Centelhas na nuvem
    for (let i = 0; i < 5; i++) {
      const sx = e.x + (rand() - 0.5) * 70;
      const sy = e.y - 52 + (rand() - 0.5) * 16;
      g.fillStyle(0xffffff, 0.55 * fade * (0.5 + rand() * 0.5));
      g.fillCircle(sx, sy, 1.5 + rand() * 2);
      g.fillStyle(color, 0.4 * fade);
      g.fillCircle(sx, sy, 3 + rand() * 2);
    }

    // Núcleo da tempestade
    g.fillStyle(color, 0.35 * fade);
    g.fillCircle(e.x, e.y - 50, 10);
    g.fillStyle(0xffffff, 0.5 * fade);
    g.fillCircle(e.x, e.y - 50, 4);
  }

  /**
   * Conjuração: mesma energia da borda da arena, subindo do chão até a cabeça.
   * (tipo de efeito no servidor continua `pentagram` por compatibilidade)
   */
  drawPentagram(e) {
    const maxLife = e.maxLife || 0.35;
    const fade = Math.min(1, e.life / maxLife);
    const t = this.time.now;
    const age = Math.max(0, maxLife - e.life);
    const pulse = 0.78 + 0.22 * Math.sin(t / 280);
    const flicker = 0.82 + 0.18 * Math.sin(t / 240 + 1.1);
    const spin = t * 0.0007 + age * 2.4;
    const rise = Math.min(1, age / 0.1);
    const baseR = (e.radius || 30.4) * (0.72 + 0.08 * pulse);
    // Sobe do chão (pés) até a cabeça do mago
    const headH = 34 + baseR * 0.15;
    const height = headH * rise * (0.88 + 0.12 * flicker);
    const spellColor = e.color || 0x88aacc;
    const g = this.effectGraphics;
    const aFade = fade * flicker;

    // Anel no chão — mesma linguagem visual da parede da arena
    g.lineStyle(12, 0x1a0840, 0.14 * aFade);
    g.strokeCircle(e.x, e.y + 6, baseR + 3);
    g.lineStyle(8, 0x3a1878, 0.18 * pulse * fade);
    g.strokeCircle(e.x, e.y + 6, baseR + 1);
    g.lineStyle(5, 0x5a3098, 0.22 * aFade);
    g.strokeCircle(e.x, e.y + 6, baseR);
    g.lineStyle(2.5, 0x3a6a88, 0.26 * pulse * fade);
    g.strokeCircle(e.x, e.y + 6, baseR - 2);
    g.lineStyle(1.2, 0x88aacc, 0.32 * aFade);
    g.strokeCircle(e.x, e.y + 6, baseR - 3);

    // Toque da cor da magia no chão
    g.lineStyle(1.5, spellColor, 0.28 * fade);
    g.strokeCircle(e.x, e.y + 6, baseR * 0.55);

    // Arcos rotativos no chão
    const arcs = 3;
    for (let k = 0; k < arcs; k++) {
      const start = spin * (k % 2 === 0 ? 1 : -1) + (k / arcs) * Math.PI * 2;
      const sweep = 0.55 + 0.12 * Math.sin(t * 0.003 + k);
      g.lineStyle(2, k % 2 === 0 ? 0x7a48b0 : 0x4a88a8, 0.3 * pulse * fade);
      g.beginPath();
      g.arc(e.x, e.y + 6, baseR + 1, start, start + sweep, false);
      g.strokePath();
    }

    // Coluna suave (chão → cabeça)
    g.fillStyle(0x3a1878, 0.08 * aFade);
    g.fillEllipse(e.x, e.y + 6 - height * 0.45, baseR * 1.1, height * 0.95);
    g.fillStyle(0x5a3098, 0.07 * pulse * fade);
    g.fillEllipse(e.x, e.y + 6 - height * 0.5, baseR * 0.7, height * 0.85);
    g.fillStyle(spellColor, 0.05 * fade);
    g.fillEllipse(e.x, e.y + 6 - height * 0.55, baseR * 0.35, height * 0.7);

    // Línguas de energia verticais (mesmo estilo da borda, mas subindo)
    const tongues = 16;
    for (let i = 0; i < tongues; i++) {
      const ang = (i / tongues) * Math.PI * 2 + spin * 0.35;
      const wobble = 0.7 + 0.3 * Math.sin(t * 0.004 + i * 2.1);
      const h = (height * 0.55 + (i % 5) * (height * 0.09) + 4 * Math.sin(t * 0.003 + i * 1.4)) * wobble;
      const ring = baseR * (0.55 + 0.35 * ((i % 3) / 2));
      const x0 = e.x + Math.cos(ang) * ring;
      const y0 = e.y + 8 + Math.sin(ang) * ring * 0.22;
      const x1 = x0 + Math.cos(ang) * 2;
      const y1 = y0 - h;
      const yM = y0 - h * 0.55;

      g.lineStyle(3.2, 0x3a1878, 0.22 * wobble * fade);
      g.lineBetween(x0, y0, x1, y1);
      g.lineStyle(2.0, 0x3a6a88, 0.3 * wobble * fade);
      g.lineBetween(x0, y0, x0, yM);
      g.lineStyle(1.1, 0x88aacc, 0.38 * wobble * fade);
      g.lineBetween(x0, y0, x0, y0 - h * 0.35);
      if (i % 3 === 0) {
        g.lineStyle(1.0, spellColor, 0.35 * wobble * fade);
        g.lineBetween(x0, y0, x0 + Math.cos(ang) * 1.5, y0 - h * 0.75);
      }
    }

    // Halo na altura da cabeça
    const headY = e.y + 6 - height;
    g.lineStyle(6, 0x3a1878, 0.16 * aFade);
    g.strokeCircle(e.x, headY, baseR * 0.35);
    g.lineStyle(2.5, 0x88aacc, 0.28 * pulse * fade);
    g.strokeCircle(e.x, headY, baseR * 0.28);
    g.lineStyle(1.2, spellColor, 0.35 * fade);
    g.strokeCircle(e.x, headY, baseR * 0.18);
    g.fillStyle(0x88aacc, 0.2 * pulse * fade);
    g.fillCircle(e.x, headY, 2.5);

    // Partículas subindo do anel do chão
    if (this.conjureFx && fade > 0.08) {
      const steps = 10;
      const frame = Math.floor(t / 70);
      for (let i = 0; i < steps; i++) {
        if ((i + frame) % 3 !== 0) continue;
        const ang = (i / steps) * Math.PI * 2 + spin;
        const r = baseR * (0.65 + 0.2 * Math.sin(t * 0.006 + i));
        const x = e.x + Math.cos(ang) * r;
        const y = e.y + 8 + Math.sin(ang) * r * 0.2;
        this.conjureFx.emitParticleAt(x, y, 1);
        if (this.conjureEmbers && (i + frame) % 5 === 0) {
          this.conjureEmbers.emitParticleAt(x, y, 1);
        }
      }
      // jato central sobe até a cabeça
      if (frame % 2 === 0) {
        this.conjureFx.emitParticleAt(e.x + (Math.random() - 0.5) * 6, e.y + 6, 1);
      }
    }
  }

  /** Explosão da Flame Nova: fogo nasce no centro e avança até o raio máximo. */
  drawNova(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const baseR = e.radius || 80;
    // Cresce do centro (0) ao raio cheio ~no meio da animação
    const growT = Math.min(1, p / 0.55);
    const expand = growT * growT * (3 - 2 * growT);
    const r = Math.max(3, baseR * expand);
    const coreBoost = 1 - expand * 0.45;

    g.setBlendMode(Phaser.BlendModes.ADD);

    // Núcleo no personagem
    g.fillStyle(0xffffff, 0.7 * fade * coreBoost);
    g.fillCircle(e.x, e.y, 4 + r * 0.08);
    g.fillStyle(0xffee66, 0.55 * fade);
    g.fillCircle(e.x, e.y, r * 0.22);
    g.fillStyle(0xff8822, 0.5 * fade);
    g.fillCircle(e.x, e.y, r * 0.5);
    g.fillStyle(0xff3300, 0.4 * fade);
    g.fillCircle(e.x, e.y, r);

    // Línguas saindo do centro rumo à borda
    const wedges = 20;
    for (let i = 0; i < wedges; i++) {
      const spin = p * 1.8;
      const a0 = (i / wedges) * Math.PI * 2 + spin;
      const a1 = ((i + 0.65) / wedges) * Math.PI * 2 + spin;
      const len = r * (0.75 + 0.25 * Math.sin(p * 14 + i));
      g.fillStyle(i % 2 === 0 ? 0xff4400 : 0xffaa22, 0.7 * fade);
      g.fillTriangle(
        e.x,
        e.y,
        e.x + Math.cos(a0) * len,
        e.y + Math.sin(a0) * len,
        e.x + Math.cos(a1) * len,
        e.y + Math.sin(a1) * len
      );
      g.fillStyle(0xffee88, 0.45 * fade);
      g.fillTriangle(
        e.x,
        e.y,
        e.x + Math.cos(a0) * len * 0.4,
        e.y + Math.sin(a0) * len * 0.4,
        e.x + Math.cos(a1) * len * 0.4,
        e.y + Math.sin(a1) * len * 0.4
      );
    }

    // Frente de fogo na borda em expansão
    g.lineStyle(5, 0xffee66, 0.9 * fade);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(2, 0xffffff, 0.55 * fade * coreBoost);
    g.strokeCircle(e.x, e.y, Math.max(2, r * 0.15));

    // Faíscas na borda
    if (this.fireballFx && expand > 0.15 && (Math.floor(this.time.now / 40) % 2 === 0)) {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + p * 4;
        this.fireballFx.emitParticleAt(
          e.x + Math.cos(ang) * r,
          e.y + Math.sin(ang) * r,
          1
        );
      }
      this.sparkFx?.emitParticleAt(e.x, e.y, 2);
    }

    g.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  drawFirebreath(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xff6622;
    const range = (e.range || 170) * (0.55 + 0.45 * Math.min(1, p * 1.6));
    const half = ((e.coneAngle || 38) * Math.PI) / 180;
    const baseAng = Math.atan2(e.dirY || 0, e.dirX || 1);

    // Preenche o cone
    g.fillStyle(color, 0.2 * fade * (1 - p * 0.4));
    g.beginPath();
    g.moveTo(e.x, e.y);
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const a = baseAng - half + (i / steps) * half * 2;
      g.lineTo(e.x + Math.cos(a) * range, e.y + Math.sin(a) * range);
    }
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffee88, 0.14 * fade * (1 - p));
    g.beginPath();
    g.moveTo(e.x, e.y);
    for (let i = 0; i <= steps; i++) {
      const a = baseAng - half * 0.55 + (i / steps) * half * 1.1;
      g.lineTo(e.x + Math.cos(a) * range * 0.7, e.y + Math.sin(a) * range * 0.7);
    }
    g.closePath();
    g.fillPath();

    // Línguas de fogo no cone
    const tongues = 7;
    for (let i = 0; i < tongues; i++) {
      const t = i / (tongues - 1);
      const a = baseAng - half + t * half * 2;
      const len = range * (0.65 + 0.35 * Math.sin(p * 10 + i));
      g.lineStyle(2.5, i % 2 === 0 ? 0xffee88 : 0xff8844, 0.65 * fade);
      g.lineBetween(e.x, e.y, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len);
      g.fillStyle(0xffee88, 0.5 * fade);
      g.fillCircle(e.x + Math.cos(a) * len, e.y + Math.sin(a) * len, 3);
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
    const spell = e.spellId || '';
    const isRocket = spell === 'tiro_de_buscape' || spell === 'rocket';

    if (isRocket) {
      this.drawRocketExplosion(e, fade, p, color);
      return;
    }

    const r = (e.radius || 24) * (0.4 + 0.9 * p);

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

  /** Explosão de buscapé — flash + anéis + estrelas de fogos. */
  drawRocketExplosion(e, fade, p, color) {
    const g = this.effectGraphics;
    const r = (e.radius || 32) * (0.35 + 1.15 * p);
    const flash = Math.max(0, 1 - p * 2.2);
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);

    g.fillStyle(0xfff6c8, 0.55 * fade * flash);
    g.fillCircle(e.x, e.y, r * 0.45);
    g.fillStyle(color, 0.32 * fade * (1 - p));
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(0xff2200, 0.18 * fade * (1 - p * 0.7));
    g.fillCircle(e.x, e.y, r * 1.25);
    g.fillStyle(0xffffff, 0.4 * fade * flash);
    g.fillCircle(e.x, e.y, r * 0.22);

    g.lineStyle(3, 0xffee88, 0.75 * fade * (1 - p * 0.5));
    g.strokeCircle(e.x, e.y, r * 0.7);
    g.lineStyle(2, color, 0.55 * fade);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(1.5, 0xffaa44, 0.35 * fade * (1 - p));
    g.strokeCircle(e.x, e.y, r * 1.2);

    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + p * 1.4 + rand() * 0.2;
      const len = r * (0.85 + 0.55 * p + rand() * 0.25);
      const inner = r * 0.15;
      g.lineStyle(i % 2 === 0 ? 2.5 : 1.5, i % 3 === 0 ? 0xffee88 : color, 0.65 * fade);
      g.lineBetween(
        e.x + Math.cos(a) * inner,
        e.y + Math.sin(a) * inner,
        e.x + Math.cos(a) * len,
        e.y + Math.sin(a) * len
      );
      const sx = e.x + Math.cos(a) * len;
      const sy = e.y + Math.sin(a) * len;
      g.fillStyle(0xffffff, 0.55 * fade * (1 - p));
      g.fillCircle(sx, sy, 1.8 + rand() * 1.5);
    }
  }

  /**
   * Congelamento Temporal — cúpula radial de vidro (hemisfério translúcido).
   * Cresce do centro, com meridianos, paralelos e reflexo especular.
   */
  drawFreeze(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xaaddff;
    const growT = Math.min(1, p / 0.42);
    const grow = growT * growT * (3 - 2 * growT);
    const settle = Math.max(0, Math.min(1, (p - 0.35) / 0.45));
    const late = Math.max(0, (p - 0.72) / 0.28);
    const baseR = e.radius || 200;
    const r = Math.max(4, baseR * (0.12 + 0.88 * grow));
    // Perspectiva leve: a cúpula “sobe” no eixo Y (elipse achatada no topo).
    const domeH = r * (0.52 + 0.1 * settle);
    const cx = e.x;
    const cy = e.y;
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);
    const alpha = fade * (1 - late * 0.55);

    // Solo sob o vidro + anel de contato
    g.fillStyle(0x102038, 0.16 * alpha);
    g.fillEllipse(cx, cy + 2, r * 2.05, r * 0.55);
    g.fillStyle(color, 0.1 * alpha * (1 - late * 0.4));
    g.fillCircle(cx, cy, r * 0.98);
    g.fillStyle(0xffffff, 0.04 * alpha);
    g.fillCircle(cx, cy, r * 0.55);

    // Corpo do vidro — camadas concêntricas (paralelos / latitudes)
    const latBands = 5;
    for (let i = latBands; i >= 1; i--) {
      const t = i / latBands;
      // latitude: raio horizontal e altura da elipse (cúpula)
      const latR = r * Math.sin((t * Math.PI) / 2);
      const latY = cy - domeH * Math.cos((t * Math.PI) / 2) * 0.85;
      const latH = Math.max(3, latR * (0.28 + 0.22 * (1 - t)));
      const glassA = (0.05 + 0.04 * (1 - t)) * alpha;
      g.fillStyle(color, glassA);
      g.fillEllipse(cx, latY, latR * 2, latH * 2);
      g.lineStyle(1.2, 0xffffff, (0.18 + 0.22 * (1 - t)) * alpha);
      g.strokeEllipse(cx, latY, latR * 2, latH * 2);
      g.lineStyle(1, color, (0.25 + 0.2 * t) * alpha);
      g.strokeEllipse(cx, latY, latR * 2, latH * 2);
    }

    // Meridianos (arcos longitudinais da cúpula)
    const meridians = 10;
    const rot = p * 0.35;
    for (let i = 0; i < meridians; i++) {
      const a0 = rot + (i / meridians) * Math.PI * 2;
      g.lineStyle(1.4, 0xffffff, (0.22 + (i % 2) * 0.08) * alpha);
      g.beginPath();
      const steps = 12;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps; // 0 base → 1 topo
        const elev = u * (Math.PI / 2);
        const rr = r * Math.cos(elev);
        const yy = cy - domeH * Math.sin(elev);
        // Compressão elíptica no “chão” da vista
        const px = cx + Math.cos(a0) * rr;
        const py = yy + Math.sin(a0) * rr * 0.22;
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }

    // Aro inferior (borda da cúpula no chão)
    g.lineStyle(4.5, color, 0.55 * alpha);
    g.strokeCircle(cx, cy, r);
    g.lineStyle(2, 0xffffff, 0.7 * alpha);
    g.strokeCircle(cx, cy, r);
    g.lineStyle(1.5, 0xd0f0ff, 0.35 * alpha);
    g.strokeCircle(cx, cy, r * 0.92);

    // Reflexo especular (faixa de vidro)
    const shineAng = -0.7 + settle * 0.15;
    g.lineStyle(3.5, 0xffffff, 0.55 * alpha * (0.5 + 0.5 * settle));
    g.beginPath();
    for (let s = 0; s <= 14; s++) {
      const u = 0.12 + (s / 14) * 0.62;
      const elev = u * (Math.PI / 2);
      const rr = r * Math.cos(elev) * 0.92;
      const yy = cy - domeH * Math.sin(elev);
      const px = cx + Math.cos(shineAng) * rr;
      const py = yy + Math.sin(shineAng) * rr * 0.22;
      if (s === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();

    // Segundo brilho mais fino
    g.lineStyle(1.5, 0xffffff, 0.4 * alpha);
    g.beginPath();
    const shine2 = shineAng + 0.55;
    for (let s = 0; s <= 10; s++) {
      const u = 0.2 + (s / 10) * 0.45;
      const elev = u * (Math.PI / 2);
      const rr = r * Math.cos(elev) * 0.88;
      const yy = cy - domeH * Math.sin(elev);
      const px = cx + Math.cos(shine2) * rr;
      const py = yy + Math.sin(shine2) * rr * 0.22;
      if (s === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();

    // Topo / ápice da cúpula
    const apexY = cy - domeH * 0.92;
    g.fillStyle(0xffffff, 0.45 * alpha * (0.4 + 0.6 * settle));
    g.fillCircle(cx, apexY, Math.max(2.5, r * 0.035));
    g.fillStyle(color, 0.35 * alpha);
    g.fillCircle(cx, apexY, Math.max(4, r * 0.055));
    g.lineStyle(1.5, 0xffffff, 0.5 * alpha);
    g.strokeEllipse(cx, apexY + 2, r * 0.22, r * 0.08);

    // Partículas de gelo/vidro no perímetro (surgem após o crescimento)
    if (grow > 0.55) {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + p * 0.8 + rand() * 0.2;
        const d = r * (0.88 + rand() * 0.1);
        const px = cx + Math.cos(a) * d;
        const py = cy + Math.sin(a) * d * 0.55;
        g.fillStyle(0xffffff, (0.35 + rand() * 0.35) * alpha * (1 - late));
        g.fillCircle(px, py, 1.5 + rand() * 1.5);
      }
    }

    // Onda radial no momento em que a cúpula “trava”
    if (settle > 0 && settle < 0.85) {
      const wave = r * (1 + settle * 0.12);
      g.lineStyle(2, 0xffffff, (0.35 - settle * 0.35) * alpha);
      g.strokeCircle(cx, cy, wave);
    }
  }

  /**
   * Apocalipse: pentagrama se forma na área e, em seguida,
   * explosão de fogo sobe do chão para o céu.
   */
  drawApocalypse(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xff2200;
    const r = e.radius || 200;
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);
    const cx = e.x;
    const cy = e.y;
    const pulse = 0.85 + 0.15 * Math.sin(this.time.now / 90);

    // Fase 1 (0–0.42): pentagrama · Fase 2 (0.38–1): fogo sobe
    const formT = Math.min(1, p / 0.42);
    const formEase = formT * formT * (3 - 2 * formT);
    const blastT = Math.max(0, Math.min(1, (p - 0.38) / 0.52));
    const blastEase = blastT * blastT * (3 - 2 * blastT);
    const late = Math.max(0, (p - 0.75) / 0.25);
    const pentFade = fade * (1 - late * 0.85) * (p < 0.38 ? 1 : 0.55 + 0.45 * (1 - blastEase));

    // Solo ritual / brasa
    const groundA = 0.1 + 0.14 * formEase + 0.22 * blastEase;
    g.fillStyle(0x1a0600, groundA * fade * (1 - late * 0.4));
    g.fillCircle(cx, cy, r * (0.55 + 0.45 * Math.max(formEase, blastEase)));
    g.fillStyle(color, (0.08 + 0.16 * blastEase) * fade * pulse);
    g.fillCircle(cx, cy, r * (0.4 + 0.35 * blastEase));

    // ——— Pentagrama ———
    const pr = r * (0.72 + 0.08 * formEase);
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      pts.push({ x: cx + Math.cos(a) * pr, y: cy + Math.sin(a) * pr * 0.92 });
    }
    // Ordem da estrela: a cada 2 vértices
    const starOrder = [0, 2, 4, 1, 3, 0];

    // Círculo externo se desenhando
    const circleDraw = Math.min(1, formEase / 0.45);
    if (circleDraw > 0.01) {
      g.lineStyle(5, 0x4a0800, 0.35 * pentFade);
      g.beginPath();
      g.arc(cx, cy, pr * 1.08, -Math.PI / 2, -Math.PI / 2 + circleDraw * Math.PI * 2, false);
      g.strokePath();
      g.lineStyle(2.5, color, 0.75 * pentFade * pulse);
      g.beginPath();
      g.arc(cx, cy, pr * 1.08, -Math.PI / 2, -Math.PI / 2 + circleDraw * Math.PI * 2, false);
      g.strokePath();
      g.lineStyle(1.2, 0xffee88, 0.45 * pentFade);
      g.beginPath();
      g.arc(cx, cy, pr * 1.02, -Math.PI / 2, -Math.PI / 2 + circleDraw * Math.PI * 2, false);
      g.strokePath();
    }

    // Estrela se formando (arestas em sequência)
    const starDraw = Math.max(0, Math.min(1, (formEase - 0.2) / 0.65));
    if (starDraw > 0.01) {
      const edgeCount = 5;
      const drawn = starDraw * edgeCount;
      for (let i = 0; i < edgeCount; i++) {
        const edgeProg = Math.max(0, Math.min(1, drawn - i));
        if (edgeProg <= 0) continue;
        const a = pts[starOrder[i]];
        const b = pts[starOrder[i + 1]];
        const x2 = a.x + (b.x - a.x) * edgeProg;
        const y2 = a.y + (b.y - a.y) * edgeProg;
        g.lineStyle(4.5, 0x660800, 0.4 * pentFade);
        g.lineBetween(a.x, a.y, x2, y2);
        g.lineStyle(2.8, color, 0.85 * pentFade * pulse);
        g.lineBetween(a.x, a.y, x2, y2);
        g.lineStyle(1.2, 0xffee88, 0.55 * pentFade);
        g.lineBetween(a.x, a.y, x2, y2);
      }

      // Vértices acesos
      for (let i = 0; i < 5; i++) {
        if (drawn < i) break;
        const glow = Math.min(1, drawn - i);
        g.fillStyle(0xffee88, 0.55 * pentFade * glow);
        g.fillCircle(pts[i].x, pts[i].y, 3.5 + glow * 2);
        g.fillStyle(color, 0.7 * pentFade * glow);
        g.fillCircle(pts[i].x, pts[i].y, 2 + glow);
      }
    }

    // Runas / marcas nos vértices quando o pentagrama completa
    if (formEase > 0.85) {
      const runeA = ((formEase - 0.85) / 0.15) * pentFade;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const rx = cx + Math.cos(a) * pr * 1.18;
        const ry = cy + Math.sin(a) * pr * 1.08;
        g.lineStyle(1.5, 0xffaa44, 0.5 * runeA);
        g.strokeCircle(rx, ry, 5);
        g.fillStyle(color, 0.35 * runeA);
        g.fillCircle(rx, ry, 2);
      }
      // Núcleo do pentagrama
      g.fillStyle(color, 0.12 * runeA * pulse);
      g.fillCircle(cx, cy, pr * 0.22);
      g.fillStyle(0xffee88, 0.2 * runeA);
      g.fillCircle(cx, cy, 4);
    }

    // ——— Explosão de fogo (baixo → cima) ———
    if (blastEase > 0.01) {
      // Flash no chão no instante da detonação
      const ignite = Math.max(0, 1 - blastT * 3.2);
      if (ignite > 0) {
        g.fillStyle(0xffffff, 0.4 * ignite * fade);
        g.fillCircle(cx, cy, r * (0.2 + ignite * 0.25));
        g.fillStyle(0xffee66, 0.45 * ignite * fade);
        g.fillCircle(cx, cy, r * (0.4 + ignite * 0.3));
      }

      // Anéis de choque no solo
      for (let i = 0; i < 3; i++) {
        const wave = Math.min(1.35, blastEase * 1.4 + i * 0.12);
        const wr = r * (0.3 + wave * 0.8);
        const wa = (0.65 - i * 0.15) * fade * Math.max(0, 1 - wave * 0.55);
        g.lineStyle(3.2 - i * 0.5, i === 0 ? 0xffee88 : color, wa);
        g.strokeCircle(cx, cy, wr);
      }

      // Coluna de fogo subindo
      const fireH = (60 + r * 0.85) * blastEase;
      const fireW = r * (0.35 + 0.45 * blastEase) * (1 - late * 0.25);
      if (fireH > 4) {
        g.fillStyle(0x4a1000, 0.35 * fade * (1 - late * 0.4));
        g.fillEllipse(cx, cy - fireH * 0.4, fireW * 2.1, fireH);
        g.fillStyle(color, 0.38 * fade * (1 - late * 0.35));
        g.fillEllipse(cx, cy - fireH * 0.45, fireW * 1.55, fireH * 0.95);
        g.fillStyle(0xff6622, 0.32 * fade * Math.max(0.15, 1 - blastT * 0.7));
        g.fillEllipse(cx, cy - fireH * 0.5, fireW * 1.05, fireH * 0.85);
        g.fillStyle(0xffaa33, 0.28 * fade * Math.max(0.1, 1 - blastT));
        g.fillEllipse(cx, cy - fireH * 0.55, fireW * 0.55, fireH * 0.7);
        g.fillStyle(0xffeeaa, 0.35 * fade * Math.max(0, 1 - blastT * 1.4));
        g.fillEllipse(cx, cy - fireH * 0.6, fireW * 0.22, fireH * 0.45);
      }

      // Línguas de fogo verticais (emergem do perímetro e sobem)
      const tongues = 14;
      for (let i = 0; i < tongues; i++) {
        const a = (i / tongues) * Math.PI * 2 + blastEase * 0.6 + rand() * 0.25;
        const delay = (i % 5) * 0.04;
        const rise = Math.max(0, Math.min(1, (blastEase - delay) / 0.75));
        if (rise <= 0) continue;
        const ring = r * (0.15 + (i % 4) * 0.18) * (0.7 + 0.3 * rise);
        const x0 = cx + Math.cos(a) * ring;
        const y0 = cy + Math.sin(a) * ring * 0.35 + 4;
        const h = (28 + r * 0.35 + (i % 4) * 12 + rand() * 16) * rise;
        const lean = Math.cos(a) * (4 + rise * 8);
        const tipX = x0 + lean;
        const tipY = y0 - h;

        g.lineStyle(5.5, 0x661000, 0.35 * fade * (1 - rise * 0.4));
        g.lineBetween(x0, y0, tipX, tipY);
        g.lineStyle(3.5, color, 0.65 * fade * (1 - rise * 0.35) * pulse);
        g.lineBetween(x0, y0, tipX, y0 - h * 0.85);
        g.lineStyle(2, 0xffaa44, 0.55 * fade * Math.max(0.1, 1 - rise * 0.8));
        g.lineBetween(x0, y0, x0 + lean * 0.4, y0 - h * 0.55);
        if (i % 2 === 0) {
          g.fillStyle(0xffee88, 0.45 * fade * Math.max(0, 1 - rise * 1.2));
          g.fillCircle(tipX, tipY, 2.5 + (1 - rise) * 2);
        }
      }

      // Brasas / faíscas ejetadas para cima
      for (let i = 0; i < 12; i++) {
        const launch = Math.max(0, Math.min(1, (blastEase - i * 0.03) * 1.4));
        if (launch <= 0) continue;
        const a = rand() * Math.PI * 2;
        const dist = r * (0.1 + rand() * 0.55) * Math.min(1, launch * 1.1);
        const px = cx + Math.cos(a) * dist;
        const py = cy + Math.sin(a) * dist * 0.35 - launch * (40 + rand() * 70 + r * 0.25);
        g.fillStyle(i % 3 === 0 ? 0xffee88 : color, 0.6 * fade * (1 - launch * 0.55));
        g.fillCircle(px, py, 1.5 + rand() * 3 * (1 - launch * 0.4));
      }
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

  drawBossNova(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0x4a0080;
    const r = (e.radius || 130) * (0.35 + 0.65 * Math.min(1, p * 1.4));

    g.fillStyle(0x0a0014, 0.35 * fade);
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(color, 0.22 * fade);
    g.fillCircle(e.x, e.y, r * 0.78);
    g.fillStyle(0xffffff, 0.12 * fade);
    g.fillCircle(e.x, e.y, r * 0.28);
    for (let i = 0; i < 4; i++) {
      const t = (p * 1.6 + i * 0.22) % 1;
      g.lineStyle(2.5, color, (0.55 - t * 0.4) * fade);
      g.strokeCircle(e.x, e.y, r * (0.2 + t * 0.8));
    }
  }

  drawBossStrike(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0x6c3483;
    const r = (e.radius || 36) * (0.5 + 0.7 * Math.min(1, p * 1.5));

    g.fillStyle(color, 0.35 * fade);
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(0xffffff, 0.2 * fade);
    g.fillCircle(e.x, e.y, r * 0.4);
    g.lineStyle(2, color, 0.7 * fade);
    g.strokeCircle(e.x, e.y, r * 1.05);
    const rays = 8;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + p * 3;
      g.lineStyle(2, color, 0.55 * fade);
      g.lineBetween(
        e.x + Math.cos(a) * r * 0.3,
        e.y + Math.sin(a) * r * 0.3,
        e.x + Math.cos(a) * r * 1.35,
        e.y + Math.sin(a) * r * 1.35
      );
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

  /** Círculo de atenção + orbe de luz descendo (mass heal). */
  drawMassHealWarn(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0x55ff88;
    const r = e.radius || 78;
    const pulse = 0.85 + 0.15 * Math.sin(this.time.now / 90);
    const flash = 0.55 + 0.45 * Math.sin(this.time.now / 55);
    const imminent = Math.max(0, (p - 0.75) / 0.25);

    g.fillStyle(color, (0.1 + 0.12 * imminent) * fade * pulse);
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(0xa8ffc8, (0.05 + 0.1 * imminent) * fade * flash);
    g.fillCircle(e.x, e.y, r * 0.55);

    const shadowR = 10 + p * 22;
    g.fillStyle(0x0a2014, (0.18 + 0.35 * p) * fade);
    g.fillEllipse(e.x, e.y + 4, shadowR * 1.6, shadowR * 0.7);

    g.lineStyle(3.5, color, (0.75 + 0.2 * imminent) * fade * flash);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(2, 0xddffe8, 0.55 * fade);
    g.strokeCircle(e.x, e.y, r * 0.78);

    const remain = Math.max(0.05, 1 - p);
    g.lineStyle(4, 0xffffff, 0.8 * fade);
    g.beginPath();
    g.arc(e.x, e.y, r * 0.92, -Math.PI / 2, -Math.PI / 2 + remain * Math.PI * 2, false);
    g.strokePath();

    const a0 = this.time.now / 280;
    g.lineStyle(2.5, 0xa8ffc8, 0.65 * fade);
    g.beginPath();
    g.arc(e.x, e.y, r * 1.06, a0, a0 + 0.9, false);
    g.strokePath();

    // Cruz no chão
    g.lineStyle(3, 0xffffff, 0.75 * fade * flash);
    g.lineBetween(e.x - r * 0.28, e.y, e.x + r * 0.28, e.y);
    g.lineBetween(e.x, e.y - r * 0.28, e.x, e.y + r * 0.28);
    g.strokeCircle(e.x, e.y, 8);

    // Orbe de luz descendo
    const pose = this.meteorFallPose(e, p);
    const scale = 0.85 + pose.t * 0.85;
    const dx = 95;
    const dy = 312;
    const tlen = Math.hypot(dx, dy) || 1;
    const tailLen = 36 + pose.t * 80;
    const backX = pose.x - (dx / tlen) * tailLen;
    const backY = pose.y - (dy / tlen) * tailLen;

    g.lineStyle(10 * scale, 0x55ff88, 0.22 * fade);
    g.lineBetween(backX, backY, pose.x, pose.y);
    g.lineStyle(4 * scale, 0xffffff, 0.65 * fade);
    g.lineBetween(
      backX + (pose.x - backX) * 0.35,
      backY + (pose.y - backY) * 0.35,
      pose.x,
      pose.y
    );

    g.fillStyle(0x55ff88, 0.28 * fade);
    g.fillCircle(pose.x, pose.y, 18 * scale);
    g.fillStyle(0xa8ffc8, 0.45 * fade);
    g.fillCircle(pose.x, pose.y, 11 * scale);
    g.fillStyle(0xffffff, 0.85 * fade);
    g.fillCircle(pose.x, pose.y, 5 * scale);

    const cross = 7 * scale;
    g.lineStyle(2.5, 0xffffff, 0.95 * fade);
    g.lineBetween(pose.x - cross, pose.y, pose.x + cross, pose.y);
    g.lineBetween(pose.x, pose.y - cross, pose.x, pose.y + cross);

    if (this.healFx && pose.t > 0.15) {
      const id = e.entityId ?? `${e.x},${e.y}`;
      const now = this.time.now;
      const last = this.meteorTrailAt.get(`heal:${id}`) || 0;
      if (now - last > 70) {
        this.meteorTrailAt.set(`heal:${id}`, now);
        this.healFx.emitParticleAt(pose.x, pose.y, 2);
      }
    }
  }

  /** Círculo de atenção + névoa roxa se formando (cooldown mist). */
  drawCooldownMistWarn(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xaa66ff;
    const r = e.radius || 78;
    const pulse = 0.85 + 0.15 * Math.sin(this.time.now / 110);
    const flash = 0.55 + 0.45 * Math.sin(this.time.now / 70);
    const imminent = Math.max(0, (p - 0.75) / 0.25);
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);

    g.fillStyle(color, (0.12 + 0.14 * imminent) * fade * pulse);
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(0x6b2cff, (0.06 + 0.1 * imminent) * fade * flash);
    g.fillCircle(e.x, e.y, r * 0.62);
    g.fillStyle(0xcc99ff, (0.04 + 0.08 * imminent) * fade);
    g.fillCircle(e.x, e.y, r * 0.32);

    g.lineStyle(3, color, (0.7 + 0.25 * imminent) * fade * flash);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(2, 0xddccff, 0.4 * fade);
    g.strokeCircle(e.x, e.y, r * 0.78);

    const remain = Math.max(0.05, 1 - p);
    g.lineStyle(4, 0xffffff, 0.7 * fade);
    g.beginPath();
    g.arc(e.x, e.y, r * 0.92, -Math.PI / 2, -Math.PI / 2 + remain * Math.PI * 2, false);
    g.strokePath();

    // Nuvens de névoa flutuando dentro do raio
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2 + this.time.now / (900 + i * 80);
      const dist = r * (0.2 + rand() * 0.65) * (0.55 + 0.45 * p);
      const cx = e.x + Math.cos(a) * dist;
      const cy = e.y + Math.sin(a) * dist * 0.75 - 4 - Math.sin(this.time.now / 400 + i) * 6;
      const br = 10 + rand() * 18 + p * 8;
      g.fillStyle(i % 2 === 0 ? color : 0x8844dd, (0.1 + 0.08 * pulse) * fade);
      g.fillEllipse(cx, cy, br * 1.6, br * 0.9);
      g.fillStyle(0xcc99ff, 0.06 * fade * flash);
      g.fillEllipse(cx - 2, cy - 3, br * 0.7, br * 0.45);
    }

    // Coluna suave de névoa subindo
    const rise = 20 + p * 50;
    g.fillStyle(color, 0.14 * fade * (0.5 + 0.5 * p));
    g.fillEllipse(e.x, e.y - rise * 0.35, 22 + p * 10, rise);
    g.fillStyle(0xcc99ff, 0.1 * fade * flash);
    g.fillEllipse(e.x, e.y - rise * 0.5, 8, rise * 0.55);

    if (this.mistFx && p > 0.1) {
      const id = e.entityId ?? `${e.x},${e.y}`;
      const now = this.time.now;
      const last = this.meteorTrailAt.get(`mist:${id}`) || 0;
      if (now - last > 80) {
        this.meteorTrailAt.set(`mist:${id}`, now);
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * r * 0.7;
        this.mistFx.emitParticleAt(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.7, 2);
      }
    }
  }

  /** Impacto: explosão de névoa roxa. */
  drawCooldownMistStrike(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xaa66ff;
    const r = e.radius || 78;
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);

    const flash = Math.max(0, 1 - p * 3.2);
    if (flash > 0) {
      g.fillStyle(0xffffff, 0.35 * flash * fade);
      g.fillCircle(e.x, e.y, r * (0.3 + flash * 0.4));
      g.fillStyle(0xcc99ff, 0.35 * flash * fade);
      g.fillCircle(e.x, e.y, r * (0.7 + flash * 0.35));
    }

    const groundR = r * (0.7 + 0.4 * Math.min(1, p * 1.5));
    g.fillStyle(color, 0.28 * fade * (1 - p * 0.45));
    g.fillCircle(e.x, e.y, groundR);
    g.fillStyle(0x6b2cff, 0.16 * fade * (1 - p * 0.5));
    g.fillCircle(e.x, e.y, groundR * 0.55);
    g.lineStyle(3, 0xddccff, 0.65 * fade);
    g.strokeCircle(e.x, e.y, groundR);

    for (let i = 0; i < 4; i++) {
      const wave = Math.min(1.5, p * 1.7 + i * 0.16);
      const wr = r * (0.3 + wave * 0.95);
      const wa = (0.65 - i * 0.12) * fade * Math.max(0, 1 - wave * 0.6);
      g.lineStyle(3.5 - i * 0.5, i === 0 ? 0xffffff : color, wa);
      g.strokeCircle(e.x, e.y, wr);
    }

    // Névoa expandindo
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + p * 0.8 + rand() * 0.4;
      const dist = r * (0.2 + (i % 3) * 0.2) * Math.min(1.15, 0.35 + p * 1.1);
      const cx = e.x + Math.cos(a) * dist;
      const cy = e.y + Math.sin(a) * dist * 0.8 - p * 18;
      const br = 14 + (i % 3) * 6 + (1 - p) * 8;
      g.fillStyle(i % 2 === 0 ? color : 0x8844dd, 0.22 * fade * (1 - p * 0.5));
      g.fillEllipse(cx, cy, br * 1.7, br);
      g.fillStyle(0xcc99ff, 0.1 * fade * Math.max(0, 1 - p * 1.4));
      g.fillEllipse(cx, cy - 4, br * 0.8, br * 0.5);
    }

    const columnH = 36 + (1 - p) * 80;
    g.fillStyle(color, 0.22 * fade * (1 - p * 0.45));
    g.fillEllipse(e.x, e.y - columnH * 0.35, 30 * (1 - p * 0.25), columnH);
    g.fillStyle(0xffffff, 0.22 * fade * Math.max(0, 1 - p * 2));
    g.fillEllipse(e.x, e.y - columnH * 0.5, 9, columnH * 0.4);

    if (this.mistFx && p < 0.75) {
      const id = `mist-strike:${e.entityId ?? `${e.x},${e.y}`}`;
      const now = this.time.now;
      const last = this.meteorTrailAt.get(id) || 0;
      if (now - last > 70) {
        this.meteorTrailAt.set(id, now);
        this.mistFx.emitParticleAt(
          e.x + Phaser.Math.Between(-r * 0.4, r * 0.4),
          e.y + Phaser.Math.Between(-16, 6),
          3
        );
      }
    }
  }

  /** Círculo de atenção + ventania se formando (rajadas laterais). */
  drawGaleWarn(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0xa8d8ff;
    const r = e.radius || 78;
    const angle = e.angle || 0;
    const pulse = 0.85 + 0.15 * Math.sin(this.time.now / 100);
    const flash = 0.55 + 0.45 * Math.sin(this.time.now / 65);
    const imminent = Math.max(0, (p - 0.75) / 0.25);
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const px = -dy;
    const py = dx;

    g.fillStyle(color, (0.1 + 0.12 * imminent) * fade * pulse);
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(0x6aa8d8, (0.05 + 0.08 * imminent) * fade * flash);
    g.fillCircle(e.x, e.y, r * 0.58);
    g.lineStyle(3, color, (0.65 + 0.3 * imminent) * fade * flash);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(2, 0xffffff, 0.35 * fade);
    g.strokeCircle(e.x, e.y, r * 0.78);

    const remain = Math.max(0.05, 1 - p);
    g.lineStyle(4, 0xffffff, 0.7 * fade);
    g.beginPath();
    g.arc(e.x, e.y, r * 0.92, -Math.PI / 2, -Math.PI / 2 + remain * Math.PI * 2, false);
    g.strokePath();

    // Rajadas cruzando o círculo (lado → lado)
    const sweep = ((this.time.now / 420) % 1) * 2 - 1;
    for (let i = 0; i < 6; i++) {
      const lane = (i / 5 - 0.5) * r * 1.5;
      const t = sweep + (rand() - 0.5) * 0.35 + i * 0.08;
      const along = t * r * 0.95;
      const cx = e.x + dx * along + px * lane * 0.55;
      const cy = e.y + dy * along + py * lane * 0.55;
      if (Math.hypot(cx - e.x, cy - e.y) > r * 0.95) continue;
      const len = 18 + rand() * 28 + p * 16;
      g.lineStyle(2 + (i % 2), i % 2 === 0 ? 0xffffff : color, (0.35 + 0.25 * pulse) * fade);
      g.lineBetween(cx - dx * len * 0.5, cy - dy * len * 0.5, cx + dx * len * 0.5, cy + dy * len * 0.5);
      g.fillStyle(0xffffff, 0.12 * fade * flash);
      g.fillEllipse(cx, cy, 10 + p * 6, 4);
    }

    if (this.windFx && p > 0.15) {
      const id = e.entityId ?? `${e.x},${e.y}`;
      const now = this.time.now;
      const last = this.meteorTrailAt.get(`gale:${id}`) || 0;
      if (now - last > 70) {
        this.meteorTrailAt.set(`gale:${id}`, now);
        const deg = Phaser.Math.RadToDeg(angle);
        this.windFx.setEmitterAngle({ min: deg - 16, max: deg + 16 });
        this.windFx.setParticleSpeed({ min: 70, max: 160 });
        const side = (Math.random() - 0.5) * r * 1.2;
        const back = -r * (0.55 + Math.random() * 0.25);
        this.windFx.emitParticleAt(e.x + dx * back + px * side, e.y + dy * back + py * side, 2);
      }
    }
  }

  /** Zona ativa: ventania radial com rajadas contínuas. */
  drawGaleStrike(e) {
    const g = this.effectGraphics;
    // Zona longa: só some no fim (não fade linear de 5s)
    const fade = Math.min(1, Math.max(0, (e.life || 0) / 0.85));
    const color = e.color || 0xa8d8ff;
    const r = e.radius || 78;
    const angle = e.angle || 0;
    const seedRef = { v: (e.seed ?? 1) >>> 0 };
    const rand = () => this.seededRand(seedRef);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const px = -dy;
    const py = dx;
    const pulse = 0.8 + 0.2 * Math.sin(this.time.now / 90);
    // Flash só no início da zona
    const age = Math.max(0, (e.maxLife || 0) - (e.life || 0));
    const flash = Math.max(0, 1 - age * 4);
    if (flash > 0) {
      g.fillStyle(0xffffff, 0.28 * flash * fade);
      g.fillCircle(e.x, e.y, r * (0.35 + flash * 0.4));
      g.fillStyle(color, 0.22 * flash * fade);
      g.fillCircle(e.x, e.y, r * (0.75 + flash * 0.3));
    }

    g.fillStyle(color, 0.16 * fade * pulse);
    g.fillCircle(e.x, e.y, r);
    g.fillStyle(0x6aa8d8, 0.08 * fade);
    g.fillCircle(e.x, e.y, r * 0.55);
    g.lineStyle(3, 0xffffff, 0.45 * fade * pulse);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(2, color, 0.55 * fade);
    g.strokeCircle(e.x, e.y, r * 0.82);

    // Faixas de vento varrendo o círculo
    const sweep = ((this.time.now / 280) % 1) * 2 - 1;
    for (let i = 0; i < 10; i++) {
      const lane = (i / 9 - 0.5) * r * 1.7;
      const t = sweep + i * 0.11 + (rand() - 0.5) * 0.2;
      const along = ((t % 2) + 2) % 2; // 0..2
      const pos = (along - 1) * r; // -r..r
      const cx = e.x + dx * pos + px * lane * 0.5;
      const cy = e.y + dy * pos + py * lane * 0.5;
      if (Math.hypot(cx - e.x, cy - e.y) > r * 0.98) continue;
      const len = 26 + (i % 3) * 10;
      const a = (0.55 - (i % 3) * 0.08) * fade * pulse;
      g.lineStyle(2.5, i % 2 === 0 ? 0xffffff : color, a);
      g.lineBetween(cx - dx * len * 0.55, cy - dy * len * 0.55, cx + dx * len * 0.55, cy + dy * len * 0.55);
      g.fillStyle(0xffffff, 0.1 * fade);
      g.fillEllipse(cx, cy, 12, 3.5);
    }

    // Setas de direção nas bordas
    for (let i = 0; i < 4; i++) {
      const lane = (i / 3 - 0.5) * r * 1.1;
      const tipX = e.x + dx * r * 0.72 + px * lane;
      const tipY = e.y + dy * r * 0.72 + py * lane;
      const baseX = tipX - dx * 16;
      const baseY = tipY - dy * 16;
      g.lineStyle(2, 0xffffff, 0.5 * fade * pulse);
      g.lineBetween(baseX, baseY, tipX, tipY);
      g.lineBetween(tipX, tipY, tipX - dx * 7 + px * 5, tipY - dy * 7 + py * 5);
      g.lineBetween(tipX, tipY, tipX - dx * 7 - px * 5, tipY - dy * 7 - py * 5);
    }

    if (this.windFx && fade > 0.05) {
      const id = `gale-strike:${e.entityId ?? `${e.x},${e.y}`}`;
      const now = this.time.now;
      const last = this.meteorTrailAt.get(id) || 0;
      if (now - last > 55) {
        this.meteorTrailAt.set(id, now);
        const deg = Phaser.Math.RadToDeg(angle);
        this.windFx.setEmitterAngle({ min: deg - 18, max: deg + 18 });
        this.windFx.setParticleSpeed({ min: 110, max: 240 });
        const side = (Math.random() - 0.5) * r * 1.4;
        const back = -r * (0.65 + Math.random() * 0.2);
        this.windFx.emitParticleAt(e.x + dx * back + px * side, e.y + dy * back + py * side, 3);
      }
    }
  }

  /**
   * Alavanca de arena: surge da esquerda (facing left), puxada à direita some
   * e amplia a zona segura no servidor.
   */
  drawLever(e) {
    const g = this.effectGraphics;
    const appear = e.type === 'lever_appear';
    const pulled = e.type === 'lever_pulled';
    const progress = this.effectProgress(e);
    const lifeFade = pulled
      ? Math.min(1, Math.max(0, (e.life || 0) / Math.max(0.05, e.maxLife || 0.55)))
      : appear
        ? Math.min(1, progress)
        : Math.min(1, Math.max(0.35, (e.life || 0) / Math.max(0.2, (e.maxLife || 14) * 0.15)));
    const fade = appear ? Math.min(1, progress * 1.4) : lifeFade;
    const wood = e.color || 0xd4a574;
    const metal = 0x8a9aaa;
    const glow = pulled ? 0x66e8a0 : 0xffc857;
    const r = e.radius || 22;

    // Entrada: desliza da esquerda até o ponto final
    const slide = appear ? (1 - progress) * 48 : 0;
    const x = e.x - slide;
    const y = e.y;
    const pulse = 0.85 + 0.15 * Math.sin(this.time.now / 120);

    g.fillStyle(glow, (pulled ? 0.22 : 0.12) * fade * pulse);
    g.fillCircle(x, y, r * (pulled ? 1.15 : 0.95));
    g.lineStyle(2, glow, (pulled ? 0.75 : 0.45) * fade);
    g.strokeCircle(x, y, r * 0.9);

    // Base / pedestal
    g.fillStyle(0x3a2a1a, 0.85 * fade);
    g.fillRoundedRect(x - 10, y - 4, 20, 14, 3);
    g.fillStyle(wood, 0.95 * fade);
    g.fillRoundedRect(x - 8, y - 2, 16, 10, 2);
    g.fillStyle(0x2a1c10, 0.55 * fade);
    g.fillRect(x - 3, y - 18, 6, 20);

    // Manopla: esquerda (−) ou direita (+)
    const facingRight = e.facing === 'right' || pulled;
    // Transição visual ao puxar
    const pullT = pulled ? Math.min(1, 1 - (e.life || 0) / Math.max(0.05, e.maxLife || 0.55)) : 0;
    const ang = facingRight
      ? Phaser.Math.DegToRad(-55 + pullT * 8)
      : Phaser.Math.DegToRad(215);
    const hx = Math.cos(ang);
    const hy = Math.sin(ang);
    const pivotX = x;
    const pivotY = y - 16;
    const tipX = pivotX + hx * 22;
    const tipY = pivotY + hy * 22;

    g.lineStyle(5, 0x5a4030, 0.95 * fade);
    g.lineBetween(pivotX, pivotY, tipX, tipY);
    g.lineStyle(3, wood, 0.98 * fade);
    g.lineBetween(pivotX, pivotY, tipX, tipY);
    g.fillStyle(metal, 0.95 * fade);
    g.fillCircle(pivotX, pivotY, 4);
    g.fillStyle(glow, 0.95 * fade);
    g.fillCircle(tipX, tipY, 5.5);
    g.fillStyle(0xffffff, 0.55 * fade);
    g.fillCircle(tipX - 1.5, tipY - 1.5, 2);

    if (pulled) {
      const flash = Math.max(0, 1 - pullT * 1.6);
      if (flash > 0) {
        g.fillStyle(0xffffff, 0.35 * flash * fade);
        g.fillCircle(x, y, r * (0.6 + flash * 0.5));
        g.fillStyle(0x66e8a0, 0.28 * flash * fade);
        g.fillCircle(x, y, r * (1.1 + flash * 0.4));
      }
    } else if (!appear) {
      // Indicador de “passe por cima”
      const remain = Math.max(0.05, 1 - progress);
      g.lineStyle(2.5, 0xffffff, 0.35 * fade);
      g.beginPath();
      g.arc(x, y, r * 1.05, -Math.PI / 2, -Math.PI / 2 + remain * Math.PI * 2, false);
      g.strokePath();
    }
  }

  /** Impacto: onda de cura e cruzes ascendentes. */
  drawMassHealStrike(e) {
    const g = this.effectGraphics;
    const fade = this.effectFade(e);
    const p = this.effectProgress(e);
    const color = e.color || 0x55ff88;
    const r = e.radius || 78;

    const flash = Math.max(0, 1 - p * 3.2);
    if (flash > 0) {
      g.fillStyle(0xffffff, 0.45 * flash * fade);
      g.fillCircle(e.x, e.y, r * (0.35 + flash * 0.45));
      g.fillStyle(0xa8ffc8, 0.3 * flash * fade);
      g.fillCircle(e.x, e.y, r * (0.75 + flash * 0.35));
    }

    const groundR = r * (0.75 + 0.35 * Math.min(1, p * 1.6));
    g.fillStyle(color, 0.22 * fade * (1 - p * 0.4));
    g.fillCircle(e.x, e.y, groundR);
    g.fillStyle(0xa8ffc8, 0.12 * fade * (1 - p * 0.5));
    g.fillCircle(e.x, e.y, groundR * 0.55);
    g.lineStyle(3, 0xddffe8, 0.75 * fade);
    g.strokeCircle(e.x, e.y, groundR);

    for (let i = 0; i < 3; i++) {
      const wave = Math.min(1.4, p * 1.8 + i * 0.18);
      const wr = r * (0.35 + wave * 0.9);
      const wa = (0.7 - i * 0.18) * fade * Math.max(0, 1 - wave * 0.65);
      g.lineStyle(3.5 - i, i === 0 ? 0xffffff : color, wa);
      g.strokeCircle(e.x, e.y, wr);
    }

    // Coluna de luz
    const columnH = 30 + (1 - p) * 70;
    g.fillStyle(color, 0.28 * fade * (1 - p * 0.4));
    g.fillEllipse(e.x, e.y - columnH * 0.35, 26 * (1 - p * 0.3), columnH);
    g.fillStyle(0xffffff, 0.35 * fade * Math.max(0, 1 - p * 2));
    g.fillEllipse(e.x, e.y - columnH * 0.45, 8, columnH * 0.45);

    // Cruzes de cura subindo
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + p * 1.2;
      const dist = r * (0.25 + (i % 3) * 0.18) * Math.min(1.1, 0.4 + p);
      const cx = e.x + Math.cos(a) * dist;
      const cy = e.y + Math.sin(a) * dist * 0.85 - p * 36;
      const s = 5 + (i % 2) * 2;
      g.lineStyle(2.5, 0xffffff, 0.85 * fade * (1 - p * 0.35));
      g.lineBetween(cx - s, cy, cx + s, cy);
      g.lineBetween(cx, cy - s, cx, cy + s);
      g.lineStyle(1.5, color, 0.9 * fade * (1 - p * 0.35));
      g.lineBetween(cx - s, cy, cx + s, cy);
      g.lineBetween(cx, cy - s, cx, cy + s);
    }

    g.fillStyle(0xffffff, 0.5 * fade * Math.max(0, 1 - p * 1.8));
    g.fillCircle(e.x, e.y, 20 * Math.max(0.2, 1 - p));

    if (this.healFx && p < 0.7) {
      const id = `heal-strike:${e.entityId ?? `${e.x},${e.y}`}`;
      const now = this.time.now;
      const last = this.meteorTrailAt.get(id) || 0;
      if (now - last > 70) {
        this.meteorTrailAt.set(id, now);
        this.healFx.emitParticleAt(
          e.x + Phaser.Math.Between(-r * 0.3, r * 0.3),
          e.y + Phaser.Math.Between(-10, 4),
          2
        );
      }
    }
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
        const arena = this.state.arena;
        // Fora da plataforma = lava: não desenha / remove sprite local
        if (arena && Math.hypot(e.x - arena.x, e.y - arena.y) > arena.radius) {
          continue;
        }
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
        e.type === 'firebreath' ||
        e.type === 'heal' ||
        e.type === 'blink' ||
        e.type === 'barrier' ||
        e.type === 'freeze' ||
        e.type === 'apocalypse' ||
        e.type === 'storm' ||
        e.type === 'electric_storm' ||
        e.type === 'poison_burst' ||
        e.type === 'boss_nova' ||
        e.type === 'boss_strike' ||
        e.type === 'lightning' ||
        e.type === 'sky_lightning' ||
        e.type === 'meteor_strike' ||
        e.type === 'mass_heal_strike' ||
        e.type === 'cooldown_mist_strike' ||
        e.type === 'cooldown_mist' ||
        e.type === 'gale_strike' ||
        e.type === 'lever_pulled'
      ) {
        activeBursts.add(burstKey);
        this.burstOnce(burstKey, () => this.burstSpellParticles(e));
      }

      if (e.type === 'pentagram') {
        this.drawPentagram(e);
      } else if (e.type === 'sky_lightning') {
        this.drawSkyLightning(e);
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
      } else if (e.type === 'firebreath') {
        this.drawFirebreath(e);
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
      } else if (e.type === 'mass_heal_warn') {
        this.drawMassHealWarn(e);
      } else if (e.type === 'mass_heal_strike') {
        this.drawMassHealStrike(e);
      } else if (e.type === 'cooldown_mist_warn') {
        this.drawCooldownMistWarn(e);
      } else if (e.type === 'cooldown_mist_strike') {
        this.drawCooldownMistStrike(e);
      } else if (e.type === 'gale_warn') {
        this.drawGaleWarn(e);
      } else if (e.type === 'gale_strike') {
        this.drawGaleStrike(e);
      } else if (
        e.type === 'lever_appear' ||
        e.type === 'lever_ready' ||
        e.type === 'lever_pulled'
      ) {
        this.drawLever(e);
      } else if (e.type === 'storm') {
        this.drawStorm(e);
      } else if (e.type === 'electric_storm') {
        this.drawElectricStorm(e);
      } else if (e.type === 'poison_burst') {
        this.drawPoisonBurst(e);
      } else if (e.type === 'boss_nova') {
        this.drawBossNova(e);
      } else if (e.type === 'boss_strike') {
        this.drawBossStrike(e);
      }
    }

    this.pruneBurstSeen(activeBursts);

    // Limpa trails de meteoros / mass heal inativos (uma passagem O(n))
    if (this.meteorTrailAt.size) {
      const alive = new Set();
      for (const e of this.state.effects || []) {
        if (e.type === 'meteor_warn' || e.type === 'meteor_strike') {
          const id = String(e.entityId ?? `${e.x},${e.y}`);
          alive.add(id);
          if (e.type === 'meteor_strike') alive.add(`strike:${id}`);
        } else if (e.type === 'mass_heal_warn' || e.type === 'mass_heal_strike') {
          const id = String(e.entityId ?? `${e.x},${e.y}`);
          alive.add(`heal:${id}`);
          if (e.type === 'mass_heal_strike') alive.add(`heal-strike:${id}`);
        } else if (e.type === 'cooldown_mist_warn' || e.type === 'cooldown_mist_strike') {
          const id = String(e.entityId ?? `${e.x},${e.y}`);
          alive.add(`mist:${id}`);
          if (e.type === 'cooldown_mist_strike') alive.add(`mist-strike:${id}`);
        } else if (e.type === 'gale_warn' || e.type === 'gale_strike') {
          const id = String(e.entityId ?? `${e.x},${e.y}`);
          alive.add(`gale:${id}`);
          if (e.type === 'gale_strike') alive.add(`gale-strike:${id}`);
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

  renderLootBags() {
    if (!this.textures.exists('loot_bag')) return;
    const seen = new Set();
    for (const bag of this.state?.lootBags || []) {
      seen.add(bag.entityId);
      let s = this.lootBagSprites.get(bag.entityId);
      if (!s) {
        s = this.add
          .image(bag.x, bag.y, 'loot_bag')
          .setDepth(6)
          .setScale(0.2)
          .setAlpha(1);
        this.lootBagSprites.set(bag.entityId, s);
        this.tweens.add({
          targets: s,
          scale: 1.15,
          duration: 220,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!s.active) return;
            this.tweens.add({
              targets: s,
              y: bag.y - 5,
              duration: 480,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
          },
        });
      } else {
        s.x = bag.x;
      }
    }
    for (const [id, s] of this.lootBagSprites) {
      if (!seen.has(id)) {
        this.tweens.killTweensOf(s);
        s.destroy();
        this.lootBagSprites.delete(id);
      }
    }
  }

  renderCoins() {
    if (!this.textures.exists('coin')) return;
    const seen = new Set();
    for (const coin of this.state?.coins || []) {
      seen.add(coin.entityId);
      let s = this.coinSprites.get(coin.entityId);
      if (!s) {
        s = this.add
          .image(coin.x, coin.y, 'coin')
          .setDepth(6)
          .setScale(0.2)
          .setAlpha(1);
        this.coinSprites.set(coin.entityId, s);
        this.tweens.add({
          targets: s,
          scale: 1.05,
          duration: 200,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!s.active) return;
            this.tweens.add({
              targets: s,
              y: coin.y - 4,
              duration: 420,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
          },
        });
      } else {
        s.x = coin.x;
      }
    }
    for (const [id, s] of this.coinSprites) {
      if (!seen.has(id)) {
        this.tweens.killTweensOf(s);
        s.destroy();
        this.coinSprites.delete(id);
      }
    }
  }

  updateHud() {
    const me = this.me();
    if (!me) return;

    const PAD_X = 20;
    const PANEL_X = 12;
    const PANEL_Y = 12;
    const BAR_W = 220;
    let y = 18;

    const pvpOn = this.state?.pvpEnabled !== false;
    const bossRound = !!this.state.bossRound || !!this.state.pendingBossFight;
    const displayRound =
      this.state.phase === 'countdown' && !bossRound
        ? Math.max(1, (this.state.round || 0) + 1)
        : this.state.round || 1;
    this.modeText.setPosition(PAD_X + 4, y);
    this.modeText.setText(pvpOn ? 'PVP' : 'PVE');
    this.modeText.setColor(pvpOn ? '#ff6b6b' : '#6bffb0');
    this.roundHudText.setPosition(PAD_X + 4 + this.modeText.width + 8, y);
    this.roundHudText.setText(
      bossRound && this.state.phase !== 'countdown'
        ? `· Round ${displayRound} · BOSS`
        : `· Round ${displayRound}`
    );
    y += 20;

    const hpRatio = me.alive ? me.hp / me.maxHp : 0;
    this.hpBarBg.setPosition(PAD_X, y);
    this.hpBar.setPosition(PAD_X, y);
    this.hpBar.width = BAR_W * hpRatio;
    this.hpText.setPosition(PAD_X + 4, y + 1);
    this.hpText.setText(me.alive ? `HP ${Math.ceil(me.hp)} / ${me.maxHp}` : 'MORTO — próximo round');
    y += 24;

    const xpRatio = me.xpToNext ? Math.min(1, me.xp / me.xpToNext) : 0;
    this.xpBarBg.setPosition(PAD_X, y);
    this.xpBar.setPosition(PAD_X, y);
    this.xpBar.width = BAR_W * xpRatio;
    y += 14;

    const showShield = me.alive && me.shield > 0;
    if (showShield) {
      const maxShield = me.maxShield > 0 ? me.maxShield : me.shield;
      const shieldRatio = Math.min(1, me.shield / maxShield);
      this.shieldBarBg.setPosition(PAD_X, y).setVisible(true);
      this.shieldBar.setPosition(PAD_X, y).setVisible(true);
      this.shieldBar.width = BAR_W * shieldRatio;
      this.shieldText
        .setPosition(PAD_X + 4, y)
        .setVisible(true)
        .setText(`ESCUDO ${Math.ceil(me.shield)} / ${Math.ceil(maxShield)}`);
      y += 16;
    } else {
      this.shieldBarBg.setVisible(false);
      this.shieldBar.setVisible(false);
      this.shieldText.setVisible(false);
    }

    this.levelText.setPosition(PAD_X + 4, y);
    this.levelText.setText(`Lv ${me.level}  ·  XP ${me.xp}/${me.xpToNext}`);
    this.scoreText.setText(
      `·  ${me.kills || 0}/${me.deaths || 0}  (${me.score || 0} pts)  ·  ${me.damageDealt || 0} dmg`
    );
    this.scoreText.setPosition(this.levelText.x + this.levelText.width + 8, y);
    y += 20;

    this.lootText.setPosition(PAD_X + 4, y);
    this.lootText.setText(`Loot ${me.loot || 0}`);
    this.goldText.setPosition(this.lootText.x + this.lootText.width + 14, y);
    this.goldText.setText(`Gold ${me.gold || 0}`);
    y += 18;

    this.mapText.setPosition(PAD_X + 4, y);
    this.mapText.setText(`Mapa ${this.arenaMapName(this.state?.arena?.floorType)}`);
    y += 18;

    // Status recebidos + terreno (abaixo do mapa)
    const effects = [];
    if (me.alive) {
      const floorEff = getFloorStatusEffect(this.state?.arena?.floorType);
      if (floorEff) effects.push(floorEff);

      const gale = this.activeGaleOnMe(me);
      if (gale) effects.push(getGaleStatusEffect(gale.life));

      if (this.isOnLava(me.x, me.y)) effects.push(getLavaStatusEffect());

      if ((me.slow || 0) > 0 && (me.slowTimer || 0) > 0) {
        effects.push(getCombatStatusEffect('slow', me.slowTimer, me.slow));
      }
      if (Number(me.poisonTimer) > 0) {
        effects.push(getCombatStatusEffect('poison', Number(me.poisonTimer)));
      }
      if (Number(me.burnTimer) > 0) {
        effects.push(getCombatStatusEffect('burn', Number(me.burnTimer)));
      }
    }
    for (let i = 0; i < this.statusSlots.length; i++) {
      const slot = this.statusSlots[i];
      const eff = effects[i];
      if (!eff) {
        slot.effect = null;
        slot.container.setVisible(false);
        if (this.statusTooltipEffect === i) this.hideStatusTooltip(i);
        continue;
      }
      slot.effect = eff;
      slot.container.setVisible(true);
      slot.container.setDepth(110);
      slot.container.setPosition(PAD_X + 14 + i * 36, y + 14);
      if (this.textures.exists(eff.icon)) {
        slot.icon.setTexture(eff.icon).setVisible(true).setDisplaySize(18, 18);
      } else {
        slot.icon.setVisible(false);
      }
      slot.bg.setStrokeStyle(2, eff.color);
      slot.cd.setText(eff.timer != null && Number.isFinite(eff.timer) ? Number(eff.timer).toFixed(1) : '');
    }
    if (effects.length > 0) y += 34;
    this.refreshStatusTooltip();

    const contentRight = Math.max(
      PAD_X + BAR_W,
      this.roundHudText.x + this.roundHudText.width,
      this.scoreText.x + this.scoreText.width,
      this.goldText.x + this.goldText.width,
      this.mapText.x + this.mapText.width
    );
    const panelW = Math.max(240, contentRight - PANEL_X + 12);
    const panelH = Math.max(72, y - PANEL_Y + 8);
    this.hudPanel.setPosition(PANEL_X, PANEL_Y);
    this.hudPanel.setSize(panelW, panelH);
    this.hudPanel.setStrokeStyle(2, 0x6b5cff);

    if (bossRound && this.state.phase === 'playing') {
      this.timerText.setText('BOSS');
    } else if (bossRound && (this.state.phase === 'countdown' || this.state.phase === 'intermission')) {
      this.timerText.setText('--:--');
    } else {
      const roundDuration = this.state.roundDuration ?? this.state.matchDuration ?? 15;
      const remain = Math.max(0, roundDuration - (this.state.roundTime || 0));
      const m = Math.floor(remain / 60);
      const s = Math.floor(remain % 60);
      this.timerText.setText(`${m}:${String(s).padStart(2, '0')}`);
    }
    const shrinksDone = this.state.arena?.shrinksDone ?? 0;
    const shrinkTimes = this.state.arena?.shrinkTimes ?? 0;
    let zoneLabel = 'posicionando';
    if (this.state.phase !== 'countdown') {
      if (bossRound) {
        zoneLabel = 'boss fight';
      } else if (this.state.arena?.shrinking) {
        zoneLabel = 'fechando zona';
      } else {
        zoneLabel =
          shrinkTimes > 0 && shrinksDone >= shrinkTimes
            ? 'zona final'
            : `zona em ${Math.max(0, Math.ceil(this.state.arena.nextShrinkAt - this.state.roundTime))}s`;
      }
    }
    this.roundText.setText(
      bossRound && this.state.phase !== 'countdown'
        ? `Round ${displayRound} · BOSS`
        : `Round ${displayRound} · ${zoneLabel}`
    );

    // Spells (máx. 3 básicas)
    for (let i = 0; i < 3; i++) {
      const slot = this.spellSlots[i];
      const spell = me.spells[i];
      const selected = this.selectedSpellSlot === i;
      if (!spell) {
        slot.name.setText('-');
        slot.cd.setText('');
        slot.icon.setVisible(false);
        this.setSpellSlotElement(slot, null);
        slot.bg.setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : 0x443866);
        slot.bg.setFillStyle(selected ? 0x2a2250 : 0x1a1430, 0.95);
        continue;
      }
      this.setSpellSlotIcon(slot, spell.id || spell.stats?.id);
      this.setSpellSlotElement(slot, spell.id || spell.stats?.id);
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
      this.setSpellSlotElement(ultSlot, null);
      ultSlot.bg.setStrokeStyle(ultSelected ? 3 : 2, ultSelected ? 0xffffff : 0x443866);
      ultSlot.bg.setFillStyle(ultSelected ? 0x2a2250 : 0x1a1430, 0.95);
    } else {
      this.setSpellSlotIcon(ultSlot, ult.id || ult.stats?.id);
      this.setSpellSlotElement(ultSlot, ult.id || ult.stats?.id);
      ultSlot.name.setText('ult');
      ultSlot.cd.setText(ult.cooldownLeft > 0 ? ult.cooldownLeft.toFixed(1) : 'OK');
      ultSlot.icon.setAlpha(ult.cooldownLeft > 0 ? 0.45 : 1);
      ultSlot.bg.setStrokeStyle(ultSelected ? 3 : 2, ultSelected ? 0xffffff : ult.stats.color || 0xffaa33);
      ultSlot.bg.setFillStyle(ultSelected ? 0x2a2250 : 0x1a1430, 0.95);
    }

    // Slot depois do ultimate (4): cooldown do dash
    const dashSlot = this.spellSlots[4];
    const dashCd = me.dashCooldown || 0;
    const dashing = !!me.dashing;
    this.setSpellSlotIcon(dashSlot, 'dash');
    this.setSpellSlotElement(dashSlot, null);
    dashSlot.name.setText(dashing ? 'dash!' : 'dash');
    dashSlot.cd.setText(dashCd > 0 ? dashCd.toFixed(1) : '');
    dashSlot.icon.setAlpha(dashCd > 0 && !dashing ? 0.45 : 1);
    dashSlot.bg.setStrokeStyle(2, dashing ? 0xffffff : dashCd > 0 ? 0x665544 : 0xd4c48a);
    dashSlot.bg.setFillStyle(dashing ? 0x2a2250 : 0x1a1430, 0.95);

    // Slot depois do dash (5): escudo inato (E, lv1+)
    const barrierSlot = this.spellSlots[5];
    const barrierUnlocked = (me.level || 1) >= 1;
    const barrierCd = me.barrierCooldown || 0;
    const shielded = !!me.alive && (me.shield || 0) > 0;
    this.setSpellSlotIcon(barrierSlot, 'barrier');
    this.setSpellSlotElement(barrierSlot, barrierUnlocked ? 'barrier' : null);
    if (!barrierUnlocked) {
      barrierSlot.name.setText('lv1');
      barrierSlot.cd.setText('');
      barrierSlot.icon.setAlpha(0.3);
      barrierSlot.lock?.setVisible(true).setAlpha(1);
      barrierSlot.bg.setStrokeStyle(2, 0x443866);
      barrierSlot.bg.setFillStyle(0x12101c, 0.95);
    } else {
      barrierSlot.lock?.setVisible(false);
      barrierSlot.name.setText(shielded ? 'escudo!' : 'escudo');
      barrierSlot.cd.setText(barrierCd > 0 ? barrierCd.toFixed(1) : '');
      barrierSlot.icon.setAlpha(barrierCd > 0 && !shielded ? 0.45 : 1);
      barrierSlot.bg.setStrokeStyle(2, shielded ? 0xffffff : barrierCd > 0 ? 0x445566 : 0x88aaff);
      barrierSlot.bg.setFillStyle(shielded ? 0x1a2848 : 0x1a1430, 0.95);
    }

    // Slot depois do escudo (6): heal inato (H, lv1+)
    const mendSlot = this.spellSlots[6];
    const mendUnlocked = (me.level || 1) >= 1;
    const mendCd = me.mendCooldown || 0;
    this.setSpellSlotIcon(mendSlot, 'mend');
    this.setSpellSlotElement(mendSlot, mendUnlocked ? 'mend' : null);
    if (!mendUnlocked) {
      mendSlot.name.setText('lv1');
      mendSlot.cd.setText('');
      mendSlot.icon.setAlpha(0.3);
      mendSlot.lock?.setVisible(true).setAlpha(1);
      mendSlot.bg.setStrokeStyle(2, 0x443866);
      mendSlot.bg.setFillStyle(0x12101c, 0.95);
    } else {
      mendSlot.lock?.setVisible(false);
      mendSlot.name.setText('heal');
      mendSlot.cd.setText(mendCd > 0 ? mendCd.toFixed(1) : '');
      mendSlot.icon.setAlpha(mendCd > 0 ? 0.45 : 1);
      mendSlot.bg.setStrokeStyle(2, mendCd > 0 ? 0x445544 : 0x55ff88);
      mendSlot.bg.setFillStyle(0x1a1430, 0.95);
    }

    // Slot depois do heal (7): blink inato (B, lv5+)
    const blinkSlot = this.spellSlots[7];
    const blinkUnlocked = (me.level || 1) >= 5;
    const blinkCd = me.blinkCooldown || 0;
    this.setSpellSlotIcon(blinkSlot, 'blink');
    this.setSpellSlotElement(blinkSlot, blinkUnlocked ? 'blink' : null);
    if (!blinkUnlocked) {
      blinkSlot.name.setText('lv5');
      blinkSlot.cd.setText('');
      blinkSlot.icon.setAlpha(0.3);
      blinkSlot.lock?.setVisible(true).setAlpha(1);
      blinkSlot.bg.setStrokeStyle(2, 0x443866);
      blinkSlot.bg.setFillStyle(0x12101c, 0.95);
    } else {
      blinkSlot.lock?.setVisible(false);
      blinkSlot.name.setText('blink');
      blinkSlot.cd.setText(blinkCd > 0 ? blinkCd.toFixed(1) : '');
      blinkSlot.icon.setAlpha(blinkCd > 0 ? 0.45 : 1);
      blinkSlot.bg.setStrokeStyle(2, blinkCd > 0 ? 0x554466 : 0xaa88ff);
      blinkSlot.bg.setFillStyle(0x1a1430, 0.95);
    }

    this.updateScoreboard();
  }

  updateLootNotifications() {
    if (!this.lootNotifications.length) return;
    const now = this.time.now;
    const TTL = 4000;
    const FADE_DURATION = 600;
    const MAX_VISIBLE = 5;
    const ROW_H = 15;
    const PANEL_X = 12;
    const PANEL_Y = 12;

    const panelH = this.hudPanel.height || 96;
    const baseY = PANEL_Y + panelH + 6;

    // Cria textos para novos itens ainda sem textObj
    for (const entry of this.lootNotifications) {
      if (entry.textObj) continue;
      const alive = this.lootNotifications.filter(e => e.textObj && !e.fading && !e.destroyed).length;
      const initialY = baseY + alive * ROW_H;

      entry.textObj = this.add.text(PANEL_X + 6, initialY, entry.name, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#' + (entry.color >>> 0).toString(16).padStart(6, '0'),
        stroke: '#000000',
        strokeThickness: 2,
      })
        .setScrollFactor(0)
        .setDepth(105)
        .setAlpha(0);

      this.tweens.add({
        targets: entry.textObj,
        alpha: 1,
        duration: 200,
      });
    }

    // Marca fading para itens que expiraram (TTL) ou excedem MAX_VISIBLE
    const alive = this.lootNotifications.filter(e => e.textObj && !e.fading && !e.destroyed);
    const fifo = alive.slice(0, Math.max(0, alive.length - MAX_VISIBLE));
    for (const entry of alive) {
      if (entry.fading) continue;
      const age = now - entry.addedAt;
      const expired = age >= TTL;
      const overflow = fifo.includes(entry);
      if (!expired && !overflow) continue;

      entry.fading = true;
      this.tweens.add({
        targets: entry.textObj,
        alpha: 0,
        y: entry.textObj.y - 20,
        duration: FADE_DURATION,
        onComplete: () => {
          entry.textObj.destroy();
          entry.textObj = null;
          entry.destroyed = true;
        },
      });
    }

    // Reposiciona itens visíveis não-fading (empilha no canto esquerdo)
    const visible = alive.filter(e => !e.fading).slice(-MAX_VISIBLE);
    for (let i = 0; i < visible.length; i++) {
      const targetY = baseY + i * ROW_H;
      const text = visible[i].textObj;
      if (text && Math.abs(text.y - targetY) > 1) {
        this.tweens.killTweensOf(text);
        this.tweens.add({
          targets: text,
          y: targetY,
          duration: 250,
          ease: 'Power1',
        });
      }
    }

    // Remove entradas com textos já destruídos
    this.lootNotifications = this.lootNotifications.filter(e => !e.destroyed);
  }

  showBossFightAlert() {
    if (!this.bossFightText) return;
    this.bossFightText.setText('BOSS FIGHT!');
    this.bossFightText.setAlpha(1);
    this.bossFightText.setScale(0.7);
    this.tweens.killTweensOf(this.bossFightText);
    this.tweens.add({
      targets: this.bossFightText,
      scale: 1.05,
      duration: 280,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 900,
      onComplete: () => {
        this.tweens.add({
          targets: this.bossFightText,
          alpha: 0,
          scale: 1.2,
          duration: 700,
          ease: 'Cubic.easeIn',
        });
      },
    });
  }

  handleBanners() {
    if (!this.state || this.matchEndOpen) return;
    if (this.state.phase === 'countdown' && (this.state.round || 0) === 0) {
      const sec = Math.max(1, Math.ceil(this.state.countdown || 0));
      const bossSoon = !!this.state.bossRound || !!this.state.pendingBossFight;
      const nextRound = bossSoon ? this.state.round || 1 : 1;
      this.bannerText.setText(
        bossSoon
          ? `BOSS FIGHT\nRound ${nextRound} · ${sec}`
          : `Round ${nextRound}\nComeçando · ${sec}`
      );
      this.bannerText.setAlpha(1);
    } else if (
      (this.state.phase === 'playing' || this.state.phase === 'levelup') &&
      this.me() &&
      !this.me().alive
    ) {
      this.bannerText.setText(
        this.state.bossRound
          ? 'Você morreu\nSe todos caírem, a partida acaba'
          : 'Você morreu\nRevive no próximo round'
      );
      this.bannerText.setAlpha(1);
    } else if (this.state.phase === 'playing' && this.bannerText.alpha > 0 && !this.levelUpOpen) {
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

  /** Escolha de magia ao vivo (PvE e PvP), sem pausar o combate. */
  isLiveSpellChoice() {
    const phase = this.state?.phase;
    return (
      phase === 'playing' ||
      phase === 'intermission' ||
      phase === 'countdown' ||
      phase === 'levelup'
    );
  }

  updateLevelUpUi() {
    const me = this.me();
    if (!me || !this.state) return;

    if (!this.isLiveSpellChoice()) {
      if (this.levelUpOpen) this.hideLevelUp();
      return;
    }

    const choices = me.spellChoices;
    const needs = me.pendingLevelUps > 0 && choices?.length;

    if (!needs) {
      this.levelUpSubmitting = false;
      this.levelUpSubmittedKey = null;
      this.levelUpChoices = [];
      if (this.levelUpOpen) this.hideLevelUp();
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
      } else if (this.levelUpPointsText) {
        this.levelUpPointsText.setText(this.levelUpPointsLabel(me.pendingLevelUps));
      }
      return;
    }

    if (!this.levelUpOpen || key !== this.levelUpChoiceKey) {
      this.showLevelUp(choices, key);
    } else {
      if (this.levelUpPointsText) {
        this.levelUpPointsText.setText(this.levelUpPointsLabel(me.pendingLevelUps));
      }
      this.updateLevelUpSlotHint();
    }
  }

  levelUpPointsLabel(pending) {
    const pts = Math.max(1, pending || 1);
    return pts === 1 ? '1 ponto para distribuir' : `${pts} pontos para distribuir`;
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

  setSpellSlotElement(slot, spellId) {
    const el = slot?.elementIcon;
    if (!el) return;
    if (!spellId) {
      el.setVisible(false);
      return;
    }
    const key = spellElementIconKey(spellId);
    if (key && this.textures.exists(key)) {
      el.setTexture(key).setDisplaySize(12, 12).setVisible(true);
    } else {
      el.setVisible(false);
    }
  }

  spellSlotFilled(index) {
    const me = this.me();
    if (!me) return false;
    if (index >= 0 && index < 3) return !!me.spells?.[index];
    if (index === 3) return !!me.ultimate;
    return false;
  }

  filledSpellSlots() {
    const slots = [];
    for (let i = 0; i < 4; i++) {
      if (this.spellSlotFilled(i)) slots.push(i);
    }
    return slots;
  }

  /**
   * Troca entre magias preenchidas. Sem próxima habilidade → volta à primeira.
   * @param {number} dir 1 = próxima (Tab/scroll↓), -1 = anterior (scroll↑)
   */
  cycleSpellSlot(dir = 1) {
    const filled = this.filledSpellSlots();
    if (!filled.length) {
      this.selectedSpellSlot = 0;
      return;
    }

    const step = dir >= 0 ? 1 : -1;
    let idx = filled.indexOf(this.selectedSpellSlot);
    if (idx < 0) {
      // Slot atual vazio (ex.: sem ultimate) → primeira magia
      this.selectedSpellSlot = filled[0];
      return;
    }

    const next = (idx + step + filled.length) % filled.length;
    this.selectedSpellSlot = filled[next];
  }

  updateLevelUpSlotHint() {
    if (!this.levelUpHint || this.levelUpSubmitting) return;
    this.levelUpHint.setText('1 · 2 · 3 · 4 para escolher');
    this.updateLevelUpCountdown();
  }

  /** Contagem regressiva do auto-escolha no painel. */
  updateLevelUpCountdown() {
    if (!this.levelUpCountdown || this.levelUpSubmitting) return;

    const timeLeft = this.me()?.choiceTimeLeft;
    if (timeLeft == null || !Number.isFinite(timeLeft)) {
      this.levelUpCountdown.setText('').setVisible(false);
      return;
    }

    const sec = Math.max(0, Math.ceil(timeLeft));
    this.levelUpCountdown
      .setVisible(true)
      .setColor(sec <= 3 ? '#ff6b6b' : '#ffd166')
      .setText(sec > 0 ? `Auto ${sec}s` : '…');
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

  clearLevelUpLayer() {
    if (this.levelUpLayer) {
      for (const child of this.levelUpLayer.list.slice()) {
        this.tweens.killTweensOf(child);
      }
      this.levelUpLayer.removeAll(true);
    }
    this.levelUpHint = null;
    this.levelUpCountdown = null;
    this.levelUpPointsText = null;
    this.choiceCards = [];
  }

  showLevelUp(choices, key = null) {
    const me = this.me();
    this.levelUpOpen = true;
    this.levelUpSubmitting = false;
    this.levelUpChoices = choices || [];
    this.levelUpChoiceKey =
      key ?? this.choicesKey(choices, me?.choiceSetId, me?.pendingLevelUps || 0);
    this.clearLevelUpLayer();
    this.levelUpLayer.setVisible(true);

    const { width, height } = this.scale;
    const pointsLabel = this.levelUpPointsLabel(me?.pendingLevelUps);

    // Painel no canto inferior direito (sem overlay)
    const n = Math.max(1, choices.length);
    const cardW = 168;
    const cardH = 200;
    const gap = 176;
    const cardScale = 0.88;
    const clusterW = (n - 1) * gap;
    const rightPad = 20;
    const anchorX = width - rightPad - (cardW * cardScale) / 2;
    const startX = anchorX - clusterW;
    const cardY = height - 128;
    const headerX = width - rightPad;
    const titleY = cardY - cardH * cardScale * 0.5 - 58;

    this.levelUpPointsText = this.add
      .text(headerX, titleY, pointsLabel, {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#ffd166',
        stroke: '#1a1030',
        strokeThickness: 4,
      })
      .setOrigin(1, 0.5);
    this.levelUpCountdown = this.add
      .text(headerX, titleY + 24, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#ffd166',
        stroke: '#1a1030',
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5);
    this.levelUpHint = this.add
      .text(headerX, titleY + 44, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#c4b5e0',
        stroke: '#1a1030',
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5);
    this.updateLevelUpSlotHint();

    this.levelUpLayer.add([
      this.levelUpPointsText,
      this.levelUpCountdown,
      this.levelUpHint,
    ]);

    choices.forEach((choice, i) => {
      const x = startX + i * gap;
      const y = cardY;
      const card = this.add.container(x, y);
      const stroke = choice.kind === 'upgrade' ? 0xf1c40f : choice.def?.color || 0x6b5cff;
      const bg = this.add
        .rectangle(0, 0, cardW, cardH, 0x1a1430, 0.92)
        .setStrokeStyle(2, stroke);
      const topY = -84;
      const badgeY = -80;
      const iconY = -38;
      const nameY = 10;
      const descY = 48;
      const metaY = 80;
      const keyHint = this.add
        .text(-(cardW / 2 - 18), topY, `${i + 1}`, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#2a2250',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5);
      const badge = this.add
        .text(0, badgeY, choice.label || (choice.kind === 'upgrade' ? 'UPGRADE' : 'NOVA'), {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '12px',
          color: choice.kind === 'upgrade' ? '#f1c40f' : '#a99bc8',
        })
        .setOrigin(0.5);

      const spellId = choice.spellId || choice.def?.id;
      const iconKey = this.spellIconKey(spellId);
      const iconBg = this.add.rectangle(0, iconY, 52, 52, 0x0e0a1a, 0.95).setStrokeStyle(2, stroke);
      const icon =
        iconKey && this.textures.exists(iconKey)
          ? this.add.image(0, iconY, iconKey).setScale(1.5)
          : this.add.circle(0, iconY, 15, choice.def?.color || 0x6b5cff, 0.9);

      const elementKey = spellId ? spellElementIconKey(spellId) : null;
      const elementIcon =
        elementKey && this.textures.exists(elementKey)
          ? this.add.image(-18, iconY - 18, elementKey).setDisplaySize(16, 16)
          : null;
      const elementName = choice.def?.elementLabel || (spellId ? spellElementLabel(spellId) : '');
      const elementColorHex = `#${(choice.def?.element
        ? spellElementColor(choice.def.element)
        : spellId
          ? spellElementColor(spellId)
          : 0xa99bc8
      )
        .toString(16)
        .padStart(6, '0')}`;
      const elementText = this.add
        .text(0, nameY - 16, elementName, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: elementColorHex,
        })
        .setOrigin(0.5);

      const name = this.add
        .text(0, nameY, choice.def?.name || choice.spellId, {
          fontFamily: 'Georgia, serif',
          fontSize: '16px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      const desc = this.add
        .text(0, descY, choice.def?.description || '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: '#c4b5e0',
          align: 'center',
          wordWrap: { width: cardW - 28 },
        })
        .setOrigin(0.5);
      const meta = this.add
        .text(
          0,
          metaY,
          choice.kind === 'upgrade'
            ? `Lv ${choice.fromLevel} → ${choice.toLevel}`
            : choice.def?.type === 'ultimate'
              ? `Ultimate · CD ${choice.def?.cooldown ?? '-'}s`
              : `Dano ${choice.def?.damage ?? '-'} · CD ${choice.def?.cooldown ?? '-'}s`,
          {
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '12px',
            color: '#ffcc66',
            align: 'center',
          }
        )
        .setOrigin(0.5);

      card.add(
        [bg, keyHint, badge, iconBg, icon, elementIcon, elementText, name, desc, meta].filter(
          Boolean
        )
      );
      card.setSize(cardW, cardH);
      card.setScale(cardScale);
      // Escolha só por hotkeys 1–4 (sem clique)
      this.levelUpLayer.add(card);
      this.choiceCards.push(card);
    });
  }

  hideLevelUp() {
    const layer = this.levelUpLayer;
    this.levelUpOpen = false;
    this.levelUpSubmitting = false;
    this.levelUpChoiceKey = null;
    this.levelUpSubmittedKey = null;
    this.levelUpChoices = [];
    this.levelUpHint = null;
    this.levelUpCountdown = null;
    this.levelUpPointsText = null;
    this.choiceCards = [];
    this.clearLevelUpLayer();
    if (layer) layer.setVisible(false);
  }
}
