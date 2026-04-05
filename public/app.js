const state = {
  step: 1,
  tripName: '',
  cities: [],
  activities: [],
  reviewed: {},
  approvedIds: [],
  days: [],
  placements: {},
  itinerary: null,
  arrangeCity: null,
  chatSessionId: '',
  chatHistory: [],
  chatOpen: false,
  chatLoading: false,
  keys: { anthropicConfigured: false, unsplashConfigured: false },
  isPlanning: false,
  profile: null,
  profileEditMode: false
};

const PROFILE_KEY = 'travelplanner_profile_v1';
const USER_ID_KEY = 'travelplanner_user_id';
const PROFILE_QUESTIONS = [
  { key: 'museumPerson', label: 'Are you a museum person?', summary: 'Museum person' },
  { key: 'foodTravel', label: 'Do you travel for food?', summary: 'Travels for food' },
  { key: 'livePerformances', label: 'Do you seek out live performances (concerts, theatre, shows)?', summary: 'Live performances' },
  { key: 'outdoorNature', label: 'Do you enjoy outdoor / nature activities?', summary: 'Outdoor / nature activities' },
  { key: 'nightlifeBars', label: 'Are you into nightlife and bars?', summary: 'Nightlife and bars' },
  { key: 'structuredTours', label: 'Do you like structured tours?', summary: 'Structured tours' }
];
const PROFILE_OPTIONS = ['Yes', 'Meh', 'No'];

const els = {
  steps: [...document.querySelectorAll('#stepIndicator .step')],
  panels: [1,2,3,4].map((n) => document.getElementById(`step${n}`)),
  tripName: document.getElementById('tripName'),
  citiesContainer: document.getElementById('citiesContainer'),
  addCityBtn: document.getElementById('addCityBtn'),
  planBtn: document.getElementById('planBtn'),
  activitiesGrid: document.getElementById('activitiesGrid'),
  continueArrangeBtn: document.getElementById('continueArrangeBtn'),
  backToSetupBtn: document.getElementById('backToSetupBtn'),
  continueArrangeHint: document.getElementById('continueArrangeHint'),
  budgetTracker: document.getElementById('budgetTracker'),
  arrangeCityNav: document.getElementById('arrangeCityNav'),
  dayColumns: document.getElementById('dayColumns'),
  stagingArea: document.getElementById('stagingArea'),
  backToReviewBtn: document.getElementById('backToReviewBtn'),
  generateBtn: document.getElementById('generateBtn'),
  itineraryGrid: document.getElementById('itineraryGrid'),
  editBtn: document.getElementById('editBtn'),
  apiBanner: document.getElementById('apiBanner'),
  preferencesLink: document.getElementById('preferencesLink'),
  prefsModal: document.getElementById('prefsModal'),
  prefsClose: document.getElementById('prefsClose'),
  profileQuestions: document.getElementById('profileQuestions'),
  profileTravelNotes: document.getElementById('profileTravelNotes'),
  profileDislikes: document.getElementById('profileDislikes'),
  profileEditBtn: document.getElementById('profileEditBtn'),
  prefsSignalCount: document.getElementById('prefsSignalCount'),
  prefsLikedTypes: document.getElementById('prefsLikedTypes'),
  prefsLikedKeywords: document.getElementById('prefsLikedKeywords'),
  prefsDislikedTypes: document.getElementById('prefsDislikedTypes'),
  prefsDislikedKeywords: document.getElementById('prefsDislikedKeywords'),
  saveProgressBtn: document.getElementById('saveProgressBtn'),
  saveToast: document.getElementById('saveToast'),
  resumeModal: document.getElementById('resumeModal'),
  resumeTripBtn: document.getElementById('resumeTripBtn'),
  startFreshBtn: document.getElementById('startFreshBtn'),
  chatBubble: document.getElementById('chatBubble'),
  chatPanel: document.getElementById('chatPanel'),
  chatClose: document.getElementById('chatClose'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  chatSend: document.getElementById('chatSend')
};

const SNAPSHOT_KEY = 'travelplanner_snapshot';
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s='') => s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalizeCity = (str = '') => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function defaultProfile() {
  return {
    answers: Object.fromEntries(PROFILE_QUESTIONS.map((q) => [q.key, 'Meh'])),
    travelNotes: '',
    activityDislikes: ''
  };
}

function normalizeProfile(profile) {
  const base = defaultProfile();
  if (!profile || typeof profile !== 'object') return base;
  const incomingAnswers = profile.answers && typeof profile.answers === 'object' ? profile.answers : {};
  for (const q of PROFILE_QUESTIONS) {
    const val = incomingAnswers[q.key];
    base.answers[q.key] = PROFILE_OPTIONS.includes(val) ? val : 'Meh';
  }
  base.travelNotes = String(profile.travelNotes || '').trim();
  base.activityDislikes = String(profile.activityDislikes || '').trim();
  return base;
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile();
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return defaultProfile();
  }
}

