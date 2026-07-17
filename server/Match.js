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
      input: { up: false, down: false, left: false, right: false, aimX: 0, aimY: 0, castSlot: -1 },
      shield: 0,
      shieldTimer: 0,
      slow: 0,
      slowTimer: 0,
      stunTimer: 0,
      phoenixReady: false,
      kills: 0,
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

  startCountdown() {
    this.phase = 'countdown';
    this.countdown = 3;
    if (!this.rocks.length) this.generateRocks();
    this.broadcast({ type: 'countdown', seconds: this.countdown });
    this.broadcastState(true);
    this.ensureLoop();
  }

  startRound() {
    this.round += 1;
    this.phase = 'playing';
    this.roundTime = 0;
    this.arenaRadius = CONFIG.ARENA_START_RADIUS;
    this.nextShrinkAt = CONFIG.ARENA_SHRINK_INTERVAL;
    this.monsterSpawnTimer = 1;
    this.monsters = [];
    this.projectiles = [];
    this.aoes = [];
    this.events = [];
    this.winnerId = null;

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
    p.input = {
      up: !!input.up,
      down: !!input.down,
      left: !!input.left,
      right: !!input.right,
      aimX: Number(input.aimX) || 0,
      aimY: Number(input.aimY) || 0,
      castSlot: Number.isInteger(input.castSlot) ? input.castSlot : -1,
    };
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
    player.score += amount;
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

  damageEntity(target, amount, sourcePlayerId = null, isPlayer = true) {
    if (!target.alive) return false;
    let dmg = amount;
    if (isPlayer && target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg <= 0) return false;
    target.hp -= dmg;
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

      const killer = sourcePlayerId ? this.players.get(sourcePlayerId) : null;
      if (killer && killer.id !== target.id) {
        killer.kills += 1;
        this.grantXp(killer, CONFIG.XP_PLAYER_KILL, 'player_kill');
        this.pushEvent({ type: 'player_kill', killerId: killer.id, victimId: target.id });
      } else {
        this.pushEvent({ type: 'player_death', playerId: target.id });
      }
      this.checkRoundEnd();
      return true;
    }

    // Monster
    const killer = sourcePlayerId ? this.players.get(sourcePlayerId) : null;
    if (killer) {
      killer.monsterKills += 1;
      this.grantXp(killer, CONFIG.XP_MONSTER, 'monster');
    }
    this.monsters = this.monsters.filter((m) => m.entityId !== target.entityId);
    this.pushEvent({ type: 'monster_kill', monsterId: target.entityId, killerId: sourcePlayerId });
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
      winner.score += 25;
      this.grantXp(winner, CONFIG.XP_ROUND_SURVIVE, 'round');
      this.pushEvent({ type: 'round_win', playerId: winner.id, round: this.round });
    }

    // Sobreviventes (se por algum motivo >1) também ganham XP de round — menor que kill de player
    for (const p of this.players.values()) {
      if (p.alive && p.id !== winner?.id) {
        this.grantXp(p, CONFIG.XP_ROUND_SURVIVE, 'round');
      }
    }

    if (this.matchTime >= CONFIG.MATCH_DURATION) {
      this.endMatch(winner);
      return;
    }

    this.phase = 'intermission';
    this.intermissionTimer = CONFIG.ROUND_INTERMISSION;
    this.broadcastState(true);
  }

  endMatch(winner) {
    this.phase = 'ended';
    this.winnerId = winner?.id || null;
    this.pushEvent({
      type: 'match_end',
      winnerId: this.winnerId,
      scores: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        kills: p.kills,
        level: p.level,
      })),
    });
    this.broadcastState(true);
    setTimeout(() => this.destroy(), 8000);
  }

  wipeAll() {
    for (const p of this.players.values()) {
      if (p.alive) {
        p.alive = false;
        p.hp = 0;
        this.pushEvent({ type: 'player_death', playerId: p.id, reason: 'time' });
      }
    }
    this.endMatch(null);
  }

  spawnMonster() {
    if (this.monsters.length >= CONFIG.MONSTER_MAX) return;
    const types = ['imp', 'slime', 'wraith'];
    const type = types[Math.floor(Math.random() * types.length)];
    const hpMul = type === 'wraith' ? 1.3 : type === 'slime' ? 1.5 : 1;
    const speedMul = type === 'imp' ? 1.25 : type === 'wraith' ? 1.1 : 0.8;

    let x = CONFIG.ARENA_CENTER_X;
    let y = CONFIG.ARENA_CENTER_Y;
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = this.arenaRadius * (0.35 + Math.random() * 0.5);
      x = CONFIG.ARENA_CENTER_X + Math.cos(angle) * r;
      y = CONFIG.ARENA_CENTER_Y + Math.sin(angle) * r;
      if (!this.isBlockedByRock(x, y, CONFIG.MONSTER_RADIUS)) break;
    }

    this.monsters.push({
      entityId: eid(),
      type,
      x,
      y,
      hp: Math.round(CONFIG.MONSTER_HP * hpMul),
      maxHp: Math.round(CONFIG.MONSTER_HP * hpMul),
      alive: true,
      speed: CONFIG.MONSTER_SPEED * speedMul,
      damage: CONFIG.MONSTER_DAMAGE,
      attackCd: 0,
      radius: CONFIG.MONSTER_RADIUS,
      color: type === 'imp' ? 0xff4422 : type === 'slime' ? 0x44ff66 : 0x8866ff,
    });
  }

  castSpell(player, slot) {
    if (!player.alive || player.stunTimer > 0) return;
    if (this.phase !== 'playing') return;

    let spellInst = null;
    if (slot >= 0 && slot < 4) {
      spellInst = player.spells[slot];
    } else if (slot === 4) {
      spellInst = player.ultimate;
    }
    if (!spellInst) return;
    if (spellInst.cooldownLeft > 0) return;
    if (spellInst.type === 'ultimate' || spellStats(spellInst.id)?.oncePerRound) {
      if (spellInst.usedThisRound) return;
      // Phoenix is passive — don't cast
      if (spellInst.id === 'phoenix') return;
    }

    const stats = spellStats(spellInst.id, spellInst.level);
    if (!stats) return;

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
        return;
    }

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
      this.damageEntity(hostile.ref, amount, sourceId, true);
    } else {
      this.damageEntity(hostile.ref, amount, sourceId, false);
    }
  }

  applyNova(origin, radius, damage, sourceId) {
    for (const p of this.players.values()) {
      if (p.id === sourceId || !p.alive) continue;
      if (dist(origin, p) <= radius) this.damageEntity(p, damage, sourceId, true);
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (dist(origin, m) <= radius) this.damageEntity(m, damage, sourceId, false);
    }
  }

  tick(dt) {
    this.events = [];

    for (const bot of this.bots) bot.update(dt);

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.matchTime = 0;
        this.startRound();
      } else {
        this.broadcast({ type: 'countdown', seconds: Math.ceil(this.countdown) });
      }
      return;
    }

    if (this.phase === 'intermission') {
      this.intermissionTimer -= dt;
      this.matchTime += dt;
      if (this.intermissionTimer <= 0) {
        if (this.matchTime >= CONFIG.MATCH_DURATION) {
          this.endMatch(this.winnerId ? this.players.get(this.winnerId) : null);
        } else {
          this.startRound();
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

    if (this.matchTime >= CONFIG.MATCH_DURATION) {
      this.wipeAll();
      return;
    }

    // Arena shrink
    if (this.roundTime >= this.nextShrinkAt && this.arenaRadius > CONFIG.ARENA_MIN_RADIUS) {
      this.arenaRadius = Math.max(CONFIG.ARENA_MIN_RADIUS, this.arenaRadius - CONFIG.ARENA_SHRINK_AMOUNT);
      this.nextShrinkAt += CONFIG.ARENA_SHRINK_INTERVAL;
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

      for (const s of p.spells) s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
      if (p.ultimate) p.ultimate.cooldownLeft = Math.max(0, p.ultimate.cooldownLeft - dt);

      if (p.stunTimer <= 0) {
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
        p.x += mx * speed * dt;
        this.resolveRockCollision(p, CONFIG.PLAYER_RADIUS);
        p.y += my * speed * dt;
        this.resolveRockCollision(p, CONFIG.PLAYER_RADIUS);
      }

      // Zone damage
      const fromCenter = dist(p, { x: CONFIG.ARENA_CENTER_X, y: CONFIG.ARENA_CENTER_Y });
      if (fromCenter > this.arenaRadius) {
        p.zoneDmgAcc += CONFIG.ZONE_DPS * dt;
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
      if (m.stunTimer > 0) continue;

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
      if (!nearest) continue;

      if (nearestD > CONFIG.MONSTER_ATTACK_RANGE) {
        const dx = nearest.x - m.x;
        const dy = nearest.y - m.y;
        const len = Math.hypot(dx, dy) || 1;
        m.x += (dx / len) * m.speed * dt;
        this.resolveRockCollision(m, m.radius || CONFIG.MONSTER_RADIUS);
        m.y += (dy / len) * m.speed * dt;
        this.resolveRockCollision(m, m.radius || CONFIG.MONSTER_RADIUS);
      } else if (m.attackCd <= 0) {
        this.damageEntity(nearest, m.damage, null, true);
        m.attackCd = CONFIG.MONSTER_ATTACK_COOLDOWN;
      }
    }

    // Projectiles
    for (const proj of this.projectiles) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;
      let hit = false;
      for (const p of this.players.values()) {
        if (!p.alive || p.id === proj.ownerId) continue;
        if (dist(proj, p) <= proj.radius + CONFIG.PLAYER_RADIUS) {
          this.damageEntity(p, proj.damage, proj.ownerId, true);
          if (proj.slow) {
            p.slow = Math.max(p.slow, proj.slow);
            p.slowTimer = Math.max(p.slowTimer, proj.slowDuration);
          }
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (dist(proj, m) <= proj.radius + m.radius) {
            this.damageEntity(m, proj.damage, proj.ownerId, false);
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
          if (dist(aoe, p) <= aoe.radius) this.damageEntity(p, aoe.damage, aoe.ownerId, true);
        }
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (dist(aoe, m) <= aoe.radius) this.damageEntity(m, aoe.damage, aoe.ownerId, false);
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
      kills: p.kills,
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
      matchTime: +this.matchTime.toFixed(2),
      matchDuration: CONFIG.MATCH_DURATION,
      roundTime: +this.roundTime.toFixed(2),
      arena: {
        x: CONFIG.ARENA_CENTER_X,
        y: CONFIG.ARENA_CENTER_Y,
        radius: this.arenaRadius,
        nextShrinkAt: this.nextShrinkAt,
      },
      rocks: this.rocks,
      players: [...this.players.values()].map((p) => this.serializePlayer(p)),
      monsters: this.monsters.map((m) => ({
        entityId: m.entityId,
        type: m.type,
        x: m.x,
        y: m.y,
        hp: m.hp,
        maxHp: m.maxHp,
        color: m.color,
      })),
      projectiles: this.projectiles.map((p) => ({
        entityId: p.entityId,
        x: p.x,
        y: p.y,
        color: p.color,
        radius: p.radius,
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
