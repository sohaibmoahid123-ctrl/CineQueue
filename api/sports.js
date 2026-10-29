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

async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; CineQueue/1.0)'
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
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

    // حداکثر ۳۰ تا با سورس (برای سرعت)
    const candidates = raw.filter((m) => m.sources && m.sources.length).slice(0, 30);

    const matches = (
      await Promise.all(
        candidates.map(async (m) => {
          const src = m.sources[0];
          const streams = await fetchJson(
            `https://streamed.pk/api/stream/${src.source}/${src.id}`,
            4000
          );
          const item = Array.isArray(streams) ? streams[0] : streams;
          const embedUrl = (item && item.embedUrl) || '';

          const home = (m.teams && m.teams.home && m.teams.home.name) || '';
          const away = (m.teams && m.teams.away && m.teams.away.name) || '';
          const homeBadge = (m.teams && m.teams.home && m.teams.home.badge) || '';
          const awayBadge = (m.teams && m.teams.away && m.teams.away.badge) || '';

          const isLive = liveIds.has(m.id);
          const sport = mapSport(m.category); // "Football" | "Basketball" | ...
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
            awayLogo: badgeUrl(awayBadge),

            // مهم: باید دقیقاً با کلید تب فرانت یکی باشد
            sport, // Football / Basketball / Tennis / Motorsport
            league: sport,
            category: String(m.category || 'football').toLowerCase(),

            status: isLive ? 'LIVE' : 'SCHEDULED',
            day, // today | upcoming
            time: isLive ? 'LIVE' : formatTime(m.date),
            kickoffTime: m.date ? new Date(m.date).toISOString() : null,

            popular: !!(m.popular || isLive),
            priority: isLive ? 300 : m.popular ? 120 : 50,
            accent: sport === 'Football' ? '#e50914' : '#f59e0b',

            embedUrl,
            streamAvailable: !!embedUrl
          };
        })
      )
    ).filter((m) => m.streamAvailable);

    matches.sort(
      (a, b) =>
        (b.status === 'LIVE') - (a.status === 'LIVE') ||
        b.priority - a.priority ||
        String(a.sport).localeCompare(String(b.sport))
    );

    return res.status(200).json({
      success: true,
      source: 'streamed.pk multi-sport',
      matches
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