/** Multiplicadores de chão (espelho de server/config.js FLOOR_*). */
export const FLOOR_SPEED_MUL = {
  dirt: 1,
  grass: 1,
  ice: 0.75,
  wood: 1.2,
  sea: 1,
  desert: 0.7,
  swamp: 0.7,
  volcano: 0.85,
  ruins: 1,
  crystal: 1.05,
  snow: 0.8,
  tundra: 0.85,
  cave: 0.95,
  dungeon: 1,
  graveyard: 0.95,
  hell: 0.8,
  sky: 1.15,
  mushroom: 0.9,
  jungle: 0.85,
  mountain: 0.9,
  beach: 1.05,
  coral: 0.95,
  ashland: 0.8,
  enchanted: 1.1,
  blood: 0.9,
  shadow: 1,
  temple: 1,
  sewer: 0.7,
  meadow: 1.1,
  lava_field: 0.75,
  glacier: 0.7,
  oasis: 1.05,
  canyon: 0.9,
  marsh: 0.65,
  aurora: 1.1,
  obsidian: 0.85,
  sandstone: 1,
  storm: 1.05,
  garden: 1.1,
  battlefield: 0.9,
  library: 1.15,
  catacomb: 0.95,
  abyss: 0.9,
  bramble: 0.8,
  saltflat: 0.75,
  crystal_cave: 1,
  bat_cave: 0.95,
  vampire_castle: 1,
  throne_hall: 1.1,
  crypt: 0.95,
};

export const FLOOR_INERTIA_MUL = {
  dirt: 1,
  grass: 1,
  ice: 1,
  wood: 1,
  sea: 2.8,
  desert: 1,
  swamp: 1,
  volcano: 1,
  ruins: 1,
  crystal: 1.2,
  snow: 1.35,
  tundra: 1.1,
  cave: 1,
  dungeon: 1,
  graveyard: 1,
  hell: 1,
  sky: 1.4,
  mushroom: 1.1,
  jungle: 1,
  mountain: 1,
  beach: 1.3,
  coral: 2.2,
  ashland: 1,
  enchanted: 1.15,
  blood: 1.1,
  shadow: 1.15,
  temple: 1,
  sewer: 1.25,
  meadow: 1,
  lava_field: 1,
  glacier: 1.5,
  oasis: 1.1,
  canyon: 1,
  marsh: 1.15,
  aurora: 1.35,
  obsidian: 1.1,
  sandstone: 1,
  storm: 1.45,
  garden: 1,
  battlefield: 1,
  library: 1,
  catacomb: 1,
  abyss: 2.5,
  bramble: 1,
  saltflat: 1.2,
  crystal_cave: 1.15,
  bat_cave: 1,
  vampire_castle: 1,
  throne_hall: 1,
  crypt: 1,
};

export const GALE_SPEED_MUL = 1.5;
export const GALE_INERTIA_MUL = 0.75;
export const PLAYER_RADIUS = 16;

