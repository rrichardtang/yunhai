const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ROOT = path.join(DATA_DIR, 'attachments');
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif'
]);
const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif'
};

function createId() {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function userDir(userId) {
  return path.join(ROOT, String(userId));
}

function manifestPath(userId) {
  return path.join(userDir(userId), 'manifest.json');
}

function ensureUserDir(userId) {
  const dir = userDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readManifest(userId) {
  const file = manifestPath(userId);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeManifest(userId, entries) {
  ensureUserDir(userId);
  fs.writeFileSync(manifestPath(userId), JSON.stringify(entries, null, 2));
}

function isAllowedMime(mimeType) {
  return ALLOWED_MIME.has(String(mimeType || '').toLowerCase());
}

function publicEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    filename: entry.filename,
    size: entry.size,
    mimeType: entry.mimeType,
    uploadedAt: entry.uploadedAt,
    activityId: entry.activityId,
    itineraryId: entry.itineraryId
  };
}

function saveAttachment({ userId, itineraryId, activityId, originalName, mimeType, buffer }) {
  if (!userId) throw new Error('userId required');
  if (!activityId) throw new Error('activityId required');
  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('buffer required');
  if (buffer.length > MAX_BYTES) {
    const err = new Error('File exceeds 10 MB limit');
    err.code = 'TOO_LARGE';
    throw err;
  }
  if (!isAllowedMime(mimeType)) {
    const err = new Error('Unsupported file type');
    err.code = 'UNSUPPORTED_TYPE';
    throw err;
  }

  ensureUserDir(userId);
  const id = createId();
  const ext = MIME_TO_EXT[String(mimeType).toLowerCase()] || 'bin';
  const storedName = `${id}.${ext}`;
  const diskPath = path.join(userDir(userId), storedName);
  fs.writeFileSync(diskPath, buffer);

  const entry = {
    id,
    itineraryId: String(itineraryId || ''),
    activityId: String(activityId),
    filename: String(originalName || storedName).slice(0, 180),
    storedName,
    mimeType: String(mimeType).toLowerCase(),
    size: buffer.length,
    uploadedAt: new Date().toISOString()
  };

  const manifest = readManifest(userId);
  manifest.push(entry);
  writeManifest(userId, manifest);
  return publicEntry(entry);
}

function findManifestEntry(userId, attachmentId) {
  const manifest = readManifest(userId);
  return manifest.find((e) => e.id === attachmentId) || null;
}

function getAttachmentFile({ userId, attachmentId }) {
  const entry = findManifestEntry(userId, attachmentId);
  if (!entry) return null;
  const diskPath = path.join(userDir(userId), entry.storedName);
  if (!fs.existsSync(diskPath)) return null;
  return {
    path: diskPath,
    filename: entry.filename,
    mimeType: entry.mimeType,
    size: entry.size
  };
}

function listAttachments({ userId, activityId, itineraryId }) {
  const manifest = readManifest(userId);
  return manifest
    .filter((e) => (activityId ? e.activityId === String(activityId) : true))
    .filter((e) => (itineraryId ? e.itineraryId === String(itineraryId) : true))
    .map(publicEntry);
}

function deleteAttachment({ userId, attachmentId }) {
  const manifest = readManifest(userId);
  const idx = manifest.findIndex((e) => e.id === attachmentId);
  if (idx === -1) return false;

  const entry = manifest[idx];
  const diskPath = path.join(userDir(userId), entry.storedName);
  try {
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  } catch {
    // ignore — we still want the manifest entry removed
  }
  manifest.splice(idx, 1);
  writeManifest(userId, manifest);
  return true;
}

module.exports = {
  saveAttachment,
  getAttachmentFile,
  listAttachments,
  deleteAttachment,
  isAllowedMime,
  MAX_BYTES,
  ALLOWED_MIME: Array.from(ALLOWED_MIME)
};
