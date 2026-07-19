/** Elementos do bruxo (espelha server/elements.js). */

export const WIZARD_ELEMENTS = [
  { id: 'crimson', label: 'Fogo', color: '#ff5555' },
  { id: 'azure', label: 'Água', color: '#55aaff' },
  { id: 'emerald', label: 'Natureza', color: '#55ff99' },
  { id: 'amber', label: 'Terra', color: '#ffaa33' },
  { id: 'necromancer', label: 'Sombra', color: '#8844cc' },
];

export function elementLabel(id) {
  return WIZARD_ELEMENTS.find((e) => e.id === id)?.label || id || '—';
}

export function elementColor(id) {
  return WIZARD_ELEMENTS.find((e) => e.id === id)?.color || '#c4b5e0';
}
