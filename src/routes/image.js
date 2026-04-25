const { fetchUnsplashImage } = require('../unsplash');
const { buildImageSearchQuery } = require('../services/imageQuery');

function register(app) {
  app.get('/api/image', async (req, res) => {
    try {
      const { q, city, type } = req.query;
      if (!q) return res.status(400).json({ error: 'q query param is required' });

      const searchQuery = buildImageSearchQuery({ name: q, type, city });
      const imageUrl = await fetchUnsplashImage(searchQuery, city, type);
      return res.json({ imageUrl, searchQuery });
    } catch (error) {
      if (error.code === 'UNSPLASH_KEY_MISSING') {
        return res.status(503).json({
          error: 'Unsplash API key not configured',
          code: error.code
        });
      }
      return res.status(500).json({ error: error.message || 'Failed to fetch image' });
    }
  });
}

module.exports = { register };
