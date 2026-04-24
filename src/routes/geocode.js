const { nominatimFetch } = require('../middleware/nominatim');

function register(app) {
  app.get('/api/geocode', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
      const r = await nominatimFetch(url);
      if (!r.ok) return res.status(r.status).json({ error: `Nominatim error ${r.status}` });
      const data = await r.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { register };
