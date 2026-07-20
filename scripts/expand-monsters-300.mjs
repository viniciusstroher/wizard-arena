/**
 * Expansão 8: +300 monstros novos + 12 magias exclusivas de monstro.
 * Uso: node scripts/expand-monsters-300.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMonsterTypeDefs } from '../server/monsterTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const CONFIG = {
  MONSTER_WEIGHT_COMMON: 10,
  MONSTER_WEIGHT_ELITE: 3,
  MONSTER_WEIGHT_BOSS: 1,
};
const EXISTING = new Set(Object.keys(createMonsterTypeDefs(CONFIG)));

const EXP_TAG = 'Expansão 8 +300';
const SPELL_TAG = 'Expansão 8 — exclusivas de monstro';

const FLOORS = {
  fire: ['volcano', 'hell', 'lava_field', 'ashland', 'obsidian'],
  ice: ['ice', 'snow', 'tundra', 'glacier', 'mountain', 'canyon'],
  swamp: ['swamp', 'sewer', 'mushroom', 'marsh', 'bramble', 'jungle'],
  desert: ['desert', 'oasis', 'ashland', 'saltflat', 'beach', 'obsidian'],
  forest: ['grass', 'jungle', 'meadow', 'enchanted', 'garden', 'bramble'],
  cave: ['cave', 'mountain', 'dungeon', 'ruins', 'canyon', 'battlefield', 'crystal_cave', 'bat_cave'],
  undead: ['graveyard', 'ruins', 'dungeon', 'shadow', 'catacomb', 'battlefield', 'blood', 'vampire_castle', 'throne_hall', 'crypt'],
  sea: ['sea', 'beach', 'coral', 'abyss'],
  sky: ['sky', 'mountain', 'aurora', 'storm', 'canyon', 'meadow'],
  crystal: ['crystal', 'cave', 'enchanted', 'temple', 'sandstone', 'abyss', 'crystal_cave'],
  shadow: ['shadow', 'graveyard', 'ruins', 'crystal', 'dungeon', 'catacomb', 'vampire_castle', 'throne_hall', 'crypt'],
  temple: ['temple', 'ruins', 'dungeon', 'sandstone', 'library', 'battlefield'],
  hell: ['hell', 'volcano', 'lava_field', 'blood'],
  mixed: ['dungeon', 'ruins', 'wood', 'dirt', 'library', 'battlefield'],
};

/** [en, pt, theme, color, templates[], attackHints by tier weight] */
const PREFIXES = [
  ['cinder', 'cinza', 'fire', 0x6e2c00],
  ['ember', 'brasa', 'fire', 0xe67e22],
  ['pyre', 'pira', 'fire', 0xc0392b],
  ['magma', 'magma', 'fire', 0xd35400],
  ['brimstone', 'enxofre', 'hell', 0xb03a2e],
  ['soot', 'fuligem', 'fire', 0x4a3728],
  ['kiln', 'forno', 'fire', 0xe65100],
  ['furnace', 'fornalha', 'hell', 0xbf360c],
  ['frost', 'geada', 'ice', 0x85c1e9],
  ['glacier', 'geleira', 'ice', 0xaed6f1],
  ['hail', 'granizo', 'ice', 0xb0bec5],
  ['rime', 'geada', 'ice', 0xd6eaf8],
  ['arctic', 'ártico', 'ice', 0x5dade2],
  ['blizzard', 'nevasca', 'ice', 0xeaf2f8],
  ['mire', 'lodo', 'swamp', 0x4a6741],
  ['bog', 'pântano', 'swamp', 0x556b2f],
  ['peat', 'turfa', 'swamp', 0x5d4037],
  ['spore', 'esporo', 'swamp', 0x7cb342],
  ['fungal', 'fúngico', 'swamp', 0x9ccc65],
  ['reed', 'junco', 'swamp', 0x7d6608],
  ['marsh', 'charco', 'swamp', 0x6b8e23],
  ['dune', 'duna', 'desert', 0xd4a017],
  ['sand', 'areia', 'desert', 0xf4d03f],
  ['salt', 'sal', 'desert', 0xf5e6c8],
  ['dust', 'pó', 'desert', 0xb08e48],
  ['mirage', 'miragem', 'desert', 0xe8daef],
  ['oasis', 'oásis', 'desert', 0x48c9b0],
  ['thorn', 'espinho', 'forest', 0x27ae60],
  ['vine', 'cipó', 'forest', 0x1e8449],
  ['moss', 'musgo', 'forest', 0x556b2f],
  ['bark', 'casca', 'forest', 0x6e4a2e],
  ['pine', 'pinheiro', 'forest', 0x2e7d32],
  ['bloom', 'flor', 'forest', 0xf8bbd0],
  ['root', 'raiz', 'forest', 0x6d4c41],
  ['cave', 'caverna', 'cave', 0x5d6d7e],
  ['shale', 'folhelho', 'cave', 0x7f8c8d],
  ['granite', 'granito', 'cave', 0x95a5a6],
  ['quartz', 'quartzo', 'crystal', 0xd5dbdb],
  ['obsidian', 'obsidiana', 'cave', 0x1c2833],
  ['tunnel', 'túnel', 'cave', 0x566573],
  ['grave', 'túmulo', 'undead', 0x7b7d7d],
  ['bone', 'osso', 'undead', 0xece5d0],
  ['crypt', 'cripta', 'undead', 0x4a4a5a],
  ['ghoul', 'carniçal', 'undead', 0x8fbc8f],
  ['wraith', 'espectro', 'undead', 0x8866ff],
  ['plague', 'praga', 'undead', 0x58d68d],
  ['tide', 'maré', 'sea', 0x48c9b0],
  ['brine', 'salmoura', 'sea', 0x26a69a],
  ['coral', 'coral', 'sea', 0xe91e63],
  ['kelp', 'alga', 'sea', 0x1b5e20],
  ['abyss', 'abismo', 'sea', 0x1a237e],
  ['reef', 'recife', 'sea', 0x00897b],
  ['storm', 'tempestade', 'sky', 0x5c6bc0],
  ['gale', 'vendaval', 'sky', 0xaed6f1],
  ['thunder', 'trovão', 'sky', 0xffdd33],
  ['cloud', 'nuvem', 'sky', 0xcfd8dc],
  ['aurora', 'aurora', 'sky', 0x80deea],
  ['zephyr', 'zéfiro', 'sky', 0xb3e5fc],
  ['prism', 'prisma', 'crystal', 0xce93d8],
  ['crystal', 'cristal', 'crystal', 0xaed6f1],
  ['glass', 'vidro', 'crystal', 0xa8d8ea],
  ['jade', 'jade', 'crystal', 0x27ae60],
  ['sapphire', 'safira', 'crystal', 0x2980b9],
  ['ruby', 'rubi', 'crystal', 0xc0392b],
  ['shadow', 'sombra', 'shadow', 0x1c1c28],
  ['void', 'vazio', 'shadow', 0x4a0080],
  ['dusk', 'crepúsculo', 'shadow', 0x5d4037],
  ['night', 'noite', 'shadow', 0x2c3e50],
  ['eclipse', 'eclipse', 'shadow', 0x212121],
  ['hex', 'hex', 'shadow', 0xaa44ff],
  ['rune', 'runa', 'temple', 0x8e44ad],
  ['temple', 'templo', 'temple', 0xd4c48a],
  ['idol', 'ídolo', 'temple', 0xc9a227],
  ['oracle', 'oráculo', 'temple', 0xffd54f],
  ['sacred', 'sagrado', 'temple', 0xf5e6c8],
  ['arcane', 'arcano', 'temple', 0x9b59b6],
  ['iron', 'ferro', 'mixed', 0x7f8c8d],
  ['scrap', 'sucata', 'mixed', 0xb7410e],
  ['copper', 'cobre', 'mixed', 0xb87333],
  ['bronze', 'bronze', 'mixed', 0xcd7f32],
  ['ashen', 'acinzentado', 'fire', 0x6e2c00],
  ['crimson', 'carmesim', 'hell', 0xc0392b],
  ['ivory', 'marfim', 'undead', 0xf5e6c8],
  ['onyx', 'ônix', 'cave', 0x1c2833],
  ['amber', 'âmbar', 'desert', 0xd4a017],
  ['violet', 'violeta', 'shadow', 0x7d3c98],
  ['azure', 'azul', 'sky', 0x3498db],
  ['verdant', 'verdejante', 'forest', 0x27ae60],
  ['scarlet', 'escarlate', 'hell', 0xe74c3c],
  ['pale', 'pálido', 'undead', 0xd5d8dc],
  ['hollow', 'oco', 'undead', 0x566573],
  ['gloom', 'treva', 'shadow', 0x2c3e50],
  ['bright', 'luminoso', 'crystal', 0xfff59d],
  ['wild', 'selvagem', 'forest', 0x6d4c41],
  ['feral', 'feroz', 'forest', 0x8d6e63],
  ['ancient', 'ancestral', 'temple', 0xb7950b],
  ['elder', 'ancião', 'temple', 0x7d6608],
  ['fallen', 'caído', 'undead', 0x5d6d7e],
  ['cursed', 'amaldiçoado', 'undead', 0x6c3483],
  ['blight', 'praga', 'swamp', 0x6b8e23],
  ['rot', 'podridão', 'swamp', 0x4a6741],
  ['toxic', 'tóxico', 'swamp', 0x88ff44],
  ['venom', 'veneno', 'swamp', 0x27ae60],
  ['lava', 'lava', 'fire', 0xff6622],
  ['coal', 'carvão', 'fire', 0x2c2c2c],
  ['slate', 'ardósia', 'cave', 0x708090],
  ['marble', 'mármore', 'temple', 0xeceff1],
  ['pearl', 'pérola', 'sea', 0xf5eef8],
  ['ink', 'tinta', 'sea', 0x1a237e],
  ['mist', 'névoa', 'sky', 0xd5d8dc],
  ['fog', 'neblina', 'forest', 0xb0bec5],
  ['spark', 'faísca', 'sky', 0xffee66],
  ['plasma', 'plasma', 'sky', 0x7cf0ff],
  ['solar', 'solar', 'temple', 0xf4d03f],
  ['lunar', 'lunar', 'shadow', 0xc5cae9],
  ['stellar', 'estelar', 'sky', 0xffd54f],
  ['chaos', 'caos', 'hell', 0x8e44ad],
  ['doom', 'perdição', 'hell', 0x4a235a],
  ['blood', 'sangue', 'hell', 0x922b21],
  ['soul', 'alma', 'undead', 0xd7bde2],
  ['spirit', 'espírito', 'undead', 0xbb8fce],
  ['dream', 'sonho', 'crystal', 0xf8bbd0],
  ['nightmare', 'pesadelo', 'shadow', 0x4a148c],
  ['rift', 'fenda', 'shadow', 0x9b59b6],
  ['warp', 'distorção', 'crystal', 0xaf7ac5],
  ['chrono', 'crono', 'temple', 0x5dade2],
  ['aether', 'éter', 'sky', 0xd2b4de],
  ['nether', 'nether', 'hell', 0x6c3483],
  ['prime', 'primordial', 'mixed', 0xb7950b],
  ['raw', 'bruto', 'cave', 0x7e5109],
  ['sharp', 'afiado', 'mixed', 0xbdc3c7],
  ['jagged', 'serrilhado', 'cave', 0x839192],
  ['silent', 'silencioso', 'shadow', 0x424949],
  ['howling', 'uivante', 'ice', 0xaed6f1],
  ['roaring', 'rugidor', 'fire', 0xe74c3c],
  ['whisper', 'sussurro', 'shadow', 0x7f8c8d],
  ['echo', 'eco', 'cave', 0x85c1e9],
  ['pulse', 'pulso', 'crystal', 0x58d68d],
  ['flux', 'fluxo', 'sea', 0x3498db],
  ['surge', 'surto', 'sea', 0x1abc9c],
  ['rifted', 'rachado', 'shadow', 0x8e44ad],
  ['gilded', 'dourado', 'temple', 0xf1c40f],
  ['rusted', 'enferrujado', 'mixed', 0xb7410e],
  ['molten', 'fundido', 'fire', 0xff6622],
  ['frozen', 'congelado', 'ice', 0x85c1e9],
  ['burning', 'ardente', 'fire', 0xff4422],
  ['weeping', 'choroso', 'undead', 0x5dade2],
  ['laughing', 'ríspido', 'hell', 0xc0392b],
  ['twisted', 'torcido', 'swamp', 0x6c3483],
  ['gnarled', 'retorcido', 'forest', 0x5d4037],
  ['splinter', 'estilhaço', 'forest', 0x8d6e63],
  ['shard', 'fragmento', 'crystal', 0xaed6f1],
  ['spike', 'espeto', 'cave', 0x95a5a6],
  ['claw', 'garra', 'mixed', 0x7f8c8d],
  ['fang', 'presa', 'mixed', 0xd5d8dc],
  ['horn', 'chifre', 'mixed', 0xd4a017],
  ['wing', 'asa', 'sky', 0xb0bec5],
  ['scale', 'escama', 'sea', 0x27ae60],
  ['shell', 'concha', 'sea', 0xe8daef],
  ['mask', 'máscara', 'temple', 0xc9a227],
  ['crown', 'coroa', 'temple', 0xf4d03f],
  ['chain', 'corrente', 'mixed', 0x7f8c8d],
  ['blade', 'lâmina', 'mixed', 0xbdc3c7],
  ['torch', 'tocha', 'fire', 0xffaa33],
  ['lantern', 'lanterna', 'temple', 0xffe082],
  ['bell', 'sino', 'temple', 0xd4c48a],
  ['drum', 'tambor', 'mixed', 0x8d6e63],
  ['choir', 'coro', 'undead', 0xd7bde2],
  ['dirge', 'réquiem', 'undead', 0x566573],
];

