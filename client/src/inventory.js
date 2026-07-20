/** Inventário do personagem: equipamento + grade 12×12. */

export const BAG_COLS = 12;
export const BAG_ROWS = 12;
export const BAG_SIZE = BAG_COLS * BAG_ROWS;

/** Slots de equipamento (colar, 2 anéis, chapéu, capa). */
export const EQUIP_SLOTS = [
  { key: 'necklace', label: 'Colar', accepts: 'necklace' },
  { key: 'ring1', label: 'Anel', accepts: 'ring' },
  { key: 'ring2', label: 'Anel', accepts: 'ring' },
  { key: 'hat', label: 'Chapéu', accepts: 'hat' },
  { key: 'cape', label: 'Capa', accepts: 'cape' },
];

const EQUIP_KEYS = EQUIP_SLOTS.map((s) => s.key);
const ACCEPTS = new Set(EQUIP_SLOTS.map((s) => s.accepts));

function emptyEquipment() {
  const eq = {};
  for (const key of EQUIP_KEYS) eq[key] = null;
  return eq;
}

function emptyBag() {
  return Array.from({ length: BAG_SIZE }, () => null);
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const name = String(raw.name || '').trim().slice(0, 24);
  const slot = String(raw.slot || '').trim();
  if (!id || !name || !ACCEPTS.has(slot)) return null;
  const color = Number(raw.color);
  return {
    id,
    name,
    slot,
    color: Number.isFinite(color) ? color >>> 0 : 0x6b5cff,
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

export function defaultInventory() {
  return {
    equipment: emptyEquipment(),
    bag: emptyBag(),
    gold: 0,
    loot: 0,
  };
}

export function normalizeInventory(raw) {
  const base = defaultInventory();
  if (!raw || typeof raw !== 'object') return base;
  return {
    equipment: normalizeEquipment(raw.equipment),
    bag: normalizeBag(raw.bag),
    gold: Math.max(0, Math.floor(Number(raw.gold) || 0)),
    loot: Math.max(0, Math.floor(Number(raw.loot) || 0)),
  };
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
  if (idx < 0) return { ok: false, error: 'Inventário cheio.', inventory: inv };
  inv.bag[idx] = item;
  inv.equipment[equipKey] = null;
  return { ok: true, inventory: inv };
}
