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
    'Referer': 'https://moviesmods.best/'
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 7000) => {
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

  // Valid & invalid domain filters
  const validDomains = [
    'nexdrive', 'gdtot', 'pixeldrain', 'fastserver', 'drive.google',
    'mega.nz', 'mediafire', 'workers.dev', 'hubcloud', 'gdflix',
    'filepress', 'dropgalaxy', 'streamtape', 'dood', 'mixdrop'
  ];

  const invalidKeywords = [
    'facebook', 'twitter', 'instagram', 'telegram', 't.me',
    'wp-content', 'modpro.blog', 'moviesmods.best', 'javascript',
    'mailto:', 'whatsapp', 'discord'
  ];

  const isValidDownloadLink = (href = '', text = '') => {
    const lowerHref = href.toLowerCase();
    const lowerText = text.toLowerCase();

    if (!href.startsWith('http')) return false;
    if (invalidKeywords.some(kw => lowerHref.includes(kw))) return false;

    const hasValidDomain = validDomains.some(d => lowerHref.includes(d));
    const hasDownloadKeyword =
      /download|click here|480p|720p|1080p|2160p|4k|web-dl|bluray|hdts|hdcam/i.test(lowerText) ||
      /download|file|drive|nexdrive|gdtot/i.test(lowerHref);

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
    const wpApiUrl = `https://episodes.modpro.blog/wp-json/wp/v2/posts?search=${encodeURIComponent(cleanSearchQuery)}&per_page=8&_fields=id,title,content,link`;

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

        // Prioritize posts whose title is more similar to the query
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

          $('a[href^="http"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const text = cleanText($(el).text());

            if (!isValidDownloadLink(href, text)) return;
            if (seenLinks.has(href)) return;

            // Build a clean label
            let label = cleanText(
              $(el).prev().text() ||
              $(el).parent().prev().text() ||
              $(el).closest('p, div, li').prev().text() ||
              text
            );

            if (!label || label.length > 80 || label.length < 3) {
              label = text || `Option ${downloadOptions.length + 1}`;
            }

            // Append quality if found in the link text
            const qualityMatch = text.match(/(480p|720p|1080p|2160p|4K|WEB-DL|BluRay|HDTS|HDCAM)/i);
            if (qualityMatch && !label.toLowerCase().includes(qualityMatch[0].toLowerCase())) {
              label += ` [${qualityMatch[0]}]`;
            }

            seenLinks.add(href);
            downloadOptions.push({
              id: downloadOptions.length + 1,
              label: label,
              link: href
            });
          });

          // Stop early if we already have enough links
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

  // ====================== STAGE 2: moviesmods.best (Legacy) ======================
  try {
    let targetPageUrl = rawQuery;

    // If not a direct URL → search
    if (!isDirectUrl) {
      const searchUrl = `https://moviesmods.best/?do=search&subaction=search&story=${encodeURIComponent(cleanSearchQuery)}`;

      const searchRes = await fetchWithTimeout(searchUrl, {
        headers: customHeaders
      }, 6500);

      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);

      let foundLink = null;
      let bestScore = -1;

      $search('a[href*=".html"]').each((_, el) => {
        const href = $search(el).attr('href') || '';
        const text = cleanText($search(el).text());
        const titleAttr = $search(el).attr('title') || '';

        if (!href.includes('moviesmods.best')) return;
        if (href.includes('request') || href.includes('dmca') || href.includes('about')) return;
        if (text.length < 8) return;

        const fullHref = href.startsWith('http') ? href : `https://moviesmods.best${href}`;
        const lowerText = (text + ' ' + titleAttr).toLowerCase();
        const queryWords = cleanSearchQuery.toLowerCase().split(/\s+/);

        // Simple scoring to pick the best matching result
        let score = 0;
        queryWords.forEach(word => {
          if (word.length > 2 && lowerText.includes(word)) score += 1;
        });

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

    // Open the movie/series page
    const pageRes = await fetchWithTimeout(targetPageUrl, {
      headers: customHeaders
    }, 7000);

    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const downloadOptions = [];
    const seenLinks = new Set();

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

      if (!qualityLabel || qualityLabel.length > 60) {
        qualityLabel = text || `Option ${downloadOptions.length + 1}`;
      }

      // Extract size if present inside brackets
      const sizeMatch = text.match(/\[([^\]]+)\]/);
      if (sizeMatch && !qualityLabel.includes(sizeMatch[0])) {
        qualityLabel += ` ${sizeMatch[0]}`;
      }

      seenLinks.add(href);
      downloadOptions.push({
        id: downloadOptions.length + 1,
        label: qualityLabel,
        link: href
      });
    });

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