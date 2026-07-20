/** Elementos mágicos das magias (independente dos elementos de personagem). */

export const SPELL_ELEMENTS = {
  fire: { id: 'fire', label: 'Fogo', color: 0xff5533 },
  ice: { id: 'ice', label: 'Gelo', color: 0x66ccff },
  lightning: { id: 'lightning', label: 'Raio', color: 0xffdd33 },
  poison: { id: 'poison', label: 'Veneno', color: 0x88ff44 },
  shadow: { id: 'shadow', label: 'Sombra', color: 0x8844cc },
  nature: { id: 'nature', label: 'Natureza', color: 0x27ae60 },
  holy: { id: 'holy', label: 'Sagrado', color: 0x55ff88 },
  arcane: { id: 'arcane', label: 'Arcano', color: 0xaa88ff },
  water: { id: 'water', label: 'Água', color: 0x5dade2 },
};

/** Mapa spellId → elementId. */
export const SPELL_ELEMENT_OF = {
  firebolt: 'fire',
  ice_shard: 'ice',
  arc_lightning: 'lightning',
  flame_nova: 'fire',
  mend: 'holy',
  poison_cloud: 'poison',
  blink: 'arcane',
  barrier: 'arcane',
  skull_bolt: 'shadow',
  water_orb: 'water',
  vine_spike: 'nature',
  skull_wave: 'shadow',
  firebreath: 'fire',
  electric_bolt: 'lightning',
  electric_storm: 'lightning',
  soul_rend: 'shadow',
  void_collapse: 'shadow',
  death_knell: 'shadow',
  cataclysm_beam: 'fire',
  blood_pact: 'shadow',
  abyss_nova: 'shadow',
  frost_apocalypse: 'ice',
  plague_burst: 'poison',
  infernal_judgment: 'fire',
  shadow_eclipse: 'shadow',
  acid_bolt: 'poison',
  frost_breath: 'ice',
  bone_volley: 'shadow',
  hex_bolt: 'shadow',
  magma_surge: 'fire',
  soul_lance: 'shadow',
  entropy_pulse: 'shadow',
  solar_judgment: 'holy',
  crystal_bolt: 'ice',
  thorn_nova: 'nature',
  rift_lance: 'arcane',
  tidal_crush: 'water',
  apocalypse: 'fire',
  time_freeze: 'arcane',
  storm_call: 'lightning',
};

export function spellElementId(spellId) {
  return SPELL_ELEMENT_OF[spellId] || 'arcane';
}

export function spellElementMeta(spellIdOrElement) {
  if (SPELL_ELEMENTS[spellIdOrElement]) return SPELL_ELEMENTS[spellIdOrElement];
  return SPELL_ELEMENTS[spellElementId(spellIdOrElement)] || SPELL_ELEMENTS.arcane;
}

export function spellElementLabel(spellIdOrElement) {
  return spellElementMeta(spellIdOrElement).label;
}

export function spellElementColor(spellIdOrElement) {
  return spellElementMeta(spellIdOrElement).color;
}

export function spellElementIconKey(spellIdOrElement) {
  const id = SPELL_ELEMENTS[spellIdOrElement]
    ? spellIdOrElement
    : spellElementId(spellIdOrElement);
  return `element_${id}`;
}

/** Cor CSS (#rrggbb) para UI DOM. */
export function spellElementCssColor(spellIdOrElement) {
  return `#${spellElementColor(spellIdOrElement).toString(16).padStart(6, '0')}`;
}
