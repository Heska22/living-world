const grid = document.getElementById('grid');
const metaLine = document.getElementById('meta-line');
const statusLine = document.getElementById('status-line');
const tabs = document.querySelectorAll('.tab');
const subjectTagsEl = document.getElementById('subject-tags');
const themeToggle = document.getElementById('theme-toggle');

let newsData = null;
let activeCategory = 'Mundo';
let activeTag = null;

// ---------- Tema (claro/escuro) ----------
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

// ---------- Util ----------
function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function placeholderImage(seed) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/338`;
}

// ---------- Render ----------
function renderTagFilters(items) {
  const tags = [...new Set(items.map(i => i.tag).filter(Boolean))];
  subjectTagsEl.innerHTML = '';
  if (tags.length <= 1) return;

  tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'subject-tag' + (activeTag === tag ? ' active' : '');
    btn.textContent = tag;
    btn.addEventListener('click', () => {
      activeTag = activeTag === tag ? null : tag;
      render(activeCategory);
    });
    subjectTagsEl.appendChild(btn);
  });
}

function render(category) {
  activeCategory = category;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.cat === category));

  const allItems = (newsData && newsData.categories[category]) || [];
  renderTagFilters(allItems);

  const items = activeTag ? allItems.filter(i => i.tag === activeTag) : allItems;
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state">Nenhuma matéria encontrada aqui ainda. O robô ainda não rodou, a fonte não retornou nada, ou o filtro escolhido não tem resultado — tenta limpar o filtro ou volta mais tarde.</div>';
    return;
  }

  items.forEach((item, i) => {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = `article.html?id=${encodeURIComponent(item.id)}`;
    card.style.animationDelay = `${i * 60}ms`;

    card.innerHTML = `
      <img class="card-image" src="${item.image || placeholderImage(item.title)}" alt="" loading="lazy"
           onerror="this.src='${placeholderImage(item.title)}'">
      <div class="card-body">
        <span class="card-tag">${item.tag || category}</span>
        <h2>${item.title}</h2>
        ${item.resumo ? `<p class="card-resumo">${item.resumo}</p>` : ''}
        <div class="card-footer">
          <span>${item.source || ''}</span>
          <span>${timeAgo(item.published)}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function init() {
  try {
    const res = await fetch('data/news.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('news.json não encontrado');
    newsData = await res.json();

    const generated = new Date(newsData.generated_at);
    metaLine.textContent = `Atualizado em ${generated.toLocaleDateString('pt-BR')} às ${generated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    statusLine.textContent = '';

    render(activeCategory);
  } catch (err) {
    metaLine.textContent = 'Sem dados ainda';
    statusLine.textContent = 'Ainda não há um news.json publicado — assim que o GitHub Action rodar pela primeira vez, as matérias aparecem aqui.';
  }
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activeTag = null;
    render(tab.dataset.cat);
  });
});

init();
