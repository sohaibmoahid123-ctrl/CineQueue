// ============================================================
// CineQueue — app.js
// ============================================================
import { API_KEY, BASE_URL, IMAGE_URL, YTS_API_URL } from './js/config.js';
import { handleNewServerDownload } from './js/decryptor.js';
import { handleYTSDownload, getAutoDownloadLinks } from './js/yts.js';
import { showDownloadPage } from './js/moviesmod.js';
import { getTvSeasonsInfo, buildSeasonDownloadList, selectTvSeason, selectTvEpisode } from './js/tv.js';
import { startHero, stopHeroTimer, paintHero, setHeroMovies } from './js/hero.js';


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
        if (!m.adult) rawItems.push({ ...m, media_type: 'movie' });
      });
    });

    tvDataList.forEach(p => {
      p.results?.forEach(tv => {
        rawItems.push({
          ...tv,
          title: tv.name || tv.original_name,
          release_date: tv.first_air_date || '2025',
          media_type: 'tv'
        });
      });
    });

    rawItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    const buildItem = (item, assignedGenre) => {
      const isTv = item.media_type === 'tv';
      const embedBase = isTv
        ? `https://vidsrc.to/embed/tv/${item.id}`
        : `https://vidsrc.to/embed/movie/${item.id}`;

      return {
        id: item.id,
        title: item.title,
        posterUrl: item.poster_path ? `${IMAGE_URL}${item.poster_path}` : '',
        synopsis: item.overview || 'No synopsis available.',
        year: parseInt((item.release_date || '2025').split('-')[0]),
        rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 7.0,
        durationMinutes: 120,
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

    allMovies = [];

    for (const item of rawItems) {
      if (genreCounts['Popular Movies'] < 15) {
        allMovies.push(buildItem(item, 'Popular Movies'));
        genreCounts['Popular Movies']++;
        continue;
      }

      if (item.genre_ids?.includes(16) && genreCounts['Animation'] < 15) {
        allMovies.push(buildItem(item, 'Animation'));
        genreCounts['Animation']++;
        continue;
      }

      if (item.genre_ids) {
        const matchedName = item.genre_ids
          .map(id => genreMap[id])
          .find(name => allowedGenres.includes(name));

        if (matchedName) {
          let finalGenre = matchedName;
          if (matchedName === 'Action & Adventure' || matchedName === 'Sci-Fi & Fantasy') finalGenre = 'Action';

          if (genreCounts[finalGenre] < 15) {
            allMovies.push(buildItem(item, finalGenre));
            genreCounts[finalGenre]++;
          }
        }
      }
    }

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

  startHero();
  wireCards();
  wireSearch();
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

function wireSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;

  let searchTimeout = null;
  let searchDropdown = document.getElementById('search-dropdown');

  if (!searchDropdown) {
    searchDropdown = document.createElement('div');
    searchDropdown.id = 'search-dropdown';
    searchDropdown.style.cssText = `
      position: fixed;
      background: #111625;
      border: 1px solid #232d45;
      border-radius: 12px;
      max-height: 350px;
      overflow-y: auto;
      z-index: 999999;
      box-shadow: 0 10px 30px rgba(0,0,0,0.9);
      display: none;
      padding: 8px;
      box-sizing: border-box;
    `;
    document.body.appendChild(searchDropdown);
  }

  function updateDropdownPosition() {
    const rect = input.getBoundingClientRect();
    searchDropdown.style.top = (rect.bottom + 6) + 'px';
    searchDropdown.style.left = rect.left + 'px';
    searchDropdown.style.width = rect.width + 'px';
  }

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.style.display = 'none';
    }
  });

  window.addEventListener('scroll', () => {
    if (searchDropdown.style.display === 'block') updateDropdownPosition();
  });
  window.addEventListener('resize', () => {
    if (searchDropdown.style.display === 'block') updateDropdownPosition();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const q = this.value.trim();
      if (q.length >= 2) {
        searchDropdown.style.display = 'none';
        executeFullSearch(q);
      }
    }
  });

  input.addEventListener('input', function () {
    const q = this.value.trim();

    if (q.length < 2) {
      searchDropdown.style.display = 'none';
      searchDropdown.innerHTML = '';
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        const [movieRes, tvRes] = await Promise.all([
          fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(q)}`).then(r => r.json()),
          fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(q)}`).then(r => r.json())
        ]);

        const movieResults = (movieRes.results || []).map(movie => ({
          id: movie.id,
          title: movie.title,
          posterUrl: movie.poster_path ? `${IMAGE_URL}${movie.poster_path}` : '',
          synopsis: movie.overview || 'No synopsis available.',
          year: parseInt(movie.release_date ? movie.release_date.split('-')[0] : '2026'),
          rating: movie.vote_average ? parseFloat(movie.vote_average.toFixed(1)) : 7.0,
          durationMinutes: 120,
          genre: 'Search Result',
          director: 'TMDB Cinema',
          cast: ['Popular Actor'],
          mediaType: 'movie',
          popularity: movie.popularity || 0
        }));

        const tvResults = (tvRes.results || []).map(tv => ({
          id: tv.id,
          title: tv.name || tv.original_name,
          posterUrl: tv.poster_path ? `${IMAGE_URL}${tv.poster_path}` : '',
          synopsis: tv.overview || 'No synopsis available.',
          year: parseInt(tv.first_air_date ? tv.first_air_date.split('-')[0] : '2026'),
          rating: tv.vote_average ? parseFloat(tv.vote_average.toFixed(1)) : 7.0,
          durationMinutes: 120,
          genre: 'Search Result',
          director: 'TMDB Cinema',
          cast: ['Popular Actor'],
          mediaType: 'tv',
          popularity: tv.popularity || 0
        }));

        const searchResults = [...movieResults, ...tvResults]
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 10);

        searchResults.forEach(m => {
          if (!allMovies.some(existing => existing.id === m.id)) {
            allMovies.push(m);
          }
        });

        if (searchResults.length > 0) {
          searchDropdown.innerHTML = searchResults.map(buildSearchDropdownItem).join('');
          updateDropdownPosition();
          searchDropdown.style.display = 'block';

          searchDropdown.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              const id = parseInt(this.getAttribute('data-id'), 10);
              if (id) {
                searchDropdown.style.display = 'none';
                input.value = '';
                window.openMovie(id);
              }
            });
          });
        } else {
          searchDropdown.innerHTML = `<div style="padding:12px; color:#aaa; text-align:center;">No results</div>`;
          updateDropdownPosition();
          searchDropdown.style.display = 'block';
        }
      } catch (err) {
        console.error('Dropdown search error:', err);
      }
    }, 300);
  });
}

