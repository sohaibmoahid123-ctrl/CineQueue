const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawQuery = req.query.url;
  if (!rawQuery) {
    return res.status(400).json({ error: 'Movie title or URL is required' });
  }

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://moviesmods.best/'
  };

  const fetchWithTimeout = (url, options = {}, timeout = 10000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
    ]);
  };

  try {
    let targetPageUrl = rawQuery;

    if (!rawQuery.startsWith('http')) {
      // ۱. آماده‌سازی عبارات سرچ متوالی (Fallback Terms)
      const fullTitle = rawQuery.split('(')[0].trim(); // مثلا Evil Dead Burn 2026
      const titleWithoutYear = fullTitle.replace(/\b(19|20)\d{2}\b/g, '').trim(); // مثلا Evil Dead Burn
      const mainKeyword = titleWithoutYear.split(' ')[0]; // کلمه اول، مثلا Evil

      const searchTerms = [fullTitle, titleWithoutYear, mainKeyword].filter(Boolean);
      let matchedLink = null;

      // ۲. تست سرچ‌ها به ترتیب تا پیدا شدن نتیجه
      for (const term of searchTerms) {
        if (matchedLink) break;

        const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(term)}`;
        try {
          const searchRes = await fetchWithTimeout(searchUrl, { headers: browserHeaders });
          if (!searchRes.ok) continue;

          const searchHtml = await searchRes.text();
          const $search = cheerio.load(searchHtml);

          $search('article, .post-item, h2.entry-title, h3.entry-title').each((i, el) => {
            const link = $(el).find('a').first().attr('href');
            const cardText = $(el).text().toLowerCase();

            // چک کردن اینکه آیا کارت مربوط به کلمه کلیدی ماست یا صفحه اصلی
            if (link && link.includes('moviesmods.best') && !link.endsWith('moviesmods.best/')) {
              const termWords = titleWithoutYear.toLowerCase().split(' ');
              const matchesWord = termWords.some(w => w.length > 2 && cardText.includes(w));

              if (matchesWord) {
                matchedLink = link;
                return false;
              }
            }
          });
        } catch (e) {
          // ادامه به عبارت بعدی در صورت تایم‌اوت
        }
      }

      if (!matchedLink) {
        return res.status(200).json({ 
          success: false, 
          stage: 'NOT_FOUND',
          message: `No available links found for "${fullTitle}".` 
        });
      }

      targetPageUrl = matchedLink;
    }

    // ۳. باز کردن صفحه پست نهایی و استخراج لینک‌ها
    const pageRes = await fetchWithTimeout(targetPageUrl, { headers: browserHeaders });
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    $('a[href^="http"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      const isExternal = href && !href.includes('moviesmods.best') && !href.includes('telegram') && !href.includes('t.me');
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
      error: error.message || 'Server error' 
    });
  }
};
