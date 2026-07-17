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

const ARENA_START_RADIUS = 320;
const ARENA_MIN_RADIUS = 80;
const ARENA_SHRINK_TIMES = envInt('ARENA_SHRINK_TIMES', 5);
const ARENA_SHRINK_AMOUNT = (ARENA_START_RADIUS - ARENA_MIN_RADIUS) / ARENA_SHRINK_TIMES;
const MAX_ROUNDS = envInt('MAX_ROUNDS', 5);
const ROUND_DURATION = envInt('ROUND_DURATION', 60);

export const CONFIG = {
  TICK_RATE: 20,
  MAX_PLAYERS: 4,
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
  /** Velocidade do dash (px/s) no double-tap WASD. */
  PLAYER_DASH_SPEED: envNumber('PLAYER_DASH_SPEED', 520),
  /** Duração do dash em segundos. */
  PLAYER_DASH_DURATION: envNumber('PLAYER_DASH_DURATION', 0.12),
  /** Cooldown entre dashes em segundos. */
  PLAYER_DASH_COOLDOWN: envNumber('PLAYER_DASH_COOLDOWN', 0.7),
  /** HP regenerado a cada janela (0 = desligado). */
  HP_REGEN_AMOUNT: envNumber('HP_REGEN_AMOUNT', 2),
  /** Janela em segundos entre regenerações. */
  HP_REGEN_INTERVAL: envNumber('HP_REGEN_INTERVAL', 2),

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
  /**
   * Inércia dos monstros (segundos para aproximar da velocidade alvo).
   * 0 = movimento instantâneo; valores maiores = mais deslizamento.
   */
  MONSTER_INERTIA: envNumber('MONSTER_INERTIA', 0.18),
  MONSTER_RADIUS: 14,
  MONSTER_ATTACK_RANGE: 28,
  MONSTER_ATTACK_COOLDOWN: 1.0,
  MONSTER_AGGRO_RANGE: 220,

  XP_MONSTER: 18,
  XP_PLAYER_KILL: 100,
  XP_ROUND_SURVIVE: 40,
  XP_PER_SECOND: envNumber('XP_PER_SECOND', 5),
  XP_LEVELS: [0, 50, 120, 220, 350, 520, 720, 960],

  ROCK_SPAWN_CLEAR_RADIUS: 170,
  ROCK_MIN: 16,
  ROCK_MAX: 28,
};
