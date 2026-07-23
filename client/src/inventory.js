/** Inventário do personagem: equipamento + grade 12×12 com agrupamento por item. */

import { buildGeneratedItems } from './itemData.js';

export const BAG_COLS = 12;
export const BAG_ROWS = 12;
export const BAG_SIZE = BAG_COLS * BAG_ROWS;

/** v6: level requirement nos itens + novos tipos de bônus. */
export const STARTER_KIT_VERSION = 6;

/** Slots de equipamento. */
export const EQUIP_SLOTS = [
  { key: 'hat', label: 'Chapéu', accepts: 'hat' },
  { key: 'necklace', label: 'Colar', accepts: 'necklace' },
  { key: 'ring1', label: 'Anel', accepts: 'ring' },
  { key: 'tunic', label: 'Túnica', accepts: 'tunic' },
  { key: 'cape', label: 'Capa', accepts: 'cape' },
  { key: 'boots', label: 'Botas', accepts: 'boots' },
];

export const SET_LABELS = {
  conjunto_de_pano: 'Conjunto de Pano',
  conjunto_de_couro: 'Conjunto de Couro',
  conjunto_de_bronze: 'Conjunto de Bronze',
  conjunto_de_ferro: 'Conjunto de Ferro',
  conjunto_de_prata: 'Conjunto de Prata',
  conjunto_de_ouro: 'Conjunto de Ouro',
  conjunto_de_cristal: 'Conjunto de Cristal',
  conjunto_de_safira: 'Conjunto de Safira',
  conjunto_de_mitril: 'Conjunto de Mitril',
  conjunto_divino: 'Conjunto Divino',
};

export const CATEGORY_LABELS = {
  equipment: 'Equipamento',
  ore: 'Minério',
  other: 'Outro',
};

/** Rótulos dos bônus para tooltips. */
export const BONUS_LABELS = {
  cooldownReduction: 'Recarga das magias',
  damageBonus: 'Dano mágico',
  healBonus: 'Cura',
  shieldBonus: 'Força do escudo',
  speedBonus: 'Velocidade',
  rangeBonus: 'Alcance das magias',
  radiusBonus: 'Raio das magias',
  slowResist: 'Resistência a lentidão',
  poisonResist: 'Resistência a veneno',
  burnResist: 'Resistência a queimadura',
  maxHpBonus: 'Vida máxima',
  xpBonus: 'Experiência',
};

/**
 * Itens base + 360 equipamentos gerados (60 por slot).
 *
 * Categorias:
 *   equipment — equipável (slot indica onde)
 *   ore       — minério (não equipável)
 *   other     — outros (não equipável)
 */
