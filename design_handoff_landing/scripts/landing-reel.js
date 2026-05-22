/* GuideMe — Landing demo reel
 * Drives the iframes for real: clicks real buttons, types into real inputs.
 * Since iframes are same-origin we can reach into contentDocument.
 */
(function () {
  'use strict';

  const FRAME_W = 1440;
  const FRAME_H = 880;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ============================================================
  //  ENGINE
  // ============================================================
  class Engine {
    constructor(els) {
      this.viewport = els.viewport;
      this.cursor = els.cursor;
      this.narratorEl = els.narratorEl;
      this.narratorBody = els.narratorBody;
      this.narratorLabel = els.narratorLabel;
      this.narratorTitle = els.narratorTitle;
      this.narratorText = els.narratorText;
      this.totalSubsteps = 7;
      this.scale = 1;
      this.iframe = null;
      this.cancelled = false;
    }
    setScale(s) { this.scale = s; }
    setIframe(f) { this.iframe = f; }

    get doc() { return this.iframe && this.iframe.contentDocument; }
    get scroller() {
      return this.doc && (this.doc.scrollingElement || this.doc.documentElement);
    }

    // Update the narrator card content with a crossfade.
    // Optional 4th arg `corner` ∈ {'tl','tr','bl','br'} repositions the card.
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
      const start = performance.now();
      while (performance.now() - start < ms) {
        if (this.cancelled) return;
        await wait(Math.min(60, ms - (performance.now() - start)));
      }
    }

    // Scroll iframe document so element is comfortably visible
    async scrollTo(el, padding = 140) {
      const sc = this.scroller;
      if (!sc) return;
      const r = el.getBoundingClientRect();
      const targetTop = sc.scrollTop + r.top - padding;
      const max = sc.scrollHeight - FRAME_H;
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

    // Move cursor to target element. Returns the resolved element for chaining.
    async cursorTo(selector, opts = {}) {
      if (this.cancelled) return null;
      const el = typeof selector === 'string' ? this.doc.querySelector(selector) : selector;
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

    // Click target — moves cursor first, ripples, then fires the real click
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

    // Type into an input, char-by-char, firing input events
    async type(selector, text, opts = {}) {
      const el = typeof selector === 'string' ? this.doc.querySelector(selector) : selector;
      if (!el) { console.warn('[reel] type not found:', selector); return; }
      await this.cursorTo(el, { travel: opts.travel || 600, padding: opts.padding || 200 });
      if (this.cancelled) return;
      el.focus();
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const min = opts.speedMin ?? 35;
      const max = opts.speedMax ?? 70;
      for (const ch of text) {
        if (this.cancelled) return;
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(min + Math.random() * (max - min));
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Set a value without typing (date/time/select fields)
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

    // Run arbitrary DOM work on the iframe
    async custom(fn) {
      if (this.cancelled) return;
      await fn(this.doc, this.iframe.contentWindow, this);
    }
  }

  // ============================================================
  //  BEATS
  // ============================================================
  const BEATS = [
    // ---------------- SETUP — fully scripted ----------------
    {
      src: 'Setup.html',
      path: '/setup',
      step: '01 / SETUP',
      caption: 'Lay out the trip, city by city.',
      dur: 36000,
      run: async (eng) => {
        const doc = eng.doc;

        // --- Reset to clean baseline: only Córdoba, collapsed
        await eng.custom(async (doc) => {
          // Remove any previous demo-inserted card
          doc.querySelectorAll('[data-demo-new]').forEach((n) => n.remove());
          // Remove cities 2 & 3 if still present from original markup
          doc.querySelectorAll('[data-city="2"], [data-city="3"]').forEach((n) => n.remove());
          // Collapse city 1
          const c1 = doc.querySelector('[data-city="1"]');
          if (c1) c1.classList.add('collapsed');
          // Trip arc → single city
          const arcRight = doc.querySelector('.trip-arc__head .r');
          if (arcRight) arcRight.innerHTML = '<b>Apr 24</b> → <b>Apr 26</b> · <b>2</b> nights · <b>1</b> city';
          const arcStops = doc.querySelector('.trip-arc__stops');
          if (arcStops) {
            arcStops.innerHTML =
              '<div class="trip-stop active"><span class="nm">Córdoba</span><span class="pin"></span><span class="dt">04/24 — 04/26</span></div>';
          }
          const arcEdges = doc.querySelector('.trip-arc__edges');
          if (arcEdges) {
            arcEdges.innerHTML =
              '<span class="e">Start · Madrid (MAD)</span><span class="e">End · Córdoba (ODB)</span>';
          }
          const cnt = doc.querySelector('.cities-tool .count');
          if (cnt) cnt.textContent = '1 leg';
          const meta = doc.querySelector('.setup-foot .meta');
          if (meta) meta.textContent = '1 city · 2 nights · 1 of 1 fully filled';
          // Scroll to top
          (doc.scrollingElement || doc.documentElement).scrollTop = 0;
        });
        await eng.wait(700);

        // ---- 1. Add City — cursor goes to top toolbar → narrator bottom-right
        await eng.narrate(
          'Step 01 of 07 · Setup',
          'Build the trip, leg by leg.',
          'Every trip is a chain of cities. We start with an empty plan and add stops one at a time — here we kick it off by adding a new city.',
          'br'
        );
        await eng.wait(250);
        await eng.click('.cities-tool .stool-btn.add', { travel: 950, padding: 140 });

        // Insert empty city card
        await eng.custom(async (doc) => {
          const stack = doc.getElementById('cityStack');
          if (!stack) return;
          const tpl = doc.createElement('article');
          tpl.className = 'city';
          tpl.setAttribute('data-city', '2');
          tpl.setAttribute('data-demo-new', '1');
          tpl.style.opacity = '0';
          tpl.style.transform = 'translateY(10px)';
          tpl.style.transition = 'opacity 380ms ease, transform 380ms ease';
          tpl.innerHTML = `
            <div class="city__head">
              <span class="city__num">02</span>
              <div class="city__main">
                <span class="city__name"><span data-dm="name">Untitled city</span> <span class="city__country" data-dm="country">—</span></span>
                <span class="city__sub" data-dm="sub">Stay <b>—</b> · Arrive <b>—</b></span>
              </div>
              <div class="city__dates">
                <span data-dm="d1">—</span><span class="arrow">→</span><span data-dm="d2">—</span>
                <span class="nights" data-dm="nights">0 nights</span>
              </div>
              <button class="city__chev" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <button class="city__del" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
              </button>
            </div>
            <div class="city__body">
              <nav class="city__tabs">
                <span class="city__tab active" data-tab="stay" data-dm-tab="stay"><span class="dot"></span> Stay</span>
                <span class="city__tab" data-tab="arrival" data-dm-tab="arrival"><span class="dot"></span> Arrival</span>
                <span class="city__tab" data-tab="departure" data-dm-tab="departure"><span class="dot"></span> Departure</span>
                <span class="city__tab" data-tab="notes" data-dm-tab="notes"><span class="dot"></span> Notes</span>
              </nav>

              <div class="pane active" data-pane="stay">
                <div class="grid c-loc-time" style="margin-bottom:14px">
                  <div class="f"><label>City <span class="opt">required</span></label><input class="inp with-icon" data-dm="city" placeholder="Search a city…"></div>
                  <div class="f"><label>Nights</label><input class="inp" data-dm="nightsField" value="0 nights" readonly style="background:var(--paper-2);color:var(--text-500)"></div>
                </div>
                <div class="grid c2">
                  <div class="f"><label>Check-in</label><input class="inp" type="date" data-dm="checkin"></div>
                  <div class="f"><label>Check-out</label><input class="inp" type="date" data-dm="checkout"></div>
                </div>
                <div class="f" style="margin-top:14px">
                  <label>Accommodation address <span class="opt">optional</span></label>
                  <input class="inp with-pin" data-dm="address" placeholder="Street, city, postal code">
                </div>
              </div>

              <div class="pane" data-pane="arrival">
                <div class="grid c-loc-time" style="margin-bottom:14px">
                  <div class="f"><label>Arriving at</label><input class="inp with-pin" data-dm="arriveLoc" placeholder="Station, airport, or address"></div>
                  <div class="f"><label>Time</label><input class="inp" type="time" data-dm="arriveTime"></div>
                </div>
                <div class="grid c-mode-intl">
                  <div class="f"><label>Mode</label><select class="inp" data-dm="arriveMode"><option>Train</option><option>Flight</option><option>Bus</option><option>Car</option><option>Ferry</option></select></div>
                  <div class="f"><label>&nbsp;</label><label class="check-inline"><input type="checkbox"> International</label></div>
                </div>
              </div>

              <div class="pane" data-pane="departure">
                <div class="grid c-loc-time" style="margin-bottom:14px">
                  <div class="f"><label>Departing from</label><input class="inp with-pin" data-dm="departLoc" placeholder="Station, airport, or address"></div>
                  <div class="f"><label>Time</label><input class="inp" type="time" data-dm="departTime"></div>
                </div>
                <div class="grid c-mode-intl">
                  <div class="f"><label>Mode</label><select class="inp" data-dm="departMode"><option>Train</option><option>Flight</option><option>Bus</option><option>Car</option><option>Ferry</option></select></div>
                  <div class="f"><label>&nbsp;</label><label class="check-inline"><input type="checkbox"> International</label></div>
                </div>
              </div>

              <div class="pane" data-pane="notes">
                <div class="f">
                  <label>Notes for this city <span class="opt">bookings, must-sees, anything</span></label>
                  <textarea class="ta" data-dm="notes" placeholder="e.g. tour booked Apr 25 3–5pm, want to see X…"></textarea>
                </div>
              </div>
            </div>`;
          stack.appendChild(tpl);
          // Wire tab switching for the new card
          tpl.querySelectorAll('[data-dm-tab]').forEach((tab) => {
            tab.addEventListener('click', () => {
              const t = tab.getAttribute('data-tab');
              tpl.querySelectorAll('.city__tab').forEach((x) =>
                x.classList.toggle('active', x.getAttribute('data-tab') === t)
              );
              tpl.querySelectorAll('.pane').forEach((p) =>
                p.classList.toggle('active', p.getAttribute('data-pane') === t)
              );
            });
          });
          // Animate in
          requestAnimationFrame(() => {
            tpl.style.opacity = '1';
            tpl.style.transform = 'translateY(0)';
          });
          // Bump count
          const cnt = doc.querySelector('.cities-tool .count');
          if (cnt) cnt.textContent = '2 legs';
        });

        await eng.wait(700);

        // ---- 2. Fill out city + dates — fields at top of new card → narrator bottom-right
        await eng.narrate(
          'Step 02 of 07 · City & dates',
          'Pick the city. Pick the dates.',
          'Type any city — GuideMe will find it. Check-in and check-out propagate up to the trip arc above, so you always see the whole route at a glance.',
          'br'
        );
        await eng.type('[data-demo-new] [data-dm="city"]', 'Seville, Spain', { padding: 200 });
        await eng.custom(async (doc) => {
          const tpl = doc.querySelector('[data-demo-new]');
          if (!tpl) return;
          tpl.querySelector('[data-dm="name"]').textContent = 'Seville';
          tpl.querySelector('[data-dm="country"]').textContent = 'Spain';
        });
        await eng.wait(250);
        await eng.setValue('[data-demo-new] [data-dm="checkin"]', '2026-04-26', { travel: 600 });
        await eng.setValue('[data-demo-new] [data-dm="checkout"]', '2026-04-30', { travel: 600 });

        // Header & trip arc reflect dates
        await eng.custom(async (doc) => {
          const tpl = doc.querySelector('[data-demo-new]');
          if (!tpl) return;
          tpl.querySelector('[data-dm="d1"]').textContent = '04/26';
          tpl.querySelector('[data-dm="d2"]').textContent = '04/30';
          tpl.querySelector('[data-dm="nights"]').textContent = '4 nights';
          tpl.querySelector('[data-dm="nightsField"]').value = '4 nights';
          const arcStops = doc.querySelector('.trip-arc__stops');
          if (arcStops) {
            arcStops.innerHTML =
              '<div class="trip-stop"><span class="nm">Córdoba</span><span class="pin"></span><span class="dt">04/24 — 04/26</span></div>' +
              '<div class="trip-stop active"><span class="nm">Seville</span><span class="pin"></span><span class="dt">04/26 — 04/30</span></div>';
          }
          const arcRight = doc.querySelector('.trip-arc__head .r');
          if (arcRight) arcRight.innerHTML = '<b>Apr 24</b> → <b>Apr 30</b> · <b>6</b> nights · <b>2</b> cities';
          const arcEdges = doc.querySelector('.trip-arc__edges');
          if (arcEdges) arcEdges.innerHTML = '<span class="e">Start · Madrid (MAD)</span><span class="e">End · Seville (SVQ)</span>';
          const meta = doc.querySelector('.setup-foot .meta');
          if (meta) meta.textContent = '2 cities · 6 nights · 1 of 2 fully filled';
        });
        await eng.wait(400);

        // ---- 3. Fill out Stay — address field is mid-card → narrator top-right
        await eng.narrate(
          'Step 03 of 07 · Stay',
          'Where will you be sleeping?',
          'Drop in the hotel or apartment address. GuideMe uses it as the anchor point for nearby activities and to compute realistic commute times later.',
          'tr'
        );
        await eng.type('[data-demo-new] [data-dm="address"]', 'Hotel Alfonso XIII, Plaza San Fernando 2', { padding: 240 });
        await eng.custom(async (doc) => {
          const tpl = doc.querySelector('[data-demo-new]');
          if (tpl) tpl.querySelector('[data-dm="sub"]').innerHTML = 'Stay <b>Alfonso XIII</b> · Arrive <b>—</b>';
        });
        await eng.wait(450);

        // ---- 4. Arrival — tabs + fields in middle → narrator top-right
        await eng.narrate(
          'Step 04 of 07 · Arrival',
          'How you get into town.',
          'Train, plane, bus, ferry — your arrival becomes the start of the first full day. GuideMe won\'t schedule anything before you actually get there.',
          'tr'
        );
        await eng.click('[data-demo-new] [data-dm-tab="arrival"]', { travel: 700, padding: 160 });
        await eng.wait(250);
        await eng.type('[data-demo-new] [data-dm="arriveLoc"]', 'Estación Sevilla-Santa Justa', { padding: 200 });
        await eng.setValue('[data-demo-new] [data-dm="arriveTime"]', '11:05');
        await eng.custom(async (doc) => {
          const tpl = doc.querySelector('[data-demo-new]');
          if (tpl) {
            tpl.querySelector('[data-dm="sub"]').innerHTML = 'Stay <b>Alfonso XIII</b> · Arrive <b>11:05 train</b>';
            tpl.querySelector('[data-dm-tab="arrival"]').classList.add('has-data');
          }
        });
        await eng.wait(350);

        // ---- 5. Departure — same area → flip to top-LEFT for variety + leaves form clear
        await eng.narrate(
          'Step 05 of 07 · Departure',
          'And how you head out.',
          'Departures shape the last day. If you\'re catching a 6:30 bus, the planner won\'t book you a museum that opens at 10.',
          'tl'
        );
        await eng.click('[data-demo-new] [data-dm-tab="departure"]', { travel: 700, padding: 160 });
        await eng.wait(250);
        await eng.type('[data-demo-new] [data-dm="departLoc"]', 'Estación de Autobuses Plaza de Armas', {
          padding: 200, speedMin: 28, speedMax: 55,
        });
        await eng.setValue('[data-demo-new] [data-dm="departTime"]', '06:30');
        await eng.setValue('[data-demo-new] [data-dm="departMode"]', 'Bus', { travel: 500 });
        await eng.custom(async (doc) => {
          const tpl = doc.querySelector('[data-demo-new]');
          if (tpl) tpl.querySelector('[data-dm-tab="departure"]').classList.add('has-data');
        });
        await eng.wait(350);

        // ---- 6. Notes — textarea fills lower pane → narrator top-right
        await eng.narrate(
          'Step 06 of 07 · Notes',
          'Anything else we should remember?',
          'Reservations, must-sees, links, weird constraints — drop them here. GuideMe folds them into the activity suggestions so nothing gets dropped.',
          'tr'
        );
        await eng.click('[data-demo-new] [data-dm-tab="notes"]', { travel: 700, padding: 160 });
        await eng.wait(250);
        await eng.type(
          '[data-demo-new] [data-dm="notes"]',
          'Flamenco at La Carbonería on Apr 28. Want to see the Alcázar gardens early. Reservation at Eslava for tapas — Apr 27, 21:00.',
          { padding: 240, speedMin: 24, speedMax: 50 }
        );
        await eng.custom(async (doc) => {
          const tpl = doc.querySelector('[data-demo-new]');
          if (tpl) tpl.querySelector('[data-dm-tab="notes"]').classList.add('has-data');
          const meta = doc.querySelector('.setup-foot .meta');
          if (meta) meta.textContent = '2 cities · 6 nights · 2 of 2 fully filled';
        });
        await eng.wait(600);

        // ---- 7. Continue to Review
        await eng.narrate(
          'Step 07 of 07 · Save & continue',
          'On to suggestions.',
          'Everything you just entered feeds the suggestion engine. GuideMe pulls real venues from Google Places and starts proposing what to do in each city.',
          'tl'
        );
        await eng.click('.setup-foot .gm-btn--primary', { travel: 1100, padding: 220 });
        await eng.wait(700);
      },
    },

    // ---------------- PROFILE — scroll tour ----------------
    {
      src: 'ProfileWizard.html',
      path: '/profile',
      step: '02 / PROFILE',
      caption: 'Teach GuideMe how you actually travel.',
      dur: 8000,
      run: async (eng) => {
        await eng.narrate(
          'Step 02 · Profile',
          'Teach GuideMe how you travel.',
          'Pace, food preferences, budget, vibe — answer a few quick questions and the suggestions stop being generic top-10 lists and start fitting how you actually like to spend a day.',
          'br'
        );
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(600);
        const targets = eng.doc.querySelectorAll('button, .chip, [role="button"], label');
        const arr = [];
        for (const t of targets) {
          const r = t.getBoundingClientRect();
          if (r.width > 40 && r.height > 24 && arr.length < 4) arr.push(t);
        }
        for (const el of arr) {
          if (eng.cancelled) return;
          await eng.cursorTo(el, { travel: 1000, padding: 180 });
          eng.cursor.classList.add('is-clicking');
          await eng.wait(160);
          eng.cursor.classList.remove('is-clicking');
          await eng.wait(700);
        }
      },
    },

    // ---------------- PLANNER — scroll tour ----------------
    {
      src: 'Planner.html',
      path: '/planner',
      step: '03 / REVIEW',
      caption: 'Approve, skip, or ask for more like this.',
      dur: 8000,
      run: async (eng) => {
        await eng.narrate(
          'Step 03 · Review',
          'Approve, skip, or ask for more.',
          'Every activity is a card with what it costs, why it fits your profile, and how long it takes. Tap to approve, swipe to skip, or ask for more like this — no decision fatigue.',
          'tr'
        );
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(500);
        const cards = eng.doc.querySelectorAll('[data-cards-grid] > *');
        for (let i = 0; i < Math.min(3, cards.length); i++) {
          if (eng.cancelled) return;
          await eng.cursorTo(cards[i], { travel: 1100, padding: 180 });
          eng.cursor.classList.add('is-clicking');
          await eng.wait(160);
          eng.cursor.classList.remove('is-clicking');
          await eng.wait(900);
        }
      },
    },

    // ---------------- ARRANGE — scroll tour ----------------
    {
      src: 'Arrange.html',
      path: '/arrange',
      step: '04 / ARRANGE',
      caption: 'Drag activities into days, geographically grouped.',
      dur: 7000,
      run: async (eng) => {
        await eng.narrate(
          'Step 04 · Arrange',
          'Compose the days.',
          'Drag activities into days, or let auto-arrange group them geographically. Commute times are pulled from real maps — not vibes — so the schedule actually fits.',
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

    // ---------------- FINALIZE — scroll tour ----------------
    {
      src: 'Finalize.html',
      path: '/finalize',
      step: '05 / FINALIZE',
      caption: 'Trip Health flags conflicts before you book.',
      dur: 7000,
      run: async (eng) => {
        await eng.narrate(
          'Step 05 · Finalize',
          'Trip Health, before you book.',
          'Overlapping reservations, thin mornings, museums closed that day — all flagged ahead of time, all fixable in place. No bad surprises after you\'ve paid.',
          'tr'
        );
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(500);
        const sc = eng.scroller;
        if (sc) {
          const target = Math.min(sc.scrollHeight - FRAME_H, 500);
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

    // ---------------- ITINERARY — scroll tour ----------------
    {
      src: 'Itinerary.html',
      path: '/itinerary',
      step: '06 / SHIP IT',
      caption: 'Sync, share, and start packing.',
      dur: 6500,
      run: async (eng) => {
        await eng.narrate(
          'Step 06 · Ship it',
          'Sync, share, start packing.',
          'Export the final itinerary to your calendar, share it with everyone on the trip, and the plan is yours. No more twenty browser tabs — just the day-by-day you trust.',
          'bl'
        );
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(500);
        const sc = eng.scroller;
        if (sc) {
          const target = Math.min(sc.scrollHeight - FRAME_H, 700);
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

  // ============================================================
  //  BOOT
  // ============================================================
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

  const iframes = BEATS.map((beat, i) => {
    const f = document.createElement('iframe');
    f.className = 'reel__frame';
    f.src = beat.src;
    f.title = 'GuideMe — ' + beat.step;
    f.setAttribute('tabindex', '-1');
    f.setAttribute('aria-hidden', 'true');
    f.setAttribute('loading', i === 0 ? 'eager' : 'lazy');
    framesHost.appendChild(f);
    return f;
  });

  const dots = BEATS.map((beat, i) => {
    const d = document.createElement('button');
    d.className = 'reel__dot';
    d.type = 'button';
    d.textContent = beat.step;
    d.setAttribute('aria-label', 'Go to ' + beat.step);
    d.addEventListener('click', () => {
      pause();
      goTo(i, /* manual */ true);
    });
    dotsHost.appendChild(d);
    return d;
  });

  function rescale() {
    const w = viewport.clientWidth;
    const s = w / FRAME_W;
    engine.setScale(s);
    iframes.forEach((f) => {
      f.style.transform = 'scale(' + s + ')';
      f.style.width = FRAME_W + 'px';
      f.style.height = FRAME_H + 'px';
    });
  }
  rescale();
  if (window.ResizeObserver) new ResizeObserver(rescale).observe(viewport);
  else window.addEventListener('resize', rescale);

  iframes[0].addEventListener('load', () => {
    viewport.classList.remove('is-loading');
  }, { once: true });

  function ensureLoaded(f) {
    return new Promise((resolve) => {
      try {
        if (f.contentDocument && f.contentDocument.readyState === 'complete') return resolve();
      } catch (e) {}
      f.addEventListener('load', () => resolve(), { once: true });
    });
  }

  let idx = 0;
  let playing = true;
  let runToken = 0;
  let raf = null;
  let beatStart = 0;
  let beatDur = 0;

  function setCaption(step, text) {
    // Caption pill removed in favor of the narrator card. Beat intro is
    // applied via the first narrate() call inside each beat's run().
  }

  async function goTo(i, manual) {
    runToken++;
    const myToken = runToken;
    engine.cancelled = true;
    await wait(60);
    if (myToken !== runToken) return;
    engine.cancelled = false;

    idx = (i + BEATS.length) % BEATS.length;
    const beat = BEATS[idx];

    iframes.forEach((f, k) => f.classList.toggle('is-active', k === idx));
    engine.setIframe(iframes[idx]);
    urlPath.textContent = beat.path;
    setCaption(beat.step, beat.caption);
    dots.forEach((d, k) => d.classList.toggle('is-active', k === idx));

    await ensureLoaded(iframes[idx]);
    if (myToken !== runToken) return;

    cursorEl.style.opacity = '1';
    beatStart = performance.now();
    beatDur = beat.dur;
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
    if (!playing) { raf = null; return; }
    const elapsed = now - beatStart;
    progressBar.style.width = Math.min(100, (elapsed / beatDur) * 100) + '%';
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    playing = true;
    playBtn.setAttribute('aria-label', 'Pause demo');
    playIcon.innerHTML =
      '<rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect>';
    if (!raf) raf = requestAnimationFrame(tick);
    goTo(idx);
  }
  function pause() {
    playing = false;
    runToken++;
    engine.cancelled = true;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    playBtn.setAttribute('aria-label', 'Play demo');
    playIcon.innerHTML = '<path d="M7 4 L19 12 L7 20 Z"></path>';
  }
  playBtn.addEventListener('click', () => (playing ? pause() : play()));

  // Pause when offscreen
  let wantsPlay = true;
  const reelObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting && playing) {
          wantsPlay = true;
          pause();
        } else if (e.isIntersecting && wantsPlay && !playing) {
          play();
        }
      });
    },
    { threshold: 0.15 }
  );
  reelObs.observe(document.getElementById('reel'));

  // Kick off
  playing = true;
  goTo(0);
})();
