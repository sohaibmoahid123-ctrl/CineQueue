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

    // ========== پیدا کردن صفحه فیلم ==========
    if (!isDirectUrl) {
      // هم /?s= و هم /search/ رو امتحان کن
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

    // ========== باز کردن صفحه فیلم ==========
    const pageRes = await fetchWithTimeout(targetUrl, 9000);
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    // Related posts رو حذف کن
    $('a[href*="/download-"]').each((_, el) => {
      const t = clean($(el).text()).toLowerCase();
      // لینک‌های related که اسم سریال دیگه‌ان
      if (t.includes('download ') && !t.includes(cleanQuery.toLowerCase().split(' ')[0])) {
        // نگهشون می‌داریم فقط اگر داخل محتوای اصلی باشن، بعداً فیلتر می‌کنیم
      }
    });

    const options = [];
    const seen = new Set();

    // روش مطمئن: تمام لینک‌های episodes.modpro.blog (و مشابه) رو پیدا کن
    // و متن سیزن نزدیک‌شون رو بخون
    $('a[href*="modpro.blog"], a[href*="driveseed"], a[href*="unblockedgames"], a[href*="modlinks"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.startsWith('http') || seen.has(href)) return;

      const btnText = clean($(el).text()) || clean($(el).find('.mb-text').text()) || 'Download';

      // متن اطراف برای فهمیدن سیزن و کیفیت
      let context = '';
      const parent = $(el).parent();
      context += clean(parent.text()) + ' ';
      context += clean(parent.prev().text()) + ' ';
      context += clean(parent.prev().prev().text()) + ' ';
      context += clean($(el).closest('p, div').prev().text()) + ' ';

      // چند المان قبلی رو هم چک کن
      let prev = parent.prev();
      for (let i = 0; i < 4 && prev.length; i++) {
        context += clean(prev.text()) + ' ';
        prev = prev.prev();
      }

      const lowerContext = context.toLowerCase();

      // فیلتر سیزن
      if (requestedSeason) {
        const seasonOk = new RegExp(`(?:season\\s*|s)\\s*0*${requestedSeason}\\b`, 'i').test(context);
        if (!seasonOk) return;
      }

      // رد کردن related posts (اسم سریال‌های دیگه)
      const foreign = ['solar opposites', 'victor lessard', 'citadel', 'house of the dragon', 'silo', 'outer banks', 'bridgerton', 'ted lasso'];
      const queryFirst = cleanQuery.toLowerCase().split(/\s+/)[0];
      for (const f of foreign) {
        if (lowerContext.includes(f) && !f.includes(queryFirst) && !queryFirst.includes(f.split(' ')[0])) {
          return;
        }
      }

      // ساخت لیبل
      let label = '';
      const seasonMatch = context.match(/Season\s*\d+\s*\{[^}]+\}[^\n[]*(?:480p|720p|1080p|2160p)[^\n[]*(?:\[[^\]]+\])?/i);
      if (seasonMatch) {
        label = seasonMatch[0].trim();
      } else {
        // ساده‌تر
        const m = context.match(/(Season\s*\d+[^\n]{0,60}(?:480p|720p|1080p)[^\n]{0,40})/i);
        label = m ? m[1].trim() : context.slice(0, 80).trim();
      }

      if (!label || label.length < 5) label = btnText;
      label = `${label} — ${btnText}`.replace(/\s+/g, ' ').trim().slice(0, 130);

      seen.add(href);
      options.push({
        id: options.length + 1,
        label,
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
      options: options.slice(0, 20)
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Scraper failed'
    });
  }
};