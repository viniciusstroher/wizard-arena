/** Inventário do personagem: equipamento + grade 12×12. */

export const BAG_COLS = 12;
export const BAG_ROWS = 12;
export const BAG_SIZE = BAG_COLS * BAG_ROWS;

/** v4: um slot de anel (ring1) + túnica no lugar do segundo anel. */
export const STARTER_KIT_VERSION = 4;

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
};

/**
 * Itens iniciais.
 * Conjunto de pano = chapéu + capa + túnica.
 */
export const ITEM_DEFS = {
  cloth_hat: {
    id: 'cloth_hat',
    name: 'Chapéu de Pano',
    slot: 'hat',
    color: 0xc4b59a,
    set: 'conjunto_de_pano',
  },
  cloth_cape: {
    id: 'cloth_cape',
    name: 'Capa de Pano',
    slot: 'cape',
    color: 0xb8a88a,
    set: 'conjunto_de_pano',
  },
  cloth_tunic: {
    id: 'cloth_tunic',
    name: 'Túnica de Pano',
    slot: 'tunic',
    color: 0xa89878,
    set: 'conjunto_de_pano',
    bonus: { cooldownReduction: 0.01 },
  },
  plastic_ring: {
    id: 'plastic_ring',
    name: 'Anel de Plástico',
    slot: 'ring',
    color: 0x7ec8e3,
  },
  brass_necklace: {
    id: 'brass_necklace',
    name: 'Colar de Latão',
    slot: 'necklace',
    color: 0xc9a227,
  },
  holey_boots: {
    id: 'holey_boots',
    name: 'Botas Furas',
    slot: 'boots',
    color: 0x8b6914,
  },
  // Minérios (não equipáveis)
  copper_ore:    { id: 'copper_ore',    name: 'Minério de Cobre',     slot: 'ore', color: 0xe87438 },
  iron_ore:      { id: 'iron_ore',      name: 'Minério de Ferro',     slot: 'ore', color: 0x8c7a6b },
  silver_ore:    { id: 'silver_ore',    name: 'Minério de Prata',     slot: 'ore', color: 0xc0c8d4 },
  gold_ore:      { id: 'gold_ore',      name: 'Minério de Ouro',      slot: 'ore', color: 0xe8c048 },
  diamond_ore:   { id: 'diamond_ore',   name: 'Minério de Diamante',  slot: 'ore', color: 0x64d8e8 },
  emerald_ore:   { id: 'emerald_ore',   name: 'Minério de Esmeralda', slot: 'ore', color: 0x40c860 },
  ruby_ore:      { id: 'ruby_ore',      name: 'Minério de Rubi',      slot: 'ore', color: 0xe04050 },
  sapphire_ore:  { id: 'sapphire_ore',  name: 'Minério de Safira',    slot: 'ore', color: 0x3068e8 },
  quartz_ore:    { id: 'quartz_ore',    name: 'Minério de Quartzo',   slot: 'ore', color: 0xe8d0e0 },
  obsidian_ore:  { id: 'obsidian_ore',  name: 'Minério de Obsidiana', slot: 'ore', color: 0x301828 },
  mythril_ore:   { id: 'mythril_ore',   name: 'Minério de Mitril',    slot: 'ore', color: 0x60c0d8 },
  orichalcum_ore:{ id: 'orichalcum_ore',name: 'Minério de Oricalco',  slot: 'ore', color: 0xe8a030 },
  moonstone_ore: { id: 'moonstone_ore', name: 'Minério Lunar',        slot: 'ore', color: 0xa0b8ff },
  sunstone_ore:  { id: 'sunstone_ore',  name: 'Minério Solar',        slot: 'ore', color: 0xffcc50 },
  shadow_ore:    { id: 'shadow_ore',    name: 'Minério Sombrio',      slot: 'ore', color: 0x482868 },
  crystal_ore:   { id: 'crystal_ore',   name: 'Minério Cristalino',   slot: 'ore', color: 0xb0ffd8 },
  coral_ore:     { id: 'coral_ore',     name: 'Minério de Coral',     slot: 'ore', color: 0xe87080 },
  amber_ore:     { id: 'amber_ore',     name: 'Minério de Âmbar',     slot: 'ore', color: 0xf0a040 },
  jade_ore:      { id: 'jade_ore',      name: 'Minério de Jade',      slot: 'ore', color: 0x40a870 },
  onyx_ore:      { id: 'onyx_ore',      name: 'Minério de Ônix',      slot: 'ore', color: 0x202028 },
};

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

const EQUIP_KEYS = EQUIP_SLOTS.map((s) => s.key);
const ACCEPTS = new Set([...EQUIP_SLOTS.map((s) => s.accepts), 'ore']);
const SLOT_LABEL_BY_ACCEPTS = Object.fromEntries(
  [...EQUIP_SLOTS.map((s) => [s.accepts, s.label]), ['ore', 'Minério']]
);

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
  if (Number.isFinite(bonus.cooldownReduction)) {
    out.cooldownReduction = bonus.cooldownReduction;
  }
  return Object.keys(out).length ? out : null;
}

