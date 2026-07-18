import Phaser from 'phaser';
import {
  getMonsterEntries,
  getSpellEntries,
  spellDisplayName,
} from '../catalog/galleryCatalog.js';

const FONT = 'Trebuchet MS, sans-serif';
const PANEL_W = 760;
const PANEL_H = 520;

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
    this.selectedMonsterId = null;
    this.selectedSpellId = null;

    this.container = scene.add.container(0, 0).setDepth(400).setVisible(false);
    this.listDom = null;
    this.previewRoot = null;
    this.previewSprites = [];
    this.previewTimers = [];
    this.fx = {};
    this.tabTexts = [];
    this.infoTitle = null;
    this.infoBody = null;
    this.stageGfx = null;

    this.monsters = getMonsterEntries();
    this.spells = getSpellEntries();
  }

  isOpen() {
    return this.open;
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.onOpen?.();

    const { width, height } = this.scene.scale;
    this.container.removeAll(true);
    this._destroyListDom();
    this._clearPreview();
    this.container.setDepth(10000).setVisible(true);
    this.scene.children.bringToTop(this.container);

    const dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.hide());

    const panel = this.scene.add
      .rectangle(width / 2, height / 2, PANEL_W, PANEL_H, 0x161228, 0.98)
      .setStrokeStyle(2, 0x6b5cff)
      .setInteractive();

    const title = this.scene.add
      .text(width / 2, height / 2 - PANEL_H / 2 + 28, 'Galeria', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    this.tabTexts = [];
    const tabY = height / 2 - PANEL_H / 2 + 62;
    const tabs = [
      { id: 'monsters', label: 'Monstros' },
      { id: 'spells', label: 'Magias' },
    ];
    let tabX = width / 2 - 70;
    for (const t of tabs) {
      const text = this.scene.add
        .text(tabX, tabY, t.label, {
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
      .rectangle(width / 2 - 210, height / 2 + 10, 280, 340, 0x0e0a1a, 0.95)
      .setStrokeStyle(1, 0x6b5cff, 0.35);

    const previewBg = this.scene.add
      .rectangle(width / 2 + 150, height / 2 - 40, 340, 220, 0x0a0814, 0.95)
      .setStrokeStyle(1, 0x6b5cff, 0.35);

    this.infoTitle = this.scene.add
      .text(width / 2 + 150, height / 2 + 95, '', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#e8dfff',
        align: 'center',
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5, 0);

    this.infoBody = this.scene.add
      .text(width / 2 + 150, height / 2 + 125, '', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#a99bc8',
        align: 'center',
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5, 0);

    const closeBg = this.scene.add
      .rectangle(width / 2, height / 2 + PANEL_H / 2 - 36, 140, 40, 0x6b5cff, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const closeLabel = this.scene.add
      .text(width / 2, height / 2 + PANEL_H / 2 - 36, 'Fechar', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerover', () => closeBg.setScale(1.04));
    closeBg.on('pointerout', () => closeBg.setScale(1));
    closeBg.on('pointerup', () => this.hide());

    this.previewRoot = this.scene.add.container(width / 2 + 150, height / 2 - 40);
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
    this.onClose?.();
  }

  destroy() {
    this.hide();
    this.container.destroy(true);
  }

  _setTab(tab, force = false) {
    if (!force && this.tab === tab) return;
    this.tab = tab;
    for (const t of this.tabTexts) {
      t.text.setColor(t.id === tab ? '#e8dfff' : '#7a6e96');
    }
    this._rebuildList();
    if (tab === 'monsters') {
      const first = this.selectedMonsterId
        ? this.monsters.find((m) => m.id === this.selectedMonsterId)
        : this.monsters[0];
      if (first) this._selectMonster(first.id);
    } else {
      const first = this.selectedSpellId
        ? this.spells.find((s) => s.id === this.selectedSpellId)
        : this.spells[0];
      if (first) this._selectSpell(first.id);
    }
  }

  _rebuildList() {
    this._destroyListDom();
    const { width, height } = this.scene.scale;
    const el = document.createElement('div');
    el.style.cssText = [
      'width: 260px',
      'height: 320px',
      'overflow-y: auto',
      'overflow-x: hidden',
      'box-sizing: border-box',
      'padding: 4px 0',
      'font-family: Trebuchet MS, sans-serif',
      'font-size: 13px',
      'color: #eee6ff',
      'background: transparent',
      'scrollbar-width: thin',
      'scrollbar-color: #6b5cff #1a1430',
      'user-select: none',
    ].join(';');

    const entries = this.tab === 'monsters' ? this.monsters : this.spells;
    const selectedId = this.tab === 'monsters' ? this.selectedMonsterId : this.selectedSpellId;

    for (const entry of entries) {
      const row = document.createElement('div');
      const active = entry.id === selectedId;
      row.dataset.id = entry.id;
      row.style.cssText = [
        'padding: 7px 10px',
        'margin: 2px 6px',
        'border-radius: 6px',
        'cursor: pointer',
        `background: ${active ? 'rgba(107,92,255,0.35)' : 'transparent'}`,
        `color: ${active ? '#ffffff' : '#c4b5e0'}`,
        'display: flex',
        'justify-content: space-between',
        'align-items: center',
        'gap: 8px',
      ].join(';');

      const name = document.createElement('span');
      name.textContent = this._capitalize(entry.name);
      name.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

      const badge = document.createElement('span');
      badge.textContent =
        this.tab === 'monsters' ? entry.difficultyLabel : entry.typeLabel;
      badge.style.cssText = [
        'font-size: 11px',
        'color: #9a8bb8',
        'flex-shrink: 0',
      ].join(';');

      row.appendChild(name);
      row.appendChild(badge);
      row.addEventListener('mouseenter', () => {
        if (row.dataset.id !== (this.tab === 'monsters' ? this.selectedMonsterId : this.selectedSpellId)) {
          row.style.background = 'rgba(107,92,255,0.15)';
        }
      });
      row.addEventListener('mouseleave', () => {
        const sel = this.tab === 'monsters' ? this.selectedMonsterId : this.selectedSpellId;
        row.style.background =
          row.dataset.id === sel ? 'rgba(107,92,255,0.35)' : 'transparent';
      });
      row.addEventListener('click', () => {
        if (this.tab === 'monsters') this._selectMonster(entry.id);
        else this._selectSpell(entry.id);
      });
      el.appendChild(row);
    }

    this.listDom = this.scene.add
      .dom(width / 2 - 210, height / 2 + 10, el)
      .setOrigin(0.5)
      .setDepth(10001);
  }

  _highlightListSelection() {
    if (!this.listDom?.node) return;
    const selectedId = this.tab === 'monsters' ? this.selectedMonsterId : this.selectedSpellId;
    for (const row of this.listDom.node.children) {
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

    const spellNames = entry.spells.map((s) => spellDisplayName(s)).join(', ');
    const details = [
      `Tipo: ${entry.difficultyLabel}`,
      `Ataque: ${entry.attackLabel}`,
    ];
    if (entry.projectile) details.push(`Projétil: ${entry.projectile}`);
    if (spellNames) details.push(`Magias: ${spellNames}`);

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

    // caster — cicla pelas magias (ou firebolt como fallback)
    const spells = entry.spells.length ? entry.spells : ['firebolt'];
    const idx = (sprite.getData('spellIdx') || 0) % spells.length;
    sprite.setData('spellIdx', idx + 1);
    const spellId = spells[idx];
    this._animateSpellCast(spellId, sprite.x + 16, sprite.y, dummy.x, dummy.y);
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
  }

  _capitalize(name) {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
