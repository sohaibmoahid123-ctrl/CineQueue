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

function formatTime(ts) {
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return d.toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return 'TBD';
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // 1) اول لایوهای streamed.pk
    const liveList = (await fetchJson('https://streamed.pk/api/matches/live')) || [];
    const footballList = (await fetchJson('https://streamed.pk/api/matches/football')) || [];
    const basketballList = (await fetchJson('https://streamed.pk/api/matches/basketball')) || [];

    // live را اول، بعد بقیه (بدون تکرار)
    const seen = new Set();
    const raw = [];
    for (const m of [...liveList, ...footballList, ...basketballList]) {
      if (!m?.id || seen.has(m.id)) continue;
      seen.add(m.id);
      raw.push(m);
    }

    // 2) برای حداکثر ۱۲ تای اول که سورس دارند، embed بگیر
    const matches = [];
    const withSource = raw.filter((m) => m.sources?.length).slice(0, 12);

    await Promise.all(
      withSource.map(async (m) => {
        const src = m.sources[0];
        const streams = await fetchJson(
          `https://streamed.pk/api/stream/${src.source}/${src.id}`,
          4000
        );
        const item = Array.isArray(streams) ? streams[0] : streams;
        const embedUrl = item?.embedUrl || '';

        const home = m.teams?.home?.name || '';
        const away = m.teams?.away?.name || '';
        const isLive = liveList.some((x) => x.id === m.id);

        matches.push({
          id: m.id,
          title: m.title || `${home} vs ${away}`,
          home,
          away,
          league: m.category || 'football',
          sport: m.category || 'football',
          status: isLive ? 'LIVE' : 'SCHEDULED',
          time: isLive ? 'LIVE' : formatTime(m.date),
          kickoffTime: m.date ? new Date(m.date).toISOString() : null,
          priority: isLive ? 300 : m.popular ? 100 : 50,
          embedUrl,                 // همان embed خود سایت
          streamAvailable: !!embedUrl
        });
      })
    );

    matches.sort(
      (a, b) =>
        (b.status === 'LIVE') - (a.status === 'LIVE') ||
        b.priority - a.priority
    );

    return res.status(200).json({
      success: true,
      source: 'streamed.pk primary',
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