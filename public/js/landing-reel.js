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

  // ----- Mock trip data: lets steps 2-4 render the real UI without the live AI. -----
  // Shapes mirror the app: activities → buildActivityCard fields; days → expandDays
  // (`${city}-${YYYY-MM-DD}`); placements → { dayId, time }. Seeded activities are never
  // enriched (renderActivities doesn't call enrichActivity), so imageUrl '' is safe.
  const CORDOBA = 'Córdoba, Spain';
  const SEVILLE = 'Seville, Spain';

  const DEMO_CITIES = [
    {
      id: 'demo-cordoba', name: CORDOBA, startDate: '2026-04-24', endDate: '2026-04-26',
      leaveTime: '18:00', notes: '', detailsExpanded: false,
      latitude: 37.8882, longitude: -4.7794,
      logistics: { arrival: { date: '2026-04-24', time: '14:00', mode: 'train', location: 'Córdoba Station' },
        departure: { date: '2026-04-26', time: '18:00', mode: 'train', location: 'Córdoba Station' } }
    },
    {
      id: 'demo-seville', name: SEVILLE, startDate: '2026-04-26', endDate: '2026-04-30',
      leaveTime: '06:30', notes: 'Flamenco at La Carbonería on Apr 28.', detailsExpanded: false,
      latitude: 37.3891, longitude: -5.9845,
      logistics: { arrival: { date: '2026-04-26', time: '11:05', mode: 'train', location: 'Sevilla-Santa Justa' },
        departure: { date: '2026-04-30', time: '06:30', mode: 'bus', location: 'Plaza de Armas' } }
    }
  ];

  const DEMO_DAYS = [
    { id: `${CORDOBA}-2026-04-24`, city: CORDOBA, date: '2026-04-24' },
    { id: `${CORDOBA}-2026-04-25`, city: CORDOBA, date: '2026-04-25' },
    { id: `${CORDOBA}-2026-04-26`, city: CORDOBA, date: '2026-04-26' },
    { id: `${SEVILLE}-2026-04-26`, city: SEVILLE, date: '2026-04-26' },
    { id: `${SEVILLE}-2026-04-27`, city: SEVILLE, date: '2026-04-27' },
    { id: `${SEVILLE}-2026-04-28`, city: SEVILLE, date: '2026-04-28' },
    { id: `${SEVILLE}-2026-04-29`, city: SEVILLE, date: '2026-04-29' },
    { id: `${SEVILLE}-2026-04-30`, city: SEVILLE, date: '2026-04-30' }
  ];

  const act = (o) => ({
    type: 'landmark', cost_type: 'per_person', duration_hours: 2, imageUrl: '',
    booking_type: 'none', booking_links: [], userAdded: false, ...o
  });

  const DEMO_ACTIVITIES = [
    act({ id: 'demo-mezquita', name: 'Mezquita-Catedral de Córdoba', city: CORDOBA, type: 'landmark',
      why_it_fits: 'A UNESCO masterpiece — a forest of red-and-white arches you can wander for hours. Exactly the kind of slow, architectural awe you flagged.',
      pitfall: 'Late-morning tour groups swarm the prayer hall — go right at opening.',
      booking_advice: 'Buy timed-entry tickets online; the on-site queue eats an hour.',
      insider_tips: 'Free entry weekday mornings 08:30–09:30 if you skip the guided route.',
      estimated_cost_usd: 13, duration_hours: 2, opening_hours: '08:30–19:00' }),
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
      estimated_cost_usd: 0, duration_hours: 1, opening_hours: 'Open 24h' })
  ];

  // Review opens with a couple already approved (not a blank slate).
  const DEMO_REVIEWED = {
    'demo-mezquita': { approved: true, notes: '' },
    'demo-realalcazar': { approved: true, notes: '' }
  };

  // Arrange/Finalize present an already-built trip: everything placed is approved so the
  // day columns and itinerary render full. (Review uses DEMO_REVIEWED instead.)
  const DEMO_REVIEWED_ARRANGED = {
    'demo-mezquita': { approved: true, notes: 'Book the 08:30 slot — quietest light for photos.' },
    'demo-alcazar-cor': { approved: true, notes: '' },
    'demo-patios': { approved: true, notes: '' },
    'demo-realalcazar': { approved: true, notes: '' },
    'demo-flamenco': { approved: true, notes: '' },
    'demo-plaza-espana': { approved: true, notes: '' }
  };

  // Pre-arranged calendar so step-3 day columns and step-4 finalize have content.
  const DEMO_PLACEMENTS = {
    'demo-mezquita': { dayId: `${CORDOBA}-2026-04-25`, time: '09:30' },
    'demo-alcazar-cor': { dayId: `${CORDOBA}-2026-04-25`, time: '12:00' },
    'demo-patios': { dayId: `${CORDOBA}-2026-04-25`, time: '18:30' },
    'demo-realalcazar': { dayId: `${SEVILLE}-2026-04-27`, time: '09:30' },
    'demo-flamenco': { dayId: `${SEVILLE}-2026-04-28`, time: '21:00' },
    'demo-plaza-espana': { dayId: `${SEVILLE}-2026-04-27`, time: '19:00' }
  };

  // Used for the faked Replace swap. Seeded with place_id/price_level/imageUrl so the
  // app's enrichActivity() (called by replaceActivityInState) makes no network calls.
  const REPLACEMENT = act({
    id: 'demo-patios-replacement', name: 'Hammam Al Ándalus (Arab baths)', city: CORDOBA, type: 'wellness',
    why_it_fits: 'A candlelit thermal bath circuit in a restored Moorish house — a calm, offbeat evening that fits your slow-travel pace better than another courtyard walk.',
    pitfall: 'Sessions are timed; latecomers lose part of the slot.',
    booking_advice: 'Reserve a 90-minute slot online; bring a swimsuit.',
    insider_tips: 'The 21:00 session is quietest — almost private midweek.',
    estimated_cost_usd: 42, duration_hours: 1.5, opening_hours: '10:00–24:00',
    place_id: 'demo-place-hammam', price_level: 2, imageUrl: ''
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
      dur: 30000,
      run: async (eng) => {
        // Seed real activity cards, then drive the genuine review UI.
        await seed(eng, { activities: DEMO_ACTIVITIES, reviewed: { ...DEMO_REVIEWED } });
        eng.gotoAppStep(2);
        await eng.custom(async (doc, win) => { if (win.renderActivities) win.renderActivities(); });
        (eng.scroller || {}).scrollTop = 0;
        await eng.wait(500);

        const card = (id) => eng.doc.querySelector(`.activity-card[data-activity-id="${id}"]`);
        const inCard = (id, sel) => { const c = card(id); return c ? c.querySelector(sel) : null; };

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
        await eng.cursorTo(inCard('demo-alcazar-cor', '.approve'), { travel: 1000, padding: 160 });
        eng.cursor.classList.add('is-clicking');
        await eng.wait(160);
        inCard('demo-alcazar-cor', '.approve')?.click();
        eng.cursor.classList.remove('is-clicking');
        await eng.wait(1000);

        // Decline
        await eng.narrate(
          'Decline',
          'Drop what doesn’t fit.',
          'Decline dismisses a suggestion. If it was scheduled, it leaves your days too — so the plan always reflects what you actually want.',
          'tl'
        );
        await eng.cursorTo(inCard('demo-plaza-espana', '.decline'), { travel: 1000, padding: 160 });
        eng.cursor.classList.add('is-clicking');
        await eng.wait(160);
        inCard('demo-plaza-espana', '.decline')?.click();
        eng.cursor.classList.remove('is-clicking');
        await eng.wait(1000);

        // Notes
        await eng.narrate(
          'Notes',
          'Pin a reminder to any stop.',
          'Reservation refs, who’s coming, a must-try dish — saved right on the card and folded into the plan.',
          'tr'
        );
        await eng.type(`#actNotes-demo-mezquita`, 'Book the 08:30 slot — quietest light for photos.', { padding: 200 });
        await eng.wait(200);
        await eng.cursorTo(inCard('demo-mezquita', '.save-activity-notes'), { travel: 700, padding: 160 });
        eng.cursor.classList.add('is-clicking');
        await eng.wait(160);
        inCard('demo-mezquita', '.save-activity-notes')?.click();
        eng.cursor.classList.remove('is-clicking');
        await eng.wait(1100);

        // Replace / modify (faked swap — no API)
        await eng.narrate(
          'Don’t love it? Swap it.',
          'Ask for something that fits better.',
          'Say why in a line, and YunHai replaces it with a smarter match tuned to your taste — here, a calm evening over another courtyard walk.',
          'bl'
        );
        await eng.type(`#actDecline-demo-patios`, 'Want something calmer for the evening, not another walk.', { padding: 220, speedMin: 26, speedMax: 52 });
        await eng.wait(250);
        const replaceBtn = inCard('demo-patios', '.confirm-replace');
        await eng.cursorTo(replaceBtn, { travel: 700, padding: 160 });
        eng.cursor.classList.add('is-clicking');
        await eng.wait(160);
        eng.cursor.classList.remove('is-clicking');
        if (replaceBtn) replaceBtn.innerHTML = '<i class="ph-bold ph-spinner"></i>';
        await eng.wait(1300);
        await eng.custom(async (doc, win) => {
          if (win.replaceActivityInState) win.replaceActivityInState('demo-patios', { ...REPLACEMENT });
        });
        await eng.wait(1400);

        // Create a new activity
        await eng.narrate(
          'Missing something?',
          'Add your own activity.',
          'Got a reservation or a place you already know? Drop it in and it slots into the same flow as everything else.',
          'br'
        );
        const addCard = eng.doc.querySelector('#activitiesGrid .add-activity-card');
        await eng.cursorTo(addCard, { travel: 1100, padding: 200 });
        eng.cursor.classList.add('is-clicking');
        await eng.wait(160);
        addCard?.click();
        eng.cursor.classList.remove('is-clicking');
        await eng.wait(1800);
        await eng.custom(async (doc) => {
          doc.getElementById('addActivityModalClose')?.click();
        });
        await eng.wait(400);
      },
    },

    {
      step: 3,
      path: '/arrange',
      label: '03 / ARRANGE',
      dur: 16000,
      run: async (eng) => {
        // Seed a pre-arranged calendar so the day columns are full (self-sufficient on dot-jump).
        await seed(eng, {
          cities: DEMO_CITIES, days: DEMO_DAYS,
          activities: DEMO_ACTIVITIES, reviewed: { ...DEMO_REVIEWED_ARRANGED },
          placements: { ...DEMO_PLACEMENTS }, arrangeCity: CORDOBA
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

        // Scheduling preferences modal (pure frontend)
        await eng.narrate(
          'Scheduling preferences',
          'Set the rhythm once.',
          'Day start and end, when you eat, how much breathing room between stops — YunHai schedules every day to match.',
          'br'
        );
        await eng.click('#schedulingWizardBtn', { travel: 1000, padding: 160, after: 700 });
        await eng.wait(1700);
        // Nudge the breaks slider to show it's live, then close.
        await eng.custom(async (doc) => {
          const slider = doc.getElementById('schedBreaks');
          if (slider) { slider.value = '4'; slider.dispatchEvent(new Event('input', { bubbles: true })); }
        });
        await eng.wait(1400);
        await eng.click('#schedulingWizardCancel', { travel: 800, padding: 140, after: 500 });
        await eng.wait(600);
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
          placements: { ...DEMO_PLACEMENTS }, arrangeCity: CORDOBA
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
