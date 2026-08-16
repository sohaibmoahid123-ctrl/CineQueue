const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const movieTitle = req.query.url;

  if (!movieTitle) {
    return res.status(400).json({ error: 'Movie title is required' });
  }

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://moviesmods.best/'
  };

  try {
    let targetPageUrl = movieTitle;

    if (!movieTitle.startsWith('http')) {
      const cleanSearchQuery = movieTitle
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9 ]/g, " ")
        .trim();

      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(cleanSearchQuery)}`;
      
      const searchRes = await fetch(searchUrl, { headers: customHeaders });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      const foundLink = $search('article h2 a, .post-title a, h2.entry-title a, h3 a, .entry-title a').first().attr('href');

      if (!foundLink) {
        return res.status(200).json({ 
          success: false, 
          stage: 'SEARCH_FAILED', 
          message: `Could not find "${cleanSearchQuery}" on target site.` 
        });
      }

      targetPageUrl = foundLink;
    }

    const pageRes = await fetch(targetPageUrl, { headers: customHeaders });
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    // استخراج بر اساس تمام لینک‌های موجود در کلاس‌های دکمه یا لینک‌های مربوط به دانلود
    $('a.maxbutton, a[href*="nexdrive"], a[href*="download"], .entry-content a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      // فیلتر کردن لینک‌های معتبر دانلود
      if (href.startsWith('http') && !href.includes('moviesmods.best') && !href.includes('telegram')) {
        
        // استخراج عنوان کیفیت از لایه‌های متنی بالای دکمه
        let parentText = $(el).parent().prev().text().trim() || $(el).parent().prev('p, h3, h4').text().trim();
        if (!parentText || parentText.length > 50) {
          parentText = $(el).closest('p, div').prev().text().trim();
        }

        if (!parentText || parentText.length > 50) {
          parentText = `Option ${downloadOptions.length + 1}`;
        }

        // استخراج حجم از متن دکمه یا متن همراه آن
        const sizeMatch = text.match(/\[(.*?)\]/);
        const sizeText = sizeMatch ? ` [${sizeMatch[1]}]` : '';

        // جلوگیری از افزودن لینک‌های تکراری
        const isDuplicate = downloadOptions.some(opt => opt.link === href);
        if (!isDuplicate) {
          downloadOptions.push({
            id: downloadOptions.length,
            label: `${parentText}${sizeText}`,
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
        message: 'Movie page found, but no download buttons matched.' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      targetUrl: targetPageUrl,
      options: downloadOptions 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