function saveProfile(profile) {
  const normalized = normalizeProfile(profile);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
  state.profile = normalized;
  return normalized;
}

const LOADING_MESSAGES = [
  'Analyzing your destinations...',
  'Filtering out the boring stuff...',
  'Sounds like fun, wish I could join you...',
  'Checking sunset times...',
  'Finding the best neighborhoods to get lost in...',
  'Evaluating disappointment risk...',
  'Almost there...'
];

let loadingInterval = null;
let loadingMessageIndex = 0;

function updatePlanningStatus(status = '', progress = '') {
  const overlay = document.getElementById('planningOverlay');
  if (!overlay) return;
  overlay.querySelector('[data-city-status]').textContent = status;
  overlay.querySelector('[data-progress]').textContent = progress;
}

function setStep(n) {
  state.step = n;
  els.steps.forEach((el, i) => el.classList.toggle('active', i + 1 === n));
  els.panels.forEach((el, i) => el.classList.toggle('active', i + 1 === n));
}

function setPlanningLoading(isLoading) {
  const overlay = document.getElementById('planningOverlay');
  if (!overlay) return;

  state.isPlanning = isLoading;
  els.planBtn.disabled = isLoading;
  els.planBtn.textContent = isLoading ? 'Planning…' : 'Plan My Trip';

  if (!isLoading) {
    overlay.classList.add('hidden');
    if (loadingInterval) clearInterval(loadingInterval);
    loadingInterval = null;
    loadingMessageIndex = 0;
    return;
  }

  const tripName = (els.tripName.value || state.tripName || 'your trip').trim();
  overlay.querySelector('[data-trip-name]').textContent = `Planning your trip to ${tripName}`;
  overlay.querySelector('[data-loading-message]').textContent = LOADING_MESSAGES[0];
  updatePlanningStatus('Starting planning...', '');
  overlay.classList.remove('hidden');

  if (loadingInterval) clearInterval(loadingInterval);
  loadingInterval = setInterval(() => {
    loadingMessageIndex = (loadingMessageIndex + 1) % LOADING_MESSAGES.length;
    const messageEl = overlay.querySelector('[data-loading-message]');
    messageEl.classList.remove('loading-visible');
    setTimeout(() => {
      messageEl.textContent = LOADING_MESSAGES[loadingMessageIndex];
      messageEl.classList.add('loading-visible');
    }, 140);
  }, 2400);
}

function addCityRow(city = { id: uid(), name: '', startDate: '', endDate: '' }) {
  state.cities.push(city);
  renderCities();
}

function renderCities() {
  els.citiesContainer.innerHTML = '';
  state.cities.forEach((city) => {
    const row = document.createElement('div');
    row.className = 'city-row';
    row.innerHTML = `
      <input placeholder="City" value="${esc(city.name)}" data-field="name" />
      <input type="date" value="${esc(city.startDate)}" data-field="startDate" />
      <input type="date" value="${esc(city.endDate)}" data-field="endDate" />
      <button class="secondary" type="button">Remove</button>
    `;
    const inputs = row.querySelectorAll('input');
    inputs.forEach((input) => {
      input.addEventListener('input', () => {
        city[input.dataset.field] = input.value;
      });
    });
    row.querySelector('button').addEventListener('click', () => {
      state.cities = state.cities.filter((c) => c.id !== city.id);
      renderCities();
    });
    els.citiesContainer.appendChild(row);
  });
}

function typeToTime(type) {
  const map = {
    breakfast: '8:30am',
    tour: '10:00am',
    walk: '11:00am',
    neighborhood: '11:30am',
    lunch: '1:00pm',
    cultural: '2:30pm',
    show: '8:00pm',
    sports: '4:00pm',
    sunset: 'sunset',
    food: '7:30pm',
    dinner: '8:00pm'
  };
  return map[type] || 'TBD';
}

function ensureUserId() {
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, next);
  return next;
}

function postPreferenceSignal(activity, verdict) {
  fetch('/api/preferences/signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: ensureUserId(),
      name: activity.name,
      type: activity.type,
      verdict,
      city: activity.city,
      why_it_fits: activity.why_it_fits
    })
  }).catch(() => {});
}

function renderTags(container, values, kind) {
  container.innerHTML = values?.length
    ? values.map((v) => `<span class="tag ${kind === 'like' ? 'tag-like' : 'tag-dislike'}">${esc(v)}</span>`).join('')
    : '<span class="muted-text">None yet</span>';
}

