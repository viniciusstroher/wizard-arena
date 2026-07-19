import { createMonsterTypeDefs } from '../../../server/monsterTypes.js';
import { SPELLS, ULTIMATES } from '../../../server/spells.js';
import { monsterLabel } from './monsterLabels.js';
import {
  FLOOR_SPEED_MUL,
  FLOOR_INERTIA_MUL,
  FLOOR_META,
  floorDescription,
} from './statusEffects.js';

/** Grupos temáticos da galeria de terrenos. */
const FLOOR_GROUP_OF = {
  grass: 'nature',
  meadow: 'nature',
  jungle: 'nature',
  enchanted: 'nature',
  mushroom: 'nature',
  tundra: 'nature',
  garden: 'nature',
  bramble: 'nature',
  oasis: 'nature',
  mountain: 'nature',
  ice: 'element',
  snow: 'element',
  glacier: 'element',
  aurora: 'element',
  volcano: 'element',
  hell: 'element',
  lava_field: 'element',
  obsidian: 'element',
  sky: 'element',
  storm: 'element',
  crystal: 'element',
  sea: 'water',
  coral: 'water',
  swamp: 'water',
  marsh: 'water',
  sewer: 'water',
  abyss: 'water',
  beach: 'water',
  cave: 'dark',
  dungeon: 'dark',
  graveyard: 'dark',
  ruins: 'dark',
  blood: 'dark',
  shadow: 'dark',
  catacomb: 'dark',
  battlefield: 'dark',
  dirt: 'soil',
  wood: 'soil',
  temple: 'soil',
  library: 'soil',
  desert: 'soil',
  ashland: 'soil',
  canyon: 'soil',
  sandstone: 'soil',
  saltflat: 'soil',
};

const FLOOR_GROUP_LABEL = {
  nature: 'Natureza',
  element: 'Elemental',
  water: 'Aquático',
  dark: 'Sombrio',
  soil: 'Solo',
};

/** Chave de textura Phaser do chão (dirt usa arena_brick). */
const FLOOR_TEXTURE = {
  dirt: 'arena_brick',
  grass: 'arena_grass',
  ice: 'arena_ice',
  wood: 'arena_wood',
  sea: 'arena_sea',
  desert: 'arena_desert',
  swamp: 'arena_swamp',
  volcano: 'arena_volcano',
  ruins: 'arena_ruins',
  crystal: 'arena_crystal',
  snow: 'arena_snow',
  tundra: 'arena_tundra',
  cave: 'arena_cave',
  dungeon: 'arena_dungeon',
  graveyard: 'arena_graveyard',
  hell: 'arena_hell',
  sky: 'arena_sky',
  mushroom: 'arena_mushroom',
  jungle: 'arena_jungle',
  mountain: 'arena_mountain',
  beach: 'arena_beach',
  coral: 'arena_coral',
  ashland: 'arena_ashland',
  enchanted: 'arena_enchanted',
  blood: 'arena_blood',
  shadow: 'arena_shadow',
  temple: 'arena_temple',
  sewer: 'arena_sewer',
  meadow: 'arena_meadow',
  lava_field: 'arena_lava_field',
  glacier: 'arena_glacier',
  oasis: 'arena_oasis',
  canyon: 'arena_canyon',
  marsh: 'arena_marsh',
  aurora: 'arena_aurora',
  obsidian: 'arena_obsidian',
  sandstone: 'arena_sandstone',
  storm: 'arena_storm',
  garden: 'arena_garden',
  battlefield: 'arena_battlefield',
  library: 'arena_library',
  catacomb: 'arena_catacomb',
  abyss: 'arena_abyss',
  bramble: 'arena_bramble',
  saltflat: 'arena_saltflat',
};

const TIER_LABEL = {
  normal: 'Normal',
  elite: 'Elite',
  boss: 'Boss',
};

const ATTACK_LABEL = {
  melee: 'Corpo a corpo',
  ranged: 'À distância',
  caster: 'Conjurador',
};

