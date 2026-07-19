/**
 * Expansão 5: +100 variantes das criaturas existentes
 * (ex.: orc → orc_war_chief / "orc chefe da guerra")
 * Uso: node scripts/expand-monster-variants-100.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMonsterTypeDefs } from '../server/monsterTypes.js';
import { MONSTER_FLOORS } from '../server/monsterHabitats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const CONFIG = {
  MONSTER_WEIGHT_COMMON: 10,
  MONSTER_WEIGHT_ELITE: 3,
  MONSTER_WEIGHT_BOSS: 1,
};
const existingDefs = createMonsterTypeDefs(CONFIG);
const EXISTING = new Set(Object.keys(existingDefs));

/**
 * [id, labelPT, baseId, template, attackHint]
 * Cores/floors herdados do base quando possível.
 */
const VARIANTS = [
  // ── Normals (48) — recrutas / jovens / batedores ──
  ['orc_recruit', 'orc recruta', 'orc', 'beast', 'melee'],
  ['goblin_scout', 'goblin batedor', 'goblin', 'humanoid', 'ranged_arrow'],
  ['slime_spawn', 'slime cria', 'slime', 'bulk', 'melee'],
  ['wolf_pup', 'filhote de lobo', 'wolf', 'beast', 'melee'],
  ['skeleton_recruit', 'esqueleto recruta', 'skeleton', 'humanoid', 'melee'],
  ['bat_hatchling', 'morcego filhote', 'bat', 'winged', 'melee'],
  ['imp_whelp', 'imp filhote', 'imp', 'winged', 'ranged_fire'],
  ['elf_apprentice', 'elfo aprendiz', 'elf', 'humanoid', 'ranged_arrow'],
  ['zombie_thrall', 'zumbi servo', 'zombie', 'humanoid', 'melee'],
  ['mummy_servant', 'múmia serva', 'mummy', 'humanoid', 'melee'],
  ['ghoul_scavenger', 'carniçal necrófago', 'ghoul', 'humanoid', 'melee'],
  ['kobold_miner', 'kobold mineiro', 'kobold', 'humanoid', 'ranged_arrow'],
  ['bandit_thug', 'bandido capanga', 'bandit', 'humanoid', 'melee'],
  ['pirate_deckhand', 'pirata grumete', 'pirate', 'humanoid', 'melee'],
  ['cyclops_youth', 'ciclope jovem', 'cyclops', 'bulk', 'melee'],
  ['minotaur_calf', 'minotauro jovem', 'minotaur', 'beast', 'melee'],
  ['harpy_fledgling', 'harpía filhote', 'harpy', 'winged', 'ranged_orb'],
  ['scorpion_nymph', 'escorpião ninfa', 'scorpion', 'beast', 'melee'],
  ['cultist_initiate', 'cultista iniciado', 'cultist', 'humanoid', 'caster_fire'],
  ['gargoyle_shard', 'gárgula fragmento', 'gargoyle', 'winged', 'melee'],
  ['pixie_spark', 'pixie faísca', 'pixie', 'winged', 'caster_hex'],
  ['gnoll_pup', 'gnoll filhote', 'gnoll', 'beast', 'melee'],
  ['ratman_squeaker', 'homem-rato chiador', 'ratman', 'beast', 'melee'],
  ['crab_hatchling', 'caranguejo filhote', 'crab', 'beast', 'melee'],
  ['wasp_drone', 'vespa zangão', 'wasp', 'winged', 'melee'],
  ['toad_tadpole', 'sapo girino', 'giant_toad', 'bulk', 'melee'],
  ['dwarf_squire', 'anão escudeiro', 'dwarf_guard', 'humanoid', 'melee'],
  ['wraith_shade', 'espectro sombra', 'wraith', 'humanoid', 'melee'],
  ['frogman_poliwog', 'homem-sapo girino', 'frogman', 'humanoid', 'melee'],
  ['porcupine_kit', 'porco-espinho filhote', 'porcupine', 'beast', 'ranged_orb'],
  ['raven_chick', 'corvo filhote', 'raven_scout', 'winged', 'ranged_arrow'],
  ['boar_piglet', 'javali leitão', 'iron_boar', 'beast', 'melee'],
  ['owl_fledgling', 'coruja filhote', 'night_owl', 'winged', 'ranged_orb'],
  ['fox_kit', 'raposa filhote', 'fox_trickster', 'beast', 'caster_hex'],
  ['shark_pup', 'tubarão filhote', 'reef_shark', 'beast', 'melee'],
  ['hive_larva', 'larva da colmeia', 'hive_drone', 'beast', 'melee'],
  ['yeti_whelp', 'yeti filhote', 'yeti_cub', 'beast', 'melee'],
  ['spiderling', 'aranha filhote', 'giant_spider', 'beast', 'melee'],
  ['snake_hatchling', 'serpente filhote', 'venom_snake', 'serpent', 'melee'],
  ['desert_jackal_pup', 'chacal filhote', 'desert_scavenger', 'beast', 'melee'],
  ['troll_runt', 'troll nanico', 'cave_troll', 'bulk', 'melee'],
  ['slug_nymph', 'lesma ninfa', 'swamp_slug', 'serpent', 'melee'],
  ['ice_imp_spark', 'imp de gelo faísca', 'ice_imp', 'winged', 'caster_ice'],
  ['scarab_larva', 'escaravelho larva', 'ancient_scarab', 'beast', 'melee'],
  ['bone_shardling', 'fragmento ósseo', 'bone_whelp', 'winged', 'melee'],
  ['ember_spark', 'faísca de brasa', 'ember_whelp', 'winged', 'ranged_fire'],
  ['ash_rat_pup', 'rato de cinzas filhote', 'ash_rat', 'beast', 'melee'],
  ['coral_crab_hatch', 'caranguejo de coral filhote', 'coral_crab', 'beast', 'melee'],

  // ── Elites (32) — chefes / veteranos / capitães ──
  ['orc_war_chief', 'orc chefe da guerra', 'orc', 'beast', 'melee'],
  ['goblin_raid_captain', 'goblin capitão de raid', 'goblin', 'humanoid', 'ranged_arrow'],
  ['slime_overseer', 'slime supervisor', 'slime', 'bulk', 'caster_acid'],
  ['wolf_alpha', 'lobo alfa', 'wolf', 'beast', 'melee'],
  ['skeleton_captain', 'esqueleto capitão', 'skeleton', 'humanoid', 'melee'],
  ['bat_matriarch', 'morcego matriarca', 'bat', 'winged', 'melee'],
  ['imp_taskmaster', 'imp feitor', 'imp', 'winged', 'caster_fire'],
  ['elf_blademaster', 'elfo mestre das lâminas', 'elf', 'humanoid', 'ranged_arrow'],
  ['zombie_warlord', 'zumbi senhor da guerra', 'zombie', 'humanoid', 'melee'],
  ['mummy_pharaoh_guard', 'guarda do faraó', 'mummy', 'humanoid', 'melee'],
  ['ghoul_packleader', 'carniçal líder da matilha', 'ghoul', 'humanoid', 'melee'],
  ['kobold_trapmaster', 'kobold mestre das armadilhas', 'kobold', 'humanoid', 'ranged_arrow'],
  ['bandit_kingpin', 'bandido chefão', 'bandit', 'humanoid', 'melee'],
  ['pirate_captain', 'pirata capitão', 'pirate', 'humanoid', 'melee'],
  ['cyclops_champion', 'ciclope campeão', 'cyclops', 'bulk', 'melee'],
  ['minotaur_arena_lord', 'minotauro senhor da arena', 'minotaur', 'beast', 'melee'],
  ['harpy_stormcaller', 'harpía invocadora de tempestade', 'harpy', 'winged', 'caster_storm'],
  ['scorpion_broodmother', 'escorpião mãe da ninhada', 'scorpion', 'beast', 'melee'],
  ['cultist_hierophant', 'cultista hierofante', 'cultist', 'humanoid', 'caster_hex'],
  ['gargoyle_sentinel', 'gárgula sentinela', 'gargoyle', 'winged', 'melee'],
  ['pixie_queen_guard', 'guarda da rainha pixie', 'pixie', 'winged', 'caster_hex'],
  ['gnoll_packlord', 'gnoll senhor da matilha', 'gnoll', 'beast', 'melee'],
  ['ratman_warlord', 'homem-rato senhor da guerra', 'ratman', 'beast', 'melee'],
  ['crab_shellbreaker', 'caranguejo quebracascos', 'crab', 'beast', 'melee'],
  ['wasp_hivequeen_guard', 'guarda da rainha vespa', 'wasp', 'winged', 'caster_poison'],
  ['toad_bog_king', 'sapo rei do pântano', 'giant_toad', 'bulk', 'caster_poison'],
  ['dwarf_warcaptain', 'anão capitão de guerra', 'dwarf_guard', 'humanoid', 'melee'],
  ['wraith_reaper', 'espectro ceifador', 'wraith', 'humanoid', 'caster_bone'],
  ['frost_mage_adept', 'mago do gelo adepto', 'frost_mage', 'humanoid', 'caster_frost_breath'],
  ['death_knight_vanguard', 'cavaleiro da morte vanguarda', 'death_knight', 'humanoid', 'melee'],
  ['shadow_assassin_master', 'assassino sombrio mestre', 'shadow_assassin', 'humanoid', 'melee'],
  ['stone_golem_warden', 'golem de pedra guardião', 'stone_golem', 'bulk', 'melee'],

  // ── Bosses (20) — reis / imperadores / senhores ──
  ['orc_warchief_king', 'orc rei chefe da guerra', 'orc', 'beast', 'boss_inferno'],
  ['goblin_warlord_king', 'goblin rei senhor da guerra', 'goblin', 'humanoid', 'boss_beam'],
  ['slime_emperor', 'slime imperador', 'slime', 'bulk', 'boss_plague'],
  ['wolf_dire_king', 'lobo rei dire', 'wolf', 'beast', 'boss_void'],
  ['skeleton_bone_king', 'esqueleto rei dos ossos', 'skeleton', 'humanoid', 'boss_death'],
  ['imp_hell_overlord', 'imp suserano do inferno', 'imp', 'winged', 'boss_inferno'],
  ['elf_forest_sovereign', 'elfo soberano da floresta', 'elf', 'humanoid', 'boss_plague'],
  ['zombie_plague_king', 'zumbi rei da praga', 'zombie', 'humanoid', 'boss_plague'],
  ['mummy_pharaoh', 'múmia faraó', 'mummy', 'humanoid', 'boss_solar'],
  ['cyclops_mountain_king', 'ciclope rei da montanha', 'cyclops', 'bulk', 'boss_beam'],
  ['minotaur_labyrinth_king', 'minotauro rei do labirinto', 'minotaur', 'beast', 'boss_rift'],
  ['harpy_sky_empress', 'harpía imperatriz dos céus', 'harpy', 'winged', 'boss_storm'],
  ['cultist_dark_messiah', 'cultista messias sombrio', 'cultist', 'humanoid', 'boss_void'],
  ['gargoyle_cathedral_lord', 'gárgula senhor da catedral', 'gargoyle', 'winged', 'boss_beam'],
  ['gnoll_war_khan', 'gnoll khan da guerra', 'gnoll', 'beast', 'boss_inferno'],
  ['pirate_sea_emperor', 'pirata imperador dos mares', 'pirate', 'humanoid', 'boss_tidal'],
  ['bandit_crime_emperor', 'bandido imperador do crime', 'bandit', 'humanoid', 'boss_rift'],
  ['dwarf_forge_king', 'anão rei da forja', 'dwarf_guard', 'humanoid', 'boss_solar'],
  ['ratman_underking', 'homem-rato rei subterrâneo', 'ratman', 'beast', 'boss_plague'],
  ['scorpion_dune_emperor', 'escorpião imperador das dunas', 'scorpion', 'beast', 'boss_solar'],
];