function renderProfileEditor() {
  if (!els.profileQuestions) return;
  const profile = state.profile || defaultProfile();
  const disabled = !state.profileEditMode ? 'disabled' : '';

  els.profileQuestions.innerHTML = PROFILE_QUESTIONS.map((q) => {
    const active = profile.answers[q.key] || 'Meh';
    return `
      <div class="profile-question" data-question="${esc(q.key)}">
        <p>${esc(q.label)}</p>
        <div class="pill-toggle" role="group" aria-label="${esc(q.label)}">
          ${PROFILE_OPTIONS.map((option) => `
            <button type="button" class="pill-btn ${active === option ? 'active' : ''}" data-answer="${esc(option)}" ${disabled}>${esc(option)}</button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  els.profileTravelNotes.value = profile.travelNotes || '';
  els.profileDislikes.value = profile.activityDislikes || '';
  els.profileTravelNotes.disabled = !state.profileEditMode;
  els.profileDislikes.disabled = !state.profileEditMode;
  els.profileEditBtn.textContent = state.profileEditMode ? 'Save Profile' : 'Edit Profile';

  if (!state.profileEditMode) return;

  els.profileQuestions.querySelectorAll('.pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.closest('.profile-question')?.dataset.question;
      const answer = btn.dataset.answer;
      if (!key || !answer) return;
      state.profile = normalizeProfile({
        ...(state.profile || defaultProfile()),
        answers: { ...(state.profile?.answers || {}), [key]: answer }
      });
      renderProfileEditor();
    });
  });
}

function getProfilePayload() {
  return normalizeProfile({
    ...(state.profile || defaultProfile()),
    travelNotes: els.profileTravelNotes?.value || state.profile?.travelNotes || '',
    activityDislikes: els.profileDislikes?.value || state.profile?.activityDislikes || ''
  });
}

async function openPreferencesModal() {
  state.profile = loadProfile();
  state.profileEditMode = false;
  renderProfileEditor();

  try {
    const res = await fetch(`/api/preferences?userId=${encodeURIComponent(ensureUserId())}`);
    const data = await res.json();
    const prefs = data.preferences || { liked: { types: [], keywords: [] }, disliked: { types: [], keywords: [] }, signals: [] };

    els.prefsSignalCount.textContent = `Based on ${prefs.signals?.length || 0} past activities`;
    renderTags(els.prefsLikedTypes, prefs.liked?.types || [], 'like');
    renderTags(els.prefsLikedKeywords, prefs.liked?.keywords || [], 'like');
    renderTags(els.prefsDislikedTypes, prefs.disliked?.types || [], 'dislike');
    renderTags(els.prefsDislikedKeywords, prefs.disliked?.keywords || [], 'dislike');
  } catch {
    els.prefsSignalCount.textContent = 'Unable to load preferences';
  }
  els.prefsModal.classList.remove('hidden');
}

function closePreferencesModal() {
  state.profileEditMode = false;
  renderProfileEditor();
  els.prefsModal.classList.add('hidden');
}

async function fetchStatus() {
  const res = await fetch('/api/status');
  const data = await res.json();
  state.keys = data.keys || state.keys;
  const msgs = [];
  if (!state.keys.anthropicConfigured) msgs.push('Anthropic API key not configured: planning disabled.');
  if (!state.keys.unsplashConfigured) msgs.push('Unsplash API key not configured: images may be blank.');
  if (msgs.length) {
    els.apiBanner.textContent = msgs.join(' ');
    els.apiBanner.classList.remove('hidden');
  } else {
    els.apiBanner.classList.add('hidden');
  }
}

async function enrichImages(items) {
  await Promise.all(items.map(async (item) => {
    if (item.imageUrl) return;
    try {
      const res = await fetch(`/api/image?q=${encodeURIComponent(item.name)}&city=${encodeURIComponent(item.city || '')}`);
      const data = await res.json();
      item.imageUrl = data.imageUrl || '';
    } catch {
      item.imageUrl = '';
    }
  }));
}

function renderBudget() {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  const dedicated = approved.filter((a) => a.dedicated_time_block).length;
  const pct = Math.min(100, (dedicated / 5) * 100);
  const level = dedicated >= 5 ? 'bad' : dedicated >= 4 ? 'warn' : '';
  els.budgetTracker.innerHTML = `
    <div><strong>Cultural Time Budget:</strong> ${dedicated}/5 dedicated blocks</div>
    <div class="progress ${level}"><span style="width:${pct}%"></span></div>
  `;
}

function updateReviewNav() {
  const approvedCount = state.activities.filter((a) => state.reviewed[a.id]?.approved).length;
  const canContinue = approvedCount > 0;
  if (els.continueArrangeBtn) {
    els.continueArrangeBtn.disabled = !canContinue;
    els.continueArrangeBtn.title = canContinue ? '' : 'Approve at least one activity to continue';
  }
  if (els.continueArrangeHint) {
    els.continueArrangeHint.classList.toggle('hidden', canContinue);
  }
}

