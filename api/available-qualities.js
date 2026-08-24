const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // ====================== CORS ======================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawQuery = req.query.url;

  if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'The "url" parameter is required (movie/series title or full link)'
    });
  }

  // ====================== Helpers ======================
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
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\n\r\t]/g, ' ')
      .trim();
  };

  // دامنه‌های معتبر (نهایی + واسط‌های شناخته‌شده MoviesMod)
  const validDomains = [
    // نهایی
    'nexdrive', 'gdtot', 'pixeldrain', 'fastserver', 'drive.google',
    'mega.nz', 'mediafire', 'workers.dev', 'hubcloud', 'gdflix',
    'filepress', 'dropgalaxy', 'streamtape', 'dood', 'mixdrop',
    'driveseed', 'driveleech',
    // واسط‌های MoviesMod
    'modpro.blog', 'links.modpro', 'modlinks', 'modrefer',
    'unblockedgames.world', 'tech.unblockedgames', 'cloud.unblockedgames',
    'oddfirm', 'techmny', 'en.techmny'
  ];

  // فقط چیزهایی که واقعاً نباید میان
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

    // خود دامنه moviesmod رو رد کن (لینک‌های داخلی صفحه)
    if (lowerHref.includes('moviesmod.zone') || lowerHref.includes('moviesmod.')) {
      // فقط اگر لینک دانلود واقعی باشه قبول کن (نادر)
      if (!/download|drive|server|file/i.test(lowerText + lowerHref)) return false;
    }

    const hasValidDomain = validDomains.some(d => lowerHref.includes(d));
    const hasDownloadKeyword =
      /download|click here|480p|720p|1080p|2160p|4k|web-dl|bluray|hdts|hdcam|google drive|fast server|instant/i.test(lowerText) ||
      /download|file|drive|nexdrive|gdtot|driveseed|modpro|unblockedgames/i.test(lowerHref);

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

  // ====================== STAGE 1: WordPress REST API ======================
  try {
    const wpApiUrl = `https://moviesmod.zone/wp-json/wp/v2/posts?search=${encodeURIComponent(cleanSearchQuery)}&per_page=8&_fields=id,title,content,link`;

    const wpRes = await fetchWithTimeout(wpApiUrl, {
      headers: {
        ...customHeaders,
        'Accept': 'application/json'
      }
    }, 6000);

    if (wpRes.ok) {
      const posts = await wpRes.json();

      if (Array.isArray(posts) && posts.length > 0) {
        const downloadOptions = [];
        const seenLinks = new Set();

        const sortedPosts = posts.sort((a, b) => {
          const titleA = (a.title?.rendered || '').toLowerCase();
          const titleB = (b.title?.rendered || '').toLowerCase();
          const query = cleanSearchQuery.toLowerCase();

          const scoreA = titleA.includes(query) ? 2 : (query.split(' ').some(w => titleA.includes(w)) ? 1 : 0);
          const scoreB = titleB.includes(query) ? 2 : (query.split(' ').some(w => titleB.includes(w)) ? 1 : 0);
          return scoreB - scoreA;
        });

        for (const post of sortedPosts) {
          const content = post.content?.rendered || '';
          if (!content) continue;

          const $ = cheerio.load(content);

          // اول سعی کن لینک‌های نزدیک به هدینگ‌های کیفیت رو پیدا کنی
          $('h3, h4, strong, p, div').each((_, el) => {
            const headingText = cleanText($(el).text());
            if (!/(480p|720p|1080p|2160p|4k|web-dl|bluray)/i.test(headingText)) return;

            // لینک‌های داخل یا بلافاصله بعد از این هدینگ
            const links = $(el).find('a[href^="http"]').add($(el).nextAll().find('a[href^="http"]').slice(0, 6));

            links.each((_, aEl) => {
              const href = $(aEl).attr('href') || '';
              const text = cleanText($(aEl).text());

              if (!isValidDownloadLink(href, text)) return;
              if (seenLinks.has(href)) return;

              let label = headingText.length > 5 && headingText.length < 90
                ? headingText
                : (text || `Option ${downloadOptions.length + 1}`);

              // کیفیت رو اگر نبود اضافه کن
              const qualityMatch = (headingText + ' ' + text).match(/(480p|720p|1080p|2160p|4K)/i);
              if (qualityMatch && !label.toLowerCase().includes(qualityMatch[0].toLowerCase())) {
                label += ` [${qualityMatch[0]}]`;
              }

              seenLinks.add(href);
              downloadOptions.push({
                id: downloadOptions.length + 1,
                label: label.slice(0, 100),
                link: href
              });
            });
          });

          // اگر هنوز لینک کم داریم، همه لینک‌های معتبر رو هم جمع کن
          if (downloadOptions.length < 6) {
            $('a[href^="http"]').each((_, el) => {
              const href = $(el).attr('href') || '';
              const text = cleanText($(el).text());

              if (!isValidDownloadLink(href, text)) return;
              if (seenLinks.has(href)) return;

              let label = cleanText(
                $(el).prev().text() ||
                $(el).parent().prev().text() ||
                $(el).closest('p, div, li').prev().text() ||
                text
              );

              if (!label || label.length > 80 || label.length < 3) {
                label = text || `Option ${downloadOptions.length + 1}`;
              }

              const qualityMatch = text.match(/(480p|720p|1080p|2160p|4K|WEB-DL|BluRay)/i);
              if (qualityMatch && !label.toLowerCase().includes(qualityMatch[0].toLowerCase())) {
                label += ` [${qualityMatch[0]}]`;
              }

              seenLinks.add(href);
              downloadOptions.push({
                id: downloadOptions.length + 1,
                label: label.slice(0, 100),
                link: href
              });
            });
          }

          if (downloadOptions.length >= 12) break;
        }

        if (downloadOptions.length > 0) {
          return res.status(200).json({
            success: true,
            source: 'WordPress_REST_API',
            query: cleanSearchQuery,
            totalOptions: downloadOptions.length,
            options: downloadOptions.slice(0, 15)
          });
        }
      }
    }
  } catch (err) {
    console.warn('[WP Stage Failed]', err.message);
  }

  // ====================== STAGE 2: moviesmod.zone (Legacy Scraper) ======================
  try {
    let targetPageUrl = rawQuery;

    if (!isDirectUrl) {
      const searchUrl = `https://moviesmod.zone/?s=${encodeURIComponent(cleanSearchQuery)}`;

      const searchRes = await fetchWithTimeout(searchUrl, {
        headers: customHeaders
      }, 7000);

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
        const queryWords = cleanSearchQuery.toLowerCase().split(/\s+/);

        let score = 0;
        queryWords.forEach(word => {
          if (word.length > 2 && lowerText.includes(word)) score += 1;
        });

        // امتیاز بیشتر به لینک‌هایی که "download" دارن
        if (lowerText.includes('download')) score += 2;

        if (score > bestScore) {
          bestScore = score;
          foundLink = fullHref;
        }
      });

      if (!foundLink) {
        return res.status(200).json({
          success: false,
          stage: 'SEARCH_FAILED',
          message: `No results found for "${cleanSearchQuery}".`
        });
      }

      targetPageUrl = foundLink;
    }

    // صفحه فیلم رو باز کن
    const pageRes = await fetchWithTimeout(targetPageUrl, {
      headers: customHeaders
    }, 8000);

    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];
    const seenLinks = new Set();

    // روش بهتر: اول هدینگ‌های کیفیت رو پیدا کن، بعد لینک‌های نزدیکشون
    $('h2, h3, h4, strong, p').each((_, el) => {
      const headingText = cleanText($(el).text());
      if (!/(480p|720p|1080p|2160p|4k|season\s*\d|episode|web-dl|bluray|download)/i.test(headingText)) return;
      if (headingText.length > 120) return;

      // لینک‌های داخل خود المان + چند المان بعدی
      const candidates = $(el).find('a[href^="http"]')
        .add($(el).nextUntil('h2, h3, h4').find('a[href^="http"]').slice(0, 8));

      candidates.each((_, aEl) => {
        const href = $(aEl).attr('href') || '';
        const text = cleanText($(aEl).text());

        if (!isValidDownloadLink(href, text)) return;
        if (seenLinks.has(href)) return;

        let label = headingText.length >= 5 ? headingText : (text || `Option ${downloadOptions.length + 1}`);

        // سایز اگر داخل متن باشه
        const sizeMatch = (headingText + ' ' + text).match(/\[?\d+(\.\d+)?\s*(MB|GB)\]?/i);
        if (sizeMatch && !label.includes(sizeMatch[0])) {
          label += ` ${sizeMatch[0]}`;
        }

        seenLinks.add(href);
        downloadOptions.push({
          id: downloadOptions.length + 1,
          label: label.slice(0, 100),
          link: href
        });
      });
    });

    // اگر هنوز کم بود، همه لینک‌های معتبر رو جمع کن
    if (downloadOptions.length < 4) {
      $('a[href^="http"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = cleanText($(el).text());

        if (!isValidDownloadLink(href, text)) return;
        if (seenLinks.has(href)) return;

        let qualityLabel = cleanText(
          $(el).parent().prev().text() ||
          $(el).closest('p, div').prev('p, h3, h4, strong').text() ||
          $(el).prev().text() ||
          text
        );

        if (!qualityLabel || qualityLabel.length > 70) {
          qualityLabel = text || `Option ${downloadOptions.length + 1}`;
        }

        const sizeMatch = text.match(/\[([^\]]+)\]/);
        if (sizeMatch && !qualityLabel.includes(sizeMatch[0])) {
          qualityLabel += ` ${sizeMatch[0]}`;
        }

        seenLinks.add(href);
        downloadOptions.push({
          id: downloadOptions.length + 1,
          label: qualityLabel.slice(0, 100),
          link: href
        });
      });
    }

    if (downloadOptions.length === 0) {
      return res.status(200).json({
        success: false,
        stage: 'PARSING_FAILED',
        targetUrl: targetPageUrl,
        message: 'Page was found, but no valid download links could be extracted.'
      });
    }

    return res.status(200).json({
      success: true,
      source: 'Legacy_Scraper',
      targetUrl: targetPageUrl,
      query: cleanSearchQuery,
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