/**
 * Catálogo de equipamentos — 426 itens por slot (3408 total).
 * Baseado nos itens originais: Chapéu de Pano, Capa de Pano, Anel de Plástico...
 * Cada tier tem 1 item de conjunto + 5 variações temáticas (D&D, Tibia, WoW).
 * 71 tiers cobrindo os níveis 1 a 210, liberando novos itens a cada 3 níveis.
 *
 * Estrutura: { id, name, slot, color, level, set?, bonus? }
 *   bonus — { damageBonus, healBonus, shieldBonus, speedBonus,
 *              rangeBonus, radiusBonus, slowResist, poisonResist,
 *              burnResist, maxHpBonus, xpBonus, cooldownReduction }
 */

const SLOTS = ['hat', 'cape', 'ring', 'tunic', 'necklace', 'boots', 'cajado', 'grimorio'];

// 71 tiers — cores baseadas nos materiais

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

function adjectiveForm(mat, noun) {
  if (isFeminine(noun)) {
    if (mat.endsWith('o')) return mat.slice(0, -1) + 'a';
  }
  return mat;
}

// 21 tiers — nível 1, depois a cada 3 níveis até 60. Libera itens novos a cada 3 níveis.
const TIERS = [
  { key: 't1',  lv: 1,  mat: 'Pano',       set: 'conjunto_de_pano',       title: 'do Aprendiz',     c: 0xc4b59a, adj: false },
  { key: 't2',  lv: 3,  mat: 'Couro',      set: 'conjunto_de_couro',      title: 'do Iniciado',     c: 0x9b7a4b, adj: false },
  { key: 't3',  lv: 6,  mat: 'Osso',       set: 'conjunto_de_osso',       title: 'do Escudeiro',    c: 0xe8e0c8, adj: false },
  { key: 't4',  lv: 9,  mat: 'Bronze',     set: 'conjunto_de_bronze',     title: 'do Viajante',     c: 0xcd7f32, adj: false },
  { key: 't5',  lv: 12, mat: 'Latão',      set: 'conjunto_de_latao',      title: 'do Andarilho',    c: 0xb5a642, adj: false },
  { key: 't6',  lv: 15, mat: 'Ferro',      set: 'conjunto_de_ferro',      title: 'do Guardião',     c: 0x7c6e62, adj: false },
  { key: 't7',  lv: 18, mat: 'Aço',        set: 'conjunto_de_aco',        title: 'do Sentinela',    c: 0x9fa8b0, adj: false },
  { key: 't8',  lv: 21, mat: 'Prata',      set: 'conjunto_de_prata',      title: 'do Baluarte',     c: 0xb0b8c4, adj: false },
  { key: 't9',  lv: 24, mat: 'Ônix',       set: 'conjunto_de_onix',       title: 'do Defensor',     c: 0x2b2b2e, adj: false },
  { key: 't10', lv: 27, mat: 'Ouro',       set: 'conjunto_de_ouro',       title: 'do Sábio',        c: 0xd8b038, adj: false },
  { key: 't11', lv: 30, mat: 'Jade',       set: 'conjunto_de_jade',       title: 'do Erudito',      c: 0x4ba876, adj: false },
  { key: 't12', lv: 33, mat: 'Esmeralda',  set: 'conjunto_de_esmeralda',  title: 'do Arquimago',    c: 0x189d5a, adj: false },
  { key: 't13', lv: 36, mat: 'Rubi',       set: 'conjunto_de_rubi',       title: 'do Feiticeiro',   c: 0xc0392b, adj: false },
  { key: 't14', lv: 39, mat: 'Cristal',    set: 'conjunto_de_cristal',    title: 'do Vidente',      c: 0x80e0b0, adj: false },
  { key: 't15', lv: 42, mat: 'Safira',     set: 'conjunto_de_safira',     title: 'do Oráculo',      c: 0x2058d0, adj: false },
  { key: 't16', lv: 45, mat: 'Mitril',     set: 'conjunto_de_mitril',     title: 'do Ilusionista',  c: 0x48a8c0, adj: false },
  { key: 't17', lv: 48, mat: 'Adamante',   set: 'conjunto_de_adamante',   title: 'do Encantador',   c: 0x6a5acd, adj: false },
  { key: 't18', lv: 51, mat: 'Obsidiana',  set: 'conjunto_de_obsidiana',  title: 'do Arconte',      c: 0x1c1c24, adj: false },
  { key: 't19', lv: 54, mat: 'Platina',    set: 'conjunto_de_platina',    title: 'do Ascendente',   c: 0xd8d8e0, adj: false },
  { key: 't20', lv: 57, mat: 'Éter',       set: 'conjunto_de_eter',       title: 'do Exaltado',     c: 0x8fd9ff, adj: false },
  { key: 't21', lv: 60,  mat: 'Divino',       set: 'conjunto_divino',         title: 'do Transcendente', c: 0xefc820, adj: true  },
  { key: 't22', lv: 63,  mat: 'Astral',       set: 'conjunto_astral',         title: 'do Profeta',        c: 0xb0a0ff, adj: true  },
  { key: 't23', lv: 66,  mat: 'Etéreo',       set: 'conjunto_etereo',         title: 'do Serafim',        c: 0xa0d8ff, adj: true  },
  { key: 't24', lv: 69,  mat: 'Sombrio',      set: 'conjunto_sombrio',        title: 'do Arcanjo',        c: 0x302868, adj: true  },
  { key: 't25', lv: 72,  mat: 'Estelar',      set: 'conjunto_estelar',        title: 'do Querubim',       c: 0x6888e8, adj: true  },
  { key: 't26', lv: 75,  mat: 'Cósmico',      set: 'conjunto_cosmico',        title: 'do Avatar',         c: 0x4828a8, adj: true  },
  { key: 't27', lv: 78,  mat: 'Rúnico',       set: 'conjunto_runico',         title: 'do Semideus',       c: 0x30d8a0, adj: true  },
  { key: 't28', lv: 81,  mat: 'Dracônico',    set: 'conjunto_draconico',      title: 'do Colosso',        c: 0xd04840, adj: true  },
  { key: 't29', lv: 84,  mat: 'Fênix',        set: 'conjunto_de_fenix',       title: 'do Leviatã',        c: 0xff6830, adj: false },
  { key: 't30', lv: 87,  mat: 'Titânico',     set: 'conjunto_titanico',       title: 'do Behemoth',       c: 0xc8a860, adj: true  },
  { key: 't31', lv: 90,  mat: 'Celestial',    set: 'conjunto_celestial',      title: 'do Celeste',        c: 0xf0f0ff, adj: true  },
  { key: 't32', lv: 93,  mat: 'Abissal',      set: 'conjunto_abissal',        title: 'do Abissal',        c: 0x180820, adj: true  },
  { key: 't33', lv: 96,  mat: 'Místico',      set: 'conjunto_mistico',        title: 'do Místico',        c: 0x7848d0, adj: true  },
  { key: 't34', lv: 99,  mat: 'Arcanita',     set: 'conjunto_de_arcanita',    title: 'do Arcanista',      c: 0x60b8c0, adj: false },
  { key: 't35', lv: 102, mat: 'Lunar',        set: 'conjunto_lunar',          title: 'do Luar',           c: 0xc0d8f0, adj: true  },
  { key: 't36', lv: 105, mat: 'Solar',        set: 'conjunto_solar',          title: 'do Eclipse',        c: 0xffb030, adj: true  },
  { key: 't37', lv: 108, mat: 'Tempestuoso',  set: 'conjunto_tempestuoso',    title: 'do Furacão',        c: 0x6090b0, adj: true  },
  { key: 't38', lv: 111, mat: 'Vulcânico',    set: 'conjunto_vulcanico',      title: 'do Vulcão',         c: 0xe05020, adj: true  },
  { key: 't39', lv: 114, mat: 'Glacial',      set: 'conjunto_glacial',        title: 'do Glacial',        c: 0x80c8ff, adj: true  },
  { key: 't40', lv: 117, mat: 'Telúrico',     set: 'conjunto_telurico',       title: 'do Telúrico',       c: 0x887050, adj: true  },
  { key: 't41', lv: 120, mat: 'Espectral',    set: 'conjunto_espectral',      title: 'do Espectro',       c: 0x90a8c0, adj: true  },
  { key: 't42', lv: 123, mat: 'Fantasmal',    set: 'conjunto_fantasmal',      title: 'do Fantasma',       c: 0x708090, adj: true  },
  { key: 't43', lv: 126, mat: 'Demoníaco',    set: 'conjunto_demoniaco',      title: 'do Demoníaco',      c: 0xc02020, adj: true  },
  { key: 't44', lv: 129, mat: 'Angelical',    set: 'conjunto_angelical',      title: 'do Angelical',      c: 0xfff0c0, adj: true  },
  { key: 't45', lv: 132, mat: 'Primordial',   set: 'conjunto_primordial',     title: 'da Criação',        c: 0x40c0a0, adj: true  },
  { key: 't46', lv: 135, mat: 'Ancestral',    set: 'conjunto_ancestral',      title: 'do Ancestral',      c: 0x806040, adj: true  },
  { key: 't47', lv: 138, mat: 'Infinito',     set: 'conjunto_infinito',       title: 'do Infinito',       c: 0x202020, adj: true  },
  { key: 't48', lv: 141, mat: 'Eterno',       set: 'conjunto_eterno',         title: 'do Eterno',         c: 0xc8d8e0, adj: true  },
  { key: 't49', lv: 144, mat: 'Supremo',      set: 'conjunto_supremo',        title: 'do Supremo',        c: 0xe0d040, adj: true  },
  { key: 't50', lv: 147, mat: 'Imortal',      set: 'conjunto_imortal',        title: 'do Imortal',        c: 0x60ff60, adj: true  },
  { key: 't51', lv: 150, mat: 'Onírico',      set: 'conjunto_onirico',        title: 'do Sonhador',       c: 0x9060d0, adj: true  },
  { key: 't52', lv: 153, mat: 'Paradoxal',    set: 'conjunto_paradoxal',      title: 'do Paradoxo',       c: 0xd0a0ff, adj: true  },
  { key: 't53', lv: 156, mat: 'Quântico',     set: 'conjunto_quantico',       title: 'do Quântico',       c: 0x00d0d0, adj: true  },
  { key: 't54', lv: 159, mat: 'Entrópico',    set: 'conjunto_entropico',      title: 'da Entropia',       c: 0x604020, adj: true  },
  { key: 't55', lv: 162, mat: 'Níhil',        set: 'conjunto_nihil',          title: 'do Vazio',          c: 0x000000, adj: true  },
  { key: 't56', lv: 165, mat: 'Apocalíptico', set: 'conjunto_apocaliptico',   title: 'do Apocalipse',     c: 0xd04030, adj: true  },
  { key: 't57', lv: 168, mat: 'Ômega',        set: 'conjunto_de_omega',       title: 'do Ômega',          c: 0x000040, adj: false },
  { key: 't58', lv: 171, mat: 'Alfa',         set: 'conjunto_de_alfa',        title: 'do Alfa',           c: 0xf0f0ff, adj: false },
  { key: 't59', lv: 174, mat: 'Gênesis',      set: 'conjunto_de_genesis',     title: 'da Gênese',         c: 0x40e0a0, adj: false },
  { key: 't60', lv: 177, mat: 'Zênite',       set: 'conjunto_de_zenite',      title: 'do Zênite',         c: 0xffffff, adj: false },
  { key: 't61', lv: 180, mat: 'Aurora',       set: 'conjunto_de_aurora',      title: 'da Aurora',         c: 0xff80a0, adj: false },
  { key: 't62', lv: 183, mat: 'Crepúsculo',   set: 'conjunto_de_crepusculo',  title: 'do Crepúsculo',     c: 0x6040a0, adj: false },
  { key: 't63', lv: 186, mat: 'Oblívio',      set: 'conjunto_de_oblivio',     title: 'do Oblívio',        c: 0x404040, adj: false },
  { key: 't64', lv: 189, mat: 'Destino',      set: 'conjunto_de_destino',     title: 'do Destino',        c: 0xe0a030, adj: false },
  { key: 't65', lv: 192, mat: 'Caótico',      set: 'conjunto_caotico',        title: 'do Caos',           c: 0x802050, adj: true  },
  { key: 't66', lv: 195, mat: 'Ordeiro',      set: 'conjunto_ordeiro',        title: 'da Ordem',          c: 0xd0d0e0, adj: true  },
  { key: 't67', lv: 198, mat: 'Psiônico',     set: 'conjunto_psionico',       title: 'do Psíquico',       c: 0xff40a0, adj: true  },
  { key: 't68', lv: 201, mat: 'Vorpal',       set: 'conjunto_vorpal',         title: 'Vorpal',            c: 0x40ff40, adj: true  },
  { key: 't69', lv: 204, mat: 'Sideral',      set: 'conjunto_sideral',        title: 'do Sidéreo',        c: 0x3050a0, adj: true  },
  { key: 't70', lv: 207, mat: 'Numinoso',     set: 'conjunto_numinoso',       title: 'do Nume',           c: 0xfff080, adj: true  },
  { key: 't71', lv: 210, mat: 'Onipotente',   set: 'conjunto_onipotente',     title: 'do Absoluto',        c: 0xffe0ff, adj: true  },
];

