const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawQuery = req.query.url;
  const requestedSeason = req.query.season ? String(req.query.season).replace(/^0+/, '') : null;

  if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'url parameter is required' });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://moviesmod.zone/'
  };

  const fetchWithTimeout = async (url, timeoutMs = 9000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  const clean = (t = '') => t.replace(/\s+/g, ' ').trim();

  const isDirectUrl = rawQuery.startsWith('http');
  const cleanQuery = isDirectUrl
    ? rawQuery
    : rawQuery.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  try {
    let targetUrl = rawQuery;

    // ========== ۱. جستجوی صفحه فیلم/سریال ==========
    if (!isDirectUrl) {
      const searchUrls = [
        `https://moviesmod.zone/?s=${encodeURIComponent(cleanQuery)}`,
        `https://moviesmod.zone/search/${encodeURIComponent(cleanQuery)}`
      ];

      let foundLink = null;
      let bestScore = -1;

      for (const searchUrl of searchUrls) {
        try {
          const searchRes = await fetchWithTimeout(searchUrl, 7000);
          if (!searchRes.ok) continue;
          const html = await searchRes.text();
          const $ = cheerio.load(html);

          $('a[href*="moviesmod.zone/download-"], a[href*="/download-"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const text = clean($(el).text() + ' ' + ($(el).attr('title') || ''));
            if (text.length < 5) return;

            const full = href.startsWith('http') ? href : `https://moviesmod.zone${href.startsWith('/') ? '' : '/'}${href}`;
            const lower = text.toLowerCase();
            const words = cleanQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);

            let score = 0;
            words.forEach(w => { if (lower.includes(w)) score += 3; });
            if (lower.includes('download')) score += 2;
            if (lower.includes(cleanQuery.toLowerCase())) score += 8;

            if (score > bestScore) {
              bestScore = score;
              foundLink = full;
            }
          });

          if (foundLink && bestScore >= 3) break;
        } catch (e) {}
      }

      if (!foundLink) {
        return res.status(200).json({
          success: false,
          stage: 'SEARCH_FAILED',
          message: `No results for "${cleanQuery}"`
        });
      }
      targetUrl = foundLink;
    }

    // ========== ۲. باز کردن صفحه هدف ==========
    const pageRes = await fetchWithTimeout(targetUrl, 9000);
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    // پاکسازی عناصر مزاحم (پست‌های مرتبط و منوها) تا لینک‌های اشتباه وارد نشوند
    $('.code-block, .related-posts, .yarpp-related, footer, sidebar, .navigation').remove();

    const options = [];
    const seen = new Set();

    // ========== ۳. استخراج معنایی لینک‌ها (Semantic Extraction) ==========
    $('a[href*="modpro.blog"], a[href*="driveseed"], a[href*="unblockedgames"], a[href*="modlinks"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.startsWith('http') || seen.has(href)) return;

      const btnText = clean($(el).text()) || 'Download';

      // یافتن نزدیک‌ترین متن/تیترِ بالای دکمه
      let contextText = '';
      let parentContainer = $(el).closest('p, div, h3, h4');
      
      // بررسی متنِ عناصرِ قبل از دکمه
      let prevElem = parentContainer.prev();
      let steps = 0;
      while (prevElem.length > 0 && steps < 4) {
        const txt = clean(prevElem.text());
        if (txt.length > 5) {
          contextText = txt + ' ' + contextText;
          // اگر به یک تیتر اصلی رسیدیم توقف کن
          if (/(Season\s*\d+|S\d+|480p|720p|1080p|2160p)/i.test(txt)) break;
        }
        prevElem = prevElem.prev();
        steps++;
      }

      if (!contextText) contextText = clean(parentContainer.text());

      // ========== ۴. منطق تفکیک فیلم از سریال ==========
      if (requestedSeason) {
        // --- حالت سریال ---
        // بررسی شماره فصل در متنِ اطراف دکمه
        const seasonMatch = contextText.match(/(?:Season\s*|S)0*(\d+)/i) || (btnText + ' ' + href).match(/(?:Season\s*|S)0*(\d+)/i);
        
        if (!seasonMatch) return; // اگر فصل نداشت رد شو
        
        const foundSeason = seasonMatch[1].replace(/^0+/, '');
        if (foundSeason !== String(requestedSeason)) return; // اگر فصلِ درخواستی نبود رد شو
      } else {
        // --- حالت فیلم (بدون فصل) ---
        // اگر کاربر سیزن نخواسته، اما متنِ لینک مربوط به یک سریال با سیزن دیگر است، ردش کن
        const hasSeasonPattern = /(?:Season\s*|S)0*(\d+)/i.test(contextText);
        // اگر فیلم است اما متن شامل فصل بود، در صورت عدم درخواست سیزن باز هم لینک‌های کیفیت را جمع‌آوری می‌کنیم
      }

      // ساخت عنوان تمیز برای نشان دادن به کاربر
      let label = contextText.replace(/\s+/g, ' ').trim();
      if (label.length > 110) label = label.slice(0, 110) + '...';
      if (btnText && !label.toLowerCase().includes(btnText.toLowerCase())) {
        label = `${label} — ${btnText}`;
      }

      seen.add(href);
      options.push({
        id: options.length + 1,
        label: label || 'Download Link',
        link: href
      });
    });

    if (options.length === 0) {
      return res.status(200).json({
        success: false,
        stage: 'PARSING_FAILED',
        targetUrl,
        season: requestedSeason,
        message: requestedSeason
          ? `No links found for Season ${requestedSeason}`
          : 'No download links found on the page'
      });
    }

    return res.status(200).json({
      success: true,
      source: 'MoviesMod_Scraper',
      targetUrl,
      query: cleanQuery,
      season: requestedSeason,
      totalOptions: options.length,
      options: options.slice(0, 25)
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Scraper failed'
    });
  }
};
