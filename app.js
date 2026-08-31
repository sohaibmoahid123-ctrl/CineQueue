// ============================================================
// CineQueue — app.js
// ============================================================
import { API_KEY, BASE_URL, IMAGE_URL, YTS_API_URL } from './js/config.js';
import { handleYTSDownload, getAutoDownloadLinks } from './js/yts.js';
import { showDownloadPage } from './js/moviesmod.js';
import { getTvSeasonsInfo, buildSeasonDownloadList, selectTvSeason, selectTvEpisode } from './js/tv.js';
import { startHero, stopHeroTimer, paintHero } from './js/hero.js';
import { wireSearch } from './js/search.js';
import { handleNewServerDownload, handleMovieServer2Download } from './js/decryptor.js';


const app = document.getElementById('app');
const adScript = document.createElement('script');
adScript.dataset.zone = '11510328';
adScript.src = 'https://al5sm.com/tag.min.js';
document.head.appendChild(adScript);

let allMovies      = [];
let featuredMovies = [];

async function init() {
  showLoading();
  try {
    const pagesToFetch = [1, 2, 3, 4, 5];
    let genreMap = {};

    try {
      const [movieGenresRes, tvGenresRes] = await Promise.all([
        fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=en-US`).then(r => r.json()),
        fetch(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}&language=en-US`).then(r => r.json())
      ]);

      if (movieGenresRes?.genres) movieGenresRes.genres.forEach(g => { genreMap[g.id] = g.name; });
      if (tvGenresRes?.genres) tvGenresRes.genres.forEach(g => { genreMap[g.id] = g.name; });
    } catch (e) {
      console.error("Genre fetch error:", e);
    }

    const moviePromises = pagesToFetch.map(page =>
      fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}&include_adult=false`)
        .then(res => res.json()).catch(() => ({ results: [] }))
    );

    const tvPromises = pagesToFetch.map(page =>
      fetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=${page}`)
        .then(res => res.json()).catch(() => ({ results: [] }))
    );

    const [moviesDataList, tvDataList] = await Promise.all([
      Promise.all(moviePromises),
      Promise.all(tvPromises)
    ]);

    let rawItems = [];

moviesDataList.forEach(p => {
  p.results?.forEach(m => {
    if (!m.adult && m.vote_count > 50 && m.poster_path) {
      rawItems.push({ ...m, media_type: 'movie' });
    }
  });
});

tvDataList.forEach(p => {
  p.results?.forEach(tv => {
    if (tv.vote_count > 50 && tv.poster_path) {
      rawItems.push({
        ...tv,
        title: tv.name || tv.original_name,
        release_date: tv.first_air_date || new Date().getFullYear().toString(),
        media_type: 'tv'
      });
    }
  });
});

const uniqueItemsMap = new Map();
rawItems.forEach(item => {
  if (!uniqueItemsMap.has(item.id)) {
    uniqueItemsMap.set(item.id, item);
  }
});

const cleanRawItems = Array.from(uniqueItemsMap.values())
  .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));


const buildItem = (item, assignedGenre) => {
  const isTv = item.media_type === 'tv';
  const embedBase = isTv
    ? `https://vidsrc.to/embed/tv/${item.id}`
    : `https://vidsrc.to/embed/movie/${item.id}`;

  const calculatedTime = isTv 
    ? (30 + (item.id % 30)) 
    : (85 + (item.id % 65));

  return {
    id: item.id,
    title: item.title || item.name,
    posterUrl: item.poster_path ? `${IMAGE_URL}${item.poster_path}` : '',
    backdrop_path: item.backdrop_path || null,
    synopsis: item.overview || 'No synopsis available.',
year: parseInt((item.release_date || item.first_air_date || '2026').toString().split('-')[0]),
    rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 7.0,
    durationMinutes: calculatedTime,
    genre: assignedGenre,
    director: 'TMDB Cinema',
    cast: ['Popular Actor'],
    mediaType: item.media_type,
    downloadUrl1080p: embedBase,
    downloadUrl720p: embedBase
  };
};


    const allowedGenres = ['Action', 'Animation', 'Crime', 'Horror', 'Romance', 'Action & Adventure', 'Sci-Fi & Fantasy'];
    const genreCounts = {
      'Popular Movies': 0,
      'Action': 0,
      'Animation': 0,
      'Crime': 0,
      'Horror': 0,
      'Romance': 0
    };

