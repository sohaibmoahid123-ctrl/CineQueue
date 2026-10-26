const feeds = [
  { sport: 'Football', league: 'Premier League', slug: 'soccer/eng.1', priority: 100 },
  { sport: 'Football', league: 'Champions League', slug: 'soccer/uefa.champions', priority: 95 },
  { sport: 'Basketball', league: 'NBA', slug: 'basketball/nba', priority: 90 },
  { sport: 'Tennis', league: 'ATP', slug: 'tennis/atp', priority: 70 },
  { sport: 'Motorsport', league: 'Formula 1', slug: 'racing/f1', priority: 80 }
];

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'CineQueue/1.0' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalize(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(fc|cf|sc|ac|afc|united|city|town|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function statusFromEvent(event) {
  const t = event.competitions?.[0]?.status?.type || event.status?.type || {};
  if (t.state === 'in') return 'LIVE';
  if (t.completed || t.state === 'post') return 'FINAL';
  return 'SCHEDULED';
}

function formatKickoff(startTime) {
  try {
    return new Date(startTime).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return 'TBD';
  }
}

async function getEspnMatches() {
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const data = await fetchJson(
        `https://site.api.espn.com/apis/site/v2/sports/${feed.slug}/scoreboard`
      );
      if (!data?.events) return [];

      return data.events.map((event) => {
        const comp = event.competitions?.[0];
        const comps = comp?.competitors || [];
        const home = comps.find((c) => c.homeAway === 'home') || comps[0] || {};
        const away = comps.find((c) => c.homeAway === 'away') || comps[1] || {};

        const homeName = home.team?.displayName || home.team?.name || home.athlete?.displayName || '';
        const awayName = away.team?.displayName || away.team?.name || away.athlete?.displayName || '';
        if (!event.id || (!homeName && !awayName)) return null;

        const status = statusFromEvent(event);
        const startTime = event.date || new Date().toISOString();

        return {
          id: `espn-${event.id}`,
          title: homeName && awayName ? `${homeName} vs ${awayName}` : (event.name || 'Match'),
          home: homeName,
          away: awayName,
          league: feed.league,
          sport: feed.sport,
          status,
          priority: feed.priority,
          kickoffTime: startTime,
          time: status === 'LIVE' ? 'LIVE' : formatKickoff(startTime),
          embedUrl: '',
          streamAvailable: false
        };
      }).filter(Boolean);
    })
  );

  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

async function getStreamedMap() {
  const map = new Map();
  const categories = ['football', 'basketball', 'motor-sports', 'tennis'];

  const results = await Promise.allSettled(
    categories.map((cat) => fetchJson(`https://streamed.pk/api/matches/${cat}`))
  );

  for (const r of results) {
    if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
    for (const m of r.value) {
      if (!m.sources?.length) continue;
      const src = m.sources[0];
      const h = normalize(m.teams?.home?.name);
      const a = normalize(m.teams?.away?.name);
      const title = normalize(m.title);
      if (h && a) {
        map.set(`${h}|${a}`, src);
        map.set(`${a}|${h}`, src);
      }
      if (title) map.set(`t:${title}`, src);
    }
  }
  return map;
}

function findSource(match, map) {
  const h = normalize(match.home);
  const a = normalize(match.away);
  const t = normalize(match.title);

  return (
    map.get(`${h}|${a}`) ||
    map.get(`${a}|${h}`) ||
    map.get(`t:${t}`) ||
    null
  );
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const [matches, streamedMap] = await Promise.all([
      getEspnMatches(),
      getStreamedMap()
    ]);

    // فقط برای چند بازی اول که سورس دارند، embed را بگیر (جلوگیری از timeout)
    const withSource = matches
      .map((m) => ({ match: m, src: findSource(m, streamedMap) }))
      .filter((x) => x.src)
      .slice(0, 10);

    await Promise.all(
      withSource.map(async ({ match, src }) => {
        const streams = await fetchJson(
          `https://streamed.pk/api/stream/${src.source}/${src.id}`,
          4000
        );
        if (!streams) return;
        const item = Array.isArray(streams) ? streams[0] : streams;
        const embed = item?.embedUrl;
        if (embed) {
          match.embedUrl = embed; // همان لینک embed خود سایت
          match.streamAvailable = true;
          match.status = 'LIVE';
          match.time = 'LIVE';
          match.priority += 200;
        }
      })
    );

    const unique = [...new Map(matches.map((m) => [m.id, m])).values()];
    unique.sort(
      (a, b) =>
        (b.status === 'LIVE') - (a.status === 'LIVE') ||
        b.priority - a.priority ||
        new Date(a.kickoffTime) - new Date(b.kickoffTime)
    );

    return res.status(200).json({
      success: true,
      source: 'CineQueue Hybrid Feed',
      matches: unique.slice(0, 60)
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ success: false, error: err.message, matches: [] });
  }
};