const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Resend } = require('resend');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ROUTING_PATH = path.join(DATA_DIR, 'email-routing.json');

function ensureRoutingFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ROUTING_PATH)) {
    fs.writeFileSync(ROUTING_PATH, JSON.stringify({ users: {}, aliases: {} }, null, 2));
  }
}

function readRouting() {
  ensureRoutingFile();
  try {
    const raw = fs.readFileSync(ROUTING_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed?.users && typeof parsed.users === 'object' ? parsed.users : {},
      aliases: parsed?.aliases && typeof parsed.aliases === 'object' ? parsed.aliases : {}
    };
  } catch {
    return { users: {}, aliases: {} };
  }
}

function writeRouting(next) {
  ensureRoutingFile();
  fs.writeFileSync(ROUTING_PATH, JSON.stringify(next, null, 2));
}

function deriveAlias(userId) {
  const hash = crypto.createHash('sha256').update(String(userId)).digest('hex');
  return `tp-${hash.slice(0, 20)}`;
}

function getDomain() {
  return String(process.env.FORWARDING_EMAIL_DOMAIN || '').trim();
}

function getOrCreateForwardingAddress(userId, userEmail = '') {
  const domain = getDomain();
  if (!domain) return null;

  const routing = readRouting();
  const existing = routing.users[userId];
  const alias = existing?.alias || deriveAlias(userId);

  routing.users[userId] = {
    alias,
    userEmail: String(userEmail || existing?.userEmail || '').trim(),
    updatedAt: new Date().toISOString()
  };
  routing.aliases[alias] = userId;
  writeRouting(routing);

  return `${alias}@${domain}`;
}

function resolveUserFromRecipient(recipient = '') {
  const text = String(recipient || '').toLowerCase();
  const match = text.match(/([a-z0-9._%+-]+)@([a-z0-9.-]+)/i);
  if (!match) return null;

  const local = match[1];
  const domain = match[2];
  if (domain !== getDomain().toLowerCase()) return null;

  const routing = readRouting();
  const userId = routing.aliases[local] || null;
  if (!userId) return null;

  return {
    userId,
    alias: local,
    userEmail: routing.users[userId]?.userEmail || ''
  };
}

function firstMatch(pattern, text = '') {
  const m = String(text || '').match(pattern);
  return m ? String(m[1] || '').trim() : '';
}

function parseBookingEmail({ subject = '', text = '', html = '' } = {}) {
  const raw = `${subject}\n${text || ''}\n${html || ''}`;
  const compact = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = compact.toLowerCase();
  if (!compact) return [];

  const dateRange = compact.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}).{0,40}(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/);
  const confirmationCode = firstMatch(/(?:confirmation|booking|reservation|record locator|pnr)[^A-Za-z0-9]{0,8}([A-Z0-9-]{5,12})/i, compact);

  const entries = [];
  if (/\bflight\b|\bairline\b|\bboarding\b|\bpnr\b/.test(lower)) {
    entries.push({
      kind: 'flight',
      provider: firstMatch(/(?:airline|carrier)[:\s-]+([^|\n]{2,40})/i, compact),
      title: firstMatch(/(?:flight|trip)[:\s-]+([^|\n]{3,60})/i, compact) || subject,
      confirmationCode,
      startDate: dateRange?.[1] || '',
      endDate: dateRange?.[2] || '',
      location: firstMatch(/(?:from|departure)[:\s-]+([^|\n]{2,40})/i, compact),
      rawSnippet: compact.slice(0, 500)
    });
  }

  if (/\bhotel\b|\bcheck-in\b|\bcheck out\b|\breservation\b/.test(lower)) {
    entries.push({
      kind: 'hotel',
      provider: firstMatch(/(?:hotel|property)[:\s-]+([^|\n]{2,60})/i, compact),
      title: subject,
      confirmationCode,
      startDate: firstMatch(/check[-\s]?in[:\s-]+([^|\n]{4,30})/i, compact) || dateRange?.[1] || '',
      endDate: firstMatch(/check[-\s]?out[:\s-]+([^|\n]{4,30})/i, compact) || dateRange?.[2] || '',
      location: firstMatch(/(?:address|location|city)[:\s-]+([^|\n]{2,80})/i, compact),
      rawSnippet: compact.slice(0, 500)
    });
  }

  if (/\bcar rental\b|\brental car\b|\bpickup\b|\bdropoff\b/.test(lower)) {
    entries.push({
      kind: 'car',
      provider: firstMatch(/(?:provider|rental company|company)[:\s-]+([^|\n]{2,50})/i, compact),
      title: subject,
      confirmationCode,
      startDate: firstMatch(/(?:pickup|pick up)[:\s-]+([^|\n]{4,40})/i, compact) || dateRange?.[1] || '',
      endDate: firstMatch(/(?:dropoff|drop off|return)[:\s-]+([^|\n]{4,40})/i, compact) || dateRange?.[2] || '',
      location: firstMatch(/(?:pickup location|pick up location|location)[:\s-]+([^|\n]{2,80})/i, compact),
      rawSnippet: compact.slice(0, 500)
    });
  }

  if (!entries.length && /\bbooking\b|\bconfirmation\b|\breservation\b/.test(lower)) {
    entries.push({
      kind: 'other',
      provider: '',
      title: subject || 'Forwarded booking',
      confirmationCode,
      startDate: dateRange?.[1] || '',
      endDate: dateRange?.[2] || '',
      location: '',
      rawSnippet: compact.slice(0, 500)
    });
  }

  return entries;
}

async function sendIngestConfirmation({ toEmail, parsedCount, forwardingAddress }) {
  if (!toEmail || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: [toEmail],
    subject: 'TravelPlanner booking received',
    text: `We added ${parsedCount} booking item(s) to your itinerary from your forwarded email.\n\nForward again anytime to: ${forwardingAddress}`
  });
}

module.exports = {
  getOrCreateForwardingAddress,
  resolveUserFromRecipient,
  parseBookingEmail,
  sendIngestConfirmation
};
