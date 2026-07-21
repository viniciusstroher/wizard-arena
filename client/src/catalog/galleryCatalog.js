import { createMonsterTypeDefs } from '../../../server/monsterTypes.js';
import { SPELLS, ULTIMATES } from '../../../server/spells.js';
import {
  spellElementId,
  spellElementLabel,
  spellElementColor,
  spellElementCssColor,
} from './spellElements.js';
import { monsterLabel } from './monsterLabels.js';
import { formatResistancesLine, resistanceDetails } from './monsterResistances.js';
import {
  FLOOR_SPEED_MUL,
  FLOOR_INERTIA_MUL,
  FLOOR_META,
  floorDescription,
} from './statusEffects.js';
import { ITEM_DEFS } from '../inventory.js';

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
  crystal_cave: 'dark',
  bat_cave: 'dark',
  vampire_castle: 'dark',
  throne_hall: 'dark',
  crypt: 'dark',
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
  crystal_cave: 'arena_crystal_cave',
  bat_cave: 'arena_bat_cave',
  vampire_castle: 'arena_vampire_castle',
  throne_hall: 'arena_throne_hall',
  crypt: 'arena_crypt',
};

/** Pack de obstáculos por terreno (espelha server/Match.typesByFloor). */
const FLOOR_OBSTACLE_PACK = {
  grass: 'dirt',
  dirt: 'dirt',
  ice: 'ice',
  wood: 'wood',
  sea: 'sea',
  desert: 'desert',
  swamp: 'swamp',
  volcano: 'volcano',
  ruins: 'ruins',
  crystal: 'crystal',
  snow: 'ice',
  tundra: 'ice',
  cave: 'dirt',
  dungeon: 'wood',
  graveyard: 'ruins',
  hell: 'volcano',
  sky: 'crystal',
  mushroom: 'swamp',
  jungle: 'dirt',
  mountain: 'dirt',
  beach: 'sea',
  coral: 'sea',
  ashland: 'volcano',
  enchanted: 'crystal',
  blood: 'ruins',
  shadow: 'crystal',
  temple: 'ruins',
  sewer: 'swamp',
  meadow: 'dirt',
  lava_field: 'volcano',
  glacier: 'ice',
  oasis: 'desert',
  canyon: 'dirt',
  marsh: 'swamp',
  aurora: 'crystal',
  obsidian: 'volcano',
  sandstone: 'ruins',
  storm: 'crystal',
  garden: 'dirt',
  battlefield: 'ruins',
  library: 'wood',
  catacomb: 'ruins',
  abyss: 'sea',
  bramble: 'dirt',
  saltflat: 'desert',
  crystal_cave: 'crystal',
  bat_cave: 'dirt',
  vampire_castle: 'wood',
  throne_hall: 'wood',
  crypt: 'ruins',
};

/** Estilo de árvore: null = sem árvores. */
const FLOOR_TREE_STYLE = {
  grass: 'forest',
  swamp: 'swamp',
  jungle: 'forest',
  mushroom: 'swamp',
  enchanted: 'forest',
  meadow: 'forest',
  tundra: 'cold',
  marsh: 'swamp',
  garden: 'forest',
  bramble: 'forest',
  oasis: 'forest',
};

const OBSTACLE_PACK_TYPES = {
  dirt: [
    { type: 'stone', radius: 12 },
    { type: 'rock', radius: 18 },
    { type: 'boulder', radius: 26 },
  ],
  ice: [
    { type: 'ice_stone', radius: 12 },
    { type: 'ice_rock', radius: 18 },
    { type: 'ice_boulder', radius: 26 },
  ],
  wood: [
    { type: 'chair', radius: 12 },
    { type: 'crate', radius: 14 },
    { type: 'table', radius: 18 },
    { type: 'cabinet', radius: 26 },
  ],
  sea: [
    { type: 'shell', radius: 12 },
    { type: 'conch', radius: 18 },
    { type: 'clam', radius: 26 },
  ],
  desert: [
    { type: 'cactus_small', radius: 12 },
    { type: 'cactus', radius: 18 },
    { type: 'cactus_tall', radius: 26 },
  ],
  swamp: [
    { type: 'puddle_small', radius: 14 },
    { type: 'puddle', radius: 20 },
    { type: 'puddle_large', radius: 28 },
  ],
  volcano: [
    { type: 'ember_stone', radius: 12 },
    { type: 'lava_rock', radius: 18 },
    { type: 'obsidian', radius: 26 },
  ],
  ruins: [
    { type: 'rubble', radius: 12 },
    { type: 'broken_pillar', radius: 18 },
    { type: 'statue', radius: 26 },
  ],
  crystal: [
    { type: 'crystal_small', radius: 12 },
    { type: 'crystal', radius: 18 },
    { type: 'crystal_large', radius: 26 },
  ],
};

