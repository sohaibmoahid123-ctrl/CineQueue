// ============================================================
// CineQueue - dedicated TV Shows dashboard
// ============================================================
import { API_KEY, BASE_URL, IMAGE_URL } from './config.js';
import { buildFooter, buildHeader } from './utils.js';
import { wireCards } from './cards.js';

const tvGenreRails = [
  { id: 10759, label: 'Action & Adventure' },
  { id: 18, label: 'Drama' },
  { id: 35, label: 'Comedy' },
  { id: 9648, label: 'Mystery' },
  { id: 10765, label: 'Sci-Fi & Fantasy' }
];

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
  return response.json();
}

function mapShow(show, source) {
  const year = parseInt((show.first_air_date || '2026').split('-')[0], 10);
  return {
    id: show.id,
    title: show.name || show.original_name,
    posterUrl: show.poster_path ? `${IMAGE_URL}${show.poster_path}` : '',
    backdrop_path: show.backdrop_path || null,
    synopsis: show.overview || 'No synopsis available.',
    year,
    rating: show.vote_average ? Number(show.vote_average.toFixed(1)) : 0,
    durationMinutes: 45,
    genre: source,
    mediaType: 'tv',
    popularity: show.popularity || 0,
    genreIds: show.genre_ids || [],
    seasons: show.number_of_seasons || 0,
    episodes: show.number_of_episodes || 0,
    firstAirDate: show.first_air_date || '',
    downloadUrl1080p: `https://vidsrc.to/embed/tv/${show.id}`,
    downloadUrl720p: `https://vidsrc.to/embed/tv/${show.id}`
  };
}

function buildTvCard(show) {
  return `
    <div class="movie-card tv-show-card fade-in-up" data-id="${show.id}" data-media-type="tv" tabindex="0" role="button" aria-label="${show.title}">
      <img src="${show.posterUrl}" alt="${show.title}" loading="lazy">
      <div class="card-overlay">
        <div class="card-title">${show.title}</div>
        <div class="card-meta">
          <span class="rating-badge">${show.rating || 'N/A'}</span>
          <span>${show.firstAirDate || show.year}</span>
          <span>${show.seasons ? `${show.seasons} season${show.seasons === 1 ? '' : 's'}` : 'TV series'}</span>
        </div>
      </div>
    </div>`;
}

function buildHero(show) {
  const backdrop = show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : show.posterUrl;
  return `
    <div class="hero-backdrop tv-dashboard-hero fade-in-up" style="background-image:url('${backdrop}')">
      <div class="hero-gradient"></div>
      <div class="hero-content">
        <span class="hero-genre">TV SHOWS</span>
        <h1 class="hero-title">${show.title}</h1>
        <div class="hero-meta"><span class="rating-badge">${show.rating || 'N/A'}</span><span>${show.year}</span><span>${show.seasons ? `${show.seasons} seasons` : 'Series'}</span></div>
        <p class="tv-hero-synopsis">${show.synopsis}</p>
        <div class="hero-actions"><button class="btn-primary" onclick="openMovie(${show.id}, 'tv')">&#9654; Watch Now</button><button class="btn-secondary" onclick="openMovie(${show.id}, 'tv')">&#8505; More Info</button></div>
      </div>
    </div>`;
}

export async function renderTvShows() {
  const app = document.getElementById('app');
  app.innerHTML = `${buildHeader()}<main class="tv-dashboard"><div class="tv-dashboard-loading">Loading TV shows...</div></main>`;

  try {
    const [trending, popular, topRated] = await Promise.all([
      fetchJson(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}&language=en-US`),
      fetchJson(`${BASE_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=1`),
      fetchJson(`${BASE_URL}/tv/top_rated?api_key=${API_KEY}&language=en-US&page=1`)
    ]);

    const mapUnique = (items, source, excludedIds = new Set()) => {
      const unique = new Map();
      items.forEach(item => {
        if (item.poster_path && !excludedIds.has(item.id) && !unique.has(item.id)) unique.set(item.id, mapShow(item, source));
      });
      return Array.from(unique.values());
    };
    const trendingShows = mapUnique(trending.results || [], 'Trending TV');
    const trendingIds = new Set(trendingShows.map(show => show.id));
    const popularShows = mapUnique(popular.results || [], 'Popular TV', trendingIds);
    const topRatedShows = mapUnique(topRated.results || [], 'Top Rated TV', new Set([...trendingIds, ...popularShows.map(show => show.id)]));
    const shows = [...trendingShows, ...popularShows, ...topRatedShows];
    const detailShows = await Promise.all(shows.slice(0, 36).map(async show => {
      try {
        const details = await fetchJson(`${BASE_URL}/tv/${show.id}?api_key=${API_KEY}&language=en-US`);
        return { ...show, seasons: details.number_of_seasons || show.seasons, episodes: details.number_of_episodes || show.episodes };
      } catch {
        return show;
      }
    }));
    const byId = new Map(detailShows.map(show => [show.id, show]));
    shows.forEach(show => Object.assign(show, byId.get(show.id) || {}));

    const heroShows = trendingShows.length ? trendingShows : shows;
    const render = () => {
      app.querySelector('.tv-dashboard').innerHTML = `
        <section class="tv-dashboard-hero-wrap">${heroShows.length ? buildHero(heroShows[0]) : ''}</section>
        <section class="tv-dashboard-content">
          <div class="tv-show-rail"><h2 class="genre-title">Trending this week</h2><div class="cards-scroll">${trendingShows.slice(0, 12).map(buildTvCard).join('')}</div></div>
          <div class="tv-show-rail"><h2 class="genre-title">Popular TV</h2><div class="cards-scroll">${popularShows.slice(0, 12).map(buildTvCard).join('')}</div></div>
          <div class="tv-show-rail"><h2 class="genre-title">Top Rated TV</h2><div class="cards-scroll">${topRatedShows.slice(0, 18).map(buildTvCard).join('')}</div></div>
          ${tvGenreRails.map(genre => {
            const genreShows = shows.filter(show => show.genreIds?.includes(genre.id));
            return genreShows.length ? `<div class="tv-show-rail"><h2 class="genre-title">${genre.label}</h2><div class="cards-scroll">${genreShows.slice(0, 12).map(buildTvCard).join('')}</div></div>` : '';
          }).join('')}
        </section>
        ${buildFooter()}`;

      wireCards();
    };
    render();
  } catch (error) {
    console.error('TV dashboard error:', error);
    app.innerHTML = `${buildHeader()}<main class="tv-dashboard"><div class="tv-dashboard-loading">TV shows are temporarily unavailable.</div></main>${buildFooter()}`;
  }
}
