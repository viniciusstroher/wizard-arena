import Phaser from 'phaser';
import {
  deleteCharacter,
  ensureCharacter,
  saveCharacter,
  saveInventory,
  WIZARD_COLORS,
} from '../character.js';
import { fetchCharacterMatches } from '../api.js';
import {
  BAG_COLS,
  BAG_SIZE,
  EQUIP_SLOTS,
  equipFromBag,
  isEquippable,
  itemTooltipLines,
  normalizeInventory,
  unequipToBag,
  canEquipItem,
} from '../inventory.js';
import { ensureItemIconTextures, itemIconKey } from '../itemIcons.js';
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
  getSkin,
  normalizeSkinId,
  updateWizardPreviewTexture,
} from '../wizardSkin.js';
import { SkinPickerModal } from '../ui/SkinPickerModal.js';
import { elementLabel } from '../catalog/elements.js';
import {
  levelFromPoints,
  levelColor,
  rankTitle,
} from '../characterLevel.js';
import {
  ensureRankIconTextures,
  rankIconKeyForLevel,
} from '../rankIcons.js';

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

const TAB_INFO = 'info';
const TAB_INVENTORY = 'inventory';

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super('Character');
  }

  create() {
    this.character = ensureCharacter();
    this.inventory = normalizeInventory(this.character.inventory);
    this.totalPoints = 0;
    this.characterLevel = 1;
    this.selectedColor = this.character.color >>> 0;
    this.selectedSkin = normalizeSkinId(this.character.skin);
    this.errorText = null;
    this.activeTab = TAB_INFO;
    this.infoNodes = [];
    this.invNodes = [];
    this.equipSlotViews = {};
    this.bagSlotViews = [];
    this.dragSource = null;
    this.dragGhost = null;

    drawMenuBackground(this, { subtitle: 'Personagem' });
    createAmbientCreatures(this);
    ensureMenuMusic(this);

    const { width, height } = this.scale;
    const uiDepth = 10;

    this.buildTabs(width / 2, 148, uiDepth);
    this.buildInfoTab(uiDepth);
    this.buildInventoryTab(uiDepth);
    this.setTab(TAB_INFO);

    this.events.once('shutdown', () => {
      this.hideItemTooltip();
      this.skinModal?.destroy();
      this.skinModal = null;
      this.destroyDeletePrompt();
      this.nameInput?.destroy();
      this.nameInput = null;
      this.historyDom?.destroy();
      this.historyDom = null;
      destroyAmbientCreatures(this);
    });
  }

  trackInfo(...nodes) {
    for (const n of nodes) {
      if (n) this.infoNodes.push(n);
    }
  }

  trackInv(...nodes) {
    for (const n of nodes) {
      if (n) this.invNodes.push(n);
    }
  }

  buildTabs(centerX, y, depth) {
    const tabs = [
      { id: TAB_INFO, label: 'Info', x: centerX - 70 },
      { id: TAB_INVENTORY, label: 'Inventário', x: centerX + 70 },
    ];
    this.tabButtons = [];

    for (const tab of tabs) {
      const bg = this.add
        .rectangle(tab.x, y, 120, 34, 0x1a1430, 0.95)
        .setStrokeStyle(2, 0x6b5cff, 0.7)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });

      const label = this.add
        .text(tab.x, y, tab.label, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '15px',
          color: '#c4b5e0',
        })
        .setOrigin(0.5)
        .setDepth(depth + 1);

      const activate = () => this.setTab(tab.id);
      bg.on('pointerup', activate);
      bg.on('pointerover', () => {
        if (this.activeTab !== tab.id) bg.setStrokeStyle(2, 0x8b7cff, 1);
      });
      bg.on('pointerout', () => this.refreshTabStyles());

      this.tabButtons.push({ id: tab.id, bg, label });
    }
  }

  refreshTabStyles() {
    for (const tab of this.tabButtons || []) {
      const active = tab.id === this.activeTab;
      tab.bg.setFillStyle(active ? 0x2a2250 : 0x1a1430, 0.95);
      tab.bg.setStrokeStyle(2, active ? 0x8b7cff : 0x6b5cff, active ? 1 : 0.7);
      tab.label.setColor(active ? '#f4e8ff' : '#c4b5e0');
    }
  }

  setTab(tabId) {
    this.activeTab = tabId;
    const showInfo = tabId === TAB_INFO;
    const showInv = tabId === TAB_INVENTORY;

    for (const n of this.infoNodes) n.setVisible?.(showInfo);
    for (const n of this.invNodes) n.setVisible?.(showInv);

    this.nameInput?.setVisible(showInfo && !this.skinModal?.isOpen?.());
    this.historyDom?.setVisible(showInfo && !this.skinModal?.isOpen?.());

    if (!showInv) this.hideItemTooltip();
    this.refreshTabStyles();

    if (showInv) {
      this.refreshAllEquipSlots?.();
      this.refreshAllBagSlots?.();
      this.loadInventoryCurrency();
    }
  }

  buildLevelDisplay(centerX, y, depth) {
    ensureRankIconTextures(this);

    this.levelIcon = this.add
      .image(centerX - 58, y, rankIconKeyForLevel(1))
      .setDisplaySize(36, 36)
      .setDepth(depth);
    this.trackInfo(this.levelIcon);

    this.levelBadgeText = this.add
      .text(centerX - 58, y, '1', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f4e8ff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.trackInfo(this.levelBadgeText);

    this.levelRankText = this.add
      .text(centerX - 32, y - 8, 'Aprendiz Arcano', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#c4b5e0',
      })
      .setOrigin(0, 0.5)
      .setDepth(depth);
    this.trackInfo(this.levelRankText);

    this.levelPtsText = this.add
      .text(centerX - 32, y + 6, 'PTS 0 / 50', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '10px',
        color: '#7a6e96',
      })
      .setOrigin(0, 0.5)
      .setDepth(depth);
    this.trackInfo(this.levelPtsText);

    this.levelBarBg = this.add
      .rectangle(centerX + 62, y + 10, 120, 7, 0x161228, 0.9)
      .setStrokeStyle(1, 0x4a3d78, 0.8)
      .setDepth(depth)
      .setOrigin(0.5, 0.5);
    this.trackInfo(this.levelBarBg);

    this.levelBarFill = this.add
      .rectangle(centerX + 2, y + 10, 0, 5, 0x6b5cff, 1)
      .setDepth(depth + 1)
      .setOrigin(0, 0.5);
    this.trackInfo(this.levelBarFill);

    this.refreshLevelDisplay();
  }

  refreshLevelDisplay() {
    const info = levelFromPoints(this.totalPoints);
    this.characterLevel = info.level;
    const color = levelColor(info.level);
    const iconKey = rankIconKeyForLevel(info.level);

    if (this.levelBadgeText) {
      this.levelBadgeText.setText(String(info.level));
    }
    if (this.levelIcon) {
      this.levelIcon.setTexture(iconKey).setTint(color);
    }
    if (this.levelRankText) {
      this.levelRankText.setText(rankTitle(info.level));
    }
    if (this.levelPtsText) {
      const ptsIntoLevel = Math.max(0, this.totalPoints - info.currentPts);
      this.levelPtsText.setText(`PTS ${ptsIntoLevel} / ${info.nextPts - info.currentPts}`);
    }
    if (this.levelBarFill && this.levelBarBg) {
      const barW = 116;
      this.levelBarFill.setSize(barW * info.progress, 5);
      this.levelBarFill.setFillStyle(color, 1);
    }
  }

  buildInfoTab(depth) {
    const { width, height } = this.scale;
    const editorX = width * 0.32;
    const historyX = width * 0.72;

    const previewKey = updateWizardPreviewTexture(this, this.selectedColor, this.selectedSkin);
    this.preview = this.add
      .sprite(editorX, height / 2 - 200, previewKey)
      .setScale(4)
      .setDepth(depth);
    this.trackInfo(this.preview);

    this.tweens.add({
      targets: this.preview,
      y: this.preview.y - 8,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.buildLevelDisplay(editorX, height / 2 - 161, depth);

    const skinLabel = this.add
      .text(editorX, height / 2 - 135, 'Classe / skin', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(skinLabel);

    this.buildSkinOpener(editorX, height / 2 - 88, depth);

    this.skinModal = new SkinPickerModal(this, {
      getColor: () => this.selectedColor,
      getSelectedSkin: () => this.selectedSkin,
      onSelect: (skinId) => this.selectSkin(skinId),
      onOpen: () => {
        this.nameInput?.setVisible(false);
        this.historyDom?.setVisible(false);
      },
      onClose: () => {
        if (this.activeTab === TAB_INFO) {
          this.nameInput?.setVisible(true);
          this.historyDom?.setVisible(true);
        }
      },
    });

    const nameLabel = this.add
      .text(editorX, height / 2 - 25, 'Nome', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(nameLabel);

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.maxLength = 16;
    inputEl.value = this.character.name;
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;
    inputEl.placeholder = 'Digite seu nome';
    styleDomInput(inputEl);
    this.nameInput = this.add.dom(editorX, height / 2 + 15, inputEl).setOrigin(0.5).setDepth(depth);

    this.idText = this.add
      .text(editorX, height / 2 + 54, `ID: ${this.character.id}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#6b6088',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(this.idText);

    this.createdText = this.add
      .text(editorX, height / 2 + 70, `Criado: ${formatDate(this.character.createdAt)}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#6b6088',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(this.createdText);

    const colorLabel = this.add
      .text(editorX, height / 2 + 96, 'Cor do bruxo', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(colorLabel);

    this.buildPalette(editorX, height / 2 + 150, depth);

    this.errorText = this.add
      .text(editorX, height / 2 + 225, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#ff6b6b',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(this.errorText);

    const btnY = height / 2 + 280;
    const backBtn = makeMenuButton(this, editorX - 120, btnY, 'Voltar', 0x443866, () => {
      navigate('/');
    }, 130).setDepth(depth);
    const saveBtn = makeMenuButton(this, editorX + 20, btnY, 'Salvar', 0x2ecc71, () => {
      this.save();
    }, 130).setDepth(depth);
    const delBtn = makeMenuButton(this, editorX + 160, btnY, 'Deletar', 0xc0392b, () => {
      this.confirmDeleteProfile();
    }, 130).setDepth(depth);
    this.trackInfo(backBtn, saveBtn, delBtn);

    this.buildHistoryPanel(historyX, height / 2 + 50, depth);
  }

  buildInventoryTab(depth) {
    const { width, height } = this.scale;
    const cx = width / 2;
    ensureItemIconTextures(this);

    this.invGoldText = this.add
      .text(cx - 90, 172, `Gold: ${this.inventory.gold}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '17px',
        color: '#ffd76a',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInv(this.invGoldText);

    this.invLootText = this.add
      .text(cx + 90, 172, `Loot: ${this.inventory.loot}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '17px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInv(this.invLootText);

    this.invHintText = this.add
      .text(cx, 196, 'Clique no saco para equipar · clique 2× no equipamento para remover', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#6b6088',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInv(this.invHintText);

    this.equipClickKey = null;
    this.equipClickAt = 0;

    const equipX = width * 0.24;
    const bagX = width * 0.64;

    const equipTitle = this.add
      .text(equipX, 224, 'Equipamento', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInv(equipTitle);

    this.buildEquipmentSlots(equipX, 270, depth);

    const bagTitle = this.add
      .text(bagX, 224, 'Saco (12×12)', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInv(bagTitle);

    this.buildBagGrid(bagX, 248, depth);
    this.buildItemTooltip(depth + 50);

    const backBtn = makeMenuButton(this, cx, height - 36, 'Voltar', 0x443866, () => {
      navigate('/');
    }, 140).setDepth(depth);
    this.trackInv(backBtn);
  }

  buildItemTooltip(depth) {
    const bg = this.add
      .rectangle(0, 0, 200, 84, 0x120e22, 0.96)
      .setStrokeStyle(2, 0x8b7cff, 0.95)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setVisible(false);

    const text = this.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#f4e8ff',
        lineSpacing: 4,
      })
      .setDepth(depth + 1)
      .setVisible(false);

    this.itemTooltip = { bg, text };
    // Tooltip fica acima das abas; não entra em invNodes para não sumir no hover
  }

  showItemTooltip(item, x, y) {
    if (!this.itemTooltip || !item) return;
    const lines = itemTooltipLines(item, this.characterLevel);
    const { bg, text } = this.itemTooltip;
    text.setText(lines.join('\n')).setVisible(true);

    const padX = 12;
    const padY = 10;
    const w = Math.max(160, text.width + padX * 2);
    const h = text.height + padY * 2;
    bg.setSize(w, h).setVisible(true);

    const { width, height } = this.scale;
    let tx = x + 16;
    let ty = y + 16;
    if (tx + w > width - 8) tx = x - w - 12;
    if (ty + h > height - 8) ty = y - h - 12;
    tx = Math.max(8, tx);
    ty = Math.max(8, ty);

    bg.setPosition(tx, ty);
    text.setPosition(tx + padX, ty + padY);
  }

  hideItemTooltip() {
    if (!this.itemTooltip) return;
    this.itemTooltip.bg.setVisible(false);
    this.itemTooltip.text.setVisible(false);
  }

  buildEquipmentSlots(centerX, topY, depth) {
    const slotSize = 64;
    const gapX = 14;
    const gapY = 28;
    const cols = 3;
    const totalW = cols * slotSize + (cols - 1) * gapX;
    const startX = centerX - totalW / 2 + slotSize / 2;
    const startY = topY + slotSize / 2;

    this.equipSlotViews = {};
    EQUIP_SLOTS.forEach((slot, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (slotSize + gapX);
      const y = startY + row * (slotSize + gapY);

      const frame = this.add
        .rectangle(x, y, slotSize, slotSize, 0x161228, 0.95)
        .setStrokeStyle(2, 0x4a3d78, 0.95)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });

      const icon = this.add
        .image(x, y - 2, itemIconKey('cloth_hat'))
        .setDisplaySize(44, 44)
        .setDepth(depth + 1)
        .setVisible(false);

      const label = this.add
        .text(x, y + slotSize / 2 + 12, slot.label, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '12px',
          color: '#9a8bb8',
        })
        .setOrigin(0.5)
        .setDepth(depth);

      frame.on('pointerup', () => this.onEquipSlotClick(slot.key));
      frame.on('pointerover', (pointer) => {
        frame.setStrokeStyle(2, 0x8b7cff, 1);
        const item = this.inventory.equipment[slot.key];
        if (item) this.showItemTooltip(item, pointer.worldX, pointer.worldY);
      });
      frame.on('pointermove', (pointer) => {
        const item = this.inventory.equipment[slot.key];
        if (item) this.showItemTooltip(item, pointer.worldX, pointer.worldY);
      });
      frame.on('pointerout', () => {
        this.refreshEquipSlot(slot.key);
        this.hideItemTooltip();
      });

      this.equipSlotViews[slot.key] = { frame, icon, label, accepts: slot.accepts };
      this.trackInv(frame, icon, label);
    });

    this.refreshAllEquipSlots();
  }

  buildBagGrid(centerX, topY, depth) {
    const slotSize = 32;
    const gap = 3;
    const totalW = BAG_COLS * slotSize + (BAG_COLS - 1) * gap;
    const startX = centerX - totalW / 2 + slotSize / 2;
    const startY = topY + slotSize / 2;

    this.bagSlotViews = [];
    this.bagSlotCoords = []; // { x, y } para hit-test do drop
    for (let i = 0; i < BAG_SIZE; i++) {
      const col = i % BAG_COLS;
      const row = Math.floor(i / BAG_COLS);
      const x = startX + col * (slotSize + gap);
      const y = startY + row * (slotSize + gap);

      this.bagSlotCoords[i] = { x, y, w: slotSize, h: slotSize };

      const frame = this.add
        .rectangle(x, y, slotSize, slotSize, 0x12101c, 0.92)
        .setStrokeStyle(1, 0x3a2f66, 0.9)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true, draggable: true });

      const icon = this.add
        .image(x, y, itemIconKey('cloth_hat'))
        .setDisplaySize(26, 26)
        .setDepth(depth + 1)
        .setVisible(false);

      const qtyText = this.add
        .text(x + 12, y + 9, '', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(1, 0.5)
        .setDepth(depth + 2)
        .setVisible(false);

      const slotIdx = i;

      frame.on('pointerdown', (pointer) => {
        const stack = this.inventory.bag[slotIdx];
        if (!stack || !stack.item) return;
        if (this.activeTab !== TAB_INVENTORY) return;
        // Inicia drag
        this.dragSource = slotIdx;
        this.dragGhost = this.add.image(pointer.x, pointer.y, itemIconKey(stack.item.id))
          .setDisplaySize(32, 32)
          .setDepth(100)
          .setAlpha(0.85);
        this.hideItemTooltip();
      });

      frame.on('pointerup', (pointer) => {
        if (this.dragSource == null || this.activeTab !== TAB_INVENTORY) {
          // Click normal (sem drag)
          this.onBagSlotClick(slotIdx);
          return;
        }

        // Drop: encontra slot alvo sob o pointer
        const targetIdx = this.bagSlotAtPoint(pointer.x, pointer.y);
        this.cleanupDrag();

        if (targetIdx != null && targetIdx !== this.dragSource) {
          this.swapBagSlots(this.dragSource, targetIdx);
        } else if (targetIdx === this.dragSource) {
          // Soltou no mesmo lugar — click normal
          this.onBagSlotClick(slotIdx);
        }
        this.dragSource = null;
      });

      frame.on('pointermove', (pointer) => {
        if (this.dragSource != null && this.dragGhost) {
          this.dragGhost.setPosition(pointer.x, pointer.y);
          return;
        }
        const stack = this.inventory.bag[slotIdx];
        const item = stack?.item || null;
        if (item) this.showItemTooltip(item, pointer.worldX, pointer.worldY);
      });

      frame.on('pointerover', (pointer) => {
        if (this.dragSource != null) return;
        frame.setStrokeStyle(1, 0x8b7cff, 1);
        const stack = this.inventory.bag[slotIdx];
        const item = stack?.item || null;
        if (item) this.showItemTooltip(item, pointer.worldX, pointer.worldY);
      });
      frame.on('pointerout', () => {
        if (this.dragSource != null) return;
        this.refreshBagSlot(slotIdx);
        this.hideItemTooltip();
      });

      this.bagSlotViews.push({ frame, icon, qtyText });
      this.trackInv(frame, icon, qtyText);
    }

    this.refreshAllBagSlots();
  }

  /** Retorna o índice do slot do saco sob as coordenadas da tela, ou null. */
  bagSlotAtPoint(px, py) {
    for (let i = 0; i < this.bagSlotCoords.length; i++) {
      const r = this.bagSlotCoords[i];
      const halfW = r.w / 2 + 1;
      const halfH = r.h / 2 + 1;
      if (px >= r.x - halfW && px <= r.x + halfW && py >= r.y - halfH && py <= r.y + halfH) {
        return i;
      }
    }
    return null;
  }

  /** Destroi o ghost do drag e reseta estado. */
  cleanupDrag() {
    if (this.dragGhost) {
      this.dragGhost.destroy();
      this.dragGhost = null;
    }
  }

  /** Troca dois slots do saco e persiste. */
  swapBagSlots(a, b) {
    const bag = this.inventory.bag;
    const tmp = bag[a];
    bag[a] = bag[b];
    bag[b] = tmp;
    this.persistInventory();
    this.refreshBagSlot(a);
    this.refreshBagSlot(b);
  }

  refreshEquipSlot(key) {
    const view = this.equipSlotViews[key];
    if (!view) return;
    const item = this.inventory.equipment[key];
    if (item) {
      view.frame.setStrokeStyle(2, 0x6b5cff, 1);
      const keyTex = itemIconKey(item.id);
      if (this.textures.exists(keyTex)) {
        view.icon.setTexture(keyTex).setDisplaySize(44, 44).setVisible(true);
      } else {
        view.icon.setVisible(false);
      }
    } else {
      view.frame.setStrokeStyle(2, 0x4a3d78, 0.95);
      view.icon.setVisible(false);
    }
  }

  refreshAllEquipSlots() {
    for (const { key } of EQUIP_SLOTS) this.refreshEquipSlot(key);
  }

  refreshBagSlot(index) {
    const view = this.bagSlotViews[index];
    if (!view) return;
    const stack = this.inventory.bag[index];
    if (stack && stack.item) {
      view.frame.setStrokeStyle(1, 0x6b5cff, 0.95);
      view.frame.setFillStyle(0x1e1840, 0.95);
      const keyTex = itemIconKey(stack.item.id);
      if (this.textures.exists(keyTex)) {
        view.icon.setTexture(keyTex).setDisplaySize(26, 26).setVisible(true);
      } else {
        view.icon.setVisible(false);
      }
      if (stack.qty > 1 && view.qtyText) {
        view.qtyText.setText(String(stack.qty)).setVisible(true);
      } else if (view.qtyText) {
        view.qtyText.setVisible(false);
      }
    } else {
      view.frame.setStrokeStyle(1, 0x3a2f66, 0.9);
      view.frame.setFillStyle(0x12101c, 0.92);
      view.icon.setVisible(false);
      if (view.qtyText) view.qtyText.setVisible(false);
    }
  }

  refreshAllBagSlots() {
    for (let i = 0; i < BAG_SIZE; i++) this.refreshBagSlot(i);
  }

  refreshCurrencyTexts() {
    this.invGoldText?.setText(`Gold: ${this.inventory.gold}`);
    this.invLootText?.setText(`Loot: ${this.inventory.loot}`);
  }

  persistInventory() {
    const result = saveInventory(this.inventory);
    if (result.ok) {
      this.character = result.character;
      this.inventory = normalizeInventory(result.character.inventory);
    }
    return result;
  }

  onBagSlotClick(index) {
    if (this.activeTab !== TAB_INVENTORY) return;
    const stack = this.inventory.bag[index];
    if (!stack || !stack.item) {
      this.equipClickKey = null;
      return;
    }
    if (!isEquippable(stack.item)) {
      this.invHintText?.setText('Este item não pode ser equipado.').setColor('#ff6b6b');
      this.time.delayedCall(1800, () => this.resetInvHint());
      return;
    }
    const result = equipFromBag(this.inventory, index, this.characterLevel);
    if (!result.ok) {
      this.invHintText?.setText(result.error).setColor('#ff6b6b');
      this.time.delayedCall(1800, () => this.resetInvHint());
      return;
    }
    this.inventory = result.inventory;
    this.persistInventory();
    this.refreshAllEquipSlots();
    this.refreshAllBagSlots();
    this.invHintText?.setText('Item equipado').setColor('#2ecc71');
    this.time.delayedCall(1400, () => this.resetInvHint());
  }

  resetInvHint() {
    this.invHintText
      ?.setText('Clique no saco para equipar · clique 2× no equipamento para remover')
      .setColor('#6b6088');
  }

  onEquipSlotClick(key) {
    if (this.activeTab !== TAB_INVENTORY) return;
    if (!this.inventory.equipment[key]) {
      this.equipClickKey = null;
      return;
    }

    const now = this.time.now;
    const isDouble =
      this.equipClickKey === key && now - this.equipClickAt < 400;

    this.equipClickKey = key;
    this.equipClickAt = now;

    if (!isDouble) {
      this.invHintText?.setText('Clique novamente para desequipar').setColor('#c4b5e0');
      this.time.delayedCall(400, () => {
        if (this.equipClickKey === key && this.time.now - this.equipClickAt >= 400) {
          this.resetInvHint();
        }
      });
      return;
    }

    this.equipClickKey = null;
    const result = unequipToBag(this.inventory, key);
    if (!result.ok) {
      this.invHintText?.setText(result.error).setColor('#ff6b6b');
      this.time.delayedCall(2200, () => this.resetInvHint());
      return;
    }
    this.inventory = result.inventory;
    this.persistInventory();
    this.refreshAllEquipSlots();
    this.refreshAllBagSlots();
    this.invHintText?.setText('Item desequipado').setColor('#2ecc71');
    this.time.delayedCall(1400, () => this.resetInvHint());
  }

  async loadInventoryCurrency() {
    try {
      const data = await fetchCharacterMatches(this.character.id, { limit: 1 });
      const gold = Number(data.totalGold) || 0;
      const loot = Number(data.totalLoot) || 0;
      if (gold !== this.inventory.gold || loot !== this.inventory.loot) {
        this.inventory = normalizeInventory({
          ...this.inventory,
          gold,
          loot,
        });
        this.persistInventory();
      }
      this.refreshCurrencyTexts();
    } catch {
      this.refreshCurrencyTexts();
    }
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
    const histTitle = this.add
      .text(x, y - 256, 'Histórico de partidas', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(histTitle);

    this.historyLootText = this.add
      .text(x - 110, y - 232, 'Loot: —', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(this.historyLootText);

    this.historyPointsText = this.add
      .text(x, y - 232, 'Pontos: —', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#f4e8ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(this.historyPointsText);

    this.historyGoldText = this.add
      .text(x + 110, y - 232, 'Gold: —', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffd76a',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(this.historyGoldText);

    this.historyStatus = this.add
      .text(x, y - 208, 'Carregando...', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.trackInfo(this.historyStatus);

    const listEl = document.createElement('div');
    listEl.style.cssText = [
      'width: 460px',
      'height: 380px',
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
    this.historyDom = this.add.dom(x, y + 26, listEl).setOrigin(0.5).setDepth(depth);
    this.loadHistory();
  }

  async loadHistory() {
    if (!this.historyEl) return;
    this.historyEl.innerHTML = '';
    this.historyLootText?.setText('Loot: —');
    this.historyPointsText?.setText('Pontos: —');
    this.historyGoldText?.setText('Gold: —');
    this.historyStatus?.setText('Carregando...').setColor('#9a8bb8');
    try {
      const data = await fetchCharacterMatches(this.character.id, { limit: 40 });
      const matches = data.matches || [];
      const totalLoot = Number(data.totalLoot) || 0;
      const totalGold = Number(data.totalGold) || 0;
      const totalPoints = Number(data.totalPoints) || 0;
      this.historyLootText?.setText(`Loot: ${totalLoot}`);
      this.historyPointsText?.setText(`Pontos: ${totalPoints}`);
      this.historyGoldText?.setText(`Gold: ${totalGold}`);

      if (totalPoints !== this.totalPoints) {
        this.totalPoints = totalPoints;
        this.refreshLevelDisplay();
      }

      // Mantém inventário alinhado ao total acumulado nas partidas
      if (
        totalGold !== this.inventory.gold ||
        totalLoot !== this.inventory.loot
      ) {
        this.inventory = normalizeInventory({
          ...this.inventory,
          gold: totalGold,
          loot: totalLoot,
        });
        this.persistInventory();
        this.refreshCurrencyTexts();
      }

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
        const roundLabel = m.round > 0 ? `Round ${m.round}` : 'Partida';
        result.textContent = roundLabel;
        result.style.cssText = 'font-size: 13px; font-weight: 700; color: #c4b5e0;';

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
        stats.textContent = `${elementLabel(m.wizardType)} · ${m.points ?? 0} pts · ${m.kills ?? 0}K / ${m.deaths ?? 0}D · ${m.damageDealt ?? 0} dano · ${m.loot ?? 0} loot · ${m.gold ?? 0} gold`;
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

  buildSkinOpener(centerX, y, depth) {
    const skin = getSkin(this.selectedSkin);
    const key = updateWizardPreviewTexture(
      this,
      this.selectedColor,
      this.selectedSkin,
      'wizard_skin_opener'
    );

    const frame = this.add
      .rectangle(centerX, y, 200, 78, 0x1a1430, 0.9)
      .setStrokeStyle(2, 0x6b5cff, 0.85)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true });

    const sprite = this.add
      .sprite(centerX - 62, y - 2, key)
      .setScale(1.55)
      .setDepth(depth + 1);

    const name = this.add
      .text(centerX + 18, y - 12, skin.name, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    const hint = this.add
      .text(centerX + 18, y + 12, 'Clique para trocar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#9a8bb8',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    const open = () => this.skinModal?.show();
    frame.on('pointerup', open);
    frame.on('pointerover', () => frame.setStrokeStyle(2, 0x8b7cff, 1));
    frame.on('pointerout', () => frame.setStrokeStyle(2, 0x6b5cff, 0.85));
    sprite.setInteractive({ useHandCursor: true }).on('pointerup', open);

    this.preview.setInteractive({ useHandCursor: true }).on('pointerup', open);

    this.skinOpener = { frame, sprite, name, hint };
    this.trackInfo(frame, sprite, name, hint);
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
      this.trackInfo(swatch);
    });
  }

  refreshPreviews() {
    updateWizardPreviewTexture(this, this.selectedColor, this.selectedSkin);
    this.preview.setTexture('wizard_preview');

    if (this.skinOpener) {
      const key = updateWizardPreviewTexture(
        this,
        this.selectedColor,
        this.selectedSkin,
        'wizard_skin_opener'
      );
      this.skinOpener.sprite.setTexture(key);
      const skin = getSkin(this.selectedSkin);
      this.skinOpener.name.setText(skin.name);
    }
  }

  selectSkin(skinId) {
    this.selectedSkin = normalizeSkinId(skinId);
    this.refreshPreviews();
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
      createdAt: this.character.createdAt,
      inventory: this.inventory,
    });
    if (!result.ok) {
      this.errorText.setText(result.error);
      this.nameInput?.node?.focus();
      return;
    }
    this.character = result.character;
    this.inventory = normalizeInventory(result.character.inventory);
    this.errorText.setText('');
    navigate('/');
  }

  update(_time, delta) {
    updateMenuFlames(this);
    updateAmbientCreatures(this, delta);
  }
}
