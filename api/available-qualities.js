const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const query = req.query.url; // می‌تواند IMDb ID یا عنوان فیلم باشد

  if (!query) {
    return res.status(400).json({ error: 'Query param is required' });
  }

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://moviesmods.best/'
  };

  try {
    let targetPageUrl = query;

    if (!query.startsWith('http')) {
      // سرچ مستقیم ID یا عنوان
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(query)}`;
      
      const searchRes = await fetch(searchUrl, { headers: customHeaders });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      // گرفتن اولین نتیجه معتبر که پست فیلم باشد
      const foundLink = $search('article h2 a, .post-title a, h2.entry-title a, h3 a').first().attr('href');

      if (!foundLink) {
        return res.status(200).json({ 
          success: false, 
          stage: 'SEARCH_FAILED', 
          message: `No movie found on target site for ID/Title: "${query}"` 
        });
      }

      targetPageUrl = foundLink;
    }

    const pageRes = await fetch(targetPageUrl, { headers: customHeaders });
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];

    // استخراج دکمه‌های لینک دانلود
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
        message: 'Movie page found, but no download links matched.' 
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
