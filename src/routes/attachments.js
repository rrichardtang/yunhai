const fs = require('fs');
const { getAuthedUserId, parseUserId } = require('../middleware/auth');
const { attachmentUpload, handleAttachmentError } = require('../middleware/attachmentUpload');
const { getItineraryById } = require('../itineraryStore');
const {
  saveAttachment: saveAttachmentFile,
  getAttachmentFile,
  listAttachments: listAttachmentsForActivity,
  deleteAttachment: deleteAttachmentFile
} = require('../attachmentStore');

function register(app) {
  app.post(
    '/api/itinerary/:itineraryId/activity/:activityId/attachments',
    (req, res, next) => {
      attachmentUpload.array('files', 5)(req, res, (err) => {
        if (err) return handleAttachmentError(err, res);
        next();
      });
    },
    (req, res) => {
      const userId = parseUserId(getAuthedUserId(req));
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const itinerary = getItineraryById(req.params.itineraryId, userId);
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) return res.status(400).json({ error: 'No files provided' });

      const saved = [];
      for (const file of files) {
        try {
          const entry = saveAttachmentFile({
            userId,
            itineraryId: itinerary.id,
            activityId: req.params.activityId,
            originalName: file.originalname,
            mimeType: file.mimetype,
            buffer: file.buffer
          });
          saved.push(entry);
        } catch (err) {
          return handleAttachmentError(err, res);
        }
      }
      return res.json({ attachments: saved });
    }
  );

  app.get('/api/itinerary/:itineraryId/activity/:activityId/attachments', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const itinerary = getItineraryById(req.params.itineraryId, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
    const attachments = listAttachmentsForActivity({ userId, activityId: req.params.activityId });
    return res.json({ attachments });
  });

  app.get('/api/itinerary/:itineraryId/attachments', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const itinerary = getItineraryById(req.params.itineraryId, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
    const attachments = listAttachmentsForActivity({ userId, itineraryId: req.params.itineraryId });
    return res.json({ attachments });
  });

  app.get('/api/attachments/:attachmentId', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const file = getAttachmentFile({ userId, attachmentId: req.params.attachmentId });
    if (!file) return res.status(404).json({ error: 'Attachment not found' });
    res.setHeader('Content-Type', file.mimeType);
    const safeName = String(file.filename || 'attachment').replace(/[^a-zA-Z0-9._-]+/g, '_');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Content-Length', String(file.size));
    fs.createReadStream(file.path).pipe(res);
  });

  app.delete('/api/attachments/:attachmentId', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ok = deleteAttachmentFile({ userId, attachmentId: req.params.attachmentId });
    if (!ok) return res.status(404).json({ error: 'Attachment not found' });
    return res.json({ ok: true });
  });
}

module.exports = { register };
