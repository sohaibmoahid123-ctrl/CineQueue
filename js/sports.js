// ============================================================
// CineQueue - Sports section
// ============================================================
import { buildHeader } from './utils.js';

const matches = [
  {
    id: 'premier-league-arsenal-chelsea',
    league: 'Premier League',
    sport: 'Football',
    home: 'Arsenal',
    away: 'Chelsea',
    homeMark: 'ARS',
    awayMark: 'CHE',
    status: 'Live',
    time: '62\'',
    accent: '#e50914',
    embedUrl: ''
  },
  {
    id: 'nba-lakers-celtics',
    league: 'NBA',
    sport: 'Basketball',
    home: 'Los Angeles Lakers',
    away: 'Boston Celtics',
    homeMark: 'LAL',
    awayMark: 'BOS',
    status: 'Scheduled',
    time: '19:30',
    accent: '#f59e0b',
    embedUrl: ''
  },
  {
    id: 'formula-1-singapore',
    league: 'Formula 1',
    sport: 'Motorsport',
    home: 'Singapore Grand Prix',
    away: 'Race Weekend',
    homeMark: 'F1',
    awayMark: 'GP',
    status: 'Scheduled',
    time: 'Sun 14:00',
    accent: '#2a9d8f',
    embedUrl: ''
  },
  {
    id: 'champions-league-madrid-inter',
    league: 'Champions League',
    sport: 'Football',
    home: 'Real Madrid',
    away: 'Inter Milan',
    homeMark: 'RMA',
    awayMark: 'INT',
    status: 'Live',
    time: '38\'',
    accent: '#3b82f6',
    embedUrl: ''
  }
];

const filters = [
  { key: 'all', label: 'All Sports' },
  { key: 'live', label: 'Live Matches' },
  { key: 'popular', label: 'Popular' }
];

function getMatches(filter) {
  if (filter === 'live') return matches.filter(match => match.status === 'Live');
  if (filter === 'popular') return matches.filter(match => ['Premier League', 'NBA', 'Champions League'].includes(match.league));
  return matches;
}

function matchCard(match) {
  const statusClass = match.status.toLowerCase();
  return `
    <article class="sports-match-card" data-match-id="${match.id}" tabindex="0" role="button" aria-label="Open ${match.home} versus ${match.away}">
      <div class="sports-card-topline">
        <span class="sports-league">${match.league}</span>
        <span class="sports-status ${statusClass}"><span></span>${match.status}</span>
      </div>
      <div class="sports-teams">
        <div class="sports-team">
          <span class="sports-team-mark" style="--team-accent: ${match.accent}">${match.homeMark}</span>
          <strong>${match.home}</strong>
        </div>
        <span class="sports-versus">VS</span>
        <div class="sports-team">
          <span class="sports-team-mark" style="--team-accent: ${match.accent}">${match.awayMark}</span>
          <strong>${match.away}</strong>
        </div>
      </div>
      <div class="sports-card-footer">
        <span>${match.sport}</span>
        <span>${match.time}</span>
      </div>
    </article>
  `;
}

function openSportsPlayer(match) {
  const existing = document.getElementById('sports-player-modal');
  if (existing) existing.remove();

  const playerMarkup = match.embedUrl
    ? `<iframe src="${match.embedUrl}" title="${match.home} versus ${match.away}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`
    : `<div class="sports-player-empty"><strong>Stream unavailable</strong><span>A live stream has not been configured for this match.</span></div>`;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="sports-player-modal" class="sports-player-modal" role="dialog" aria-modal="true" aria-label="${match.home} versus ${match.away}">
      <div class="sports-player-backdrop" data-close-sports-player></div>
      <div class="sports-player-dialog">
        <div class="sports-player-header">
          <div><span class="sports-kicker">${match.league}</span><h2>${match.home} <span>vs</span> ${match.away}</h2></div>
          <button class="sports-player-close" type="button" aria-label="Close player" data-close-sports-player>&times;</button>
        </div>
        <div class="sports-player-frame">${playerMarkup}</div>
      </div>
    </div>
  `);

  document.querySelectorAll('[data-close-sports-player]').forEach(element => {
    element.addEventListener('click', () => document.getElementById('sports-player-modal')?.remove());
  });
}

function wireSportsCards() {
  document.querySelectorAll('.sports-match-card').forEach(card => {
    const open = () => {
      const match = matches.find(item => item.id === card.dataset.matchId);
      if (match) openSportsPlayer(match);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

export function renderSports() {
  const app = document.getElementById('app');
  let activeFilter = 'all';

  const render = () => {
    const visibleMatches = getMatches(activeFilter);
    app.innerHTML = `
      ${buildHeader()}
      <main class="sports-page">
        <section class="sports-hero">
          <span class="sports-kicker">CineQueue Sports</span>
          <h1>Live moments. One place.</h1>
          <p>Follow the matches worth watching, from kickoff to the final whistle.</p>
        </section>
        <section class="sports-content" aria-label="Sports matches">
          <div class="sports-toolbar">
            <div><span class="sports-kicker">Match centre</span><h2>Today's fixtures</h2></div>
            <div class="sports-filters" role="tablist" aria-label="Match filters">
              ${filters.map(filter => `<button class="sports-filter ${activeFilter === filter.key ? 'active' : ''}" data-filter="${filter.key}" role="tab" aria-selected="${activeFilter === filter.key}">${filter.label}</button>`).join('')}
            </div>
          </div>
          <div class="sports-match-grid">
            ${visibleMatches.length ? visibleMatches.map(matchCard).join('') : '<p class="sports-empty">No matches in this view.</p>'}
          </div>
        </section>
      </main>
    `;

    document.querySelectorAll('.sports-filter').forEach(button => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.filter;
        render();
      });
    });
    wireSportsCards();
  };

  render();
}
