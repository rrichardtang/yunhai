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
  // Divided by the live speed multiplier (1× or 2×) so the speed toggle affects everything.
  const PACE_BASE = 1.6;
  let speedMult = 1;
  const pace = () => PACE_BASE / speedMult;
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
      const total = ms * pace();
      let remaining = total;
      while (remaining > 0) {
        if (this.cancelled) return;
        if (this.paused) { await this.pumpPause(); continue; }
        const slice = Math.min(60, remaining);
        await wait(slice);
        remaining -= slice;
      }
    }

    async scrollToTop(target) {
      const sc = this.scroller;
      if (!sc) return;
      const max = Math.max(0, sc.scrollHeight - FRAME_H);
      const clamped = Math.max(0, Math.min(max, target));
      if (Math.abs(clamped - sc.scrollTop) < 4) return;
      const from = sc.scrollTop;
      const dist = clamped - from;
      const dur = Math.min(900, 260 + Math.abs(dist) * 0.5);
      const start = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          if (this.cancelled) return resolve();
          if (this.paused) { return requestAnimationFrame(step); }
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          sc.scrollTop = from + dist * eased;
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    // Scroll so the element's TOP sits `padding` from the viewport top.
    async scrollTo(el, padding = 140) {
      const sc = this.scroller;
      if (!sc) return;
      const r = el.getBoundingClientRect();
      await this.scrollToTop(sc.scrollTop + r.top - padding);
    }

    // Scroll so the WHOLE element is visible — centers it when taller than the frame
    // allows. Use before interacting with a card so nothing is cropped.
    async scrollIntoFrame(el, { margin = 90 } = {}) {
      const sc = this.scroller;
      if (!sc || !el) return;
      const r = el.getBoundingClientRect();
      const top = sc.scrollTop + r.top;
      const bottom = top + r.height;
      const viewTop = sc.scrollTop;
      const viewBottom = viewTop + FRAME_H;
      let target = viewTop;
      if (r.height + margin * 2 >= FRAME_H) {
        target = top - (FRAME_H - r.height) / 2; // taller than frame: center it
      } else if (top - margin < viewTop) {
        target = top - margin;                    // cropped at top: bring down
      } else if (bottom + margin > viewBottom) {
        target = bottom + margin - FRAME_H;       // cropped at bottom: bring up
      } else {
        return;                                   // already fully visible
      }
      await this.scrollToTop(target);
    }

    // Center an element inside its nearest scrollable ancestor (e.g. a modal body),
    // not the page. Used so modal rows sit mid-screen, never cropped at the bottom.
    async centerInScroller(el) {
      if (!el) return;
      const win = this.win;
      let sc = el.parentElement;
      while (sc && sc !== this.doc.body) {
        const st = win.getComputedStyle(sc);
        const scrolls = /(auto|scroll)/.test(st.overflowY) && sc.scrollHeight > sc.clientHeight + 4;
        if (scrolls) break;
        sc = sc.parentElement;
      }
      if (!sc || sc === this.doc.body) return;
      const er = el.getBoundingClientRect();
      const cr = sc.getBoundingClientRect();
      const target = sc.scrollTop + (er.top - cr.top) - (sc.clientHeight - er.height) / 2;
      const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
      const clamped = Math.max(0, Math.min(max, target));
      if (Math.abs(clamped - sc.scrollTop) < 4) return;
      const from = sc.scrollTop;
      const dist = clamped - from;
      const dur = Math.min(700, 220 + Math.abs(dist) * 0.5);
      const start = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          if (this.cancelled) return resolve();
          if (this.paused) { return requestAnimationFrame(step); }
          const t = Math.min(1, (now - start) / dur);
          sc.scrollTop = from + dist * (1 - Math.pow(1 - t, 3));
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
      // Glide the cursor over ~85% of the (paced) travel window so it always lands
      // before we click — even at 2× — instead of fighting a fixed CSS duration.
      const travel = (opts.travel || 750) * pace();
      const glide = Math.max(220, travel * 0.85);
      this.cursor.style.transitionDuration = `${glide}ms, ${glide}ms, 350ms`;
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
      await this.cursorTo(el, { travel: opts.travel || 600, padding: opts.padding || 200, scroll: opts.scroll });
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
        await wait((min + Math.random() * (max - min)) * pace());
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async setValue(selector, value, opts = {}) {
      const el = await this.cursorTo(selector, { travel: opts.travel || 550, padding: opts.padding || 180, scroll: opts.scroll });
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

  // ----- Mock trip data: lets steps 2-4 render the real UI without the live AI. -----
  // Shapes mirror the app: activities → buildActivityCard fields; days → expandDays
  // (`${city}-${YYYY-MM-DD}`); placements → { dayId, time }. Seeded activities are never
  // enriched (renderActivities doesn't call enrichActivity), so imageUrl '' is safe.
  const CORDOBA = 'Córdoba, Spain';
  const SEVILLE = 'Seville, Spain';

  const DEMO_CITIES = [
    {
      id: 'demo-cordoba', name: CORDOBA, startDate: '2026-04-23', endDate: '2026-04-25',
      leaveTime: '18:00', notes: '', detailsExpanded: false,
      latitude: 37.8882, longitude: -4.7794,
      logistics: { arrival: { date: '2026-04-23', time: '13:00', mode: 'train', location: 'Córdoba Station' },
        departure: { date: '2026-04-25', time: '21:30', mode: 'train', location: 'Córdoba Station' } }
    },
    {
      id: 'demo-seville', name: SEVILLE, startDate: '2026-04-26', endDate: '2026-04-27',
      leaveTime: '20:00', notes: 'Flamenco at La Carbonería on Apr 27.', detailsExpanded: false,
      latitude: 37.3891, longitude: -5.9845,
      logistics: { arrival: { date: '2026-04-26', time: '10:30', mode: 'train', location: 'Sevilla-Santa Justa' },
        departure: { date: '2026-04-27', time: '23:30', mode: 'bus', location: 'Plaza de Armas' } }
    }
  ];

  const DEMO_DAYS = [
    { id: `${CORDOBA}-2026-04-23`, city: CORDOBA, date: '2026-04-23' },
    { id: `${CORDOBA}-2026-04-24`, city: CORDOBA, date: '2026-04-24' },
    { id: `${CORDOBA}-2026-04-25`, city: CORDOBA, date: '2026-04-25' },
    { id: `${SEVILLE}-2026-04-26`, city: SEVILLE, date: '2026-04-26' },
    { id: `${SEVILLE}-2026-04-27`, city: SEVILLE, date: '2026-04-27' }
  ];

  // Photos are self-hosted at /img/demo/<slug>.jpg (slug = id without the "demo-" prefix).
  // Drop a file in public/img/demo/ to fill a card; a missing file falls back to the
  // placeholder automatically (activityImgHtml has an onerror handler). Override per-activity
  // by passing imageUrl explicitly.
  const demoPhoto = (id) => `/img/demo/${String(id).replace(/^demo-/, '')}.jpg`;
  const act = (o) => ({
    type: 'landmark', cost_type: 'per_person', duration_hours: 2,
    imageUrl: o.id ? demoPhoto(o.id) : '',
    booking_type: 'none', booking_links: [], userAdded: false, ...o
  });

  const DEMO_ACTIVITIES = [
    act({ id: 'demo-mezquita', name: 'Mezquita-Catedral de Córdoba', city: CORDOBA, type: 'landmark',
      why_it_fits: 'A UNESCO masterpiece — a forest of red-and-white arches you can wander for hours. Exactly the kind of slow, architectural awe you flagged.',
      pitfall: 'Late-morning tour groups swarm the prayer hall — go right at opening.',
      booking_advice: 'Buy timed-entry tickets online; the on-site queue eats an hour.',
      insider_tips: 'Free entry weekday mornings 08:30–09:30 if you skip the guided route.',
      estimated_cost_usd: 13, duration_hours: 2, opening_hours: '08:30–19:00',
      // Fixed time → enables the Arrange "Finalize" button (updateFinalizeBtn gate).
      timing: { fixed: { date: '2026-04-25', time: '09:30' } } }),
    act({ id: 'demo-alcazar-cor', name: 'Alcázar de los Reyes Cristianos', city: CORDOBA, type: 'outdoors',
      why_it_fits: 'Terraced gardens, fountains and Moorish towers a six-minute walk from the Mezquita — an easy second stop.',
      pitfall: 'Limited shade at midday; the garden loop is exposed.',
      booking_advice: 'No reservation needed — pay at the gate.',
      estimated_cost_usd: 5, duration_hours: 1.5, opening_hours: '09:15–20:00' }),
    act({ id: 'demo-patios', name: 'Patios de San Basilio', city: CORDOBA, type: 'outdoors',
      why_it_fits: 'Hidden flower-filled courtyards locals open to visitors — the offbeat, non-top-10 find you love.',
      pitfall: 'Best in May during the Patio Festival; some close midday.',
      booking_advice: 'A few patios take a small donation at the door.',
      estimated_cost_usd: 0, duration_hours: 1, opening_hours: '11:00–14:00, 18:00–22:00' }),
    act({ id: 'demo-bodegas', name: 'Lunch at Bodegas Mezquita', city: CORDOBA, type: 'food',
      why_it_fits: 'Classic Córdoban plates — salmorejo, oxtail, no seafood in sight — a short walk from the old town.',
      pitfall: 'Fills up by 2pm with tour groups.',
      booking_advice: 'Walk-ins fine before 1:30pm, otherwise book ahead.',
      estimated_cost_usd: 28, duration_hours: 1, opening_hours: '12:00–16:00, 20:00–23:00' }),
    act({ id: 'demo-puente', name: 'Puente Romano & Calahorra Tower', city: CORDOBA, type: 'landmark',
      why_it_fits: 'The Roman bridge over the Guadalquivir at golden hour — the kind of slow riverside view you asked for.',
      pitfall: 'Very exposed; skip it at midday heat.',
      booking_advice: 'Bridge is free; tower museum is a few euros.',
      estimated_cost_usd: 5, duration_hours: 1, opening_hours: '10:00–19:00' }),
    act({ id: 'demo-juderia', name: 'Judería Old-Town Wander', city: CORDOBA, type: 'outdoors',
      why_it_fits: 'Whitewashed lanes, hidden plazas and craft shops — exactly the offbeat, on-foot drifting you love.',
      pitfall: 'Easy to get turned around; that’s half the fun.',
      booking_advice: 'No booking — just wander.',
      estimated_cost_usd: 0, duration_hours: 1, opening_hours: 'Open daily' }),
    // --- Córdoba arrival afternoon (Apr 24) ---
    act({ id: 'demo-mercado', name: 'Mercado Victoria Food Hall', city: CORDOBA, type: 'food',
      why_it_fits: 'A buzzing covered market to land in — small plates, local wine, zero seafood pressure. Easy first stop off the train.',
      pitfall: 'Busiest right at lunch; mid-afternoon is calmer.',
      booking_advice: 'No booking — grab a stool at any stall.',
      estimated_cost_usd: 18, duration_hours: 1, opening_hours: '12:00–24:00' }),
    act({ id: 'demo-vinos', name: 'Taberna Sunset on Calleja de las Flores', city: CORDOBA, type: 'nightlife',
      why_it_fits: 'A glass of Montilla in the prettiest flowered alley as the light goes gold — a slow, lively first evening.',
      pitfall: 'The famous alley gets photo-crowded; go for the side tabernas.',
      booking_advice: 'Walk-in; cash is handy.',
      estimated_cost_usd: 12, duration_hours: 1, opening_hours: '18:00–24:00' }),
    act({ id: 'demo-realalcazar', name: 'Real Alcázar de Sevilla', city: SEVILLE, type: 'landmark',
      why_it_fits: 'The royal palace from Game of Thrones — tilework, sunken baths and the Ambassadors’ hall. Unmissable in Seville.',
      pitfall: 'Sells out days ahead in spring.',
      booking_advice: 'Book the first 09:30 slot online — mornings are calm and cool.',
      estimated_cost_usd: 15, duration_hours: 2.5, opening_hours: '09:30–17:00' }),
    act({ id: 'demo-flamenco', name: 'Flamenco at La Carbonería', city: SEVILLE, type: 'nightlife',
      why_it_fits: 'A raw, no-cover tablao in a candlelit old coal yard — the lively-nights energy from your profile.',
      pitfall: 'No reservations; arrive 30 min early for a seat.',
      booking_advice: 'Free entry, buy a drink — cash only.',
      estimated_cost_usd: 8, cost_type: 'per_person', duration_hours: 1.5, opening_hours: '20:00–02:00' }),
    act({ id: 'demo-plaza-espana', name: 'Plaza de España', city: SEVILLE, type: 'landmark',
      why_it_fits: 'A half-kilometre tiled crescent best at golden hour — exactly the view-at-sunset moment you asked for.',
      pitfall: 'Crowded by afternoon; rowboats have a long queue.',
      booking_advice: 'Free and open-air — no booking.',
      estimated_cost_usd: 0, duration_hours: 1, opening_hours: 'Open 24h' }),
    act({ id: 'demo-catedral', name: 'Seville Cathedral & Giralda Climb', city: SEVILLE, type: 'landmark',
      why_it_fits: 'The world’s largest Gothic cathedral, then a ramped climb up the Giralda for the whole-city view.',
      pitfall: 'Long midday queues; the ramp gets warm.',
      booking_advice: 'Buy a timed combined ticket online.',
      estimated_cost_usd: 12, duration_hours: 1.5, opening_hours: '11:00–17:00' }),
    act({ id: 'demo-triana', name: 'Triana Market & Riverside Walk', city: SEVILLE, type: 'outdoors',
      why_it_fits: 'Cross the river to the ceramic quarter — a working market and a slow walk back along the Guadalquivir.',
      pitfall: 'Market winds down by mid-afternoon.',
      booking_advice: 'No booking needed.',
      estimated_cost_usd: 0, duration_hours: 1, opening_hours: '09:00–15:00' }),
    act({ id: 'demo-setas', name: 'Las Setas de Sevilla', city: SEVILLE, type: 'landmark',
      why_it_fits: 'The giant timber “mushrooms” — a rooftop walkway that’s pure sunset territory, just like you flagged.',
      pitfall: 'Last entry is well before close; check times.',
      booking_advice: 'Small entry fee; pay at the lift.',
      estimated_cost_usd: 5, duration_hours: 1, opening_hours: '10:00–23:00' }),

    // --- Filler stops: calendar/checklist only (not in Review). No photos needed — the
    //     Arrange/Finalize cards show time + icon + name, not an image. ---
    // Córdoba
    act({ id: 'demo-sinagoga', name: 'Sinagoga & Casa de Sefarad', city: CORDOBA, type: 'culture',
      why_it_fits: 'A tiny 14th-c. synagogue and Sephardic museum tucked in the Judería — exactly the offbeat history you like.',
      pitfall: 'Very small; it fills fast with tour groups.', booking_advice: 'Cheap entry, pay at the door.',
      estimated_cost_usd: 3, duration_hours: 1, opening_hours: '09:00–20:00' }),
    act({ id: 'demo-viana', name: 'Palacio de Viana Patios', city: CORDOBA, type: 'outdoors',
      why_it_fits: 'Twelve connected courtyards in a noble house — the patio city at its most peaceful.',
      pitfall: 'Closed Mondays; last entry early.', booking_advice: 'Ticket at the gate, no need to pre-book.',
      estimated_cost_usd: 8, duration_hours: 1.5, opening_hours: '10:00–19:00' }),
    act({ id: 'demo-hammam-cor', name: 'Hammam Al Ándalus Córdoba', city: CORDOBA, type: 'wellness',
      why_it_fits: 'A candlelit thermal-bath wind-down after a full day on foot — slow travel, literally.',
      pitfall: 'Timed sessions; arrive 15 min early.', booking_advice: 'Reserve a slot online; bring a swimsuit.',
      estimated_cost_usd: 38, duration_hours: 1.5, opening_hours: '10:00–24:00' }),
    act({ id: 'demo-tablao-cor', name: 'Tablao Flamenco Cardenal', city: CORDOBA, type: 'nightlife',
      why_it_fits: 'An intimate courtyard flamenco show — the lively-nights energy without the tourist arena.',
      pitfall: 'One show a night; it sells out.', booking_advice: 'Book the evening show ahead.',
      estimated_cost_usd: 23, cost_type: 'per_person', duration_hours: 1.5, opening_hours: '20:00–23:00' }),
    act({ id: 'demo-salmorejo', name: 'Salmorejo tasting at La Boca', city: CORDOBA, type: 'food',
      why_it_fits: 'Creative Córdoban small plates — and no seafood on the tasting menu, just as you asked.',
      pitfall: 'Tiny dining room; book or go early.', booking_advice: 'Reserve for dinner.',
      estimated_cost_usd: 34, duration_hours: 1.5, opening_hours: '13:00–16:00, 20:00–23:30' }),
    // Seville
    act({ id: 'demo-barrio-santa-cruz', name: 'Barrio Santa Cruz Wander', city: SEVILLE, type: 'outdoors',
      why_it_fits: 'Orange-tree plazas and twisting lanes in the old Jewish quarter — pure aimless-drift territory.',
      pitfall: 'Easy to lose the crowd and yourself; bring water.', booking_advice: 'No booking — just wander.',
      estimated_cost_usd: 0, duration_hours: 1, opening_hours: 'Open daily' }),
    act({ id: 'demo-tapas-lonja', name: 'Tapas crawl · El Arenal', city: SEVILLE, type: 'food',
      why_it_fits: 'Three classic tabernas, one street — Iberian ham and Rioja, zero seafood pressure.',
      pitfall: 'Standing-room only after 9pm.', booking_advice: 'No booking; go stool to stool.',
      estimated_cost_usd: 26, duration_hours: 1.5, opening_hours: '12:00–16:00, 20:00–24:00' }),
    act({ id: 'demo-metropol-bar', name: 'Sunset drinks above Las Setas', city: SEVILLE, type: 'nightlife',
      why_it_fits: 'A rooftop drink as the city turns gold — the sunset view you keep flagging, with a glass in hand.',
      pitfall: 'Limited seats at golden hour.', booking_advice: 'Walk-in; arrive before sunset.',
      estimated_cost_usd: 14, duration_hours: 1, opening_hours: '17:00–01:00' }),
    act({ id: 'demo-maria-luisa', name: 'Parque de María Luisa stroll', city: SEVILLE, type: 'outdoors',
      why_it_fits: 'Shaded fountains and tiled benches beside Plaza de España — a calm green pause mid-day.',
      pitfall: 'Big; pick one loop rather than all of it.', booking_advice: 'Free, open all day.',
      estimated_cost_usd: 0, duration_hours: 1, opening_hours: 'Open daily' }),
    act({ id: 'demo-casa-pilatos', name: 'Casa de Pilatos', city: SEVILLE, type: 'culture',
      why_it_fits: 'A half-palace of Mudéjar tilework and a quiet courtyard most top-10 lists skip.',
      pitfall: 'Upper floor is guided-only and timed.', booking_advice: 'Ground-floor ticket at the door.',
      estimated_cost_usd: 10, duration_hours: 1, opening_hours: '09:00–18:00' }),
    act({ id: 'demo-hospital-caridad', name: 'Hospital de los Venerables', city: SEVILLE, type: 'culture',
      why_it_fits: 'A jewel-box baroque chapel and patio in Santa Cruz — small, calm, and skippable-by-crowds.',
      pitfall: 'Short visit; pairs well with the barrio walk.', booking_advice: 'Ticket at the door.',
      estimated_cost_usd: 8, duration_hours: 1, opening_hours: '10:00–18:00' })
  ];

  // The 02/Review beat shows a curated, photo-backed subset (the filler stops below exist
  // only to fill the Arrange/Finalize calendar — keeping them out of Review avoids a wall of
  // placeholder cards). Must include every activity the Review choreography touches.
  const REVIEW_IDS = ['demo-mezquita', 'demo-alcazar-cor', 'demo-patios', 'demo-bodegas', 'demo-realalcazar', 'demo-plaza-espana'];
  const DEMO_REVIEW_ACTIVITIES = DEMO_ACTIVITIES.filter((a) => REVIEW_IDS.includes(a.id));

  // Review opens with a couple already approved (not a blank slate).
  const DEMO_REVIEWED = {
    'demo-mezquita': { approved: true, notes: '' },
    'demo-realalcazar': { approved: true, notes: '' }
  };

  // Arrange/Finalize present an already-built trip: everything placed is approved so the
  // day columns and itinerary render full. (Review uses DEMO_REVIEWED instead.)
  // Every placed activity must be approved here so it renders in Arrange AND appears in the
  // Finalize/booking checklist (buildChecklistFromState includes all approved activities).
  const DEMO_REVIEWED_ARRANGED = Object.fromEntries(
    DEMO_ACTIVITIES.map((a) => [a.id, {
      approved: true,
      notes: a.id === 'demo-mezquita' ? 'Book the 08:30 slot — quietest light for photos.' : ''
    }])
  );

  // Pre-arranged calendar — each day packed ~09:30→21:00 with small gaps so the timeline
  // reads full (the grid spans 6am–2am, so sparse days look empty). Times are 24h.
  const D = (city, date, time) => ({ dayId: `${city}-${date}`, time });
  const DEMO_PLACEMENTS = {
    // Córdoba Apr 23 — arrival 13:00; first stop after the accommodation card (~13:45).
    'demo-viana': D(CORDOBA, '2026-04-23', '14:45'),
    'demo-sinagoga': D(CORDOBA, '2026-04-23', '16:45'),
    'demo-vinos': D(CORDOBA, '2026-04-23', '18:45'),
    'demo-tablao-cor': D(CORDOBA, '2026-04-23', '20:30'),
    // Córdoba Apr 24 — full day
    'demo-mercado': D(CORDOBA, '2026-04-24', '09:30'),
    'demo-juderia': D(CORDOBA, '2026-04-24', '11:00'),
    'demo-salmorejo': D(CORDOBA, '2026-04-24', '13:00'),
    'demo-puente': D(CORDOBA, '2026-04-24', '15:30'),
    'demo-hammam-cor': D(CORDOBA, '2026-04-24', '18:00'),
    // Córdoba Apr 25 — hero day
    'demo-mezquita': D(CORDOBA, '2026-04-25', '09:30'),
    'demo-bodegas': D(CORDOBA, '2026-04-25', '12:00'),
    'demo-alcazar-cor': D(CORDOBA, '2026-04-25', '13:45'),
    'demo-patios': D(CORDOBA, '2026-04-25', '16:00'),
    // Seville Apr 26 — arrival 10:30
    'demo-realalcazar': D(SEVILLE, '2026-04-26', '11:30'),
    'demo-catedral': D(SEVILLE, '2026-04-26', '14:30'),
    'demo-barrio-santa-cruz': D(SEVILLE, '2026-04-26', '16:30'),
    'demo-casa-pilatos': D(SEVILLE, '2026-04-26', '18:15'),
    'demo-tapas-lonja': D(SEVILLE, '2026-04-26', '20:30'),
    // Seville Apr 27 — full day
    'demo-triana': D(SEVILLE, '2026-04-27', '10:00'),
    'demo-hospital-caridad': D(SEVILLE, '2026-04-27', '12:00'),
    'demo-maria-luisa': D(SEVILLE, '2026-04-27', '13:30'),
    'demo-plaza-espana': D(SEVILLE, '2026-04-27', '15:30'),
    'demo-setas': D(SEVILLE, '2026-04-27', '18:00'),
    'demo-metropol-bar': D(SEVILLE, '2026-04-27', '20:00'),
    'demo-flamenco': D(SEVILLE, '2026-04-27', '21:30')
  };

  // Transit pills between consecutive placed stops per day. Keyed `fromId->toId`
  // (commutePairKey). The Finalize step reveals these to show the day "snapping" together.
  const cm = (mins) => ({ selectedMode: 'driving', modes: { driving: { durationMinutes: mins, modeIcon: '🚗' } } });
  const DEMO_COMMUTES = {
    // Córdoba Apr 23
    'demo-viana->demo-sinagoga': cm(9),
    'demo-sinagoga->demo-vinos': cm(5),
    'demo-vinos->demo-tablao-cor': cm(6),
    // Córdoba Apr 24
    'demo-mercado->demo-juderia': cm(8),
    'demo-juderia->demo-salmorejo': cm(5),
    'demo-salmorejo->demo-puente': cm(7),
    'demo-puente->demo-hammam-cor': cm(9),
    // Córdoba Apr 25 (hero day)
    'demo-mezquita->demo-bodegas': cm(7),
    'demo-bodegas->demo-alcazar-cor': cm(6),
    'demo-alcazar-cor->demo-patios': cm(10),
    // Seville Apr 26
    'demo-realalcazar->demo-catedral': cm(9),
    'demo-catedral->demo-barrio-santa-cruz': cm(6),
    'demo-barrio-santa-cruz->demo-casa-pilatos': cm(8),
    'demo-casa-pilatos->demo-tapas-lonja': cm(12),
    // Seville Apr 27
    'demo-triana->demo-hospital-caridad': cm(13),
    'demo-hospital-caridad->demo-maria-luisa': cm(10),
    'demo-maria-luisa->demo-plaza-espana': cm(5),
    'demo-plaza-espana->demo-setas': cm(15),
    'demo-setas->demo-metropol-bar': cm(4),
    'demo-metropol-bar->demo-flamenco': cm(8)
  };

  // Used for the faked Replace swap. place_id/price_level set + a derived imageUrl so the
  // app's enrichActivity() (called by replaceActivityInState) makes no network calls.
  const REPLACEMENT = act({
    id: 'demo-patios-replacement', name: 'Hammam Al Ándalus (Arab baths)', city: CORDOBA, type: 'wellness',
    why_it_fits: 'A candlelit thermal bath circuit in a restored Moorish house — a calm, offbeat evening that fits your slow-travel pace better than another courtyard walk.',
    pitfall: 'Sessions are timed; latecomers lose part of the slot.',
    booking_advice: 'Reserve a 90-minute slot online; bring a swimsuit.',
    insider_tips: 'The 21:00 session is quietest — almost private midweek.',
    estimated_cost_usd: 42, duration_hours: 1.5, opening_hours: '10:00–24:00',
    place_id: 'demo-place-hammam', price_level: 2
  });

  const seed = (eng, partial) => eng.custom(async (doc, win) => {
    if (typeof win.applyDemoState === 'function') win.applyDemoState(partial);
  });

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
          'Where will you be staying?',
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
          'Tell it what you actually like.',
          'The more honest, specific signals you give — tastes, dislikes, must-dos — the better your plan. A few clear bullet points beat a paragraph.',
          'tr'
        );
        await eng.click(NEW_CITY + ' [data-tab="notes"]', { travel: 700, padding: 160 });
        await eng.wait(300);
        await eng.type(
          NEW_CITY + ' [data-field="notes"]',
          '- I’ve heard a lot about flamenco shows and want to check one out\n- I don’t like paella or other seafood\n- Prefer slow mornings, lively nights\n- Reservation at Eslava — Apr 27, 21:00',
          { padding: 240, speedMin: 18, speedMax: 40 }
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
      dur: 40000,
      run: async (eng) => {
        // Seed real activity cards, then drive the genuine review UI.
        await seed(eng, { activities: DEMO_REVIEW_ACTIVITIES, reviewed: { ...DEMO_REVIEWED } });
        eng.gotoAppStep(2);
        await eng.custom(async (doc, win) => { if (win.renderActivities) win.renderActivities(); });
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(500);

        const card = (id) => eng.doc.querySelector(`.activity-card[data-activity-id="${id}"]`);
        const inCard = (id, sel) => { const c = card(id); return c ? c.querySelector(sel) : null; };
        // Bring the whole card into frame first so nothing is cropped, then settle.
        const focusCard = async (id) => { await eng.scrollIntoFrame(card(id)); await eng.wait(260); };
        // Click without re-scrolling (the card is already framed).
        const tap = async (el, opts = {}) => {
          await eng.cursorTo(el, { travel: opts.travel || 850, padding: 160, scroll: false });
          eng.cursor.classList.add('is-clicking');
          await eng.wait(160);
          if (!eng.cancelled) el?.click();
          eng.cursor.classList.remove('is-clicking');
        };

        await eng.narrate(
          'Step 02 · Review',
          'Every suggestion is a card.',
          'Real venues from Google Places — what it costs, why it fits you, the pitfalls, and booking advice. No fabricated top-10 filler.',
          'tr'
        );
        await eng.wait(900);

        // Approve
        await eng.narrate(
          'Approve',
          'Keep the ones you love.',
          'Approve adds it to your trip and the running budget. Tap again to un-approve — nothing is locked until you say so.',
          'tr'
        );
        await focusCard('demo-alcazar-cor');
        await tap(inCard('demo-alcazar-cor', '.approve'));
        await eng.wait(1100);

        // Decline
        await eng.narrate(
          'Decline',
          'Drop what doesn’t fit.',
          'Decline dismisses a suggestion. If it was scheduled, it leaves your days too — so the plan always reflects what you actually want.',
          'tl'
        );
        await focusCard('demo-plaza-espana');
        await tap(inCard('demo-plaza-espana', '.decline'));
        await eng.wait(1100);

        // Notes
        await eng.narrate(
          'Notes',
          'Pin a reminder to any stop.',
          'Reservation refs, who’s coming, a must-try dish — saved right on the card and folded into the plan.',
          'tr'
        );
        await focusCard('demo-mezquita');
        await eng.type(`#actNotes-demo-mezquita`, 'Book the 08:30 slot — quietest light for photos.', { padding: 200, scroll: false });
        await eng.wait(250);
        await tap(inCard('demo-mezquita', '.save-activity-notes'), { travel: 650 });
        await eng.wait(1100);

        // Replace / modify (faked swap — no API). Keep the whole card framed so the
        // viewer can watch the activity actually change.
        await eng.narrate(
          'Don’t love it? Swap it.',
          'Ask for something that fits better.',
          'Say why in a line, and YunHai replaces it with a smarter match tuned to your taste — here, a calm evening over another courtyard walk.',
          'bl'
        );
        await focusCard('demo-patios');
        await eng.type(`#actDecline-demo-patios`, 'Want something calmer for the evening, not another walk.', { padding: 220, scroll: false, speedMin: 26, speedMax: 52 });
        await eng.wait(300);
        await focusCard('demo-patios');
        const replaceBtn = inCard('demo-patios', '.confirm-replace');
        await eng.cursorTo(replaceBtn, { travel: 700, padding: 160, scroll: false });
        eng.cursor.classList.add('is-clicking');
        await eng.wait(160);
        eng.cursor.classList.remove('is-clicking');
        if (replaceBtn) replaceBtn.innerHTML = '<i class="ph-bold ph-spinner"></i>';
        await eng.wait(1300);
        await eng.custom(async (doc, win) => {
          if (win.replaceActivityInState) win.replaceActivityInState('demo-patios', { ...REPLACEMENT });
        });
        await eng.scrollIntoFrame(card('demo-patios-replacement'));
        await eng.wait(1800);

        // Create a new activity — open the modal and fill it out as a worked example.
        await eng.narrate(
          'Missing something?',
          'Add your own activity.',
          'Got a reservation or a place you already know? Fill in a few details and it joins the trip like any other stop.',
          'br'
        );
        const addCard = eng.doc.querySelector('#activitiesGrid .add-activity-card');
        await eng.scrollIntoFrame(addCard);
        await eng.wait(200);
        await tap(addCard, { travel: 1000 });
        await eng.wait(900);

        // Fields live in a centered overlay — no page scroll needed (scroll:false).
        await eng.type('#addActivityName', 'Cooking class — Andalusian tapas', { scroll: false, padding: 0 });
        await eng.wait(250);
        await eng.setValue('#addActivityCost', '55', { scroll: false, after: 250 });
        await eng.type('#addActivityWhy', 'A hands-on evening making local tapas — fits the “lively nights, no seafood” notes from setup.', { scroll: false, padding: 0, speedMin: 22, speedMax: 44 });
        await eng.wait(900);
        await eng.cursorTo('#addActivitySubmit', { travel: 700, scroll: false });
        await eng.wait(1100);
        await eng.custom(async (doc) => { doc.getElementById('addActivityCancel')?.click(); });
        await eng.wait(500);
      },
    },

    {
      step: 3,
      path: '/arrange',
      label: '03 / ARRANGE',
      dur: 52000,
      run: async (eng) => {
        // Seed the placed calendar — but NO commutes yet, so the day "snaps together"
        // (transit pills appear) only after Finalize, below.
        await seed(eng, {
          cities: DEMO_CITIES, days: DEMO_DAYS,
          activities: DEMO_ACTIVITIES, reviewed: { ...DEMO_REVIEWED_ARRANGED },
          placements: { ...DEMO_PLACEMENTS }, commutes: {}, arrangeCity: CORDOBA
        });
        eng.gotoAppStep(3);
        await eng.custom(async (doc, win) => { if (win.renderArrange) win.renderArrange(); });
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(500);

        await eng.narrate(
          'Step 03 · Arrange',
          'Your days, laid out on a real clock.',
          'Approved stops sit on a true hourly timeline — drag to move or resize, and overlaps become obvious at a glance.',
          'br'
        );
        await eng.wait(1400);

        // ---- Booking checklist (cursor-driven, pure frontend) ----
        await eng.narrate(
          'Booking checklist',
          'Track every reservation in one place.',
          'Mark what needs booking, attach confirmation numbers, set times, and check things off as you lock them in.',
          'br'
        );
        // Surface the Checklist button (it lives in the embed-hidden topbar): relocate it to
        // <body> and float it, so the cursor can visibly navigate to it.
        await eng.custom(async (doc) => {
          const btn = doc.getElementById('checklistBtn');
          if (btn) { doc.body.appendChild(btn); btn.classList.add('embed-float'); }
        });
        await eng.wait(400);
        const clBtn = eng.doc.getElementById('checklistBtn');
        await eng.cursorTo(clBtn, { scroll: false, travel: 1100 });
        eng.cursor.classList.add('is-clicking'); await eng.wait(180);
        eng.cursor.classList.remove('is-clicking');
        await eng.custom(async (doc, win) => { if (win.openChecklistModal) win.openChecklistModal(); });
        await eng.wait(1100);

        // Find a checklist row by its visible activity name; center it in the modal's own
        // scroll area before interacting so it sits mid-screen (never cropped at the bottom).
        const clRow = (name) => Array.from(eng.doc.querySelectorAll('#bookingChecklist [data-cl-item]'))
          .find((r) => (r.querySelector('.cl-item-name')?.textContent || '').includes(name)) || null;
        const inRow = (rowEl, sel) => (rowEl ? rowEl.querySelector(sel) : null);
        const focusRow = async (name) => { await eng.centerInScroller(clRow(name)); await eng.wait(280); };
        const clickEl = async (el, opts = {}) => {
          if (!el) return;
          await eng.cursorTo(el, { scroll: false, travel: opts.travel || 750 });
          eng.cursor.classList.add('is-clicking'); await eng.wait(160);
          if (!eng.cancelled) el.click(); eng.cursor.classList.remove('is-clicking');
        };

        // 1) Ticket icon → "Booking Not Required" on a free stop (Judería wander, no ticket).
        await eng.narrate(
          'No ticket needed?',
          'One tap files it away.',
          'Free or walk-in stops don’t need a booking — tap the ticket to move them to “Booking Not Required.”',
          'tr'
        );
        await focusRow('Judería');
        await clickEl(inRow(clRow('Judería'), '[data-cl-booking-toggle]'));
        await eng.wait(1200);

        // 2) Full booking flow on the Mezquita row: expand → set time → confirmation # → check off.
        await eng.narrate(
          'Lock in a booking',
          'Time, confirmation, done.',
          'Open a stop, set its time, drop in the confirmation number, and check it off — now it’s locked to your plan.',
          'tr'
        );
        await focusRow('Mezquita');
        await clickEl(inRow(clRow('Mezquita'), '[data-cl-collapse-row]'), { travel: 800 });
        await eng.wait(600);
        await focusRow('Mezquita'); // expanded row is taller — recenter it
        await eng.setValue(inRow(clRow('Mezquita'), '[data-cl="activityTime"]'), '09:30', { scroll: false, after: 350 });
        await eng.setValue(inRow(clRow('Mezquita'), '[data-cl="activityEndTime"]'), '11:30', { scroll: false, after: 350 });
        // Reveal the reference field (it lives behind "More details").
        await clickEl(inRow(clRow('Mezquita'), '[data-cl-more]'), { travel: 650 });
        await eng.wait(500);
        await focusRow('Mezquita');
        await eng.type(inRow(clRow('Mezquita'), '[data-cl="referenceNum"]'), 'MZQ-4471', { scroll: false, padding: 0 });
        await eng.wait(500);
        await clickEl(inRow(clRow('Mezquita'), '[data-cl-check]'), { travel: 700 });
        await eng.wait(1200);

        // Close the checklist, then hide the relocated floating button.
        await clickEl(eng.doc.getElementById('checklistModalClose'), { travel: 800 });
        await eng.custom(async (doc) => {
          const btn = doc.getElementById('checklistBtn');
          if (btn) { btn.classList.remove('embed-float'); btn.style.display = 'none'; }
        });
        await eng.wait(700);

        // ---- Scheduling preferences modal (cursor-driven, pure frontend) ----
        await eng.narrate(
          'Scheduling preferences',
          'Set the rhythm once.',
          'Day start and end, when you eat, and how much downtime between stops — YunHai schedules every day to match.',
          'br'
        );
        await eng.click('#schedulingWizardBtn', { travel: 1000, padding: 160, after: 800 });
        await eng.wait(900);
        // Move through the controls so the viewer sees them being set.
        await eng.setValue('#schedDayStart', '09:00', { scroll: false, travel: 850, after: 500 });
        await eng.setValue('#schedDayEnd', '21:30', { scroll: false, travel: 700, after: 500 });
        const morning = eng.doc.querySelector('#schedTourTiming .sched-radio:first-child');
        await eng.cursorTo(morning, { scroll: false, travel: 800 });
        eng.cursor.classList.add('is-clicking'); await eng.wait(160);
        morning?.querySelector('input')?.click(); eng.cursor.classList.remove('is-clicking');
        await eng.wait(600);
        // Drag the downtime slider up a notch.
        await eng.cursorTo('#schedBreaks', { scroll: false, travel: 800 });
        await eng.custom(async (doc) => {
          const s = doc.getElementById('schedBreaks');
          if (s) { s.value = String(Math.min(Number(s.max || 5), Number(s.value || 3) + 1)); s.dispatchEvent(new Event('input', { bubbles: true })); }
        });
        await eng.wait(900);
        await eng.click('#schedulingWizardSave', { travel: 800, padding: 140, after: 600 });
        await eng.wait(700);
        await eng.custom(async (doc, win) => { if (win.renderArrange) win.renderArrange(); });

        // ---- Finalize: confirm the checklist, then the day snaps together with transit pills ----
        await eng.narrate(
          'Finalize',
          'Lock it in.',
          'Already-booked stops stay pinned to their times; YunHai fits everything else around them — then drops in real drive times between stops.',
          'tr'
        );
        await eng.click('#finalizeArrangeBtn', { travel: 1000, padding: 160, after: 800 });
        await eng.wait(1300); // let the viewer read the checklist (Mezquita is pre-locked)

        // Press Confirm & Arrange, then FAKE the result (no /api/arrange): close the modal
        // and reveal transit pills between the stops.
        await eng.cursorTo('#finalizeConfirmBtn', { scroll: false, travel: 850 });
        eng.cursor.classList.add('is-clicking'); await eng.wait(200);
        eng.cursor.classList.remove('is-clicking');
        await eng.custom(async (doc) => { doc.getElementById('finalizeModal')?.remove(); });
        await eng.wait(500);
        await seed(eng, { commutes: { ...DEMO_COMMUTES } });
        await eng.custom(async (doc, win) => { if (win.renderArrange) win.renderArrange(); });
        await eng.wait(700);

        await eng.narrate(
          'Done',
          'A day that actually holds up.',
          'Every stop in order, real drive times between them, buffers baked in — no backtracking, no impossible jumps.',
          'br'
        );
        // Slowly pan down the packed day so the full timeline + transit pills are seen.
        await eng.scrollToTop(0);
        await eng.wait(900);
        const sc = eng.scroller;
        if (sc) {
          const target = Math.min(sc.scrollHeight - FRAME_H, 700);
          const start = sc.scrollTop;
          const dur = 5200;
          const t0 = performance.now();
          await new Promise((resolve) => {
            const t = (now) => {
              if (eng.cancelled) return resolve();
              if (eng.paused) { return requestAnimationFrame(t); }
              const k = Math.min(1, (now - t0) / dur);
              sc.scrollTop = start + (target - start) * (1 - Math.pow(1 - k, 2));
              if (k < 1) requestAnimationFrame(t);
              else resolve();
            };
            requestAnimationFrame(t);
          });
        }
        await eng.wait(900);
      },
    },

    {
      step: 4,
      path: '/finalize',
      label: '04 / FINALIZE',
      dur: 14000,
      run: async (eng) => {
        // Self-seed the full trip so jumping straight here (dot click) still renders.
        await seed(eng, {
          cities: DEMO_CITIES, days: DEMO_DAYS,
          activities: DEMO_ACTIVITIES, reviewed: { ...DEMO_REVIEWED_ARRANGED },
          placements: { ...DEMO_PLACEMENTS }, commutes: { ...DEMO_COMMUTES }, arrangeCity: CORDOBA
        });
        eng.gotoAppStep(4);
        await eng.custom(async (doc, win) => { if (win.renderItinerary) win.renderItinerary(); });
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(500);

        await eng.narrate(
          'Step 04 · Finalize',
          'The whole trip, day by day.',
          'Every approved stop, in order, with times and costs — the plan you’ll actually travel with.',
          'tr'
        );
        await eng.wait(1400);

        const sc = eng.scroller;
        if (sc) {
          const target = Math.min(sc.scrollHeight - FRAME_H, 520);
          const start = sc.scrollTop;
          const dur = 4200;
          const t0 = performance.now();
          await new Promise((resolve) => {
            const t = (now) => {
              if (eng.cancelled) return resolve();
              if (eng.paused) { return requestAnimationFrame(t); }
              const k = Math.min(1, (now - t0) / dur);
              sc.scrollTop = start + (target - start) * k;
              if (k < 1) requestAnimationFrame(t);
              else resolve();
            };
            requestAnimationFrame(t);
          });
        }

        await eng.narrate(
          'Take it anywhere.',
          'Sync, share, or export.',
          'Push every stop to Google Calendar, share a live link with your party, or download a PDF with your tickets tucked inside.',
          'br'
        );
        const tool = eng.doc.querySelector('#step4 #syncGoogleCalendarBtn') ? '#step4 #syncGoogleCalendarBtn' : '#step4 .send-tile';
        await eng.cursorTo(tool, { travel: 1100, padding: 180 });
        await eng.wait(1600);
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
  const speedBtn = document.getElementById('reelSpeed');

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
  let beatRawDur = 0;

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
    beatRawDur = beat.dur;
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
    const beatDur = beatRawDur * pace();
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

  // Speed toggle (1× ⇄ 2×) — affects all waits, typing, and the progress bar live.
  speedBtn?.addEventListener('click', () => {
    speedMult = speedMult === 1 ? 2 : 1;
    speedBtn.textContent = speedMult + '×';
    speedBtn.classList.toggle('is-fast', speedMult === 2);
  });

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
