// ============================================================
// CineQueue — app.js
// ============================================================
const API_KEY = 'cab1be6caea88ea79b1101c13ddb5702';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p/w500';
const YTS_API_URL = 'https://movies-api.accel.li/api/v2';

const app = document.getElementById('app');
const adScript = document.createElement('script');
adScript.dataset.zone = '11510328';
adScript.src = 'https://al5sm.com/tag.min.js';
document.head.appendChild(adScript);

let allMovies      = [];
let featuredMovies = [];
let heroIndex      = 0;
let heroTimer      = null;

// ========== MOVIESMOD DOWNLOAD (NEW) ==========
function getMoviesModLink(title, isTv = false, season = null, episode = null) {
    // تبدیل عنوان به فرمت URL-friendly
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    
    if (isTv && season && episode) {
        // لینک سریال: moviesmod.page/silo-2026-season-3-episode-7
        return `https://www.moviesmod.page/${slug}-season-${season}-episode-${episode}`;
    } else {
        // لینک فیلم: moviesmod.page/?s=inception
        return `https://www.moviesmod.page/?s=${encodeURIComponent(title)}`;
    }
}

window.showDownloadPage = function(title, isTv = false, season = null, episode = null) {
    const url = getMoviesModLink(title, isTv, season, episode);
    
    // پیدا کردن یا ساختن کانتینر
    let container = document.getElementById('moviesmod-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'moviesmod-container';
        container.style.cssText = 'margin-top: 20px; border-radius: 12px; overflow: hidden; background: #000;';
        
        // اضافه کردن به بخش دانلود
        const downloadSection = document.querySelector('.download-section');
        if (downloadSection) {
            downloadSection.appendChild(container);
        } else {
            // اگر بخش دانلود وجود نداشت، به انتهای صفحه اضافه کن
            document.querySelector('.detail-content').appendChild(container);
        }
    }
    
    // نمایش iframe
    container.innerHTML = `
        <div style="position: relative; padding-top: 56.25%; background: #0a0e1a;">
            <iframe 
                src="${url}" 
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
                allowfullscreen>
            </iframe>
        </div>
        <div style="text-align: center; padding: 10px; background: #0f1629; color: #888; font-size: 0.85rem; border-top: 1px solid #232d45;">
            ⚠️ اگر صفحه نمایش داده نشد، 
            <a href="${url}" target="_blank" style="color: #e50914; text-decoration: none;">اینجا کلیک کنید</a>
        </div>
    `;
    
    // اسکرول به بخش دانلود
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
// ========== END MOVIESMOD ==========

// ========== YTS API FUNCTIONS ==========
async function getYTSMovie(title) {
  try {
    const res = await fetch(
      `${YTS_API_URL}/list_movies.json?query_term=${encodeURIComponent(title)}`
    );
    const data = await res.json();
    
    if (data.status === 'ok' && data.data && data.data.movies && data.data.movies.length > 0) {
      return data.data.movies[0];
    }
    return null;
  } catch (error) {
    console.error('YTS API Error:', error);
    return null;
  }
}

async function getYTSDownloadLinks(title) {
  try {
    const movie = await getYTSMovie(title);
    if (movie && movie.torrents) {
      return movie.torrents.map(t => ({
        quality: t.quality,
        size: t.size,
        url: t.url,
        hash: t.hash
      }));
    }
    return [];
  } catch (error) {
    console.error('YTS Download Error:', error);
    return [];
  }
}

window.handleYTSDownload = async function(movieId) {
  const movie = allMovies.find(m => m.id === movieId);
  if (!movie) {
    alert('Movie not found!');
    return;
  }

  const btn = document.getElementById('yts-download-btn');
  if (btn) {
    btn.innerHTML = '⏳ Searching...';
    btn.disabled = true;
    btn.style.opacity = '0.6';
  }

  try {
    const torrents = await getYTSDownloadLinks(movie.title);
    
    if (torrents && torrents.length > 0) {
      const best = torrents.find(t => t.quality === '1080p') || 
                   torrents.find(t => t.quality === '720p') || 
                   torrents[0];
      window.open(best.url, '_blank');
      alert(`✅ Download started! (${best.quality} - ${best.size})`);
    } else {
      alert('❌ No torrent found for this movie. Try Server 1.');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error fetching download link. Please try again.');
  } finally {
    if (btn) {
      btn.innerHTML = 'SERVER 2 (YTS)';
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
};
// ========== END YTS API ==========

// Download link fetcher (Moviepire - Server 1)
async function getAutoDownloadLinks(movie) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${YTS_API_URL}/list_movies.json?query_term=${encodeURIComponent(movie.title)}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();

    if (data.data && data.data.movies && data.data.movies.length > 0) {
      const torrents = data.data.movies[0].torrents;
      const t1080 = torrents.find(t => t.quality === '1080p');
      const t720  = torrents.find(t => t.quality === '720p');

      movie.downloadUrl1080p = t1080 ? t1080.url : torrents[0].url;
      movie.downloadUrl720p  = t720 ? t720.url : torrents[0].url;
    }
  } catch (err) {
    // Ignore timeout errors silently
  }
}

// Fetch the real season/episode structure for a TV show from TMDB
async function getTvSeasonsInfo(tvId) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}&language=en-US`);
    const data = await res.json();
    const seasons = (data.seasons || [])
      .filter(s => s.season_number > 0 && s.episode_count > 0)
      .map(s => ({ season_number: s.season_number, episode_count: s.episode_count }));
    return seasons.length > 0 ? seasons : [{ season_number: 1, episode_count: 10 }];
  } catch (err) {
    console.error('TV seasons fetch error:', err);
    return [{ season_number: 1, episode_count: 10 }];
  }
}

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

      if (movieGenresRes?.genres) {
        movieGenresRes.genres.forEach(g => { genreMap[g.id] = g.name; });
      }
      if (tvGenresRes?.genres) {
        tvGenresRes.genres.forEach(g => { genreMap[g.id] = g.name; });
      }
    } catch (e) {
      console.error("Genre fetch error:", e);
    }

    const moviePromises = pagesToFetch.map(page =>
      fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}&include_adult=false`)
        .then(res => res.json())
        .catch(() => ({ results: [] }))
    );

    const tvPromises = pagesToFetch.map(page =>
      fetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=${page}`)
        .then(res => res.json())
        .catch(() => ({ results: [] }))
    );

    const [moviesDataList, tvDataList] = await Promise.all([
      Promise.all(moviePromises),
      Promise.all(tvPromises)
    ]);

    let rawItems = [];

    moviesDataList.forEach(p => {
      if (p?.results) {
        p.results.forEach(m => {
          if (!m.adult) {
            rawItems.push({ ...m, media_type: 'movie' });
          }
        });
      }
    });

    tvDataList.forEach(p => {
      if (p?.results) {
        p.results.forEach(tv => {
          rawItems.push({
            ...tv,
            title: tv.name || tv.original_name,
            release_date: tv.first_air_date || '2025',
            media_type: 'tv'
          });
        });
      }
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
          if (matchedName === 'Action & Adventure') finalGenre = 'Action';
          if (matchedName === 'Sci-Fi & Fantasy') finalGenre = 'Action';

          if (genreCounts[finalGenre] < 15) {
            allMovies.push(buildItem(item, finalGenre));
            genreCounts[finalGenre]++;
          }
        }
      }
    }

    featuredMovies = allMovies.slice(0, 5);

    console.log('Loaded items:', allMovies.length, genreCounts);

    route();

  } catch (err) {
    console.error("Init Error:", err);
  } finally {
    hideLoading();
  }
}

window.addEventListener('hashchange', route);

// ── Router ────────────────────────────────────────────────────
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

// ── Loading Screen ────────────────────────────────────────────
function showLoading() {
  app.innerHTML = `
    <div class="loading-screen">
      <div class="loading-logo">CineQueue</div>
      <div class="loading-spinner"></div>
    </div>`;
}
function hideLoading() {
  const loading = document.querySelector('.loading-screen');
  if (loading) loading.remove();
}

// ── Home Page ─────────────────────────────────────────────────
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

// ── Hero Carousel ─────────────────────────────────────────────
function startHero() {
  heroIndex = 0;
  paintHero();
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % featuredMovies.length;
    paintHero();
  }, 7000);
}

function stopHeroTimer() {
  if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
}

function paintHero() {
  const section = document.getElementById('hero-section');
  if (!section) return;
  const m = featuredMovies[heroIndex];
  section.innerHTML = `
    <div class="hero-backdrop" style="background-image:url('${m.posterUrl}')">
      <div class="hero-gradient"></div>
      <div class="hero-content">
        <span class="hero-genre">${m.genre}</span>
        <h1 class="hero-title">${m.title}</h1>
        <div class="hero-meta">
          <span class="rating-badge">${m.rating}</span>
          <span>${m.year}</span>
          <span>${m.durationMinutes} min</span>
        </div>
        <p class="hero-synopsis">${m.synopsis}</p>
        <div class="hero-actions">
          <button class="btn-primary" onclick="openMovie(${m.id})">&#9654; Watch Now</button>
          <button class="btn-secondary" onclick="openMovie(${m.id})">&#8505; More Info</button>
        </div>
      </div>
      <div class="hero-dots">
        ${featuredMovies.map((_, i) =>
          `<span class="hero-dot ${i === heroIndex ? 'active' : ''}" onclick="jumpHero(${i})"></span>`
        ).join('')}
      </div>
    </div>`;
}

window.jumpHero = function(i) {
  stopHeroTimer();
  heroIndex = i;
  paintHero();
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % featuredMovies.length;
    paintHero();
  }, 7000);
};

window.openMovie = function(id) {
  window.location.hash = 'movie/' + id;
};

// ── Search Wiring ──────────────────────────────────────────────
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
        if (typeof executeFullSearch === 'function') {
          executeFullSearch(q);
        }
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

// ── Toggle Download List (for TV shows) ─────────────────────
window.toggleDownloadList = function() {
  const list = document.getElementById('episode-download-list');
  const icon = document.getElementById('download-toggle-icon');
  if (list) {
    if (list.style.display === 'none' || list.style.display === '') {
      list.style.display = 'block';
      if (icon) icon.innerHTML = '▲';
    } else {
      list.style.display = 'none';
      if (icon) icon.innerHTML = '▼';
    }
  }
};

// ── BUILD SEASON DOWNLOAD LIST (NOT EPISODES) ──────────────
function buildSeasonDownloadList(seasonsInfo, tvId) {
  let items = '';
  seasonsInfo.forEach(s => {
    const seasonNum = s.season_number;
    const srv1 = `https://video.moviepire.co/download/tv/${tvId}/${seasonNum}`;
    const srv2 = `https://video.moviepire.co/download/tv/${tvId}/${seasonNum}?download=true`;
    items += `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:#0f1629; border-radius:6px; margin-bottom:4px; border-left:3px solid #e50914;">
        <span style="color:#fff; font-weight:500; min-width:50px; font-size:0.85rem;">Season ${seasonNum}</span>
        <div style="display:flex; gap:6px;">
          <a href="${srv1}" target="_blank" style="background:#e50914; color:#fff; padding:3px 10px; border-radius:4px; text-decoration:none; font-size:0.75rem; font-weight:600;">Server 1</a>
          <a href="${srv2}" target="_blank" style="background:#232d45; color:#fff; padding:3px 10px; border-radius:4px; text-decoration:none; font-size:0.75rem; font-weight:600;">Server 2</a>
        </div>
      </div>
    `;
  });
  return `
    <div id="episode-download-list" style="display: none; margin-top:10px;">
      ${items}
    </div>
  `;
}

