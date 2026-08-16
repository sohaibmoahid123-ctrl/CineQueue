const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const movieTitle = req.query.url; // عنوان فیلم ورودی از CineQueue

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

    // اگر ورودی لینک مستقیم نبود، ابتدا در سایت سرچ کن
    if (!movieTitle.startsWith('http')) {
      // پاک‌سازی عنوان فیلم برای سرچ بهتر (حذف سال و کاراکترهای اضافی)
      const cleanSearchQuery = movieTitle.split('(')[0].replace(/[^a-zA-Z0-9 ]/g, "").trim();
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(cleanSearchQuery)}`;
      
      const searchRes = await fetch(searchUrl, { headers: customHeaders });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      // پیدا کردن اولین لینک پست فیلم از نتایج سرچ
      const foundLink = $search('article h2 a, .post-title a, h2.entry-title a, h3 a').first().attr('href');

      if (!foundLink) {
        // اشکال‌یابی: سرچ نتوانست فیلم را پیدا کند
        return res.status(200).json({ 
          success: false, 
          stage: 'SEARCH_FAILED', 
          message: `Search returned no results for "${cleanSearchQuery}"` 
        });
      }

      targetPageUrl = foundLink;
    }

    // دریافت HTML صفحه اختصاصی فیلم
    const pageRes = await fetch(targetPageUrl, { headers: customHeaders });
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    // پیمایش و استخراج تمام دکمه‌های دانلود موجود در صفحه
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (href.startsWith('http') && (text.includes('CLICK HERE TO DOWNLOAD') || text.includes('DOWNLOAD'))) {
        let qualityName = $(el).parent().prev().text().trim() || $(el).prev().text().trim();
        
        if (!qualityName || qualityName.length > 60) {
          qualityName = `Option ${downloadOptions.length + 1}`;
        }

        const sizeMatch = text.match(/\[(.*?)\]/);
        const sizeText = sizeMatch ? ` [${sizeMatch[1]}]` : '';

        downloadOptions.push({
          id: downloadOptions.length,
          label: `${qualityName}${sizeText}`,
          link: href
        });
      }
    });

    if (downloadOptions.length === 0) {
      // اشکال‌یابی: صفحه فیلم پیدا شد اما دکمه‌ها خوانده نشدند (تغییر ساختار HTML)
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