export function createItem(defId) {
  const def = ITEM_DEFS[defId];
  if (!def) return null;
  return {
    id: def.id,
    name: def.name,
    slot: def.slot,
    color: def.color >>> 0,
    set: def.set || null,
    bonus: copyBonus(def.bonus),
  };
}

export function itemTooltipLines(item) {
  if (!item) return [];
  const lines = [item.name];
  lines.push(`Tipo: ${SLOT_LABEL_BY_ACCEPTS[item.slot] || item.slot}`);
  if (item.set && SET_LABELS[item.set]) {
    lines.push(SET_LABELS[item.set]);
  }
  if (item.bonus?.cooldownReduction) {
    const pct = Math.round(item.bonus.cooldownReduction * 100);
    lines.push(`Cooldown das magias: -${pct}%`);
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
      slot: def.slot,
      color: def.color >>> 0,
      set: def.set || null,
      bonus: copyBonus(def.bonus),
    };
  }
  const name = String(raw.name || '').trim().slice(0, 24);
  const slot = String(raw.slot || '').trim();
  if (!id || !name || !ACCEPTS.has(slot)) return null;
  const color = Number(raw.color);
  return {
    id,
    name,
    slot,
    color: Number.isFinite(color) ? color >>> 0 : 0x6b5cff,
    set: raw.set ? String(raw.set) : null,
    bonus: copyBonus(raw.bonus),
  };
}

function normalizeBag(raw) {
  const bag = emptyBag();
  if (!Array.isArray(raw)) return bag;
  for (let i = 0; i < BAG_SIZE; i++) {
    bag[i] = normalizeItem(raw[i]);
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
    if (bag[i]?.id === id) return i;
  }
  return -1;
}

function collectOwnedIds(inventory) {
  const ids = new Set();
  for (const item of inventory.bag) {
    if (item?.id) ids.add(item.id);
  }
  for (const key of EQUIP_KEYS) {
    const item = inventory.equipment[key];
    if (item?.id) ids.add(item.id);
  }
  return ids;
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

  // Cria itens faltantes no saco
  for (const defId of STARTER_ITEM_IDS) {
    if (owned.has(defId)) continue;
    const idx = firstEmptyBagIndex(inv.bag);
    if (idx < 0) break;
    const item = createItem(defId);
    if (!item) continue;
    inv.bag[idx] = item;
    owned.add(defId);
  }

  // Equipa o set inicial nos slots correspondentes
  for (const { key, id } of STARTER_EQUIP_PLAN) {
    if (inv.equipment[key]?.id === id) continue;

    const bagIdx = findBagIndexById(inv.bag, id);
    if (bagIdx >= 0) {
      const starter = inv.bag[bagIdx];
      const previous = inv.equipment[key];
      inv.equipment[key] = starter;
      inv.bag[bagIdx] = previous || null;
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
  let cooldownReduction = 0;
  for (const key of EQUIP_KEYS) {
    const item = inv.equipment[key];
    const red = item?.bonus?.cooldownReduction;
    if (Number.isFinite(red) && red > 0) cooldownReduction += red;
  }
  return {
    cooldownReduction: Math.min(0.95, Math.max(0, cooldownReduction)),
  };
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

export function findEquipSlotForItem(equipment, item) {
  if (!item) return null;
  for (const { key, accepts } of EQUIP_SLOTS) {
    if (accepts === item.slot && !equipment[key]) return key;
  }
  return null;
}

export function firstEmptyBagIndex(bag) {
  for (let i = 0; i < bag.length; i++) {
    if (!bag[i]) return i;
  }
  return -1;
}

/** Equipa item do saco no primeiro slot compatível livre. */
export function equipFromBag(inventory, bagIndex) {
  const inv = normalizeInventory(inventory);
  const item = inv.bag[bagIndex];
  if (!item) return { ok: false, error: 'Slot vazio.', inventory: inv };
  const slotKey = findEquipSlotForItem(inv.equipment, item);
  if (!slotKey) {
    return { ok: false, error: 'Nenhum slot livre para este item.', inventory: inv };
  }
  inv.equipment[slotKey] = item;
  inv.bag[bagIndex] = null;
  return { ok: true, inventory: inv };
}

/** Remove item do equipamento para o primeiro slot livre do saco. */
export function unequipToBag(inventory, equipKey) {
  const inv = normalizeInventory(inventory);
  if (!EQUIP_KEYS.includes(equipKey)) {
    return { ok: false, error: 'Slot inválido.', inventory: inv };
  }
  const item = inv.equipment[equipKey];
  if (!item) return { ok: false, error: 'Slot vazio.', inventory: inv };
  const idx = firstEmptyBagIndex(inv.bag);
  if (idx < 0) {
    return {
      ok: false,
      error: 'Inventário cheio! Não há espaço para desequipar.',
      inventory: inv,
    };
  }
  inv.bag[idx] = item;
  inv.equipment[equipKey] = null;
  return { ok: true, inventory: inv };
}
