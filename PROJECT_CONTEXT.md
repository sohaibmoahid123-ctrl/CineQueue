# CineQueue - Project Context (for AI)

## Project Overview
CineQueue is a Vanilla JavaScript movie & TV streaming website (no React, no Next.js, no framework).
- Live site: https://movie-stream-dist-2.vercel.app
- Hosted on Vercel
- Uses TMDB API for movie/TV data
- Hash-based routing (#movie/movie/123, #movie/tv/456, #sports, #tv)
- Main entry: index.html → loads app.js

## Folder Structure
CineQueue/
├── index.html              → Main HTML (just a <div id="app">)
├── app.js                  → Main logic, routing, fetching data from TMDB
├── style.css               → All styles
├── package.json            → Only axios + cheerio
├── vercel.json             → Rewrites & headers
├── js/                     → All modular JS files
│   ├── config.js           → API_KEY, BASE_URL, IMAGE_URL, YTS_API_URL
│   ├── cards.js            → buildCard() + wireCards()
│   ├── details.js          → renderMovieDetail() (movie & TV detail page)
│   ├── hero.js             → Homepage hero slider
│   ├── search.js           → Search functionality
│   ├── tv.js + tv-shows.js → TV series seasons/episodes
│   ├── sports.js           → Sports section
│   ├── yts.js              → YTS download links
│   ├── moviesmod.js        → MoviesMod download page
│   ├── decryptor.js        → Server 2 download logic
│   ├── utils.js            → buildHeader() + buildFooter()
│   └── catalog.js          → setCatalog()
├── api/                    → Vercel serverless functions (scraping & proxies)
└── movies/ + attached_assets/

## Important Data Structure (Movie Object)
Every movie/TV item has this shape:
{
  id: number,
  title: string,
  posterUrl: string,
  backdrop_path: string | null,
  synopsis: string,
  year: number,
  releaseDate: string | null,   // full date "YYYY-MM-DD" (important!)
  rating: number,
  durationMinutes: number,
  genre: string,
  director: string,
  cast: Array,
  mediaType: "movie" | "tv",
  downloadUrl1080p: string,
  downloadUrl720p: string
}

## Key Files & Responsibilities
- app.js            → Fetches TMDB data, builds allMovies, routing, homepage
- js/cards.js       → Renders movie cards
- js/details.js     → Full movie/TV detail page + downloads
- js/hero.js        → Hero banner on homepage
- js/config.js      → All API keys and base URLs
- style.css         → Complete styling

## Current Features
- Homepage with Trending / Popular / Top Rated + Genre rows
- Movie & TV detail pages
- Search
- Download system (MoviesMod + Server 2 + YTS)
- TV seasons & episodes selector
- Sports section
- Hash routing

## Coding Rules (very important)
1. Do not rewrite whole files unless necessary.
2. Prefer small, precise edits.
3. Always keep existing functionality working.
4. Use the existing style and design system (colors, classes, fonts).
5. When adding new features related to upcoming movies, use the releaseDate field.
6. Do not introduce React, Vue, or any framework.
7. Keep everything in Vanilla JS + ES Modules.

## Design System
- Background: #0b0d1a
- Accent color: #f59e0b (orange)
- Card background: #13162a
- Font: Outfit + DM Sans
- Border radius: 10px / 16px

---

After creating the PROJECT_CONTEXT.md file, implement the following feature carefully:

### Feature: Coming Soon + Circular Countdown Timer

For movies that have not been released yet (release date is in the future):

1. Show a red badge with the text "Coming Soon" on the movie cards.
2. On the movie detail page, show a beautiful circular countdown timer that counts down the days, hours, minutes and seconds until the movie's release date.
3. If the release date has already passed, do not show the badge or timer.

### Exact changes needed:

#### 1. In app.js
Inside the buildItem function, add the full release date.

Find this line:
year: parseInt((item.release_date || item.first_air_date || '2026').toString().split('-')[0]),

And change it to:
year: parseInt((item.release_date || item.first_air_date || '2026').toString().split('-')[0]),
releaseDate: item.release_date || item.first_air_date || null,

#### 2. In js/cards.js
Replace the entire buildCard function with this:

export function buildCard(movie) {
  const isUpcoming = movie.releaseDate && new Date(movie.releaseDate) > new Date();
  
  return `
    <div class="movie-card fade-in-up ${isUpcoming ? 'upcoming' : ''}" data-id="${movie.id}" data-media-type="${movie.mediaType || 'movie'}" tabindex="0" role="button" aria-label="${movie.title}">
      <img src="${movie.posterUrl}" alt="${movie.title}" loading="lazy">
      ${isUpcoming ? `<div class="coming-soon-badge">Coming Soon</div>` : ''}
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

#### 3. In style.css
Add these styles at the end of the file:

/* Coming Soon Badge */
.coming-soon-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: #e50914;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  z-index: 5;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(229, 9, 20, 0.4);
}

.movie-card.upcoming img {
  filter: brightness(0.75);
}

/* Circular Countdown Timer */
.countdown-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 24px 0;
  gap: 12px;
}

.countdown-label {
  font-size: 0.95rem;
  color: #f59e0b;
  font-weight: 600;
  letter-spacing: 1px;
}

.circular-timer {
  position: relative;
  width: 160px;
  height: 160px;
}

.circular-timer svg {
  transform: rotate(-90deg);
  width: 160px;
  height: 160px;
}

.circular-timer circle {
  fill: none;
  stroke-width: 8;
}

.circular-timer .bg {
  stroke: #232d45;
}

.circular-timer .progress {
  stroke: #f59e0b;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}

.timer-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  font-family: 'Outfit', sans-serif;
}

.timer-days {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}

.timer-label {
  font-size: 0.75rem;
  color: #8b90a8;
  margin-top: 4px;
}

.timer-hms {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 0.85rem;
  color: #c0c4d8;
}

#### 4. In js/details.js
Inside the renderMovieDetail function, right after this line:
<p class="detail-synopsis">${movie.synopsis}</p>

Add this code:

${(() => {
  const isUpcoming = movie.releaseDate && new Date(movie.releaseDate) > new Date();
  if (!isUpcoming) return '';

  return `
    <div class="countdown-container" id="countdown-box">
      <div class="countdown-label">COMING SOON</div>
      <div class="circular-timer">
        <svg viewBox="0 0 160 160">
          <circle class="bg" cx="80" cy="80" r="70"></circle>
          <circle class="progress" id="countdown-progress" cx="80" cy="80" r="70"
            stroke-dasharray="440" stroke-dashoffset="440"></circle>
        </svg>
        <div class="timer-text">
          <div class="timer-days" id="cd-days">--</div>
          <div class="timer-label">DAYS LEFT</div>
        </div>
      </div>
      <div class="timer-hms">
        <span id="cd-hours">00</span>h
        <span id="cd-mins">00</span>m
        <span id="cd-secs">00</span>s
      </div>
    </div>
  `;
})()}

And at the end of the renderMovieDetail function (before the final closing }), add this JavaScript logic:

// Countdown Timer Logic
if (movie.releaseDate && new Date(movie.releaseDate) > new Date()) {
  const targetDate = new Date(movie.releaseDate).getTime();
  const progressCircle = document.getElementById('countdown-progress');
  const totalDaysEstimate = 365;

  const updateCountdown = () => {
    const now = new Date().getTime();
    const distance = targetDate - now;

    if (distance < 0) {
      const box = document.getElementById('countdown-box');
      if (box) box.innerHTML = `<div class="countdown-label" style="color:#22c55e">NOW AVAILABLE</div>`;
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((distance % (1000 * 60)) / 1000);

    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minsEl = document.getElementById('cd-mins');
    const secsEl = document.getElementById('cd-secs');

    if (daysEl) daysEl.textContent = days;
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minsEl) minsEl.textContent = String(mins).padStart(2, '0');
    if (secsEl) secsEl.textContent = String(secs).padStart(2, '0');

    const progress = Math.min(days / totalDaysEstimate, 1);
    const offset = 440 - (progress * 440);
    if (progressCircle) progressCircle.style.strokeDashoffset = offset;
  };

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

### Important Rules:
- Do not change or remove any existing working features.
- Do not rewrite whole files. Only make the exact changes mentioned above.
- Keep the code clean and compatible with the current project structure.
- After making the changes, make sure everything still works.

Please do both things now:
1. Create the PROJECT_CONTEXT.md file
2. Implement the Coming Soon + Countdown feature