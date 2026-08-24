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
  const requestedEpisode = req.query.episode ? String(req.query.episode).trim() : null;

  if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'The "url" parameter is required (movie/series title or full link)'
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

  const cleanText = (text = '') => {
    return text.replace(/\s+/g, ' ').replace(/[\n\r\t]/g, ' ').trim();
  };

  // ====================== تشخیص سیزن ======================
  const matchesSeason = (text) => {
    if (!requestedSeason) return true;
    const lower = text.toLowerCase();
    const seasonNum = requestedSeason.replace(/^0+/, '');
    const patterns = [
      new RegExp(`season\\s*0*${seasonNum}\\b`, 'i'),
      new RegExp(`\\bs0*${seasonNum}\\b`, 'i'),
      new RegExp(`season0*${seasonNum}\\b`, 'i')
    ];
    return patterns.some(p => p.test(lower));
  };

  // ====================== تشخیص اینکه لیبل مربوط به همین عنوان هست یا نه ======================
  const isRelevantToQuery = (label, query) => {
    if (!label || !query) return true;

    const lowerLabel = label.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // کلمات کلیدی عنوان
    const queryWords = lowerQuery
      .split(/\s+/)
      .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'season', 'episode'].includes(w));

    if (queryWords.length === 0) return true;

    // حداقل یکی از کلمات مهم عنوان باید داخل لیبل باشه
    const hasQueryWord = queryWords.some(w => lowerLabel.includes(w));

    // لیست سریال‌های معروف که نباید قاطی بشن (برای جلوگیری از related posts)
    const foreignTitles = [
      'solar opposites', 'victor lessard', 'citadel', 'house of the dragon',
      'silo', 'outer banks', 'the boys', 'reacher', 'bridgerton', 'ted lasso',
      'the night agent', 'fallout', 'shogun', 'the last of us'
    ];

    // اگر لیبل اسم سریال دیگه‌ای رو داره و اسم سریال فعلی رو نداره → رد
    for (const foreign of foreignTitles) {
      if (lowerLabel.includes(foreign) && !queryWords.some(w => foreign.includes(w))) {
        // اگر خود query همون foreign باشه مشکلی نیست
        if (!lowerQuery.includes(foreign.split(' ')[0])) {
          return false;
        }
      }
    }

    return hasQueryWord;
  };

  const validDomains = [
    'nexdrive', 'gdtot', 'pixeldrain', 'fastserver', 'drive.google',
    'mega.nz', 'mediafire', 'workers.dev', 'hubcloud', 'gdflix',
    'filepress', 'dropgalaxy', 'streamtape', 'dood', 'mixdrop',
    'driveseed', 'driveleech',
    'modpro.blog', 'links.modpro', 'modlinks', 'modrefer',
    'unblockedgames.world', 'tech.unblockedgames', 'cloud.unblockedgames',
    'oddfirm', 'techmny', 'en.techmny'
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

    // لینک‌های داخلی moviesmod که صفحه فیلم دیگه‌ان رو رد کن
    if ((lowerHref.includes('moviesmod.zone') || lowerHref.includes('moviesmod.')) &&
        lowerHref.includes('/download-') &&
        !/episode|batch|zip|server|drive/i.test(lowerText)) {
      return false;
    }

    const hasValidDomain = validDomains.some(d => lowerHref.includes(d));
    const hasDownloadKeyword =
      /download|episode links|batch|zip file|click here|480p|720p|1080p|2160p|4k|web-dl|bluray|google drive|fast server|instant/i.test(lowerText) ||
      /download|file|drive|nexdrive|gdtot|driveseed|modpro|unblockedgames|episode|batch/i.test(lowerHref);

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

  // ====================== استخراج لینک فقط از محتوای اصلی ======================
  const extractLinksFromHtml = (html, query) => {
    const $ = cheerio.load(html);
    const downloadOptions = [];
    const seenLinks = new Set();

    // بخش‌های Related / Popular / More Posts رو کامل حذف کن تا لینک‌هاشون نیاد
    $('.related-posts, .popular-posts, .more-posts, .jp-relatedposts, #related, .sidebar, aside, footer').remove();
    $('h3, h4, h2').each((_, el) => {
      const t = cleanText($(el).text()).toLowerCase();
      if (t.includes('related') || t.includes('popular') || t.includes('you may also') || t.includes('more posts')) {
        $(el).nextUntil('h2, h3').remove();
        $(el).remove();
      }
    });

    // فقط هدینگ‌های کیفیت/سیزن داخل محتوای اصلی
    $('h2, h3, h4, strong, p').each((_, el) => {
      const headingText = cleanText($(el).text());

      if (!/(480p|720p|1080p|2160p|4k|season\s*\d|web-dl|bluray|msubs|esubs)/i.test(headingText)) return;
      if (headingText.length > 140) return;

      // فیلتر سیزن
      if (!matchesSeason(headingText)) return;

      // فیلتر عنوان (مربوط به همین سریال باشه)
      if (!isRelevantToQuery(headingText, query)) return;

      const candidates = $(el).find('a[href^="http"]')
        .add($(el).nextUntil('h2, h3, h4').find('a[href^="http"]').slice(0, 8));

      candidates.each((_, aEl) => {
        const href = $(aEl).attr('href') || '';
        const text = cleanText($(aEl).text());

        if (!isValidDownloadLink(href, text)) return;
        if (seenLinks.has(href)) return;

        // لینک صفحه فیلم دیگه رو رد کن
        if (href.includes('/download-') && href.includes('moviesmod') && !text.match(/episode|batch|zip|server|drive/i)) {
          return;
        }

        let label = headingText;

        if (text && /episode links|batch|zip|download|google drive|fast server/i.test(text)) {
          label = `${headingText} — ${text}`;
        }

        // دوباره چک کن لیبل نهایی مربوط به همین عنوان باشه
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

  // ====================== STAGE 1: WordPress REST API ======================
  try {
    const wpApiUrl = `https://moviesmod.zone/wp-json/wp/v2/posts?search=${encodeURIComponent(cleanSearchQuery)}&per_page=5&_fields=id,title,content,link`;

    const wpRes = await fetchWithTimeout(wpApiUrl, {
      headers: { ...customHeaders, 'Accept': 'application/json' }
    }, 6000);

    if (wpRes.ok) {
      const posts = await wpRes.json();

      if (Array.isArray(posts) && posts.length > 0) {
        // فقط بهترین پست رو انتخاب کن (نه همه)
        const scored = posts.map(post => {
          const title = (post.title?.rendered || '').toLowerCase();
          const query = cleanSearchQuery.toLowerCase();
          let score = 0;

          if (title.includes(query)) score += 10;
          query.split(' ').forEach(w => {
            if (w.length > 2 && title.includes(w)) score += 2;
          });
          // اگر "download" و اسم سریال با هم بودن امتیاز بیشتر
          if (title.includes('download') && score > 0) score += 3;

          return { post, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];

        // فقط اگر امتیاز قابل قبول باشه
        if (best && best.score >= 4) {
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
        const titleAttr = $search(el).attr('title') || '';

        if (!href.includes('moviesmod.zone')) return;
        if (href.includes('request') || href.includes('dmca') || href.includes('about')) return;
        if (text.length < 8) return;

        const fullHref = href.startsWith('http') ? href : `https://moviesmod.zone${href}`;
        const lowerText = (text + ' ' + titleAttr).toLowerCase();
        const queryWords = cleanSearchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);

        let score = 0;
        queryWords.forEach(word => {
          if (lowerText.includes(word)) score += 2;
        });
        if (lowerText.includes('download')) score += 3;
        // امتیاز بیشتر اگر تقریباً کل عنوان داخل متن باشه
        if (lowerText.includes(cleanSearchQuery.toLowerCase())) score += 8;

        if (score > bestScore) {
          bestScore = score;
          foundLink = fullHref;
        }
      });

      if (!foundLink || bestScore < 4) {
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
          ? `No download links found for Season ${requestedSeason}.`
          : 'Page was found, but no valid download links could be extracted.'
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
      error: error.message || 'Failed to connect to the destination server'
    });
  }
};