// ── Movie Detail Page ──────────────────────────────────────────
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

  // Get the REAL season/episode structure for this show from TMDB
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

        <!-- ======= DOWNLOAD SECTION ======= -->
        ${isTv ? `
        <div class="download-section" style="background: #161d2f; border: 1px solid #232d45; border-radius: 12px; padding: 16px 20px; margin-top: 30px;">
          <div style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="toggleDownloadList()">
            <h3 style="display: flex; align-items: center; gap: 8px; margin:0; font-size:1rem; color:#fff;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Seasons
            </h3>
            <span id="download-toggle-icon" style="color:#fff; font-size:1.2rem;">▼</span>
          </div>
          ${buildSeasonDownloadList(seasonsInfo, movie.id)}
        </div>
        ` : `
        <div class="download-section" style="background: #161d2f; border: 1px solid #232d45; border-radius: 12px; padding: 20px; margin-top: 30px;">
          <h3 class="download-heading" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color:#fff; font-size:1rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Video
          </h3>
          <div style="display: flex; gap: 12px; width: 100%;">
            <!-- Server 1: Moviepire -->
            <a href="${`https://video.moviepire.co/download/movie/${movie.tmdb_id || movie.id}`}" target="_blank" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #e50914; color: #fff; padding: 12px; border-radius: 8px; text-decoration: none;">
              <div style="font-size: 1rem; font-weight: 800;">SERVER 1 (MP4)</div>
              <div style="font-size: 0.75rem; opacity: 0.85; margin-top: 4px;">1080P, 720P</div>
            </a>
            <!-- Server 2: MoviesMod (NEW) -->
            <button onclick="showDownloadPage('${movie.title}')" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #2a9d8f; color: #fff; padding: 12px; border-radius: 8px; border: none; cursor: pointer; transition: background 0.2s;">
              <div style="font-size: 1rem; font-weight: 800;">📥 DOWNLOAD</div>
              <div style="font-size: 0.75rem; opacity: 0.85; margin-top: 4px;">FIND LINKS</div>
            </button>
          </div>
          <!-- کانتینر برای نمایش iframe -->
          <div id="moviesmod-container" style="margin-top: 15px;"></div>
        </div>
        `}
        <!-- ======= END DOWNLOAD SECTION ======= -->

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

// ── TV Episode Handler Functions ──────────────────────────────
window.selectTvSeason = function(tvId, season) {
  const grid = document.getElementById('episodes-btn-grid');
  if (!grid) return;

  const movie = allMovies.find(m => m.id == tvId);
  const seasonData = movie?.seasonsInfo?.find(s => s.season_number == season);
  const episodeCount = seasonData ? seasonData.episode_count : 10;

  // Update episode buttons
  grid.innerHTML = Array.from({ length: episodeCount }, (_, i) => i + 1).map(ep => `
    <button class="ep-btn ${ep === 1 ? 'active' : ''}" 
            onclick="window.selectTvEpisode(${tvId}, ${season}, ${ep}, this)" 
            style="background: ${ep === 1 ? '#e50914' : '#232d45'}; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; transition: background 0.2s;">
      Ep ${ep}
    </button>
  `).join('');

  // Update download list with correct links
  const downloadList = document.getElementById('episode-download-list');
  if (downloadList) {
    let items = '';
    for (let ep = 1; ep <= episodeCount; ep++) {
      const srv1 = `https://video.moviepire.co/download/tv/${tvId}/${season}/${ep}`;
      const srv2 = `https://video.moviepire.co/download/tv/${tvId}/${season}/${ep}?download=true`;
      items += `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:#0f1629; border-radius:6px; margin-bottom:4px; border-left:3px solid #e50914;">
          <span style="color:#fff; font-weight:500; min-width:50px; font-size:0.85rem;">Ep ${ep}</span>
          <div style="display:flex; gap:6px;">
            <a href="${srv1}" target="_blank" style="background:#e50914; color:#fff; padding:3px 10px; border-radius:4px; text-decoration:none; font-size:0.75rem; font-weight:600;">Server 1</a>
            <a href="${srv2}" target="_blank" style="background:#232d45; color:#fff; padding:3px 10px; border-radius:4px; text-decoration:none; font-size:0.75rem; font-weight:600;">Server 2</a>
          </div>
        </div>
      `;
    }
    downloadList.innerHTML = items;
    // Keep it closed when switching seasons
    downloadList.style.display = 'none';
    const icon = document.getElementById('download-toggle-icon');
    if (icon) icon.innerHTML = '▼';
  }

  // Default: play first episode
  window.selectTvEpisode(tvId, season, 1);
};