const BASE_ITEM_DEFS = {
  // --- Equipamentos básicos (kit inicial) ---
  cloth_hat: {
    id: 'cloth_hat',
    name: 'Chapéu de Pano',
    category: 'equipment',
    slot: 'hat',
    color: 0xc4b59a,
    set: 'conjunto_de_pano',
    level: 1,
  },
  cloth_cape: {
    id: 'cloth_cape',
    name: 'Capa de Pano',
    category: 'equipment',
    slot: 'cape',
    color: 0xb8a88a,
    set: 'conjunto_de_pano',
    level: 1,
  },
  cloth_tunic: {
    id: 'cloth_tunic',
    name: 'Túnica de Pano',
    category: 'equipment',
    slot: 'tunic',
    color: 0xa89878,
    set: 'conjunto_de_pano',
    level: 1,
    bonus: { cooldownReduction: 0.01 },
  },
  plastic_ring: {
    id: 'plastic_ring',
    name: 'Anel de Plástico',
    category: 'equipment',
    slot: 'ring',
    color: 0x7ec8e3,
    level: 1,
  },
  brass_necklace: {
    id: 'brass_necklace',
    name: 'Colar de Latão',
    category: 'equipment',
    slot: 'necklace',
    color: 0xc9a227,
    level: 1,
  },
  holey_boots: {
    id: 'holey_boots',
    name: 'Botas Furas',
    category: 'equipment',
    slot: 'boots',
    color: 0x8b6914,
    level: 1,
  },

  // --- Minérios ---
  copper_ore:    { id: 'copper_ore',    name: 'Minério de Cobre',     category: 'ore', slot: 'ore', color: 0xe87438 },
  iron_ore:      { id: 'iron_ore',      name: 'Minério de Ferro',     category: 'ore', slot: 'ore', color: 0x8c7a6b },
  silver_ore:    { id: 'silver_ore',    name: 'Minério de Prata',     category: 'ore', slot: 'ore', color: 0xc0c8d4 },
  gold_ore:      { id: 'gold_ore',      name: 'Minério de Ouro',      category: 'ore', slot: 'ore', color: 0xe8c048 },
  diamond_ore:   { id: 'diamond_ore',   name: 'Minério de Diamante',  category: 'ore', slot: 'ore', color: 0x64d8e8 },
  emerald_ore:   { id: 'emerald_ore',   name: 'Minério de Esmeralda', category: 'ore', slot: 'ore', color: 0x40c860 },
  ruby_ore:      { id: 'ruby_ore',      name: 'Minério de Rubi',      category: 'ore', slot: 'ore', color: 0xe04050 },
  sapphire_ore:  { id: 'sapphire_ore',  name: 'Minério de Safira',    category: 'ore', slot: 'ore', color: 0x3068e8 },
  quartz_ore:    { id: 'quartz_ore',    name: 'Minério de Quartzo',   category: 'ore', slot: 'ore', color: 0xe8d0e0 },
  obsidian_ore:  { id: 'obsidian_ore',  name: 'Minério de Obsidiana', category: 'ore', slot: 'ore', color: 0x301828 },
  mythril_ore:   { id: 'mythril_ore',   name: 'Minério de Mitril',    category: 'ore', slot: 'ore', color: 0x60c0d8 },
  orichalcum_ore:{ id: 'orichalcum_ore',name: 'Minério de Oricalco',  category: 'ore', slot: 'ore', color: 0xe8a030 },
  moonstone_ore: { id: 'moonstone_ore', name: 'Minério Lunar',        category: 'ore', slot: 'ore', color: 0xa0b8ff },
  sunstone_ore:  { id: 'sunstone_ore',  name: 'Minério Solar',        category: 'ore', slot: 'ore', color: 0xffcc50 },
  shadow_ore:    { id: 'shadow_ore',    name: 'Minério Sombrio',      category: 'ore', slot: 'ore', color: 0x482868 },
  crystal_ore:   { id: 'crystal_ore',   name: 'Minério Cristalino',   category: 'ore', slot: 'ore', color: 0xb0ffd8 },
  coral_ore:     { id: 'coral_ore',     name: 'Minério de Coral',     category: 'ore', slot: 'ore', color: 0xe87080 },
  amber_ore:     { id: 'amber_ore',     name: 'Minério de Âmbar',     category: 'ore', slot: 'ore', color: 0xf0a040 },
  jade_ore:      { id: 'jade_ore',      name: 'Minério de Jade',      category: 'ore', slot: 'ore', color: 0x40a870 },
  onyx_ore:      { id: 'onyx_ore',      name: 'Minério de Ônix',      category: 'ore', slot: 'ore', color: 0x202028 },

  // --- Outros (não equipáveis, colecionáveis) ---
  health_potion: { id: 'health_potion', name: 'Poção de Vida',        category: 'other', slot: 'other', color: 0xff4050 },
  mana_potion:   { id: 'mana_potion',   name: 'Poção de Mana',        category: 'other', slot: 'other', color: 0x4060ff },
  magic_scroll:  { id: 'magic_scroll',  name: 'Pergaminho Mágico',    category: 'other', slot: 'other', color: 0xf5deb3 },
  ancient_coin:  { id: 'ancient_coin',  name: 'Moeda Antiga',         category: 'other', slot: 'other', color: 0xc8a860 },
};

// Mescla itens base + 360 gerados
const GENERATED = buildGeneratedItems();
for (const [id, def] of GENERATED) {
  BASE_ITEM_DEFS[id] = def;
}

export const ITEM_DEFS = BASE_ITEM_DEFS;