async function init() {
  showLoading();
  try {
    const genreEndpoints = [
      { key: 'Popular Movies', url: `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=1` },
      { key: 'Action', url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28&sort_by=popularity.desc` },
      { key: 'Animation', url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=16&sort_by=popularity.desc` },
      { key: 'Crime', url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=80&sort_by=popularity.desc` },
      { key: 'Horror', url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=27&sort_by=popularity.desc` },
      { key: 'Romance', url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=10749&sort_by=popularity.desc` }
    ];

    const responses = await Promise.all(genreEndpoints.map(g => fetch(g.url).then(r => r.json())));
    
    const addedIds = new Set();
    allMovies = [];

    genreEndpoints.forEach((g, index) => {
      const results = responses[index].results || [];
      let count = 0;

      for (const item of results) {
        if (count >= 12) break;
        if (!item.poster_path || addedIds.has(item.id)) continue;

        const movieItem = { 
          ...item, 
          media_type: 'movie',
          assignedGenre: g.key 
        };
        
        allMovies.push(buildItem(movieItem));
        addedIds.add(item.id);
        count++;
      }
    });

    featuredMovies = allMovies.slice(0, 5);
    route();

  } catch (err) {
    console.error("Init Error:", err);
  } finally {
    hideLoading();
  }
}



window.addEventListener('hashchange', route);

function route() {
  const hash = window.location.hash.slice(1);
  stopHeroTimer();
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (hash.startsWith('movie/')) {
    const id = parseInt(hash.split('/')[1], 10);
    renderMovieDetail(id);
  } else {
    renderHome();
  }
}

function showLoading() {
  if (app) {
    app.innerHTML = `
      <div class="loading-screen">
        <div class="loading-logo">CineQueue</div>
        <div class="loading-spinner"></div>
      </div>`;
  }
}

function hideLoading() {
  const loading = document.querySelector('.loading-screen');
  if (loading) loading.remove();
}

function renderHome() {
  const genres = [...new Set(allMovies.map(m => m.genre))].sort((a, b) => {
    if (a === 'Popular Movies') return -1;
    if (b === 'Popular Movies') return 1;
    return a.localeCompare(b);
  });

  app.innerHTML = `
    ${buildHeader()}
    <main>
      <section class="hero-section" id="hero-section"></section>
      <section class="browse-section" id="browse-section">
        ${genres.map(genre => buildGenreRow(genre)).join('')}
      </section>
    </main>`;

  startHero(featuredMovies.length ? featuredMovies : allMovies);
  wireCards();
  wireSearch(allMovies, wireCards);
}

function buildGenreRow(genre) {
  const movies = allMovies.filter(m => m.genre === genre);
  return `
    <div class="genre-row">
      <h2 class="genre-title">${genre}</h2>
      <div class="cards-scroll">
        ${movies.map(buildCard).join('')}
      </div>
    </div>`;
}

function buildCard(movie) {
  return `
    <div class="movie-card" data-id="${movie.id}" tabindex="0" role="button" aria-label="${movie.title}">
      <img src="${movie.posterUrl}" alt="${movie.title}" loading="lazy">
      <div class="card-overlay">
        <div class="card-title">${movie.title}</div>
        <div class="card-meta">
          <span class="rating-badge">${movie.rating}</span>
          <span>${movie.year}</span>
          <span>${movie.durationMinutes} min</span>
        </div>
      </div>
    </div>`;
}

window.openMovie = function(id) {
  window.location.hash = 'movie/' + id;
};

window.toggleDownloadList = function() {
  const list = document.getElementById('season-download-list');
  const icon = document.getElementById('download-toggle-icon');
  if (list) {
    const isHidden = list.style.display === 'none' || !list.style.display;
    list.style.display = isHidden ? 'block' : 'none';
    if (icon) icon.innerText = isHidden ? '▲' : '▼';
  }
};

window.unlockAdultPosters = function() {
  localStorage.setItem('ageUnlocked', 'true');
  document.querySelectorAll('.movie-card.adult-content').forEach(card => {
    card.classList.remove('adult-content');
  });
  const banner = document.querySelector('.age-unlock-banner');
  if (banner) banner.remove();
};

async function renderMovieDetail(id) {
  const movie = allMovies.find(m => m.id === id);
  if (!movie) {
    app.innerHTML = `
      ${buildHeader()}
      <div class="not-found">
        <h2>Movie not found</h2>
        <button class="btn-primary" onclick="history.back()">&#8592; Go Back</button>
      </div>`;
    wireSearch(allMovies, wireCards);
    return;
  }

  const isTv = movie.mediaType === 'tv' || movie.genre === 'TV Series' || !!movie.first_air_date;
  const related = allMovies.filter(m => m.genre === movie.genre && m.id !== movie.id);

  if (!isTv) {
    getAutoDownloadLinks(movie);
  }

  let seasonsInfo = [{ season_number: 1, episode_count: 10 }];
  if (isTv) {
    if (movie.seasonsInfo) {
      seasonsInfo = movie.seasonsInfo;
    } else {
      seasonsInfo = await getTvSeasonsInfo(movie.id);
      movie.seasonsInfo = seasonsInfo;
    }
  }
  const firstSeasonNumber = seasonsInfo[0].season_number;
  const firstSeasonEpisodeCount = seasonsInfo[0].episode_count;

  app.innerHTML = `
    ${buildHeader()}
    <main class="detail-main">
      <div class="player-outer-wrapper" style="width: 100%; max-width: 900px; margin: 0 auto 20px auto; padding: 0 10px; box-sizing: border-box;">
        <div id="backdrop-player-box" style="position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.8); border: 1px solid #232d45;">
          <img id="detail-poster-img" src="${movie.posterUrl}" alt="${movie.title}" style="width: 100%; height: 100%; object-fit: cover; filter: blur(4px) brightness(0.6); transform: scale(1.05);" />
          <button id="hero-play-btn" 
            onclick="${isTv ? `window.selectTvEpisode(${movie.id}, ${firstSeasonNumber}, 1)` : ''}" 
            style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); cursor: pointer; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; padding: 15px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#FFFFFF" style="margin-left: 4px;"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      </div>

      <div class="detail-content">
        <button class="back-btn" onclick="history.back()">&#8592; Back</button>
        
        ${isTv ? `
        <div class="tv-episodes-wrapper" style="max-width: 900px; margin: 50px auto 25px auto; padding: 15px; background: #161d2f; border: 1px solid #232d45; border-radius: 12px; position: relative; z-index: 10;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 1.1rem; color: #fff; display: flex; align-items: center; gap: 8px;">
              📺 Select Season & Episode
            </h3>
            <select id="season-picker" onchange="window.selectTvSeason(${movie.id}, this.value)" style="background: #232d45; color: #fff; border: 1px solid #324163; border-radius: 6px; padding: 6px 12px;">
              ${seasonsInfo.map(s => `<option value="${s.season_number}">Season ${s.season_number}</option>`).join('')}
            </select>
          </div>

          <div id="episodes-btn-grid" style="display: flex; gap: 8px; flex-wrap: wrap; overflow-x: auto;">
            ${Array.from({ length: firstSeasonEpisodeCount }, (_, i) => i + 1).map(ep => `
              <button class="ep-btn ${ep === 1 ? 'active' : ''}" onclick="window.selectTvEpisode(${movie.id}, ${firstSeasonNumber}, ${ep}, this)" style="background: ${ep === 1 ? '#e50914' : '#232d45'}; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Ep ${ep}
              </button>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div class="detail-layout">
          <div class="detail-poster-wrap">
            <img class="detail-poster" src="${movie.posterUrl}" alt="${movie.title}">
          </div>

          <div class="detail-info">
            <span class="detail-genre-tag">${movie.genre}</span>
            <h1 class="detail-title">${movie.title}</h1>
            <div class="detail-meta">
              <span class="rating-badge large">${movie.rating}</span>
              <span>${movie.year}</span>
              <span>${movie.durationMinutes} min</span>
            </div>
            <p class="detail-synopsis">${movie.synopsis}</p>

            <div class="detail-credits">
              <div class="credit-row">
                <span class="credit-label">Director</span>
                <span class="credit-value">${movie.director}</span>
              </div>
              <div class="credit-row">
                <span class="credit-label">Cast</span>
                <span class="credit-value">${movie.cast ? movie.cast.join(', ') : ''}</span>
              </div>
            </div>
          </div>
        </div>

${isTv ? `
<div class="download-section" style="background: #161d2f; border: 1px solid #232d45; border-radius: 12px; padding: 16px 20px; margin-top: 30px;">
  <div style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="window.toggleDownloadList()">
    <h3 style="display: flex; align-items: center; gap: 8px; margin:0; font-size:1rem; color:#fff;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download Seasons
    </h3>
    <span id="download-toggle-icon" style="color:#fff; font-size:1.2rem;">▼</span>
  </div>
  ${buildSeasonDownloadList(seasonsInfo, movie.id)}

  <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #2e3856;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
      <span style="color: #9ca3af; font-size: 0.9rem; font-weight: 500;">MoviesMod Links:</span>
      
      <select id="moviesmod-season-select" 
              style="background: #232d45; color: #fff; border: 1px solid #324163; border-radius: 6px; padding: 6px 12px; font-size: 0.85rem; min-width: 120px;">
        ${seasonsInfo.map(s => 
          `<option value="${s.season_number}">Season ${s.season_number}</option>`
        ).join('')}
      </select>
    </div>

    <button onclick="
        const seasonSelect = document.getElementById('moviesmod-season-select');
        const selectedSeason = seasonSelect ? seasonSelect.value : 1;
        const searchTitle = '${movie.title.replace(/'/g, "\\'")} Season ' + selectedSeason;
        showDownloadPage(searchTitle, true, selectedSeason);
      " 
      style="width: 100%; background: #2a9d8f; color: #fff; border: none; padding: 11px 14px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.9rem;">
      📩 FIND LINKS (Selected Season)
    </button>

    <div id="moviesmod-container" style="margin-top: 12px;"></div>
  </div>

  <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #2e3856;">
    <div style="display: flex; gap: 10px; margin-bottom: 12px;">
      <select id="new-season-select" style="flex: 1; background: #232d45; color: #fff; border: 1px solid #324163; border-radius: 8px; padding: 8px;">
        ${seasonsInfo.map(s => `<option value="${s.season_number}">Season ${s.season_number}</option>`).join('')}
      </select>
      <select id="new-episode-select" style="flex: 1; background: #232d45; color: #fff; border: 1px solid #324163; border-radius: 8px; padding: 8px;">
        ${Array.from({length: 24}, (_, i) => `<option value="${i + 1}">Episode ${i + 1}</option>`).join('')}
      </select>
    </div>

    <button id="new-server-btn" onclick="handleNewServerDownload('${movie.id}')" style="width: 100%; background: #2a9d8f; color: #fff; border: none; padding: 11px 14px; border-radius: 8px; cursor: pointer; font-weight: bold;">
      📩 FIND LINKS (Server 2)
    </button>

    <div id="new-server-results" style="margin-top: 12px;"></div>
  </div>
</div>
` : `
        <div class="download-section" style="background: #161d2f; border: 1px solid #232d45; border-radius: 12px; padding: 16px 20px; margin-top: 30px;">
          <div style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="window.toggleDownloadList()">
            <h3 style="display: flex; align-items: center; gap: 8px; margin:0; font-size:1rem; color:#fff;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Video
            </h3>
            <span id="download-toggle-icon" style="color:#fff; font-size:1.2rem;">▼</span>
          </div>

          <div id="download-content" style="margin-top: 16px;">
            <!-- دکمه اول: MoviesMod -->
            <button onclick="showDownloadPage('${movie.title.replace(/'/g, "\\'")}')" 
                    style="width: 100%; background: #2a9d8f; color: #fff; border: none; padding: 11px 14px; border-radius: 8px; cursor: pointer; margin-bottom: 10px; font-weight: bold;">
              📩 FIND LINKS (MoviesMod)
            </button>
            <div id="moviesmod-container" style="margin-top: 8px; margin-bottom: 16px;"></div>

            <!-- دکمه دوم: Server 2 -->
            <button id="new-server-btn" onclick="handleMovieServer2Download('${movie.id}')" 
                    style="width: 100%; background: #2a9d8f; color: #fff; border: none; padding: 11px 14px; border-radius: 8px; cursor: pointer; font-weight: bold;">
              📩 FIND LINKS (Server 2)
            </button>
            <div id="new-server-results" style="margin-top: 12px;"></div>
          </div>
        </div>
        `}

        ${related.length > 0 ? `
        <div class="more-section" style="margin-top: 30px;">
          <h2 class="genre-title">More ${movie.genre}</h2>
          <div class="cards-scroll">
            ${related.map(buildCard).join('')}
          </div>
        </div>` : ''}

      </div>
    </main>
  `;

  wireCards();
  wireSearch(allMovies, wireCards);
}

function buildHeader() {
  return `
    <header class="site-header">
      <a href="#" class="logo">CineQueue</a>
      <nav class="nav-links">
        <a href="#">Browse</a>
      </nav>
      <div class="search-wrap">
        <input type="search" id="search-input" class="search-input" placeholder="Search movies..." />
      </div>
    </header>`;
}

function wireCards() {
  document.querySelectorAll('.movie-card').forEach(card => {
    card.onclick = function (e) {
      if (this.classList.contains('adult-content')) {
        e.preventDefault();
        e.stopPropagation();
        alert('Please unlock (+18) posters first by confirming your age.');
        return;
      }

      const id = this.getAttribute('data-id');
      if (id) {
        window.openMovie(id);
      }
    };
  });
}

init();

document.addEventListener("click", function (e) {
  const playBtn = e.target.closest("#hero-play-btn");
  const closeBtn = e.target.closest("#hero-close-btn");

  const getMovieId = () => {
    const hashParts = window.location.hash.split("/");
    return hashParts.length > 1 && hashParts[1] ? hashParts[1] : (window.currentMovieId || "");
  };

  if (playBtn) {
    const rawId = getMovieId();
    const moviesList = typeof allMovies !== "undefined" ? allMovies : [];
    const movie = moviesList.find(m => m.id == rawId || m.tmdbId == rawId || m.imdbId == rawId);

    if (!rawId && !movie) {
      alert("Error: Item ID not found.");
      return;
    }

    const isTv = (movie && movie.mediaType === 'tv');
    if (isTv) return;

    const box = document.getElementById("backdrop-player-box");
    if (box) {
      box.style.position = "relative";
      box.style.zIndex = "50";

      let playerSrc = "";
      if (movie?.imdbId) {
        playerSrc = `https://multiembed.mov/?video_id=${movie.imdbId}`;
      } else if (movie?.tmdbId) {
        playerSrc = `https://multiembed.mov/?video_id=${movie.tmdbId}&tmdb=1`;
      } else {
        const isImdb = String(rawId).startsWith("tt");
        playerSrc = isImdb
          ? `https://multiembed.mov/?video_id=${rawId}`
          : `https://multiembed.mov/?video_id=${rawId}&tmdb=1`;
      }

      box.innerHTML = `
        <button id="hero-close-btn" style="position: absolute; top: 12px; left: 12px; z-index: 1000; color: #fff; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.8rem; backdrop-filter: blur(8px); opacity: 0.85;">✕ Close Player</button>
        <iframe
          src="${playerSrc}"
          style="width: 100%; height: 100%; border: none; display: block;"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope"
          allowfullscreen
          webkitallowfullscreen
          mozallowfullscreen
          playsinline
          frameborder="0">
        </iframe>
      `;

      const iframe = box.querySelector("iframe");
      const fullscreenBtn = document.createElement("button");
      fullscreenBtn.id = "hero-fullscreen-btn";
      fullscreenBtn.innerHTML = "⛶";
      fullscreenBtn.title = "Fullscreen";
      fullscreenBtn.style.cssText = `
        position: absolute !important; bottom: 6px !important; right: 8px !important; z-index: 9999 !important;
        width: 32px !important; height: 32px !important; color: #fff !important;
        background: rgba(0, 0, 0, 0.6) !important; border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 6px !important; cursor: pointer !important; font-size: 16px !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
      `;

      box.appendChild(fullscreenBtn);
      fullscreenBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        if (iframe.requestFullscreen) {
          iframe.requestFullscreen().catch(() => {
            if (box.requestFullscreen) box.requestFullscreen();
          });
        } else if (box.requestFullscreen) {
          box.requestFullscreen();
        }
      });
    }
  }

  if (closeBtn) {
    const rawId = getMovieId();
    const moviesList = typeof allMovies !== "undefined" ? allMovies : [];
    const movie = moviesList.find(m => m.id == rawId || m.tmdbId == rawId || m.imdbId == rawId);
    const box = document.getElementById("backdrop-player-box");

    if (box) {
      box.style.zIndex = "auto";
      const poster = movie?.posterUrl || "";
      const title = movie?.title || "";

      box.innerHTML = `
        <img id="detail-poster-img" src="${poster}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;">
        <button id="hero-play-btn" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 64px; height: 64px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#FFFFFF" style="margin-left: 4px;"><path d="M8 5v14l11-7z"/></svg>
        </button>
      `;
    }
  }
});