function renderActivities() {
  renderBudget();
  updateReviewNav();
  els.activitiesGrid.innerHTML = '';
  state.activities.forEach((a) => {
    const review = state.reviewed[a.id] || { approved: null, notes: '' };
    const approvedState = review.approved;
    const isApproved = approvedState === true;
    const isDeclined = approvedState === false;
    const approveBtnClass = `primary approve btn-approve ${isApproved ? 'active' : ''} ${isDeclined ? 'inactive' : ''}`.trim();
    const declineBtnClass = `secondary decline btn-decline ${isDeclined ? 'active' : ''} ${isApproved ? 'inactive' : ''}`.trim();
    const cardStateClass = isApproved ? 'approved' : isDeclined ? 'declined' : '';
    const verdictClass = `verdict-${(a.verdict || '').replace(/\s+/g, '-')}`;
    const card = document.createElement('article');
    card.className = `card activity-card ${cardStateClass}`.trim();
    card.innerHTML = `
      <img src="${esc(a.imageUrl || '')}" alt="${esc(a.name)}" />
      <div class="card-content">
        <div>
          <span class="badge">${esc(a.type)}</span>
          <span class="badge ${verdictClass}">${esc(a.verdict || 'N/A')}</span>
        </div>
        <h3>${esc(a.name)}</h3>
        <p><strong>City:</strong> ${esc(a.city || '')}</p>
        <p><strong>Why it fits:</strong> ${esc(a.why_it_fits || '')}</p>
        <p><strong>Pitfall:</strong> ${esc(a.pitfall || '')}</p>
        <p><strong>Booking advice:</strong> ${esc(a.booking_advice || '')}</p>
        <div class="actions">
          <button class="${approveBtnClass}">✅ Approve</button>
          <button class="${declineBtnClass}">❌ Decline</button>
        </div>
        <label class="${review.approved ? '' : 'hidden'}">
          Notes
          <textarea rows="2" class="notes">${esc(review.notes || '')}</textarea>
        </label>
      </div>
    `;

    card.querySelector('.approve').addEventListener('click', () => {
      const current = state.reviewed[a.id]?.approved;
      const nextApproved = current === true ? null : true;
      state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), approved: nextApproved };
      if (nextApproved === true) postPreferenceSignal(a, 'approved');
      renderActivities();
    });
    card.querySelector('.decline').addEventListener('click', () => {
      const current = state.reviewed[a.id]?.approved;
      const nextApproved = current === false ? null : false;
      state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), approved: nextApproved, notes: nextApproved === false ? '' : (state.reviewed[a.id]?.notes || '') };
      if (nextApproved === false) postPreferenceSignal(a, 'declined');
      renderActivities();
    });
    const notes = card.querySelector('.notes');
    if (notes) notes.addEventListener('input', () => {
      state.reviewed[a.id].notes = notes.value;
    });

    els.activitiesGrid.appendChild(card);
  });
}

function expandDays(cities) {
  const days = [];
  cities.forEach((c) => {
    const start = new Date(c.startDate);
    const end = new Date(c.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      days.push({ id: `${c.name}-${iso}`, city: c.name, date: iso });
    }
  });
  return days;
}

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const PX_PER_HOUR = 60;
const GRID_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * PX_PER_HOUR;

function formatDuration(hours = 1) {
  const h = Number(hours || 1);
  return Number.isInteger(h) ? `${h}h` : `${h}h`;
}

function verdictColor(verdict = '') {
  if (/skip/i.test(verdict)) return '#ef4444';
  if (/caveat/i.test(verdict)) return '#f59e0b';
  return '#22c55e';
}

function parseTimeTo24(raw = '') {
  if (!raw) return '09:00';
  const t = raw.trim().toLowerCase();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return '09:00';
  let h = Number(m[1]);
  const min = Number(m[2] || '0');
  const ap = m[3];
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  h = Math.max(0, Math.min(23, h));
  const mm = String(Math.max(0, Math.min(59, min))).padStart(2, '0');
  return `${String(h).padStart(2, '0')}:${mm}`;
}

function minutesFromTime(time = '09:00') {
  const [h, m] = String(time).split(':').map((n) => Number(n || 0));
  return (h * 60) + m;
}

