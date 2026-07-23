import Phaser from 'phaser';
import { ensureCharacter } from '../character.js';
import { equipmentBonusesFromInventory } from '../inventory.js';
import { getSocket } from '../net/socket.js';
import { navigate } from '../router.js';
import { MessageBoard } from '../ui/MessageBoard.js';
import {
  createMagicFlakes,
  createMenuFlames,
  updateMenuFlames,
} from '../ui/menuChrome.js';
import {
  createAmbientCreatures,
  destroyAmbientCreatures,
  updateAmbientCreatures,
} from '../ui/ambientCreatures.js';
import {
  ensureMenuMusic,
  stopMenuMusic,
} from '../audio/menuMusic.js';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  init(data = {}) {
    this.matchId = data.matchId || null;
    this.joinPassword = data.password || null;
  }

  create() {
    this.socket = getSocket();
    this.character = ensureCharacter();
    this.playerName = this.character.name;
    this.joined = false;
    this.ready = false;
    this.autoMode = false;
    this.lobby = null;
    this.leavingToMenu = false;
    this.enteringGame = false;

    if (!this.matchId) {
      navigate('/matchmaking', { replace: true });
      return;
    }

    // Senha guardada ao entrar pela listagem
    try {
      const raw = sessionStorage.getItem('wa_join_password');
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.matchId === this.matchId && data.password) {
          this.joinPassword = data.password;
        }
        sessionStorage.removeItem('wa_join_password');
      }
    } catch {
      sessionStorage.removeItem('wa_join_password');
    }

    this.drawBackground();
    createAmbientCreatures(this);
    this.buildUI();
    this.createChatBoard();
    this.bindSocket();
    ensureMenuMusic(this);
    this.joinLobby();

    this.events.once('shutdown', () => {
      this.messageBoard?.destroy();
      this.messageBoard = null;
      destroyAmbientCreatures(this);
      // Ao ir para a GameScene o Lobby encerra — não sair da partida.
      if (!this.leavingToMenu && !this.enteringGame && this.joined) {
        this.socket.emit('leave_lobby');
      }
    });
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

    createMenuFlames(this);
    createMagicFlakes(this);

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

  update(_time, delta) {
    updateMenuFlames(this);
    updateAmbientCreatures(this, delta);
  }

  buildUI() {
    const { width, height } = this.scale;
    const panelX = width / 2;
    const panelY = height / 2 + 10;
    const btnW = 280;
    const btnH = 48;
    const btnGap = 8;
    const uiDepth = 10;

    this.titleText = this.add
      .text(panelX, panelY - 210, 'Lobby', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '22px',
        color: '#e8dfff',
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.add
      .text(panelX, panelY - 168, this.playerName, {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.statusText = this.add
      .text(panelX, panelY - 120, 'Entrando no lobby...', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

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
    this.playersListDom = this.add.dom(panelX, panelY - 20, listEl).setOrigin(0.5).setDepth(uiDepth);
    listEl.textContent = 'Nenhum jogador ainda';

    const btnStartY = panelY + 70;
    const step = btnH + btnGap;
    this.readyBtn = this.makeButton(panelX, btnStartY, 'Pronto', 0x2ecc71, () => this.toggleReady(), btnW);
    this.setButtonEnabled(this.readyBtn, false);

    this.leaveBtn = this.makeButton(
      panelX,
      btnStartY + step,
      'Sair',
      0xc0392b,
      () => this.leaveToMatchmaking(),
      btnW
    );

    this.autoModeBtn = this.makeAutoModeToggle(
      panelX,
      btnStartY + step * 2 + 10,
      uiDepth
    );

    for (const btn of [this.readyBtn, this.leaveBtn, this.autoModeBtn]) {
      btn.setDepth(uiDepth);
    }

    this.hint = this.add
      .text(panelX, height - 36, '1 jogador ready já inicia · ou chame amigos', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#7a6e96',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);
  }

  createChatBoard() {
    this.messageBoard = new MessageBoard(this, {
      tabs: ['chat'],
      initialTab: 'chat',
      onSendChat: (text) => {
        if (!this.joined) return;
        this.socket.emit('chat_message', { text });
      },
    });
    this.messageBoard.setChatEnabled(false);
    this.messageBoard.pushChat('Entre no lobby para conversar.');
    this.input.on('wheel', (_pointer, _gos, _dx, dy) => {
      this.messageBoard?.onWheel(dy);
    });
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

  makeAutoModeToggle(x, y, depth) {
    const w = 280;
    const h = 44;
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, 0x1a1540, 1)
      .setStrokeStyle(2, 0x6b5cff, 0.8);
    const checkBox = this.add.rectangle(-w / 2 + 20, 0, 18, 18, 0x1a1540, 1)
      .setStrokeStyle(2, 0x6b5cff, 1);
    const checkMark = this.add.text(-w / 2 + 20, 0, '\u2713', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      color: '#2ecc71',
    }).setOrigin(0.5).setAlpha(0);
    const label = this.add
      .text(-w / 2 + 48, 0, 'Modo Automático', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
      })
      .setOrigin(0, 0.5);
    container.add([bg, checkBox, checkMark, label]);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      if (container.enabled !== false) bg.setStrokeStyle(2, 0x9b8cff, 1);
    });
    bg.on('pointerout', () => {
      if (container.enabled !== false) bg.setStrokeStyle(2, 0x6b5cff, 0.8);
    });
    bg.on('pointerup', () => {
      if (container.enabled !== false) this.toggleAutoMode();
    });

    container.enabled = true;
    container._bg = bg;
    container._checkBox = checkBox;
    container._checkMark = checkMark;
    container._label = label;
    return container;
  }

  updateAutoModeToggle() {
    if (!this.autoModeBtn) return;
    this.autoModeBtn._checkMark.setAlpha(this.autoMode ? 1 : 0);
    this.autoModeBtn._checkBox.setFillStyle(this.autoMode ? 0x2ecc71 : 0x1a1540, 1);
    this.autoModeBtn._bg.setStrokeStyle(2, this.autoMode ? 0x2ecc71 : 0x6b5cff, 0.8);
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
      this.messageBoard?.setChatEnabled(true);
      this.statusText.setText('Marque Pronto quando estiver preparado. Se todos estiverem prontos, a partida será iniciada automaticamente.');
    });

    this.socket.on('error_msg', (payload) => {
      const code = payload?.code;
      const message = payload?.message || 'Erro';
      const redirectCodes = {
        lobby_not_found: 'Lobby não existe.',
        bad_password: 'Senha incorreta.',
        match_started: 'Partida já iniciada.',
        already_in_lobby: 'Você já está em uma sala.',
      };
      if (code && redirectCodes[code]) {
        this.leavingToMenu = true;
        sessionStorage.setItem('wa_mm_message', redirectCodes[code]);
        navigate('/matchmaking', { replace: true });
        return;
      }
      this.statusText.setText(message);
    });

    this.socket.on('game_event', (ev) => {
      if (ev.type === 'countdown') {
        this.statusText.setText(`Partida iniciando em ${ev.seconds}...`);
        this.enterGame();
      } else if (ev.type === 'chat') {
        const name = ev.name || 'Jogador';
        this.messageBoard?.pushChat(`${name}: ${ev.text}`);
      }
    });

    this.socket.on('game_state', (state) => {
      if (state.phase === 'lobby') return;
      this.enterGame();
    });
  }

  enterGame() {
    if (this.enteringGame) return;
    if (this.scene.isActive('Game') || this.scene.isSleeping('Game')) return;
    this.enteringGame = true;
    stopMenuMusic();
    this.scene.start('Game', { playerId: this.socket.id });
  }

  joinLobby() {
    if (!this.matchId) return;
    const bonuses = equipmentBonusesFromInventory(this.character.inventory);
    const payload = {
      matchId: this.matchId,
      characterId: this.character.id,
      name: this.character.name,
      color: this.character.color,
      skin: this.character.skin,
      ...bonuses,
    };
    if (this.joinPassword) payload.password = this.joinPassword;
    this.socket.emit('join_lobby', payload);
    this.statusText.setText('Entrando no lobby...');
  }

  leaveToMatchmaking() {
    this.leavingToMenu = true;
    if (this.joined) this.socket.emit('leave_lobby');
    this.joined = false;
    navigate('/matchmaking');
  }

  toggleReady() {
    if (!this.joined) return;
    this.ready = !this.ready;
    this.socket.emit('set_ready', { ready: this.ready });
    this.readyBtn.label.setText(this.ready ? 'Cancelar Ready' : 'Ready');
    this.readyBtn.bg.setFillStyle(this.ready ? 0xe67e22 : 0x2ecc71);
  }

  toggleAutoMode() {
    if (!this.joined) return;
    this.autoMode = !this.autoMode;
    this.socket.emit('toggle_auto_mode', { enabled: this.autoMode });
    this.updateAutoModeToggle();
  }

  refreshLobby() {
    if (!this.lobby) return;
    const me = this.lobby.players.find((p) => p.id === this.socket.id);
    if (me && me.autoMode !== undefined) {
      this.autoMode = me.autoMode;
      this.updateAutoModeToggle();
    }
    const lines = this.lobby.players.map((p) => {
      const tag = p.isBot ? ' [bot]' : '';
      const autoTag = p.autoMode ? ' [auto]' : '';
      const ready = p.ready ? '✓ ready' : '… waiting';
      return `${p.name}${tag}${autoTag}  —  ${ready}`;
    });
    const n = this.lobby.players.length;
    if (this.playersListEl) {
      this.playersListEl.textContent = lines.length
        ? lines.join('\n')
        : 'Nenhum jogador ainda';
      this.playersListEl.style.overflowY = n > 4 ? 'auto' : 'hidden';
    }
    const readyCount = this.lobby.players.filter((p) => p.ready).length;
    const host =
      this.lobby.players.find((p) => !p.isBot) || this.lobby.players[0];
    const roomName = host?.name ? `Sala de ${host.name}` : 'Lobby';
    const mode = this.lobby.pvpEnabled ? 'PvP' : 'PvE';
    const durSec = Number(this.lobby.roundDuration);
    const dur =
      Number.isFinite(durSec) && durSec > 0
        ? durSec < 60
          ? `${durSec}s por round`
          : `${Math.round(durSec / 60)} min por round`
        : null;
    this.titleText?.setText(dur ? `${roomName} · ${mode} · ${dur}` : `${roomName} · ${mode}`);
    this.statusText.setText(
      `${n}/${this.lobby.maxPlayers} jogadores · ${readyCount} ready · precisa ${this.lobby.minPlayers}+`
    );
  }
}