const CREATURES = [
  // [en, pt, templates, attackHints]
  ['mite', 'ácaro', ['beast'], ['melee']],
  ['tick', 'carrapato', ['beast'], ['melee']],
  ['beetle', 'besouro', ['beast'], ['melee']],
  ['scarab', 'escaravelho', ['beast'], ['melee']],
  ['grub', 'larva', ['beast'], ['melee']],
  ['worm', 'verme', ['serpent'], ['melee']],
  ['slug', 'lesma', ['serpent'], ['melee']],
  ['snail', 'caracol', ['beast'], ['melee']],
  ['newt', 'tritão', ['beast', 'serpent'], ['melee', 'caster_acid']],
  ['toad', 'sapo', ['beast', 'bulk'], ['melee']],
  ['frog', 'rã', ['beast'], ['melee']],
  ['snake', 'serpente', ['serpent'], ['melee', 'caster_poison']],
  ['viper', 'víbora', ['serpent'], ['melee', 'caster_acid']],
  ['eel', 'enguia', ['serpent'], ['melee']],
  ['fish', 'peixe', ['beast'], ['melee']],
  ['shark', 'tubarão', ['beast'], ['melee']],
  ['crab', 'caranguejo', ['beast'], ['melee']],
  ['urchin', 'ouriço', ['beast'], ['melee', 'ranged_orb']],
  ['jellyfish', 'água-viva', ['bulk'], ['caster_arc', 'melee']],
  ['ray', 'arraia', ['beast'], ['melee', 'caster_arc']],
  ['rat', 'rato', ['beast'], ['melee']],
  ['vole', 'arganaz', ['beast'], ['melee']],
  ['ferret', 'furão', ['beast'], ['melee']],
  ['weasel', 'doninha', ['beast'], ['melee']],
  ['hare', 'lebre', ['beast'], ['melee']],
  ['fox', 'raposa', ['beast'], ['caster_hex', 'melee']],
  ['jackal', 'chacal', ['beast'], ['melee']],
  ['wolf', 'lobo', ['beast'], ['melee']],
  ['hound', 'cão', ['beast'], ['melee']],
  ['panther', 'pantera', ['beast'], ['melee']],
  ['boar', 'javali', ['beast'], ['melee']],
  ['ibex', 'íbex', ['beast'], ['melee']],
  ['goat', 'cabra', ['beast'], ['melee']],
  ['ram', 'carneiro', ['beast'], ['melee']],
  ['bull', 'touro', ['beast', 'bulk'], ['melee']],
  ['bear', 'urso', ['beast', 'bulk'], ['melee']],
  ['ape', 'macaco', ['humanoid', 'beast'], ['melee']],
  ['bat', 'morcego', ['winged'], ['melee']],
  ['owl', 'coruja', ['winged'], ['ranged_orb', 'melee']],
  ['raven', 'corvo', ['winged'], ['ranged_arrow', 'melee']],
  ['hawk', 'falcão', ['winged'], ['melee', 'ranged_orb']],
  ['finch', 'tentilhão', ['winged'], ['melee']],
  ['moth', 'mariposa', ['winged'], ['ranged_orb', 'caster_hex']],
  ['wasp', 'vespa', ['winged'], ['melee']],
  ['drone', 'zangão', ['winged', 'beast'], ['melee']],
  ['mosquito', 'mosquito', ['winged'], ['melee']],
  ['fly', 'mosca', ['winged'], ['melee']],
  ['spider', 'aranha', ['beast'], ['melee', 'caster_poison']],
  ['mantis', 'louva-a-deus', ['beast'], ['melee']],
  ['scorpion', 'escorpião', ['beast'], ['melee']],
  ['imp', 'imp', ['winged', 'humanoid'], ['ranged_fire', 'caster_fire']],
  ['sprite', 'sprite', ['winged'], ['caster_hex', 'caster_arc', 'caster_ice']],
  ['pixie', 'pixie', ['winged'], ['caster_hex']],
  ['wisp', 'fogo-fátuo', ['winged'], ['caster_arc', 'caster_fire', 'caster_ice']],
  ['sylph', 'sylph', ['winged'], ['caster_arc', 'caster_ice']],
  ['mephit', 'mefite', ['winged'], ['caster_fire', 'caster_ice', 'ranged_fire']],
  ['gremlin', 'gremlin', ['humanoid'], ['melee', 'ranged_orb']],
  ['goblin', 'goblin', ['humanoid'], ['ranged_arrow', 'melee']],
  ['kobold', 'kobold', ['humanoid'], ['ranged_arrow', 'melee']],
  ['gnoll', 'gnoll', ['beast', 'humanoid'], ['melee']],
  ['orc', 'orc', ['humanoid', 'beast'], ['melee']],
  ['troll', 'troll', ['bulk'], ['melee']],
  ['ogre', 'ogro', ['bulk'], ['melee']],
  ['giant', 'gigante', ['bulk'], ['melee']],
  ['golem', 'golem', ['bulk'], ['melee']],
  ['elemental', 'elemental', ['bulk', 'winged'], ['caster_fire', 'caster_ice', 'caster_arc', 'caster_crystal']],
  ['construct', 'constructo', ['bulk'], ['melee', 'ranged_orb']],
  ['sentinel', 'sentinela', ['bulk', 'humanoid'], ['melee', 'ranged_orb']],
  ['guardian', 'guardião', ['bulk'], ['melee']],
  ['knight', 'cavaleiro', ['humanoid'], ['melee']],
  ['archer', 'arqueiro', ['humanoid'], ['ranged_arrow']],
  ['mage', 'mago', ['humanoid'], ['caster_fire', 'caster_ice', 'caster_arc', 'caster_hex']],
  ['witch', 'bruxa', ['humanoid'], ['caster_hex', 'caster_poison', 'caster_thorn']],
  ['priest', 'sacerdote', ['humanoid'], ['caster_hex', 'caster_crystal']],
  ['cultist', 'cultista', ['humanoid'], ['caster_fire', 'caster_hex']],
  ['alchemist', 'alquimista', ['humanoid'], ['caster_acid', 'caster_poison']],
  ['assassin', 'assassino', ['humanoid'], ['melee', 'caster_poison']],
  ['duelist', 'duelista', ['humanoid'], ['melee']],
  ['warden', 'guardião', ['humanoid'], ['melee', 'ranged_orb']],
  ['hunter', 'caçador', ['humanoid'], ['ranged_arrow', 'melee']],
  ['scout', 'batedor', ['humanoid'], ['ranged_arrow', 'melee']],
  ['raider', 'saqueador', ['humanoid'], ['melee']],
  ['bandit', 'bandido', ['humanoid'], ['melee', 'ranged_arrow']],
  ['pirate', 'pirata', ['humanoid'], ['melee']],
  ['skeleton', 'esqueleto', ['humanoid'], ['melee', 'ranged_arrow']],
  ['zombie', 'zumbi', ['humanoid'], ['melee']],
  ['mummy', 'múmia', ['humanoid'], ['melee']],
  ['ghast', 'espectro', ['humanoid', 'winged'], ['melee', 'caster_hex']],
  ['specter', 'fantasma', ['winged', 'humanoid'], ['caster_hex', 'melee']],
  ['shade', 'sombra', ['humanoid'], ['melee', 'caster_hex']],
  ['lichling', 'lichling', ['humanoid'], ['caster_bone', 'caster_hex', 'caster_ice']],
  ['whelp', 'filhote', ['winged', 'beast'], ['ranged_fire', 'melee']],
  ['drake', 'draco', ['winged', 'serpent'], ['caster_firebreath', 'caster_frost_breath', 'ranged_fire']],
  ['wyrm', 'wyrm', ['serpent'], ['caster_frost_breath', 'caster_firebreath', 'melee']],
  ['hydra', 'hidra', ['serpent', 'bulk'], ['caster_poison', 'caster_acid', 'melee']],
  ['naga', 'naga', ['serpent', 'humanoid'], ['caster_poison', 'caster_ice', 'melee']],
  ['sphinx', 'esfinge', ['beast', 'winged'], ['caster_hex', 'caster_arc']],
  ['gargoyle', 'gárgula', ['winged'], ['melee']],
  ['harpy', 'harpía', ['winged'], ['ranged_orb', 'caster_storm']],
  ['chimera', 'quimera', ['beast', 'bulk'], ['melee', 'ranged_fire']],
  ['basilisk', 'basilisco', ['serpent', 'beast'], ['caster_hex', 'melee']],
  ['krakenling', 'krakenzinho', ['bulk', 'serpent'], ['melee', 'caster_ice']],
  ['leviathan_cub', 'leviatã filhote', ['bulk'], ['melee']],
  ['phoenixling', 'fênix filhote', ['winged'], ['caster_fire', 'ranged_fire']],
  ['treantling', 'treantzinho', ['bulk'], ['melee', 'caster_thorn']],
  ['myconid', 'micônido', ['humanoid', 'bulk'], ['caster_poison', 'melee']],
  ['dryad', 'dríade', ['humanoid'], ['caster_thorn', 'caster_hex']],
  ['nymph', 'ninfa', ['humanoid'], ['caster_ice', 'caster_hex']],
  ['satyr', 'sátiro', ['humanoid'], ['melee', 'ranged_orb']],
  ['centaur', 'centauro', ['beast', 'humanoid'], ['ranged_arrow', 'melee']],
  ['minotaurling', 'minotauro jovem', ['beast'], ['melee']],
  ['cyclops_cub', 'ciclope filhote', ['bulk'], ['melee']],
  ['djinnling', 'gênio jovem', ['winged', 'humanoid'], ['caster_arc', 'caster_fire']],
  ['efreet', 'efreet', ['winged', 'humanoid'], ['caster_fire', 'caster_magma']],
  ['marid', 'marid', ['humanoid', 'winged'], ['caster_ice', 'caster_crystal']],
  ['homunculus', 'homúnculo', ['humanoid'], ['caster_hex', 'melee']],
  ['familiar', 'familiar', ['beast', 'winged'], ['caster_hex', 'melee']],
  ['puppet', 'marionete', ['humanoid'], ['melee', 'ranged_orb']],
  ['doll', 'boneca', ['humanoid'], ['caster_hex', 'melee']],
  ['masker', 'mascarado', ['humanoid'], ['melee', 'caster_hex']],
  ['herald', 'arauto', ['humanoid'], ['caster_arc', 'ranged_orb']],
  ['chanter', 'cantor', ['humanoid'], ['caster_bone', 'caster_hex']],
  ['seer', 'vidente', ['humanoid'], ['caster_crystal', 'caster_hex']],
  ['scribe', 'escriba', ['humanoid'], ['caster_hex', 'caster_arc']],
  ['monk', 'monge', ['humanoid'], ['melee', 'caster_crystal']],
  ['paladin', 'paladino', ['humanoid'], ['melee']],
  ['berserker', 'berserker', ['humanoid'], ['melee']],
  ['reaver', 'devastador', ['humanoid'], ['melee']],
  ['stalker', 'perseguidor', ['beast', 'humanoid'], ['melee']],
  ['lurker', 'espreitador', ['beast'], ['melee']],
  ['crawler', 'rastejante', ['beast', 'serpent'], ['melee']],
  ['swarmer', 'enxame', ['beast', 'winged'], ['melee']],
  ['swarm', 'enxame', ['beast'], ['melee', 'caster_poison']],
  ['brood', 'ninhada', ['beast'], ['melee']],
  ['spawn', 'cria', ['beast', 'bulk'], ['melee']],
  ['hatchling', 'filhote', ['beast', 'winged'], ['melee', 'ranged_fire']],
  ['cub', 'filhote', ['beast'], ['melee']],
  ['pup', 'filhote', ['beast'], ['melee']],
  ['kit', 'filhote', ['beast'], ['melee']],
  ['fledgling', 'filhote', ['winged'], ['melee', 'ranged_orb']],
  ['juvenile', 'jovem', ['beast', 'humanoid'], ['melee']],
  ['brute', 'bruto', ['bulk'], ['melee']],
  ['crusher', 'esmagador', ['bulk'], ['melee']],
  ['smasher', 'destruidor', ['bulk'], ['melee']],
  ['basher', 'espancador', ['bulk'], ['melee']],
  ['razor', 'navalha', ['beast', 'winged'], ['melee', 'ranged_orb']],
  ['stinger', 'ferrão', ['winged', 'beast'], ['melee']],
  ['biter', 'mordedor', ['beast'], ['melee']],
  ['howler', 'uivador', ['beast'], ['melee']],
  ['screamer', 'gritador', ['winged', 'humanoid'], ['ranged_orb', 'caster_hex']],
  ['whisperer', 'sussurrador', ['humanoid'], ['caster_hex']],
  ['haunter', 'assombrador', ['humanoid', 'winged'], ['caster_hex', 'melee']],
  ['devourer', 'devorador', ['bulk', 'beast'], ['melee']],
  ['mangler', 'dilacerador', ['beast'], ['melee']],
  ['ripper', 'rasgador', ['beast'], ['melee']],
  ['slasher', 'cortador', ['humanoid', 'beast'], ['melee']],
  ['piercer', 'perfurador', ['beast'], ['melee', 'ranged_orb']],
  ['bombardier', 'bombardeiro', ['winged', 'beast'], ['ranged_fire', 'ranged_orb']],
  ['spitter', 'cuspidor', ['beast', 'serpent'], ['ranged_orb', 'caster_acid']],
  ['blaster', 'explosivo', ['humanoid', 'bulk'], ['ranged_fire', 'caster_magma']],
  ['shocker', 'eletrizante', ['beast', 'humanoid'], ['caster_arc', 'caster_storm']],
  ['freezer', 'congelador', ['beast', 'humanoid'], ['caster_ice', 'caster_frost_breath']],
  ['burner', 'queimador', ['beast', 'humanoid'], ['caster_fire', 'caster_firebreath']],
  ['poisoner', 'envenenador', ['humanoid', 'beast'], ['caster_poison', 'caster_acid']],
  ['hexer', 'amaldiçoador', ['humanoid'], ['caster_hex']],
  ['binder', 'amarrador', ['humanoid'], ['caster_hex', 'caster_crystal']],
  ['weaver', 'tecelão', ['humanoid', 'beast'], ['caster_thorn', 'caster_hex']],
  ['carver', 'entalhador', ['humanoid'], ['melee', 'ranged_orb']],
  ['smith', 'ferreiro', ['humanoid'], ['melee', 'ranged_fire']],
  ['forger', 'forjador', ['humanoid', 'bulk'], ['melee', 'caster_magma']],
  ['miner', 'mineiro', ['humanoid'], ['melee', 'ranged_orb']],
  ['diver', 'mergulhador', ['humanoid'], ['melee']],
  ['sailor', 'marinheiro', ['humanoid'], ['melee', 'ranged_arrow']],
  ['rider', 'cavaleiro', ['humanoid', 'beast'], ['melee', 'ranged_orb']],
  ['walker', 'andante', ['humanoid', 'bulk'], ['melee']],
  ['strider', 'andador', ['beast', 'humanoid'], ['melee']],
  ['glider', 'planador', ['winged'], ['ranged_orb', 'melee']],
  ['dancer', 'dançarino', ['humanoid'], ['melee', 'caster_hex']],
  ['jester', 'bufão', ['humanoid'], ['caster_hex', 'ranged_orb']],
  ['trickster', 'trapaceiro', ['humanoid', 'beast'], ['caster_hex', 'melee']],
  ['oracle', 'oráculo', ['humanoid'], ['caster_crystal', 'caster_arc']],
  ['prophet', 'profeta', ['humanoid'], ['caster_hex', 'caster_crystal']],
  ['apostle', 'apóstolo', ['humanoid'], ['caster_hex', 'caster_fire']],
  ['acolyte', 'acólito', ['humanoid'], ['caster_fire', 'caster_hex']],
  ['initiate', 'iniciado', ['humanoid'], ['caster_fire', 'melee']],
  ['adept', 'adepto', ['humanoid'], ['caster_arc', 'caster_ice']],
  ['savant', 'erudito', ['humanoid'], ['caster_crystal', 'caster_arc']],
  ['archivist', 'arquivista', ['humanoid'], ['caster_hex', 'caster_crystal']],
  ['curator', 'curador', ['humanoid'], ['caster_crystal', 'melee']],
  ['ward', 'guardião', ['bulk', 'humanoid'], ['melee']],
  ['keeper', 'guarda', ['humanoid'], ['melee', 'ranged_orb']],
  ['jailer', 'carcereiro', ['humanoid'], ['melee']],
  ['torturer', 'torturador', ['humanoid'], ['melee', 'caster_hex']],
  ['executioner', 'executor', ['humanoid'], ['melee']],
  ['judge', 'juiz', ['humanoid'], ['caster_hex', 'melee']],
  ['inquisitor', 'inquisidor', ['humanoid'], ['caster_fire', 'caster_hex']],
  ['zealot', 'fanático', ['humanoid'], ['melee', 'caster_fire']],
  ['fanatic', 'fanático', ['humanoid'], ['melee', 'caster_hex']],
  ['martyr', 'mártir', ['humanoid'], ['caster_hex', 'melee']],
  ['pilgrim', 'peregrino', ['humanoid'], ['melee', 'caster_crystal']],
  ['nomad', 'nômade', ['humanoid'], ['ranged_arrow', 'melee']],
  ['exile', 'exilado', ['humanoid'], ['melee', 'caster_hex']],
  ['outcast', 'pária', ['humanoid'], ['melee', 'ranged_orb']],
  ['vagabond', 'vagabundo', ['humanoid'], ['melee']],
  ['wanderer', 'andarilho', ['humanoid'], ['melee', 'ranged_orb']],
];

