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
};

export const GALE_SPEED_MUL = 1.5;
export const GALE_INERTIA_MUL = 0.75;
export const PLAYER_RADIUS = 16;

const FLOOR_META = {
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
};

function pctDelta(mul) {
  const pct = Math.round((mul - 1) * 100);
  if (pct === 0) return null;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
}

function floorDescription(speedMul, inertiaMul) {
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
