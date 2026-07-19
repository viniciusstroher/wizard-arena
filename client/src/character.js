/** Persistência do personagem no localStorage. */

import { DEFAULT_SKIN, normalizeSkinId, WIZARD_SKIN_IDS } from './wizardSkin.js';

export const CHARACTER_KEY = 'wa_character';
export { DEFAULT_SKIN, WIZARD_SKIN_IDS };

export const WIZARD_COLORS = [
  0xff5555, // crimson
  0x55aaff, // azure
  0x55ff99, // emerald
  0xffaa33, // amber
  0x8844cc, // necromancer
  0xff69b4, // pink
  0xffd700, // gold
  0x00e5ff, // cyan
  0xff3300, // scarlet
  0xffffff, // white
  0x2ecc71, // green
  0xe74c3c, // red
  0x3498db, // blue
  0x9b59b6, // violet
  0x1abc9c, // teal
  0xe67e22, // orange
  0xc0392b, // burgundy
  0x8e44ad, // grape
  0x16a085, // jungle
  0xf39c12, // sunflower
  0x27ae60, // forest
  0xd35400, // pumpkin
  0x2980b9, // ocean
  0x7f8c8d, // slate
  0xff6b9d, // rose
  0xb8e994, // mint
  0x6c5ce7, // indigo
  0xfd79a8, // blush
];

const RANDOM_NAMES = ['Mage', 'Hex', 'Nyx', 'Orb', 'Rune', 'Ash', 'Vex', 'Lux', 'Kira', 'Zed'];

function normalizeColor(value, fallback = 0xff5555) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n >>> 0;
}

export function randomCharacter() {
  const prefix = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  return {
    name: `${prefix}${Math.floor(Math.random() * 900 + 100)}`,
    color: WIZARD_COLORS[Math.floor(Math.random() * WIZARD_COLORS.length)],
    skin: WIZARD_SKIN_IDS[Math.floor(Math.random() * WIZARD_SKIN_IDS.length)],
  };
}

export function loadCharacter() {
  try {
    const raw = localStorage.getItem(CHARACTER_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const name = String(data?.name || '').trim().slice(0, 16);
      if (name) {
        return {
          name,
          color: normalizeColor(data.color),
          skin: normalizeSkinId(data.skin),
        };
      }
    }
  } catch {
    // ignore corrupt storage
  }

  // Migra nome legado, se existir
  const legacyName = String(localStorage.getItem('wa_name') || '').trim().slice(0, 16);
  if (legacyName) {
    const char = {
      name: legacyName,
      color: WIZARD_COLORS[Math.floor(Math.random() * WIZARD_COLORS.length)],
      skin: DEFAULT_SKIN,
    };
    saveCharacter(char);
    return char;
  }

  return null;
}

/** Garante personagem no storage (cria aleatório na 1ª visita). */
export function ensureCharacter() {
  const existing = loadCharacter();
  if (existing) return existing;
  const created = randomCharacter();
  saveCharacter(created);
  return created;
}

export function saveCharacter(character) {
  const name = String(character?.name || '').trim().slice(0, 16);
  if (!name) return { ok: false, error: 'Digite um nome para o personagem.' };
  const data = {
    name,
    color: normalizeColor(character?.color),
    skin: normalizeSkinId(character?.skin),
  };
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(data));
  localStorage.setItem('wa_name', data.name);
  return { ok: true, character: data };
}