if (VARIANTS.length !== 100) {
  console.error('Expected 100 variants, got', VARIANTS.length);
  process.exit(1);
}

for (const [id] of VARIANTS) {
  if (EXISTING.has(id)) {
    console.error('Duplicate id:', id);
    process.exit(1);
  }
}

function spellLoadout(hint, tier) {
  const map = {
    caster_fire: ['firebolt'],
    caster_ice: ['ice_shard'],
    caster_hex: ['hex_bolt'],
    caster_acid: ['acid_bolt'],
    caster_poison: ['poison_cloud', 'acid_bolt', 'firebolt'],
    caster_frost_breath: ['frost_breath', 'ice_shard', 'crystal_bolt'],
    caster_storm: ['electric_storm', 'arc_lightning', 'electric_bolt'],
    caster_bone: ['bone_volley', 'hex_bolt', 'ice_shard'],
    boss_solar: ['solar_judgment', 'magma_surge', 'flame_nova', 'firebolt'],
    boss_void: ['shadow_eclipse', 'entropy_pulse', 'hex_bolt', 'void_collapse'],
    boss_tidal: ['tidal_crush', 'abyss_nova', 'frost_breath', 'ice_shard'],
    boss_plague: ['plague_burst', 'poison_cloud', 'acid_bolt', 'thorn_nova'],
    boss_beam: ['cataclysm_beam', 'electric_storm', 'soul_lance', 'electric_bolt'],
    boss_frost: ['frost_apocalypse', 'frost_breath', 'ice_shard', 'crystal_bolt'],
    boss_inferno: ['infernal_judgment', 'magma_surge', 'firebreath', 'solar_judgment'],
    boss_rift: ['rift_lance', 'entropy_pulse', 'hex_bolt', 'void_collapse'],
    boss_storm: ['electric_storm', 'cataclysm_beam', 'electric_bolt', 'solar_judgment'],
    boss_death: ['death_knell', 'bone_volley', 'skull_wave', 'soul_rend'],
  };
  if (tier === 'normal' && hint.startsWith('caster_')) {
    const base = map[hint] || ['firebolt'];
    const singles = base.filter(
      (s) =>
        ![
          'poison_cloud',
          'flame_nova',
          'firebreath',
          'frost_breath',
          'magma_surge',
          'electric_storm',
          'thorn_nova',
          'bone_volley',
          'skull_wave',
        ].includes(s)
    );
    return singles.length ? singles.slice(0, 1) : ['firebolt'];
  }
  return map[hint] || null;
}

