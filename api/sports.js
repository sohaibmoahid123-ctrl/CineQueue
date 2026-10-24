const feeds = [
  { sport: 'Football', league: 'Premier League', slug: 'soccer/eng.1', priority: 100 },
  { sport: 'Football', league: 'Champions League', slug: 'soccer/uefa.champions', priority: 95 },
  { sport: 'Basketball', league: 'NBA', slug: 'basketball/nba', priority: 90 },
  { sport: 'Tennis', league: 'ATP', slug: 'tennis/atp', priority: 70 },
  { sport: 'Motorsport', league: 'Formula 1', slug: 'racing/f1', priority: 80 }
];

const sportsDbLeagues = [
  { id: 4328, sport: 'Football', priority: 100 },
  { id: 4480, sport: 'Football', priority: 95 },
  { id: 4335, sport: 'Football', priority: 90 },
  { id: 4387, sport: 'Basketball', priority: 85 }
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
  const date = new Date(startTime);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? 'today' : 'upcoming';
}

function statusFromEvent(event) {
  const state = event.competitions?.[0]?.status?.type;
  if (state?.state === 'in') return 'LIVE';
  if (state?.completed) return 'FINAL';
  return 'SCHEDULED';
}

function getDateKey(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function getFeedDates(days = 3) {
  const dates = [];
  const now = new Date();
  for (let offset = 0; offset <= days; offset += 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() + offset);
    dates.push(getDateKey(date));
  }
  return dates;
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

function teamMark(name) {
  return String(name || '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
}

function teamLogo(team) {
  return team.team?.logos?.[0]?.href || team.team?.logo || team.logo || '';
}

// ۱. دریافت لیست مسابقات از ESPN
async function getEspnMatches() {
  const dates = getFeedDates();
  const responses = await Promise.allSettled(feeds.flatMap(feed => dates.map(async date => {
    const data = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${feed.slug}/scoreboard?dates=${date}`);
    if (!data) return [];
    return (data.events || []).map(event => normalizeEspnEvent(event, feed)).filter(Boolean);
  })));
  return responses.flatMap(result => result.status === 'fulfilled' ? result.value : []);
}

function normalizeEspnEvent(event, feed) {
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
    homeMark: teamMark(home.team?.abbreviation || homeName),
    awayMark: teamMark(away.team?.abbreviation || awayName),
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
}

// ۲. دریافت استریم‌های زنده و پویای جاری از streamed.pk برای تطبیق با مسابقات
async function getStreamedPkLivePool() {
  const liveMap = new Map();
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
              const homeN = (match.teams?.home?.name || '').toLowerCase();
              const awayN = (match.teams?.away?.name || '').toLowerCase();
              
              if (homeN && awayN) {
                liveMap.set(`${homeN}_${awayN}`, proxyUrl);
                liveMap.set(`${awayN}_${homeN}`, proxyUrl); // برای احتیاط در ترتیب نام‌ها
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
    // ۱. گرفتن جدول مسابقات از ESPN
    let matches = await getEspnMatches();

    // ۲. گرفتن استریم‌های زنده از streamed.pk به صورت پشت صحنه
    let streamedLiveMap = new Map();
    try {
      streamedLiveMap = await getStreamedPkLivePool();
    } catch (e) {
      console.warn('Streamed.pk live pool fetch failed:', e.message);
    }

    // ۳. تطبیق هوشمند مسابقات ESPN با استریم‌های زنده streamed.pk
    const now = new Date();
    matches.forEach(match => {
      const h = match.home.toLowerCase();
      const a = match.away.toLowerCase();
      
      // جستجوی تطبیقی نام تیم‌ها در استریم‌های زنده سایت مرجع
      const dynamicStream = streamedLiveMap.get(`${h}_${a}`) || streamedLiveMap.get(`${a}_${h}`);

      if (dynamicStream) {
        match.embedUrl = dynamicStream;
        match.streamAvailable = true;
      }

      // بررسی خودکار زمان شروع برای وضعیت LIVE
      const kickoff = new Date(match.kickoffTime);
      const endTime = new Date(kickoff.getTime() + (120 * 60 * 1000));
      
      if (match.status !== 'FINAL' && now >= kickoff && now <= endTime) {
        match.status = 'LIVE';
        match.time = 'LIVE';
      }
    });

    matches = [...new Map(matches.map(match => [match.id, match])).values()];
    matches.sort((a, b) => (b.status === 'LIVE') - (a.status === 'LIVE') || b.priority - a.priority);

    return res.status(200).json({ 
      success: true, 
      source: 'ESPN Schedule + Streamed.pk Live Resolver', 
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
