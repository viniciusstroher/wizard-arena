/** IA aprimorada: defensiva, movimento circular, esquiva de projéteis/AOE, tiros precisos. */

import { CONFIG } from './config.js';

const PLAYER_R = CONFIG.PLAYER_RADIUS || 14;
const DODGE_MARGIN = 28;

function dirsToward(px, py, tx, ty, deadzone = 10) {
  const dx = tx - px;
  const dy = ty - py;
  return {
    up: dy < -deadzone,
    down: dy > deadzone,
    left: dx < -deadzone,
    right: dx > deadzone,
  };
}

function dirsAway(px, py, fx, fy, deadzone = 8) {
  let dx = px - fx;
  let dy = py - fy;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    const a = Math.random() * Math.PI * 2;
    dx = Math.cos(a);
    dy = Math.sin(a);
  }
  return {
    up: dy < -deadzone,
    down: dy > deadzone,
    left: dx < -deadzone,
    right: dx > deadzone,
  };
}

export class BotController {
  constructor(match, playerId) {
    this.match = match;
    this.playerId = playerId;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.retargetTimer = 0;
    this.target = null;
    this.levelUpThinkTimer = 0;
    this.levelUpChoiceSetId = null;
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.orbitRadius = 0;
    this.strafeSwitchTimer = 0;
  }

  idleInput(player) {
    this.match.setInput(this.playerId, {
      up: false,
      down: false,
      left: false,
      right: false,
      aimX: player.x,
      aimY: player.y,
      castSlot: -1,
      barrier: false,
      mend: false,
      blink: false,
    });
  }

  pickRandomSpell(player) {
    if (!player.spellChoices?.length || player.pendingLevelUps <= 0) return;
    const index = Math.floor(Math.random() * player.spellChoices.length);
    const choice = player.spellChoices[index];
    this.match.chooseSpell(this.playerId, {
      index,
      spellId: choice.spellId,
      kind: choice.kind,
      fromLevel: choice.fromLevel,
      choiceSetId: player.choiceSetId,
    });
    this.levelUpChoiceSetId = null;
  }

