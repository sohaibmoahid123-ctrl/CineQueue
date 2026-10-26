// تست قدم‌به‌قدم: گرفتن اولین مسابقه زنده و اولین سرور
async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'CineQueue/1.0' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ۱. گرفتن لیست مسابقات فوتبال از API سایت مرجع
    const matches = await fetchJson('https://streamed.pk/api/matches/football');
    if (!matches || !matches.length) {
      return res.status(200).json({ success: false, message: 'No matches found', matches: [] });
    }

    // انتخاب دقیقاً همین اولین مسابقه (که در صفحه اول سایت هم اول است)
    const firstMatch = matches[0];
    let streamUrl = '';

    // ۲. بررسی وجود منابع (Sources) برای این مسابقه
    if (firstMatch.sources && firstMatch.sources.length > 0) {
      const sourceObj = firstMatch.sources[0]; // مثل admin
      
      // درخواست به صفحه دوم (همان ساختار مشخص سرورها مثل /admin/1)
      const streamData = await fetchJson(`https://streamed.pk/api/stream/${sourceObj.source}/${sourceObj.id}`);
      
      if (streamData) {
        const streamItem = Array.isArray(streamData) ? streamData[0] : streamData;
        const rawUrl = streamItem?.url || streamItem?.embedUrl || streamItem?.file;
        
        if (rawUrl) {
          // عبور دادن از پراکسی امن خودمان برای جلوگیری از خطای CORS و بلاک شدن
          streamUrl = `/api/proxy?url=` + encodeURIComponent(rawUrl);
        }
      }
    }

    const homeName = firstMatch.teams?.home?.name || 'Home';
    const awayName = firstMatch.teams?.away?.name || 'Away';

    // ساخت فرمت خروجی استاندارد برای پلیر سایت شما
    const formattedMatch = {
      id: `test-${firstMatch.id}`,
      title: firstMatch.title || `${homeName} vs ${awayName}`,
      homeTeam: homeName,
      awayTeam: awayName,
      league: firstMatch.league?.name || 'Live Match',
      sport: 'Football',
      home: homeName,
      away: awayName,
      homeLogo: firstMatch.teams?.home?.badge || '',
      awayLogo: firstMatch.teams?.away?.badge || '',
      status: 'LIVE',
      day: 'today',
      time: 'LIVE',
      accent: '#e50914',
      embedUrl: streamUrl,
      streamAvailable: !!streamUrl
    };

    return res.status(200).json({
      success: true,
      source: 'Step-by-Step Test Resolver',
      matches: [formattedMatch]
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, matches: [] });
  }
};