const ELITE_TITLES = [
  ['veteran', 'veterano'],
  ['captain', 'capitão'],
  ['chief', 'chefe'],
  ['alpha', 'alfa'],
  ['matron', 'matrona'],
  ['warden', 'guardião'],
  ['champion', 'campeão'],
  ['overseer', 'supervisor'],
  ['packlord', 'senhor da matilha'],
  ['broodmother', 'mãe da ninhada'],
  ['hierophant', 'hierofante'],
  ['sentinel', 'sentinela'],
  ['raider', 'saqueador'],
  ['stalker', 'perseguidor'],
  ['hexer', 'amaldiçoador'],
  ['blighted', 'corrompido'],
  ['armored', 'blindado'],
  ['enraged', 'enraivecido'],
  ['ascendant', 'ascendente'],
  ['prime', 'primordial'],
  ['greater', 'maior'],
  ['dire', 'terrível'],
  ['savage', 'selvagem'],
  ['cursed', 'amaldiçoado'],
  ['blessed', 'abençoado'],
  ['twilight', 'crepuscular'],
  ['midnight', 'meia-noite'],
  ['dawn', 'alvorada'],
  ['stormforged', 'forjado na tempestade'],
  ['ironbound', 'preso em ferro'],
  ['soulbound', 'preso à alma'],
  ['blooded', 'sangrento'],
  ['venomous', 'venenoso'],
  ['arcane', 'arcano'],
  ['runic', 'rúnico'],
  ['crystalbound', 'cristalino'],
  ['ashen', 'acinzentado'],
  ['frozen', 'congelado'],
  ['molten', 'fundido'],
  ['abyssal', 'abissal'],
  ['celestial', 'celestial'],
  ['infernal', 'infernal'],
  ['necrotic', 'necrótico'],
  ['primal', 'primitivo'],
  ['war', 'de guerra'],
  ['battle', 'de batalha'],
  ['siege', 'de cerco'],
  ['raid', 'de raid'],
];

