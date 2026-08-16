const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // حل مشکل CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const rawQuery = req.query.url;
  if (!rawQuery) {
    return res.status(400).json({ error: 'اسم فیلم یا لینک لازمه' });
  }

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://moviesmods.best/'
  };

  // تابع با تایم‌اوت (۱۵ ثانیه)
  const fetchWithTimeout = (url, options = {}, timeout = 15000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('درخواست تایم‌اوت شد')), timeout)
      )
    ]);
  };

  try {
    let targetPageUrl = rawQuery;

    // اگه کاربر لینک نداده، جستجو کن
    if (!rawQuery.startsWith('http')) {
      const cleanTitle = rawQuery.split('(')[0].trim();
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(cleanTitle)}`;
      
      const searchRes = await fetchWithTimeout(searchUrl, { headers: customHeaders });
      
      // بررسی اینکه صفحه جواب داده یا نه
      if (!searchRes.ok) {
        return res.status(200).json({ 
          success: false, 
          stage: 'SEARCH_FAILED',
          message: `جستجو با خطا مواجه شد: ${searchRes.status}` 
        });
      }
      
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      // چندین روش مختلف برای پیدا کردن لینک
      const selectors = [
        'article .entry-title a',
        '.post-item a[href*="moviesmods.best"]',
        '.latest-post a[href*="moviesmods.best"]',
        'h2.entry-title a',
        'h3.entry-title a'
      ];
      
      let matchedLink = null;
      for (const selector of selectors) {
        const link = $search(selector).first().attr('href');
        if (link && link.includes('moviesmods.best')) {
          matchedLink = link;
          break;
        }
      }

      if (!matchedLink) {
        return res.status(200).json({ 
          success: false, 
          stage: 'SEARCH_FAILED',
          message: `فیلم "${cleanTitle}" پیدا نشد` 
        });
      }

      targetPageUrl = matchedLink;
    }

    // دریافت صفحه فیلم
    const pageRes = await fetchWithTimeout(targetPageUrl, { headers: customHeaders });
    
    if (!pageRes.ok) {
      return res.status(200).json({
        success: false,
        stage: 'PAGE_FETCH_FAILED',
        message: `خطا در دریافت صفحه: ${pageRes.status}`
      });
    }

    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    // پیدا کردن دکمه‌های دانلود
    $('a[href^="http"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      const parentText = $(el).parent().text().trim();

      // چک کردن اینکه دکمه دانلود هست یا نه
      const isDownload = text.toUpperCase().includes('CLICK HERE TO DOWNLOAD') ||
                        text.toUpperCase().includes('DOWNLOAD') ||
                        text.includes('MB') ||
                        parentText.includes('MB');

      if (href && isDownload) {
        // پیدا کردن کیفیت فیلم (مثلاً 720p یا 1080p)
        let qualityLabel = '';
        const prevText = $(el).parent().prev().text().trim() || 
                        $(el).closest('div').prev().text().trim() ||
                        $(el).closest('p').prev('p').text().trim();

        if (prevText && prevText.length < 50) {
          qualityLabel = prevText;
        }

        // پیدا کردن حجم فایل از داخل متن دکمه
        const sizeMatch = text.match(/\[(.*?)\]/);
        const sizeText = sizeMatch ? ` [${sizeMatch[1]}]` : '';

        downloadOptions.push({
          id: downloadOptions.length + 1,
          label: qualityLabel || `کیفیت ${downloadOptions.length + 1}` + sizeText,
          link: href
        });
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