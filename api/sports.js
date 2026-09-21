const feeds = [
  { sport: 'Football', league: 'Premier League', slug: 'soccer/eng.1', priority: 100 },
  { sport: 'Football', league: 'Champions League', slug: 'soccer/uefa.champions', priority: 95 },
  { sport: 'Basketball', league: 'NBA', slug: 'basketball/nba', priority: 90 },
  { sport: 'Tennis', league: 'ATP', slug: 'tennis/atp', priority: 70 },
  { sport: 'Motorsport', league: 'Formula 1', slug: 'racing/f1', priority: 80 }
];

function getDay(status, startTime) {
  const date = new Date(startTime);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? 'today' : 'upcoming';
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

function getFeedDates(days = 7) {
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
  return new Date(startTime).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function teamMark(name) {
  return String(name || '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
}

function teamLogo(team) {
  return team.team?.logos?.[0]?.href
    || team.team?.logo
    || team.logo
    || '';
}

function normalizeEvent(event, feed) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find(team => team.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find(team => team.homeAway === 'away') || competitors[1] || {};
  const homeName = home.team?.displayName || home.team?.name || '';
  const awayName = away.team?.displayName || away.team?.name || '';
  if (!event.id || !homeName || !awayName) return null;

  const status = statusFromEvent(event);
  const startTime = event.date || new Date().toISOString();

  return {
    id: `espn-${event.id}`,
    league: event.league?.name || competition?.league?.name || feed.league,
    sport: feed.sport,
    home: homeName,
    away: awayName,
    homeMark: teamMark(home.team?.abbreviation || home.team?.displayName),
    awayMark: teamMark(away.team?.abbreviation || away.team?.displayName),
    homeLogo: teamLogo(home),
    awayLogo: teamLogo(away),
    status,
    day: getDay(status, startTime),
    popular: feed.priority >= 90,
    priority: feed.priority,
    kickoffTime: startTime,
    time: status === 'LIVE' ? (competition?.status?.displayClock || 'LIVE') : formatKickoff(startTime),
    accent: feed.sport === 'Football' ? '#e50914' : feed.sport === 'Basketball' ? '#f59e0b' : '#2a9d8f',
    embedUrl: '',
    streamAvailable: false
  };
}

function extractEmbedUrl(video) {
  if (!video) return '';
  if (typeof video.embed === 'string') {
    const source = video.embed.match(/src=["']([^"']+)["']/i);
    return source ? source[1] : (video.embed.startsWith('http') ? video.embed : '');
  }
  return typeof video.url === 'string' ? video.url : '';
}

async function getScoreBatEmbeds() {
  const token = process.env.SCOREBAT_TOKEN;
  if (!token) return [];

  const url = process.env.SCOREBAT_API_URL || `https://www.scorebat.com/video-api/v3/feed/?token=${encodeURIComponent(token)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ScoreBat returned ${response.status}`);
  const data = await response.json();
  const entries = Array.isArray(data) ? data : (data.response || data.events || []);
  return entries.map(entry => ({
    title: String(entry.title || entry.match || '').toLowerCase(),
    embedUrl: extractEmbedUrl(entry.videos?.find(video => video.embed || video.url) || entry.video)
  })).filter(entry => entry.embedUrl);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const dates = getFeedDates();
    const responses = await Promise.all(feeds.flatMap(feed => dates.map(async date => {
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${feed.slug}/scoreboard?dates=${date}`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.events || []).map(event => normalizeEvent(event, feed)).filter(Boolean);
    })));

    const matches = [...new Map(responses.flat().map(match => [match.id, match])).values()];
    let embeds = [];
    try {
      embeds = await getScoreBatEmbeds();
    } catch (error) {
      console.warn('ScoreBat enrichment unavailable:', error.message);
    }

    matches.forEach(match => {
      const haystack = `${match.home} ${match.away} ${match.league}`.toLowerCase();
      const stream = embeds.find(entry => entry.title.includes(match.home.toLowerCase()) && entry.title.includes(match.away.toLowerCase()))
        || embeds.find(entry => entry.title.includes(haystack));
      if (stream) {
        match.embedUrl = stream.embedUrl;
        match.streamAvailable = true;
      }
    });

    matches.sort((a, b) => (b.status === 'LIVE') - (a.status === 'LIVE') || (a.status === 'SCHEDULED') - (b.status === 'SCHEDULED') || b.priority - a.priority || new Date(a.kickoffTime) - new Date(b.kickoffTime));
    return res.status(200).json({ success: true, source: embeds.length ? 'ESPN + ScoreBat' : 'ESPN', matches: matches.slice(0, 60) });
  } catch (error) {
    return res.status(502).json({ success: false, error: error.message || 'Sports feed unavailable', matches: [] });
  }
};