const BOSS_TITLES = [
  ['sovereign', 'soberano'],
  ['emperor', 'imperador'],
  ['empress', 'imperatriz'],
  ['tyrant', 'tirano'],
  ['overlord', 'suserano'],
  ['matriarch', 'matriarca'],
  ['patriarch', 'patriarca'],
  ['colossus', 'colosso'],
  ['behemoth', 'beemote'],
  ['leviathan', 'leviatã'],
  ['primordial', 'primordial'],
  ['avatar', 'avatar'],
  ['herald', 'arauto'],
  ['harbinger', 'presságio'],
  ['apocalypse', 'apocalipse'],
  ['cataclysm', 'cataclismo'],
  ['eternal', 'eterno'],
  ['infinite', 'infinito'],
  ['world', 'do mundo'],
  ['voidborn', 'nascido do vazio'],
  ['starborn', 'nascido das estrelas'],
  ['doomlord', 'senhor da perdição'],
  ['deathlord', 'senhor da morte'],
  ['flametyrant', 'tirano das chamas'],
  ['frostking', 'rei da geada'],
  ['stormqueen', 'rainha da tempestade'],
  ['plagueking', 'rei da praga'],
  ['bloodqueen', 'rainha do sangue'],
  ['boneking', 'rei dos ossos'],
  ['ashenlord', 'senhor das cinzas'],
  ['tidefather', 'pai das marés'],
  ['skymother', 'mãe dos céus'],
  ['crystalheart', 'coração de cristal'],
  ['nightcrown', 'coroa da noite'],
  ['sunscorch', 'queimadura solar'],
  ['moonfall', 'queda lunar'],
  ['riftwalker', 'caminhante da fenda'],
  ['entropy', 'entropia'],
  ['chaosborn', 'nascido do caos'],
  ['endbringer', 'trazedor do fim'],
  ['worldbreaker', 'quebrador de mundos'],
  ['soulreaper', 'ceifador de almas'],
  ['graveking', 'rei das tumbas'],
  ['hellcrown', 'coroa do inferno'],
  ['abysscrown', 'coroa do abismo'],
  ['jadeempire', 'império de jade'],
  ['ironthrone', 'trono de ferro'],
  ['forgemaster', 'mestre da forja'],
  ['archon', 'arconte'],
  ['paragon', 'paragão'],
  ['apex', 'ápice'],
  ['omega', 'ômega'],
  ['alpha_prime', 'alfa primordial'],
  ['final', 'final'],
  ['ultimate', 'supremo'],
  ['mythic', 'mítico'],
  ['legendary', 'lendário'],
  ['divine', 'divino'],
  ['profane', 'profano'],
];

const NORMAL_HINTS_EXTRA = [
  'melee',
  'melee',
  'melee',
  'ranged_arrow',
  'ranged_orb',
  'ranged_fire',
  'caster_fire',
  'caster_ice',
  'caster_arc',
  'caster_hex',
  'caster_acid',
  'caster_crystal',
  'caster_ember',
  'caster_sap',
  'caster_brine',
  'caster_spark',
  'caster_dusk',
];

const ELITE_HINTS_EXTRA = [
  'melee',
  'ranged_arrow',
  'ranged_orb',
  'caster_fire',
  'caster_ice',
  'caster_poison',
  'caster_thorn',
  'caster_magma',
  'caster_storm',
  'caster_bone',
  'caster_frost_breath',
  'caster_firebreath',
  'caster_ash',
  'caster_mire',
  'caster_gale',
  'caster_ember',
  'caster_sap',
  'caster_spark',
];

const BOSS_HINTS = [
  'boss_solar',
  'boss_void',
  'boss_tidal',
  'boss_plague',
  'boss_beam',
  'boss_frost',
  'boss_inferno',
  'boss_rift',
  'boss_storm',
  'boss_death',
  'boss_aurora',
  'boss_blood',
  'boss_quake',
  'boss_obsidian',
  'melee',
  'caster_magma',
  'caster_storm',
  'caster_bone',
];

