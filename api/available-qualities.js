const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawQuery = req.query.url;
  if (!rawQuery) return res.status(400).json({ error: 'Movie title is required' });

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  };

  try {
    let targetPageUrl = rawQuery;

    if (!rawQuery.startsWith('http')) {
      const cleanTitle = rawQuery.split('(')[0].trim();
      
      // جستجوی لینک دقیق پست در گوگل/داک‌داک‌گو بجای سرچ داخلی سایت
      const searchEngineUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:moviesmods.best ${cleanTitle}`)}`;
      
      const searchRes = await fetch(searchEngineUrl, { headers: customHeaders });
      const searchHtml = await searchRes.text();
      const $ddg = cheerio.load(searchHtml);

      let foundLink = null;
      $ddg('a.result__url').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('moviesmods.best')) {
          // استخراج لینک واقعی از ریدایرکت داک‌داک‌گو
          const match = href.match(/uddg=(https?%3A%2F%2F[^&]+)/);
          if (match) {
            foundLink = decodeURIComponent(match[1]);
            return false;
          }
        }
      });

      if (!foundLink) {
        return res.status(200).json({
          success: false,
          stage: 'NOT_INDEXED',
          message: `فیلم "${cleanTitle}" در ایندکس سایت پیدا نشد.`
        });
      }

      targetPageUrl = foundLink;
    }

    // باز کردن مستقیم صفحه فیلم
    const pageRes = await fetch(targetPageUrl, { headers: customHeaders });
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    $('a[href^="http"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      const isExternal = href && !href.includes('moviesmods.best') && !href.includes('telegram');
      const isDownloadBtn = text.toUpperCase().includes('CLICK HERE TO DOWNLOAD') || text.toUpperCase().includes('DOWNLOAD');

      if (isExternal && isDownloadBtn) {
        let qualityLabel = $(el).parent().prev().text().trim() || $(el).closest('p').prev('p').text().trim();
        if (!qualityLabel || qualityLabel.length > 40) qualityLabel = `Option ${downloadOptions.length + 1}`;

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
      options: downloadOptions
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
