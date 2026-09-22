// ============================================================
// CineQueue — app.js
// ============================================================
import { API_KEY, BASE_URL, IMAGE_URL, YTS_API_URL } from './js/config.js';
import { handleYTSDownload, getAutoDownloadLinks } from './js/yts.js';
import { showDownloadPage } from './js/moviesmod.js';
import { getTvSeasonsInfo, buildSeasonDownloadList, selectTvSeason, selectTvEpisode } from './js/tv.js';
import { startHero, stopHeroTimer, paintHero } from './js/hero.js';
import { wireSearch } from './js/search.js';
import { renderMovieDetail } from './js/details.js';
import { handleNewServerDownload, handleMovieServer2Download } from './js/decryptor.js';
import { buildHeader } from './js/utils.js';
import { wireCards } from './js/cards.js';
import { setCatalog } from './js/catalog.js';
import { renderSports } from './js/sports.js';
import { renderTvShows } from './js/tv-shows.js';


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
    // ۱. فیلم‌های محبوب
const popularMoviesUrl = `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=1&region=US&append_to_response=credits`;
    
    // ۲. سریال‌های محبوب
const popularTvUrl = `${BASE_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=1&append_to_response=credits`;

    // ۳. ژانرهای میکس (فیلم بیشتر + سریال کمتر)
    const mixedGenres = [
      { key: 'Action', movieGenre: 28, tvGenre: 10759 },
      { key: 'Animation', movieGenre: 16, tvGenre: null }, // فقط فیلم (کارتون)، بدون انیمه/سریال
      { key: 'Crime', movieGenre: 80, tvGenre: 80 },
      { key: 'Horror', movieGenre: 27, tvGenre: null },
      { key: 'Romance', movieGenre: 10749, tvGenre: 10749 }
    ];

    // درخواست‌ها
    const [popularMoviesRes, popularTvRes, ...mixedResponses] = await Promise.all([
      fetch(popularMoviesUrl).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(popularTvUrl).then(r => r.json()).catch(() => ({ results: [] })),
      ...mixedGenres.flatMap(g => {
        const requests = [
fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${g.movieGenre}&sort_by=popularity.desc&vote_count.gte=500&vote_average.gte=6.8&with_original_language=en&append_to_response=credits`)
            .then(r => r.json()).catch(() => ({ results: [] }))
        ];
        if (g.tvGenre) {
          requests.push(
fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=${g.tvGenre}&sort_by=popularity.desc&vote_count.gte=300&with_original_language=en&append_to_response=credits`)
              .then(r => r.json()).catch(() => ({ results: [] }))
          );
        }
        return requests;
      })
    ]);

    const addedIds = new Set();
    allMovies = [];

    const buildItem = (item, assignedGenre, isTv = false) => {
      const embedBase = isTv
        ? `https://vidsrc.to/embed/tv/${item.id}`
        : `https://vidsrc.to/embed/movie/${item.id}`;

      return {
        id: item.id,
        title: item.title || item.name,
        posterUrl: item.poster_path ? `${IMAGE_URL}${item.poster_path}` : '',
        backdrop_path: item.backdrop_path || null,
        synopsis: item.overview || 'No synopsis available.',
        year: parseInt((item.release_date || item.first_air_date || '2026').toString().split('-')[0]),
        rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 7.0,
        durationMinutes: isTv ? (40 + (item.id % 20)) : (90 + (item.id % 40)),
        genre: assignedGenre,
director: item.credits?.crew?.find(c => c.job === 'Director')?.name || 'TMDB Cinema',
cast: item.credits?.cast ? item.credits.cast.slice(0, 10).map(a => ({
  name: a.name,
  character: a.character || '',
  profileUrl: a.profile_path ? `${IMAGE_URL}${a.profile_path}` : null
})) : [],
        mediaType: isTv ? 'tv' : 'movie',
        downloadUrl1080p: embedBase,
        downloadUrl720p: embedBase
      };
    };

    // --- ردیف ۱: Popular Movies ---
    let count = 0;
    for (const item of (popularMoviesRes.results || [])) {
      if (count >= 12) break;
      if (!item.poster_path || addedIds.has(`movie_${item.id}`)) continue;
      allMovies.push(buildItem(item, 'Popular Movies', false));
      addedIds.add(`movie_${item.id}`);
      count++;
    }

    // --- ردیف ۲: Popular Series ---
    count = 0;
    for (const item of (popularTvRes.results || [])) {
      if (count >= 12) break;
      if (!item.poster_path || addedIds.has(`tv_${item.id}`)) continue;
      allMovies.push(buildItem(item, 'Popular Series', true));
      addedIds.add(`tv_${item.id}`);
      count++;
    }

    // --- ژانرهای میکس (۸ فیلم + ۴ سریال) ---
    let responseIndex = 0;
    for (const g of mixedGenres) {
      const movieRes = mixedResponses[responseIndex++] || { results: [] };
      const tvRes = g.tvGenre ? (mixedResponses[responseIndex++] || { results: [] }) : { results: [] };

      // اول فیلم‌ها
      count = 0;
      for (const item of (movieRes.results || [])) {
        if (count >= 8) break;
        if (!item.poster_path || addedIds.has(`movie_${item.id}`)) continue;
        allMovies.push(buildItem(item, g.key, false));
        addedIds.add(`movie_${item.id}`);
        count++;
      }

      // بعد سریال‌ها (اگر داشته باشه)
      if (g.tvGenre) {
        count = 0;
        for (const item of (tvRes.results || [])) {
          if (count >= 4) break;
          if (!item.poster_path || addedIds.has(`tv_${item.id}`)) continue;
          allMovies.push(buildItem(item, g.key, true));
          addedIds.add(`tv_${item.id}`);
          count++;
        }
      }
    }

    featuredMovies = allMovies.slice(0, 5);
    setCatalog(allMovies);
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

  if (hash === 'sports') {
    renderSports();
  } else if (hash === 'tv' || hash === 'tv-shows') {
    renderTvShows();
  } else if (hash.startsWith('movie/')) {
    const parts = hash.split('/');
    const mediaType = parts.length > 2 ? parts[1] : null;
    const id = parseInt(parts.length > 2 ? parts[2] : parts[1], 10);
    renderMovieDetail(id, allMovies, mediaType);
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
  const movies = allMovies.filter(movie => movie.mediaType === 'movie');
  const genres = [...new Set(movies.map(m => m.genre))].sort((a, b) => {
    if (a === 'Popular Movies') return -1;
    if (b === 'Popular Movies') return 1;
    if (a === 'Popular Series') return -1;
    if (b === 'Popular Series') return 1;
    return a.localeCompare(b);
  });

  app.innerHTML = `
    ${buildHeader()}
    <main>
      <section class="hero-section" id="hero-section"></section>
      <section class="browse-section" id="browse-section">
        ${genres.map(genre => buildGenreRow(genre, movies)).join('')}
      </section>
    </main>

    ${buildFooter()}`;


  const featured = featuredMovies.filter(movie => movie.mediaType === 'movie');
  startHero(featured.length ? featured : movies);
  wireCards();
  wireSearch(movies, wireCards);
}