function pick(arr, i) {
  return arr[i % arr.length];
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function spellLoadout(hint, tier) {
  const map = {
    caster_fire: ['firebolt'],
    caster_ice: ['ice_shard'],
    caster_arc: ['arc_lightning'],
    caster_hex: ['hex_bolt'],
    caster_acid: ['acid_bolt'],
    caster_crystal: ['crystal_bolt'],
    caster_ember: ['ember_bolt'],
    caster_sap: ['sap_bolt'],
    caster_brine: ['brine_bolt'],
    caster_spark: ['spark_bolt'],
    caster_dusk: ['dusk_bolt'],
    caster_poison: ['poison_cloud', 'acid_bolt', 'sap_bolt'],
    caster_frost_breath: ['frost_breath', 'ice_shard', 'brine_bolt'],
    caster_firebreath: ['firebreath', 'firebolt', 'ember_bolt'],
    caster_magma: ['magma_surge', 'firebreath', 'ember_bolt'],
    caster_ash: ['ash_nova', 'magma_surge', 'ember_bolt'],
    caster_mire: ['mire_nova', 'thorn_nova', 'sap_bolt'],
    caster_gale: ['gale_breath', 'frost_breath', 'spark_bolt'],
    caster_storm: ['electric_storm', 'arc_lightning', 'spark_bolt'],
    caster_bone: ['bone_volley', 'hex_bolt', 'dusk_bolt'],
    caster_thorn: ['thorn_nova', 'acid_bolt', 'sap_bolt'],
    boss_solar: ['solar_judgment', 'magma_surge', 'flame_nova', 'ember_bolt'],
    boss_void: ['shadow_eclipse', 'entropy_pulse', 'hex_bolt', 'dusk_bolt'],
    boss_tidal: ['tidal_crush', 'abyss_nova', 'gale_breath', 'brine_bolt'],
    boss_plague: ['plague_burst', 'mire_nova', 'sap_bolt', 'thorn_nova'],
    boss_beam: ['cataclysm_beam', 'electric_storm', 'soul_lance', 'spark_bolt'],
    boss_frost: ['frost_apocalypse', 'gale_breath', 'brine_bolt', 'crystal_bolt'],
    boss_inferno: ['infernal_judgment', 'ash_nova', 'firebreath', 'ember_bolt'],
    boss_rift: ['rift_lance', 'entropy_pulse', 'hex_bolt', 'dusk_bolt'],
    boss_storm: ['electric_storm', 'cataclysm_beam', 'spark_bolt', 'solar_judgment'],
    boss_death: ['death_knell', 'bone_volley', 'skull_wave', 'soul_rend'],
    boss_aurora: ['aurora_judgment', 'spark_bolt', 'crystal_bolt', 'electric_storm'],
    boss_blood: ['blood_nova', 'hex_bolt', 'dusk_bolt', 'shadow_eclipse'],
    boss_quake: ['quake_pulse', 'ash_nova', 'magma_surge', 'ember_bolt'],
    boss_obsidian: ['obsidian_lance', 'ash_nova', 'rift_lance', 'dusk_bolt'],
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
          'ash_nova',
          'mire_nova',
          'gale_breath',
        ].includes(s)
    );
    return singles.length ? singles.slice(0, 1) : ['firebolt'];
  }
  return map[hint] || null;
}

function buildDef(entry, index) {
  const [id, , , , color, hint] = entry;
  const isBoss = index >= 240;
  const isElite = index >= 144 && index < 240;
  const difficulty = isBoss
    ? ['nightmare', 'apocalypse', 'hard', 'apocalypse'][index % 4]
    : isElite
      ? ['hard', 'nightmare', 'apocalypse', 'hard'][index % 4]
      : ['normal', 'normal', 'hard', 'normal'][index % 4];

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
  lines.push(
    `      hpMul: ${hpMul.toFixed(2)}, speedMul: ${speedMul.toFixed(2)}, dmgMul: ${dmgMul.toFixed(2)}, radius: ${radius}, color: 0x${color.toString(16).padStart(6, '0')},`
  );

  if (hint === 'melee') {
    const cd = isBoss
      ? 1.1
      : isElite
        ? +(0.65 + (index % 5) * 0.1).toFixed(2)
        : +(0.7 + (index % 6) * 0.1).toFixed(2);
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
          'ash_nova',
          'mire_nova',
          'blood_nova',
          'quake_pulse',
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

function generateThemes() {
  const used = new Set(EXISTING);
  const themes = [];

  // ── Normals (144) ──
  for (let i = 0; themes.length < 144; i++) {
    const pref = pick(PREFIXES, i * 3 + 7);
    const cre = pick(CREATURES, i * 5 + 11);
    let id = `${pref[0]}_${cre[0]}`;
    let n = 2;
    while (used.has(id)) {
      id = `${pref[0]}_${cre[0]}_${n}`;
      n++;
      if (n > 20) break;
    }
    if (used.has(id)) continue;
    used.add(id);
    const h = hashStr(id);
    const template = pick(cre[2], h);
    const hints = [...cre[3], ...NORMAL_HINTS_EXTRA];
    const hint = pick(hints, h >>> 8);
    const label = `${cre[1]} ${pref[1]}`;
    themes.push([id, label, template, pref[2], pref[3], hint]);
  }

  // ── Elites (96) ──
  for (let i = 0; themes.length < 240; i++) {
    const pref = pick(PREFIXES, i * 7 + 13);
    const cre = pick(CREATURES, i * 11 + 3);
    const title = pick(ELITE_TITLES, i * 5 + 2);
    let id = `${pref[0]}_${cre[0]}_${title[0]}`;
    let n = 2;
    while (used.has(id)) {
      id = `${pref[0]}_${cre[0]}_${title[0]}_${n}`;
      n++;
      if (n > 20) break;
    }
    if (used.has(id)) continue;
    used.add(id);
    const h = hashStr(id);
    const template = pick(cre[2], h);
    const hints = [...cre[3], ...ELITE_HINTS_EXTRA];
    const hint = pick(hints, h >>> 8);
    const label = `${cre[1]} ${pref[1]} ${title[1]}`;
    const color = darken(pref[3], 0.85) || pref[3];
    themes.push([id, label, template, pref[2], color, hint]);
  }

  // ── Bosses (60) ──
  for (let i = 0; themes.length < 300; i++) {
    const pref = pick(PREFIXES, i * 9 + 19);
    const cre = pick(CREATURES, i * 13 + 17);
    const title = pick(BOSS_TITLES, i * 3 + 1);
    let id = `${pref[0]}_${cre[0]}_${title[0]}`;
    let n = 2;
    while (used.has(id)) {
      id = `${pref[0]}_${cre[0]}_${title[0]}_${n}`;
      n++;
      if (n > 20) break;
    }
    if (used.has(id)) continue;
    used.add(id);
    const h = hashStr(id);
    const template = pick(['bulk', 'serpent', 'winged', 'humanoid', 'beast'], h);
    const hint = pick(BOSS_HINTS, h >>> 8);
    const label = `${cre[1]} ${pref[1]} ${title[1]}`;
    const color = darken(pref[3], 0.7) || pref[3];
    themes.push([id, label, template, pref[2], color, hint]);
  }

  return themes;
}

function insertBefore(filePath, marker, block, alreadyToken) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes(alreadyToken)) {
    console.log('Already patched:', filePath);
    return false;
  }
  const idx = src.lastIndexOf(marker);
  if (idx < 0) throw new Error(`Marker not found in ${filePath}: ${marker}`);
  src = src.slice(0, idx) + block + src.slice(idx);
  fs.writeFileSync(filePath, src);
  console.log('Patched', path.relative(root, filePath));
  return true;
}

function replaceOnce(filePath, find, replace, alreadyToken) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (alreadyToken && src.includes(alreadyToken)) {
    console.log('Already patched:', filePath);
    return false;
  }
  if (!src.includes(find)) throw new Error(`Find string not found in ${filePath}`);
  src = src.replace(find, replace);
  fs.writeFileSync(filePath, src);
  console.log('Updated', path.relative(root, filePath));
  return true;
}

// ── New spells ────────────────────────────────────────────────
const NEW_SPELLS_BLOCK = `
  // ─── ${SPELL_TAG} ─────────────────
  ember_bolt: {
    id: 'ember_bolt',
    name: 'Seta de Brasa',
    description: 'Projétil de brasa crepitante. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.05,
    manaCost: 0,
    damage: 17,
    range: 320,
    speed: 540,
    radius: 9,
    color: 0xff7744,
  },
  sap_bolt: {
    id: 'sap_bolt',
    name: 'Seta de Seiva',
    description: 'Projétil de seiva tóxica que envenena. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.25,
    manaCost: 0,
    damage: 15,
    range: 295,
    speed: 460,
    radius: 9,
    poisonDamage: 3,
    poisonTick: 1,
    poisonDuration: 4,
    color: 0x6ab04c,
  },
  brine_bolt: {
    id: 'brine_bolt',
    name: 'Seta Salgada',
    description: 'Projétil de água salgada que causa lentidão. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.2,
    manaCost: 0,
    damage: 16,
    range: 305,
    speed: 500,
    radius: 9,
    slow: 0.38,
    slowDuration: 3.2,
    color: 0x48c9b0,
  },
  spark_bolt: {
    id: 'spark_bolt',
    name: 'Raio Faísca',
    description: 'Faísca elétrica que cai do céu no alvo. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.35,
    manaCost: 0,
    damage: 24,
    range: 235,
    color: 0xffee66,
  },
  dusk_bolt: {
    id: 'dusk_bolt',
    name: 'Seta do Crepúsculo',
    description: 'Projétil sombrio que causa lentidão. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 1.18,
    manaCost: 0,
    damage: 18,
    range: 300,
    speed: 510,
    radius: 9,
    slow: 0.32,
    slowDuration: 3.0,
    color: 0x7d3c98,
  },
  ash_nova: {
    id: 'ash_nova',
    name: 'Nova de Cinzas',
    description: 'Explosão de cinzas em área com chão em chamas. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 4.0,
    manaCost: 0,
    damage: 19,
    range: 155,
    radius: 102,
    duration: 2.3,
    burnDamage: 3,
    burnTick: 0.85,
    burnDuration: 3,
    color: 0xa04000,
  },
  mire_nova: {
    id: 'mire_nova',
    name: 'Nova do Lodo',
    description: 'Explosão de lodo tóxico em área. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 4.1,
    manaCost: 0,
    damage: 17,
    range: 150,
    radius: 98,
    duration: 2.1,
    poisonDamage: 3,
    poisonTick: 1,
    poisonDuration: 4,
    color: 0x4a6741,
  },
  gale_breath: {
    id: 'gale_breath',
    name: 'Sopro de Vendaval',
    description: 'Sopro gelado de vento em cone que causa dano e lentidão. Uso exclusivo de certos monstros.',
    type: 'basic',
    playerUsable: false,
    cooldown: 2.1,
    manaCost: 0,
    damage: 21,
    range: 170,
    coneAngle: 38,
    slow: 0.42,
    slowDuration: 2.6,
    color: 0xaed6f1,
  },
  obsidian_lance: {
    id: 'obsidian_lance',
    name: 'Lança de Obsidiana',
    description: 'Lança de obsidiana no alvo. Exclusiva de bosses. Até 62% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.1,
    manaCost: 0,
    damagePercentMaxHp: 0.62,
    range: 235,
    color: 0x1c2833,
  },
  blood_nova: {
    id: 'blood_nova',
    name: 'Nova de Sangue',
    description: 'Explosão sanguínea em área. Exclusiva de bosses. Até 52% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.3,
    manaCost: 0,
    damagePercentMaxHp: 0.52,
    range: 210,
    radius: 128,
    color: 0x922b21,
  },
  aurora_judgment: {
    id: 'aurora_judgment',
    name: 'Julgamento Aurora',
    description: 'Julgamento polar do céu. Exclusiva de bosses. Até 68% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 7.0,
    manaCost: 0,
    damagePercentMaxHp: 0.68,
    range: 265,
    color: 0x80deea,
  },
  quake_pulse: {
    id: 'quake_pulse',
    name: 'Pulso Sísmico',
    description: 'Pulso sísmico em área. Exclusiva de bosses. Até 48% da vida máxima.',
    type: 'basic',
    playerUsable: false,
    bossOnly: true,
    cooldown: 6.6,
    manaCost: 0,
    damagePercentMaxHp: 0.48,
    range: 205,
    radius: 132,
    color: 0x7e5109,
  },
`;

