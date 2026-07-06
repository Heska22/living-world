const grid = document.getElementById('grid');
const statusLine = document.getElementById('status-line');
const tabs = document.querySelectorAll('.tab');
const dateTabsEl = document.getElementById('date-tabs');
const subjectTagsEl = document.getElementById('subject-tags');
const themeToggle = document.getElementById('theme-toggle');

let newsData = null;
let activeCategory = 'Mundo';
let activeTag = null;
let activeDate = null;

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

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
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
      renderCategory(activeCategory);
    });
    subjectTagsEl.appendChild(btn);
  });
}

function renderCategory(category) {
  activeCategory = category;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.cat === category));

  const allItems = (newsData && newsData.categories[category]) || [];
  renderTagFilters(allItems);

  const items = activeTag ? allItems.filter(i => i.tag === activeTag) : allItems;
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state">Nada aqui pra essa data/categoria/filtro.</div>';
    return;
  }

  items.forEach((item, i) => {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = `article.html?id=${encodeURIComponent(item.id)}&date=${encodeURIComponent(activeDate)}`;
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

async function loadDate(dateStr) {
  activeDate = dateStr;
  activeTag = null;
  document.querySelectorAll('.date-tab').forEach(t => t.classList.toggle('active', t.dataset.date === dateStr));

  try {
    const res = await fetch(`data/archive/${dateStr}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error('edição não encontrada');
    newsData = await res.json();
    statusLine.textContent = `Edição de ${formatDateLabel(dateStr)}`;
    renderCategory(activeCategory);
  } catch (err) {
    statusLine.textContent = 'Não consegui carregar essa edição.';
    grid.innerHTML = '';
  }
}

async function init() {
  try {
    const res = await fetch('data/archive/index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('sem índice de arquivo ainda');
    const dates = await res.json();

    if (dates.length === 0) {
      statusLine.textContent = 'Ainda não há edições arquivadas.';
      return;
    }

    dateTabsEl.innerHTML = '';
    dates.forEach((dateStr, i) => {
      const btn = document.createElement('button');
      btn.className = 'tab date-tab' + (i === 0 ? ' active' : '');
      btn.dataset.date = dateStr;
      btn.textContent = formatDateLabel(dateStr);
      btn.addEventListener('click', () => loadDate(dateStr));
      dateTabsEl.appendChild(btn);
    });

    loadDate(dates[0]);
  } catch (err) {
    statusLine.textContent = 'Ainda não há edições arquivadas — volte depois que o robô rodar pela primeira vez.';
  }
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activeTag = null;
    renderCategory(tab.dataset.cat);
  });
});

init();
