/* ===== Config ===== */
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 1 day

// Map genre names to Jikan API genre IDs
const genreNameToId = {
  "Action": 1,
  "Adventure": 2,
  "Comedy": 4,
  "Drama": 8,
  "Fantasy": 10,
  "Horror": 14,
  "Mystery": 7,
  "Romance": 22,
  "Sci-Fi": 24,
  "Slice of Life": 36,
  "Sports": 30,
  "Thriller": 41,
};

/* ===== Elements (cached) ===== */
const resultsEl = document.getElementById('results');
const historyEl = document.getElementById('history');
const favEl = document.getElementById('favorites');
const textInput = document.getElementById('textInput');
const searchBtn = document.getElementById('searchBtn');
const fileInput = document.getElementById('fileInput');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const modalCloseBtn = document.getElementById('modalClose');

/* ===== State ===== */
let history = JSON.parse(getCookie('history') || '[]');
let favs = JSON.parse(getCookie('favs') || '[]');
let page = 1;
let currentQuery = "";

renderHistory();
renderFavs();

/* ===== Event Listeners ===== */
modalCloseBtn.onclick = () => modal.classList.add('hidden');

let debounceTimer;
textInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const q = textInput.value.trim();
    if (q.length >= 3) showSuggestions(q);
    else textInput.removeAttribute('list');
  }, 300);
});

searchBtn.onclick = startSearch;
textInput.onkeydown = e => { if (e.key === "Enter") startSearch(); };
fileInput.onchange = () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  pushHistory('[IMAGE]');
  searchByImage(f);
};

// Event delegation for results buttons (View, Fav)
resultsEl.addEventListener('click', e => {
  const viewBtn = e.target.closest('button');
  if (!viewBtn) return;
  if (viewBtn.textContent === 'View') {
    const malId = viewBtn.dataset.malid;
    if (malId) viewDetails(Number(malId));
  }
  if (viewBtn.textContent.includes('❤')) {
    const malId = viewBtn.dataset.malid;
    const title = viewBtn.closest('div')?.querySelector('h3')?.innerText;
    if (malId && title) pushFav({ mal_id: Number(malId), title });
  }
});

/* ===== Functions ===== */

function getSelectedGenres() {
  const checkedBoxes = document.querySelectorAll('#genreSelection input[name="genres"]:checked');
  return Array.from(checkedBoxes)
    .map(box => genreNameToId[box.value])
    .filter(Boolean);
}

function startSearch() {
  const q = textInput.value.trim();
  const genres = getSelectedGenres();
  if (!q && genres.length === 0) return; // prevent empty search
  currentQuery = q;
  page = 1;
  pushHistory(q || '[Filtered Search]');
  searchByText(q, page, genres);
}

async function searchByText(q, p = 1, genres = []) {
  // Create a cache key that includes genres
  const cacheKey = `${q}-page${p}-genres${genres.sort().join(',')}`;
  const cached = getCache(cacheKey);
  if (cached) {
    showResults(cached, p > 1);
    return;
  }

  if (p === 1) resultsEl.innerHTML = '<p class="animate-pulse text-gray-400">Searching…</p>';

  try {
    // Build the genres param for API (comma-separated genre IDs)
    const genreParam = genres.length ? `&genres=${genres.join(',')}` : '';
    const queryParam = q ? `&q=${encodeURIComponent(q)}` : '';
    const url = `https://api.jikan.moe/v4/anime?page=${p}&limit=10${queryParam}${genreParam}`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Failed fetching search results");
    const j = await resp.json();

    const list = j.data.map(d => ({
      mal_id: d.mal_id,
      title: d.title_english ?? d.title,
      synopsis: d.synopsis,
      episodes: d.episodes,
      status: d.status,
      score: d.score,
      image_url: d.images?.jpg?.large_image_url ?? ''
    }));
    setCache(cacheKey, list);
    showResults(list, p > 1);
  } catch {
    if (p === 1) resultsEl.innerHTML = '<p class="text-red-500">Error fetching results.</p>';
  }
}

async function searchByImage(file) {
  resultsEl.innerHTML = '<p class="animate-pulse text-gray-400">Analyzing image…</p>';
  const form = new FormData();
  form.append('image', file);
  try {
    const resp = await fetch('https://api.trace.moe/search?anilistInfo', { method: 'POST', body: form });
    if (!resp.ok) throw new Error("Image search failed");
    const j = await resp.json();
    if (!j.result?.length) {
      resultsEl.innerHTML = '<p class="text-red-500">No match found.</p>';
      return;
    }
    searchByText(j.result[0].anilist.id.toString());
  } catch {
    resultsEl.innerHTML = '<p class="text-red-500">Image analysis failed.</p>';
  }
}

