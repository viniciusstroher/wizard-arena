import { createMonsterTypeDefs } from '../../../server/monsterTypes.js';
import { SPELLS, ULTIMATES } from '../../../server/spells.js';
import { monsterLabel } from './monsterLabels.js';

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