const observer = new MutationObserver(() => {
  if (window.location.hash.includes("movie/")) {
    const targetArea = document.querySelector("[class*='backdrop'], [class*='hero'], [style*='background']") || document.querySelector("main");
    if (targetArea && !document.getElementById("hero-play-btn") && !targetArea.querySelector("iframe")) {
      const currentPos = window.getComputedStyle(targetArea).position;
      if (currentPos === "static") targetArea.style.position = "relative";

      const btn = document.createElement("button");
      btn.id = "hero-play-btn";
      btn.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="#FFFFFF" style="margin-left:4px;"><path d="M8 5v14l11-7z"/></svg>`;
      btn.style.cssText = "position:absolute; top:42%; left:50%; transform:translate(-50%,-50%); background:rgba(229,9,20,0.9); border:none; border-radius:50%; width:75px; height:75px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:99; box-shadow:0 8px 25px rgba(0,0,0,0.6); transition:transform 0.2s;";

      btn.onmouseover = () => btn.style.transform = "translate(-50%,-50%) scale(1.1)";
      btn.onmouseout = () => btn.style.transform = "translate(-50%,-50%) scale(1)";

      targetArea.appendChild(btn);
    }
  }
}); 

observer.observe(document.body, { childList: true, subtree: true });

window.changeServer = function(serverUrl, btnElement) {
  const player = document.getElementById('main-player');
  if (player) {
    player.src = serverUrl;
  }

  document.querySelectorAll('.srv-btn').forEach(btn => btn.classList.remove('active'));
  if (btnElement) {
    btnElement.classList.add('active');
  }
};
