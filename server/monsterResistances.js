/**
 * Resistências elementais dos monstros (estilo D&D / Tibia / WoW).
 *
 * Valor = percentual de resistência:
 *   50  → resistente (metade do dano, D&D Resistant)
 *  100  → imune
 *    0  → neutro
 *  -50  → vulnerável (+50% dano)
 * -100  → vulnerável forte (dano dobrado, D&D Vulnerable)
 *
 * Multiplicador de dano = clamp((100 - resist) / 100, 0, 2).
 */

import { SPELL_ELEMENTS } from './spellElements.js';

export const ELEMENT_IDS = Object.keys(SPELL_ELEMENTS);

/** Perfis nomeados reutilizáveis. */
const P = {
  fire: { fire: 60, ice: -40, water: -30, nature: 20 },
  magma: { fire: 80, ice: -50, water: -40, nature: 30, lightning: 20 },
  ice: { ice: 70, fire: -40, water: 30, lightning: -10 },
  water: { water: 60, lightning: -40, fire: 25, ice: 20 },
  storm: { lightning: 70, water: 20, nature: -15, arcane: 15 },
  poison: { poison: 70, holy: -25, nature: 20, fire: -15 },
  undead: { shadow: 40, holy: -50, poison: 60, fire: -20, ice: 15 },
  shadow: { shadow: 60, holy: -50, arcane: 20, poison: 30 },
  nature: { nature: 55, fire: -40, poison: 30, water: 15, lightning: -10 },
  stone: { fire: 35, ice: 25, lightning: -25, nature: 20, poison: 40, arcane: 15 },
  metal: { fire: 40, lightning: -45, ice: 20, poison: 50, arcane: -10 },
  demon: { fire: 50, shadow: 35, holy: -55, ice: -15, poison: 25 },
  holy: { holy: 50, shadow: -40, fire: 20, arcane: 15 },
  arcane: { arcane: 50, shadow: 15, holy: -15, lightning: 20 },
  crystal: { ice: 40, arcane: 35, fire: -20, lightning: 15, nature: -10 },
  beast: { nature: 15, poison: -10, arcane: -5 },
  humanoid: { arcane: -5, holy: 5, poison: -5 },
  insect: { poison: 40, fire: -25, nature: 15, ice: -10 },
  dragon_fire: { fire: 55, ice: -30, arcane: 20, nature: 15 },
  dragon_frost: { ice: 60, fire: -35, water: 25, arcane: 15 },
  dragon_bone: { shadow: 45, holy: -45, poison: 70, fire: -20, ice: 20 },
  construct: { poison: 80, arcane: -15, lightning: -20, fire: 25, ice: 20 },
  blood: { shadow: 30, holy: -35, fire: -15, poison: 25, water: 15 },
  void: { shadow: 70, arcane: 40, holy: -60, nature: -20, fire: 15 },
};

/**
 * Regras por palavra-chave no id do monstro (mais específicas primeiro).
 * Cada match faz merge; regras posteriores só preenchem gaps se `soft`.
 */
