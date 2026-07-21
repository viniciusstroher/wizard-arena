/**
 * Deep links da galeria no lobby.
 *
 * Exemplos:
 *   ?gallery=monsters
 *   ?gallery=spells
 *   ?gallery=floors
 *   ?gallery=items
 *   ?gallery=spells&spell=firebolt
 *   ?gallery=monsters&monster=goblin
 *   ?gallery=floors&floor=glacier
 *   ?gallery=items&item=copper_ore
 */

const GALLERY_TABS = new Set(['monsters', 'spells', 'floors', 'items', 'ores']);

export function parseGalleryUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const gallery = String(params.get('gallery') || '').trim().toLowerCase();
  const normalizedTab = gallery === 'ores' ? 'items' : gallery;
  if (!GALLERY_TABS.has(gallery)) return null;

  const spell = String(params.get('spell') || '').trim();
  const monster = String(params.get('monster') || '').trim();
  const floor = String(params.get('floor') || '').trim();
  const item = String(params.get('item') || params.get('ore') || '').trim();

  return {
    tab: normalizedTab,
    spellId: spell || null,
    monsterId: monster || null,
    floorId: floor || null,
    itemId: item || null,
    oreId: item || null,
  };
}

export function buildGalleryUrl({
  tab,
  spellId = null,
  monsterId = null,
  floorId = null,
  itemId = null,
  oreId = null,
} = {}) {
  const url = new URL(window.location.href);
  const displayTab = tab === 'items' ? 'items' : tab;
  const id = itemId || oreId;

  if (!tab) {
    url.searchParams.delete('gallery');
    url.searchParams.delete('spell');
    url.searchParams.delete('monster');
    url.searchParams.delete('floor');
    url.searchParams.delete('item');
    url.searchParams.delete('ore');
    return url;
  }

  url.searchParams.set('gallery', displayTab);
  if (tab === 'spells' && spellId) {
    url.searchParams.set('spell', spellId);
    url.searchParams.delete('monster');
    url.searchParams.delete('floor');
    url.searchParams.delete('item');
    url.searchParams.delete('ore');
  } else if (tab === 'monsters' && monsterId) {
    url.searchParams.set('monster', monsterId);
    url.searchParams.delete('spell');
    url.searchParams.delete('floor');
    url.searchParams.delete('item');
    url.searchParams.delete('ore');
  } else if (tab === 'floors' && floorId) {
    url.searchParams.set('floor', floorId);
    url.searchParams.delete('spell');
    url.searchParams.delete('monster');
    url.searchParams.delete('item');
    url.searchParams.delete('ore');
  } else if (tab === 'items' && id) {
    url.searchParams.set('item', id);
    url.searchParams.delete('spell');
    url.searchParams.delete('monster');
    url.searchParams.delete('floor');
    url.searchParams.delete('ore');
  } else {
    url.searchParams.delete('spell');
    url.searchParams.delete('monster');
    url.searchParams.delete('floor');
    url.searchParams.delete('item');
    url.searchParams.delete('ore');
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

export function galleryShareUrl({
  tab,
  spellId = null,
  monsterId = null,
  floorId = null,
  itemId = null,
  oreId = null,
} = {}) {
  const url = buildGalleryUrl({ tab, spellId, monsterId, floorId, itemId, oreId });
  return url.toString();
}
