/**
 * Catálogo de equipamentos — 60 itens por slot (360 total).
 * Baseado nos itens originais: Chapéu de Pano, Capa de Pano, Anel de Plástico...
 * Cada tier tem 1 item de conjunto + 5 variações temáticas (D&D, Tibia, WoW).
 *
 * Estrutura: { id, name, slot, color, level, set?, bonus? }
 *   bonus — { damageBonus, healBonus, shieldBonus, speedBonus,
 *              rangeBonus, radiusBonus, slowResist, poisonResist,
 *              burnResist, maxHpBonus, xpBonus, cooldownReduction }
 */

const SLOTS = ['hat', 'cape', 'ring', 'tunic', 'necklace', 'boots', 'cajado', 'grimorio'];

// 10 tiers — cores realistas baseadas nos materiais

const FEMININE_WORDS = new Set([
  'Diadema', 'Tiara', 'Coifa', 'Mitra', 'Loriga', 'Murça', 'Clâmide', 'Sobrecapa',
  'Pelerine', 'Aliança', 'Argola', 'Banda', 'Aliança Mística', 'Túnica', 'Veste',
  'Vestimenta', 'Armadura Arcana', 'Cota Arcana', 'Casula', 'Sotaina', 'Botas',
  'Sandálias', 'Grevas', 'Botinas', 'Sapatilhas', 'Alpercatas', 'Galochas',
  'Capa', 'Sobre-capa', 'Mantle', 'Véu', 'Pálio',
]);

function isFeminine(name) {
  if (FEMININE_WORDS.has(name)) return true;
  const lastChar = name[name.length - 1];
  if (lastChar === 'a' || lastChar === 'ã') return true;
  if (lastChar === 's' && name.length > 1) {
    const prev = name[name.length - 2];
    if (prev === 'a' || prev === 'ã') return true;
  }
  return false;
}

const TIERS = [
  { key: 't1',  lv: 1,  mat: 'Pano',     set: 'conjunto_de_pano',    title: 'do Aprendiz',      c: 0xc4b59a, adj: false },
  { key: 't2',  lv: 5,  mat: 'Couro',    set: 'conjunto_de_couro',   title: 'do Viajante',      c: 0x9b7a4b, adj: false },
  { key: 't3',  lv: 10, mat: 'Bronze',   set: 'conjunto_de_bronze',  title: 'do Guardião',      c: 0xcd7f32, adj: false },
  { key: 't4',  lv: 15, mat: 'Ferro',    set: 'conjunto_de_ferro',   title: 'do Baluarte',      c: 0x7c6e62, adj: false },
  { key: 't5',  lv: 20, mat: 'Prata',    set: 'conjunto_de_prata',   title: 'do Sábio',         c: 0xb0b8c4, adj: false },
  { key: 't6',  lv: 30, mat: 'Ouro',     set: 'conjunto_de_ouro',    title: 'do Arquimago',     c: 0xd8b038, adj: false },
  { key: 't7',  lv: 40, mat: 'Cristal',  set: 'conjunto_de_cristal', title: 'do Vidente',       c: 0x80e0b0, adj: false },
  { key: 't8',  lv: 50, mat: 'Safira',   set: 'conjunto_de_safira',  title: 'do Ilusionista',   c: 0x2058d0, adj: false },
  { key: 't9',  lv: 65, mat: 'Mitril',   set: 'conjunto_de_mitril',  title: 'do Arconte',       c: 0x48a8c0, adj: false },
  { key: 't10', lv: 80, mat: 'Divino',   set: 'conjunto_divino',     title: 'do Transcendente', c: 0xefc820, adj: true  },
];

/**
 * Nomes base por slot: 3 grupos de prestígio (simples / médio / nobre).
 * O tier define qual grupo usar: T1-3 = simples, T4-6 = médio, T7-10 = nobre.
 */