function buildSearchDropdownItem(m) {
  return `
    <div class="search-item" data-id="${m.id}" style="display:flex; align-items:center; gap:12px; padding:8px; border-bottom:1px solid #1a233a; cursor:pointer; border-radius:8px; transition:background 0.2s;" onmouseover="this.style.background='#1c263e'" onmouseout="this.style.background='transparent'">
      <img src="${m.posterUrl}" alt="${m.title}" style="width:40px; height:56px; object-fit:cover; border-radius:6px;" />
      <div style="flex:1;">
        <div style="color:#fff; font-weight:bold; font-size:0.95rem;">${m.title}</div>
        <div style="color:#888; font-size:0.8rem; margin-top:3px;">★ ${m.rating} | ${m.year}</div>
      </div>
    </div>
  `;
}

async function executeFullSearch(q) {
  const browse = document.getElementById('browse-section');
  if (!browse) return;

  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(q)}`).then(r => r.json()),
      fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(q)}`).then(r => r.json())
    ]);

    const movieResults = (movieRes.results || []).map(movie => ({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.poster_path ? `${IMAGE_URL}${movie.poster_path}` : '',
      synopsis: movie.overview || 'No synopsis available.',
      year: parseInt(movie.release_date ? movie.release_date.split('-')[0] : '2026'),
      rating: movie.vote_average ? parseFloat(movie.vote_average.toFixed(1)) : 7.0,
      durationMinutes: 120,
      genre: 'Search Result',
      isAdult: movie.adult || false,
      director: 'TMDB Cinema',
      cast: ['Popular Actor'],
      mediaType: 'movie',
      popularity: movie.popularity || 0,
      downloadUrl1080p: `https://vidsrc.to/embed/movie/${movie.id}`,
      downloadUrl720p: `https://vidsrc.to/embed/movie/${movie.id}`
    }));

    const tvResults = (tvRes.results || []).map(tv => ({
      id: tv.id,
      title: tv.name || tv.original_name,
      posterUrl: tv.poster_path ? `${IMAGE_URL}${tv.poster_path}` : '',
      synopsis: tv.overview || 'No synopsis available.',
      year: parseInt(tv.first_air_date ? tv.first_air_date.split('-')[0] : '2026'),
      rating: tv.vote_average ? parseFloat(tv.vote_average.toFixed(1)) : 7.0,
      durationMinutes: 120,
      genre: 'Search Result',
      isAdult: tv.adult || false,
      director: 'TMDB Cinema',
      cast: ['Popular Actor'],
      mediaType: 'tv',
      popularity: tv.popularity || 0,
      downloadUrl1080p: `https://vidsrc.to/embed/tv/${tv.id}`,
      downloadUrl720p: `https://vidsrc.to/embed/tv/${tv.id}`
    }));

    const searchResults = [...movieResults, ...tvResults].sort((a, b) => b.popularity - a.popularity);

    searchResults.forEach(m => {
      if (!allMovies.some(existing => existing.id === m.id)) {
        allMovies.push(m);
      }
    });

    if (searchResults.length > 0) {
      const isAgeUnlocked = localStorage.getItem('ageUnlocked') === 'true';
      let html = '';
      if (!isAgeUnlocked) {
        html += `
          <div class="age-unlock-banner">
            <p>⚠️ Some search results may contain adult or sensitive content (+18).</p>
            <button class="btn-unlock-age" onclick="unlockAdultPosters()">Unlock (+18) Posters</button>
          </div>
        `;
      }

      html += `
        <div class="genre-row">
          <h2 class="genre-title">Results for "${q}" (${searchResults.length})</h2>
          <div class="cards-scroll">
            ${searchResults.map(m => buildSearchCard(m, isAgeUnlocked)).join('')}
          </div>
        </div>
      `;

      browse.innerHTML = html;
      wireCards();
    } else {
      browse.innerHTML = `<div class="no-results">No results for "<strong>${q}</strong>"</div>`;
    }
  } catch (err) {
    console.error('Full search error:', err);
  }
}

