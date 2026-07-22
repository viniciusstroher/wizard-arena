import Phaser from 'phaser';
import {
  attackIconKey,
  getMonsterEntries,
  getSpellEntries,
  getFloorEntries,
  getItemEntries,
  ITEM_CATEGORY_SECTIONS,
} from '../catalog/galleryCatalog.js';
import { spellElementIconKey } from '../catalog/spellElements.js';
import {
  clearGalleryUrl,
  galleryShareUrl,
  syncGalleryUrl,
} from './galleryUrl.js';
import { GallerySpellFx } from './gallerySpellFx.js';
import { ensureCharacter } from '../character.js';
import { ensureWizardColorTexture } from '../wizardSkin.js';
import { ensureItemIconTextures, itemIconKey } from '../itemIcons.js';

const TIER_SECTIONS = [
  { id: 'normal', label: 'Normais', color: '#9a8bb8' },
  { id: 'elite', label: 'Elites', color: '#e8b84a' },
  { id: 'boss', label: 'Bosses', color: '#e85a5a' },
];

const SPELL_SECTIONS = [
  { id: 'basic', label: 'Básicas', color: '#9a8bb8' },
  { id: 'innate', label: 'Inatas', color: '#55ff88' },
  { id: 'monster', label: 'Monstro', color: '#e8b84a' },
  { id: 'ultimate', label: 'Ult.', color: '#6b5cff' },
  { id: 'boss', label: 'Boss', color: '#e85a5a' },
];

const FLOOR_SECTIONS = [
  { id: 'nature', label: 'Nat.', color: '#58d68d' },
  { id: 'element', label: 'Elem.', color: '#5dade2' },
  { id: 'water', label: 'Água', color: '#48c9b0' },
  { id: 'dark', label: 'Sombra', color: '#a569bd' },
  { id: 'soil', label: 'Solo', color: '#d4a574' },
];

const FONT = 'Trebuchet MS, sans-serif';
const PANEL_W = 760;
const PANEL_H = 540;
const LIST_W = 280;
const LIST_PAD = 10;
const LIST_INNER_W = LIST_W - LIST_PAD * 2;
const PREVIEW_W = 340;
const PREVIEW_H = 260;
/** Margem interna ao encaixar o sprite do monstro no painel de preview. */
const MONSTER_PREVIEW_PAD_X = 28;
const MONSTER_PREVIEW_PAD_Y = 20;
/** Fração do tamanho máximo que cabe no preview (1 = preenche; menor = mais compacto). */
const MONSTER_PREVIEW_FILL = 0.42;

/**
 * Modal da galeria no lobby: abas Monstros / Magias / Terrenos com lista + preview.
 */
