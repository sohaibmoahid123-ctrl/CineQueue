// ============================================================
// yts.js — دریافت لینک تورنت از YTS (در حالت رزرو برای آینده)
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

// این تابع جهت خنثی‌سازی غیرفعال شد تا به UI دکمه‌ها دست نزند
export async function handleYTSDownload(movieId) {
  console.log('YTS is currently disabled for UI buttons.');
}

export async function getAutoDownloadLinks(movie) {
  // این بخش هم جهت عدم تداخل با دکمه‌های جدید غیرفعال است
  return;
}

// خنثی کردن اتصال سراسری به HTML
window.handleYTSDownload = handleYTSDownload;
