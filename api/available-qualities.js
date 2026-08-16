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
      // استخراج کلمه اصلی فیلم (مثلاً از Soulm8te کلمه Soul یا Soulm8te)
      const cleanTitle = rawQuery.split('(')[0].trim();
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(cleanTitle)}`;
      
      const searchRes = await fetch(searchUrl, { headers: customHeaders });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      let matchedLink = null;
      
      // کلمات کلیدی اصلی اسم فیلم برای تطبیق
      const searchKeywords = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(w => w.length > 2);

      // بررسی تمام پست‌های موجود در صفحه نتایج
      $search('article, .post-item, .entry-title').each((i, el) => {
        const linkEl = $(el).find('a').first();
        const postTitle = linkEl.text().toLowerCase();
        const href = linkEl.attr('href');

        if (href) {
          // بررسی اینکه آیا تمام کلمات کلیدی فیلم در تیتر پست وجود دارند یا خیر
          const isMatch = searchKeywords.every(word => postTitle.includes(word));
          if (isMatch) {
            matchedLink = href;
            return false; // پیدا شد، خروج از حلقه
          }
        }
      });

      // اگر هیچ پستی دقیقاً با اسم فیلم تطابق نداشت، پست‌های نامربوط را باز نکن!
      if (!matchedLink) {
        return res.status(200).json({ 
          success: false, 
          stage: 'NOT_FOUND_ON_TARGET', 
          message: `The movie "${cleanTitle}" is not available on the download provider yet.` 
        });
      }

      targetPageUrl = matchedLink;
    }

    // باز کردن صفحه اصلی خودِ فیلم
    const pageRes = await fetch(targetPageUrl, { headers: customHeaders });
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    // استخراج لینک‌های دانلود
    $('a.maxbutton, a[href*="nexdrive"], a[href*="download"], .entry-content a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (href.startsWith('http') && !href.includes('moviesmods.best') && !href.includes('telegram')) {
        let parentText = $(el).parent().prev().text().trim() || $(el).parent().prev('p, h3, h4').text().trim();
        
        if (!parentText || parentText.length > 50) {
          parentText = $(el).closest('p, div').prev().text().trim();
        }

        if (!parentText || parentText.length > 50) {
          parentText = `Option ${downloadOptions.length + 1}`;
        }

        const sizeMatch = text.match(/\[(.*?)\]/);
        const sizeText = sizeMatch ? ` [${sizeMatch[1]}]` : '';

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
        message: 'Movie page found, but download links could not be extracted.' 
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
