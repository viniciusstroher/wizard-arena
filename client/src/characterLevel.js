/** Nível do personagem baseado nos pontos totais acumulados em partidas. */

/**
 * Pontos cumulativos necessários para atingir determinado nível.
 * Nível 1 → 0 pts, Nível 2 → 50 pts, Nível 3 → 150 pts, etc.
 * Fórmula: pts = 25 * L * (L - 1)
 */
export function pointsForLevel(level) {
  if (level <= 1) return 0;
  return 25 * level * (level - 1);
}

/**
 * Retorna o nível atual e progresso a partir dos pontos totais.
 *
 * @param {number} totalPoints - Pontos acumulados em todas as partidas
 * @returns {{ level: number, currentPts: number, nextPts: number, progress: number }}
 */
export function levelFromPoints(totalPoints) {
  const pts = Math.max(0, Math.floor(totalPoints));
  let level = 1;
  while (pointsForLevel(level + 1) <= pts) {
    level += 1;
  }
  const currentPts = pointsForLevel(level);
  const nextPts = pointsForLevel(level + 1);
  const range = nextPts - currentPts;
  const progress = range > 0 ? Math.min(1, (pts - currentPts) / range) : 1;
  return { level, currentPts, nextPts, progress };
}

/** Tabela de cores por faixa de nível (cicla a cada 10). */
const LEVEL_COLORS = [
  0x6b5cff, // 1-10  roxo
  0x2ecc71, // 11-20 verde
  0xe8b84a, // 21-30 dourado
  0xe85a5a, // 31-40 vermelho
  0x5dade2, // 41-50 azul
  0xf0a040, // 51+   laranja
];

export function levelColor(level) {
  const idx = Math.floor((level - 1) / 10) % LEVEL_COLORS.length;
  return LEVEL_COLORS[idx];
}

/** Label para a faixa de nível. */
const RANK_LABELS = [
  { min: 1, label: 'Aprendiz' },
  { min: 11, label: 'Invocador' },
  { min: 21, label: 'Arquimago' },
  { min: 31, label: 'Lorde Arcano' },
  { min: 41, label: 'Mestre Elemental' },
  { min: 51, label: 'Lendário' },
];

export function rankLabel(level) {
  for (let i = RANK_LABELS.length - 1; i >= 0; i--) {
    if (level >= RANK_LABELS[i].min) return RANK_LABELS[i].label;
  }
  return 'Aprendiz';
}
