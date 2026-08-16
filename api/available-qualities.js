const cheerio = require('cheerio');

module.exports = async (req, res) => {
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

    // جستجو اگر لینک نداد
    if (!rawQuery.startsWith('http')) {
      const cleanTitle = rawQuery.split('(')[0].trim();
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(cleanTitle)}`;
      
      const searchRes = await fetchWithTimeout(searchUrl, { headers: customHeaders });
      
      if (!searchRes.ok) {
        return res.status(200).json({ 
          success: false, 
          message: `جستجو با خطا مواجه شد: ${searchRes.status}` 
        });
      }
      
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      let matchedLink = null;
      
      // پیدا کردن لینک از روی تصویر یا عنوان
      $search('article, .post-item, .latest-post, .blog-item').each((i, el) => {
        // اول تصویر رو چک کن
        const img = $(el).find('img').first();
        const imgAlt = img.attr('alt') || '';
        const imgSrc = img.attr('src') || '';
        
        // بعد عنوان رو چک کن
        const title = $(el).find('h2.entry-title, h3.entry-title, .post-title').text().trim();
        const link = $(el).find('a').first().attr('href');
        
        // اگه عنوان یا alt تصویر با جستجو مطابقت داشت
        if (link && link.includes('moviesmods.best')) {
          const linkText = $(el).text().toLowerCase();
          const searchText = cleanTitle.toLowerCase();
          
          if (linkText.includes(searchText) || 
              title.toLowerCase().includes(searchText) ||
              imgAlt.toLowerCase().includes(searchText)) {
            matchedLink = link;
            return false;
          }
        }
      });

      if (!matchedLink) {
        return res.status(200).json({ 
          success: false, 
          message: `"${cleanTitle}" پیدا نشد` 
        });
      }

      targetPageUrl = matchedLink;
    }

    // دریافت صفحه فیلم
    const pageRes = await fetchWithTimeout(targetPageUrl, { headers: customHeaders });
    
    if (!pageRes.ok) {
      return res.status(200).json({
        success: false,
        message: `خطا در دریافت صفحه: ${pageRes.status}`
      });
    }

    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    // ===== اطلاعات فیلم از روی تصویر و متن =====
    const movieInfo = {
      title: '',
      poster: '',
      rating: '',
      year: '',
      duration: '',
      description: '',
      director: '',
      cast: ''
    };

    // گرفتن تصویر فیلم (پوستر)
    const posterImg = $('img.wp-post-image, .post-thumbnail img, .featured-image img, .entry-image img').first();
    if (posterImg.length > 0) {
      movieInfo.poster = posterImg.attr('src') || '';
      movieInfo.title = posterImg.attr('alt') || '';
    }

    // اگر تصویر پیدا نشد، از عنوان استفاده کن
    if (!movieInfo.title) {
      movieInfo.title = $('h1.entry-title, .post-title, .entry-header h1').first().text().trim();
    }

    // اطلاعات فیلم (امتیاز، سال، مدت)
    const infoText = $('.entry-meta, .post-meta, .movie-info, .film-info').text().trim();
    const ratingMatch = infoText.match(/(\d+\.?\d*)\s*\/\s*10/) || infoText.match(/rating:?\s*(\d+\.?\d*)/i);
    const yearMatch = infoText.match(/\b(19|20)\d{2}\b/);
    const durationMatch = infoText.match(/(\d+)\s*(min|hour|hr)/i);

    if (ratingMatch) movieInfo.rating = ratingMatch[1];
    if (yearMatch) movieInfo.year = yearMatch[0];
    if (durationMatch) movieInfo.duration = durationMatch[0];

    // داستان فیلم
    movieInfo.description = $('.entry-content p, .post-content p, .movie-description p').first().text().trim();

    // کارگردان و بازیگران
    const directorMatch = $('.entry-content, .post-content').text().match(/Director:?\s*([^\n]+)/i);
    const castMatch = $('.entry-content, .post-content').text().match(/Cast:?\s*([^\n]+)/i);
    if (directorMatch) movieInfo.director = directorMatch[1].trim();
    if (castMatch) movieInfo.cast = castMatch[1].trim();

    // ===== استخراج گزینه‌های دانلود =====
    const downloadOptions = [];

    // روش ۱: پیدا کردن گزینه‌های دانلود از لیست‌ها
    $('ul, ol, div.download-links, div.entry-content, div.post-content').each((i, container) => {
      const containerHtml = $(container).html() || '';
      
      // دنبال گزینه‌های دانلود بگرد (با چک‌باکس یا لینک)
      $(container).find('li, div.download-item, div.option, p').each((j, item) => {
        const itemText = $(item).text().trim();
        const links = $(item).find('a[href*="http"]');
        
        // اگه متن شامل MB یا GB یا Download باشه
        if ((itemText.includes('MB') || itemText.includes('GB') || itemText.includes('Download')) && links.length > 0) {
          links.each((k, linkEl) => {
            const href = $(linkEl).attr('href') || '';
            const linkText = $(linkEl).text().trim();
            
            // فقط لینک‌های خارجی (غیر از خود سایت)
            if (href && !href.includes('moviesmods.best') && !href.includes('#')) {
              // استخراج کیفیت و حجم
              let quality = '';
              let size = '';
              
              // کیفیت از متن اطراف
              const qualityMatch = itemText.match(/(1080p|720p|480p|4K|2160p|HD|FHD|UHD)/i) ||
                                  linkText.match(/(1080p|720p|480p|4K|2160p|HD|FHD|UHD)/i);
              if (qualityMatch) quality = qualityMatch[1].toUpperCase();
              
              // حجم از متن
              const sizeMatch = itemText.match(/(\d+[\.\d]*\s*(MB|GB|KB))/i) ||
                               linkText.match(/(\d+[\.\d]*\s*(MB|GB|KB))/i);
              if (sizeMatch) size = sizeMatch[1];
              
              // اگه کیفیت پیدا نشد، از متن استفاده کن
              if (!quality) {
                const cleanText = itemText.replace(/\[.*?\]/g, '').trim();
                if (cleanText.length < 30 && !cleanText.includes('Download')) {
                  quality = cleanText;
                }
              }
              
              downloadOptions.push({
                id: downloadOptions.length + 1,
                quality: quality || `Option ${downloadOptions.length + 1}`,
                label: `${quality || 'Option'}${size ? ' [' + size + ']' : ''}`,
                size: size || '',
                link: href,
                rawText: itemText.substring(0, 50) // برای دیباگ
              });
            }
          });
        }
        
        // چک‌باکس‌ها
        $(item).find('input[type="checkbox"]').each((k, checkbox) => {
          const label = $(checkbox).next('label').text().trim() || 
                       $(checkbox).closest('label').text().trim() ||
                       $(item).text().trim();
          const link = $(item).find('a[href*="http"]').attr('href') || 
                      $(checkbox).closest('div').find('a[href*="http"]').attr('href');
          
          if (link && label && !link.includes('moviesmods.best')) {
            const sizeMatch = label.match(/(\d+[\.\d]*\s*(MB|GB|KB))/i);
            const qualityMatch = label.match(/(1080p|720p|480p|4K|2160p|HD|FHD|UHD)/i);
            
            downloadOptions.push({
              id: downloadOptions.length + 1,
              quality: qualityMatch ? qualityMatch[1].toUpperCase() : `Option ${downloadOptions.length + 1}`,
              label: label,
              size: sizeMatch ? sizeMatch[1] : '',
              link: link
            });
          }
        });
      });
    });

    // روش ۲: اگر چیزی پیدا نشد، مستقیم دنبال دکمه‌های دانلود بگرد
    if (downloadOptions.length === 0) {
      $('a[href^="http"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const parentText = $(el).parent().text().trim();
        const grandParentText = $(el).closest('div, p, li').text().trim();
        
        const hasSize = /MB|GB|KB/.test(text) || /MB|GB|KB/.test(parentText);
        const hasQuality = /1080p|720p|480p|4K|2160p|HD|FHD/.test(text) || 
                          /1080p|720p|480p|4K|2160p|HD|FHD/.test(parentText);
        const isDownload = /download|click here|server/i.test(text) || 
                          /download|click here|server/i.test(parentText);
        
        if (href && !href.includes('moviesmods.best') && !href.includes('#') && 
            (hasSize || hasQuality || isDownload)) {
          
          let quality = '';
          let size = '';
          
          const qualityMatch = text.match(/(1080p|720p|480p|4K|2160p|HD|FHD|UHD)/i) ||
                              parentText.match(/(1080p|720p|480p|4K|2160p|HD|FHD|UHD)/i);
          if (qualityMatch) quality = qualityMatch[1].toUpperCase();
          
          const sizeMatch = text.match(/(\d+[\.\d]*\s*(MB|GB|KB))/i) ||
                           parentText.match(/(\d+[\.\d]*\s*(MB|GB|KB))/i);
          if (sizeMatch) size = sizeMatch[1];
          
          downloadOptions.push({
            id: downloadOptions.length + 1,
            quality: quality || `Link ${downloadOptions.length + 1}`,
            label: `${quality || 'Link'}${size ? ' [' + size + ']' : ''}`,
            size: size || '',
            link: href
          });
        }
      });
    }

    // حذف لینک‌های تکراری
    const uniqueOptions = [];
    const seenLinks = new Set();
    for (const opt of downloadOptions) {
      if (!seenLinks.has(opt.link)) {
        seenLinks.add(opt.link);
        uniqueOptions.push(opt);
      }
    }

    // پاسخ نهایی
    return res.status(200).json({ 
      success: uniqueOptions.length > 0,
      movieInfo: movieInfo,
      targetUrl: targetPageUrl,
      totalOptions: uniqueOptions.length,
      options: uniqueOptions 
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};