/** Ordem de equipamento do kit inicial. */
const STARTER_EQUIP_PLAN = [
  { key: 'hat', id: 'cloth_hat' },
  { key: 'cape', id: 'cloth_cape' },
  { key: 'ring1', id: 'plastic_ring' },
  { key: 'tunic', id: 'cloth_tunic' },
  { key: 'necklace', id: 'brass_necklace' },
  { key: 'boots', id: 'holey_boots' },
];

const STARTER_ITEM_IDS = STARTER_EQUIP_PLAN.map((p) => p.id);

export const EQUIP_KEYS = EQUIP_SLOTS.map((s) => s.key);
/** Tipos que podem ser equipados (slots de equipamento). */
export const EQUIP_ACCEPTS = new Set(EQUIP_SLOTS.map((s) => s.accepts));
const ACCEPTS = new Set([...EQUIP_ACCEPTS, 'ore', 'other']);
export const SLOT_LABEL_BY_ACCEPTS = Object.fromEntries([
  ...EQUIP_SLOTS.map((s) => [s.accepts, s.label]),
  ['ore', 'Minério'],
  ['other', 'Outro'],
]);

/** Todas as chaves de bônus conhecidas. */
const BONUS_KEYS = [
  'cooldownReduction',
  'damageBonus',
  'healBonus',
  'shieldBonus',
  'speedBonus',
  'rangeBonus',
  'radiusBonus',
  'slowResist',
  'poisonResist',
  'burnResist',
  'maxHpBonus',
  'xpBonus',
];

function emptyEquipment() {
  const eq = {};
  for (const key of EQUIP_KEYS) eq[key] = null;
  return eq;
}

function emptyBag() {
  return Array.from({ length: BAG_SIZE }, () => null);
}

function copyBonus(bonus) {
  if (!bonus || typeof bonus !== 'object') return null;
  const out = {};
  for (const key of BONUS_KEYS) {
    if (Number.isFinite(bonus[key]) && bonus[key] !== 0) {
      out[key] = bonus[key];
    }
  }
  return Object.keys(out).length ? out : null;
}

export function createItem(defId) {
  const def = ITEM_DEFS[defId];
  if (!def) return null;
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    slot: def.slot,
    color: def.color >>> 0,
    set: def.set || null,
    level: def.level || 1,
    bonus: copyBonus(def.bonus),
  };
}

export function isEquippable(item) {
  return item && EQUIP_ACCEPTS.has(item.slot);
}

/** Verifica se o personagem tem nível suficiente para equipar o item. */
export function canEquipItem(item, characterLevel) {
  if (!item || !item.level) return true;
  if (characterLevel == null) return true; // sem info de nível, permite
  return characterLevel >= item.level;
}

export function itemTooltipLines(item, characterLevel) {
  if (!item) return [];
  const lines = [item.name];
  const catLabel = CATEGORY_LABELS[item.category] || item.category;
  const slotLabel = SLOT_LABEL_BY_ACCEPTS[item.slot] || item.slot;
  lines.push(`Tipo: ${slotLabel} (${catLabel})`);
  if (item.level && item.level > 1) {
    const meetsReq = !characterLevel || characterLevel >= item.level;
    const lvText = `Nível requerido: ${item.level}`;
    lines.push(meetsReq ? lvText : `${lvText} (você é nível ${characterLevel})`);
  }
  if (item.set && SET_LABELS[item.set]) {
    lines.push(`Conjunto: ${SET_LABELS[item.set]}`);
  }
  if (item.bonus && Object.keys(item.bonus).length > 0) {
    for (const key of BONUS_KEYS) {
      const val = item.bonus[key];
      if (!Number.isFinite(val) || val === 0) continue;
      const label = BONUS_LABELS[key] || key;
      const pct = Math.round(val * 100);
      const sign = pct > 0 ? '+' : '';
      lines.push(`${label}: ${sign}${pct}%`);
    }
  } else {
    lines.push('Sem bônus');
  }
  return lines;
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let id = String(raw.id || '').trim();
  if (id === 'plastic_ring_1') id = 'plastic_ring';
  if (id === 'plastic_ring_2') id = 'cloth_tunic';
  const def = ITEM_DEFS[id];
  if (def) {
    return {
      id: def.id,
      name: def.name,
      category: def.category,
      slot: def.slot,
      color: def.color >>> 0,
      set: def.set || null,
      level: def.level || 1,
      bonus: copyBonus(def.bonus),
    };
  }
  const name = String(raw.name || '').trim().slice(0, 32);
  const slot = String(raw.slot || '').trim();
  if (!id || !name || !ACCEPTS.has(slot)) return null;
  const color = Number(raw.color);
  const category = (def && def.category) || (slot === 'ore' ? 'ore' : EQUIP_ACCEPTS.has(slot) ? 'equipment' : 'other');
  return {
    id,
    name,
    category,
    slot,
    color: Number.isFinite(color) ? color >>> 0 : 0x6b5cff,
    set: raw.set ? String(raw.set) : null,
    level: Number.isFinite(raw.level) ? Math.max(1, Math.floor(raw.level)) : 1,
    bonus: copyBonus(raw.bonus),
  };
}