const TREE_STYLE_TYPES = {
  forest: [
    { type: 'pine', radius: 14 },
    { type: 'oak', radius: 16 },
    { type: 'bush', radius: 10 },
  ],
  swamp: [
    { type: 'mangrove', radius: 14 },
    { type: 'swamp_oak', radius: 16 },
    { type: 'swamp_bush', radius: 10 },
  ],
  cold: [
    { type: 'pine', radius: 14 },
    { type: 'pine', radius: 16 },
    { type: 'bush', radius: 10 },
  ],
};

const TIER_LABEL = {
  normal: 'Normal',
  elite: 'Elite',
  boss: 'Boss',
};

const ATTACK_LABEL = {
  melee: 'Paulada',
  ranged: 'À distância',
  caster: 'Conjurador',
};

/** Texture key Phaser do ícone de tipo de ataque (`attack_melee`, etc.). */
export function attackIconKey(attack) {
  const id = ATTACK_LABEL[attack] ? attack : 'melee';
  return `attack_${id}`;
}

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
      const spellDetails = spells.map((sid) => {
        const element = spellElementId(sid);
        return {
          id: sid,
          name: spellDisplayName(sid),
          element,
          elementLabel: spellElementLabel(element),
          elementColor: spellElementColor(element),
          elementCss: spellElementCssColor(element),
        };
      });
      const resistances = def.resistances || {};
      const resistDetails = resistanceDetails(resistances);
      return {
        id,
        name: monsterLabel(id),
        tier,
        tierLabel: TIER_LABEL[tier],
        attack: def.attack || 'melee',
        attackLabel: ATTACK_LABEL[def.attack] || def.attack || 'Paulada',
        attackIconKey: attackIconKey(def.attack || 'melee'),
        projectile: def.projectile || null,
        projectileLabel: def.projectile
          ? spellDisplayName(def.projectile) || def.projectile.replace(/_/g, ' ')
          : null,
        spells,
        spellDetails,
        spellNames: spellDetails.map((s) => s.name),
        resistances,
        resistDetails,
        resistLine: formatResistancesLine(resistances),
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
  const element = s.element || spellElementId(s.id);
  return {
    id: s.id,
    name: s.name,
    description: s.description || '',
    type: s.type || 'basic',
    category,
    typeLabel: spellTypeLabel(s),
    element,
    elementLabel: spellElementLabel(element),
    elementColor: spellElementColor(element),
    elementCss: spellElementCssColor(element),
    color: s.color ?? 0xffffff,
    playerUsable: s.playerUsable !== false,
    bossOnly: !!s.bossOnly,
    innate: !!s.innate,
  };
}

export function spellDisplayName(id) {
  return (
    SPELLS[id]?.name ||
    ULTIMATES[id]?.name ||
    String(id || '')
      .split('_')
      .filter(Boolean)
      .join(' ')
  );
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
      const pack = FLOOR_OBSTACLE_PACK[id] || 'dirt';
      const treeStyle = FLOOR_TREE_STYLE[id] || null;
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
        obstaclePack: pack,
        obstacles: OBSTACLE_PACK_TYPES[pack] || OBSTACLE_PACK_TYPES.dirt,
        treeStyle,
        trees: treeStyle ? TREE_STYLE_TYPES[treeStyle] || TREE_STYLE_TYPES.forest : [],
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

/** Catálogo de minérios para a galeria. */
export function getOreEntries() {
  const ores = [];
  for (const def of Object.values(ITEM_DEFS)) {
    if (def.slot !== 'ore') continue;
    ores.push({
      id: def.id,
      name: def.name,
      color: def.color,
      textureKey: `ore_${def.id.replace('_ore', '')}`,
    });
  }
  return ores.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}
