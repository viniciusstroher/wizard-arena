/**
 * Sorteio de drops dos monstros a partir da tabela em dropTable.js.
 */

import { CONFIG } from './config.js';
import { DROP_TABLE, resolveDropType } from './dropTable.js';

/**
 * Retorna os itens que o monstro dropa (array de { itemId, qty })
 * baseado na tabela de drops + chance. Todos os itens são sorteados.
 */
export function rollMonsterDrops(monsterType) {
  const baseType = resolveDropType(monsterType);
  if (!baseType) return null;
  const drops = DROP_TABLE[baseType];
  const mul = CONFIG.MONSTER_DROP_MULTIPLIER || 1;
  const results = [];
  for (const [itemId, chance, qtyMin, qtyMax] of drops) {
    if (Math.random() < Math.min(1, chance * mul)) {
      const qty = qtyMin === qtyMax ? qtyMin : qtyMin + Math.floor(Math.random() * (qtyMax - qtyMin + 1));
      results.push({ itemId, qty });
    }
  }
  return results.length > 0 ? results : null;
}

/**
 * Sorteia 1 item do monstro (escolhe aleatoriamente entre os drops,
 * ponderado pela chance de cada um).
 */
export function rollOneMonsterDrop(monsterType) {
  const baseType = resolveDropType(monsterType);
  if (!baseType) return null;
  const drops = DROP_TABLE[baseType];
  // Constrói lista ponderada: cada item aparece [chance*1000] vezes
  const pool = [];
  for (const [itemId, chance, qtyMin, qtyMax] of drops) {
    const weight = Math.max(1, Math.round(chance * 1000));
    for (let w = 0; w < weight; w++) pool.push({ itemId, qtyMin, qtyMax });
  }
  if (!pool.length) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const qty = pick.qtyMin === pick.qtyMax ? pick.qtyMin : pick.qtyMin + Math.floor(Math.random() * (pick.qtyMax - pick.qtyMin + 1));
  return [{ itemId: pick.itemId, qty }];
}

/**
 * Verifica se o monstro tem drops definidos.
 */
export function hasMonsterDrops(monsterType) {
  return !!resolveDropType(monsterType);
}

export { DROP_TABLE };