function darken(c, f = 0.55) {
  const r = Math.floor(((c >> 16) & 0xff) * f);
  const g = Math.floor(((c >> 8) & 0xff) * f);
  const b = Math.floor((c & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}
function lighten(c, f = 1.3) {
  const r = Math.min(255, Math.floor(((c >> 16) & 0xff) * f));
  const g = Math.min(255, Math.floor(((c >> 8) & 0xff) * f));
  const b = Math.min(255, Math.floor((c & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

function buildDef(entry, index) {
  const [id, , baseId, , hint] = entry;
  const base = existingDefs[baseId] || {};
  const color = base.color || 0x888888;
  const isBoss = index >= 80;
  const isElite = index >= 48 && index < 80;
  const difficulty = isBoss
    ? ['nightmare', 'apocalypse', 'hard', 'apocalypse'][index % 4]
    : isElite
      ? ['hard', 'nightmare', 'apocalypse', 'hard'][index % 4]
      : ['normal', 'normal', 'hard', 'normal'][index % 4];

  let hpMul, speedMul, dmgMul, radius;
  if (isBoss) {
    hpMul = +(4.6 + (index % 7) * 0.1).toFixed(2);
    speedMul = +(0.44 + (index % 5) * 0.06).toFixed(2);
    dmgMul = +(1.58 + (index % 6) * 0.05).toFixed(2);
    radius = 43 + (index % 7);
  } else if (isElite) {
    hpMul = +(1.9 + (index % 9) * 0.1).toFixed(2);
    speedMul = +(0.68 + (index % 8) * 0.07).toFixed(2);
    dmgMul = +(1.38 + (index % 5) * 0.05).toFixed(2);
    radius = 15 + (index % 8);
  } else {
    // Variantes normais: um pouco mais fracas/jovens que o base
    hpMul = +(0.65 + (index % 9) * 0.08).toFixed(2);
    speedMul = +(0.85 + (index % 8) * 0.07).toFixed(2);
    dmgMul = +(0.8 + (index % 6) * 0.07).toFixed(2);
    radius = 11 + (index % 7);
  }

  const lines = [];
  lines.push(`    ${id}: {`);
  lines.push(
    `      hpMul: ${hpMul.toFixed(2)}, speedMul: ${speedMul.toFixed(2)}, dmgMul: ${dmgMul.toFixed(2)}, radius: ${radius}, color: 0x${color.toString(16).padStart(6, '0')},`
  );

  if (hint === 'melee') {
    const cd = isBoss
      ? 1.05
      : isElite
        ? +(0.62 + (index % 5) * 0.1).toFixed(2)
        : +(0.72 + (index % 6) * 0.1).toFixed(2);
    lines.push(`      attack: 'melee', attackCooldown: ${cd},`);
  } else if (hint.startsWith('ranged_')) {
    const proj = hint === 'ranged_arrow' ? 'arrow' : hint === 'ranged_fire' ? 'fireball' : 'orb';
    const pColor = proj === 'arrow' ? 0xd4c4a0 : proj === 'fireball' ? 0xff6622 : 0x88ddff;
    lines.push(`      attack: 'ranged', projectile: '${proj}',`);
    lines.push(
      `      range: ${185 + (index % 5) * 10}, preferRange: ${120 + (index % 4) * 10}, projectileSpeed: ${230 + (index % 6) * 20}, projectileRadius: ${proj === 'arrow' ? 4 : 6}, projectileColor: 0x${pColor.toString(16)}, attackCooldown: ${(1.15 + (index % 4) * 0.1).toFixed(2)},`
    );
  } else {
    const spells =
      spellLoadout(hint, isBoss ? 'boss' : isElite ? 'elite' : 'normal') || ['firebolt'];
    const spellStr = spells.map((s) => `'${s}'`).join(', ');
    lines.push(`      attack: 'caster', spells: [${spellStr}],`);
    const range = isBoss
      ? 270 + (index % 5) * 8
      : isElite
        ? 240 + (index % 4) * 8
        : 210 + (index % 3) * 8;
    const prefer = Math.round(range * 0.58);
    const extras = [];
    if (
      spells.some((s) =>
        [
          'flame_nova',
          'magma_surge',
          'thorn_nova',
          'poison_cloud',
          'electric_storm',
          'tidal_crush',
          'abyss_nova',
          'plague_burst',
          'entropy_pulse',
          'shadow_eclipse',
          'frost_apocalypse',
          'void_collapse',
        ].includes(s)
      )
    ) {
      extras.push(
        `novaRadius: ${isBoss ? 125 + (index % 5) * 5 : 105}, novaCooldown: ${isBoss ? 4.5 : 4}`
      );
    }
    if (spells.some((s) => ['bone_volley', 'skull_wave'].includes(s))) {
      extras.push(`skullCount: ${isBoss ? 12 : 7}`);
    }
    lines.push(
      `      range: ${range}, preferRange: ${prefer}, projectileSpeed: ${360 + (index % 5) * 20}, projectileRadius: ${isBoss ? 10 : 8}, projectileColor: 0x${color.toString(16).padStart(6, '0')}, attackCooldown: ${(1.1 + (index % 3) * 0.05).toFixed(2)}${extras.length ? `, ${extras.join(', ')}` : ''},`
    );
  }

  if (isBoss) lines.push(`      weight: boss, isBoss: true, difficulty: '${difficulty}',`);
  else if (isElite) lines.push(`      weight: elite, isElite: true, difficulty: '${difficulty}',`);
  else lines.push(`      weight: common, difficulty: '${difficulty}',`);
  lines.push(`    },`);
  return lines.join('\n');
}

const typeLines = ['\n    // ─── Expansão 5 +100 (variantes) ───────────────────────'];
typeLines.push('    // Normals (48) — jovens / recrutas');
for (let i = 0; i < 48; i++) typeLines.push(buildDef(VARIANTS[i], i));
typeLines.push('\n    // Elites (32) — chefes / capitães');
for (let i = 48; i < 80; i++) typeLines.push(buildDef(VARIANTS[i], i));
typeLines.push('\n    // Bosses (20) — reis / imperadores');
for (let i = 80; i < 100; i++) typeLines.push(buildDef(VARIANTS[i], i));

const habitatLines = [];
for (const [id, , baseId] of VARIANTS) {
  const floors = MONSTER_FLOORS[baseId] || ['dungeon', 'ruins', 'battlefield'];
  habitatLines.push(`  ${id}: [${floors.map((f) => `'${f}'`).join(', ')}],`);
}

const labelLines = [];
for (const [id, label] of VARIANTS) {
  labelLines.push(`  ${id}: '${label}',`);
}

const spriteLines = ['      // Expansão 5 +100 (variantes)'];
for (const [id, , baseId, template] of VARIANTS) {
  const base = existingDefs[baseId] || {};
  const color = base.color || 0x888888;
  // Elites/bosses levemente mais escuros/ricos
  const body = color;
  const dark = darken(color, 0.52);
  const light = lighten(color, 1.28);
  const eye = lighten(color, 1.55);
  const accent = darken(color, 0.32);
  spriteLines.push(
    `      ['${id}', '${template}', 0x${body.toString(16).padStart(6, '0')}, 0x${dark.toString(16).padStart(6, '0')}, 0x${light.toString(16).padStart(6, '0')}, 0x${eye.toString(16).padStart(6, '0')}, 0x${accent.toString(16).padStart(6, '0')}],`
  );
}

function insertBefore(filePath, marker, block, alreadyToken) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes(alreadyToken)) {
    console.log('Already patched:', filePath);
    return;
  }
  const idx = src.lastIndexOf(marker);
  if (idx < 0) throw new Error(`Marker not found in ${filePath}: ${marker}`);
  src = src.slice(0, idx) + block + src.slice(idx);
  fs.writeFileSync(filePath, src);
  console.log('Patched', filePath);
}

insertBefore(
  path.join(root, 'server/monsterTypes.js'),
  '  };\n\n  // Habitats RPG',
  typeLines.join('\n') + '\n',
  'Expansão 5 +100'
);

insertBefore(
  path.join(root, 'server/monsterHabitats.js'),
  '};\n\nexport function floorsForMonster',
  habitatLines.join('\n') + '\n',
  'orc_war_chief'
);

insertBefore(
  path.join(root, 'client/src/catalog/monsterLabels.js'),
  '};\n\nexport function monsterLabel',
  labelLines.join('\n') + '\n',
  'orc_war_chief'
);

insertBefore(
  path.join(root, 'client/src/scenes/BootScene.js'),
  '    ];\n\n    const clampCh',
  spriteLines.join('\n') + '\n',
  'orc_war_chief'
);

console.log('Done. Generated', VARIANTS.length, 'variant monsters.');
console.log('Examples: orc_war_chief, goblin_raid_captain, skeleton_bone_king');
