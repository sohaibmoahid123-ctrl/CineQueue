const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const customHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://google.com'
    };

    // اگر عنوان فیلم فرستاده شده، آن را جستجو کن
    if (!targetUrl.startsWith('http')) {
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(targetUrl)}`;
      const searchRes = await fetch(searchUrl, { headers: customHeaders });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      const firstLink = $search('article a, .post-title a, h2 a, h3 a').first().attr('href');
      if (firstLink) {
        targetUrl = firstLink;
      } else {
        return res.status(200).json({ success: false, options: [], message: 'Movie not found' });
      }
    }

    // دریافت مستقیم صفحه فیلم
    const response = await fetch(targetUrl, { headers: customHeaders });
    const html = await response.text();
    const $ = cheerio.load(html);

    const downloadOptions = [];

    // استخراج تمام لینک‌هایی که دکمه دانلود دارند
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (href.startsWith('http') && (text.includes('DOWNLOAD') || text.includes('CLICK HERE'))) {
        // دریافت عنوان کیفیت بالای دکمه
        let qualityName = $(el).parent().prev().text().trim() || $(el).prev('p, h3, h4').text().trim();
        
        if (!qualityName || qualityName.length > 60) {
          qualityName = `Option ${downloadOptions.length + 1}`;
        }

        downloadOptions.push({
          id: downloadOptions.length,
          label: `${qualityName} ${text.includes('[') ? text.substring(text.indexOf('[')) : ''}`,
          link: href
        });
      }
    });

    return res.status(200).json({ 
      success: downloadOptions.length > 0, 
      options: downloadOptions 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
