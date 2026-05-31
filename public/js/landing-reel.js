/* YunHai — Landing demo reel
 * Single iframe loads /planner.html?embed=1 and the engine drives the real app:
 * clicks real buttons, types into real inputs, and jumps between steps via
 * iframe.contentWindow.setStep(n).
 */
(function () {
  'use strict';

  const FRAME_W = 1440;
  const FRAME_H = 880;
  const IFRAME_SRC = '/planner.html?embed=1';
  // Global pacing multiplier — >1 slows the whole walkthrough (typing, waits, beat budgets).
  const PACE = 1.6;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  class Engine {
    constructor(els) {
      this.viewport = els.viewport;
      this.cursor = els.cursor;
      this.narratorEl = els.narratorEl;
      this.narratorBody = els.narratorBody;
      this.narratorLabel = els.narratorLabel;
      this.narratorTitle = els.narratorTitle;
      this.narratorText = els.narratorText;
      this.scale = 1;
      this.iframe = null;
      this.cancelled = false;
      this.paused = false;
    }

    async pumpPause() {
      while (this.paused && !this.cancelled) await wait(80);
    }
    setScale(s) { this.scale = s; }
    setIframe(f) { this.iframe = f; }

    get doc() { return this.iframe && this.iframe.contentDocument; }
    get win() { return this.iframe && this.iframe.contentWindow; }
    get scroller() { return this.doc && (this.doc.scrollingElement || this.doc.documentElement); }

    async narrate(label, title, text, corner) {
      if (this.cancelled) return;
      this.narratorBody.classList.add('is-out');
      await wait(220);
      if (this.cancelled) return;
      if (corner) {
        this.narratorEl.classList.remove('pos-tl', 'pos-tr', 'pos-bl', 'pos-br');
        this.narratorEl.classList.add('pos-' + corner);
      }
      this.narratorLabel.textContent = label;
      this.narratorTitle.innerHTML = title;
      this.narratorText.textContent = text;
      this.narratorBody.classList.remove('is-out');
      await wait(60);
    }

    async wait(ms) {
      const total = ms * PACE;
      let remaining = total;
      while (remaining > 0) {
        if (this.cancelled) return;
        if (this.paused) { await this.pumpPause(); continue; }
        const slice = Math.min(60, remaining);
        await wait(slice);
        remaining -= slice;
      }
    }

    async scrollTo(el, padding = 140) {
      const sc = this.scroller;
      if (!sc) return;
      const r = el.getBoundingClientRect();
      const targetTop = sc.scrollTop + r.top - padding;
      const max = Math.max(0, sc.scrollHeight - FRAME_H);
      const target = Math.max(0, Math.min(max, targetTop));
      if (Math.abs(target - sc.scrollTop) < 4) return;
      const from = sc.scrollTop;
      const dist = target - from;
      const dur = Math.min(800, 220 + Math.abs(dist) * 0.45);
      const start = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          if (this.cancelled) return resolve();
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          sc.scrollTop = from + dist * eased;
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    resolve(selector) {
      return typeof selector === 'string' ? this.doc.querySelector(selector) : selector;
    }

    async cursorTo(selector, opts = {}) {
      if (this.cancelled) return null;
      const el = this.resolve(selector);
      if (!el) { console.warn('[reel] not found:', selector); return null; }
      if (opts.scroll !== false) await this.scrollTo(el, opts.padding || 160);
      if (this.cancelled) return null;
      const r = el.getBoundingClientRect();
      const cx = (r.left + r.width / 2 + (opts.dx || 0)) * this.scale;
      const cy = (r.top + r.height / 2 + (opts.dy || 0)) * this.scale;
      this.cursor.style.opacity = '1';
      this.cursor.style.left = cx + 'px';
      this.cursor.style.top = cy + 'px';
      await this.wait(opts.travel || 750);
      return el;
    }

    async click(selector, opts = {}) {
      const el = await this.cursorTo(selector, opts);
      if (!el || this.cancelled) return null;
      this.cursor.classList.add('is-clicking');
      await this.wait(160);
      if (!this.cancelled) el.click();
      await this.wait(opts.after || 480);
      this.cursor.classList.remove('is-clicking');
      return el;
    }

    async type(selector, text, opts = {}) {
      const el = this.resolve(selector);
      if (!el) { console.warn('[reel] type not found:', selector); return; }
      await this.cursorTo(el, { travel: opts.travel || 600, padding: opts.padding || 200 });
      if (this.cancelled) return;
      el.focus();
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const min = opts.speedMin ?? 55;
      const max = opts.speedMax ?? 105;
      for (const ch of text) {
        if (this.cancelled) return;
        if (this.paused) await this.pumpPause();
        if (this.cancelled) return;
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await wait((min + Math.random() * (max - min)) * PACE);
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async setValue(selector, value, opts = {}) {
      const el = await this.cursorTo(selector, { travel: opts.travel || 550, padding: opts.padding || 180 });
      if (!el || this.cancelled) return;
      this.cursor.classList.add('is-clicking');
      await this.wait(140);
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await this.wait(opts.after || 300);
      this.cursor.classList.remove('is-clicking');
    }

    async custom(fn) {
      if (this.cancelled) return;
      await fn(this.doc, this.win, this);
    }

    gotoAppStep(n) {
      if (this.win && typeof this.win.setStep === 'function') {
        this.win.setStep(n, { pushHistory: false });
      }
    }
  }

  // Each beat targets one of the real app's 4 setup steps and runs against the same iframe.
  const NEW_CITY = '.city-row:last-child';
  const BEATS = [
    {
      step: 1,
      path: '/setup',
      label: '01 / SETUP',
      dur: 38000,
      run: async (eng) => {
        eng.gotoAppStep(1);

        await eng.custom(async (doc, win) => {
          const cities = (win.state && win.state.cities) || [];
          if (cities.length > 1) {
            win.state.cities = cities.slice(0, 1);
          }
          if (cities[0]) cities[0].detailsExpanded = false;
          if (typeof win.renderCities === 'function') win.renderCities();
          (doc.scrollingElement || doc.documentElement).scrollTop = 0;
        });
        await eng.wait(500);

        await eng.narrate(
          'Step 01 · Setup',
          'Build the trip, leg by leg.',
          'A trip is a chain of cities. We start with Córdoba already on the plan, then add the next stop.',
          'br'
        );
        await eng.wait(250);

        await eng.click('#addCityBtn', { travel: 950, padding: 140 });
        await eng.wait(500);

        await eng.narrate(
          'City & dates',
          'Pick the city. Pick the dates.',
          'Type any city — YunHai resolves it through Google Places. Check-in and check-out drive the rest of the trip math.',
          'br'
        );
        await eng.type(NEW_CITY + ' [data-field="name"]', 'Seville, Spain', { padding: 200 });
        await eng.wait(250);
        await eng.setValue(NEW_CITY + ' [data-field="dateFrom"]', '2026-04-26', { travel: 600 });
        await eng.setValue(NEW_CITY + ' [data-field="dateTo"]', '2026-04-30', { travel: 600 });
        await eng.wait(400);

        await eng.narrate(
          'Stay',
          'Where will you be sleeping?',
          'Drop in the hotel or apartment address. YunHai uses it as the anchor for nearby activities and realistic commute times.',
          'tr'
        );
        await eng.type(NEW_CITY + ' [data-accommodation-field="address"]', 'Hotel Alfonso XIII, Plaza San Fernando 2', { padding: 240 });
        await eng.wait(450);

        await eng.narrate(
          'Arrival',
          'How you get into town.',
          'Train, flight, car — your arrival becomes the start of the first full day. Nothing schedules before you actually get there.',
          'tr'
        );
        await eng.click(NEW_CITY + ' [data-tab="arrival"]', { travel: 700, padding: 160 });
        await eng.wait(300);
        await eng.type(NEW_CITY + ' [data-logistics="arrivalLocation"]', 'Estación Sevilla-Santa Justa', { padding: 200 });
        await eng.setValue(NEW_CITY + ' [data-logistics="arrivalTime"]', '11:05');
        await eng.setValue(NEW_CITY + ' [data-logistics="arrivalMode"]', 'train', { travel: 500 });
        await eng.wait(350);

        await eng.narrate(
          'Departure',
          'And how you head out.',
          'Departures shape the last day. A 6:30 bus means no museum that opens at 10.',
          'tl'
        );
        await eng.click(NEW_CITY + ' [data-tab="departure"]', { travel: 700, padding: 160 });
        await eng.wait(300);
        await eng.type(NEW_CITY + ' [data-logistics="departureLocation"]', 'Estación de Autobuses Plaza de Armas', {
          padding: 200, speedMin: 28, speedMax: 55
        });
        await eng.setValue(NEW_CITY + ' [data-logistics="departureTime"]', '06:30');
        await eng.setValue(NEW_CITY + ' [data-logistics="departureMode"]', 'other', { travel: 500 });
        await eng.wait(350);

        await eng.narrate(
          'Notes',
          'Anything else we should remember?',
          'Reservations, must-sees, links, weird constraints — drop them in. YunHai folds them into the suggestion engine so nothing gets dropped.',
          'tr'
        );
        await eng.click(NEW_CITY + ' [data-tab="notes"]', { travel: 700, padding: 160 });
        await eng.wait(300);
        await eng.type(
          NEW_CITY + ' [data-field="notes"]',
          'Flamenco at La Carbonería on Apr 28. Want to see the Alcázar gardens early. Reservation at Eslava — Apr 27, 21:00.',
          { padding: 240, speedMin: 24, speedMax: 50 }
        );
        await eng.wait(700);

        await eng.narrate(
          'Save & continue',
          'On to suggestions.',
          'Everything you just entered feeds the planner. Real venues from Google Places, sized to each city\'s window and your pace.',
          'tl'
        );
        await eng.cursorTo('#planBtn', { travel: 1100, padding: 220 });
        await eng.wait(600);
      },
    },

    {
      step: 2,
      path: '/review',
      label: '02 / REVIEW',
      dur: 8000,
      run: async (eng) => {
        eng.gotoAppStep(2);
        await eng.wait(400);
        await eng.narrate(
          'Step 02 · Review',
          'Approve, skip, or ask for more.',
          'Every activity is a card — what it costs, why it fits, how long it takes. Tap to approve, skip to dismiss, ask for more like this. No decision fatigue.',
          'tr'
        );
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(600);
        const cards = eng.doc.querySelectorAll('#activitiesGrid > *');
        for (let i = 0; i < Math.min(3, cards.length); i++) {
          if (eng.cancelled) return;
          await eng.cursorTo(cards[i], { travel: 1100, padding: 180 });
          eng.cursor.classList.add('is-clicking');
          await eng.wait(160);
          eng.cursor.classList.remove('is-clicking');
          await eng.wait(900);
        }
        const sc = eng.scroller;
        if (sc) {
          const target = Math.min(sc.scrollHeight - FRAME_H, 500);
          await eng.scrollTo({ getBoundingClientRect: () => ({ top: target, left: 0, width: 0, height: 0 }) }, 0);
        }
      },
    },

    {
      step: 3,
      path: '/arrange',
      label: '03 / ARRANGE',
      dur: 7000,
      run: async (eng) => {
        eng.gotoAppStep(3);
        await eng.wait(400);
        await eng.narrate(
          'Step 03 · Arrange',
          'Compose the days.',
          'Drag activities into days, or let auto-arrange group them geographically. Commute times come from real maps, not vibes — the schedule actually fits.',
          'br'
        );
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(500);
        const sc = eng.scroller;
        if (sc) {
          const target = Math.min(sc.scrollHeight - FRAME_H, 600);
          const start = sc.scrollTop;
          const dur = 5000;
          const t0 = performance.now();
          await new Promise((resolve) => {
            const tick = (now) => {
              if (eng.cancelled) return resolve();
              const t = Math.min(1, (now - t0) / dur);
              sc.scrollTop = start + (target - start) * t;
              if (t < 1) requestAnimationFrame(tick);
              else resolve();
            };
            requestAnimationFrame(tick);
          });
        }
      },
    },

    {
      step: 4,
      path: '/finalize',
      label: '04 / FINALIZE',
      dur: 7000,
      run: async (eng) => {
        eng.gotoAppStep(4);
        await eng.wait(400);
        await eng.narrate(
          'Step 04 · Finalize',
          'Trip Health, before you book.',
          'Overlapping reservations, thin mornings, closures — all flagged ahead of time, all fixable in place. Sync to your calendar and share with the party.',
          'tr'
        );
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(500);
        const sc = eng.scroller;
        if (sc) {
          const target = Math.min(sc.scrollHeight - FRAME_H, 600);
          const start = sc.scrollTop;
          const dur = 5000;
          const t0 = performance.now();
          await new Promise((resolve) => {
            const tick = (now) => {
              if (eng.cancelled) return resolve();
              const t = Math.min(1, (now - t0) / dur);
              sc.scrollTop = start + (target - start) * t;
              if (t < 1) requestAnimationFrame(tick);
              else resolve();
            };
            requestAnimationFrame(tick);
          });
        }
      },
    },
  ];

  const viewport = document.getElementById('reelViewport');
  const framesHost = document.getElementById('reelFrames');
  const cursorEl = document.getElementById('reelCursor');
  const narratorBody = document.querySelector('#reelNarrator .reel__narrator-body');
  const narratorEl = document.getElementById('reelNarrator');
  const narratorLabel = document.getElementById('reelNarratorLabel');
  const narratorTitle = document.getElementById('reelNarratorTitle');
  const narratorText = document.getElementById('reelNarratorText');
  const progressBar = document.getElementById('reelProgress');
  const urlPath = document.getElementById('reelUrlPath');
  const dotsHost = document.getElementById('reelDots');
  const playBtn = document.getElementById('reelPlayPause');
  const playIcon = document.getElementById('reelPlayIcon');

  const engine = new Engine({
    viewport, cursor: cursorEl,
    narratorEl, narratorBody, narratorLabel, narratorTitle, narratorText,
  });

  const iframe = document.createElement('iframe');
  iframe.className = 'reel__frame is-active';
  iframe.src = IFRAME_SRC;
  iframe.title = 'YunHai — live product demo';
  iframe.setAttribute('tabindex', '-1');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('loading', 'eager');
  framesHost.appendChild(iframe);
  engine.setIframe(iframe);

  const dots = BEATS.map((beat, i) => {
    const d = document.createElement('button');
    d.className = 'reel__dot';
    d.type = 'button';
    d.textContent = beat.label;
    d.setAttribute('aria-label', 'Go to ' + beat.label);
    d.addEventListener('click', () => seek(i));
    dotsHost.appendChild(d);
    return d;
  });

  function rescale() {
    const w = viewport.clientWidth;
    const s = w / FRAME_W;
    engine.setScale(s);
    iframe.style.transform = 'scale(' + s + ')';
    iframe.style.width = FRAME_W + 'px';
    iframe.style.height = FRAME_H + 'px';
  }
  rescale();
  if (window.ResizeObserver) new ResizeObserver(rescale).observe(viewport);
  else window.addEventListener('resize', rescale);

  let iframeReady = false;
  iframe.addEventListener('load', () => {
    iframeReady = true;
    viewport.classList.remove('is-loading');
  });

  function ensureReady() {
    if (iframeReady) return Promise.resolve();
    return new Promise((resolve) => iframe.addEventListener('load', resolve, { once: true }));
  }

  let idx = 0;
  let playing = false;
  let runToken = 0;
  let raf = null;
  let beatStart = 0;
  let beatDur = 0;

  async function goTo(i, manual) {
    runToken++;
    const myToken = runToken;
    engine.cancelled = true;
    await wait(60);
    if (myToken !== runToken) return;
    engine.cancelled = false;

    idx = (i + BEATS.length) % BEATS.length;
    const beat = BEATS[idx];

    urlPath.textContent = beat.path;
    dots.forEach((d, k) => d.classList.toggle('is-active', k === idx));

    await ensureReady();
    if (myToken !== runToken) return;

    cursorEl.style.opacity = '1';
    beatStart = performance.now();
    beatDur = beat.dur * PACE;
    if (!raf && playing) raf = requestAnimationFrame(tick);

    try {
      await beat.run(engine);
    } catch (e) {
      console.warn('[reel] beat error:', e);
    }

    if (myToken === runToken && playing) {
      goTo(idx + 1);
    }
  }

  function tick(now) {
    // Freeze the progress clock while paused by sliding beatStart forward.
    if (engine.paused) { beatStart += now - (tick._last || now); }
    tick._last = now;
    const elapsed = now - beatStart;
    progressBar.style.width = Math.min(100, (elapsed / beatDur) * 100) + '%';
    if (playing) raf = requestAnimationFrame(tick);
    else raf = null;
  }

  // Freeze in place — the in-flight beat keeps its position and resumes.
  function pause() {
    if (!playing || engine.paused) return;
    engine.paused = true;
    cursorEl.classList.remove('is-clicking');
    playBtn.setAttribute('aria-label', 'Play demo');
    playIcon.innerHTML = '<path d="M7 4 L19 12 L7 20 Z"></path>';
  }
  function resume() {
    if (!engine.paused) return;
    engine.paused = false;
    playBtn.setAttribute('aria-label', 'Pause demo');
    playIcon.innerHTML =
      '<rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect>';
    if (!raf) raf = requestAnimationFrame(tick);
  }
  // Hard stop — used when scrolled out of view; tears down the in-flight beat.
  function stop() {
    playing = false;
    runToken++;
    engine.cancelled = true;
    engine.paused = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }
  function start() {
    if (playing && !engine.paused) return;
    engine.cancelled = false;
    engine.paused = false;
    playing = true;
    playBtn.setAttribute('aria-label', 'Pause demo');
    playIcon.innerHTML =
      '<rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect>';
    if (!raf) raf = requestAnimationFrame(tick);
    goTo(idx);
  }
  playBtn.addEventListener('click', () => (engine.paused ? resume() : pause()));

  // Jump to a specific beat (dot click) — tears down current beat, restarts at i.
  async function seek(i) {
    stop();
    await wait(80);
    idx = (i + BEATS.length) % BEATS.length;
    start();
  }

  // Off-screen: hard stop to free the iframe work. On-screen: restart current beat.
  const reelObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) stop();
        else if (e.isIntersecting && !playing) start();
      });
    },
    { threshold: 0.15 }
  );
  reelObs.observe(document.getElementById('reel'));

  start();
})();
