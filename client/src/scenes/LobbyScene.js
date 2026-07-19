import Phaser from 'phaser';
import { ensureCharacter } from '../character.js';
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
    this.lobby = null;
    this.adminModalOpen = false;
    this.adminModal = null;
    this.adminChecksDom = null;
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
      this.closeAdminModal();
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

    this.add
      .text(panelX, panelY - 210, 'Lobby', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '22px',
        color: '#e8dfff',
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
    this.readyBtn = this.makeButton(panelX, btnStartY, 'Iniciar', 0x2ecc71, () => this.toggleReady(), btnW);
    this.setButtonEnabled(this.readyBtn, false);

    const halfW = (btnW - 12) / 2;
    this.botsBtn = this.makeButton(
      panelX - halfW / 2 - 6,
      btnStartY + step,
      '+ Bot',
      0xff8c42,
      () => this.addBot(),
      halfW
    );
    this.removeBotsBtn = this.makeButton(
      panelX + halfW / 2 + 6,
      btnStartY + step,
      '− Bot',
      0xc0392b,
      () => this.removeBot(),
      halfW
    );
    this.setButtonEnabled(this.botsBtn, false);
    this.setButtonEnabled(this.removeBotsBtn, false);

    this.adminBtn = this.makeButton(
      panelX,
      btnStartY + step * 2,
      'Opções da Partida',
      0x8e44ad,
      () => this.openAdminModal(),
      btnW
    );
    this.setButtonEnabled(this.adminBtn, false);

    this.leaveBtn = this.makeButton(
      panelX,
      btnStartY + step * 3,
      'Sair',
      0xc0392b,
      () => this.leaveToMatchmaking(),
      btnW
    );

    for (const btn of [
      this.readyBtn,
      this.botsBtn,
      this.removeBotsBtn,
      this.adminBtn,
      this.leaveBtn,
    ]) {
      btn.setDepth(uiDepth);
    }

    this.adminModal = this.add.container(0, 0).setDepth(400).setVisible(false);

    this.hint = this.add
      .text(panelX, height - 36, '1 jogador ready já inicia · ou chame amigos/bots', {
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

  setLobbyDomVisible(visible) {
    if (this.playersListDom) this.playersListDom.setVisible(visible);
    this.messageBoard?.setDomVisible(visible);
  }

  openAdminModal() {
    if (this.adminModalOpen) return;
    if (!this.joined) return;
    this.adminModalOpen = true;

    this.setLobbyDomVisible(false);

    const { width, height } = this.scale;
    this.adminModal.removeAll(true);
    this.adminModal.setDepth(10000).setVisible(true);
    this.children.bringToTop(this.adminModal);

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.closeAdminModal());

    const panel = this.add
      .rectangle(width / 2, height / 2, 420, 390, 0x161228, 0.98)
      .setStrokeStyle(2, 0x8e44ad);
    // Impede o clique no painel de fechar o modal (propaga pro dim)
    panel.setInteractive();
    panel.on('pointerup', (_p, _x, _y, event) => event.stopPropagation());

    const title = this.add
      .text(width / 2, height / 2 - 155, 'Opções da Partida', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(width / 2, height / 2 - 117, 'Marque as opções e clique em Salvar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5);

    const botIdle = this.lobby?.botAiEnabled === false;
    const mobSpawn = this.lobby?.monsterSpawnEnabled !== false;
    const botLevelUp = this.lobby?.botLevelUpChoiceEnabled !== false;
    const pvpOn = this.lobby?.pvpEnabled !== false;

    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'gap: 18px',
      'width: 320px',
      'padding: 8px 12px',
      'box-sizing: border-box',
      'font-family: Trebuchet MS, sans-serif',
      'font-size: 16px',
      'color: #e8dfff',
      'user-select: none',
      'pointer-events: auto',
      'z-index: 10001',
    ].join(';');

    const makeCheck = (labelText, checked) => {
      const row = document.createElement('label');
      row.style.cssText = [
        'display: flex',
        'align-items: center',
        'gap: 12px',
        'cursor: pointer',
        'pointer-events: auto',
      ].join(';');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      cb.style.cssText = [
        'width: 22px',
        'height: 22px',
        'accent-color: #8e44ad',
        'cursor: pointer',
        'pointer-events: auto',
        'flex-shrink: 0',
      ].join(';');
      const span = document.createElement('span');
      span.textContent = labelText;
      row.append(cb, span);
      wrap.appendChild(row);
      return cb;
    };

    this.adminBotIdleCheck = makeCheck('Bot parado (não ataca)', botIdle);
    this.adminMobSpawnCheck = makeCheck('Respawn de mobs', mobSpawn);
    this.adminBotLevelUpCheck = makeCheck(
      'Bot escolhe habilidade (outros esperam)',
      botLevelUp
    );
    this.adminPvpCheck = makeCheck('PvP (jogadores/bots se atacam)', pvpOn);

    this.adminChecksDom = this.add
      .dom(width / 2, height / 2 - 5, wrap)
      .setOrigin(0.5)
      .setDepth(10001);

    const saveBg = this.add
      .rectangle(width / 2 - 80, height / 2 + 150, 140, 40, 0x2ecc71, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const saveLabel = this.add
      .text(width / 2 - 80, height / 2 + 150, 'Salvar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    saveBg.setInteractive({ useHandCursor: true });
    saveBg.on('pointerover', () => saveBg.setScale(1.04));
    saveBg.on('pointerout', () => saveBg.setScale(1));
    saveBg.on('pointerup', () => this.saveAdminSettings());

    const closeBg = this.add
      .rectangle(width / 2 + 80, height / 2 + 150, 140, 40, 0x443866, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const closeLabel = this.add
      .text(width / 2 + 80, height / 2 + 150, 'Fechar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerover', () => closeBg.setScale(1.04));
    closeBg.on('pointerout', () => closeBg.setScale(1));
    closeBg.on('pointerup', () => this.closeAdminModal());

    this.adminModal.add([dim, panel, title, hint, saveBg, saveLabel, closeBg, closeLabel]);
  }

  closeAdminModal() {
    if (!this.adminModalOpen && !this.adminChecksDom) return;
    this.adminModalOpen = false;
    if (this.adminChecksDom) {
      this.adminChecksDom.destroy();
      this.adminChecksDom = null;
    }
    this.adminBotIdleCheck = null;
    this.adminMobSpawnCheck = null;
    this.adminBotLevelUpCheck = null;
    this.adminPvpCheck = null;
    if (this.adminModal) {
      this.adminModal.removeAll(true);
      this.adminModal.setVisible(false);
    }
    this.setLobbyDomVisible(true);
  }

  saveAdminSettings() {
    if (!this.joined) return;
    const botIdle = !!this.adminBotIdleCheck?.checked;
    const mobSpawn = !!this.adminMobSpawnCheck?.checked;
    const botLevelUp = !!this.adminBotLevelUpCheck?.checked;
    const pvpOn = !!this.adminPvpCheck?.checked;
    this.socket.emit('admin_settings', {
      botAiEnabled: !botIdle,
      monsterSpawnEnabled: mobSpawn,
      botLevelUpChoiceEnabled: botLevelUp,
      pvpEnabled: pvpOn,
    });
    if (this.lobby) {
      this.lobby.botAiEnabled = !botIdle;
      this.lobby.monsterSpawnEnabled = mobSpawn;
      this.lobby.botLevelUpChoiceEnabled = botLevelUp;
      this.lobby.pvpEnabled = pvpOn;
    }
    this.closeAdminModal();
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
      this.setButtonEnabled(this.adminBtn, true);
      this.refreshRemoveBotsBtn();
      this.messageBoard?.setChatEnabled(true);
      this.statusText.setText('No lobby. Marque Ready quando estiver preparado.');
    });

    this.socket.on('error_msg', (payload) => {
      const code = payload?.code;
      const message = payload?.message || 'Erro';
      if (code === 'lobby_not_found' || code === 'bad_password') {
        this.leavingToMenu = true;
        const banner =
          code === 'lobby_not_found' ? 'Lobby não existe.' : 'Senha incorreta.';
        sessionStorage.setItem('wa_mm_message', banner);
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
    const payload = {
      matchId: this.matchId,
      characterId: this.character.id,
      name: this.character.name,
      color: this.character.color,
      skin: this.character.skin,
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

  addBot() {
    if (!this.joined) return;
    this.socket.emit('add_bots', { count: 1 });
  }

  removeBot() {
    if (!this.joined) return;
    this.socket.emit('remove_bots', { count: 1 });
  }

  refreshRemoveBotsBtn() {
    if (!this.removeBotsBtn) return;
    const botCount = this.lobby?.players?.filter((p) => p.isBot).length || 0;
    this.setButtonEnabled(this.removeBotsBtn, this.joined && botCount > 0);
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
    this.refreshRemoveBotsBtn();
    const readyCount = this.lobby.players.filter((p) => p.ready).length;
    this.statusText.setText(
      `${n}/${this.lobby.maxPlayers} jogadores · ${readyCount} ready · precisa ${this.lobby.minPlayers}+`
    );
  }
}
