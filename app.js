// ============================================================
// CineQueue — app.js
//
// To edit movie titles, descriptions, images:
//   Open  api/movies/index.json
//
// To edit download links, find the movie in that file and
// change "downloadUrl1080p" and "downloadUrl720p" values.
// ============================================================

const app = document.getElementById('app');
let allMovies    = [];
let featuredMovies = [];
let heroIndex    = 0;
let heroTimer    = null;

// ── Boot ──────────────────────────────────────────────────────
async function init() {
  showLoading();
  try {
    const [moviesRes, featuredRes] = await Promise.all([
      fetch('./api/movies/index.json'),
      fetch('./api/movies/featured/index.json')
    ]);
    allMovies      = await moviesRes.json();
    featuredMovies = await featuredRes.json();
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
  const genres = [...new Set(allMovies.map(m => m.genre))].sort();

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
  input.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    const browse = document.getElementById('browse-section');
    if (!browse) return;
    if (q.length < 2) {
      // Restore genre rows
      const genres = [...new Set(allMovies.map(m => m.genre))].sort();
      browse.innerHTML = genres.map(buildGenreRow).join('');
      wireCards();
      return;
    }
    const results = allMovies.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.synopsis.toLowerCase().includes(q) ||
      m.genre.toLowerCase().includes(q) ||
      m.director.toLowerCase().includes(q)
    );
    browse.innerHTML = results.length
      ? `<div class="genre-row">
           <h2 class="genre-title">Results for "${this.value.trim()}" (${results.length})</h2>
           <div class="cards-scroll">${results.map(buildCard).join('')}</div>
         </div>`
      : `<div class="no-results">No results for "<strong>${this.value.trim()}</strong>"</div>`;
    wireCards();
  });
}

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
  const has1080 = movie.downloadUrl1080p && movie.downloadUrl1080p !== '#';
  const has720  = movie.downloadUrl720p  && movie.downloadUrl720p  !== '#';

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

            <!-- ── Download Section ── -->
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
                <a href="${movie.downloadUrl1080p}"
                   class="download-btn primary-dl ${!has1080 ? 'placeholder' : ''}"
                   ${has1080 ? 'download' : 'onclick="return false"'}>
                  <div class="dl-quality">1080p</div>
                  <div class="dl-label">Full HD</div>
                  <div class="dl-size">~2.4 GB</div>
                </a>
                <a href="${movie.downloadUrl720p}"
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
          </div>
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
    const id = parseInt(card.dataset.id, 10);
    card.addEventListener('click', () => { window.location.hash = 'movie/' + id; });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.location.hash = 'movie/' + id;
      }
    });
  });
}

// ── Start the app ─────────────────────────────────────────────
init();

;/* --- Overlay Video Player (Perfect Placement) --- */
document.addEventListener("click", function(e) {
  const playBtn = e.target.closest("#hero-play-btn");
  const closeBtn = e.target.closest("#hero-close-btn");

  if (playBtn) {
    const backdrop = playBtn.parentElement;
    if (backdrop) {
      backdrop.dataset.originalHtml = backdrop.innerHTML;
      backdrop.style.position = "relative";

      // پلیر دقیقا در کادر بلور قرار می‌گیرد و ۴۰ پیکسل بالاتر کشیده می‌شود
      backdrop.innerHTML = `
        <div style="position:relative; width:100%; height:300px; margin-top:-40px; background:#000; z-index:1; border-radius:12px; overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,0.7);">
          <button id="hero-close-btn" style="position:absolute; top:10px; right:10px; z-index:101; background:rgba(0,0,0,0.8); color:#fff; border:1px solid rgba(255,255,255,0.4); border-radius:50%; width:32px; height:32px; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;">✕</button>
          <iframe 
            src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" 
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
      btn.innerHTML = `<svg width="44" height="44" viewBox="0 0 24 24" fill="#FFFFFF" style="margin-left:3px;"><path d="M8 5v14l11-7z"/></svg>`;
      btn.style.cssText = "position:absolute; top:35%; left:50%; transform:translate(-50%,-50%); background:rgba(229,9,20,0.9); border:none; border-radius:50%; width:70px; height:70px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:99; box-shadow:0 6px 20px rgba(0,0,0,0.6); transition:transform 0.2s;";
      
      btn.onmouseover = () => btn.style.transform = "translate(-50%,-50%) scale(1.1)";
      btn.onmouseout = () => btn.style.transform = "translate(-50%,-50%) scale(1)";
      
      targetArea.appendChild(btn);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
