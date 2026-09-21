// ============================================================
// CineQueue - Sports section
// ============================================================
import { buildHeader } from './utils.js';

let matches = [];

async function loadLiveMatches() {
  try {
    const response = await fetch('/api/sports', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Sports feed returned ${response.status}`);
    const data = await response.json();
    if (data.success && Array.isArray(data.matches) && data.matches.length) {
      matches = data.matches;
      return true;
    }
  } catch (error) {
    console.warn('Live sports feed unavailable.', error);
  }
  return false;
}

const sportCategories = [
  { key: 'all', label: 'All Sports', icon: '◈' },
  { key: 'Football', label: 'Football', icon: '⚽' },
  { key: 'Basketball', label: 'Basketball', icon: '◉' },
  { key: 'Tennis', label: 'Tennis', icon: '●' },
  { key: 'Motorsport', label: 'Motorsports', icon: '◒' }
];

const statusFilters = [
  { key: 'all', label: 'All Matches' },
  { key: 'live', label: 'LIVE NOW' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' }
];

function getMatches(sport, status, query) {
  const normalizedQuery = query.trim().toLowerCase();
  return matches.filter(match => {
    const matchesSport = sport === 'all' || match.sport === sport;
    const matchesStatus = status === 'all'
      || (status === 'live' && match.status === 'LIVE')
      || (status === 'today' && match.status === 'SCHEDULED' && match.day === 'today')
      || (status === 'upcoming' && match.status === 'SCHEDULED' && ['today', 'upcoming'].includes(match.day));
    const matchesSearch = !normalizedQuery || `${match.home} ${match.away} ${match.league} ${match.sport}`.toLowerCase().includes(normalizedQuery);
    return matchesSport && matchesStatus && matchesSearch;
  });
}

function groupByLeague(items) {
  return items.reduce((groups, match) => {
    (groups[match.league] ||= []).push(match);
    return groups;
  }, {});
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
        <span>${match.streamAvailable ? 'Watch stream' : match.time}</span>
      </div>
    </article>
  `;
}

function openSportsPlayer(match) {
  const existing = document.getElementById('sports-player-modal');
  if (existing) existing.remove();

  const hasLiveStream = match.status === 'LIVE' && typeof match.embedUrl === 'string' && match.embedUrl.trim();
  const playerMarkup = hasLiveStream
    ? `<iframe src="${match.embedUrl}" title="${match.home} versus ${match.away}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`
    : `<div class="sports-player-empty"><strong>Live stream is currently offline for this match</strong><span>${match.status === 'LIVE' ? 'The live source is not available right now.' : `This match is ${String(match.status).toLowerCase()}.`}</span></div>`;

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
      const match = matches.find(item => String(item.id) === String(card.dataset.matchId));
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
  let activeSport = 'all';
  let activeStatus = 'all';
  let searchQuery = '';

  const render = () => {
    const visibleMatches = getMatches(activeSport, activeStatus, searchQuery);
    const popularMatches = matches.filter(match => match.popular).slice(0, 4);
    const leagueGroups = groupByLeague(visibleMatches);
    app.innerHTML = `
      ${buildHeader()}
      <main class="sports-page">
        <section class="sports-hero">
          <span class="sports-kicker">CineQueue Sports</span>
          <h1>Live moments. One place.</h1>
          <p>Follow the matches worth watching, from kickoff to the final whistle.</p>
        </section>
        <section class="sports-content" aria-label="Sports matches">
          <section class="sports-popular" aria-label="Popular matches">
            <div class="sports-section-heading"><div><span class="sports-kicker">Top picks</span><h2>Popular matches</h2></div><span class="sports-count">${popularMatches.length} featured</span></div>
            <div class="sports-feature-grid">${popularMatches.map(matchCard).join('')}</div>
          </section>
          <div class="sports-toolbar">
            <div><span class="sports-kicker">Match centre</span><h2>Find a match</h2></div>
            <label class="sports-search"><span>Search sports</span><input id="sports-search-input" type="search" value="${searchQuery}" placeholder="Search teams or leagues" /></label>
          </div>
          <div class="sports-category-row" role="tablist" aria-label="Sports categories">
            ${sportCategories.map(category => `<button class="sports-category ${activeSport === category.key ? 'active' : ''}" data-sport="${category.key}" role="tab" aria-selected="${activeSport === category.key}"><span>${category.icon}</span>${category.label}</button>`).join('')}
          </div>
          <div class="sports-filters" role="tablist" aria-label="Match status filters">
            ${statusFilters.map(filter => `<button class="sports-filter ${activeStatus === filter.key ? 'active' : ''}" data-status="${filter.key}" role="tab" aria-selected="${activeStatus === filter.key}">${filter.label}</button>`).join('')}
          </div>
          <div class="sports-league-groups">
            ${Object.keys(leagueGroups).length ? Object.entries(leagueGroups).map(([league, leagueMatches]) => `
              <section class="sports-league-group"><div class="sports-section-heading"><h3>${league}</h3><span class="sports-count">${leagueMatches.length} match${leagueMatches.length === 1 ? '' : 'es'}</span></div><div class="sports-match-grid">${leagueMatches.map(matchCard).join('')}</div></section>
            `).join('') : '<p class="sports-empty">No matches match those filters.</p>'}
          </div>
        </section>
      </main>
    `;

    document.querySelectorAll('.sports-category').forEach(button => {
      button.addEventListener('click', () => {
        activeSport = button.dataset.sport;
        render();
      });
    });
    document.querySelectorAll('.sports-filter').forEach(button => {
      button.addEventListener('click', () => {
        activeStatus = button.dataset.status;
        render();
      });
    });
    document.getElementById('sports-search-input')?.addEventListener('input', event => {
      searchQuery = event.target.value;
      render();
      const input = document.getElementById('sports-search-input');
      input?.focus();
      input?.setSelectionRange(searchQuery.length, searchQuery.length);
    });
    wireSportsCards();
  };

  render();
  loadLiveMatches().then(updated => {
    if (updated) render();
  });
}
