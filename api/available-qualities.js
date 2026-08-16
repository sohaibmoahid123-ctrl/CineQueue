const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const movieTitle = req.query.url;

  if (!movieTitle) {
    return res.status(400).json({ 
      success: false, 
      error: 'Movie title or URL is required' 
    });
  }

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://moviesmods.best/'
  };

  try {
    let targetPageUrl = movieTitle;

    // اگر لینک کامل نبود → سرچ کن
    if (!movieTitle.startsWith('http')) {
      const cleanSearchQuery = movieTitle
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // آدرس سرچ درست برای DataLife Engine
      const searchUrl = `https://moviesmods.best/?do=search&subaction=search&story=${encodeURIComponent(cleanSearchQuery)}`;

      const searchRes = await fetch(searchUrl, { headers: customHeaders });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);

      // پیدا کردن نتایج سرچ
      let foundLink = null;
      let foundTitle = null;

      $search('a[href*=".html"]').each((i, el) => {
        const href = $search(el).attr('href');
        const text = $search(el).text().trim();
        const titleAttr = $search(el).attr('title') || '';

        // فقط لینک‌های فیلم (نه صفحات ثابت)
        if (href && href.includes('moviesmods.best') && 
            !href.includes('request') && 
            !href.includes('dmca') && 
            !href.includes('about') &&
            text.length > 10) {
          
          // اگر هنوز لینکی پیدا نکردیم، اولین نتیجه معتبر رو بگیر
          if (!foundLink) {
            foundLink = href.startsWith('http') ? href : `https://moviesmods.best${href}`;
            foundTitle = text || titleAttr;
          }
        }
      });

      if (!foundLink) {
        return res.status(200).json({ 
          success: false, 
          stage: 'SEARCH_FAILED', 
          message: `نتیجه‌ای برای "${cleanSearchQuery}" پیدا نشد.` 
        });
      }

      targetPageUrl = foundLink;
    }

    // حالا صفحه فیلم رو باز کن
    const pageRes = await fetch(targetPageUrl, { headers: customHeaders });
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    $('a[href^="http"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      const isExternal = !href.includes('moviesmods.best') && !href.includes('telegram');
      const isDownloadBtn = 
        text.toUpperCase().includes('CLICK HERE TO DOWNLOAD') || 
        text.toUpperCase().includes('DOWNLOAD') ||
        href.includes('nexdrive') ||
        href.includes('download');

      if (isExternal && isDownloadBtn) {
        let qualityLabel = $(el).parent().prev().text().trim() || 
                           $(el).closest('p').prev('p, h3, h4').text().trim() ||
                           $(el).prev().text().trim();

        if (!qualityLabel || qualityLabel.length > 50) {
          qualityLabel = `Option ${downloadOptions.length + 1}`;
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

    if (downloadOptions.length === 0) {
      return res.status(200).json({ 
        success: false, 
        stage: 'PARSING_FAILED', 
        targetUrl: targetPageUrl, 
        message: 'صفحه فیلم پیدا شد، ولی دکمه دانلودی پیدا نشد.' 
      });
    }

    return res.status(200).json({ 
      success: true, 
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