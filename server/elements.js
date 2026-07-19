/** Elementos do bruxo (= wizardType no servidor). */

export const WIZARD_ELEMENTS = [
  { id: 'crimson', label: 'Fogo', color: '#ff5555' },
  { id: 'azure', label: 'Água', color: '#55aaff' },
  { id: 'emerald', label: 'Natureza', color: '#55ff99' },
  { id: 'amber', label: 'Terra', color: '#ffaa33' },
  { id: 'necromancer', label: 'Sombra', color: '#8844cc' },
];

const IDS = new Set(WIZARD_ELEMENTS.map((e) => e.id));

export function normalizeElement(value) {
  if (value == null || value === '' || value === 'all') return null;
  const id = String(value).toLowerCase().trim();
  return IDS.has(id) ? id : null;
}

export function elementLabel(id) {
  return WIZARD_ELEMENTS.find((e) => e.id === id)?.label || id || '—';
}
