import Phaser from 'phaser';
import { ensureCharacter } from '../character.js';
import { equipmentBonusesFromInventory } from '../inventory.js';
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
    this.pvpEnabled = false;
    this.roundDuration = 30;
    this.passwordPrompt = null;
    this.lobbyAgeEls = [];
    this._lobbyAgeAcc = 0;
    this.alreadyInLobby = null;

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
    this.socket.emit('subscribe_lobbies', { characterId: this.character.id });
    this.socket.emit('check_character_seat', { characterId: this.character.id });

    this.events.once('shutdown', () => {
      this.socket.emit('unsubscribe_lobbies');
      this.socket.off('lobbies_list');
      this.socket.off('lobby_created');
      this.socket.off('error_msg');
      this.socket.off('character_seat');
      this.destroyPasswordPrompt();
      this.modeSelectDom?.destroy();
      this.maxSelectDom?.destroy();
      this.durationSelectDom?.destroy();
      this.passInputDom?.destroy();
      this.listDom?.destroy();
      destroyAmbientCreatures(this);
    });
  }

  buildCreatePanel(width, height, uiDepth) {
    const x = width * 0.28;
    const y = height / 2 + 10;
    const selectStyle = [
      'width: 220px',
      'height: 34px',
      'padding: 0 10px',
      'border: 1px solid #6b5cff',
      'border-radius: 8px',
      'background: #0e0a1a',
      'color: #f0e8ff',
      'font-family: Trebuchet MS, sans-serif',
      'font-size: 14px',
      'outline: none',
      'cursor: pointer',
    ].join(';');
    const labelStyle = {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '12px',
      color: '#9a8bb8',
    };
    const addLabel = (ty, text) =>
      this.add.text(x, ty, text, labelStyle).setOrigin(0.5).setDepth(uiDepth);
    const addSelect = (ty, el) => this.add.dom(x, ty, el).setOrigin(0.5).setDepth(uiDepth);

    this.add
      .text(x, y - 210, 'Criar sala', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    addLabel(y - 175, 'Modo');
    const modeEl = document.createElement('select');
    modeEl.style.cssText = selectStyle;
    for (const [value, label] of [
      ['false', 'PvE — vs monstros'],
      ['true', 'PvP — jogadores se atacam'],
    ]) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if ((value === 'true') === this.pvpEnabled) opt.selected = true;
      modeEl.appendChild(opt);
    }
    modeEl.addEventListener('change', () => {
      this.pvpEnabled = modeEl.value === 'true';
    });
    this.modeSelectEl = modeEl;
    this.modeSelectDom = addSelect(y - 148, modeEl);

    addLabel(y - 112, 'Jogadores (1–4)');
    const selectEl = document.createElement('select');
    selectEl.style.cssText = selectStyle;
    for (let i = 1; i <= 4; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${i} jogador${i > 1 ? 'es' : ''}`;
      if (i === this.maxPlayers) opt.selected = true;
      selectEl.appendChild(opt);
    }
    selectEl.addEventListener('change', () => {
      this.maxPlayers = Number(selectEl.value) || 4;
    });
    this.maxSelectDom = addSelect(y - 85, selectEl);

    addLabel(y - 49, 'Duração do round');
    const durationEl = document.createElement('select');
    durationEl.style.cssText = selectStyle;
    for (const [secs, label] of [
      [30, '30 segundos'],
      [60, '1 minuto'],
      [120, '2 minutos'],
      [180, '3 minutos'],
    ]) {
      const opt = document.createElement('option');
      opt.value = String(secs);
      opt.textContent = label;
      if (secs === this.roundDuration) opt.selected = true;
      durationEl.appendChild(opt);
    }
    durationEl.addEventListener('change', () => {
      this.roundDuration = Number(durationEl.value) || 30;
    });
    this.durationSelectEl = durationEl;
    this.durationSelectDom = addSelect(y - 22, durationEl);

    addLabel(y + 14, 'Senha (opcional, 4 dígitos)');
    const passEl = document.createElement('input');
    passEl.type = 'password';
    passEl.inputMode = 'numeric';
    passEl.maxLength = 4;
    passEl.placeholder = 'Privado';
    passEl.autocomplete = 'off';
    styleDomInput(passEl);
    passEl.style.width = '220px';
    passEl.style.height = '34px';
    passEl.addEventListener('input', () => {
      passEl.value = passEl.value.replace(/\D/g, '').slice(0, 4);
    });
    const passWrap = wrapPasswordInput(passEl, '220px');
    this.passInputDom = this.add.dom(x, y + 41, passWrap).setOrigin(0.5).setDepth(uiDepth);
    this.passInputEl = passEl;

    makeMenuButton(this, x, y + 92, 'Criar lobby', 0x2ecc71, () => this.createLobby(), 220).setDepth(
      uiDepth
    );
    makeMenuButton(this, x, y + 147, 'Voltar', 0x443866, () => {
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
    this.socket.off('character_seat');

    this.socket.on('lobbies_list', (payload) => {
      const list = Array.isArray(payload?.lobbies) ? payload.lobbies : [];
      // Só salas ainda em lobby (partida iniciada some da listagem).
      this.lobbies = list.filter((l) => !l?.phase || l.phase === 'lobby');
      if (payload?.alreadyInLobby) {
        this.setAlreadyInLobby(payload.alreadyInLobby);
      } else if (payload && 'alreadyInLobby' in payload) {
        this.setAlreadyInLobby(null);
      }
      this.renderLobbyList();
    });

    this.socket.on('character_seat', (payload) => {
      if (payload?.seated) {
        this.setAlreadyInLobby({
          matchId: payload.matchId,
          phase: payload.phase,
        });
      } else {
        this.setAlreadyInLobby(null);
      }
    });

    this.socket.on('lobby_created', (payload) => {
      if (!payload?.matchId) return;
      navigate(`/matchmaking/${payload.matchId}`);
    });

    this.socket.on('error_msg', (payload) => {
      this.statusText.setColor('#ff6b6b');
      const code = payload?.code;
      const message =
        code === 'already_in_lobby'
          ? 'Você já está em uma sala.'
          : payload?.message || 'Erro';
      this.statusText.setText(message);
      if (code === 'already_in_lobby') {
        this.socket.emit('check_character_seat', { characterId: this.character.id });
      }
    });
  }

  setAlreadyInLobby(seat) {
    const wasSeated = Boolean(this.alreadyInLobby);
    this.alreadyInLobby = seat || null;
    if (this.alreadyInLobby) {
      this.statusText.setColor('#ffb36b');
      this.statusText.setText(
        'Você já está em uma sala em outra aba/navegador. Saia de lá antes de criar ou entrar em outra.'
      );
      return;
    }
    if (wasSeated && !this.bannerMessage) {
      this.statusText.setColor('#c4b5e0');
      this.statusText.setText('Lobbies em tempo real');
    }
  }

  blockIfAlreadyInLobby() {
    if (!this.alreadyInLobby) {
      this.socket.emit('check_character_seat', { characterId: this.character.id });
      return false;
    }
    this.statusText.setColor('#ff6b6b');
    this.statusText.setText('Você já está em uma sala.');
    return true;
  }

  createLobby() {
    if (this.blockIfAlreadyInLobby()) return;
    const password = String(this.passInputEl?.value || '').trim();
    if (password && !/^\d{4}$/.test(password)) {
      this.statusText.setColor('#ff6b6b');
      this.statusText.setText('A senha deve ter exatamente 4 dígitos.');
      return;
    }
    this.statusText.setColor('#c4b5e0');
    this.statusText.setText('Criando lobby...');
    const pvpEnabled =
      this.modeSelectEl != null
        ? this.modeSelectEl.value === 'true'
        : !!this.pvpEnabled;
    this.pvpEnabled = pvpEnabled;
    if (this.durationSelectEl) {
      this.roundDuration = Number(this.durationSelectEl.value) || this.roundDuration;
    }
    const roundDuration = [30, 60, 120, 180].includes(this.roundDuration)
      ? this.roundDuration
      : 30;
    this.roundDuration = roundDuration;
    const bonuses = equipmentBonusesFromInventory(this.character.inventory);
    this.socket.emit('create_lobby', {
      characterId: this.character.id,
      name: this.character.name,
      color: this.character.color,
      skin: this.character.skin,
      cooldownReduction: bonuses.cooldownReduction,
      maxPlayers: this.maxPlayers,
      password: password || null,
      pvpEnabled,
      roundDuration,
    });
  }

  formatLobbyCreatedAt(value) {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  formatLobbyOpenAge(createdAt) {
    const created = new Date(createdAt).getTime();
    if (!Number.isFinite(created)) return '0m 00s';
    const totalSec = Math.max(0, Math.floor((Date.now() - created) / 1000));
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }

  refreshLobbyAges() {
    if (!this.lobbyAgeEls?.length) return;
    for (const item of this.lobbyAgeEls) {
      if (!item?.el) continue;
      item.el.textContent = `Aberta há ${this.formatLobbyOpenAge(item.createdAt)}`;
    }
  }

  renderLobbyList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    this.lobbyAgeEls = [];

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
      const mode = lobby.pvpEnabled ? 'PvP' : 'PvE';
      const lock = lobby.hasPassword ? ' · 🔒 privada' : '';
      const durSec = Number(lobby.roundDuration);
      const dur =
        Number.isFinite(durSec) && durSec > 0
          ? durSec < 60
            ? `${durSec}s`
            : `${Math.round(durSec / 60)}m`
          : null;
      const rulesTag = dur ? ` · ${dur}` : '';
      meta.textContent = `${mode}${rulesTag} · ${lobby.playerCount}/${lobby.maxPlayers} jogadores${lock}`;

      const created = document.createElement('div');
      created.style.cssText = 'font-size: 11px; color: #7a6e96; margin-top: 4px;';
      created.textContent = `Criada em ${this.formatLobbyCreatedAt(lobby.createdAt)}`;

      const age = document.createElement('div');
      age.style.cssText = 'font-size: 11px; color: #c4b5e0; margin-top: 2px;';
      age.textContent = `Aberta há ${this.formatLobbyOpenAge(lobby.createdAt)}`;
      this.lobbyAgeEls.push({ el: age, createdAt: lobby.createdAt });

      info.appendChild(title);
      info.appendChild(meta);
      info.appendChild(created);
      info.appendChild(age);

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
    if (this.blockIfAlreadyInLobby()) return;
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
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 4);
    });
    const passWrap = wrapPasswordInput(input, '160px');
    passWrap.style.margin = '0 auto 14px';

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
      if (this.blockIfAlreadyInLobby()) {
        this.destroyPasswordPrompt();
        return;
      }
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
    wrap.appendChild(passWrap);
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
    this._lobbyAgeAcc = (this._lobbyAgeAcc || 0) + delta;
    if (this._lobbyAgeAcc >= 1000) {
      this._lobbyAgeAcc = 0;
      this.refreshLobbyAges();
    }
  }
}

const EYE_OPEN_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c4b5e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

const EYE_OFF_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c4b5e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

/** Wrap a password <input> with a show/hide eye toggle. */
function wrapPasswordInput(input, width) {
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position: relative',
    `width: ${width}`,
    'margin: 0 auto',
    'box-sizing: border-box',
  ].join(';');

  input.style.width = '100%';
  input.style.paddingRight = '40px';
  input.style.boxSizing = 'border-box';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = [
    'position: absolute',
    'right: 6px',
    'top: 50%',
    'transform: translateY(-50%)',
    'width: 28px',
    'height: 28px',
    'padding: 0',
    'border: none',
    'background: transparent',
    'cursor: pointer',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'opacity: 0.8',
  ].join(';');

  let visible = false;
  const sync = () => {
    btn.innerHTML = visible ? EYE_OFF_SVG : EYE_OPEN_SVG;
    const label = visible ? 'Ocultar senha' : 'Mostrar senha';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  };
  sync();

  btn.addEventListener('pointerdown', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    visible = !visible;
    input.type = visible ? 'text' : 'password';
    input.inputMode = 'numeric';
    sync();
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '1';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '0.8';
  });

  wrap.appendChild(input);
  wrap.appendChild(btn);
  return wrap;
}
