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

function statusFromEvent(event) {
  const state = event.competitions?.[0]?.status?.type;
  if (state?.state === 'in') return 'LIVE';
  if (state?.completed) return 'FINAL';
  return 'SCHEDULED';
}

function teamMark(name) {
  return String(name || '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
}

function teamLogo(team) {
  return team?.team?.logos?.[0]?.href || team?.team?.logo || team?.logo || '';
}

function formatKickoff(startTime) {
  try {
    return new Date(startTime).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'LIVE';
  }
}

// ۱. دریافت جدول دقیق مسابقات از ESPN (برای حفظ لوگوهای سالم، تاریخ‌ها و وضعیت واقعی)
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

      const status = statusFromEvent(event);
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
        status,
        day: getDay(status, startTime),
        popular: feed.priority >= 90,
        priority: feed.priority,
        kickoffTime: startTime,
        time: status === 'LIVE' ? 'LIVE' : formatKickoff(startTime),
        accent: feed.sport === 'Football' ? '#e50914' : '#f59e0b',
        embedUrl: '',
        streamAvailable: false
      };
    }).filter(Boolean);
  }));

  return responses.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ۲. استخراج سرورها و استریم‌های واقعیِ در حال پخش از streamed.pk
async function getStreamedPkLivePool() {
  const liveMap = new Map();
  const categories = ['football', 'basketball', 'motorsport', 'tennis'];

  for (const cat of categories) {
    try {
      const matchesData = await fetchJson(`https://streamed.pk/api/matches/${cat}`);
      if (!matchesData || !Array.isArray(matchesData)) continue;

      for (const match of matchesData) {
        if (match.sources && match.sources.length > 0) {
          // بررسی سرور اول (یا انتخاب بهترین منبع)
          const sourceObj = match.sources[0]; 
          const streamData = await fetchJson(`https://streamed.pk/api/stream/${sourceObj.source}/${sourceObj.id}`);
          
          if (streamData) {
            const streamItem = Array.isArray(streamData) ? streamData[0] : streamData;
            const rawUrl = streamItem?.url || streamItem?.embedUrl || streamItem?.file;
            
            if (rawUrl) {
              const proxyUrl = `/api/proxy?url=` + encodeURIComponent(rawUrl);
              const homeN = (match.teams?.home?.name || match.homeTeam || '').toLowerCase();
              const awayN = (match.teams?.away?.name || match.awayTeam || '').toLowerCase();
              
              if (homeN && awayN) {
                liveMap.set(`${homeN}_${awayN}`, proxyUrl);
                liveMap.set(`${awayN}_${homeN}`, proxyUrl);
              }
              if (match.title) {
                liveMap.set(match.title.toLowerCase(), proxyUrl);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(`Streamed.pk pool error for ${cat}:`, err.message);
    }
  }
  return liveMap;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ۱. دریافت جدول اصلی و استاندارد مسابقات
    let matches = await getEspnMatches();

    // ۲. دریافت استریم‌های زنده‌ای که الان روی سایت مرجع فعال هستند
    let streamedLiveMap = new Map();
    try {
      streamedLiveMap = await getStreamedPkLivePool();
    } catch (e) {
      console.warn('Streamed.pk live pool fetch failed:', e.message);
    }

    // ۳. تطبیق هوشمند: فقط به بازی‌هایی که الان در سایت مرجع استریمِ فعال دارند لینک لایو بدهیم
    matches.forEach(match => {
      const h = match.home.toLowerCase();
      const a = match.away.toLowerCase();
      
      const dynamicStream = streamedLiveMap.get(`${h}_${a}`) || streamedLiveMap.get(`${a}_${h}`);

      if (dynamicStream) {
        // اگر بازی واقعاً در حال پخش بود، لینک امن و وضعیت لایو را تزریق کن
        match.embedUrl = dynamicStream;
        match.streamAvailable = true;
        match.status = 'LIVE';
        match.time = 'LIVE';
        match.priority += 100; // بیاید بالاترین جایگاه
      }
    });

    matches = [...new Map(matches.map(m => [m.id, m])).values()];
    
    // مرتب‌سازی منظم: مسابقات زنده و دارای استریم بالا، بقیه سر جای خودشان
    matches.sort((a, b) => (b.status === 'LIVE') - (a.status === 'LIVE') || b.priority - a.priority || new Date(a.kickoffTime) - new Date(b.kickoffTime));

    return res.status(200).json({ 
      success: true, 
      source: 'CineQueue Hybrid Resolver', 
      matches: matches.slice(0, 60) 
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
