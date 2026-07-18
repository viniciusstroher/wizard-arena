/** Catálogo de magias e utilitários de escolha estilo rogue. */

export const SPELLS = {
  firebolt: {
    id: 'firebolt',
    name: 'Firebolt',
    description: 'Projétil de fogo que causa dano a distância.',
    type: 'basic',
    playerUsable: true,
    /** Dispara sozinho enquanto o slot estiver selecionado (sem Espaço). */
    autocast: true,
    cooldown: 0.40,
    manaCost: 0,
    damage: 18,
    range: 340,
    speed: 560,
    radius: 10,
    color: 0xff5533,
  },
  ice_shard: {
    id: 'ice_shard',
    name: 'Ice Shard',
    description: 'Fragmento de gelo que causa dano e reduz velocidade por 5s.',
    type: 'basic',
    playerUsable: true,
    /** Dispara sozinho enquanto o slot estiver selecionado (sem Espaço). */
    autocast: true,
    cooldown: 0.45,
    manaCost: 0,
    damage: 14,
    range: 300,
    speed: 500,
    radius: 10,
    slow: 0.45,
    slowDuration: 5,
    color: 0x66ccff,
  },
  arc_lightning: {
    id: 'arc_lightning',
    name: 'Arc Lightning',
    description: 'Raio elétrico no inimigo mais próximo.',
    type: 'basic',
    playerUsable: true,
    cooldown: 1.4,
    manaCost: 0,
    damage: 22,
    range: 160,
    color: 0xaadfff,
  },
  flame_nova: {
    id: 'flame_nova',
    name: 'Flame Nova',
    description: 'Explosão de fogo no chão. Quem for atingido queima (3 dmg/s por 10s).',
    type: 'basic',
    playerUsable: true,
    cooldown: 2.5,
    manaCost: 0,
    /** Dano inicial ao explodir. */
    damage: 28,
    radius: 110,
    /** Tempo que o fogo fica queimando no chão (segundos). */
    duration: 4,
    /** Dano por tick do status de queimadura. */
    burnDamage: 3,
    /** Intervalo entre ticks da queimadura (segundos). */
    burnTick: 1,
    /** Duração da queimadura ao ser atingido / pisar no fogo (segundos). */
    burnDuration: 10,
    color: 0xff8844,
  },
  mend: {
    id: 'mend',
    name: 'Mend',
    description: 'Cura rápida. Habilidade inata (H), liberada no nível 3.',
    type: 'basic',
    playerUsable: true,
    /** Não aparece na tela de escolha; inata a partir do nível 3. */
    selectable: false,
    innate: true,
    unlockLevel: 3,
    cooldown: 4.0,
    manaCost: 0,
    heal: 28,
    color: 0x55ff88,
  },
  poison_cloud: {
    id: 'poison_cloud',
    name: 'Poison Cloud',
    description: 'Nuvem tóxica: ao pisar, aplica veneno (3 de dano/s por 5s). Reentrar renova o efeito.',
    type: 'basic',
    playerUsable: true,
    cooldown: 3.0,
    manaCost: 0,
    /** Dano por tick do veneno aplicado. */
    damage: 3,
    /** Intervalo entre ticks do veneno (segundos). */
    tick: 1,
    /** Duração da nuvem no chão (segundos). */
    duration: 4,
    /** Duração do status de veneno ao pisar (segundos). */
    poisonDuration: 5,
    radius: 90,
    color: 0x88ff44,
  },
  blink: {
    id: 'blink',
    name: 'Blink',
    description: 'Teleporte curto na direção do cursor. Habilidade inata (B), liberada no nível 5.',
    type: 'basic',
    playerUsable: true,
    /** Não aparece na tela de escolha; inata a partir do nível 5. */
    selectable: false,
    innate: true,
    unlockLevel: 5,
    cooldown: 3.5,
    manaCost: 0,
    range: 180,
    color: 0xaa88ff,
  },
  barrier: {
    id: 'barrier',
    name: 'Barrier',
    description: 'Escudo que absorve dano por alguns segundos. Habilidade inata (E), liberada no nível 2.',
    type: 'basic',
    playerUsable: true,
    /** Não aparece na tela de escolha; inata a partir do nível 2. */
    selectable: false,
    innate: true,
    unlockLevel: 2,
    cooldown: 6.0,
    manaCost: 0,
    shield: 35,
    duration: 3.5,
    color: 0x88aaff,
  },
  skull_bolt: {
    id: 'skull_bolt',
    name: 'Skull Bolt',
    description: 'Caveira amaldiçoada com raios negros.',
    type: 'basic',
    playerUsable: true,
    /** Dispara sozinho enquanto o slot estiver selecionado (sem Espaço). */
    autocast: true,
    cooldown: 0.63,
    manaCost: 0,
    damage: 22,
    range: 320,
    speed: 500,
    radius: 12,
    color: 0x4a0080,
  },
  /** Exclusiva do grim_reaper — onda radial de caveiras. */
  skull_wave: {
    id: 'skull_wave',
    name: 'Skull Wave',
    description: 'Onda radial de caveiras amaldiçoadas. Uso exclusivo do Ceifador.',
    type: 'basic',
    playerUsable: false,
    cooldown: 2.4,
    manaCost: 0,
    damage: 18,
    range: 220,
    speed: 300,
    radius: 11,
    /** Quantidade padrão de caveiras na onda. */
    skullCount: 10,
    color: 0x4a0080,
  },
  /** Exclusiva de dragon / fire_elemental / bruxo — não entra no pool de jogadores. */
  firebreath: {
    id: 'firebreath',
    name: 'Firebreath',
    description: 'Sopro de fogo em cone à frente. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.8,
    manaCost: 0,
    damage: 26,
    range: 170,
    /** Meia-abertura do cone em graus. */
    coneAngle: 38,
    color: 0xff6622,
  },
  /** Exclusiva de demon — raio do céu no alvo. */
  electric_bolt: {
    id: 'electric_bolt',
    name: 'Electric Bolt',
    description: 'Raio que cai do céu no alvo. Uso exclusivo de demônios.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.35,
    manaCost: 0,
    damage: 24,
    range: 240,
    color: 0x7cf0ff,
  },
  /** Exclusiva de demon — tempestade com vários raios caindo. */
  electric_storm: {
    id: 'electric_storm',
    name: 'Electric Storm',
    description: 'Tempestade elétrica: vários raios caem na área. Uso exclusivo de demônios.',
    type: 'basic',
    playerUsable: false,
    cooldown: 4.5,
    manaCost: 0,
    damage: 16,
    range: 200,
    radius: 130,
    /** Quantidade de raios visuais na tempestade. */
    boltCount: 7,
    color: 0x88bbff,
  },
};

