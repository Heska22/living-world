const themeToggle = document.getElementById('theme-toggle');
const articleContent = document.getElementById('article-content');
const backLink = document.getElementById('back-link');

// ---------- Tema ----------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? 'modo claro' : 'modo escuro';
  localStorage.setItem('copaverde-theme', theme);
}
(function initTheme() {
  const saved = localStorage.getItem('copaverde-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
})();
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

function timeFormat(isoString) {
  const d = new Date(isoString);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function youtubeEmbedUrl(url) {
  if (url.includes('/embed/')) return url;
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return null;
}

function render(item, category) {
  const embed = item.video ? youtubeEmbedUrl(item.video) : null;
  const paragraphs = (item.materia || item.resumo || 'Sem conteúdo disponível pra essa matéria ainda.')
    .split(/\n\n+/)
    .map(p => `<p>${p}</p>`)
    .join('');

  articleContent.innerHTML = `
    <span class="card-tag">${item.tag || category}</span>
    <h1 class="article-title">${item.title}</h1>
    <div class="article-meta">${item.source || ''} · ${timeFormat(item.published)}</div>
    ${embed
      ? `<div class="article-video"><iframe src="${embed}" allowfullscreen loading="lazy"></iframe></div>`
      : (item.image ? `<img class="article-image" src="${item.image}" alt="">` : '')}
    <div class="article-body">
      ${paragraphs}
    </div>
    <p class="article-disclaimer">Texto reescrito automaticamente por IA a partir da matéria original, com propósito informativo.</p>
    <a class="original-link" href="${item.link}" target="_blank" rel="noopener noreferrer">Ver a matéria original em ${item.source || 'fonte original'} →</a>
  `;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const date = params.get('date');

  if (date) {
    backLink.href = 'archive.html';
    backLink.textContent = '← Voltar pro arquivo';
  }

  if (!id) {
    articleContent.innerHTML = '<p class="status-line">Matéria não especificada.</p>';
    return;
  }

  try {
    const url = date ? `data/archive/${date}.json` : 'data/news.json';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('dados não encontrados');
    const data = await res.json();

    let found = null;
    let foundCategory = null;
    for (const [category, items] of Object.entries(data.categories)) {
      const match = items.find(i => i.id === id);
      if (match) {
        found = match;
        foundCategory = category;
        break;
      }
    }

    if (!found) {
      articleContent.innerHTML = '<p class="status-line">Não encontrei essa matéria — ela pode ter saído da edição atual.</p>';
      return;
    }

    render(found, foundCategory);
  } catch (err) {
    articleContent.innerHTML = '<p class="status-line">Não consegui carregar essa matéria.</p>';
  }
}

init();