export class GalleryModal {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ onOpen?: () => void, onClose?: () => void }} [options]
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.onOpen = options.onOpen || null;
    this.onClose = options.onClose || null;

    this.open = false;
    this.tab = 'monsters';
    this.monsterTier = 'normal';
    this.spellCategory = 'basic';
    this.floorGroup = 'nature';
    this.searchQuery = '';
    this.selectedMonsterId = null;
    this.selectedSpellId = null;
    this.selectedFloorId = null;
    this.selectedItemId = null;
    this.itemCategory = 'equipment';
    this._previewedTab = null;
    this._previewedId = null;

    this.container = scene.add.container(0, 0).setDepth(400).setVisible(false);
    this.listDom = null;
    this.listScrollEl = null;
    this.searchInputEl = null;
    this.previewRoot = null;
    this.previewSprites = [];
    this.previewTimers = [];
    this.fx = {};
    this.tabTexts = [];
    this.tierTabEls = [];
    this.infoTitle = null;
    this.infoElementIcon = null;
    this.infoBody = null;
    this.copyBtn = null;
    this.copyLabel = null;
    this.copyFeedbackTimer = null;
    this.stageGfx = null;
    this.spellFx = null;
    this._previewPlatformId = null;
    this._previewArenaR = 78;

    this.monsters = getMonsterEntries();
    this.spells = getSpellEntries();
    this.floors = getFloorEntries();
    this.items = getItemEntries();
    this.layout = null;
  }

  isOpen() {
    return this.open;
  }

  _computeLayout() {
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;
    const panelLeft = cx - PANEL_W / 2;
    const panelTop = cy - PANEL_H / 2;
    const padX = 28;
    const titleY = panelTop + 26;
    const tabY = titleY + 34;
    const closeY = panelTop + PANEL_H - 32;
    const contentTop = tabY + 28;
    const contentBottom = closeY - 40;
    const contentH = contentBottom - contentTop;
    const listH = contentH;
    const listX = panelLeft + padX + LIST_W / 2;
    const listY = contentTop + listH / 2;
    const previewX = cx + PANEL_W / 2 - padX - PREVIEW_W / 2;
    const previewY = contentTop + PREVIEW_H / 2;
    const infoTop = contentTop + PREVIEW_H + 14;

    return {
      cx,
      cy,
      titleY,
      tabY,
      closeY,
      listX,
      listY,
      listH,
      previewX,
      previewY,
      infoTop,
      infoWrapW: PREVIEW_W - 20,
    };
  }

  /**
   * @param {{ tab?: 'monsters'|'spells'|'floors', monsterId?: string|null, spellId?: string|null, floorId?: string|null, syncUrl?: boolean }} [options]
   */
  show(options = {}) {
    if (this.open) {
      this.applyDeepLink(options);
      return;
    }
    this.open = true;
    this.onOpen?.();

    // Recarrega o catálogo atual (nomes/ícones/defs).
    this.monsters = getMonsterEntries();
    this.spells = getSpellEntries();
    this.floors = getFloorEntries();
    this.items = getItemEntries();
    ensureItemIconTextures(this.scene);
    this._applyDeepLinkState(options);

    const { width, height } = this.scene.scale;
    const L = this._computeLayout();
    this.layout = L;

    this.spellFx?.destroy();
    this.spellFx = null;
    this._clearPreview();
    this.container.removeAll(true);
    this.previewRoot = null;
    this.stageGfx = null;
    this._destroyListDom();
    this.container.setDepth(10000).setVisible(true);
    this.scene.children.bringToTop(this.container);

    const dim = this.scene.add.rectangle(L.cx, L.cy, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.hide());

    const panel = this.scene.add
      .rectangle(L.cx, L.cy, PANEL_W, PANEL_H, 0x161228, 0.98)
      .setStrokeStyle(2, 0x6b5cff)
      .setInteractive();

    const title = this.scene.add
      .text(L.cx, L.titleY, 'Galeria', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    this.tabTexts = [];
    const tabs = [
      { id: 'monsters', label: `Monstros (${this.monsters.length})` },
      { id: 'spells', label: `Magias (${this.spells.length})` },
      { id: 'items', label: `Itens (${this.items.length})` },
      { id: 'floors', label: `Terrenos (${this.floors.length})` },
    ];
    let tabX = L.cx - 220;
    for (const t of tabs) {
      const text = this.scene.add
        .text(tabX, L.tabY, t.label, {
          fontFamily: FONT,
          fontSize: '15px',
          color: '#7a6e96',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      text.on('pointerup', () => this._setTab(t.id));
      this.tabTexts.push({ id: t.id, text });
      tabX += 150;
    }

    const listBg = this.scene.add
      .rectangle(L.listX, L.listY, LIST_W, L.listH, 0x0e0a1a, 0.95)
      .setStrokeStyle(1, 0x6b5cff, 0.35);

    const previewBg = this.scene.add
      .rectangle(L.previewX, L.previewY, PREVIEW_W, PREVIEW_H, 0x0a0814, 0.95)
      .setStrokeStyle(1, 0x6b5cff, 0.35);

    this.infoTitle = this.scene.add
      .text(L.previewX, L.infoTop, '', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#e8dfff',
        align: 'center',
        wordWrap: { width: L.infoWrapW },
      })
      .setOrigin(0.5, 0);

    this.infoElementIcon = this.scene.add
      .image(L.previewX - 70, L.infoTop + 10, 'element_arcane')
      .setDisplaySize(16, 16)
      .setVisible(false);

    this.infoBody = this.scene.add
      .text(L.previewX, L.infoTop + 28, '', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#a99bc8',
        align: 'center',
        wordWrap: { width: L.infoWrapW },
      })
      .setOrigin(0.5, 0);

    const copyY = L.closeY;
    const copyX = L.previewX;
    this.copyBtn = this.scene.add
      .rectangle(copyX, copyY, 150, 36, 0x2a2448, 1)
      .setStrokeStyle(1, 0x6b5cff, 0.7);
    this.copyLabel = this.scene.add
      .text(copyX, copyY, 'Copiar link', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#e8dfff',
      })
      .setOrigin(0.5);
    this.copyBtn.setInteractive({ useHandCursor: true });
    this.copyBtn.on('pointerover', () => this.copyBtn.setFillStyle(0x3a3360, 1));
    this.copyBtn.on('pointerout', () => this.copyBtn.setFillStyle(0x2a2448, 1));
    this.copyBtn.on('pointerup', () => this._copyCurrentLink());

    const closeBg = this.scene.add
      .rectangle(L.cx, L.closeY, 140, 40, 0x6b5cff, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const closeLabel = this.scene.add
      .text(L.cx, L.closeY, 'Fechar', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerover', () => closeBg.setScale(1.04));
    closeBg.on('pointerout', () => closeBg.setScale(1));
    closeBg.on('pointerup', () => this.hide());

    this.previewRoot = this.scene.add.container(L.previewX, L.previewY);
    this.stageGfx = this.scene.add.graphics();
    this.previewRoot.add(this.stageGfx);

    this.spellFx = new GallerySpellFx(this.scene, {
      getOrigin: () => ({
        x: this.previewRoot?.x ?? 0,
        y: this.previewRoot?.y ?? 0,
      }),
      depth: 10003,
    });
    this.spellFx.create(this.previewRoot);

    this.container.add([
      dim,
      panel,
      title,
      ...this.tabTexts.map((t) => t.text),
      listBg,
      previewBg,
      this.previewRoot,
      this.infoTitle,
      this.infoElementIcon,
      this.infoBody,
      this.copyBtn,
      this.copyLabel,
      closeBg,
      closeLabel,
    ]);

    this._createFx();
    this._setTab(this.tab, true);
    if (options.syncUrl !== false) this._syncUrl();
  }

  /**
   * Aplica deep link com a galeria já aberta (ou só prepara estado se fechada).
   * @param {{ tab?: 'monsters'|'spells'|'floors', monsterId?: string|null, spellId?: string|null, floorId?: string|null, syncUrl?: boolean }} [options]
   */
  applyDeepLink(options = {}) {
    if (
      !options ||
      (!options.tab && !options.monsterId && !options.spellId && !options.floorId)
    ) {
      return;
    }
    this.monsters = getMonsterEntries();
    this.spells = getSpellEntries();
    this.floors = getFloorEntries();
    this.items = getItemEntries();
    this._applyDeepLinkState(options);
    if (!this.open) {
      this.show({ ...options, syncUrl: options.syncUrl });
      return;
    }
    this._setTab(this.tab, true);
    if (options.syncUrl !== false) this._syncUrl();
  }

  _applyDeepLinkState(options = {}) {
    if (options.tab === 'monsters' || options.tab === 'spells' || options.tab === 'floors' || options.tab === 'items' || options.tab === 'ores') {
      this.tab = options.tab === 'ores' ? 'items' : options.tab;
    } else if (options.itemId || options.oreId) {
      this.tab = 'items';
    } else if (options.spellId) {
      this.tab = 'spells';
    } else if (options.monsterId) {
      this.tab = 'monsters';
    } else if (options.floorId) {
      this.tab = 'floors';
    }

    if (options.monsterId) {
      const monster = this.monsters.find((m) => m.id === options.monsterId);
      if (monster) {
        this.tab = 'monsters';
        this.monsterTier = monster.tier;
        this.selectedMonsterId = monster.id;
        this.searchQuery = '';
      }
    }

    const itemId = options.itemId || options.oreId;
    if (itemId) {
      const item = this.items.find((i) => i.id === itemId);
      if (item) {
        this.tab = 'items';
        this.itemCategory = item.category;
        this.selectedItemId = item.id;
        this.searchQuery = '';
      }
    }

    if (options.spellId) {
      const spell = this.spells.find((s) => s.id === options.spellId);
      if (spell) {
        this.tab = 'spells';
        this.spellCategory = spell.category;
        this.selectedSpellId = spell.id;
        this.searchQuery = '';
      }
    }

    if (options.floorId) {
      const floor = this.floors.find((f) => f.id === options.floorId);
      if (floor) {
        this.tab = 'floors';
        this.floorGroup = floor.group;
        this.selectedFloorId = floor.id;
        this.searchQuery = '';
      }
    }
  }

  _syncUrl() {
    const spellId = this.tab === 'spells' ? this.selectedSpellId : null;
    const monsterId = this.tab === 'monsters' ? this.selectedMonsterId : null;
    const floorId = this.tab === 'floors' ? this.selectedFloorId : null;
    const itemId = this.tab === 'items' ? this.selectedItemId : null;
    syncGalleryUrl({ tab: this.tab, spellId, monsterId, floorId, itemId });
  }

  async _copyCurrentLink() {
    const spellId = this.tab === 'spells' ? this.selectedSpellId : null;
    const monsterId = this.tab === 'monsters' ? this.selectedMonsterId : null;
    const floorId = this.tab === 'floors' ? this.selectedFloorId : null;
    const itemId = this.tab === 'items' ? this.selectedItemId : null;
    if (
      (this.tab === 'spells' && !spellId) ||
      (this.tab === 'monsters' && !monsterId) ||
      (this.tab === 'floors' && !floorId) ||
      (this.tab === 'items' && !itemId)
    ) {
      this._setCopyFeedback('Selecione um item');
      return;
    }
    const url = galleryShareUrl({ tab: this.tab, spellId, monsterId, floorId, itemId });
    const ok = await this._writeClipboard(url);
    this._setCopyFeedback(ok ? 'Link copiado!' : 'Falha ao copiar');
  }

  async _writeClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fallback abaixo */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  _setCopyFeedback(message) {
    if (!this.copyLabel) return;
    this.copyLabel.setText(message);
    if (this.copyFeedbackTimer) {
      this.copyFeedbackTimer.remove(false);
      this.copyFeedbackTimer = null;
    }
    this.copyFeedbackTimer = this.scene.time.delayedCall(1400, () => {
      this.copyFeedbackTimer = null;
      if (this.copyLabel?.active) this.copyLabel.setText('Copiar link');
    });
  }

  hide() {
    if (!this.open && !this.listDom) return;
    this.open = false;
    if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = true;
    if (this.copyFeedbackTimer) {
      this.copyFeedbackTimer.remove(false);
      this.copyFeedbackTimer = null;
    }
    this._clearPreview();
    this._destroyFx();
    this.spellFx?.destroy();
    this.spellFx = null;
    this._destroyListDom();
    this.container.removeAll(true);
    this.container.setVisible(false);
    this.previewRoot = null;
    this.infoTitle = null;
    this.infoElementIcon = null;
    this.infoBody = null;
    this.copyBtn = null;
    this.copyLabel = null;
    this.stageGfx = null;
    this.tabTexts = [];
    this.tierTabEls = [];
    this.listScrollEl = null;
    this.searchInputEl = null;
    this.layout = null;
    this._previewedTab = null;
    this._previewedId = null;
    this._previewPlatformId = null;
    clearGalleryUrl();
    this.onClose?.();
  }

  destroy() {
    this.hide();
    this.container.destroy(true);
  }

  _setTab(tab, force = false) {
    if (!force && this.tab === tab) return;
    this.tab = tab;
    this.searchQuery = '';
    for (const t of this.tabTexts) {
      t.text.setColor(t.id === tab ? '#e8dfff' : '#7a6e96');
    }
    this._rebuildList();
    this._selectDefaultForCurrentView();
    this._syncUrl();
  }

  _setMonsterTier(tier) {
    if (this.monsterTier === tier) return;
    this.monsterTier = tier;
    this._syncFilterTabs();
    this._fillListContent();
    this._selectDefaultForCurrentView();
    this._syncUrl();
  }

  _setSpellCategory(category) {
    if (this.spellCategory === category) return;
    this.spellCategory = category;
    this._syncFilterTabs();
    this._fillListContent();
    this._selectDefaultForCurrentView();
    this._syncUrl();
  }

  _setFloorGroup(group) {
    if (this.floorGroup === group) return;
    this.floorGroup = group;
    this._syncFilterTabs();
    this._fillListContent();
    this._selectDefaultForCurrentView();
    this._syncUrl();
  }

  _selectDefaultForCurrentView() {
    if (this.tab === 'items') {
      const filtered = this._filteredItems();
      const keep = filtered.find((o) => o.id === this.selectedItemId);
      if (keep) {
        const samePreview = this._previewedTab === 'items' && this._previewedId === keep.id;
        if (samePreview) this._highlightListSelection();
        else this._selectItem(keep.id, { syncUrl: false });
        return;
      }
      const first = filtered[0];
      if (first) {
        this._selectItem(first.id);
        return;
      }
      this.selectedItemId = null;
      this._previewedId = null;
      this._previewedTab = null;
      this._clearPreview();
      if (this.infoTitle) this.infoTitle.setText('');
      this._setInfoElement(null);
      if (this.infoBody) this.infoBody.setText('Nenhum item encontrado.');
      return;
    }

    if (this.tab === 'monsters') {
      const filtered = this._filteredMonsters();
      const keep = filtered.find((m) => m.id === this.selectedMonsterId);
      if (keep) {
        const samePreview =
          this._previewedTab === 'monsters' && this._previewedId === keep.id;
        if (samePreview) this._highlightListSelection();
        else this._selectMonster(keep.id, { syncUrl: false });
        return;
      }
      const first = filtered[0];
      if (first) {
        this._selectMonster(first.id);
        return;
      }
      this.selectedMonsterId = null;
      this._previewedId = null;
      this._previewedTab = null;
      this._clearPreview();
      if (this.infoTitle) this.infoTitle.setText('');
      this._setInfoElement(null);
      if (this.infoBody) this.infoBody.setText('Nenhum monstro encontrado.');
      return;
    }

    if (this.tab === 'floors') {
      const filtered = this._filteredFloors();
      const keep = filtered.find((f) => f.id === this.selectedFloorId);
      if (keep) {
        const samePreview = this._previewedTab === 'floors' && this._previewedId === keep.id;
        if (samePreview) this._highlightListSelection();
        else this._selectFloor(keep.id, { syncUrl: false });
        return;
      }
      const first = filtered[0];
      if (first) {
        this._selectFloor(first.id);
        return;
      }
      this.selectedFloorId = null;
      this._previewedId = null;
      this._previewedTab = null;
      this._clearPreview();
      if (this.infoTitle) this.infoTitle.setText('');
      this._setInfoElement(null);
      if (this.infoBody) this.infoBody.setText('Nenhum terreno encontrado.');
      return;
    }

    const filtered = this._filteredSpells();
    const keep = filtered.find((s) => s.id === this.selectedSpellId);
    if (keep) {
      const samePreview = this._previewedTab === 'spells' && this._previewedId === keep.id;
      if (samePreview) this._highlightListSelection();
      else this._selectSpell(keep.id, { syncUrl: false });
      return;
    }
    const first = filtered[0];
    if (first) {
      this._selectSpell(first.id);
      return;
    }
    this.selectedSpellId = null;
    this._previewedId = null;
    this._previewedTab = null;
    this._clearPreview();
    if (this.infoTitle) this.infoTitle.setText('');
    this._setInfoElement(null);
    if (this.infoBody) this.infoBody.setText('Nenhuma magia encontrada.');
  }

  _filteredMonsters() {
    const q = this.searchQuery.trim().toLowerCase();
    return this.monsters.filter((m) => {
      if (m.tier !== this.monsterTier) return false;
      if (!q) return true;
      const name = (m.name || '').toLowerCase();
      const spells = (m.spellNames || []).join(' ').toLowerCase();
      const attack = (m.attackLabel || '').toLowerCase();
      return name.includes(q) || spells.includes(q) || attack.includes(q);
    });
  }

  _filteredSpells() {
    const q = this.searchQuery.trim().toLowerCase();
    return this.spells.filter((s) => {
      if (s.category !== this.spellCategory) return false;
      if (!q) return true;
      const name = (s.name || '').toLowerCase();
      const desc = (s.description || '').toLowerCase();
      const type = (s.typeLabel || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || type.includes(q);
    });
  }

  _filteredFloors() {
    const q = this.searchQuery.trim().toLowerCase();
    return this.floors.filter((f) => {
      if (f.group !== this.floorGroup) return false;
      if (!q) return true;
      const name = (f.name || '').toLowerCase();
      const desc = (f.description || '').toLowerCase();
      const type = (f.typeLabel || '').toLowerCase();
      const id = (f.id || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || type.includes(q) || id.includes(q);
    });
  }

  _filteredItems() {
    const q = this.searchQuery.trim().toLowerCase();
    return this.items.filter((it) => {
      if (it.category !== this.itemCategory) return false;
      if (!q) return true;
      const name = (it.name || '').toLowerCase();
      const id = (it.id || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }

  _filterSections() {
    if (this.tab === 'monsters') return TIER_SECTIONS;
    if (this.tab === 'floors') return FLOOR_SECTIONS;
    if (this.tab === 'items') return ITEM_CATEGORY_SECTIONS;
    return SPELL_SECTIONS;
  }

  _activeFilterId() {
    if (this.tab === 'monsters') return this.monsterTier;
    if (this.tab === 'floors') return this.floorGroup;
    if (this.tab === 'items') return this.itemCategory;
    return this.spellCategory;
  }

  _rebuildList() {
    this._destroyListDom();
    const L = this.layout || this._computeLayout();
    this.layout = L;

    const innerH = L.listH - LIST_PAD * 2;
    // filter tabs(30) + gap(8) + search(32) + gap(8)
    const chromeH = 78;
    const scrollH = Math.max(80, innerH - chromeH);
    const sections = this._filterSections();
    const activeId = this._activeFilterId();
    const searchPlaceholder =
      this.tab === 'monsters'
        ? 'Procurar monstro...'
        : this.tab === 'floors'
          ? 'Procurar terreno...'
          : this.tab === 'items'
            ? 'Procurar item...'
            : 'Procurar magia...';

    const root = document.createElement('div');
    root.style.cssText = [
      `width: ${LIST_INNER_W}px`,
      `height: ${innerH}px`,
      'box-sizing: border-box',
      'display: flex',
      'flex-direction: column',
      'gap: 8px',
      'overflow: hidden',
      'font-family: Trebuchet MS, sans-serif',
      'font-size: 13px',
      'color: #eee6ff',
      'background: transparent',
      'user-select: none',
    ].join(';');

    this.tierTabEls = [];
    this.searchInputEl = null;

    const filterRow = document.createElement('div');
    filterRow.style.cssText = [
      'display: flex',
      'gap: 3px',
      'flex-shrink: 0',
      'height: 30px',
      'box-sizing: border-box',
    ].join(';');

    for (const section of sections) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.filter = section.id;
      btn.textContent = this._filterTabLabel(section);
      btn.style.cssText = this._filterTabStyle(section.id === activeId, section.color);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.tab === 'monsters') this._setMonsterTier(section.id);
        else if (this.tab === 'floors') this._setFloorGroup(section.id);
        else if (this.tab === 'items') this._setItemCategory(section.id);
        else this._setSpellCategory(section.id);
      });
      this.tierTabEls.push(btn);
      filterRow.appendChild(btn);
    }
    root.appendChild(filterRow);

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = searchPlaceholder;
    search.value = this.searchQuery;
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.style.cssText = [
      'flex-shrink: 0',
      'width: 100%',
      'height: 32px',
      'box-sizing: border-box',
      'padding: 0 10px',
      'border-radius: 6px',
      'border: 1px solid rgba(107,92,255,0.45)',
      'background: rgba(10,8,20,0.95)',
      'color: #eee6ff',
      'font-family: Trebuchet MS, sans-serif',
      'font-size: 12px',
      'outline: none',
      'user-select: text',
    ].join(';');
    search.addEventListener('pointerdown', (e) => e.stopPropagation());
    search.addEventListener('mousedown', (e) => e.stopPropagation());
    search.addEventListener('keydown', (e) => e.stopPropagation());
    search.addEventListener('keyup', (e) => e.stopPropagation());
    search.addEventListener('focus', () => {
      if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = false;
    });
    search.addEventListener('blur', () => {
      if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = true;
    });
    search.addEventListener('input', () => {
      this.searchQuery = search.value || '';
      this._fillListContent();
      this._selectDefaultForCurrentView();
    });
    this.searchInputEl = search;
    root.appendChild(search);

    const scroll = document.createElement('div');
    scroll.style.cssText = [
      `height: ${scrollH}px`,
      'flex: 0 0 auto',
      'overflow-y: auto',
      'overflow-x: hidden',
      'box-sizing: border-box',
      'padding: 2px 0',
      'scrollbar-width: thin',
      'scrollbar-color: #6b5cff #1a1430',
    ].join(';');
    this.listScrollEl = scroll;
    root.appendChild(scroll);

    this.listDom = this.scene.add.dom(L.listX, L.listY, root).setOrigin(0.5).setDepth(10001);

    this._fillListContent();
  }

  _filterTabLabel(section) {
    const count =
      this.tab === 'monsters'
        ? this.monsters.filter((m) => m.tier === section.id).length
        : this.tab === 'floors'
          ? this.floors.filter((f) => f.group === section.id).length
          : this.tab === 'items'
            ? this.items.filter((it) => it.category === section.id).length
            : this.spells.filter((s) => s.category === section.id).length;
    return `${section.label} (${count})`;
  }

  _filterTabStyle(active, color) {
    return [
      'flex: 1',
      'height: 100%',
      'padding: 0 2px',
      'border-radius: 6px',
      'cursor: pointer',
      'font-family: Trebuchet MS, sans-serif',
      'font-size: 10px',
      'font-weight: 700',
      'letter-spacing: 0.02em',
      'border: 1px solid',
      'box-sizing: border-box',
      'white-space: nowrap',
      active
        ? `border-color: ${color}; background: rgba(107,92,255,0.35); color: #ffffff`
        : 'border-color: rgba(255,255,255,0.1); background: transparent; color: #9a8bb8',
    ].join(';');
  }

  _syncFilterTabs() {
    const sections = this._filterSections();
    const activeId = this._activeFilterId();
    for (const btn of this.tierTabEls) {
      const section = sections.find((s) => s.id === btn.dataset.filter);
      if (!section) continue;
      btn.textContent = this._filterTabLabel(section);
      btn.style.cssText = this._filterTabStyle(section.id === activeId, section.color);
    }
  }

  _selectedIdForTab(tab) {
    if (tab === 'monsters') return this.selectedMonsterId;
    if (tab === 'floors') return this.selectedFloorId;
    if (tab === 'items') return this.selectedItemId;
    return this.selectedSpellId;
  }

  _fillListContent() {
    const scroll = this.listScrollEl;
    if (!scroll) return;
    scroll.replaceChildren();

    if (this.tab === 'monsters') {
      const group = this._filteredMonsters();
      if (!group.length) {
        const empty = document.createElement('div');
        empty.style.cssText =
          'padding: 16px 12px; color: #7a6e96; font-size: 12px; text-align: center;';
        empty.textContent = this.searchQuery.trim()
          ? 'Nenhum monstro corresponde à procura.'
          : 'Nenhum monstro nesta classe.';
        scroll.appendChild(empty);
        return;
      }
      for (const entry of group) {
        scroll.appendChild(this._makeListRow(entry, 'monsters'));
      }
      return;
    }

    if (this.tab === 'items') {
      const group = this._filteredItems();
      if (!group.length) {
        const empty = document.createElement('div');
        empty.style.cssText =
          'padding: 16px 12px; color: #7a6e96; font-size: 12px; text-align: center;';
        empty.textContent = this.searchQuery.trim()
          ? 'Nenhum item corresponde à procura.'
          : 'Nenhum item disponível.';
        scroll.appendChild(empty);
        return;
      }
      for (const entry of group) {
        scroll.appendChild(this._makeListRow(entry, 'items'));
      }
      return;
    }

    if (this.tab === 'floors') {
      const group = this._filteredFloors();
      if (!group.length) {
        const empty = document.createElement('div');
        empty.style.cssText =
          'padding: 16px 12px; color: #7a6e96; font-size: 12px; text-align: center;';
        empty.textContent = this.searchQuery.trim()
          ? 'Nenhum terreno corresponde à procura.'
          : 'Nenhum terreno neste grupo.';
        scroll.appendChild(empty);
        return;
      }
      for (const entry of group) {
        scroll.appendChild(this._makeListRow(entry, 'floors'));
      }
      return;
    }

    const group = this._filteredSpells();
    if (!group.length) {
      const empty = document.createElement('div');
      empty.style.cssText =
        'padding: 16px 12px; color: #7a6e96; font-size: 12px; text-align: center;';
      empty.textContent = this.searchQuery.trim()
        ? 'Nenhuma magia corresponde à procura.'
        : 'Nenhuma magia nesta categoria.';
      scroll.appendChild(empty);
      return;
    }
    for (const entry of group) {
      scroll.appendChild(this._makeListRow(entry, 'spells'));
    }
  }

  _makeListRow(entry, tab) {
    const selectedId = this._selectedIdForTab(tab);
    const active = entry.id === selectedId;
    const row = document.createElement('div');
    row.dataset.id = entry.id;
    row.style.cssText = [
      'padding: 7px 8px',
      'margin: 2px 4px',
      'border-radius: 6px',
      'cursor: pointer',
      'box-sizing: border-box',
      'max-width: 100%',
      'overflow: hidden',
      `background: ${active ? 'rgba(107,92,255,0.35)' : 'transparent'}`,
      `color: ${active ? '#ffffff' : '#c4b5e0'}`,
      'display: flex',
      'flex-direction: column',
      'gap: 2px',
    ].join(';');

    const top = document.createElement('div');
    top.style.cssText = [
      'display: flex',
      'justify-content: space-between',
      'align-items: center',
      'gap: 8px',
      'min-width: 0',
      'overflow: hidden',
    ].join(';');

    const nameWrap = document.createElement('div');
    nameWrap.style.cssText = [
      'display: flex',
      'align-items: center',
      'gap: 6px',
      'min-width: 0',
      'flex: 1',
      'overflow: hidden',
    ].join(';');

    if (tab === 'spells' && entry.elementLabel) {
      nameWrap.appendChild(this._elementBadgeEl(entry.elementCss, entry.elementLabel, true));
    }
    if (tab === 'items' && entry.slotLabel) {
      const iconKey = itemIconKey(entry.id);
      if (this.scene.textures.exists(iconKey)) {
        try {
          const canvas = this.scene.textures.get(iconKey).getSourceImage();
          if (canvas && typeof canvas.toDataURL === 'function') {
            const img = document.createElement('img');
            img.src = canvas.toDataURL();
            img.style.cssText = 'width:20px;height:20px;border-radius:3px;flex-shrink:0;image-rendering:pixelated';
            nameWrap.appendChild(img);
          }
        } catch { /* fallback to color dot below */ }
      }
      if (!nameWrap.querySelector('img')) {
        const colorCss = `#${(entry.color >>> 0).toString(16).padStart(6, '0')}`;
        nameWrap.appendChild(this._elementBadgeEl(colorCss, '', true));
      }
    }

    const name = document.createElement('span');
    name.textContent = this._capitalize(entry.name);
    name.style.cssText = [
      'overflow: hidden',
      'text-overflow: ellipsis',
      'white-space: nowrap',
      'min-width: 0',
      'flex: 1',
    ].join(';');
    nameWrap.appendChild(name);

    const badge = document.createElement('span');
    badge.style.cssText = [
      'display: inline-flex',
      'align-items: center',
      'gap: 4px',
      'font-size: 11px',
      'color: #9a8bb8',
      'flex-shrink: 0',
    ].join(';');
    if (tab === 'monsters') {
      const atkIcon = this._attackIconEl(entry.attack);
      if (atkIcon) badge.appendChild(atkIcon);
      const atkLabel = document.createElement('span');
      atkLabel.textContent = entry.attackLabel;
      badge.appendChild(atkLabel);
    } else if (tab === 'items') {
      badge.textContent = entry.slotLabel || entry.categoryLabel;
    } else {
      badge.textContent = entry.typeLabel;
    }

    top.appendChild(nameWrap);
    top.appendChild(badge);
    row.appendChild(top);

    if (tab === 'spells' && entry.elementLabel) {
      const elLine = document.createElement('div');
      elLine.textContent = entry.elementLabel;
      elLine.style.cssText = [
        'font-size: 10px',
        `color: ${entry.elementCss || '#7a6e96'}`,
        'overflow: hidden',
        'text-overflow: ellipsis',
        'white-space: nowrap',
        'max-width: 100%',
      ].join(';');
      row.appendChild(elLine);
    }

    if (tab === 'items' && entry.set) {
      const setLine = document.createElement('div');
      setLine.textContent = entry.setLabel || entry.set;
      setLine.style.cssText = [
        'font-size: 10px',
        'color: #7a6e96',
        'overflow: hidden',
        'text-overflow: ellipsis',
        'white-space: nowrap',
        'max-width: 100%',
      ].join(';');
      row.appendChild(setLine);
    }

    if (tab === 'monsters' && entry.spellDetails?.length) {
      const spellsLine = document.createElement('div');
      spellsLine.style.cssText = [
        'font-size: 10px',
        'color: #7a6e96',
        'overflow: hidden',
        'text-overflow: ellipsis',
        'white-space: nowrap',
        'max-width: 100%',
      ].join(';');
      spellsLine.textContent = entry.spellDetails
        .map((s) => `${s.name} (${s.elementLabel})`)
        .join(' · ');
      row.appendChild(spellsLine);
    } else if (tab === 'monsters' && entry.spellNames?.length) {
      const spellsLine = document.createElement('div');
      spellsLine.textContent = entry.spellNames.join(' · ');
      spellsLine.style.cssText = [
        'font-size: 10px',
        'color: #7a6e96',
        'overflow: hidden',
        'text-overflow: ellipsis',
        'white-space: nowrap',
        'max-width: 100%',
      ].join(';');
      row.appendChild(spellsLine);
    }

    if (tab === 'monsters' && entry.resistDetails?.length) {
      const resistLine = document.createElement('div');
      resistLine.style.cssText = [
        'display: flex',
        'flex-wrap: wrap',
        'gap: 3px',
        'margin-top: 2px',
        'max-width: 100%',
        'overflow: hidden',
      ].join(';');
      for (const r of entry.resistDetails.slice(0, 4)) {
        const chip = document.createElement('span');
        const weak = r.value < 0;
        chip.textContent = `${r.label} ${r.text}`;
        chip.title = weak
          ? `Vulnerabilidade a ${r.label}: ${r.text}`
          : `Resistência a ${r.label}: ${r.text}`;
        chip.style.cssText = [
          'font-size: 9px',
          'line-height: 1.2',
          'padding: 1px 4px',
          'border-radius: 3px',
          `color: ${weak ? '#ffb4b4' : '#c8f0c8'}`,
          `background: ${r.cssColor}33`,
          `box-shadow: inset 0 0 0 1px ${r.cssColor}88`,
          'white-space: nowrap',
        ].join(';');
        resistLine.appendChild(chip);
      }
      if (entry.resistDetails.length > 4) {
        const more = document.createElement('span');
        more.textContent = `+${entry.resistDetails.length - 4}`;
        more.style.cssText = 'font-size: 9px; color: #7a6e96;';
        resistLine.appendChild(more);
      }
      row.appendChild(resistLine);
    }

    if (tab === 'floors' && entry.description) {
      const descLine = document.createElement('div');
      descLine.textContent = entry.description;
      descLine.style.cssText = [
        'font-size: 10px',
        'color: #7a6e96',
        'overflow: hidden',
        'text-overflow: ellipsis',
        'white-space: nowrap',
        'max-width: 100%',
      ].join(';');
      row.appendChild(descLine);
    }

    row.addEventListener('mouseenter', () => {
      const sel = this._selectedIdForTab(tab);
      if (row.dataset.id !== sel) row.style.background = 'rgba(107,92,255,0.15)';
    });
    row.addEventListener('mouseleave', () => {
      const sel = this._selectedIdForTab(tab);
      row.style.background =
        row.dataset.id === sel ? 'rgba(107,92,255,0.35)' : 'transparent';
    });
    row.addEventListener('click', () => {
      if (tab === 'monsters') this._selectMonster(entry.id);
      else if (tab === 'floors') this._selectFloor(entry.id);
      else if (tab === 'items') this._selectItem(entry.id);
      else this._selectSpell(entry.id);
    });
    return row;
  }

  _highlightListSelection() {
    const root = this.listScrollEl || this.listDom?.node;
    if (!root) return;
    const selectedId = this._selectedIdForTab(this.tab);
    for (const row of root.children) {
      if (!row.dataset?.id) continue;
      const active = row.dataset.id === selectedId;
      row.style.background = active ? 'rgba(107,92,255,0.35)' : 'transparent';
      row.style.color = active ? '#ffffff' : '#c4b5e0';
      if (active) {
        try {
          row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch {
          row.scrollIntoView(false);
        }
      }
    }
  }

  _selectMonster(id, { syncUrl = true } = {}) {
    const entry = this.monsters.find((m) => m.id === id);
    if (!entry) return;
    this.selectedMonsterId = id;
    if (entry.tier !== this.monsterTier) {
      this.monsterTier = entry.tier;
      this._syncFilterTabs();
      this._fillListContent();
    }
    this._highlightListSelection();

    const details = [
      `Tipo: ${entry.tierLabel}`,
      `Ataque: ${entry.attackLabel}`,
    ];
    if (entry.projectile) {
      details.push(`Projétil: ${entry.projectileLabel || entry.projectile.replace(/_/g, ' ')}`);
    }
    if (entry.spellDetails?.length) {
      details.push(
        `Magias: ${entry.spellDetails.map((s) => `${s.name} (${s.elementLabel})`).join(', ')}`
      );
    } else if (entry.spellNames?.length) {
      details.push(`Magias: ${entry.spellNames.join(', ')}`);
    } else if (entry.attack === 'caster') {
      details.push('Magias: —');
    }
    details.push(entry.resistLine || 'Resistências: neutras');

    if (this.infoTitle) this.infoTitle.setText(this._capitalize(entry.name));
    this._setInfoAttack(entry);
    if (this.infoBody) this.infoBody.setText(details.join('\n'));

    this._previewedTab = 'monsters';
    this._previewedId = id;
    this._playMonsterPreview(entry);
    if (syncUrl) this._syncUrl();
  }

  _selectSpell(id, { syncUrl = true } = {}) {
    const entry = this.spells.find((s) => s.id === id);
    if (!entry) return;
    this.selectedSpellId = id;
    if (entry.category !== this.spellCategory) {
      this.spellCategory = entry.category;
      this._syncFilterTabs();
      this._fillListContent();
    }
    this._highlightListSelection();

    if (this.infoTitle) this.infoTitle.setText(entry.name);
    this._setInfoElement(entry);
    if (this.infoBody) {
      const elLine = entry.elementLabel
        ? `${entry.typeLabel} · ${entry.elementLabel}`
        : entry.typeLabel;
      this.infoBody.setText(`${elLine}\n${entry.description}`);
    }
    this._previewedTab = 'spells';
    this._previewedId = id;
    this._playSpellPreview(entry);
    if (syncUrl) this._syncUrl();
  }

  _elementBadgeEl(cssColor, label, iconOnly = false) {
    const badge = document.createElement('span');
    badge.title = label || '';
    badge.style.cssText = [
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'width: 12px',
      'height: 12px',
      'border-radius: 3px',
      `background: ${cssColor || '#7a6e96'}`,
      'flex-shrink: 0',
      'box-shadow: 0 0 0 1px rgba(0,0,0,0.35)',
    ].join(';');
    if (!iconOnly && label) {
      badge.style.width = 'auto';
      badge.style.height = 'auto';
      badge.style.padding = '1px 4px';
      badge.style.fontSize = '9px';
      badge.style.color = '#0a0814';
      badge.textContent = label;
    }
    return badge;
  }

  _textureDataUrl(key) {
    if (!key || !this.scene.textures.exists(key)) return null;
    const src = this.scene.textures.get(key).getSourceImage();
    if (src instanceof HTMLCanvasElement) return src.toDataURL();
    if (src instanceof HTMLImageElement) return src.src || null;
    return null;
  }

  _attackIconEl(attack) {
    const key = attackIconKey(attack);
    const url = this._textureDataUrl(key);
    if (!url) return null;
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.width = 14;
    img.height = 14;
    img.style.cssText = 'image-rendering: pixelated; flex-shrink: 0; display: block;';
    return img;
  }

  _placeInfoIcon(key) {
    const icon = this.infoElementIcon;
    if (!icon) return;
    if (key && this.scene.textures.exists(key)) {
      icon.setTexture(key).setDisplaySize(16, 16).setVisible(true);
      const titleW = this.infoTitle?.width || 0;
      const L = this.layout;
      if (L) {
        icon.setPosition(L.previewX - titleW / 2 - 14, L.infoTop + 10);
      }
    } else {
      icon.setVisible(false);
    }
  }

  _setInfoElement(entry) {
    if (!entry?.element && !entry?.id) {
      this._placeInfoIcon(null);
      return;
    }
    this._placeInfoIcon(spellElementIconKey(entry.element || entry.id));
  }

  _setInfoAttack(entry) {
    if (!entry?.attack) {
      this._placeInfoIcon(null);
      return;
    }
    this._placeInfoIcon(attackIconKey(entry.attack));
  }

  _selectFloor(id, { syncUrl = true } = {}) {
    const entry = this.floors.find((f) => f.id === id);
    if (!entry) return;
    this.selectedFloorId = id;
    if (entry.group !== this.floorGroup) {
      this.floorGroup = entry.group;
      this._syncFilterTabs();
      this._fillListContent();
    }
    this._highlightListSelection();

    const speedPct = Math.round((entry.speedMul - 1) * 100);
    const inertiaPct = Math.round((entry.inertiaMul - 1) * 100);
    const speedTxt =
      speedPct === 0 ? 'Velocidade normal' : `Velocidade ${speedPct > 0 ? '+' : ''}${speedPct}%`;
    const inertiaTxt =
      inertiaPct === 0
        ? 'Sem deslize extra'
        : inertiaPct > 0
          ? `Deslize +${inertiaPct}%`
          : `Inércia ${inertiaPct}%`;

    if (this.infoTitle) this.infoTitle.setText(entry.name);
    this._setInfoElement(null);
    if (this.infoBody) {
      this.infoBody.setText(
        `${entry.groupLabel}\n${entry.description}\n${speedTxt} · ${inertiaTxt}`
      );
    }
    this._previewedTab = 'floors';
    this._previewedId = id;
    this._playFloorPreview(entry);
    if (syncUrl) this._syncUrl();
  }

  _setItemCategory(category) {
    if (this.itemCategory === category) return;
    this.itemCategory = category;
    this._syncFilterTabs();
    this._fillListContent();
    this._selectDefaultForCurrentView();
    this._syncUrl();
  }

  _selectItem(id, { syncUrl = true } = {}) {
    const entry = this.items.find((o) => o.id === id);
    if (!entry) return;
    this.selectedItemId = id;
    if (entry.category !== this.itemCategory) {
      this.itemCategory = entry.category;
      this._syncFilterTabs();
      this._fillListContent();
    }
    this._highlightListSelection();

    const isEquipable = entry.category === 'equipment';
    const details = [`${entry.categoryLabel}${isEquipable ? ' · ' + (entry.slotLabel || '') : ''}`];
    if (entry.level && entry.level > 1) details.push(`Nível requerido: ${entry.level}`);
    if (entry.setLabel) details.push(`Conjunto: ${entry.setLabel}`);
    if (entry.bonusLabels && entry.bonusLabels.length) {
      details.push('');
      details.push('Bônus:');
      for (const bl of entry.bonusLabels) details.push(`  ${bl}`);
    }

    if (this.infoTitle) this.infoTitle.setText(this._capitalize(entry.name));
    this._setInfoElement(null);
    if (this.infoBody) this.infoBody.setText(details.join('\n'));
    this._previewedTab = 'items';
    this._previewedId = id;
    this._playItemPreview(entry);
    if (syncUrl) this._syncUrl();
  }

  _playItemPreview(entry) {
    this._clearPreview();
    if (!this.previewRoot || !entry) return;

    const iconKey = itemIconKey(entry.id);
    if (this.scene.textures.exists(iconKey)) {
      const img = this.scene.add.image(0, -30, iconKey).setDisplaySize(64, 64);
      this.previewRoot.add(img);
      this.previewSprites.push(img);
    } else {
      const color = Number.isFinite(entry.color) ? entry.color >>> 0 : 0xffffff;
      const circle = this.scene.add.circle(0, -30, 42, color, 1);
      this.previewRoot.add(circle);
      this.previewSprites.push(circle);
    }

    // Level badge
    if (entry.level && entry.level > 1) {
      const lvText = this.scene.add
        .text(36, -62, `Lv ${entry.level}`, {
          fontFamily: FONT,
          fontSize: '11px',
          color: '#e8b84a',
          backgroundColor: '#1a1430cc',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0, 0);
      this.previewRoot.add(lvText);
      this.previewSprites.push(lvText);
    }

    const lines = [];
    lines.push(`Tipo: ${entry.slotLabel || entry.categoryLabel}`);
    if (entry.setLabel) lines.push(`Conjunto: ${entry.setLabel}`);
    if (entry.bonusLabels && entry.bonusLabels.length) {
      lines.push('');
      lines.push('Bônus:');
      for (const bl of entry.bonusLabels) lines.push(`  ${bl}`);
    }

    const info = this.scene.add
      .text(0, 80, lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#c4b5e0',
        lineSpacing: 3,
        align: 'center',
      })
      .setOrigin(0.5, 0);
    this.previewRoot.add(info);
    this.previewSprites.push(info);

    // Label abaixo
    const label = this.scene.add
      .text(0, 42, entry.categoryLabel, {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5);
    this.previewRoot.add(label);
    this.previewSprites.push(label);
  }

  _playFloorPreview(entry) {
    this._clearPreview();
    this._buildPlatformStage(entry);
  }

  /** Monta lava + disco + props + borda (plataforma da arena) no preview. */
  _buildPlatformStage(entry) {
    if (!this.previewRoot || !entry) return;

    const arenaR = 78;
    this._previewArenaR = arenaR;
    this._previewPlatformId = entry.id;

    const floorKey = this.scene.textures.exists(entry.textureKey)
      ? entry.textureKey
      : this.scene.textures.exists('arena_brick')
        ? 'arena_brick'
        : null;

    // Fundo de lava (fora do círculo) — como na partida
    if (this.scene.textures.exists('lava_tile')) {
      const lava = this.scene.add
        .tileSprite(0, 0, PREVIEW_W - 12, PREVIEW_H - 12, 'lava_tile')
        .setOrigin(0.5)
        .setTileScale(1.1, 1.1);
      this.previewRoot.add(lava);
      this.previewSprites.push(lava);
      this.previewTimers.push(
        this.scene.time.addEvent({
          delay: 40,
          loop: true,
          callback: () => {
            if (!this.open || this._previewPlatformId !== entry.id || !lava.active) return;
            lava.tilePositionX += 0.45;
            lava.tilePositionY += 0.25;
          },
        })
      );
    } else {
      const bg = this.scene.add.rectangle(0, 0, PREVIEW_W - 12, PREVIEW_H - 12, 0x1a0500, 1);
      this.previewRoot.add(bg);
      this.previewSprites.push(bg);
    }

    // Chão circular mascarado
    if (floorKey) {
      const floor = this.scene.add
        .tileSprite(0, 0, arenaR * 2, arenaR * 2, floorKey)
        .setOrigin(0.5);
      this.previewRoot.add(floor);
      this.previewSprites.push(floor);

      const maskGfx = this.scene.add.graphics();
      maskGfx.setPosition(this.previewRoot.x, this.previewRoot.y);
      maskGfx.fillStyle(0xffffff, 1);
      maskGfx.fillCircle(0, 0, arenaR);
      maskGfx.setVisible(false);
      floor.setMask(maskGfx.createGeometryMask());
      this._floorMaskGfx = maskGfx;
    } else {
      const disc = this.scene.add.circle(0, 0, arenaR, entry.color ?? 0xa08060, 1);
      this.previewRoot.add(disc);
      this.previewSprites.push(disc);
    }

    // Obstáculos temáticos (layout determinístico por id)
    this._spawnFloorPreviewProps(entry, arenaR);

    // Anel de ferro no perímetro
    this._spawnFloorPreviewIronRim(arenaR);

    // Parede de energia por cima do chão (VFX de magia fica acima via spellFx)
    if (this.stageGfx) this.previewRoot.bringToTop(this.stageGfx);
    if (this.spellFx?.effectGraphics) {
      this.previewRoot.bringToTop(this.spellFx.effectGraphics);
    }
    this.previewTimers.push(
      this.scene.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          if (!this.open || this._previewPlatformId !== entry.id) return;
          this._drawFloorPreviewFireWall(arenaR);
        },
      })
    );
    this._drawFloorPreviewFireWall(arenaR);
  }

  _hashStr(s) {
    let h = 0;
    const str = String(s);
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  _rockTextureVariants() {
    return {
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
  }

  _treeTextureVariants() {
    return {
      pine: ['tree_pine_0', 'tree_pine_1'],
      oak: ['tree_oak_0', 'tree_oak_1'],
      bush: ['tree_bush_0', 'tree_bush_1'],
      mangrove: ['tree_mangrove_0', 'tree_mangrove_1'],
      swamp_oak: ['tree_swamp_oak_0', 'tree_swamp_oak_1'],
      swamp_bush: ['tree_swamp_bush_0', 'tree_swamp_bush_1'],
    };
  }

  _spawnFloorPreviewProps(entry, arenaR) {
    const variants = this._rockTextureVariants();
    const obstacles = entry.obstacles || [];
    if (!obstacles.length) return;

    const seed = this._hashStr(entry.id);
    const count = 5;
    const placed = [];
    let attempts = 0;

    while (placed.length < count && attempts < 40) {
      attempts += 1;
      const h = (seed + attempts * 2654435761) >>> 0;
      const def = obstacles[h % obstacles.length];
      const ang = ((h >>> 8) % 360) * (Math.PI / 180);
      const minR = 22;
      const maxR = arenaR - def.radius * 0.45 - 10;
      const dist = minR + ((h >>> 16) % 1000) / 1000 * Math.max(0, maxR - minR);
      const x = Math.cos(ang) * dist;
      const y = Math.sin(ang) * dist;

      let overlaps = false;
      for (const p of placed) {
        if (Math.hypot(x - p.x, y - p.y) < p.radius + def.radius * 0.45 + 6) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      const list = variants[def.type] || variants.rock;
      const key = list[h % list.length];
      if (!this.scene.textures.exists(key)) continue;

      const isPuddle = def.type.startsWith('puddle');
      const isTall =
        def.type.includes('tall') ||
        def.type === 'boulder' ||
        def.type === 'ice_boulder' ||
        def.type === 'cabinet' ||
        def.type === 'statue' ||
        def.type === 'crystal_large' ||
        def.type === 'obsidian' ||
        def.type === 'clam';
      const scale = (isTall ? 0.72 : def.radius >= 18 ? 0.62 : 0.52) * (0.92 + ((h >>> 4) % 20) / 100);
      const img = this.scene.add
        .image(x, y, key)
        .setOrigin(0.5, isPuddle ? 0.5 : 0.7)
        .setScale(scale)
        .setFlipX((h & 1) === 1)
        .setRotation(isPuddle ? (((h >>> 3) % 9) - 4) * 0.04 : (((h >>> 3) % 11) - 5) * 0.02);
      this.previewRoot.add(img);
      this.previewSprites.push(img);
      placed.push({ x, y, radius: def.radius * 0.45 });
    }

    // Árvores em biomas florestais
    const trees = entry.trees || [];
    if (!trees.length) return;
    const treeVariants = this._treeTextureVariants();
    const treeCount = 3;
    let tAttempts = 0;
    while (placed.length < count + treeCount && tAttempts < 30) {
      tAttempts += 1;
      const h = (seed + 9000 + tAttempts * 2246822519) >>> 0;
      const def = trees[h % trees.length];
      const ang = ((h >>> 7) % 360) * (Math.PI / 180);
      const dist = 28 + ((h >>> 15) % 1000) / 1000 * (arenaR - 36);
      const x = Math.cos(ang) * dist;
      const y = Math.sin(ang) * dist;
      let overlaps = false;
      for (const p of placed) {
        if (Math.hypot(x - p.x, y - p.y) < p.radius + 12) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      const list = treeVariants[def.type] || treeVariants.oak;
      const key = list[h % list.length];
      if (!this.scene.textures.exists(key)) continue;

      const scale =
        (def.type.includes('oak') ? 0.78 : def.type.includes('pine') || def.type.includes('mangrove') ? 0.72 : 0.62) *
        (0.9 + ((h >>> 5) % 20) / 100);
      const pad = this.scene.add.ellipse(x, y + 2, 18, 8, 0x101808, 0.5);
      const img = this.scene.add
        .image(x, y, key)
        .setOrigin(0.5, 0.9)
        .setScale(scale)
        .setFlipX((h & 1) === 1);
      this.previewRoot.add(pad);
      this.previewRoot.add(img);
      this.previewSprites.push(pad, img);
      placed.push({ x, y, radius: 12 });
    }
  }

  _spawnFloorPreviewIronRim(arenaR) {
    if (!this.scene.textures.exists('iron_block')) return;
    const scale = 0.42;
    const rimInset = 6;
    const r = Math.max(8, arenaR - rimInset);
    const spacing = 32 * scale * 0.92;
    const count = Math.max(14, Math.floor((Math.PI * 2 * r) / spacing));

    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const sprite = this.scene.add
        .image(Math.cos(ang) * r, Math.sin(ang) * r, 'iron_block')
        .setOrigin(0.5)
        .setScale(scale)
        .setRotation(ang + Math.PI / 2);
      this.previewRoot.add(sprite);
      this.previewSprites.push(sprite);
    }
  }

  _drawFloorPreviewFireWall(arenaR) {
    const g = this.stageGfx;
    if (!g) return;
    g.clear();

    const t = this.scene.time.now;
    const pulse = 0.78 + 0.22 * Math.sin(t / 420);
    const flicker = 0.82 + 0.18 * Math.sin(t / 360 + 1.1);
    const spin = t * 0.00012;
    const r = arenaR;

    g.lineStyle(10, 0x1a0840, 0.12 * flicker);
    g.strokeCircle(0, 0, r + 3);
    g.lineStyle(7, 0x3a1878, 0.14 * pulse);
    g.strokeCircle(0, 0, r + 1);
    g.lineStyle(5, 0x5a3098, 0.18 * flicker);
    g.strokeCircle(0, 0, r);
    g.lineStyle(3, 0x3a6a88, 0.2 * pulse);
    g.strokeCircle(0, 0, r - 1);
    g.lineStyle(1.2, 0x88aacc, 0.28 * flicker);
    g.strokeCircle(0, 0, r - 2);

    const arcs = 4;
    for (let k = 0; k < arcs; k++) {
      const start = spin * (k % 2 === 0 ? 1 : -1) + (k / arcs) * Math.PI * 2;
      const sweep = 0.45 + 0.1 * Math.sin(t * 0.0025 + k);
      g.lineStyle(1.8, k % 2 === 0 ? 0x7a48b0 : 0x4a88a8, 0.22 * pulse);
      g.beginPath();
      g.arc(0, 0, r + 2, start, start + sweep, false);
      g.strokePath();
    }

    const tongues = 18;
    for (let i = 0; i < tongues; i++) {
      const ang = (i / tongues) * Math.PI * 2 + spin * 0.25;
      const wobble = 0.7 + 0.3 * Math.sin(t * 0.004 + i * 2.1);
      const height = (4 + (i % 4) * 1.0 + 2.5 * Math.sin(t * 0.003 + i * 1.4)) * wobble;
      const x0 = Math.cos(ang) * (r - 1);
      const y0 = Math.sin(ang) * (r - 1);
      const x1 = Math.cos(ang) * (r + height);
      const y1 = Math.sin(ang) * (r + height);
      g.lineStyle(2.4, 0x3a1878, 0.16 * wobble);
      g.lineBetween(x0, y0, x1, y1);
      g.lineStyle(1.3, 0x3a6a88, 0.22 * wobble);
      g.lineBetween(x0, y0, Math.cos(ang) * (r + height * 0.55), Math.sin(ang) * (r + height * 0.55));
    }
  }

  _playMonsterPreview(entry) {
    this._clearPreview();
    if (!this.previewRoot) return;

    const tex = this._monsterTexture(entry.id);
    const frame = this.scene.textures.get(tex)?.get();
    const tw = Math.max(1, frame?.width || 32);
    const th = Math.max(1, frame?.height || 32);
    const scale =
      Math.min(
        (PREVIEW_W - MONSTER_PREVIEW_PAD_X * 2) / tw,
        (PREVIEW_H - MONSTER_PREVIEW_PAD_Y * 2) / th
      ) * MONSTER_PREVIEW_FILL;

    const displayH = th * scale;
    const spriteY = 4;
    const feetY = spriteY + displayH * 0.5 - 2;
    // Sombra leve no chão para ancorar o sprite ampliado.
    const shadow = this.scene.add.ellipse(
      0,
      feetY,
      tw * scale * 0.7,
      Math.max(10, displayH * 0.08),
      0x000000,
      0.35
    );
    const sprite = this.scene.add.sprite(0, spriteY, tex).setScale(scale);
    this.previewRoot.add(shadow);
    this.previewRoot.add(sprite);
    this.previewSprites.push(shadow, sprite);

    const idleKey = `monster_${entry.id}_idle`;
    const walkKey = `monster_${entry.id}_walk`;
    if (this.scene.anims.exists(idleKey)) {
      sprite.play(idleKey);
    } else if (this.scene.anims.exists(walkKey)) {
      sprite.play(walkKey);
    }
  }

  _playSpellPreview(entry) {
    this._clearPreview();
    if (!this.previewRoot) return;

    const wizardScale = 1.5;
    const from = { x: -40, y: 12 };
    const to = { x: 70, y: 12 };

    const char = ensureCharacter();
    const tex = ensureWizardColorTexture(this.scene, char.color, char.skin);
    const wizard = this.scene.add.sprite(from.x, from.y, tex).setScale(wizardScale);
    this.previewRoot.add(wizard);
    this.previewSprites.push(wizard);
    wizard.setData('baseScale', wizardScale);
    wizard.setData('baseY', from.y);
    wizard.setFlipX(to.x < from.x);

    const walkKey = `${tex}_walk`;
    if (this.scene.anims.exists(walkKey)) wizard.play(walkKey);

    if (this.spellFx?.effectGraphics) {
      this.previewRoot.bringToTop(this.spellFx.effectGraphics);
    }

    const cast = () => {
      if (!this.open || this.selectedSpellId !== entry.id || !wizard.active) return;
      this._castGalleryWizardSpell(entry, wizard, from, to);
    };
    this.previewTimers.push(this.scene.time.delayedCall(450, cast));
    this.previewTimers.push(
      this.scene.time.addEvent({
        delay: 10000,
        loop: true,
        callback: cast,
      })
    );
  }

  /** Windup do mago + VFX da magia selecionada. */
  _castGalleryWizardSpell(entry, wizard, from, to) {
    if (!wizard?.active || !this.previewRoot) return;

    const baseScale = wizard.getData('baseScale') ?? wizard.scaleX;
    const baseY = wizard.getData('baseY') ?? from.y;

    this.scene.tweens.killTweensOf(wizard);
    wizard.setPosition(from.x, baseY).setScale(baseScale);
    wizard.setTint(entry.color ?? 0xffffff);

    this.scene.tweens.add({
      targets: wizard,
      scaleX: baseScale * 1.18,
      scaleY: baseScale * 1.18,
      y: baseY - Math.max(4, baseScale * 3),
      duration: 220,
      yoyo: true,
      ease: 'Back.easeOut',
      onYoyo: () => {
        if (!wizard.active) return;
        this._burstAt(from.x, baseY - 8, this._fxKindForSpell(entry.id), 10);
        this._animateSpellCast(entry.id, from.x, from.y, to.x, to.y, entry.color);
      },
      onComplete: () => {
        if (!wizard.active) return;
        wizard.clearTint();
        wizard.setScale(baseScale);
        wizard.y = baseY;
      },
    });
  }

  /** VFX completo do jogo (fade começa em 100%), com projétil quando necessário. */
  _animateSpellCast(spellId, x1, y1, x2, y2, color) {
    if (!this.spellFx) {
      this._burstAt(x2, y2, this._fxKindForSpell(spellId), 14);
      return;
    }

    const result = this.spellFx.play(spellId, color, { x: x1, y: y1 }, { x: x2, y: y2 });
    if (!result.needsProjectile) return;

    if (spellId === 'tiro_de_buscape') {
      this._animateBuscapeRockets(x1, y1, x2, y2, color);
      return;
    }

    const projKey = this._projectileTexture(spellId);
    const proj = this.scene.add.image(x1, y1, projKey).setScale(1.45);
    if (!this.scene.textures.exists(projKey) || projKey === 'orb') {
      proj.setTint(color ?? 0xffffff);
    }
    this.previewRoot.add(proj);
    this.previewSprites.push(proj);
    if (this.spellFx?.effectGraphics) {
      this.previewRoot.bringToTop(this.spellFx.effectGraphics);
    }

    this.scene.tweens.add({
      targets: proj,
      x: x2,
      y: y2,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.spellFx?.playImpact(spellId, color, x2, y2, 28);
        proj.destroy();
      },
    });
  }

  /** Três foguetes em leque pé de galinha (\|/) — voam e explodem no fim. */
  _animateBuscapeRockets(x1, y1, x2, y2, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const spread = (28 * Math.PI) / 180;
    const angles = [-spread, 0, spread];
    const projKey = this._projectileTexture('tiro_de_buscape');

    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rdx = dirX * c - dirY * s;
      const rdy = dirX * s + dirY * c;
      const tx = x1 + rdx * dist;
      const ty = y1 + rdy * dist;
      const proj = this.scene.add.image(x1, y1, projKey).setScale(1.35);
      if (!this.scene.textures.exists(projKey) || projKey === 'orb') {
        proj.setTint(color ?? 0xff6622);
      }
      proj.setRotation(Math.atan2(rdy, rdx) + Math.PI / 2);
      this.previewRoot.add(proj);
      this.previewSprites.push(proj);

      let lastTrail = 0;
      this.scene.tweens.add({
        targets: proj,
        x: tx,
        y: ty,
        duration: 420,
        ease: 'Quad.easeIn',
        delay: i * 25,
        onUpdate: () => {
          const now = this.scene.time.now;
          if (now - lastTrail < 28) return;
          lastTrail = now;
          const bx = proj.x - rdx * 8;
          const by = proj.y - rdy * 8;
          this.spellFx?.fireballFx?.emitParticleAt(bx, by, 2);
        },
        onComplete: () => {
          this.spellFx?.playImpact('tiro_de_buscape', color, tx, ty, 30);
          proj.destroy();
        },
      });
    }
    if (this.spellFx?.effectGraphics) {
      this.previewRoot.bringToTop(this.spellFx.effectGraphics);
    }
  }

  _createFx() {
    this._destroyFx();
    const depth = 10002;
    const make = (tint, opts = {}) =>
      this.scene.add
        .particles(0, 0, 'particle', {
          tint,
          speed: { min: 20, max: 90 },
          scale: { start: 1.4, end: 0 },
          alpha: { start: 0.95, end: 0 },
          lifespan: { min: 180, max: 420 },
          gravityY: opts.gravityY ?? -30,
          frequency: -1,
          emitting: false,
          blendMode: 'ADD',
          ...opts,
        })
        .setDepth(depth);

    this.fx = {
      fire: make([0xff2200, 0xff4a00, 0xff8800, 0xffcc33]),
      ice: make([0xffffff, 0xc8f0ff, 0x66ccff], { gravityY: 18 }),
      spark: make([0xffee88, 0xffffff, 0xaaddff]),
      necro: make([0x4a0080, 0xaa66ff, 0x220044]),
      heal: make([0x55ff88, 0xaaffcc, 0xffffff]),
      poison: make([0x88ff44, 0x44aa22, 0xccff88]),
      magic: make([0xaa88ff, 0x88aaff, 0xffffff]),
    };

    // Mantém emitters no container do modal (coords mundo via _burstAt)
    for (const emitter of Object.values(this.fx)) {
      this.container.add(emitter);
    }
  }

  _destroyFx() {
    for (const emitter of Object.values(this.fx)) {
      emitter?.destroy?.();
    }
    this.fx = {};
  }

  /** Burst em coordenadas locais do previewRoot. */
  _burstAt(localX, localY, kind, count = 12) {
    const map = {
      fire: this.fx.fire,
      ice: this.fx.ice,
      spark: this.fx.spark,
      necro: this.fx.necro,
      heal: this.fx.heal,
      poison: this.fx.poison,
      magic: this.fx.magic,
    };
    const emitter = map[kind] || this.fx.spark;
    const ox = this.previewRoot?.x ?? 0;
    const oy = this.previewRoot?.y ?? 0;
    emitter?.emitParticleAt(ox + localX, oy + localY, count);
  }

  _fxKindForSpell(spellId) {
    if (
      spellId === 'firebolt' ||
      spellId === 'flame_nova' ||
      spellId === 'firebreath' ||
      spellId === 'tiro_de_buscape' ||
      spellId === 'apocalypse' ||
      spellId === 'infernal_judgment'
    ) {
      return 'fire';
    }
    if (
      spellId === 'ice_shard' ||
      spellId === 'water_orb' ||
      spellId === 'time_freeze' ||
      spellId === 'frost_apocalypse'
    ) {
      return 'ice';
    }
    if (
      spellId === 'skull_bolt' ||
      spellId === 'skull_wave' ||
      spellId === 'soul_rend' ||
      spellId === 'death_knell' ||
      spellId === 'shadow_eclipse' ||
      spellId === 'void_collapse' ||
      spellId === 'abyss_nova'
    ) {
      return 'necro';
    }
    if (spellId === 'mend') return 'heal';
    if (
      spellId === 'poison_cloud' ||
      spellId === 'plague_burst' ||
      spellId === 'vine_spike'
    ) {
      return 'poison';
    }
    if (
      spellId === 'arc_lightning' ||
      spellId === 'storm_call' ||
      spellId === 'electric_bolt' ||
      spellId === 'electric_storm'
    ) {
      return 'spark';
    }
    return 'magic';
  }

  _monsterTexture(type) {
    const key = `monster_${type}`;
    return this.scene.textures.exists(key) ? key : 'monster';
  }

  _projectileTexture(kind) {
    if (kind === 'arrow' && this.scene.textures.exists('proj_arrow')) return 'proj_arrow';
    if (
      (kind === 'fireball' || kind === 'firebolt') &&
      this.scene.textures.exists('proj_fireball')
    ) {
      return 'proj_fireball';
    }
    if (kind === 'ice_shard' && this.scene.textures.exists('proj_ice_shard')) {
      return 'proj_ice_shard';
    }
    if (
      (kind === 'skull_bolt' || kind === 'skull_wave') &&
      this.scene.textures.exists('proj_skull_bolt')
    ) {
      return 'proj_skull_bolt';
    }
    if (
      (kind === 'rocket' || kind === 'tiro_de_buscape') &&
      this.scene.textures.exists('proj_rocket')
    ) {
      return 'proj_rocket';
    }
    if (this.scene.textures.exists('orb')) return 'orb';
    return 'particle';
  }

  _clearPreview() {
    for (const t of this.previewTimers) {
      t?.remove?.(false);
      t?.destroy?.();
    }
    this.previewTimers = [];
    for (const s of this.previewSprites) {
      if (s?.clearMask) s.clearMask(false);
      s?.destroy?.();
    }
    this.previewSprites = [];
    if (this._floorMaskGfx) {
      this._floorMaskGfx.destroy();
      this._floorMaskGfx = null;
    }
    if (this.stageGfx) this.stageGfx.clear();
    this.spellFx?.clear();
    this._previewPlatformId = null;
    // Limpar tweens do previewRoot (sem destruir emitters/graphics do spellFx)
    if (this.previewRoot) {
      const skip = new Set();
      if (this.stageGfx) skip.add(this.stageGfx);
      if (this.spellFx?.effectGraphics) skip.add(this.spellFx.effectGraphics);
      for (const child of this.previewRoot.list) {
        if (!skip.has(child)) this.scene.tweens.killTweensOf(child);
      }
    }
  }

  _destroyListDom() {
    if (this.listDom) {
      this.listDom.destroy();
      this.listDom = null;
    }
    this.listScrollEl = null;
    this.searchInputEl = null;
    this.tierTabEls = [];
  }

  _capitalize(name) {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
