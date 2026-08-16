const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const searchQuery = req.query.url;

  if (!searchQuery) {
    return res.status(400).json({ 
      success: false, 
      error: 'اسم فیلم یا لینک الزامی است' 
    });
  }

  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  };

  try {
    let postsData = [];

    // ۱. اگر لینک مستقیم داده شد یا اسم فیلم
    if (searchQuery.includes('modpro.blog/archives/')) {
      const postId = searchQuery.split('/archives/')[1].replace('/', '');
      const singlePostUrl = `https://episodes.modpro.blog/wp-json/wp/v2/posts/${postId}`;
      const postRes = await fetch(singlePostUrl, { headers: customHeaders });
      if (postRes.ok) postsData.push(await postRes.json());
    } else {
      const cleanQuery = searchQuery
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const apiUrl = `https://episodes.modpro.blog/wp-json/wp/v2/posts?search=${encodeURIComponent(cleanQuery)}&per_page=10`;
      const searchRes = await fetch(apiUrl, { headers: customHeaders });
      if (searchRes.ok) postsData = await searchRes.json();
    }

    if (!postsData || postsData.length === 0) {
      return res.status(200).json({ 
        success: false, 
        stage: 'SEARCH_FAILED', 
        message: `هیچ پستی برای "${searchQuery}" پیدا نشد.` 
      });
    }

    const results = [];

    // ۲. خواندن لینک‌های داخل پست‌ها
    for (const post of postsData) {
      const postTitle = post.title?.rendered || 'Unknown Title';
      const postContent = post.content?.rendered || '';
      const $ = cheerio.load(postContent);

      const links = [];

      $('a[href^="http"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        const isDownloadLink = 
          !href.includes('modpro.blog') && 
          !href.includes('telegram') && 
          !href.includes('wp-content');

        if (isDownloadLink) {
          let label = $(el).prev().text().trim() || $(el).parent().text().trim() || text;
          if (!label || label.length > 80) label = text || `Link ${links.length + 1}`;

          if (!links.some(l => l.link === href)) {
            links.push({
              id: links.length + 1,
              label: label.replace(/\s+/g, ' '),
              link: href
            });
          }
        }
      });

      if (links.length > 0) {
        results.push({
          postId: post.id,
          title: postTitle.replace(/&#8211;/g, '-').replace(/&#8217;/g, "'"),
          postUrl: post.link,
          totalLinks: links.length,
          downloadLinks: links
        });
      }
    }

    if (results.length === 0) {
      return res.status(200).json({ 
        success: false, 
        stage: 'PARSING_FAILED', 
        message: 'پست پیدا شد اما لینک دانلودی نداشت.' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      totalResults: results.length,
      data: results 
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
