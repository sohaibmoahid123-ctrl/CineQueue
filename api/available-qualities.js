const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawQuery = req.query.url;
  if (!rawQuery) {
    return res.status(400).json({ error: 'Movie title is required' });
  }

  const fetchWithProxy = async (targetUrl) => {
    // استفاده از پروکسی برای دور زدن محدودیت IP ورسل
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    return await response.text();
  };

  try {
    let targetPageUrl = rawQuery;

    if (!rawQuery.startsWith('http')) {
      const cleanTitle = rawQuery.split('(')[0].trim();
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(cleanTitle)}`;
      
      // دریافت HTML سرچ از طریق پروکسی
      const searchHtml = await fetchWithProxy(searchUrl);
      const $search = cheerio.load(searchHtml);
      
      let matchedLink = null;

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

    // دریافت HTML صفحه فیلم از طریق پروکسی
    const pageHtml = await fetchWithProxy(targetPageUrl);
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    $('a[href^="http"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      const isExternal = href && !href.includes('moviesmods.best') && !href.includes('telegram');
      const isDownloadBtn = text.toUpperCase().includes('CLICK HERE TO DOWNLOAD') || text.toUpperCase().includes('DOWNLOAD');

      if (isExternal && isDownloadBtn) {
        let qualityLabel = $(el).parent().prev().text().trim() || 
                           $(el).closest('p').prev('p').text().trim() || 
                           $(el).prev().text().trim();

        if (!qualityLabel || qualityLabel.length > 40) {
          qualityLabel = `Quality Option ${downloadOptions.length + 1}`;
        }

        const sizeMatch = text.match(/\[(.*?)\]/);
        const sizeText = sizeMatch ? ` [${sizeMatch[1]}]` : '';

        if (!downloadOptions.some(opt => opt.link === href)) {
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
      error: error.message 
    });
  }
};

