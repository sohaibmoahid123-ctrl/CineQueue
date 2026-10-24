const feeds = [
  { sport: 'Football', league: 'Premier League', slug: 'soccer/eng.1', priority: 100 },
  { sport: 'Football', league: 'Champions League', slug: 'soccer/uefa.champions', priority: 95 },
  { sport: 'Basketball', league: 'NBA', slug: 'basketball/nba', priority: 90 },
  { sport: 'Tennis', league: 'ATP', slug: 'tennis/atp', priority: 70 },
  { sport: 'Motorsport', league: 'Formula 1', slug: 'racing/f1', priority: 80 }
];

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'CineQueue/1.0' }
    });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    if (!response.ok) return null;
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function getDay(status, startTime) {
  try {
    const date = new Date(startTime);
    const today = new Date();
    return date.toDateString() === today.toDateString() ? 'today' : 'upcoming';
  } catch {
    return 'today';
  }
}

function teamMark(name) {
  return String(name || '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
}

function teamLogo(team) {
  return team?.team?.logos?.[0]?.href || team?.team?.logo || team?.logo || '';
}

// گرفتن جدول مسابقات از ESPN
async function getEspnMatches() {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10).replace(/-/g, '');
  
  const responses = await Promise.allSettled(feeds.map(async feed => {
    const data = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${feed.slug}/scoreboard?dates=${dateKey}`);
    if (!data || !data.events) return [];
    
    return data.events.map(event => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors || [];
      const home = competitors.find(t => t.homeAway === 'home') || competitors[0] || {};
      const away = competitors.find(t => t.homeAway === 'away') || competitors[1] || {};
      const homeName = home.team?.displayName || home.team?.name || '';
      const awayName = away.team?.displayName || away.team?.name || '';
      if (!event.id || !homeName || !awayName) return null;

      const startTime = event.date || new Date().toISOString();

      return {
        id: `espn-${event.id}`,
        title: `${homeName} vs ${awayName}`,
        homeTeam: homeName,
        awayTeam: awayName,
        league: event.league?.name || competition?.league?.name || feed.league,
        sport: feed.sport,
        home: homeName,
        away: awayName,
        homeMark: teamMark(homeName),
        awayMark: teamMark(awayName),
        homeLogo: teamLogo(home),
        awayLogo: teamLogo(away),
        status: 'SCHEDULED',
        day: 'today',
        popular: feed.priority >= 90,
        priority: feed.priority,
        kickoffTime: startTime,
        time: 'SCHEDULED',
        accent: feed.sport === 'Football' ? '#e50914' : '#f59e0b',
        embedUrl: '',
        streamAvailable: false
      };
    }).filter(Boolean);
  }));

  return responses.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// گرفتن استریوم‌های زنده مستقیماً از streamed.pk (منبع اصلی)
async function getStreamedPkLiveMatches() {
  const liveList = [];
  const categories = ['football', 'basketball', 'motorsport', 'tennis'];

  for (const cat of categories) {
    try {
      const matchesData = await fetchJson(`https://streamed.pk/api/matches/${cat}`);
      if (!matchesData || !Array.isArray(matchesData)) continue;

      for (const match of matchesData) {
        if (match.sources && match.sources.length > 0) {
          const sourceObj = match.sources[0];
          const streamData = await fetchJson(`https://streamed.pk/api/stream/${sourceObj.source}/${sourceObj.id}`);
          
          if (streamData) {
            const streamItem = Array.isArray(streamData) ? streamData[0] : streamData;
            const rawUrl = streamItem?.url || streamItem?.embedUrl || streamItem?.file;
            
            if (rawUrl) {
              const proxyUrl = `/api/proxy?url=` + encodeURIComponent(rawUrl);
              const homeName = match.teams?.home?.name || match.homeTeam || 'Home';
              const awayName = match.teams?.away?.name || match.awayTeam || 'Away';

              liveList.push({
                id: `streamed-${match.id || Math.random()}`,
                title: match.title || `${homeName} vs ${awayName}`,
                homeTeam: homeName,
                awayTeam: awayName,
                league: match.league?.name || 'Live Stream',
                sport: cat.charAt(0).toUpperCase() + cat.slice(1),
                home: homeName,
                away: awayName,
                homeMark: teamMark(homeName),
                awayMark: teamMark(awayName),
                homeLogo: match.teams?.home?.badge || '',
                awayLogo: match.teams?.away?.badge || '',
                status: 'LIVE', // به صورت پیش‌فرض لایو در نظر گرفته می‌شود چون سایت اصلی در حال پخش آن است
                day: 'today',
                popular: true,
                priority: 150, // اولویت بالا برای اینکه بیاید بالای لیست
                kickoffTime: match.date || new Date().toISOString(),
                time: 'LIVE',
                accent: '#e50914',
                embedUrl: proxyUrl,
                streamAvailable: true
              });
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error in streamed.pk fetch for ${cat}:`, err.message);
    }
  }
  return liveList;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ۱. دریافت لیست مسابقات زنده مستقیماً از سایت مرجع (streamed.pk)
    let streamedMatches = await getStreamedPkLiveMatches();
    
    // ۲. دریافت جدول تکمیلی از ESPN
    let espnMatches = await getEspnMatches();

    // ۳. ادغام هوشمند: تطبیق بازی‌های ESPN با استریم‌های واقعی سایت مرجع
    espnMatches.forEach(espnMatch => {
      const h = espnMatch.home.toLowerCase();
      const a = espnMatch.away.toLowerCase();

      // پیدا کردن تطابق در بازی‌های زنده سایت مرجع
      const matchedLive = streamedMatches.find(sm => {
        const sh = sm.home.toLowerCase();
        const sa = sm.away.toLowerCase();
        return (sh.includes(h) || h.includes(sh)) && (sa.includes(a) || a.includes(sa));
      });

      if (matchedLive) {
        // بازنویسی وضعیت به صورت قطعی روی حالت LIVE (بی‌توجه به اشتباهات ساعت ESPN)
        espnMatch.embedUrl = matchedLive.embedUrl;
        espnMatch.streamAvailable = true;
        espnMatch.status = 'LIVE';
        espnMatch.time = 'LIVE';
        espnMatch.priority = 200; // آوردن به بالای لیست
      }
    });

    // ترکیب همه موارد و حذف تکراری‌ها (اولویت با مسابقاتی که استریم فعال دارند)
    let allMatches = [...streamedMatches, ...espnMatches];
    allMatches = [...new Map(allMatches.map(m => [m.id, m])).values()];
    
    // مرتب‌سازی: اول بازی‌های لایو و دارای استریم، بعد بقیه
    allMatches.sort((a, b) => (b.status === 'LIVE') - (a.status === 'LIVE') || b.priority - a.priority);

    return res.status(200).json({ 
      success: true, 
      source: 'CineQueue Smart Sync', 
      matches: allMatches.slice(0, 60) 
    });

  } catch (error) {
    console.error('Sports feed error:', error);
    return res.status(502).json({ 
      success: false, 
      error: error.message || 'Sports feed unavailable', 
      matches: [] 
    });
  }
};
