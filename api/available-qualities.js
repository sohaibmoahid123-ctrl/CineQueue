const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://moviesmods.best/'
    };

    if (!targetUrl.startsWith('http')) {
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(targetUrl)}`;
      const searchRes = await fetch(searchUrl, { headers });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      const firstLink = $search('article a, .post-title a, h2 a, h3 a').first().attr('href');
      if (firstLink) {
        targetUrl = firstLink;
      } else {
        return res.status(200).json({ success: false, options: [], message: 'Movie not found' });
      }
    }

    const response = await fetch(targetUrl, { headers });
    const html = await response.text();
    const $ = cheerio.load(html);

    const downloadOptions = [];

    // پیمایش تمام دکمه‌های دانلود موجود در صفحه
    $('a').each((index, el) => {
      const href = $(el).attr('href') || '';
      const btnText = $(el).text().trim();

      if (href.startsWith('http') && (btnText.includes('CLICK HERE TO DOWNLOAD') || btnText.includes('DOWNLOAD'))) {
        // خواندن عنوان کیفیت از متن بالای دکمه
        let qualityTitle = $(el).parent().prev().text().trim() || $(el).prev().text().trim();
        
        // اگر عنوان بالای دکمه پیدا نشد، از متن خود دکمه استفاده کن
        if (!qualityTitle || qualityTitle.length > 50) {
          qualityTitle = 'Download Option ' + (downloadOptions.length + 1);
        }

        // استخراج حجم داخل دکمه (مثلاً [450MB])
        const sizeMatch = btnText.match(/\[(.*?)\]/);
        const sizeText = sizeMatch ? ` [${sizeMatch[1]}]` : '';

        downloadOptions.push({
          id: downloadOptions.length, // شناسه عددی دقیق برای هر دکمه
          label: `${qualityTitle}${sizeText}`,
          link: href
        });
      }
    });

    return res.status(200).json({ 
      success: downloadOptions.length > 0, 
      options: downloadOptions,
      movieUrl: targetUrl 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
