// ============================================================
// CineQueue — app.js
//
// To edit movie titles, descriptions, images:
//   Open  api/movies/index.json
//
// To edit download links, find the movie in that file and
// change "downloadUrl1080p" and "downloadUrl720p" values.
// ============================================================
const API_KEY = 'cab1be6caea88ea79b1101c13ddb5702';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p/w500';

const app = document.getElementById('app');
let allMovies    = [];
let featuredMovies = [];
let heroIndex    = 0;
let heroTimer    = null;

// ── Boot ──────────────────────────────────────────────────────
async function init() {
  showLoading();
  try {
    const pagesToFetch = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const fetchPromises = pagesToFetch.map(page => 
      fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}&include_adult=false`).then(res => res.json())
    );

    const [genresRes, ...pagesData] = await Promise.all([
      fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=en-US`).then(res => res.json()),
      ...fetchPromises
    ]);

    let rawMovies = [];
    pagesData.forEach(p => {
      if (p.results) rawMovies.push(...p.results);
    });
    rawMovies = rawMovies.filter(m => !m.adult);

    const genreMap = {};
    if (genresRes.genres) {
      genresRes.genres.forEach(g => { genreMap[g.id] = g.name; });
    }

    const allowedGenres = ['Action', 'Animation', 'Crime', 'Horror', 'Romance'];
    
    const genreCounts = {
      'Popular Movies': 0,
      'Action': 0,
      'Animation': 0,
      'Crime': 0,
      'Horror': 0,
      'Romance': 0
    };

    allMovies = [];

    const buildMovieObj = (movie, assignedGenre) => ({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.poster_path ? `${IMAGE_URL}${movie.poster_path}` : '',
      synopsis: movie.overview || 'No synopsis available.',
      year: parseInt(movie.release_date ? movie.release_date.split('-')[0] : '2026'),
      rating: movie.vote_average ? parseFloat(movie.vote_average.toFixed(1)) : 7.0,
      durationMinutes: 120,
      genre: assignedGenre,
      director: 'TMDB Cinema',
      cast: ['Popular Actor'],
      downloadUrl1080p: `https://vidsrc.to/embed/movie/${movie.id}`,
      downloadUrl720p: `https://vidsrc.to/embed/movie/${movie.id}`
    });

    for (const movie of rawMovies) {
      if (genreCounts['Popular Movies'] < 15) {
        allMovies.push(buildMovieObj(movie, 'Popular Movies'));
        genreCounts['Popular Movies']++;
        continue;
      }

      if (movie.genre_ids && movie.genre_ids.includes(16)) {
        if (genreCounts['Animation'] < 15) {
          allMovies.push(buildMovieObj(movie, 'Animation'));
          genreCounts['Animation']++;
          continue;
        }
      }

      if (movie.genre_ids) {
        const matchedName = movie.genre_ids.map(id => genreMap[id]).find(name => allowedGenres.includes(name) && name !== 'Animation');
        if (matchedName && genreCounts[matchedName] < 15) {
          allMovies.push(buildMovieObj(movie, matchedName));
          genreCounts[matchedName]++;
        }
      }
    }

    featuredMovies = allMovies.slice(0, 5);

  } catch (err) {
    app.innerHTML = '<div class="error"><h2>Could not load movies.</h2><p>Please refresh the page.</p></div>';
    return;
  }

  window.addEventListener('hashchange', route);
  route();
}


// ── Router ────────────────────────────────────────────────────
function route() {
  const hash = window.location.hash.slice(1); // strip the #
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

// ── Home Page ─────────────────────────────────────────────────
function renderHome() {
  // Collect unique genres in the order they appear
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

// Global so onclick= attributes can reach it
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

// ── Search ────────────────────────────────────────────────────
function wireSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;

  let searchTimeout = null;

  input.addEventListener('input', function () {
    const q = this.value.trim();
    const browse = document.getElementById('browse-section');
    if (!browse) return;

    if (q.length < 2) {
      const genres = [...new Set(allMovies.map(m => m.genre))].sort((a, b) => {
        if (a === 'Popular Movies') return -1;
        if (b === 'Popular Movies') return 1;
        return a.localeCompare(b);
      });
      browse.innerHTML = genres.map(buildGenreRow).join('');
      wireCards();
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(q)}`);
        const data = await res.json();

        const searchResults = (data.results || []).map(movie => ({
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
          downloadUrl1080p: `https://vidsrc.to/embed/movie/${movie.id}`,
          downloadUrl720p: `https://vidsrc.to/embed/movie/${movie.id}`
        }));

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
        console.error('Search error:', err);
      }
    }, 400);
  });
}