const KEYWORD_RULES = [
  // Dragões tipados
  { keys: ['frost_dragon', 'ice_wyrm', 'ice_wyvern', 'arctic'], profile: P.dragon_frost },
  { keys: ['bone_dragon', 'entropy_dragon'], profile: P.dragon_bone },
  { keys: ['dragon', 'drake', 'wyvern', 'whelp'], profile: P.dragon_fire },

  // Elementais / temas fortes
  { keys: ['fire_elemental', 'flame_lord', 'magma', 'lava', 'brimstone', 'cinder', 'ember', 'pyre', 'furnace', 'kiln', 'slag', 'soot', 'torch', 'ash_', 'phoenix', 'solar'], profile: P.fire },
  { keys: ['frost', 'ice_', 'glacier', 'snow_', 'yeti', 'hail_', 'aurora_'], profile: P.ice },
  { keys: ['storm', 'thunder', 'tempest', 'spark_', 'lightning'], profile: P.storm },
  { keys: ['water', 'tide_', 'brine', 'kelp', 'reef', 'kraken', 'leviathan', 'shark', 'coral', 'pearl', 'siren', 'pirate', 'crab', 'urchin', 'eel', 'drift_'], profile: P.water },
  { keys: ['poison', 'venom', 'plague', 'toxin', 'acid', 'blight', 'spore', 'mire_', 'bog_', 'marsh_', 'swamp_'], profile: P.poison },
  { keys: ['void_', 'abyss', 'entropy'], profile: P.void },
  { keys: ['shadow', 'wraith', 'nightmare', 'dusk_', 'night_', 'shade_', 'soul_', 'grim_'], profile: P.shadow },
  { keys: ['skeleton', 'zombie', 'ghoul', 'lich', 'mummy', 'necromancer', 'necrotic', 'death_knight', 'bone_', 'reaper', 'tomb_'], profile: P.undead },
  { keys: ['demon', 'archdemon', 'cerberus', 'imp', 'hell', 'bruxo'], profile: P.demon },
  { keys: ['treant', 'thorn', 'vine', 'moss_', 'pine_', 'forest', 'bark_', 'bramble', 'root_', 'pollen', 'mushroom', 'ironbark', 'reed_', 'mangrove'], profile: P.nature },
  { keys: ['stone_golem', 'obsidian', 'basalt', 'shale', 'salt_', 'chalk', 'clay_', 'pebble', 'sand_', 'dune_', 'scarab', 'golem'], profile: P.stone },
  { keys: ['iron_', 'copper_', 'scrap_', 'rust_', 'forge_', 'metal'], profile: P.metal },
  { keys: ['crystal', 'quartz', 'amber_', 'jade_', 'onyx_', 'sapphire', 'prism_', 'glass_', 'mirror_'], profile: P.crystal },
  { keys: ['rune_', 'arcane', 'astral', 'chronomancer', 'starfall', 'hex_', 'beholder'], profile: P.arcane },
  { keys: ['blood_', 'crimson', 'succubus'], profile: P.blood },
  { keys: ['wasp', 'spider', 'scarab', 'mite', 'tick', 'moth', 'gnat', 'larva', 'insect', 'mantis', 'beetle', 'mosquito'], profile: P.insect },
  { keys: ['holy', 'solar_', 'lantern_spirit'], profile: P.holy },
  { keys: ['wolf', 'boar', 'bat', 'owl', 'hawk', 'raven', 'jackal', 'panther', 'ferret', 'hare', 'goat', 'ibex', 'finch', 'vole', 'newt', 'toad', 'snake', 'hydra', 'naga', 'croco'], profile: P.beast },
  { keys: ['goblin', 'bandit', 'orc', 'dwarf', 'elf', 'kobold', 'gnoll', 'cultist', 'pirate', 'ratman', 'frogman', 'squire', 'knight', 'archer', 'witch', 'mage', 'alchemist', 'doctor', 'assassin', 'scout', 'raider'], profile: P.humanoid },
];

/** Ajustes suaves por habitat (valores baixos; só preenche gaps). */
const FLOOR_SOFT = {
  volcano: { fire: 20, ice: -15, water: -10 },
  hell: { fire: 15, holy: -20, shadow: 10 },
  lava_field: { fire: 25, ice: -20, water: -15 },
  ashland: { fire: 15, ice: -10, nature: -10 },
  obsidian: { fire: 15, lightning: -10, poison: 15 },
  ice: { ice: 20, fire: -15 },
  snow: { ice: 15, fire: -10 },
  tundra: { ice: 15, fire: -10 },
  glacier: { ice: 20, fire: -15 },
  sea: { water: 20, lightning: -15 },
  coral: { water: 15, lightning: -10 },
  beach: { water: 10, lightning: -10 },
  abyss: { shadow: 20, holy: -15, water: 10 },
  swamp: { poison: 20, nature: 10 },
  marsh: { poison: 15, nature: 10 },
  sewer: { poison: 15, holy: -10 },
  mushroom: { nature: 15, poison: 15, fire: -10 },
  graveyard: { shadow: 15, holy: -20, poison: 20 },
  catacomb: { shadow: 15, holy: -15, poison: 15 },
  crypt: { shadow: 15, holy: -20, poison: 20 },
  shadow: { shadow: 20, holy: -15 },
  blood: { shadow: 10, holy: -15 },
  vampire_castle: { shadow: 15, holy: -20 },
  throne_hall: { shadow: 10, holy: -15 },
  enchanted: { nature: 15, arcane: 10 },
  jungle: { nature: 15, poison: 10 },
  garden: { nature: 10 },
  bramble: { nature: 15, fire: -10 },
  grass: { nature: 10 },
  meadow: { nature: 10 },
  desert: { fire: 10, water: -10, ice: -10 },
  oasis: { water: 10 },
  saltflat: { lightning: -10, poison: 10 },
  sky: { lightning: 15 },
  storm: { lightning: 20, water: 10 },
  aurora: { lightning: 10, ice: 10, arcane: 10 },
  crystal: { ice: 10, arcane: 15 },
  crystal_cave: { ice: 10, arcane: 10 },
  temple: { holy: 10, shadow: -10 },
  dungeon: { shadow: 5, poison: 5 },
};

