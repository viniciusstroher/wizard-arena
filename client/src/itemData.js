/**
 * Catálogo de items gerados — 60 itens por slot (360 equipamentos).
 * Nomes e temas inspirados em D&D, Tibia e WoW.
 * Bônus são determinísticos (baseados em índices, não Math.random).
 *
 * Exporta buildGeneratedItems() que retorna entries [id, def] para mesclar em ITEM_DEFS.
 */

const SLOTS = ['hat','cape','ring','tunic','necklace','boots'];

// 10 tiers com cores e níveis
const TIERS = [
  { key:'t1',  lv:1,  n:'Pano',     mat:'cloth',     set:'conjunto_de_pano',    c:0xc4b59a },
  { key:'t2',  lv:5,  n:'Couro',     mat:'leather',    set:'conjunto_de_couro',   c:0x9b7a4b },
  { key:'t3',  lv:10, n:'Bronze',    mat:'bronze',     set:'conjunto_de_bronze',  c:0xcd7f32 },
  { key:'t4',  lv:15, n:'Ferro',     mat:'iron',       set:'conjunto_de_ferro',   c:0x7c6e62 },
  { key:'t5',  lv:20, n:'Prata',     mat:'silver',     set:'conjunto_de_prata',   c:0xb0b8c4 },
  { key:'t6',  lv:30, n:'Ouro',      mat:'gold',       set:'conjunto_de_ouro',    c:0xd8b038 },
  { key:'t7',  lv:40, n:'Cristal',   mat:'crystal',    set:'conjunto_de_cristal', c:0x80e0b0 },
  { key:'t8',  lv:50, n:'Safira',    mat:'sapphire',   set:'conjunto_de_safira',  c:0x2058d0 },
  { key:'t9',  lv:65, n:'Mitril',    mat:'mythril',    set:'conjunto_de_mitril',  c:0x48a8c0 },
  { key:'t10', lv:80, n:'Divino',    mat:'divine',     set:'conjunto_divino',     c:0xefc820 },
];

// Nomes por slot em português
const S = {
  hat:      ['Chapéu','Coroa','Tiara','Capuz','Elmo','Mitra','Diadema','Coifa','Gorro','Toucado'],
  cape:     ['Capa','Manto','Sobre-capa','Mantle','Pelerine','Loriga','Murça','Clâmide','Pálio','Véu'],
  ring:     ['Anel','Selo','Banda','Aliança','Argola','Aro','Elo','Anel de Sinete','Círculo','Grilhão'],
  necklace: ['Colar','Amuleto','Pingente','Talismã','Gargantilha','Medalhão','Colar de Contas','Escapulário','Relicário','Rosário'],
  tunic:    ['Túnica','Veste','Robe','Sobretúnica','Armadura Arcana','Cota Arcana','Vestimenta','Hábito','Casula','Sotaina'],
  boots:    ['Botas','Sapatos','Sandálias','Grevas','Calçados','Pisantes','Botinas','Sapatilhas','Alpercatas','Galochas'],
};

// Sufixos temáticos — D&D, Tibia, WoW + originais
const SUFFIX_DND     = ['Arcano','das Chamas','do Gelo','dos Raios','Sombrio','da Luz','da Terra','do Vento','da Água','do Caos'];
const SUFFIX_TIBIA   = ['do Druida','do Mago','do Paladino','do Cavaleiro','do Caçador','do Alquimista','do Necromante','do Xamã'];
const SUFFIX_WOW     = ['do Portal','de Dalaran','de Quel\'Thalas','de Ventobravo','da Horda','da Aliança','do Trovão','de Luar Lívido','do Templo Negro','de Corvinal'];
const SUFFIX_SET     = ['do Aprendiz','do Viajante','do Guardião','do Baluarte','do Sábio','do Arquimago','do Vidente','do Ilusionista','do Arconte','do Transcendente'];

// FNV-1a determinístico — seed baseado em índice do item
function fhash(h) {
  h ^= 2747636419;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) % 1000 / 1000; // 0..0.999
}

/** Valor de bônus entre 60% e 140% do base (determinístico). */
function bval(seed, base) {
  const r = fhash(seed);
  return +((base + (r - 0.5) * base * 0.6)).toFixed(3);
}

/** Pools de bônus por slot (o que faz sentido tematicamente). */
const POOLS = {
  hat:      ['damageBonus','xpBonus','rangeBonus'],
  cape:     ['speedBonus','rangeBonus','slowResist'],
  ring:     ['damageBonus','radiusBonus','cooldownReduction'],
  tunic:    ['maxHpBonus','shieldBonus','poisonResist','burnResist'],
  necklace: ['healBonus','shieldBonus','cooldownReduction'],
  boots:    ['speedBonus','slowResist','maxHpBonus'],
};

