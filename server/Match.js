import { CONFIG } from './config.js';
import { BotController } from './Bot.js';
import {
  applySpellChoice,
  createSpellInstance,
  innateUnlockLevel,
  isInnateSpell,
  isPlayerUsableSpell,
  rollSpellChoices,
  spellStats,
} from './spells.js';

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

function randomWizard() {
  return WIZARD_TYPES[Math.floor(Math.random() * WIZARD_TYPES.length)];
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
  constructor(id, io) {
    this.id = id;
    this.io = io;
    this.players = new Map(); // socketId -> player
    this.monsters = [];
    this.projectiles = [];
    this.aoes = [];
    this.effects = [];
    this.meteors = [];
    this.meteorTimer = 0;
    this.massHeals = [];
    this.massHealTimer = 0;
    this.kikoLaughTimer = 0;
    this.phase = 'lobby'; // lobby | countdown | playing | levelup | intermission | ended
    this.round = 0;
    this.matchTime = 0;
    this.roundTime = 0;
    this.arenaRadius = CONFIG.ARENA_START_RADIUS;
    this.nextShrinkAt = CONFIG.ARENA_SHRINK_INTERVAL;
    this.shrinksDone = 0;
    this.monsterSpawnTimer = 0;
    this.lastSpawnedMonsterType = null;
    this.countdown = 0;
    this.intermissionTimer = 0;
    this.winnerId = null;
    /** Após level-up no fim do round: null | { type: 'intermission' } | { type: 'endMatch', winner } */
    this.afterLevelUp = null;
    this.events = [];
    this.tickAcc = 0;
    this.running = false;
    this._interval = null;
    this.bots = [];
    this.rocks = [];
    this.xpPassiveTimer = 0;
    this.hpRegenTimer = 0;
    /** Overrides de admin (lobby); defaults vêm do .env. */
    this.botAiEnabled = CONFIG.BOT_AI_ENABLED;
    this.monsterSpawnEnabled = CONFIG.MONSTER_SPAWN_ENABLED;
    this.botLevelUpChoiceEnabled = CONFIG.BOT_LEVELUP_CHOICE_ENABLED;
    this.generateRocks();
  }

  setAdminSettings(payload = {}) {
    if (payload.botAiEnabled !== undefined) {
      this.botAiEnabled = !!payload.botAiEnabled;
    }
    if (payload.monsterSpawnEnabled !== undefined) {
      this.monsterSpawnEnabled = !!payload.monsterSpawnEnabled;
    }
    if (payload.botLevelUpChoiceEnabled !== undefined) {
      this.botLevelUpChoiceEnabled = !!payload.botLevelUpChoiceEnabled;
    }
    this.broadcastLobby();
    return {
      ok: true,
      botAiEnabled: this.botAiEnabled,
      monsterSpawnEnabled: this.monsterSpawnEnabled,
      botLevelUpChoiceEnabled: this.botLevelUpChoiceEnabled,
    };
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

  /** Segment–circle test so fast projectiles cannot tunnel through rocks. */
  projectileHitsRock(x0, y0, x1, y1, radius) {
    for (const rock of this.rocks) {
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
      /** Escudo inato (E) — liberado no nível 2. */
      barrierCooldown: 0,
      barrierBuffer: 0,
      /** Heal inato (H) — liberado no nível 3. */
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
      damageDealt: 0,
      critChance: CONFIG.PLAYER_CRIT_CHANCE,
      critMult: CONFIG.PLAYER_CRIT_MULT,
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
    this.effects = [];
    this.meteors = [];
    this.meteorTimer = 0;
    this.massHeals = [];
    this.massHealTimer = 0;
    this.kikoLaughTimer = 0;
    this.events = [];
    this.winnerId = null;
    this.generateRocks();
    if (CONFIG.MONSTER_PERSIST_ROUNDS && this.monsters.length) {
      for (const m of this.monsters) {
        const radius = m.radius || CONFIG.MONSTER_RADIUS;
        this.resolveRockCollision(m, radius);
        const dx = m.x - CONFIG.ARENA_CENTER_X;
        const dy = m.y - CONFIG.ARENA_CENTER_Y;
        const d = Math.hypot(dx, dy);
        const maxR = Math.max(0, this.arenaRadius - radius);
        if (d > maxR && d > 0) {
          m.x = CONFIG.ARENA_CENTER_X + (dx / d) * maxR;
          m.y = CONFIG.ARENA_CENTER_Y + (dy / d) * maxR;
          this.resolveRockCollision(m, radius);
        }
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
    this.scheduleNextMeteor();
    this.scheduleNextMassHeal();
    this.scheduleNextKikoLaugh();
    this.pushEvent({ type: 'round_start', round: this.round });
    this.broadcastState(true);
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

  scheduleNextKikoLaugh() {
    const min = CONFIG.KIKO_LAUGH_MIN_INTERVAL;
    const max = Math.max(min, CONFIG.KIKO_LAUGH_MAX_INTERVAL);
    this.kikoLaughTimer = min + Math.random() * (max - min);
  }

  tickKikoLaugh(dt) {
    if (CONFIG.KIKO_LAUGH_CHANCE <= 0) return;
    this.kikoLaughTimer -= dt;
    if (this.kikoLaughTimer > 0) return;
    if (Math.random() < CONFIG.KIKO_LAUGH_CHANCE) {
      // Um clip por vez: Kiko ou Seu Madruga (o client também bloqueia overlap).
      const type = Math.random() < 0.5 ? 'kiko_laugh' : 'madruga_nossa';
      this.pushEvent({ type });
    }
    this.scheduleNextKikoLaugh();
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
        this.damageEntity(m, meteor.damage, null, false, false);
      }
    }
  }

  tickMeteors(dt) {
    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0) {
      this.spawnMeteorEvent();
      this.scheduleNextMeteor();
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
      this.spawnMassHealEvent();
      this.scheduleNextMassHeal();
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

  /** Escudo inato (E) — liberado no nível 2. */
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

    player.shield = stats.shield;
    player.maxShield = stats.shield;
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

  /** Heal inato (H) — liberado no nível 3. */
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

    player.hp = Math.min(player.maxHp, player.hp + stats.heal);
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
    if (CONFIG.LEVELUP_CHOICE_TIMEOUT <= 0 || this.phase !== 'levelup') return;
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
      this.phase = 'intermission';
      this.intermissionTimer = CONFIG.ROUND_INTERMISSION;
      return;
    }
    if (next?.type === 'endMatch') {
      this.endMatch(next.winner || this.leadingPlayer());
      return;
    }
    this.phase = 'playing';
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
      this.phase = 'levelup';
      this.autoResolveBotLevelUpsIfDisabled();
      this.maybeResumeFromLevelUp();
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

    let crit = false;
    let dmg = amount;
    if (sourcePlayerId != null && amount > 0) {
      const attacker =
        this.players.get(sourcePlayerId) || this.findMonster(sourcePlayerId);
      if (attacker) {
        const chance = Math.max(0, Math.min(1, attacker.critChance ?? 0));
        const mult = Math.max(1, attacker.critMult ?? 1);
        if (chance > 0 && Math.random() < chance) {
          crit = true;
          dmg = Math.max(1, Math.round(amount * mult));
        }
      }
    }

    let absorbed = 0;
    if (isPlayer && target.shield > 0) {
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
    if (source) {
      const hpHit = dmg > 0 ? Math.min(dmg, target.hp) : 0;
      source.damageDealt += absorbed + hpHit;
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
    if (this.afterLevelUp) return; // round já encerrado, aguardando distribuição de habilidades
    if (this.phase !== 'playing' && this.phase !== 'levelup') return;
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length <= 1) {
      this.finishRound(alive[0] || null);
    }
  }

  finishRound(winner) {
    if (this.afterLevelUp || this.phase === 'intermission' || this.phase === 'ended') return;

    this.meteors = [];
    this.meteorTimer = 0;
    this.massHeals = [];
    this.massHealTimer = 0;
    this.kikoLaughTimer = 0;
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

    // Round só termina de verdade depois que ninguém tem pontos de habilidade pendentes
    if (this.playersNeedingSpellChoices().length > 0) {
      if (this.round >= CONFIG.MAX_ROUNDS) {
        this.beginPostRoundLevelUp({
          type: 'endMatch',
          winner: this.leadingPlayer() || winner,
        });
      } else {
        this.beginPostRoundLevelUp({ type: 'intermission' });
      }
      return;
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
          monsterKills: p.monsterKills || 0,
          damageDealt: Math.round(p.damageDealt || 0),
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

  monsterTypeDefs() {
    const common = CONFIG.MONSTER_WEIGHT_COMMON;
    const boss = CONFIG.MONSTER_WEIGHT_BOSS;
    return {
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
        weight: common,
      },
      slime: {
        hpMul: 1.5,
        speedMul: 0.8,
        dmgMul: 1,
        radius: 16,
        color: 0x44ff66,
        attack: 'melee',
        weight: common,
      },
      wraith: {
        hpMul: 1.3,
        speedMul: 1.1,
        dmgMul: 1,
        radius: 14,
        color: 0x8866ff,
        attack: 'melee',
        weight: common,
      },
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
        weight: common,
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
        weight: common,
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
        weight: common,
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
        weight: common,
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
        weight: common,
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
        weight: common,
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
        weight: common,
      },
      // Nimble forest archer
      elf: {
        hpMul: 0.9,
        speedMul: 1.25,
        dmgMul: 1.1,
        radius: 13,
        color: 0x6bbf59,
        attack: 'ranged',
        projectile: 'arrow',
        range: 240,
        preferRange: 170,
        projectileSpeed: 380,
        projectileRadius: 4,
        projectileColor: 0xc8e6a0,
        attackCooldown: 1.05,
        weight: common,
      },
      // Beholder — olho arcano que lança Arc Lightning
      beholder: {
        hpMul: 2.4,
        speedMul: 0.55,
        dmgMul: 1.25,
        radius: 20,
        color: 0x9b59b6,
        attack: 'caster',
        spells: ['arc_lightning'],
        range: 170,
        preferRange: 130,
        attackCooldown: 1.35,
        weight: boss,
      },
      // Dragão — Firebreath / Firebolt + Flame Nova de perto
      dragon: {
        hpMul: 3.8,
        speedMul: 0.5,
        dmgMul: 1.55,
        radius: 28,
        color: 0xe74c3c,
        attack: 'caster',
        spells: ['firebreath', 'firebolt', 'flame_nova'],
        range: 300,
        preferRange: 170,
        projectileSpeed: 480,
        projectileRadius: 10,
        projectileColor: 0xff5533,
        attackCooldown: 1.1,
        novaRadius: 120,
        novaCooldown: 4.2,
        weight: boss,
      },
      // Lich — morto-vivo arcano que lança Ice Shard
      lich: {
        hpMul: 2.1,
        speedMul: 0.6,
        dmgMul: 1.15,
        radius: 16,
        color: 0x66ccff,
        attack: 'caster',
        spells: ['ice_shard'],
        range: 280,
        preferRange: 160,
        projectileSpeed: 460,
        projectileRadius: 9,
        projectileColor: 0x66ccff,
        attackCooldown: 1.25,
        weight: boss,
      },
      // Elemental de fogo — chama viva: Firebreath / Firebolt + Flame Nova
      fire_elemental: {
        hpMul: 1.8,
        speedMul: 1.1,
        dmgMul: 1.3,
        radius: 16,
        color: 0xff6622,
        attack: 'caster',
        spells: ['firebreath', 'firebolt', 'flame_nova'],
        range: 250,
        preferRange: 145,
        projectileSpeed: 440,
        projectileRadius: 9,
        projectileColor: 0xff5533,
        attackCooldown: 1.15,
        novaRadius: 105,
        novaCooldown: 4.0,
        weight: common,
      },
      // Demônio — Electric Bolt + Electric Storm (raios do céu)
      demon: {
        hpMul: 2.2,
        speedMul: 0.85,
        dmgMul: 1.4,
        radius: 28,
        color: 0x8b1a2b,
        attack: 'caster',
        spells: ['electric_bolt', 'electric_storm'],
        range: 260,
        preferRange: 150,
        attackCooldown: 1.2,
        /** Reusa novaRadius/novaCooldown para a tempestade elétrica. */
        novaRadius: 130,
        novaCooldown: 4.5,
        weight: boss,
      },
    };
  }

  /** Sorteia tipo com pesos + diversidade (evita repetir tipos já vivos / último spawn). */
  pickMonsterType(types) {
    const diversity = Math.max(0, CONFIG.MONSTER_SPAWN_DIVERSITY);
    const aliveCount = {};
    for (const m of this.monsters) {
      if (!m.alive) continue;
      aliveCount[m.type] = (aliveCount[m.type] || 0) + 1;
    }

    const ids = Object.keys(types);
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

  /**
   * Nível de spawn: lv máximo da partida ±2 (mín. 1).
   * Ex.: max 5 → monstro entre 3 e 7.
   */
  rollMonsterSpawnLevel() {
    const maxLv = this.matchMaxPlayerLevel();
    const delta = Math.floor(Math.random() * 5) - 2; // -2..+2
    return Math.max(1, maxLv + delta);
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

  spawnMonster() {
    if (this.monsters.length >= CONFIG.MONSTER_MAX) return;
    const types = this.monsterTypeDefs();
    const type = this.pickMonsterType(types);
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

    const monster = {
      entityId: eid(),
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: Math.round(CONFIG.MONSTER_HP * def.hpMul),
      maxHp: Math.round(CONFIG.MONSTER_HP * def.hpMul),
      alive: true,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(2) - xpForLevel(1),
      speed: CONFIG.MONSTER_SPEED * def.speedMul,
      damage: Math.round(CONFIG.MONSTER_DAMAGE * def.dmgMul),
      critChance: CONFIG.MONSTER_CRIT_CHANCE,
      critMult: CONFIG.MONSTER_CRIT_MULT,
      attackCd: 0,
      attack: def.attack || 'melee',
      spells: def.spells || null,
      projectile: def.projectile || null,
      range: def.range || CONFIG.MONSTER_ATTACK_RANGE,
      preferRange: def.preferRange || 0,
      projectileSpeed: def.projectileSpeed || 0,
      projectileRadius: def.projectileRadius || 6,
      projectileColor: def.projectileColor || def.color,
      attackCooldown: def.attackCooldown || CONFIG.MONSTER_ATTACK_COOLDOWN,
      novaRadius: def.novaRadius || 110,
      novaCooldown: def.novaCooldown || 4,
      novaCd: 0,
      radius: def.radius,
      color: def.color,
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
    };
    this.scaleMonsterToLevel(monster, this.rollMonsterSpawnLevel());
    this.monsters.push(monster);
  }

  isPlayerEntity(target) {
    return !!(target?.id && this.players.has(target.id));
  }

  /** Aplica/renova veneno (duração sempre no máximo). */
  applyPoison(target, ownerId, damage, tick, duration) {
    if (!target?.alive) return;
    const wasPoisoned = (target.poisonTimer || 0) > 0;
    const dmg = Math.max(0, Math.round(Number(damage) || 0));
    target.poisonTimer = Math.max(0.05, Number(duration) || 5);
    target.poisonDamage = dmg;
    target.poisonTick = Math.max(0.05, Number(tick) || 1);
    target.poisonOwnerId = ownerId;
    // Renovar não pausa o DoT; na 1ª aplicação causa tick imediato
    if (!wasPoisoned) {
      target.poisonTickAcc = 0;
      if (dmg > 0) this.damageEntity(target, dmg, ownerId, this.isPlayerEntity(target), true);
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
      if (dmg > 0) this.damageEntity(target, dmg, target.poisonOwnerId, isPlayer, true);
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
    const wasBurning = (target.burnTimer || 0) > 0;
    const dmg = Math.max(0, Math.round(Number(damage) || 0));
    target.burnTimer = Math.max(0.05, Number(duration) || 10);
    target.burnDamage = dmg;
    target.burnTick = Math.max(0.05, Number(tick) || 1);
    target.burnOwnerId = ownerId;
    // Renovar não pausa o DoT; na 1ª aplicação causa tick imediato
    if (!wasBurning) {
      target.burnTickAcc = 0;
      if (dmg > 0) this.damageEntity(target, dmg, ownerId, this.isPlayerEntity(target), true);
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
      if (dmg > 0) this.damageEntity(target, dmg, target.burnOwnerId, isPlayer, true);
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

    for (const p of this.players.values()) {
      if (!p.alive || p.id === ownerId || p.entityId === ownerId) continue;
      if (dist(origin, p) <= radius + CONFIG.PLAYER_RADIUS) {
        this.damageEntity(p, burst, ownerId, true, true);
        this.applyBurn(p, ownerId, burnDmgSafe, burnTickSafe, burnDurationSafe);
      }
    }
    if (hitMonsters) {
      for (const m of this.monsters) {
        if (!m.alive) continue;
        if (dist(origin, m) <= radius + (m.radius || CONFIG.MONSTER_RADIUS)) {
          this.damageEntity(m, burst, ownerId, false, true);
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
      life: 0.55,
      maxLife: 0.55,
      color: stats.color || 0xff8844,
    });
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

  /** Magias usadas por monstros caster (beholder / dragão / lich / demon). */
  monsterCast(monster, spellId, target) {
    const stats = spellStats(spellId, 1);
    if (!stats) return;

    switch (spellId) {
      case 'arc_lightning': {
        const range = stats.range || 160;
        if (!target || dist(monster, target) > range) return;
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
      case 'electric_bolt': {
        const range = stats.range || 240;
        if (!target || dist(monster, target) > range) return;
        const dmg = Math.round(monster.damage * 1.1);
        this.damageEntity(target, dmg, monster.entityId, true, true);
        this.pushSkyLightning(target.x, target.y, stats.color, {
          spellId: 'electric_bolt',
          branches: 5,
          skyHeight: 320 + Math.random() * 60,
        });
        this.spawnSpellImpact(target.x, target.y, 'electric_bolt', stats.color, 30);
        monster.attackCd = monster.attackCooldown || stats.cooldown || 1.35;
        break;
      }
      case 'electric_storm': {
        const radius = monster.novaRadius || stats.radius || 130;
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
      case 'ice_shard': {
        if (!target) return;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = monster.projectileSpeed || stats.speed || 480;
        const range = monster.range || stats.range || 300;
        const isIce = spellId === 'ice_shard';
        this.projectiles.push({
          entityId: eid(),
          ownerId: monster.entityId,
          team: 'monster',
          kind: isIce ? 'ice_shard' : 'fireball',
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
        });
        monster.attackCd = monster.attackCooldown || (isIce ? 1.25 : 1.1);
        break;
      }
      case 'flame_nova': {
        const radius = monster.novaRadius || stats.radius || 110;
        this.applyFlameNova(
          monster,
          monster.entityId,
          { ...stats, radius },
          Math.round(monster.damage * 1.15),
          false
        );
        monster.attackCd = (monster.attackCooldown || 1.1) * 1.2;
        monster.novaCd = monster.novaCooldown || 4;
        break;
      }
      case 'firebreath': {
        if (!target) return;
        const range = stats.range || 170;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        if (len > range * 1.15) return;
        const dirX = dx / len;
        const dirY = dy / len;
        const halfAngle = ((stats.coneAngle || 38) * Math.PI) / 180;
        const cosMin = Math.cos(halfAngle);
        const dmg = Math.round(monster.damage * 1.35);
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const pdx = p.x - monster.x;
          const pdy = p.y - monster.y;
          const pd = Math.hypot(pdx, pdy);
          if (pd > range) continue;
          if (pd < 0.001) {
            this.damageEntity(p, dmg, monster.entityId, true, true);
            continue;
          }
          const dot = (pdx / pd) * dirX + (pdy / pd) * dirY;
          if (dot >= cosMin) {
            this.damageEntity(p, dmg, monster.entityId, true, true);
          }
        }
        this.effects.push({
          type: 'firebreath',
          spellId: 'firebreath',
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
      default:
        return;
    }
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
    }

    const stats = spellStats(spellInst.id, spellInst.level);
    if (!stats || !isPlayerUsableSpell(spellInst.id)) {
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
      case 'skull_bolt': {
        const kind =
          spellInst.id === 'firebolt'
            ? 'fireball'
            : spellInst.id === 'ice_shard'
              ? 'ice_shard'
              : 'skull_bolt';
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
          radius: stats.radius,
          life: stats.range / stats.speed,
          slow: stats.slow || 0,
          slowDuration: stats.slowDuration || 0,
          color: stats.color,
        });
        break;
      }
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
        this.aoes.push({
          entityId: eid(),
          ownerId: player.id,
          x: player.x + dirX * 80,
          y: player.y + dirY * 80,
          radius: stats.radius || 90,
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
          radius: stats.radius,
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
        this.applyNova(player, stats.radius, stats.damage, player.id);
        this.effects.push({
          type: 'apocalypse',
          x: player.x,
          y: player.y,
          radius: stats.radius,
          life: 1.35,
          maxLife: 1.35,
          color: stats.color,
          seed: (Math.random() * 1e9) | 0,
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
          type: 'freeze',
          x: player.x,
          y: player.y,
          radius: stats.radius,
          life: 1.1,
          maxLife: 1.1,
          color: stats.color,
          seed: (Math.random() * 1e9) | 0,
        });
        spellInst.usedThisRound = true;
        break;
      case 'storm_call': {
        const hostiles = this.listHostiles(player).filter((h) => dist(player, h) <= stats.range);
        this.effects.push({
          type: 'storm',
          x: player.x,
          y: player.y,
          radius: stats.range,
          life: 0.85,
          maxLife: 0.85,
          color: stats.color,
          seed: (Math.random() * 1e9) | 0,
        });
        for (const h of hostiles) {
          this.damageHostile(h, stats.damage, player.id);
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
      radius: 30.4,
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

  spawnSpellImpact(x, y, spellId, color, radius = 24) {
    this.effects.push({
      type: 'impact',
      spellId: spellId || 'orb',
      x,
      y,
      radius,
      life: 0.4,
      maxLife: 0.4,
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
      // Pausa: combate travado até todos escolherem ou o timeout expirar
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
    if (this.monsterSpawnEnabled) {
      this.monsterSpawnTimer -= dt;
      if (this.monsterSpawnTimer <= 0) {
        const count = CONFIG.MONSTER_SPAWN_COUNT;
        for (let i = 0; i < count; i++) this.spawnMonster();
        this.monsterSpawnTimer = CONFIG.MONSTER_SPAWN_INTERVAL;
      }
    }

    // Eventos aleatórios: meteoro (dano) e mass heal (cura)
    this.tickMeteors(dt);
    this.tickMassHeals(dt);
    // Vozes aleatórias (Kiko / Seu Madruga) no client
    this.tickKikoLaugh(dt);

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
      m.novaCd = Math.max(0, (m.novaCd || 0) - dt);
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
        } else if (m.attack === 'caster') {
          const spells = m.spells || [];
          const shootRange = m.range || 180;
          const prefer = m.preferRange || shootRange * 0.7;
          const novaR = m.novaRadius || 110;
          const lightningR = spellStats('arc_lightning')?.range || 160;

          if (nearestD > shootRange) {
            targetVx = (dx / len) * m.speed;
            targetVy = (dy / len) * m.speed;
          } else if (
            (spells.includes('flame_nova') || spells.includes('electric_storm')) &&
            nearestD < novaR * 0.45 &&
            (m.novaCd || 0) > 0
          ) {
            // Nova/storm em CD e jogador colado — recua
            targetVx = (-dx / len) * m.speed * 0.75;
            targetVy = (-dy / len) * m.speed * 0.75;
          } else if (nearestD < prefer * 0.6) {
            targetVx = (-dx / len) * m.speed * 0.65;
            targetVy = (-dy / len) * m.speed * 0.65;
          }

          if (m.attackCd <= 0) {
            let spell = null;
            const breathRange = spellStats('firebreath')?.range || 170;
            const boltRange = spellStats('electric_bolt')?.range || 240;
            const stormR = m.novaRadius || spellStats('electric_storm')?.radius || novaR;
            if (
              spells.includes('electric_storm') &&
              nearestD <= stormR &&
              (m.novaCd || 0) <= 0
            ) {
              spell = 'electric_storm';
            } else if (
              spells.includes('flame_nova') &&
              nearestD <= novaR &&
              (m.novaCd || 0) <= 0
            ) {
              spell = 'flame_nova';
            } else if (spells.includes('firebreath') && nearestD <= breathRange) {
              spell = 'firebreath';
            } else if (spells.includes('electric_bolt') && nearestD <= boltRange) {
              spell = 'electric_bolt';
            } else if (spells.includes('arc_lightning') && nearestD <= lightningR) {
              spell = 'arc_lightning';
            } else if (spells.includes('ice_shard') && nearestD <= shootRange) {
              spell = 'ice_shard';
            } else if (spells.includes('firebolt') && nearestD <= shootRange) {
              spell = 'firebolt';
            }
            if (spell) this.monsterCast(m, spell, nearest);
          }
        } else if (nearestD > meleeRange) {
          targetVx = (dx / len) * m.speed;
          targetVy = (dy / len) * m.speed;
        } else if (m.attackCd <= 0) {
          this.damageEntity(nearest, m.damage, m.entityId, true, true);
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
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (!fromMonster && p.id === proj.ownerId) continue;
          if (dist(proj, p) <= proj.radius + CONFIG.PLAYER_RADIUS) {
            this.damageEntity(p, proj.damage, proj.ownerId, true, true);
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
      }
      if (hit || ended) {
        const spellId = proj.spellId || proj.kind || 'orb';
        const impactR =
          spellId === 'firebolt' || spellId === 'fireball'
            ? 30
            : spellId === 'ice_shard'
              ? 26
              : spellId === 'skull_bolt'
                ? 28
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
      const aoeR = Number(aoe.radius) || 0;
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
      botAiEnabled: this.botAiEnabled,
      monsterSpawnEnabled: this.monsterSpawnEnabled,
      botLevelUpChoiceEnabled: this.botLevelUpChoiceEnabled,
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
      score: p.score,
      damageDealt: Math.round(p.damageDealt || 0),
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
        level: m.level || 1,
        xp: m.xp || 0,
        xpToNext: m.xpToNext || 0,
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
        spellId: p.spellId || p.kind || 'orb',
        team: p.team || 'player',
      })),
      aoes: this.aoes.map((a) => ({
        entityId: a.entityId,
        x: a.x,
        y: a.y,
        radius: a.radius,
        color: a.color,
        life: a.life,
        maxLife: a.maxLife || a.life,
        spellId: a.spellId || null,
      })),
      effects: [
        ...this.effects,
        ...this.serializeMeteorEffects(),
        ...this.serializeMassHealEffects(),
      ],
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
