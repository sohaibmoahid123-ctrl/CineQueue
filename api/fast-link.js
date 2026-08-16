const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let targetUrl = req.query.url;
  const quality = req.query.quality || '1080p';

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://moviesmods.best/'
    };

    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://moviesmods.best/?s=${encodeURIComponent(targetUrl)}`;
    }

    let response = await fetch(targetUrl, { headers });
    let html = await response.text();
    let $ = cheerio.load(html);

    if (targetUrl.includes('/?s=')) {
      const firstLink = $('article a, .post-title a, h2 a, h3 a').first().attr('href');
      if (firstLink) {
        targetUrl = firstLink;
        response = await fetch(targetUrl, { headers });
        html = await response.text();
        $ = cheerio.load(html);
      }
    }

    let finalDownloadLink = null;

    // پیدا کردن دکمه مدنظر بر اساس کیفیت
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text() || '';
      const parentText = $(el).parent().text() || '';
      const prevText = $(el).parent().prev().text() || '';
      const fullContext = (text + ' ' + parentText + ' ' + prevText).toLowerCase();

      if (href.startsWith('http') && fullContext.includes(quality.toLowerCase())) {
        finalDownloadLink = href;
        return false; // خروج از حلقه
      }
    });

    // Fallback: اگر دقیقاً بر اساس کیفیت پیدا نشد، اولین لینک معتبر دانلود را برمی‌گرداند
    if (!finalDownloadLink) {
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text() || '';
        if (href.startsWith('http') && (text.includes('DOWNLOAD') || text.includes('CLICK HERE'))) {
          finalDownloadLink = href;
          return false;
        }
      });
    }

    if (finalDownloadLink) {
      return res.status(200).json({ success: true, url: finalDownloadLink });
    }

    return res.status(404).json({ error: 'Download link not found' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
