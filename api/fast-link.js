const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let targetUrl = req.query.url;
  const quality = (req.query.quality || '1080p').toLowerCase();

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://moviesmods.best/'
    };

    // اگر لینک مستقیم نبود و اسم فیلم بود، ابتدا جستجو کند
    if (!targetUrl.startsWith('http')) {
      const searchUrl = `https://moviesmods.best/?s=${encodeURIComponent(targetUrl)}`;
      const searchRes = await fetch(searchUrl, { headers });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      
      const firstLink = $search('article a, .post-title a, h2 a, h3 a').first().attr('href');
      if (firstLink) {
        targetUrl = firstLink;
      } else {
        return res.status(444).json({ error: 'Movie page not found' });
      }
    }

    const response = await fetch(targetUrl, { headers });
    const html = await response.text();
    const $ = cheerio.load(html);

    let matchedLink = null;
    let fallbackLink = null;

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const btnText = $(el).text().toLowerCase();
      const parentText = $(el).parent().text().toLowerCase();
      const prevText = $(el).parent().prev().text().toLowerCase();
      const fullContext = `${btnText} ${parentText} ${prevText}`;

      // اگر لینک دانلود بود
      if (btnText.includes('click here') || btnText.includes('download') || href.includes('download') || href.includes('drive') || href.includes('link')) {
        if (!fallbackLink && href.startsWith('http')) {
          fallbackLink = href;
        }

        if (fullContext.includes(quality) && href.startsWith('http')) {
          matchedLink = href;
          return false; // خروج از حلقه
        }
      }
    });

    const finalUrl = matchedLink || fallbackLink;

    if (finalUrl) {
      return res.status(200).json({ success: true, url: finalUrl });
    }

    return res.status(404).json({ error: 'Download link not found' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