function normalizeBag(raw) {
  const bag = emptyBag();
  if (!Array.isArray(raw)) return bag;
  for (let i = 0; i < BAG_SIZE; i++) {
    const entry = raw[i];
    if (!entry) { bag[i] = null; continue; }

    // v5+ formato empilhado: { item, qty }
    if (entry.item && typeof entry.qty === 'number') {
      const item = normalizeItem(entry.item);
      const qty = Math.max(1, Math.floor(entry.qty));
      bag[i] = item ? { item, qty } : null;
      continue;
    }

    // v4- formato antigo: item direto no slot
    const item = normalizeItem(entry);
    if (item) {
      bag[i] = { item, qty: 1 };
    }
  }
  return bag;
}

function normalizeEquipment(raw) {
  const eq = emptyEquipment();
  if (!raw || typeof raw !== 'object') return eq;
  for (const { key, accepts } of EQUIP_SLOTS) {
    const item = normalizeItem(raw[key]);
    eq[key] = item && item.slot === accepts ? item : null;
  }
  return eq;
}

function findBagIndexById(bag, id) {
  for (let i = 0; i < bag.length; i++) {
    const stack = bag[i];
    if (stack?.item?.id === id) return i;
  }
  return -1;
}

/** Encontra o primeiro stack livre para empilhar o mesmo item. */
export function findStackForItemId(bag, id) {
  for (let i = 0; i < bag.length; i++) {
    const stack = bag[i];
    if (stack?.item?.id === id && stack.qty < 999) return i;
  }
  return -1;
}

function collectOwnedIds(inventory) {
  const ids = new Set();
  for (const stack of inventory.bag) {
    if (stack?.item?.id) ids.add(stack.item.id);
  }
  for (const key of EQUIP_KEYS) {
    const item = inventory.equipment[key];
    if (item?.id) ids.add(item.id);
  }
  return ids;
}

/** Adiciona um item ao saco, empilhando se possível. */
export function addItemToBag(inventory, item) {
  const inv = normalizeInventory(inventory);
  if (!item) return { ok: false, error: 'Item inválido.', inventory: inv };

  const stackIdx = findStackForItemId(inv.bag, item.id);
  if (stackIdx >= 0) {
    inv.bag[stackIdx].qty += 1;
    return { ok: true, inventory: inv, index: stackIdx };
  }

  const freeIdx = firstEmptyBagIndex(inv.bag);
  if (freeIdx < 0) {
    return { ok: false, error: 'Inventário cheio!', inventory: inv };
  }
  inv.bag[freeIdx] = { item: { ...item }, qty: 1 };
  return { ok: true, inventory: inv, index: freeIdx };
}

