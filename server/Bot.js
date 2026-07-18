/** IA simples para preencher o lobby e testar PvP. */

import { CONFIG } from './config.js';

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
    this.castTimer = 0.5 + Math.random();
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.retargetTimer = 0;
    this.target = null;
    this.levelUpThinkTimer = 0;
    this.levelUpChoiceSetId = null;
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
      const dangerR = m.radius + CONFIG.PLAYER_RADIUS + margin;
      if (d <= dangerR && d < bestD) {
        best = m;
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
        // Flag off: resolve na hora (Match.autoResolveBotLevelUpsIfDisabled também cobre).
        if (!this.match.botLevelUpChoiceEnabled) {
          this.pickRandomSpell(player);
        } else {
          // Flag on: espera um tempo “pensando” e escolhe aleatório.
          if (this.levelUpChoiceSetId !== player.choiceSetId) {
            this.levelUpChoiceSetId = player.choiceSetId;
            this.levelUpThinkTimer = 1.8 + Math.random() * 2.4; // ~1.8–4.2s
          }
          this.levelUpThinkTimer -= dt;
          if (this.levelUpThinkTimer <= 0) {
            this.pickRandomSpell(player);
          }
        }
        // Só trava a AI do bot se a partida estiver na phase levelup (legado).
        if (pausedChoice) return;
      }
    }
    if (this.match.phase !== 'playing') return;

    if (!this.match.botAiEnabled) {
      this.idleInput(player);
      return;
    }

    this.retargetTimer -= dt;
    this.castTimer -= dt;

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
      let bestD = Infinity;
      for (const h of hostiles) {
        const d = Math.hypot(h.x - player.x, h.y - player.y);
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      this.target = best;
      this.retargetTimer = 0.4 + Math.random() * 0.4;
    }

    const arena = {
      x: CONFIG.ARENA_CENTER_X,
      y: CONFIG.ARENA_CENTER_Y,
      r: this.match.arenaRadius * 0.75,
    };
    const fromCenter = Math.hypot(player.x - arena.x, player.y - arena.y);

    let aimX = player.x;
    let aimY = player.y;
    let up = false;
    let down = false;
    let left = false;
    let right = false;
    let fleeMeteor = false;

    const threat = this.findThreateningMeteor(player);
    const heal = this.findMassHealTarget(player);
    const mist = this.findCooldownMistTarget(player);
    const gale = this.findGaleTarget(player);
    const pickup = this.findNearestPickup(player);
    // Prefere cura; senão névoa; senão ventania
    const buff = heal || mist || gale;

    // 1) Prioridade máxima: sair da área do meteoro
    if (threat) {
      fleeMeteor = true;
      // Mira na direção da fuga (blink segue aimX/aimY)
      let fleeDx = player.x - threat.x;
      let fleeDy = player.y - threat.y;
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
    } else if (buff) {
      // 2) Sempre tenta pegar mass heal / névoa / ventania (aviso)
      aimX = buff.x;
      aimY = buff.y;
      const inside =
        Math.hypot(buff.x - player.x, buff.y - player.y) <=
        Math.max(12, buff.radius - CONFIG.PLAYER_RADIUS * 0.5);
      if (inside) {
        // Já na zona: fica parado para receber o buff
        up = down = left = right = false;
      } else if (fromCenter > arena.r) {
        ({ up, down, left, right } = dirsToward(player.x, player.y, arena.x, arena.y));
      } else {
        ({ up, down, left, right } = dirsToward(player.x, player.y, buff.x, buff.y));
      }
    } else if (pickup && fromCenter <= arena.r) {
      // 3) Coleta saco de loot ou moeda próximo
      aimX = pickup.x;
      aimY = pickup.y;
      ({ up, down, left, right } = dirsToward(player.x, player.y, pickup.x, pickup.y, 6));
    } else if (fromCenter > arena.r) {
      // Fica dentro da arena
      aimX = arena.x;
      aimY = arena.y;
      ({ up, down, left, right } = dirsToward(player.x, player.y, arena.x, arena.y));
    } else if (this.target) {
      aimX = this.target.x;
      aimY = this.target.y;
      const dx = this.target.x - player.x;
      const dy = this.target.y - player.y;
      const d = Math.hypot(dx, dy);
      const ideal = 140;
      if (d > ideal + 20) {
        ({ up, down, left, right } = dirsToward(player.x, player.y, this.target.x, this.target.y));
      } else if (d < ideal - 30) {
        ({ up, down, left, right } = dirsAway(player.x, player.y, this.target.x, this.target.y, 10));
      } else {
        // strafe
        const sx = -dy * this.strafe;
        const sy = dx * this.strafe;
        if (sx > 0) right = true;
        if (sx < 0) left = true;
        if (sy > 0) down = true;
        if (sy < 0) up = true;
      }
    }

    let castSlot = -1;
    if (this.castTimer <= 0 && this.target && !fleeMeteor) {
      // Prefere slot com cooldown pronto
      for (let i = 0; i < player.spells.length; i++) {
        if (player.spells[i].cooldownLeft <= 0) {
          castSlot = i;
          break;
        }
      }
      if (castSlot < 0 && player.ultimate && !player.ultimate.usedThisRound && player.hp < 50) {
        castSlot = 3;
      }
      this.castTimer = 0.6 + Math.random() * 0.8;
    }

    const level = player.level || 1;

    // Escudo inato (lv2+): sempre que possível (ainda mais útil sob meteoro)
    const barrier =
      level >= 2 && (player.barrierCooldown || 0) <= 0 && (player.shield || 0) <= 0;

    // Heal inato (lv3+): sempre que possível (ferido e fora de CD)
    const mend = level >= 3 && (player.mendCooldown || 0) <= 0 && player.hp < player.maxHp;

    // Blink inato (lv5+): prioriza fuga/cura; no combate usa sempre que possível
    const blink = level >= 5 && (player.blinkCooldown || 0) <= 0;

    this.match.setInput(this.playerId, {
      up,
      down,
      left,
      right,
      aimX,
      aimY,
      castSlot,
      barrier,
      mend,
      blink,
    });
  }
}
