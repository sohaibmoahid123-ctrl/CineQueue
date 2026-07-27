const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const TMDB_API_KEY = 'cab1be6caea88ea79b1101c13ddb5702';
const JSON_FILE_PATH = './api/movies/index.json';

// آدرس بخش جستجوی اختصاصی PSA
const TARGET_SOURCE_URL = 'https://psa.wf/?s='; 

async function searchPSA(title, year) {
  try {
    // سرچ اسم فیلم در PSA
    const searchUrl = `${TARGET_SOURCE_URL}${encodeURIComponent(title + ' ' + year)}`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' 
      }
    });

    const $ = cheerio.load(response.data);
    let moviePageUrl = '#';

    // پیدا کردن اولین پست مربوط به فیلم
    $('article h2.post-title a, article h1.post-title a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && moviePageUrl === '#') {
        moviePageUrl = href;
      }
    });

    // اگر پستی پیدا شد، وارد صفحه پست می‌شویم تا لینک‌ها را بخوانیم
    if (moviePageUrl !== '#') {
      const pageRes = await axios.get(moviePageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const $page = cheerio.load(pageRes.data);
      
      let link720p = '#';
      let link1080p = '#';

      // استخراج لینک‌های دانلود بر اساس کیفیت از داخل پست
      $page('a').each((i, el) => {
        const text = $page(el).text().toLowerCase();
        const href = $page(el).attr('href');

        if (href && href.startsWith('http')) {
          if ((text.includes('720p') || href.includes('720p')) && link720p === '#') {
            link720p = href;
          }
          if ((text.includes('1080p') || href.includes('1080p')) && link1080p === '#') {
            link1080p = href;
          }
        }
      });

      return { link720p, link1080p };
    }

    return { link720p: '#', link1080p: '#' };
  } catch (err) {
    return { link720p: '#', link1080p: '#' };
  }
}

async function runAutoScraper() {
  console.log('Starting PSA Scraper...');

  try {
    let localData = [];
    if (fs.existsSync(JSON_FILE_PATH)) {
      try {
        localData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
      } catch (e) {
        localData = [];
      }
    }

    // گرفتن ۵ صفحه اول محبوب‌ترین‌های TMDB
    for (let page = 1; page <= 5; page++) {
      console.log(`Checking TMDB Page ${page}...`);
      const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=${page}`);
      const movies = tmdbRes.data.results;

      for (let movie of movies) {
        const existingIndex = localData.findIndex(m => m.id === movie.id);
        if (existingIndex !== -1) {
          continue; 
        }

        const title = movie.title;
        const year = movie.release_date ? movie.release_date.split('-')[0] : '';

        console.log(`Searching PSA for: ${title} (${year})...`);
        const links = await searchPSA(title, year);

        localData.push({
          id: movie.id,
          downloadUrl720p: links.link720p,
          downloadUrl1080p: links.link1080p
        });
      }
    }

    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(localData, null, 2));
    console.log(`Done! Total movies updated in index.json: ${localData.length}`);

  } catch (error) {
    console.error('Error running scraper:', error.message);
  }
}

runAutoScraper();
