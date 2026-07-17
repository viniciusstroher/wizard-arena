import 'dotenv/config';

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

const ARENA_START_RADIUS = 320;
const ARENA_MIN_RADIUS = 80;
const ARENA_SHRINK_TIMES = envInt('ARENA_SHRINK_TIMES', 5);
const ARENA_SHRINK_AMOUNT = (ARENA_START_RADIUS - ARENA_MIN_RADIUS) / ARENA_SHRINK_TIMES;
const MAX_ROUNDS = envInt('MAX_ROUNDS', 5);
const ROUND_DURATION = envInt('ROUND_DURATION', 60);

export const CONFIG = {
  TICK_RATE: 20,
  MAX_PLAYERS: 8,
  MIN_PLAYERS: 2,
  /** Quantidade de rounds na partida. */
  MAX_ROUNDS,
  /** Duração de cada round em segundos. */
  ROUND_DURATION,
  ROUND_INTERMISSION: 4,
  /** Duração total estimada dos rounds (sem intermissões). */
  MATCH_DURATION: MAX_ROUNDS * ROUND_DURATION,
  PLAYER_MAX_HP: 100,
  PLAYER_SPEED: 180,
  PLAYER_RADIUS: 16,
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
  /** HP regenerado a cada janela (0 = desligado). */
  HP_REGEN_AMOUNT: envNumber('HP_REGEN_AMOUNT', 2),
  /** Janela em segundos entre regenerações. */
  HP_REGEN_INTERVAL: envNumber('HP_REGEN_INTERVAL', 2),
  /** Chance de crítico de jogadores/bots (0–1). */
  PLAYER_CRIT_CHANCE: envNumber('PLAYER_CRIT_CHANCE', 0.15),
  /** Multiplicador de dano em crítico (jogadores/bots). */
  PLAYER_CRIT_MULT: envNumber('PLAYER_CRIT_MULT', 2),

  ARENA_CENTER_X: 640,
  ARENA_CENTER_Y: 360,
  ARENA_START_RADIUS,
  ARENA_MIN_RADIUS,
  /** Intervalo em segundos entre cada encolhimento da arena. */
  ARENA_SHRINK_INTERVAL: envInt('ARENA_SHRINK_INTERVAL', 10),
  /** Quantas vezes a arena encolhe por round (até o raio mínimo). */
  ARENA_SHRINK_TIMES,
  ARENA_SHRINK_AMOUNT,
  ZONE_DPS: 12,

  MONSTER_SPAWN_INTERVAL: 4,
  MONSTER_MAX: 18,
  MONSTER_HP: 40,
  MONSTER_DAMAGE: 8,
  MONSTER_SPEED: 95,
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
  MONSTER_AGGRO_RANGE: 220,
  /** Peso base dos monstros comuns no sorteio de spawn. */
  MONSTER_WEIGHT_COMMON: envNumber('MONSTER_WEIGHT_COMMON', 10),
  /** Peso base dos bosses (beholder, dragon, lich). */
  MONSTER_WEIGHT_BOSS: envNumber('MONSTER_WEIGHT_BOSS', 6),
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

  /** Duração do fade-out do pentagrama ao lançar magia (segundos). */
  PENTAGRAM_FADEOUT: envNumber('PENTAGRAM_FADEOUT', 2.2),

  /**
   * Empurrão ao ser atingido por magia projétil (px/s).
   * 0 = desligado. Magias em área (nova, AoE) não empurram.
   */
  PROJECTILE_KNOCKBACK_SPEED: envNumber('PROJECTILE_KNOCKBACK_SPEED', 280),
  /** Duração do empurrão em segundos. */
  PROJECTILE_KNOCKBACK_DURATION: envNumber('PROJECTILE_KNOCKBACK_DURATION', 0.12),

  /** Intervalo mínimo/máximo entre meteoros aleatórios (segundos). */
  METEOR_EVENT_MIN_INTERVAL: envNumber('METEOR_EVENT_MIN_INTERVAL', 12),
  METEOR_EVENT_MAX_INTERVAL: envNumber('METEOR_EVENT_MAX_INTERVAL', 24),
  /** Tempo de aviso (círculo de atenção) antes do impacto. */
  METEOR_WARN_TIME: envNumber('METEOR_WARN_TIME', 2.2),
  /** Duração do efeito visual de impacto. */
  METEOR_IMPACT_TIME: envNumber('METEOR_IMPACT_TIME', 0.85),
  METEOR_RADIUS: envNumber('METEOR_RADIUS', 78),
  METEOR_DAMAGE: envNumber('METEOR_DAMAGE', 42),
};
