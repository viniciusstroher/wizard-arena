/**
 * Rotas da SPA (History API).
 *
 *   /                  → Home
 *   /character         → Personagem
 *   /matchmaking       → Lista de salas
 *   /matchmaking/<id>  → Sala / lobby da partida
 */

export function getRoute(pathname = window.location.pathname) {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/';

  if (path === '/') return { name: 'home' };
  if (path === '/character') return { name: 'character' };
  if (path === '/matchmaking') return { name: 'matchmaking' };

  const room = path.match(/^\/matchmaking\/([^/]+)$/);
  if (room) {
    return { name: 'room', matchId: decodeURIComponent(room[1]) };
  }

  return { name: 'home' };
}

export function sceneKeyForRoute(route) {
  switch (route?.name) {
    case 'character':
      return 'Character';
    case 'matchmaking':
      return 'Matchmaking';
    case 'room':
      return 'Lobby';
    case 'home':
    default:
      return 'Home';
  }
}

export function navigate(path, { replace = false } = {}) {
  const next = path.startsWith('/') ? path : `/${path}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const url = new URL(next, window.location.origin);
  const target = `${url.pathname}${url.search}${url.hash}`;
  if (target === current) {
    window.dispatchEvent(new CustomEvent('wa:navigate', { detail: getRoute(url.pathname) }));
    return;
  }
  if (replace) window.history.replaceState(null, '', target);
  else window.history.pushState(null, '', target);
  window.dispatchEvent(new CustomEvent('wa:navigate', { detail: getRoute(url.pathname) }));
}

/** Troca a cena Phaser conforme a rota atual. */
export function goToRoute(game, route = getRoute(), data = {}) {
  if (!game?.scene) return;
  const key = sceneKeyForRoute(route);
  const payload =
    route.name === 'room'
      ? { matchId: route.matchId, ...data }
      : { ...data };

  // Evita reiniciar a mesma tela (ex.: popstate / navigate duplicado)
  if (game.scene.isActive(key)) {
    if (key === 'Lobby') {
      const lobby = game.scene.getScene('Lobby');
      if (lobby?.matchId === payload.matchId) return;
    } else if (key !== 'Game') {
      return;
    }
  }

  game.scene.start(key, payload);
}

export function bindRouter(game) {
  const onNav = () => {
    const boot = game.scene.getScene('Boot');
    if (!boot?.textures?.exists('wizard_crimson')) {
      // Assets ainda não gerados — Boot cuida da 1ª rota
      return;
    }
    goToRoute(game, getRoute());
  };
  window.addEventListener('popstate', onNav);
  window.addEventListener('wa:navigate', onNav);
  return () => {
    window.removeEventListener('popstate', onNav);
    window.removeEventListener('wa:navigate', onNav);
  };
}