function showResults(items, append = false) {
  if (!items.length && !append) {
    resultsEl.innerHTML = '<p class="text-gray-400">No results found.</p>';
    return;
  }
  const html = items.map(a => `
    <div class="bg-gray-800 rounded-lg p-4 mb-4 flex gap-4 fade-in-up">
      <img src="${a.image_url}" loading="lazy" alt="cover" class="w-24 h-32 object-cover rounded shadow-md"/>
      <div class="flex-grow">
        <h3 class="text-xl text-indigo-400">${a.title}</h3>
        <p class="text-gray-300">${a.synopsis?.substring(0, 150) ?? 'N/A'}…</p>
        <div class="mt-2 space-x-2 text-gray-400 text-sm">
          <span>Ep: ${a.episodes ?? 'N/A'}</span><span>Status: ${a.status ?? 'N/A'}</span><span>Score: ${a.score ?? 'N/A'}</span>
        </div>
        <button data-malid="${a.mal_id}" class="mt-2 text-indigo-300 cursor-pointer">View</button>
        <button data-malid="${a.mal_id}" class="ml-4 text-red-400 hover:text-red-600 cursor-pointer">❤ Fav</button>
      </div>
    </div>`).join('');
  if (append) resultsEl.insertAdjacentHTML('beforeend', html);
  else resultsEl.innerHTML = html;
}

window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    if (currentQuery) {
      page++;
      const genres = getSelectedGenres();
      searchByText(currentQuery, page, genres);
    }
  }
});

function pushFav(a) {
  if (!favs.find(x => x.mal_id === a.mal_id)) {
    favs.push(a);
    setCookie('favs', JSON.stringify(favs), 365);
    renderFavs();
  }
}

function renderFavs() {
  favEl.innerHTML = favs.map(a => `<li>${a.title}</li>`).join('');
}

function pushHistory(q) {
  history = [q, ...history.filter(x => x !== q)].slice(0, 10);
  setCookie('history', JSON.stringify(history), 365);
  renderHistory();
}

function renderHistory() {
  historyEl.innerHTML = history.map(h => `<li>${h}</li>`).join('');
}

window.viewDetails = async function(mal_id) {
  const cacheKey = `details-${mal_id}`;
  let data = getCache(cacheKey);
  if (!data) {
    try {
      data = await fetchDetails(mal_id);
      setCache(cacheKey, data);
    } catch {
      modalContent.innerHTML = '<p class="text-red-500">Failed to load details.</p>';
      modal.classList.remove('hidden');
      return;
    }
  }
  const synopsis = await translateText(data.synopsis ?? '');
  const genres = data.genres?.map(g => g.name).join(', ') ?? 'N/A';
  const characters = (data.characters?.data ?? []).slice(0, 5).map(c => c.character.name).join(', ') || 'N/A';

  modalContent.innerHTML = `
    <h2 class="text-2xl text-indigo-400">${data.title_english ?? data.title}</h2>
    <img src="${data.images?.jpg?.large_image_url ?? ''}" class="w-full h-64 object-cover rounded"/>
    <p><strong>Genres:</strong> ${genres}</p>
    <p><strong>Characters:</strong> ${characters}</p>
    <p><strong>Episodes:</strong> ${data.episodes ?? 'N/A'}</p>
    <p><strong>Status:</strong> ${data.status ?? 'N/A'}</p>
    <p><strong>Score:</strong> ${data.score ?? 'N/A'}</p>
    <p><strong>Synopsis:</strong> ${synopsis}</p>
    ${data.trailer?.youtube_id ? `
      <div id="trailerContainer" class="mt-4">
        <iframe
          class="w-full aspect-video rounded"
          src="https://www.youtube.com/embed/${data.trailer.youtube_id}"
          allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
          title="Trailer">
        </iframe>
      </div>` : ''}
  `;
  modal.classList.remove('hidden');
};

function showSuggestions(q) {
  const matches = history.filter(h => h.toLowerCase().includes(q.toLowerCase()));
  if (matches.length) {
    textInput.setAttribute('list', 'suggestions');
    let datalist = document.getElementById('suggestions');
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = 'suggestions';
      document.body.append(datalist);
    }
    datalist.innerHTML = matches.map(m => `<option value="${m}"/>`).join('');
  } else {
    textInput.removeAttribute('list');
  }
}

async function fetchDetails(mal_id) {
  const resp = await fetch(`https://api.jikan.moe/v4/anime/${mal_id}/full`);
  if (!resp.ok) throw new Error("Failed to fetch anime details");
  return (await resp.json()).data;
}

async function translateText(text) {
  if (!text) return 'N/A';
  try {
    const resp = await fetch('https://libretranslate.de/translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'auto', target: 'en' })
    });
    const j = await resp.json();
    return j.translatedText || text;
  } catch {
    return text;
  }
}

/* ===== Cache ===== */
function setCache(key, value) {
  localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() }));
}
function getCache(key) {
  const item = localStorage.getItem(key);
  if (!item) return null;
  try {
    const { value, ts } = JSON.parse(item);
    if (Date.now() - ts > CACHE_EXPIRY) {
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

/* ===== Cookies ===== */
function setCookie(n, v, days) {
  document.cookie = `${n}=${encodeURIComponent(v)};max-age=${days * 86400};path=/`;
}
function getCookie(n) {
  const m = document.cookie.match('(?:^|; )' + n + '=([^;]*)');
  return m ? decodeURIComponent(m[1]) : '';
}