const SPELL_ELEMENT_ENTRIES = `
  ember_bolt: 'fire',
  sap_bolt: 'poison',
  brine_bolt: 'water',
  spark_bolt: 'lightning',
  dusk_bolt: 'shadow',
  ash_nova: 'fire',
  mire_nova: 'poison',
  gale_breath: 'ice',
  obsidian_lance: 'shadow',
  blood_nova: 'shadow',
  aurora_judgment: 'holy',
  quake_pulse: 'arcane',
`;

function patchSpells() {
  insertBefore(
    path.join(root, 'server/spells.js'),
    '};\n\nexport const ULTIMATES',
    NEW_SPELLS_BLOCK,
    SPELL_TAG
  );
  insertBefore(
    path.join(root, 'server/spellElements.js'),
    '  tidal_crush: \'water\',\n  apocalypse:',
    SPELL_ELEMENT_ENTRIES,
    'ember_bolt:'
  );
}

function patchMatch() {
  const file = path.join(root, 'server/Match.js');
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('ember_bolt')) {
    console.log('Already patched: server/Match.js');
    return;
  }

  src = src.replace(
    `    const bossNovaSpells = [
      'shadow_eclipse',
      'abyss_nova',
      'void_collapse',
      'frost_apocalypse',
      'plague_burst',
      'entropy_pulse',
      'tidal_crush',
    ];
    const bossSingleSpells = [
      'death_knell',
      'infernal_judgment',
      'soul_rend',
      'blood_pact',
      'soul_lance',
      'solar_judgment',
      'rift_lance',
    ];`,
    `    const bossNovaSpells = [
      'shadow_eclipse',
      'abyss_nova',
      'void_collapse',
      'frost_apocalypse',
      'plague_burst',
      'entropy_pulse',
      'tidal_crush',
      'blood_nova',
      'quake_pulse',
    ];
    const bossSingleSpells = [
      'death_knell',
      'infernal_judgment',
      'soul_rend',
      'blood_pact',
      'soul_lance',
      'solar_judgment',
      'rift_lance',
      'obsidian_lance',
      'aurora_judgment',
    ];`
  );

  src = src.replace(
    `    if (
      canArea &&
      spells.includes('thorn_nova') &&
      nearestD <= this.areaSpellReach(monster, 'thorn_nova', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'thorn_nova';
    }`,
    `    if (
      canArea &&
      spells.includes('thorn_nova') &&
      nearestD <= this.areaSpellReach(monster, 'thorn_nova', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'thorn_nova';
    }
    if (
      canArea &&
      spells.includes('ash_nova') &&
      nearestD <= this.areaSpellReach(monster, 'ash_nova', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'ash_nova';
    }
    if (
      canArea &&
      spells.includes('mire_nova') &&
      nearestD <= this.areaSpellReach(monster, 'mire_nova', novaR) &&
      (monster.novaCd || 0) <= 0
    ) {
      return 'mire_nova';
    }`
  );

  src = src.replace(
    `    if (canArea && spells.includes('frost_breath') && nearestD <= (spellStats('frost_breath')?.range || 165)) {
      return 'frost_breath';
    }
    if (canArea && spells.includes('firebreath') && nearestD <= (spellStats('firebreath')?.range || 170)) {
      return 'firebreath';
    }
    if (spells.includes('hex_bolt') && nearestD <= (spellStats('hex_bolt')?.range || 245)) return 'hex_bolt';
    if (spells.includes('electric_bolt') && nearestD <= (spellStats('electric_bolt')?.range || 240)) {
      return 'electric_bolt';
    }
    if (spells.includes('arc_lightning') && nearestD <= lightningR) return 'arc_lightning';
    if (canArea && spells.includes('bone_volley') && nearestD <= shootRange) return 'bone_volley';
    if (canArea && spells.includes('skull_wave') && nearestD <= shootRange) return 'skull_wave';
    if (spells.includes('acid_bolt') && nearestD <= shootRange) return 'acid_bolt';
    if (spells.includes('crystal_bolt') && nearestD <= shootRange) return 'crystal_bolt';
    if (spells.includes('ice_shard') && nearestD <= shootRange) return 'ice_shard';
    if (spells.includes('firebolt') && nearestD <= shootRange) return 'firebolt';`,
    `    if (canArea && spells.includes('frost_breath') && nearestD <= (spellStats('frost_breath')?.range || 165)) {
      return 'frost_breath';
    }
    if (canArea && spells.includes('gale_breath') && nearestD <= (spellStats('gale_breath')?.range || 170)) {
      return 'gale_breath';
    }
    if (canArea && spells.includes('firebreath') && nearestD <= (spellStats('firebreath')?.range || 170)) {
      return 'firebreath';
    }
    if (spells.includes('hex_bolt') && nearestD <= (spellStats('hex_bolt')?.range || 245)) return 'hex_bolt';
    if (spells.includes('spark_bolt') && nearestD <= (spellStats('spark_bolt')?.range || 235)) {
      return 'spark_bolt';
    }
    if (spells.includes('electric_bolt') && nearestD <= (spellStats('electric_bolt')?.range || 240)) {
      return 'electric_bolt';
    }
    if (spells.includes('arc_lightning') && nearestD <= lightningR) return 'arc_lightning';
    if (canArea && spells.includes('bone_volley') && nearestD <= shootRange) return 'bone_volley';
    if (canArea && spells.includes('skull_wave') && nearestD <= shootRange) return 'skull_wave';
    if (spells.includes('acid_bolt') && nearestD <= shootRange) return 'acid_bolt';
    if (spells.includes('sap_bolt') && nearestD <= shootRange) return 'sap_bolt';
    if (spells.includes('crystal_bolt') && nearestD <= shootRange) return 'crystal_bolt';
    if (spells.includes('brine_bolt') && nearestD <= shootRange) return 'brine_bolt';
    if (spells.includes('dusk_bolt') && nearestD <= shootRange) return 'dusk_bolt';
    if (spells.includes('ice_shard') && nearestD <= shootRange) return 'ice_shard';
    if (spells.includes('ember_bolt') && nearestD <= shootRange) return 'ember_bolt';
    if (spells.includes('firebolt') && nearestD <= shootRange) return 'firebolt';`
  );

  src = src.replace(
    `    const AREA_SPELLS = new Set([
      'flame_nova',
      'poison_cloud',
      'electric_storm',
      'firebreath',
      'frost_breath',
      'skull_wave',
      'bone_volley',
      'magma_surge',
      'thorn_nova',
      'void_collapse',
      'abyss_nova',
      'frost_apocalypse',
      'plague_burst',
      'shadow_eclipse',
      'entropy_pulse',
      'tidal_crush',
      'cataclysm_beam',
    ]);`,
    `    const AREA_SPELLS = new Set([
      'flame_nova',
      'poison_cloud',
      'electric_storm',
      'firebreath',
      'frost_breath',
      'gale_breath',
      'skull_wave',
      'bone_volley',
      'magma_surge',
      'thorn_nova',
      'ash_nova',
      'mire_nova',
      'void_collapse',
      'abyss_nova',
      'frost_apocalypse',
      'plague_burst',
      'shadow_eclipse',
      'entropy_pulse',
      'tidal_crush',
      'blood_nova',
      'quake_pulse',
      'cataclysm_beam',
    ]);`
  );

  src = src.replace(
    `      case 'electric_bolt':
      case 'hex_bolt': {`,
    `      case 'electric_bolt':
      case 'hex_bolt':
      case 'spark_bolt': {`
  );

  src = src.replace(
    `      case 'firebolt':
      case 'ice_shard':
      case 'acid_bolt':
      case 'crystal_bolt': {
        if (!target) return false;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = monster.projectileSpeed || stats.speed || 480;
        const range = monster.range || stats.range || 300;
        const isIce = spellId === 'ice_shard' || spellId === 'crystal_bolt';
        const isAcid = spellId === 'acid_bolt';`,
    `      case 'firebolt':
      case 'ice_shard':
      case 'acid_bolt':
      case 'crystal_bolt':
      case 'ember_bolt':
      case 'sap_bolt':
      case 'brine_bolt':
      case 'dusk_bolt': {
        if (!target) return false;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = monster.projectileSpeed || stats.speed || 480;
        const range = monster.range || stats.range || 300;
        const isIce = ['ice_shard', 'crystal_bolt', 'brine_bolt', 'dusk_bolt'].includes(spellId);
        const isAcid = spellId === 'acid_bolt' || spellId === 'sap_bolt';`
  );

  src = src.replace(
    `      case 'flame_nova':
      case 'magma_surge': {
        const radius = Math.max(monster.novaRadius || 0, stats.radius || 0, 110);
        this.applyFlameNova(
          monster,
          monster.entityId,
          { ...stats, radius },
          Math.round(monster.damage * (spellId === 'magma_surge' ? 1.25 : 1.15)),
          false
        );`,
    `      case 'flame_nova':
      case 'magma_surge':
      case 'ash_nova': {
        const radius = Math.max(monster.novaRadius || 0, stats.radius || 0, 110);
        this.applyFlameNova(
          monster,
          monster.entityId,
          { ...stats, radius },
          Math.round(monster.damage * (spellId === 'magma_surge' || spellId === 'ash_nova' ? 1.25 : 1.15)),
          false
        );`
  );

  src = src.replace(
    `      case 'thorn_nova': {
        const radius = Math.max(monster.novaRadius || 0, stats.radius || 0, 100);
        const dmg = Math.round(monster.damage * 1.2);
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (dist(p, monster) > radius) continue;
          this.damageEntity(p, dmg, monster.entityId, true, true);
          this.applyPoison(
            p,
            monster.entityId,
            stats.poisonDamage || 3,
            stats.poisonTick || 1,
            stats.poisonDuration || 4
          );
        }
        this.effects.push({
          type: 'poison_burst',
          spellId: 'thorn_nova',`,
    `      case 'thorn_nova':
      case 'mire_nova': {
        const radius = Math.max(monster.novaRadius || 0, stats.radius || 0, 100);
        const dmg = Math.round(monster.damage * 1.2);
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (dist(p, monster) > radius) continue;
          this.damageEntity(p, dmg, monster.entityId, true, true);
          this.applyPoison(
            p,
            monster.entityId,
            stats.poisonDamage || 3,
            stats.poisonTick || 1,
            stats.poisonDuration || 4
          );
        }
        this.effects.push({
          type: 'poison_burst',
          spellId,`
  );

  src = src.replace(
    `this.spawnSpellImpact(monster.x, monster.y, 'thorn_nova', stats.color, 36);
        monster.attackCd = (monster.attackCooldown || 1.1) * 1.2;
        monster.novaCd = monster.novaCooldown || stats.cooldown || 4;
        break;
      }
      case 'firebreath':`,
    `this.spawnSpellImpact(monster.x, monster.y, spellId, stats.color, 36);
        monster.attackCd = (monster.attackCooldown || 1.1) * 1.2;
        monster.novaCd = monster.novaCooldown || stats.cooldown || 4;
        break;
      }
      case 'firebreath':`
  );

  src = src.replace(
    `      case 'firebreath':
      case 'frost_breath': {
        if (!target) return false;
        const range = stats.range || 170;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        if (len > range * 1.15) return false;
        const dirX = dx / len;
        const dirY = dy / len;
        const halfAngle = ((stats.coneAngle || 38) * Math.PI) / 180;
        const cosMin = Math.cos(halfAngle);
        const dmg = Math.round(monster.damage * (spellId === 'frost_breath' ? 1.2 : 1.35));
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const pdx = p.x - monster.x;
          const pdy = p.y - monster.y;
          const pd = Math.hypot(pdx, pdy);
          if (pd > range) continue;
          if (pd < 0.001 || (pdx / pd) * dirX + (pdy / pd) * dirY >= cosMin) {
            this.damageEntity(p, dmg, monster.entityId, true, true);
            if (spellId === 'frost_breath') {
              this.applyMonsterSlow(p, stats.slow || 0.4, stats.slowDuration || 2.8);
            }
          }
        }`,
    `      case 'firebreath':
      case 'frost_breath':
      case 'gale_breath': {
        if (!target) return false;
        const range = stats.range || 170;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        const len = Math.hypot(dx, dy) || 1;
        if (len > range * 1.15) return false;
        const dirX = dx / len;
        const dirY = dy / len;
        const halfAngle = ((stats.coneAngle || 38) * Math.PI) / 180;
        const cosMin = Math.cos(halfAngle);
        const dmg = Math.round(
          monster.damage * (spellId === 'frost_breath' || spellId === 'gale_breath' ? 1.2 : 1.35)
        );
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const pdx = p.x - monster.x;
          const pdy = p.y - monster.y;
          const pd = Math.hypot(pdx, pdy);
          if (pd > range) continue;
          if (pd < 0.001 || (pdx / pd) * dirX + (pdy / pd) * dirY >= cosMin) {
            this.damageEntity(p, dmg, monster.entityId, true, true);
            if (spellId === 'frost_breath' || spellId === 'gale_breath') {
              this.applyMonsterSlow(p, stats.slow || 0.4, stats.slowDuration || 2.8);
            }
          }
        }`
  );

  src = src.replace(
    `      case 'soul_rend':
      case 'death_knell':
      case 'blood_pact':
      case 'soul_lance':
      case 'rift_lance': {`,
    `      case 'soul_rend':
      case 'death_knell':
      case 'blood_pact':
      case 'soul_lance':
      case 'rift_lance':
      case 'obsidian_lance': {`
  );

  src = src.replace(
    `      case 'infernal_judgment':
      case 'solar_judgment': {`,
    `      case 'infernal_judgment':
      case 'solar_judgment':
      case 'aurora_judgment': {`
  );

  src = src.replace(
    `      case 'void_collapse':
      case 'abyss_nova':
      case 'frost_apocalypse':
      case 'plague_burst':
      case 'shadow_eclipse':
      case 'entropy_pulse':
      case 'tidal_crush': {`,
    `      case 'void_collapse':
      case 'abyss_nova':
      case 'frost_apocalypse':
      case 'plague_burst':
      case 'shadow_eclipse':
      case 'entropy_pulse':
      case 'tidal_crush':
      case 'blood_nova':
      case 'quake_pulse': {`
  );

  src = src.replace(
    `          const hasLongFiller = spells.some((id) =>
            [
              'firebolt',
              'ice_shard',
              'acid_bolt',
              'crystal_bolt',
              'electric_bolt',
              'hex_bolt',
              'skull_wave',
              'bone_volley',
            ].includes(id)
          );`,
    `          const hasLongFiller = spells.some((id) =>
            [
              'firebolt',
              'ice_shard',
              'acid_bolt',
              'crystal_bolt',
              'ember_bolt',
              'sap_bolt',
              'brine_bolt',
              'dusk_bolt',
              'spark_bolt',
              'electric_bolt',
              'hex_bolt',
              'skull_wave',
              'bone_volley',
            ].includes(id)
          );`
  );

  src = src.replace(
    `            (spells.includes('flame_nova') ||
              spells.includes('magma_surge') ||
              spells.includes('thorn_nova') ||
              spells.includes('electric_storm') ||
              spells.includes('abyss_nova') ||
              spells.includes('tidal_crush') ||
              spells.includes('void_collapse') ||
              spells.includes('shadow_eclipse') ||
              spells.includes('frost_apocalypse') ||
              spells.includes('plague_burst') ||
              spells.includes('entropy_pulse') ||
              spells.includes('poison_cloud')) &&`,
    `            (spells.includes('flame_nova') ||
              spells.includes('magma_surge') ||
              spells.includes('thorn_nova') ||
              spells.includes('ash_nova') ||
              spells.includes('mire_nova') ||
              spells.includes('electric_storm') ||
              spells.includes('abyss_nova') ||
              spells.includes('tidal_crush') ||
              spells.includes('void_collapse') ||
              spells.includes('shadow_eclipse') ||
              spells.includes('frost_apocalypse') ||
              spells.includes('plague_burst') ||
              spells.includes('entropy_pulse') ||
              spells.includes('blood_nova') ||
              spells.includes('quake_pulse') ||
              spells.includes('poison_cloud')) &&`
  );

  fs.writeFileSync(file, src);
  console.log('Updated server/Match.js');
}

