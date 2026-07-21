import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Sempre carrega o .env na raiz do projeto (não depende do cwd do processo).
dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env'),
});

function envNumber(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envInt(key, fallback, min = 1) {
  const n = Math.floor(envNumber(key, fallback));
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

function envBool(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

/** Lista de inteiros separados por vírgula (ex.: "1,10,20"). */
function envIntList(key, fallback = []) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const list = String(raw)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1);
  return list.length ? list : fallback;
}

/**
 * Entradas de boss por duração da partida.
 * Formato: "5#100%,10#50%" → após o round N, chance % de iniciar boss fight.
 * Sem `#` → 100%. Vazio / inválido → fallback.
 */
function parseBossAppears(raw, fallback = []) {
  if (raw === undefined || raw === null) return fallback;
  const text = String(raw).trim();
  if (!text) return fallback;
  const entries = [];
  for (const token of text.split(',')) {
    const m = token.trim().match(/^(\d+)\s*(?:#\s*(\d+(?:\.\d+)?)\s*%?)?$/i);
    if (!m) continue;
    const round = parseInt(m[1], 10);
    if (!Number.isFinite(round) || round < 1) continue;
    let chance = 1;
    if (m[2] !== undefined) {
      const pct = Number(m[2]);
      if (!Number.isFinite(pct)) continue;
      // Formato pedido: #100% → percentual 0–100.
      chance = Math.min(1, Math.max(0, pct / 100));
    }
    entries.push({ round, chance });
  }
  return entries.length ? entries : fallback;
}

/** Faixas de maxRounds do lobby que têm config própria de boss. */
const BOSS_APPEARS_MAX_ROUNDS = [1, 5, 10, 15, 20];

/** Defaults se a env da faixa não estiver definida. */
const BOSS_APPEARS_DEFAULTS = {
  1: [{ round: 1, chance: 1 }],
  5: [{ round: 5, chance: 1 }],
  10: [
    { round: 5, chance: 1 },
    { round: 10, chance: 1 },
  ],
  15: [
    { round: 5, chance: 1 },
    { round: 10, chance: 1 },
    { round: 15, chance: 1 },
  ],
  20: [
    { round: 5, chance: 1 },
    { round: 10, chance: 1 },
    { round: 15, chance: 1 },
    { round: 20, chance: 1 },
  ],
};

function buildBossAppearsByMaxRounds() {
  const legacy = envIntList('BOSS_APPEARS', []).map((round) => ({
    round,
    chance: 1,
  }));
  const map = Object.create(null);
  for (const maxRounds of BOSS_APPEARS_MAX_ROUNDS) {
    const key = `BOSS_APPEARS_${maxRounds}`;
    const raw = process.env[key];
    const legacyForLength = legacy.filter((e) => e.round <= maxRounds);
    if (raw === undefined) {
      // Env ausente → legado filtrado, senão default da faixa.
      map[maxRounds] = legacyForLength.length
        ? legacyForLength
        : BOSS_APPEARS_DEFAULTS[maxRounds] || [];
    } else {
      // Env presente (mesmo vazia) → só o que estiver parseado (vazio = sem boss).
      map[maxRounds] = parseBossAppears(raw, []);
    }
  }
  return map;
}

const BOSS_APPEARS_BY_MAX_ROUNDS = buildBossAppearsByMaxRounds();

/** Agenda de boss para uma duração de partida. */
export function getBossAppearsForMaxRounds(maxRounds) {
  const n = Math.floor(Number(maxRounds));
  const list = BOSS_APPEARS_BY_MAX_ROUNDS[n] || BOSS_APPEARS_BY_MAX_ROUNDS[String(n)];
  return Array.isArray(list) ? list.map((e) => ({ ...e })) : [];
}

const ARENA_MIN_RADIUS = 80;
const ARENA_START_RADIUS = envInt('ARENA_START_RADIUS', 320, ARENA_MIN_RADIUS);
const ARENA_SHRINK_TIMES = envInt('ARENA_SHRINK_TIMES', 5);
const ARENA_SHRINK_AMOUNT = (ARENA_START_RADIUS - ARENA_MIN_RADIUS) / ARENA_SHRINK_TIMES;
const ROUND_DURATION = envInt('ROUND_DURATION', 15);
/** Round mínimo para sortear boss fight após um round normal. */
const BOSS_FIGHT_MIN_ROUND = Math.max(1, envInt('BOSS_FIGHT_MIN_ROUND', 50));
/** Chance (0–1) de boss fight após cada round normal (a partir de BOSS_FIGHT_MIN_ROUND). */
const BOSS_FIGHT_CHANCE = Math.min(1, Math.max(0, envNumber('BOSS_FIGHT_CHANCE', 0.1)));
/** Escala de dificuldade por round (round 2+). */
const ROUND_MOB_HP_STEP = Math.max(0, envNumber('ROUND_MOB_HP_STEP', 0.08));
const ROUND_MOB_DMG_STEP = Math.max(0, envNumber('ROUND_MOB_DMG_STEP', 0.06));
const ROUND_SPAWN_COUNT_STEP = Math.max(0, envNumber('ROUND_SPAWN_COUNT_STEP', 0.12));
const ROUND_SPAWN_INTERVAL_STEP = Math.min(0.5, Math.max(0, envNumber('ROUND_SPAWN_INTERVAL_STEP', 0.05)));

/** Níveis de dificuldade da partida (afeta mobs / spawn / bosses). */
const DIFFICULTY_PRESETS = {
  easy: {
    hp: 0.75,
    dmg: 0.7,
    spawnInterval: 1.35,
    spawnCount: 0.7,
    eliteWeight: 0.55,
    bossHp: 0.85,
    bossDmg: 0.8,
    maxMonsters: 0.85,
  },
  normal: {
    hp: 1,
    dmg: 1,
    spawnInterval: 1,
    spawnCount: 1,
    eliteWeight: 1,
    bossHp: 1,
    bossDmg: 1,
    maxMonsters: 1,
  },
  hard: {
    hp: 1.35,
    dmg: 1.25,
    spawnInterval: 0.85,
    spawnCount: 1.25,
    eliteWeight: 1.45,
    bossHp: 1.25,
    bossDmg: 1.2,
    maxMonsters: 1.15,
  },
  nightmare: {
    hp: 1.75,
    dmg: 1.55,
    spawnInterval: 0.7,
    spawnCount: 1.5,
    eliteWeight: 1.85,
    bossHp: 1.5,
    bossDmg: 1.4,
    maxMonsters: 1.3,
  },
  apocalypse: {
    hp: 2.2,
    dmg: 1.9,
    spawnInterval: 0.55,
    spawnCount: 2,
    eliteWeight: 2.3,
    bossHp: 1.85,
    bossDmg: 1.65,
    maxMonsters: 1.5,
  },
};

function resolveDifficulty() {
  const raw = String(process.env.DIFFICULTY || 'normal')
    .trim()
    .toLowerCase();
  return DIFFICULTY_PRESETS[raw] ? raw : 'normal';
}

const DIFFICULTY = resolveDifficulty();
const DIFF = DIFFICULTY_PRESETS[DIFFICULTY];

const BASE_MONSTER_HP = envNumber('MONSTER_HP', 40);
const BASE_MONSTER_DAMAGE = envNumber('MONSTER_DAMAGE', 8);
const BASE_SPAWN_INTERVAL = envNumber('MONSTER_SPAWN_INTERVAL', 4);
const BASE_SPAWN_COUNT = envInt('MONSTER_SPAWN_COUNT', 1);
const BASE_MONSTER_MAX = envInt('MONSTER_MAX', 18, 1);
const BASE_ELITE_WEIGHT = envNumber('MONSTER_WEIGHT_ELITE', 5);

export const CONFIG = {
  /** easy | normal | hard | nightmare | apocalypse */
  DIFFICULTY,
  DIFFICULTY_HP_MUL: DIFF.hp,
  DIFFICULTY_DMG_MUL: DIFF.dmg,
  DIFFICULTY_BOSS_HP_MUL: DIFF.bossHp,
  DIFFICULTY_BOSS_DMG_MUL: DIFF.bossDmg,
  TICK_RATE: 20,
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 1,
  /** Duração de cada round em segundos. */
  ROUND_DURATION,
  ROUND_INTERMISSION: 4,
  /** Duração de um round (partidas são rounds ilimitados até wipe). */
  MATCH_DURATION: ROUND_DURATION,
  PLAYER_MAX_HP: 100,
  /** Vida máxima extra por nível do personagem (nível 1 = base). */
  PLAYER_HP_PER_LEVEL: envNumber('PLAYER_HP_PER_LEVEL', 10),
  /** Cura (H) extra por nível do personagem além do valor base da magia. */
  PLAYER_HEAL_PER_LEVEL: envNumber('PLAYER_HEAL_PER_LEVEL', 4),
  /** Escudo (E) extra por nível do personagem além do valor base da magia. */
  PLAYER_SHIELD_PER_LEVEL: envNumber('PLAYER_SHIELD_PER_LEVEL', 5),
  /** Velocidade de movimento de jogadores/bots (px/s). */
  PLAYER_SPEED: envNumber('PLAYER_SPEED', 189),
  /** Multiplicador de velocidade por tipo de chão da arena. */
  FLOOR_SPEED_MUL: {
    dirt: 1,
    grass: 1,
    ice: 0.75,
    wood: 1.2,
    sea: 1,
    desert: 0.7,
    swamp: 0.7,
    volcano: 0.85,
    ruins: 1,
    crystal: 1.05,
    snow: 0.8,
    tundra: 0.85,
    cave: 0.95,
    dungeon: 1,
    graveyard: 0.95,
    hell: 0.8,
    sky: 1.15,
    mushroom: 0.9,
    jungle: 0.85,
    mountain: 0.9,
    beach: 1.05,
    coral: 0.95,
    ashland: 0.8,
    enchanted: 1.1,
    blood: 0.9,
    shadow: 1,
    temple: 1,
    sewer: 0.7,
    meadow: 1.1,
    lava_field: 0.75,
    glacier: 0.7,
    oasis: 1.05,
    canyon: 0.9,
    marsh: 0.65,
    aurora: 1.1,
    obsidian: 0.85,
    sandstone: 1,
    storm: 1.05,
    garden: 1.1,
    battlefield: 0.9,
    library: 1.15,
    catacomb: 0.95,
    abyss: 0.9,
    bramble: 0.8,
    saltflat: 0.75,
    crystal_cave: 1,
    bat_cave: 0.95,
    vampire_castle: 1,
    throne_hall: 1.1,
    crypt: 0.95,
  },
  /**
   * Multiplicador de inércia por chão (valores maiores = mais deslize).
   * Fundo do mar desliza bem mais que o padrão.
   */
  FLOOR_INERTIA_MUL: {
    dirt: 1,
    grass: 1,
    ice: 1,
    wood: 1,
    sea: 2.8,
    desert: 1,
    swamp: 1,
    volcano: 1,
    ruins: 1,
    crystal: 1.2,
    snow: 1.35,
    tundra: 1.1,
    cave: 1,
    dungeon: 1,
    graveyard: 1,
    hell: 1,
    sky: 1.4,
    mushroom: 1.1,
    jungle: 1,
    mountain: 1,
    beach: 1.3,
    coral: 2.2,
    ashland: 1,
    enchanted: 1.15,
    blood: 1.1,
    shadow: 1.15,
    temple: 1,
    sewer: 1.25,
    meadow: 1,
    lava_field: 1,
    glacier: 1.5,
    oasis: 1.1,
    canyon: 1,
    marsh: 1.15,
    aurora: 1.35,
    obsidian: 1.1,
    sandstone: 1,
    storm: 1.45,
    garden: 1,
    battlefield: 1,
    library: 1,
    catacomb: 1,
    abyss: 2.5,
    bramble: 1,
    saltflat: 1.2,
    crystal_cave: 1.15,
    bat_cave: 1,
    vampire_castle: 1,
    throne_hall: 1,
    crypt: 1,
  },
  PLAYER_RADIUS: 16,
  /** Raio de coleta do saco de loot no chão. */
  LOOT_BAG_RADIUS: 14,
  /** Segundos até o saco poder ser coletado (fica visível no corpo). */
  LOOT_BAG_PICKUP_DELAY: Math.max(0, envNumber('LOOT_BAG_PICKUP_DELAY', 0.8)),
  /** Chance (0–1) do mob dropar moeda em vez do saco de loot. */
  MONSTER_COIN_DROP_CHANCE: Math.min(1, Math.max(0, envNumber('MONSTER_COIN_DROP_CHANCE', 0.45))),
  /** Gold concedido ao coletar uma moeda. */
  COIN_VALUE: Math.max(1, envInt('COIN_VALUE', 1, 1)),
  /** Raio de coleta da moeda no chão. */
  COIN_RADIUS: 12,
  /** Segundos até a moeda poder ser coletada. */
  COIN_PICKUP_DELAY: Math.max(0, envNumber('COIN_PICKUP_DELAY', 0.8)),
  /**
   * Inércia do jogador (segundos para aproximar da velocidade alvo).
   * 0 = movimento instantâneo; valores maiores = mais deslizamento.
   */
  PLAYER_INERTIA: envNumber('PLAYER_INERTIA', 0.12),
  /** Velocidade do dash (px/s) com Shift + WASD. */
  PLAYER_DASH_SPEED: envNumber('PLAYER_DASH_SPEED', 520),
  /** Duração do dash em segundos. */
  PLAYER_DASH_DURATION: envNumber('PLAYER_DASH_DURATION', 0.12),
  /** Cooldown entre dashes em segundos. */
  PLAYER_DASH_COOLDOWN: envNumber('PLAYER_DASH_COOLDOWN', 0.7),
  /** Cooldown do ultimate (autocast) em segundos. */
  PLAYER_ULTIMATE_COOLDOWN: Math.max(0.2, envNumber('PLAYER_ULTIMATE_COOLDOWN', 20)),
  /** HP regenerado a cada janela (0 = desligado). */
  HP_REGEN_AMOUNT: envNumber('HP_REGEN_AMOUNT', 2),
  /** Janela em segundos entre regenerações. */
  HP_REGEN_INTERVAL: envNumber('HP_REGEN_INTERVAL', 2),
  /**
   * Fração da vida máxima do mob curada no killer ao matá-lo (0–1).
   * Ex.: 0.1 = 10%. 0 = desligado (sem cura nem efeito).
   */
  MONSTER_KILL_HEAL_PERCENT: Math.max(0, Math.min(1, envNumber('MONSTER_KILL_HEAL_PERCENT', 0))),
  /** Chance de crítico de jogadores/bots (0–1). */
  PLAYER_CRIT_CHANCE: envNumber('PLAYER_CRIT_CHANCE', 0.15),
  /** Multiplicador de dano em crítico (jogadores/bots). */
  PLAYER_CRIT_MULT: envNumber('PLAYER_CRIT_MULT', 2),

  ARENA_CENTER_X: 640,
  ARENA_CENTER_Y: 360,
  ARENA_START_RADIUS,
  ARENA_MIN_RADIUS,
  /** Intervalo em segundos entre o início de cada encolhimento da arena. */
  ARENA_SHRINK_INTERVAL: envInt('ARENA_SHRINK_INTERVAL', 10),
  /** Duração em segundos do fechamento gradual de cada encolhimento (0 = instantâneo). */
  ARENA_SHRINK_DURATION: Math.max(0, envNumber('ARENA_SHRINK_DURATION', 5)),
  /** Quantas vezes a arena encolhe por round (até o raio mínimo). */
  ARENA_SHRINK_TIMES,
  ARENA_SHRINK_AMOUNT,
  ZONE_DPS: 12,

  /** Se false, não gera novos monstros durante a partida. */
  MONSTER_SPAWN_ENABLED: envBool('MONSTER_SPAWN_ENABLED', true),
  /** Intervalo (segundos) entre spawns de monstros (escala com DIFFICULTY). */
  MONSTER_SPAWN_INTERVAL: Math.max(0.5, +(BASE_SPAWN_INTERVAL * DIFF.spawnInterval).toFixed(2)),
  /** Quantidade de monstros spawnados a cada intervalo (escala com DIFFICULTY). */
  MONSTER_SPAWN_COUNT: Math.max(1, Math.round(BASE_SPAWN_COUNT * DIFF.spawnCount)),
  MONSTER_MAX: Math.max(4, Math.round(BASE_MONSTER_MAX * DIFF.maxMonsters)),
  MONSTER_HP: Math.max(1, Math.round(BASE_MONSTER_HP * DIFF.hp)),
  MONSTER_DAMAGE: Math.max(1, Math.round(BASE_MONSTER_DAMAGE * DIFF.dmg)),
  /** Velocidade base dos mobs (px/s); tipos aplicam speedMul em cima. */
  MONSTER_SPEED: envNumber('MONSTER_SPEED', 95),
  /** Chance de crítico de monstros (0–1). */
  MONSTER_CRIT_CHANCE: envNumber('MONSTER_CRIT_CHANCE', 0.1),
  /** Multiplicador de dano em crítico (monstros). */
  MONSTER_CRIT_MULT: envNumber('MONSTER_CRIT_MULT', 1.75),
  /** Se true, monstros vivos permanecem no próximo round. */
  MONSTER_PERSIST_ROUNDS: envBool('MONSTER_PERSIST_ROUNDS', false),
  /**
   * Inércia dos monstros (segundos para aproximar da velocidade alvo).
   * 0 = movimento instantâneo; valores maiores = mais deslizamento.
   */
  MONSTER_INERTIA: envNumber('MONSTER_INERTIA', 0.18),
  MONSTER_RADIUS: 14,
  MONSTER_ATTACK_RANGE: 28,
  MONSTER_ATTACK_COOLDOWN: 1.0,
  /**
   * Multiplicador de taxa de magia (casters). CD efetivo = attackCooldown / rate.
   * Normal < 1 (casta menos); elite/boss mais altos. Valores = baseline −15%.
   */
  MONSTER_CAST_RATE_NORMAL: Math.max(0.1, envNumber('MONSTER_CAST_RATE_NORMAL', 0.34)),
  MONSTER_CAST_RATE_ELITE: Math.max(0.1, envNumber('MONSTER_CAST_RATE_ELITE', 2.55)),
  MONSTER_CAST_RATE_BOSS: Math.max(0.1, envNumber('MONSTER_CAST_RATE_BOSS', 4.25)),
  /**
   * Legado: a IA dos mobs não usa mais limite de aggro — eles sempre
   * perseguem o jogador/bot vivo mais próximo e permanecem na plataforma.
   */
  MONSTER_AGGRO_RANGE: 220,
  /** Peso base dos monstros comuns no sorteio de spawn. */
  MONSTER_WEIGHT_COMMON: envNumber('MONSTER_WEIGHT_COMMON', 10),
  /** Peso dos elites (mais fortes) no spawn contínuo. */
  MONSTER_WEIGHT_ELITE: Math.max(0.5, +(BASE_ELITE_WEIGHT * DIFF.eliteWeight).toFixed(2)),
  /** Peso relativo entre bosses ao sortear qual aparece no round de boss. */
  MONSTER_WEIGHT_BOSS: envNumber('MONSTER_WEIGHT_BOSS', 6),
  /** Round mínimo para sortear boss fight após um round normal. */
  BOSS_FIGHT_MIN_ROUND,
  /** Chance (0–1) de boss fight após cada round normal (a partir de BOSS_FIGHT_MIN_ROUND). */
  BOSS_FIGHT_CHANCE,
  /** +HP por round após o 1º (ex.: 0.08 = +8% por round). */
  ROUND_MOB_HP_STEP,
  /** +dano por round após o 1º. */
  ROUND_MOB_DMG_STEP,
  /** +quantidade de spawn por round após o 1º. */
  ROUND_SPAWN_COUNT_STEP,
  /** Redução relativa do intervalo de spawn por round (ex.: 0.05 = −5%/round). */
  ROUND_SPAWN_INTERVAL_STEP,
  /** @deprecated legado — partidas agora são rounds ilimitados. */
  BOSS_APPEARS_BY_MAX_ROUNDS,
  /** @deprecated legado. */
  BOSS_APPEARS: envIntList('BOSS_APPEARS', []),
  /** Intervalo (segundos) entre tentativas de auto-cura do boss. */
  BOSS_HEAL_INTERVAL: Math.max(0.5, envNumber('BOSS_HEAL_INTERVAL', 5)),
  /** Chance (0–1) de curar a cada intervalo. */
  BOSS_HEAL_CHANCE: Math.min(1, Math.max(0, envNumber('BOSS_HEAL_CHANCE', 0.1))),
  /** Fração máxima da vida máxima restaurada por cura (ex.: 0.6 = 60%). */
  BOSS_HEAL_MAX_PERCENT: Math.min(1, Math.max(0, envNumber('BOSS_HEAL_MAX_PERCENT', 0.6))),
  /**
   * Diversidade do spawn (0–2+). Penaliza tipos já vivos e o último spawnado.
   * 0 = só pesos fixos; 1 = variação forte; >1 = ainda mais espalhado.
   */
  MONSTER_SPAWN_DIVERSITY: envNumber('MONSTER_SPAWN_DIVERSITY', 1),

  XP_MONSTER: 18,
  XP_PLAYER_KILL: 100,
  XP_ROUND_SURVIVE: 40,
  XP_PER_SECOND: envNumber('XP_PER_SECOND', 5),
  /** XP passivo por segundo para bots vivos (durante a partida). */
  BOT_XP_PER_SECOND: envNumber('BOT_XP_PER_SECOND', 5),
  /** Se false, bots ficam parados e não atacam. */
  BOT_AI_ENABLED: envBool('BOT_AI_ENABLED', true),
  /**
   * Se true, bot escolhe habilidade aleatória no level-up (com atraso)
   * e os outros jogadores esperam. Se false, bot resolve na hora.
   */
  BOT_LEVELUP_CHOICE_ENABLED: envBool('BOT_LEVELUP_CHOICE_ENABLED', true),
  /**
   * PvP: true = jogadores/bots podem se atacar (comportamento atual).
   * false = PvE: sem dano entre jogadores/bots; bots só miram mobs.
   */
  PVP_ENABLED: envBool('PVP_ENABLED', false),
  /**
   * Tempo máximo (segundos) na tela de escolha de magia.
   * Ao expirar, escolhe automaticamente. 0 = sem limite.
   */
  LEVELUP_CHOICE_TIMEOUT: envNumber('LEVELUP_CHOICE_TIMEOUT', 10),
  /** XP passivo por segundo para cada monstro vivo. */
  MONSTER_XP_PER_SECOND: envNumber('MONSTER_XP_PER_SECOND', 3),
  /** XP que o monstro ganha ao eliminar um jogador. */
  MONSTER_XP_PLAYER_KILL: envNumber('MONSTER_XP_PLAYER_KILL', 100),
  XP_LEVELS: [0, 50, 120, 220, 350, 520, 720, 960],

  ROCK_SPAWN_CLEAR_RADIUS: 170,
  ROCK_MIN: 16,
  ROCK_MAX: 28,

  /** Árvores (só em chão de grama, só dentro do círculo da arena). */
  TREE_MIN: 8,
  TREE_MAX: 14,

  /** Duração do fade-out do pentagrama ao lançar magia (segundos). */
  PENTAGRAM_FADEOUT: envNumber('PENTAGRAM_FADEOUT', 0.35),

  /**
   * Empurrão ao ser atingido por magia projétil.
   * false = desligado. Magias em área (nova, AoE) não empurram.
   */
  PROJECTILE_KNOCKBACK_ENABLED: envBool('PROJECTILE_KNOCKBACK_ENABLED', false),
  /** Empurrão em px/s (só se PROJECTILE_KNOCKBACK_ENABLED). */
  PROJECTILE_KNOCKBACK_SPEED: envNumber('PROJECTILE_KNOCKBACK_SPEED', 280),
  /** Duração do empurrão em segundos. */
  PROJECTILE_KNOCKBACK_DURATION: envNumber('PROJECTILE_KNOCKBACK_DURATION', 0.12),

  /**
   * Cooldown global entre eventos de arena (meteoro, mass heal, névoa, ventania, alavanca).
   * Após um evento começar, nenhum outro pode iniciar até este tempo (segundos).
   * 0 = desliga o bloqueio global.
   */
  ARENA_EVENT_COOLDOWN: Math.max(0, envNumber('ARENA_EVENT_COOLDOWN', 30)),

  /** Intervalo mínimo/máximo entre meteoros aleatórios (segundos). */
  METEOR_EVENT_MIN_INTERVAL: envNumber('METEOR_EVENT_MIN_INTERVAL', 12),
  METEOR_EVENT_MAX_INTERVAL: envNumber('METEOR_EVENT_MAX_INTERVAL', 24),
  /** Tempo de aviso (círculo de atenção) antes do impacto. */
  METEOR_WARN_TIME: envNumber('METEOR_WARN_TIME', 2.2),
  /** Duração do efeito visual de impacto. */
  METEOR_IMPACT_TIME: envNumber('METEOR_IMPACT_TIME', 0.85),
  METEOR_RADIUS: envNumber('METEOR_RADIUS', 78),
  METEOR_DAMAGE: envNumber('METEOR_DAMAGE', 42),

  /** Intervalo mínimo/máximo entre mass heals aleatórios (segundos). */
  MASS_HEAL_EVENT_MIN_INTERVAL: envNumber('MASS_HEAL_EVENT_MIN_INTERVAL', 12),
  MASS_HEAL_EVENT_MAX_INTERVAL: envNumber('MASS_HEAL_EVENT_MAX_INTERVAL', 24),
  /** Tempo de aviso (círculo de atenção) antes do impacto. */
  MASS_HEAL_WARN_TIME: envNumber('MASS_HEAL_WARN_TIME', 2.2),
  /** Duração do efeito visual de impacto. */
  MASS_HEAL_IMPACT_TIME: envNumber('MASS_HEAL_IMPACT_TIME', 0.85),
  MASS_HEAL_RADIUS: envNumber('MASS_HEAL_RADIUS', 78),
  /** Cura aplicada a jogadores/bots na área no impacto. */
  MASS_HEAL_AMOUNT: envNumber('MASS_HEAL_AMOUNT', 42),

  /** Intervalo mínimo/máximo entre névoas de cooldown aleatórias (segundos). */
  COOLDOWN_MIST_EVENT_MIN_INTERVAL: envNumber('COOLDOWN_MIST_EVENT_MIN_INTERVAL', 12),
  COOLDOWN_MIST_EVENT_MAX_INTERVAL: envNumber('COOLDOWN_MIST_EVENT_MAX_INTERVAL', 24),
  /** Tempo de aviso (círculo de atenção) antes do impacto. */
  COOLDOWN_MIST_WARN_TIME: envNumber('COOLDOWN_MIST_WARN_TIME', 2.2),
  /** Duração do efeito visual de impacto. */
  COOLDOWN_MIST_IMPACT_TIME: envNumber('COOLDOWN_MIST_IMPACT_TIME', 0.85),
  COOLDOWN_MIST_RADIUS: envNumber('COOLDOWN_MIST_RADIUS', 78),
  /**
   * Fração (0–1) de redução dos cooldowns restantes no impacto.
   * Ex.: 0.3 = reduz 30% (multiplica por 0.7).
   */
  COOLDOWN_MIST_REDUCTION: envNumber('COOLDOWN_MIST_REDUCTION', 0.3),

  /** Intervalo mínimo/máximo entre ventanias aleatórias (segundos). */
  GALE_EVENT_MIN_INTERVAL: envNumber('GALE_EVENT_MIN_INTERVAL', 12),
  GALE_EVENT_MAX_INTERVAL: envNumber('GALE_EVENT_MAX_INTERVAL', 24),
  /** Tempo de aviso (círculo de atenção) antes da ventania. */
  GALE_WARN_TIME: envNumber('GALE_WARN_TIME', 2.2),
  /** Duração da zona de vento ativa (segundos). */
  GALE_DURATION: envNumber('GALE_DURATION', 5),
  GALE_RADIUS: envNumber('GALE_RADIUS', 78),
  /** Multiplicador de velocidade dentro da ventania (1.5 = +50%). */
  GALE_SPEED_MUL: envNumber('GALE_SPEED_MUL', 1.5),
  /** Multiplicador de inércia dentro da ventania (0.75 = −25%). */
  GALE_INERTIA_MUL: envNumber('GALE_INERTIA_MUL', 0.75),

  /** Intervalo mínimo/máximo entre alavancas aleatórias (segundos). */
  LEVER_EVENT_MIN_INTERVAL: envNumber('LEVER_EVENT_MIN_INTERVAL', 10),
  LEVER_EVENT_MAX_INTERVAL: envNumber('LEVER_EVENT_MAX_INTERVAL', 10),
  /** Tempo de aparição (desliza da esquerda) antes de ficar ativável. */
  LEVER_APPEAR_TIME: envNumber('LEVER_APPEAR_TIME', 0.45),
  /** Tempo máximo no chão aguardando alguém passar por cima (segundos). */
  LEVER_LIFETIME: envNumber('LEVER_LIFETIME', 14),
  /** Duração visual após puxar (alavanca à direita) antes de sumir. */
  LEVER_PULL_TIME: envNumber('LEVER_PULL_TIME', 0.55),
  /** Raio de coleta (somado ao PLAYER_RADIUS). */
  LEVER_RADIUS: envNumber('LEVER_RADIUS', 22),
  /**
   * Multiplicador do ARENA_SHRINK_AMOUNT restaurado ao ativar a alavanca.
   * Ex.: 2 = a arena cresce o dobro do quanto fecha por fase.
   */
  LEVER_EXPAND_RATIO: envNumber('LEVER_EXPAND_RATIO', 2),
};
