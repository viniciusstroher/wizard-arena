import { CONFIG } from './config.js';
import { BotController } from './Bot.js';
import {
  applySpellChoice,
  createSpellInstance,
  rollSpellChoices,
  spellStats,
} from './spells.js';

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
];

function randomWizard() {
  return WIZARD_TYPES[Math.floor(Math.random() * WIZARD_TYPES.length)];
}

export class Match {
  constructor(id, io) {
    this.id = id;
    this.io = io;
    this.players = new Map(); // socketId -> player
    this.monsters = [];
    this.projectiles = [];
    this.aoes = [];
    this.effects = [];
    this.phase = 'lobby'; // lobby | countdown | playing | levelup | intermission | ended
    this.round = 0;
    this.matchTime = 0;
    this.roundTime = 0;
    this.arenaRadius = CONFIG.ARENA_START_RADIUS;
    this.nextShrinkAt = CONFIG.ARENA_SHRINK_INTERVAL;
    this.shrinksDone = 0;
    this.monsterSpawnTimer = 0;
    this.countdown = 0;
    this.intermissionTimer = 0;
    this.winnerId = null;
    this.events = [];
    this.tickAcc = 0;
    this.running = false;
    this._interval = null;
    this.bots = [];
    this.rocks = [];
    this.xpPassiveTimer = 0;
    this.hpRegenTimer = 0;
    this.generateRocks();
  }

