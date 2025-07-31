type Anime = {
  mal_id: number;
  titles: string[];
  synopsis: string;
  episodes: number;
  status: string;
  score: number;
  start_date?: string;
  end_date?: string;
  trailer?: string;
  image_url?: string;
};

const resultsEl = document.getElementById('results')!;
const historyEl = document.getElementById('history')!;
const favEl = document.getElementById('favorites')!;
const textInput = document.getElementById('textInput') as HTMLInputElement;
const searchBtn = document.getElementById('searchBtn')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;

let searchHistory: string[] = JSON.parse(getCookie('history') || '[]');
let favs = JSON.parse(getCookie('favs') || '[]') as Anime[];

renderHistory();
renderFavs();

searchBtn.addEventListener('click', () => {
  const q = textInput.value.trim();
  if (!q) return;
  pushHistory(q);
  searchByText(q);
});
fileInput.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  pushHistory('[IMAGE]');
  searchByImage(f);
});

function pushHistory(q: string) {
  searchHistory = [q, ...searchHistory.filter(x=>x!==q)].slice(0,10);
  setCookie('history', JSON.stringify(searchHistory), 365);
  renderHistory();
}

function pushFav(a: Anime) {
  if (!favs.find(x=>x.mal_id===a.mal_id)) {
    favs.push(a);
    setCookie('favs', JSON.stringify(favs), 365);
    renderFavs();
  }
}

function renderHistory() {
  historyEl.innerHTML = searchHistory.map(h=>`<li>${h}</li>`).join('');
}
function renderFavs() {
  favEl.innerHTML = favs.map(a=>`<li>${a.titles[0]}</li>`).join('');
}

async function searchByText(q: string) {
  resultsEl.innerHTML = `<p class="text-gray-400 animate-pulse">Searching…</p>`;
  const resp = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=5`);
  const j = await resp.json();
  const list = j.data.map((d:any): Anime => ({
    mal_id: d.mal_id,
    titles: [d.title, d.title_english].filter(Boolean),
    synopsis: d.synopsis,
    episodes: d.episodes, status: d.status,
    score: d.score,
    start_date: d.aired?.from, end_date: d.aired?.to,
    trailer: d.trailer?.youtube_id? `https://www.youtube.com/watch?v=${d.trailer.youtube_id}`:'',
    image_url: d.images.jpg.image_url
  }));
  showResults(list);
}

async function searchByImage(file: File) {
  resultsEl.innerHTML = `<p class="text-gray-400 animate-pulse">Analyzing image…</p>`;
  const form = new FormData();
  form.append('file', file);
  const resp = await fetch(`https://api.trace.moe/search?anilistInfo`, {method:'POST', body:form});
  const j = await resp.json();
  if(!j.result?.length) {
    resultsEl.innerHTML = `<p class="text-red-500">No match found.</p>`;
    return;
  }
  const top = j.result[0];
  // fetch MAL details via Jikan using MAL ID derived: j.result[0].mal_id
  const malResp = await fetch(`https://api.jikan.moe/v4/anime/${top.anilist.id}`);
  const dm = await malResp.json();
  await searchByText(dm.data.title);
}

function showResults(items: Anime[]) {
  resultsEl.innerHTML = items.map(a => `
    <div class="bg-gray-800 rounded p-4 mb-4 flex gap-4">
      <img src="${a.image_url}" alt="cover" class="w-24 h-32 object-cover rounded"/>
      <div class="flex-grow">
        <h3 class="text-xl text-indigo-400">${a.titles[0]}</h3>
        <p class="text-gray-300">${a.synopsis?.substring(0,200)}…</p>
        <div class="mt-2 space-x-2 text-gray-400">
          <span>Episodes: ${a.episodes}</span>
          <span>Status: ${a.status}</span>
          <span>Score: ${a.score}</span>
        </div>
        ${a.trailer ? `<a href="${a.trailer}" target="_blank" class="mt-2 inline-block text-indigo-300">Watch Trailer</a>` : ''}
        <button class="ml-4 text-red-400 hover:text-red-600" data-id="${a.mal_id}">❤ Favorite</button>
      </div>
    </div>
  `).join('');
  resultsEl.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt((btn as HTMLElement).dataset.id!);
      const ani = items.find(x=>x.mal_id===id);
      if(ani) pushFav(ani);
    });
  });
}

// simple cookie helpers
function setCookie(n:string,v:string,days:number) {
  document.cookie = `${n}=${encodeURIComponent(v)}; max-age=${days*86400}; path=/`;
}
function getCookie(n:string) {
  const m = document.cookie.match('(?:^|; )'+n+'=([^;]*)');
  return m ? decodeURIComponent(m[1]) : '';
}
