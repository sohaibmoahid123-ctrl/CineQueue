const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const targetUrl = req.query.url; // آدرس صفحه فیلم در MoviesMod
  const quality = req.query.quality || '1080p'; // کیفیت مدنظر

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // ۱. گرفتن HTML صفحه در پس‌زمینه (زیر نیم ثانیه)
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://moviesmods.one/'
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    let finalDownloadLink = null;

    // ۲. پیدا کردن لینک nexdrive بر اساس کیفیت
    $('.download-links-div a.btn').each((_, el) => {
      const link = $(el).attr('href');
      const parentQuality = $(el).closest('h3').prev('h3').text().trim();

      if (link && parentQuality.includes(quality)) {
        finalDownloadLink = link;
        return false; // خروج از حلقه به محض پیدا شدن
      }
    });

    // اگر کیفیت پیدا نشد، اولین لینک دانلود موجود را می‌گیرد
    if (!finalDownloadLink) {
      finalDownloadLink = $('.download-links-div a.btn').first().attr('href');
    }

    if (finalDownloadLink) {
      return res.status(200).json({ success: true, url: finalDownloadLink });
    }

    return res.status(404).json({ error: 'Link not found' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