  /** Meteoro em aviso que ainda pode acertar o bot (com margem de fuga). */
  findThreateningMeteor(player) {
    const margin = 36;
    let best = null;
    let bestD = Infinity;
    for (const m of this.match.meteors || []) {
      if (m.phase !== 'warn') continue;
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      const dangerR = m.radius + PLAYER_R + margin;
      if (d <= dangerR && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  /** Projétil que está vindo em direção ao bot. */
  findThreateningProjectile(player) {
    let best = null;
    let bestTime = Infinity;
    for (const proj of this.match.projectiles || []) {
      if (proj.team !== 'monster') continue;
      const px = proj.x;
      const py = proj.y;
      const vx = proj.vx || 0;
      const vy = proj.vy || 0;
      const speed = Math.hypot(vx, vy);
      if (speed < 1) continue;

      const dx = player.x - px;
      const dy = player.y - py;
      const t = (dx * vx + dy * vy) / (speed * speed);
      const cpX = px + vx * t;
      const cpY = py + vy * t;
      const closestDist = Math.hypot(player.x - cpX, player.y - cpY);
      const hitR = (proj.radius || 6) + PLAYER_R + DODGE_MARGIN;

      if (closestDist <= hitR && t > -0.2 && t < 1.5) {
        if (t < bestTime) {
          best = proj;
          bestTime = t;
        }
      }
    }
    return best;
  }

  /** AOE perigoso sobrando sobre o bot. */
  findThreateningAOE(player) {
    let best = null;
    let bestD = Infinity;
    for (const aoe of this.match.aoes || []) {
      const d = Math.hypot(aoe.x - player.x, aoe.y - player.y);
      const dangerR = (aoe.radius || 40) + PLAYER_R;
      if (d <= dangerR && d < bestD) {
        best = aoe;
        bestD = d;
      }
    }
    return best;
  }

  /** Mass heal em aviso — prioriza a mais próxima. */
  findMassHealTarget(player) {
    let best = null;
    let bestD = Infinity;
    for (const h of this.match.massHeals || []) {
      if (h.phase !== 'warn') continue;
      const d = Math.hypot(h.x - player.x, h.y - player.y);
      if (d < bestD) {
        best = h;
        bestD = d;
      }
    }
    return best;
  }

  /** Névoa de cooldown em aviso — prioriza a mais próxima. */
  findCooldownMistTarget(player) {
    let best = null;
    let bestD = Infinity;
    for (const m of this.match.cooldownMists || []) {
      if (m.phase !== 'warn') continue;
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  /** Ventania em aviso — prioriza a mais próxima. */
  findGaleTarget(player) {
    let best = null;
    let bestD = Infinity;
    for (const g of this.match.gales || []) {
      if (g.phase !== 'warn') continue;
      const d = Math.hypot(g.x - player.x, g.y - player.y);
      if (d < bestD) {
        best = g;
        bestD = d;
      }
    }
    return best;
  }

  /** Saco de loot ou moeda mais próximo dentro do alcance de busca. */
  findNearestPickup(player, maxDist = 220) {
    let best = null;
    let bestD = Infinity;
    for (const bag of this.match.lootBags || []) {
      const d = Math.hypot(bag.x - player.x, bag.y - player.y);
      if (d <= maxDist && d < bestD) {
        best = bag;
        bestD = d;
      }
    }
    for (const coin of this.match.coins || []) {
      const d = Math.hypot(coin.x - player.x, coin.y - player.y);
      if (d <= maxDist && d < bestD) {
        best = coin;
        bestD = d;
      }
    }
    return best;
  }

  /** Mira com lead: antecipa posição futura do alvo baseado no movimento. */
  predictAim(player, target) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const d = Math.hypot(dx, dy) || 1;

    const SPELL_SPEED = 520;
    const travelTime = d / SPELL_SPEED;
    const leadTime = Math.min(travelTime, 0.35);

    let leadX = target.x;
    let leadY = target.y;
    if (target.vx !== undefined || target.vy !== undefined) {
      const tvx = target.vx || 0;
      const tvy = target.vy || 0;
      const targetSpeed = Math.hypot(tvx, tvy);
      if (targetSpeed > 5) {
        const clamped = Math.min(leadTime * targetSpeed, targetSpeed * 0.6);
        leadX += (tvx / (targetSpeed || 1)) * clamped;
        leadY += (tvy / (targetSpeed || 1)) * clamped;
      }
    }

    return { aimX: leadX, aimY: leadY };
  }

  update(dt) {
    const player = this.match.players.get(this.playerId);
    if (!player || !player.alive) return;
    if (player.spellChoices?.length && player.pendingLevelUps > 0) {
      const liveChoice =
        this.match.phase === 'playing' ||
        this.match.phase === 'intermission' ||
        this.match.phase === 'countdown';
      const pausedChoice = this.match.phase === 'levelup';

      if (pausedChoice || liveChoice) {
        if (!this.match.botLevelUpChoiceEnabled) {
          this.pickRandomSpell(player);
        } else {
          if (this.levelUpChoiceSetId !== player.choiceSetId) {
            this.levelUpChoiceSetId = player.choiceSetId;
            this.levelUpThinkTimer = 1.8 + Math.random() * 2.4;
          }
          this.levelUpThinkTimer -= dt;
          if (this.levelUpThinkTimer <= 0) {
            this.pickRandomSpell(player);
          }
        }
        if (pausedChoice) return;
      }
    }
    if (this.match.phase !== 'playing') return;

    if (!this.match.botAiEnabled) {
      this.idleInput(player);
      return;
    }

    this.retargetTimer -= dt;
    this.strafeSwitchTimer -= dt;

    if (this.strafeSwitchTimer <= 0) {
      this.strafe = Math.random() < 0.5 ? 1 : -1;
      this.strafeSwitchTimer = 1.5 + Math.random() * 3.0;
    }

    const hostiles = [];
    if (this.match.pvpEnabled) {
      for (const p of this.match.players.values()) {
        if (p.id !== player.id && p.alive) hostiles.push(p);
      }
    }
    for (const m of this.match.monsters) {
      if (m.alive) hostiles.push(m);
    }

    if (this.retargetTimer <= 0 || !this.target || !this.target.alive) {
      let best = null;
      let bestScore = -Infinity;
      for (const h of hostiles) {
        const d = Math.hypot(h.x - player.x, h.y - player.y);
        const hpPct = (h.hp || 0) / Math.max((h.maxHp || 1), 1);
        const priorityBonus = (h.isBoss ? 50 : h.isElite ? 30 : 0);
        const hpPriority = (1 - hpPct) * 80;
        const score = priorityBonus + hpPriority - d;
        if (score > bestScore) {
          bestScore = score;
          best = h;
        }
      }
      this.target = best;
      this.retargetTimer = 0.3 + Math.random() * 0.5;
    }

    const arena = {
      x: CONFIG.ARENA_CENTER_X,
      y: CONFIG.ARENA_CENTER_Y,
      r: this.match.arenaRadius * 0.8,
    };
    const fromCenter = Math.hypot(player.x - arena.x, player.y - arena.y);

    if (this.orbitRadius === 0) {
      this.orbitRadius = arena.r * (0.35 + Math.random() * 0.4);
    }

    let aimX = player.x;
    let aimY = player.y;
    let up = false;
    let down = false;
    let left = false;
    let right = false;

    const threatMeteor = this.findThreateningMeteor(player);
    const threatProj = this.findThreateningProjectile(player);
    const threatAOE = this.findThreateningAOE(player);
    const heal = this.findMassHealTarget(player);
    const mist = this.findCooldownMistTarget(player);
    const gale = this.findGaleTarget(player);
    const pickup = this.findNearestPickup(player);
    const buff = heal || mist || gale;

    if (threatMeteor) {
      let fleeDx = player.x - threatMeteor.x;
      let fleeDy = player.y - threatMeteor.y;
      if (Math.abs(fleeDx) < 1 && Math.abs(fleeDy) < 1) {
        const a = Math.random() * Math.PI * 2;
        fleeDx = Math.cos(a);
        fleeDy = Math.sin(a);
      }
      if (fromCenter > arena.r * 0.85) {
        fleeDx += (arena.x - player.x) * 0.75;
        fleeDy += (arena.y - player.y) * 0.75;
      }
      const fleeLen = Math.hypot(fleeDx, fleeDy) || 1;
      aimX = player.x + (fleeDx / fleeLen) * 200;
      aimY = player.y + (fleeDy / fleeLen) * 200;
      ({ up, down, left, right } = dirsToward(player.x, player.y, aimX, aimY, 8));
    } else if (threatProj) {
      const px = threatProj.x;
      const py = threatProj.y;
      const vx = threatProj.vx || 0;
      const vy = threatProj.vy || 0;
      const dx = player.x - px;
      const dy = player.y - py;
      const perpX = -vy;
      const perpY = vx;
      const sign = (dx * perpX + dy * perpY) > 0 ? 1 : -1;
      aimX = player.x + perpX * sign * 150;
      aimY = player.y + perpY * sign * 150;
      if (fromCenter > arena.r * 0.85) {
        aimX += (arena.x - player.x) * 0.4;
        aimY += (arena.y - player.y) * 0.4;
      }
      ({ up, down, left, right } = dirsToward(player.x, player.y, aimX, aimY, 6));
    } else if (threatAOE) {
      const dAOE = Math.hypot(threatAOE.x - player.x, threatAOE.y - player.y);
      if (dAOE < 1) {
        const a = Math.random() * Math.PI * 2;
        aimX = player.x + Math.cos(a) * 120;
        aimY = player.y + Math.sin(a) * 120;
      } else {
        aimX = player.x + (player.x - threatAOE.x) / dAOE * 120;
        aimY = player.y + (player.y - threatAOE.y) / dAOE * 120;
      }
      ({ up, down, left, right } = dirsToward(player.x, player.y, aimX, aimY, 6));
    } else if (buff) {
      aimX = buff.x;
      aimY = buff.y;
      const inside =
        Math.hypot(buff.x - player.x, buff.y - player.y) <=
        Math.max(12, buff.radius - PLAYER_R * 0.5);
      if (inside) {
        up = down = left = right = false;
      } else if (fromCenter > arena.r) {
        ({ up, down, left, right } = dirsToward(player.x, player.y, arena.x, arena.y));
      } else {
        ({ up, down, left, right } = dirsToward(player.x, player.y, buff.x, buff.y));
      }
    } else if (pickup && fromCenter <= arena.r) {
      aimX = pickup.x;
      aimY = pickup.y;
      ({ up, down, left, right } = dirsToward(player.x, player.y, pickup.x, pickup.y, 6));
    } else if (fromCenter > arena.r) {
      aimX = arena.x;
      aimY = arena.y;
      ({ up, down, left, right } = dirsToward(player.x, player.y, arena.x, arena.y));
    } else if (this.target) {
      const dx = this.target.x - player.x;
      const dy = this.target.y - player.y;
      const d = Math.hypot(dx, dy);
      const ideal = 150;

      if (this.target.vx !== undefined) {
        ({ aimX, aimY } = this.predictAim(player, this.target));
      } else {
        aimX = this.target.x;
        aimY = this.target.y;
      }

      if (d > ideal + 40) {
        const dirs = dirsToward(player.x, player.y, this.target.x, this.target.y);
        const sx = -dy * this.strafe * 0.3;
        const sy = dx * this.strafe * 0.3;
        if (sx > 0.6) dirs.right = true;
        if (sx < -0.6) dirs.left = true;
        if (sy > 0.6) dirs.down = true;
        if (sy < -0.6) dirs.up = true;
        ({ up, down, left, right } = dirs);
      } else if (d < ideal - 35) {
        ({ up, down, left, right } = dirsAway(player.x, player.y, this.target.x, this.target.y, 10));
      } else {
        const sx = -dy * this.strafe;
        const sy = dx * this.strafe;
        if (sx > 0) right = true;
        if (sx < 0) left = true;
        if (sy > 0) down = true;
        if (sy < 0) up = true;
      }
    } else {
      this.orbitAngle += this.orbitDir * dt * 1.8;
      const orbitX = arena.x + Math.cos(this.orbitAngle) * this.orbitRadius;
      const orbitY = arena.y + Math.sin(this.orbitAngle) * this.orbitRadius;
      aimX = orbitX;
      aimY = orbitY;
      ({ up, down, left, right } = dirsToward(player.x, player.y, orbitX, orbitY, 16));
    }

    this.match.setInput(this.playerId, {
      up,
      down,
      left,
      right,
      aimX,
      aimY,
      castSlot: -1,
      barrier: true,
      mend: true,
      blink: true,
    });
  }
}