function patchGalleryFx() {
  replaceOnce(
    path.join(root, 'client/src/ui/gallerySpellFx.js'),
    `  'acid_bolt',
  'crystal_bolt',
  'skull_wave',
  'bone_volley',
]);`,
    `  'acid_bolt',
  'crystal_bolt',
  'ember_bolt',
  'sap_bolt',
  'brine_bolt',
  'dusk_bolt',
  'skull_wave',
  'bone_volley',
]);`,
    'ember_bolt'
  );
}

function patchSpellIcons() {
  const file = path.join(root, 'client/src/scenes/BootScene.js');
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('ember_bolt:')) {
    console.log('Already patched spell icons in BootScene.js');
    return;
  }
  const icons = `
      ember_bolt: {
        rows: [
          '................',
          '..........OO....',
          '.........ORRO...',
          '........ORYYRO..',
          '.......ORYMMYRO.',
          '......ORYM..MYRO',
          '.....ORYM....YRO',
          '....ORYM....YRO.',
          '...ORYYM...YRO..',
          '..OORYYYYYRO....',
          '.OORRRRRRO......',
          'OORRRRRO........',
          '.OORRO..........',
          '...OO...........',
          '................',
          '................',
        ],
        palette: { O: 0xff7744, R: 0xff4422, Y: 0xffcc66, M: 0xaa2200 },
      },
      sap_bolt: {
        rows: [
          '................',
          '..........GG....',
          '.........GLLG...',
          '........GLYYLG..',
          '.......GLYYYYLG.',
          '......GLYYDYYLG.',
          '.....GLYYDDDYLG.',
          '....GLYYDDDDYLG.',
          '...GLYYYADDYLG..',
          '..GGGLYYYYYLG...',
          '.GLLLYYYYYLG....',
          'GLLLLLLLLG......',
          '.GGLLLLGG.......',
          '...GGGGG........',
          '................',
          '................',
        ],
        palette: { G: 0x3d6b1f, L: 0x6ab04c, Y: 0x88ff44, D: 0x1e8449, A: 0xc8ffa0 },
      },
      brine_bolt: {
        rows: [
          '................',
          '..........CC....',
          '.........CWLC...',
          '........CWLLLC..',
          '.......CWLPPLIC.',
          '......CWLP.PLIC.',
          '.....CWLP...PLIC',
          '....CWLP....PLIC',
          '...CWLPP...PLIC.',
          '..CCWLPPLICIC...',
          '.CWWWLLLICC.....',
          'CWWWWWWWCC......',
          '.CCWWWWCC.......',
          '...CCCCC........',
          '................',
          '................',
        ],
        palette: { C: 0x1abc9c, W: 0xa3e4d7, L: 0xffffff, P: 0x48c9b0, I: 0x16a085 },
      },
      spark_bolt: {
        rows: [
          '................',
          '.......YY.......',
          '......YWWY......',
          '.....YWLLWY.....',
          '....YW....WY....',
          '...YW..YY..WY...',
          '..YW..YWWY..WY..',
          '...YW..YY..WY...',
          '....YW....WY....',
          '.....YWLLWY.....',
          '......YWWY......',
          '.......YY.......',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { Y: 0xffee66, W: 0xffffff, L: 0xffdd33 },
      },
      dusk_bolt: {
        rows: [
          '................',
          '..........PP....',
          '.........PLLP...',
          '........PLVVLP..',
          '.......PLV..VLP.',
          '......PLV....VLP',
          '.....PLV......LP',
          '....PLV......LP.',
          '...PLVV.....LP..',
          '..PPLVVVVVLP....',
          '.PPLLLLLLP......',
          'PPLLLLLP........',
          '.PPLLP..........',
          '...PP...........',
          '................',
          '................',
        ],
        palette: { P: 0x4a235a, L: 0x7d3c98, V: 0xd7bde2 },
      },
      ash_nova: {
        rows: [
          '................',
          '....OOYOO.......',
          '..OORRRRROO.....',
          '.ORRYYYYRRRO....',
          '.ORY......YRO...',
          'ORY...MM...YRO..',
          'ORY...MM...YRO..',
          'ORY........YRO..',
          '.ORY......YRO...',
          '.ORRYYYYRRRO....',
          '..OORRRRROO.....',
          '....OOYOO.......',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { O: 0xa04000, R: 0x6e2c00, Y: 0xffaa44, M: 0x3e1f00 },
      },
      mire_nova: {
        rows: [
          '................',
          '....G..G..G.....',
          '..G.GGGGGG.G....',
          '.GGGLYYYLGGG....',
          '..GLYY..YYLG.G..',
          'G.GLY....YLG.G..',
          '..GLY.TT.YLG....',
          'G.GLY....YLG.G..',
          '..GLYY..YYLG....',
          '.GGGLYYYLGGG....',
          '..G.GGGGGG.G....',
          '....G..G..G.....',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { G: 0x2e4a22, L: 0x4a6741, Y: 0x6b8e23, T: 0x88ff44 },
      },
      gale_breath: {
        rows: [
          '................',
          'C...............',
          'WC..............',
          'BWC.............',
          'BBWC..C.........',
          'BBBWC.CWC.......',
          'BBBBWCWWBWC.....',
          'BBBBBWWWBBCW....',
          'BBBBWCWWBWC.....',
          'BBBWC.CWC.......',
          'BBWC..C.........',
          'BWC.............',
          'WC..............',
          'C...............',
          '................',
          '................',
        ],
        palette: { C: 0xaed6f1, W: 0xeaf2f8, B: 0x5dade2 },
      },
      obsidian_lance: {
        rows: [
          '................',
          '.......NN.......',
          '......NLLN......',
          '.....NLPPLN.....',
          '....NLP..PLN....',
          '...NLP....PLN...',
          '..NLP......PLN..',
          '...NLP....PLN...',
          '....NLP..PLN....',
          '.....NLPPLN.....',
          '......NLLN......',
          '.......NN.......',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { N: 0x0d0d12, L: 0x1c2833, P: 0x566573 },
      },
      blood_nova: {
        rows: [
          '................',
          '....RR..RR......',
          '..RRWWWWWWRR....',
          '.RWWCCCCCCWWR...',
          '.RWCC....CCWR...',
          'RWC...DD...CWR..',
          'RWC...DD...CWR..',
          '.RWCC....CCWR...',
          '.RWWCCCCCCWWR...',
          '..RRWWWWWWRR....',
          '....RR..RR......',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { R: 0x641e16, W: 0x922b21, C: 0xc0392b, D: 0xff6644 },
      },
      aurora_judgment: {
        rows: [
          '................',
          '.......WW.......',
          '......WCCW......',
          '.....WCCCCW.....',
          '....WCCYYCCW....',
          '...WCCYYYYCCW...',
          '..WCCYYOOYYCCW..',
          '...WCCYYYYCCW...',
          '....WCCYYCCW....',
          '.....WCCCCW.....',
          '......WRRW......',
          '.....WRRRRW.....',
          '....WRRRRRRW....',
          '................',
          '................',
          '................',
        ],
        palette: { W: 0xe8f8f5, C: 0x80deea, Y: 0xaed6f1, O: 0x48c9b0, R: 0x5dade2 },
      },
      quake_pulse: {
        rows: [
          '................',
          '....BB..BB......',
          '..BBWWWWWWBB....',
          '.BWWCCCCCCWWB...',
          '.BWCC....CCWB...',
          'BWC...DD...CWB..',
          'BWC...DD...CWB..',
          '.BWCC....CCWB...',
          '.BWWCCCCCCWWB...',
          '..BBWWWWWWBB....',
          '....BB..BB......',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        palette: { B: 0x4a3728, W: 0x7e5109, C: 0xb7950b, D: 0xf4d03f },
      },
`;

  const idx = src.indexOf('tidal_crush:');
  if (idx < 0) throw new Error('tidal_crush icon not found');
  const end = src.indexOf('\n    };', idx);
  if (end < 0) throw new Error('icons object end not found');
  src = src.slice(0, end) + icons + src.slice(end);
  fs.writeFileSync(file, src);
  console.log('Patched spell icons in BootScene.js');
}

