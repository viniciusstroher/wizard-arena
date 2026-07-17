/** IA simples para preencher o lobby e testar PvP. */

export class BotController {
  constructor(match, playerId) {
    this.match = match;
    this.playerId = playerId;
    this.castTimer = 0.5 + Math.random();
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.retargetTimer = 0;
    this.target = null;
  }

  update(dt) {
    const player = this.match.players.get(this.playerId);
    if (!player || !player.alive) return;
    if (this.match.phase === 'levelup' && player.spellChoices?.length) {
      // Escolhe uma opção após um pequeno atraso simulado
      if (Math.random() < 0.08) {
        const index = Math.floor(Math.random() * player.spellChoices.length);
        const choice = player.spellChoices[index];
        this.match.chooseSpell(this.playerId, {
          index,
          spellId: choice.spellId,
          kind: choice.kind,
          fromLevel: choice.fromLevel,
          choiceSetId: player.choiceSetId,
        });
      }
      return;
    }
    if (this.match.phase !== 'playing') return;

    this.retargetTimer -= dt;
    this.castTimer -= dt;

    const hostiles = [];
    for (const p of this.match.players.values()) {
      if (p.id !== player.id && p.alive) hostiles.push(p);
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
      x: 640,
      y: 360,
      r: this.match.arenaRadius * 0.75,
    };
    const fromCenter = Math.hypot(player.x - arena.x, player.y - arena.y);

    let aimX = player.x;
    let aimY = player.y;
    let up = false;
    let down = false;
    let left = false;
    let right = false;

    // Fica dentro da arena
    if (fromCenter > arena.r) {
      aimX = arena.x;
      aimY = arena.y;
      if (player.x < arena.x) right = true;
      if (player.x > arena.x) left = true;
      if (player.y < arena.y) down = true;
      if (player.y > arena.y) up = true;
    } else if (this.target) {
      aimX = this.target.x;
      aimY = this.target.y;
      const dx = this.target.x - player.x;
      const dy = this.target.y - player.y;
      const d = Math.hypot(dx, dy);
      const ideal = 140;
      if (d > ideal + 20) {
        if (dx > 10) right = true;
        if (dx < -10) left = true;
        if (dy > 10) down = true;
        if (dy < -10) up = true;
      } else if (d < ideal - 30) {
        if (dx > 10) left = true;
        if (dx < -10) right = true;
        if (dy > 10) up = true;
        if (dy < -10) down = true;
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
    if (this.castTimer <= 0 && this.target) {
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

    // Escudo inato (lv2+): sempre que possível
    const barrier =
      level >= 2 && (player.barrierCooldown || 0) <= 0 && (player.shield || 0) <= 0;

    // Heal inato (lv3+): sempre que possível (ferido e fora de CD)
    const mend = level >= 3 && (player.mendCooldown || 0) <= 0 && player.hp < player.maxHp;

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
    });
  }
}
