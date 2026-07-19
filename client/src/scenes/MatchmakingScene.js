import Phaser from 'phaser';
import { ensureCharacter } from '../character.js';
import { getSocket } from '../net/socket.js';
import { navigate } from '../router.js';
import { ensureMenuMusic } from '../audio/menuMusic.js';
import {
  drawMenuBackground,
  makeMenuButton,
  styleDomInput,
  updateMenuFlames,
} from '../ui/menuChrome.js';
import {
  createAmbientCreatures,
  destroyAmbientCreatures,
  updateAmbientCreatures,
} from '../ui/ambientCreatures.js';

export class MatchmakingScene extends Phaser.Scene {
  constructor() {
    super('Matchmaking');
  }

  init(data = {}) {
    let banner = data.message || null;
    try {
      const stored = sessionStorage.getItem('wa_mm_message');
      if (stored) {
        banner = stored;
        sessionStorage.removeItem('wa_mm_message');
      }
    } catch {
      // ignore
    }
    this.bannerMessage = banner;
  }

  create() {
    this.character = ensureCharacter();
    this.socket = getSocket();
    this.lobbies = [];
    this.maxPlayers = 4;
    this.passwordPrompt = null;

    drawMenuBackground(this, { subtitle: 'Salas' });
    createAmbientCreatures(this);
    ensureMenuMusic(this);

    const { width, height } = this.scale;
    const uiDepth = 10;

    this.statusText = this.add
      .text(width / 2, 140, this.bannerMessage || 'Lobbies em tempo real', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: this.bannerMessage ? '#ffb36b' : '#c4b5e0',
        align: 'center',
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.buildCreatePanel(width, height, uiDepth);
    this.buildLobbyList(width, height, uiDepth);

    this.bindSocket();
    this.socket.emit('subscribe_lobbies');

    this.events.once('shutdown', () => {
      this.socket.emit('unsubscribe_lobbies');
      this.socket.off('lobbies_list');
      this.socket.off('lobby_created');
      this.socket.off('error_msg');
      this.destroyPasswordPrompt();
      this.maxSelectDom?.destroy();
      this.passInputDom?.destroy();
      this.listDom?.destroy();
      destroyAmbientCreatures(this);
    });
  }

  buildCreatePanel(width, height, uiDepth) {
    const x = width * 0.28;
    const y = height / 2 + 10;

    this.add
      .text(x, y - 160, 'Criar sala', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.add
      .text(x, y - 110, 'Jogadores (1–8)', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    const selectEl = document.createElement('select');
    selectEl.style.cssText = [
      'width: 220px',
      'height: 40px',
      'padding: 0 10px',
      'border: 1px solid #6b5cff',
      'border-radius: 8px',
      'background: #0e0a1a',
      'color: #f0e8ff',
      'font-family: Trebuchet MS, sans-serif',
      'font-size: 15px',
      'outline: none',
      'cursor: pointer',
    ].join(';');
    for (let i = 1; i <= 8; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${i} jogador${i > 1 ? 'es' : ''}`;
      if (i === this.maxPlayers) opt.selected = true;
      selectEl.appendChild(opt);
    }
    selectEl.addEventListener('change', () => {
      this.maxPlayers = Number(selectEl.value) || 4;
    });
    this.maxSelectDom = this.add.dom(x, y - 70, selectEl).setOrigin(0.5).setDepth(uiDepth);

    this.add
      .text(x, y - 20, 'Senha (opcional, 4 dígitos)', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    const passEl = document.createElement('input');
    passEl.type = 'password';
    passEl.inputMode = 'numeric';
    passEl.maxLength = 4;
    passEl.placeholder = 'Privado';
    passEl.autocomplete = 'off';
    styleDomInput(passEl);
    passEl.style.width = '220px';
    passEl.addEventListener('input', () => {
      passEl.value = passEl.value.replace(/\D/g, '').slice(0, 4);
    });
    this.passInputDom = this.add.dom(x, y + 20, passEl).setOrigin(0.5).setDepth(uiDepth);
    this.passInputEl = passEl;

    makeMenuButton(this, x, y + 90, 'Criar lobby', 0x2ecc71, () => this.createLobby(), 220).setDepth(
      uiDepth
    );
    makeMenuButton(this, x, y + 150, '← Home', 0x443866, () => {
      navigate('/');
    }, 220).setDepth(uiDepth);
  }

  buildLobbyList(width, height, uiDepth) {
    const x = width * 0.68;
    const y = height / 2 + 10;

    this.add
      .text(x, y - 160, 'Lobbies abertos', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    const listEl = document.createElement('div');
    listEl.style.cssText = [
      'width: 420px',
      'height: 340px',
      'overflow-y: auto',
      'box-sizing: border-box',
      'padding: 8px',
      'font-family: Trebuchet MS, sans-serif',
      'color: #eee6ff',
      'background: rgba(14, 10, 26, 0.72)',
      'border: 1px solid #3a2f66',
      'border-radius: 10px',
      'scrollbar-width: thin',
      'scrollbar-color: #6b5cff #1a1430',
    ].join(';');
    this.listEl = listEl;
    this.listDom = this.add.dom(x, y + 30, listEl).setOrigin(0.5).setDepth(uiDepth);
    this.renderLobbyList();
  }

  bindSocket() {
    this.socket.off('lobbies_list');
    this.socket.off('lobby_created');
    this.socket.off('error_msg');

    this.socket.on('lobbies_list', (payload) => {
      this.lobbies = Array.isArray(payload?.lobbies) ? payload.lobbies : [];
      this.renderLobbyList();
    });

    this.socket.on('lobby_created', (payload) => {
      if (!payload?.matchId) return;
      navigate(`/matchmaking/${payload.matchId}`);
    });

    this.socket.on('error_msg', (payload) => {
      this.statusText.setColor('#ff6b6b');
      this.statusText.setText(payload?.message || 'Erro');
    });
  }

  createLobby() {
    const password = String(this.passInputEl?.value || '').trim();
    if (password && !/^\d{4}$/.test(password)) {
      this.statusText.setColor('#ff6b6b');
      this.statusText.setText('A senha deve ter exatamente 4 dígitos.');
      return;
    }
    this.statusText.setColor('#c4b5e0');
    this.statusText.setText('Criando lobby...');
    this.socket.emit('create_lobby', {
      name: this.character.name,
      color: this.character.color,
      skin: this.character.skin,
      maxPlayers: this.maxPlayers,
      password: password || null,
    });
  }

  renderLobbyList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    if (!this.lobbies.length) {
      const empty = document.createElement('div');
      empty.style.cssText =
        'padding: 40px 12px; text-align: center; color: #9a8bb8; font-size: 14px;';
      empty.textContent = 'Nenhum lobby aberto. Crie o primeiro!';
      this.listEl.appendChild(empty);
      return;
    }

    for (const lobby of this.lobbies) {
      const row = document.createElement('div');
      row.style.cssText = [
        'display: flex',
        'align-items: center',
        'justify-content: space-between',
        'gap: 10px',
        'padding: 12px 10px',
        'margin-bottom: 8px',
        'background: rgba(30, 24, 54, 0.9)',
        'border-radius: 8px',
        'border: 1px solid #4a3d78',
      ].join(';');

      const info = document.createElement('div');
      info.style.cssText = 'flex: 1; min-width: 0;';
      const title = document.createElement('div');
      title.style.cssText = 'font-size: 15px; color: #f4e8ff; font-weight: 600;';
      title.textContent = lobby.hostName ? `Sala de ${lobby.hostName}` : 'Sala';
      const meta = document.createElement('div');
      meta.style.cssText = 'font-size: 12px; color: #9a8bb8; margin-top: 4px;';
      const lock = lobby.hasPassword ? ' · 🔒 privada' : '';
      meta.textContent = `${lobby.playerCount}/${lobby.maxPlayers} jogadores${lock}`;
      info.appendChild(title);
      info.appendChild(meta);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Entrar';
      btn.style.cssText = [
        'padding: 8px 14px',
        'border: none',
        'border-radius: 6px',
        'background: #6b5cff',
        'color: #fff',
        'font-family: Trebuchet MS, sans-serif',
        'font-size: 13px',
        'cursor: pointer',
        'flex-shrink: 0',
      ].join(';');
      btn.addEventListener('click', () => this.onJoinClick(lobby));

      row.appendChild(info);
      row.appendChild(btn);
      this.listEl.appendChild(row);
    }
  }

  onJoinClick(lobby) {
    if (lobby.hasPassword) {
      this.openPasswordPrompt(lobby.id);
      return;
    }
    navigate(`/matchmaking/${lobby.id}`);
  }

  openPasswordPrompt(matchId) {
    this.destroyPasswordPrompt();
    const { width, height } = this.scale;

    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position: relative',
      'width: 340px',
      'padding: 22px 20px',
      'background: #161228',
      'border: 2px solid #6b5cff',
      'border-radius: 12px',
      'font-family: Trebuchet MS, sans-serif',
      'color: #f0e8ff',
      'text-align: center',
      'box-shadow: 0 12px 40px rgba(0,0,0,0.55)',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Sala privada';
    title.style.cssText = 'font-family: Georgia, serif; font-size: 20px; margin-bottom: 8px;';
    const hint = document.createElement('div');
    hint.textContent = 'Digite a senha de 4 dígitos';
    hint.style.cssText = 'font-size: 13px; color: #9a8bb8; margin-bottom: 14px;';

    const input = document.createElement('input');
    input.type = 'password';
    input.inputMode = 'numeric';
    input.maxLength = 4;
    input.placeholder = '••••';
    styleDomInput(input);
    input.style.width = '160px';
    input.style.margin = '0 auto 14px';
    input.style.display = 'block';
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 4);
    });

    const err = document.createElement('div');
    err.style.cssText = 'min-height: 18px; font-size: 13px; color: #ff6b6b; margin-bottom: 10px;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancelar';
    cancel.style.cssText =
      'padding: 10px 16px; border: none; border-radius: 6px; background: #443866; color: #fff; cursor: pointer;';
    cancel.addEventListener('click', () => this.destroyPasswordPrompt());

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = 'Entrar';
    ok.style.cssText =
      'padding: 10px 16px; border: none; border-radius: 6px; background: #2ecc71; color: #fff; cursor: pointer;';
    ok.addEventListener('click', () => {
      const password = input.value.trim();
      if (!/^\d{4}$/.test(password)) {
        err.textContent = 'Senha inválida (4 dígitos).';
        return;
      }
      this.destroyPasswordPrompt();
      // Guarda senha temporária para a RoomScene usar no join
      sessionStorage.setItem('wa_join_password', JSON.stringify({ matchId, password }));
      navigate(`/matchmaking/${matchId}`);
    });

    actions.appendChild(cancel);
    actions.appendChild(ok);
    wrap.appendChild(title);
    wrap.appendChild(hint);
    wrap.appendChild(input);
    wrap.appendChild(err);
    wrap.appendChild(actions);

    const dim = document.createElement('div');
    dim.style.cssText = [
      'position: fixed',
      'inset: 0',
      'background: rgba(0,0,0,0.55)',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'z-index: 9999',
    ].join(';');
    dim.appendChild(wrap);
    dim.addEventListener('click', (e) => {
      if (e.target === dim) this.destroyPasswordPrompt();
    });
    document.body.appendChild(dim);
    this.passwordPrompt = dim;
    input.focus();
  }

  destroyPasswordPrompt() {
    if (this.passwordPrompt) {
      this.passwordPrompt.remove();
      this.passwordPrompt = null;
    }
  }

  update(_time, delta) {
    updateMenuFlames(this);
    updateAmbientCreatures(this, delta);
  }
}