function patchMonsters(themes) {
  const typeLines = [`\n    // ─── ${EXP_TAG} ─────────────────────────────────────`];
  typeLines.push('    // Normals (144)');
  for (let i = 0; i < 144; i++) typeLines.push(buildDef(themes[i], i));
  typeLines.push('\n    // Elites (96)');
  for (let i = 144; i < 240; i++) typeLines.push(buildDef(themes[i], i));
  typeLines.push('\n    // Bosses (60)');
  for (let i = 240; i < 300; i++) typeLines.push(buildDef(themes[i], i));

  const habitatLines = [`  // ${EXP_TAG}`];
  for (const [id, , , theme] of themes) {
    const floors = FLOORS[theme] || FLOORS.mixed;
    habitatLines.push(`  ${id}: [${floors.map((f) => `'${f}'`).join(', ')}],`);
  }

  const labelLines = [`  // ${EXP_TAG}`];
  for (const [id, label] of themes) {
    labelLines.push(`  ${id}: '${label.replace(/'/g, "\\'")}',`);
  }

  const spriteLines = [`      // ${EXP_TAG}`];
  for (const [id, , template, , color] of themes) {
    const body = color;
    const dark = darken(color, 0.55);
    const light = lighten(color, 1.3);
    const eye = eyeColor(color);
    const accent = darken(color, 0.35);
    spriteLines.push(
      `      ['${id}', '${template}', 0x${body.toString(16).padStart(6, '0')}, 0x${dark.toString(16).padStart(6, '0')}, 0x${light.toString(16).padStart(6, '0')}, 0x${eye.toString(16).padStart(6, '0')}, 0x${accent.toString(16).padStart(6, '0')}],`
    );
  }

  const outDir = path.join(root, 'scripts', '_gen');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'exp8-types.js'), typeLines.join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'exp8-habitats.js'), habitatLines.join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'exp8-labels.js'), labelLines.join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'exp8-sprites.js'), spriteLines.join('\n') + '\n');

  insertBefore(
    path.join(root, 'server/monsterTypes.js'),
    '  };\n\n  // Habitats RPG',
    typeLines.join('\n') + '\n',
    EXP_TAG
  );
  insertBefore(
    path.join(root, 'server/monsterHabitats.js'),
    '};\n\nexport function floorsForMonster',
    habitatLines.join('\n') + '\n',
    EXP_TAG
  );
  insertBefore(
    path.join(root, 'client/src/catalog/monsterLabels.js'),
    '};\n\nexport function monsterLabel',
    labelLines.join('\n') + '\n',
    EXP_TAG
  );
  insertBefore(
    path.join(root, 'client/src/scenes/BootScene.js'),
    '    ];\n\n    const clampCh',
    spriteLines.join('\n') + '\n',
    EXP_TAG
  );
}

// ── Main ──
const themes = generateThemes();
if (themes.length !== 300) {
  console.error('Expected 300 themes, got', themes.length);
  process.exit(1);
}

patchSpells();
patchMatch();
patchGalleryFx();
patchSpellIcons();
patchMonsters(themes);

console.log('Done. Generated', themes.length, 'monsters + 12 spells.');
console.log('Examples:', themes.slice(0, 3).map((t) => t[0]).join(', '), '...');
console.log('Boss examples:', themes.slice(240, 243).map((t) => t[0]).join(', '));
