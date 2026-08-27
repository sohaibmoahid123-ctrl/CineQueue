// ============================================================
// CineQueue — hero.js
// ============================================================

let featuredMovies = [];
let heroTimer = null;
let heroIndex = 0;

export function setHeroMovies(movies) {
  featuredMovies = movies || [];
}

export function stopHeroTimer() {
  if (heroTimer) {
    clearInterval(heroTimer);
    heroTimer = null;
  }
}

export function paintHero() {
  const section = document.getElementById('hero-section');
  if (!section || !featuredMovies.length) return;

  const m = featuredMovies[heroIndex];
  section.innerHTML = `

<div class="hero-backdrop" style="background-image:url('${m.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + m.backdrop_path : m.posterUrl}')">

      <div class="hero-gradient"></div>
      <div class="hero-content">
        <span class="hero-genre">${m.genre}</span>
        <h1 class="hero-title">${m.title}</h1>
        <div class="hero-meta">
          <span class="rating-badge">${m.rating}</span>
          <span>${m.year}</span>
          <span>${m.durationMinutes} min</span>
        </div>

        <div class="hero-actions">
          <button class="btn-primary" onclick="openMovie(${m.id})">&#9654; Watch Now</button>
          <button class="btn-secondary" onclick="openMovie(${m.id})">&#8505; More Info</button>
        </div>
      </div>
      <div class="hero-dots">
        ${featuredMovies.map((_, i) => `
          <span class="hero-dot ${i === heroIndex ? 'active' : ''}" onclick="jumpHero(${i})"></span>
        `).join('')}
      </div>
    </div>`;
}

export function jumpHero(i) {
  stopHeroTimer();
  heroIndex = i;
  paintHero();
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % featuredMovies.length;
    paintHero();
  }, 7000);
}

export function startHero(movies) {
  if (movies && movies.length) {
    setHeroMovies(movies);
  }
  heroIndex = 0;
  paintHero();
  stopHeroTimer();
  if (featuredMovies.length) {
    heroTimer = setInterval(() => {
      heroIndex = (heroIndex + 1) % featuredMovies.length;
      paintHero();
    }, 7000);
  }
}

window.startHero = startHero;
window.stopHeroTimer = stopHeroTimer;
window.paintHero = paintHero;
window.jumpHero = jumpHero;
