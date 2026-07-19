import { fetchLeaderboard } from '../api.js';
import { elementColor, elementLabel, WIZARD_ELEMENTS } from '../catalog/elements.js';

const SECTIONS = [
  { key: 'damage', title: 'Mais dano', unit: 'dano' },
  { key: 'kills', title: 'Mais abates', unit: 'kills' },
  { key: 'deaths', title: 'Mais mortes', unit: 'mortes' },
  { key: 'points', title: 'Mais pontos', unit: 'pts' },
];

function btnStyle(active) {
  return [
    'padding: 7px 12px',
    'border: 1px solid ' + (active ? '#8b7cff' : '#3a2f66'),
    'border-radius: 6px',
    'background: ' + (active ? '#3a2f6e' : '#1a1430'),
    'color: ' + (active ? '#f4e8ff' : '#9a8bb8'),
    'font-family: Trebuchet MS, sans-serif',
    'font-size: 12px',
    'cursor: pointer',
  ].join(';');
}

function formatValue(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('pt-BR');
}

function renderColumn(section, rows) {
  const col = document.createElement('div');
  col.style.cssText = [
    'flex: 1',
    'min-width: 180px',
    'background: rgba(20, 16, 36, 0.9)',
    'border: 1px solid #3a2f66',
    'border-radius: 10px',
    'padding: 12px',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = section.title;
  title.style.cssText =
    'font-family: Georgia, serif; font-size: 16px; color: #f4e8ff; margin-bottom: 10px;';
  col.appendChild(title);

  if (!rows?.length) {
    const empty = document.createElement('div');
    empty.textContent = 'Sem dados ainda';
    empty.style.cssText = 'color: #9a8bb8; font-size: 13px; padding: 12px 0;';
    col.appendChild(empty);
    return col;
  }

  rows.forEach((row) => {
    const line = document.createElement('div');
    line.style.cssText = [
      'display: flex',
      'align-items: baseline',
      'justify-content: space-between',
      'gap: 8px',
      'padding: 7px 0',
      'border-bottom: 1px solid rgba(74, 61, 120, 0.45)',
    ].join(';');

    const left = document.createElement('div');
    left.style.cssText = 'min-width: 0; flex: 1;';

    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display: flex; gap: 6px; align-items: center;';

    const rank = document.createElement('span');
    rank.textContent = `${row.rank}.`;
    rank.style.cssText = 'color: #9a8bb8; font-size: 12px; width: 22px; flex-shrink: 0;';

    const name = document.createElement('span');
    name.textContent = row.name || 'Bruxo';
    name.style.cssText =
      'color: #f4e8ff; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

    nameRow.appendChild(rank);
    nameRow.appendChild(name);

    const meta = document.createElement('div');
    meta.textContent = `${elementLabel(row.wizardType)} · ${row.matches} partida${row.matches === 1 ? '' : 's'}`;
    meta.style.cssText = `font-size: 11px; color: ${elementColor(row.wizardType)}; margin: 2px 0 0 28px;`;

    left.appendChild(nameRow);
    left.appendChild(meta);

    const value = document.createElement('div');
    value.textContent = formatValue(row.value);
    value.title = section.unit;
    value.style.cssText =
      'color: #c4b5e0; font-size: 14px; font-variant-numeric: tabular-nums; flex-shrink: 0;';

    line.appendChild(left);
    line.appendChild(value);
    col.appendChild(line);
  });

  return col;
}

/**
 * Modal de leaderboard (somente humanos; filtro por elemento).
 * @returns {{ close: () => void }}
 */
export function openLeaderboardModal() {
  let element = 'all';
  let loading = false;

  const dim = document.createElement('div');
  dim.style.cssText = [
    'position: fixed',
    'inset: 0',
    'background: rgba(0,0,0,0.62)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'z-index: 9999',
    'padding: 20px',
    'box-sizing: border-box',
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'width: min(1100px, 96vw)',
    'max-height: 90vh',
    'overflow: auto',
    'background: #161228',
    'border: 2px solid #6b5cff',
    'border-radius: 14px',
    'padding: 22px 22px 18px',
    'font-family: Trebuchet MS, sans-serif',
    'color: #f0e8ff',
    'box-shadow: 0 16px 48px rgba(0,0,0,0.55)',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText =
    'display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px;';

  const title = document.createElement('div');
  title.textContent = 'Leaderboard';
  title.style.cssText = 'font-family: Georgia, serif; font-size: 26px; color: #f4e8ff;';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Fechar';
  closeBtn.style.cssText =
    'padding: 8px 14px; border: none; border-radius: 6px; background: #443866; color: #fff; cursor: pointer; font-family: Trebuchet MS, sans-serif;';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const subtitle = document.createElement('div');
  subtitle.textContent = 'Ranking de bruxos — apenas jogadores reais';
  subtitle.style.cssText = 'font-size: 13px; color: #9a8bb8; margin-bottom: 14px;';

  const filters = document.createElement('div');
  filters.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;';

  const body = document.createElement('div');
  body.style.cssText = 'display: flex; flex-wrap: wrap; gap: 12px;';

  const status = document.createElement('div');
  status.style.cssText = 'min-height: 18px; font-size: 13px; color: #9a8bb8; margin-top: 10px;';

  panel.appendChild(header);
  panel.appendChild(subtitle);
  panel.appendChild(filters);
  panel.appendChild(body);
  panel.appendChild(status);
  dim.appendChild(panel);
  document.body.appendChild(dim);

  function close() {
    dim.remove();
  }

  closeBtn.addEventListener('click', close);
  dim.addEventListener('click', (e) => {
    if (e.target === dim) close();
  });

  function paintFilters() {
    filters.innerHTML = '';
    const options = [{ id: 'all', label: 'Todos' }, ...WIZARD_ELEMENTS];
    for (const opt of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = opt.label;
      b.style.cssText = btnStyle(element === opt.id);
      if (opt.color) b.style.borderColor = element === opt.id ? opt.color : '#3a2f66';
      b.addEventListener('click', () => {
        element = opt.id;
        paintFilters();
        load();
      });
      filters.appendChild(b);
    }
  }

  async function load() {
    if (loading) return;
    loading = true;
    status.textContent = 'Carregando...';
    status.style.color = '#9a8bb8';
    body.innerHTML = '';
    try {
      const data = await fetchLeaderboard({
        element: element === 'all' ? null : element,
        limit: 12,
      });
      body.innerHTML = '';
      for (const section of SECTIONS) {
        body.appendChild(renderColumn(section, data[section.key] || []));
      }
      status.textContent = data.filter
        ? `Filtro: ${elementLabel(data.filter)}`
        : 'Todos os elementos';
    } catch (err) {
      status.textContent = err.message || 'Falha ao carregar';
      status.style.color = '#ff6b6b';
    } finally {
      loading = false;
    }
  }

  paintFilters();
  load();

  return { close };
}
