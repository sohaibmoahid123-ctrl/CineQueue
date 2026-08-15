const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://moviesmods.one/'
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const availableQualities = [];

    // استخراج تمام کیفیت‌های موجود در صفحه
    $('.download-links-div a.btn').each((_, el) => {
      const parentText = $(el).closest('h3').prev('h3').text().trim();
      const link = $(el).attr('href');

      if (link && link.includes('nexdrive')) {
        if (parentText.includes('480p') && !availableQualities.includes('480p')) {
          availableQualities.push('480p');
        }
        if (parentText.includes('720p') && !availableQualities.includes('720p')) {
          availableQualities.push('720p');
        }
        if (parentText.includes('1080p') && !availableQualities.includes('1080p')) {
          availableQualities.push('1080p');
        }
      }
    });

    return res.status(200).json({ success: true, qualities: availableQualities });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