export const FLOOR_META = {
  dirt: { name: 'Terra', icon: 'spell_dash', color: 0xa08060 },
  grass: { name: 'Floresta', icon: 'spell_mend', color: 0x5dade2 },
  ice: { name: 'Gelo', icon: 'spell_ice_shard', color: 0x66ccff },
  wood: { name: 'Madeira', icon: 'spell_dash', color: 0x7dcea0 },
  sea: { name: 'Mar', icon: 'spell_time_freeze', color: 0x5dade2 },
  desert: { name: 'Deserto', icon: 'spell_firebolt', color: 0xe67e22 },
  swamp: { name: 'Pântano', icon: 'spell_poison_cloud', color: 0x6b8f3a },
  volcano: { name: 'Vulcão', icon: 'spell_flame_nova', color: 0xff6644 },
  ruins: { name: 'Ruínas', icon: 'spell_skull_bolt', color: 0xa99bc8 },
  crystal: { name: 'Cristal', icon: 'spell_blink', color: 0xc39bd3 },
  snow: { name: 'Neve', icon: 'spell_ice_shard', color: 0xeaf2f8 },
  tundra: { name: 'Tundra', icon: 'spell_ice_shard', color: 0xaed6f1 },
  cave: { name: 'Caverna', icon: 'spell_dash', color: 0x5d6d7e },
  dungeon: { name: 'Masmorra', icon: 'spell_skull_bolt', color: 0x7f8c8d },
  graveyard: { name: 'Cemitério', icon: 'spell_skull_bolt', color: 0x566573 },
  hell: { name: 'Inferno', icon: 'spell_flame_nova', color: 0xc0392b },
  sky: { name: 'Céu', icon: 'spell_arc_lightning', color: 0x85c1e9 },
  mushroom: { name: 'Cogumelos', icon: 'spell_poison_cloud', color: 0xa569bd },
  jungle: { name: 'Selva', icon: 'spell_mend', color: 0x1e8449 },
  mountain: { name: 'Montanha', icon: 'spell_dash', color: 0x7f8c8d },
  beach: { name: 'Praia', icon: 'spell_time_freeze', color: 0xf9e79f },
  coral: { name: 'Recife', icon: 'spell_time_freeze', color: 0xe74c3c },
  ashland: { name: 'Cinzas', icon: 'spell_flame_nova', color: 0x6e2c00 },
  enchanted: { name: 'Encantado', icon: 'spell_blink', color: 0xbb8fce },
  blood: { name: 'Sangue', icon: 'spell_blood_pact', color: 0x922b21 },
  shadow: { name: 'Sombras', icon: 'spell_shadow_eclipse', color: 0x2c003e },
  temple: { name: 'Templo', icon: 'spell_barrier', color: 0xd4ac0d },
  sewer: { name: 'Esgoto', icon: 'spell_poison_cloud', color: 0x556b2f },
  meadow: { name: 'Prado', icon: 'spell_mend', color: 0x82e0aa },
  lava_field: { name: 'Campo de Lava', icon: 'spell_flame_nova', color: 0xe67e22 },
  glacier: { name: 'Geleira', icon: 'spell_ice_shard', color: 0x5dade2 },
  oasis: { name: 'Oásis', icon: 'spell_mend', color: 0x58d68d },
  canyon: { name: 'Cânion', icon: 'spell_dash', color: 0xd35400 },
  marsh: { name: 'Charco', icon: 'spell_poison_cloud', color: 0x7d8a3a },
  aurora: { name: 'Aurora', icon: 'spell_arc_lightning', color: 0x58d68d },
  obsidian: { name: 'Obsidiana', icon: 'spell_flame_nova', color: 0x1c2833 },
  sandstone: { name: 'Arenito', icon: 'spell_barrier', color: 0xd4a574 },
  storm: { name: 'Tempestade', icon: 'spell_arc_lightning', color: 0x5b6b8a },
  garden: { name: 'Jardim', icon: 'spell_mend', color: 0xf1948a },
  battlefield: { name: 'Campo de Batalha', icon: 'spell_skull_bolt', color: 0x7b241c },
  library: { name: 'Biblioteca', icon: 'spell_dash', color: 0xa04000 },
  catacomb: { name: 'Catacumba', icon: 'spell_skull_bolt', color: 0x85929e },
  abyss: { name: 'Abismo', icon: 'spell_time_freeze', color: 0x1a5276 },
  bramble: { name: 'Espinhos', icon: 'spell_poison_cloud', color: 0x196f3d },
  saltflat: { name: 'Salina', icon: 'spell_firebolt', color: 0xf5e6c8 },
  crystal_cave: { name: 'Caverna de Cristal', icon: 'spell_blink', color: 0x8e44ad },
  bat_cave: { name: 'Caverna dos Morcegos', icon: 'spell_dash', color: 0x2c3e50 },
  vampire_castle: { name: 'Castelo Vampírico', icon: 'spell_blood_pact', color: 0x641e16 },
  throne_hall: { name: 'Salão do Trono', icon: 'spell_blood_pact', color: 0x7b241c },
  crypt: { name: 'Cripta', icon: 'spell_skull_bolt', color: 0x5d6d7e },
};

function pctDelta(mul) {
  const pct = Math.round((mul - 1) * 100);
  if (pct === 0) return null;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
}