/** Garante o kit e deixa os itens iniciais equipados. */
export function grantStarterKit(inventory) {
  const inv = {
    equipment: normalizeEquipment(inventory?.equipment),
    bag: normalizeBag(inventory?.bag),
    gold: Math.max(0, Math.floor(Number(inventory?.gold) || 0)),
    loot: Math.max(0, Math.floor(Number(inventory?.loot) || 0)),
    starterKit: STARTER_KIT_VERSION,
  };

  const owned = collectOwnedIds(inv);

  for (const defId of STARTER_ITEM_IDS) {
    if (owned.has(defId)) continue;
    const item = createItem(defId);
    if (!item) continue;
    const result = addItemToBag(inv, item);
    if (!result.ok) break;
    inv.bag = result.inventory.bag;
    owned.add(defId);
  }

  for (const { key, id } of STARTER_EQUIP_PLAN) {
    if (inv.equipment[key]?.id === id) continue;

    const bagIdx = findBagIndexById(inv.bag, id);
    if (bagIdx >= 0) {
      const stack = inv.bag[bagIdx];
      const starter = { ...stack.item };
      const previous = inv.equipment[key];
      inv.equipment[key] = starter;
      if (stack.qty <= 1) {
        inv.bag[bagIdx] = previous ? { item: previous, qty: 1 } : null;
      } else {
        stack.qty -= 1;
        if (previous) {
          const result = addItemToBag(inv, previous);
          if (result.ok) inv.bag = result.inventory.bag;
          else inv.bag[bagIdx] = null;
        }
      }
      continue;
    }

    if (!inv.equipment[key]) {
      inv.equipment[key] = createItem(id);
    }
  }

  return inv;
}

export function defaultInventory() {
  return grantStarterKit({
    equipment: emptyEquipment(),
    bag: emptyBag(),
    gold: 0,
    loot: 0,
    starterKit: 0,
  });
}

function migrateLegacyRing2ToTunic(rawEquipment, inv) {
  if (!rawEquipment || typeof rawEquipment !== 'object') return;
  if (rawEquipment.ring2 == null) return;
  if (!inv.equipment.tunic) {
    const ring2 = normalizeItem(rawEquipment.ring2);
    inv.equipment.tunic =
      ring2?.slot === 'tunic' ? ring2 : createItem('cloth_tunic');
  }
}

/** Bônus agregados do equipamento (para enviar ao servidor). */
export function equipmentBonusesFromInventory(inventory) {
  const inv = normalizeInventory(inventory);
  const bonuses = {};
  for (const key of BONUS_KEYS) {
    bonuses[key] = 0;
  }
  for (const key of EQUIP_KEYS) {
    const item = inv.equipment[key];
    if (!item?.bonus) continue;
    for (const bk of BONUS_KEYS) {
      const val = item.bonus[bk];
      if (Number.isFinite(val)) bonuses[bk] += val;
    }
  }
  // Aplica limites máximos
  bonuses.cooldownReduction = Math.min(0.95, Math.max(0, bonuses.cooldownReduction));
  bonuses.damageBonus = Math.min(0.75, Math.max(0, bonuses.damageBonus));
  bonuses.healBonus = Math.min(0.75, Math.max(0, bonuses.healBonus));
  bonuses.shieldBonus = Math.min(0.75, Math.max(0, bonuses.shieldBonus));
  bonuses.speedBonus = Math.min(0.50, Math.max(0, bonuses.speedBonus));
  bonuses.rangeBonus = Math.min(0.50, Math.max(0, bonuses.rangeBonus));
  bonuses.radiusBonus = Math.min(0.50, Math.max(0, bonuses.radiusBonus));
  bonuses.slowResist = Math.min(0.80, Math.max(0, bonuses.slowResist));
  bonuses.poisonResist = Math.min(0.80, Math.max(0, bonuses.poisonResist));
  bonuses.burnResist = Math.min(0.80, Math.max(0, bonuses.burnResist));
  bonuses.maxHpBonus = Math.min(0.60, Math.max(0, bonuses.maxHpBonus));
  bonuses.xpBonus = Math.min(0.50, Math.max(0, bonuses.xpBonus));
  return bonuses;
}

export function normalizeInventory(raw) {
  if (!raw || typeof raw !== 'object') return defaultInventory();

  const inv = {
    equipment: normalizeEquipment(raw.equipment),
    bag: normalizeBag(raw.bag),
    gold: Math.max(0, Math.floor(Number(raw.gold) || 0)),
    loot: Math.max(0, Math.floor(Number(raw.loot) || 0)),
    starterKit: Math.max(0, Math.floor(Number(raw.starterKit) || 0)),
  };

  migrateLegacyRing2ToTunic(raw.equipment, inv);

  if (inv.starterKit < STARTER_KIT_VERSION) {
    return grantStarterKit(inv);
  }
  return inv;
}

