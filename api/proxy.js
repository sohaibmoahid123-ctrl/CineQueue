// api/proxy.js
export default async function handler(req, res) {
  // تنظیم هدرهای CORS برای دسترسی کامل فرانت‌اند
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': new URL(decodedUrl).origin
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('Stream error');
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    res.setHeader('Content-Type', contentType);

    const data = await response.arrayBuffer();
    return res.status(200).send(Buffer.from(data));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
