/** Persistência do personagem no localStorage. */

export const CHARACTER_KEY = 'wa_character';

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
  };
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(data));
  localStorage.setItem('wa_name', data.name);
  return { ok: true, character: data };
}
