const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://moviesmods.best/'
    };

    // اگر آدرس کامل داده نشده بود و فقط اسم فیلم بود، سرچ کن
    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://moviesmods.best/?s=${encodeURIComponent(targetUrl)}`;
    }

    let response = await fetch(targetUrl, { headers });
    let html = await response.text();
    let $ = cheerio.load(html);

    // اگر صفحه سرچ بود، اولین لینک پست فیلم را پیدا کن
    if (targetUrl.includes('/?s=')) {
      const firstArticleLink = $('article a, .post-title a, h2.entry-title a, .entry-header a').first().attr('href');
      if (firstArticleLink) {
        targetUrl = firstArticleLink;
        response = await fetch(targetUrl, { headers });
        html = await response.text();
        $ = cheerio.load(html);
      } else {
        return res.status(200).json({ success: false, qualities: [], message: 'No movie found' });
      }
    }

    // استخراج کیفیت‌ها از بالای دکمه‌های دانلود
    const availableQualities = [];

    $('a').each((_, el) => {
      const text = $(el).text();
      const href = $(el).attr('href');

      // تشخیص دکمه‌های دانلود از روی متن دکمه
      if (href && (text.includes('CLICK HERE TO DOWNLOAD') || text.includes('DOWNLOAD'))) {
        // خواندن متن کیفیت بالای دکمه (p یا span یا h3 قبلی)
        const parentText = $(el).parent().prev().text().trim() || $(el).prev().text().trim() || $(el).parent().text().trim();

        if (parentText.includes('1080p') || text.includes('1080p')) {
          if (!availableQualities.includes('1080p')) availableQualities.push('1080p');
        } else if (parentText.includes('720p') || text.includes('720p')) {
          if (!availableQualities.includes('720p')) availableQualities.push('720p');
        } else if (parentText.includes('480p') || text.includes('480p')) {
          if (!availableQualities.includes('480p')) availableQualities.push('480p');
        } else if (parentText.includes('2160p') || text.includes('2160p') || parentText.includes('4K')) {
          if (!availableQualities.includes('2160p')) availableQualities.push('2160p');
        }
      }
    });

    return res.status(200).json({ success: true, qualities: availableQualities, movieUrl: targetUrl });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
