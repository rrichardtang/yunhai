const { getAuthedUserId, parseUserId } = require('../middleware/auth');
const {
  saveItinerary,
  updateItinerary,
  getLatestItinerary,
  getItineraryById,
  getItineraryByIdPublic,
  listItineraries,
  deleteItinerary,
  updateBookingChecklist
} = require('../itineraryStore');

function toPublicItinerary(itinerary) {
  if (!itinerary) return null;
  const checklist = Array.isArray(itinerary?.bookingChecklist?.checklist)
    ? itinerary.bookingChecklist.checklist
    : [];
  return {
    id: itinerary.id,
    tripName: itinerary.tripName || '',
    tripBudget: itinerary.tripBudget ?? null,
    numTravelers: itinerary.numTravelers ?? null,
    numChildren: itinerary.numChildren ?? null,
    cities: itinerary.cities || [],
    travels: itinerary.travels || [],
    days: itinerary.days || [],
    activities: itinerary.activities || [],
    reviewed: itinerary.reviewed || {},
    placements: itinerary.placements || {},
    commutes: itinerary.commutes || {},
    schedulingPrefs: itinerary.schedulingPrefs || null,
    itineraryRows: itinerary.itineraryRows || [],
    executionRows: itinerary.executionRows || [],
    bookingChecklist: { checklist }
  };
}
const { computeTripHealth, normalizeChecklistItem } = require('../tripHealth');
const { sendTripHealthSummaryEmail } = require('../services/tripHealthEmail');

function register(app) {
  app.post('/api/itinerary', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const payload = req.body || {};
    const itinerary = saveItinerary(payload, userId);
    res.json({ itinerary });
  });

  app.get('/api/itinerary', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    res.json({ itinerary: getLatestItinerary(userId) });
  });

  app.get('/api/itineraries', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    res.json({ itineraries: listItineraries(userId) });
  });

  app.get('/api/itinerary/:id', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const itinerary = getItineraryById(req.params.id, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
    return res.json({ itinerary });
  });

  app.put('/api/itinerary/:id', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const itinerary = updateItinerary(req.params.id, req.body || {}, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
    return res.json({ itinerary });
  });

  app.delete('/api/itinerary/:id', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const deleted = deleteItinerary(req.params.id, userId);
    if (!deleted) return res.status(404).json({ error: 'Itinerary not found' });
    return res.json({ ok: true });
  });

  app.get('/api/itinerary/:id/trip-health', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const itinerary = getItineraryById(req.params.id, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
    const tripHealth = computeTripHealth(itinerary);
    return res.json({ tripHealth });
  });

  app.put('/api/itinerary/:id/trip-health', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const itinerary = getItineraryById(req.params.id, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    const checklist = Array.isArray(req.body?.checklist)
      ? req.body.checklist.map(normalizeChecklistItem)
      : (itinerary?.bookingChecklist?.checklist || []);
    const notificationPrefs = {
      emailSummary: Boolean(req.body?.notificationPrefs?.emailSummary),
      reminderBeforeDeparture: Boolean(req.body?.notificationPrefs?.reminderBeforeDeparture)
    };
    const issueMeta = req.body?.issueMeta && typeof req.body.issueMeta === 'object'
      ? req.body.issueMeta
      : (itinerary?.bookingChecklist?.issueMeta || {});

    const updated = updateBookingChecklist(req.params.id, userId, { checklist, notificationPrefs, issueMeta });
    const tripHealth = computeTripHealth(updated || itinerary);
    return res.json({ ok: true, tripHealth });
  });

  app.post('/api/itinerary/:id/trip-health/email-summary', async (req, res) => {
    try {
      const userId = parseUserId(getAuthedUserId(req));
      const itinerary = getItineraryById(req.params.id, userId);
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

      const session = req.auth?.().sessionClaims || {};
      const toEmail = String(session?.email || session?.email_address || '').trim();
      if (!toEmail) return res.status(400).json({ error: 'No authenticated email found for this account' });

      const tripHealth = computeTripHealth(itinerary);
      await sendTripHealthSummaryEmail({ toEmail, tripName: itinerary.tripName, tripHealth });
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to send trip health summary email' });
    }
  });
}

function registerPublic(app) {
  app.get('/api/public/itinerary/:id', (req, res) => {
    const itinerary = getItineraryByIdPublic(req.params.id);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
    return res.json({ itinerary: toPublicItinerary(itinerary) });
  });
}

module.exports = { register, registerPublic };