const BASE_NAMES = {
  hat: {
    set:      ['Chapéu',         'Coroa',        'Diadema'],
    setMid:   ['Chapéu',         'Mitra',        'Diadema'],
    alt:      ['Capuz', 'Tiara', 'Elmo', 'Coifa', 'Gorro', 'Toucado', 'Mitra', 'Chapéu de Pico', 'Capelo', 'Cocar'],
  },
  cape: {
    set:      ['Capa',           'Manto',        'Manto Arcano'],
    setMid:   ['Capa',           'Manto',        'Manto Arcano'],
    alt:      ['Sobrecapa', 'Pelerine', 'Loriga', 'Clâmide', 'Mantle', 'Véu', 'Pálio', 'Murça', 'Manto de Seda', 'Manto Sombrio'],
  },
  ring: {
    set:      ['Anel',           'Selo',         'Aliança'],
    setMid:   ['Anel',           'Anel de Sinete','Aliança Mística'],
    alt:      ['Banda', 'Aro', 'Elo', 'Argola', 'Círculo', 'Anel de Sinete', 'Anel de Poder', 'Grilhão', 'Selo Arcano', 'Anel de Luz'],
  },
  tunic: {
    set:      ['Túnica',         'Veste',        'Robe'],
    setMid:   ['Túnica',         'Armadura Arcana','Robe Arcano'],
    alt:      ['Vestimenta', 'Sobretúnica', 'Hábito', 'Cota Arcana', 'Casula', 'Sotaina', 'Manto de Batalha', 'Veste Arcana', 'Túnica Rúnica', 'Robe Sagrado'],
  },
  necklace: {
    set:      ['Colar',          'Amuleto',      'Talismã'],
    setMid:   ['Colar',          'Pingente',     'Medalhão'],
    alt:      ['Gargantilha', 'Pingente', 'Medalhão', 'Talismã', 'Amuleto', 'Escapulário', 'Relicário', 'Rosário', 'Colar de Contas', 'Colar de Runas'],
  },
  boots: {
    set:      ['Botas',          'Sapatos',      'Grevas'],
    setMid:   ['Botas',          'Pisantes',     'Grevas'],
    alt:      ['Sandálias', 'Calçados', 'Pisantes', 'Botinas', 'Sapatilhas', 'Alpercatas', 'Galochas', 'Botas de Viagem', 'Botas de Salto', 'Botas de Camurça'],
  },
  cajado: {
    set:      ['Cajado',         'Bastão',       'Cetro'],
    setMid:   ['Cajado',         'Bastão Arcano','Cetro Místico'],
    alt:      ['Vara', 'Báculo', 'Bastão', 'Cetro', 'Cajado Rúnico', 'Cetro de Poder', 'Bastão de Luz', 'Cajado Sombrio', 'Varinha', 'Cajado Arcano'],
  },
  grimorio: {
    set:      ['Grimório',       'Livro',        'Tomo'],
    setMid:   ['Grimório',       'Livro Arcano', 'Tomo Místico'],
    alt:      ['Códex', 'Pergaminho', 'Livro de Runas', 'Tomo', 'Grimório das Sombras', 'Escritura', 'Manual Arcano', 'Códex Sombrio', 'Livro Antigo', 'Grimório Sagrado'],
  },
};

function prestigeGroup(tierIdx) {
  if (tierIdx < 3) return 0;      // simples
  if (tierIdx < 6) return 1;      // médio
  return 2;                        // nobre
}

// Temas por índice (0 = set, 1-2 = D&D, 3-4 = Tibia, 5 = WoW)
const THEMES = [
  // D&D — elementos e escolas
  { sufix: 'Arcano',           sufixLong: 'do Fogo Arcano' },
  { sufix: 'das Chamas',       sufixLong: 'do Gelo Eterno' },
  { sufix: 'dos Raios',        sufixLong: 'da Tempestade' },
  { sufix: 'Sombrio',          sufixLong: 'das Sombras' },
  { sufix: 'da Luz',           sufixLong: 'da Luz Sagrada' },
  { sufix: 'da Terra',         sufixLong: 'da Terra Firme' },
  { sufix: 'do Vento',         sufixLong: 'do Vento Cortante' },
  { sufix: 'da Água',          sufixLong: 'das Profundezas' },
  { sufix: 'do Caos',          sufixLong: 'do Caos Primordial' },
  { sufix: 'do Vazio',         sufixLong: 'do Vazio Estelar' },
  // Tibia — classes e vocações
  { sufix: 'do Druida',        sufixLong: 'do Sábio Druida' },
  { sufix: 'do Mago',          sufixLong: 'do Arquimago' },
  { sufix: 'do Paladino',      sufixLong: 'do Paladino Sagrado' },
  { sufix: 'do Cavaleiro',     sufixLong: 'do Cavaleiro Andante' },
  { sufix: 'do Caçador',       sufixLong: 'do Caçador Sombrio' },
  { sufix: 'do Alquimista',    sufixLong: 'do Alquimista Arcano' },
  { sufix: 'do Necromante',    sufixLong: 'do Necromante das Sombras' },
  { sufix: 'do Xamã',          sufixLong: 'do Xamã Espiritual' },
  // WoW — locais lendários
  { sufix: 'do Portal',        sufixLong: 'de Dalaran' },
  { sufix: 'de Ventobravo',    sufixLong: 'do Templo Negro' },
  { sufix: 'da Horda',         sufixLong: 'da Aliança' },
  { sufix: 'de Corvinal',      sufixLong: 'de Luar Lívido' },
  { sufix: 'do Trovão',        sufixLong: 'do Trono de Gelo' },
  { sufix: 'de Quel\'Thalas',  sufixLong: 'do Sol Poente' },
];

