const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const rawQuery = req.query.url;

  if (!rawQuery) {
    return res.status(400).json({ error: 'Movie query is required' });
  }

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://moviesmods.best/'
  };

  try {
    let targetPageUrl = rawQuery;

    if (!rawQuery.startsWith('http')) {
      // استفاده مستقیم از عبارت جستجو بدون دستکاری حروف/اعداد
      const cleanTitle = rawQuery.split('(')[0].trim();
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(cleanTitle)}`;
      
      const searchRes = await fetch(searchUrl, { headers: customHeaders });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      let matchedLink = null;

      // انتخاب اولین کارت نتیجه جستجو
      $search('article, .post-item, .latest-post, h2.entry-title, h3.entry-title').each((i, el) => {
        const linkEl = $(el).find('a').first();
        const href = linkEl.attr('href');
        if (href && href.includes('moviesmods.best')) {
          matchedLink = href;
          return false;
        }
      });

      if (!matchedLink) {
        // تست آخرین لایه دریافت لینک در صورت نبود کارت استاندارد
        matchedLink = $search('a[href*="moviesmods.best/"]').first().attr('href');
      }

      if (!matchedLink) {
        return res.status(200).json({ 
          success: false, 
          stage: 'SEARCH_FAILED',
          message: `Could not find link for "${cleanTitle}".` 
        });
      }

      targetPageUrl = matchedLink;
    }

    // دریافت مستقیم HTML صفحه پست
    const pageRes = await fetch(targetPageUrl, { headers: customHeaders });
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    // خواندن دکمه‌های دانلود CLICK HERE TO DOWNLOAD
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (href.startsWith('http') && text.toUpperCase().includes('CLICK HERE TO DOWNLOAD')) {
        // استخراج عنوان کیفیت از تگ متنی بالای دکمه
        let qualityLabel = $(el).parent().prev().text().trim() || 
                           $(el).closest('p').prev('p').text().trim() || 
                           $(el).prev().text().trim();

        if (!qualityLabel || qualityLabel.length > 40) {
          qualityLabel = `Quality ${downloadOptions.length + 1}`;
        }

        // استخراج حجم از داخل متن دکمه مثل [450MB]
        const sizeMatch = text.match(/\[(.*?)\]/);
        const sizeText = sizeMatch ? ` [${sizeMatch[1]}]` : '';

        downloadOptions.push({
          id: downloadOptions.length,
          label: `${qualityLabel}${sizeText}`,
          link: href
        });
      }
    });

    return res.status(200).json({ 
      success: downloadOptions.length > 0, 
      targetUrl: targetPageUrl,
      options: downloadOptions 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
