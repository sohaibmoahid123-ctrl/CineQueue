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
