/** Chamadas REST ao servidor. */

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro HTTP ${res.status}`);
  }
  return res.json();
}

export function fetchCharacterMatches(characterId, { limit = 30 } = {}) {
  const id = encodeURIComponent(characterId);
  return getJson(`/api/characters/${id}/matches?limit=${limit}`);
}

export function fetchLeaderboard({ element = null, limit = 15 } = {}) {
  const params = new URLSearchParams();
  if (element && element !== 'all') params.set('element', element);
  params.set('limit', String(limit));
  return getJson(`/api/leaderboard?${params.toString()}`);
}

export function fetchElements() {
  return getJson('/api/elements');
}