/**
 * Analisa o saco e retorna dicas visuais para cada slot de equipamento vazio.
 * Retorna um objeto { slotKey: 'equippable' | 'low_level' } apenas para slots
 * vazios onde existem itens compatíveis no saco.
 *   'equippable' — há item compatível e o personagem tem nível suficiente.
 *   'low_level'  — há item compatível mas o personagem não tem nível suficiente.
 */
export function getBagEquipHints(bag, equipment, characterLevel) {
  const hints = {};

  for (const { key, accepts } of EQUIP_SLOTS) {
    if (equipment[key]) continue;

    const candidates = [];
    for (const stack of bag) {
      if (stack?.item?.slot === accepts) {
        candidates.push(stack.item);
      }
    }
    if (candidates.length === 0) continue;

    const hasEquippable = candidates.some((item) => canEquipItem(item, characterLevel));
    hints[key] = hasEquippable ? 'equippable' : 'low_level';
  }

  return hints;
}

export function findEquipSlotForItem(equipment, item) {
  if (!item) return null;
  for (const { key, accepts } of EQUIP_SLOTS) {
    if (accepts === item.slot && !equipment[key]) return key;
  }
  return null;
}

/** Encontra o slot compatível para o item (ocupado ou vazio). */
export function findSlotForItemType(item) {
  if (!item) return null;
  for (const { key, accepts } of EQUIP_SLOTS) {
    if (accepts === item.slot) return key;
  }
  return null;
}

export function firstEmptyBagIndex(bag) {
  for (let i = 0; i < bag.length; i++) {
    if (!bag[i]) return i;
  }
  return -1;
}

/** Equipa 1 unidade do item do saco no primeiro slot compatível livre. */
export function equipFromBag(inventory, bagIndex, characterLevel) {
  const inv = normalizeInventory(inventory);
  const stack = inv.bag[bagIndex];
  if (!stack) return { ok: false, error: 'Slot vazio.', inventory: inv };
  const item = stack.item;
  if (!isEquippable(item)) {
    return { ok: false, error: 'Este item não pode ser equipado.', inventory: inv };
  }
  if (!canEquipItem(item, characterLevel)) {
    return {
      ok: false,
      error: `Você precisa ser nível ${item.level} para equipar este item.`,
      inventory: inv,
    };
  }
  const slotKey = findEquipSlotForItem(inv.equipment, item);
  if (!slotKey) {
    return { ok: false, error: 'Nenhum slot livre para este item.', inventory: inv };
  }
  inv.equipment[slotKey] = { ...item };
  if (stack.qty <= 1) {
    inv.bag[bagIndex] = null;
  } else {
    stack.qty -= 1;
  }
  return { ok: true, inventory: inv };
}

/** Equipa item do saco e troca com o item equipado no slot compatível (se houver). */
export function swapFromBag(inventory, bagIndex, characterLevel) {
  const inv = normalizeInventory(inventory);
  const stack = inv.bag[bagIndex];
  if (!stack) return { ok: false, error: 'Slot vazio.', inventory: inv };
  const item = stack.item;
  if (!isEquippable(item)) {
    return { ok: false, error: 'Este item não pode ser equipado.', inventory: inv };
  }
  if (!canEquipItem(item, characterLevel)) {
    return {
      ok: false,
      error: `Você precisa ser nível ${item.level} para equipar este item.`,
      inventory: inv,
    };
  }

  const slotKey = findSlotForItemType(item);
  if (!slotKey) {
    return { ok: false, error: 'Nenhum slot compatível.', inventory: inv };
  }

  const equipped = inv.equipment[slotKey];

  if (!equipped) {
    inv.equipment[slotKey] = { ...item };
    if (stack.qty <= 1) {
      inv.bag[bagIndex] = null;
    } else {
      stack.qty -= 1;
    }
    return { ok: true, inventory: inv, swapped: false };
  }

  const canStack = findStackForItemId(inv.bag, equipped.id) >= 0;
  const willFreeSlot = stack.qty <= 1;
  const hasEmptySlot = firstEmptyBagIndex(inv.bag) >= 0;

  if (!canStack && !willFreeSlot && !hasEmptySlot) {
    return { ok: false, error: 'Inventário cheio! Não é possível trocar.', inventory: inv };
  }

  if (stack.qty <= 1) {
    inv.bag[bagIndex] = null;
  } else {
    stack.qty -= 1;
  }

  const stackTarget = findStackForItemId(inv.bag, equipped.id);
  if (stackTarget >= 0) {
    inv.bag[stackTarget].qty += 1;
  } else if (!inv.bag[bagIndex]) {
    inv.bag[bagIndex] = { item: { ...equipped }, qty: 1 };
  } else {
    const freeIdx = firstEmptyBagIndex(inv.bag);
    inv.bag[freeIdx] = { item: { ...equipped }, qty: 1 };
  }

  inv.equipment[slotKey] = { ...item };

  return { ok: true, inventory: inv, swapped: true };
}

