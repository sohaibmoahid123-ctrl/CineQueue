// ============================================================
// CineQueue — utils.js
// ============================================================
const app = document.getElementById('app');

export function showLoading() {
  if (app) {
    app.innerHTML = `
      <div class="loading-screen">
        <div class="loading-logo">CineQueue</div>
        <div class="loading-spinner"></div>
      </div>`;
  }
}

export function hideLoading() {
  const loading = document.querySelector('.loading-screen');
  if (loading) loading.remove();
}

export function buildHeader() {
  return `
    <header class="site-header">
      <a href="#" class="logo">CineQueue</a>
      <nav class="nav-links">
        <a href="#">Movies</a>
        <a href="#tv">TV Shows</a>
        <a href="#sports" class="sports-nav-link">Sports</a>
      </nav>
      <div class="search-wrap">
        <input type="search" id="search-input" class="search-input" placeholder="Search movies..." />
      </div>
    </header>`;
}

export function buildFooter() {
  return `
    <footer class="site-footer">
      <div class="footer-container">
        <div class="footer-brand">
          <h2 class="footer-logo">Cine<span>Queue</span></h2>
          <p class="footer-tagline">Fast movie streaming & direct download system.<br>Powered by TMDB metadata.</p>
        </div>
        <div class="footer-column">
          <h4>Explore</h4>
          <ul>
            <li><a href="#">Trending Movies</a></li>
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
          <button class="back-to-top" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">Back to Top</button>
        </div>
      </div>
      <div class="footer-bottom"><p>2026 CineQueue. All rights reserved. This product uses the TMDB API but is not endorsed or certified by TMDB.</p></div>
    </footer>`;
}

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