function buildSearchCard(m, isAgeUnlocked) {
  const sensitiveKeywords = ['sex', 'nude', 'erotic', 'desire', 'passion', 'kill', 'slasher', 'blood', 'gory', 'gore', 'massacre', 'murder'];
  const titleLower = (m.title || '').toLowerCase();
  const hasSensitiveTitle = sensitiveKeywords.some(keyword => titleLower.includes(keyword));
  const isSensitive = m.isAdult || hasSensitiveTitle;

  const adultClass = (isSensitive && !isAgeUnlocked) ? 'adult-content' : '';
  const adultBadge = isSensitive ? `<span class="adult-badge">+18</span>` : '';
  const typeBadge = m.mediaType === 'tv'
    ? `<span style="position:absolute; top:6px; left:6px; background:rgba(0,0,0,0.7); color:#fff; font-size:0.65rem; font-weight:bold; padding:2px 6px; border-radius:4px; z-index:2;">TV</span>`
    : '';

  return `
    <div class="movie-card ${adultClass}" data-id="${m.id}">
      <div class="card-poster">
        ${typeBadge}
        ${adultBadge}
        <img src="${m.posterUrl}" alt="${m.title}" loading="lazy" />
        <div class="card-overlay">
          <button class="btn-play">&#9654;</button>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${m.title}</div>
        <div class="card-meta">
          <span class="rating">★ ${m.rating}</span>
          <span class="year">${m.year}</span>
        </div>
      </div>
    </div>
  `;
}

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
    wireSearch();
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
  
  <!-- بخش Server 1 / Server 2 (بدون تغییر ظاهر) -->
  <div style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="toggleDownloadList()">
    <h3 style="display: flex; align-items: center; gap: 8px; margin:0; font-size:1rem; color:#fff;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download Seasons
    </h3>
    <span id="download-toggle-icon" style="color:#fff; font-size:1.2rem;">▼</span>
  </div>
  ${buildSeasonDownloadList(seasonsInfo, movie.id)}

  <!-- بخش MoviesMod با انتخاب فصل -->
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
      📥 FIND LINKS (Selected Season)
    </button>

    <div id="moviesmod-container" style="margin-top: 12px;"></div>
  </div>
