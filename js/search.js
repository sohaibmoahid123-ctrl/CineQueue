// ============================================================
// CineQueue — search.js
// ============================================================
import { API_KEY, BASE_URL, IMAGE_URL } from './config.js';

let cleanupActiveSearch = null;

function getMediaKey(movie) {
  return `${movie.mediaType || 'movie'}_${movie.id}`;
}

export function wireSearch(allMovies, wireCardsCallback) {
  if (cleanupActiveSearch) cleanupActiveSearch();

  const input = document.getElementById('search-input');
  if (!input) return;

  let searchTimeout = null;
  const controller = new AbortController();
  let searchDropdown = document.getElementById('search-dropdown');

  if (!searchDropdown) {
    searchDropdown = document.createElement('div');
    searchDropdown.id = 'search-dropdown';
    searchDropdown.style.cssText = `
      position: fixed;
      background: #111625;
      border: 1px solid #232d45;
      border-radius: 12px;
      max-height: 350px;
      overflow-y: auto;
      z-index: 999999;
      box-shadow: 0 10px 30px rgba(0,0,0,0.9);
      display: none;
      padding: 8px;
      box-sizing: border-box;
    `;
    document.body.appendChild(searchDropdown);
  }

  function updateDropdownPosition() {
    const rect = input.getBoundingClientRect();
    searchDropdown.style.top = (rect.bottom + 6) + 'px';
    searchDropdown.style.left = rect.left + 'px';
    searchDropdown.style.width = rect.width + 'px';
  }

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.style.display = 'none';
    }
  }, { signal: controller.signal });

  window.addEventListener('scroll', () => {
    if (searchDropdown.style.display === 'block') updateDropdownPosition();
  }, { signal: controller.signal, passive: true });
  window.addEventListener('resize', () => {
    if (searchDropdown.style.display === 'block') updateDropdownPosition();
  }, { signal: controller.signal, passive: true });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const q = this.value.trim();
      if (q.length >= 2) {
        searchDropdown.style.display = 'none';
        executeFullSearch(q, allMovies, wireCardsCallback);
      }
    }
  }, { signal: controller.signal });

  input.addEventListener('input', function () {
    const q = this.value.trim();

    if (q.length < 2) {
      searchDropdown.style.display = 'none';
      searchDropdown.innerHTML = '';
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        const [movieRes, tvRes] = await Promise.all([
          fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(q)}`, { signal: controller.signal }).then(r => r.json()),
          fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(q)}`, { signal: controller.signal }).then(r => r.json())
        ]);

        const movieResults = (movieRes.results || []).map(movie => ({
          id: movie.id,
          title: movie.title,
          posterUrl: movie.poster_path ? `${IMAGE_URL}${movie.poster_path}` : '',
          synopsis: movie.overview || 'No synopsis available.',
          year: parseInt(movie.release_date ? movie.release_date.split('-')[0] : '2026'),
          rating: movie.vote_average ? parseFloat(movie.vote_average.toFixed(1)) : 7.0,
          durationMinutes: 120,
          genre: 'Search Result',
          director: 'TMDB Cinema',
          cast: ['Popular Actor'],
          mediaType: 'movie',
          popularity: movie.popularity || 0
        }));

        const tvResults = (tvRes.results || []).map(tv => ({
          id: tv.id,
          title: tv.name || tv.original_name,
          posterUrl: tv.poster_path ? `${IMAGE_URL}${tv.poster_path}` : '',
          synopsis: tv.overview || 'No synopsis available.',
          year: parseInt(tv.first_air_date ? tv.first_air_date.split('-')[0] : '2026'),
          rating: tv.vote_average ? parseFloat(tv.vote_average.toFixed(1)) : 7.0,
          durationMinutes: 120,
          genre: 'Search Result',
          director: 'TMDB Cinema',
          cast: ['Popular Actor'],
          mediaType: 'tv',
          popularity: tv.popularity || 0
        }));

        const searchResults = [...movieResults, ...tvResults]
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 10);

        searchResults.forEach(m => {
          if (!allMovies.some(existing => getMediaKey(existing) === getMediaKey(m))) {
            allMovies.push(m);
          }
        });

        if (searchResults.length > 0) {
          searchDropdown.innerHTML = searchResults.map(buildSearchDropdownItem).join('');
          updateDropdownPosition();
          searchDropdown.style.display = 'block';

          searchDropdown.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              const id = parseInt(this.getAttribute('data-id'), 10);
              const mediaType = this.getAttribute('data-media-type');
              if (id) {
                searchDropdown.style.display = 'none';
                input.value = '';
                window.openMovie(id, mediaType);
              }
            });
          });
        } else {
          searchDropdown.innerHTML = `<div style="padding:12px; color:#aaa; text-align:center;">No results</div>`;
          updateDropdownPosition();
          searchDropdown.style.display = 'block';
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Dropdown search error:', err);
      }
    }, 300);
  }, { signal: controller.signal });

  cleanupActiveSearch = () => {
    clearTimeout(searchTimeout);
    controller.abort();
    if (cleanupActiveSearch === cleanup) cleanupActiveSearch = null;
  };
  const cleanup = cleanupActiveSearch;
}