const POOL_WEIGHTS = {
  hat:      { damageBonus:3, xpBonus:3, rangeBonus:2 },
  cape:     { speedBonus:3, rangeBonus:2, slowResist:3 },
  ring:     { damageBonus:4, radiusBonus:2, cooldownReduction:3 },
  tunic:    { maxHpBonus:3, shieldBonus:3, poisonResist:2, burnResist:2 },
  necklace: { healBonus:3, shieldBonus:3, cooldownReduction:3 },
  boots:    { speedBonus:4, slowResist:3, maxHpBonus:2 },
};

function weightedPick(pool, weights, seed) {
  const total = Object.values(weights).reduce((a,b)=>a+b,0);
  const keys = Object.keys(weights);
  let r = fhash(seed);
  let acc = 0;
  for (const k of keys) {
    acc += weights[k] / total;
    if (r <= acc) return k;
  }
  return keys[keys.length-1];
}

/** Escolhe 1-3 bônus determinísticos para um item. */
function mkBonus(slot, idx, tierBase, countSeed) {
  const pool = POOLS[slot];
  const weights = POOL_WEIGHTS[slot];
  const numBonuses = (idx < 2) ? 1 : (idx < 4) ? 2 : 3;
  const bonus = {};
  const used = new Set();
  for (let b = 0; b < numBonuses; b++) {
    let key;
    let attempts = 0;
    do {
      key = weightedPick(pool, weights, countSeed * 100 + b * 37 + idx * 13);
      attempts++;
    } while (used.has(key) && attempts < 20);
    if (used.has(key)) break;
    used.add(key);
    const v = bval(countSeed * 1000 + b * 23, tierBase);
    if (v > 0) bonus[key] = v;
  }
  return Object.keys(bonus).length ? bonus : null;
}

/** Retorna sufixo temático baseado no índice do item dentro da tier. */
function itemSuffix(idx, tierIdx) {
  if (idx === 0) return SUFFIX_SET[tierIdx];                           // set item
  if (idx === 1) return SUFFIX_DND[tierIdx % SUFFIX_DND.length];       // D&D
  if (idx === 2) return SUFFIX_TIBIA[tierIdx % SUFFIX_TIBIA.length];   // Tibia
  if (idx === 3) return SUFFIX_WOW[tierIdx % SUFFIX_WOW.length];       // WoW
  if (idx === 4) return SUFFIX_DND[(tierIdx + 3) % SUFFIX_DND.length]; // D&D 2
  return SUFFIX_TIBIA[(tierIdx + 2) % SUFFIX_TIBIA.length];            // Tibia 2
}

/** Gera todos os 360 itens e retorna como array de [id, def]. */
export function buildGeneratedItems() {
  const items = [];

  for (let ti = 0; ti < TIERS.length; ti++) {
    const tier = TIERS[ti];
    // Base de bônus cresce com o tier (itens melhores em tiers altos)
    const bonusBase = 0.008 + tier.lv * 0.0016;

    for (const slot of SLOTS) {
      const names = S[slot];
      const pool = POOLS[slot];

      for (let i = 0; i < 6; i++) {
        // ID: tier_key + slot + index (ex: t1_hat_0, t2_cape_3)
        const itemId = `${tier.key}_${slot}_${i}`;
        const globalIdx = ti * 100 + SLOTS.indexOf(slot) * 10 + i + 1;

        // Nome com variação
        const baseName = names[(ti + i) % names.length];
        const suffix = itemSuffix(i, ti);
        const fullName = `${tier.n} ${baseName} ${suffix}`;

        // Cor com variação determinística por índice
        const colorVar = (fhash(globalIdx * 7) - 0.5) * 0x1a1a1a;
        const color = (tier.c + Math.round(colorVar)) >>> 0;

        // Bônus determinísticos
        const bonus = mkBonus(slot, i, bonusBase, globalIdx);

        // Set apenas para índice 0 (1 item set por slot por tier)
        const set = i === 0 ? tier.set : null;

        const def = {
          id: itemId,
          name: fullName,
          category: 'equipment',
          slot,
          color,
          level: tier.lv,
          bonus: bonus || undefined,
        };
        if (set) def.set = set;

        items.push([itemId, def]);
      }
    }
  }

  // Verificação: deve ter 360 itens
  // 10 tiers × 6 slots × 6 itens per slot per tier = 360
  return items;
}

export { TIERS, SLOTS };
