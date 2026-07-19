import Phaser from 'phaser';
import { ensureCharacter } from '../character.js';
import { getSocket } from '../net/socket.js';
import { navigate } from '../router.js';
import { MessageBoard } from '../ui/MessageBoard.js';
import { GalleryModal } from '../ui/GalleryModal.js';
import { parseGalleryUrl } from '../ui/galleryUrl.js';
import {
  RESOLUTIONS,
  applyResolution,
  loadResolutionId,
  saveResolutionId,
} from '../settings/resolution.js';
import {
  createMagicFlakes,
  createMenuFlames,
  updateMenuFlames,
} from '../ui/menuChrome.js';
import {
  ensureMenuMusic,
  getMenuMusicVolume,
  setMenuMusicVolume,
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
    this.lobbyMusicVolume = getMenuMusicVolume();
    this.settingsModalOpen = false;
    this.settingsModal = null;
    this.volumeSlider = null;
    this.resolutionSelect = null;
    this.resolutionId = loadResolutionId();
    this.adminModalOpen = false;
    this.adminModal = null;
    this.adminChecksDom = null;
    this.galleryModal = null;
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
    this.createAmbientCreatures();
    this.buildUI();
    this.createChatBoard();
    this.bindSocket();
    ensureMenuMusic(this);
    this.joinLobby();

    this.events.once('shutdown', () => {
      this.closeSettingsModal();
      this.closeAdminModal();
      this.closeControlsModal();
      this.galleryModal?.destroy();
      this.galleryModal = null;
      this.messageBoard?.destroy();
      this.messageBoard = null;
      this.destroyAmbientCreatures();
      // Ao ir para a GameScene o Lobby encerra — não sair da partida.
      if (!this.leavingToMenu && !this.enteringGame && this.joined) {
        this.socket.emit('leave_lobby');
      }
    });
  }

  saveLobbyMusicVolume(vol) {
    this.lobbyMusicVolume = setMenuMusicVolume(vol);
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
    this.updateAmbientCreatures(delta);
  }

  /** Magos e monstros do jogo vagando atrás do menu, em camadas de profundidade. */
  createAmbientCreatures() {
    const catalogs = [
      {
        prefix: 'wizard',
        types: ['crimson', 'azure', 'emerald', 'amber', 'necromancer'],
      },
      {
        prefix: 'monster',
        types: [
          'imp',
          'slime',
          'wraith',
          'goblin',
          'orc',
          'skeleton',
          'skeleton_archer',
          'wolf',
          'giant_spider',
          'bat',
          'elf',
          'beholder',
          'dragon',
          'lich',
          'fire_elemental',
          'demon',
          'grim_reaper',
          'bruxo',
        ],
      },
    ]
      .map((c) => ({
        ...c,
        types: c.types.filter((t) => this.textures.exists(`${c.prefix}_${t}`)),
      }))
      .filter((c) => c.types.length);

    if (!catalogs.length) {
      this.ambientCreatures = [];
      return;
    }

    const { width, height } = this.scale;
    // Mais criaturas na tela: magos + todos os monstros
    const count = 32;
    this.ambientCreatures = [];
    this.ambientCatalogs = catalogs;

    for (let i = 0; i < count; i++) {
      // Alterna catálogos no spawn inicial para garantir variedade
      const catalog = catalogs[i % catalogs.length];
      this.ambientCreatures.push(this.spawnAmbientCreature(catalog, width, height, true));
    }
  }

  destroyAmbientCreatures() {
    if (!this.ambientCreatures) return;
    for (const c of this.ambientCreatures) {
      c.sprite?.destroy();
    }
    this.ambientCreatures = null;
    this.ambientCatalogs = null;
  }

  spawnAmbientCreature(catalog, width, height, instant = false) {
    const type = Phaser.Utils.Array.GetRandom(catalog.types);
    const tex = `${catalog.prefix}_${type}`;
    // z: 0 = longe (fundo), 1 = perto (ainda atrás do menu)
    const z = Phaser.Math.FloatBetween(0.08, 1);
    const scale = Phaser.Math.Linear(0.55, 2.35, z);
    const alpha = Phaser.Math.Linear(0.12, 0.5, z);
    // Mais longe = mais escuro / azulado (atmosfera)
    const shade = Phaser.Math.Linear(0.35, 1, z);
    const tint = Phaser.Display.Color.GetColor(
      Math.floor(140 * shade + 40 * (1 - shade)),
      Math.floor(150 * shade + 55 * (1 - shade)),
      Math.floor(190 * shade + 90 * (1 - shade))
    );

    // Evita o centro do menu um pouco; favorece laterais e fundo
    let x;
    let y;
    if (Math.random() < 0.65) {
      x = Math.random() < 0.5
        ? Phaser.Math.Between(40, Math.floor(width * 0.28))
        : Phaser.Math.Between(Math.floor(width * 0.72), width - 40);
      y = Phaser.Math.Between(Math.floor(height * 0.22), height - 50);
    } else {
      x = Phaser.Math.Between(60, width - 60);
      y = Phaser.Math.Between(Math.floor(height * 0.55), height - 40);
    }

    const sprite = this.add
      .sprite(x, y, tex)
      .setScale(scale)
      .setAlpha(instant ? alpha : 0)
      .setTint(tint)
      .setDepth(0.05 + z * 0.55)
      .setFlipX(Math.random() < 0.5);

    const speed = Phaser.Math.Linear(12, 38, z);
    const angle = Math.random() * Math.PI * 2;
    const creature = {
      sprite,
      type,
      tex,
      prefix: catalog.prefix,
      z,
      x,
      y,
      baseScale: scale,
      baseAlpha: alpha,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.55,
      bobPhase: Math.random() * Math.PI * 2,
      bobAmp: Phaser.Math.Linear(0.6, 2.2, z),
      life: Phaser.Math.Between(9000, 18000),
      fadingOut: false,
      catalog,
    };

    if (!instant) {
      this.tweens.add({
        targets: sprite,
        alpha,
        duration: 700,
        ease: 'Sine.easeOut',
      });
    }

    const walkKey = `${tex}_walk`;
    if (this.anims.exists(walkKey)) {
      sprite.play(walkKey);
      sprite.anims.timeScale = Phaser.Math.Linear(0.45, 0.95, z);
    }

    return creature;
  }

  updateAmbientCreatures(delta) {
    const list = this.ambientCreatures;
    if (!list?.length) return;

    const { width, height } = this.scale;
    const dt = delta / 1000;
    const catalogs = this.ambientCatalogs;

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const s = c.sprite;
      if (!s?.active) continue;

      c.life -= delta;

      // Troca de direção ocasional
      if (Math.random() < 0.008) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Phaser.Math.Linear(12, 38, c.z);
        c.vx = Math.cos(angle) * speed;
        c.vy = Math.sin(angle) * speed * 0.55;
      }

      c.x += c.vx * dt;
      c.y += c.vy * dt;

      const margin = 28;
      if (c.x < margin || c.x > width - margin) {
        c.vx *= -1;
        c.x = Phaser.Math.Clamp(c.x, margin, width - margin);
      }
      if (c.y < height * 0.18 || c.y > height - 36) {
        c.vy *= -1;
        c.y = Phaser.Math.Clamp(c.y, height * 0.18, height - 36);
      }

      if (Math.abs(c.vx) > 4) s.setFlipX(c.vx < 0);

      c.bobPhase += dt * (2.2 + c.z);
      const bob = Math.sin(c.bobPhase) * c.bobAmp;
      s.setPosition(c.x, c.y + bob);

      // Respiração leve de escala (profundidade viva)
      const breathe = 1 + Math.sin(c.bobPhase * 0.55) * 0.02;
      s.setScale(c.baseScale * breathe);

      if (!c.fadingOut && c.life <= 0) {
        c.fadingOut = true;
        this.tweens.add({
          targets: s,
          alpha: 0,
          duration: 650,
          ease: 'Sine.easeIn',
          onComplete: () => {
            if (!this.ambientCreatures) return;
            s.destroy();
            const idx = this.ambientCreatures.indexOf(c);
            if (idx >= 0) {
              const nextCatalog = catalogs?.length
                ? Phaser.Utils.Array.GetRandom(catalogs)
                : c.catalog;
              this.ambientCreatures[idx] = this.spawnAmbientCreature(
                nextCatalog,
                width,
                height,
                false
              );
            }
          },
        });
      }
    }
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
    this.readyBtn = this.makeButton(panelX, btnStartY, 'Ready', 0x2ecc71, () => this.toggleReady(), btnW);
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

    this.galleryBtn = this.makeButton(
      panelX - halfW / 2 - 6,
      btnStartY + step * 2,
      'Galeria',
      0x443866,
      () => this.openGalleryModal(),
      halfW
    );
    this.controlsBtn = this.makeButton(
      panelX + halfW / 2 + 6,
      btnStartY + step * 2,
      'Comandos',
      0x443866,
      () => this.openControlsModal(),
      halfW
    );

    this.settingsBtn = this.makeButton(
      panelX - halfW / 2 - 6,
      btnStartY + step * 3,
      'Config',
      0x443866,
      () => this.openSettingsModal(),
      halfW
    );
    this.adminBtn = this.makeButton(
      panelX + halfW / 2 + 6,
      btnStartY + step * 3,
      'Admin',
      0x8e44ad,
      () => this.openAdminModal(),
      halfW
    );
    this.setButtonEnabled(this.adminBtn, false);

    this.leaveBtn = this.makeButton(
      panelX,
      btnStartY + step * 4,
      'Sair da sala',
      0xc0392b,
      () => this.leaveToMatchmaking(),
      btnW
    );

    for (const btn of [
      this.readyBtn,
      this.botsBtn,
      this.removeBotsBtn,
      this.galleryBtn,
      this.controlsBtn,
      this.settingsBtn,
      this.adminBtn,
      this.leaveBtn,
    ]) {
      btn.setDepth(uiDepth);
    }

    this.controlsModalOpen = false;
    this.controlsModal = this.add.container(0, 0).setDepth(400).setVisible(false);
    this.settingsModal = this.add.container(0, 0).setDepth(400).setVisible(false);
    this.adminModal = this.add.container(0, 0).setDepth(400).setVisible(false);
    this.galleryModal = new GalleryModal(this, {
      onOpen: () => this.setLobbyDomVisible(false),
      onClose: () => {
        if (!this.settingsModalOpen && !this.adminModalOpen && !this.controlsModalOpen) {
          this.setLobbyDomVisible(true);
        }
      },
    });
    this._maybeOpenGalleryFromUrl();

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

  openGalleryModal(options = {}) {
    if (this.settingsModalOpen) this.closeSettingsModal();
    if (this.adminModalOpen) this.closeAdminModal();
    if (this.controlsModalOpen) this.closeControlsModal();
    this.galleryModal?.show(options);
  }

  _maybeOpenGalleryFromUrl() {
    const link = parseGalleryUrl();
    if (!link) return;
    // Adia um tick para o layout/DOM do lobby estabilizar.
    this.time.delayedCall(0, () => {
      this.openGalleryModal({
        tab: link.tab,
        spellId: link.spellId,
        monsterId: link.monsterId,
      });
    });
  }

  openSettingsModal() {
    if (this.settingsModalOpen) return;
    if (this.controlsModalOpen) this.closeControlsModal();
    if (this.adminModalOpen) this.closeAdminModal();
    if (this.galleryModal?.isOpen()) this.galleryModal.hide();
    this.settingsModalOpen = true;

    this.setLobbyDomVisible(false);

    const { width, height } = this.scale;
    this.settingsModal.removeAll(true);
    this.settingsModal.setDepth(10000).setVisible(true);
    this.children.bringToTop(this.settingsModal);

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.closeSettingsModal());

    const panel = this.add
      .rectangle(width / 2, height / 2, 420, 340, 0x161228, 0.98)
      .setStrokeStyle(2, 0x6b5cff)
      .setInteractive();

    const title = this.add
      .text(width / 2, height / 2 - 130, 'Configurações', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    const resLabel = this.add
      .text(width / 2, height / 2 - 75, 'Resolução', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5);

    const selectEl = document.createElement('select');
    selectEl.style.cssText = [
      'width: 280px',
      'height: 34px',
      'padding: 0 10px',
      'border: 1px solid #6b5cff',
      'border-radius: 6px',
      'background: #1e1836',
      'color: #e8dfff',
      'font-family: Trebuchet MS, sans-serif',
      'font-size: 14px',
      'cursor: pointer',
      'outline: none',
    ].join(';');
    for (const res of RESOLUTIONS) {
      const opt = document.createElement('option');
      opt.value = res.id;
      opt.textContent = res.label;
      if (res.id === this.resolutionId) opt.selected = true;
      selectEl.appendChild(opt);
    }
    selectEl.addEventListener('change', () => {
      this.resolutionId = selectEl.value;
      saveResolutionId(this.resolutionId);
      applyResolution(this.resolutionId, this.game);
      // Rebuild para recentrar o modal após o Scale.FIT recalcular
      this.closeSettingsModal();
      this.openSettingsModal();
    });
    this.resolutionSelect = this.add.dom(width / 2, height / 2 - 40, selectEl).setOrigin(0.5);

    const volLabel = this.add
      .text(width / 2, height / 2 + 10, 'Volume da música de fundo', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5);

    const pct = Math.round(this.lobbyMusicVolume * 100);
    this.volumeValueText = this.add
      .text(width / 2, height / 2 + 42, `${pct}%`, {
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

    this.volumeSlider = this.add.dom(width / 2, height / 2 + 78, sliderEl).setOrigin(0.5);

    const closeBg = this.add
      .rectangle(width / 2, height / 2 + 130, 140, 40, 0x6b5cff, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const closeLabel = this.add
      .text(width / 2, height / 2 + 130, 'Fechar', {
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
      resLabel,
      volLabel,
      this.volumeValueText,
      closeBg,
      closeLabel,
    ]);
  }

  closeSettingsModal() {
    if (!this.settingsModalOpen && !this.volumeSlider && !this.resolutionSelect) return;
    this.settingsModalOpen = false;
    if (this.volumeSlider) {
      this.volumeSlider.destroy();
      this.volumeSlider = null;
    }
    if (this.resolutionSelect) {
      this.resolutionSelect.destroy();
      this.resolutionSelect = null;
    }
    if (this.settingsModal) {
      this.settingsModal.removeAll(true);
      this.settingsModal.setVisible(false);
    }
    this.volumeValueText = null;
    if (!this.controlsModalOpen && !this.adminModalOpen && !this.galleryModal?.isOpen()) {
      this.setLobbyDomVisible(true);
    }
  }

  openAdminModal() {
    if (this.adminModalOpen) return;
    if (!this.joined) return;
    if (this.settingsModalOpen) this.closeSettingsModal();
    if (this.galleryModal?.isOpen()) this.galleryModal.hide();
    if (this.controlsModalOpen) this.closeControlsModal();
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
      .text(width / 2, height / 2 - 155, 'Admin', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
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
    if (!this.controlsModalOpen && !this.settingsModalOpen && !this.galleryModal?.isOpen()) {
      this.setLobbyDomVisible(true);
    }
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

  openControlsModal() {
    if (this.controlsModalOpen) return;
    if (this.settingsModalOpen) this.closeSettingsModal();
    if (this.adminModalOpen) this.closeAdminModal();
    if (this.galleryModal?.isOpen()) this.galleryModal.hide();
    this.controlsModalOpen = true;

    // DOM fica acima do canvas — esconde inputs enquanto o modal está aberto
    this.setLobbyDomVisible(false);

    const { width, height } = this.scale;
    this.controlsModal.removeAll(true);
    this.controlsModal.setDepth(10000).setVisible(true);
    this.children.bringToTop(this.controlsModal);

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.closeControlsModal());

    const panel = this.add
      .rectangle(width / 2, height / 2, 420, 460, 0x161228, 0.98)
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
      ['1 – 4', 'Selecionar (projéteis: autocast)'],
      ['Tab', 'Ciclar magia 1→2→3→4'],
      ['Espaço', 'Magia de área / ultimate'],
      ['E / H / B', 'Escudo / Heal / Blink'],
    ];

    const rows = [];
    const startY = height / 2 - 130;
    lines.forEach(([key, action], i) => {
      const y = startY + i * 34;
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
    if (!this.settingsModalOpen && !this.adminModalOpen && !this.galleryModal?.isOpen()) {
      this.setLobbyDomVisible(true);
    }
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