function timeFromY(yPx = 0) {
  const clamped = Math.max(0, Math.min(GRID_HEIGHT, yPx));
  const minsFromStart = Math.round(clamped / 30) * 30;
  const totalMins = (DAY_START_HOUR * 60) + minsFromStart;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function yFromTime(time = '09:00') {
  const mins = minutesFromTime(time);
  const start = DAY_START_HOUR * 60;
  const end = DAY_END_HOUR * 60;
  const clamped = Math.max(start, Math.min(end, mins));
  return ((clamped - start) / 60) * PX_PER_HOUR;
}

function getArrangeCities() {
  const byCity = new Map();
  state.days.forEach((d) => {
    if (!byCity.has(d.city)) byCity.set(d.city, []);
    byCity.get(d.city).push(d);
  });
  return [...byCity.entries()].map(([city, days]) => ({ city, days }));
}

function renderArrangeCityNav(cityGroups) {
  if (!els.arrangeCityNav) return;
  if (!cityGroups.length) {
    els.arrangeCityNav.innerHTML = '';
    return;
  }
  if (!state.arrangeCity || !cityGroups.some((g) => normalizeCity(g.city) === normalizeCity(state.arrangeCity))) {
    state.arrangeCity = cityGroups[0].city;
  }

  const activeIndex = cityGroups.findIndex((g) => normalizeCity(g.city) === normalizeCity(state.arrangeCity));
  els.arrangeCityNav.innerHTML = `
    <button type="button" class="secondary arrange-city-arrow" data-city-prev ${activeIndex <= 0 ? 'disabled' : ''}>←</button>
    <div class="arrange-city-tabs">
      ${cityGroups.map((g) => {
        const start = new Date(g.days[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const end = new Date(g.days[g.days.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `<button type="button" class="arrange-city-tab ${normalizeCity(g.city) === normalizeCity(state.arrangeCity) ? 'active' : ''}" data-city-tab="${esc(g.city)}">${esc(g.city)} (${start}–${end})</button>`;
      }).join('')}
    </div>
    <button type="button" class="secondary arrange-city-arrow" data-city-next ${activeIndex >= cityGroups.length - 1 ? 'disabled' : ''}>→</button>
  `;

  els.arrangeCityNav.querySelectorAll('[data-city-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.arrangeCity = btn.dataset.cityTab;
      renderArrange();
    });
  });
  els.arrangeCityNav.querySelector('[data-city-prev]')?.addEventListener('click', () => {
    if (activeIndex <= 0) return;
    state.arrangeCity = cityGroups[activeIndex - 1].city;
    renderArrange();
  });
  els.arrangeCityNav.querySelector('[data-city-next]')?.addEventListener('click', () => {
    if (activeIndex >= cityGroups.length - 1) return;
    state.arrangeCity = cityGroups[activeIndex + 1].city;
    renderArrange();
  });
}

function makeStagingCard(item) {
  const color = verdictColor(item.verdict);
  return `
    <div class="item staging-card" data-id="${item.id}" style="border-left-color:${color}">
      <span class="verdict-dot" style="background:${color}"></span>
      <h4>${esc(item.name)}</h4>
      <span class="badge">${esc(item.type)}</span>
      <span class="badge">${esc(formatDuration(item.duration_hours || 1))}</span>
    </div>
  `;
}