function clampResist(v) {
  const n = Math.round(Number(v) || 0);
  return Math.max(-100, Math.min(100, n));
}

function mergeProfile(into, profile, { soft = false } = {}) {
  if (!profile) return into;
  for (const [el, val] of Object.entries(profile)) {
    if (!SPELL_ELEMENTS[el]) continue;
    const next = clampResist(val);
    if (soft) {
      if ((into[el] ?? 0) === 0 && next !== 0) into[el] = next;
    } else if (Math.abs(next) >= Math.abs(into[el] ?? 0)) {
      into[el] = next;
    } else if ((into[el] ?? 0) === 0) {
      into[el] = next;
    }
  }
  return into;
}

function compact(resists) {
  const out = {};
  for (const el of ELEMENT_IDS) {
    const v = clampResist(resists[el]);
    if (v !== 0) out[el] = v;
  }
  return out;
}

/**
 * Resolve resistências para um tipo de monstro.
 * @param {string} monsterId
 * @param {string[]} [floors]
 */
export function resolveMonsterResistances(monsterId, floors = []) {
  const id = String(monsterId || '').toLowerCase();
  const acc = {};

  // Primeira regra específica define o perfil; matches extras só preenchem gaps.
  let primary = false;
  for (const rule of KEYWORD_RULES) {
    if (!rule.keys.some((k) => id.includes(k))) continue;
    mergeProfile(acc, rule.profile, { soft: primary });
    primary = true;
  }

  for (const floor of floors || []) {
    mergeProfile(acc, FLOOR_SOFT[floor], { soft: true });
  }

  // Elites/bosses um pouco mais resistentes no próprio elemento dominante (WoW-ish).
  if (
    /(_elite|_boss|_king|_queen|_emperor|_matriarch|_tyrant|_colossus|_overlord|_sovereign|_primordial|_paragon|_ascendant)$/.test(
      id
    ) ||
    id.endsWith('_lord') ||
    id.includes('_boss')
  ) {
    for (const el of Object.keys(acc)) {
      if (acc[el] > 0) acc[el] = clampResist(acc[el] + 10);
      if (acc[el] < 0) acc[el] = clampResist(acc[el] - 5);
    }
  }

  // Neutro mínimo para criaturas sem tema.
  if (!Object.keys(compact(acc)).length) {
    acc.arcane = -5;
    acc.nature = 5;
  }

  return compact(acc);
}

/** Multiplicador de dano dado o % de resistência. */
export function elementDamageMultiplier(resistPercent) {
  const r = clampResist(resistPercent);
  return Math.max(0, Math.min(2, (100 - r) / 100));
}

/**
 * Aplica resistência elemental ao dano.
 * @returns {number} dano inteiro após resistência
 */
export function applyElementResistance(amount, resistances, elementId) {
  if (!elementId || !resistances || typeof resistances !== 'object') {
    return Math.max(0, Math.round(Number(amount) || 0));
  }
  const resist = resistances[elementId] ?? 0;
  if (!resist) return Math.max(0, Math.round(Number(amount) || 0));
  return Math.max(0, Math.round((Number(amount) || 0) * elementDamageMultiplier(resist)));
}

/** Anexa `resistances` em cada def do catálogo. */
export function attachMonsterResistances(defs) {
  for (const [id, def] of Object.entries(defs)) {
    def.resistances = resolveMonsterResistances(id, def.floors || []);
  }
  return defs;
}

/** Lista ordenada para UI: [{ element, label, value, cssColor }, ...] */
export function resistanceDetails(resistances) {
  if (!resistances) return [];
  return ELEMENT_IDS.filter((el) => (resistances[el] ?? 0) !== 0)
    .map((el) => {
      const meta = SPELL_ELEMENTS[el];
      const value = clampResist(resistances[el]);
      return {
        element: el,
        label: meta.label,
        value,
        cssColor: `#${meta.color.toString(16).padStart(6, '0')}`,
        text: formatResistValue(value),
      };
    })
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.label.localeCompare(b.label, 'pt'));
}

export function formatResistValue(value) {
  const v = clampResist(value);
  if (v === 100) return 'Imune';
  if (v === -100) return 'Vulnerável';
  if (v > 0) return `+${v}%`;
  return `${v}%`;
}

export function formatResistancesLine(resistances) {
  const details = resistanceDetails(resistances);
  if (!details.length) return 'Resistências: neutras';
  return `Resistências: ${details.map((d) => `${d.label} ${d.text}`).join(', ')}`;
}
