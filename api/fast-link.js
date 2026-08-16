const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let targetUrl = req.query.url;
  const quality = req.query.quality || '1080p';

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://moviesmods.best/'
    };

    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://moviesmods.best/?s=${encodeURIComponent(targetUrl)}`;
    }

    let response = await fetch(targetUrl, { headers });
    let html = await response.text();
    let $ = cheerio.load(html);

    if (targetUrl.includes('/?s=')) {
      const firstArticleLink = $('article a, .post-title a, h2.entry-title a, .entry-header a').first().attr('href');
      if (firstArticleLink) {
        targetUrl = firstArticleLink;
        response = await fetch(targetUrl, { headers });
        html = await response.text();
        $ = cheerio.load(html);
      }
    }

    let finalDownloadLink = null;

    $('a').each((_, el) => {
      const text = $(el).text();
      const href = $(el).attr('href');

      if (href && (text.includes('CLICK HERE TO DOWNLOAD') || text.includes('DOWNLOAD'))) {
        const parentText = $(el).parent().prev().text().trim() || $(el).prev().text().trim() || $(el).parent().text().trim();

        if (parentText.includes(quality) || text.includes(quality)) {
          finalDownloadLink = href;
          return false; // خروج از حلقه به محض پیدا کردن کیفیت مورد نظر
        }
      }
    });

    // اگر کیفیت خاص پیدا نشد، لینک اولین دکمه دانلود را برمی‌گرداند
    if (!finalDownloadLink) {
      $('a').each((_, el) => {
        const text = $(el).text();
        const href = $(el).attr('href');
        if (href && (text.includes('CLICK HERE TO DOWNLOAD') || text.includes('DOWNLOAD'))) {
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
