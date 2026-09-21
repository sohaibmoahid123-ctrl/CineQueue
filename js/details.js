// ============================================================
// CineQueue — details.js
// ============================================================
import { API_KEY, BASE_URL, IMAGE_URL } from './config.js';
import { buildHeader } from './utils.js';
import { buildCard, wireCards } from './cards.js';
import { wireSearch } from './search.js';
import { getAutoDownloadLinks } from './yts.js';
import { showDownloadPage } from './moviesmod.js';
import { getTvSeasonsInfo, buildSeasonDownloadList } from './tv.js';
import { handleNewServerDownload, handleMovieServer2Download } from './decryptor.js';

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

async function getMovieCredits(movieId, isTv = false) {
  const type = isTv ? 'tv' : 'movie';
  const url = `${BASE_URL}/${type}/${movieId}?api_key=${API_KEY}&append_to_response=credits`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const directorPerson = data.credits?.crew?.find(c => c.job === 'Director');

    return {
      director: directorPerson ? directorPerson.name : 'TMDB Cinema',
      cast: (data.credits?.cast || []).slice(0, 12).map(a => ({
        name: a.name,
        character: a.character || '',
        profileUrl: a.profile_path ? `${IMAGE_URL}${a.profile_path}` : null
      }))
    };
  } catch (error) {
    console.error('Error fetching credits:', error);
    return {
      director: 'TMDB Cinema',
      cast: []
    };
  }
}

export async function renderMovieDetail(id, allMovies, mediaType = null) {
  const app = document.getElementById('app');
  const movie = allMovies.find(m => m.id === id && (!mediaType || m.mediaType === mediaType));
  
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

  const credits = await getMovieCredits(movie.id, movie.mediaType === 'tv');
  movie.director = credits.director;
  movie.cast = credits.cast;

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

<div class="info-cast-section">
  <div class="director-inline">
    <span class="dir-label">Director:</span>
    <span class="dir-name">${movie.director || 'N/A'}</span>
  </div>

  <div class="cast-carousel-wrapper">
    <div class="cast-carousel">
      ${movie.cast && Array.isArray(movie.cast) ? movie.cast.map(actor => `
        <div class="cast-item">
          <div class="cast-avatar-circle">
            <img src="${actor.profileUrl || 'https://via.placeholder.com/80?text=Actor'}" alt="${actor.name || 'Actor'}" loading="lazy">
          </div>
          <span class="cast-actor-name">${actor.name || actor}</span>
          <span class="cast-role-name">${actor.character || ''}</span>
        </div>
      `).join('') : '<p style="color:#888; font-size:0.8rem;">No cast details available</p>'}
    </div>
  </div>
</div>

  </div>
  </div>

${isTv ? `
<!-- ========== بخش دانلود سریال ========== -->
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
      📥 FIND LINKS (Selected Season)
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
<!-- ========== بخش دانلود فیلم ========== -->
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
      ${buildFooter()}
  `;

  wireCards();
  wireSearch(allMovies, wireCards);
}
