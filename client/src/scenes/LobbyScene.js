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
    const btnW = 280;
    const btnH = 48;
    const btnGap = 10;

    this.add.rectangle(panelX, panelY, 680, 560, 0x161228, 0.92).setStrokeStyle(2, 0x6b5cff);

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
    this.joinBtn = this.makeButton(panelX, btnStartY, 'Entrar', 'door', () => this.joinLobby(), btnW);
    this.readyBtn = this.makeButton(panelX, btnStartY + step, 'Ready', 'shield', () => this.toggleReady(), btnW);
    this.setButtonEnabled(this.readyBtn, false);

    this.botsBtn = this.makeButton(
      panelX,
      btnStartY + step * 2,
      '+ Bot (testar solo)',
      'golem',
      () => this.addBot(),
      btnW
    );
    this.setButtonEnabled(this.botsBtn, false);

    this.controlsBtn = this.makeButton(
      panelX,
      btnStartY + step * 3,
      'Comandos',
      'scroll',
      () => this.openControlsModal(),
      btnW
    );

    this.controlsModalOpen = false;
    this.controlsModal = this.add.container(0, 0).setDepth(400).setVisible(false);

    this.hint = this.add
      .text(panelX, height - 36, 'Mín. 2 jogadores ready para iniciar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#7a6e96',
      })
      .setOrigin(0.5);
  }

  openControlsModal() {
    if (this.controlsModalOpen) return;
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
      .rectangle(width / 2, height / 2, 420, 400, 0x161228, 0.98)
      .setStrokeStyle(2, 0x6b5cff);

    const title = this.add
      .text(width / 2, height / 2 - 160, 'Comandos', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    const lines = [
      ['WASD', 'Mover'],
      ['Shift + WASD', 'Dash'],
      ['Mouse', 'Mirar'],
      ['1 – 4 / R', 'Selecionar magia'],
      ['Espaço', 'Usar magia'],
    ];

    const rows = [];
    const startY = height / 2 - 105;
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
      .rectangle(width / 2, height / 2 + 150, 140, 40, 0x6b5cff, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const closeLabel = this.add
      .text(width / 2, height / 2 + 150, 'Fechar', {
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

  makeButton(x, y, label, iconKey, onClick, width = 280) {
    const height = 48;
    const container = this.add.container(x, y);

    const glow = this.add.ellipse(0, 0, width + 28, height + 22, 0xffe2a0, 0.22);
    glow.setAlpha(0);

    const parchment = this.add.graphics();
    this.drawParchment(parchment, width, height);

    const hit = this.add.rectangle(0, 0, width, height, 0x000000, 0.001);

    const icon = this.drawButtonIcon(iconKey, -width / 2 + 34, 0);
    const text = this.add
      .text(-width / 2 + 52, 0, label, {
        fontFamily: 'Georgia, serif',
        fontSize: '17px',
        color: '#3a2614',
        stroke: '#e8d5a8',
        strokeThickness: 1,
      })
      .setOrigin(0, 0.5);

    container.add([glow, parchment, hit, icon, text]);

    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      if (container.enabled === false) return;
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: 0.55, duration: 140, ease: 'Sine.easeOut' });
      container.setScale(1.03);
    });
    hit.on('pointerout', () => {
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: 0, duration: 180, ease: 'Sine.easeIn' });
      container.setScale(1);
    });
    hit.on('pointerup', () => {
      if (container.enabled !== false) onClick();
    });

    container.glow = glow;
    container.parchment = parchment;
    container.hit = hit;
    container.icon = icon;
    container.label = text;
    container.iconKey = iconKey;
    container.btnW = width;
    container.btnH = height;
    container.enabled = true;
    return container;
  }

  drawParchment(g, width, height) {
    g.clear();
    const hw = width / 2;
    const hh = height / 2;
    const roll = 10;

    // Soft shadow
    g.fillStyle(0x1a0e08, 0.35);
    g.fillRoundedRect(-hw + 3, -hh + 4, width, height, 6);

    // Main parchment
    g.fillStyle(0xd8c09a, 1);
    g.fillRoundedRect(-hw + roll, -hh, width - roll * 2, height, 4);

    // Aged gradient bands
    g.fillStyle(0xc9a97a, 0.55);
    g.fillRect(-hw + roll + 6, -hh + 4, width - roll * 2 - 12, 5);
    g.fillStyle(0xb89568, 0.28);
    g.fillRect(-hw + roll + 8, hh - 8, width - roll * 2 - 16, 4);

    // Ink edge line
    g.lineStyle(1.5, 0x6b4a28, 0.7);
    g.strokeRoundedRect(-hw + roll + 2, -hh + 2, width - roll * 2 - 4, height - 4, 3);

    // Left roll
    g.fillStyle(0xb89568, 1);
    g.fillRoundedRect(-hw, -hh - 2, roll + 4, height + 4, 5);
    g.fillStyle(0x8a6a3e, 1);
    g.fillRoundedRect(-hw + 2, -hh, 4, height, 2);
    g.fillStyle(0xe8d5a8, 0.45);
    g.fillRoundedRect(-hw + 1, -hh + 3, 3, height - 6, 2);

    // Right roll
    g.fillStyle(0xb89568, 1);
    g.fillRoundedRect(hw - roll - 4, -hh - 2, roll + 4, height + 4, 5);
    g.fillStyle(0x8a6a3e, 1);
    g.fillRoundedRect(hw - 6, -hh, 4, height, 2);
    g.fillStyle(0xe8d5a8, 0.45);
    g.fillRoundedRect(hw - 5, -hh + 3, 3, height - 6, 2);

    // Tiny wax seal accent
    g.fillStyle(0x8b2e2e, 0.85);
    g.fillCircle(hw - roll - 18, 0, 5);
    g.fillStyle(0xc04545, 0.7);
    g.fillCircle(hw - roll - 18, -1, 2.5);
  }

  drawButtonIcon(iconKey, x, y) {
    const g = this.add.graphics();
    g.x = x;
    g.y = y;

    if (iconKey === 'door') {
      g.fillStyle(0x5a3a1a, 1);
      g.fillRoundedRect(-9, -11, 18, 22, 2);
      g.fillStyle(0xd8c09a, 1);
      g.fillRect(-6, -8, 12, 16);
      g.fillStyle(0xc9a040, 1);
      g.fillCircle(3, 1, 2);
    } else if (iconKey === 'shield') {
      const drawShield = () => {
        g.beginPath();
        g.moveTo(0, -12);
        g.lineTo(10, -7);
        g.lineTo(9, 4);
        g.lineTo(0, 12);
        g.lineTo(-9, 4);
        g.lineTo(-10, -7);
        g.closePath();
      };
      g.fillStyle(0x3d5a2a, 1);
      drawShield();
      g.fillPath();
      g.lineStyle(1.5, 0xc9a040, 0.9);
      drawShield();
      g.strokePath();
      g.fillStyle(0xe8d5a8, 1);
      g.fillCircle(0, -1, 3);
    } else if (iconKey === 'golem') {
      g.fillStyle(0x6b5a4a, 1);
      g.fillRoundedRect(-8, -6, 16, 16, 3);
      g.fillStyle(0x8a7868, 1);
      g.fillCircle(0, -10, 6);
      g.fillStyle(0xff8c42, 1);
      g.fillCircle(-2.5, -11, 1.5);
      g.fillCircle(2.5, -11, 1.5);
      g.fillStyle(0x5a4a3a, 1);
      g.fillRect(-11, -2, 4, 8);
      g.fillRect(7, -2, 4, 8);
    } else if (iconKey === 'scroll') {
      g.fillStyle(0xc9a97a, 1);
      g.fillRoundedRect(-10, -11, 20, 22, 3);
      g.fillStyle(0x8a6a3e, 1);
      g.fillRoundedRect(-10, -11, 20, 5, 2);
      g.fillRoundedRect(-10, 6, 20, 5, 2);
      g.lineStyle(1.5, 0x5a3a1a, 0.8);
      g.lineBetween(-5, -2, 5, -2);
      g.lineBetween(-5, 2, 3, 2);
    } else if (iconKey === 'cancel') {
      g.lineStyle(3, 0x8b2e2e, 1);
      g.lineBetween(-7, -7, 7, 7);
      g.lineBetween(7, -7, -7, 7);
    }

    return g;
  }

  setButtonIcon(btn, iconKey) {
    if (btn.icon) btn.icon.destroy();
    const icon = this.drawButtonIcon(iconKey, -btn.btnW / 2 + 34, 0);
    btn.add(icon);
    btn.icon = icon;
    btn.iconKey = iconKey;
  }

  setButtonEnabled(btn, enabled) {
    btn.enabled = enabled;
    btn.setAlpha(enabled ? 1 : 0.4);
    btn.setScale(1);
    if (btn.glow) {
      this.tweens.killTweensOf(btn.glow);
      btn.glow.setAlpha(0);
    }
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
    this.setButtonIcon(this.readyBtn, this.ready ? 'cancel' : 'shield');
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
