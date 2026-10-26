const feeds = [
  { sport: 'Football', league: 'Premier League', slug: 'soccer/eng.1', priority: 100 },
  { sport: 'Football', league: 'Champions League', slug: 'soccer/uefa.champions', priority: 95 },
  { sport: 'Basketball', league: 'NBA', slug: 'basketball/nba', priority: 90 },
  { sport: 'Tennis', league: 'ATP', slug: 'tennis/atp', priority: 70 },
  { sport: 'Motorsport', league: 'Formula 1', slug: 'racing/f1', priority: 80 }
];

async function fetchJson(url, timeoutMs = 5000) {
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
    return 'TBD';
  }
}

// گرفتن جدول مسابقات ESPN با سرعت بالا
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

// گرفتن سریع مپ مسابقات زنده از سایت مرجع (بدون معطلی)
async function getStreamedPkQuickMap() {
  const liveMap = new Map();
  const categories = ['football', 'basketball', 'motorsport', 'tennis'];

  const results = await Promise.allSettled(
    categories.map(cat => fetchJson(`https://streamed.pk/api/matches/${cat}`))
  );

  results.forEach(result => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      result.value.forEach(match => {
        if (match.sources && match.sources.length > 0) {
          const sourceObj = match.sources[0]; // اولین منبع / اولین سرور
          const homeN = (match.teams?.home?.name || match.homeTeam || '').toLowerCase().trim();
          const awayN = (match.teams?.away?.name || match.awayTeam || '').toLowerCase().trim();
          
          if (homeN && awayN) {
            liveMap.set(`${homeN}_${awayN}`, sourceObj);
            liveMap.set(`${awayN}_${homeN}`, sourceObj);
          }
        }
      });
    }
  });

  return liveMap;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // اجرای موازی برای حفظ سرعت لود زیر ۱ ثانیه
    const [matches, streamedMap] = await Promise.all([
      getEspnMatches(),
      getStreamedPkQuickMap()
    ]);

    // تطبیق هوشمند و گرفتن لینک استریم فقط برای بازی‌های پیدا شده
    for (const match of matches) {
      const h = match.home.toLowerCase().trim();
      const a = match.away.toLowerCase().trim();

      let sourceObj = streamedMap.get(`${h}_${a}`) || streamedMap.get(`${a}_${h}`);

      if (!sourceObj) {
        for (const [key, val] of streamedMap.entries()) {
          if ((key.includes(h) || h.includes(key)) && (key.includes(a) || a.includes(key))) {
            sourceObj = val;
            break;
          }
        }
      }

      // اگر بازی در سایت مرجع استریم داشت، لینک اولین سرور را می‌گیریم
      if (sourceObj) {
        try {
          const streamData = await fetchJson(`https://streamed.pk/api/stream/${sourceObj.source}/${sourceObj.id}`, 4000);
          if (streamData) {
            const streamItem = Array.isArray(streamData) ? streamData[0] : streamData;
            const rawUrl = streamItem?.url || streamItem?.embedUrl || streamItem?.file;
            
            if (rawUrl) {
              match.embedUrl = `/api/proxy?url=` + encodeURIComponent(rawUrl);
              match.streamAvailable = true;
              match.status = 'LIVE';
              match.time = 'LIVE';
              match.priority += 200;
            }
          }
        } catch (e) {
          // خطا در گرفتن استریم تکمیلی نباید کل صفحه را خراب کند
        }
      }
    }

    // حذف تکراری‌ها
    let uniqueMatches = [...new Map(matches.map(m => [m.id, m])).values()];

    // مرتب‌سازی: اول زنده → اولویت → زمان شروع
    uniqueMatches.sort((a, b) => 
      (b.status === 'LIVE') - (a.status === 'LIVE') || 
      b.priority - a.priority || 
      new Date(a.kickoffTime) - new Date(b.kickoffTime)
    );

    return res.status(200).json({
      success: true,
      source: 'CineQueue Fast Hybrid Feed',
      matches: uniqueMatches.slice(0, 60)
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
