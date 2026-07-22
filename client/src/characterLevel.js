/** Nível do personagem baseado nos pontos totais acumulados em partidas. */

/**
 * Pontos cumulativos necessários para atingir determinado nível.
 * Nível 1 → 0 pts, Nível 2 → 50 pts, Nível 3 → 150 pts, etc.
 * Fórmula: pts = 25 × L × (L - 1)
 */
export function pointsForLevel(level) {
  if (level <= 1) return 0;
  return 25 * level * (level - 1);
}

/**
 * Retorna o nível atual e progresso a partir dos pontos totais.
 */
export function levelFromPoints(totalPoints) {
  const pts = Math.max(0, Math.floor(totalPoints));
  let level = 1;
  while (level < MAX_LEVEL && pointsForLevel(level + 1) <= pts) {
    level += 1;
  }
  const currentPts = pointsForLevel(level);
  const nextPts = pointsForLevel(level + 1);
  const range = nextPts - currentPts;
  const progress = range > 0 ? Math.min(1, (pts - currentPts) / range) : 1;
  return { level, currentPts, nextPts, progress };
}

export const MAX_LEVEL = 100;

/** Grupo de ícone (0–19) baseado no nível — muda a cada 5 níveis. */
export function iconGroupForLevel(level) {
  return Math.min(19, Math.floor((Math.max(1, level) - 1) / 5));
}

/** Cor do nível baseada no grupo de ícone. */
const GROUP_COLORS = [
  0x6b5cff, 0x5b8cff, 0x4db8e8, 0x3dd6a8, 0x2ecc71, // 1-25
  0x44d978, 0x5ce68c, 0x7af0a0, 0x9af5b8, 0xc0fad0, // 26-50
  0xf0c040, 0xe8a830, 0xe09020, 0xd87810, 0xc86000, // 51-75
  0xd06050, 0xe04860, 0xf03070, 0xf02080, 0xe01090, // 76-100
];

export function levelColor(level) {
  return GROUP_COLORS[iconGroupForLevel(level)] ?? 0x6b5cff;
}

/**
 * 100 títulos — um por nível.
 * Ícone muda a cada 5 níveis (iconGroup 0–19).
 */
const TITLES = [
  // 1-5 · Aprendiz
  'Aprendiz Arcano',
  'Aprendiz das Chamas',
  'Aprendiz Sombrio',
  'Aprendiz Celeste',
  'Aprendiz Místico',
  // 6-10 · Estudante
  'Estudante Arcano',
  'Estudante das Runas',
  'Estudante dos Ventos',
  'Estudante das Marés',
  'Estudante do Fogo',
  // 11-15 · Iniciado
  'Iniciado Arcano',
  'Iniciado Elemental',
  'Iniciado do Gelo',
  'Iniciado dos Raios',
  'Iniciado do Abismo',
  // 16-20 · Mago
  'Mago das Sombras',
  'Mago da Luz',
  'Mago da Terra',
  'Mago do Vento',
  'Mago da Água',
  // 21-25 · Conjurador
  'Conjurador de Fogo',
  'Conjurador de Gelo',
  'Conjurador de Raios',
  'Conjurador Sombrio',
  'Conjurador Astral',
  // 26-30 · Feiticeiro
  'Feiticeiro das Chamas',
  'Feiticeiro Glacial',
  'Feiticeiro Telúrico',
  'Feiticeiro Celeste',
  'Feiticeiro Abissal',
  // 31-35 · Encantador
  'Encantador de Runas',
  'Encantador de Almas',
  'Encantador Elemental',
  'Encantador dos Ventos',
  'Encantador do Caos',
  // 36-40 · Invocador
  'Invocador de Sombras',
  'Invocador de Chamas',
  'Invocador do Abismo',
  'Invocador Celestial',
  'Invocador Primordial',
  // 41-45 · Ilusionista
  'Ilusionista Arcano',
  'Ilusionista Mental',
  'Ilusionista das Brumas',
  'Ilusionista dos Espelhos',
  'Ilusionista Onírico',
  // 46-50 · Arquimago
  'Arquimago Arcano',
  'Arquimago de Fogo',
  'Arquimago de Gelo',
  'Arquimago Sombrio',
  'Arquimago Celeste',
  // 51-55 · Sábio Arcano
  'Sábio Arcano',
  'Sábio das Eras',
  'Sábio das Estrelas',
  'Sábio dos Portais',
  'Sábio do Vácuo',
  // 56-60 · Mestre Elemental
  'Mestre do Fogo',
  'Mestre do Gelo',
  'Mestre dos Raios',
  'Mestre da Terra',
  'Mestre do Vento',
  // 61-65 · Senhor do Caos
  'Senhor do Caos',
  'Senhor das Sombras',
  'Senhor da Tempestade',
  'Senhor do Abismo',
  'Senhor da Ruína',
  // 66-70 · Guardião Arcano
  'Guardião Arcano',
  'Guardião do Santuário',
  'Guardião das Runas',
  'Guardião do Nexo',
  'Guardião Eterno',
  // 71-75 · Arquimago Supremo
  'Arquimago da Corte',
  'Arquimago do Conselho',
  'Arquimago Imperial',
  'Arquimago Ancestral',
  'Arquimago Supremo',
  // 76-80 · Mago Imperial
  'Mago da Corte',
  'Mago do Trono',
  'Mago Imperial',
  'Mago da Coroa',
  'Mago Real',
  // 81-85 · Lendário
  'Mago Lendário',
  'Bruxo Lendário',
  'Feiticeiro Lendário',
  'Conjurador Lendário',
  'Arquimago Lendário',
  // 86-90 · Mítico
  'Mago Mítico',
  'Bruxo Mítico',
  'Feiticeiro Mítico',
  'Invocador Mítico',
  'Arquimago Mítico',
  // 91-95 · Eterno
  'Mago Eterno',
  'Arcano Eterno',
  'Guardião Eterno',
  'Senhor Eterno',
  'Sábio Eterno',
  // 96-100 · Transcendente
  'Transcendente Arcano',
  'Transcendente Astral',
  'Transcendente Cósmico',
  'Transcendente Supremo',
  'Transcendente Absoluto',
];

export function rankTitle(level) {
  const idx = Math.min(MAX_LEVEL - 1, Math.max(0, Math.floor(level) - 1));
  return TITLES[idx];
}
