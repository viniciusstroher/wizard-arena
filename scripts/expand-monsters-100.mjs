/**
 * Gera expansão +100 monstros e escreve patches nos catálogos.
 * Uso: node scripts/expand-monsters-100.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const EXISTING = new Set(`
imp slime wraith goblin skeleton skeleton_archer wolf bat elf cyclops
minotaur harpy kobold zombie mummy ghoul ratman scorpion venom_snake
cultist gargoyle pixie dwarf_guard bandit pirate giant_toad wasp crab
yeti_cub shadow_wolf cave_troll swamp_slug desert_scavenger gnoll ice_imp
orc giant_spider fire_elemental bruxo ancient_scarab death_knight frost_mage
venom_hydra stone_golem blood_succubus nightmare_steed bone_whelp abyss_watcher
crystal_elemental plague_doctor war_troll shadow_assassin storm_elemental
magma_golem forest_guardian void_stalker ice_wyrm necromancer beholder dragon
lich demon grim_reaper frost_dragon bone_dragon kraken hydra_boss medusa
phoenix titan void_lord ancient_treant sand_worm flame_lord frost_lich
plague_queen storm_giant cerberus basilisk djinn archdemon world_serpent
frogman porcupine dune_viper moss_sprite scrap_golem raven_scout
bog_witch_apprentice crystal_bat iron_boar sand_archer frost_sprite cave_crawler
marsh_lurker ember_whelp bone_picker thorn_bush ash_rat coral_crab wind_sylph
tomb_guard spore_fungus glacier_cub night_owl brimstone_imp reed_stalker
thunder_hawk blood_ogre mirage_dancer frost_berserker venom_alchemist
obsidian_guardian soul_harvester lava_serpent mirror_wraith plague_rat_king
storm_rider ironbark_treant crimson_cultist void_imp_lord sapphire_drake
eclipse_sphinx magma_colossus arctic_leviathan blight_emperor chronomancer
dread_naga solar_phoenix abyssal_kraken bone_emperor world_ender
mushroom_brute salt_golem fox_trickster quill_hunter peat_zombie lantern_spirit
cliff_goat reef_shark dust_mephit bark_spider snow_hare torch_bearer
bog_mosquito rune_scribe clay_soldier pearl_diver night_panther hive_drone
frost_toad scrap_bandit vine_creeper cinder_sprite tunnel_mole glass_imp
thunder_boar blood_knight sand_djinni poison_archer jade_golem shadow_priest
bladed_mantis storm_witch furnace_beast crystal_archer void_hound plague_swarm
iron_sentinel aurora_mage ash_wyvern bone_reaver tempest_queen forge_titan
coral_empress nightmare_king elder_beholder doom_hydra astral_serpent
war_god_avatar necrotic_colossus chaos_primordial pebble_sprite reed_rat
tide_urchin cinder_moth pine_sprite copper_goblin mist_wisp brine_crab
soot_imp thistle_boar kelp_strider ember_gnat chalk_golem_cub dusk_ferret
bog_newt crystal_mite rust_scorpion pollen_pixie shale_basher frost_vole
tar_slug spark_sprite dune_jackal lichen_troll_cub ivory_skeleton
mangrove_croco storm_finch ash_cult_initiate prism_moth geyser_toad
carrion_vulture magma_grub void_mote salt_wraith iron_tick glacier_imp
thorn_imp cave_bat_swarm scrap_wolf coral_snake rune_imp peat_slime
wind_razor blood_leech frost_archer_novice shade_larva pyre_cultist
quartz_beetle acid_alchemist frost_wyvern bone_chanter hex_witch magma_brute
storm_centurion obsidian_raptor venom_naga crystal_guardian shadow_duelist
pyre_drake glacier_knight plague_harpy rune_golem blood_panther arcane_archer
furnace_golem void_serpent jade_monk thunder_drake mirror_knight blight_treant
ash_assassin sapphire_witch iron_hydra soul_thief cinder_titan_spawn
aurora_serpent grave_sentinel night_reaver ember_witch toxin_archer
acid_sovereign frost_empress bone_overlord hex_archon magma_tyrant
storm_colossus void_matriarch plague_sovereign solar_phoenix_lord
abyss_leviathan jade_emperor crimson_warlord necrotic_queen entropy_dragon
iron_behemoth mire_hydra_king astral_tyrant forge_emperor shadow_primordial
tide_kraken_lord
`.trim().split(/\s+/));

const FLOORS = {
  fire: ['volcano', 'hell', 'lava_field', 'ashland', 'obsidian'],
  ice: ['ice', 'snow', 'tundra', 'glacier', 'mountain', 'canyon'],
  swamp: ['swamp', 'sewer', 'mushroom', 'marsh', 'bramble', 'jungle'],
  desert: ['desert', 'oasis', 'ashland', 'saltflat', 'beach', 'obsidian'],
  forest: ['grass', 'jungle', 'meadow', 'enchanted', 'garden', 'bramble'],
  cave: ['cave', 'mountain', 'dungeon', 'ruins', 'canyon', 'battlefield'],
  undead: ['graveyard', 'ruins', 'dungeon', 'shadow', 'catacomb', 'battlefield', 'blood'],
  sea: ['sea', 'beach', 'coral', 'abyss'],
  sky: ['sky', 'mountain', 'aurora', 'storm', 'canyon', 'meadow'],
  crystal: ['crystal', 'cave', 'enchanted', 'temple', 'sandstone', 'abyss'],
  shadow: ['shadow', 'graveyard', 'ruins', 'crystal', 'dungeon', 'catacomb'],
  temple: ['temple', 'ruins', 'dungeon', 'sandstone', 'library', 'battlefield'],
  hell: ['hell', 'volcano', 'lava_field', 'blood'],
  mixed: ['dungeon', 'ruins', 'wood', 'dirt', 'library', 'battlefield'],
};

const THEMES = [
  // [id, labelPT, template, theme, color, attackHint]
  // ── Normals (48) ──
  ['amber_mite', 'ácaro âmbar', 'beast', 'desert', 0xd4a017, 'melee'],
  ['fog_hare', 'lebre da névoa', 'beast', 'forest', 0xd5d8dc, 'melee'],
  ['driftwood_crab', 'caranguejo de madeira', 'beast', 'sea', 0x8b7355, 'melee'],
  ['pollen_moth', 'mariposa de pólen', 'winged', 'forest', 0xf9e79f, 'ranged_orb'],
  ['basalt_cub', 'filhote de basalto', 'bulk', 'cave', 0x2c3e50, 'melee'],
  ['reed_imp', 'imp de junco', 'winged', 'swamp', 0x7d6608, 'ranged_fire'],
  ['snow_finch', 'tentilhão da neve', 'winged', 'ice', 0xeaf2f8, 'melee'],
  ['salt_scorpion', 'escorpião de sal', 'beast', 'desert', 0xf5e6c8, 'melee'],
  ['moss_newt', 'tritão de musgo', 'beast', 'swamp', 0x556b2f, 'melee'],
  ['copper_tick', 'carrapato de cobre', 'beast', 'cave', 0xb87333, 'melee'],
  ['tide_sprite', 'sprite das marés', 'winged', 'sea', 0x48c9b0, 'caster_ice'],
  ['ash_vole', 'arganaz de cinzas', 'beast', 'fire', 0x6e2c00, 'melee'],
  ['bramble_boar', 'javali de sarças', 'beast', 'forest', 0x6e4a2e, 'melee'],
  ['chalk_imp', 'imp de giz', 'winged', 'temple', 0xf5e6c8, 'caster_fire'],
  ['mire_slug', 'lesma do lodo', 'serpent', 'swamp', 0x4a6741, 'melee'],
  ['gust_sylph', 'sylph da rajada', 'winged', 'sky', 0xaed6f1, 'caster_arc'],
  ['onyx_beetle', 'besouro de ônix', 'beast', 'cave', 0x1c2833, 'melee'],
  ['peat_rat', 'rato de turfa', 'beast', 'swamp', 0x5d4037, 'melee'],
  ['glint_pixie', 'pixie reluzente', 'winged', 'crystal', 0xd2b4de, 'caster_hex'],
  ['dune_scarab', 'escaravelho das dunas', 'beast', 'desert', 0xc9a227, 'melee'],
  ['frost_gnat', 'mosquito glacial', 'winged', 'ice', 0x85c1e9, 'ranged_orb'],
  ['root_crawler', 'rastejante de raízes', 'beast', 'forest', 0x1e8449, 'melee'],
  ['cinder_toad', 'sapo de brasas', 'bulk', 'fire', 0xe67e22, 'melee'],
  ['pearl_slug', 'lesma de pérola', 'serpent', 'sea', 0xf5eef8, 'melee'],
  ['rune_mite', 'ácaro rúnico', 'beast', 'temple', 0xaf7ac5, 'caster_hex'],
  ['shadow_vole', 'arganaz sombrio', 'beast', 'shadow', 0x2c2c3a, 'melee'],
  ['coral_urchin', 'ouriço de coral', 'bulk', 'sea', 0xe74c3c, 'melee'],
  ['pine_imp', 'imp de pinheiro', 'winged', 'forest', 0x145a32, 'ranged_arrow'],
  ['slag_imp', 'imp de escória', 'winged', 'fire', 0x935116, 'ranged_fire'],
  ['ice_tick', 'carrapato de gelo', 'beast', 'ice', 0xd6eaf8, 'melee'],
  ['bog_finch', 'tentilhão do pântano', 'winged', 'swamp', 0x7dcea0, 'melee'],
  ['quartz_mite', 'ácaro de quartzo', 'beast', 'crystal', 0xaed6f1, 'melee'],
  ['dust_jackal', 'chacal de pó', 'beast', 'desert', 0xc2a05a, 'melee'],
  ['kelp_newt', 'tritão de algas', 'beast', 'sea', 0x117a65, 'melee'],
  ['ember_vole', 'arganaz de brasas', 'beast', 'fire', 0xcb4335, 'melee'],
  ['thorn_mite', 'ácaro de espinhos', 'beast', 'forest', 0x27ae60, 'melee'],
  ['mist_imp', 'imp da névoa', 'winged', 'shadow', 0x95a5a6, 'caster_ice'],
  ['shale_tick', 'carrapato de xisto', 'beast', 'cave', 0x7f8c8d, 'melee'],
  ['aurora_moth', 'mariposa da aurora', 'winged', 'sky', 0xaf7ac5, 'ranged_orb'],
  ['blood_mite', 'ácaro de sangue', 'beast', 'undead', 0xc0392b, 'melee'],
  ['salt_newt', 'tritão de sal', 'beast', 'desert', 0xf5e6c8, 'melee'],
  ['vine_imp', 'imp de vinhas', 'winged', 'forest', 0x1abc9c, 'caster_acid'],
  ['glacier_mite', 'ácaro glacial', 'beast', 'ice', 0x5dade2, 'melee'],
  ['scrap_tick', 'carrapato de sucata', 'beast', 'cave', 0x85929e, 'melee'],
  ['void_gnat', 'mosquito do vazio', 'winged', 'shadow', 0x4a0080, 'ranged_orb'],
  ['marsh_imp', 'imp do pântano', 'winged', 'swamp', 0x556b2f, 'caster_acid'],
  ['crystal_finch', 'tentilhão de cristal', 'winged', 'crystal', 0xd6eaf8, 'melee'],
  ['pyre_mite', 'ácaro da pira', 'beast', 'hell', 0xe74c3c, 'melee'],

  // ── Elites (32) ──
  ['amber_golem', 'golem âmbar', 'bulk', 'desert', 0xd4a017, 'melee'],
  ['fog_wraith', 'espectro da névoa', 'humanoid', 'shadow', 0xd5d8dc, 'caster_ice'],
  ['drift_krakenling', 'kraken jovem', 'bulk', 'sea', 0x1a5276, 'melee'],
  ['pollen_witch', 'bruxa de pólen', 'humanoid', 'forest', 0xf9e79f, 'caster_hex'],
  ['basalt_guardian', 'guardião de basalto', 'bulk', 'cave', 0x2c3e50, 'melee'],
  ['reed_naga', 'naga de junco', 'serpent', 'swamp', 0x7d6608, 'caster_acid'],
  ['snow_berserker', 'berserker da neve', 'humanoid', 'ice', 0xeaf2f8, 'melee'],
  ['salt_goliath', 'golias de sal', 'bulk', 'desert', 0xf5e6c8, 'melee'],
  ['moss_treant', 'treant de musgo', 'bulk', 'swamp', 0x556b2f, 'caster_poison'],
  ['copper_sentinel', 'sentinela de cobre', 'bulk', 'cave', 0xb87333, 'ranged_arrow'],
  ['tide_witch', 'bruxa das marés', 'humanoid', 'sea', 0x48c9b0, 'caster_frost_breath'],
  ['ash_assassin_adept', 'assassino de cinzas adepto', 'humanoid', 'fire', 0x6e2c00, 'melee'],
  ['bramble_hydra', 'hidra de sarças', 'serpent', 'forest', 0x6e4a2e, 'melee'],
  ['chalk_mage', 'mago de giz', 'humanoid', 'temple', 0xf5e6c8, 'caster_crystal'],
  ['mire_hydra', 'hidra do lodo', 'serpent', 'swamp', 0x4a6741, 'caster_poison'],
  ['gust_djinn', 'djinn da rajada', 'winged', 'sky', 0xaed6f1, 'caster_storm'],
  ['onyx_knight', 'cavaleiro de ônix', 'humanoid', 'cave', 0x1c2833, 'melee'],
  ['peat_necromancer', 'necromante de turfa', 'humanoid', 'undead', 0x5d4037, 'caster_bone'],
  ['glint_sphinx', 'esfinge reluzente', 'beast', 'crystal', 0xd2b4de, 'caster_hex'],
  ['dune_wyrm', 'serpe das dunas', 'serpent', 'desert', 0xc9a227, 'caster_magma'],
  ['frost_centurion', 'centurião glacial', 'humanoid', 'ice', 0x85c1e9, 'melee'],
  ['root_guardian', 'guardião de raízes', 'bulk', 'forest', 0x1e8449, 'caster_thorn'],
  ['cinder_drake', 'drake de brasas', 'winged', 'fire', 0xe67e22, 'caster_firebreath'],
  ['pearl_siren', 'sereia de pérola', 'humanoid', 'sea', 0xf5eef8, 'caster_ice'],
  ['rune_archon_adept', 'adepto arconte rúnico', 'humanoid', 'temple', 0xaf7ac5, 'caster_hex'],
  ['shadow_duelist_elite', 'duelista sombrio elite', 'humanoid', 'shadow', 0x2c2c3a, 'melee'],
  ['coral_hydra', 'hidra de coral', 'serpent', 'sea', 0xe74c3c, 'caster_acid'],
  ['pine_treant', 'treant de pinheiro', 'bulk', 'forest', 0x145a32, 'caster_thorn'],
  ['slag_golem', 'golem de escória', 'bulk', 'fire', 0x935116, 'caster_magma'],
  ['ice_wyvern_adept', 'wyvern glacial adepto', 'winged', 'ice', 0xd6eaf8, 'caster_frost_breath'],
  ['bog_alchemist', 'alquimista do pântano', 'humanoid', 'swamp', 0x7dcea0, 'caster_acid'],
  ['quartz_guardian', 'guardião de quartzo', 'bulk', 'crystal', 0xaed6f1, 'caster_crystal'],

  // ── Bosses (20) ──
  ['amber_sovereign', 'soberano âmbar', 'bulk', 'desert', 0xd4a017, 'boss_solar'],
  ['fog_matriarch', 'matriarca da névoa', 'winged', 'shadow', 0xd5d8dc, 'boss_void'],
  ['drift_kraken_king', 'rei kraken das correntes', 'bulk', 'sea', 0x1a5276, 'boss_tidal'],
  ['pollen_empress', 'imperatriz de pólen', 'winged', 'forest', 0xf9e79f, 'boss_plague'],
  ['basalt_colossus', 'colosso de basalto', 'bulk', 'cave', 0x2c3e50, 'boss_beam'],
  ['reed_hydra_queen', 'rainha hidra de junco', 'serpent', 'swamp', 0x7d6608, 'boss_plague'],
  ['snow_emperor', 'imperador da neve', 'humanoid', 'ice', 0xeaf2f8, 'boss_frost'],
  ['salt_tyrant', 'tirano de sal', 'bulk', 'desert', 0xf5e6c8, 'boss_solar'],
  ['moss_world_tree', 'árvore-mundo de musgo', 'bulk', 'forest', 0x556b2f, 'boss_plague'],
  ['copper_behemoth', 'beemote de cobre', 'bulk', 'cave', 0xb87333, 'boss_beam'],
  ['tide_leviathan', 'leviatã das marés', 'serpent', 'sea', 0x48c9b0, 'boss_tidal'],
  ['ash_warlord', 'senhor da guerra de cinzas', 'humanoid', 'fire', 0x6e2c00, 'boss_inferno'],
  ['bramble_primordial', 'primordial de sarças', 'bulk', 'forest', 0x6e4a2e, 'boss_plague'],
  ['chalk_archon', 'arconte de giz', 'humanoid', 'temple', 0xf5e6c8, 'boss_rift'],
  ['mire_sovereign', 'soberano do lodo', 'serpent', 'swamp', 0x4a6741, 'boss_plague'],
  ['gust_storm_lord', 'senhor da rajada', 'winged', 'sky', 0xaed6f1, 'boss_storm'],
  ['onyx_overlord', 'suserano de ônix', 'humanoid', 'cave', 0x1c2833, 'boss_void'],
  ['peat_bone_king', 'rei ósseo de turfa', 'humanoid', 'undead', 0x5d4037, 'boss_death'],
  ['glint_astral_lord', 'senhor astral reluzente', 'winged', 'crystal', 0xd2b4de, 'boss_rift'],
  ['dune_sand_emperor', 'imperador das areias', 'serpent', 'desert', 0xc9a227, 'boss_solar'],
];

if (THEMES.length !== 100) {
  console.error('Expected 100 themes, got', THEMES.length);
  process.exit(1);
}

for (const [id] of THEMES) {
  if (EXISTING.has(id)) {
    console.error('Duplicate id:', id);
    process.exit(1);
  }
}

function spellLoadout(hint, tier) {
  const map = {
    caster_fire: ['firebolt'],
    caster_ice: ['ice_shard'],
    caster_arc: ['arc_lightning'],
    caster_hex: ['hex_bolt'],
    caster_acid: ['acid_bolt'],
    caster_crystal: ['crystal_bolt'],
    caster_poison: ['poison_cloud', 'acid_bolt', 'firebolt'],
    caster_frost_breath: ['frost_breath', 'ice_shard', 'crystal_bolt'],
    caster_firebreath: ['firebreath', 'firebolt', 'magma_surge'],
    caster_magma: ['magma_surge', 'firebreath', 'firebolt'],
    caster_storm: ['electric_storm', 'arc_lightning', 'electric_bolt'],
    caster_bone: ['bone_volley', 'hex_bolt', 'ice_shard'],
    caster_thorn: ['thorn_nova', 'acid_bolt', 'poison_cloud'],
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

function buildDef(entry, index) {
  const [id, , , , color, hint] = entry;
  const isBoss = index >= 80;
  const isElite = index >= 48 && index < 80;
  const difficulty = isBoss
    ? ['nightmare', 'apocalypse', 'hard', 'apocalypse'][index % 4]
    : isElite
      ? ['hard', 'nightmare', 'apocalypse', 'hard'][index % 4]
      : ['normal', 'normal', 'hard', 'normal'][index % 4];

  const weight = isBoss ? 'boss' : isElite ? 'elite' : 'common';
  let hpMul, speedMul, dmgMul, radius;

  if (isBoss) {
    hpMul = +(4.5 + (index % 7) * 0.1).toFixed(2);
    speedMul = +(0.42 + (index % 5) * 0.06).toFixed(2);
    dmgMul = +(1.55 + (index % 6) * 0.05).toFixed(2);
    radius = 42 + (index % 8);
  } else if (isElite) {
    hpMul = +(1.85 + (index % 9) * 0.1).toFixed(2);
    speedMul = +(0.65 + (index % 8) * 0.07).toFixed(2);
    dmgMul = +(1.35 + (index % 5) * 0.05).toFixed(2);
    radius = 14 + (index % 9);
  } else {
    hpMul = +(0.7 + (index % 10) * 0.1).toFixed(2);
    speedMul = +(0.8 + (index % 9) * 0.08).toFixed(2);
    dmgMul = +(0.85 + (index % 6) * 0.08).toFixed(2);
    radius = 11 + (index % 8);
  }

  const lines = [];
  lines.push(`    ${id}: {`);
  lines.push(`      hpMul: ${hpMul.toFixed(2)}, speedMul: ${speedMul.toFixed(2)}, dmgMul: ${dmgMul.toFixed(2)}, radius: ${radius}, color: 0x${color.toString(16).padStart(6, '0')},`);

  if (hint === 'melee') {
    const cd = isBoss ? 1.1 : isElite ? +(0.65 + (index % 5) * 0.1).toFixed(2) : +(0.7 + (index % 6) * 0.1).toFixed(2);
    lines.push(`      attack: 'melee', attackCooldown: ${cd},`);
  } else if (hint.startsWith('ranged_')) {
    const proj = hint === 'ranged_arrow' ? 'arrow' : hint === 'ranged_fire' ? 'fireball' : 'orb';
    const pColor =
      proj === 'arrow' ? 0xd4c4a0 : proj === 'fireball' ? 0xff6622 : 0x88ddff;
    lines.push(`      attack: 'ranged', projectile: '${proj}',`);
    lines.push(
      `      range: ${185 + (index % 5) * 10}, preferRange: ${120 + (index % 4) * 10}, projectileSpeed: ${230 + (index % 6) * 20}, projectileRadius: ${proj === 'arrow' ? 4 : 6}, projectileColor: 0x${pColor.toString(16)}, attackCooldown: ${(1.15 + (index % 4) * 0.1).toFixed(2)},`
    );
  } else {
    const spells = spellLoadout(hint, isBoss ? 'boss' : isElite ? 'elite' : 'normal') || ['firebolt'];
    const spellStr = spells.map((s) => `'${s}'`).join(', ');
    lines.push(`      attack: 'caster', spells: [${spellStr}],`);
    const range = isBoss ? 270 + (index % 5) * 8 : isElite ? 240 + (index % 4) * 8 : 210 + (index % 3) * 8;
    const prefer = Math.round(range * 0.58);
    const extras = [];
    if (spells.some((s) => ['flame_nova', 'magma_surge', 'thorn_nova', 'poison_cloud', 'electric_storm', 'tidal_crush', 'abyss_nova', 'plague_burst', 'entropy_pulse', 'shadow_eclipse', 'frost_apocalypse', 'void_collapse'].includes(s))) {
      extras.push(`novaRadius: ${isBoss ? 125 + (index % 5) * 5 : 105}, novaCooldown: ${isBoss ? 4.5 : 4}`);
    }
    if (spells.some((s) => ['bone_volley', 'skull_wave'].includes(s))) {
      extras.push(`skullCount: ${isBoss ? 12 : 7}`);
    }
    const pColor = color;
    lines.push(
      `      range: ${range}, preferRange: ${prefer}, projectileSpeed: ${360 + (index % 5) * 20}, projectileRadius: ${isBoss ? 10 : 8}, projectileColor: 0x${pColor.toString(16).padStart(6, '0')}, attackCooldown: ${(1.1 + (index % 3) * 0.05).toFixed(2)}${extras.length ? `, ${extras.join(', ')}` : ''},`
    );
  }

  if (isBoss) lines.push(`      weight: boss, isBoss: true, difficulty: '${difficulty}',`);
  else if (isElite) lines.push(`      weight: elite, isElite: true, difficulty: '${difficulty}',`);
  else lines.push(`      weight: common, difficulty: '${difficulty}',`);
  lines.push(`    },`);
  return lines.join('\n');
}

function darken(c, f = 0.6) {
  const r = Math.floor(((c >> 16) & 0xff) * f);
  const g = Math.floor(((c >> 8) & 0xff) * f);
  const b = Math.floor((c & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}
function lighten(c, f = 1.35) {
  const r = Math.min(255, Math.floor(((c >> 16) & 0xff) * f));
  const g = Math.min(255, Math.floor(((c >> 8) & 0xff) * f));
  const b = Math.min(255, Math.floor((c & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}
function eyeColor(c) {
  return lighten(c, 1.6) | 0x220000;
}

// ── Generate blocks ──
const typeLines = ['\n    // ─── Expansão 4 +100 ─────────────────────────────────────'];
typeLines.push('    // Normals (48)');
for (let i = 0; i < 48; i++) typeLines.push(buildDef(THEMES[i], i));
typeLines.push('\n    // Elites (32)');
for (let i = 48; i < 80; i++) typeLines.push(buildDef(THEMES[i], i));
typeLines.push('\n    // Bosses (20)');
for (let i = 80; i < 100; i++) typeLines.push(buildDef(THEMES[i], i));

const habitatLines = [];
for (const [id, , , theme] of THEMES) {
  const floors = FLOORS[theme] || FLOORS.mixed;
  habitatLines.push(`  ${id}: [${floors.map((f) => `'${f}'`).join(', ')}],`);
}

const labelLines = [];
for (const [id, label] of THEMES) {
  labelLines.push(`  ${id}: '${label}',`);
}

const spriteLines = ['      // Expansão 4 +100'];
for (const [id, , template, , color] of THEMES) {
  const body = color;
  const dark = darken(color, 0.55);
  const light = lighten(color, 1.3);
  const eye = eyeColor(color);
  const accent = darken(color, 0.35);
  spriteLines.push(
    `      ['${id}', '${template}', 0x${body.toString(16).padStart(6, '0')}, 0x${dark.toString(16).padStart(6, '0')}, 0x${light.toString(16).padStart(6, '0')}, 0x${eye.toString(16).padStart(6, '0')}, 0x${accent.toString(16).padStart(6, '0')}],`
  );
}

// Write generated fragments
const outDir = path.join(root, 'scripts', '_gen');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'types.js'), typeLines.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'habitats.js'), habitatLines.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'labels.js'), labelLines.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'sprites.js'), spriteLines.join('\n') + '\n');

// Patch files
function insertBefore(filePath, marker, block) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes('Expansão 4 +100') || src.includes('amber_mite')) {
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
  typeLines.join('\n') + '\n'
);

insertBefore(
  path.join(root, 'server/monsterHabitats.js'),
  '};\n\nexport function floorsForMonster',
  habitatLines.join('\n') + '\n'
);

insertBefore(
  path.join(root, 'client/src/catalog/monsterLabels.js'),
  '};\n\nexport function monsterLabel',
  labelLines.join('\n') + '\n'
);

insertBefore(
  path.join(root, 'client/src/scenes/BootScene.js'),
  '    ];\n\n    const clampCh',
  spriteLines.join('\n') + '\n'
);

console.log('Done. Generated', THEMES.length, 'monsters.');
