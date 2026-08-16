const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://moviesmods.best/'
  };

  try {
    // ۱. باز کردن مستقیم صفحه اصلی یا لینک ورودی
    const targetUrl = req.query.url && req.query.url.startsWith('http') 
      ? req.query.url 
      : 'https://moviesmods.best/';

    const homeRes = await fetch(targetUrl, { headers: customHeaders });
    const homeHtml = await homeRes.text();
    const $home = cheerio.load(homeHtml);

    // ۲. استخراج لینک اولین فیلم موجود در صفحه
    let moviePageUrl = targetUrl;
    if (!req.query.url || !req.query.url.startsWith('http')) {
      const firstCardLink = $home('article a, .post-item a, h2.entry-title a, h3.entry-title a').first().attr('href');
      if (firstCardLink) {
        moviePageUrl = firstCardLink;
      }
    }

    // ۳. باز کردن صفحه خودِ فیلم
    const pageRes = await fetch(moviePageUrl, { headers: customHeaders });
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    // ۴. استخراج دکمه‌های دانلود CLICK HERE TO DOWNLOAD
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
      targetUrl: moviePageUrl,
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