/** Catálogo de monstros para a galeria (defs do servidor + rótulos). */
export function getMonsterEntries() {
  const defs = createMonsterTypeDefs({
    MONSTER_WEIGHT_COMMON: 1,
    MONSTER_WEIGHT_ELITE: 1,
    MONSTER_WEIGHT_BOSS: 1,
  });

  const order = { normal: 0, elite: 1, boss: 2 };
  return Object.entries(defs)
    .map(([id, def]) => {
      const tier = def.isBoss ? 'boss' : def.isElite ? 'elite' : 'normal';
      const spells = Array.isArray(def.spells) ? [...def.spells] : [];
      return {
        id,
        name: monsterLabel(id),
        tier,
        tierLabel: TIER_LABEL[tier],
        attack: def.attack || 'melee',
        attackLabel: ATTACK_LABEL[def.attack] || def.attack || 'Corpo a corpo',
        projectile: def.projectile || null,
        spells,
        spellNames: spells.map((s) => spellDisplayName(s)),
        color: def.color ?? 0xffffff,
      };
    })
    .sort((a, b) => {
      const d = (order[a.tier] ?? 9) - (order[b.tier] ?? 9);
      if (d !== 0) return d;
      return a.name.localeCompare(b.name, 'pt');
    });
}

/** Catálogo de magias (básicas + ultimates). */
export function getSpellEntries() {
  const basics = Object.values(SPELLS).map((s) => spellEntryFromDef(s));
  const ultimates = Object.values(ULTIMATES).map((s) =>
    spellEntryFromDef({ ...s, type: 'ultimate' })
  );

  const order = { basic: 0, innate: 1, monster: 2, ultimate: 3, boss: 4 };
  return [...basics, ...ultimates].sort((a, b) => {
    const r = (order[a.category] ?? 9) - (order[b.category] ?? 9);
    if (r !== 0) return r;
    return a.name.localeCompare(b.name, 'pt');
  });
}

function spellCategory(s) {
  if (s.type === 'ultimate') return 'ultimate';
  if (s.bossOnly) return 'boss';
  if (s.innate) return 'innate';
  if (s.playerUsable === false) return 'monster';
  return 'basic';
}

function spellTypeLabel(s) {
  const labels = {
    ultimate: 'Ultimate',
    boss: 'Boss',
    innate: 'Inata',
    monster: 'Monstro',
    basic: 'Básica',
  };
  return labels[spellCategory(s)] || 'Básica';
}

function spellEntryFromDef(s) {
  const category = spellCategory(s);
  return {
    id: s.id,
    name: s.name,
    description: s.description || '',
    type: s.type || 'basic',
    category,
    typeLabel: spellTypeLabel(s),
    color: s.color ?? 0xffffff,
    playerUsable: s.playerUsable !== false,
    bossOnly: !!s.bossOnly,
    innate: !!s.innate,
  };
}

export function spellDisplayName(id) {
  return SPELLS[id]?.name || ULTIMATES[id]?.name || id;
}

export function spellColor(id) {
  return SPELLS[id]?.color ?? ULTIMATES[id]?.color ?? 0xffffff;
}

/** Catálogo de terrenos da arena para a galeria. */
export function getFloorEntries() {
  const groupOrder = { nature: 0, element: 1, water: 2, dark: 3, soil: 4 };
  return Object.keys(FLOOR_META)
    .map((id) => {
      const meta = FLOOR_META[id];
      const speedMul = FLOOR_SPEED_MUL[id] ?? 1;
      const inertiaMul = FLOOR_INERTIA_MUL[id] ?? 1;
      const group = FLOOR_GROUP_OF[id] || 'soil';
      return {
        id,
        name: meta.name,
        group,
        groupLabel: FLOOR_GROUP_LABEL[group] || 'Solo',
        color: meta.color ?? 0xa99bc8,
        textureKey: FLOOR_TEXTURE[id] || 'arena_brick',
        speedMul,
        inertiaMul,
        description: floorDescription(speedMul, inertiaMul),
        typeLabel: FLOOR_GROUP_LABEL[group] || 'Solo',
      };
    })
    .sort((a, b) => {
      const d = (groupOrder[a.group] ?? 9) - (groupOrder[b.group] ?? 9);
      if (d !== 0) return d;
      return a.name.localeCompare(b.name, 'pt');
    });
}

export function floorDisplayName(id) {
  return FLOOR_META[id]?.name || id;
}