  generateRocks() {
    const types = [
      { type: 'stone', radius: 12 },
      { type: 'rock', radius: 18 },
      { type: 'boulder', radius: 26 },
    ];
    const count =
      CONFIG.ROCK_MIN + Math.floor(Math.random() * (CONFIG.ROCK_MAX - CONFIG.ROCK_MIN + 1));
    const rocks = [];
    const cx = CONFIG.ARENA_CENTER_X;
    const cy = CONFIG.ARENA_CENTER_Y;
    let attempts = 0;

    while (rocks.length < count && attempts < count * 40) {
      attempts += 1;
      const def = types[Math.floor(Math.random() * types.length)];
      const x = 48 + Math.random() * (1280 - 96);
      const y = 40 + Math.random() * (720 - 80);
      const fromCenter = Math.hypot(x - cx, y - cy);
      if (fromCenter < CONFIG.ROCK_SPAWN_CLEAR_RADIUS + def.radius) continue;

      let overlaps = false;
      for (const r of rocks) {
        if (Math.hypot(x - r.x, y - r.y) < r.radius + def.radius + 10) {
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
  }

  resolveRockCollision(entity, entityRadius) {
    if (!this.rocks.length) return;
    for (const rock of this.rocks) {
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

  isBlockedByRock(x, y, radius) {
    for (const rock of this.rocks) {
      if (Math.hypot(x - rock.x, y - rock.y) < rock.radius + radius) return true;
    }
    return false;
  }

  createPlayerState(id, name, isBot = false) {
    const angle = (this.players.size / CONFIG.MAX_PLAYERS) * Math.PI * 2;
    const wizard = randomWizard();
    return {
      id,
      entityId: eid(),
      name: (name || 'Wizard').slice(0, 16),
      ready: isBot,
      isBot,
      x: CONFIG.ARENA_CENTER_X + Math.cos(angle) * 120,
      y: CONFIG.ARENA_CENTER_Y + Math.sin(angle) * 120,
      vx: 0,
      vy: 0,
      hp: CONFIG.PLAYER_MAX_HP,
      maxHp: CONFIG.PLAYER_MAX_HP,
      alive: true,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(2) - xpForLevel(1),
      spells: [createSpellInstance('firebolt', 1)],
      ultimate: null,
      pendingLevelUps: 0,
      spellChoices: null,
      input: {
        up: false,
        down: false,
        left: false,
        right: false,
        aimX: 0,
        aimY: 0,
        castSlot: -1,
        dash: null,
      },
      shield: 0,
      shieldTimer: 0,
      slow: 0,
      slowTimer: 0,
      stunTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashBuffer: 0,
      dashDx: 0,
      dashDy: 0,
      knockbackTimer: 0,
      knockbackDx: 0,
      knockbackDy: 0,
      phoenixReady: false,
      kills: 0,
      deaths: 0,
      monsterKills: 0,
      wizardType: wizard.type,
      color: wizard.color,
      zoneDmgAcc: 0,
      score: 0,
    };
  }

  addPlayer(socket, name) {
    if (this.phase !== 'lobby') return { ok: false, error: 'Match already started' };
    if (this.players.size >= CONFIG.MAX_PLAYERS) return { ok: false, error: 'Lobby full' };

    const player = this.createPlayerState(socket.id, name, false);
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
      if (this.players.size >= CONFIG.MAX_PLAYERS) break;
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
    this.monsterSpawnTimer = 1;
    this.xpPassiveTimer = 0;
    this.monsters = [];
    this.projectiles = [];
    this.aoes = [];
    this.effects = [];
    this.events = [];
    this.winnerId = null;
    this.generateRocks();
  }

  /** Posiciona e reseta os jogadores nos spawns do round. */
  placePlayersForRound() {
    const list = [...this.players.values()];
    list.forEach((p, i) => {
      const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      p.x = CONFIG.ARENA_CENTER_X + Math.cos(angle) * 140;
      p.y = CONFIG.ARENA_CENTER_Y + Math.sin(angle) * 140;
      p.hp = p.maxHp;
      p.alive = true;
      p.shield = 0;
      p.shieldTimer = 0;
      p.slow = 0;
      p.slowTimer = 0;
      p.stunTimer = 0;
      p.knockbackTimer = 0;
      p.knockbackDx = 0;
      p.knockbackDy = 0;
      p.zoneDmgAcc = 0;
      p.vx = 0;
      p.vy = 0;
      for (const s of p.spells) s.cooldownLeft = 0;
      if (p.ultimate) {
        p.ultimate.cooldownLeft = 0;
        p.ultimate.usedThisRound = false;
        if (p.ultimate.id === 'phoenix') p.phoenixReady = true;
      }
    });
  }

  /** Prepara arena limpa + spawns visíveis antes da contagem. */
  prepareRound() {
    this.clearArena();
    this.placePlayersForRound();
  }

  startCountdown() {
    this.prepareRound();
    this.phase = 'countdown';
    this.countdown = 3;
    this.broadcast({ type: 'countdown', seconds: this.countdown });
    this.broadcastState(true);
    this.ensureLoop();
  }

  startRound() {
    this.round += 1;
    this.phase = 'playing';
    this.roundTime = 0;
    this.pushEvent({ type: 'round_start', round: this.round });
    this.broadcastState(true);
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
    // Latch cast/dash until the next tick consumes them — client frames are much
    // faster than TICK_RATE, so a one-frame press would otherwise be overwritten.
    if (dash) p.dashBuffer = 0.2;
    p.input = {
      up: !!input.up,
      down: !!input.down,
      left: !!input.left,
      right: !!input.right,
      aimX: Number(input.aimX) || 0,
      aimY: Number(input.aimY) || 0,
      castSlot: castSlot >= 0 ? castSlot : p.input.castSlot,
      dash: dash || p.input.dash,
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

  chooseSpell(socketId, choiceIndex) {
    const p = this.players.get(socketId);
    if (!p || !p.spellChoices) return;
    const choice = p.spellChoices[choiceIndex];
    if (!choice) return;
    if (applySpellChoice(p, choice)) {
      p.pendingLevelUps = Math.max(0, p.pendingLevelUps - 1);
      if (p.pendingLevelUps > 0) {
        p.spellChoices = rollSpellChoices(p, p.level);
      } else {
        p.spellChoices = null;
      }
      this.maybeResumeFromLevelUp();
      this.broadcastState(true);
    }
  }

  maybeResumeFromLevelUp() {
    if (this.phase !== 'levelup') return;
    const waiting = [...this.players.values()].some((p) => p.alive && p.pendingLevelUps > 0);
    if (!waiting) {
      this.phase = 'playing';
    }
  }

  grantXp(player, amount, reason) {
    if (!player.alive && reason !== 'round') return;
    player.xp += amount;
    let leveled = false;
    // xp é progresso no nível atual; xpToNext é o custo do próximo nível
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level += 1;
      player.xpToNext = xpForLevel(player.level + 1) - xpForLevel(player.level);
      if (player.xpToNext <= 0) player.xpToNext = 100 + player.level * 40;
      player.pendingLevelUps += 1;
      leveled = true;
      this.pushEvent({ type: 'level_up', playerId: player.id, level: player.level });
    }
    if (leveled) {
      if (!player.spellChoices) {
        player.spellChoices = rollSpellChoices(player, player.level);
      }
      this.phase = 'levelup';
    }
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
    this.effects.push({
      entityId: eid(),
      type: 'bones',
      x: +(x + (Math.random() - 0.5) * 6).toFixed(1),
      y: +(y + (Math.random() - 0.5) * 6).toFixed(1),
      life: 999,
      scale: +(0.85 + Math.random() * 0.35).toFixed(2),
      rotation: +((Math.random() - 0.5) * 0.6).toFixed(2),
      skullOffsetX: +((Math.random() - 0.5) * 6).toFixed(1),
      skullOffsetY: +((-6 + (Math.random() - 0.5) * 3).toFixed(1)),
    });
  }

  /** @param {boolean} fromHit hit de jogador/monstro (não zona) */
  damageEntity(target, amount, sourcePlayerId = null, isPlayer = true, fromHit = false) {
    if (!target.alive) return false;
    let dmg = amount;
    if (isPlayer && target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg <= 0) return false;
    target.hp -= dmg;

    this.pushEvent({
      type: 'damage',
      amount: dmg,
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
      // Phoenix passive
      if (target.phoenixReady && target.ultimate?.id === 'phoenix' && !target.ultimate.usedThisRound) {
        target.ultimate.usedThisRound = true;
        target.phoenixReady = false;
        target.alive = true;
        target.hp = Math.round(CONFIG.PLAYER_MAX_HP * 0.5);
        this.pushEvent({ type: 'phoenix', playerId: target.id });
        return false;
      }

      this.spawnBones(target.x, target.y);
      target.deaths += 1;
      const killer = sourcePlayerId ? this.players.get(sourcePlayerId) : null;
      if (killer && killer.id !== target.id) {
        killer.kills += 1;
        killer.score += 1;
        this.grantXp(killer, CONFIG.XP_PLAYER_KILL, 'player_kill');
        this.pushEvent({ type: 'player_kill', killerId: killer.id, victimId: target.id });
      } else {
        this.pushEvent({ type: 'player_death', playerId: target.id });
      }
      this.checkRoundEnd();
      return true;
    }

    // Monster — ossos no chão + remove da lista
    const mx = target.x;
    const my = target.y;
    this.spawnBones(mx, my);
    const killer = sourcePlayerId ? this.players.get(sourcePlayerId) : null;
    if (killer) {
      killer.monsterKills += 1;
      this.grantXp(killer, CONFIG.XP_MONSTER, 'monster');
    }
    this.monsters = this.monsters.filter((m) => m.entityId !== target.entityId);
    this.pushEvent({ type: 'monster_kill', monsterId: target.entityId, killerId: sourcePlayerId, x: mx, y: my });
    return true;
  }

  checkRoundEnd() {
    if (this.phase !== 'playing' && this.phase !== 'levelup') return;
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length <= 1) {
      this.finishRound(alive[0] || null);
    }
  }

  finishRound(winner) {
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

    if (this.round >= CONFIG.MAX_ROUNDS) {
      this.endMatch(this.leadingPlayer() || winner);
      return;
    }

    this.phase = 'intermission';
    this.intermissionTimer = CONFIG.ROUND_INTERMISSION;
    this.broadcastState(true);
  }

  /** Jogador com maior placar (desempate: kills, menos deaths, depois nível). */
  leadingPlayer() {
    return (
      [...this.players.values()].sort(
        (a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths || b.level - a.level
      )[0] || null
    );
  }

  endMatch(winner) {
    this.phase = 'ended';
    this.winnerId = winner?.id || null;
    this.pushEvent({
      type: 'match_end',
      winnerId: this.winnerId,
      scores: [...this.players.values()]
        .map((p) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          kills: p.kills,
          deaths: p.deaths,
          level: p.level,
        }))
        .sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths || b.level - a.level),
    });
    this.broadcastState(true);
    setTimeout(() => this.destroy(), 60000);
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
    this.endMatch(null);
  }

  spawnMonster() {
    if (this.monsters.length >= CONFIG.MONSTER_MAX) return;
    const types = {
      // Ranged: fireballs
      imp: {
        hpMul: 1,
        speedMul: 1.2,
        dmgMul: 1,
        radius: 14,
        color: 0xff4422,
        attack: 'ranged',
        projectile: 'fireball',
        range: 190,
        preferRange: 130,
        projectileSpeed: 220,
        projectileRadius: 7,
        projectileColor: 0xff6622,
        attackCooldown: 1.45,
      },
      slime: { hpMul: 1.5, speedMul: 0.8, dmgMul: 1, radius: 16, color: 0x44ff66, attack: 'melee' },
      wraith: { hpMul: 1.3, speedMul: 1.1, dmgMul: 1, radius: 14, color: 0x8866ff, attack: 'melee' },
      // Fast skirmisher — arrows
      goblin: {
        hpMul: 0.7,
        speedMul: 1.35,
        dmgMul: 0.85,
        radius: 12,
        color: 0xa8c734,
        attack: 'ranged',
        projectile: 'arrow',
        range: 210,
        preferRange: 140,
        projectileSpeed: 340,
        projectileRadius: 4,
        projectileColor: 0xd4c4a0,
        attackCooldown: 1.15,
      },
      // Slow bruiser — heavier arrows
      orc: {
        hpMul: 2.2,
        speedMul: 0.65,
        dmgMul: 1.6,
        radius: 20,
        color: 0x3d8b4a,
        attack: 'ranged',
        projectile: 'arrow',
        range: 175,
        preferRange: 110,
        projectileSpeed: 260,
        projectileRadius: 5,
        projectileColor: 0xb8956a,
        attackCooldown: 1.7,
      },
      // Melee undead
      skeleton: {
        hpMul: 1.1,
        speedMul: 1.05,
        dmgMul: 1.15,
        radius: 14,
        color: 0xe8e0d0,
        attack: 'melee',
        attackCooldown: 0.9,
      },
      // Ranged-only undead archer
      skeleton_archer: {
        hpMul: 0.85,
        speedMul: 0.95,
        dmgMul: 1.05,
        radius: 13,
        color: 0xd8d0c0,
        attack: 'ranged',
        projectile: 'arrow',
        range: 230,
        preferRange: 160,
        projectileSpeed: 360,
        projectileRadius: 4,
        projectileColor: 0xc8b8a0,
        attackCooldown: 1.35,
      },
      // Fast melee pack hunter
      wolf: {
        hpMul: 0.95,
        speedMul: 1.45,
        dmgMul: 1.2,
        radius: 14,
        color: 0x8b7355,
        attack: 'melee',
        attackCooldown: 0.75,
      },
      // Bulky melee arachnid
      giant_spider: {
        hpMul: 1.7,
        speedMul: 0.85,
        dmgMul: 1.35,
        radius: 18,
        color: 0x2d1b2e,
        attack: 'melee',
        attackCooldown: 1.1,
      },
      // Fragile flying skirmisher
      bat: {
        hpMul: 0.5,
        speedMul: 1.65,
        dmgMul: 0.8,
        radius: 11,
        color: 0x4a3728,
        attack: 'melee',
        attackCooldown: 0.65,
      },
    };
    const ids = Object.keys(types);
    const type = ids[Math.floor(Math.random() * ids.length)];
    const def = types[type];

    let x = CONFIG.ARENA_CENTER_X;
    let y = CONFIG.ARENA_CENTER_Y;
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = this.arenaRadius * (0.35 + Math.random() * 0.5);
      x = CONFIG.ARENA_CENTER_X + Math.cos(angle) * r;
      y = CONFIG.ARENA_CENTER_Y + Math.sin(angle) * r;
      if (!this.isBlockedByRock(x, y, def.radius)) break;
    }

    this.monsters.push({
      entityId: eid(),
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: Math.round(CONFIG.MONSTER_HP * def.hpMul),
      maxHp: Math.round(CONFIG.MONSTER_HP * def.hpMul),
      alive: true,
      speed: CONFIG.MONSTER_SPEED * def.speedMul,
      damage: Math.round(CONFIG.MONSTER_DAMAGE * def.dmgMul),
      attackCd: 0,
      attack: def.attack || 'melee',
      projectile: def.projectile || null,
      range: def.range || CONFIG.MONSTER_ATTACK_RANGE,
      preferRange: def.preferRange || 0,
      projectileSpeed: def.projectileSpeed || 0,
      projectileRadius: def.projectileRadius || 6,
      projectileColor: def.projectileColor || def.color,
      attackCooldown: def.attackCooldown || CONFIG.MONSTER_ATTACK_COOLDOWN,
      radius: def.radius,
      color: def.color,
      knockbackTimer: 0,
      knockbackDx: 0,
      knockbackDy: 0,
    });
  }

  /** Empurra o alvo na direção da trajetória do projétil (magias em área não usam isto). */
  applyProjectileKnockback(target, proj) {
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
    if (spellInst.type === 'ultimate' || spellStats(spellInst.id)?.oncePerRound) {
      if (spellInst.usedThisRound) {
        player.input.castSlot = -1;
        return;
      }
      // Phoenix is passive — don't cast
      if (spellInst.id === 'phoenix') {
        player.input.castSlot = -1;
        return;
      }
    }

    const stats = spellStats(spellInst.id, spellInst.level);
    if (!stats) {
      player.input.castSlot = -1;
      return;
    }

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
        this.projectiles.push({
          entityId: eid(),
          ownerId: player.id,
          team: 'player',
          kind: spellInst.id === 'firebolt' ? 'fireball' : 'orb',
          spellId: spellInst.id,
          x: player.x,
          y: player.y,
          vx: dirX * stats.speed,
          vy: dirY * stats.speed,
          damage: stats.damage,
          radius: stats.radius,
          life: stats.range / stats.speed,
          slow: stats.slow || 0,
          slowDuration: stats.slowDuration || 0,
          color: stats.color,
        });
        break;
      case 'arc_lightning': {
        const target = this.findNearestHostile(player, stats.range);
        if (target) {
          this.damageHostile(target, stats.damage, player.id);
          this.effects.push({
            type: 'lightning',
            x1: player.x,
            y1: player.y,
            x2: target.x,
            y2: target.y,
            life: 0.15,
            color: stats.color,
          });
        }
        break;
      }
      case 'flame_nova':
        this.applyNova(player, stats.radius, stats.damage, player.id);
        this.effects.push({
          type: 'nova',
          x: player.x,
          y: player.y,
          radius: stats.radius,
          life: 0.25,
          color: stats.color,
        });
        break;
      case 'mend':
        player.hp = Math.min(player.maxHp, player.hp + stats.heal);
        this.effects.push({ type: 'heal', x: player.x, y: player.y, life: 0.4, color: stats.color });
        break;
      case 'poison_cloud':
        this.aoes.push({
          entityId: eid(),
          ownerId: player.id,
          x: player.x + dirX * 80,
          y: player.y + dirY * 80,
          radius: stats.radius,
          damage: stats.damage,
          tick: stats.tick,
          tickAcc: 0,
          life: stats.duration,
          color: stats.color,
        });
        break;
      case 'blink': {
        const distBlink = Math.min(stats.range, Math.hypot(aimDx, aimDy));
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
        this.effects.push({ type: 'blink', x: player.x, y: player.y, life: 0.2, color: stats.color });
        break;
      }
      case 'barrier':
        player.shield = stats.shield;
        player.shieldTimer = stats.duration;
        this.effects.push({ type: 'barrier', x: player.x, y: player.y, life: 0.35, color: stats.color });
        break;
      case 'apocalypse':
        this.applyNova(player, stats.radius, stats.damage, player.id);
        this.effects.push({
          type: 'nova',
          x: player.x,
          y: player.y,
          radius: stats.radius,
          life: 0.5,
          color: stats.color,
        });
        spellInst.usedThisRound = true;
        break;
      case 'time_freeze':
        for (const other of this.players.values()) {
          if (other.id === player.id || !other.alive) continue;
          if (dist(player, other) <= stats.radius) other.stunTimer = stats.duration;
        }
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (dist(player, m) <= stats.radius) m.stunTimer = stats.duration;
        }
        this.effects.push({
          type: 'nova',
          x: player.x,
          y: player.y,
          radius: stats.radius,
          life: 0.4,
          color: stats.color,
        });
        spellInst.usedThisRound = true;
        break;
      case 'storm_call': {
        const hostiles = this.listHostiles(player).filter((h) => dist(player, h) <= stats.range);
        for (const h of hostiles) {
          this.damageHostile(h, stats.damage, player.id);
          this.effects.push({
            type: 'lightning',
            x1: player.x,
            y1: player.y,
            x2: h.x,
            y2: h.y,
            life: 0.2,
            color: stats.color,
          });
        }
        spellInst.usedThisRound = true;
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
      radius: 38,
      life: pentagramLife,
      maxLife: pentagramLife,
      color: stats.color,
    });

    spellInst.cooldownLeft = stats.cooldown;
    player.input.castSlot = -1;
  }

  listHostiles(player) {
    const list = [];
    for (const p of this.players.values()) {
      if (p.id !== player.id && p.alive) list.push({ ...p, _isPlayer: true, ref: p });
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

  damageHostile(hostile, amount, sourceId) {
    if (hostile._isPlayer) {
      this.damageEntity(hostile.ref, amount, sourceId, true, true);
    } else {
      this.damageEntity(hostile.ref, amount, sourceId, false, true);
    }
  }

  applyNova(origin, radius, damage, sourceId) {
    for (const p of this.players.values()) {
      if (p.id === sourceId || !p.alive) continue;
      if (dist(origin, p) <= radius) this.damageEntity(p, damage, sourceId, true, true);
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (dist(origin, m) <= radius) this.damageEntity(m, damage, sourceId, false, true);
    }
  }

  tick(dt) {
    this.events = [];

    for (const bot of this.bots) bot.update(dt);

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        if (this.round === 0) this.matchTime = 0;
        this.startRound();
      } else {
        this.broadcast({ type: 'countdown', seconds: Math.ceil(this.countdown) });
        this.broadcastState();
      }
      return;
    }

    if (this.phase === 'intermission') {
      this.intermissionTimer -= dt;
      this.matchTime += dt;
      if (this.intermissionTimer <= 0) {
        if (this.round >= CONFIG.MAX_ROUNDS) {
          this.endMatch(this.leadingPlayer());
        } else {
          this.startCountdown();
        }
      } else {
        this.broadcastState();
      }
      return;
    }

    if (this.phase === 'ended') return;

    if (this.phase === 'levelup') {
      // Pausa leve: ainda atualiza cooldowns visuais, sem combate
      this.matchTime += dt;
      for (const p of this.players.values()) {
        for (const s of p.spells) s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
        if (p.ultimate) p.ultimate.cooldownLeft = Math.max(0, p.ultimate.cooldownLeft - dt);
      }
      this.broadcastState();
      return;
    }

    if (this.phase !== 'playing') return;

    this.matchTime += dt;
    this.roundTime += dt;

    if (this.roundTime >= CONFIG.ROUND_DURATION) {
      const alive = [...this.players.values()].filter((p) => p.alive);
      if (alive.length === 1) {
        this.finishRound(alive[0]);
      } else if (alive.length > 1) {
        alive.sort((a, b) => b.hp - a.hp || b.score - a.score);
        const soleLead = alive[0].hp > alive[1].hp ? alive[0] : null;
        this.finishRound(soleLead);
      } else {
        this.finishRound(null);
      }
      return;
    }

    // XP passivo a cada segundo (configurável via XP_PER_SECOND no .env)
    if (CONFIG.XP_PER_SECOND > 0) {
      this.xpPassiveTimer += dt;
      while (this.xpPassiveTimer >= 1) {
        this.xpPassiveTimer -= 1;
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          this.grantXp(p, CONFIG.XP_PER_SECOND, 'passive');
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

    // Arena shrink (quantidade e intervalo via .env)
    if (
      this.shrinksDone < CONFIG.ARENA_SHRINK_TIMES &&
      this.roundTime >= this.nextShrinkAt
    ) {
      this.arenaRadius = Math.max(
        CONFIG.ARENA_MIN_RADIUS,
        this.arenaRadius - CONFIG.ARENA_SHRINK_AMOUNT
      );
      this.shrinksDone += 1;
      if (this.shrinksDone < CONFIG.ARENA_SHRINK_TIMES) {
        this.nextShrinkAt += CONFIG.ARENA_SHRINK_INTERVAL;
      }
      this.pushEvent({ type: 'arena_shrink', radius: this.arenaRadius });
    }

    // Spawns
    this.monsterSpawnTimer -= dt;
    if (this.monsterSpawnTimer <= 0) {
      this.spawnMonster();
      this.monsterSpawnTimer = CONFIG.MONSTER_SPAWN_INTERVAL;
    }

    // Players
    for (const p of this.players.values()) {
      if (!p.alive) continue;

      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.slowTimer = Math.max(0, p.slowTimer - dt);
      if (p.slowTimer <= 0) p.slow = 0;
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);
      if (p.shieldTimer <= 0) p.shield = 0;
      p.dashCooldown = Math.max(0, p.dashCooldown - dt);
      p.dashBuffer = Math.max(0, (p.dashBuffer || 0) - dt);

      for (const s of p.spells) s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
      if (p.ultimate) p.ultimate.cooldownLeft = Math.max(0, p.ultimate.cooldownLeft - dt);

      this.tryStartDash(p);

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
        const speed = CONFIG.PLAYER_SPEED * (1 - p.slow);
        applyInertia(p, mx * speed, my * speed, CONFIG.PLAYER_INERTIA, dt);
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

      if (p.input.castSlot >= 0) {
        this.castSpell(p, p.input.castSlot);
      }
    }

    // Monsters AI
    for (const m of this.monsters) {
      if (!m.alive) continue;
      m.stunTimer = Math.max(0, (m.stunTimer || 0) - dt);
      m.attackCd = Math.max(0, m.attackCd - dt);
      if (m.stunTimer > 0) {
        m.vx = 0;
        m.vy = 0;
        m.knockbackTimer = 0;
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
        continue;
      }

      let nearest = null;
      let nearestD = CONFIG.MONSTER_AGGRO_RANGE;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const d = dist(m, p);
        if (d < nearestD) {
          nearestD = d;
          nearest = p;
        }
      }

      const meleeRange =
        CONFIG.MONSTER_ATTACK_RANGE +
        Math.max(0, (m.radius || CONFIG.MONSTER_RADIUS) - CONFIG.MONSTER_RADIUS);

      let targetVx = 0;
      let targetVy = 0;
      if (nearest) {
        const dx = nearest.x - m.x;
        const dy = nearest.y - m.y;
        const len = Math.hypot(dx, dy) || 1;

        if (m.attack === 'ranged') {
          const shootRange = m.range || 180;
          const prefer = m.preferRange || shootRange * 0.7;
          if (nearestD > shootRange) {
            targetVx = (dx / len) * m.speed;
            targetVy = (dy / len) * m.speed;
          } else if (nearestD < prefer * 0.65) {
            // Recua um pouco para manter distância de tiro
            targetVx = (-dx / len) * m.speed * 0.7;
            targetVy = (-dy / len) * m.speed * 0.7;
          }
          if (nearestD <= shootRange && m.attackCd <= 0) {
            this.monsterShoot(m, nearest);
          }
        } else if (nearestD > meleeRange) {
          targetVx = (dx / len) * m.speed;
          targetVy = (dy / len) * m.speed;
        } else if (m.attackCd <= 0) {
          this.damageEntity(nearest, m.damage, null, true, true);
          m.attackCd = m.attackCooldown || CONFIG.MONSTER_ATTACK_COOLDOWN;
        }
      }

      applyInertia(m, targetVx, targetVy, CONFIG.MONSTER_INERTIA, dt);
      m.x += m.vx * dt;
      this.resolveRockCollision(m, m.radius || CONFIG.MONSTER_RADIUS);
      m.y += m.vy * dt;
      this.resolveRockCollision(m, m.radius || CONFIG.MONSTER_RADIUS);
    }

    // Projectiles
    for (const proj of this.projectiles) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;
      let hit = false;
      const fromMonster = proj.team === 'monster';
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (!fromMonster && p.id === proj.ownerId) continue;
        if (dist(proj, p) <= proj.radius + CONFIG.PLAYER_RADIUS) {
          // Dano de monstro não conta como kill de jogador
          const sourceId = fromMonster ? null : proj.ownerId;
          this.damageEntity(p, proj.damage, sourceId, true, true);
          this.applyProjectileKnockback(p, proj);
          if (proj.slow) {
            p.slow = Math.max(p.slow, proj.slow);
            p.slowTimer = Math.max(p.slowTimer, proj.slowDuration);
          }
          hit = true;
          break;
        }
      }
      if (!hit && !fromMonster) {
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (dist(proj, m) <= proj.radius + m.radius) {
            this.damageEntity(m, proj.damage, proj.ownerId, false, true);
            this.applyProjectileKnockback(m, proj);
            hit = true;
            break;
          }
        }
      }
      if (hit) proj.life = 0;
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);

    // AoEs
    for (const aoe of this.aoes) {
      aoe.life -= dt;
      aoe.tickAcc += dt;
      while (aoe.tickAcc >= aoe.tick) {
        aoe.tickAcc -= aoe.tick;
        for (const p of this.players.values()) {
          if (!p.alive || p.id === aoe.ownerId) continue;
          if (dist(aoe, p) <= aoe.radius) this.damageEntity(p, aoe.damage, aoe.ownerId, true, true);
        }
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (dist(aoe, m) <= aoe.radius) this.damageEntity(m, aoe.damage, aoe.ownerId, false, true);
        }
      }
    }
    this.aoes = this.aoes.filter((a) => a.life > 0);

    // Effects lifetime
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);

    this.broadcastState();
  }

  pushEvent(ev) {
    this.events.push(ev);
  }

  lobbySnapshot() {
    return {
      matchId: this.id,
      phase: this.phase,
      minPlayers: CONFIG.MIN_PLAYERS,
      maxPlayers: CONFIG.MAX_PLAYERS,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        wizardType: p.wizardType,
        color: p.color,
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
      shield: p.shield,
      slow: p.slow,
      stun: p.stunTimer > 0,
      dashing: p.dashTimer > 0,
      dashDx: p.dashDx,
      dashDy: p.dashDy,
      dashCooldown: +Math.max(0, p.dashCooldown).toFixed(2),
      kills: p.kills,
      deaths: p.deaths,
      score: p.score,
      pendingLevelUps: p.pendingLevelUps,
      spellChoices: p.spellChoices,
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
      maxRounds: CONFIG.MAX_ROUNDS,
      matchTime: +this.matchTime.toFixed(2),
      matchDuration: CONFIG.MATCH_DURATION,
      roundTime: +this.roundTime.toFixed(2),
      roundDuration: CONFIG.ROUND_DURATION,
      countdown: this.countdown,
      arena: {
        x: CONFIG.ARENA_CENTER_X,
        y: CONFIG.ARENA_CENTER_Y,
        radius: this.arenaRadius,
        nextShrinkAt: this.nextShrinkAt,
        shrinksDone: this.shrinksDone,
        shrinkTimes: CONFIG.ARENA_SHRINK_TIMES,
      },
      rocks: this.rocks,
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
        radius: m.radius,
        color: m.color,
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
        team: p.team || 'player',
      })),
      aoes: this.aoes.map((a) => ({
        entityId: a.entityId,
        x: a.x,
        y: a.y,
        radius: a.radius,
        color: a.color,
        life: a.life,
      })),
      effects: this.effects,
      events: this.events,
      winnerId: this.winnerId,
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
