/* ===== Config ===== */
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 1 day

// Genre name → Jikan API genre IDs
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

/* ===== Elements ===== */
const resultsEl   = document.getElementById('results');
const historyEl   = document.getElementById('history');
const favEl       = document.getElementById('favorites');
const textInput   = document.getElementById('textInput');
const searchBtn   = document.getElementById('searchBtn');
const fileInput   = document.getElementById('fileInput');
const modal       = document.getElementById('modal');
const modalContent= document.getElementById('modalContent');

/* ===== State ===== */
let history = JSON.parse(getCookie('history') || '[]');
let favs    = JSON.parse(getCookie('favs') || '[]');
let page    = 1;
let currentQuery = "";
let isLoading = false;

/* ===== Init ===== */
renderHistory();
renderFavs();

/* ===== Event Listeners ===== */
searchBtn.onclick = startSearch;
textInput.onkeydown = e => { if (e.key === "Enter") startSearch(); };

let debounceTimer;
textInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const q = textInput.value.trim();
    if (q.length >= 2) showSuggestions(q);
    else textInput.removeAttribute('list');
  }, 250);
});

fileInput.onchange = () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  pushHistory('[Image Search]');
  searchByImage(file);
};

// Handle clicks inside results
resultsEl.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const malId = btn.dataset.malid;
  if (!malId) return;

  if (btn.dataset.action === "view") {
    viewDetails(Number(malId));
  }
  if (btn.dataset.action === "fav") {
    const title = btn.closest('.anime-card')?.querySelector('h3')?.innerText;
    if (title) pushFav({ mal_id: Number(malId), title });
  }
});

// Infinite Scroll
window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    if (currentQuery && !isLoading) {
      page++;
      const genres = getSelectedGenres();
      searchByText(currentQuery, page, genres, true);
    }
  }
});

/* ===== Core Functions ===== */
function getSelectedGenres() {
  return Array.from(document.querySelectorAll('#genreSelection input[name="genres"]:checked'))
    .map(box => genreNameToId[box.value])
    .filter(Boolean);
}

function startSearch() {
  const q = textInput.value.trim();
  const genres = getSelectedGenres();
  if (!q && genres.length === 0) return; // prevent empty search
  currentQuery = q;
  page = 1;
  pushHistory(q || '[Genre Filter]');
  searchByText(q, page, genres, false);
}

async function searchByText(query, p = 1, genres = [], append = false) {
  const cacheKey = `${query}-page${p}-genres${genres.sort().join(',')}`;
  const cached = getCache(cacheKey);
  if (cached) return showResults(cached, append);

  if (!append) showLoading("Searching…");

  isLoading = true;
  try {
    const genreParam = genres.length ? `&genres=${genres.join(',')}` : '';
    const queryParam = query ? `&q=${encodeURIComponent(query)}` : '';
    const url = `https://api.jikan.moe/v4/anime?page=${p}&limit=12${queryParam}${genreParam}`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Failed to fetch");

    const data = await resp.json();
    const list = data.data.map(d => ({
      mal_id: d.mal_id,
      title: d.title_english ?? d.title,
      synopsis: d.synopsis,
      episodes: d.episodes,
      status: d.status,
      score: d.score,
      image_url: d.images?.jpg?.large_image_url ?? ''
    }));

    setCache(cacheKey, list);
    showResults(list, append);
  } catch (err) {
    if (!append) showError("⚠️ Failed to fetch results.");
  } finally {
    isLoading = false;
  }
}

async function searchByImage(file) {
  showLoading("Analyzing image…");
  const form = new FormData();
  form.append('image', file);

  try {
    const resp = await fetch('https://api.trace.moe/search?anilistInfo', {
      method: 'POST', body: form
    });
    if (!resp.ok) throw new Error("Image search failed");
    const j = await resp.json();
    if (!j.result?.length) return showError("❌ No match found.");
    searchByText(j.result[0].anilist.id.toString());
  } catch {
    showError("⚠️ Image analysis failed.");
  }
}

function showResults(items, append = false) {
  if (!items.length && !append) return showError("No results found.");

  const html = items.map(a => `
    <div class="anime-card bg-gray-800 rounded-lg p-4 flex gap-4 fade-in-up shadow hover:shadow-lg transition">
      <img src="${a.image_url}" loading="lazy" alt="cover" class="w-24 h-32 object-cover rounded shadow-md"/>
      <div class="flex-grow">
        <h3 class="text-lg font-semibold text-indigo-300">${a.title}</h3>
        <p class="text-gray-300 text-sm">${a.synopsis?.substring(0, 150) ?? 'N/A'}…</p>
        <div class="mt-2 space-x-3 text-gray-400 text-xs">
          <span>📺 Ep: ${a.episodes ?? 'N/A'}</span>
          <span>📌 ${a.status ?? 'N/A'}</span>
          <span>⭐ ${a.score ?? 'N/A'}</span>
        </div>
        <div class="mt-3 space-x-3">
          <button data-action="view" data-malid="${a.mal_id}" class="text-indigo-400 hover:underline">View</button>
          <button data-action="fav" data-malid="${a.mal_id}" class="text-red-400 hover:text-red-500">❤ Fav</button>
        </div>
      </div>
    </div>
  `).join('');

  if (append) resultsEl.insertAdjacentHTML('beforeend', html);
  else resultsEl.innerHTML = html;
}

function showLoading(msg) {
  resultsEl.innerHTML = `<div class="text-gray-400 animate-pulse">${msg}</div>`;
}
function showError(msg) {
  resultsEl.innerHTML = `<div class="text-red-400">${msg}</div>`;
}

/* ===== Favorites & History ===== */
function pushFav(a) {
  if (!favs.find(x => x.mal_id === a.mal_id)) {
    favs.push(a);
    setCookie('favs', JSON.stringify(favs), 365);
    renderFavs();
  }
}
function renderFavs() {
  favEl.innerHTML = favs.map(a => `<li>${a.title}</li>`).join('') || "<li class='text-gray-500'>No favorites yet.</li>";
}

function pushHistory(q) {
  history = [q, ...history.filter(x => x !== q)].slice(0, 10);
  setCookie('history', JSON.stringify(history), 365);
  renderHistory();
}
function renderHistory() {
  historyEl.innerHTML = history.map(h => `<li>${h}</li>`).join('') || "<li class='text-gray-500'>No searches yet.</li>";
}

/* ===== Suggestions ===== */
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

/* ===== Details Modal ===== */
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
    <h2 class="text-2xl text-indigo-400 font-bold">${data.title_english ?? data.title}</h2>
    <img src="${data.images?.jpg?.large_image_url ?? ''}" class="w-full h-64 object-cover rounded"/>
    <p><strong>Genres:</strong> ${genres}</p>
    <p><strong>Characters:</strong> ${characters}</p>
    <p><strong>Episodes:</strong> ${data.episodes ?? 'N/A'}</p>
    <p><strong>Status:</strong> ${data.status ?? 'N/A'}</p>
    <p><strong>Score:</strong> ${data.score ?? 'N/A'}</p>
    <p class="text-gray-300"><strong>Synopsis:</strong> ${synopsis}</p>
    ${data.trailer?.youtube_id ? `
      <div class="mt-4">
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

/* ===== API Helpers ===== */
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
function setCookie(name, value, days) {
  document.cookie = `${name}=${encodeURIComponent(value)};max-age=${days * 86400};path=/`;
}
function getCookie(name) {
  const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
  return m ? decodeURIComponent(m[1]) : '';
}
