const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawQuery = req.query.url;
  if (!rawQuery) {
    return res.status(400).json({ error: 'Movie title or URL is required' });
  }

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://moviesmods.best/'
  };

  const fetchWithTimeout = (url, options = {}, timeout = 12000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request Timeout')), timeout)
      )
    ]);
  };

  try {
    let targetPageUrl = rawQuery;

    if (!rawQuery.startsWith('http')) {
      const cleanTitle = rawQuery.split('(')[0].trim();
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(cleanTitle)}`;
      
      const searchRes = await fetchWithTimeout(searchUrl, { headers: browserHeaders });
      
      if (!searchRes.ok) {
        return res.status(200).json({ 
          success: false, 
          stage: 'SEARCH_FAILED',
          message: `Search server responded with status: ${searchRes.status}` 
        });
      }
      
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      let matchedLink = null;

      // دریافت لینک مستقیم پست از کارت‌های نتیجه جستجو
      $search('article, .post-item, h2.entry-title, h3.entry-title').each((i, el) => {
        const link = $(el).find('a').first().attr('href');
        if (link && link.includes('moviesmods.best') && !link.endsWith('moviesmods.best/')) {
          matchedLink = link;
          return false;
        }
      });

      if (!matchedLink) {
        matchedLink = $search('.entry-title a').first().attr('href');
      }

      if (!matchedLink) {
        return res.status(200).json({ 
          success: false, 
          stage: 'NOT_FOUND',
          message: `No results found for "${cleanTitle}".` 
        });
      }

      targetPageUrl = matchedLink;
    }

    const pageRes = await fetchWithTimeout(targetPageUrl, { headers: browserHeaders });
    if (!pageRes.ok) {
      return res.status(200).json({
        success: false,
        stage: 'PAGE_FETCH_FAILED',
        message: `Failed to load movie page: ${pageRes.status}`
      });
    }

    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    $('a[href^="http"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      const isExternalDownload = href && 
        !href.includes('moviesmods.best') && 
        !href.includes('telegram') && 
        !href.includes('t.me');

      const isDownloadText = text.toUpperCase().includes('CLICK HERE TO DOWNLOAD') || 
                             text.toUpperCase().includes('DOWNLOAD');

      if (isExternalDownload && isDownloadText) {
        let qualityLabel = $(el).parent().prev().text().trim() || 
                           $(el).closest('p').prev('p').text().trim() || 
                           $(el).prev().text().trim();

        if (!qualityLabel || qualityLabel.length > 40) {
          qualityLabel = `Quality Option ${downloadOptions.length + 1}`;
        }

        const sizeMatch = text.match(/\[(.*?)\]/);
        const sizeText = sizeMatch ? ` [${sizeMatch[1]}]` : '';

        const isDuplicate = downloadOptions.some(opt => opt.link === href);
        if (!isDuplicate) {
          downloadOptions.push({
            id: downloadOptions.length + 1,
            label: `${qualityLabel}${sizeText}`,
            link: href
          });
        }
      }
    });

    return res.status(200).json({ 
      success: downloadOptions.length > 0,
      targetUrl: targetPageUrl,
      totalOptions: downloadOptions.length,
      options: downloadOptions 
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Internal Server Error'
    });
  }
};