export function floorDescription(speedMul, inertiaMul) {
  const parts = [];
  const spd = pctDelta(speedMul);
  if (spd) parts.push(`Velocidade ${spd}`);
  if (inertiaMul > 1.01) {
    const slide = pctDelta(inertiaMul);
    parts.push(slide ? `Deslize ${slide}` : 'Mais deslize');
  } else if (inertiaMul < 0.99) {
    const grip = pctDelta(inertiaMul);
    parts.push(grip ? `Inércia ${grip}` : 'Menos deslize');
  }
  if (parts.length === 0) return 'Terreno neutro.';
  return `${parts.join('. ')}.`;
}

/** Efeito de terreno ativo no mapa (só se alterar movimento). */
export function getFloorStatusEffect(floorType) {
  const speedMul = FLOOR_SPEED_MUL[floorType] ?? 1;
  const inertiaMul = FLOOR_INERTIA_MUL[floorType] ?? 1;
  if (Math.abs(speedMul - 1) < 0.01 && Math.abs(inertiaMul - 1) < 0.01) return null;

  const meta = FLOOR_META[floorType] || { name: 'Arena', icon: 'spell_dash', color: 0xa99bc8 };
  const isBuff = speedMul > 1 || (speedMul >= 1 && inertiaMul < 1);
  const isDebuff = speedMul < 1 || inertiaMul > 1.05;

  return {
    id: `floor_${floorType}`,
    icon: meta.icon,
    color: isBuff && !isDebuff ? 0x7dcea0 : isDebuff && speedMul < 1 ? 0xe67e22 : meta.color,
    name: `Terreno: ${meta.name}`,
    description: floorDescription(speedMul, inertiaMul),
    timer: null,
  };
}

export function getCombatStatusEffect(kind, timer, slowAmount = 0) {
  if (kind === 'slow') {
    const pct = Math.round((Number(slowAmount) || 0) * 100);
    return {
      id: 'slow',
      icon: 'spell_ice_shard',
      color: 0x66ccff,
      name: 'Lentidão',
      description: pct > 0 ? `Velocidade reduzida em ${pct}%.` : 'Velocidade reduzida.',
      timer,
    };
  }
  if (kind === 'poison') {
    return {
      id: 'poison',
      icon: 'spell_poison_cloud',
      color: 0x88ff44,
      name: 'Veneno',
      description: 'Sofre dano periódico enquanto o veneno durar.',
      timer,
    };
  }
  if (kind === 'burn') {
    return {
      id: 'burn',
      icon: 'spell_flame_nova',
      color: 0xff8844,
      name: 'Queimadura',
      description: 'Sofre dano periódico de fogo enquanto queimar.',
      timer,
    };
  }
  return null;
}

export function getGaleStatusEffect(life) {
  const spd = pctDelta(GALE_SPEED_MUL);
  const grip = pctDelta(GALE_INERTIA_MUL);
  const parts = [];
  if (spd) parts.push(`Velocidade ${spd}`);
  if (grip) parts.push(`Inércia ${grip}`);
  return {
    id: 'gale',
    icon: 'spell_storm_call',
    color: 0xa8d8ff,
    name: 'Ventania',
    description: parts.length
      ? `${parts.join('. ')}. Zona de vento ativo.`
      : 'Zona de vento ativo.',
    timer: life ?? null,
  };
}

export function getLavaStatusEffect() {
  return {
    id: 'lava',
    icon: 'spell_apocalypse',
    color: 0xff4422,
    name: 'Lava',
    description: 'Fora da arena segura: sofre dano contínuo.',
    timer: null,
  };
}

/** Cooldown global entre eventos de arena (meteoro / heal / névoa / ventania). */
export function getArenaEventCooldownStatusEffect(remaining, maxCd) {
  const t = Number(remaining) || 0;
  if (t <= 0) return null;
  const max = Number(maxCd) || 0;
  return {
    id: 'arena_event_cooldown',
    icon: 'spell_time_freeze',
    color: 0xc39bd3,
    name: 'Eventos em espera',
    description:
      max > 0
        ? `Próximo evento de arena só após o cooldown (${max}s).`
        : 'Próximo evento de arena só após o cooldown.',
    timer: t,
  };
}
