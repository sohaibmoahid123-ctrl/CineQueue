// ============================================================
// CineQueue — player.js
// ============================================================

export function initPlayerEvents(getAllMovies) {
  document.addEventListener("click", function (e) {
    const playBtn = e.target.closest("#hero-play-btn");
    const closeBtn = e.target.closest("#hero-close-btn");

    const getMovieId = () => {
      const hashParts = window.location.hash.split("/");
      return hashParts.length > 1 && hashParts[1] ? hashParts[1] : (window.currentMovieId || "");
    };

    if (playBtn) {
      const rawId = getMovieId();
      const moviesList = getAllMovies() || [];
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
      const moviesList = getAllMovies() || [];
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
}

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
