const BASE = 'https://streamfree.top/api/v1';

// category سایت → sport فرانت تو
const SPORT_MAP = {
  soccer: 'Football',
  basketball: 'Basketball',
  tennis: 'Tennis',
  racing: 'Motorsport',
  football: 'American Football',
  hockey: 'Hockey',
  baseball: 'Baseball',
  combat: 'Fight',
  cricket: 'Cricket'
};

async function fetchJson(url, timeoutMs = 8000) {
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

function getDay(tsSec) {
  try {
    if (!tsSec) return 'upcoming';
    const date = new Date(tsSec * 1000);
    const today = new Date();
    return date.toDateString() === today.toDateString() ? 'today' : 'upcoming';
  } catch {
    return 'upcoming';
  }
}

function formatTime(tsSec) {
  try {
    if (!tsSec) return 'TBD';
    return new Date(tsSec * 1000).toLocaleString([], {
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

function pickEmbed(sources) {
  if (!Array.isArray(sources) || !sources.length) return { url: '', live: false };
  // اول لایو FHD، بعد هر لایو، بعد FHD، بعد اولی
  const liveFhd = sources.find((s) => s.live && s.quality === 'FHD');
  if (liveFhd?.url) return { url: liveFhd.url, live: true };
  const anyLive = sources.find((s) => s.live && s.url);
  if (anyLive?.url) return { url: anyLive.url, live: true };
  const fhd = sources.find((s) => s.quality === 'FHD' && s.url);
  if (fhd?.url) return { url: fhd.url, live: !!fhd.live };
  return { url: sources[0].url || '', live: !!sources[0].live };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const data = await fetchJson(`${BASE}/streams`);
    const list = Array.isArray(data?.streams) ? data.streams : [];

    const matches = list.map((s) => {
      const home = s.team1?.name || '';
      const away = s.team2?.name || '';
      const cat = String(s.category || 'soccer').toLowerCase();
      const sport = SPORT_MAP[cat] || 'Football';
      const { url: embedUrl, live } = pickEmbed(s.sources);
      const ts = s.match_timestamp || 0;
      const day = live ? 'today' : getDay(ts);

      return {
        id: s.id || s.stream_key || `${cat}-${s.name}`,
        title: s.name || `${home} vs ${away}`,
        home,
        away,
        homeTeam: home,
        awayTeam: away,
        homeMark: teamMark(home),
        awayMark: teamMark(away),
        homeLogo: s.team1?.logo || '',
        awayLogo: s.team2?.logo || '',

        sport, // Football / Basketball / Tennis / Motorsport
        league: s.league || sport,
        category: cat,

        status: live ? 'LIVE' : 'SCHEDULED',
        day,
        time: live ? 'LIVE' : formatTime(ts),
        kickoffTime: ts ? new Date(ts * 1000).toISOString() : null,

        popular: live || (s.viewers || 0) > 0,
        priority: live ? 300 : s.viewers || 50,
        accent: sport === 'Football' ? '#e50914' : '#f59e0b',

        embedUrl,
        streamAvailable: !!embedUrl
      };
    });

    matches.sort(
      (a, b) =>
        (b.status === 'LIVE') - (a.status === 'LIVE') ||
        b.priority - a.priority ||
        String(a.kickoffTime || '').localeCompare(String(b.kickoffTime || ''))
    );

    return res.status(200).json({
      success: true,
      source: 'streamfree.top',
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