window.selectTvEpisode = function(tvId, season, episode, btnElement) {
  // 1. Highlight episode button
  if (btnElement) {
    document.querySelectorAll('.ep-btn').forEach(btn => {
      btn.style.background = '#232d45';
      btn.classList.remove('active');
    });
    btnElement.style.background = '#e50914';
    btnElement.classList.add('active');
  }

  // 2. Build player
  const box = document.getElementById("backdrop-player-box");
  if (!box) return;

  const streamUrl = `https://multiembed.mov/?video_id=${tvId}&tmdb=1&s=${season}&e=${episode}`;

  box.innerHTML = `
    <button id="hero-close-btn" style="position: absolute; top: 12px; left: 12px; z-index: 1000; color: #fff; background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.8rem; backdrop-filter: blur(8px);">
      ✕ Close Player
    </button>
    <iframe
      src="${streamUrl}"
      style="width: 100%; height: 100%; border: none; display: block;"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope"
      allowfullscreen
      webkitallowfullscreen
      mozallowfullscreen
      playsinline
      frameborder="0">
    </iframe>
  `;

  // Fullscreen button
  const iframe = box.querySelector("iframe");
  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.id = "hero-fullscreen-btn";
  fullscreenBtn.innerHTML = "⛶";
  fullscreenBtn.title = "Fullscreen";
  fullscreenBtn.style.cssText = `
    position: absolute !important; bottom: 8px !important; right: 8px !important; z-index: 9999 !important;
    width: 34px !important; height: 34px !important; color: #fff !important;
    background: rgba(0,0,0,0.65) !important; border: 1px solid rgba(255,255,255,0.2) !important;
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
};

// ── Header ────────────────────────────────────────────────────
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

// ── Wire card clicks ──────────────────────────────────────────
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

// ── Start the app ─────────────────────────────────────────────
init();

// ── Overlay Video Player Listener ──────────────────────────────
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
    if (isTv) {
      return;
    }

    const box = document.getElementById("backdrop-player-box");
    if (box) {
      box.style.position = "relative";
      box.style.zIndex = "50";

      let playerSrc = "";

      if (movie && movie.imdbId) {
        playerSrc = `https://multiembed.mov/?video_id=${movie.imdbId}`;
      } else if (movie && movie.tmdbId) {
        playerSrc = `https://multiembed.mov/?video_id=${movie.tmdbId}&tmdb=1`;
      } else {
        const isImdb = String(rawId).startsWith("tt");
        playerSrc = isImdb
          ? `https://multiembed.mov/?video_id=${rawId}`
          : `https://multiembed.mov/?video_id=${rawId}&tmdb=1`;
      }

      box.innerHTML = `
        <button id="hero-close-btn" style="position: absolute; top: 48px; left: 12px; z-index: 1000; color: #fff; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.8rem; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transition: all 0.2s ease; opacity: 0.85;" onmouseover="this.style.backgroundColor='rgba(0,0,0,0.5)'; this.style.opacity='1'" onmouseout="this.style.backgroundColor='rgba(0,0,0,0.3)'; this.style.opacity='0.85'">✕ Close Player</button>
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
        position: absolute !important;
        bottom: 6px !important;
        right: 8px !important;
        z-index: 9999 !important;
        width: 32px !important;
        height: 32px !important;
        color: #fff !important;
        background: rgba(0, 0, 0, 0.6) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 16px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        margin: 0 !important;
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
      const poster = movie && movie.posterUrl ? movie.posterUrl : "";
      const title = movie && movie.title ? movie.title : "";

      box.innerHTML = `
        <img id="detail-poster-img" src="${poster}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;">
        <button id="hero-play-btn" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 64px; height: 64px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#FFFFFF" style="margin-left: 4px;"><path d="M8 5v14l11-7z"/></svg>
        </button>
      `;
    }
  }
});

// ── Player Mutation Observer ──────────────────────────────────
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
// --- Scraper Functions ---
window.showDownloadPage = async function(movieTitle) {
  const container = document.getElementById('moviesmod-container');
  if (!container) return;

  // 1. Loading State
  container.innerHTML = `
    <div style="background: #161d2f; padding: 15px; border-radius: 8px; color: #fff; text-align: center; border: 1px solid #232d45;">
      <p style="margin: 0;">⏳ Searching available qualities for "${movieTitle}"...</p>
    </div>
  `;

  try {
const targetUrl = "https://moviesmods.best/3893670-soulm8te-2026-english-audio-web-dl-720p-480p-1080p.html";

    // 2. Fetch available qualities
    const res = await fetch(`/api/available-qualities?url=${encodeURIComponent(targetUrl)}`);
    const data = await res.json();

    if (data.success && data.qualities && data.qualities.length > 0) {
      let buttonsHtml = data.qualities.map(q => `
        <button onclick="fetchFastLink('${targetUrl}', '${q}')" 
                style="background: #10b981; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">
           Download ${q}
        </button>
      `).join('');

      container.innerHTML = `
        <div style="background: #161d2f; padding: 15px; border-radius: 8px; border: 1px solid #232d45;">
          <p style="margin-top: 0; color: #9ca3af; font-size: 0.9rem;">Select Quality:</p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${buttonsHtml}
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="background: #161d2f; padding: 15px; border-radius: 8px; color: #ef4444; border: 1px solid #232d45;">
          ❌ No qualities found for this movie.
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `
      <div style="background: #161d2f; padding: 15px; border-radius: 8px; color: #ef4444; border: 1px solid #232d45;">
        ❌ Scraper error occurred. Please try again.
      </div>
    `;
  }
};

window.fetchFastLink = async function(targetUrl, quality) {
  alert(`Fetching ${quality} link... Please wait.`);
  try {
    const res = await fetch(`/api/fast-link?url=${encodeURIComponent(targetUrl)}&quality=${quality}`);
    const data = await res.json();

    if (data.success && data.url) {
      window.open(data.url, '_blank');
    } else {
      alert('Download link not found.');
    }
  } catch (err) {
    alert('Error fetching download link.');
  }
};
