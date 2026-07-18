import { createMonsterTypeDefs } from '../../../server/monsterTypes.js';
import { SPELLS, ULTIMATES } from '../../../server/spells.js';
import { monsterLabel } from './monsterLabels.js';

const DIFFICULTY_LABEL = {
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
    .map(([id, def]) => ({
      id,
      name: monsterLabel(id),
      difficulty: def.difficulty || 'normal',
      difficultyLabel: DIFFICULTY_LABEL[def.difficulty] || def.difficulty || 'Normal',
      attack: def.attack || 'melee',
      attackLabel: ATTACK_LABEL[def.attack] || def.attack || 'Corpo a corpo',
      projectile: def.projectile || null,
      spells: Array.isArray(def.spells) ? [...def.spells] : [],
      color: def.color ?? 0xffffff,
    }))
    .sort((a, b) => {
      const d = (order[a.difficulty] ?? 9) - (order[b.difficulty] ?? 9);
      if (d !== 0) return d;
      return a.name.localeCompare(b.name, 'pt');
    });
}

/** Catálogo de magias (básicas + ultimates). */
export function getSpellEntries() {
  const basics = Object.values(SPELLS).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description || '',
    type: s.type || 'basic',
    typeLabel: spellTypeLabel(s),
    color: s.color ?? 0xffffff,
    playerUsable: s.playerUsable !== false,
    bossOnly: !!s.bossOnly,
    innate: !!s.innate,
  }));

  const ultimates = Object.values(ULTIMATES).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description || '',
    type: 'ultimate',
    typeLabel: 'Ultimate',
    color: s.color ?? 0xffffff,
    playerUsable: s.playerUsable !== false,
    bossOnly: false,
    innate: false,
  }));

  return [...basics, ...ultimates].sort((a, b) => {
    const rank = (e) => {
      if (e.type === 'ultimate') return 2;
      if (e.bossOnly) return 3;
      if (e.playerUsable === false) return 1;
      return 0;
    };
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return a.name.localeCompare(b.name, 'pt');
  });
}

function spellTypeLabel(s) {
  if (s.type === 'ultimate') return 'Ultimate';
  if (s.bossOnly) return 'Boss';
  if (s.innate) return 'Inata';
  if (s.playerUsable === false) return 'Monstro';
  return 'Básica';
}

export function spellDisplayName(id) {
  return SPELLS[id]?.name || ULTIMATES[id]?.name || id;
}
