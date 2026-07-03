const {
  resolveUserFromRecipient,
  parseBookingEmail,
  sendIngestConfirmation
} = require('../emailForwarding');
const { addParsedBookings } = require('../itineraryStore');

function register(app) {
  app.post('/api/email/inbound', async (req, res) => {
    const expectedSecret = String(process.env.EMAIL_WEBHOOK_SECRET || '').trim();
    if (!expectedSecret) {
      return res.status(503).json({ error: 'Email ingest is not configured' });
    }
    const providedSecret = String(req.headers['x-travelplanner-email-secret'] || '').trim();
    if (providedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const payload = req.body || {};
    const recipients = [payload.to, payload.recipient, payload.envelope?.to].flat().filter(Boolean);
    const routing = recipients
      .map((value) => resolveUserFromRecipient(value))
      .find(Boolean);

    if (!routing?.userId) {
      return res.status(400).json({ error: 'No matching forwarding address found' });
    }

    const parsedBookings = parseBookingEmail({
      subject: payload.subject || '',
      text: payload.text || payload.textBody || '',
      html: payload.html || payload.htmlBody || ''
    });

    if (!parsedBookings.length) {
      return res.json({ ok: true, parsed: 0, message: 'No booking details detected' });
    }

    const source = {
      from: String(payload.from || payload.sender || '').slice(0, 200),
      subject: String(payload.subject || '').slice(0, 200),
      receivedAt: new Date().toISOString()
    };

    const attached = addParsedBookings({
      userId: routing.userId,
      itineraryId: String(payload.itineraryId || '').trim(),
      bookings: parsedBookings,
      source
    });

    if (!attached) {
      return res.status(404).json({ error: 'No itinerary found for user to attach booking' });
    }

    try {
      await sendIngestConfirmation({
        toEmail: routing.userEmail,
        parsedCount: attached.added,
        forwardingAddress: `${routing.alias}@${process.env.FORWARDING_EMAIL_DOMAIN}`
      });
    } catch (error) {
      console.error('[email] confirmation send failed:', error.message);
    }

    return res.json({ ok: true, parsed: attached.added, itineraryId: attached.itineraryId });
  });
}

module.exports = { register };
