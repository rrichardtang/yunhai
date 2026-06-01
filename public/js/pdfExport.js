/* Itinerary PDF export
 *
 * Builds a single PDF that contains:
 *   1. The styled itinerary view, rasterized block-by-block (hero, city headers,
 *      day headers, individual stops) so page breaks land on block boundaries
 *      instead of slicing through a stop.
 *   2. Each stop's uploaded attachments inserted immediately after that stop:
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
  const BLOCK_GAP = 8;  // vertical gap between stacked blocks, in PDF points
  const SCALE = 2;      // html2canvas oversampling

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

  // Ordered list of the blocks we rasterize one at a time. A stop block carries
  // its activityId so its attachments can be inserted right after it.
  function collectBlocks() {
    const view = document.getElementById('itineraryModeView');
    if (!view) return [];
    const hero = document.getElementById('itineraryModeHero');
    const blocks = [];
    if (hero) blocks.push({ el: hero });
    view.querySelectorAll('.city-head, .day__when, .stop[data-activity-id]').forEach((el) => {
      const activityId = el.classList.contains('stop') ? el.dataset.activityId : null;
      blocks.push({ el, activityId });
    });
    return blocks;
  }

  async function rasterizeBlock(el) {
    return window.html2canvas(el, {
      scale: SCALE,
      backgroundColor: '#F4F1EC',
      useCORS: true,
      logging: false,
      windowWidth: el.scrollWidth
    });
  }

  // Paginator that stacks block images top-to-bottom, opening a new page when a
  // block doesn't fit. Blocks taller than a full page are sliced (rare).
  function createPaginator(pdfDoc) {
    const printableW = PAGE_W - MARGIN * 2;
    const printableH = PAGE_H - MARGIN * 2;
    let page = null;
    let cursorY = 0; // distance consumed from the top of the printable area

    function newPage() {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      cursorY = 0;
    }

    async function embedCanvas(canvas, sx, sh) {
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sh;
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#F4F1EC';
      ctx.fillRect(0, 0, slice.width, sh);
      ctx.drawImage(canvas, 0, sx, canvas.width, sh, 0, 0, canvas.width, sh);
      const dataUrl = slice.toDataURL('image/jpeg', 0.92);
      const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
      return pdfDoc.embedJpg(new Uint8Array(bytes));
    }

    return {
      async place(canvas) {
        const pxToPt = printableW / canvas.width; // canvas px → PDF points
        const slicePx = Math.floor(printableH / pxToPt); // a full page worth of source px
        let yPx = 0;
        while (yPx < canvas.height) {
          if (!page || cursorY >= printableH - 1) newPage();
          const remainingPt = printableH - cursorY;
          const remainingPx = Math.floor(remainingPt / pxToPt);
          const blockPx = canvas.height - yPx;
          // If the whole remaining block fits, place it; otherwise fill the page.
          const takePx = blockPx <= remainingPx ? blockPx : Math.min(slicePx, remainingPx);
          if (takePx <= 0) { newPage(); continue; }
          const img = await embedCanvas(canvas, yPx, takePx);
          const drawH = takePx * pxToPt;
          page.drawImage(img, {
            x: MARGIN,
            y: PAGE_H - MARGIN - cursorY - drawH,
            width: printableW,
            height: drawH
          });
          cursorY += drawH;
          yPx += takePx;
        }
        cursorY += BLOCK_GAP;
      },
      // Force the next block onto a fresh page (used after appended attachments).
      breakPage() { page = null; cursorY = 0; }
    };
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

  // Returns true if any attachment page was added (so the caller can page-break).
  async function appendStopAttachments(pdfDoc, activityId, warnings) {
    const attachments = getAttachmentsFor(activityId);
    let added = false;
    for (const att of attachments) {
      try {
        const bytes = await fetchAttachmentBytes(att.id);
        const mime = String(att.mimeType || '').toLowerCase();
        if (mime === 'application/pdf') {
          await appendPdfAttachment(pdfDoc, bytes);
          added = true;
        } else if (mime.startsWith('image/')) {
          const ok = await appendImageAttachment(pdfDoc, bytes, mime);
          if (ok) added = true;
          else warnings.push(`Skipped unsupported image: ${att.filename}`);
        } else {
          warnings.push(`Skipped unsupported file: ${att.filename}`);
        }
      } catch (err) {
        warnings.push(`Failed: ${att.filename} (${err.message})`);
      }
    }
    return added;
  }

  async function buildItinerary(pdfDoc) {
    const blocks = collectBlocks();
    if (!blocks.length) throw new Error('Itinerary view not found');
    const warnings = [];
    const restore = hideForCapture();
    const paginator = createPaginator(pdfDoc);
    try {
      for (const block of blocks) {
        const canvas = await rasterizeBlock(block.el);
        await paginator.place(canvas);
        if (block.activityId) {
          const added = await appendStopAttachments(pdfDoc, block.activityId, warnings);
          if (added) paginator.breakPage();
        }
      }
    } finally {
      restore();
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
    const warnings = await buildItinerary(pdfDoc);

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
