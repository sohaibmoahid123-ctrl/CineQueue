const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const TMDB_API_KEY = 'cab1be6caea88ea79b1101c13ddb5702';
const JSON_FILE_PATH = './api/movies/index.json';

// آدرس سایت منبع برای استخراج لینک دانلود
const TARGET_SOURCE_URL = 'https://example-download-source.com/search?q=';

async function searchForMovieLink(title, year) {
  try {
    const searchUrl = `${TARGET_SOURCE_URL}${encodeURIComponent(title + ' ' + year)}`;
    const response = await axios.get(searchUrl, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const $ = cheerio.load(response.data);
    let link720p = '#';
    let link1080p = '#';

    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && (href.endsWith('.mp4') || href.endsWith('.mkv'))) {
        if (href.includes('720p') && link720p === '#') link720p = href;
        if (href.includes('1080p') && link1080p === '#') link1080p = href;
      }
    });

    return { link720p, link1080p };
  } catch (err) {
    return { link720p: '#', link1080p: '#' };
  }
}

async function runAutoScraper() {
  console.log('Starting scraper...');

  try {
    let localData = [];
    if (fs.existsSync(JSON_FILE_PATH)) {
      try {
        localData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
      } catch (e) {
        localData = [];
      }
    }

    // ۵ صفحه از TMDB = ۱۰۰ فیلم در هر بار اجرا
    for (let page = 1; page <= 5; page++) {
      console.log(`Checking TMDB Page ${page}...`);
      const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=${page}`);
      const movies = tmdbRes.data.results;

      for (let movie of movies) {
        // ۱. اگر این فیلم قبلاً در فایل ما ثبت شده، نادیده‌اش بگیر
        const existingIndex = localData.findIndex(m => m.id === movie.id);
        if (existingIndex !== -1) {
          continue; 
        }

        const title = movie.title;
        const year = movie.release_date ? movie.release_date.split('-')[0] : '';

        console.log(`Searching download links for new movie: ${title} (${year})...`);
        const links = await searchForMovieLink(title, year);

        // ۲. اضافه کردن فیلم جدید به آرشیو
        localData.push({
          id: movie.id,
          downloadUrl720p: links.link720p,
          downloadUrl1080p: links.link1080p
        });
      }
    }

    // ذخیره کامل آرشیو بدون پاک شدن داده‌های قبلی
    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(localData, null, 2));
    console.log(`Done! Total movies now in index.json: ${localData.length}`);

  } catch (error) {
    console.error('Error running scraper:', error.message);
  }
}

runAutoScraper();