function buildSearchDropdownItem(m) {
  return `
    <div class="search-item" data-id="${m.id}" data-media-type="${m.mediaType}" style="display:flex; align-items:center; gap:12px; padding:8px; border-bottom:1px solid #1a233a; cursor:pointer; border-radius:8px; transition:background 0.2s;" onmouseover="this.style.background='#1c263e'" onmouseout="this.style.background='transparent'">
      <img src="${m.posterUrl}" alt="${m.title}" style="width:40px; height:56px; object-fit:cover; border-radius:6px;" />
      <div style="flex:1;">
        <div style="color:#fff; font-weight:bold; font-size:0.95rem;">${m.title}</div>
        <div style="color:#888; font-size:0.8rem; margin-top:3px;">★ ${m.rating} | ${m.year}</div>
      </div>
    </div>
  `;
}

export async function executeFullSearch(q, allMovies, wireCardsCallback) {
  const browse = document.getElementById('browse-section');
  if (!browse) return;

  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(q)}`).then(r => r.json()),
      fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(q)}`).then(r => r.json())
    ]);

    const movieResults = (movieRes.results || []).map(movie => ({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.poster_path ? `${IMAGE_URL}${movie.poster_path}` : '',
      synopsis: movie.overview || 'No synopsis available.',
      year: parseInt(movie.release_date ? movie.release_date.split('-')[0] : '2026'),
      rating: movie.vote_average ? parseFloat(movie.vote_average.toFixed(1)) : 7.0,
      durationMinutes: 120,
      genre: 'Search Result',
      isAdult: movie.adult || false,
      director: 'TMDB Cinema',
      cast: ['Popular Actor'],
      mediaType: 'movie',
      popularity: movie.popularity || 0,
      downloadUrl1080p: `https://vidsrc.to/embed/movie/${movie.id}`,
      downloadUrl720p: `https://vidsrc.to/embed/movie/${movie.id}`
    }));

    const tvResults = (tvRes.results || []).map(tv => ({
      id: tv.id,
      title: tv.name || tv.original_name,
      posterUrl: tv.poster_path ? `${IMAGE_URL}${tv.poster_path}` : '',
      synopsis: tv.overview || 'No synopsis available.',
      year: parseInt(tv.first_air_date ? tv.first_air_date.split('-')[0] : '2026'),
      rating: tv.vote_average ? parseFloat(tv.vote_average.toFixed(1)) : 7.0,
      durationMinutes: 120,
      genre: 'Search Result',
      isAdult: tv.adult || false,
      director: 'TMDB Cinema',
      cast: ['Popular Actor'],
      mediaType: 'tv',
      popularity: tv.popularity || 0,
      downloadUrl1080p: `https://vidsrc.to/embed/tv/${tv.id}`,
      downloadUrl720p: `https://vidsrc.to/embed/tv/${tv.id}`
    }));

    const searchResults = [...movieResults, ...tvResults].sort((a, b) => b.popularity - a.popularity);

    searchResults.forEach(m => {
      if (!allMovies.some(existing => getMediaKey(existing) === getMediaKey(m))) {
        allMovies.push(m);
      }
    });

    if (searchResults.length > 0) {
      const isAgeUnlocked = localStorage.getItem('ageUnlocked') === 'true';
      let html = '';
      if (!isAgeUnlocked) {
        html += `
          <div class="age-unlock-banner">
            <p>⚠️ Some search results may contain adult or sensitive content (+18).</p>
            <button class="btn-unlock-age" onclick="unlockAdultPosters()">Unlock (+18) Posters</button>
          </div>
        `;
      }

      html += `
        <div class="genre-row">
          <h2 class="genre-title">Results for "${q}" (${searchResults.length})</h2>
          <div class="cards-scroll">
            ${searchResults.map(m => buildSearchCard(m, isAgeUnlocked)).join('')}
          </div>
        </div>
      `;

      browse.innerHTML = html;
      if (wireCardsCallback) wireCardsCallback();
    } else {
      browse.innerHTML = `<div class="no-results">No results for "<strong>${q}</strong>"</div>`;
    }
  } catch (err) {
    console.error('Full search error:', err);
  }
}

function buildSearchCard(m, isAgeUnlocked) {
  const sensitiveKeywords = ['sex', 'nude', 'erotic', 'desire', 'passion', 'kill', 'slasher', 'blood', 'gory', 'gore', 'massacre', 'murder'];
  const titleLower = (m.title || '').toLowerCase();
  const hasSensitiveTitle = sensitiveKeywords.some(keyword => titleLower.includes(keyword));
  const isSensitive = m.isAdult || hasSensitiveTitle;

  const adultClass = (isSensitive && !isAgeUnlocked) ? 'adult-content' : '';
  const adultBadge = isSensitive ? `<span class="adult-badge">+18</span>` : '';
  const typeBadge = m.mediaType === 'tv'
    ? `<span style="position:absolute; top:6px; left:6px; background:rgba(0,0,0,0.7); color:#fff; font-size:0.65rem; font-weight:bold; padding:2px 6px; border-radius:4px; z-index:2;">TV</span>`
    : '';

  return `
    <div class="movie-card ${adultClass}" data-id="${m.id}" data-media-type="${m.mediaType}">
      <div class="card-poster">
        ${typeBadge}
        ${adultBadge}
        <img src="${m.posterUrl}" alt="${m.title}" loading="lazy" />
        <div class="card-overlay">
          <button class="btn-play">&#9654;</button>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${m.title}</div>
        <div class="card-meta">
          <span class="rating">★ ${m.rating}</span>
          <span class="year">${m.year}</span>
        </div>
      </div>
    </div>
  `;
}
