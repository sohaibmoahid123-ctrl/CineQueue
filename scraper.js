const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const TMDB_API_KEY = 'cab1be6caea88ea79b1101c13ddb5702';
const JSON_FILE_PATH = './api/movies/index.json';

// آدرس منبع جستجوی مستقیم فایل‌های ویدئویی mp4
const TARGET_SOURCE_URL = 'https://auto-embed.org/api/search?q='; 

async function searchForDirectDownloadLink(title, year) {
  try {
    const searchUrl = `${TARGET_SOURCE_URL}${encodeURIComponent(title + ' ' + year)}`;
    const response = await axios.get(searchUrl, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const $ = cheerio.load(response.data);
    let link720p = '#';
    let link1080p = '#';

    // استخراج و قاپ زدن فقط لینک‌های مستقیم فایل MP4/MKV
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
  console.log('Starting movie link scraper...');

  try {
    let localData = [];
    if (fs.existsSync(JSON_FILE_PATH)) {
      try {
        localData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
      } catch (e) {
        localData = [];
      }
    }

    // دریافت ۵ صفحه از TMDB (۱۰۰ فیلم)
    for (let page = 1; page <= 5; page++) {
      console.log(`Checking TMDB Page ${page}...`);
      const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=${page}`);
      const movies = tmdbRes.data.results;

      for (let movie of movies) {
        // جلوگیری از ثبت تکراری
        const existingIndex = localData.findIndex(m => m.id === movie.id);
        if (existingIndex !== -1) {
          continue; 
        }

        const title = movie.title;
        const year = movie.release_date ? movie.release_date.split('-')[0] : '';

        console.log(`Scraping direct download links for: ${title} (${year})...`);
        const links = await searchForDirectDownloadLink(title, year);

        // فقط ذخیره ID و لینک‌های دانلود (بدون مشخصات اضافی)
        localData.push({
          id: movie.id,
          downloadUrl720p: links.link720p,
          downloadUrl1080p: links.link1080p
        });
      }
    }

    // ذخیره در فایل index.json
    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(localData, null, 2));
    console.log(`Successfully updated index.json! Total movies in archive: ${localData.length}`);

  } catch (error) {
    console.error('Error running scraper:', error.message);
  }
}

runAutoScraper();