// تابع کمکی برای ساخت کارت‌های سرچ با افکت بلور// تابع کمکی برای ساخت کارت‌های سرچ با تشخیص هوشمند کلمات و برچسب حساس
function buildSearchCard(m, isAgeUnlocked) {
  const sensitiveKeywords = ['sex', 'nude', 'erotic', 'desire', 'passion', 'kill', 'slasher', 'blood', 'gory', 'gore', 'massacre', 'murder'];
  
  const titleLower = (m.title || '').toLowerCase();
  const hasSensitiveTitle = sensitiveKeywords.some(keyword => titleLower.includes(keyword));

  const isSensitive = m.isAdult || hasSensitiveTitle;

  const adultClass = (isSensitive && !isAgeUnlocked) ? 'adult-content' : '';
  const adultBadge = isSensitive ? `<span class="adult-badge">+18</span>` : '';

  return `
    <div class="movie-card ${adultClass}" data-id="${m.id}">
      <div class="card-poster">
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

// تابع باز کردن بلور پوسترها با تایید سن
window.unlockAdultPosters = function() {
  localStorage.setItem('ageUnlocked', 'true');
  document.querySelectorAll('.movie-card.adult-content').forEach(card => {
    card.classList.remove('adult-content');
  });
  const banner = document.querySelector('.age-unlock-banner');
  if (banner) banner.remove();
};

// ── Movie Detail Page ─────────────────────────────────────────
function renderMovieDetail(id) {
  const movie = allMovies.find(m => m.id === id);
  if (!movie) {
    app.innerHTML = `
      ${buildHeader()}
      <div class="not-found">
        <h2>Movie not found</h2>
        <button class="btn-primary" onclick="history.back()">&#8592; Go Back</button>
      </div>`;
    return;
  }

  // Related movies in the same genre (exclude this one)
  const related = allMovies.filter(m => m.genre === movie.genre && m.id !== movie.id);

  // Check if real download links were provided
const has1080 = `https://vidlink.pro/movie/${movie.id}`;
const has720 = `https://vidlink.pro/movie/${movie.id}`;
  app.innerHTML = `
    ${buildHeader()}
    <main class="detail-main">

      <!-- Full-width backdrop (blurred poster) -->
      <div class="detail-backdrop">
        <img class="detail-backdrop-img" src="${movie.posterUrl}" alt="">
        <div class="detail-backdrop-gradient"></div>
      </div>

      <div class="detail-content">

        <!-- Back -->
        <button class="back-btn" onclick="history.back()">&#8592; Back</button>

        <!-- Poster + Info side by side -->
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
              <span class="credit-value">${movie.cast.join(', ')}</span>
            </div>
          </div>
        </div>

   </div>
   </div>
      <!-- Download Section -->
      <div class="download-section">
        <h3 class="download-heading">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Video
        </h3>
        <div class="download-buttons">
          <a href="⁠${has1080}"
             class="download-btn primary-dl ${!has1080 ? 'placeholder' : ''}"
             ${has1080 ? 'download' : 'onclick="return false"'}>
            <div class="dl-quality">1080p</div>
            <div class="dl-label">Full HD</div>
            <div class="dl-size">~2.4 GB</div>
          </a>
          <a href="${has720}"
             class="download-btn secondary-dl ${!has720 ? 'placeholder' : ''}"
             ${has720 ? 'download' : 'onclick="return false"'}>
            <div class="dl-quality">720p</div>
            <div class="dl-label">HD Ready</div>
            <div class="dl-size">~1.1 GB</div>
          </a>
        </div>
        ${!has1080 && !has720
          ? `<p class="dl-note">
              No download links yet. Open <code>api/movies/index.json</code>,
              find this movie, and set <code>downloadUrl1080p</code> and
              <code>downloadUrl720p</code> to real video URLs.
            </p>`
          : ''}
      </div>
<div className="mt-auto bg-[#...] p-6 rounded-2xl ...">
</div>

        <!-- More in this genre -->
        ${related.length > 0 ? `
        <div class="more-section">
          <h2 class="genre-title">More ${movie.genre}</h2>
          <div class="cards-scroll">
            ${related.map(buildCard).join('')}
          </div>
        </div>` : ''}

      </div>
    </main>`;

  wireCards();
}

// ── Header ────────────────────────────────────────────────────
function buildHeader() {
  return `
    <header class="site-header">
      <a href="#" class="logo">CineQueue</a>
      <nav class="nav-links">
        <a href="#">Browse</a>
      </nav>
      <div class="search-wrap">
        <input type="search" id="search-input"
               class="search-input" placeholder="Search movies..." />
      </div>
    </header>`;
}

// ── Wire card clicks ──────────────────────────────────────────
function wireCards() {
  document.querySelectorAll('.movie-card').forEach(card => {
    card.onclick = function (e) {
      // اگر کارت هنوز بلور و قفل است، اجازه ورود به صفحه بعد را نده
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

;/* --- Overlay Video Player (Extended Height to Back Button) --- */
document.addEventListener("click", function(e) {
  const playBtn = e.target.closest("#hero-play-btn");
  const closeBtn = e.target.closest("#hero-close-btn");

  if (playBtn) {
    const backdrop = playBtn.parentElement;
    if (backdrop) {
      backdrop.dataset.originalHtml = backdrop.innerHTML;
      backdrop.style.position = "relative";
      backdrop.style.width = "100%";

      // افزایش ارتفاع به ۴۶۰ پیکسل برای رسیدن به نزدیکی کلمه Back
      backdrop.innerHTML = `
        <div style="position:relative; width:100%; height:460px; margin:10px 0 15px 0; background:#000; border-radius:16px; overflow:hidden; box-shadow:0 12px 35px rgba(0,0,0,0.85); border:1px solid rgba(255,255,255,0.12);">
          <button id="hero-close-btn" style="position:absolute; top:14px; right:14px; z-index:101; background:rgba(0,0,0,0.8); color:#fff; border:1px solid rgba(255,255,255,0.3); border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:18px; font-weight:bold; display:flex; align-items:center; justify-content:center; transition:0.2s;">✕</button>
          <iframe 
            src={`https://vidlink.pro/movie/${movie.id || window.currentMovieId}`}
            style="width:100%; height:100%; border:none;" 
            allow="autoplay; encrypted-media; fullscreen" 
            allowfullscreen>
          </iframe>
        </div>`;
    }
  }

  if (closeBtn) {
    const backdrop = closeBtn.closest("[data-original-html]");
    if (backdrop && backdrop.dataset.originalHtml) {
      backdrop.innerHTML = backdrop.dataset.originalHtml;
      delete backdrop.dataset.originalHtml;
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
// تابع تعویض سرور پخش فیلم
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