function buildGenreRow(genre, movies) {
  const genreMovies = movies.filter(m => m.genre === genre);
  return `
    <div class="genre-row">
      <h2 class="genre-title">${genre}</h2>
      <div class="cards-scroll">
        ${genreMovies.map(buildCard).join('')}
      </div>
    </div>`;
}

function buildCard(movie) {
  return `
    <div class="movie-card" data-id="${movie.id}" data-media-type="${movie.mediaType || 'movie'}" tabindex="0" role="button" aria-label="${movie.title}">
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

window.openMovie = function(id, mediaType = 'movie') {
  window.location.hash = `movie/${mediaType}/${id}`;
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


function buildFooter() {
  return `
    <footer class="site-footer">
      <div class="footer-container">

        <div class="footer-brand">
          <h2 class="footer-logo">Cine<span>Queue</span></h2>
          <p class="footer-tagline">
            Fast movie streaming & direct download system.<br>
            Powered by TMDB metadata.
          </p>
        </div>

        <div class="footer-column">
          <h4>Explore</h4>
          <ul>
            <li><a href="#hero-section">Trending Movies</a></li>
            <li><a href="#browse-section">Browse Genres</a></li>
            <li><a href="#" onclick="document.querySelector('.search-input')?.focus(); return false;">Search Movies</a></li>
          </ul>
        </div>

        <div class="footer-column">
          <h4>System Status</h4>
          <ul class="status-list">
            <li><span class="status-dot online"></span> TMDB Database: Connected</li>
            <li><span class="status-dot online"></span> Player & Downloads: Active</li>
            <li><span class="status-dot info"></span> Platform: Web SPA</li>
          </ul>
        </div>

        <div class="footer-column">
          <h4>Quick Action</h4>
          <button class="back-to-top" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
            ↑ Back to Top
          </button>
        </div>

      </div>

      <div class="footer-bottom">
        <p>© 2026 CineQueue. All rights reserved. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </div>
    </footer>`;
}