export const ULTIMATES = {
  apocalypse: {
    id: 'apocalypse',
    name: 'Apocalypse',
    description: 'Chuva de meteoros em grande área. 1x por round.',
    type: 'ultimate',
    playerUsable: true,
    cooldown: 9999,
    oncePerRound: true,
    damage: 70,
    radius: 200,
    color: 0xff2200,
  },
  time_freeze: {
    id: 'time_freeze',
    name: 'Time Freeze',
    description: 'Congela inimigos próximos. 1x por round.',
    type: 'ultimate',
    playerUsable: true,
    cooldown: 9999,
    oncePerRound: true,
    duration: 3,
    radius: 220,
    color: 0xaaddff,
  },
  storm_call: {
    id: 'storm_call',
    name: 'Storm Call',
    description: 'Cadeia de raios em todos os inimigos próximos. 1x por round.',
    type: 'ultimate',
    playerUsable: true,
    cooldown: 9999,
    oncePerRound: true,
    damage: 45,
    range: 320,
    color: 0xffdd33,
  },
};

const BASIC_IDS = Object.keys(SPELLS);
const ULTIMATE_IDS = Object.keys(ULTIMATES);

/** Magias básicas que jogadores podem aprender / sortear (exclui inatas). */
export const PLAYER_BASIC_IDS = BASIC_IDS.filter(
  (id) => SPELLS[id].playerUsable !== false && SPELLS[id].selectable !== false
);

/** IDs de magias inatas (escudo, heal, etc.) — não entram nos slots 1–3. */
export const INNATE_SPELL_IDS = BASIC_IDS.filter((id) => SPELLS[id].innate);

export function isInnateSpell(id) {
  return !!SPELLS[id]?.innate;
}

export function innateUnlockLevel(id) {
  return SPELLS[id]?.unlockLevel ?? 1;
}
/** Ultimates disponíveis para jogadores. */
export const PLAYER_ULTIMATE_IDS = ULTIMATE_IDS.filter((id) => ULTIMATES[id].playerUsable !== false);

/** Máximo de magias básicas (além de ultimate e dash). */
export const MAX_BASIC_SPELLS = 3;

export function getSpellDef(id) {
  return SPELLS[id] || ULTIMATES[id] || null;
}

export function isPlayerUsableSpell(id) {
  const def = getSpellDef(id);
  return !!(def && def.playerUsable !== false);
}

export function createSpellInstance(id, level = 1) {
  const base = getSpellDef(id);
  if (!base) return null;
  return {
    id,
    level,
    type: base.type,
    cooldownLeft: 0,
    usedThisRound: false,
  };
}

