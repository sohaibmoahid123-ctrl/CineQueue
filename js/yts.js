// ============================================================
// yts.js  —  دریافت لینک تورنت از YTS
// ============================================================

import { YTS_API_URL } from './config.js';

export async function getYTSMovie(title) {
  try {
    const res = await fetch(`${YTS_API_URL}/list_movies.json?query_term=${encodeURIComponent(title)}`);
    const data = await res.json();
    if (data.status === 'ok' && data.data?.movies?.length > 0) {
      return data.data.movies[0];
    }
    return null;
  } catch (error) {
    console.error('YTS API Error:', error);
    return null;
  }
}

export async function getYTSDownloadLinks(title) {
  try {
    const movie = await getYTSMovie(title);
    if (movie?.torrents) {
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

export async function handleYTSDownload(movieId) {
  // چون allMovies داخل app.js هست، فعلاً از window استفاده می‌کنیم
  const movie = window.allMovies?.find(m => m.id === movieId);
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
    if (torrents.length > 0) {
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
}

export async function getAutoDownloadLinks(movie) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${YTS_API_URL}/list_movies.json?query_term=${encodeURIComponent(movie.title)}`, { 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    const data = await res.json();

    if (data.data?.movies?.length > 0) {
      const torrents = data.data.movies[0].torrents;
      const t1080 = torrents.find(t => t.quality === '1080p');
      const t720  = torrents.find(t => t.quality === '720p');

      movie.downloadUrl1080p = t1080 ? t1080.url : torrents[0].url;
      movie.downloadUrl720p  = t720 ? t720.url : torrents[0].url;
    }
  } catch (err) {
    // Timeout/Abort errors ignored
  }
}

// برای اینکه از HTML و جاهای دیگه بشه صداش زد
window.handleYTSDownload = handleYTSDownload;