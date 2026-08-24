const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawQuery = req.query.url;
  const requestedSeason = req.query.season ? String(req.query.season).trim() : null;

  if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'The "url" parameter is required'
    });
  }

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://moviesmod.zone/'
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  const cleanText = (text = '') => text.replace(/\s+/g, ' ').replace(/[\n\r\t]/g, ' ').trim();

  // ====================== فیلتر سیزن ======================
  const matchesSeason = (text) => {
    if (!requestedSeason) return true;
    const lower = text.toLowerCase();
    const num = requestedSeason.replace(/^0+/, '');
    return new RegExp(`(?:season\\s*|s)0*${num}\\b`, 'i').test(lower);
  };

  // ====================== فیلتر عنوان (نسخه متعادل) ======================
  const isRelevantToQuery = (label, query) => {
    if (!label || !query) return true;

    const lowerLabel = label.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // کلمات مهم عنوان (کلمات کوتاه و بی‌معنی رو حذف کن)
    const stopWords = ['the', 'and', 'for', 'with', 'season', 'episode', 'download', 'hindi', 'english', 'dual', 'audio'];
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

    if (queryWords.length === 0) return true;

    // حداقل یکی از کلمات عنوان داخل لیبل باشه
    const hasMatch = queryWords.some(w => lowerLabel.includes(w));
    if (!hasMatch) return false;

    // سریال‌های معروف دیگه (خود عنوان فعلی رو از لیست خارج می‌کنیم)
    const foreignTitles = [
      'solar opposites', 'victor lessard', 'citadel', 'house of the dragon',
      'silo', 'outer banks', 'the boys', 'bridgerton', 'ted lasso',
      'the night agent', 'fallout', 'shogun', 'the last of us',
      'stranger things', 'wednesday', 'euphoria', 'succession'
    ].filter(t => !queryWords.some(w => t.includes(w)));

    for (const foreign of foreignTitles) {
      if (lowerLabel.includes(foreign)) return false;
    }

    return true;
  };

  const validDomains = [
    'nexdrive', 'gdtot', 'pixeldrain', 'fastserver', 'drive.google',
    'mega.nz', 'mediafire', 'workers.dev', 'hubcloud', 'gdflix',
    'filepress', 'dropgalaxy', 'streamtape', 'dood', 'mixdrop',
    'driveseed', 'driveleech',
    'modpro.blog', 'links.modpro', 'modlinks', 'modrefer',
    'unblockedgames.world', 'tech.unblockedgames', 'cloud.unblockedgames',
    'oddfirm', 'techmny'
  ];

  const invalidKeywords = [
    'facebook', 'twitter', 'instagram', 'telegram', 't.me',
    'wp-content', 'javascript', 'mailto:', 'whatsapp', 'discord',
    'youtube.com', 'youtu.be', 'imdb.com', 'wikipedia'
  ];

  const isValidDownloadLink = (href = '', text = '') => {
    const lowerHref = href.toLowerCase();
    const lowerText = text.toLowerCase();

    if (!href.startsWith('http')) return false;
    if (invalidKeywords.some(kw => lowerHref.includes(kw))) return false;

    // لینک صفحه فیلم/سریال دیگه رو رد کن
    if (lowerHref.includes('moviesmod') && lowerHref.includes('/download-') &&
        !/episode links|batch|zip|server|drive|google/i.test(lowerText)) {
      return false;
    }

    const hasValidDomain = validDomains.some(d => lowerHref.includes(d));
    const hasDownloadKeyword =
      /episode links|batch\/zip|batch|zip file|download|google drive|fast server|480p|720p|1080p/i.test(lowerText) ||
      /modpro|unblockedgames|driveseed|nexdrive|gdtot|drive/i.test(lowerHref);

    return hasValidDomain || hasDownloadKeyword;
  };

  // ====================== Clean Query ======================
  const isDirectUrl = rawQuery.startsWith('http');
  const cleanSearchQuery = isDirectUrl
    ? rawQuery
    : rawQuery
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

  // ====================== استخراج لینک ======================
  const extractLinksFromHtml = (html, query) => {
    const $ = cheerio.load(html);
    const downloadOptions = [];
    const seenLinks = new Set();

    // حذف بخش‌های Related / Popular
    $('.related-posts, .popular-posts, .more-posts, .jp-relatedposts, aside, .sidebar').remove();
    $('h2, h3, h4').each((_, el) => {
      const t = cleanText($(el).text()).toLowerCase();
      if (/(related|popular|you may also|more posts|recommended)/i.test(t)) {
        $(el).nextUntil('h2').remove();
        $(el).remove();
      }
    });

    $('h2, h3, h4, strong, p').each((_, el) => {
      const headingText = cleanText($(el).text());

      // فقط هدینگ‌هایی که کیفیت یا سیزن دارن
      if (!/(480p|720p|1080p|2160p|4k|season\s*\d|s0?\d|web-dl|bluray|msubs|esubs)/i.test(headingText)) return;
      if (headingText.length > 150) return;

      // فیلتر سیزن
      if (!matchesSeason(headingText)) return;

      // فیلتر عنوان
      if (!isRelevantToQuery(headingText, query)) return;

      const candidates = $(el).find('a[href^="http"]')
        .add($(el).nextUntil('h2, h3, h4').find('a[href^="http"]').slice(0, 8));

      candidates.each((_, aEl) => {
        const href = $(aEl).attr('href') || '';
        const text = cleanText($(aEl).text());

        if (!isValidDownloadLink(href, text)) return;
        if (seenLinks.has(href)) return;

        let label = headingText;
        if (text && /episode links|batch|zip|download|google drive|fast server/i.test(text)) {
          label = `${headingText} — ${text}`;
        }

        if (!isRelevantToQuery(label, query)) return;

        seenLinks.add(href);
        downloadOptions.push({
          id: downloadOptions.length + 1,
          label: label.slice(0, 120),
          link: href
        });
      });
    });

    return downloadOptions;
  };

  // ====================== STAGE 1: WordPress API ======================
  try {
    const wpApiUrl = `https://moviesmod.zone/wp-json/wp/v2/posts?search=${encodeURIComponent(cleanSearchQuery)}&per_page=6&_fields=id,title,content,link`;

    const wpRes = await fetchWithTimeout(wpApiUrl, {
      headers: { ...customHeaders, 'Accept': 'application/json' }
    }, 6000);

    if (wpRes.ok) {
      const posts = await wpRes.json();

      if (Array.isArray(posts) && posts.length > 0) {
        const scored = posts.map(post => {
          const title = (post.title?.rendered || '').toLowerCase();
          const query = cleanSearchQuery.toLowerCase();
          let score = 0;

          if (title.includes(query)) score += 12;
          query.split(/\s+/).forEach(w => {
            if (w.length > 2 && title.includes(w)) score += 3;
          });
          if (title.includes('download')) score += 2;

          return { post, score, title };
        });

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];

        // آستانه امتیاز رو کمی پایین آوردم
        if (best && best.score >= 3) {
          const content = best.post.content?.rendered || '';
          if (content) {
            const options = extractLinksFromHtml(content, cleanSearchQuery);

            if (options.length > 0) {
              return res.status(200).json({
                success: true,
                source: 'WordPress_REST_API',
                query: cleanSearchQuery,
                matchedTitle: best.post.title?.rendered || null,
                season: requestedSeason || null,
                totalOptions: options.length,
                options: options.slice(0, 15)
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[WP Stage Failed]', err.message);
  }

  // ====================== STAGE 2: Legacy Scraper ======================
  try {
    let targetPageUrl = rawQuery;

    if (!isDirectUrl) {
      const searchUrl = `https://moviesmod.zone/?s=${encodeURIComponent(cleanSearchQuery)}`;
      const searchRes = await fetchWithTimeout(searchUrl, { headers: customHeaders }, 7000);
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);

      let foundLink = null;
      let bestScore = -1;

      $search('a[href*="moviesmod.zone"]').each((_, el) => {
        const href = $search(el).attr('href') || '';
        const text = cleanText($search(el).text());
        if (!href.includes('moviesmod.zone')) return;
        if (/request|dmca|about|contact/i.test(href + text)) return;
        if (text.length < 6) return;

        const fullHref = href.startsWith('http') ? href : `https://moviesmod.zone${href}`;
        const lowerText = text.toLowerCase();
        const queryWords = cleanSearchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);

        let score = 0;
        queryWords.forEach(w => { if (lowerText.includes(w)) score += 3; });
        if (lowerText.includes('download')) score += 4;
        if (lowerText.includes(cleanSearchQuery.toLowerCase())) score += 10;

        if (score > bestScore) {
          bestScore = score;
          foundLink = fullHref;
        }
      });

      if (!foundLink || bestScore < 3) {
        return res.status(200).json({
          success: false,
          stage: 'SEARCH_FAILED',
          message: `No good match found for "${cleanSearchQuery}".`
        });
      }

      targetPageUrl = foundLink;
    }

    const pageRes = await fetchWithTimeout(targetPageUrl, { headers: customHeaders }, 8000);
    const pageHtml = await pageRes.text();
    const downloadOptions = extractLinksFromHtml(pageHtml, cleanSearchQuery);

    if (downloadOptions.length === 0) {
      return res.status(200).json({
        success: false,
        stage: 'PARSING_FAILED',
        targetUrl: targetPageUrl,
        season: requestedSeason || null,
        message: requestedSeason
          ? `No links found for Season ${requestedSeason}.`
          : 'No valid download links extracted.'
      });
    }

    return res.status(200).json({
      success: true,
      source: 'Legacy_Scraper',
      targetUrl: targetPageUrl,
      query: cleanSearchQuery,
      season: requestedSeason || null,
      totalOptions: downloadOptions.length,
      options: downloadOptions.slice(0, 15)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to connect'
    });
  }
};