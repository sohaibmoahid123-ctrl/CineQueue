// ============================================================
// CineQueue — details.js
// ============================================================
import { buildHeader } from './utils.js';
import { buildCard, wireCards } from './cards.js';
import { wireSearch } from './search.js';
import { getAutoDownloadLinks } from './yts.js';
import { showDownloadPage } from './moviesmod.js';
import { getTvSeasonsInfo, buildSeasonDownloadList } from './tv.js';
import { handleNewServerDownload } from './decryptor.js';

export async function renderMovieDetail(id, allMovies) {
  const app = document.getElementById('app');
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
  wireSearch(allMovies, wireCards);
}
