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

    this.drawBackground();
    this.buildUI();
    this.bindSocket();
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
    const panelY = height / 2 + 20;
    const btnW = 200;
    const btnGap = 16;

    this.add.rectangle(panelX, panelY, 680, 520, 0x161228, 0.92).setStrokeStyle(2, 0x6b5cff);

    this.add
      .text(panelX, panelY - 170, 'Lobby', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '22px',
        color: '#e8dfff',
      })
      .setOrigin(0.5);

    this.add
      .text(panelX, panelY - 128, 'Seu nome', {
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

    this.nameInput = this.add.dom(panelX, panelY - 90, inputEl).setOrigin(0.5);
    this.nameInput.addListener('keydown');
    this.nameInput.on('keydown', (event) => {
      if (event.key === 'Enter') this.joinLobby();
    });

    this.statusText = this.add
      .text(panelX, panelY - 36, 'Digite seu nome e entre no lobby.', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5);

    this.playersText = this.add
      .text(panelX, panelY + 40, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '16px',
        color: '#eee6ff',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    const rowY = panelY + 145;
    this.joinBtn = this.makeButton(panelX - (btnW + btnGap) / 2, rowY, 'Entrar', 0x6b5cff, () => this.joinLobby(), btnW);
    this.readyBtn = this.makeButton(panelX + (btnW + btnGap) / 2, rowY, 'Ready', 0x2ecc71, () => this.toggleReady(), btnW);
    this.setButtonEnabled(this.readyBtn, false);

    this.botsBtn = this.makeButton(panelX, panelY + 205, '+ Bot (testar solo)', 0xff8c42, () => this.addBot(), 260);
    this.setButtonEnabled(this.botsBtn, false);

    this.hint = this.add
      .text(
        panelX,
        height - 36,
        'Mín. 2 jogadores ready para iniciar · WASD mover · Mouse mirar · 1-4 magias · R ultimate',
        {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '13px',
          color: '#7a6e96',
        }
      )
      .setOrigin(0.5);
  }

  makeButton(x, y, label, color, onClick, width = 180) {
    const height = 44;
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

    // Clique no retângulo (origin 0.5) — setSize no container desloca a hitbox
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