/**
 * Nomes base por slot: 3 grupos de prestígio (simples / médio / nobre).
 * O tier define qual grupo usar: T1-5 = simples, T6-12 = médio, T13-21 = nobre.
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
  if (tierIdx < 6) return 0;      // simples
  if (tierIdx < 13) return 1;     // médio
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

/** Valor de bônus: base +- 30% determinístico. Escala x10 (itens bem mais fortes). */
const BONUS_SCALE = 10;

function bval(seed, base) {
  const r = fhash(seed);
  return +((base + (r - 0.5) * base * 0.6) * BONUS_SCALE).toFixed(3);
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

/** Gera todos os 3408 itens */
export function buildGeneratedItems() {
  const items = [];

  for (let ti = 0; ti < TIERS.length; ti++) {
    const tier = TIERS[ti];
    const pg = prestigeGroup(ti);
    const baseBonus = 0.01 + tier.lv * 0.0015;
    const altNameOffset = ti * 3;

    for (const slot of SLOTS) {
      const slotDef = BASE_NAMES[slot];
      const setName = ti < 10 ? slotDef.set[pg] : slotDef.setMid[pg];
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
            name = `${setName} ${adjectiveForm(tier.mat, setName)} ${tier.title}`;
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
            const adjForm = adjectiveForm(tier.mat, baseItemName);
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
