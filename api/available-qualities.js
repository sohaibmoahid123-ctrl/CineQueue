const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://moviesmods.best/'
    };

    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://moviesmods.best/?s=${encodeURIComponent(targetUrl)}`;
    }

    let response = await fetch(targetUrl, { headers });
    let html = await response.text();
    let $ = cheerio.load(html);

    // اگر صفحه سرچ بود، وارد اولين پست بشو
    if (targetUrl.includes('/?s=')) {
      const firstLink = $('article a, .post-title a, h2 a, h3 a').first().attr('href');
      if (firstLink) {
        targetUrl = firstLink;
        response = await fetch(targetUrl, { headers });
        html = await response.text();
        $ = cheerio.load(html);
      }
    }

    const availableQualities = [];

    // بررسی تمام تک‌های a موجود در کل صفحه بدون محدود کردن به کلاس خاص
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text() || '';
      const parentText = $(el).parent().text() || '';
      const fullContext = (text + ' ' + parentText + ' ' + href).toLowerCase();

      if (fullContext.includes('1080p') && !availableQualities.includes('1080p')) {
        availableQualities.push('1080p');
      }
      if (fullContext.includes('720p') && !availableQualities.includes('720p')) {
        availableQualities.push('720p');
      }
      if (fullContext.includes('480p') && !availableQualities.includes('480p')) {
        availableQualities.push('480p');
      }
      if ((fullContext.includes('2160p') || fullContext.includes('4k')) && !availableQualities.includes('2160p')) {
        availableQualities.push('2160p');
      }
    });

    // اگر باز هم هیچی پیدا نشد ولی لینک‌هایی وجود داشت، حداقل کیفیت‌های عمومی را خروجی بده
    if (availableQualities.length === 0 && html.length > 2000) {
      if (html.includes('1080p')) availableQualities.push('1080p');
      if (html.includes('720p')) availableQualities.push('720p');
      if (html.includes('480p')) availableQualities.push('480p');
    }

    return res.status(200).json({ 
      success: availableQualities.length > 0, 
      qualities: availableQualities,
      htmlLength: html.length 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
