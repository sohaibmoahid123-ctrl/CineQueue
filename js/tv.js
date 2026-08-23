// ============================================================
// tv.js  —  مدیریت فصل و قسمت سریال‌ها
// ============================================================

import { BASE_URL, API_KEY } from './config.js';

export async function getTvSeasonsInfo(tvId) {
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

export function buildSeasonDownloadList(seasonsInfo, tvId) {
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

export function selectTvSeason(tvId, season) {
  const grid = document.getElementById('episodes-btn-grid');
  if (!grid) return;

  const movie = window.allMovies?.find(m => m.id == tvId);
  const seasonData = movie?.seasonsInfo?.find(s => s.season_number == season);
  const episodeCount = seasonData ? seasonData.episode_count : 10;

  grid.innerHTML = Array.from({ length: episodeCount }, (_, i) => i + 1).map(ep => `
    <button class="ep-btn ${ep === 1 ? 'active' : ''}" 
            onclick="window.selectTvEpisode(${tvId}, ${season}, ${ep}, this)" 
            style="background: ${ep === 1 ? '#e50914' : '#232d45'}; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; transition: background 0.2s;">
      Ep ${ep}
    </button>
  `).join('');

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
    downloadList.style.display = 'none';
    const icon = document.getElementById('download-toggle-icon');
    if (icon) icon.innerHTML = '▼';
  }

  window.selectTvEpisode(tvId, season, 1);
}

export function selectTvEpisode(tvId, season, episode, btnElement) {
  if (btnElement) {
    document.querySelectorAll('.ep-btn').forEach(btn => {
      btn.style.background = '#232d45';
      btn.classList.remove('active');
    });
    btnElement.style.background = '#e50914';
    btnElement.classList.add('active');
  }

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
}

// برای صدا زدن از HTML
window.selectTvSeason = selectTvSeason;
window.selectTvEpisode = selectTvEpisode;
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