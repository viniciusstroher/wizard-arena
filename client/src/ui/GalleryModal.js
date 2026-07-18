import Phaser from 'phaser';
import {
  getMonsterEntries,
  getSpellEntries,
  spellDisplayName,
  spellColor,
} from '../catalog/galleryCatalog.js';

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

const FONT = 'Trebuchet MS, sans-serif';
const PANEL_W = 760;
const PANEL_H = 540;
const LIST_W = 280;
const LIST_PAD = 10;
const LIST_INNER_W = LIST_W - LIST_PAD * 2;
const PREVIEW_W = 340;
const PREVIEW_H = 200;

/**
 * Modal da galeria no lobby: abas Monstros / Magias com lista + preview animado.
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
    this.searchQuery = '';
    this.selectedMonsterId = null;
    this.selectedSpellId = null;

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
    this.infoBody = null;
    this.stageGfx = null;

    this.monsters = getMonsterEntries();
    this.spells = getSpellEntries();
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

  show() {
    if (this.open) return;
    this.open = true;
    this.onOpen?.();

    // Recarrega o catálogo atual (nomes/ícones/defs).
    this.monsters = getMonsterEntries();
    this.spells = getSpellEntries();

    const { width, height } = this.scene.scale;
    const L = this._computeLayout();
    this.layout = L;

    this.container.removeAll(true);
    this._destroyListDom();
    this._clearPreview();
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
      { id: 'monsters', label: 'Monstros' },
      { id: 'spells', label: 'Magias' },
    ];
    let tabX = L.cx - 70;
    for (const t of tabs) {
      const text = this.scene.add
        .text(tabX, L.tabY, t.label, {
          fontFamily: FONT,
          fontSize: '16px',
          color: '#7a6e96',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      text.on('pointerup', () => this._setTab(t.id));
      this.tabTexts.push({ id: t.id, text });
      tabX += 140;
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

    this.infoBody = this.scene.add
      .text(L.previewX, L.infoTop + 28, '', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#a99bc8',
        align: 'center',
        wordWrap: { width: L.infoWrapW },
      })
      .setOrigin(0.5, 0);

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

    this.container.add([
      dim,
      panel,
      title,
      ...this.tabTexts.map((t) => t.text),
      listBg,
      previewBg,
      this.previewRoot,
      this.infoTitle,
      this.infoBody,
      closeBg,
      closeLabel,
    ]);

    this._createFx();
    this._setTab(this.tab, true);
  }

  hide() {
    if (!this.open && !this.listDom) return;
    this.open = false;
    if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = true;
    this._clearPreview();
    this._destroyFx();
    this._destroyListDom();
    this.container.removeAll(true);
    this.container.setVisible(false);
    this.previewRoot = null;
    this.infoTitle = null;
    this.infoBody = null;
    this.stageGfx = null;
    this.tabTexts = [];
    this.tierTabEls = [];
    this.listScrollEl = null;
    this.searchInputEl = null;
    this.layout = null;
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
  }

  _setMonsterTier(tier) {
    if (this.monsterTier === tier) return;
    this.monsterTier = tier;
    this._syncFilterTabs();
    this._fillListContent();
    this._selectDefaultForCurrentView();
  }

  _setSpellCategory(category) {
    if (this.spellCategory === category) return;
    this.spellCategory = category;
    this._syncFilterTabs();
    this._fillListContent();
    this._selectDefaultForCurrentView();
  }

  _selectDefaultForCurrentView() {
    if (this.tab === 'monsters') {
      const filtered = this._filteredMonsters();
      const keep = filtered.find((m) => m.id === this.selectedMonsterId);
      if (keep) {
        this._highlightListSelection();
        return;
      }
      const first = filtered[0];
      if (first) {
        this._selectMonster(first.id);
        return;
      }
      this.selectedMonsterId = null;
      this._clearPreview();
      if (this.infoTitle) this.infoTitle.setText('');
      if (this.infoBody) this.infoBody.setText('Nenhum monstro encontrado.');
      return;
    }

    const filtered = this._filteredSpells();
    const keep = filtered.find((s) => s.id === this.selectedSpellId);
    if (keep) {
      this._highlightListSelection();
      return;
    }
    const first = filtered[0];
    if (first) {
      this._selectSpell(first.id);
      return;
    }
    this.selectedSpellId = null;
    this._clearPreview();
    if (this.infoTitle) this.infoTitle.setText('');
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

  _rebuildList() {
    this._destroyListDom();
    const L = this.layout || this._computeLayout();
    this.layout = L;

    const innerH = L.listH - LIST_PAD * 2;
    // filter tabs(30) + gap(8) + search(32) + gap(8)
    const chromeH = 78;
    const scrollH = Math.max(80, innerH - chromeH);
    const sections = this.tab === 'monsters' ? TIER_SECTIONS : SPELL_SECTIONS;
    const activeId = this.tab === 'monsters' ? this.monsterTier : this.spellCategory;
    const searchPlaceholder =
      this.tab === 'monsters' ? 'Procurar monstro...' : 'Procurar magia...';

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
      btn.textContent = section.label;
      btn.style.cssText = this._filterTabStyle(section.id === activeId, section.color);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.tab === 'monsters') this._setMonsterTier(section.id);
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
    const sections = this.tab === 'monsters' ? TIER_SECTIONS : SPELL_SECTIONS;
    const activeId = this.tab === 'monsters' ? this.monsterTier : this.spellCategory;
    for (const btn of this.tierTabEls) {
      const section = sections.find((s) => s.id === btn.dataset.filter);
      if (!section) continue;
      btn.style.cssText = this._filterTabStyle(section.id === activeId, section.color);
    }
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
    const selectedId = tab === 'monsters' ? this.selectedMonsterId : this.selectedSpellId;
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

    const name = document.createElement('span');
    name.textContent = this._capitalize(entry.name);
    name.style.cssText = [
      'overflow: hidden',
      'text-overflow: ellipsis',
      'white-space: nowrap',
      'min-width: 0',
      'flex: 1',
    ].join(';');

    const badge = document.createElement('span');
    badge.textContent = tab === 'monsters' ? entry.attackLabel : entry.typeLabel;
    badge.style.cssText = 'font-size: 11px; color: #9a8bb8; flex-shrink: 0;';

    top.appendChild(name);
    top.appendChild(badge);
    row.appendChild(top);

    if (tab === 'monsters' && entry.spellNames?.length) {
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

    row.addEventListener('mouseenter', () => {
      const sel = tab === 'monsters' ? this.selectedMonsterId : this.selectedSpellId;
      if (row.dataset.id !== sel) row.style.background = 'rgba(107,92,255,0.15)';
    });
    row.addEventListener('mouseleave', () => {
      const sel = tab === 'monsters' ? this.selectedMonsterId : this.selectedSpellId;
      row.style.background =
        row.dataset.id === sel ? 'rgba(107,92,255,0.35)' : 'transparent';
    });
    row.addEventListener('click', () => {
      if (tab === 'monsters') this._selectMonster(entry.id);
      else this._selectSpell(entry.id);
    });
    return row;
  }

  _highlightListSelection() {
    const root = this.listScrollEl || this.listDom?.node;
    if (!root) return;
    const selectedId = this.tab === 'monsters' ? this.selectedMonsterId : this.selectedSpellId;
    for (const row of root.children) {
      if (!row.dataset?.id) continue;
      const active = row.dataset.id === selectedId;
      row.style.background = active ? 'rgba(107,92,255,0.35)' : 'transparent';
      row.style.color = active ? '#ffffff' : '#c4b5e0';
    }
  }

  _selectMonster(id) {
    const entry = this.monsters.find((m) => m.id === id);
    if (!entry) return;
    this.selectedMonsterId = id;
    this._highlightListSelection();

    const details = [
      `Tipo: ${entry.tierLabel}`,
      `Ataque: ${entry.attackLabel}`,
    ];
    if (entry.projectile) details.push(`Projétil: ${entry.projectile}`);
    if (entry.spellNames?.length) {
      details.push(`Magias: ${entry.spellNames.join(', ')}`);
    } else if (entry.attack === 'caster') {
      details.push('Magias: —');
    }

    if (this.infoTitle) this.infoTitle.setText(this._capitalize(entry.name));
    if (this.infoBody) this.infoBody.setText(details.join('\n'));

    this._playMonsterPreview(entry);
  }

  _selectSpell(id) {
    const entry = this.spells.find((s) => s.id === id);
    if (!entry) return;
    this.selectedSpellId = id;
    this._highlightListSelection();

    if (this.infoTitle) this.infoTitle.setText(entry.name);
    if (this.infoBody) {
      this.infoBody.setText(`${entry.typeLabel}\n${entry.description}`);
    }
    this._playSpellPreview(entry);
  }

  _playMonsterPreview(entry) {
    this._clearPreview();
    if (!this.previewRoot) return;

    const tex = this._monsterTexture(entry.id);
    const sprite = this.scene.add.sprite(0, 10, tex).setScale(3.2);
    this.previewRoot.add(sprite);
    this.previewSprites.push(sprite);

    const walkKey = `monster_${entry.id}_walk`;
    if (this.scene.anims.exists(walkKey)) {
      sprite.play(walkKey);
    }

    // Alvo visual para ataques
    const dummy = this.scene.add.circle(110, 10, 8, 0x884444, 0.85);
    this.previewRoot.add(dummy);
    this.previewSprites.push(dummy);

    this._scheduleAttackLoop(entry, sprite, dummy);
  }

  _scheduleAttackLoop(entry, sprite, dummy) {
    const fire = () => {
      if (!this.open || this.selectedMonsterId !== entry.id) return;
      this._runMonsterAttack(entry, sprite, dummy);
    };
    // Primeiro ataque após um curto delay; depois a cada ~2.2s
    this.previewTimers.push(this.scene.time.delayedCall(600, fire));
    this.previewTimers.push(
      this.scene.time.addEvent({
        delay: 2200,
        loop: true,
        callback: fire,
      })
    );
  }

  _runMonsterAttack(entry, sprite, dummy) {
    if (!sprite?.active) return;

    if (entry.attack === 'melee') {
      this.scene.tweens.add({
        targets: sprite,
        x: 70,
        duration: 180,
        yoyo: true,
        ease: 'Quad.easeOut',
        onYoyo: () => {
          this._burstAt(dummy.x, dummy.y, 'spark', 10);
          dummy.setFillStyle(0xff6666, 1);
          this.scene.time.delayedCall(120, () => {
            if (dummy.active) dummy.setFillStyle(0x884444, 0.85);
          });
        },
      });
      return;
    }

    if (entry.attack === 'ranged') {
      const projKey = this._projectileTexture(entry.projectile);
      const proj = this.scene.add.image(sprite.x + 20, sprite.y, projKey).setScale(1.6);
      this.previewRoot.add(proj);
      this.previewSprites.push(proj);
      this.scene.tweens.add({
        targets: proj,
        x: dummy.x,
        y: dummy.y,
        duration: 320,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this._burstAt(dummy.x, dummy.y, this._fxKindForProjectile(entry.projectile), 12);
          proj.destroy();
        },
      });
      return;
    }

    // caster — cicla pelas magias com windup + rótulo
    const spells = entry.spells.length ? entry.spells : ['firebolt'];
    const idx = (sprite.getData('spellIdx') || 0) % spells.length;
    sprite.setData('spellIdx', idx + 1);
    const spellId = spells[idx];
    this._castMonsterSpell(entry, sprite, dummy, spellId);
  }

  /** Windup do mob + FX da magia + nome flutuante. */
  _castMonsterSpell(entry, sprite, dummy, spellId) {
    if (!sprite?.active || !this.previewRoot) return;

    const color = spellColor(spellId);
    const label = this.scene.add
      .text(sprite.x, sprite.y - 42, spellDisplayName(spellId), {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.previewRoot.add(label);
    this.previewSprites.push(label);

    const baseScale = sprite.scaleX;
    const baseY = sprite.getData('baseY') ?? sprite.y;
    sprite.setData('baseY', baseY);
    sprite.setTint(color);

    this.scene.tweens.killTweensOf(sprite);
    sprite.setPosition(sprite.x, baseY).setScale(baseScale);

    this.scene.tweens.add({
      targets: sprite,
      scaleX: baseScale * 1.18,
      scaleY: baseScale * 1.18,
      y: baseY - 6,
      duration: 220,
      yoyo: true,
      ease: 'Back.easeOut',
      onYoyo: () => {
        if (!sprite.active) return;
        this._burstAt(sprite.x, baseY - 8, this._fxKindForSpell(spellId), 10);
        this._animateSpellCast(
          spellId,
          sprite.x + 16,
          baseY,
          dummy.x,
          dummy.y,
          color
        );
        dummy.setFillStyle(0xff6666, 1);
        this.scene.time.delayedCall(160, () => {
          if (dummy.active) dummy.setFillStyle(0x884444, 0.85);
        });
      },
      onComplete: () => {
        if (sprite.active) {
          sprite.clearTint();
          sprite.setScale(baseScale);
          sprite.y = baseY;
        }
      },
    });

    this.scene.tweens.add({
      targets: label,
      alpha: 1,
      y: label.y - 10,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          alpha: 0,
          y: label.y - 8,
          delay: 500,
          duration: 280,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  _playSpellPreview(entry) {
    this._clearPreview();
    if (!this.previewRoot) return;

    const iconKey = `spell_${entry.id}`;
    if (this.scene.textures.exists(iconKey)) {
      const icon = this.scene.add.image(0, -20, iconKey).setScale(2.4);
      this.previewRoot.add(icon);
      this.previewSprites.push(icon);
      this.scene.tweens.add({
        targets: icon,
        scale: 2.7,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      const orb = this.scene.add.circle(0, -20, 22, entry.color, 0.95);
      this.previewRoot.add(orb);
      this.previewSprites.push(orb);
    }

    const cast = () => {
      if (!this.open || this.selectedSpellId !== entry.id) return;
      this._animateSpellCast(entry.id, -90, 40, 100, 40, entry.color);
    };
    this.previewTimers.push(this.scene.time.delayedCall(400, cast));
    this.previewTimers.push(
      this.scene.time.addEvent({
        delay: 1800,
        loop: true,
        callback: cast,
      })
    );
  }

  _animateSpellCast(spellId, x1, y1, x2, y2, color) {
    const kind = this._fxKindForSpell(spellId);

    // Magias de área / novae: anel expandindo
    if (
      spellId === 'flame_nova' ||
      spellId === 'poison_cloud' ||
      spellId === 'abyss_nova' ||
      spellId === 'void_collapse' ||
      spellId === 'frost_apocalypse' ||
      spellId === 'plague_burst' ||
      spellId === 'shadow_eclipse' ||
      spellId === 'apocalypse' ||
      spellId === 'time_freeze' ||
      spellId === 'barrier'
    ) {
      const ring = this.scene.add.circle(0, 30, 8, color ?? 0xffffff, 0.15);
      ring.setStrokeStyle(2, color ?? 0xffffff, 0.9);
      this.previewRoot.add(ring);
      this.previewSprites.push(ring);
      this.scene.tweens.add({
        targets: ring,
        scale: 4.5,
        alpha: 0,
        duration: 700,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
      this._burstAt(0, 30, kind, 16);
      return;
    }

    // Raios / cadeia
    if (
      spellId === 'arc_lightning' ||
      spellId === 'storm_call' ||
      spellId === 'electric_bolt' ||
      spellId === 'electric_storm' ||
      spellId === 'infernal_judgment'
    ) {
      if (this.stageGfx) {
        this.stageGfx.clear();
        this.stageGfx.lineStyle(2, color ?? 0xaadfff, 0.95);
        this.stageGfx.beginPath();
        this.stageGfx.moveTo(x1, y1 - 50);
        this.stageGfx.lineTo(x2, y2);
        this.stageGfx.strokePath();
        this.scene.time.delayedCall(180, () => {
          if (this.stageGfx) this.stageGfx.clear();
        });
      }
      this._burstAt(x2, y2, 'spark', 18);
      return;
    }

    // Blink / heal — partículas no local
    if (spellId === 'blink' || spellId === 'mend' || spellId === 'dash') {
      this._burstAt(0, 20, kind, 16);
      return;
    }

    // Projétil padrão
    const projKey = this._projectileTexture(spellId);
    const proj = this.scene.add.image(x1, y1, projKey).setScale(1.5);
    if (!this.scene.textures.exists(projKey) || projKey === 'orb') {
      proj.setTint(color ?? 0xffffff);
    }
    this.previewRoot.add(proj);
    this.previewSprites.push(proj);
    this.scene.tweens.add({
      targets: proj,
      x: x2,
      y: y2,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this._burstAt(x2, y2, kind, 14);
        proj.destroy();
      },
    });
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
      spellId === 'apocalypse' ||
      spellId === 'infernal_judgment'
    ) {
      return 'fire';
    }
    if (
      spellId === 'ice_shard' ||
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
    if (spellId === 'poison_cloud' || spellId === 'plague_burst') return 'poison';
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

  _fxKindForProjectile(kind) {
    if (kind === 'fireball' || kind === 'firebolt') return 'fire';
    if (kind === 'ice_shard') return 'ice';
    if (kind === 'skull_bolt') return 'necro';
    return 'spark';
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
      s?.destroy?.();
    }
    this.previewSprites = [];
    if (this.stageGfx) this.stageGfx.clear();
    // Limpar tweens do previewRoot
    if (this.previewRoot) {
      this.scene.tweens.killTweensOf(this.previewRoot.list);
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
