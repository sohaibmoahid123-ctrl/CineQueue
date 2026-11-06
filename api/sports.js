const SPORT_MAP = {
  football: 'Football',
  basketball: 'Basketball',
  tennis: 'Tennis',
  'motor-sports': 'Motorsport',
  motorsport: 'Motorsport',
  hockey: 'Hockey',
  'american-football': 'American Football',
  baseball: 'Baseball',
  fight: 'Fight',
  rugby: 'Rugby',
  cricket: 'Cricket'
};

const CATEGORIES = [
  'football',
  'basketball',
  'tennis',
  'motor-sports',
  'hockey',
  'american-football'
];

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://streamed.pk/',
        'Origin': 'https://streamed.pk/',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) {
      console.error(`API Error: ${res.status} for ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Fetch exception for ${url}:`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function teamMark(name) {
  return String(name || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase() || 'TM';
}

function badgeUrl(badge) {
  if (!badge) return '';
  const b = String(badge);
  if (b.startsWith('http')) return b;
  if (b.startsWith('/')) return `https://streamed.pk${b}`;
  return `https://streamed.pk/api/images/badge/${b}.webp`;
}

function getDay(ts) {
  try {
    if (!ts) return 'upcoming';
    const date = new Date(typeof ts === 'number' ? ts : ts);
    const today = new Date();
    return date.toDateString() === today.toDateString() ? 'today' : 'upcoming';
  } catch {
    return 'upcoming';
  }
}

function formatTime(ts) {
  try {
    if (!ts) return 'TBD';
    const d = new Date(typeof ts === 'number' ? ts : ts);
    if (Number.isNaN(d.getTime())) return 'TBD';
    return d.toLocaleString([], {
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

function mapSport(category) {
  const key = String(category || 'football').toLowerCase();
  return SPORT_MAP[key] || 'Football';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // درخواست به APIهای اصلی سایت
    const [liveList, ...catLists] = await Promise.all([
      fetchJson('https://streamed.pk/api/matches/live'),
      ...CATEGORIES.map((c) => fetchJson(`https://streamed.pk/api/matches/${c}`))
    ]);

    const liveArr = Array.isArray(liveList) ? liveList : [];
    const liveIds = new Set(liveArr.map((m) => m && m.id).filter(Boolean));

    const seen = new Set();
    const raw = [];

    for (const m of liveArr) {
      if (!m?.id || seen.has(m.id)) continue;
      seen.add(m.id);
      raw.push(m);
    }

    for (const list of catLists) {
      if (!Array.isArray(list)) continue;
      for (const m of list) {
        if (!m?.id || seen.has(m.id)) continue;
        seen.add(m.id);
        raw.push(m);
      }
    }

    // اگر باز هم به هر دلیلی هیچ دیتایی نیامد، ارور دقیق را برمی‌گردانیم تا در کنسول ببینیم
    if (raw.length === 0) {
      return res.status(502).json({
        success: false,
        error: 'Target API blocked or returned empty response',
        matches: []
      });
    }

    const baseMatches = raw.map((m) => {
      const home = (m.teams && m.teams.home && m.teams.home.name) || '';
      const away = (m.teams && m.teams.away && m.teams.away.name) || '';
      const homeBadge = (m.teams && m.teams.home && m.teams.home.badge) || '';
      const awayBadge = (m.teams && m.teams.away && m.teams.away.badge) || '';

      const isLive = liveIds.has(m.id);
      const sport = mapSport(m.category);
      const day = isLive ? 'today' : getDay(m.date);

      return {
        id: m.id,
        title: m.title || `${home} vs ${away}`,
        home,
        away,
        homeTeam: home,
        awayTeam: away,
        homeMark: teamMark(home),
        awayMark: teamMark(away),
        homeLogo: badgeUrl(homeBadge),
        awayLogo: badgeUrl(badgeUrl(awayBadge)),
        sport,
        league: sport,
        category: String(m.category || 'football').toLowerCase(),
        status: isLive ? 'LIVE' : 'SCHEDULED',
        day,
        time: isLive ? 'LIVE' : formatTime(m.date),
        kickoffTime: m.date ? new Date(m.date).toISOString() : null,
        popular: !!(m.popular || isLive),
        priority: isLive ? 300 : m.popular ? 120 : 50,
        accent: sport === 'Football' ? '#e50914' : '#f59e0b',
        embedUrl: '',
        streamAvailable: false,
        _rawSources: m.sources
      };
    });

    const candidatesForStream = baseMatches
      .filter((m) => m.status === 'LIVE' && m._rawSources && m._rawSources.length > 0)
      .slice(0, 8);

    await Promise.allSettled(
      candidatesForStream.map(async (match) => {
        const src = match._rawSources[0];
        const streams = await fetchJson(
          `https://streamed.pk/api/stream/${src.source}/${src.id}`,
          3000
        );
        const item = Array.isArray(streams) ? streams[0] : streams;
        const embedUrl = (item && item.embedUrl) || '';
        if (embedUrl) {
          match.embedUrl = embedUrl;
          match.streamAvailable = true;
        }
      })
    );

    const matches = baseMatches.map(({ _rawSources, ...rest }) => rest);

    matches.sort(
      (a, b) =>
        (b.status === 'LIVE') - (a.status === 'LIVE') ||
        b.priority - a.priority ||
        String(a.sport).localeCompare(String(b.sport))
    );

    return res.status(200).json({
      success: true,
      source: 'streamed.pk live direct',
      matches: matches.slice(0, 60)
    });

  } catch (err) {
    console.error(err);
    return res.status(502).json({
      success: false,
      error: err.message || 'feed error',
      matches: []
    });
  }
};
