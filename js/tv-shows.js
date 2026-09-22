// ============================================================
// CineQueue - dedicated TV Shows dashboard
// ============================================================
import { API_KEY, BASE_URL, IMAGE_URL } from './config.js';
import { buildHeader } from './utils.js';
import { wireCards } from './cards.js';
import { wireSearch } from './search.js';

const tvGenres = [
  { id: 'all', label: 'All Shows' },
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
    <div class="movie-card tv-show-card" data-id="${show.id}" data-media-type="tv" tabindex="0" role="button" aria-label="${show.title}">
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
    <div class="hero-backdrop tv-dashboard-hero" style="background-image:url('${backdrop}')">
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

    const unique = new Map();
    const addShows = (items, source) => items.forEach(item => {
      if (item.poster_path && !unique.has(item.id)) unique.set(item.id, mapShow(item, source));
    });
    addShows(trending.results || [], 'Trending TV');
    addShows(popular.results || [], 'Popular TV');
    addShows(topRated.results || [], 'Top Rated TV');

    const shows = Array.from(unique.values());
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

    let activeGenre = 'all';
    let query = '';
    const popularShows = shows.slice(0, 5);
    const render = () => {
      const normalized = query.toLowerCase().trim();
      const filtered = shows.filter(show => {
        const genreMatch = activeGenre === 'all' || show.genreIds?.includes(Number(activeGenre));
        const queryMatch = !normalized || `${show.title} ${show.synopsis}`.toLowerCase().includes(normalized);
        return genreMatch && queryMatch;
      });
      app.querySelector('.tv-dashboard').innerHTML = `
        <section class="tv-dashboard-hero-wrap">${buildHero(popularShows[0])}</section>
        <section class="tv-dashboard-content">
          <div class="tv-dashboard-toolbar"><div><span class="sports-kicker">TV library</span><h2>Find your next series</h2></div><label class="sports-search"><span>Quick search</span><input id="tv-show-search" type="search" value="${query}" placeholder="Search TV shows" /></label></div>
          <div class="tv-genre-filters">${tvGenres.map(genre => `<button class="tv-genre-filter ${activeGenre === String(genre.id) ? 'active' : ''}" data-genre="${genre.id}">${genre.label}</button>`).join('')}</div>
          <div class="tv-show-rail"><h2>Trending this week</h2><div class="cards-scroll">${shows.slice(0, 12).map(buildTvCard).join('')}</div></div>
          <div class="tv-show-rail"><h2>Popular TV</h2><div class="cards-scroll">${shows.filter(show => show.genre === 'Popular TV').slice(0, 12).map(buildTvCard).join('')}</div></div>
          <div class="tv-show-rail"><h2>${normalized ? `Results for "${query}"` : 'Top Rated TV'}</h2><div class="cards-scroll">${filtered.slice(0, 18).map(buildTvCard).join('') || '<p class="sports-empty">No TV shows match your search.</p>'}</div></div>
        </section>`;

      app.querySelectorAll('.tv-genre-filter').forEach(button => button.addEventListener('click', () => { activeGenre = button.dataset.genre; render(); }));
      app.querySelector('#tv-show-search')?.addEventListener('input', event => { query = event.target.value; render(); app.querySelector('#tv-show-search')?.focus(); });
      wireCards();
    };
    render();
  } catch (error) {
    console.error('TV dashboard error:', error);
    app.innerHTML = `${buildHeader()}<main class="tv-dashboard"><div class="tv-dashboard-loading">TV shows are temporarily unavailable.</div></main>`;
  }
}