/** Remove item do equipamento e tenta empilhar no saco. */
export function unequipToBag(inventory, equipKey) {
  const inv = normalizeInventory(inventory);
  if (!EQUIP_KEYS.includes(equipKey)) {
    return { ok: false, error: 'Slot inválido.', inventory: inv };
  }
  const item = inv.equipment[equipKey];
  if (!item) return { ok: false, error: 'Slot vazio.', inventory: inv };

  const stackIdx = findStackForItemId(inv.bag, item.id);
  if (stackIdx >= 0) {
    inv.bag[stackIdx].qty += 1;
    inv.equipment[equipKey] = null;
    return { ok: true, inventory: inv, stackedOn: stackIdx };
  }

  const freeIdx = firstEmptyBagIndex(inv.bag);
  if (freeIdx < 0) {
    return {
      ok: false,
      error: 'Inventário cheio! Não há espaço para desequipar.',
      inventory: inv,
    };
  }
  inv.bag[freeIdx] = { item: { ...item }, qty: 1 };
  inv.equipment[equipKey] = null;
  return { ok: true, inventory: inv };
}

/** Organiza o saco: equipamentos primeiro (ordenados por nível decrescente),
 *  depois minérios, depois outros. Agrupa stacks do mesmo item e compacta
 *  para os primeiros slots. */
export function sortBag(inventory) {
  const inv = normalizeInventory(inventory);
  const bag = inv.bag;

  const mergeMap = new Map();
  for (let i = 0; i < bag.length; i++) {
    const stack = bag[i];
    if (!stack || !stack.item) continue;
    const key = stack.item.id;
    const existing = mergeMap.get(key);
    if (existing) {
      existing.qty += stack.qty;
    } else {
      mergeMap.set(key, { item: { ...stack.item }, qty: stack.qty });
    }
  }

  const merged = [];
  for (const [, stack] of mergeMap) {
    let qty = stack.qty;
    while (qty > 999) {
      merged.push({ item: { ...stack.item }, qty: 999 });
      qty -= 999;
    }
    merged.push({ item: { ...stack.item }, qty: qty });
  }

  const categoryOrder = { equipment: 0, ore: 1, other: 2 };
  merged.sort((a, b) => {
    const catA = categoryOrder[a.item.category] ?? 3;
    const catB = categoryOrder[b.item.category] ?? 3;
    if (catA !== catB) return catA - catB;
    if (a.item.category === 'equipment') {
      const lvA = a.item.level || 1;
      const lvB = b.item.level || 1;
      if (lvA !== lvB) return lvB - lvA;
    }
    return a.item.name.localeCompare(b.item.name);
  });

  const newBag = emptyBag();
  for (let i = 0; i < merged.length && i < BAG_SIZE; i++) {
    newBag[i] = merged[i];
  }
  inv.bag = newBag;
  return inv;
}

/** Retorna a quantidade total de um item no saco (soma todos os stacks). */
export function bagItemQty(bag, itemId) {
  let total = 0;
  for (const stack of bag) {
    if (stack?.item?.id === itemId) total += stack.qty;
  }
  return total;
}
