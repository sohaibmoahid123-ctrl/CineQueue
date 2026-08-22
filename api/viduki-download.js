export default async function handler(req, res) {
  const { path, token } = req.query;

  try {
    const response = await fetch(`https://api.viduki.net${path}`, {
      method: "GET",
      headers: {
        "x-download-token": token,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.1shows.org/",
        "Origin": "https://www.1shows.org"
      }
    });

    const data = await response.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    res.status(response.status).send(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