function makePlacedCard(item) {
  const placement = state.placements[item.id] || {};
  const time = parseTimeTo24(placement.time || item.suggested_time || typeToTime(item.type));
  const h = Math.max(60, Number(item.duration_hours || 1) * PX_PER_HOUR);
  const y = yFromTime(time);
  return `
    <article class="placed-card" data-id="${item.id}" style="height:${h}px;top:${y}px;">
      ${item.imageUrl ? `<div class="placed-image-wrap"><img src="${esc(item.imageUrl)}" alt="${esc(item.name)}" class="placed-image" /></div>` : ''}
      <div class="placed-body">
        <h4>${esc(item.name)}</h4>
        <div class="placed-meta">
          <label>Time <input data-time type="time" value="${esc(time)}" /></label>
          <span class="badge">${esc(formatDuration(item.duration_hours || 1))}</span>
          <span class="badge">${esc(item.type)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderArrange() {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  const cityGroups = getArrangeCities();
  renderArrangeCityNav(cityGroups);

  const activeCity = state.arrangeCity;
  const activeDays = state.days.filter((d) => normalizeCity(d.city) === normalizeCity(activeCity));

  els.stagingArea.innerHTML = approved
    .filter((a) => (normalizeCity(a.city) === normalizeCity(activeCity)) && !state.placements[a.id]?.dayId)
    .map(makeStagingCard)
    .join('');

  els.dayColumns.innerHTML = activeDays.map((d) => {
    const dt = new Date(d.date);
    const label = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const hourLines = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => {
      const hour = DAY_START_HOUR + i;
      const y = i * PX_PER_HOUR;
      const labelHour = new Date(2020, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' }).toLowerCase();
      return `<div class="hour-line" style="top:${y}px"><span>${labelHour}</span></div>`;
    }).join('');
    return `
      <section class="day-col schedule-col" data-day="${d.id}">
        <div class="day-head"><div>${label}</div><small>${esc(d.city)}</small></div>
        <div class="day-grid-wrap">
          <div class="hour-grid">${hourLines}</div>
          <div class="day-schedule" id="schedule-${d.id}"></div>
        </div>
      </section>
    `;
  }).join('');

  activeDays.forEach((d) => {
    const schedule = document.getElementById(`schedule-${d.id}`);
    if (!schedule) return;
    const items = approved
      .filter((a) => state.placements[a.id]?.dayId === d.id)
      .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)));
    schedule.innerHTML = items.map(makePlacedCard).join('');
  });

  new Sortable(els.stagingArea, { group: 'itinerary', sort: false, animation: 120 });
  document.querySelectorAll('.day-schedule').forEach((zone) => {
    new Sortable(zone, {
      group: 'itinerary',
      sort: false,
      animation: 120,
      onAdd: (evt) => {
        const id = evt.item?.dataset.id;
        if (!id) return;
        const dayId = zone.id.replace('schedule-', '');
        const y = (evt.originalEvent?.clientY || 0) - zone.getBoundingClientRect().top;
        state.placements[id] = {
          ...(state.placements[id] || {}),
          dayId,
          time: timeFromY(y)
        };
        renderArrange();
      }
    });
  });

  bindPlacedCardInteractions();
}

function bindPlacedCardInteractions() {
  document.querySelectorAll('.placed-card [data-time]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const id = inp.closest('.placed-card')?.dataset.id;
      if (!id) return;
      state.placements[id] = state.placements[id] || {};
      state.placements[id].time = inp.value;
      renderArrange();
    });
  });

  document.querySelectorAll('.placed-card').forEach((card) => {
    card.addEventListener('mousedown', (e) => {
      if (e.target.matches('input, label')) return;
      const id = card.dataset.id;
      const schedule = card.closest('.day-schedule');
      const dayId = schedule?.id.replace('schedule-', '');
      if (!id || !schedule || !dayId) return;
      const rect = schedule.getBoundingClientRect();

      const move = (ev) => {
        const y = ev.clientY - rect.top;
        state.placements[id] = { ...(state.placements[id] || {}), dayId, time: timeFromY(y) };
        const nextY = yFromTime(state.placements[id].time);
        card.style.top = `${nextY}px`;
        const input = card.querySelector('[data-time]');
        if (input) input.value = state.placements[id].time;
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        renderArrange();
      };

      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  });
}

function renderItinerary() {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  els.itineraryGrid.innerHTML = state.days.map((d) => {
    const items = approved
      .filter((a) => state.placements[a.id]?.dayId === d.id)
      .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)))
      .map((a) => `
        <div class="item">
          <h4>${esc(a.name)}</h4>
          <p><strong>Time:</strong> ${esc(state.placements[a.id]?.time || parseTimeTo24(a.suggested_time || typeToTime(a.type)))}</p>
          <p><strong>Duration:</strong> ${esc(formatDuration(a.duration_hours || 1))}</p>
          <p><strong>Type:</strong> ${esc(a.type)}</p>
          <p><strong>Why:</strong> ${esc(a.why_it_fits || '')}</p>
        </div>
      `)
      .join('');
    return `<section class="day-col"><div class="day-head">${d.date} • ${esc(d.city)}</div><div class="list">${items || '<em>No activities assigned.</em>'}</div></section>`;
  }).join('');
}

async function planTrip() {
  state.tripName = els.tripName.value.trim();
  const cities = state.cities.map(({name,startDate,endDate}) => ({ name, startDate, endDate }));
  const payload = { cities, profile: state.profile || loadProfile(), userId: ensureUserId() };

  state.activities = [];
  state.reviewed = {};
  renderActivities();

  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok || !res.body) {
    let msg = 'Failed to plan';
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completedCities = 0;

  updatePlanningStatus(`Planning ${cities[0]?.name || 'trip'}...`, `City 0 of ${cities.length} done`);

  const handleEvent = async (payloadText) => {
    const evt = JSON.parse(payloadText);

    if (evt.type === 'error') throw new Error(evt.error || 'Failed to plan');

    if (evt.type === 'city') {
      const cityActivities = (evt.activities || []).map((a, i) => ({
        id: a.id || `${evt.city}-${i}-${uid()}`,
        ...a,
        city: a.city || evt.city
      }));

      state.activities.push(...cityActivities);
      renderActivities();
      enrichImages(cityActivities).then(() => renderActivities());

      completedCities += 1;
      const nextCity = cities[completedCities]?.name;
      const progress = `City ${completedCities} of ${cities.length} done`;
      if (nextCity) {
        updatePlanningStatus(
          `Got ${cityActivities.length} activities for ${evt.city}! Moving to ${nextCity}...`,
          progress
        );
        setTimeout(() => updatePlanningStatus(`Planning ${nextCity}...`, progress), 700);
      } else {
        updatePlanningStatus(`Got ${cityActivities.length} activities for ${evt.city}!`, progress);
      }
      setStep(2);
    }

    if (evt.type === 'done') {
      updatePlanningStatus('Finalizing...', `City ${completedCities} of ${cities.length} done`);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const raw of events) {
      const lines = raw.split('\n').filter((line) => line.startsWith('data: '));
      if (!lines.length) continue;
      const payloadText = lines.map((line) => line.slice(6)).join('\n');
      await handleEvent(payloadText);
    }
  }

  setStep(2);
}

async function generateItinerary() {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  const arranged = approved.map((a) => ({
    ...a,
    notes: state.reviewed[a.id]?.notes || '',
    dayId: state.placements[a.id]?.dayId || null,
    order: minutesFromTime(parseTimeTo24(state.placements[a.id]?.time || a.suggested_time || typeToTime(a.type))),
    time: state.placements[a.id]?.time || parseTimeTo24(a.suggested_time || typeToTime(a.type))
  }));

  const byDay = state.days.map((d) => ({
    ...d,
    activities: arranged.filter((a) => a.dayId === d.id).sort((x,y) => x.order - y.order)
  }));

  const payload = { tripName: state.tripName, days: byDay };
  const res = await fetch('/api/itinerary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  state.itinerary = data.itinerary;
  renderItinerary();
  setStep(4);
}

function getTripContext() {
  return {
    step: state.step,
    cities: state.cities,
    approvedActivities: state.activities.filter((a) => state.reviewed[a.id]?.approved).map((a) => a.name),
    declinedActivities: state.activities.filter((a) => state.reviewed[a.id]?.approved === false).map((a) => a.name)
  };
}

function ensureChatSessionId() {
  const existing = localStorage.getItem('chat_session_id');
  state.chatSessionId = existing || crypto.randomUUID();
  if (!existing) localStorage.setItem('chat_session_id', state.chatSessionId);
  return state.chatSessionId;
}

function renderChatMessages() {
  if (!els.chatMessages) return;
  els.chatMessages.innerHTML = state.chatHistory.map((msg) => `
    <div class="${msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-assistant'}">${esc(msg.content || '')}</div>
  `).join('');
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function setChatOpen(isOpen) {
  state.chatOpen = isOpen;
  els.chatPanel.classList.toggle('hidden', !isOpen);
}

async function restoreChatHistory() {
  try {
    const sessionId = ensureChatSessionId();
    const res = await fetch(`/api/chat/session/${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    state.chatHistory = Array.isArray(data.history)
      ? data.history.filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      : [];
    renderChatMessages();
  } catch {
    state.chatHistory = [];
    renderChatMessages();
  }
}

