import Phaser from 'phaser';
import { deleteCharacter, ensureCharacter, saveCharacter, WIZARD_COLORS } from '../character.js';
import { fetchCharacterMatches } from '../api.js';
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
import {
  updateWizardPreviewTexture,
  WIZARD_SKINS,
} from '../wizardSkin.js';
import { elementLabel } from '../catalog/elements.js';

function formatDate(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function shortUuid(id) {
  const s = String(id || '');
  if (s.length < 12) return s || '—';
  return `${s.slice(0, 8)}…`;
}

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super('Character');
  }

  create() {
    this.character = ensureCharacter();
    this.selectedColor = this.character.color >>> 0;
    this.selectedSkin = this.character.skin || 'classic';
    this.errorText = null;

    drawMenuBackground(this, { subtitle: 'Personagem' });
    createAmbientCreatures(this);
    ensureMenuMusic(this);

    const { width, height } = this.scale;
    const uiDepth = 10;
    const editorX = width * 0.32;
    const historyX = width * 0.72;

    const previewKey = updateWizardPreviewTexture(this, this.selectedColor, this.selectedSkin);
    this.preview = this.add
      .sprite(editorX, height / 2 - 230, previewKey)
      .setScale(4)
      .setDepth(uiDepth);

    this.tweens.add({
      targets: this.preview,
      y: this.preview.y - 8,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(editorX, height / 2 - 165, 'Skin do bruxo', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.buildSkinPicker(editorX, height / 2 - 120, uiDepth);

    this.add
      .text(editorX, height / 2 - 55, 'Nome', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.maxLength = 16;
    inputEl.value = this.character.name;
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;
    inputEl.placeholder = 'Digite seu nome';
    styleDomInput(inputEl);
    this.nameInput = this.add.dom(editorX, height / 2 - 15, inputEl).setOrigin(0.5).setDepth(uiDepth);

    this.idText = this.add
      .text(editorX, height / 2 + 28, `ID: ${this.character.id}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#6b6088',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.add
      .text(editorX, height / 2 + 60, 'Cor do bruxo', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    this.buildPalette(editorX, height / 2 + 120, uiDepth);

    this.errorText = this.add
      .text(editorX, height / 2 + 195, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#ff6b6b',
      })
      .setOrigin(0.5)
      .setDepth(uiDepth);

    const btnY = height / 2 + 250;
    makeMenuButton(this, editorX - 120, btnY, 'Voltar', 0x443866, () => {
      navigate('/');
    }, 130).setDepth(uiDepth);

    makeMenuButton(this, editorX + 20, btnY, 'Salvar', 0x2ecc71, () => {
      this.save();
    }, 130).setDepth(uiDepth);

    makeMenuButton(this, editorX + 160, btnY, 'Deletar', 0xc0392b, () => {
      this.confirmDeleteProfile();
    }, 130).setDepth(uiDepth);

    this.buildHistoryPanel(historyX, height / 2 + 20, uiDepth);

    this.events.once('shutdown', () => {
      this.destroyDeletePrompt();
      this.nameInput?.destroy();
      this.nameInput = null;
      this.historyDom?.destroy();
      this.historyDom = null;
      destroyAmbientCreatures(this);
    });
  }

  confirmDeleteProfile() {
    this.destroyDeletePrompt();

    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position: relative',
      'width: 360px',
      'padding: 22px 20px',
      'background: #161228',
      'border: 2px solid #c0392b',
      'border-radius: 12px',
      'font-family: Trebuchet MS, sans-serif',
      'color: #f0e8ff',
      'text-align: center',
      'box-shadow: 0 12px 40px rgba(0,0,0,0.55)',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Deletar personagem?';
    title.style.cssText = 'font-family: Georgia, serif; font-size: 20px; margin-bottom: 10px;';

    const hint = document.createElement('div');
    hint.textContent =
      'Isso apaga o personagem deste navegador. O histórico no servidor não é removido.';
    hint.style.cssText =
      'font-size: 13px; color: #9a8bb8; margin-bottom: 18px; line-height: 1.4;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancelar';
    cancel.style.cssText =
      'padding: 10px 16px; border: none; border-radius: 6px; background: #443866; color: #fff; cursor: pointer; font-family: Trebuchet MS, sans-serif;';
    cancel.addEventListener('click', () => this.destroyDeletePrompt());

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = 'Deletar';
    ok.style.cssText =
      'padding: 10px 16px; border: none; border-radius: 6px; background: #c0392b; color: #fff; cursor: pointer; font-family: Trebuchet MS, sans-serif;';
    ok.addEventListener('click', () => {
      deleteCharacter();
      this.destroyDeletePrompt();
      window.location.reload();
    });

    actions.appendChild(cancel);
    actions.appendChild(ok);
    wrap.appendChild(title);
    wrap.appendChild(hint);
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
      if (e.target === dim) this.destroyDeletePrompt();
    });
    document.body.appendChild(dim);
    this.deletePrompt = dim;
  }

  destroyDeletePrompt() {
    if (this.deletePrompt) {
      this.deletePrompt.remove();
      this.deletePrompt = null;
    }
  }

  buildHistoryPanel(x, y, depth) {
    this.add
      .text(x, y - 292, 'Histórico de partidas', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    this.historyWinsText = this.add
      .text(x - 70, y - 258, 'Vitórias: —', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#2ecc71',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    this.historyLossesText = this.add
      .text(x + 70, y - 258, 'Derrotas: —', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ff6b6b',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    this.historyStatus = this.add
      .text(x, y - 232, 'Carregando...', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    const listEl = document.createElement('div');
    listEl.style.cssText = [
      'width: 460px',
      'height: 440px',
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
    this.historyEl = listEl;
    this.historyDom = this.add.dom(x, y + 20, listEl).setOrigin(0.5).setDepth(depth);
    this.loadHistory();
  }

  async loadHistory() {
    if (!this.historyEl) return;
    this.historyEl.innerHTML = '';
    this.historyWinsText?.setText('Vitórias: —');
    this.historyLossesText?.setText('Derrotas: —');
    this.historyStatus?.setText('Carregando...').setColor('#9a8bb8');
    try {
      const data = await fetchCharacterMatches(this.character.id, { limit: 40 });
      const matches = data.matches || [];
      const wins = Number(data.wins) || 0;
      const losses = Number(data.losses) || 0;
      this.historyWinsText?.setText(`Vitórias: ${wins}`);
      this.historyLossesText?.setText(`Derrotas: ${losses}`);

      if (!matches.length) {
        this.historyStatus?.setText('Nenhuma partida registrada ainda');
        const empty = document.createElement('div');
        empty.style.cssText =
          'padding: 48px 16px; text-align: center; color: #9a8bb8; font-size: 14px; line-height: 1.5;';
        empty.textContent =
          'Quando você terminar uma partida com este personagem, ela aparecerá aqui.';
        this.historyEl.appendChild(empty);
        return;
      }

      this.historyStatus?.setText(
        `${data.total} partida${data.total === 1 ? '' : 's'} · ${this.character.name}`
      );

      for (const m of matches) {
        const row = document.createElement('div');
        row.style.cssText = [
          'padding: 12px 10px',
          'margin-bottom: 8px',
          'background: rgba(30, 24, 54, 0.9)',
          'border-radius: 8px',
          'border: 1px solid #4a3d78',
        ].join(';');

        const top = document.createElement('div');
        top.style.cssText =
          'display: flex; justify-content: space-between; gap: 8px; align-items: baseline;';

        const result = document.createElement('div');
        const ok = m.result === 'success';
        result.textContent = ok ? 'SUCESSO' : 'DERROTA';
        result.style.cssText = `font-size: 13px; font-weight: 700; color: ${ok ? '#2ecc71' : '#ff6b6b'};`;

        const points = document.createElement('div');
        points.textContent = `${m.points ?? 0} pts`;
        points.style.cssText = 'font-size: 14px; color: #f4e8ff; font-weight: 600;';

        top.appendChild(result);
        top.appendChild(points);

        const uuid = document.createElement('div');
        uuid.textContent = `UUID: ${shortUuid(m.matchId)}`;
        uuid.title = m.matchId;
        uuid.style.cssText = 'font-size: 11px; color: #6b6088; margin-top: 4px;';

        const date = document.createElement('div');
        date.textContent = formatDate(m.endedAt);
        date.style.cssText = 'font-size: 12px; color: #9a8bb8; margin-top: 2px;';

        const names = (m.participants || []).map((p) => p.name).filter(Boolean);
        const participants = document.createElement('div');
        participants.textContent = names.length
          ? `Participantes: ${names.join(', ')}`
          : 'Participantes: —';
        participants.style.cssText =
          'font-size: 12px; color: #c4b5e0; margin-top: 6px; line-height: 1.35;';

        const stats = document.createElement('div');
        stats.textContent = `${elementLabel(m.wizardType)} · ${m.kills ?? 0}K / ${m.deaths ?? 0}D · ${m.damageDealt ?? 0} dano`;
        stats.style.cssText = 'font-size: 11px; color: #9a8bb8; margin-top: 4px;';

        row.appendChild(top);
        row.appendChild(uuid);
        row.appendChild(date);
        row.appendChild(participants);
        row.appendChild(stats);
        this.historyEl.appendChild(row);
      }
    } catch (err) {
      this.historyStatus?.setText(err.message || 'Falha ao carregar histórico').setColor('#ff6b6b');
    }
  }

  buildSkinPicker(centerX, y, depth) {
    const gap = 88;
    const totalW = (WIZARD_SKINS.length - 1) * gap;
    const startX = centerX - totalW / 2;

    this.skinButtons = [];
    WIZARD_SKINS.forEach((skin, i) => {
      const x = startX + i * gap;
      const selected = skin.id === this.selectedSkin;
      const key = updateWizardPreviewTexture(
        this,
        this.selectedColor,
        skin.id,
        `wizard_skin_pick_${skin.id}`
      );

      const frame = this.add
        .rectangle(x, y, 70, 70, 0x1a1430, 0.85)
        .setStrokeStyle(2, 0xffffff, selected ? 0.95 : 0.2)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });

      const sprite = this.add
        .sprite(x, y - 4, key)
        .setScale(1.2)
        .setDepth(depth + 1);

      const label = this.add
        .text(x, y + 46, skin.name, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '10px',
          color: selected ? '#f4e8ff' : '#9a8bb8',
        })
        .setOrigin(0.5)
        .setDepth(depth);

      const pick = () => this.selectSkin(skin.id);
      frame.on('pointerup', pick);
      sprite.setInteractive({ useHandCursor: true }).on('pointerup', pick);

      this.skinButtons.push({ skinId: skin.id, frame, sprite, label });
    });
  }

  buildPalette(centerX, y, depth) {
    const size = 24;
    const gap = 7;
    const cols = 10;
    const rows = Math.ceil(WIZARD_COLORS.length / cols);
    const totalW = cols * size + (cols - 1) * gap;
    const totalH = rows * size + (rows - 1) * gap;
    const startX = centerX - totalW / 2 + size / 2;
    const startY = y - totalH / 2 + size / 2;

    this.swatches = [];
    WIZARD_COLORS.forEach((color, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (size + gap);
      const cy = startY + row * (size + gap);
      const swatch = this.add
        .rectangle(x, cy, size, size, color, 1)
        .setStrokeStyle(2, 0xffffff, this.selectedColor === color ? 0.95 : 0.2)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });
      swatch.on('pointerup', () => this.selectColor(color));
      this.swatches.push({ color, swatch });
    });
  }

  refreshPreviews() {
    updateWizardPreviewTexture(this, this.selectedColor, this.selectedSkin);
    this.preview.setTexture('wizard_preview');

    for (const btn of this.skinButtons) {
      const key = updateWizardPreviewTexture(
        this,
        this.selectedColor,
        btn.skinId,
        `wizard_skin_pick_${btn.skinId}`
      );
      btn.sprite.setTexture(key);
    }
  }

  selectSkin(skinId) {
    this.selectedSkin = skinId;
    this.refreshPreviews();
    for (const btn of this.skinButtons) {
      const selected = btn.skinId === this.selectedSkin;
      btn.frame.setStrokeStyle(2, 0xffffff, selected ? 0.95 : 0.2);
      btn.label.setColor(selected ? '#f4e8ff' : '#9a8bb8');
    }
  }

  selectColor(color) {
    this.selectedColor = color >>> 0;
    this.refreshPreviews();
    for (const { color: c, swatch } of this.swatches) {
      swatch.setStrokeStyle(2, 0xffffff, c === this.selectedColor ? 0.95 : 0.2);
    }
  }

  save() {
    const name = String(this.nameInput?.node?.value || '').trim();
    const result = saveCharacter({
      id: this.character.id,
      name,
      color: this.selectedColor,
      skin: this.selectedSkin,
    });
    if (!result.ok) {
      this.errorText.setText(result.error);
      this.nameInput?.node?.focus();
      return;
    }
    this.character = result.character;
    this.errorText.setText('');
    navigate('/');
  }

  update(_time, delta) {
    updateMenuFlames(this);
    updateAmbientCreatures(this, delta);
  }
}
