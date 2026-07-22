/**
 * Tabela de drops dos monstros — qual item cada tipo de monstro pode dropar.
 * Baseado em D&D, Tibia e WoW.
 *
 * Estrutura:
 *   Cada monstro tem um array de [itemId, chance (0–1), qtyMin, qtyMax].
 *   A chance é a probabilidade de dropar AQUELE item quando o monstro morre.
 *   Vários itens podem dropar simultaneamente (cada um é sorteado independentemente).
 *
 * Bosses têm chances maiores e itens melhores.
 * Monstros de tiers mais altos dropam itens de níveis mais altos.
 */

const DROP_TABLE = {
  // ========== TIER 1 — Monstros fracos (imp, slime, goblin, etc.) ==========
  // Dropam itens de nível 1–5 (tiers t1 e t2)
  imp: [
    ['t1_hat_1', 0.08, 1, 1],
    ['t1_ring_3', 0.06, 1, 1],
    ['t1_boots_4', 0.05, 1, 1],
    ['copper_ore', 0.15, 1, 3],
    ['health_potion', 0.10, 1, 2],
  ],
  slime: [
    ['t1_tunic_2', 0.06, 1, 1],
    ['t1_necklace_4', 0.05, 1, 1],
    ['copper_ore', 0.12, 1, 2],
    ['iron_ore', 0.08, 1, 1],
  ],
  wraith: [
    ['t1_hat_5', 0.08, 1, 1],
    ['t1_cape_3', 0.07, 1, 1],
    ['shadow_ore', 0.08, 1, 1],
    ['magic_scroll', 0.06, 1, 1],
  ],
  goblin: [
    ['t1_boots_2', 0.07, 1, 1],
    ['t1_cape_5', 0.06, 1, 1],
    ['copper_ore', 0.14, 1, 3],
    ['brass_necklace', 0.05, 1, 1],
  ],
  skeleton: [
    ['t2_hat_1', 0.08, 1, 1],
    ['t2_tunic_3', 0.06, 1, 1],
    ['iron_ore', 0.10, 1, 2],
    ['ancient_coin', 0.04, 1, 1],
  ],
  skeleton_archer: [
    ['t2_hat_4', 0.08, 1, 1],
    ['t2_cape_3', 0.07, 1, 1],
    ['iron_ore', 0.10, 1, 2],
  ],
  wolf: [
    ['t2_cape_2', 0.06, 1, 1],
    ['t2_boots_3', 0.07, 1, 1],
    ['copper_ore', 0.10, 1, 1],
  ],
  bat: [
    ['t2_necklace_5', 0.07, 1, 1],
    ['t2_cape_4', 0.06, 1, 1],
    ['shadow_ore', 0.08, 1, 1],
  ],
  elf: [
    ['t3_hat_1', 0.09, 1, 1],
    ['t3_ring_2', 0.08, 1, 1],
    ['t3_tunic_5', 0.06, 1, 1],
    ['silver_ore', 0.10, 1, 2],
    ['mana_potion', 0.08, 1, 1],
  ],
  cyclops: [
    ['t3_boots_1', 0.08, 1, 1],
    ['t3_hat_3', 0.07, 1, 1],
    ['iron_ore', 0.12, 1, 2],
    ['brass_necklace', 0.06, 1, 1],
  ],
  minotaur: [
    ['t4_hat_1', 0.09, 1, 1],
    ['t4_tunic_4', 0.07, 1, 1],
    ['t4_ring_2', 0.07, 1, 1],
    ['iron_ore', 0.10, 1, 2],
    ['gold_ore', 0.05, 1, 1],
  ],
  harpy: [
    ['t4_cape_1', 0.09, 1, 1],
    ['t4_necklace_3', 0.07, 1, 1],
    ['t4_boots_5', 0.06, 1, 1],
    ['silver_ore', 0.10, 1, 2],
  ],

  // ========== TIER 2 — Monstros médios ==========
  kobold: [
    ['t2_ring_5', 0.08, 1, 1],
    ['t3_boots_4', 0.07, 1, 1],
    ['copper_ore', 0.12, 1, 3],
  ],
  zombie: [
    ['t3_tunic_1', 0.08, 1, 1],
    ['t3_hat_4', 0.07, 1, 1],
    ['iron_ore', 0.10, 1, 2],
    ['ancient_coin', 0.05, 1, 2],
  ],
  mummy: [
    ['t4_hat_1', 0.09, 1, 1],
    ['t4_ring_4', 0.07, 1, 1],
    ['gold_ore', 0.08, 1, 1],
    ['ancient_coin', 0.08, 1, 3],
  ],
  ghoul: [
    ['t3_necklace_3', 0.08, 1, 1],
    ['t4_cape_5', 0.07, 1, 1],
    ['shadow_ore', 0.10, 1, 2],
  ],
  ratman: [
    ['t3_boots_2', 0.07, 1, 1],
    ['t3_cape_5', 0.06, 1, 1],
    ['copper_ore', 0.10, 1, 2],
  ],
  scorpion: [
    ['t3_ring_4', 0.08, 1, 1],
    ['t4_boots_2', 0.07, 1, 1],
    ['amber_ore', 0.08, 1, 1],
  ],
  venom_snake: [
    ['t3_necklace_5', 0.08, 1, 1],
    ['t3_tunic_2', 0.07, 1, 1],
    ['emerald_ore', 0.06, 1, 1],
  ],
  cultist: [
    ['t4_hat_5', 0.09, 1, 1],
    ['t4_necklace_2', 0.08, 1, 1],
    ['t4_cape_3', 0.07, 1, 1],
    ['shadow_ore', 0.10, 1, 2],
    ['magic_scroll', 0.08, 1, 2],
  ],
  gargoyle: [
    ['t4_cape_1', 0.09, 1, 1],
    ['t4_hat_3', 0.08, 1, 1],
    ['quartz_ore', 0.08, 1, 1],
  ],
  pixie: [
    ['t4_ring_1', 0.09, 1, 1],
    ['t4_necklace_4', 0.08, 1, 1],
    ['crystal_ore', 0.08, 1, 1],
    ['mana_potion', 0.10, 1, 2],
  ],
  dwarf_guard: [
    ['t4_hat_1', 0.09, 1, 1],
    ['t4_tunic_3', 0.08, 1, 1],
    ['iron_ore', 0.14, 1, 3],
    ['gold_ore', 0.06, 1, 1],
  ],
  bandit: [
    ['t3_ring_3', 0.08, 1, 1],
    ['t4_boots_4', 0.07, 1, 1],
    ['silver_ore', 0.10, 1, 2],
    ['ancient_coin', 0.06, 1, 2],
  ],
  pirate: [
    ['t4_cape_4', 0.09, 1, 1],
    ['t4_boots_3', 0.08, 1, 1],
    ['coral_ore', 0.10, 1, 2],
    ['gold_ore', 0.06, 1, 1],
  ],

  // ========== TIER 3 — Monstros fortes ==========
  giant_toad: [
    ['t4_tunic_5', 0.08, 1, 1],
    ['t5_hat_2', 0.08, 1, 1],
    ['emerald_ore', 0.08, 1, 2],
  ],
  wasp: [
    ['t4_ring_5', 0.08, 1, 1],
    ['t5_necklace_3', 0.07, 1, 1],
    ['amber_ore', 0.08, 1, 1],
  ],
  crab: [
    ['t4_tunic_2', 0.08, 1, 1],
    ['t5_ring_4', 0.07, 1, 1],
    ['coral_ore', 0.10, 1, 2],
  ],
  yeti_cub: [
    ['t4_cape_2', 0.08, 1, 1],
    ['t5_boots_4', 0.07, 1, 1],
    ['sapphire_ore', 0.06, 1, 1],
  ],
  shadow_wolf: [
    ['t5_cape_1', 0.09, 1, 1],
    ['t5_hat_5', 0.08, 1, 1],
    ['shadow_ore', 0.12, 1, 2],
    ['obsidian_ore', 0.06, 1, 1],
  ],
  cave_troll: [
    ['t5_tunic_1', 0.10, 1, 1],
    ['t5_hat_4', 0.08, 1, 1],
    ['iron_ore', 0.15, 1, 3],
    ['diamond_ore', 0.04, 1, 1],
  ],
  swamp_slug: [
    ['t5_boots_5', 0.08, 1, 1],
    ['t5_necklace_4', 0.07, 1, 1],
    ['jade_ore', 0.08, 1, 1],
  ],
  desert_scavenger: [
    ['t5_hat_3', 0.08, 1, 1],
    ['t5_boots_2', 0.07, 1, 1],
    ['gold_ore', 0.10, 1, 2],
  ],
  gnoll: [
    ['t5_ring_5', 0.08, 1, 1],
    ['t5_cape_4', 0.07, 1, 1],
    ['silver_ore', 0.10, 1, 2],
  ],
  ice_imp: [
    ['t5_hat_1', 0.09, 1, 1],
    ['t5_necklace_5', 0.07, 1, 1],
    ['sapphire_ore', 0.08, 1, 1],
  ],
  orc: [
    ['t5_tunic_3', 0.09, 1, 1],
    ['t5_hat_2', 0.08, 1, 1],
    ['iron_ore', 0.14, 1, 3],
    ['gold_ore', 0.06, 1, 2],
  ],
  giant_spider: [
    ['t5_cape_5', 0.08, 1, 1],
    ['t5_necklace_2', 0.07, 1, 1],
    ['shadow_ore', 0.10, 1, 2],
  ],

  // ========== TIER 4 — Monstros elementais e mágicos ==========
  fire_elemental: [
    ['t6_hat_1', 0.10, 1, 1],
    ['t6_ring_3', 0.08, 1, 1],
    ['t6_tunic_4', 0.06, 1, 1],
    ['ruby_ore', 0.12, 1, 2],
    ['obsidian_ore', 0.08, 1, 1],
  ],
  bruxo: [
    ['t6_cape_1', 0.10, 1, 1],
    ['t6_hat_5', 0.08, 1, 1],
    ['t6_necklace_4', 0.07, 1, 1],
    ['shadow_ore', 0.12, 1, 2],
    ['magic_scroll', 0.10, 1, 2],
  ],
  ancient_scarab: [
    ['t6_tunic_5', 0.09, 1, 1],
    ['t6_ring_2', 0.08, 1, 1],
    ['amber_ore', 0.10, 1, 2],
    ['ancient_coin', 0.08, 1, 2],
  ],
  death_knight: [
    ['t7_hat_1', 0.11, 1, 1],
    ['t7_tunic_3', 0.09, 1, 1],
    ['t7_ring_5', 0.07, 1, 1],
    ['onyx_ore', 0.10, 1, 2],
    ['shadow_ore', 0.08, 1, 2],
  ],
  frost_mage: [
    ['t6_hat_3', 0.10, 1, 1],
    ['t6_cape_4', 0.08, 1, 1],
    ['t7_ring_4', 0.07, 1, 1],
    ['sapphire_ore', 0.12, 1, 2],
    ['mana_potion', 0.08, 1, 2],
  ],
  venom_hydra: [
    ['t7_tunic_1', 0.10, 1, 1],
    ['t7_necklace_3', 0.08, 1, 1],
    ['t7_boots_4', 0.07, 1, 1],
    ['emerald_ore', 0.10, 1, 2],
    ['jade_ore', 0.08, 1, 1],
  ],
  stone_golem: [
    ['t7_hat_4', 0.09, 1, 1],
    ['t7_tunic_2', 0.08, 1, 1],
    ['quartz_ore', 0.12, 1, 3],
    ['diamond_ore', 0.06, 1, 1],
  ],
  blood_succubus: [
    ['t7_cape_5', 0.10, 1, 1],
    ['t7_necklace_2', 0.09, 1, 1],
    ['ruby_ore', 0.10, 1, 2],
    ['shadow_ore', 0.08, 1, 1],
  ],
  nightmare_steed: [
    ['t7_cape_3', 0.10, 1, 1],
    ['t7_boots_5', 0.08, 1, 1],
    ['onyx_ore', 0.10, 1, 2],
  ],
  bone_whelp: [
    ['t6_tunic_2', 0.09, 1, 1],
    ['t7_hat_5', 0.07, 1, 1],
    ['iron_ore', 0.10, 1, 2],
  ],
  abyss_watcher: [
    ['t7_ring_1', 0.10, 1, 1],
    ['t7_necklace_5', 0.08, 1, 1],
    ['shadow_ore', 0.12, 1, 2],
    ['obsidian_ore', 0.08, 1, 2],
  ],

  // ========== TIER 5 — Dragões e criaturas lendárias ==========
  black_dragon: [
    ['t8_hat_1', 0.12, 1, 1],
    ['t8_cape_3', 0.10, 1, 1],
    ['t8_tunic_5', 0.08, 1, 1],
    ['onyx_ore', 0.12, 1, 3],
    ['shadow_ore', 0.10, 1, 2],
  ],
  red_dragon: [
    ['t8_hat_4', 0.12, 1, 1],
    ['t8_ring_1', 0.10, 1, 1],
    ['t8_boots_2', 0.08, 1, 1],
    ['ruby_ore', 0.12, 1, 3],
    ['gold_ore', 0.08, 1, 3],
  ],
  ice_dragon: [
    ['t8_hat_3', 0.12, 1, 1],
    ['t8_cape_5', 0.10, 1, 1],
    ['t8_necklace_2', 0.08, 1, 1],
    ['sapphire_ore', 0.12, 1, 3],
    ['diamond_ore', 0.08, 1, 2],
  ],
  green_dragon: [
    ['t8_tunic_1', 0.12, 1, 1],
    ['t8_ring_4', 0.10, 1, 1],
    ['t8_boots_3', 0.08, 1, 1],
    ['emerald_ore', 0.12, 1, 3],
    ['jade_ore', 0.08, 1, 2],
  ],
  iron_golem: [
    ['t8_tunic_4', 0.10, 1, 1],
    ['t8_hat_5', 0.09, 1, 1],
    ['iron_ore', 0.15, 1, 5],
    ['mythril_ore', 0.06, 1, 1],
  ],
  blood_demon: [
    ['t8_cape_1', 0.10, 1, 1],
    ['t8_necklace_4', 0.09, 1, 1],
    ['ruby_ore', 0.10, 1, 2],
    ['onyx_ore', 0.08, 1, 2],
  ],
  arch_lich: [
    ['t9_hat_1', 0.12, 1, 1],
    ['t9_ring_3', 0.10, 1, 1],
    ['t9_tunic_5', 0.08, 1, 1],
    ['shadow_ore', 0.12, 1, 3],
    ['magic_scroll', 0.10, 1, 2],
  ],
  phoenix: [
    ['t9_cape_1', 0.12, 1, 1],
    ['t9_hat_3', 0.10, 1, 1],
    ['t9_boots_4', 0.08, 1, 1],
    ['ruby_ore', 0.12, 1, 3],
    ['orichalcum_ore', 0.06, 1, 1],
  ],
  thunder_elemental: [
    ['t9_ring_1', 0.10, 1, 1],
    ['t9_hat_5', 0.08, 1, 1],
    ['sapphire_ore', 0.10, 1, 2],
    ['mythril_ore', 0.06, 1, 1],
  ],
  crystal_titan: [
    ['t9_tunic_1', 0.12, 1, 1],
    ['t9_boots_5', 0.10, 1, 1],
    ['diamond_ore', 0.12, 1, 3],
    ['crystal_ore', 0.10, 1, 3],
  ],
  shadow_lord: [
    ['t9_cape_5', 0.12, 1, 1],
    ['t9_necklace_2', 0.10, 1, 1],
    ['onyx_ore', 0.12, 1, 3],
    ['shadow_ore', 0.10, 1, 3],
  ],

  // ========== BOSSES — Todos os bosses dropam itens divinos (T10) ==========
  balrog: [
    ['t10_hat_1', 0.30, 1, 1],
    ['t10_tunic_3', 0.25, 1, 1],
    ['t10_ring_2', 0.20, 1, 1],
    ['t10_boots_4', 0.20, 1, 1],
    ['obsidian_ore', 0.40, 1, 5],
    ['ruby_ore', 0.30, 1, 5],
  ],
  demon_lord: [
    ['t10_cape_1', 0.30, 1, 1],
    ['t10_necklace_3', 0.25, 1, 1],
    ['t10_hat_5', 0.20, 1, 1],
    ['t10_ring_4', 0.20, 1, 1],
    ['onyx_ore', 0.40, 1, 5],
    ['shadow_ore', 0.30, 1, 5],
  ],
  chaos_dragon: [
    ['t10_tunic_1', 0.30, 1, 1],
    ['t10_cape_3', 0.25, 1, 1],
    ['t10_boots_5', 0.20, 1, 1],
    ['t10_necklace_5', 0.20, 1, 1],
    ['diamond_ore', 0.40, 1, 5],
    ['orichalcum_ore', 0.20, 1, 3],
  ],
  guardian_titan: [
    ['t10_hat_2', 0.30, 1, 1],
    ['t10_tunic_4', 0.25, 1, 1],
    ['t10_ring_5', 0.20, 1, 1],
    ['t10_cape_4', 0.20, 1, 1],
    ['mythril_ore', 0.40, 1, 5],
    ['moonstone_ore', 0.30, 1, 3],
  ],
  void_reaper: [
    ['t10_necklace_1', 0.30, 1, 1],
    ['t10_hat_4', 0.25, 1, 1],
    ['t10_cape_5', 0.20, 1, 1],
    ['t10_boots_2', 0.20, 1, 1],
    ['shadow_ore', 0.40, 1, 5],
    ['sunstone_ore', 0.30, 1, 3],
  ],
};

/**
 * Retorna os itens que o monstro dropa (array de { itemId, qty })
 * baseado na tabela de drops + chance. Todos os itens são sorteados.
 */
export function rollMonsterDrops(monsterType) {
  const drops = DROP_TABLE[monsterType];
  if (!drops) return null;
  const results = [];
  for (const [itemId, chance, qtyMin, qtyMax] of drops) {
    if (Math.random() < chance) {
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
  const drops = DROP_TABLE[monsterType];
  if (!drops) return null;
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
  return !!DROP_TABLE[monsterType];
}

export { DROP_TABLE };