// FNV hash determinístico para bônus
function fhash(h) {
  h ^= 2747636419;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) % 1000 / 1000;
}

/** Valor de bônus: base +- 30% determinístico */
function bval(seed, base) {
  const r = fhash(seed);
  return +((base + (r - 0.5) * base * 0.6)).toFixed(3);
}

/** Pools temáticos por slot */
const POOLS = {
  hat:      ['damageBonus', 'xpBonus', 'rangeBonus'],
  cape:     ['speedBonus', 'rangeBonus', 'slowResist'],
  ring:     ['damageBonus', 'radiusBonus', 'cooldownReduction'],
  tunic:    ['maxHpBonus', 'shieldBonus', 'poisonResist', 'burnResist'],
  necklace: ['healBonus', 'shieldBonus', 'cooldownReduction'],
  boots:    ['speedBonus', 'slowResist', 'maxHpBonus'],
  cajado:   ['damageBonus', 'multishot', 'rangeBonus', 'cooldownReduction', 'speedBonus'],
  grimorio: ['damageBonus', 'healBonus', 'shieldBonus', 'cooldownReduction', 'radiusBonus', 'rangeBonus'],
};

/** Gera bônus para um item (1-3 stats determinísticos) */
function mkBonus(slot, seed, baseVal, count) {
  const pool = POOLS[slot];
  const bonus = {};
  const used = new Set();
  for (let b = 0; b < count && b < pool.length; b++) {
    const pickIdx = Math.floor(fhash(seed * 73 + b * 41) * pool.length) % pool.length;
    const key = pool[pickIdx];
    if (used.has(key)) continue;
    used.add(key);
    if (key === 'multishot') {
      const msVal = 2 + Math.floor(fhash(seed * 777 + b * 31) * 4); // 2-5
      if (msVal > 0) bonus[key] = msVal;
    } else {
      const v = bval(seed * 1000 + b * 23, baseVal);
      if (v > 0) bonus[key] = v;
    }
  }
  return Object.keys(bonus).length ? bonus : null;
}

/** Retorna o sufixo para itens não-set baseado no tema */
function getSuffix(themeIdx, long) {
  const t = THEMES[themeIdx % THEMES.length];
  return long ? t.sufixLong : t.sufix;
}

/** Gera todos os 360 itens */
export function buildGeneratedItems() {
  const items = [];

  for (let ti = 0; ti < TIERS.length; ti++) {
    const tier = TIERS[ti];
    const pg = prestigeGroup(ti);
    const baseBonus = 0.01 + tier.lv * 0.0015;
    const altNameOffset = ti * 3;

    for (const slot of SLOTS) {
      const slotDef = BASE_NAMES[slot];
      const setName = ti < 5 ? slotDef.set[pg] : slotDef.setMid[pg];
      const altNames = slotDef.alt;

      for (let i = 0; i < 6; i++) {
        const itemId = `${tier.key}_${slot}_${i}`;
        const globalIdx = ti * 100 + SLOTS.indexOf(slot) * 10 + i + 1;

        // --- Nome ---
        let name;
        let setTag = null;
        if (i === 0) {
          // Item de conjunto
          if (tier.adj) {
            name = `${setName} ${tier.mat === 'Divino' && isFeminine(setName) ? 'Divina' : tier.mat} ${tier.title}`;
          } else {
            const prep = tier.mat.endsWith('a') ? 'da ' : 'de ';
            name = `${setName} ${prep}${tier.mat} ${tier.title}`;
          }
          setTag = tier.set;
        } else {
          const altIdx = (altNameOffset + i) % altNames.length;
          const baseItemName = altNames[altIdx];
          const themeIdx = ti * 3 + i;
          const suffix = getSuffix(themeIdx, i >= 3);
          if (tier.adj) {
            const adjForm = tier.mat === 'Divino' && isFeminine(baseItemName) ? 'Divina' : tier.mat;
            name = `${baseItemName} ${adjForm} ${suffix}`;
          } else {
            const prep = tier.mat.endsWith('a') ? 'da ' : 'de ';
            name = `${baseItemName} ${prep}${tier.mat} ${suffix}`;
          }
        }

        // --- Cor ---
        const colorVar = (fhash(globalIdx * 7) - 0.5) * 0x222222;
        const color = (tier.c + Math.round(colorVar)) >>> 0;

        // --- Bônus ---
        const numBonuses = i < 2 ? 1 : i < 4 ? 2 : 3;
        const bonus = mkBonus(slot, globalIdx, baseBonus, numBonuses);

        const def = {
          id: itemId,
          name,
          category: 'equipment',
          slot,
          color,
          level: tier.lv,
        };
        if (setTag) def.set = setTag;
        if (bonus) def.bonus = bonus;

        items.push([itemId, def]);
      }
    }
  }

  return items;
}

export { TIERS, SLOTS };
