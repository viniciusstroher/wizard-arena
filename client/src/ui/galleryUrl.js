/**
 * Deep links da galeria no lobby.
 *
 * Exemplos:
 *   ?gallery=monsters
 *   ?gallery=spells
 *   ?gallery=spells&spell=firebolt
 *   ?gallery=monsters&monster=goblin
 */

export function parseGalleryUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const gallery = String(params.get('gallery') || '').trim().toLowerCase();
  if (gallery !== 'monsters' && gallery !== 'spells') return null;

  const spell = String(params.get('spell') || '').trim();
  const monster = String(params.get('monster') || '').trim();

  return {
    tab: gallery,
    spellId: spell || null,
    monsterId: monster || null,
  };
}

export function buildGalleryUrl({ tab, spellId = null, monsterId = null } = {}) {
  const url = new URL(window.location.href);
  if (!tab) {
    url.searchParams.delete('gallery');
    url.searchParams.delete('spell');
    url.searchParams.delete('monster');
    return url;
  }

  url.searchParams.set('gallery', tab);
  if (tab === 'spells' && spellId) {
    url.searchParams.set('spell', spellId);
    url.searchParams.delete('monster');
  } else if (tab === 'monsters' && monsterId) {
    url.searchParams.set('monster', monsterId);
    url.searchParams.delete('spell');
  } else {
    url.searchParams.delete('spell');
    url.searchParams.delete('monster');
  }
  return url;
}

export function syncGalleryUrl(state) {
  const url = buildGalleryUrl(state);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  window.history.replaceState(null, '', next);
}

export function clearGalleryUrl() {
  syncGalleryUrl({ tab: null });
}

export function galleryShareUrl({ tab, spellId = null, monsterId = null } = {}) {
  const url = buildGalleryUrl({ tab, spellId, monsterId });
  return url.toString();
}
