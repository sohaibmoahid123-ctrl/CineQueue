// ============================================================
// CineQueue — cards.js
// ============================================================

export function buildCard(movie) {
  return `
    <div class="movie-card" data-id="${movie.id}" tabindex="0" role="button" aria-label="${movie.title}">
      <img src="${movie.posterUrl}" alt="${movie.title}" loading="lazy">
      <div class="card-overlay">
        <div class="card-title">${movie.title}</div>
        <div class="card-meta">
          <span class="rating-badge">${movie.rating}</span>
          <span>${movie.year}</span>
          <span>${movie.durationMinutes} min</span>
        </div>
      </div>
    </div>`;
}

export function buildGenreRow(genre, allMovies) {
  const movies = allMovies.filter(m => m.genre === genre);
  return `
    <div class="genre-row">
      <h2 class="genre-title">${genre}</h2>
      <div class="cards-scroll">
        ${movies.map(buildCard).join('')}
      </div>
    </div>`;
}

export function wireCards() {
  document.querySelectorAll('.movie-card').forEach(card => {
    card.onclick = function (e) {
      if (this.classList.contains('adult-content')) {
        e.preventDefault();
        e.stopPropagation();
        alert('Please unlock (+18) posters first by confirming your age.');
        return;
      }

      const id = this.getAttribute('data-id');
      if (id) {
        window.openMovie(id);
      }
    };
  });
}

window.openMovie = function(id) {
  window.location.hash = 'movie/' + id;
};