async function sendChatMessage() {
  const message = (els.chatInput.value || '').trim();
  if (!message || state.chatLoading) return;

  state.chatHistory.push({ role: 'user', content: message });
  els.chatInput.value = '';
  renderChatMessages();

  state.chatLoading = true;
  state.chatHistory.push({ role: 'assistant', content: 'Thinking...' });
  renderChatMessages();

  try {
    const res = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: ensureChatSessionId(),
        message,
        tripContext: getTripContext()
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Chat failed');

    state.chatHistory[state.chatHistory.length - 1] = {
      role: 'assistant',
      content: data.reply || 'Sorry, chat is unavailable right now.'
    };
  } catch (err) {
    state.chatHistory[state.chatHistory.length - 1] = {
      role: 'assistant',
      content: err.message || 'Sorry, chat is unavailable right now.'
    };
  } finally {
    state.chatLoading = false;
    renderChatMessages();
  }
}

async function resetChatSession() {
  const existing = localStorage.getItem('chat_session_id');
  if (existing) {
    try { await fetch(`/api/chat/session/${encodeURIComponent(existing)}`, { method: 'DELETE' }); } catch {}
  }

  const nextSessionId = crypto.randomUUID();
  localStorage.setItem('chat_session_id', nextSessionId);
  state.chatSessionId = nextSessionId;
  state.chatHistory = [];
  state.chatLoading = false;
  renderChatMessages();
}

function bindChatEvents() {
  els.chatBubble.addEventListener('click', () => setChatOpen(!state.chatOpen));
  els.chatClose.addEventListener('click', () => setChatOpen(false));
  els.chatSend.addEventListener('click', sendChatMessage);
  els.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChatMessage();
    }
  });
}

function mountPlanningOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'planningOverlay';
  overlay.className = 'planning-overlay hidden';
  overlay.innerHTML = `
    <div class="planning-overlay-card">
      <div class="planning-trip" data-trip-name></div>
      <div class="planning-status" data-city-status></div>
      <div class="planning-progress" data-progress></div>
      <div class="planning-message loading-visible" data-loading-message></div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function showSavedToast() {
  if (!els.saveToast) return;
  els.saveToast.classList.add('show');
  setTimeout(() => els.saveToast.classList.remove('show'), 2000);
}

function getSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSnapshot() {
  localStorage.removeItem(SNAPSHOT_KEY);
}

function saveSnapshot() {
  const payload = {
    cities: state.cities,
    activities: state.activities,
    placements: state.placements,
    reviewed: state.reviewed,
    tripName: state.tripName,
    days: state.days,
    arrangeCity: state.arrangeCity,
    currentStep: 3
  };
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  showSavedToast();
}

function resetToFresh() {
  state.step = 1;
  state.tripName = '';
  state.cities = [];
  state.activities = [];
  state.reviewed = {};
  state.days = [];
  state.placements = {};
  state.itinerary = null;
  state.arrangeCity = null;
  state.chatHistory = [];
  state.chatLoading = false;

  els.tripName.value = '';
  renderCities();
  addCityRow();
  renderActivities();
  els.dayColumns.innerHTML = '';
  els.stagingArea.innerHTML = '';
  els.itineraryGrid.innerHTML = '';
  renderChatMessages();
  setStep(1);
}

function hydrateFromSnapshot(snapshot) {
  state.tripName = snapshot.tripName || '';
  state.cities = snapshot.cities || [];
  state.activities = snapshot.activities || [];
  state.placements = snapshot.placements || {};
  state.reviewed = snapshot.reviewed || {};
  state.days = snapshot.days || expandDays(state.cities);
  state.arrangeCity = snapshot.arrangeCity || state.days[0]?.city || null;

  els.tripName.value = state.tripName;
  renderCities();
  renderActivities();
  renderArrange();
  setStep(3);
}

function maybePromptSnapshot() {
  const snapshot = getSnapshot();
  if (!snapshot) {
    resetToFresh();
    return;
  }

  els.resumeModal.classList.remove('hidden');
  els.resumeTripBtn.onclick = () => {
    els.resumeModal.classList.add('hidden');
    hydrateFromSnapshot(snapshot);
  };
  els.startFreshBtn.onclick = () => {
    clearSnapshot();
    els.resumeModal.classList.add('hidden');
    resetChatSession();
    resetToFresh();
  };
}

function clearPlannedResultsKeepSetup() {
  state.activities = [];
  state.reviewed = {};
  state.days = [];
  state.placements = {};
  state.itinerary = null;
  state.arrangeCity = null;
  renderActivities();
  els.dayColumns.innerHTML = '';
  els.stagingArea.innerHTML = '';
  els.itineraryGrid.innerHTML = '';
}

els.addCityBtn.addEventListener('click', () => { addCityRow(); });
els.planBtn.addEventListener('click', async () => {
  if (state.isPlanning) return;
  clearSnapshot();
  clearPlannedResultsKeepSetup();
  setPlanningLoading(true);
  try { await planTrip(); }
  catch (e) { alert(e.message); }
  finally { setPlanningLoading(false); }
});
els.backToSetupBtn.addEventListener('click', () => {
  clearPlannedResultsKeepSetup();
  setStep(1);
});
els.continueArrangeBtn.addEventListener('click', () => {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  if (!approved.length) return;
  state.days = expandDays(state.cities);
  state.arrangeCity = state.days[0]?.city || null;
  approved.forEach((a) => {
    state.placements[a.id] = state.placements[a.id] || { dayId: null, time: parseTimeTo24(a.suggested_time || typeToTime(a.type)) };
  });
  renderArrange();
  setStep(3);
});
els.saveProgressBtn.addEventListener('click', saveSnapshot);
els.backToReviewBtn.addEventListener('click', () => setStep(2));
els.generateBtn.addEventListener('click', generateItinerary);
els.editBtn.addEventListener('click', () => { renderArrange(); setStep(3); });
els.preferencesLink.addEventListener('click', openPreferencesModal);
els.prefsClose.addEventListener('click', closePreferencesModal);
els.prefsModal.addEventListener('click', (e) => {
  if (e.target === els.prefsModal) closePreferencesModal();
});
els.profileEditBtn.addEventListener('click', () => {
  if (!state.profileEditMode) {
    state.profileEditMode = true;
    renderProfileEditor();
    return;
  }

  const next = getProfilePayload();
  saveProfile(next);
  state.profileEditMode = false;
  renderProfileEditor();
});

els.activitiesGrid.addEventListener('change', () => {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  state.days = expandDays(state.cities);
  state.arrangeCity = state.arrangeCity || state.days[0]?.city || null;
  approved.forEach((a) => {
    state.placements[a.id] = state.placements[a.id] || { dayId: null, time: parseTimeTo24(a.suggested_time || typeToTime(a.type)) };
  });
  renderArrange();
});

(async function init() {
  state.profile = loadProfile();
  mountPlanningOverlay();
  bindChatEvents();
  ensureUserId();
  ensureChatSessionId();
  await restoreChatHistory();
  await fetchStatus();
  maybePromptSnapshot();
})();
