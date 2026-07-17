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
    const raw = localStorage.getItem('wa_lobby_music_vol');
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0.2;
    return Phaser.Math.Clamp(n, 0, 1);
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

    const title = this.add
      .text(width / 2 - 36, 72, 'WIZARD ARENA', {
        fontFamily: 'Georgia, serif',
        fontSize: '56px',
        color: '#f4e8ff',
        stroke: '#3a2060',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const manaPotion = this.add
      .image(title.x + title.width / 2 + 8, title.y + 6, 'mana_potion')
      .setOrigin(0, 0.5)
      .setScale(1.15);

    this.tweens.add({
      targets: manaPotion,
      y: manaPotion.y - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
      .text(panelX, panelY - 76, 'Digite seu nome e entre no lobby.', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5);

    this.playersText = this.add
      .text(panelX, panelY - 10, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '16px',
        color: '#eee6ff',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    const btnStartY = panelY + 70;
    const step = btnH + btnGap;
    this.joinBtn = this.makeButton(panelX, btnStartY, 'Entrar', 0x6b5cff, () => this.joinLobby(), btnW);
    this.readyBtn = this.makeButton(panelX, btnStartY + step, 'Ready', 0x2ecc71, () => this.toggleReady(), btnW);
    this.setButtonEnabled(this.readyBtn, false);

    this.botsBtn = this.makeButton(
      panelX,
      btnStartY + step * 2,
      '+ Bot (testar solo)',
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
    this.playersText.setText(
      lines.length
        ? lines.join('\n')
        : 'Nenhum jogador ainda'
    );
    const n = this.lobby.players.length;
    const readyCount = this.lobby.players.filter((p) => p.ready).length;
    this.statusText.setText(
      `${n}/${this.lobby.maxPlayers} jogadores · ${readyCount} ready · precisa ${this.lobby.minPlayers}+`
    );
  }
}
