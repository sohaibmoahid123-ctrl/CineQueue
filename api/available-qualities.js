const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // مدیریت CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawQuery = req.query.url;
  if (!rawQuery) {
    return res.status(400).json({ error: 'اسم فیلم یا لینک لازمه' });
  }

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://moviesmods.best/'
  };

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

    if (!rawQuery.startsWith('http')) {
      const cleanTitle = rawQuery.split('(')[0].trim();
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(cleanTitle)}`;
      
      const searchRes = await fetchWithTimeout(searchUrl, { headers: customHeaders });
      
      if (!searchRes.ok) {
        return res.status(200).json({ 
          success: false, 
          stage: 'SEARCH_FAILED',
          message: `جستجو با خطا مواجه شد: ${searchRes.status}` 
        });
      }
      
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
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

    // بررسی دقیق‌تر دکمه‌های اصلی دانلود
    $('a[href^="http"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      // حذف لینک‌های تبلیغاتی، دامنه اصلی یا گروه‌های تلگرامی
      const isExternalDownload = href && 
        !href.includes('moviesmods.best') && 
        !href.includes('telegram') && 
        !href.includes('t.me');

      const isDownloadText = text.toUpperCase().includes('CLICK HERE TO DOWNLOAD') || 
                             text.toUpperCase().includes('DOWNLOAD');

      if (isExternalDownload && isDownloadText) {
        // استخراج کیفیت از المان قبل از دکمه
        let qualityLabel = $(el).parent().prev().text().trim() || 
                           $(el).closest('p').prev('p').text().trim() || 
                           $(el).prev().text().trim();

        if (!qualityLabel || qualityLabel.length > 40) {
          qualityLabel = `Option ${downloadOptions.length + 1}`;
        }

        // استخراج حجم درون دکمه
        const sizeMatch = text.match(/\[(.*?)\]/);
        const sizeText = sizeMatch ? ` [${sizeMatch[1]}]` : '';

        // جلوگیری از ثبت لینک‌های تکراری
        const isDuplicate = downloadOptions.some(opt => opt.link === href);
        if (!isDuplicate) {
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
