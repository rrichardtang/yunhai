/* Itinerary PDF export
 *
 * Builds a single PDF that contains:
 *   1. The styled itinerary view (rasterized via html2canvas, paginated to letter)
 *   2. After each stop, that stop's uploaded attachments:
 *        - PDFs merged page-by-page (pdf-lib copyPages)
 *        - Images embedded as full pages (jpg/png native; webp/heic skipped with warning)
 *
 * Exposes: window.exportItineraryPdf()
 *
 * Requires: window.PDFLib (pdf-lib), window.html2canvas, app.js state.attachmentsByItem
 */
(function () {
  const PAGE_W = 612;   // US Letter @ 72dpi
  const PAGE_H = 792;
  const MARGIN = 36;

  function getStopActivityIdsInOrder() {
    const view = document.getElementById('itineraryModeView');
    if (!view) return [];
    return Array.from(view.querySelectorAll('.stop[data-activity-id]'))
      .map((el) => el.dataset.activityId)
      .filter(Boolean);
  }

  function getAttachmentsFor(activityId) {
    const byItem = window.state?.attachmentsByItem || {};
    const list = byItem[activityId];
    return Array.isArray(list) ? list : [];
  }

  async function fetchAttachmentBytes(attachmentId) {
    const res = await fetch(`/api/attachments/${encodeURIComponent(attachmentId)}`);
    if (!res.ok) throw new Error(`Failed to fetch attachment ${attachmentId}: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  // Hide the send-tile buttons + sticky nav while rasterizing so they don't appear in the PDF.
  function hideForCapture() {
    const hidden = [];
    document.querySelectorAll('.itin-send, .stop__actions, .step-nav, .topbar').forEach((el) => {
      hidden.push([el, el.style.visibility]);
      el.style.visibility = 'hidden';
    });
    return () => hidden.forEach(([el, prev]) => { el.style.visibility = prev; });
  }

  async function rasterizeItineraryToPages(pdfDoc) {
    const view = document.getElementById('itineraryModeView');
    if (!view) throw new Error('Itinerary view not found');
    const restore = hideForCapture();
    let canvas;
    try {
      canvas = await window.html2canvas(view, {
        scale: 2,
        backgroundColor: '#F4F1EC',
        useCORS: true,
        logging: false,
        windowWidth: view.scrollWidth
      });
    } finally {
      restore();
    }

    // Convert the big canvas into letter-size pages by slicing it vertically.
    const imgW = canvas.width;
    const imgH = canvas.height;
    const printableW = PAGE_W - MARGIN * 2;
    const scale = printableW / imgW;
    const sliceHpx = Math.floor((PAGE_H - MARGIN * 2) / scale);

    let yPx = 0;
    while (yPx < imgH) {
      const h = Math.min(sliceHpx, imgH - yPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = imgW;
      sliceCanvas.height = h;
      const ctx = sliceCanvas.getContext('2d');
      ctx.fillStyle = '#F4F1EC';
      ctx.fillRect(0, 0, imgW, h);
      ctx.drawImage(canvas, 0, yPx, imgW, h, 0, 0, imgW, h);
      const dataUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const jpgBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
      const img = await pdfDoc.embedJpg(new Uint8Array(jpgBytes));
      const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      page.drawImage(img, {
        x: MARGIN,
        y: MARGIN,
        width: printableW,
        height: h * scale
      });
      yPx += h;
    }
  }

  async function appendImageAttachment(pdfDoc, bytes, mimeType) {
    let img;
    if (mimeType === 'image/png') {
      img = await pdfDoc.embedPng(bytes);
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      img = await pdfDoc.embedJpg(bytes);
    } else {
      return false; // webp/heic not natively supported by pdf-lib
    }
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const maxW = PAGE_W - MARGIN * 2;
    const maxH = PAGE_H - MARGIN * 2;
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    page.drawImage(img, {
      x: (PAGE_W - w) / 2,
      y: (PAGE_H - h) / 2,
      width: w,
      height: h
    });
    return true;
  }

  async function appendPdfAttachment(pdfDoc, bytes) {
    const src = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await pdfDoc.copyPages(src, src.getPageIndices());
    pages.forEach((p) => pdfDoc.addPage(p));
  }

  async function appendAttachmentsForStops(pdfDoc) {
    const activityIds = getStopActivityIdsInOrder();
    const warnings = [];
    for (const activityId of activityIds) {
      const attachments = getAttachmentsFor(activityId);
      for (const att of attachments) {
        try {
          const bytes = await fetchAttachmentBytes(att.id);
          const mime = String(att.mimeType || '').toLowerCase();
          if (mime === 'application/pdf') {
            await appendPdfAttachment(pdfDoc, bytes);
          } else if (mime.startsWith('image/')) {
            const ok = await appendImageAttachment(pdfDoc, bytes, mime);
            if (!ok) warnings.push(`Skipped unsupported image: ${att.filename}`);
          } else {
            warnings.push(`Skipped unsupported file: ${att.filename}`);
          }
        } catch (err) {
          warnings.push(`Failed: ${att.filename} (${err.message})`);
        }
      }
    }
    return warnings;
  }

  async function exportItineraryPdf() {
    if (!window.PDFLib) throw new Error('pdf-lib not loaded');
    if (!window.html2canvas) throw new Error('html2canvas not loaded');

    // Ensure we're rasterizing the itinerary view, not the planner view.
    const view = document.getElementById('itineraryModeView');
    if (!view || view.classList.contains('hidden')) {
      if (typeof window.setViewMode === 'function') window.setViewMode('itinerary');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (typeof window.showToast === 'function') window.showToast('Building PDF…', 'info');

    const pdfDoc = await window.PDFLib.PDFDocument.create();
    await rasterizeItineraryToPages(pdfDoc);
    const warnings = await appendAttachmentsForStops(pdfDoc);

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const tripName = (window.state?.tripName || 'itinerary').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tripName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    if (typeof window.showToast === 'function') {
      if (warnings.length) {
        window.showToast(`PDF saved (${warnings.length} attachment warning${warnings.length > 1 ? 's' : ''})`, 'info');
        console.warn('PDF export warnings:', warnings);
      } else {
        window.showToast('PDF saved', 'success');
      }
    }
  }

  window.exportItineraryPdf = exportItineraryPdf;
})();
