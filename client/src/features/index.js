/**
 * Carrega posts de features a partir de markdowns `AAAA-MM-DD.md`.
 * Exibe apenas data, título e conteúdo.
 */

const DATE_RE = /(\d{4}-\d{2}-\d{2})\.md$/;

/** @type {Record<string, string>} */
const rawModules = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * @param {string} raw
 * @returns {{ title: string, body: string }}
 */
function parseMarkdown(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '').trim();
  if (!text) return { title: 'Sem título', body: '' };

  const lines = text.split(/\r?\n/);
  let title = 'Sem título';
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+)$/);
    if (m) {
      title = m[1].trim() || title;
      bodyStart = i + 1;
      break;
    }
  }

  while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart += 1;
  const body = lines.slice(bodyStart).join('\n').trim();
  return { title, body };
}

/**
 * Markdown mínimo → HTML seguro (parágrafos, listas, negrito, itálico, código).
 * @param {string} md
 */
export function markdownToHtml(md) {
  const escaped = String(md || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const blocks = escaped.split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const lines = block.split('\n');
      const isList = lines.every((l) => /^\s*[-*]\s+/.test(l) || l.trim() === '');
      if (isList) {
        const items = lines
          .filter((l) => l.trim())
          .map((l) => `<li>${inlineMd(l.replace(/^\s*[-*]\s+/, ''))}</li>`)
          .join('');
        return `<ul style="margin:0 0 10px 1.1em;padding:0;color:#e8dfff;">${items}</ul>`;
      }
      return `<p style="margin:0 0 10px;line-height:1.55;color:#e8dfff;">${inlineMd(
        lines.join('<br>')
      )}</p>`;
    })
    .join('');

  return html || '<p style="margin:0;color:#9a8bb8;">Sem conteúdo.</p>';
}

/** @param {string} s */
function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, '<code style="background:#1e1836;padding:1px 5px;border-radius:4px;font-size:0.92em;">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/**
 * @param {string} isoDate YYYY-MM-DD
 */
export function formatFeatureDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  try {
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('pt-BR', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * @returns {{ date: string, title: string, body: string }[]}
 */
export function loadFeatures() {
  const posts = [];

  for (const [path, raw] of Object.entries(rawModules)) {
    const match = path.match(DATE_RE);
    if (!match) continue;
    const date = match[1];
    const { title, body } = parseMarkdown(raw);
    posts.push({ date, title, body });
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return posts;
}
