import { CONFIG } from './config.js';
import { BotController } from './Bot.js';
import { createMonsterTypeDefs } from './monsterTypes.js';
import { applyElementResistance } from './monsterResistances.js';
import { spellElementId } from './spellElements.js';
import { rollOneMonsterDrop } from './itemDrops.js';
import {
  applySpellChoice,
  createSpellInstance,
  getSpellDef,
  innateUnlockLevel,
  isInnateSpell,
  isPlayerUsableSpell,
  rollSpellChoices,
  spellStats,
} from './spells.js';

/** Magias com `speed` viram projétil — não mostram nome flutuante. */
function isProjectileSpell(spellId) {
  const def = getSpellDef(spellId);
  return !!(def && Number.isFinite(def.speed));
}

/** Dano percentual da vida máxima (teto 85%) — magias de boss. */
const MAX_BOSS_HP_PERCENT = 0.85;

function clampBossHpPercent(pct) {
  const n = Number(pct) || 0;
  if (n <= 0) return 0;
  return Math.min(MAX_BOSS_HP_PERCENT, Math.max(0, n));
}

function stripInnateSpells(spells) {
  return (spells || []).filter((s) => !isInnateSpell(s.id));
}

let nextEntityId = 1;
function eid() {
  return nextEntityId++;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Reduz cooldown de magias conforme bônus de equipamento (ex.: túnica -1%). */
function effectiveSpellCooldown(baseCd, player) {
  const base = Number(baseCd);
  if (!Number.isFinite(base) || base <= 0) return baseCd;
  const red = player?.cooldownReduction || 0;
  if (red <= 0) return base;
  return Math.max(0.2, +(base * (1 - red)).toFixed(2));
}

/** Aproxima vx/vy da velocidade alvo com inércia configurável (segundos). */
function applyInertia(entity, targetVx, targetVy, inertia, dt) {
  if (inertia <= 0) {
    entity.vx = targetVx;
    entity.vy = targetVy;
  } else {
    const t = 1 - Math.exp(-dt / inertia);
    entity.vx += (targetVx - entity.vx) * t;
    entity.vy += (targetVy - entity.vy) * t;
  }
  if (targetVx === 0 && Math.abs(entity.vx) < 1) entity.vx = 0;
  if (targetVy === 0 && Math.abs(entity.vy) < 1) entity.vy = 0;
}

function xpForLevel(level) {
  const table = CONFIG.XP_LEVELS;
  if (level <= 1) return 0;
  if (level - 1 < table.length) return table[level - 1];
  const last = table[table.length - 1];
  const extra = level - table.length;
  return last + extra * 280;
}

const WIZARD_TYPES = [
  { type: 'crimson', color: 0xff5555 },
  { type: 'azure', color: 0x55aaff },
  { type: 'emerald', color: 0x55ff99 },
  { type: 'amber', color: 0xffaa33 },
  { type: 'necromancer', color: 0x8844cc },
];

const WIZARD_SKIN_IDS = [
  'magician',
  'wizard',
  'sorcerer',
  'warlock',
  'necromancer',
  'druid',
  'shaman',
  'priest',
  'illusionist',
  'evoker',
  'conjurer',
  'enchanter',
  'archmage',
  'pyromancer',
  'cryomancer',
  'geomancer',
  'high_wizard',
  'sage',
  'runemaster',
  'elementalist',
  'mystic',
  'shadow_priest',
  'battlemage',
  'witch',
  'chronomancer',
];

const WIZARD_SKIN_ALIASES = {
  classic: 'magician',
  hooded: 'enchanter',
  crowned: 'archmage',
  battle: 'battlemage',
  shadow: 'shadow_priest',
};

function normalizeSkin(skin) {
  let id = String(skin || 'magician');
  if (WIZARD_SKIN_ALIASES[id]) id = WIZARD_SKIN_ALIASES[id];
  return WIZARD_SKIN_IDS.includes(id) ? id : 'magician';
}

const CHARACTER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidCharacterId(value) {
  return typeof value === 'string' && CHARACTER_ID_RE.test(value);
}

function randomSkin() {
  return WIZARD_SKIN_IDS[Math.floor(Math.random() * WIZARD_SKIN_IDS.length)];
}

function randomWizard() {
  const w = WIZARD_TYPES[Math.floor(Math.random() * WIZARD_TYPES.length)];
  return { ...w, skin: randomSkin() };
}

function nearestWizard(color, skin) {
  const hex = Number(color) >>> 0;
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  let best = WIZARD_TYPES[0];
  let bestDist = Infinity;
  for (const w of WIZARD_TYPES) {
    const wr = (w.color >> 16) & 0xff;
    const wg = (w.color >> 8) & 0xff;
    const wb = w.color & 0xff;
    const d = (r - wr) ** 2 + (g - wg) ** 2 + (b - wb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return { type: best.type, color: hex, skin: normalizeSkin(skin) };
}

function resolveWizard(appearance = {}) {
  if (appearance.color != null && Number.isFinite(Number(appearance.color))) {
    return nearestWizard(appearance.color, appearance.skin);
  }
  return randomWizard();
}

function startingSpellsFor(wizardType) {
  // if (wizardType === 'necromancer') {
  //   return [
  //     createSpellInstance('firebolt', 1),
  //     createSpellInstance('skull_bolt', 1),
  //     createSpellInstance('poison_cloud', 1),
  //   ];
  // }
  return [createSpellInstance('firebolt', 1)];
}

export class Match {
  constructor(id, io, options = {}) {
    this.id = id;
    this.io = io;
    const max = Math.floor(Number(options.maxPlayers));
    this.maxPlayers = Number.isFinite(max)
      ? Math.min(CONFIG.MAX_PLAYERS, Math.max(1, max))
      : CONFIG.MAX_PLAYERS;
    this.roundDuration = 15;
    this.password = options.password ? String(options.password) : null;
    this.onLobbyListChange =
      typeof options.onLobbyListChange === 'function' ? options.onLobbyListChange : null;
    this.players = new Map(); // socketId -> player
    this.monsters = [];
    this.projectiles = [];
    this.aoes = [];
    this.effects = [];
    this.lootBags = [];
    this.coins = [];
    this.meteors = [];
    this.meteorTimer = 0;
    this.massHeals = [];
    this.massHealTimer = 0;
    this.cooldownMists = [];
    this.cooldownMistTimer = 0;
    this.gales = [];
    this.galeTimer = 0;
    this.levers = [];
    this.leverTimer = 0;
    /** Tempo restante do cooldown global entre eventos de arena (s). */
    this.arenaEventCooldown = 0;
    this.phase = 'lobby'; // lobby | countdown | playing | levelup | intermission | ended
    this.round = 0;
    this.matchTime = 0;
    this.roundTime = 0;
    this.arenaRadius = CONFIG.ARENA_START_RADIUS;
    this.nextShrinkAt = CONFIG.ARENA_SHRINK_INTERVAL;
    this.shrinksDone = 0;
    this.shrinkActive = false;
    this.shrinkFrom = CONFIG.ARENA_START_RADIUS;
    this.shrinkTo = CONFIG.ARENA_START_RADIUS;
    this.shrinkElapsed = 0;
    this.monsterSpawnTimer = 0;
    this.lastSpawnedMonsterType = null;
    /** Contagem de mortes por tipo de monstro (type → count). */
    this.monsterKillCounts = Object.create(null);
    /** Round atual é luta de boss (sem tempo; win ao matar o boss). */
    this.bossRound = false;
    /**
     * Após terminar um round normal, chance de boss fight (não consome round extra).
     */
    this.pendingBossFight = false;
    /** Rounds (número) cuja boss fight pós-round já foi concluída. */
    this.clearedBossFights = new Set();
    /** Sorteio de chance por round (round → boolean): true = dispara boss fight. */
    this.bossAppearRolls = new Map();
    this.countdown = 0;
    this.intermissionTimer = 0;
    this.winnerId = null;
    /** Resultado da partida: null | 'ended' */
    this.matchResult = null;
    /** Após level-up no fim do round: null | { type: 'intermission' } | { type: 'endMatch', winner } */
    this.afterLevelUp = null;
    this.events = [];
    /** Log persistente da partida (não limpa a cada tick). */
    this.eventLog = [];
    this.chatLog = [];
    /** Momento em que a sala (lobby) foi criada. */
    this.createdAt = new Date();
    this.startedAt = null;
    this.endReason = null;
    this._persisted = false;
    this.tickAcc = 0;
    this.running = false;
    this._interval = null;
    this.bots = [];
    this.rocks = [];
    this.trees = [];
    /** 'dirt' | 'grass' | 'ice' | 'wood' | 'sea' | 'desert' | 'swamp' | 'volcano' | 'ruins' | 'crystal' */
    this.floorType = 'dirt';
    this.xpPassiveTimer = 0;
    this.hpRegenTimer = 0;
    /** Overrides de admin (lobby); defaults vêm do .env (ou create_lobby). */
    this.botAiEnabled = CONFIG.BOT_AI_ENABLED;
    this.monsterSpawnEnabled = CONFIG.MONSTER_SPAWN_ENABLED;
    this.botLevelUpChoiceEnabled = CONFIG.BOT_LEVELUP_CHOICE_ENABLED;
    this.pvpEnabled =
      options.pvpEnabled !== undefined ? !!options.pvpEnabled : CONFIG.PVP_ENABLED;
    this.generateRocks();
  }

  setAdminSettings(payload = {}) {
    const prevPvp = this.pvpEnabled;
    if (payload.botAiEnabled !== undefined) {
      this.botAiEnabled = !!payload.botAiEnabled;
    }
    if (payload.monsterSpawnEnabled !== undefined) {
      this.monsterSpawnEnabled = !!payload.monsterSpawnEnabled;
    }
    if (payload.botLevelUpChoiceEnabled !== undefined) {
      this.botLevelUpChoiceEnabled = !!payload.botLevelUpChoiceEnabled;
    }
    if (payload.pvpEnabled !== undefined) {
      this.pvpEnabled = !!payload.pvpEnabled;
    }
    this.broadcastLobby();
    if (this.pvpEnabled !== prevPvp) {
      this.onLobbyListChange?.();
    }
    return {
      ok: true,
      botAiEnabled: this.botAiEnabled,
      monsterSpawnEnabled: this.monsterSpawnEnabled,
      botLevelUpChoiceEnabled: this.botLevelUpChoiceEnabled,
      pvpEnabled: this.pvpEnabled,
    };
  }

  /**
   * Em PvE, jogadores/bots não causam dano/efeitos em outros jogadores/bots.
   * Monstros, zona e eventos da arena continuam normais.
   */
  playerCanHarmPlayers(sourceId) {
    if (this.pvpEnabled) return true;
    if (sourceId == null) return true;
    return !this.players.has(sourceId);
  }

  /** Escolha de magia é sempre ao vivo (PvE e PvP) — não pausa o combate. */
  pausesForSpellChoice() {
    return false;
  }

  /** Com a flag off, bots escolhem na hora (não travam a partida). */
  autoResolveBotLevelUpsIfDisabled() {
    if (this.botLevelUpChoiceEnabled) return;
    for (const p of [...this.players.values()]) {
      if (!p.isBot || !p.alive) continue;
      let guard = 0;
      while (p.pendingLevelUps > 0 && guard++ < 20) {
        if (!p.spellChoices?.length) this.assignSpellChoices(p);
        if (!p.spellChoices?.length) break;
        const index = Math.floor(Math.random() * p.spellChoices.length);
        const choice = p.spellChoices[index];
        const before = p.pendingLevelUps;
        this.chooseSpell(p.id, {
          index,
          spellId: choice.spellId,
          kind: choice.kind,
          fromLevel: choice.fromLevel,
          choiceSetId: p.choiceSetId,
        });
        if (p.pendingLevelUps >= before) break;
      }
    }
  }

  /** Pedras / móveis / conchas / cactos / poças / vulcão / ruínas / cristais — só no círculo. */
  generateRocks() {
    // Chance igual (uniforme) entre todos os tipos de chão a cada round.
    const floors = [
      'grass',
      'dirt',
      'ice',
      'wood',
      'sea',
      'desert',
      'swamp',
      'volcano',
      'ruins',
      'crystal',
      // Expansão +20 terrenos
      'snow',
      'tundra',
      'cave',
      'dungeon',
      'graveyard',
      'hell',
      'sky',
      'mushroom',
      'jungle',
      'mountain',
      'beach',
      'coral',
      'ashland',
      'enchanted',
      'blood',
      'shadow',
      'temple',
      'sewer',
      'meadow',
      'lava_field',
      // Expansão +15 terrenos
      'glacier',
      'oasis',
      'canyon',
      'marsh',
      'aurora',
      'obsidian',
      'sandstone',
      'storm',
      'garden',
      'battlefield',
      'library',
      'catacomb',
      'abyss',
      'bramble',
      'saltflat',
      // Expansão +5 — cavernas e castelos vampíricos
      'crystal_cave',
      'bat_cave',
      'vampire_castle',
      'throne_hall',
      'crypt',
    ];
    this.floorType = floors[Math.floor(Math.random() * floors.length)];

    const dirtTypes = [
      { type: 'stone', radius: 12 },
      { type: 'rock', radius: 18 },
      { type: 'boulder', radius: 26 },
    ];
    const iceTypes = [
      { type: 'ice_stone', radius: 12 },
      { type: 'ice_rock', radius: 18 },
      { type: 'ice_boulder', radius: 26 },
    ];
    const woodTypes = [
      { type: 'chair', radius: 12 },
      { type: 'crate', radius: 14 },
      { type: 'table', radius: 18 },
      { type: 'cabinet', radius: 26 },
    ];
    const seaTypes = [
      { type: 'shell', radius: 12 },
      { type: 'conch', radius: 18 },
      { type: 'clam', radius: 26 },
    ];
    const desertTypes = [
      { type: 'cactus_small', radius: 12 },
      { type: 'cactus', radius: 18 },
      { type: 'cactus_tall', radius: 26 },
    ];
    // Poças de água — sólidos intransitáveis no pântano.
    const swampTypes = [
      { type: 'puddle_small', radius: 14 },
      { type: 'puddle', radius: 20 },
      { type: 'puddle_large', radius: 28 },
    ];
    const volcanoTypes = [
      { type: 'ember_stone', radius: 12 },
      { type: 'lava_rock', radius: 18 },
      { type: 'obsidian', radius: 26 },
    ];
    const ruinsTypes = [
      { type: 'rubble', radius: 12 },
      { type: 'broken_pillar', radius: 18 },
      { type: 'statue', radius: 26 },
    ];
    const crystalTypes = [
      { type: 'crystal_small', radius: 12 },
      { type: 'crystal', radius: 18 },
      { type: 'crystal_large', radius: 26 },
    ];
    const typesByFloor = {
      ice: iceTypes,
      wood: woodTypes,
      sea: seaTypes,
      desert: desertTypes,
      swamp: swampTypes,
      volcano: volcanoTypes,
      ruins: ruinsTypes,
      crystal: crystalTypes,
      grass: dirtTypes,
      dirt: dirtTypes,
      // Expansão — reutiliza packs de obstáculos temáticos (mesmas regras)
      snow: iceTypes,
      tundra: iceTypes,
      cave: dirtTypes,
      dungeon: woodTypes,
      graveyard: ruinsTypes,
      hell: volcanoTypes,
      sky: crystalTypes,
      mushroom: swampTypes,
      jungle: dirtTypes,
      mountain: dirtTypes,
      beach: seaTypes,
      coral: seaTypes,
      ashland: volcanoTypes,
      enchanted: crystalTypes,
      blood: ruinsTypes,
      shadow: crystalTypes,
      temple: ruinsTypes,
      sewer: swampTypes,
      meadow: dirtTypes,
      lava_field: volcanoTypes,
      // Expansão +15 — packs temáticos
      glacier: iceTypes,
      oasis: desertTypes,
      canyon: dirtTypes,
      marsh: swampTypes,
      aurora: crystalTypes,
      obsidian: volcanoTypes,
      sandstone: ruinsTypes,
      storm: crystalTypes,
      garden: dirtTypes,
      battlefield: ruinsTypes,
      library: woodTypes,
      catacomb: ruinsTypes,
      abyss: seaTypes,
      bramble: dirtTypes,
      saltflat: desertTypes,
      // Expansão +5 — cavernas e castelos vampíricos
      crystal_cave: crystalTypes,
      bat_cave: dirtTypes,
      vampire_castle: woodTypes,
      throne_hall: woodTypes,
      crypt: ruinsTypes,
    };
    const types = typesByFloor[this.floorType] || dirtTypes;
    const count =
      CONFIG.ROCK_MIN + Math.floor(Math.random() * (CONFIG.ROCK_MAX - CONFIG.ROCK_MIN + 1));
    const rocks = [];
    const cx = CONFIG.ARENA_CENTER_X;
    const cy = CONFIG.ARENA_CENTER_Y;
    const arenaR = CONFIG.ARENA_START_RADIUS;
    let attempts = 0;

    while (rocks.length < count && attempts < count * 50) {
      attempts += 1;
      const def = types[Math.floor(Math.random() * types.length)];
      const ang = Math.random() * Math.PI * 2;
      const maxR = Math.max(0, arenaR - def.radius - 4);
      const r =
        CONFIG.ROCK_SPAWN_CLEAR_RADIUS +
        def.radius +
        Math.random() * Math.max(0, maxR - CONFIG.ROCK_SPAWN_CLEAR_RADIUS - def.radius);
      if (r > maxR) continue;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      const fromCenter = Math.hypot(x - cx, y - cy);
      if (fromCenter + def.radius > arenaR) continue;
      if (fromCenter < CONFIG.ROCK_SPAWN_CLEAR_RADIUS + def.radius) continue;

      let overlaps = false;
      for (const rock of rocks) {
        if (Math.hypot(x - rock.x, y - rock.y) < rock.radius + def.radius + 10) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      rocks.push({
        id: eid(),
        type: def.type,
        x: +x.toFixed(1),
        y: +y.toFixed(1),
        radius: def.radius,
      });
    }

    this.rocks = rocks;
    this.generateTrees();
  }

  /** Árvores em biomas florestais e apenas dentro do círculo da arena. */
  generateTrees() {
    const forestFloors = new Set([
      'grass',
      'swamp',
      'jungle',
      'mushroom',
      'enchanted',
      'meadow',
      'tundra',
      'marsh',
      'garden',
      'bramble',
      'oasis',
    ]);
    if (!forestFloors.has(this.floorType)) {
      this.trees = [];
      return;
    }

    const swampLike =
      this.floorType === 'swamp' ||
      this.floorType === 'mushroom' ||
      this.floorType === 'marsh';
    const coldLike = this.floorType === 'tundra';
    const types = swampLike
      ? [
          { type: 'mangrove', radius: 14 },
          { type: 'swamp_oak', radius: 16 },
          { type: 'swamp_bush', radius: 10 },
        ]
      : coldLike
        ? [
            { type: 'pine', radius: 14 },
            { type: 'pine', radius: 16 },
            { type: 'bush', radius: 10 },
          ]
        : [
            { type: 'pine', radius: 14 },
            { type: 'oak', radius: 16 },
            { type: 'bush', radius: 10 },
          ];
    const count =
      CONFIG.TREE_MIN + Math.floor(Math.random() * (CONFIG.TREE_MAX - CONFIG.TREE_MIN + 1));
    const trees = [];
    const cx = CONFIG.ARENA_CENTER_X;
    const cy = CONFIG.ARENA_CENTER_Y;
    const arenaR = CONFIG.ARENA_START_RADIUS;
    let attempts = 0;

    while (trees.length < count && attempts < count * 50) {
      attempts += 1;
      const def = types[Math.floor(Math.random() * types.length)];
      const ang = Math.random() * Math.PI * 2;
      const maxR = Math.max(0, arenaR - def.radius - 4);
      const r = CONFIG.ROCK_SPAWN_CLEAR_RADIUS + def.radius + Math.random() * Math.max(0, maxR - CONFIG.ROCK_SPAWN_CLEAR_RADIUS - def.radius);
      if (r > maxR) continue;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      const fromCenter = Math.hypot(x - cx, y - cy);
      if (fromCenter + def.radius > arenaR) continue;
      if (fromCenter < CONFIG.ROCK_SPAWN_CLEAR_RADIUS + def.radius) continue;

      let overlaps = false;
      for (const t of trees) {
        if (Math.hypot(x - t.x, y - t.y) < t.radius + def.radius + 12) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      for (const rock of this.rocks) {
        if (Math.hypot(x - rock.x, y - rock.y) < rock.radius + def.radius + 10) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      trees.push({
        id: eid(),
        type: def.type,
        x: +x.toFixed(1),
        y: +y.toFixed(1),
        radius: def.radius,
      });
    }

    this.trees = trees;
  }

  /** Remove árvores que ficaram fora do círculo após o shrink. */
  cullTreesOutsideArena() {
    if (!this.trees.length) return;
    const cx = CONFIG.ARENA_CENTER_X;
    const cy = CONFIG.ARENA_CENTER_Y;
    const r = this.arenaRadius;
    this.trees = this.trees.filter((t) => Math.hypot(t.x - cx, t.y - cy) + t.radius <= r);
  }

  /** Remove pedras que ficaram fora do círculo após o shrink. */
  cullRocksOutsideArena() {
    if (!this.rocks.length) return;
    const cx = CONFIG.ARENA_CENTER_X;
    const cy = CONFIG.ARENA_CENTER_Y;
    const r = this.arenaRadius;
    this.rocks = this.rocks.filter((rock) => Math.hypot(rock.x - cx, rock.y - cy) + rock.radius <= r);
  }

  solidObstacles() {
    return this.trees.length ? this.rocks.concat(this.trees) : this.rocks;
  }

  resolveRockCollision(entity, entityRadius) {
    const solids = this.solidObstacles();
    if (!solids.length) return;
    for (const rock of solids) {
      const dx = entity.x - rock.x;
      const dy = entity.y - rock.y;
      const d = Math.hypot(dx, dy);
      const min = rock.radius + entityRadius;
      if (d >= min) continue;
      if (d < 0.001) {
        entity.x = rock.x + min;
        entity.y = rock.y;
        continue;
      }
      const push = (min - d) / d;
      entity.x += dx * push;
      entity.y += dy * push;
    }
  }

  /** Mantém o monstro dentro da plataforma (círculo da arena). */
  clampMonsterToArena(m) {
    const radius = m.radius || CONFIG.MONSTER_RADIUS;
    this.resolveRockCollision(m, radius);
    const dx = m.x - CONFIG.ARENA_CENTER_X;
    const dy = m.y - CONFIG.ARENA_CENTER_Y;
    const d = Math.hypot(dx, dy);
    const maxR = Math.max(0, this.arenaRadius - radius);
    if (d > maxR && d > 0) {
      const nx = dx / d;
      const ny = dy / d;
      m.x = CONFIG.ARENA_CENTER_X + nx * maxR;
      m.y = CONFIG.ARENA_CENTER_Y + ny * maxR;
      const outward = (m.vx || 0) * nx + (m.vy || 0) * ny;
      if (outward > 0) {
        m.vx -= nx * outward;
        m.vy -= ny * outward;
      }
      this.resolveRockCollision(m, radius);
    }
  }

  isBlockedByRock(x, y, radius) {
    for (const rock of this.solidObstacles()) {
      if (Math.hypot(x - rock.x, y - rock.y) < rock.radius + radius) return true;
    }
    return false;
  }

  /** Segment–circle test so fast projectiles cannot tunnel through rocks/trees. */
  projectileHitsRock(x0, y0, x1, y1, radius) {
    for (const rock of this.solidObstacles()) {
      const r = rock.radius + radius;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len2 = dx * dx + dy * dy;
      let t = 0;
      if (len2 > 0) {
        t = Math.max(0, Math.min(1, ((rock.x - x0) * dx + (rock.y - y0) * dy) / len2));
      }
      const px = x0 + t * dx;
      const py = y0 + t * dy;
      if (Math.hypot(px - rock.x, py - rock.y) < r) return true;
    }
    return false;
  }

  createPlayerState(id, name, isBot = false, appearance = {}) {
    const angle = (this.players.size / Math.max(1, this.maxPlayers)) * Math.PI * 2;
    const wizard = isBot ? randomWizard() : resolveWizard(appearance);
    const characterId =
      !isBot && appearance.characterId && isValidCharacterId(appearance.characterId)
        ? appearance.characterId
        : null;
    const bonuses = isBot ? {} : (appearance.bonuses || {});
    const maxHpBonus = Number(bonuses.maxHpBonus) || 0;
    const hp = Math.round(CONFIG.PLAYER_MAX_HP * (1 + Math.min(0.60, maxHpBonus)));
    return {
      id,
      entityId: eid(),
      name: (name || 'Wizard').slice(0, 16),
      characterId,
      ready: isBot,
      isBot,
      x: CONFIG.ARENA_CENTER_X + Math.cos(angle) * 120,
      y: CONFIG.ARENA_CENTER_Y + Math.sin(angle) * 120,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      alive: true,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(2) - xpForLevel(1),
      spells: stripInnateSpells(startingSpellsFor(wizard.type)),
      ultimate: null,
      pendingLevelUps: 0,
      spellChoices: null,
      choiceSetId: null,
      choiceDeadlineAt: null,
      input: {
        up: false,
        down: false,
        left: false,
        right: false,
        aimX: 0,
        aimY: 0,
        castSlot: -1,
        dash: null,
        barrier: false,
        mend: false,
        blink: false,
      },
      /** Escudo inato (E) — disponível desde o nível 1. */
      barrierCooldown: 0,
      barrierBuffer: 0,
      /** Heal inato (H) — disponível desde o nível 1. */
      mendCooldown: 0,
      mendBuffer: 0,
      /** Blink inato (B) — liberado no nível 5. */
      blinkCooldown: 0,
      blinkBuffer: 0,
      shield: 0,
      maxShield: 0,
      shieldTimer: 0,
      slow: 0,
      slowTimer: 0,
      poisonTimer: 0,
      poisonDamage: 0,
      poisonTick: 1,
      poisonTickAcc: 0,
      poisonOwnerId: null,
      burnTimer: 0,
      burnDamage: 0,
      burnTick: 1,
      burnTickAcc: 0,
      burnOwnerId: null,
      stunTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashBuffer: 0,
      dashDx: 0,
      dashDy: 0,
      knockbackTimer: 0,
      knockbackDx: 0,
      knockbackDy: 0,
      kills: 0,
      deaths: 0,
      monsterKills: 0,
      loot: 0,
      gold: 0,
      damageDealt: 0,
      damageTaken: 0,
      /** Dano causado por elemento (elementId | 'other' → amount). */
      elementDamageDealt: Object.create(null),
      /** Dano recebido por elemento (elementId | 'other' → amount). */
      elementDamageTaken: Object.create(null),
      critChance: CONFIG.PLAYER_CRIT_CHANCE,
      critMult: CONFIG.PLAYER_CRIT_MULT,
      wizardType: wizard.type,
      color: wizard.color,
      skin: wizard.skin || 'classic',
      zoneDmgAcc: 0,
      score: 0,
      collectedItems: [],
      bonuses: {
        cooldownReduction: Math.min(0.95, Math.max(0, Number(bonuses.cooldownReduction) || 0)),
        damageBonus: Math.min(0.75, Math.max(0, Number(bonuses.damageBonus) || 0)),
        healBonus: Math.min(0.75, Math.max(0, Number(bonuses.healBonus) || 0)),
        shieldBonus: Math.min(0.75, Math.max(0, Number(bonuses.shieldBonus) || 0)),
        speedBonus: Math.min(0.50, Math.max(0, Number(bonuses.speedBonus) || 0)),
        rangeBonus: Math.min(0.50, Math.max(0, Number(bonuses.rangeBonus) || 0)),
        radiusBonus: Math.min(0.50, Math.max(0, Number(bonuses.radiusBonus) || 0)),
        slowResist: Math.min(0.80, Math.max(0, Number(bonuses.slowResist) || 0)),
        poisonResist: Math.min(0.80, Math.max(0, Number(bonuses.poisonResist) || 0)),
        burnResist: Math.min(0.80, Math.max(0, Number(bonuses.burnResist) || 0)),
        maxHpBonus: Math.min(0.60, Math.max(0, Number(bonuses.maxHpBonus) || 0)),
        xpBonus: Math.min(0.50, Math.max(0, Number(bonuses.xpBonus) || 0)),
      },
      cooldownReduction: Math.min(0.95, Math.max(0, Number(bonuses.cooldownReduction) || 0)),
    };
  }

  addPlayer(socket, name, opts = {}) {
    if (this.phase !== 'lobby' || this.startedAt) {
      return { ok: false, error: 'Partida já iniciada.', code: 'match_started' };
    }
    if (this.players.size >= this.maxPlayers) {
      return { ok: false, error: 'Lobby cheio', code: 'lobby_full' };
    }
    if (this.password) {
      const provided = opts.password == null ? '' : String(opts.password);
      // Criador passa password: null explicitamente via opts.skipPassword
      if (!opts.skipPassword && provided !== this.password) {
        return { ok: false, error: 'Senha incorreta', code: 'bad_password' };
      }
    }

    const characterId = opts.characterId || null;
    if (characterId) {
      for (const [sid, p] of this.players) {
        if (!p.isBot && p.characterId === characterId && sid !== socket.id) {
          return {
            ok: false,
            error: 'Você já está em uma sala.',
            code: 'already_in_lobby',
          };
        }
      }
    }

    const player = this.createPlayerState(socket.id, name, false, {
      color: opts.color,
      skin: opts.skin,
      characterId,
      bonuses: opts.bonuses || {},
    });
    this.players.set(socket.id, player);
    socket.join(this.id);
    this.broadcastLobby();
    return { ok: true, playerId: socket.id };
  }

  addBots(count = 1) {
    if (this.phase !== 'lobby') return { ok: false, error: 'Match already started' };
    const names = ['Hexa', 'Nyx', 'Orb', 'Rune', 'Ash', 'Vex'];
    let added = 0;
    for (let i = 0; i < count; i++) {
      if (this.players.size >= this.maxPlayers) break;
      const botId = `bot_${eid()}`;
      const name = names[this.bots.length % names.length] + ' Bot';
      const player = this.createPlayerState(botId, name, true);
      this.players.set(botId, player);
      this.bots.push(new BotController(this, botId));
      added += 1;
    }
    this.broadcastLobby();
    this.tryStart();
    return { ok: true, added };
  }

  removeBots(count = 1) {
    if (this.phase !== 'lobby') return { ok: false, error: 'Match already started' };
    let removed = 0;
    for (let i = 0; i < count; i++) {
      const bot = this.bots.pop();
      if (!bot) break;
      this.players.delete(bot.playerId);
      removed += 1;
    }
    if (removed > 0) this.broadcastLobby();
    return { ok: true, removed };
  }

  removePlayer(socketId) {
    const p = this.players.get(socketId);
    if (!p) return;
    const leftName = p.name;
    this.players.delete(socketId);
    this.bots = this.bots.filter((b) => b.playerId !== socketId);

    // Se só restaram bots no lobby, limpa
    const humans = [...this.players.values()].filter((pl) => !pl.isBot);
    if (humans.length === 0) {
      for (const bot of [...this.players.keys()]) this.players.delete(bot);
      this.bots = [];
      this.destroy();
      return;
    }

    if (this.phase === 'lobby') {
      this.broadcastLobby();
      return;
    }

    this.pushEvent({ type: 'player_left', playerId: socketId, name: leftName });
    this.broadcastState(true);
    this.checkRoundEnd();
  }

  setReady(socketId, ready) {
    const p = this.players.get(socketId);
    if (!p || this.phase !== 'lobby') return;
    p.ready = !!ready;
    this.broadcastLobby();
    this.tryStart();
  }

  tryStart() {
    if (this.phase !== 'lobby') return;
    if (this.players.size < CONFIG.MIN_PLAYERS) return;
    const allReady = [...this.players.values()].every((p) => p.ready);
    if (!allReady) return;
    this.startCountdown();
  }

  /** Limpa entidades/efeitos e regenera o chão da arena para o próximo round. */
  clearArena() {
    this.arenaRadius = CONFIG.ARENA_START_RADIUS;
    this.nextShrinkAt = CONFIG.ARENA_SHRINK_INTERVAL;
    this.shrinksDone = 0;
    this.shrinkActive = false;
    this.shrinkFrom = CONFIG.ARENA_START_RADIUS;
    this.shrinkTo = CONFIG.ARENA_START_RADIUS;
    this.shrinkElapsed = 0;
    this.monsterSpawnTimer = 1;
    this.xpPassiveTimer = 0;
    if (CONFIG.MONSTER_PERSIST_ROUNDS) {
      this.monsters = this.monsters.filter((m) => m.alive);
      for (const m of this.monsters) {
        m.vx = 0;
        m.vy = 0;
        m.attackCd = 0;
        m.novaCd = 0;
        m.stunTimer = 0;
        m.knockbackTimer = 0;
        m.knockbackDx = 0;
        m.knockbackDy = 0;
      }
    } else {
      this.monsters = [];
    }
    this.projectiles = [];
    this.aoes = [];
    // Início de rodada: limpa corpos, sangue, loot e dinheiro do chão
    this.effects = [];
    this.lootBags = [];
    this.coins = [];
    this.meteors = [];
    this.meteorTimer = 0;
    this.massHeals = [];
    this.massHealTimer = 0;
    this.cooldownMists = [];
    this.cooldownMistTimer = 0;
    this.gales = [];
    this.galeTimer = 0;
    this.levers = [];
    this.leverTimer = 0;
    this.events = [];
    this.winnerId = null;
    this.generateRocks();
    if (CONFIG.MONSTER_PERSIST_ROUNDS && this.monsters.length) {
      for (const m of this.monsters) {
        this.clampMonsterToArena(m);
      }
    }
  }

  /** Posiciona e reseta os jogadores nos spawns do round. */
  placePlayersForRound() {
    const list = [...this.players.values()];
    list.forEach((p, i) => {
      const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      p.x = CONFIG.ARENA_CENTER_X + Math.cos(angle) * 140;
      p.y = CONFIG.ARENA_CENTER_Y + Math.sin(angle) * 140;
      const hpBonus = p.bonuses?.maxHpBonus || 0;
      p.maxHp = Math.round(CONFIG.PLAYER_MAX_HP * (1 + hpBonus));
      p.hp = p.maxHp;
      p.alive = true;
      p.shield = 0;
      p.maxShield = 0;
      p.shieldTimer = 0;
      p.slow = 0;
      p.slowTimer = 0;
      p.poisonTimer = 0;
      p.poisonDamage = 0;
      p.poisonTickAcc = 0;
      p.poisonOwnerId = null;
      p.burnTimer = 0;
      p.burnDamage = 0;
      p.burnTickAcc = 0;
      p.burnOwnerId = null;
      p.stunTimer = 0;
      p.knockbackTimer = 0;
      p.knockbackDx = 0;
      p.knockbackDy = 0;
      p.zoneDmgAcc = 0;
      p.vx = 0;
      p.vy = 0;
      p.spells = stripInnateSpells(p.spells);
      for (const s of p.spells) s.cooldownLeft = 0;
      p.barrierCooldown = 0;
      p.barrierBuffer = 0;
      p.mendCooldown = 0;
      p.mendBuffer = 0;
      p.blinkCooldown = 0;
      p.blinkBuffer = 0;
      if (p.ultimate) {
        p.ultimate.cooldownLeft = 0;
        p.ultimate.usedThisRound = false;
      }
    });
  }

  /** Prepara arena limpa + spawns visíveis antes da contagem. */
  prepareRound() {
    this.clearArena();
    this.placePlayersForRound();
  }

  startCountdown() {
    this.afterLevelUp = null;
    this.prepareRound();
    const leftLobbyBrowser = this.phase === 'lobby';
    this.phase = 'countdown';
    this.countdown = 3;
    if (!this.startedAt) this.startedAt = new Date();
    this.broadcast({ type: 'countdown', seconds: this.countdown });
    this.broadcastState(true);
    this.ensureLoop();
    // Remove a sala da listagem assim que a partida inicia.
    if (leftLobbyBrowser) this.onLobbyListChange?.();
  }

  /** Após intermissão: prepara a arena e inicia o próximo round/boss sem contagem. */
  beginRoundAfterIntermission() {
    this.afterLevelUp = null;
    this.prepareRound();
    if (this.pendingBossFight || this.needsBossFightAfterRound(this.round)) {
      this.pendingBossFight = true;
      this.startBossFight();
      return;
    }
    this.startRound();
  }

  /** Sorteia (1x) se a boss fight deve ocorrer após o round, segundo BOSS_FIGHT_CHANCE. */
  rollBossAppear(round) {
    if (this.bossAppearRolls.has(round)) return this.bossAppearRolls.get(round) === true;
    const minRound = Math.max(1, Math.floor(Number(CONFIG.BOSS_FIGHT_MIN_ROUND) || 50));
    if (Math.floor(Number(round)) < minRound) {
      this.bossAppearRolls.set(round, false);
      return false;
    }
    const chance = Math.min(1, Math.max(0, Number(CONFIG.BOSS_FIGHT_CHANCE) || 0));
    const ok = Math.random() < chance;
    this.bossAppearRolls.set(round, ok);
    return ok;
  }

  /** Ainda falta a boss fight depois deste round (chance sorteada uma vez). */
  needsBossFightAfterRound(round = this.round) {
    if (this.pendingBossFight) return true;
    if (this.clearedBossFights.has(round)) return false;
    const r = Math.floor(Number(round));
    if (r < 1) return false;
    const minRound = Math.max(1, Math.floor(Number(CONFIG.BOSS_FIGHT_MIN_ROUND) || 50));
    if (r < minRound) return false;
    return this.rollBossAppear(r);
  }

  /** Inicia boss fight logo após o round (sem intermissão/contagem). */
  queueBossFight() {
    this.pendingBossFight = true;
    console.log('[match] queue boss fight', {
      matchId: this.id,
      round: this.round,
      chance: CONFIG.BOSS_FIGHT_CHANCE,
    });
    this.prepareRound();
    this.startBossFight();
  }

  startRound() {
    this.round += 1;
    this.phase = 'playing';
    this.roundTime = 0;
    this.bossRound = false;
    this.pendingBossFight = false;
    this.scheduleNextMeteor();
    this.scheduleNextMassHeal();
    this.scheduleNextCooldownMist();
    this.scheduleNextGale();
    this.scheduleNextLever();
    this.pushEvent({ type: 'round_start', round: this.round, bossRound: false });
    this.broadcastState(true);
  }

  /** Boss fight logo após um round de BOSS_APPEARS (sem avançar o número do round). */
  startBossFight() {
    this.pendingBossFight = false;
    this.phase = 'playing';
    this.roundTime = 0;
    this.bossRound = true;
    this.scheduleNextMeteor();
    this.scheduleNextMassHeal();
    this.scheduleNextCooldownMist();
    this.scheduleNextGale();
    this.scheduleNextLever();
    this.monsters = [];
    const boss = this.spawnBoss();
    if (!boss) {
      console.error('[match] spawnBoss falhou — nenhum boss disponível', {
        matchId: this.id,
        round: this.round,
        floor: this.floorType,
      });
    }
    this.pushEvent({ type: 'boss_fight', round: this.round });
    this.pushEvent({ type: 'round_start', round: this.round, bossRound: true });
    this.broadcastState(true);
  }

  /** True se um novo evento de arena (buff/debuff/dano) pode iniciar. */
  canSpawnArenaEvent() {
    return (this.arenaEventCooldown || 0) <= 0;
  }

  /** Marca o início de um evento e arma o cooldown global da partida. */
  beginArenaEvent() {
    const cd = CONFIG.ARENA_EVENT_COOLDOWN;
    if (cd > 0) this.arenaEventCooldown = cd;
  }

  tickArenaEventCooldown(dt) {
    if ((this.arenaEventCooldown || 0) <= 0) return;
    this.arenaEventCooldown = Math.max(0, this.arenaEventCooldown - dt);
  }

  scheduleNextMeteor() {
    const min = CONFIG.METEOR_EVENT_MIN_INTERVAL;
    const max = Math.max(min, CONFIG.METEOR_EVENT_MAX_INTERVAL);
    this.meteorTimer = min + Math.random() * (max - min);
  }

  scheduleNextMassHeal() {
    const min = CONFIG.MASS_HEAL_EVENT_MIN_INTERVAL;
    const max = Math.max(min, CONFIG.MASS_HEAL_EVENT_MAX_INTERVAL);
    this.massHealTimer = min + Math.random() * (max - min);
  }

  scheduleNextCooldownMist() {
    const min = CONFIG.COOLDOWN_MIST_EVENT_MIN_INTERVAL;
    const max = Math.max(min, CONFIG.COOLDOWN_MIST_EVENT_MAX_INTERVAL);
    this.cooldownMistTimer = min + Math.random() * (max - min);
  }

  scheduleNextGale() {
    const min = CONFIG.GALE_EVENT_MIN_INTERVAL;
    const max = Math.max(min, CONFIG.GALE_EVENT_MAX_INTERVAL);
    this.galeTimer = min + Math.random() * (max - min);
  }

  scheduleNextLever() {
    const min = CONFIG.LEVER_EVENT_MIN_INTERVAL;
    const max = Math.max(min, CONFIG.LEVER_EVENT_MAX_INTERVAL);
    this.leverTimer = min + Math.random() * (max - min);
  }

  /** Escolhe um ponto na plataforma segura para o meteoro. */
  pickMeteorPoint(radius) {
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = this.arenaRadius * (0.15 + Math.random() * 0.7);
      const x = CONFIG.ARENA_CENTER_X + Math.cos(ang) * r;
      const y = CONFIG.ARENA_CENTER_Y + Math.sin(ang) * r;
      if (!this.isBlockedByRock(x, y, Math.min(18, radius * 0.35))) {
        return { x, y };
      }
    }
    return { x: CONFIG.ARENA_CENTER_X, y: CONFIG.ARENA_CENTER_Y };
  }

  spawnMeteorEvent() {
    const radius = CONFIG.METEOR_RADIUS;
    const { x, y } = this.pickMeteorPoint(radius);
    const warnMax = CONFIG.METEOR_WARN_TIME;
    this.meteors.push({
      entityId: eid(),
      x,
      y,
      radius,
      damage: CONFIG.METEOR_DAMAGE,
      phase: 'warn',
      life: warnMax,
      maxLife: warnMax,
      seed: (Math.random() * 1e9) | 0,
      color: 0xff4422,
    });
    this.pushEvent({ type: 'meteor_warn', x, y, radius });
  }

  applyMeteorDamage(meteor) {
    // fromHit=false: dano ambiental (sem sangue/spam no painel por entidade)
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (dist(meteor, p) <= meteor.radius + CONFIG.PLAYER_RADIUS) {
        this.damageEntity(p, meteor.damage, null, true, false);
      }
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (dist(meteor, m) <= meteor.radius + (m.radius || CONFIG.MONSTER_RADIUS)) {
        this.damageEntity(m, meteor.damage, null, false, false, { element: 'fire' });
      }
    }
  }

  tickMeteors(dt) {
    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0) {
      if (this.canSpawnArenaEvent()) {
        this.spawnMeteorEvent();
        this.beginArenaEvent();
        this.scheduleNextMeteor();
      } else {
        this.meteorTimer = 0;
      }
    }

    for (const m of this.meteors) {
      m.life -= dt;
      if (m.phase === 'warn' && m.life <= 0) {
        this.applyMeteorDamage(m);
        m.phase = 'impact';
        m.life = CONFIG.METEOR_IMPACT_TIME;
        m.maxLife = CONFIG.METEOR_IMPACT_TIME;
        this.pushEvent({
          type: 'meteor_strike',
          x: m.x,
          y: m.y,
          radius: m.radius,
          damage: m.damage,
        });
        // Visual só via serializeMeteorEffects (meteor_strike) — evita burst duplicado no client
      }
    }
    this.meteors = this.meteors.filter((m) => m.life > 0);
  }

  serializeMeteorEffects() {
    return this.meteors.map((m) => ({
      type: m.phase === 'warn' ? 'meteor_warn' : 'meteor_strike',
      entityId: m.entityId,
      x: m.x,
      y: m.y,
      radius: m.radius,
      life: Math.max(0, m.life),
      maxLife: m.maxLife,
      color: m.color,
      seed: m.seed,
    }));
  }

  spawnMassHealEvent() {
    const radius = CONFIG.MASS_HEAL_RADIUS;
    const { x, y } = this.pickMeteorPoint(radius);
    const warnMax = CONFIG.MASS_HEAL_WARN_TIME;
    this.massHeals.push({
      entityId: eid(),
      x,
      y,
      radius,
      heal: CONFIG.MASS_HEAL_AMOUNT,
      phase: 'warn',
      life: warnMax,
      maxLife: warnMax,
      seed: (Math.random() * 1e9) | 0,
      color: 0x55ff88,
    });
    this.pushEvent({ type: 'mass_heal_warn', x, y, radius });
  }

  applyMassHeal(event) {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (dist(event, p) > event.radius + CONFIG.PLAYER_RADIUS) continue;
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + event.heal);
      const gained = p.hp - before;
      if (gained > 0) {
        this.pushEvent({
          type: 'heal',
          playerId: p.id,
          amount: gained,
          x: p.x,
          y: p.y,
        });
      }
    }
  }

  tickMassHeals(dt) {
    this.massHealTimer -= dt;
    if (this.massHealTimer <= 0) {
      if (this.canSpawnArenaEvent()) {
        this.spawnMassHealEvent();
        this.beginArenaEvent();
        this.scheduleNextMassHeal();
      } else {
        this.massHealTimer = 0;
      }
    }

    for (const h of this.massHeals) {
      h.life -= dt;
      if (h.phase === 'warn' && h.life <= 0) {
        this.applyMassHeal(h);
        h.phase = 'impact';
        h.life = CONFIG.MASS_HEAL_IMPACT_TIME;
        h.maxLife = CONFIG.MASS_HEAL_IMPACT_TIME;
        this.pushEvent({
          type: 'mass_heal_strike',
          x: h.x,
          y: h.y,
          radius: h.radius,
          heal: h.heal,
        });
      }
    }
    this.massHeals = this.massHeals.filter((h) => h.life > 0);
  }

  serializeMassHealEffects() {
    return this.massHeals.map((h) => ({
      type: h.phase === 'warn' ? 'mass_heal_warn' : 'mass_heal_strike',
      entityId: h.entityId,
      x: h.x,
      y: h.y,
      radius: h.radius,
      life: Math.max(0, h.life),
      maxLife: h.maxLife,
      color: h.color,
      seed: h.seed,
    }));
  }

  spawnCooldownMistEvent() {
    const radius = CONFIG.COOLDOWN_MIST_RADIUS;
    const { x, y } = this.pickMeteorPoint(radius);
    const warnMax = CONFIG.COOLDOWN_MIST_WARN_TIME;
    const reduction = Math.min(1, Math.max(0, CONFIG.COOLDOWN_MIST_REDUCTION));
    this.cooldownMists.push({
      entityId: eid(),
      x,
      y,
      radius,
      reduction,
      phase: 'warn',
      life: warnMax,
      maxLife: warnMax,
      seed: (Math.random() * 1e9) | 0,
      color: 0xaa66ff,
    });
    this.pushEvent({ type: 'cooldown_mist_warn', x, y, radius });
  }

  applyCooldownMist(event) {
    const mul = 1 - (event.reduction ?? CONFIG.COOLDOWN_MIST_REDUCTION);
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (dist(event, p) > event.radius + CONFIG.PLAYER_RADIUS) continue;
      p.dashCooldown = Math.max(0, (p.dashCooldown || 0) * mul);
      p.barrierCooldown = Math.max(0, (p.barrierCooldown || 0) * mul);
      p.mendCooldown = Math.max(0, (p.mendCooldown || 0) * mul);
      p.blinkCooldown = Math.max(0, (p.blinkCooldown || 0) * mul);
      for (const s of p.spells) {
        s.cooldownLeft = Math.max(0, (s.cooldownLeft || 0) * mul);
      }
      if (p.ultimate) {
        p.ultimate.cooldownLeft = Math.max(0, (p.ultimate.cooldownLeft || 0) * mul);
      }
      this.pushEvent({
        type: 'cooldown_mist',
        playerId: p.id,
        reduction: event.reduction,
        x: p.x,
        y: p.y,
      });
    }
  }

  tickCooldownMists(dt) {
    this.cooldownMistTimer -= dt;
    if (this.cooldownMistTimer <= 0) {
      if (this.canSpawnArenaEvent()) {
        this.spawnCooldownMistEvent();
        this.beginArenaEvent();
        this.scheduleNextCooldownMist();
      } else {
        this.cooldownMistTimer = 0;
      }
    }

    for (const m of this.cooldownMists) {
      m.life -= dt;
      if (m.phase === 'warn' && m.life <= 0) {
        this.applyCooldownMist(m);
        m.phase = 'impact';
        m.life = CONFIG.COOLDOWN_MIST_IMPACT_TIME;
        m.maxLife = CONFIG.COOLDOWN_MIST_IMPACT_TIME;
        this.pushEvent({
          type: 'cooldown_mist_strike',
          x: m.x,
          y: m.y,
          radius: m.radius,
          reduction: m.reduction,
        });
      }
    }
    this.cooldownMists = this.cooldownMists.filter((m) => m.life > 0);
  }

  serializeCooldownMistEffects() {
    return this.cooldownMists.map((m) => ({
      type: m.phase === 'warn' ? 'cooldown_mist_warn' : 'cooldown_mist_strike',
      entityId: m.entityId,
      x: m.x,
      y: m.y,
      radius: m.radius,
      life: Math.max(0, m.life),
      maxLife: m.maxLife,
      color: m.color,
      seed: m.seed,
    }));
  }

  spawnGaleEvent() {
    const radius = CONFIG.GALE_RADIUS;
    const { x, y } = this.pickMeteorPoint(radius);
    const warnMax = CONFIG.GALE_WARN_TIME;
    const seed = (Math.random() * 1e9) | 0;
    // Direção da ventania (lado → lado), estável por evento
    const angle = ((seed % 360) / 360) * Math.PI * 2;
    this.gales.push({
      entityId: eid(),
      x,
      y,
      radius,
      angle,
      speedMul: CONFIG.GALE_SPEED_MUL,
      inertiaMul: CONFIG.GALE_INERTIA_MUL,
      phase: 'warn',
      life: warnMax,
      maxLife: warnMax,
      seed,
      color: 0xa8d8ff,
    });
    this.pushEvent({ type: 'gale_warn', x, y, radius, angle });
  }

  /** Buff de vento se o jogador estiver dentro de alguma ventania ativa. */
  galeBuffFor(p) {
    for (const g of this.gales) {
      if (g.phase !== 'impact') continue;
      if (dist(g, p) <= g.radius + CONFIG.PLAYER_RADIUS) {
        return {
          speedMul: g.speedMul ?? CONFIG.GALE_SPEED_MUL,
          inertiaMul: g.inertiaMul ?? CONFIG.GALE_INERTIA_MUL,
        };
      }
    }
    return { speedMul: 1, inertiaMul: 1 };
  }

  tickGales(dt) {
    this.galeTimer -= dt;
    if (this.galeTimer <= 0) {
      if (this.canSpawnArenaEvent()) {
        this.spawnGaleEvent();
        this.beginArenaEvent();
        this.scheduleNextGale();
      } else {
        this.galeTimer = 0;
      }
    }

    for (const g of this.gales) {
      g.life -= dt;
      if (g.phase === 'warn' && g.life <= 0) {
        g.phase = 'impact';
        g.life = CONFIG.GALE_DURATION;
        g.maxLife = CONFIG.GALE_DURATION;
        this.pushEvent({
          type: 'gale_strike',
          x: g.x,
          y: g.y,
          radius: g.radius,
          angle: g.angle,
        });
      }
    }
    this.gales = this.gales.filter((g) => g.life > 0);
  }

  serializeGaleEffects() {
    return this.gales.map((g) => ({
      type: g.phase === 'warn' ? 'gale_warn' : 'gale_strike',
      entityId: g.entityId,
      x: g.x,
      y: g.y,
      radius: g.radius,
      angle: g.angle,
      life: Math.max(0, g.life),
      maxLife: g.maxLife,
      color: g.color,
      seed: g.seed,
    }));
  }

  spawnLeverEvent() {
    const radius = CONFIG.LEVER_RADIUS;
    const { x, y } = this.pickMeteorPoint(radius);
    const appearMax = Math.max(0.05, CONFIG.LEVER_APPEAR_TIME);
    this.levers.push({
      entityId: eid(),
      x,
      y,
      radius,
      /** left = alavanca virada à esquerda; right = puxada. */
      facing: 'left',
      phase: 'appear',
      life: appearMax,
      maxLife: appearMax,
      seed: (Math.random() * 1e9) | 0,
      color: 0xd4a574,
      activatedBy: null,
    });
    this.pushEvent({ type: 'lever_spawn', x, y, radius });
  }

  /** Expande a arena segura e retoma o fechamento a partir do raio atual. */
  expandArenaFromLever(playerId = null) {
    const amount = CONFIG.ARENA_SHRINK_AMOUNT * CONFIG.LEVER_EXPAND_RATIO;
    if (!(amount > 0)) return 0;
    const before = this.arenaRadius;
    const wasShrinking = this.shrinkActive;

    // Se a zona está fechando, congela no raio atual (a fase não conta como concluída).
    if (this.shrinkActive) {
      this.shrinkActive = false;
      this.shrinkFrom = this.arenaRadius;
      this.shrinkTo = this.arenaRadius;
      this.shrinkElapsed = 0;
    }

    this.arenaRadius += amount;
    const gained = this.arenaRadius - before;
    if (gained > 0) {
      this.pushEvent({
        type: 'lever_expand',
        playerId,
        radius: this.arenaRadius,
        amount: +gained.toFixed(2),
      });
    }

    if (wasShrinking && this.shrinksDone < CONFIG.ARENA_SHRINK_TIMES) {
      this.resumeArenaShrinkFromCurrent();
    }

    return gained;
  }

  /** Inicia (ou reinicia) o fechamento gradual a partir do raio atual. */
  resumeArenaShrinkFromCurrent() {
    this.shrinkFrom = this.arenaRadius;
    this.shrinkTo = Math.max(
      CONFIG.ARENA_MIN_RADIUS,
      this.arenaRadius - CONFIG.ARENA_SHRINK_AMOUNT
    );
    this.shrinkElapsed = 0;
    this.pushEvent({ type: 'arena_shrink', radius: this.shrinkTo });
    if (CONFIG.ARENA_SHRINK_DURATION <= 0) {
      this.arenaRadius = this.shrinkTo;
      this.shrinkActive = false;
      this.shrinksDone += 1;
      this.cullTreesOutsideArena();
      this.cullRocksOutsideArena();
    } else {
      this.shrinkActive = true;
    }
  }

  activateLever(lever, player) {
    if (lever.phase === 'pulled') return;
    lever.facing = 'right';
    lever.phase = 'pulled';
    lever.life = CONFIG.LEVER_PULL_TIME;
    lever.maxLife = CONFIG.LEVER_PULL_TIME;
    lever.activatedBy = player?.id || null;
    this.expandArenaFromLever(player?.id || null);
    this.pushEvent({
      type: 'lever_pull',
      playerId: player?.id || null,
      x: lever.x,
      y: lever.y,
      radius: lever.radius,
    });
  }

  tickLevers(dt) {
    this.leverTimer -= dt;
    if (this.leverTimer <= 0) {
      // Alavanca é independente do cooldown global (meteoro/cura/névoa/vento),
      // senão ficava em timer=0 e nunca ganhava a fila após o 1º spawn.
      this.spawnLeverEvent();
      this.scheduleNextLever();
    }

    const pickupR = CONFIG.PLAYER_RADIUS + CONFIG.LEVER_RADIUS;
    for (const lever of this.levers) {
      lever.life -= dt;
      if (lever.phase === 'appear' && lever.life <= 0) {
        lever.phase = 'ready';
        lever.facing = 'left';
        lever.life = CONFIG.LEVER_LIFETIME;
        lever.maxLife = CONFIG.LEVER_LIFETIME;
      } else if (lever.phase === 'ready') {
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (dist(p, lever) > pickupR) continue;
          this.activateLever(lever, p);
          break;
        }
      }
    }
    this.levers = this.levers.filter((l) => l.life > 0);
  }

  serializeLeverEffects() {
    return this.levers.map((l) => ({
      type:
        l.phase === 'appear'
          ? 'lever_appear'
          : l.phase === 'pulled'
            ? 'lever_pulled'
            : 'lever_ready',
      entityId: l.entityId,
      x: l.x,
      y: l.y,
      radius: l.radius,
      facing: l.facing,
      life: Math.max(0, l.life),
      maxLife: l.maxLife,
      color: l.color,
      seed: l.seed,
      playerId: l.activatedBy,
    }));
  }

  ensureLoop() {
    if (this.running) return;
    this.running = true;
    const dt = 1 / CONFIG.TICK_RATE;
    this._interval = setInterval(() => this.tick(dt), 1000 / CONFIG.TICK_RATE);
  }

  destroy() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
    this.running = false;
    this.phase = 'ended';
  }

  setInput(socketId, input) {
    const p = this.players.get(socketId);
    if (!p) return;
    const dash =
      input.dash === 'up' ||
      input.dash === 'down' ||
      input.dash === 'left' ||
      input.dash === 'right'
        ? input.dash
        : null;
    const castSlot = Number.isInteger(input.castSlot) ? input.castSlot : -1;
    // Latch cast/dash/barrier/mend/blink until the next tick consumes them — client frames are much
    // faster than TICK_RATE, so a one-frame press would otherwise be overwritten.
    if (dash) p.dashBuffer = 0.2;
    if (input.barrier) p.barrierBuffer = 0.2;
    if (input.mend) p.mendBuffer = 0.2;
    if (input.blink) p.blinkBuffer = 0.2;
    p.input = {
      up: !!input.up,
      down: !!input.down,
      left: !!input.left,
      right: !!input.right,
      aimX: Number(input.aimX) || 0,
      aimY: Number(input.aimY) || 0,
      castSlot: castSlot >= 0 ? castSlot : p.input.castSlot,
      dash: dash || p.input.dash,
      barrier: !!(input.barrier || p.input.barrier),
      mend: !!(input.mend || p.input.mend),
      blink: !!(input.blink || p.input.blink),
    };
  }

  tryStartDash(player) {
    const dir = player.input?.dash;
    if (!dir) return;
    if (!player.alive) {
      player.input.dash = null;
      player.dashBuffer = 0;
      return;
    }
    if (
      player.stunTimer > 0 ||
      (player.knockbackTimer || 0) > 0 ||
      player.dashCooldown > 0 ||
      player.dashTimer > 0
    ) {
      // Só mantém buffer curto (~200ms); evita dash “fantasma” no fim do CD.
      if ((player.dashBuffer || 0) <= 0) player.input.dash = null;
      return;
    }

    let dx = 0;
    let dy = 0;
    if (dir === 'up') dy = -1;
    else if (dir === 'down') dy = 1;
    else if (dir === 'left') dx = -1;
    else if (dir === 'right') dx = 1;
    else {
      player.input.dash = null;
      return;
    }

    player.dashDx = dx;
    player.dashDy = dy;
    player.dashTimer = CONFIG.PLAYER_DASH_DURATION;
    player.dashCooldown = CONFIG.PLAYER_DASH_COOLDOWN;
    player.dashBuffer = 0;
    player.vx = dx * CONFIG.PLAYER_DASH_SPEED;
    player.vy = dy * CONFIG.PLAYER_DASH_SPEED;
    this.effects.push({
      type: 'dash',
      x: player.x,
      y: player.y,
      dx,
      dy,
      life: Math.max(0.18, CONFIG.PLAYER_DASH_DURATION + 0.08),
      color: player.color || 0xffffff,
    });
    player.input.dash = null;
  }

  clearInnateRequest(player, kind) {
    if (kind === 'barrier') {
      player.input.barrier = false;
      player.barrierBuffer = 0;
    } else if (kind === 'mend') {
      player.input.mend = false;
      player.mendBuffer = 0;
    } else if (kind === 'blink') {
      player.input.blink = false;
      player.blinkBuffer = 0;
    }
  }

  /** Escudo inato (E) — disponível desde o nível 1. */
  tryCastBarrier(player) {
    const wants = player.input?.barrier || (player.barrierBuffer || 0) > 0;
    if (!wants) return;
    if (!player.alive) {
      this.clearInnateRequest(player, 'barrier');
      return;
    }
    const unlockAt = innateUnlockLevel('barrier');
    if (
      (player.level || 1) < unlockAt ||
      player.stunTimer > 0 ||
      (player.barrierCooldown || 0) > 0 ||
      (player.shield || 0) > 0
    ) {
      this.clearInnateRequest(player, 'barrier');
      return;
    }

    const stats = spellStats('barrier', 1);
    if (!stats) {
      this.clearInnateRequest(player, 'barrier');
      return;
    }

    const levelBonus = Math.max(0, (player.level || 1) - 1) * (CONFIG.PLAYER_SHIELD_PER_LEVEL || 0);
    const shieldBonus = player.bonuses?.shieldBonus || 0;
    const shield = Math.max(1, Math.round(((stats.shield || 0) + levelBonus) * (1 + shieldBonus)));
    player.shield = shield;
    player.maxShield = shield;
    player.shieldTimer = stats.duration;
    player.barrierCooldown = stats.cooldown;
    this.clearInnateRequest(player, 'barrier');
    this.effects.push({
      type: 'barrier',
      x: player.x,
      y: player.y,
      life: 0.7,
      maxLife: 0.7,
      color: stats.color,
      radius: 40,
    });
  }

  /** Heal inato (H) — disponível desde o nível 1. */
  tryCastMend(player) {
    const wants = player.input?.mend || (player.mendBuffer || 0) > 0;
    if (!wants) return;
    if (!player.alive) {
      this.clearInnateRequest(player, 'mend');
      return;
    }
    const unlockAt = innateUnlockLevel('mend');
    if (
      (player.level || 1) < unlockAt ||
      player.stunTimer > 0 ||
      (player.mendCooldown || 0) > 0 ||
      player.hp >= player.maxHp
    ) {
      this.clearInnateRequest(player, 'mend');
      return;
    }

    const stats = spellStats('mend', 1);
    if (!stats) {
      this.clearInnateRequest(player, 'mend');
      return;
    }

    const levelBonus = Math.max(0, (player.level || 1) - 1) * (CONFIG.PLAYER_HEAL_PER_LEVEL || 0);
    const healBonus = player.bonuses?.healBonus || 0;
    const heal = Math.max(1, Math.round(((stats.heal || 0) + levelBonus) * (1 + healBonus)));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    player.mendCooldown = stats.cooldown;
    this.clearInnateRequest(player, 'mend');
    this.effects.push({
      type: 'heal',
      x: player.x,
      y: player.y,
      life: 0.75,
      maxLife: 0.75,
      color: stats.color,
      radius: 42,
    });
  }

  /** Blink inato (B) — liberado no nível 5. */
  tryCastBlink(player) {
    const wants = player.input?.blink || (player.blinkBuffer || 0) > 0;
    if (!wants) return;
    if (!player.alive) {
      this.clearInnateRequest(player, 'blink');
      return;
    }
    const unlockAt = innateUnlockLevel('blink');
    if (
      (player.level || 1) < unlockAt ||
      player.stunTimer > 0 ||
      (player.blinkCooldown || 0) > 0
    ) {
      this.clearInnateRequest(player, 'blink');
      return;
    }

    const stats = spellStats('blink', 1);
    if (!stats) {
      this.clearInnateRequest(player, 'blink');
      return;
    }

    const fromX = player.x;
    const fromY = player.y;
    const aimDx = (player.input?.aimX || player.x) - player.x;
    const aimDy = (player.input?.aimY || player.y) - player.y;
    const aimLen = Math.hypot(aimDx, aimDy) || 1;
    const dirX = aimDx / aimLen;
    const dirY = aimDy / aimLen;
    const distBlink = Math.min(stats.range, Math.hypot(aimDx, aimDy) || stats.range);

    player.x = clamp(
      player.x + dirX * distBlink,
      CONFIG.ARENA_CENTER_X - 900,
      CONFIG.ARENA_CENTER_X + 900
    );
    player.y = clamp(
      player.y + dirY * distBlink,
      CONFIG.ARENA_CENTER_Y - 900,
      CONFIG.ARENA_CENTER_Y + 900
    );
    player.vx = 0;
    player.vy = 0;
    this.resolveRockCollision(player, CONFIG.PLAYER_RADIUS);
    player.blinkCooldown = stats.cooldown;
    this.clearInnateRequest(player, 'blink');
    this.effects.push({
      type: 'blink',
      phase: 'out',
      x: fromX,
      y: fromY,
      x2: player.x,
      y2: player.y,
      life: 0.5,
      maxLife: 0.5,
      color: stats.color,
      radius: 36,
    });
    this.effects.push({
      type: 'blink',
      phase: 'in',
      x: player.x,
      y: player.y,
      x2: fromX,
      y2: fromY,
      life: 0.55,
      maxLife: 0.55,
      color: stats.color,
      radius: 36,
    });
  }

  /** Atribui um novo pacote de escolhas com id único (anti double-click / stale). */
  assignSpellChoices(player) {
    player.spellChoices = rollSpellChoices(player, player.level);
    player.choiceSetId = eid();
    player.choiceDeadlineAt =
      CONFIG.LEVELUP_CHOICE_TIMEOUT > 0
        ? this.matchTime + CONFIG.LEVELUP_CHOICE_TIMEOUT
        : null;
  }

  /**
   * Aceita index e/ou { spellId, kind, choiceSetId }.
   * Limpa as escolhas antes de aplicar para evitar aplicar 2x no mesmo pacote
   * ou aplicar o índice antigo no pacote seguinte.
   */
  chooseSpell(socketId, payload) {
    const p = this.players.get(socketId);
    if (!p || !p.spellChoices?.length || p.pendingLevelUps <= 0) return;

    const data = typeof payload === 'number' ? { index: payload } : payload || {};
    if (data.choiceSetId != null && p.choiceSetId != null && data.choiceSetId !== p.choiceSetId) {
      return; // clique atrasado de um pacote antigo
    }

    let choice = null;
    if (data.spellId) {
      choice = p.spellChoices.find(
        (c) =>
          c.spellId === data.spellId &&
          (!data.kind || c.kind === data.kind) &&
          (data.fromLevel == null || c.fromLevel === data.fromLevel)
      );
    }
    if (!choice && Number.isInteger(data.index)) {
      choice = p.spellChoices[data.index];
    }
    if (!choice) return;

    // Trava atômica: nenhum segundo choose_spell pode usar este pacote.
    const lockedChoice = choice;
    p.spellChoices = null;
    p.choiceSetId = null;
    p.choiceDeadlineAt = null;

    if (!applySpellChoice(p, lockedChoice)) {
      // Falha rara — devolve o pacote para o jogador não ficar preso.
      this.assignSpellChoices(p);
      this.broadcastState(true);
      return;
    }

    p.pendingLevelUps = Math.max(0, p.pendingLevelUps - 1);
    if (p.pendingLevelUps > 0) {
      this.assignSpellChoices(p);
    }
    this.maybeResumeFromLevelUp();
    this.broadcastState(true);
  }

  /** Escolhe automaticamente se o tempo da tela de magia expirou. */
  resolveLevelUpTimeouts() {
    if (CONFIG.LEVELUP_CHOICE_TIMEOUT <= 0) return;
    const liveChoice =
      this.phase === 'playing' || this.phase === 'intermission' || this.phase === 'countdown';
    if (this.phase !== 'levelup' && !liveChoice) return;
    for (const p of [...this.players.values()]) {
      if (!p.alive || p.pendingLevelUps <= 0 || !p.spellChoices?.length) continue;
      if (p.choiceDeadlineAt == null || this.matchTime < p.choiceDeadlineAt) continue;
      const index = Math.floor(Math.random() * p.spellChoices.length);
      const choice = p.spellChoices[index];
      this.chooseSpell(p.id, {
        index,
        spellId: choice.spellId,
        kind: choice.kind,
        fromLevel: choice.fromLevel,
        choiceSetId: p.choiceSetId,
      });
    }
  }

  playersNeedingSpellChoices() {
    return [...this.players.values()].filter((p) => p.alive && p.pendingLevelUps > 0);
  }

  ensureSpellChoicesForPending({ refreshDeadline = false } = {}) {
    for (const p of this.playersNeedingSpellChoices()) {
      if (!p.spellChoices) {
        this.assignSpellChoices(p);
      } else if (
        CONFIG.LEVELUP_CHOICE_TIMEOUT > 0 &&
        (refreshDeadline || p.choiceDeadlineAt == null)
      ) {
        p.choiceDeadlineAt = this.matchTime + CONFIG.LEVELUP_CHOICE_TIMEOUT;
      }
    }
  }

  beginPostRoundLevelUp(next) {
    this.ensureSpellChoicesForPending({ refreshDeadline: true });
    this.afterLevelUp = next;
    this.phase = 'levelup';
    this.autoResolveBotLevelUpsIfDisabled();
    this.maybeResumeFromLevelUp();
    this.broadcastState(true);
  }

  maybeResumeFromLevelUp() {
    if (this.phase !== 'levelup') return;
    const waiting = this.playersNeedingSpellChoices().length > 0;
    if (waiting) return;

    const next = this.afterLevelUp;
    this.afterLevelUp = null;
    if (next?.type === 'intermission') {
      this.beginRoundAfterIntermission();
      return;
    }
    if (next?.type === 'endMatch') {
      this.endMatch(next.winner || this.leadingPlayer(), {
        result: 'ended',
      });
      return;
    }
    this.phase = 'playing';
  }

  grantXp(player, amount, reason) {
    if (!player.alive && reason !== 'round') return;
    const xpBonus = (player.bonuses?.xpBonus || 0);
    const boosted = Math.max(1, Math.round(amount * (1 + xpBonus)));
    player.xp += boosted;
    let leveled = false;
    // xp é progresso no nível atual; xpToNext é o custo do próximo nível
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level += 1;
      player.xpToNext = xpForLevel(player.level + 1) - xpForLevel(player.level);
      if (player.xpToNext <= 0) player.xpToNext = 100 + player.level * 40;
      // Vida máxima e HP atual sobem a cada nível
      const hpGain = Math.max(0, CONFIG.PLAYER_HP_PER_LEVEL || 0);
      if (hpGain > 0) {
        player.maxHp += hpGain;
        player.hp = Math.min(player.maxHp, player.hp + hpGain);
      }
      player.pendingLevelUps += 1;
      leveled = true;
      this.pushEvent({
        type: 'level_up',
        playerId: player.id,
        level: player.level,
        x: +player.x.toFixed(1),
        y: +player.y.toFixed(1),
      });
    }
    if (leveled) {
      if (!player.spellChoices) {
        this.assignSpellChoices(player);
      }
      // Combate segue (PvE/PvP); bots resolvem sem travar a partida
      this.autoResolveBotLevelUpsIfDisabled();
    }
  }

  grantMonsterXp(monster, amount) {
    if (!monster?.alive || amount <= 0) return;
    monster.xp += amount;
    while (monster.xp >= monster.xpToNext) {
      monster.xp -= monster.xpToNext;
      monster.level += 1;
      monster.xpToNext = xpForLevel(monster.level + 1) - xpForLevel(monster.level);
      if (monster.xpToNext <= 0) monster.xpToNext = 100 + monster.level * 40;
      // Escala leve de poder a cada nível
      const hpGain = Math.max(4, Math.round(monster.maxHp * 0.1));
      monster.maxHp += hpGain;
      monster.hp = Math.min(monster.maxHp, monster.hp + hpGain);
      monster.damage = Math.max(1, Math.round(monster.damage * 1.08));
      this.pushEvent({
        type: 'monster_level_up',
        monsterId: monster.entityId,
        level: monster.level,
        x: +monster.x.toFixed(1),
        y: +monster.y.toFixed(1),
      });
    }
  }

  findMonster(entityId) {
    if (entityId == null) return null;
    return this.monsters.find((m) => m.entityId === entityId) || null;
  }

  spawnBlood(x, y) {
    this.effects.push({
      entityId: eid(),
      type: 'blood',
      x: +(x + (Math.random() - 0.5) * 12).toFixed(1),
      y: +(y + (Math.random() - 0.5) * 12).toFixed(1),
      life: 7,
      scale: +(0.75 + Math.random() * 0.7).toFixed(2),
      rotation: +(Math.random() * Math.PI * 2).toFixed(2),
      variant: Math.floor(Math.random() * 3),
    });
  }

  spawnBones(x, y) {
    const bone = {
      entityId: eid(),
      type: 'bones',
      x: +(x + (Math.random() - 0.5) * 6).toFixed(1),
      y: +(y + (Math.random() - 0.5) * 6).toFixed(1),
      life: 999,
      scale: +(0.85 + Math.random() * 0.35).toFixed(2),
      rotation: +((Math.random() - 0.5) * 0.6).toFixed(2),
      skullOffsetX: +((Math.random() - 0.5) * 6).toFixed(1),
      skullOffsetY: +((-6 + (Math.random() - 0.5) * 3).toFixed(1)),
    };
    this.effects.push(bone);
    return bone;
  }

  /** Remove ossos/sangue que ficaram na lava (fora do raio atual da arena). */
  cullDebrisOutsideArena() {
    const cx = CONFIG.ARENA_CENTER_X;
    const cy = CONFIG.ARENA_CENTER_Y;
    const r = this.arenaRadius;
    for (const e of this.effects) {
      if (e.type !== 'bones' && e.type !== 'blood') continue;
      if (Math.hypot(e.x - cx, e.y - cy) > r) e.life = 0;
    }
  }

  /** Posição do drop em cima do crânio do esqueleto. */
  dropPosOnBones(bones) {
    return {
      x: +(bones.x + (bones.skullOffsetX || 0)).toFixed(1),
      y: +(bones.y + (bones.skullOffsetY || -6) - 2).toFixed(1),
    };
  }

  /** Saco em cima do crânio do esqueleto com itens opcionais. */
  spawnLootBagOnBones(bones, items) {
    const { x, y } = this.dropPosOnBones(bones);
    this.lootBags.push({
      entityId: eid(),
      x,
      y,
      radius: CONFIG.LOOT_BAG_RADIUS,
      readyAt: this.matchTime + CONFIG.LOOT_BAG_PICKUP_DELAY,
      items: items || null,
    });
  }

  /** Moeda em cima do crânio do esqueleto. */
  spawnCoinOnBones(bones) {
    const { x, y } = this.dropPosOnBones(bones);
    this.coins.push({
      entityId: eid(),
      x,
      y,
      radius: CONFIG.COIN_RADIUS,
      value: CONFIG.COIN_VALUE,
      readyAt: this.matchTime + CONFIG.COIN_PICKUP_DELAY,
    });
  }

  /** Mob morto: saco de loot OU moeda (nunca os dois). */
  spawnMonsterDrop(bones, monsterType) {
    if (Math.random() < CONFIG.MONSTER_COIN_DROP_CHANCE) {
      this.spawnCoinOnBones(bones);
    } else {
      const items = rollOneMonsterDrop(monsterType);
      this.spawnLootBagOnBones(bones, items);
    }
  }

  /** Jogadores/bots vivos coletam sacos ao passar por cima (após o delay). */
  collectLootBags() {
    if (!this.lootBags.length) return;
    const pickupR = CONFIG.PLAYER_RADIUS + CONFIG.LOOT_BAG_RADIUS;
    const remaining = [];
    for (const bag of this.lootBags) {
      if (this.matchTime < (bag.readyAt || 0)) {
        remaining.push(bag);
        continue;
      }
      let taken = false;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (dist(p, bag) > pickupR) continue;
        p.loot = (p.loot || 0) + 1;
        if (bag.items) {
          if (!p.collectedItems) p.collectedItems = [];
          for (const { itemId, qty } of bag.items) {
            p.collectedItems.push({ itemId, qty });
          }
        }
        this.pushEvent({
          type: 'loot_pickup',
          playerId: p.id,
          loot: p.loot,
          x: bag.x,
          y: bag.y,
          items: bag.items || undefined,
          _at: this.matchTime,
        });
        taken = true;
        break;
      }
      if (!taken) remaining.push(bag);
    }
    this.lootBags = remaining;
  }

  /** Jogadores/bots vivos coletam moedas ao passar por cima (após o delay). */
  collectCoins() {
    if (!this.coins.length) return;
    const pickupR = CONFIG.PLAYER_RADIUS + CONFIG.COIN_RADIUS;
    const remaining = [];
    for (const coin of this.coins) {
      if (this.matchTime < (coin.readyAt || 0)) {
        remaining.push(coin);
        continue;
      }
      let taken = false;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (dist(p, coin) > pickupR) continue;
        const value = Math.max(1, Math.round(coin.value || CONFIG.COIN_VALUE));
        p.gold = (p.gold || 0) + value;
        this.pushEvent({
          type: 'coin_pickup',
          playerId: p.id,
          gold: p.gold,
          value,
          x: coin.x,
          y: coin.y,
        });
        taken = true;
        break;
      }
      if (!taken) remaining.push(coin);
    }
    this.coins = remaining;
  }

  /** @param {boolean} fromHit hit de jogador/monstro (não zona) */
  damageEntity(target, amount, sourcePlayerId = null, isPlayer = true, fromHit = false, opts = null) {
    if (!target.alive) return false;
    if (isPlayer && !this.playerCanHarmPlayers(sourcePlayerId)) return false;

    const options = opts && typeof opts === 'object' ? opts : null;
    let crit = false;
    let dmg = amount;

    // Dano bônus de equipamento do jogador
    if (sourcePlayerId) {
      const source = this.players.get(sourcePlayerId);
      const dmgBonus = source?.bonuses?.damageBonus || 0;
      if (dmgBonus > 0) dmg = Math.round(dmg * (1 + dmgBonus));
    }

    // Resistência elemental (só monstros) — D&D/Tibia/WoW %.
    if (!isPlayer && target.resistances) {
      const element =
        options?.element ||
        (options?.spellId ? spellElementId(options.spellId) : null);
      if (element) {
        dmg = applyElementResistance(dmg, target.resistances, element);
        if (dmg <= 0 && !(target.shield > 0)) return false;
      }
    }

    if (!options?.skipCrit && sourcePlayerId != null && dmg > 0) {
      const attacker =
        this.players.get(sourcePlayerId) || this.findMonster(sourcePlayerId);
      if (attacker) {
        const chance = Math.max(0, Math.min(1, attacker.critChance ?? 0));
        const mult = Math.max(1, attacker.critMult ?? 1);
        if (chance > 0 && Math.random() < chance) {
          crit = true;
          dmg = Math.max(1, Math.round(dmg * mult));
        }
      }
    }
    // Magias de boss %HP: nunca ultrapassar o teto da vida máxima.
    if (options?.maxHpPercent != null && target.maxHp > 0) {
      const cap = Math.max(
        1,
        Math.round(target.maxHp * clampBossHpPercent(options.maxHpPercent))
      );
      dmg = Math.min(dmg, cap);
    }

    let absorbed = 0;
    if ((target.shield || 0) > 0) {
      absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
      if (target.shield <= 0) {
        target.shield = 0;
        target.maxShield = 0;
        target.shieldTimer = 0;
      }
    }
    const source = sourcePlayerId ? this.players.get(sourcePlayerId) : null;
    const hpHit = dmg > 0 ? Math.min(dmg, target.hp) : 0;
    const applied = absorbed + hpHit;
    const element =
      options?.element ||
      (options?.spellId ? spellElementId(options.spellId) : null) ||
      'other';
    if (source && applied > 0) {
      source.damageDealt += applied;
      source.elementDamageDealt[element] = (source.elementDamageDealt[element] || 0) + applied;
    }
    if (isPlayer && applied > 0) {
      target.damageTaken = (target.damageTaken || 0) + applied;
      if (!target.elementDamageTaken) target.elementDamageTaken = Object.create(null);
      target.elementDamageTaken[element] = (target.elementDamageTaken[element] || 0) + applied;
    }
    if (dmg <= 0) return false;
    target.hp -= dmg;

    this.pushEvent({
      type: 'damage',
      amount: dmg,
      crit,
      x: +target.x.toFixed(1),
      y: +target.y.toFixed(1),
      targetId: isPlayer ? target.id : target.entityId,
      targetName: isPlayer ? target.name : target.type || 'Monstro',
      isPlayer,
      sourceId: sourcePlayerId,
      fromHit: !!fromHit,
    });

    if (fromHit || sourcePlayerId) {
      this.spawnBlood(target.x, target.y);
    }

    if (target.hp <= 0) {
      target.hp = 0;
      return this.killEntity(target, sourcePlayerId, isPlayer);
    }
    return false;
  }

  killEntity(target, sourcePlayerId, isPlayer) {
    if (!target.alive) return false;
    target.alive = false;
    target.hp = 0;

    if (isPlayer) {
      this.spawnBones(target.x, target.y);
      target.deaths += 1;
      const killer = sourcePlayerId ? this.players.get(sourcePlayerId) : null;
      const killerMonster = !killer ? this.findMonster(sourcePlayerId) : null;
      if (killer && killer.id !== target.id) {
        killer.kills += 1;
        killer.score += 1;
        this.grantXp(killer, CONFIG.XP_PLAYER_KILL, 'player_kill');
        this.pushEvent({ type: 'player_kill', killerId: killer.id, victimId: target.id });
      } else if (killerMonster) {
        this.grantMonsterXp(killerMonster, CONFIG.MONSTER_XP_PLAYER_KILL);
        this.pushEvent({
          type: 'player_death',
          playerId: target.id,
          killerMonsterId: killerMonster.entityId,
        });
      } else {
        this.pushEvent({ type: 'player_death', playerId: target.id });
      }
      this.checkRoundEnd();
      return true;
    }

    // Monster — ossos + saco de loot OU moeda; remove da lista
    const mx = target.x;
    const my = target.y;
    const wasBoss = !!target.isBoss;
    const mobMaxHp = target.maxHp || 0;
    const bones = this.spawnBones(mx, my);
    this.spawnMonsterDrop(bones, target.type);
    const killer = sourcePlayerId ? this.players.get(sourcePlayerId) : null;
    if (killer) {
      killer.monsterKills += 1;
      this.grantXp(killer, CONFIG.XP_MONSTER, 'monster');
      // Cura % da vida máxima do mob (MONSTER_KILL_HEAL_PERCENT); efeito só se > 0 e curar de fato
      const healPct = CONFIG.MONSTER_KILL_HEAL_PERCENT || 0;
      if (healPct > 0 && killer.alive && mobMaxHp > 0) {
        const amount = Math.max(1, Math.round(mobMaxHp * healPct));
        const before = killer.hp;
        killer.hp = Math.min(killer.maxHp, killer.hp + amount);
        const gained = killer.hp - before;
        if (gained > 0) {
          this.effects.push({
            type: 'heal',
            x: killer.x,
            y: killer.y,
            life: 0.75,
            maxLife: 0.75,
            color: 0x55ff88,
            radius: 42,
          });
          this.pushEvent({
            type: 'heal',
            playerId: killer.id,
            amount: gained,
            x: killer.x,
            y: killer.y,
          });
        }
      }
    }
    this.monsters = this.monsters.filter((m) => m.entityId !== target.entityId);
    const killType = target.type || 'monster';
    this.monsterKillCounts[killType] = (this.monsterKillCounts[killType] || 0) + 1;
    this.pushEvent({
      type: 'monster_kill',
      monsterId: target.entityId,
      killerId: sourcePlayerId,
      monsterType: killType,
      x: mx,
      y: my,
    });
    // Round de boss termina ao derrotar o boss
    if (this.bossRound && wasBoss && this.phase === 'playing') {
      const winner =
        killer?.alive
          ? killer
          : [...this.players.values()].find((p) => p.alive) || null;
      this.finishRound(winner);
    }
    return true;
  }

  checkRoundEnd() {
    if (this.afterLevelUp) return; // round já encerrado, aguardando distribuição de habilidades
    if (this.phase !== 'playing' && this.phase !== 'levelup') return;
    if (this.phase === 'ended') return;
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length > 0) return;
    // Wipe: todos mortos → partida encerra; jogadores mantêm loot/gold coletados.
    this.endMatch(this.leadingPlayer(), {
      result: 'ended',
      reason: this.bossRound ? 'boss_wipe' : 'wipe',
    });
  }

  finishRound(winner) {
    if (this.afterLevelUp || this.phase === 'intermission' || this.phase === 'ended') return;

    const wasBossRound = this.bossRound;
    this.bossRound = false;
    this.meteors = [];
    this.meteorTimer = 0;
    this.massHeals = [];
    this.massHealTimer = 0;
    this.cooldownMists = [];
    this.cooldownMistTimer = 0;
    this.gales = [];
    this.galeTimer = 0;
    this.levers = [];
    this.leverTimer = 0;
    this.winnerId = winner?.id || null;
    if (winner) {
      winner.score += 1;
      this.grantXp(winner, CONFIG.XP_ROUND_SURVIVE, 'round');
      this.pushEvent({ type: 'round_win', playerId: winner.id, round: this.round });
    }

    // Sobreviventes (se por algum motivo >1) também ganham XP de round — menor que kill de player
    for (const p of this.players.values()) {
      if (p.alive && p.id !== winner?.id) {
        this.grantXp(p, CONFIG.XP_ROUND_SURVIVE, 'round');
      }
    }

    // Escolhas pendentes não pausam o fim do round — ficam para o próximo / auto-timeout.

    if (wasBossRound) {
      this.clearedBossFights.add(this.round);
    }

    // Round normal com config de boss → boss fight em seguida (mesmo no último round).
    if (!wasBossRound && this.needsBossFightAfterRound(this.round)) {
      this.broadcastState(true);
      this.queueBossFight();
      return;
    }

    this.pendingBossFight = false;

    this.broadcastState(true);
    this.beginRoundAfterIntermission();
  }

  /** Jogador com maior placar (desempate: kills, menos deaths, depois nível). */
  leadingPlayer() {
    return (
      [...this.players.values()].sort(
        (a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths || b.level - a.level
      )[0] || null
    );
  }

  endMatch(winner, { result = 'ended', reason = null } = {}) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.bossRound = false;
    this.pendingBossFight = false;
    this.winnerId = winner?.id || null;
    this.matchResult = 'ended';
    this.endReason = reason || null;
    if (!this.startedAt) this.startedAt = new Date();
    this.pushEvent({
      type: 'match_end',
      winnerId: this.winnerId,
      result: this.matchResult,
      reason,
      round: this.round,
      monsterKillStats: this.serializeMonsterKillStats(),
      scores: [...this.players.values()]
        .map((p) => ({
          id: p.id,
          characterId: p.characterId || null,
          name: p.name,
          score: p.score,
          kills: p.kills,
          deaths: p.deaths,
          monsterKills: p.monsterKills || 0,
          loot: p.loot || 0,
          gold: p.gold || 0,
          collectedItems: p.collectedItems || [],
          damageDealt: Math.round(p.damageDealt || 0),
          damageTaken: Math.round(p.damageTaken || 0),
          elementDamage: this.serializePlayerElementDamage(p),
          level: p.level,
          isBot: !!p.isBot,
          wizardType: p.wizardType,
        }))
        .sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths || b.level - a.level),
    });
    this.broadcastState(true);
    void this.persistResult();
    setTimeout(() => this.destroy(), 60000);
  }

  async persistResult() {
    try {
      const { persistMatch } = await import('./db/matchStore.js');
      await persistMatch(this);
    } catch (err) {
      console.error('[db] falha ao gravar partida', this.id, err);
    }
  }

  logChat({ playerId, characterId, name, text }) {
    this.chatLog.push({
      playerId,
      characterId: characterId || null,
      name: String(name || 'Wizard').slice(0, 16),
      text: String(text || '').slice(0, 100),
      at: this.matchTime || 0,
    });
    if (this.chatLog.length > 500) this.chatLog.splice(0, this.chatLog.length - 500);
  }

  wipeAll() {
    for (const p of this.players.values()) {
      if (p.alive) {
        p.alive = false;
        p.hp = 0;
        p.deaths += 1;
        this.pushEvent({ type: 'player_death', playerId: p.id, reason: 'time' });
      }
    }
    this.endMatch(null, { result: 'ended', reason: 'wipe' });
  }

  monsterTypeDefs() {
    return createMonsterTypeDefs(CONFIG);
  }

  serializeMonsterKillStats() {
    const defs = this.monsterTypeDefs();
    const byType = Object.entries(this.monsterKillCounts || {})
      .map(([type, count]) => {
        const def = defs[type];
        const tier = def?.isBoss ? 'boss' : def?.isElite ? 'elite' : null;
        return { type, count: count || 0, tier };
      })
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
    const total = byType.reduce((sum, e) => sum + e.count, 0);
    return { total, byType };
  }

  serializeElementBreakdown(byElementMap, totalFallback = 0) {
    const byElement = Object.entries(byElementMap || {})
      .map(([element, damage]) => ({
        element,
        damage: Math.round(damage || 0),
      }))
      .filter((e) => e.damage > 0)
      .sort((a, b) => b.damage - a.damage || a.element.localeCompare(b.element));
    const total = byElement.reduce((sum, e) => sum + e.damage, 0) || Math.round(totalFallback || 0);
    return {
      total,
      byElement: byElement.map((e) => ({
        ...e,
        pct: total > 0 ? Math.round((e.damage / total) * 100) : 0,
      })),
    };
  }

  serializePlayerElementDamage(player) {
    return {
      dealt: this.serializeElementBreakdown(player?.elementDamageDealt, player?.damageDealt),
      taken: this.serializeElementBreakdown(player?.elementDamageTaken, player?.damageTaken),
    };
  }

  /** Sorteia tipo com pesos + diversidade (evita repetir tipos já vivos / último spawn). */
  pickMonsterType(types, { bossesOnly = false } = {}) {
    const diversity = Math.max(0, CONFIG.MONSTER_SPAWN_DIVERSITY);
    const aliveCount = {};
    for (const m of this.monsters) {
      if (!m.alive) continue;
      aliveCount[m.type] = (aliveCount[m.type] || 0) + 1;
    }

    const floor = this.floorType || 'dirt';
    const fitsFloor = (id) => {
      const floors = types[id]?.floors;
      // Sem habitat definido → pode aparecer em qualquer terreno.
      if (!Array.isArray(floors) || !floors.length) return true;
      return floors.includes(floor);
    };

    // Spawn contínuo nunca inclui bosses — eles só aparecem em BOSS_APPEARS.
    let ids = Object.keys(types).filter((id) => {
      const isBoss = !!types[id].isBoss;
      if (bossesOnly ? !isBoss : isBoss) return false;
      return fitsFloor(id);
    });
    // Fallback: se o terreno tiver pool vazio, usa todos do tier.
    if (!ids.length) {
      ids = Object.keys(types).filter((id) => {
        const isBoss = !!types[id].isBoss;
        return bossesOnly ? isBoss : !isBoss;
      });
    }
    if (!ids.length) return null;

    let totalWeight = 0;
    const weights = new Map();
    for (const id of ids) {
      let w = Math.max(0, types[id].weight ?? CONFIG.MONSTER_WEIGHT_COMMON);
      const n = aliveCount[id] || 0;
      if (diversity > 0 && n > 0) {
        w *= (1 / (1 + n)) ** diversity;
      }
      if (diversity > 0 && id === this.lastSpawnedMonsterType) {
        w *= Math.max(0.05, 1 - 0.85 * Math.min(1, diversity));
      }
      w = Math.max(0.01, w);
      weights.set(id, w);
      totalWeight += w;
    }

    let roll = Math.random() * totalWeight;
    let type = ids[0];
    for (const id of ids) {
      roll -= weights.get(id);
      if (roll <= 0) {
        type = id;
        break;
      }
    }
    this.lastSpawnedMonsterType = type;
    return type;
  }

  /** Maior nível entre jogadores/bots da partida. */
  matchMaxPlayerLevel() {
    let max = 1;
    for (const p of this.players.values()) {
      if ((p.level || 1) > max) max = p.level;
    }
    return max;
  }

  /** Multiplicadores de HP/dano dos mobs conforme o round atual. */
  roundDifficultyMul() {
    const r = Math.max(1, this.round);
    const hpStep = CONFIG.ROUND_MOB_HP_STEP || 0.08;
    const dmgStep = CONFIG.ROUND_MOB_DMG_STEP || 0.06;
    return {
      hpMul: 1 + (r - 1) * hpStep,
      dmgMul: 1 + (r - 1) * dmgStep,
    };
  }

  /** Quantidade de mobs spawnados por tick (aumenta a cada round). */
  getRoundSpawnCount() {
    const base = CONFIG.MONSTER_SPAWN_COUNT;
    const step = CONFIG.ROUND_SPAWN_COUNT_STEP || 0.12;
    const r = Math.max(1, this.round);
    return Math.min(CONFIG.MONSTER_MAX, Math.max(1, Math.ceil(base * (1 + (r - 1) * step))));
  }

  /** Intervalo entre spawns (diminui a cada round). */
  getRoundSpawnInterval() {
    const base = CONFIG.MONSTER_SPAWN_INTERVAL;
    const step = CONFIG.ROUND_SPAWN_INTERVAL_STEP || 0.05;
    const r = Math.max(1, this.round);
    return Math.max(0.4, base * Math.pow(Math.max(0, 1 - step), r - 1));
  }

  /**
   * Nível de spawn: lv máximo da partida + bônus por round ±2 (mín. 1).
   */
  rollMonsterSpawnLevel() {
    const maxLv = this.matchMaxPlayerLevel();
    const roundBonus = Math.floor((Math.max(1, this.round) - 1) * 0.5);
    const delta = Math.floor(Math.random() * 5) - 2; // -2..+2
    return Math.max(1, maxLv + roundBonus + delta);
  }

  /** Aplica a mesma escala de level-up usada em grantMonsterXp (do lv 1 até target). */
  scaleMonsterToLevel(monster, targetLevel) {
    const target = Math.max(1, targetLevel | 0);
    while (monster.level < target) {
      monster.level += 1;
      monster.xpToNext = xpForLevel(monster.level + 1) - xpForLevel(monster.level);
      if (monster.xpToNext <= 0) monster.xpToNext = 100 + monster.level * 40;
      const hpGain = Math.max(4, Math.round(monster.maxHp * 0.1));
      monster.maxHp += hpGain;
      monster.hp = monster.maxHp;
      monster.damage = Math.max(1, Math.round(monster.damage * 1.08));
    }
    monster.xp = 0;
  }

  createMonsterEntity(type, def) {
    let x = CONFIG.ARENA_CENTER_X;
    let y = CONFIG.ARENA_CENTER_Y;
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = this.arenaRadius * (0.35 + Math.random() * 0.5);
      x = CONFIG.ARENA_CENTER_X + Math.cos(angle) * r;
      y = CONFIG.ARENA_CENTER_Y + Math.sin(angle) * r;
      if (!this.isBlockedByRock(x, y, def.radius)) break;
    }

    const isBoss = !!def.isBoss;
    const isElite = !!def.isElite && !isBoss;
    const bossHpMul = isBoss ? CONFIG.DIFFICULTY_BOSS_HP_MUL || 1 : 1;
    const bossDmgMul = isBoss ? CONFIG.DIFFICULTY_BOSS_DMG_MUL || 1 : 1;
    const roundScale = this.roundDifficultyMul();
    const hp = Math.round(CONFIG.MONSTER_HP * def.hpMul * bossHpMul * roundScale.hpMul);
    const damage = Math.round(CONFIG.MONSTER_DAMAGE * def.dmgMul * bossDmgMul * roundScale.dmgMul);
    const attack = def.attack || 'melee';
    const castRate =
      attack === 'caster'
        ? isBoss
          ? CONFIG.MONSTER_CAST_RATE_BOSS || 4.25
          : isElite
            ? CONFIG.MONSTER_CAST_RATE_ELITE || 2.55
            : CONFIG.MONSTER_CAST_RATE_NORMAL || 0.34
        : 1;
    const baseAtkCd = def.attackCooldown || CONFIG.MONSTER_ATTACK_COOLDOWN;
    const baseNovaCd = def.novaCooldown || 4;
    // Magias de área / cone / radial — só elite e boss.
    const AREA_SPELLS = new Set([
      'flame_nova',
      'poison_cloud',
      'electric_storm',
      'firebreath',
      'frost_breath',
      'gale_breath',
      'skull_wave',
      'bone_volley',
      'magma_surge',
      'thorn_nova',
      'ash_nova',
      'mire_nova',
      'void_collapse',
      'abyss_nova',
      'frost_apocalypse',
      'plague_burst',
      'shadow_eclipse',
      'entropy_pulse',
      'tidal_crush',
      'blood_nova',
      'quake_pulse',
      'cataclysm_beam',
    ]);
    let spells = Array.isArray(def.spells) ? [...def.spells] : null;
    if (spells && !isElite && !isBoss) {
      spells = spells.filter((id) => !AREA_SPELLS.has(id));
      if (!spells.length) spells = ['firebolt'];
    }

    return {
      entityId: eid(),
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      alive: true,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(2) - xpForLevel(1),
      speed: CONFIG.MONSTER_SPEED * def.speedMul,
      damage,
      critChance: CONFIG.MONSTER_CRIT_CHANCE,
      critMult: CONFIG.MONSTER_CRIT_MULT,
      attackCd: 0,
      attack,
      spells,
      projectile: def.projectile || null,
      range: def.range || CONFIG.MONSTER_ATTACK_RANGE,
      preferRange: def.preferRange || 0,
      projectileSpeed: def.projectileSpeed || 0,
      projectileRadius: def.projectileRadius || 6,
      projectileColor: def.projectileColor || def.color,
      castRate,
      attackCooldown: Math.max(0.12, baseAtkCd / castRate),
      novaRadius: def.novaRadius || 110,
      // Novas aceleram menos que fillers (teto ~2.5×) para não spammar AoE.
      novaCooldown: Math.max(0.8, baseNovaCd / Math.min(castRate, 2.5)),
      novaCd: 0,
      skullCount: def.skullCount || 0,
      fireTrail: !!def.fireTrail,
      fireTrailInterval: def.fireTrailInterval || 0.32,
      fireTrailRadius: def.fireTrailRadius || 34,
      fireTrailLife: def.fireTrailLife || 2.6,
      fireTrailBurnDamage: def.fireTrailBurnDamage ?? 2,
      fireTrailBurnTick: def.fireTrailBurnTick || 1,
      fireTrailBurnDuration: def.fireTrailBurnDuration || 3,
      trailAcc: 0,
      radius: def.radius,
      color: def.color,
      resistances: def.resistances ? { ...def.resistances } : {},
      isBoss,
      isElite,
      difficulty: def.difficulty || (isBoss ? 'boss' : isElite ? 'hard' : 'normal'),
      /** Acumulador para tentativa de auto-cura (só bosses). */
      healAcc: 0,
      /** Inatas de boss: blink (em cima do alvo) e escudo. */
      blinkCooldown: 0,
      barrierCooldown: 0,
      shield: 0,
      maxShield: 0,
      shieldTimer: 0,
      knockbackTimer: 0,
      knockbackDx: 0,
      knockbackDy: 0,
      poisonTimer: 0,
      poisonDamage: 0,
      poisonTick: 1,
      poisonTickAcc: 0,
      poisonOwnerId: null,
      burnTimer: 0,
      burnDamage: 0,
      burnTick: 1,
      burnTickAcc: 0,
      burnOwnerId: null,
      /** Pose visual sincronizada com o client (`attack` | null). */
      pose: null,
      poseTimer: 0,
    };
  }

  /** Dispara pose de ataque/cast no snapshot do monstro. */
  flashMonsterPose(monster, pose = 'attack', duration = 0.34) {
    if (!monster) return;
    monster.pose = pose;
    monster.poseTimer = duration;
  }

  /** Escudo inato de boss (mesma Barrier dos jogadores). */
  tryBossBarrier(monster) {
    if (!monster?.alive || !monster.isBoss) return false;
    if (
      (monster.stunTimer || 0) > 0 ||
      (monster.barrierCooldown || 0) > 0 ||
      (monster.shield || 0) > 0
    ) {
      return false;
    }
    const stats = spellStats('barrier', 1);
    if (!stats) return false;

    monster.shield = stats.shield;
    monster.maxShield = stats.shield;
    monster.shieldTimer = stats.duration;
    monster.barrierCooldown = stats.cooldown;
    this.effects.push({
      type: 'barrier',
      x: monster.x,
      y: monster.y,
      life: 0.7,
      maxLife: 0.7,
      color: stats.color,
      radius: Math.max(40, (monster.radius || 14) + 18),
    });
    return true;
  }

  /** Blink inato de boss — teleporta em direção / em cima do jogador ou bot. */
  tryBossBlink(monster, target) {
    if (!monster?.alive || !monster.isBoss || !target?.alive) return false;
    if ((monster.stunTimer || 0) > 0 || (monster.blinkCooldown || 0) > 0) return false;
    const stats = spellStats('blink', 1);
    if (!stats) return false;

    const fromX = monster.x;
    const fromY = monster.y;
    const aimDx = target.x - monster.x;
    const aimDy = target.y - monster.y;
    const aimLen = Math.hypot(aimDx, aimDy);
    // Já está em cima do alvo — não gasta o blink.
    if (aimLen < 48) return false;
    const dirX = aimDx / (aimLen || 1);
    const dirY = aimDy / (aimLen || 1);
    // Distância até o alvo (teto = range): pousa em cima quando está no alcance.
    const distBlink = Math.min(stats.range, aimLen);

    monster.x = monster.x + dirX * distBlink;
    monster.y = monster.y + dirY * distBlink;
    monster.vx = 0;
    monster.vy = 0;
    this.clampMonsterToArena(monster);
    monster.blinkCooldown = stats.cooldown;
    this.effects.push({
      type: 'blink',
      phase: 'out',
      x: fromX,
      y: fromY,
      x2: monster.x,
      y2: monster.y,
      life: 0.5,
      maxLife: 0.5,
      color: stats.color,
      radius: Math.max(36, (monster.radius || 14) + 12),
    });
    this.effects.push({
      type: 'blink',
      phase: 'in',
      x: monster.x,
      y: monster.y,
      x2: fromX,
      y2: fromY,
      life: 0.55,
      maxLife: 0.55,
      color: stats.color,
      radius: Math.max(36, (monster.radius || 14) + 12),
    });
    return true;
  }

  /**
   * Auto-cura de boss: a cada BOSS_HEAL_INTERVAL, chance BOSS_HEAL_CHANCE
   * de restaurar até BOSS_HEAL_MAX_PERCENT da vida máxima (sem ultrapassar maxHp).
   */
  tryBossHeal(monster, dt) {
    if (!monster?.alive || !monster.isBoss) return;
    if (monster.hp >= monster.maxHp) {
      monster.healAcc = 0;
      return;
    }
    const interval = Math.max(0.5, CONFIG.BOSS_HEAL_INTERVAL || 5);
    monster.healAcc = (monster.healAcc || 0) + dt;
    if (monster.healAcc < interval) return;
    monster.healAcc = 0;

    const chance = Math.max(0, Math.min(1, CONFIG.BOSS_HEAL_CHANCE ?? 0.1));
    if (Math.random() >= chance) return;

    const pct = Math.max(0, Math.min(1, CONFIG.BOSS_HEAL_MAX_PERCENT ?? 0.6));
    if (pct <= 0) return;
    const missing = Math.max(0, monster.maxHp - monster.hp);
    const heal = Math.min(missing, Math.max(1, Math.round(monster.maxHp * pct)));
    if (heal <= 0) return;

    monster.hp = Math.min(monster.maxHp, monster.hp + heal);
    this.effects.push({
      type: 'heal',
      x: monster.x,
      y: monster.y,
      life: 0.85,
      maxLife: 0.85,
      color: 0x55ff88,
      radius: Math.max(42, (monster.radius || 20) * 1.6),
    });
    this.pushEvent({
      type: 'boss_heal',
      amount: heal,
      x: +monster.x.toFixed(1),
      y: +monster.y.toFixed(1),
      targetId: monster.entityId,
      targetName: monster.type || 'Boss',
    });
  }

  /** Dano de magia de boss: % da vida máxima do alvo (máx. 85%), sem crítico além do teto. */
  bossPercentDamage(target, stats) {
    const pct = clampBossHpPercent(stats?.damagePercentMaxHp);
    if (pct <= 0 || !target?.maxHp) return 0;
    return Math.max(1, Math.round(target.maxHp * pct));
  }

  /** Aplica slow em jogador (usado por magias de boss). */
  applyMonsterSlow(target, slow, duration) {
    if (!target?.alive || !this.isPlayerEntity(target)) return;
    const amount = Math.max(0, Math.min(0.85, Number(slow) || 0));
    const dur = Math.max(0.1, Number(duration) || 2);
    if (amount <= 0) return;
    const slowResist = target.bonuses?.slowResist || 0;
    const resisted = amount * (1 - slowResist);
    if (resisted <= 0) return;
    target.slow = Math.max(target.slow || 0, resisted);
    target.slowTimer = Math.max(target.slowTimer || 0, dur);
  }

  spawnMonster() {
    if (this.bossRound) return;
    if (this.monsters.length >= CONFIG.MONSTER_MAX) return;
    const types = this.monsterTypeDefs();
    const type = this.pickMonsterType(types);
    if (!type) return;
    const def = types[type];
    const monster = this.createMonsterEntity(type, def);
    this.scaleMonsterToLevel(monster, this.rollMonsterSpawnLevel());
    this.monsters.push(monster);
  }

  /** Spawna um boss aleatório (boss fight após rounds de BOSS_APPEARS). */
  spawnBoss() {
    const types = this.monsterTypeDefs();
    let type = this.pickMonsterType(types, { bossesOnly: true });
    if (!type) {
      // Último recurso: qualquer boss do catálogo, ignorando habitat.
      const anyBoss = Object.keys(types).find((id) => types[id]?.isBoss);
      type = anyBoss || null;
    }
    if (!type) return null;
    const def = types[type];
    const monster = this.createMonsterEntity(type, def);
    // Boss um pouco acima do nível da partida
    this.scaleMonsterToLevel(monster, this.matchMaxPlayerLevel() + 2);
    this.monsters.push(monster);
    return monster;
  }

  isPlayerEntity(target) {
    return !!(target?.id && this.players.has(target.id));
  }

  /** Aplica/renova veneno (duração sempre no máximo). */
  applyPoison(target, ownerId, damage, tick, duration) {
    if (!target?.alive) return;
    if (this.isPlayerEntity(target) && !this.playerCanHarmPlayers(ownerId)) return;
    const poisonResist = (target.bonuses?.poisonResist || 0);
    const wasPoisoned = (target.poisonTimer || 0) > 0;
    const dmg = Math.max(0, Math.round((Number(damage) || 0) * (1 - poisonResist)));
    if (dmg <= 0 && !wasPoisoned) return;
    target.poisonTimer = Math.max(0.05, Number(duration) || 5);
    target.poisonDamage = dmg;
    target.poisonTick = Math.max(0.05, Number(tick) || 1);
    target.poisonOwnerId = ownerId;
    // Renovar não pausa o DoT; na 1ª aplicação causa tick imediato
    if (!wasPoisoned) {
      target.poisonTickAcc = 0;
      if (dmg > 0) {
        this.damageEntity(target, dmg, ownerId, this.isPlayerEntity(target), true, {
          element: 'poison',
        });
      }
    }
  }

  /** Processa DoT de veneno em jogador ou monstro. */
  tickPoison(target, dt, isPlayer) {
    if (!target?.alive || !(target.poisonTimer > 0)) return;
    if (!Number.isFinite(target.poisonTickAcc)) target.poisonTickAcc = 0;
    const tick = Math.max(0.05, Number(target.poisonTick) || 1);
    const dmg = Math.max(0, Math.round(Number(target.poisonDamage) || 0));
    target.poisonTickAcc += dt;
    while (target.poisonTickAcc >= tick && target.alive && target.poisonTimer > 0) {
      target.poisonTickAcc -= tick;
      if (dmg > 0) {
        this.damageEntity(target, dmg, target.poisonOwnerId, isPlayer, true, {
          element: 'poison',
        });
      }
    }
    target.poisonTimer = Math.max(0, target.poisonTimer - dt);
    if (target.poisonTimer <= 0 || !target.alive) {
      target.poisonTimer = 0;
      target.poisonDamage = 0;
      target.poisonTickAcc = 0;
      target.poisonOwnerId = null;
    }
  }

  /** Aplica/renova queimadura (duração sempre no máximo). */
  applyBurn(target, ownerId, damage, tick, duration) {
    if (!target?.alive) return;
    if (this.isPlayerEntity(target) && !this.playerCanHarmPlayers(ownerId)) return;
    const burnResist = (target.bonuses?.burnResist || 0);
    const wasBurning = (target.burnTimer || 0) > 0;
    const dmg = Math.max(0, Math.round((Number(damage) || 0) * (1 - burnResist)));
    if (dmg <= 0 && !wasBurning) return;
    target.burnTimer = Math.max(0.05, Number(duration) || 10);
    target.burnDamage = dmg;
    target.burnTick = Math.max(0.05, Number(tick) || 1);
    target.burnOwnerId = ownerId;
    // Renovar não pausa o DoT; na 1ª aplicação causa tick imediato
    if (!wasBurning) {
      target.burnTickAcc = 0;
      if (dmg > 0) {
        this.damageEntity(target, dmg, ownerId, this.isPlayerEntity(target), true, {
          element: 'fire',
        });
      }
    }
  }

  /** Processa DoT de queimadura em jogador ou monstro. */
  tickBurn(target, dt, isPlayer) {
    if (!target?.alive || !(target.burnTimer > 0)) return;
    if (!Number.isFinite(target.burnTickAcc)) target.burnTickAcc = 0;
    const tick = Math.max(0.05, Number(target.burnTick) || 1);
    const dmg = Math.max(0, Math.round(Number(target.burnDamage) || 0));
    target.burnTickAcc += dt;
    while (target.burnTickAcc >= tick && target.alive && target.burnTimer > 0) {
      target.burnTickAcc -= tick;
      if (dmg > 0) {
        this.damageEntity(target, dmg, target.burnOwnerId, isPlayer, true, {
          element: 'fire',
        });
      }
    }
    target.burnTimer = Math.max(0, target.burnTimer - dt);
    if (target.burnTimer <= 0 || !target.alive) {
      target.burnTimer = 0;
      target.burnDamage = 0;
      target.burnTickAcc = 0;
      target.burnOwnerId = null;
    }
  }

  /** Aplica DoTs de todas as entidades (depois dos AoEs). */
  tickAllDots(dt) {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      this.tickPoison(p, dt, true);
      this.tickBurn(p, dt, true);
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      this.tickPoison(m, dt, false);
      this.tickBurn(m, dt, false);
    }
  }

  /**
   * Flame Nova: dano inicial + queimadura + fogo no chão.
   * @param {object} origin posição {x,y}
   * @param {string|number} ownerId
   * @param {object} stats stats da magia
   * @param {number} [burstDamage] dano inicial (default stats.damage)
   * @param {boolean} [hitMonsters=true]
   */
  applyFlameNova(origin, ownerId, stats, burstDamage = null, hitMonsters = true) {
    const radius = stats.radius || 110;
    const burst = burstDamage != null ? burstDamage : stats.damage || 0;
    const burnDmg = stats.burnDamage ?? 1;
    const burnTick = stats.burnTick ?? 1;
    const burnDuration = stats.burnDuration ?? 10;
    const groundLife = Math.max(0.5, Number(stats.duration) || 4);
    const burnDmgSafe = Math.max(1, Math.round(Number(burnDmg) || 1));
    const burnTickSafe = Math.max(0.05, Number(burnTick) || 1);
    const burnDurationSafe = Math.max(0.5, Number(burnDuration) || 10);

    if (this.playerCanHarmPlayers(ownerId)) {
      for (const p of this.players.values()) {
        if (!p.alive || p.id === ownerId || p.entityId === ownerId) continue;
        if (dist(origin, p) <= radius + CONFIG.PLAYER_RADIUS) {
          this.damageEntity(p, burst, ownerId, true, true);
          this.applyBurn(p, ownerId, burnDmgSafe, burnTickSafe, burnDurationSafe);
        }
      }
    }
    if (hitMonsters) {
      for (const m of this.monsters) {
        if (!m.alive) continue;
        if (dist(origin, m) <= radius + (m.radius || CONFIG.MONSTER_RADIUS)) {
          this.damageEntity(m, burst, ownerId, false, true, { spellId: 'flame_nova' });
          this.applyBurn(m, ownerId, burnDmgSafe, burnTickSafe, burnDurationSafe);
        }
      }
    }

    this.aoes.push({
      entityId: eid(),
      ownerId,
      x: origin.x,
      y: origin.y,
      radius,
      /** Segundos para o fogo crescer do centro até o raio máximo. */
      expandTime: 0.4,
      damage: burnDmgSafe,
      tick: burnTickSafe,
      burnDuration: burnDurationSafe,
      life: groundLife,
      maxLife: groundLife,
      color: stats.color || 0xff8844,
      spellId: 'flame_nova',
    });
    this.effects.push({
      type: 'nova',
      spellId: 'flame_nova',
      x: origin.x,
      y: origin.y,
      radius,
      life: 0.7,
      maxLife: 0.7,
      color: stats.color || 0xff8844,
    });
  }

  /**
   * Raio efetivo do AoE (flame_nova cresce do centro até o raio máximo).
   * @param {{ radius?: number, life?: number, maxLife?: number, expandTime?: number }} aoe
   */
  aoeEffectiveRadius(aoe) {
    const full = Number(aoe.radius) || 0;
    const expandTime = Number(aoe.expandTime) || 0;
    if (expandTime <= 0 || full <= 0) return full;
    const maxLife = Number(aoe.maxLife) || Number(aoe.life) || 0;
    const life = Number(aoe.life) || 0;
    const age = Math.max(0, maxLife - life);
    const t = Math.min(1, age / expandTime);
    // smoothstep
    const ease = t * t * (3 - 2 * t);
    return full * ease;
  }

  /** Empurra um raio do céu até o chão (efeito + impacto). */
  pushSkyLightning(x, y, color, opts = {}) {
    const jitter = opts.jitter ?? 10;
    const ox = (Math.random() - 0.5) * 2 * jitter;
    const skyY = y - (opts.skyHeight ?? 300 + Math.random() * 80);
    this.effects.push({
      type: 'sky_lightning',
      spellId: opts.spellId || 'electric_bolt',
      x1: x + ox * 0.35,
      y1: skyY,
      x2: x + ox,
      y2: y,
      x,
      y,
      life: opts.life ?? 0.48,
      maxLife: opts.life ?? 0.48,
      color: color || 0x7cf0ff,
      seed: (Math.random() * 1e9) | 0,
      branches: opts.branches ?? 4,
      flash: opts.flash !== false,
    });
  }

  /** Raio efetivo de uma magia de área (spell.radius vs novaRadius do mob). */
  areaSpellReach(monster, spellId, fallback = 110) {
    const st = spellStats(spellId, 1);
    return Math.max(monster?.novaRadius || 0, st?.radius || 0, fallback);
  }

  /**
   * Escolhe a próxima magia do caster conforme distância/CDs.
   * Retorna spellId ou null.
   */
  pickCasterSpell(monster, nearestD) {
    if (!monster?.alive || monster.attack !== 'caster') return null;
    const spells = monster.spells || [];
    if (!spells.length) return null;
    const shootRange = monster.range || 180;
    const novaR = monster.novaRadius || 110;
    const lightningR = spellStats('arc_lightning')?.range || 160;
    const canArea = !!(monster.isElite || monster.isBoss);
    const bossNovaSpells = [
      'shadow_eclipse',
      'abyss_nova',
      'void_collapse',
      'frost_apocalypse',
      'plague_burst',
      'entropy_pulse',
      'tidal_crush',
      'blood_nova',
      'quake_pulse',
    ];
    const bossSingleSpells = [
      'death_knell',
      'infernal_judgment',
      'soul_rend',
      'blood_pact',
      'soul_lance',
      'solar_judgment',
      'rift_lance',
      'obsidian_lance',
      'aurora_judgment',
    ];

    const bossNovaReady =
      monster.isBoss &&
      (monster.novaCd || 0) <= 0 &&
      bossNovaSpells.find(
        (id) => spells.includes(id) && nearestD <= this.areaSpellReach(monster, id, novaR)
      );
    // Singles de boss usam só attackCd — NÃO exigem novaCd.
    const bossSingleReady =
      monster.isBoss &&
      bossSingleSpells.find((id) => {
        const r = spellStats(id)?.range || shootRange;
        return spells.includes(id) && nearestD <= r;
      });
    const beamReady =
      monster.isBoss &&
      canArea &&
      spells.includes('cataclysm_beam') &&
      (monster.novaCd || 0) <= 0 &&
      nearestD <= (spellStats('cataclysm_beam')?.range || 200);

    if (bossNovaReady) return bossNovaReady;
    if (beamReady) return 'cataclysm_beam';
    if (bossSingleReady) return bossSingleReady;
    if (
      canArea &&
      spells.includes('electric_storm') &&
      nearestD <= this.areaSpellReach(monster, 'electric_storm', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'electric_storm';
    }
    if (
      canArea &&
      spells.includes('flame_nova') &&
      nearestD <= this.areaSpellReach(monster, 'flame_nova', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'flame_nova';
    }
    if (
      canArea &&
      spells.includes('magma_surge') &&
      nearestD <= this.areaSpellReach(monster, 'magma_surge', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'magma_surge';
    }
    if (
      canArea &&
      spells.includes('thorn_nova') &&
      nearestD <= this.areaSpellReach(monster, 'thorn_nova', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'thorn_nova';
    }
    if (
      canArea &&
      spells.includes('ash_nova') &&
      nearestD <= this.areaSpellReach(monster, 'ash_nova', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'ash_nova';
    }
    if (
      canArea &&
      spells.includes('mire_nova') &&
      nearestD <= this.areaSpellReach(monster, 'mire_nova', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'mire_nova';
    }
    if (
      canArea &&
      spells.includes('poison_cloud') &&
      nearestD <= this.areaSpellReach(monster, 'poison_cloud', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'poison_cloud';
    }
    if (canArea && spells.includes('frost_breath') && nearestD <= (spellStats('frost_breath')?.range || 165)) {
      return 'frost_breath';
    }
    if (canArea && spells.includes('gale_breath') && nearestD <= (spellStats('gale_breath')?.range || 170)) {
      return 'gale_breath';
    }
    if (canArea && spells.includes('firebreath') && nearestD <= (spellStats('firebreath')?.range || 170)) {
      return 'firebreath';
    }
    if (spells.includes('hex_bolt') && nearestD <= (spellStats('hex_bolt')?.range || 245)) return 'hex_bolt';
    if (spells.includes('spark_bolt') && nearestD <= (spellStats('spark_bolt')?.range || 235)) {
      return 'spark_bolt';
    }
    if (spells.includes('electric_bolt') && nearestD <= (spellStats('electric_bolt')?.range || 240)) {
      return 'electric_bolt';
    }
    if (spells.includes('arc_lightning') && nearestD <= lightningR) return 'arc_lightning';
    if (canArea && spells.includes('bone_volley') && nearestD <= shootRange) return 'bone_volley';
    if (canArea && spells.includes('skull_wave') && nearestD <= shootRange) return 'skull_wave';
    if (spells.includes('acid_bolt') && nearestD <= shootRange) return 'acid_bolt';
    if (spells.includes('sap_bolt') && nearestD <= shootRange) return 'sap_bolt';
    if (spells.includes('crystal_bolt') && nearestD <= shootRange) return 'crystal_bolt';
    if (spells.includes('brine_bolt') && nearestD <= shootRange) return 'brine_bolt';
    if (spells.includes('dusk_bolt') && nearestD <= shootRange) return 'dusk_bolt';
    if (spells.includes('ice_shard') && nearestD <= shootRange) return 'ice_shard';
    if (spells.includes('ember_bolt') && nearestD <= shootRange) return 'ember_bolt';
    if (spells.includes('firebolt') && nearestD <= shootRange) return 'firebolt';
    return null;
  }

  /** Magias usadas por monstros caster (beholder / dragão / lich / demon). */
  monsterCast(monster, spellId, target) {
    const stats = spellStats(spellId, 1);
    if (!stats) return false;
    const AREA_SPELLS = new Set([
      'flame_nova',
      'poison_cloud',
      'electric_storm',
      'firebreath',
      'frost_breath',
      'skull_wave',
      'bone_volley',
      'magma_surge',
      'thorn_nova',
      'void_collapse',
      'abyss_nova',
      'frost_apocalypse',
      'plague_burst',
      'shadow_eclipse',
      'entropy_pulse',
      'tidal_crush',
      'cataclysm_beam',
    ]);
    if (AREA_SPELLS.has(spellId) && !monster.isElite && !monster.isBoss) return false;

    switch (spellId) {
      case 'arc_lightning': {
        const range = stats.range || 160;
        if (!target || dist(monster, target) > range) return false;
        this.damageEntity(target, monster.damage, monster.entityId, true, true);
        this.effects.push({
          type: 'lightning',
          x1: monster.x,
          y1: monster.y,
          x2: target.x,
          y2: target.y,
          life: 0.38,
          maxLife: 0.38,
          color: stats.color,
          seed: (Math.random() * 1e9) | 0,
          branches: 3,
        });
        this.spawnSpellImpact(target.x, target.y, 'arc_lightning', stats.color, 26);
        monster.attackCd = monster.attackCooldown || 1.4;
        break;
      }
      case 'electric_bolt':
      case 'hex_bolt':
      case 'spark_bolt': {
        const range = stats.range || 240;
        if (!target || dist(monster, target) > range) return false;
        const dmg = Math.round(monster.damage * (spellId === 'hex_bolt' ? 1.2 : 1.1));
        this.damageEntity(target, dmg, monster.entityId, true, true);
        this.pushSkyLightning(target.x, target.y, stats.color, {
          spellId,
          branches: spellId === 'hex_bolt' ? 6 : 5,
          skyHeight: 320 + Math.random() * 60,
        });
        this.spawnSpellImpact(target.x, target.y, spellId, stats.color, 30);
        monster.attackCd = monster.attackCooldown || stats.cooldown || 1.35;
        break;
      }
      case 'electric_storm': {
        const radius = Math.max(monster.novaRadius || 0, stats.radius || 0, 130);
        const cx = target ? target.x : monster.x;
        const cy = target ? target.y : monster.y;
        const dmg = Math.round(monster.damage * 0.95);
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (dist(p, { x: cx, y: cy }) <= radius) {
            this.damageEntity(p, dmg, monster.entityId, true, true);
          }
        }
        this.effects.push({
          type: 'electric_storm',
          spellId: 'electric_storm',
          x: cx,
          y: cy,
          radius,
          life: 1.15,
          maxLife: 1.15,
          color: stats.color,
          seed: (Math.random() * 1e9) | 0,
        });
        const bolts = Math.max(4, Math.min(12, stats.boltCount || 7));
        for (let i = 0; i < bolts; i++) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * radius * 0.92;
          const bx = cx + Math.cos(ang) * r;
          const by = cy + Math.sin(ang) * r;
          this.pushSkyLightning(bx, by, stats.color, {
            spellId: 'electric_storm',
            branches: 3 + (i % 3),
            skyHeight: 280 + Math.random() * 120,
            life: 0.4 + Math.random() * 0.25,
            jitter: 18,
          });
        }
        // Raio extra no centro / alvo principal
        this.pushSkyLightning(cx, cy, 0xffffff, {
          spellId: 'electric_storm',
          branches: 6,
          skyHeight: 360,
          life: 0.55,
          jitter: 4,
        });
        this.spawnSpellImpact(cx, cy, 'electric_storm', stats.color, 40);
        monster.attackCd = (monster.attackCooldown || 1.2) * 1.25;
        monster.novaCd = monster.novaCooldown || stats.cooldown || 4.5;
        break;
      }
      case 'firebolt':
      case 'ice_shard':
      case 'acid_bolt':
      case 'crystal_bolt':
      case 'ember_bolt':
      case 'sap_bolt':
      case 'brine_bolt':
      case 'dusk_bolt': {
        if (!target) return false;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = monster.projectileSpeed || stats.speed || 480;
        const range = monster.range || stats.range || 300;
        const isIce = ['ice_shard', 'crystal_bolt', 'brine_bolt', 'dusk_bolt'].includes(spellId);
        const isAcid = spellId === 'acid_bolt' || spellId === 'sap_bolt';
        this.projectiles.push({
          entityId: eid(),
          ownerId: monster.entityId,
          team: 'monster',
          kind: isIce ? 'ice_shard' : isAcid ? 'orb' : 'fireball',
          spellId,
          x: monster.x,
          y: monster.y,
          vx: (dx / len) * speed,
          vy: (dy / len) * speed,
          damage: monster.damage,
          radius: monster.projectileRadius || stats.radius || 10,
          life: range / speed,
          color: monster.projectileColor || stats.color,
          slow: isIce ? stats.slow || 0.45 : 0,
          slowDuration: isIce ? stats.slowDuration || 5 : 0,
          poisonDamage: isAcid ? stats.poisonDamage || 3 : 0,
          poisonTick: isAcid ? stats.poisonTick || 1 : 0,
          poisonDuration: isAcid ? stats.poisonDuration || 4 : 0,
        });
        monster.attackCd =
          monster.attackCooldown || (isIce ? 1.25 : isAcid ? 1.2 : 1.1);
        break;
      }
      case 'flame_nova':
      case 'magma_surge':
      case 'ash_nova': {
        const radius = Math.max(monster.novaRadius || 0, stats.radius || 0, 110);
        this.applyFlameNova(
          monster,
          monster.entityId,
          { ...stats, radius },
          Math.round(monster.damage * (spellId === 'magma_surge' || spellId === 'ash_nova' ? 1.25 : 1.15)),
          false
        );
        monster.attackCd = (monster.attackCooldown || 1.1) * 1.2;
        monster.novaCd = monster.novaCooldown || stats.cooldown || 4;
        break;
      }
      case 'thorn_nova':
      case 'mire_nova': {
        const radius = Math.max(monster.novaRadius || 0, stats.radius || 0, 100);
        const dmg = Math.round(monster.damage * 1.2);
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (dist(p, monster) > radius) continue;
          this.damageEntity(p, dmg, monster.entityId, true, true);
          this.applyPoison(
            p,
            monster.entityId,
            stats.poisonDamage || 3,
            stats.poisonTick || 1,
            stats.poisonDuration || 4
          );
        }
        this.effects.push({
          type: 'poison_burst',
          spellId,
          x: monster.x,
          y: monster.y,
          radius,
          life: 0.5,
          maxLife: 0.5,
          color: stats.color,
        });
        this.spawnSpellImpact(monster.x, monster.y, spellId, stats.color, 36);
        monster.attackCd = (monster.attackCooldown || 1.1) * 1.2;
        monster.novaCd = monster.novaCooldown || stats.cooldown || 4;
        break;
      }
      case 'firebreath':
      case 'frost_breath':
      case 'gale_breath': {
        if (!target) return false;
        const range = stats.range || 170;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        if (len > range * 1.15) return false;
        const dirX = dx / len;
        const dirY = dy / len;
        const halfAngle = ((stats.coneAngle || 38) * Math.PI) / 180;
        const cosMin = Math.cos(halfAngle);
        const dmg = Math.round(
          monster.damage * (spellId === 'frost_breath' || spellId === 'gale_breath' ? 1.2 : 1.35)
        );
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const pdx = p.x - monster.x;
          const pdy = p.y - monster.y;
          const pd = Math.hypot(pdx, pdy);
          if (pd > range) continue;
          if (pd < 0.001 || (pdx / pd) * dirX + (pdy / pd) * dirY >= cosMin) {
            this.damageEntity(p, dmg, monster.entityId, true, true);
            if (spellId === 'frost_breath' || spellId === 'gale_breath') {
              this.applyMonsterSlow(p, stats.slow || 0.4, stats.slowDuration || 2.8);
            }
          }
        }
        this.effects.push({
          type: 'firebreath',
          spellId,
          x: monster.x,
          y: monster.y,
          dirX,
          dirY,
          range,
          coneAngle: stats.coneAngle || 38,
          life: 0.55,
          maxLife: 0.55,
          color: stats.color,
        });
        monster.attackCd = monster.attackCooldown || stats.cooldown || 1.8;
        break;
      }
      case 'skull_wave':
      case 'bone_volley': {
        const n = Math.max(4, monster.skullCount || stats.skullCount || 10);
        const speed = monster.projectileSpeed || stats.speed || 300;
        const range = monster.range || stats.range || 220;
        const life = range / speed;
        const dmg = Math.round(monster.damage * 0.95);
        const radius = monster.projectileRadius || stats.radius || 11;
        const color = monster.projectileColor || stats.color || 0x4a0080;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          const ox = Math.cos(ang) * 14;
          const oy = Math.sin(ang) * 14;
          this.projectiles.push({
            entityId: eid(),
            ownerId: monster.entityId,
            team: 'monster',
            kind: 'skull_bolt',
            spellId: 'skull_bolt',
            x: monster.x + ox,
            y: monster.y + oy,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            damage: dmg,
            radius,
            life,
            color,
          });
        }
        this.spawnSpellImpact(monster.x, monster.y, 'skull_bolt', color, 36);
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + Math.random() * 0.4;
          const len = 22 + Math.random() * 16;
          this.effects.push({
            type: 'lightning',
            x1: monster.x,
            y1: monster.y,
            x2: monster.x + Math.cos(ang) * len,
            y2: monster.y + Math.sin(ang) * len,
            life: 0.32,
            maxLife: 0.32,
            color: spellId === 'bone_volley' ? 0xece5d0 : 0x2a0044,
            seed: (Math.random() * 1e9) | 0,
            branches: 3,
            dark: spellId !== 'bone_volley',
          });
        }
        monster.attackCd = monster.attackCooldown || stats.cooldown || 2.4;
        break;
      }
      case 'poison_cloud': {
        if (!target) return false;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        const dropDist = Math.min(90, len * 0.55);
        const cx = monster.x + (dx / len) * dropDist;
        const cy = monster.y + (dy / len) * dropDist;
        const groundLife = Math.max(0.5, Number(stats.duration) || 4);
        const radius = Math.max(monster.novaRadius || 0, stats.radius || 0, 90);
        this.aoes.push({
          entityId: eid(),
          ownerId: monster.entityId,
          x: cx,
          y: cy,
          radius,
          damage: Math.max(1, Math.round(Number(stats.damage) || 3)),
          tick: Math.max(0.05, Number(stats.tick) || 1),
          poisonDuration: Math.max(0.5, Number(stats.poisonDuration) || 5),
          life: groundLife,
          maxLife: groundLife,
          color: stats.color,
          spellId: 'poison_cloud',
        });
        this.effects.push({
          type: 'poison_burst',
          x: cx,
          y: cy,
          radius,
          life: 0.45,
          maxLife: 0.45,
          color: stats.color,
        });
        monster.attackCd = monster.attackCooldown || stats.cooldown || 3;
        monster.novaCd = monster.novaCooldown || 3.8;
        break;
      }
      case 'soul_rend':
      case 'death_knell':
      case 'blood_pact':
      case 'soul_lance':
      case 'rift_lance':
      case 'obsidian_lance': {
        if (!monster.isBoss || !target) return false;
        const range = stats.range || 220;
        if (dist(monster, target) > range) return false;
        const pct = clampBossHpPercent(stats.damagePercentMaxHp);
        const dmg = this.bossPercentDamage(target, stats);
        this.damageEntity(target, dmg, monster.entityId, true, true, {
          skipCrit: true,
          maxHpPercent: pct,
        });
        this.effects.push({
          type: 'boss_strike',
          spellId,
          x: target.x,
          y: target.y,
          radius: 36,
          life: 0.55,
          maxLife: 0.55,
          color: stats.color,
        });
        this.spawnSpellImpact(target.x, target.y, spellId, stats.color, 34);
        // Single-target de boss usa só attackCd — não bloqueia fillers/AoE via novaCd.
        monster.attackCd = monster.attackCooldown || 1.2;
        break;
      }
      case 'infernal_judgment':
      case 'solar_judgment':
      case 'aurora_judgment': {
        if (!monster.isBoss || !target) return false;
        const range = stats.range || 260;
        if (dist(monster, target) > range) return false;
        const pct = clampBossHpPercent(stats.damagePercentMaxHp);
        const dmg = this.bossPercentDamage(target, stats);
        this.damageEntity(target, dmg, monster.entityId, true, true, {
          skipCrit: true,
          maxHpPercent: pct,
        });
        this.pushSkyLightning(target.x, target.y, stats.color, {
          spellId,
          branches: 6,
          skyHeight: 340 + Math.random() * 40,
        });
        this.effects.push({
          type: 'boss_strike',
          spellId,
          x: target.x,
          y: target.y,
          radius: 42,
          life: 0.65,
          maxLife: 0.65,
          color: stats.color,
        });
        this.spawnSpellImpact(target.x, target.y, spellId, stats.color, 40);
        monster.attackCd = monster.attackCooldown || 1.25;
        break;
      }
      case 'void_collapse':
      case 'abyss_nova':
      case 'frost_apocalypse':
      case 'plague_burst':
      case 'shadow_eclipse':
      case 'entropy_pulse':
      case 'tidal_crush':
      case 'blood_nova':
      case 'quake_pulse': {
        if (!monster.isBoss) return false;
        const radius = Math.max(monster.novaRadius || 0, stats.radius || 0, 120);
        const cx = target ? target.x : monster.x;
        const cy = target ? target.y : monster.y;
        const pct = clampBossHpPercent(stats.damagePercentMaxHp);
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (dist(p, { x: cx, y: cy }) > radius) continue;
          const dmg = this.bossPercentDamage(p, stats);
          this.damageEntity(p, dmg, monster.entityId, true, true, {
            skipCrit: true,
            maxHpPercent: pct,
          });
          if (spellId === 'frost_apocalypse' || spellId === 'tidal_crush') {
            this.applyMonsterSlow(
              p,
              stats.slow || (spellId === 'tidal_crush' ? 0.4 : 0.5),
              stats.slowDuration || (spellId === 'tidal_crush' ? 2.5 : 3.5)
            );
          }
          if (spellId === 'plague_burst') {
            this.applyPoison(
              p,
              monster.entityId,
              stats.poisonDamage || 4,
              stats.poisonTick || 1,
              stats.poisonDuration || 5
            );
          }
        }
        this.effects.push({
          type: 'boss_nova',
          spellId,
          x: cx,
          y: cy,
          radius,
          life: 0.85,
          maxLife: 0.85,
          color: stats.color,
        });
        this.spawnSpellImpact(cx, cy, spellId, stats.color, 44);
        monster.attackCd = (monster.attackCooldown || 1.2) * 1.3;
        monster.novaCd = monster.novaCooldown || stats.cooldown || 6;
        break;
      }
      case 'cataclysm_beam': {
        if (!monster.isBoss || !target) return false;
        const range = stats.range || 200;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        if (len > range * 1.15) return false;
        const dirX = dx / len;
        const dirY = dy / len;
        const halfAngle = ((stats.coneAngle || 32) * Math.PI) / 180;
        const cosMin = Math.cos(halfAngle);
        const pct = clampBossHpPercent(stats.damagePercentMaxHp);
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const pdx = p.x - monster.x;
          const pdy = p.y - monster.y;
          const pd = Math.hypot(pdx, pdy);
          if (pd > range) continue;
          if (pd < 0.001 || (pdx / pd) * dirX + (pdy / pd) * dirY >= cosMin) {
            const dmg = this.bossPercentDamage(p, stats);
            this.damageEntity(p, dmg, monster.entityId, true, true, {
              skipCrit: true,
              maxHpPercent: pct,
            });
          }
        }
        this.effects.push({
          type: 'firebreath',
          spellId: 'cataclysm_beam',
          x: monster.x,
          y: monster.y,
          dirX,
          dirY,
          range,
          coneAngle: stats.coneAngle || 32,
          life: 0.6,
          maxLife: 0.6,
          color: stats.color,
        });
        monster.attackCd = monster.attackCooldown || 1.3;
        monster.novaCd = monster.novaCooldown || 4.5;
        break;
      }
      default:
        return false;
    }

    // Telegraph visual — mesmo pentagrama dos jogadores
    const pentagramLife = CONFIG.PENTAGRAM_FADEOUT;
    this.effects.push({
      type: 'pentagram',
      x: monster.x,
      y: monster.y,
      radius: Math.max(30, (monster.radius || 14) * 1.15),
      life: pentagramLife,
      maxLife: pentagramLife,
      color: stats.color,
    });
    this.announceNonProjectileCast(monster, spellId, false);
    this.flashMonsterPose(monster, 'attack', 0.38);
    return true;
  }

  /** Rastro de fogo deixado pelo bruxo ao se mover. */
  dropFireTrail(monster) {
    if (!monster?.fireTrail || !monster.alive) return;
    const groundLife = Math.max(0.5, Number(monster.fireTrailLife) || 2.6);
    const burnDmg = Math.max(1, Math.round(Number(monster.fireTrailBurnDamage) || 2));
    const burnTick = Math.max(0.05, Number(monster.fireTrailBurnTick) || 1);
    const burnDuration = Math.max(0.5, Number(monster.fireTrailBurnDuration) || 3);
    this.aoes.push({
      entityId: eid(),
      ownerId: monster.entityId,
      x: monster.x,
      y: monster.y,
      radius: monster.fireTrailRadius || 34,
      damage: burnDmg,
      tick: burnTick,
      burnDuration,
      life: groundLife,
      maxLife: groundLife,
      color: monster.projectileColor || monster.color || 0xff6622,
      spellId: 'flame_nova',
    });
  }

  /** Empurra o alvo na direção da trajetória do projétil (magias em área não usam isto). */
  applyProjectileKnockback(target, proj) {
    if (!CONFIG.PROJECTILE_KNOCKBACK_ENABLED) return;
    const speed = CONFIG.PROJECTILE_KNOCKBACK_SPEED;
    const duration = CONFIG.PROJECTILE_KNOCKBACK_DURATION;
    if (speed <= 0 || duration <= 0) return;
    const len = Math.hypot(proj.vx, proj.vy);
    if (len <= 0) return;
    const dx = proj.vx / len;
    const dy = proj.vy / len;
    target.knockbackDx = dx;
    target.knockbackDy = dy;
    target.knockbackTimer = duration;
    target.vx = dx * speed;
    target.vy = dy * speed;
    // Interrompe dash em andamento para o empurrão prevalecer
    if (target.dashTimer != null) target.dashTimer = 0;
  }

  monsterShoot(monster, target) {
    const dx = target.x - monster.x;
    const dy = target.y - monster.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = monster.projectileSpeed || 240;
    this.projectiles.push({
      entityId: eid(),
      ownerId: monster.entityId,
      team: 'monster',
      kind: monster.projectile || 'orb',
      spellId: monster.projectile,
      x: monster.x,
      y: monster.y,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      damage: monster.damage,
      radius: monster.projectileRadius || 6,
      life: (monster.range || 180) / speed,
      color: monster.projectileColor || monster.color,
    });
    monster.attackCd = monster.attackCooldown || CONFIG.MONSTER_ATTACK_COOLDOWN;
    this.flashMonsterPose(monster, 'attack', 0.32);
  }

  /** Tenta castar cada magia equipada cujo cooldown já acabou. */
  autocastPlayerSpells(player) {
    if (!player?.alive || this.phase !== 'playing') return;
    const n = player.spells?.length || 0;
    for (let i = 0; i < n; i++) this.castSpell(player, i);
    if (player.ultimate) this.castSpell(player, 3);
  }

  castSpell(player, slot) {
    if (!player.alive || player.stunTimer > 0) return;
    if (this.phase !== 'playing') return;

    // Slots 0–2 = magias básicas; 3 = ultimate (dash é input separado)
    let spellInst = null;
    if (slot >= 0 && slot < 3) {
      spellInst = player.spells[slot];
    } else if (slot === 3) {
      spellInst = player.ultimate;
    }
    if (!spellInst) {
      player.input.castSlot = -1;
      return;
    }
    // Keep latched cast while on cooldown so a press queues until ready.
    if (spellInst.cooldownLeft > 0) return;

    const stats = spellStats(spellInst.id, spellInst.level);
    if (!stats || !isPlayerUsableSpell(spellInst.id)) {
      player.input.castSlot = -1;
      return;
    }

    const rangeBonus = (player.bonuses?.rangeBonus || 0);
    const radiusBonus = (player.bonuses?.radiusBonus || 0);
    const boostedRange = stats.range ? stats.range * (1 + rangeBonus) : stats.range;
    const boostedRadius = stats.radius ? Math.round(stats.radius * (1 + radiusBonus)) : stats.radius;
    const boostedLife = stats.speed ? boostedRange / stats.speed : 0;

    const castX = player.x;
    const castY = player.y;
    const aimDx = player.input.aimX - player.x;
    const aimDy = player.input.aimY - player.y;
    const aimLen = Math.hypot(aimDx, aimDy) || 1;
    const dirX = aimDx / aimLen;
    const dirY = aimDy / aimLen;

    switch (spellInst.id) {
      case 'firebolt':
      case 'ice_shard':
      case 'skull_bolt':
      case 'water_orb':
      case 'vine_spike': {
        const kind =
          spellInst.id === 'firebolt'
            ? 'fireball'
            : spellInst.id === 'ice_shard'
              ? 'ice_shard'
              : spellInst.id === 'skull_bolt'
                ? 'skull_bolt'
                : 'orb';
        this.projectiles.push({
          entityId: eid(),
          ownerId: player.id,
          team: 'player',
          kind,
          spellId: spellInst.id,
          x: player.x,
          y: player.y,
          vx: dirX * stats.speed,
          vy: dirY * stats.speed,
          damage: stats.damage,
          radius: boostedRadius || stats.radius,
          life: boostedLife || (stats.range / stats.speed),
          slow: stats.slow || 0,
          slowDuration: stats.slowDuration || 0,
          poisonDamage: stats.poisonDamage || 0,
          poisonTick: stats.poisonTick || 0,
          poisonDuration: stats.poisonDuration || 0,
          color: stats.color,
        });
        break;
      }
      case 'tiro_de_buscape': {
        // Leque pé de galinha: \ | /
        const n = Math.max(1, Math.round(Number(stats.rocketCount) || 3));
        const spreadDeg = Number(stats.spreadAngle) || 28;
        const half = (n - 1) / 2;
        const life = boostedLife || (stats.range / stats.speed);
        for (let i = 0; i < n; i++) {
          const a = ((i - half) * spreadDeg * Math.PI) / 180;
          const c = Math.cos(a);
          const s = Math.sin(a);
          const dx = dirX * c - dirY * s;
          const dy = dirX * s + dirY * c;
          this.projectiles.push({
            entityId: eid(),
            ownerId: player.id,
            team: 'player',
            kind: 'rocket',
            spellId: 'tiro_de_buscape',
            x: player.x,
            y: player.y,
            vx: dx * stats.speed,
            vy: dy * stats.speed,
            damage: stats.damage,
            radius: boostedRadius || stats.radius,
            life,
            color: stats.color,
          });
        }
        break;
      }
      case 'arc_lightning': {
        const range = boostedRange || stats.range;
        const target = this.findNearestHostile(player, range);
        if (target) {
          this.damageHostile(target, stats.damage, player.id, { spellId: 'arc_lightning' });
          this.effects.push({
            type: 'lightning',
            x1: player.x,
            y1: player.y,
            x2: target.x,
            y2: target.y,
            life: 0.38,
            maxLife: 0.38,
            color: stats.color,
            seed: (Math.random() * 1e9) | 0,
            branches: 3,
          });
          this.spawnSpellImpact(target.x, target.y, 'arc_lightning', stats.color, 26);
        }
        break;
      }
      case 'flame_nova':
        this.applyFlameNova(player, player.id, stats, stats.damage, true);
        break;
      case 'mend':
        // Heal é habilidade inata (tecla H), não slot de magia.
        player.input.castSlot = -1;
        return;
      case 'poison_cloud': {
        const groundLife = Math.max(0.5, Number(stats.duration) || 4);
        const radiusPoison = boostedRadius || stats.radius || 90;
        this.aoes.push({
          entityId: eid(),
          ownerId: player.id,
          x: player.x + dirX * 80,
          y: player.y + dirY * 80,
          radius: radiusPoison,
          damage: Math.max(1, Math.round(Number(stats.damage) || 3)),
          tick: Math.max(0.05, Number(stats.tick) || 1),
          poisonDuration: Math.max(0.5, Number(stats.poisonDuration) || 5),
          life: groundLife,
          maxLife: groundLife,
          color: stats.color,
          spellId: 'poison_cloud',
        });
        this.effects.push({
          type: 'poison_burst',
          x: player.x + dirX * 80,
          y: player.y + dirY * 80,
          radius: radiusPoison,
          life: 0.45,
          maxLife: 0.45,
          color: stats.color,
        });
        break;
      }
      case 'blink':
        // Blink é habilidade inata (tecla B), não slot de magia.
        player.input.castSlot = -1;
        return;
      case 'barrier':
        // Escudo é habilidade inata (tecla E), não slot de magia.
        player.input.castSlot = -1;
        return;
      case 'apocalypse':
        this.applyNova(player, boostedRadius || stats.radius, stats.damage, player.id, { spellId: 'apocalypse' });
        this.effects.push({
          type: 'apocalypse',
          x: player.x,
          y: player.y,
          radius: boostedRadius || stats.radius,
          life: 1.7,
          maxLife: 1.7,
          color: stats.color,
          seed: (Math.random() * 1e9) | 0,
        });
        break;
      case 'time_freeze':
        const freezeR = boostedRadius || stats.radius;
        for (const other of this.players.values()) {
          if (other.id === player.id || !other.alive) continue;
          if (dist(player, other) <= freezeR) other.stunTimer = stats.duration;
        }
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (dist(player, m) <= freezeR) m.stunTimer = stats.duration;
        }
        this.effects.push({
          type: 'freeze',
          spellId: 'time_freeze',
          x: player.x,
          y: player.y,
          radius: stats.radius,
          life: 1.45,
          maxLife: 1.45,
          color: stats.color,
          seed: (Math.random() * 1e9) | 0,
        });
        break;
      case 'storm_call': {
        const stormRange = boostedRange || stats.range;
        const hostiles = this.listHostiles(player).filter((h) => dist(player, h) <= stormRange);
        this.effects.push({
          type: 'storm',
          x: player.x,
          y: player.y,
          radius: stormRange,
          life: 0.85,
          maxLife: 0.85,
          color: stats.color,
          seed: (Math.random() * 1e9) | 0,
        });
        for (const h of hostiles) {
          this.damageHostile(h, stats.damage, player.id, { spellId: 'storm_call' });
          this.effects.push({
            type: 'lightning',
            x1: player.x,
            y1: player.y - 40,
            x2: h.x,
            y2: h.y,
            life: 0.4,
            maxLife: 0.4,
            color: stats.color,
            seed: (Math.random() * 1e9) | 0,
            branches: 4,
          });
          this.spawnSpellImpact(h.x, h.y, 'storm_call', stats.color, 30);
        }
        break;
      }
      default:
        player.input.castSlot = -1;
        return;
    }

    const pentagramLife = CONFIG.PENTAGRAM_FADEOUT;
    this.effects.push({
      type: 'pentagram',
      x: castX,
      y: castY,
      radius: 30.4,
      life: pentagramLife,
      maxLife: pentagramLife,
      color: stats.color,
    });
    this.announceNonProjectileCast(player, spellInst.id, true);

    spellInst.cooldownLeft =
      spellInst.type === 'ultimate'
        ? effectiveSpellCooldown(CONFIG.PLAYER_ULTIMATE_COOLDOWN, player)
        : effectiveSpellCooldown(stats.cooldown, player);
    player.input.castSlot = -1;
  }

  /** Nome da magia acima do caster (só não-projéteis). */
  announceNonProjectileCast(caster, spellId, isPlayer) {
    if (!caster || !spellId || isProjectileSpell(spellId)) return;
    const stats = spellStats(spellId, 1);
    this.pushEvent({
      type: 'spell_cast',
      spellId,
      casterId: isPlayer ? caster.id : caster.entityId,
      isPlayer: !!isPlayer,
      x: +caster.x.toFixed(1),
      y: +caster.y.toFixed(1),
      color: stats?.color ?? 0xffffff,
    });
  }

  listHostiles(player) {
    const list = [];
    if (this.pvpEnabled) {
      for (const p of this.players.values()) {
        if (p.id !== player.id && p.alive) list.push({ ...p, _isPlayer: true, ref: p });
      }
    }
    for (const m of this.monsters) {
      if (m.alive) list.push({ ...m, _isPlayer: false, ref: m });
    }
    return list;
  }

  findNearestHostile(player, range) {
    let best = null;
    let bestD = range;
    for (const h of this.listHostiles(player)) {
      const d = dist(player, h);
      if (d <= bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  damageHostile(hostile, amount, sourceId, opts = null) {
    if (hostile._isPlayer) {
      this.damageEntity(hostile.ref, amount, sourceId, true, true, opts);
    } else {
      this.damageEntity(hostile.ref, amount, sourceId, false, true, opts);
    }
  }

  applyNova(origin, radius, damage, sourceId, opts = null) {
    if (this.playerCanHarmPlayers(sourceId)) {
      for (const p of this.players.values()) {
        if (p.id === sourceId || !p.alive) continue;
        if (dist(origin, p) <= radius) this.damageEntity(p, damage, sourceId, true, true, opts);
      }
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (dist(origin, m) <= radius) {
        this.damageEntity(m, damage, sourceId, false, true, opts);
      }
    }
  }

  spawnSpellImpact(x, y, spellId, color, radius = 24) {
    const isRocket = spellId === 'tiro_de_buscape' || spellId === 'rocket';
    const life = isRocket ? 0.55 : 0.4;
    this.effects.push({
      type: 'impact',
      spellId: spellId || 'orb',
      x,
      y,
      radius,
      life,
      maxLife: life,
      color: color || 0xffffff,
      seed: (Math.random() * 1e9) | 0,
    });
  }

  tick(dt) {
    this.events = [];

    for (const bot of this.bots) bot.update(dt);

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        if (this.round === 0) this.matchTime = 0;
        // Boss fight só depois de um round normal (round > 0), nunca no início da partida.
        if (
          this.round > 0 &&
          (this.pendingBossFight || this.needsBossFightAfterRound(this.round))
        ) {
          this.startBossFight();
        } else {
          this.startRound();
        }
      } else {
        this.broadcast({ type: 'countdown', seconds: Math.ceil(this.countdown) });
        this.broadcastState();
      }
      return;
    }

    if (this.phase === 'intermission') {
      this.intermissionTimer -= dt;
      this.matchTime += dt;
      this.ensureSpellChoicesForPending();
      this.resolveLevelUpTimeouts();
      if (this.intermissionTimer <= 0) {
        this.beginRoundAfterIntermission();
      } else {
        this.broadcastState();
      }
      return;
    }

    if (this.phase === 'ended') return;

    if (this.phase === 'levelup') {
      // Legado: combate travado até todos escolherem (não usado com escolha ao vivo)
      this.matchTime += dt;
      // Garante deadline (e choiceTimeLeft no cliente) se algum pacote ficou sem timer
      this.ensureSpellChoicesForPending();
      for (const p of this.players.values()) {
        for (const s of p.spells) s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
        if (p.ultimate) p.ultimate.cooldownLeft = Math.max(0, p.ultimate.cooldownLeft - dt);
      }
      this.resolveLevelUpTimeouts();
      if (this.phase === 'levelup') this.broadcastState();
      return;
    }

    if (this.phase !== 'playing') return;

    this.matchTime += dt;
    this.roundTime += dt;

    // Escolha ao vivo — mantém deadlines e auto-escolhe se expirar
    this.ensureSpellChoicesForPending();
    this.resolveLevelUpTimeouts();

    // Round de boss não tem limite de tempo — só acaba ao matar o boss (ou todos morrerem).
    if (!this.bossRound && this.roundTime >= this.roundDuration) {
      const alive = [...this.players.values()].filter((p) => p.alive);
      if (alive.length === 1) {
        this.finishRound(alive[0]);
      } else if (alive.length > 1) {
        alive.sort((a, b) => b.hp - a.hp || b.score - a.score);
        const soleLead = alive[0].hp > alive[1].hp ? alive[0] : null;
        this.finishRound(soleLead);
      } else {
        this.endMatch(this.leadingPlayer(), { result: 'ended', reason: 'wipe' });
      }
      return;
    }

    // XP passivo a cada segundo (jogadores, bots e monstros)
    if (
      CONFIG.XP_PER_SECOND > 0 ||
      CONFIG.BOT_XP_PER_SECOND > 0 ||
      CONFIG.MONSTER_XP_PER_SECOND > 0
    ) {
      this.xpPassiveTimer += dt;
      while (this.xpPassiveTimer >= 1) {
        this.xpPassiveTimer -= 1;
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const amount = p.isBot ? CONFIG.BOT_XP_PER_SECOND : CONFIG.XP_PER_SECOND;
          if (amount > 0) this.grantXp(p, amount, 'passive');
        }
        if (CONFIG.MONSTER_XP_PER_SECOND > 0) {
          for (const m of this.monsters) {
            if (!m.alive) continue;
            this.grantMonsterXp(m, CONFIG.MONSTER_XP_PER_SECOND);
          }
        }
      }
    }

    // Regeneração de vida (HP_REGEN_AMOUNT / HP_REGEN_INTERVAL no .env)
    if (CONFIG.HP_REGEN_AMOUNT > 0 && CONFIG.HP_REGEN_INTERVAL > 0) {
      this.hpRegenTimer += dt;
      while (this.hpRegenTimer >= CONFIG.HP_REGEN_INTERVAL) {
        this.hpRegenTimer -= CONFIG.HP_REGEN_INTERVAL;
        for (const p of this.players.values()) {
          if (!p.alive || p.hp >= p.maxHp) continue;
          p.hp = Math.min(p.maxHp, p.hp + CONFIG.HP_REGEN_AMOUNT);
        }
      }
    }

    // Arena shrink gradual (intervalo / duração / quantidade via .env)
    if (this.shrinkActive) {
      this.shrinkElapsed += dt;
      const t = Math.min(1, this.shrinkElapsed / CONFIG.ARENA_SHRINK_DURATION);
      this.arenaRadius = this.shrinkFrom + (this.shrinkTo - this.shrinkFrom) * t;
      this.cullTreesOutsideArena();
      this.cullRocksOutsideArena();
      if (t >= 1) {
        this.arenaRadius = this.shrinkTo;
        this.shrinkActive = false;
        this.shrinksDone += 1;
      }
    } else if (
      this.shrinksDone < CONFIG.ARENA_SHRINK_TIMES &&
      this.roundTime >= this.nextShrinkAt
    ) {
      this.shrinkFrom = this.arenaRadius;
      this.shrinkTo = Math.max(
        CONFIG.ARENA_MIN_RADIUS,
        this.arenaRadius - CONFIG.ARENA_SHRINK_AMOUNT
      );
      this.shrinkElapsed = 0;
      if (this.shrinksDone + 1 < CONFIG.ARENA_SHRINK_TIMES) {
        this.nextShrinkAt += CONFIG.ARENA_SHRINK_INTERVAL;
      }
      this.pushEvent({ type: 'arena_shrink', radius: this.shrinkTo });
      if (CONFIG.ARENA_SHRINK_DURATION <= 0) {
        this.arenaRadius = this.shrinkTo;
        this.shrinkActive = false;
        this.shrinksDone += 1;
        this.cullTreesOutsideArena();
        this.cullRocksOutsideArena();
      } else {
        this.shrinkActive = true;
      }
    }

    // Spawns (desligado no round de boss — só o boss do início)
    if (this.monsterSpawnEnabled && !this.bossRound) {
      this.monsterSpawnTimer -= dt;
      if (this.monsterSpawnTimer <= 0) {
        const count = this.getRoundSpawnCount();
        for (let i = 0; i < count; i++) this.spawnMonster();
        this.monsterSpawnTimer = this.getRoundSpawnInterval();
      }
    }

    // Eventos aleatórios: meteoro, mass heal, névoa, ventania e alavanca
    this.tickArenaEventCooldown(dt);
    this.tickMeteors(dt);
    this.tickMassHeals(dt);
    this.tickCooldownMists(dt);
    this.tickGales(dt);
    this.tickLevers(dt);

    // Players
    for (const p of this.players.values()) {
      if (!p.alive) continue;

      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.slowTimer = Math.max(0, p.slowTimer - dt);
      if (p.slowTimer <= 0) p.slow = 0;
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);
      if (p.shieldTimer <= 0 || p.shield <= 0) {
        p.shield = 0;
        p.maxShield = 0;
        p.shieldTimer = 0;
      }
      p.dashCooldown = Math.max(0, p.dashCooldown - dt);
      p.dashBuffer = Math.max(0, (p.dashBuffer || 0) - dt);
      p.barrierCooldown = Math.max(0, (p.barrierCooldown || 0) - dt);
      p.barrierBuffer = Math.max(0, (p.barrierBuffer || 0) - dt);
      p.mendCooldown = Math.max(0, (p.mendCooldown || 0) - dt);
      p.mendBuffer = Math.max(0, (p.mendBuffer || 0) - dt);
      p.blinkCooldown = Math.max(0, (p.blinkCooldown || 0) - dt);
      p.blinkBuffer = Math.max(0, (p.blinkBuffer || 0) - dt);

      for (const s of p.spells) s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
      if (p.ultimate) p.ultimate.cooldownLeft = Math.max(0, p.ultimate.cooldownLeft - dt);

      this.tryStartDash(p);
      this.tryCastBarrier(p);
      this.tryCastMend(p);
      this.tryCastBlink(p);

      if (p.stunTimer > 0) {
        p.vx = 0;
        p.vy = 0;
        p.dashTimer = 0;
        p.knockbackTimer = 0;
      } else if (p.knockbackTimer > 0) {
        p.knockbackTimer = Math.max(0, p.knockbackTimer - dt);
        p.vx = p.knockbackDx * CONFIG.PROJECTILE_KNOCKBACK_SPEED;
        p.vy = p.knockbackDy * CONFIG.PROJECTILE_KNOCKBACK_SPEED;
        p.x += p.vx * dt;
        this.resolveRockCollision(p, CONFIG.PLAYER_RADIUS);
        p.y += p.vy * dt;
        this.resolveRockCollision(p, CONFIG.PLAYER_RADIUS);
        if (p.knockbackTimer <= 0) {
          p.vx *= 0.35;
          p.vy *= 0.35;
        }
      } else if (p.dashTimer > 0) {
        p.dashTimer = Math.max(0, p.dashTimer - dt);
        p.vx = p.dashDx * CONFIG.PLAYER_DASH_SPEED;
        p.vy = p.dashDy * CONFIG.PLAYER_DASH_SPEED;
        p.x += p.vx * dt;
        this.resolveRockCollision(p, CONFIG.PLAYER_RADIUS);
        p.y += p.vy * dt;
        this.resolveRockCollision(p, CONFIG.PLAYER_RADIUS);
        if (p.dashTimer <= 0) {
          p.vx *= 0.35;
          p.vy *= 0.35;
        }
      } else {
        let mx = 0;
        let my = 0;
        if (p.input.up) my -= 1;
        if (p.input.down) my += 1;
        if (p.input.left) mx -= 1;
        if (p.input.right) mx += 1;
        if (mx || my) {
          const len = Math.hypot(mx, my);
          mx /= len;
          my /= len;
        }
        const floorMul = (CONFIG.FLOOR_SPEED_MUL && CONFIG.FLOOR_SPEED_MUL[this.floorType]) || 1;
        const inertiaMul =
          (CONFIG.FLOOR_INERTIA_MUL && CONFIG.FLOOR_INERTIA_MUL[this.floorType]) || 1;
        const gale = this.galeBuffFor(p);
        const spdBonus = (p.bonuses?.speedBonus || 0);
        const speed = CONFIG.PLAYER_SPEED * floorMul * (1 - p.slow) * gale.speedMul * (1 + spdBonus);
        applyInertia(
          p,
          mx * speed,
          my * speed,
          CONFIG.PLAYER_INERTIA * inertiaMul * gale.inertiaMul,
          dt
        );
        p.x += p.vx * dt;
        this.resolveRockCollision(p, CONFIG.PLAYER_RADIUS);
        p.y += p.vy * dt;
        this.resolveRockCollision(p, CONFIG.PLAYER_RADIUS);
      }

      // Zone damage (+1 DPS a cada round)
      const fromCenter = dist(p, { x: CONFIG.ARENA_CENTER_X, y: CONFIG.ARENA_CENTER_Y });
      if (fromCenter > this.arenaRadius) {
        const zoneDps = CONFIG.ZONE_DPS + Math.max(0, this.round - 1);
        p.zoneDmgAcc += zoneDps * dt;
        if (p.zoneDmgAcc >= 1) {
          const dmg = Math.floor(p.zoneDmgAcc);
          p.zoneDmgAcc -= dmg;
          this.damageEntity(p, dmg, null, true);
        }
      } else {
        p.zoneDmgAcc = 0;
      }

      // Todas as magias equipadas (básicas + ultimate) autocastam fora de CD.
      this.autocastPlayerSpells(p);
    }

    // Monsters AI — sempre na plataforma; sempre tentam engajar jogador/bot
    for (const m of this.monsters) {
      if (!m.alive) continue;
      m.stunTimer = Math.max(0, (m.stunTimer || 0) - dt);
      m.attackCd = Math.max(0, m.attackCd - dt);
      m.novaCd = Math.max(0, (m.novaCd || 0) - dt);
      if ((m.poseTimer || 0) > 0) {
        m.poseTimer = Math.max(0, m.poseTimer - dt);
        if (m.poseTimer <= 0) m.pose = null;
      }
      if (m.isBoss) {
        m.blinkCooldown = Math.max(0, (m.blinkCooldown || 0) - dt);
        m.barrierCooldown = Math.max(0, (m.barrierCooldown || 0) - dt);
        m.shieldTimer = Math.max(0, (m.shieldTimer || 0) - dt);
        if (m.shieldTimer <= 0 || (m.shield || 0) <= 0) {
          m.shield = 0;
          m.maxShield = 0;
          m.shieldTimer = 0;
        }
      }
      this.tryBossHeal(m, dt);
      if (m.stunTimer > 0) {
        m.vx = 0;
        m.vy = 0;
        m.knockbackTimer = 0;
        this.clampMonsterToArena(m);
        continue;
      }

      if ((m.knockbackTimer || 0) > 0) {
        m.knockbackTimer = Math.max(0, m.knockbackTimer - dt);
        m.vx = m.knockbackDx * CONFIG.PROJECTILE_KNOCKBACK_SPEED;
        m.vy = m.knockbackDy * CONFIG.PROJECTILE_KNOCKBACK_SPEED;
        m.x += m.vx * dt;
        this.resolveRockCollision(m, m.radius || CONFIG.MONSTER_RADIUS);
        m.y += m.vy * dt;
        this.resolveRockCollision(m, m.radius || CONFIG.MONSTER_RADIUS);
        if (m.knockbackTimer <= 0) {
          m.vx *= 0.35;
          m.vy *= 0.35;
        }
        this.clampMonsterToArena(m);
        continue;
      }

      // Sem limite de aggro: sempre mira o vivo mais próximo (jogador ou bot)
      let nearest = null;
      let nearestD = Infinity;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const d = dist(m, p);
        if (d < nearestD) {
          nearestD = d;
          nearest = p;
        }
      }

      // Inatas de boss: escudo + blink em cima do jogador/bot mais próximo
      if (m.isBoss) {
        this.tryBossBarrier(m);
        if (nearest && this.tryBossBlink(m, nearest)) {
          nearestD = dist(m, nearest);
        }
      }

      const mRadius = m.radius || CONFIG.MONSTER_RADIUS;
      const fromCenter = dist(m, { x: CONFIG.ARENA_CENTER_X, y: CONFIG.ARENA_CENTER_Y });
      const maxR = Math.max(0, this.arenaRadius - mRadius);
      const outsidePlatform = fromCenter > maxR;

      const meleeRange =
        CONFIG.MONSTER_ATTACK_RANGE +
        Math.max(0, mRadius - CONFIG.MONSTER_RADIUS);

      let targetVx = 0;
      let targetVy = 0;
      if (outsidePlatform) {
        // Prioridade: voltar para a plataforma — mas ainda pode castar/atirar
        const dx = CONFIG.ARENA_CENTER_X - m.x;
        const dy = CONFIG.ARENA_CENTER_Y - m.y;
        const len = Math.hypot(dx, dy) || 1;
        targetVx = (dx / len) * m.speed;
        targetVy = (dy / len) * m.speed;
        if (nearest && m.attackCd <= 0) {
          if (m.attack === 'caster') {
            const spell = this.pickCasterSpell(m, nearestD);
            if (spell) this.monsterCast(m, spell, nearest);
          } else if (m.attack === 'ranged' && nearestD <= (m.range || 180)) {
            this.monsterShoot(m, nearest);
          }
        }
      } else if (nearest) {
        const dx = nearest.x - m.x;
        const dy = nearest.y - m.y;
        const len = Math.hypot(dx, dy) || 1;

        if (m.attack === 'ranged') {
          // Longa distância: mantém banda de tiro e faz strafe lateral.
          const shootRange = m.range || 180;
          const prefer = m.preferRange || shootRange * 0.7;
          const sideX = -dy / len;
          const sideY = dx / len;
          const strafe = ((Number(m.entityId) || 0) % 2 === 0 ? 1 : -1) * m.speed * 0.45;
          if (nearestD > shootRange * 0.92) {
            targetVx = (dx / len) * m.speed;
            targetVy = (dy / len) * m.speed;
          } else if (nearestD < prefer * 0.7) {
            targetVx = (-dx / len) * m.speed * 0.85 + sideX * strafe;
            targetVy = (-dy / len) * m.speed * 0.85 + sideY * strafe;
          } else {
            // Na distância ideal: strafe para dificultar mira
            targetVx = sideX * strafe;
            targetVy = sideY * strafe;
          }
          if (nearestD <= shootRange && m.attackCd <= 0) {
            this.monsterShoot(m, nearest);
          }
        } else if (m.attack === 'caster') {
          const spells = m.spells || [];
          const shootRange = m.range || 180;
          const novaR = m.novaRadius || 110;
          const lightningR = spellStats('arc_lightning')?.range || 160;
          const breathRange = spellStats('firebreath')?.range || 170;
          const boltRange = spellStats('electric_bolt')?.range || 240;
          const canArea = !!(m.isElite || m.isBoss);
          const hasLongFiller = spells.some((id) =>
            [
              'firebolt',
              'ice_shard',
              'acid_bolt',
              'crystal_bolt',
              'ember_bolt',
              'sap_bolt',
              'brine_bolt',
              'dusk_bolt',
              'spark_bolt',
              'electric_bolt',
              'hex_bolt',
              'skull_wave',
              'bone_volley',
            ].includes(id)
          );
          // Mantém preferência dentro do alcance real das magias (evita idle no mid-range).
          const castReach = Math.max(
            shootRange,
            boltRange,
            lightningR,
            breathRange,
            ...spells.map((id) => spellStats(id)?.range || 0),
            ...spells.map((id) => this.areaSpellReach(m, id, novaR))
          );
          const prefer = Math.min(m.preferRange || shootRange * 0.7, castReach * 0.85);
          const sideX = -dy / len;
          const sideY = dx / len;
          const strafe = ((Number(m.entityId) || 0) % 2 === 0 ? 1 : -1) * m.speed * 0.4;

          if (nearestD > castReach) {
            targetVx = (dx / len) * m.speed;
            targetVy = (dy / len) * m.speed;
          } else if (!hasLongFiller && nearestD > Math.min(breathRange, lightningR) * 0.9) {
            // Só tem magias curtas — aproxima para conseguir castar
            targetVx = (dx / len) * m.speed;
            targetVy = (dy / len) * m.speed;
          } else if (
            canArea &&
            (spells.includes('flame_nova') ||
              spells.includes('magma_surge') ||
              spells.includes('thorn_nova') ||
              spells.includes('ash_nova') ||
              spells.includes('mire_nova') ||
              spells.includes('electric_storm') ||
              spells.includes('abyss_nova') ||
              spells.includes('tidal_crush') ||
              spells.includes('void_collapse') ||
              spells.includes('shadow_eclipse') ||
              spells.includes('frost_apocalypse') ||
              spells.includes('plague_burst') ||
              spells.includes('entropy_pulse') ||
              spells.includes('blood_nova') ||
              spells.includes('quake_pulse') ||
              spells.includes('poison_cloud')) &&
            nearestD < novaR * 0.45 &&
            (m.novaCd || 0) > 0
          ) {
            targetVx = (-dx / len) * m.speed * 0.8 + sideX * strafe;
            targetVy = (-dy / len) * m.speed * 0.8 + sideY * strafe;
          } else if (nearestD < prefer * 0.55) {
            targetVx = (-dx / len) * m.speed * 0.7 + sideX * strafe;
            targetVy = (-dy / len) * m.speed * 0.7 + sideY * strafe;
          } else if (nearestD > prefer * 1.15) {
            targetVx = (dx / len) * m.speed * 0.75;
            targetVy = (dy / len) * m.speed * 0.75;
          } else {
            targetVx = sideX * strafe;
            targetVy = sideY * strafe;
          }

          if (m.attackCd <= 0) {
            const spell = this.pickCasterSpell(m, nearestD);
            if (spell) this.monsterCast(m, spell, nearest);
          }
        } else if (nearestD > meleeRange) {
          // Curta distância: persegue agressivo; acelera quando longe.
          const charge = nearestD > meleeRange * 4 ? 1.2 : 1;
          targetVx = (dx / len) * m.speed * charge;
          targetVy = (dy / len) * m.speed * charge;
        } else if (m.attackCd <= 0) {
          this.damageEntity(nearest, m.damage, m.entityId, true, true);
          m.attackCd = m.attackCooldown || CONFIG.MONSTER_ATTACK_COOLDOWN;
          this.flashMonsterPose(m, 'attack', 0.3);
        }
      }

      applyInertia(m, targetVx, targetVy, CONFIG.MONSTER_INERTIA, dt);
      m.x += m.vx * dt;
      this.resolveRockCollision(m, mRadius);
      m.y += m.vy * dt;
      this.resolveRockCollision(m, mRadius);
      this.clampMonsterToArena(m);

      if (m.fireTrail && m.alive) {
        const moving = Math.hypot(m.vx, m.vy) > 18;
        if (moving) {
          m.trailAcc = (m.trailAcc || 0) + dt;
          const interval = Math.max(0.12, Number(m.fireTrailInterval) || 0.32);
          if (m.trailAcc >= interval) {
            m.trailAcc = 0;
            this.dropFireTrail(m);
          }
        }
      }
    }

    // Projectiles
    for (const proj of this.projectiles) {
      const prevX = proj.x;
      const prevY = proj.y;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;
      let ended = false;
      if (this.projectileHitsRock(prevX, prevY, proj.x, proj.y, proj.radius)) {
        ended = true;
      }
      let hit = false;
      if (!ended) {
        const fromMonster = proj.team === 'monster';
        const canHitPlayers = fromMonster || this.playerCanHarmPlayers(proj.ownerId);
        if (canHitPlayers) {
          for (const p of this.players.values()) {
            if (!p.alive) continue;
            if (!fromMonster && p.id === proj.ownerId) continue;
            if (dist(proj, p) <= proj.radius + CONFIG.PLAYER_RADIUS) {
              this.damageEntity(p, proj.damage, proj.ownerId, true, true);
              this.applyProjectileKnockback(p, proj);
              if (proj.slow) {
                const slowResist = p.bonuses?.slowResist || 0;
                const resistedSlow = proj.slow * (1 - slowResist);
                if (resistedSlow > 0) {
                  p.slow = Math.max(p.slow, resistedSlow);
                  p.slowTimer = Math.max(p.slowTimer, proj.slowDuration);
                }
              }
              if (proj.poisonDamage) {
                this.applyPoison(
                  p,
                  proj.ownerId,
                  proj.poisonDamage,
                  proj.poisonTick || 1,
                  proj.poisonDuration || 4
                );
              }
              hit = true;
              break;
            }
          }
        }
        if (!hit && !fromMonster) {
          for (const m of this.monsters) {
            if (!m.alive) continue;
            if (dist(proj, m) <= proj.radius + m.radius) {
              this.damageEntity(m, proj.damage, proj.ownerId, false, true, {
                spellId: proj.spellId || proj.kind || null,
              });
              this.applyProjectileKnockback(m, proj);
              if (proj.poisonDamage) {
                this.applyPoison(
                  m,
                  proj.ownerId,
                  proj.poisonDamage,
                  proj.poisonTick || 1,
                  proj.poisonDuration || 4
                );
              }
              hit = true;
              break;
            }
          }
        }
      }
      const spellId = proj.spellId || proj.kind || 'orb';
      const isRocket = spellId === 'tiro_de_buscape' || proj.kind === 'rocket';
      // Buscapé / foguete: explode no impacto, na parede ou no fim do alcance.
      const timedOut = isRocket && proj.life <= 0;
      if (hit || ended || timedOut) {
        const impactR =
          spellId === 'firebolt' || spellId === 'fireball'
            ? 30
            : spellId === 'ice_shard' || spellId === 'water_orb'
              ? 26
              : spellId === 'skull_bolt' || spellId === 'vine_spike'
                ? 28
                : isRocket
                  ? 32
                  : 18;
        this.spawnSpellImpact(proj.x, proj.y, spellId, proj.color, impactR);
        if (spellId === 'skull_bolt' && hit) {
          const ang = Math.random() * Math.PI * 2;
          const len = 28 + Math.random() * 18;
          this.effects.push({
            type: 'lightning',
            x1: proj.x,
            y1: proj.y,
            x2: proj.x + Math.cos(ang) * len,
            y2: proj.y + Math.sin(ang) * len,
            life: 0.28,
            maxLife: 0.28,
            color: 0x2a0044,
            seed: (Math.random() * 1e9) | 0,
            branches: 4,
            dark: true,
          });
        }
        proj.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);

    // AoEs — poison / flame_nova aplicam ou renovam status no chão
    for (const aoe of this.aoes) {
      aoe.life -= dt;
      const tick = Math.max(0.05, Number(aoe.tick) || 1);
      const dmg = Math.max(0, Math.round(Number(aoe.damage) || 0));
      const aoeR = this.aoeEffectiveRadius(aoe);
      const isFlameNova = aoe.spellId === 'flame_nova' || aoe.burnDuration != null;
      const isPoisonCloud = aoe.spellId === 'poison_cloud' || aoe.poisonDuration != null;
      if (isFlameNova) {
        const burnDuration = Number(aoe.burnDuration) || 10;
        for (const p of this.players.values()) {
          if (!p.alive || p.id === aoe.ownerId || p.entityId === aoe.ownerId) continue;
          if (dist(aoe, p) <= aoeR + CONFIG.PLAYER_RADIUS) {
            this.applyBurn(p, aoe.ownerId, dmg, tick, burnDuration);
          }
        }
        // Fogo de jogador também queima monstros no chão
        if (this.players.has(aoe.ownerId)) {
          for (const m of this.monsters) {
            if (!m.alive) continue;
            if (dist(aoe, m) <= aoeR + (m.radius || CONFIG.MONSTER_RADIUS)) {
              this.applyBurn(m, aoe.ownerId, dmg, tick, burnDuration);
            }
          }
        }
        continue;
      }
      if (isPoisonCloud) {
        const poisonDuration = Number(aoe.poisonDuration) || 5;
        for (const p of this.players.values()) {
          if (!p.alive || p.id === aoe.ownerId || p.entityId === aoe.ownerId) continue;
          if (dist(aoe, p) <= aoeR + CONFIG.PLAYER_RADIUS) {
            this.applyPoison(p, aoe.ownerId, dmg, tick, poisonDuration);
          }
        }
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (dist(aoe, m) <= aoeR + (m.radius || CONFIG.MONSTER_RADIUS)) {
            this.applyPoison(m, aoe.ownerId, dmg, tick, poisonDuration);
          }
        }
      }
    }
    this.aoes = this.aoes.filter((a) => (a.life || 0) > 0);

    // DoTs depois dos AoEs (status já aplicado/renovado neste tick)
    this.tickAllDots(dt);

    // Esqueletos/sangue na lava somem quando a arena encolhe
    this.cullDebrisOutsideArena();

    // Effects lifetime
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);

    this.collectLootBags();
    this.collectCoins();

    this.broadcastState();
  }

  pushEvent(ev) {
    this.events.push(ev);
    if (ev && ev.type !== 'damage' && ev.type !== 'heal') {
      this.eventLog.push({ ...ev, _at: this.matchTime || 0 });
      if (this.eventLog.length > 4000) this.eventLog.splice(0, this.eventLog.length - 4000);
    }
  }

  lobbySnapshot() {
    return {
      matchId: this.id,
      phase: this.phase,
      minPlayers: CONFIG.MIN_PLAYERS,
      maxPlayers: this.maxPlayers,
      roundDuration: this.roundDuration,
      hasPassword: Boolean(this.password),
      botAiEnabled: this.botAiEnabled,
      monsterSpawnEnabled: this.monsterSpawnEnabled,
      botLevelUpChoiceEnabled: this.botLevelUpChoiceEnabled,
      pvpEnabled: this.pvpEnabled,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        wizardType: p.wizardType,
        color: p.color,
        skin: p.skin || 'classic',
        isBot: !!p.isBot,
      })),
    };
  }

  broadcastLobby() {
    this.io.to(this.id).emit('lobby_state', this.lobbySnapshot());
  }

  serializePlayer(p) {
    return {
      id: p.id,
      entityId: p.entityId,
      name: p.name,
      isBot: !!p.isBot,
      x: p.x,
      y: p.y,
      vx: +p.vx.toFixed(1),
      vy: +p.vy.toFixed(1),
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      level: p.level,
      xp: p.xp,
      xpToNext: p.xpToNext,
      wizardType: p.wizardType,
      color: p.color,
      skin: p.skin || 'classic',
      shield: p.shield,
      maxShield: p.maxShield || 0,
      shieldTimer: +Math.max(0, p.shieldTimer || 0).toFixed(2),
      slow: p.slow,
      slowTimer: +Math.max(0, p.slowTimer || 0).toFixed(2),
      poisonTimer: +Math.max(0, p.poisonTimer || 0).toFixed(2),
      burnTimer: +Math.max(0, p.burnTimer || 0).toFixed(2),
      stun: p.stunTimer > 0,
      dashing: p.dashTimer > 0,
      dashDx: p.dashDx,
      dashDy: p.dashDy,
      dashCooldown: +Math.max(0, p.dashCooldown).toFixed(2),
      barrierCooldown: +Math.max(0, p.barrierCooldown || 0).toFixed(2),
      mendCooldown: +Math.max(0, p.mendCooldown || 0).toFixed(2),
      blinkCooldown: +Math.max(0, p.blinkCooldown || 0).toFixed(2),
      kills: p.kills,
      deaths: p.deaths,
      monsterKills: p.monsterKills || 0,
      loot: p.loot || 0,
      gold: p.gold || 0,
      collectedItems: p.collectedItems || [],
      score: p.score,
      damageDealt: Math.round(p.damageDealt || 0),
      damageTaken: Math.round(p.damageTaken || 0),
      elementDamage: this.serializePlayerElementDamage(p),
      pendingLevelUps: p.pendingLevelUps,
      spellChoices: p.spellChoices,
      choiceSetId: p.choiceSetId,
      choiceTimeLeft:
        p.choiceDeadlineAt != null && CONFIG.LEVELUP_CHOICE_TIMEOUT > 0
          ? +Math.max(0, p.choiceDeadlineAt - this.matchTime).toFixed(1)
          : null,
      spells: p.spells.map((s) => ({
        id: s.id,
        level: s.level,
        cooldownLeft: +s.cooldownLeft.toFixed(2),
        stats: spellStats(s.id, s.level),
      })),
      ultimate: p.ultimate
        ? {
            id: p.ultimate.id,
            level: p.ultimate.level,
            cooldownLeft: +p.ultimate.cooldownLeft.toFixed(2),
            usedThisRound: p.ultimate.usedThisRound,
            stats: spellStats(p.ultimate.id, p.ultimate.level),
          }
        : null,
    };
  }

  stateSnapshot() {
    return {
      matchId: this.id,
      phase: this.phase,
      round: this.round,
      matchTime: +this.matchTime.toFixed(2),
      matchDuration: this.roundDuration,
      roundTime: +this.roundTime.toFixed(2),
      roundDuration: (() => {
        const boss =
          this.phase === 'countdown' || this.phase === 'intermission'
            ? !!this.pendingBossFight
            : this.bossRound;
        return boss ? 0 : this.roundDuration;
      })(),
      pendingBossFight: !!this.pendingBossFight,
      bossRound:
        this.phase === 'countdown' || this.phase === 'intermission'
          ? !!this.pendingBossFight
          : this.bossRound,
      countdown: this.countdown,
      pvpEnabled: this.pvpEnabled,
      arenaEventCooldown: +(this.arenaEventCooldown || 0).toFixed(2),
      arenaEventCooldownMax: CONFIG.ARENA_EVENT_COOLDOWN,
      arena: {
        x: CONFIG.ARENA_CENTER_X,
        y: CONFIG.ARENA_CENTER_Y,
        radius: this.arenaRadius,
        nextShrinkAt: this.nextShrinkAt,
        shrinksDone: this.shrinksDone,
        shrinkTimes: CONFIG.ARENA_SHRINK_TIMES,
        shrinking: this.shrinkActive,
        targetRadius: this.shrinkActive ? this.shrinkTo : this.arenaRadius,
        floorType: this.floorType || 'dirt',
      },
      rocks: this.rocks,
      trees: this.trees,
      players: [...this.players.values()].map((p) => this.serializePlayer(p)),
      monsters: this.monsters.map((m) => ({
        entityId: m.entityId,
        type: m.type,
        x: m.x,
        y: m.y,
        vx: +m.vx.toFixed(1),
        vy: +m.vy.toFixed(1),
        hp: m.hp,
        maxHp: m.maxHp,
        level: m.level || 1,
        xp: m.xp || 0,
        xpToNext: m.xpToNext || 0,
        radius: m.radius,
        color: m.color,
        isBoss: !!m.isBoss,
        isElite: !!m.isElite,
        difficulty: m.difficulty || null,
        shield: m.shield || 0,
        maxShield: m.maxShield || 0,
        pose: m.pose || null,
      })),
      projectiles: this.projectiles.map((p) => ({
        entityId: p.entityId,
        x: p.x,
        y: p.y,
        vx: +p.vx.toFixed(1),
        vy: +p.vy.toFixed(1),
        color: p.color,
        radius: p.radius,
        kind: p.kind || p.spellId || 'orb',
        spellId: p.spellId || p.kind || 'orb',
        team: p.team || 'player',
      })),
      aoes: this.aoes.map((a) => ({
        entityId: a.entityId,
        x: a.x,
        y: a.y,
        radius: a.radius,
        expandTime: a.expandTime || 0,
        color: a.color,
        life: a.life,
        maxLife: a.maxLife || a.life,
        spellId: a.spellId || null,
      })),
      effects: [
        ...this.effects,
        ...this.serializeMeteorEffects(),
        ...this.serializeMassHealEffects(),
        ...this.serializeCooldownMistEffects(),
        ...this.serializeGaleEffects(),
        ...this.serializeLeverEffects(),
      ],
      lootBags: this.lootBags.map((b) => ({
        entityId: b.entityId,
        x: b.x,
        y: b.y,
        radius: b.radius,
        items: b.items || null,
      })),
      coins: this.coins.map((c) => ({
        entityId: c.entityId,
        x: c.x,
        y: c.y,
        radius: c.radius,
        value: c.value || CONFIG.COIN_VALUE,
      })),
      events: this.events,
      winnerId: this.winnerId,
      matchResult: this.matchResult,
      monsterKillStats: this.serializeMonsterKillStats(),
      intermissionTimer: this.intermissionTimer,
    };
  }

  broadcastState(force = false) {
    this.io.to(this.id).emit('game_state', this.stateSnapshot());
  }

  broadcast(msg) {
    this.io.to(this.id).emit('game_event', msg);
  }
}
