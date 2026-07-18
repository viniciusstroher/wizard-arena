export const RESOLUTION_STORAGE_KEY = 'wa_resolution';

/** Resoluções 16:9 comuns para o tamanho da janela de exibição. */
export const RESOLUTIONS = [
  { id: '1280x720', label: '1280 × 720 (HD)', width: 1280, height: 720 },
  { id: '1366x768', label: '1366 × 768', width: 1366, height: 768 },
  { id: '1600x900', label: '1600 × 900 (HD+)', width: 1600, height: 900 },
  { id: '1920x1080', label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
  { id: '2560x1440', label: '2560 × 1440 (QHD)', width: 2560, height: 1440 },
];

const DEFAULT_RESOLUTION_ID = '1920x1080';

export function loadResolutionId() {
  try {
    const raw = localStorage.getItem(RESOLUTION_STORAGE_KEY);
    if (RESOLUTIONS.some((r) => r.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_RESOLUTION_ID;
}

export function saveResolutionId(id) {
  const res = RESOLUTIONS.find((r) => r.id === id);
  if (!res) return;
  try {
    localStorage.setItem(RESOLUTION_STORAGE_KEY, res.id);
  } catch {
    /* ignore */
  }
}

/**
 * Ajusta o container do jogo para a resolução escolhida (limitada à janela)
 * e pede ao Phaser para recalcular o Scale.FIT.
 */
export function applyResolution(id, game = null) {
  const res = RESOLUTIONS.find((r) => r.id === id) || RESOLUTIONS.find((r) => r.id === DEFAULT_RESOLUTION_ID);
  const container = document.getElementById('game-container');
  if (!container || !res) return;

  const maxW = window.innerWidth;
  const maxH = window.innerHeight;
  const fit = Math.min(1, maxW / res.width, maxH / res.height);
  const displayW = Math.max(1, Math.floor(res.width * fit));
  const displayH = Math.max(1, Math.floor(res.height * fit));

  container.style.width = `${displayW}px`;
  container.style.height = `${displayH}px`;

  if (game?.scale) {
    game.scale.refresh();
  }
}
