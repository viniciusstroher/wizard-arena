/** Catálogo de magias e utilitários de escolha estilo rogue. */

export const SPELLS = {
  firebolt: {
    id: 'firebolt',
    name: 'Seta de Fogo',
    description: 'Projétil de fogo. Dispara sozinho enquanto o slot estiver selecionado.',
    type: 'basic',
    playerUsable: true,
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
    name: 'Fragmento de Gelo',
    description: 'Fragmento de gelo. Dispara sozinho enquanto o slot estiver selecionado. Causa dano e reduz velocidade por 5s.',
    type: 'basic',
    playerUsable: true,
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
    name: 'Raio em Arco',
    description: 'Raio elétrico que atinge o inimigo mais próximo.',
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
    name: 'Nova Flamejante',
    description: 'Explosão de fogo no chão. Quem for atingido queima (3 de dano/s por 10s).',
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
    name: 'Cura',
    description: 'Cura rápida. Habilidade inata (H), disponível desde o nível 1.',
    type: 'basic',
    playerUsable: true,
    /** Não aparece na tela de escolha; inata desde o nível 1. */
    selectable: false,
    innate: true,
    unlockLevel: 1,
    cooldown: 4.0,
    manaCost: 0,
    heal: 28,
    color: 0x55ff88,
  },
  poison_cloud: {
    id: 'poison_cloud',
    name: 'Nuvem Venenosa',
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
    name: 'Teleporte',
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
    name: 'Barreira',
    description: 'Escudo que absorve dano por alguns segundos. Habilidade inata (E), disponível desde o nível 1.',
    type: 'basic',
    playerUsable: true,
    /** Não aparece na tela de escolha; inata desde o nível 1. */
    selectable: false,
    innate: true,
    unlockLevel: 1,
    cooldown: 6.0,
    manaCost: 0,
    shield: 35,
    duration: 3.5,
    color: 0x88aaff,
  },
  skull_bolt: {
    id: 'skull_bolt',
    name: 'Raio Craniano',
    description: 'Caveira amaldiçoada com raios negros. Dispara sozinho enquanto o slot estiver selecionado.',
    type: 'basic',
    playerUsable: true,
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
    name: 'Onda de Caveiras',
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
    name: 'Sopro de Fogo',
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
    name: 'Raio Celeste',
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
    name: 'Tempestade Elétrica',
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

  // ─── Magias exclusivas de boss (% da vida máxima, teto 85%) ───
  soul_rend: {
    id: 'soul_rend',
    name: 'Rasgar Alma',
    description: 'Rasga a alma do alvo. Exclusiva de bosses. Até 55% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 5.5,
    manaCost: 0,
    damagePercentMaxHp: 0.55,
    range: 220,
    color: 0x6c3483,
  },
  void_collapse: {
    id: 'void_collapse',
    name: 'Colapso do Vazio',
    description: 'Colapso do vazio em área. Exclusiva de bosses. Até 45% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.0,
    manaCost: 0,
    damagePercentMaxHp: 0.45,
    range: 200,
    radius: 120,
    color: 0x1a0033,
  },
  death_knell: {
    id: 'death_knell',
    name: 'Sino da Morte',
    description: 'Sino da morte no alvo. Exclusiva de bosses. Até 70% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 7.5,
    manaCost: 0,
    damagePercentMaxHp: 0.7,
    range: 240,
    color: 0x2a0044,
  },
  cataclysm_beam: {
    id: 'cataclysm_beam',
    name: 'Feixe Cataclísmico',
    description: 'Feixe cataclísmico em cone. Exclusiva de bosses. Até 60% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.5,
    manaCost: 0,
    damagePercentMaxHp: 0.6,
    range: 200,
    coneAngle: 32,
    color: 0xf4d03f,
  },
  blood_pact: {
    id: 'blood_pact',
    name: 'Pacto de Sangue',
    description: 'Pacto de sangue no alvo. Exclusiva de bosses. Até 50% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 5.8,
    manaCost: 0,
    damagePercentMaxHp: 0.5,
    range: 210,
    color: 0xc0392b,
  },
  abyss_nova: {
    id: 'abyss_nova',
    name: 'Nova Abissal',
    description: 'Explosão abissal em área. Exclusiva de bosses. Até 65% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.8,
    manaCost: 0,
    damagePercentMaxHp: 0.65,
    range: 180,
    radius: 135,
    color: 0x4a0080,
  },
  frost_apocalypse: {
    id: 'frost_apocalypse',
    name: 'Apocalipse Gélido',
    description: 'Apocalipse gélido em área + lentidão. Exclusiva de bosses. Até 55% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.2,
    manaCost: 0,
    damagePercentMaxHp: 0.55,
    range: 200,
    radius: 130,
    slow: 0.5,
    slowDuration: 3.5,
    color: 0x85c1e9,
  },
  plague_burst: {
    id: 'plague_burst',
    name: 'Estouro de Praga',
    description: 'Estouro de praga em área + veneno. Exclusiva de bosses. Até 40% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 5.5,
    manaCost: 0,
    damagePercentMaxHp: 0.4,
    range: 190,
    radius: 115,
    poisonDamage: 4,
    poisonTick: 1,
    poisonDuration: 5,
    color: 0x58d68d,
  },
  infernal_judgment: {
    id: 'infernal_judgment',
    name: 'Julgamento Infernal',
    description: 'Julgamento infernal do céu. Exclusiva de bosses. Até 75% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 7.0,
    manaCost: 0,
    damagePercentMaxHp: 0.75,
    range: 260,
    color: 0xff4422,
  },
  shadow_eclipse: {
    id: 'shadow_eclipse',
    name: 'Eclipse Sombrio',
    description: 'Eclipse sombrio em grande área. Exclusiva de bosses. Até 85% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 8.5,
    manaCost: 0,
    damagePercentMaxHp: 0.85,
    range: 220,
    radius: 145,
    color: 0x1c1c28,
  },

  // ─── Expansão 3 — exclusivas de monstro ─────────────────────
  acid_bolt: {
    id: 'acid_bolt',
    name: 'Seta Ácida',
    description: 'Projétil ácido que envenena o alvo. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.2,
    manaCost: 0,
    damage: 16,
    range: 300,
    speed: 480,
    radius: 9,
    poisonDamage: 3,
    poisonTick: 1,
    poisonDuration: 4,
    color: 0x88ff44,
  },
  frost_breath: {
    id: 'frost_breath',
    name: 'Sopro Gélido',
    description: 'Sopro de gelo em cone que causa dano e lentidão. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 2.0,
    manaCost: 0,
    damage: 22,
    range: 165,
    coneAngle: 36,
    slow: 0.4,
    slowDuration: 2.8,
    color: 0x85c1e9,
  },
  bone_volley: {
    id: 'bone_volley',
    name: 'Saraivada Óssea',
    description: 'Onda radial de ossos amaldiçoados. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 2.6,
    manaCost: 0,
    damage: 16,
    range: 200,
    speed: 320,
    radius: 10,
    skullCount: 8,
    color: 0xece5d0,
  },
  hex_bolt: {
    id: 'hex_bolt',
    name: 'Raio Hex',
    description: 'Raio amaldiçoado que cai do céu no alvo. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.4,
    manaCost: 0,
    damage: 26,
    range: 245,
    color: 0xaa44ff,
  },
  magma_surge: {
    id: 'magma_surge',
    name: 'Surto de Magma',
    description: 'Explosão de magma em área com chão em chamas. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 4.2,
    manaCost: 0,
    damage: 20,
    range: 160,
    radius: 105,
    duration: 2.4,
    burnDamage: 3,
    burnTick: 0.8,
    burnDuration: 3,
    color: 0xff6622,
  },
  soul_lance: {
    id: 'soul_lance',
    name: 'Lança da Alma',
    description: 'Lança espiritual no alvo. Exclusiva de bosses. Até 60% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.0,
    manaCost: 0,
    damagePercentMaxHp: 0.6,
    range: 230,
    color: 0xd7bde2,
  },
  entropy_pulse: {
    id: 'entropy_pulse',
    name: 'Pulso de Entropia',
    description: 'Pulso entrópico em área. Exclusiva de bosses. Até 50% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.4,
    manaCost: 0,
    damagePercentMaxHp: 0.5,
    range: 210,
    radius: 125,
    color: 0x6c3483,
  },
  solar_judgment: {
    id: 'solar_judgment',
    name: 'Julgamento Solar',
    description: 'Julgamento solar do céu. Exclusiva de bosses. Até 70% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 7.2,
    manaCost: 0,
    damagePercentMaxHp: 0.7,
    range: 270,
    color: 0xf4d03f,
  },
  crystal_bolt: {
    id: 'crystal_bolt',
    name: 'Seta de Cristal',
    description: 'Projétil cristalino que causa dano e reduz velocidade. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.15,
    manaCost: 0,
    damage: 20,
    range: 310,
    speed: 520,
    radius: 9,
    slow: 0.35,
    slowDuration: 3.5,
    color: 0xaed6f1,
  },
  thorn_nova: {
    id: 'thorn_nova',
    name: 'Nova de Espinhos',
    description: 'Explosão de espinhos em área com veneno residual. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 4.0,
    manaCost: 0,
    damage: 18,
    range: 155,
    radius: 100,
    duration: 2.2,
    poisonDamage: 3,
    poisonTick: 1,
    poisonDuration: 4,
    color: 0x27ae60,
  },
  rift_lance: {
    id: 'rift_lance',
    name: 'Lança da Fenda',
    description: 'Lança dimensional no alvo. Exclusiva de bosses. Até 65% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.2,
    manaCost: 0,
    damagePercentMaxHp: 0.65,
    range: 240,
    color: 0x9b59b6,
  },
  tidal_crush: {
    id: 'tidal_crush',
    name: 'Esmagamento das Marés',
    description: 'Onda abissal em área. Exclusiva de bosses. Até 55% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.5,
    manaCost: 0,
    damagePercentMaxHp: 0.55,
    range: 215,
    radius: 130,
    slow: 0.4,
    slowDuration: 2.5,
    color: 0x1a5276,
  },
};

export const ULTIMATES = {
  apocalypse: {
    id: 'apocalypse',
    name: 'Apocalipse',
    description: 'Chuva de meteoros em grande área. Ultimate — 1x por round.',
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
    name: 'Congelamento Temporal',
    description: 'Congela inimigos próximos. Ultimate — 1x por round.',
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
    name: 'Chamado da Tempestade',
    description: 'Cadeia de raios em todos os inimigos próximos. Ultimate — 1x por round.',
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