<!-- Server 2 (New Decrypter) -->
<div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #2e3856;">
  <div style="display: flex; gap: 10px; margin-bottom: 12px;">
    <!-- Season Select -->
    <select id="new-season-select" style="flex: 1; background: #232d45; color: #fff; border: 1px solid #324163; border-radius: 8px; padding: 8px;">
      ${seasonsInfo.map(s => `<option value="${s.season_number}">Season ${s.season_number}</option>`).join('')}
    </select>
    
    <!-- Episode Select -->
    <select id="new-episode-select" style="flex: 1; background: #232d45; color: #fff; border: 1px solid #324163; border-radius: 8px; padding: 8px;">
      ${Array.from({length: 24}, (_, i) => `<option value="${i + 1}">Episode ${i + 1}</option>`).join('')}
    </select>
  </div>

  <!-- Download Button -->
  <button id="new-server-btn" onclick="handleNewServerDownload('${movie.id}')" style="width: 100%; background: #2a9d8f; color: #fff; border: none; padding: 11px 14px; border-radius: 8px; cursor: pointer; font-weight: bold;">
    📩 FIND LINKS (Server 2)
  </button>

  <!-- Links Output Container -->
  <div id="new-server-results" style="margin-top: 12px;"></div>
</div>

</div>

        ` : `
        <div class="download-section" style="background: #161d2f; border: 1px solid #232d45; border-radius: 12px; padding: 20px; margin-top: 30px;">
          <h3 class="download-heading" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color:#fff; font-size:1rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Video
          </h3>
          <div style="display: flex; gap: 12px; width: 100%;">
            <a href="${`https://video.moviepire.co/download/movie/${movie.tmdb_id || movie.id}`}" target="_blank" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #e50914; color: #fff; padding: 12px; border-radius: 8px; text-decoration: none;">
              <div style="font-size: 1rem; font-weight: 800;">SERVER 1 (MP4)</div>
              <div style="font-size: 0.75rem; opacity: 0.85; margin-top: 4px;">1080P, 720P</div>
            </a>
            <button onclick="showDownloadPage('${movie.title.replace(/'/g, "\\'")}')" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #2a9d8f; color: #fff; padding: 12px; border-radius: 8px; border: none; cursor: pointer; transition: background 0.2s;">
              <div style="font-size: 1rem; font-weight: 800;">📥 DOWNLOAD</div>
              <div style="font-size: 0.75rem; opacity: 0.85; margin-top: 4px;">FIND LINKS</div>
            </button>
          </div>
          <div id="moviesmod-container" style="margin-top: 15px;"></div>
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
  wireSearch();
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

