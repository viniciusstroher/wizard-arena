import { formatFeatureDate, loadFeatures, markdownToHtml } from '../features/index.js';

/**
 * Modal de Features — blog com data, título e conteúdo dos markdowns.
 * @returns {{ close: () => void }}
 */
export function openFeaturesModal() {
  const posts = loadFeatures();

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
    'width: min(640px, 96vw)',
    'max-height: 90vh',
    'display: flex',
    'flex-direction: column',
    'background: #161228',
    'border: 2px solid #6b5cff',
    'border-radius: 14px',
    'padding: 22px 22px 18px',
    'font-family: Trebuchet MS, sans-serif',
    'color: #f0e8ff',
    'box-shadow: 0 16px 48px rgba(0,0,0,0.55)',
    'box-sizing: border-box',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText =
    'display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; flex-shrink: 0;';

  const title = document.createElement('div');
  title.textContent = 'Features';
  title.style.cssText = 'font-family: Georgia, serif; font-size: 26px; color: #f4e8ff;';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Fechar';
  closeBtn.style.cssText =
    'padding: 8px 14px; border: none; border-radius: 6px; background: #443866; color: #fff; cursor: pointer; font-family: Trebuchet MS, sans-serif;';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const subtitle = document.createElement('div');
  subtitle.textContent = 'Novidades e mudanças do Wizard Arena';
  subtitle.style.cssText = 'font-size: 13px; color: #9a8bb8; margin-bottom: 14px; flex-shrink: 0;';

  const body = document.createElement('div');
  body.style.cssText = [
    'overflow: auto',
    'flex: 1',
    'min-height: 0',
    'padding-right: 4px',
  ].join(';');

  if (!posts.length) {
    const empty = document.createElement('div');
    empty.textContent = 'Nenhuma feature cadastrada ainda.';
    empty.style.cssText = 'color: #9a8bb8; font-size: 14px; padding: 24px 0;';
    body.appendChild(empty);
  } else {
    for (const post of posts) {
      body.appendChild(renderPost(post));
    }
  }

  panel.appendChild(header);
  panel.appendChild(subtitle);
  panel.appendChild(body);
  dim.appendChild(panel);
  document.body.appendChild(dim);

  function close() {
    dim.remove();
  }

  closeBtn.addEventListener('click', close);
  dim.addEventListener('click', (e) => {
    if (e.target === dim) close();
  });

  return { close };
}

/**
 * @param {{ date: string, title: string, body: string }} post
 */
function renderPost(post) {
  const article = document.createElement('article');
  article.style.cssText = [
    'padding: 16px 0',
    'border-bottom: 1px solid rgba(74, 61, 120, 0.55)',
  ].join(';');

  const dateEl = document.createElement('div');
  dateEl.textContent = formatFeatureDate(post.date);
  dateEl.style.cssText =
    'font-size: 12px; color: #b8a6ff; letter-spacing: 0.02em; margin-bottom: 6px; text-transform: capitalize;';

  const titleEl = document.createElement('h2');
  titleEl.textContent = post.title;
  titleEl.style.cssText =
    'font-family: Georgia, serif; font-size: 20px; color: #f4e8ff; font-weight: 600; margin: 0 0 10px;';

  const contentEl = document.createElement('div');
  contentEl.style.cssText = 'font-size: 14px;';
  contentEl.innerHTML = markdownToHtml(post.body);

  article.appendChild(dateEl);
  article.appendChild(titleEl);
  article.appendChild(contentEl);
  return article;
}
