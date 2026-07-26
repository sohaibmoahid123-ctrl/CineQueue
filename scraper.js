const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const TMDB_API_KEY = 'YOUR_TMDB_API_KEY_HERE';
const JSON_FILE_PATH = './api/movies/index.json';

const BAD_KEYWORDS = ['trailer', 'teaser', 'sample', 'promo', 'behind the scenes', 'cam', 'hdcam', 'rip-sample'];

function isValidMovieLink(url, linkText, movieTitle, movieYear) {
  const lowerUrl = url.toLowerCase();
  const lowerText = linkText.toLowerCase();

  if (!lowerUrl.endsWith('.mp4') && !lowerUrl.endsWith('.mkv')) {
    return false;
  }

  for (let badWord of BAD_KEYWORDS) {
    if (lowerUrl.includes(badWord) || lowerText.includes(badWord)) {
      return false;
    }
  }

  return true;
}

async function searchForMovieLink(title, year) {
  const targetSources = [
    `https://example-download-source.com/search?q=${encodeURIComponent(title + ' ' + year)}`
  ];

  for (let sourceUrl of targetSources) {
    try {
      const response = await axios.get(sourceUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      const $ = cheerio.load(response.data);
      let foundLink = null;

      $('a').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text();

        if (href && isValidMovieLink(href, text, title, year)) {
          foundLink = href;
          return false;
        }
      });

      if (foundLink) return foundLink;

    } catch (err) {
      console.log(`Source error: ${sourceUrl}`);
    }
  }

  return null;
}

async function runAutoScraper() {
  console.log('Starting scraper...');

  try {
    const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
    const movies = tmdbRes.data.results.slice(0, 10);

    let localData = [];
    if (fs.existsSync(JSON_FILE_PATH)) {
      localData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
    }

    for (let movie of movies) {
      const title = movie.title;
      const year = movie.release_date ? movie.release_date.split('-')[0] : '';

      const exists = localData.some(m => m.id === movie.id && m.downloadLink);
      if (exists) {
        console.log(`Skipping: ${title}`);
        continue;
      }

      console.log(`Searching: ${title} (${year})...`);
      const downloadUrl = await searchForMovieLink(title, year);

      if (downloadUrl) {
        const movieIndex = localData.findIndex(m => m.id === movie.id);
        const movieObject = {
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path,
          release_date: movie.release_date,
          downloadLink: downloadUrl
        };

        if (movieIndex !== -1) {
          localData[movieIndex] = movieObject;
        } else {
          localData.push(movieObject);
        }

        console.log(`Saved link: ${title}`);
      }
    }

    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(localData, null, 2));
    console.log('Update finished!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

runAutoScraper();