/** Multiplicadores por nível de upgrade da magia. */
export function spellStats(id, level = 1) {
  const base = getSpellDef(id);
  if (!base) return null;
  const mul = 1 + (level - 1) * 0.25;
  return {
    ...base,
    damage: base.damage != null ? Math.round(base.damage * mul) : undefined,
    heal: base.heal != null ? Math.round(base.heal * mul) : undefined,
    shield: base.shield != null ? Math.round(base.shield * mul) : undefined,
    radius: base.radius != null ? Math.round(base.radius * (1 + (level - 1) * 0.12)) : undefined,
    range: base.range != null ? Math.round(base.range * (1 + (level - 1) * 0.08)) : undefined,
    cooldown: base.cooldown != null && !base.oncePerRound
      ? Math.max(0.2, +(base.cooldown * (1 - (level - 1) * 0.08)).toFixed(2))
      : base.cooldown,
    level,
  };
}

/**
 * Oferece 3 opções:
 * - preferencialmente 1 upgrade se o jogador já tem magias
 * - resto magias novas (ou ultimate no nível 4 se ainda não tiver)
 */
export function rollSpellChoices(player, forLevel) {
  const owned = player.spells.map((s) => s.id);
  const hasUltimate = !!player.ultimate;
  const choices = [];
  const used = new Set();

  const wantUltimate = forLevel >= 4 && !hasUltimate;
  if (wantUltimate) {
    const pool = PLAYER_ULTIMATE_IDS.filter((id) => !used.has(id));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      choices.push({ kind: 'new', spellId: pick, label: 'ULTIMATE' });
      used.add(pick);
    }
  }

  // Uma opção de upgrade se possível
  if (owned.length > 0 && choices.length < 3 && Math.random() < 0.85) {
    const upgradable = player.spells.filter((s) => s.level < 5);
    if (upgradable.length) {
      const s = upgradable[Math.floor(Math.random() * upgradable.length)];
      choices.push({ kind: 'upgrade', spellId: s.id, fromLevel: s.level, toLevel: s.level + 1 });
      used.add(`upgrade:${s.id}`);
    }
  }

  const canLearnNew = owned.length < MAX_BASIC_SPELLS;
  while (choices.length < 3) {
    if (canLearnNew) {
      const pool = PLAYER_BASIC_IDS.filter((id) => !owned.includes(id) && !used.has(id));
      if (pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        choices.push({ kind: 'new', spellId: pick });
        used.add(pick);
        continue;
      }
    }
    // Fallback: upgrades
    const upgradable = player.spells.filter(
      (s) => s.level < 5 && !used.has(`upgrade:${s.id}`)
    );
    if (upgradable.length) {
      const s = upgradable[Math.floor(Math.random() * upgradable.length)];
      choices.push({ kind: 'upgrade', spellId: s.id, fromLevel: s.level, toLevel: s.level + 1 });
      used.add(`upgrade:${s.id}`);
      continue;
    }
    // Último recurso: upgrade de magia própria ainda não oferecida
    const ownedPool = owned.filter((id) => {
      const s = player.spells.find((sp) => sp.id === id);
      return s && s.level < 5 && !used.has(`upgrade:${id}`);
    });
    if (ownedPool.length) {
      const pick = ownedPool[Math.floor(Math.random() * ownedPool.length)];
      const s = player.spells.find((sp) => sp.id === pick);
      choices.push({
        kind: 'upgrade',
        spellId: pick,
        fromLevel: s.level,
        toLevel: s.level + 1,
      });
      used.add(`upgrade:${pick}`);
      continue;
    }
    break;
  }

  return choices.map((c) => ({
    ...c,
    def: spellStats(c.spellId, c.kind === 'upgrade' ? c.toLevel : 1),
  }));
}

export function applySpellChoice(player, choice) {
  if (!choice) return false;
  const def = getSpellDef(choice.spellId);
  if (!def) return false;
  if (def.playerUsable === false) return false;
  if (def.selectable === false || def.innate) return false;

  if (def.type === 'ultimate') {
    if (player.ultimate) return false;
    player.ultimate = createSpellInstance(choice.spellId, 1);
    return true;
  }

  const existing = player.spells.find((s) => s.id === choice.spellId);

  // Upgrade explícito, ou "nova" que o jogador já tem (fallback seguro).
  if (choice.kind === 'upgrade' || existing) {
    if (!existing || existing.level >= 5) return false;
    existing.level += 1;
    return true;
  }

  if (player.spells.length >= MAX_BASIC_SPELLS) return false;
  player.spells.push(createSpellInstance(choice.spellId, 1));
  return true;
}
