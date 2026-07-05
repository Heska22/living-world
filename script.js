const grid = document.getElementById('grid');
const metaLine = document.getElementById('meta-line');
const statusLine = document.getElementById('status-line');
const tabs = document.querySelectorAll('.tab');

let newsData = null;
let activeCategory = 'Mundo';

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

function render(category) {
  activeCategory = category;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.cat === category));

  const items = (newsData && newsData.categories[category]) || [];
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state">Nenhuma matéria encontrada nessa categoria ainda. O robô ainda não rodou ou a fonte não retornou nada — tente novamente mais tarde.</div>';
    return;
  }

  items.forEach((item, i) => {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = item.link;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.style.animationDelay = `${i * 60}ms`;

    card.innerHTML = `
      <img class="card-image" src="${item.image || placeholderImage(item.title)}" alt="" loading="lazy"
           onerror="this.src='${placeholderImage(item.title)}'">
      <div class="card-body">
        <span class="card-tag">${category}</span>
        <h2>${item.title}</h2>
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
  tab.addEventListener('click', () => render(tab.dataset.cat));
});

init();
