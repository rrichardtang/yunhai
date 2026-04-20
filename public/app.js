const state = {
  step: 1,
  maxStep: 1,
  tripName: '',
  tripBudget: null,
  numTravelers: 1,
  numChildren: 0,
  cities: [],
  travels: [],
  activities: [],
  reviewed: {},
  approvedIds: [],
  days: [],
  placements: {},
  itinerary: null,
  currentItineraryId: null,
  savedItineraries: [],
  attachmentsByItem: {},
  commutes: {},
  arrangeCity: null,
  chatSessionId: '',
  chatHistory: [],
  chatOpen: false,
  chatLoading: false,
  keys: { anthropicConfigured: false, unsplashConfigured: false, googleMapsConfigured: false },
  isPlanning: false,
  profilesStore: null,
  profile: null,
  learnedPrefs: null,
  reviewFilters: {
    search: '',
    city: '',
    verdict: ''
  },
  reviewCardFlips: {},
  viewMode: 'planning',
  arrangeConfig: null,
  arrangeDiagnostics: {},
  lastPlannedFingerprint: null,
  authReady: false,
  authUserId: '',
  authUserEmail: '',
  forwardingAddress: '',
  calendarMetadataMode: 'compact',
  googleCalendarConnected: false,
  mapOverlaySelectedActivityId: null,
  confidence: null,
  confidenceChecklist: [],
  confidenceNotificationPrefs: { emailSummary: false, reminderBeforeDeparture: false },
  confidenceIssueSignatures: [],
  confidenceIssueMeta: {}
};

let budgetOptState = null;

const PROFILES_KEY = 'travelplanner_profiles_v1';
const LEGACY_PROFILE_KEY = 'travelplanner_profile_v1';
const USER_ID_KEY = 'travelplanner_user_id';
const PROFILE_QUESTIONS = [
  { key: 'museumPerson', label: 'Are you a museum person?', summary: 'Museum person' },
  { key: 'foodTravel', label: 'Do you travel for food?', summary: 'Travels for food' },
  { key: 'livePerformances', label: 'Do you enjoy live performances?', summary: 'Live performances' },
  { key: 'outdoorNature', label: 'Do you enjoy outdoor / nature activities?', summary: 'Outdoor / nature activities' },
  { key: 'nightlifeBars', label: 'Are you into nightlife and bars?', summary: 'Nightlife and bars' },
  { key: 'structuredTours', label: 'Do you like guided tours?', summary: 'Structured tours' },
  { key: 'pace', label: 'How packed do you like your days?', summary: 'Trip pace' },
  { key: 'dayStructure', label: 'How do you like your days structured?', summary: 'Day structure', type: 'text', placeholder: 'e.g. I like to start early and wrap up by 9pm' },
  { key: 'dietaryRestrictions', label: 'Do you have any dietary restrictions or food preferences?', summary: 'Dietary restrictions', type: 'text', placeholder: 'e.g. I\'m vegetarian and avoid shellfish' },
  { key: 'mobilityConsiderations', label: 'Any mobility or physical considerations we should know about?', summary: 'Mobility', type: 'text', placeholder: 'e.g. I avoid lots of walking or stairs' },
  { key: 'budgetStyle', label: 'How would you describe your spending style while traveling?', summary: 'Budget style', type: 'text', placeholder: 'e.g. I prefer mid-range, splurge on food but save on activities' },
  { key: 'travelCompanions', label: 'Who are you typically traveling with?', summary: 'Travel companions', type: 'text', placeholder: 'e.g. My partner and two kids aged 8 and 11' }
];
const PROFILE_MIN = 1;
const PROFILE_MAX = 5;
const PROFILE_DEFAULT = 3;

function profileLabel(value) {
  const rating = Number(value);
  if (rating <= 1) return 'Not interested at all';
  if (rating === 2) return 'Slightly interested';
  if (rating === 3) return 'Neutral';
  if (rating === 4) return 'Very interested';
  return 'Love this';
}

function pacePrefLabel(value) {
  const rating = Number(value);
  if (rating <= 1) return 'Very relaxed';
  if (rating === 2) return 'Easy-going';
  if (rating === 3) return 'Moderate';
  if (rating === 4) return 'Active';
  return 'Non-stop';
}

const els = {
  steps: [...document.querySelectorAll('#stepIndicator .step')],
  panels: [1,2,3,4].map((n) => document.getElementById(`step${n}`)),
  tripName: document.getElementById('tripName'),
  tripBudget: document.getElementById('tripBudget'),
  numTravelers: document.getElementById('numTravelers'),
  numChildren: document.getElementById('numChildren'),
  citiesContainer: document.getElementById('citiesContainer'),
  locationValidationError: document.getElementById('locationValidationError'),
  addCityBtn: document.getElementById('addCityBtn'),
  sortCitiesBtn: document.getElementById('sortCitiesBtn'),
  setupInsights: document.getElementById('setupInsights'),
  planBtn: document.getElementById('planBtn'),
  activitiesGrid: document.getElementById('activitiesGrid'),
  reviewSearch: document.getElementById('reviewSearch'),
  reviewCityFilter: document.getElementById('reviewCityFilter'),
  reviewVerdictFilter: document.getElementById('reviewVerdictFilter'),
  approveVisibleBtn: document.getElementById('approveVisibleBtn'),
  continueArrangeBtn: document.getElementById('continueArrangeBtn'),
  backToSetupBtn: document.getElementById('backToSetupBtn'),
  continueArrangeHint: document.getElementById('continueArrangeHint'),
  arrangeCityNav: document.getElementById('arrangeCityNav'),
  arrangeDiagnostics: document.getElementById('arrangeDiagnostics'),
  dayColumns: document.getElementById('dayColumns'),
  stagingArea: document.getElementById('stagingArea'),
  backToReviewBtn: document.getElementById('backToReviewBtn'),
  generateBtn: document.getElementById('generateBtn'),
  itineraryInsights: document.getElementById('itineraryInsights'),
  itineraryGrid: document.getElementById('itineraryGrid'),
  downloadCalendarBtn: document.getElementById('downloadCalendarBtn'),
  calendarMetadataMode: document.getElementById('calendarMetadataMode'),
  connectGoogleCalendarBtn: document.getElementById('connectGoogleCalendarBtn'),
  syncGoogleCalendarBtn: document.getElementById('syncGoogleCalendarBtn'),
  calendarSyncStatus: document.getElementById('calendarSyncStatus'),
  savedItineraries: document.getElementById('savedItineraries'),
  editBtn: document.getElementById('editBtn'),
  apiBanner: document.getElementById('apiBanner'),
  signInBtn: document.getElementById('signInBtn'),
  signOutBtn: document.getElementById('signOutBtn'),
  profileMenu: document.getElementById('profileMenu'),
  profileMenuBtn: document.getElementById('profileMenuBtn'),
  profileMenuDropdown: document.getElementById('profileMenuDropdown'),
  profileMenuEmail: document.getElementById('profileMenuEmail'),
  profileMenuMyProfile: document.getElementById('profileMenuMyProfile'),
  forwardingPanel: document.getElementById('forwardingPanel'),
  forwardingAddress: document.getElementById('forwardingAddress'),
  planningModeBtn: document.getElementById('planningModeBtn'),
  itineraryModeBtn: document.getElementById('itineraryModeBtn'),
  itineraryModeView: document.getElementById('itineraryModeView'),
  itineraryModeList: document.getElementById('itineraryModeList'),
  itineraryModeSummary: document.getElementById('itineraryModeSummary'),
  attachmentViewerModal: document.getElementById('attachmentViewerModal'),
  attachmentViewerTitle: document.getElementById('attachmentViewerTitle'),
  attachmentViewerList: document.getElementById('attachmentViewerList'),
  attachmentViewerClose: document.getElementById('attachmentViewerClose'),
  attachmentFileInput: document.getElementById('attachmentFileInput'),
  shareMinimalBtn: document.getElementById('shareMinimalBtn'),
  copyMinimalBtn: document.getElementById('copyMinimalBtn'),
  saveOfflineMinimalBtn: document.getElementById('saveOfflineMinimalBtn'),
  printMinimalBtn: document.getElementById('printMinimalBtn'),
  prefsModal: document.getElementById('prefsModal'),
  prefsClose: document.getElementById('prefsClose'),
  deleteProfileBtn: document.getElementById('deleteProfileBtn'),
  profileQuestions: document.getElementById('profileQuestions'),
  profileTravelNotes: document.getElementById('profileTravelNotes'),
  profileAiSummary: document.getElementById('profileAiSummary'),
  aiSummarySection: document.getElementById('aiSummarySection'),
  learnedPrefsSection: document.getElementById('learnedPrefsSection'),
  learnedPrefsTags: document.getElementById('learnedPrefsTags'),
  profileEditBtn: document.getElementById('profileEditBtn'),

  autoArrangeBtn: document.getElementById('autoArrangeBtn'),
  myTripsPanel: document.getElementById('myTripsPanel'),
  myTripsList: document.getElementById('myTripsList'),
  chatBubble: document.getElementById('chatBubble'),
  chatPanel: document.getElementById('chatPanel'),
  chatClose: document.getElementById('chatClose'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  chatSend: document.getElementById('chatSend'),
  confidenceBadge: document.getElementById('confidenceBadge'),
  confidencePopover: document.getElementById('confidencePopover'),
  confidencePopoverStatus: document.getElementById('confidencePopoverStatus'),
  confidencePopoverIssues: document.getElementById('confidencePopoverIssues'),
  confidencePopoverTopIssue: document.getElementById('confidencePopoverTopIssue'),
  confidencePopoverProgress: document.getElementById('confidencePopoverProgress'),
  openConfidenceReviewBtn: document.getElementById('openConfidenceReviewBtn'),
  confidenceSummary: document.getElementById('confidenceSummary'),
  confidenceIssues: document.getElementById('confidenceIssues'),

  confidenceChecklist: document.getElementById('confidenceChecklist')
};

const SNAPSHOT_KEY = 'travelplanner_snapshot';
const VIEW_MODE_KEY = 'travelplanner_view_mode_v1';
const MINIMAL_OFFLINE_KEY = 'travelplanner_minimal_offline_v1';
const GEO_CACHE_KEY = 'travelplanner_geo_cache_v2';
const PLACES_CACHE_KEY = 'travelplanner_places_cache_v1';
const PLACES_CACHE_MAX = 500;
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s='') => s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalizeCity = (str = '') => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function actDurationHours(a, fallback = 1) {
  if (a == null) return fallback;
  if (a.timing != null) return (a.timing.duration_minutes ?? 60) / 60;
  return Number(a.duration_hours) || fallback;
}
function actPreferredTime(a) {
  if (a == null) return null;
  if (a.timing != null) return a.timing.preferred_time ?? null;
  const s = String(a.suggested_time || '').trim();
  return (s && s !== '10:00am') ? s : null;
}
function actAddress(a) {
  if (a == null) return '';
  if (a.location != null) return a.location.address ?? '';
  return String(a.start_location || '').trim();
}
function actCostUsd(a) {
  if (a == null) return null;
  return a.cost != null ? a.cost.estimated_usd : a.estimated_cost_usd;
}
function actCostType(a) {
  if (a == null) return 'per_person';
  return a.cost != null ? a.cost.type : (a.cost_type || 'per_person');
}
function actBookingType(a) {
  if (a == null) return 'none';
  return a.booking != null ? a.booking.type : (a.booking_type || 'none');
}
function actBookingLinks(a) {
  if (a == null) return [];
  return a.booking != null ? (a.booking.links || []) : (a.booking_links || []);
}
function actOpeningHours(a) {
  if (a == null) return '';
  return a.timing != null ? (a.timing.opening_hours || '') : (a.opening_hours || '');
}

const geocodeCache = loadGeocodeCache();
let geocodeQueue = Promise.resolve();
let activityMapOverlay = null;
let activityMapOverlayMap = null;
let activityMapOverlayMarkers = [];
const miniMapInstances = new Map();

function loadGeocodeCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistGeocodeCache() {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geocodeCache));
  } catch {}
}

function geocodeKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getActivityLocationCandidates(activity = {}) {
  const name = String(activity.name || '').trim();
  const city = String(activity.city || '').trim();
  const candidates = [
    actAddress(activity),
    activity.location?.name,
    [name, city].filter(Boolean).join(', '),
    city
  ].map((x) => String(x || '').trim()).filter(Boolean);
  return [...new Set(candidates)];
}

function geocodeQueryQueued(query) {
  const key = geocodeKey(query);
  if (geocodeCache[key]) return Promise.resolve(geocodeCache[key]);

  geocodeQueue = geocodeQueue
    .catch(() => null)
    .then(async () => {
      const url = `/api/geocode?q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
      const rows = await res.json();
      const hit = Array.isArray(rows) ? rows[0] : null;
      if (!hit?.lat || !hit?.lon) return null;
      const coords = { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name || query };
      if (Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
        geocodeCache[key] = coords;
        persistGeocodeCache();
      }
      return coords;
    });

  return geocodeQueue.catch(() => null);
}

const MEAL_PREFIX_RE = /^(Lunch|Dinner|Breakfast|Brunch|Drinks|Coffee|Visit)\s+at\s+/i;

function stripMealPrefix(name = '') {
  return String(name || '').replace(MEAL_PREFIX_RE, '').replace(/^Visit\s+/i, '').trim();
}

function priceLevelBadge(level) {
  if (typeof level !== 'number' || level < 0 || level > 4) return '';
  if (level === 0) return 'Free';
  return '$'.repeat(level);
}

const PRICE_LEVEL_USD = { 0: 0, 1: 15, 2: 40, 3: 90, 4: 200 };

function representativeCostUsd(activity = {}) {
  const type = String(activity?.type || '').toLowerCase();
  const bookingType = actBookingType(activity);
  const mealTypes = ['food', 'breakfast', 'lunch', 'dinner'];
  if (mealTypes.includes(type) || bookingType === 'restaurant') {
    const lvl = activity?.price_level;
    if (typeof lvl === 'number' && PRICE_LEVEL_USD[lvl] != null) return PRICE_LEVEL_USD[lvl];
    return null;
  }
  if (bookingType === 'tour' || type === 'tour') return 75;
  if (bookingType === 'attraction' || type === 'cultural' || type === 'sports') return 25;
  if (type === 'show') return 80;
  return null;
}

function getGetYourGuideLink(activity = {}) {
  const links = actBookingLinks(activity);
  return links.find((l) => /getyourguide/i.test(l?.site || '')) || links.find((l) => /viator/i.test(l?.site || '')) || null;
}

function googleMapsLinkHtml(activity = {}) {
  const venue = activity.venue_name || activity.name;
  if (!venue) return '';
  const q = encodeURIComponent(venue);
  const url = activity.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(activity.place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
  return `<a href="${url}" target="_blank" rel="noopener" class="badge badge-maps" title="Open in Google Maps" aria-label="Google Maps"><i class="ph-bold ph-map-pin" aria-hidden="true"></i></a>`;
}

function headerPriceBadgeHtml(activity = {}) {
  const bookingType = actBookingType(activity);
  if (bookingType === 'tour' || bookingType === 'attraction') {
    const link = getGetYourGuideLink(activity);
    if (link?.url) return `<a href="${esc(link.url)}" target="_blank" rel="noopener" class="badge badge-price booking-link">${esc(link.site || 'GetYourGuide')}</a>`;
    return '';
  }
  const lvl = activity?.price_level;
  if (typeof lvl === 'number' && lvl >= 0 && lvl <= 4) {
    const label = lvl === 0 ? 'Free' : '$'.repeat(lvl);
    return `<span class="badge badge-price">${label}</span>`;
  }
  return '';
}

function renderActivityCostCell(activity = {}, { userBudget = null } = {}) {
  if (userBudget != null && Number.isFinite(Number(userBudget))) {
    return `$${Math.round(Number(userBudget)).toLocaleString()}`;
  }
  const bookingType = actBookingType(activity);
  if (bookingType === 'tour' || bookingType === 'attraction') {
    const link = getGetYourGuideLink(activity);
    if (link?.url) return `<a href="${esc(link.url)}" target="_blank" rel="noopener" class="booking-link">Price on ${esc(link.site || 'GetYourGuide')} →</a>`;
  }
  const badge = priceLevelBadge(activity?.price_level);
  if (badge) return `<span class="price-level-badge">${esc(badge)}</span>`;
  return '';
}

function loadPlacesCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLACES_CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const placesCache = loadPlacesCache();

function persistPlacesCache() {
  try {
    const keys = Object.keys(placesCache);
    if (keys.length > PLACES_CACHE_MAX) {
      const overflow = keys.length - PLACES_CACHE_MAX;
      for (let i = 0; i < overflow; i += 1) delete placesCache[keys[i]];
    }
    localStorage.setItem(PLACES_CACHE_KEY, JSON.stringify(placesCache));
  } catch {}
}

function placesKey(q, city) {
  return `${String(q || '').trim().toLowerCase()}|${String(city || '').trim().toLowerCase()}`;
}

async function resolvePlace(activity = {}, cityName = '') {
  const city = String(cityName || activity.city || '').trim();
  const venue = String(activity.venue_name || '').trim();
  const stripped = stripMealPrefix(activity.name || '');
  const query = venue || (stripped ? `${stripped}${city ? `, ${city}` : ''}` : '');
  if (!query) return null;

  const key = placesKey(query, city);
  if (placesCache[key]) {
    const hit = placesCache[key];
    return hit && hit.lat != null ? hit : null;
  }

  try {
    const url = `/api/places/resolve?q=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    if (!data || data.lat == null || data.lng == null) {
      placesCache[key] = { placeId: null };
      persistPlacesCache();
      return null;
    }
    const value = {
      lat: Number(data.lat),
      lng: Number(data.lng),
      placeId: data.placeId || null,
      priceLevel: typeof data.priceLevel === 'number' ? data.priceLevel : null,
      rating: typeof data.rating === 'number' ? data.rating : null,
      label: data.formattedAddress || data.name || query
    };
    placesCache[key] = value;
    persistPlacesCache();
    return value;
  } catch {
    return null;
  }
}

async function geocodeActivity(activity = {}) {
  const name = String(activity.name || '').trim();
  const city = String(activity.city || '').trim();

  const place = await resolvePlace(activity, city);
  if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    activity.place_id = place.placeId || activity.place_id || null;
    activity.place_lat = place.lat;
    activity.place_lng = place.lng;
    if (activity.location != null) {
      activity.location.lat = place.lat;
      activity.location.lng = place.lng;
    }
    if (place.priceLevel != null) activity.price_level = place.priceLevel;
    if (place.rating != null) activity.google_rating = place.rating;
    return { lat: place.lat, lng: place.lng, label: place.label };
  }

  const venue = String(activity.venue_name || '').trim();
  const strippedName = stripMealPrefix(name);
  const candidates = [
    venue,
    strippedName && city ? `${strippedName}, ${city}` : '',
    actAddress(activity) && city ? `${actAddress(activity)}, ${city}` : actAddress(activity),
    name && city ? `${name}, ${city}` : '',
    city
  ].map((x) => String(x || '').trim()).filter(Boolean);
  const seen = new Set();
  const ordered = candidates.filter((c) => { const k = c.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

  for (const candidate of ordered) {
    const cached = geocodeCache[geocodeKey(candidate)];
    if (cached?.lat != null && cached?.lng != null) return cached;
  }
  for (const candidate of ordered) {
    const result = await geocodeQueryQueued(candidate);
    if (result?.lat != null && result?.lng != null) return result;
  }
  return null;
}

function cityVariants(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const variants = new Set();
  const add = (text) => {
    const normalized = normalizeCity(text);
    if (normalized) variants.add(normalized);
  };

  add(raw);

  const firstComma = raw.split(',')[0]?.trim();
  if (firstComma) add(firstComma);

  const firstDash = raw.split(' - ')[0]?.trim();
  if (firstDash) add(firstDash);

  return [...variants];
}

function cityMatches(left = '', right = '') {
  const leftVariants = cityVariants(left);
  const rightVariants = cityVariants(right);
  if (!leftVariants.length || !rightVariants.length) return false;

  return leftVariants.some((lv) => rightVariants.some((rv) => (
    lv === rv
    || lv.startsWith(`${rv} `)
    || rv.startsWith(`${lv} `)
    || lv.includes(` ${rv}`)
    || rv.includes(` ${lv}`)
  )));
}

function canonicalizeActivityCity(activityCity = '', fallbackCity = '') {
  const preferred = [String(activityCity || '').trim(), String(fallbackCity || '').trim()].filter(Boolean);
  const plannedCityNames = state.cities.map((c) => String(c?.name || '').trim()).filter(Boolean);

  for (const candidate of preferred) {
    const match = plannedCityNames.find((cityName) => cityMatches(candidate, cityName));
    if (match) return match;
  }

  return preferred[0] || '';
}

function parseYmdAsLocal(value = '') {
  const text = String(value || '').slice(0, 10);
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatYmdLocal(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}


function normalizeCityLogistics(city = {}) {
  const arrivalDate = String(city.arrivalDate || city.startDate || '');
  const departureDate = String(city.departureDate || city.endDate || '');
  const existing = city.logistics || {};
  const arrival = existing.arrival || city.arrival || {};
  const departure = existing.departure || city.departure || {};
  const accommodation = existing.accommodation || city.accommodation || {};
  const accommodationType = ['hotel', 'airbnb', 'none'].includes(String(accommodation.type || '')) ? String(accommodation.type) : 'hotel';

  return {
    accommodation: {
      type: accommodationType,
      checkIn: String(accommodation.checkIn || arrivalDate || ''),
      checkOut: String(accommodation.checkOut || departureDate || '')
    },
    arrival: {
      date: String(arrival.date || arrivalDate || ''),
      time: parseTimeTo24(arrival.time || arrival.customTime || ''),
      location: String(arrival.location || ''),
      placeId: String(arrival.placeId || ''),
      latitude: normalizeCoordinate(arrival.latitude),
      longitude: normalizeCoordinate(arrival.longitude)
    },
    departure: {
      date: String(departure.date || departureDate || ''),
      time: parseTimeTo24(departure.time || departure.customTime || city.leaveTime || ''),
      location: String(departure.location || ''),
      placeId: String(departure.placeId || ''),
      latitude: normalizeCoordinate(departure.latitude),
      longitude: normalizeCoordinate(departure.longitude)
    }
  };
}

function resolveDateTime(date = '', time = '') {
  const normalizedDate = String(date || '').slice(0, 10);
  if (!normalizedDate) return null;
  const normalizedTime = parseTimeTo24(time || '');
  if (!normalizedTime) return null;
  return `${normalizedDate}T${normalizedTime}:00`;
}

function validateCityTimeline(city = {}) {
  const logistics = city.logistics || normalizeCityLogistics(city);
  const arrivalDateTime = resolveDateTime(logistics.arrival.date, logistics.arrival.time);
  const departureDateTime = resolveDateTime(logistics.departure.date, logistics.departure.time);

  if (!arrivalDateTime || !departureDateTime) return '';
  if (new Date(departureDateTime).getTime() < new Date(arrivalDateTime).getTime()) {
    return 'Departure must be at or after arrival.';
  }
  return '';
}

function syncCityLegacyDates(city) {
  if (!city) return;
  const logistics = city.logistics || normalizeCityLogistics(city);
  city.startDate = logistics.arrival.date || '';
  city.endDate = logistics.departure.date || '';

  const arrivalTime = logistics.arrival.time || '';
  const departureTime = logistics.departure.time || '';

  city.leaveTime = parseTimeTo24(departureTime || city.leaveTime || '18:00');
  city.travelTiming = {
    ...(city.travelTiming || {}),
    arrivalAvailableTime: parseTimeTo24(arrivalTime || '09:00'),
    departureMustLeaveTime: parseTimeTo24(departureTime || city.leaveTime || '18:00')
  };
}

const CITY_AUTOCOMPLETE_MIN_CHARS = 2;
const CITY_AUTOCOMPLETE_DEBOUNCE_MS = 300;
const CITY_AUTOCOMPLETE_LIMIT = 5;

const cityAutocomplete = {
  activeCityId: null,
  suggestions: [],
  highlightIndex: -1,
  debounceTimer: null,
  requestSeq: 0,
  abortController: null
};

let googleMapsSdkPromise = null;
const placesAutocompleteByElement = new WeakMap();

function isGooglePlacesReady() {
  return Boolean(window.google?.maps?.places?.PlaceAutocompleteElement);
}

function isGoogleMapsReady() {
  return Boolean(window.google?.maps?.Map);
}

function cityLocationBias(city) {
  if (!Number.isFinite(city?.latitude) || !Number.isFinite(city?.longitude)) return undefined;
  return { center: { lat: city.latitude, lng: city.longitude }, radius: 50000 };
}

function clearLocationValidationError() {
  if (!els.locationValidationError) return;
  els.locationValidationError.textContent = '';
  els.locationValidationError.classList.add('hidden');
}

function showLocationValidationError(message) {
  if (!els.locationValidationError) return;
  els.locationValidationError.textContent = message;
  els.locationValidationError.classList.remove('hidden');
}

function normalizeCoordinate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeAccommodation(accommodation = {}) {
  // Support migrating from legacy accommodations[] array — take first element if passed an array
  const src = Array.isArray(accommodation) ? (accommodation[0] || {}) : accommodation;
  return {
    address: String(src.address || ''),
    checkIn: String(src.checkIn || ''),
    checkOut: String(src.checkOut || ''),
    placeId: String(src.placeId || ''),
    latitude: normalizeCoordinate(src.latitude),
    longitude: normalizeCoordinate(src.longitude)
  };
}

function normalizeTravelEntry(travel = {}) {
  return {
    ...travel,
    entryPointPlaceId: String(travel.entryPointPlaceId || ''),
    entryPointLat: normalizeCoordinate(travel.entryPointLat),
    entryPointLng: normalizeCoordinate(travel.entryPointLng)
  };
}

function markTravelEntryUnvalidated(city) {
  if (!city?.travelEntry) return;
  city.travelEntry.entryPointPlaceId = '';
  city.travelEntry.entryPointLat = null;
  city.travelEntry.entryPointLng = null;
  syncLegacyTravelsFromCities();
}

function buildGoogleMapsSdkUrl(apiKey = '') {
  const defaultBase = 'https://maps.googleapis.com/maps/api/js?libraries=places,marker&v=beta&loading=async';
  let base = String(window.TRAVELPLANNER_GOOGLE_MAPS_SDK_BASE_URL || defaultBase);
  if (!base.includes('libraries=')) base += `${base.includes('?') ? '&' : '?'}libraries=places,marker`;
  else if (!base.includes('marker')) base = base.replace('libraries=', 'libraries=marker,');
  if (!base.includes('v=')) base += '&v=beta';
  if (!base.includes('loading=')) base += '&loading=async';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}key=${encodeURIComponent(apiKey)}`;
}

async function loadGoogleMapsPlacesSDK(apiKey = '') {
  if (isGooglePlacesReady()) return true;
  if (!apiKey) return false;
  if (googleMapsSdkPromise) return googleMapsSdkPromise;

  googleMapsSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = buildGoogleMapsSdkUrl(apiKey);
    script.async = true;
    script.defer = true;
    script.onload = async () => {
      try {
        if (window.google?.maps?.importLibrary) {
          const [placesLib, markerLib] = await Promise.all([
            window.google.maps.importLibrary('places'),
            window.google.maps.importLibrary('marker')
          ]);
          if (!window.google.maps.places) window.google.maps.places = {};
          if (placesLib) Object.assign(window.google.maps.places, placesLib);
          if (!window.google.maps.marker) window.google.maps.marker = {};
          if (markerLib) Object.assign(window.google.maps.marker, markerLib);
        }
        resolve(isGooglePlacesReady());
      } catch (err) {
        console.warn('Google Places init:', err?.message || err);
        resolve(false);
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps SDK.'));
    document.head.appendChild(script);
  }).catch((err) => {
    googleMapsSdkPromise = null;
    throw err;
  });

  return googleMapsSdkPromise;
}

function getAccommodationAutocompleteInput(row) {
  return row?.querySelector('[data-accommodation-field="address"]') || null;
}

function attachPlaceAutocompleteElement(element, { onResolved, onInvalid, onInput, locationBias }) {
  if (!element || !isGooglePlacesReady()) return;
  if (placesAutocompleteByElement.has(element)) return;

  const PlaceAutocompleteElementCtor = window.google?.maps?.places?.PlaceAutocompleteElement;
  if (!PlaceAutocompleteElementCtor) return;

  const opts = { types: ['geocode'] };
  if (locationBias) opts.locationBias = locationBias;
  const placeAutocomplete = new PlaceAutocompleteElementCtor(opts);
  placeAutocomplete.classList.add('tp-place-autocomplete');
  if ('value' in placeAutocomplete) placeAutocomplete.value = element.value || '';
  element.classList.add('place-autocomplete-fallback');
  element.insertAdjacentElement('afterend', placeAutocomplete);

  // Style the shadow DOM input to match our compact UI
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    placeAutocomplete.style.height = '32px';
    placeAutocomplete.style.maxHeight = '32px';
    placeAutocomplete.style.overflow = 'hidden';
  }
  const styleShadowInput = () => {
    const sr = placeAutocomplete.shadowRoot;
    if (!sr) return;
    // Inject a style tag to override all internal styles
    if (!sr.querySelector('.tp-override')) {
      const s = document.createElement('style');
      s.className = 'tp-override';
      s.textContent = `
        @media (max-width: 767px) {
          :host { height: 32px !important; max-height: 32px !important; }
          * { font-size: 0.8rem !important; box-sizing: border-box !important; }
          input { padding: 4px 8px !important; height: 32px !important; min-height: 0 !important; }
          div, span { padding: 0 !important; margin: 0 !important; min-height: 0 !important; }
        }
      `;
      sr.prepend(s);
    }
    const inner = sr.querySelector('input');
    if (!inner || !isMobile) return;
    inner.style.cssText = 'font-size:0.8rem;padding:4px 8px;height:32px;min-height:0;box-sizing:border-box';
  };
  styleShadowInput();
  requestAnimationFrame(styleShadowInput);
  setTimeout(styleShadowInput, 200);
  setTimeout(styleShadowInput, 500);

  const getWidgetValue = () => {
    if (typeof placeAutocomplete.value === 'string') return placeAutocomplete.value;
    const internalInput = placeAutocomplete.shadowRoot?.querySelector('input');
    return internalInput?.value || '';
  };

  const syncInputFromWidget = (dispatchType = 'input') => {
    const value = getWidgetValue();
    element.value = value;
    element.dispatchEvent(new Event(dispatchType, { bubbles: true }));
    if (typeof onInput === 'function') onInput();
  };

  const handleSelection = async (event) => {
    try {
      const place = event?.placePrediction?.toPlace?.() || event?.place || null;
      if (!place || typeof place.fetchFields !== 'function') {
        if (typeof onInvalid === 'function') onInvalid();
        return;
      }

      await place.fetchFields({
        fields: ['formattedAddress', 'location', 'id']
      });

      const formattedAddress = String(place?.formattedAddress || '').trim();
      const placeId = String(place?.id || '').trim();
      const lat = place?.location?.lat?.();
      const lng = place?.location?.lng?.();

      if (!formattedAddress || !placeId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        if (typeof onInvalid === 'function') onInvalid();
        return;
      }

      if ('value' in placeAutocomplete) placeAutocomplete.value = formattedAddress;
      syncInputFromWidget('change');
      if (typeof onResolved === 'function') onResolved({ formattedAddress, placeId, lat, lng });
    } catch {
      if (typeof onInvalid === 'function') onInvalid();
    }
  };

  const handleInput = () => syncInputFromWidget('input');
  const handleChange = () => syncInputFromWidget('change');
  placeAutocomplete.addEventListener('input', handleInput);
  placeAutocomplete.addEventListener('change', handleChange);
  placeAutocomplete.addEventListener('gmp-select', handleSelection);
  placeAutocomplete.addEventListener('gmp-placeselect', handleSelection);

  placesAutocompleteByElement.set(element, {
    placeAutocomplete,
    handleSelection,
    handleInput,
    handleChange
  });
}

function initializePlacesWidgets() {
  if (!isGooglePlacesReady()) return;

  state.cities.forEach((city, index) => {
    if (index !== 0) return;
    const input = document.querySelector(`[data-city-id="${CSS.escape(city.id)}"] [data-travel-entry-point]`);
    if (!input) return;

    attachPlaceAutocompleteElement(input, {
      locationBias: cityLocationBias(city),
      onResolved: ({ formattedAddress, placeId, lat, lng }) => {
        const travelEntry = ensureFirstCityTravelEntry();
        if (!travelEntry) return;
        travelEntry.entryPoint = formattedAddress;
        travelEntry.entryPointPlaceId = placeId;
        travelEntry.entryPointLat = lat;
        travelEntry.entryPointLng = lng;
        input.value = formattedAddress;
        clearLocationValidationError();
        syncLegacyTravelsFromCities();
      },
      onInput: () => {
        ensureFirstCityTravelEntry();
        markTravelEntryUnvalidated(city);
      },
      onInvalid: () => {
        ensureFirstCityTravelEntry();
        markTravelEntryUnvalidated(city);
        showLocationValidationError('Could not validate the travel entry point. Please choose a suggestion from Google Places.');
      }
    });
  });

}

function formatCitySuggestion(feature) {
  const props = feature?.properties || {};
  const name = String(props.name || '').trim();
  const stateName = String(props.state || '').trim();
  const country = String(props.country || '').trim();
  if (!name) return null;
  const detail = [stateName, country].filter(Boolean).join(', ');
  return {
    name,
    label: detail ? `${name}, ${detail}` : name
  };
}

function closeCityAutocomplete() {
  cityAutocomplete.activeCityId = null;
  cityAutocomplete.suggestions = [];
  cityAutocomplete.highlightIndex = -1;

  if (cityAutocomplete.debounceTimer) {
    clearTimeout(cityAutocomplete.debounceTimer);
    cityAutocomplete.debounceTimer = null;
  }
  if (cityAutocomplete.abortController) {
    cityAutocomplete.abortController.abort();
    cityAutocomplete.abortController = null;
  }

  document.querySelectorAll('.city-suggestions').forEach((list) => {
    list.classList.add('hidden');
    list.innerHTML = '';
  });
}

function renderCitySuggestions(row, city, suggestions) {
  const list = row.querySelector('.city-suggestions');
  if (!list) return;

  cityAutocomplete.activeCityId = city.id;
  cityAutocomplete.suggestions = suggestions;

  if (!suggestions.length) {
    cityAutocomplete.highlightIndex = -1;
    list.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  if (cityAutocomplete.highlightIndex >= suggestions.length) {
    cityAutocomplete.highlightIndex = 0;
  }

  list.innerHTML = suggestions.map((item, index) => `
    <button
      type="button"
      class="city-suggestion-item ${index === cityAutocomplete.highlightIndex ? 'active' : ''}"
      data-index="${index}"
    >${esc(item.label)}</button>
  `).join('');

  list.classList.remove('hidden');

  // Use event delegation on the list — avoids handlers being wiped by innerHTML re-renders.
  list.onmousedown = (e) => {
    const btn = e.target.closest('.city-suggestion-item');
    if (!btn) return;
    // Prevent blur on input before value is set.
    e.preventDefault();
    const index = Number(btn.dataset.index);
    const selected = cityAutocomplete.suggestions[index];
    if (!selected) return;
    city.name = selected.name;
    const input = row.querySelector('input[data-field="name"]');
    if (input) {
      input.value = selected.name;
      input.focus();
    }
    closeCityAutocomplete();
  };

  list.querySelectorAll('.city-suggestion-item').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      cityAutocomplete.highlightIndex = Number(btn.dataset.index);
      // Update active class without rebuilding — avoids wiping the onmousedown handler.
      list.querySelectorAll('.city-suggestion-item').forEach((b, i) => {
        b.classList.toggle('active', i === cityAutocomplete.highlightIndex);
      });
    });
  });
}

async function fetchCitySuggestions(query, row, city) {
  const requestId = ++cityAutocomplete.requestSeq;

  if (cityAutocomplete.abortController) {
    cityAutocomplete.abortController.abort();
  }
  cityAutocomplete.abortController = new AbortController();

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${CITY_AUTOCOMPLETE_LIMIT}&layer=city&layer=state`;
    const res = await fetch(url, { signal: cityAutocomplete.abortController.signal });
    if (!res.ok) throw new Error('Failed city lookup');
    const data = await res.json();

    if (requestId !== cityAutocomplete.requestSeq || cityAutocomplete.activeCityId !== city.id) return;

    const suggestions = (data?.features || [])
      .map(formatCitySuggestion)
      .filter(Boolean)
      .slice(0, CITY_AUTOCOMPLETE_LIMIT);

    cityAutocomplete.highlightIndex = suggestions.length ? 0 : -1;
    renderCitySuggestions(row, city, suggestions);
  } catch (err) {
    if (err?.name === 'AbortError') return;
    renderCitySuggestions(row, city, []);
  }
}

let cityAutocompleteOutsideBound = false;

function bindCityAutocompleteOutsideClick() {
  if (cityAutocompleteOutsideBound) return;
  cityAutocompleteOutsideBound = true;

  document.addEventListener('click', (e) => {
    if (e.target.closest('.city-autocomplete')) return;
    closeCityAutocomplete();
  });
}

function defaultProfile() {
  return {
    answers: Object.fromEntries(PROFILE_QUESTIONS.map((q) => [q.key, q.type === 'text' ? '' : PROFILE_DEFAULT])),
    aboutMe: ''
  };
}

function createProfileId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProfileName(name, fallback = 'My Profile') {
  const cleaned = String(name || '').trim().slice(0, 32);
  return cleaned || fallback;
}

function defaultProfilesStore() {
  return { activeId: null, profiles: [] };
}

function normalizeProfilesStore(store) {
  if (!store || typeof store !== 'object') return defaultProfilesStore();

  const incomingProfiles = Array.isArray(store.profiles) ? store.profiles : [];
  const normalizedProfiles = incomingProfiles
    .slice(0, 3)
    .map((p, index) => {
      const normalized = normalizeProfile(p);
      return {
        id: String(p?.id || createProfileId()),
        name: normalizeProfileName(p?.name, `Profile ${index + 1}`),
        ...normalized
      };
    });

  if (!normalizedProfiles.length) {
    return { activeId: null, profiles: [] };
  }

  const activeId = String(store.activeId || '');
  const hasActive = normalizedProfiles.some((p) => p.id === activeId);
  return {
    activeId: hasActive ? activeId : normalizedProfiles[0].id,
    profiles: normalizedProfiles
  };
}

function saveProfiles(store) {
  const normalized = normalizeProfilesStore(store);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(normalized));
  state.profilesStore = normalized;
  syncToServer('profiles', normalized);
  return normalized;
}

function syncToServer(field, value) {
  if (!state.authReady) return;
  apiFetch(`/api/userdata/${field}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  }).catch(() => {});
}

async function syncFromServer() {
  if (!state.authReady) return;
  try {
    const res = await apiFetch('/api/userdata');
    if (!res.ok) return;
    const { data } = await res.json();
    if (!data) return;

    if (data.profiles) {
      const serverProfiles = normalizeProfilesStore(data.profiles);
      const localRaw = localStorage.getItem(PROFILES_KEY);
      const localProfiles = localRaw ? normalizeProfilesStore(JSON.parse(localRaw)) : null;
      const serverTs = data.updatedAt || '';
      const localTs = localProfiles?._syncedAt || '';
      if (!localProfiles || serverTs > localTs) {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(serverProfiles));
        state.profilesStore = serverProfiles;
      }
    }

    if (data.snapshot) {
      const localSnap = localStorage.getItem(SNAPSHOT_KEY);
      if (!localSnap) {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data.snapshot));
      }
    }

    if (data.viewMode) {
      localStorage.setItem(VIEW_MODE_KEY, data.viewMode);
    }

    if (data.chatSessions) {
      const localMap = localStorage.getItem('chat_sessions');
      if (!localMap || localMap === '{}') {
        localStorage.setItem('chat_sessions', JSON.stringify(data.chatSessions));
      }
    }

  } catch {}
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return saveProfiles(parsed);
    }

    const legacyRaw = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (legacyRaw) {
      const legacyProfile = normalizeProfile(JSON.parse(legacyRaw));
      const migrated = {
        activeId: createProfileId(),
        profiles: [{
          id: '',
          name: 'My Profile',
          ...legacyProfile
        }]
      };
      migrated.profiles[0].id = migrated.activeId;
      localStorage.removeItem(LEGACY_PROFILE_KEY);
      return saveProfiles(migrated);
    }
  } catch {}

  return saveProfiles(defaultProfilesStore());
}

function getActiveProfile(store) {
  const normalized = normalizeProfilesStore(store);
  return normalized.profiles.find((p) => p.id === normalized.activeId) || normalized.profiles[0];
}

function normalizeProfile(profile) {
  const base = defaultProfile();
  if (!profile || typeof profile !== 'object') return base;
  const incomingAnswers = profile.answers && typeof profile.answers === 'object' ? profile.answers : {};
  const legacyMap = { No: 1, Meh: 3, Yes: 5 };
  for (const q of PROFILE_QUESTIONS) {
    const raw = incomingAnswers[q.key];
    if (q.type === 'text') {
      base.answers[q.key] = typeof raw === 'string' ? raw : '';
    } else {
      const legacy = typeof raw === 'string' ? legacyMap[raw] : undefined;
      const numeric = Number(raw);
      const resolved = Number.isFinite(numeric) ? numeric : legacy;
      const clamped = Math.max(PROFILE_MIN, Math.min(PROFILE_MAX, Math.round(Number(resolved || PROFILE_DEFAULT))));
      base.answers[q.key] = clamped;
    }
  }
  const hasAboutMe = profile.aboutMe !== undefined && profile.aboutMe !== null;
  const aboutSource = hasAboutMe ? profile.aboutMe : (profile.travelNotes || '');
  base.aboutMe = String(aboutSource ?? '').trim();
  return base;
}

function loadProfile() {
  return normalizeProfile(getActiveProfile(loadProfiles()));
}

function saveProfile(profile) {
  const normalized = normalizeProfile(profile);
  const store = state.profilesStore || loadProfiles();
  const nextStore = {
    ...store,
    profiles: store.profiles.map((p) => (
      p.id === store.activeId
        ? { ...p, ...normalized }
        : p
    ))
  };
  state.profilesStore = saveProfiles(nextStore);
  state.profile = normalizeProfile(getActiveProfile(state.profilesStore));
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
let activeSavingToastId = null;
let profileSnapshot = null;

function refreshOverlayInterlocks() {
  const hasBlockingOverlay = [
    document.getElementById('planningOverlay'),
    document.getElementById('prefsModal'),
    document.getElementById('checklistModal'),
    document.getElementById('textareaExpandModal'),
    document.querySelector('.activity-map-overlay'),
    document.getElementById('confirmDialog')
  ].some((node) => node && !node.classList.contains('hidden'));

  document.body.classList.toggle('overlay-active', hasBlockingOverlay);
}

function refreshCityTimelineUI(row, city) {
  if (!row || !city) return;
  const error = validateCityTimeline(city);
  const errorEl = row.querySelector('.city-dropdown-error');
  if (errorEl) {
    errorEl.textContent = error || '';
    errorEl.classList.toggle('hidden', !error);
  }

  const checkIn = row.querySelector('[data-logistics="accommodationCheckIn"]');
  if (checkIn && checkIn.value !== (city.logistics?.accommodation?.checkIn || '')) {
    checkIn.value = city.logistics.accommodation.checkIn || '';
  }

  const checkOut = row.querySelector('[data-logistics="accommodationCheckOut"]');
  if (checkOut && checkOut.value !== (city.logistics?.accommodation?.checkOut || '')) {
    checkOut.value = city.logistics.accommodation.checkOut || '';
  }
}

function showToast(message, type = 'info') {
  const safeType = ['success', 'error', 'info'].includes(type) ? type : 'info';
  const host = document.getElementById('toastHost');
  if (!host || !message) return null;

  const iconMap = {
    success: '✓',
    error: '×',
    info: 'ℹ'
  };
  const duration = safeType === 'error' ? 4000 : 2500;
  const toast = document.createElement('div');
  const toastId = `toast-${uid()}`;
  toast.dataset.toastId = toastId;
  toast.className = `toast toast-${safeType}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', safeType === 'error' ? 'assertive' : 'polite');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${iconMap[safeType]}</span>
    <span class="toast-message">${esc(String(message))}</span>
  `;

  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  const dismiss = () => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 280);
  };

  const timer = setTimeout(dismiss, duration);
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });

  return toastId;
}

function updatePlanningStatus(status = '', progress = '') {
  const overlay = document.getElementById('planningOverlay');
  if (!overlay) return;
  overlay.querySelector('[data-city-status]').textContent = status;
  overlay.querySelector('[data-progress]').textContent = progress;
}

let _stepTransitionLock = false;
function setStep(n, { pushHistory = true } = {}) {
  if (_stepTransitionLock) return;
  _stepTransitionLock = true;
  requestAnimationFrame(() => { _stepTransitionLock = false; });

  const prev = state.step;
  state.step = n;
  if (n > state.maxStep) state.maxStep = n;
  els.steps.forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
    el.classList.toggle('reachable', i + 1 <= state.maxStep);
  });
  els.panels.forEach((el, i) => el.classList.toggle('active', i + 1 === n));
  if (pushHistory) history.pushState({ spa: true, step: n }, '');

  // Ensure the target step's content is rendered regardless of navigation source
  if (n !== prev) {
    if (n === 1) renderCities();
    if (n === 2) renderActivities();
    if (n === 3) renderArrange();
    if (n === 4) renderItinerary();
  }

  updateStepNavButtons();
  renderConfidence();
}

window.addEventListener('popstate', (e) => {
  if (!e.state?.spa) return;
  const step = e.state.step;
  if (step >= 1 && step <= els.panels.length) {
    setStep(step, { pushHistory: false });
  }
});

function updateStepNavButtons() {
  const activePanel = els.panels[state.step - 1];
  if (!activePanel) return;

  const backButtons = activePanel.querySelectorAll('[data-nav-back]');
  const nextButtons = activePanel.querySelectorAll('[data-nav-next]');
  const isFirstStep = state.step === 1;
  const isLastStep = state.step === els.panels.length;

  backButtons.forEach((btn) => btn.classList.toggle('hidden', isFirstStep));
  nextButtons.forEach((btn) => btn.classList.toggle('hidden', isLastStep));
}

// ── Checklist helpers ──────────────────────────────────────────────────────

function migrateChecklistType(type = 'other') {
  const v = String(type || 'other').toLowerCase();
  if (['flight', 'train', 'car_rental', 'transfer', 'transportation'].includes(v)) return 'transportation';
  if (['hotel', 'accommodation'].includes(v)) return 'accommodation';
  if (['restaurant', 'food', 'cafe', 'bar', 'dining'].includes(v)) return 'activity';
  if (['attraction', 'tour', 'museum', 'park', 'landmark', 'entertainment', 'shopping', 'nightlife', 'activity', 'other'].includes(v)) return 'activity';
  return 'activity';
}

function mapActivityTypeToChecklist(type = '') {
  const v = String(type || '').toLowerCase();
  if (['transfer', 'transport'].includes(v)) return 'transportation';
  return 'activity';
}

function normalizeChecklistItem(item = {}) {
  const rawType = String(item.type || 'activity').toLowerCase();
  const type = ['transportation', 'accommodation', 'activity'].includes(rawType) ? rawType : migrateChecklistType(rawType);

  const rawStatus = String(item.state || item.status || 'open').toLowerCase();
  const status = ['verified', 'finalized', 'resolved'].includes(rawStatus) ? 'resolved'
    : rawStatus === 'in_progress' ? 'in_progress' : 'open';

  const verified = Boolean(item.verified || status === 'resolved' || item.state === 'verified');
  const budgetRaw = Number(item.budgetUsd ?? item.budget ?? item.budget_usd);
  const budgetUsd = Number.isFinite(budgetRaw) && budgetRaw >= 0 ? budgetRaw : null;

  const base = {
    id: String(item.id || uid()),
    type,
    name: String(item.name || item.title || '').trim(),
    verified,
    budgetUsd,
    referenceNum: String(item.referenceNum || item.bookingReference || item.reference || '').trim(),
    notes: String(item.notes || '').trim(),
    status,
    updatedAt: item.updatedAt || new Date().toISOString(),
    expanded: Boolean(item.expanded),
    // legacy field kept for backward-compat reads
    city: String(item.city || item.location || '').trim(),
    dateTime: String(item.dateTime || item.when || '').trim()
  };

  if (type === 'transportation') {
    const rawScope = String(item.transportScope || item.transport_scope || item.transportType || '').toLowerCase();
    const transportScope = rawScope === 'entry_exit' ? 'entry_exit' : 'experience';
    return {
      ...base,
      isRoundTrip: Boolean(item.isRoundTrip),
      transportScope,
      startLocation: String(item.startLocation || item.city || '').trim(),
      startPlaceId: String(item.startPlaceId || '').trim(),
      startLat: item.startLat ?? null,
      startLng: item.startLng ?? null,
      endLocation: String(item.endLocation || '').trim(),
      endPlaceId: String(item.endPlaceId || '').trim(),
      endLat: item.endLat ?? null,
      endLng: item.endLng ?? null,
      departureDate: String(item.departureDate || (base.dateTime ? base.dateTime.slice(0, 10) : '')).trim(),
      departureTime: String(item.departureTime || (base.dateTime && base.dateTime.length > 10 ? base.dateTime.slice(11, 16) : '')).trim(),
      arrivalDate: String(item.arrivalDate || '').trim(),
      arrivalTime: String(item.arrivalTime || '').trim(),
      returnDate: String(item.returnDate || '').trim(),
      returnTime: String(item.returnTime || '').trim(),
      returnArrivalDate: String(item.returnArrivalDate || '').trim(),
      returnArrivalTime: String(item.returnArrivalTime || '').trim()
    };
  }

  if (type === 'accommodation') {
    return {
      ...base,
      accommodationCity: String(item.accommodationCity || item.city || '').trim(),
      accommodationCityPlaceId: String(item.accommodationCityPlaceId || '').trim(),
      accommodationCityLat: item.accommodationCityLat ?? null,
      accommodationCityLng: item.accommodationCityLng ?? null,
      checkInDate: String(item.checkInDate || (base.dateTime ? base.dateTime.slice(0, 10) : '')).trim(),
      checkOutDate: String(item.checkOutDate || '').trim()
    };
  }

  // activity
  return {
    ...base,
    activityId: String(item.activityId || '').trim(),
    bookingNotRequired: Boolean(item.bookingNotRequired || item.booking_not_required),
    activityLocation: String(item.activityLocation || item.city || '').trim(),
    activityLocationPlaceId: String(item.activityLocationPlaceId || '').trim(),
    activityLocationLat: item.activityLocationLat ?? null,
    activityLocationLng: item.activityLocationLng ?? null,
    activityDate: String(item.activityDate || (base.dateTime ? base.dateTime.slice(0, 10) : '')).trim(),
    activityTime: String(item.activityTime || (base.dateTime && base.dateTime.length > 10 ? base.dateTime.slice(11, 16) : '')).trim()
  };
}

function checklistItemSortKey(item) {
  if (item.type === 'transportation') return item.departureDate || item.dateTime || '9999';
  if (item.type === 'accommodation') return item.checkInDate || item.dateTime || '9999';
  const date = item.activityDate || (item.dateTime ? item.dateTime.slice(0, 10) : '');
  return date ? date + 'T' + (item.activityTime || '') : '9999';
}

function sortChecklistByDateAsc(a, b) {
  return checklistItemSortKey(a).localeCompare(checklistItemSortKey(b));
}

function groupChecklist(items = []) {
  const transportation = [];
  const accommodation = [];
  const cityMap = new Map();

  const cityCanonical = new Map(); // normalized → canonical name
  (state.cities || []).forEach((c) => {
    const name = String(c.name || '').trim();
    if (name) {
      cityMap.set(name, []);
      cityCanonical.set(normalizeCity(name), name);
    }
  });

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (item.type === 'transportation') {
      transportation.push(item);
    } else if (item.type === 'accommodation') {
      accommodation.push(item);
    } else {
      const raw = String(item.city || item.activityLocation || '').trim();
      const canonical = cityCanonical.get(normalizeCity(raw)) || raw;
      const key = cityMap.has(canonical) ? canonical : '';
      if (!cityMap.has(key)) cityMap.set(key, []);
      cityMap.get(key).push(item);
    }
  });

  const plannedNames = new Set((state.cities || []).map((c) => String(c.name || '').trim()).filter(Boolean));
  const cityGroups = [];
  cityMap.forEach((cityItems, city) => {
    if (!city) return;
    cityGroups.push({ label: city, items: [...cityItems].sort(sortChecklistByDateAsc), planned: plannedNames.has(city) });
  });
  cityGroups.sort((a, b) => {
    if (a.planned !== b.planned) return a.planned ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  transportation.sort(sortChecklistByDateAsc);
  accommodation.sort(sortChecklistByDateAsc);

  const groups = [];
  groups.push({ label: 'Accommodation', type: 'accommodation', items: accommodation });
  groups.push({ label: 'Transportation', type: 'transportation', items: transportation });
  groups.push(...cityGroups.map(({ label, items }) => ({ label, type: 'activity', items })));
  const unnamed = cityMap.get('') || [];
  if (unnamed.length) groups.push({ label: 'Other Activities', type: 'activity', items: [...unnamed].sort(sortChecklistByDateAsc) });
  return groups;
}

// collapsed display helpers
function formatChecklistDate(dateStr, timeStr, endTimeStr = '') {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const base = `${month} ${day}`;
  if (!timeStr) return base;
  const fmtTime = (t) => {
    const [h, m] = String(t || '').split(':').map(Number);
    if (!Number.isFinite(h)) return '';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = (h % 12) || 12;
    return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
  };
  const startFmt = fmtTime(timeStr);
  if (!startFmt) return base;
  if (endTimeStr) {
    const endFmt = fmtTime(endTimeStr);
    if (endFmt) return `${base}, ${startFmt} – ${endFmt}`;
  }
  return `${base}, ${startFmt}`;
}

function checklistActivityEndTime(item) {
  if (!item.activityTime || !item.activityId) return '';
  const activity = (state.activities || []).find((a) => a.id === item.activityId);
  if (!activity) return '';
  const durationMins = Math.max(30, actDurationHours(activity) * 60);
  const [h, m] = item.activityTime.split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const totalMins = h * 60 + (m || 0) + durationMins;
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function truncateLocation(loc, max = 28) {
  const s = String(loc || '');
  if (s.length <= max) return s;
  // Use first segment (city name) before first comma
  const short = s.split(',')[0].trim();
  if (short.length <= max) return short;
  return short.slice(0, max - 1) + '…';
}

function collapsedRowText(item) {
  if (item.type === 'transportation') {
    const start = truncateLocation(item.startLocation);
    const end = truncateLocation(item.endLocation);
    if (item.isRoundTrip) {
      const dates = [item.departureDate, item.returnDate].filter(Boolean).map((d) => {
        const dt = new Date(d + 'T12:00:00');
        return `${dt.toLocaleString('en-US', { month: 'short' })} ${dt.getDate()}`;
      }).join(' – ');
      return [start && end ? `${start} ↔ ${end}` : (start || end), dates].filter(Boolean).join(' • ');
    }
    const dateStr = formatChecklistDate(item.departureDate, item.departureTime);
    return [start && end ? `${start} → ${end}` : (start || end), dateStr].filter(Boolean).join(' • ');
  }
  if (item.type === 'accommodation') {
    const city = truncateLocation(item.accommodationCity);
    const dates = [item.checkInDate, item.checkOutDate].filter(Boolean).map((d) => {
      const dt = new Date(d + 'T12:00:00');
      return `${dt.toLocaleString('en-US', { month: 'short' })} ${dt.getDate()}`;
    }).join(' – ');
    return [city, dates].filter(Boolean).join(' • ');
  }
  // activity
  return formatChecklistDate(item.activityDate, item.activityTime, checklistActivityEndTime(item)) || '';
}

function buildChecklistFromState() {
  const activityIds = new Set((state.activities || []).map((a) => a.id));
  const existing = (Array.isArray(state.confidenceChecklist) ? state.confidenceChecklist : [])
    .map(normalizeChecklistItem)
    .filter((item) => item.type !== 'activity' || !item.activityId || activityIds.has(item.activityId));

  // Key by type + primary location + primary date to avoid duplicates
  const keyOf = (item) => {
    if (item.type === 'transportation') return `transport|${item.startLocation}|${item.departureDate}`;
    if (item.type === 'accommodation') return `accom|${item.accommodationCity}|${item.checkInDate}`;
    if (item.activityId) return `activity|id|${item.activityId}`;
    return `activity|${item.activityLocation}|${item.activityDate}`;
  };
  const existingKeys = new Set(existing.map(keyOf));
  const items = [...existing];

  // All approved activities
  (state.activities || []).forEach((a) => {
    if (!state.reviewed[a.id]?.approved) return;
    const placement = state.placements[a.id];
    const day = placement ? state.days.find((d) => d.id === placement.dayId) : null;
    const time = day ? parseTimeTo24(placement.time || actPreferredTime(a) || typeToTime(a.type)) : '';
    const notes = String(state.reviewed[a.id]?.notes || '').trim();
    const activityEstimatedCost = (() => {
      const perPerson = representativeCostUsd(a);
      if (perPerson == null) return null;
      const adults = state.numTravelers || 1;
      const children = state.numChildren || 0;
      return perPerson * adults + perPerson * 0.6 * children;
    })();
    const item = normalizeChecklistItem({
      type: 'activity',
      activityId: a.id,
      bookingNotRequired: Boolean(state.reviewed[a.id]?.bookingNotRequired),
      name: a.name || '',
      activityLocation: day ? (day.city || '') : (a.city || ''),
      activityDate: day ? (day.date || '') : '',
      activityTime: time || '',
      budgetUsd: activityEstimatedCost,
      notes
    });

    const existingIdx = items.findIndex((x) => x.type === 'activity' && x.activityId && x.activityId === a.id);
    const fallbackIdx = existingIdx === -1 ? items.findIndex((x) => x.type === 'activity' && keyOf(x) === keyOf(item)) : -1;
    const idx = existingIdx !== -1 ? existingIdx : fallbackIdx;

    if (idx !== -1) {
      items[idx] = normalizeChecklistItem({
        ...items[idx],
        activityId: a.id,
        bookingNotRequired: items[idx].bookingNotRequired ?? Boolean(state.reviewed[a.id]?.bookingNotRequired),
        name: item.name,
        activityLocation: item.activityLocation,
        activityDate: item.activityDate,
        activityTime: item.activityTime,
        budgetUsd: activityEstimatedCost,
        notes
      });
      existingKeys.add(keyOf(items[idx]));
    } else if (!existingKeys.has(keyOf(item))) {
      items.push(item);
      existingKeys.add(keyOf(item));
    }
  });

  // Accommodations per city
  (state.cities || []).forEach((city) => {
    const acc = city.accommodation || city.logistics?.accommodation;
    if (!acc || acc.type === 'none') return;
    const checkIn = acc.checkIn || city.startDate || '';
    const checkOut = acc.checkOut || city.endDate || '';
    const item = normalizeChecklistItem({ type: 'accommodation', name: '', accommodationCity: city.name || '', checkInDate: checkIn, checkOutDate: checkOut });
    if (!existingKeys.has(keyOf(item))) {
      items.push(item);
      existingKeys.add(keyOf(item));
    }
  });

  // Transportation per city (travel entry)
  (state.cities || []).forEach((city) => {
    const te = city.travelEntry;
    if (!te) return;
    const dt = te.dateTime || '';
    const item = normalizeChecklistItem({
      type: 'transportation',
      name: '',
      transportScope: 'entry_exit',
      startLocation: te.entryPoint || '',
      departureDate: dt ? dt.slice(0, 10) : '',
      departureTime: dt && dt.length > 10 ? dt.slice(11, 16) : ''
    });
    if (!existingKeys.has(keyOf(item))) {
      items.push(item);
      existingKeys.add(keyOf(item));
    }
  });

  state.confidenceChecklist = items;
  return items;
}

function syncActivityNotesToChecklist(activityId, notes) {
  if (!activityId) return;
  const normalizedNotes = String(notes || '').trim();
  buildChecklistFromState();
  const item = state.confidenceChecklist.find((x) => x.type === 'activity' && x.activityId === activityId);
  if (!item) return;
  item.notes = normalizedNotes;
  item.updatedAt = new Date().toISOString();
}

function syncChecklistNotesToActivity(item = {}) {
  if (item.type !== 'activity' || !item.activityId) return;
  const activityId = String(item.activityId || '').trim();
  if (!activityId || !state.reviewed[activityId]) return;
  state.reviewed[activityId] = {
    ...(state.reviewed[activityId] || {}),
    notes: String(item.notes || '').trim()
  };
}

function syncChecklistBookingRequirementToActivity(item = {}) {
  if (item.type !== 'activity' || !item.activityId) return;
  const activityId = String(item.activityId || '').trim();
  if (!activityId) return;
  state.reviewed[activityId] = {
    ...(state.reviewed[activityId] || {}),
    bookingNotRequired: Boolean(item.bookingNotRequired)
  };
}

function computeConfidenceLocal() {
  const checklist = buildChecklistFromState();
  const bookingRequired = checklist.filter((item) =>
    item.type === 'transportation' || item.type === 'accommodation' ||
    (item.type === 'activity' && !item.bookingNotRequired)
  );

  // helpers — use absolute minutes from a fixed epoch for cross-day comparison
  function dateToAbsDay(dateStr) {
    return Math.round((new Date(dateStr) - new Date('2020-01-01')) / 86400000);
  }
  function toAbsMin(dateStr, timeStr) {
    const dayMin = dateToAbsDay(dateStr) * 1440;
    return dayMin + minutesFromTime(parseTimeTo24(timeStr));
  }

  function getItemTimeWindows(item) {
    if (item.type === 'accommodation') return null;
    if (item.type === 'transportation') {
      const windows = [];
      if (item.departureDate && item.departureTime && item.arrivalDate && item.arrivalTime) {
        windows.push({
          startMin: toAbsMin(item.departureDate, item.departureTime) - 120,
          endMin: toAbsMin(item.arrivalDate, item.arrivalTime) + 120
        });
      }
      if (item.isRoundTrip && item.returnDate && item.returnTime && item.returnArrivalDate && item.returnArrivalTime) {
        windows.push({
          startMin: toAbsMin(item.returnDate, item.returnTime) - 120,
          endMin: toAbsMin(item.returnArrivalDate, item.returnArrivalTime) + 120
        });
      }
      return windows.length ? windows : null;
    }
    // activity
    if (!item.activityDate || !item.activityTime) return null;
    const startMin = toAbsMin(item.activityDate, item.activityTime);
    if (!Number.isFinite(startMin)) return null;
    const dur = actDurationHours(state.activities.find((a) => a.id === item.activityId)) * 60;
    return [{ startMin, endMin: startMin + dur }];
  }

  function getItemDateRange(item) {
    if (!item.checkInDate || !item.checkOutDate) return null;
    return { start: item.checkInDate, end: item.checkOutDate };
  }

  function windowsOverlap(a, b) {
    return a.startMin < b.endMin && b.startMin < a.endMin;
  }

  function dateRangesOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
  }

  function pairLabel(nameA, nameB) {
    const [x, y] = [nameA, nameB].sort();
    return `"${x}" and "${y}"`;
  }

  const issues = [];

  // Check A — date/time overlaps (runs always)
  for (let i = 0; i < bookingRequired.length; i++) {
    for (let j = i + 1; j < bookingRequired.length; j++) {
      const a = bookingRequired[i];
      const b = bookingRequired[j];

      // Accommodation ↔ Accommodation
      if (a.type === 'accommodation' && b.type === 'accommodation') {
        const ra = getItemDateRange(a);
        const rb = getItemDateRange(b);
        if (ra && rb && dateRangesOverlap(ra, rb)) {
          issues.push({ type: 'overlapping_dates', message: `Accommodation dates overlap: ${pairLabel(a.name || 'Accommodation', b.name || 'Accommodation')}.` });
        }
        continue;
      }

      // Skip accommodation vs non-accommodation (intentionally not flagged)
      if (a.type === 'accommodation' || b.type === 'accommodation') continue;

      // Transportation or Activity ↔ Transportation or Activity
      const wa = getItemTimeWindows(a);
      const wb = getItemTimeWindows(b);
      if (!wa || !wb) continue;

      const overlaps = wa.some((winA) => wb.some((winB) => windowsOverlap(winA, winB)));
      if (overlaps) {
        const typeKey = (a.type === 'transportation' || b.type === 'transportation') ? 'overlapping_transport' : 'overlapping_activities';
        issues.push({ type: typeKey, message: `Schedule conflict: ${pairLabel(a.name || a.type, b.name || b.type)}.` });
      }
    }
  }

  // Check B — missing booking reference (verified items only)
  bookingRequired.filter((item) => item.verified).forEach((item) => {
    if (!item.referenceNum) {
      issues.push({ type: 'missing_reference', message: `${item.name || item.type} is marked booked but has no confirmation number.` });
    }
  });

  const verified = bookingRequired.filter((item) => item.verified);
  const open = checklist.filter((item) => item.status !== 'resolved');
  const finalized = checklist.filter((item) => item.verified || item.status === 'resolved');
  const checklistSummary = {
    open,
    finalized,
    counts: { open: open.length, finalized: finalized.length, total: checklist.length }
  };

  const unresolvedIssues = issues.filter((issue) => {
    const meta = state.confidenceIssueMeta[issue.message] || {};
    return !['verified', 'dismissed'].includes(meta.action);
  });

  const hasConflict = unresolvedIssues.some((i) => ['overlapping_activities', 'overlapping_transport', 'overlapping_dates'].includes(i.type));
  const hasMissingRef = unresolvedIssues.some((i) => i.type === 'missing_reference');

  let status = 'Needs review';
  if (hasConflict) status = 'Conflicts found';
  else if (hasMissingRef) status = 'Missing details';
  else if (verified.length > 0 && !unresolvedIssues.length) status = 'Ready';

  return {
    status,
    issues,
    unresolvedIssues,
    issueCount: unresolvedIssues.length,
    topIssue: unresolvedIssues[0]?.message || 'No issues detected',
    checklist,
    checklistProgress: { verified: checklistSummary.counts.finalized, total: checklist.length },
    checklistSummary
  };
}

// ── Checklist render helpers ──────────────────────────────────────────────

// Checklist search state (module-level, reset on each modal open)
const checklistSearch = { query: '', containerCollapsed: {} };
let checklistSearchRenderTimer = null;

function renderChecklistItemExpanded(item) {
  const hasSecondary = item.referenceNum || item.notes || item.budgetUsd != null;
  const showReferenceField = item.type !== 'activity' || !item.bookingNotRequired;

  const primaryFields = (() => {
    if (item.type === 'transportation') {
      return `
        <div class="cl-form-row cl-form-row--2">
          <label class="cl-field">
            <span class="cl-field-label">Name</span>
            <input type="text" data-cl="name" value="${esc(item.name)}" placeholder="e.g. Delta Flight 1234" />
          </label>
          <label class="cl-field">
            <span class="cl-field-label">Type</span>
            <div class="cl-toggle-group" role="group">
              <button type="button" class="cl-toggle-btn ${!item.isRoundTrip ? 'active' : ''}" data-cl-toggle="one-way">One-way</button>
              <button type="button" class="cl-toggle-btn ${item.isRoundTrip ? 'active' : ''}" data-cl-toggle="round-trip">Round trip</button>
            </div>
          </label>
        </div>
        <div class="cl-form-row cl-form-row--2">
          <label class="cl-field">
            <span class="cl-field-label">From</span>
            <div class="city-autocomplete">
              <input type="text" data-cl="startLocation" value="${esc(item.startLocation)}" placeholder="Departure location" autocomplete="off" />
            </div>
          </label>
          <label class="cl-field">
            <span class="cl-field-label">To</span>
            <div class="city-autocomplete">
              <input type="text" data-cl="endLocation" value="${esc(item.endLocation)}" placeholder="Arrival location" autocomplete="off" />
            </div>
          </label>
        </div>
        <div class="cl-form-row cl-form-row--2">
          <label class="cl-field">
            <span class="cl-field-label">Departure date &amp; time</span>
            <div class="cl-datetime-pair">
              <input type="date" data-cl="departureDate" value="${esc(item.departureDate)}" />
              <input type="time" data-cl="departureTime" value="${esc(item.departureTime)}" />
            </div>
          </label>
          <label class="cl-field">
            <span class="cl-field-label">Arrival date &amp; time</span>
            <div class="cl-datetime-pair">
              <input type="date" data-cl="arrivalDate" value="${esc(item.arrivalDate)}" />
              <input type="time" data-cl="arrivalTime" value="${esc(item.arrivalTime)}" />
            </div>
          </label>
        </div>
        ${item.isRoundTrip ? `
        <div class="cl-form-row cl-form-row--2">
          <label class="cl-field">
            <span class="cl-field-label">Return date &amp; time</span>
            <div class="cl-datetime-pair">
              <input type="date" data-cl="returnDate" value="${esc(item.returnDate)}" />
              <input type="time" data-cl="returnTime" value="${esc(item.returnTime)}" />
            </div>
          </label>
          <label class="cl-field">
            <span class="cl-field-label">Return arrival date &amp; time</span>
            <div class="cl-datetime-pair">
              <input type="date" data-cl="returnArrivalDate" value="${esc(item.returnArrivalDate)}" />
              <input type="time" data-cl="returnArrivalTime" value="${esc(item.returnArrivalTime)}" />
            </div>
          </label>
        </div>
        ` : ''}
        <label class="cl-field">
          <span class="cl-field-label">Budget Tracker scope</span>
          <select data-cl="transportScope">
            <option value="entry_exit" ${item.transportScope === 'entry_exit' ? 'selected' : ''}>Entry/exit travel (exclude)</option>
            <option value="experience" ${item.transportScope !== 'entry_exit' ? 'selected' : ''}>Experience-linked travel (include)</option>
          </select>
        </label>
      `;
    }
    if (item.type === 'accommodation') {
      return `
        <label class="cl-field">
          <span class="cl-field-label">Name</span>
          <input type="text" data-cl="name" value="${esc(item.name)}" placeholder="e.g. Hilton Paris Opera" />
        </label>
        <label class="cl-field">
          <span class="cl-field-label">City</span>
          <div class="city-autocomplete">
            <input type="text" data-cl="accommodationCity" value="${esc(item.accommodationCity)}" placeholder="City" autocomplete="off" />
          </div>
        </label>
        <div class="cl-form-row cl-form-row--2">
          <label class="cl-field">
            <span class="cl-field-label">Check-in date</span>
            <input type="date" data-cl="checkInDate" value="${esc(item.checkInDate)}" />
          </label>
          <label class="cl-field">
            <span class="cl-field-label">Check-out date</span>
            <input type="date" data-cl="checkOutDate" value="${esc(item.checkOutDate)}" />
          </label>
        </div>
      `;
    }
    // activity
    return `
      <label class="cl-field">
        <span class="cl-field-label">Name</span>
        <input type="text" data-cl="name" value="${esc(item.name)}" placeholder="Activity name" />
      </label>
      <label class="cl-field">
        <span class="cl-field-label">Location</span>
        <div class="city-autocomplete">
          <input type="text" data-cl="activityLocation" value="${esc(item.activityLocation)}" placeholder="Location (optional)" autocomplete="off" />
        </div>
      </label>
      <div class="cl-form-row cl-form-row--2">
        <label class="cl-field">
          <span class="cl-field-label">Date &amp; time</span>
          <div class="cl-datetime-pair">
            <input type="date" data-cl="activityDate" value="${esc(item.activityDate)}" />
            <input type="time" data-cl="activityTime" value="${esc(item.activityTime)}" />
          </div>
        </label>
        <div></div>
      </div>
    `;
  })();

  return `
    <div class="cl-expanded-body">
      <div class="cl-primary-zone">${primaryFields}</div>
      <div class="cl-secondary-zone ${hasSecondary ? 'open' : ''}">
        <button type="button" class="cl-more-details-btn" data-cl-more>
          <i class="ph-bold ${hasSecondary ? 'ph-caret-up' : 'ph-caret-down'}" aria-hidden="true"></i>
          More details
        </button>
        <div class="cl-secondary-fields ${hasSecondary ? '' : 'hidden'}">
          ${showReferenceField ? `
          <label class="cl-field">
            <span class="cl-field-label">Reference #</span>
            <input type="text" data-cl="referenceNum" value="${esc(item.referenceNum)}" placeholder="Confirmation code / ticket number" />
          </label>
          ` : ''}
          <label class="cl-field cl-field--price">
            <span class="cl-field-label">Price (USD)</span>
            <div class="cl-price-wrap">
              <span class="cl-price-prefix">$</span>
              <input type="number" min="0" step="0.01" data-cl="budgetUsd" value="${item.budgetUsd == null ? '' : String(item.budgetUsd)}" placeholder="0.00" />
            </div>
          </label>
          <label class="cl-field">
            <span class="cl-field-label">Notes</span>
            <textarea data-cl="notes" rows="2" placeholder="Any details, reminders, links…">${esc(item.notes)}</textarea>
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderChecklistContainer(group, collapsedState) {
  const isCollapsed = Boolean(collapsedState[group.label]);
  const count = group.items.length;
  const containerSubtotal = group.items.reduce((s, it) => s + (it.budgetUsd ?? 0), 0);
  const hasPrices = group.items.some((it) => it.budgetUsd != null);

  const emptyIcon = group.type === 'transportation' ? 'ph-airplane' : group.type === 'accommodation' ? 'ph-bed' : 'ph-map-pin';
  const emptyLabel = group.type === 'transportation' ? 'No transportation booked yet'
    : group.type === 'accommodation' ? 'No accommodation booked yet'
    : 'No activities booked yet';

  const itemsHtml = group.items.map((item) => {
    const meta = collapsedRowText(item);
    const checkedClass = item.verified ? ' cl-item--checked' : '';
    return `
      <div class="cl-item${checkedClass}" data-cl-item="${esc(item.id)}">
        <div class="cl-item-collapsed" data-cl-collapse-row>
          <button type="button" class="cl-checkbox ${item.verified ? 'checked' : ''}" data-cl-check aria-label="Mark as verified" aria-pressed="${item.verified}">
            ${item.verified ? '<i class="ph-bold ph-check" aria-hidden="true"></i>' : ''}
          </button>
          ${item.type === 'activity' ? `
            <button type="button" class="cl-ticket-toggle ${item.bookingNotRequired ? 'cl-ticket-toggle--off' : ''}" data-cl-booking-toggle aria-label="${item.bookingNotRequired ? 'Mark booking required' : 'Mark booking not required'}" aria-pressed="${item.bookingNotRequired}">
              <i class="ph-bold ph-ticket" aria-hidden="true"></i>
            </button>
          ` : ''}
          <div class="cl-item-text">
            <span class="cl-item-name">${esc(item.name || '(unnamed)')}</span>
            ${meta ? `<span class="cl-item-meta">${esc(meta)}</span>` : ''}
          </div>
          ${item.budgetUsd != null ? `<span class="cl-item-price">$${Math.round(item.budgetUsd).toLocaleString()}</span>` : ''}
          <i class="ph-bold ${item.expanded ? 'ph-caret-up' : 'ph-caret-down'} cl-item-chevron" aria-hidden="true"></i>
        </div>
        ${item.expanded ? `
          <div class="cl-item-expanded-wrap">
            <div class="cl-expanded-header">
              ${item.type !== 'activity' ? `
                <button type="button" class="cl-delete-btn" data-cl-delete title="Delete item">
                  <i class="ph-bold ph-trash" aria-hidden="true"></i>
                </button>
              ` : ''}
            </div>
            ${renderChecklistItemExpanded(item)}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const renderItemsBlock = (items, emptyLabelOverride) => {
    if (!items.length) {
      return `
        <div class="cl-empty-state">
          <i class="ph-bold ${emptyIcon} cl-empty-icon" aria-hidden="true"></i>
          <p class="cl-empty-label">${esc(emptyLabelOverride || emptyLabel)}</p>
        </div>
      `;
    }
    return items.map((item) => {
      const meta = collapsedRowText(item);
      const checkedClass = item.verified ? ' cl-item--checked' : '';
      return `
        <div class="cl-item${checkedClass}" data-cl-item="${esc(item.id)}">
          <div class="cl-item-collapsed" data-cl-collapse-row>
            <button type="button" class="cl-checkbox ${item.verified ? 'checked' : ''}" data-cl-check aria-label="Mark as verified" aria-pressed="${item.verified}">
              ${item.verified ? '<i class="ph-bold ph-check" aria-hidden="true"></i>' : ''}
            </button>
            ${item.type === 'activity' ? `
              <button type="button" class="cl-ticket-toggle ${item.bookingNotRequired ? 'cl-ticket-toggle--off' : ''}" data-cl-booking-toggle aria-label="${item.bookingNotRequired ? 'Mark booking required' : 'Mark booking not required'}" aria-pressed="${item.bookingNotRequired}">
                <i class="ph-bold ph-ticket" aria-hidden="true"></i>
              </button>
            ` : ''}
            <div class="cl-item-text">
              <span class="cl-item-name">${esc(item.name || '(unnamed)')}</span>
              ${meta ? `<span class="cl-item-meta">${esc(meta)}</span>` : ''}
            </div>
            ${item.budgetUsd != null ? `<span class="cl-item-price">$${Math.round(item.budgetUsd).toLocaleString()}</span>` : ''}
            <i class="ph-bold ${item.expanded ? 'ph-caret-up' : 'ph-caret-down'} cl-item-chevron" aria-hidden="true"></i>
          </div>
          ${item.expanded ? `
            <div class="cl-item-expanded-wrap">
              <div class="cl-expanded-header">
                ${item.type !== 'activity' ? `
                  <button type="button" class="cl-delete-btn" data-cl-delete title="Delete item">
                    <i class="ph-bold ph-trash" aria-hidden="true"></i>
                  </button>
                ` : ''}
              </div>
              ${renderChecklistItemExpanded(item)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  };

  if (group.type === 'activity') {
    const requiredItems = group.items.filter((item) => !item.bookingNotRequired).sort(sortChecklistByDateAsc);
    const notRequiredItems = group.items.filter((item) => item.bookingNotRequired).sort(sortChecklistByDateAsc);
    const bookingNotRequiredKey = `${group.label}::bookingNotRequired`;
    const bookingNotRequiredCollapsed = collapsedState[bookingNotRequiredKey] !== undefined
      ? Boolean(collapsedState[bookingNotRequiredKey])
      : true;

    return `
      <section class="cl-container" data-cl-group="${esc(group.label)}">
        <button type="button" class="cl-container-header" data-cl-toggle-container="${esc(group.label)}">
          <span class="cl-container-title">${esc(group.label)}</span>
          ${hasPrices ? `<span class="cl-container-price">$${Math.round(containerSubtotal).toLocaleString()}</span>` : (isCollapsed ? `<span class="cl-container-badge">${count}</span>` : '')}
          <i class="ph-bold ${isCollapsed ? 'ph-caret-down' : 'ph-caret-up'} cl-container-chevron" aria-hidden="true"></i>
        </button>
        ${isCollapsed ? '' : `
          <div class="cl-container-body">
            <div class="cl-subsection">
              <h4 class="cl-subsection-title">Booking Required</h4>
              ${renderItemsBlock(requiredItems, 'No booking-required activities yet')}
            </div>
            <div class="cl-subsection">
              <button type="button" class="cl-subsection-toggle" data-cl-toggle-container="${esc(bookingNotRequiredKey)}">
                <span class="cl-subsection-title">Booking Not Required</span>
                ${bookingNotRequiredCollapsed ? `<span class="cl-container-badge">${notRequiredItems.length}</span>` : ''}
                <i class="ph-bold ${bookingNotRequiredCollapsed ? 'ph-caret-down' : 'ph-caret-up'} cl-container-chevron" aria-hidden="true"></i>
              </button>
              ${bookingNotRequiredCollapsed ? '' : renderItemsBlock(notRequiredItems, 'No booking-exempt activities yet')}
            </div>
            <button type="button" class="cl-add-btn" data-cl-add="${esc(group.label)}" data-cl-add-type="${esc(group.type)}">
              <i class="ph-bold ph-plus" aria-hidden="true"></i> Add Item
            </button>
          </div>
        `}
      </section>
    `;
  }

  return `
    <section class="cl-container" data-cl-group="${esc(group.label)}">
      <button type="button" class="cl-container-header" data-cl-toggle-container="${esc(group.label)}">
        <span class="cl-container-title">${esc(group.label)}</span>
        ${hasPrices ? `<span class="cl-container-price">$${Math.round(containerSubtotal).toLocaleString()}</span>` : (isCollapsed ? `<span class="cl-container-badge">${count}</span>` : '')}
        <i class="ph-bold ${isCollapsed ? 'ph-caret-down' : 'ph-caret-up'} cl-container-chevron" aria-hidden="true"></i>
      </button>
      ${isCollapsed ? '' : `
        <div class="cl-container-body">
          ${count === 0 ? `
            <div class="cl-empty-state">
              <i class="ph-bold ${emptyIcon} cl-empty-icon" aria-hidden="true"></i>
              <p class="cl-empty-label">${esc(emptyLabel)}</p>
            </div>
          ` : itemsHtml}
          ${hasPrices ? `<p class="cl-subtotal">Total: $${containerSubtotal.toFixed(2)}</p>` : ''}
          <button type="button" class="cl-add-btn" data-cl-add="${esc(group.label)}" data-cl-add-type="${esc(group.type)}">
            <i class="ph-bold ph-plus" aria-hidden="true"></i> Add Item
          </button>
        </div>
      `}
    </section>
  `;
}

function renderChecklistModal() {
  const el = els.confidenceChecklist;
  if (!el) return;

  const checklist = state.confidenceChecklist || [];
  const groups = groupChecklist(checklist);
  const query = checklistSearch.query.toLowerCase().trim();

  // Search autofill dropdown
  const searchMatches = query.length >= 1
    ? checklist.filter((it) => (it.name || '').toLowerCase().includes(query)).slice(0, 8)
    : [];

  const totals = computeBudgetLensBreakdown();
  const anyPrices = checklist.some((it) => it.budgetUsd != null);

  el.innerHTML = `
    <div class="cl-search-wrap">
      <div class="cl-search-row">
        <div class="cl-search-pill">
          <i class="ph-bold ph-magnifying-glass cl-search-icon" aria-hidden="true"></i>
          <input type="search" class="cl-search-input" id="clSearchInput" placeholder="Search bookings…" value="${esc(checklistSearch.query)}" autocomplete="off" />
        </div>
      </div>
      ${searchMatches.length > 0 ? `
        <ul class="cl-search-dropdown" id="clSearchDropdown" role="listbox">
          ${searchMatches.map((it) => {
            const badge = it.type.charAt(0).toUpperCase() + it.type.slice(1);
            return `<li class="cl-search-result" data-cl-search-id="${esc(it.id)}" role="option">
              <span class="cl-search-name">${esc(it.name || '(unnamed)')}</span>
              <span class="cl-search-badge cl-badge--${esc(it.type)}">${esc(badge)}</span>
            </li>`;
          }).join('')}
        </ul>
      ` : query.length >= 1 ? `
        <ul class="cl-search-dropdown" id="clSearchDropdown">
          <li class="cl-search-no-results">No bookings found</li>
        </ul>
      ` : ''}
    </div>
    <div class="cl-containers">
      ${groups.map((g) => renderChecklistContainer(g, checklistSearch.containerCollapsed)).join('')}
    </div>
    ${anyPrices ? `
      <div class="cl-totals-block">
        <p class="cl-total-trip"><strong>Total Trip Cost: $${Math.round(totals.absoluteTripTotal).toLocaleString()}</strong></p>
        <p class="cl-total-activities">Activities Cost: $${Math.round(totals.itineraryActivityTotal).toLocaleString()}</p>
      </div>` : ''}
  `;

  bindChecklistEvents(el);
}

function bindChecklistEvents(el) {
  el.querySelector('#checklistModalSave')?.addEventListener('click', () => {
    buildChecklistFromState();
    saveSnapshot();
    renderActivities();
  });

  // Search input
  const searchInput = el.querySelector('#clSearchInput');
  searchInput?.addEventListener('input', (e) => {
    checklistSearch.query = e.target.value;
    if (checklistSearchRenderTimer) clearTimeout(checklistSearchRenderTimer);
    checklistSearchRenderTimer = setTimeout(() => {
      renderChecklistModal();
      const newInput = el.querySelector('#clSearchInput');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
      checklistSearchRenderTimer = null;
    }, 90);
  });

  // Search result selection
  el.querySelectorAll('[data-cl-search-id]').forEach((li) => {
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const id = li.dataset.clSearchId;
      checklistSearch.query = '';
      const item = state.confidenceChecklist.find((x) => x.id === id);
      if (item) item.expanded = true;
      renderChecklistModal();
      // Scroll and flash
      requestAnimationFrame(() => {
        const target = el.querySelector(`[data-cl-item="${CSS.escape(id)}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.add('cl-item--flash');
          setTimeout(() => target.classList.remove('cl-item--flash'), 1000);
        }
      });
    });
  });

  // Container collapse/expand
  el.querySelectorAll('[data-cl-toggle-container]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const label = btn.dataset.clToggleContainer;
      checklistSearch.containerCollapsed[label] = !checklistSearch.containerCollapsed[label];
      renderChecklistModal();
    });
  });

  // Item row click to expand/collapse
  el.querySelectorAll('[data-cl-collapse-row]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-cl-check]') || e.target.closest('[data-cl-booking-toggle]')) return;
      const itemEl = row.closest('[data-cl-item]');
      if (!itemEl) return;
      const id = itemEl.dataset.clItem;
      const item = state.confidenceChecklist.find((x) => x.id === id);
      if (!item) return;
      item.expanded = !item.expanded;
      renderChecklistModal();
    });
  });

  // Checkbox toggle
  el.querySelectorAll('[data-cl-check]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemEl = btn.closest('[data-cl-item]');
      if (!itemEl) return;
      const id = itemEl.dataset.clItem;
      const item = state.confidenceChecklist.find((x) => x.id === id);
      if (!item) return;
      item.verified = !item.verified;
      item.status = item.verified ? 'resolved' : 'open';
      item.updatedAt = new Date().toISOString();
      renderChecklistModal();
      renderConfidenceBadge();
    });
  });

  // Booking required toggle (activity only)
  el.querySelectorAll('[data-cl-booking-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemEl = btn.closest('[data-cl-item]');
      if (!itemEl) return;
      const groupLabel = btn.closest('[data-cl-group]')?.dataset.clGroup || '';
      const id = itemEl.dataset.clItem;
      const item = state.confidenceChecklist.find((x) => x.id === id);
      if (!item || item.type !== 'activity') return;
      item.bookingNotRequired = !item.bookingNotRequired;
      if (item.bookingNotRequired) {
        checklistSearch.containerCollapsed[`${groupLabel || 'Other Activities'}::bookingNotRequired`] = true;
      }
      item.updatedAt = new Date().toISOString();
      syncChecklistBookingRequirementToActivity(item);
      renderChecklistModal();
    });
  });

  // Delete with undo toast
  el.querySelectorAll('[data-cl-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemEl = btn.closest('[data-cl-item]');
      if (!itemEl) return;
      const id = itemEl.dataset.clItem;
      const deleted = state.confidenceChecklist.find((x) => x.id === id);
      if (!deleted || deleted.type === 'activity') return;
      state.confidenceChecklist = state.confidenceChecklist.filter((x) => x.id !== id);
      renderChecklistModal();
      renderConfidenceBadge();

      // Undo toast
      const host = document.getElementById('toastHost');
      if (host) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-info';
        toast.setAttribute('role', 'status');
        toast.innerHTML = `<span class="toast-message">Item deleted</span><button class="cl-undo-btn" type="button">Undo</button>`;
        host.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        const dismiss = () => {
          toast.classList.remove('show');
          toast.classList.add('hide');
          setTimeout(() => toast.remove(), 280);
        };
        const timer = setTimeout(dismiss, 4000);
        toast.querySelector('.cl-undo-btn').addEventListener('click', () => {
          clearTimeout(timer);
          dismiss();
          state.confidenceChecklist = [...state.confidenceChecklist, deleted];
          renderChecklistModal();
          renderConfidenceBadge();
        });
      }
    });
  });

  // More details toggle
  el.querySelectorAll('[data-cl-more]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const zone = btn.closest('.cl-secondary-zone');
      const fields = zone?.querySelector('.cl-secondary-fields');
      const icon = btn.querySelector('i');
      if (!fields) return;
      const isOpen = !fields.classList.contains('hidden');
      fields.classList.toggle('hidden', isOpen);
      if (icon) {
        icon.className = `ph-bold ${isOpen ? 'ph-caret-down' : 'ph-caret-up'}`;
      }
    });
  });

  // Round-trip toggle
  el.querySelectorAll('[data-cl-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemEl = btn.closest('[data-cl-item]');
      if (!itemEl) return;
      const id = itemEl.dataset.clItem;
      const item = state.confidenceChecklist.find((x) => x.id === id);
      if (!item) return;
      item.isRoundTrip = btn.dataset.clToggle === 'round-trip';
      syncItemFromExpanded(el, id);
      renderChecklistModal();
    });
  });

  // Add item buttons
  el.querySelectorAll('[data-cl-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.clAddType || 'activity';
      const groupLabel = btn.dataset.clAdd;
      const cityDefault = !['Transportation', 'Accommodation'].includes(groupLabel) ? groupLabel : '';
      const newItem = normalizeChecklistItem({
        type,
        name: '',
        city: cityDefault,
        activityLocation: cityDefault,
        transportScope: type === 'transportation' ? 'experience' : undefined,
        expanded: true
      });
      state.confidenceChecklist = [...(state.confidenceChecklist || []), newItem];
      renderChecklistModal();
      renderConfidenceBadge();
      // Scroll to new item
      requestAnimationFrame(() => {
        const target = el.querySelector(`[data-cl-item="${CSS.escape(newItem.id)}"]`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  });

  // Live sync from expanded form inputs
  el.querySelectorAll('[data-cl-item]').forEach((itemEl) => {
    const id = itemEl.dataset.clItem;
    itemEl.querySelectorAll('[data-cl]').forEach((input) => {
      const ev = input.tagName === 'TEXTAREA' || input.type === 'text' || input.type === 'search' ? 'input' : 'change';
      input.addEventListener(ev, () => syncItemFromExpanded(el, id));
    });

    // Attach Google Maps autocomplete to location inputs
    if (isGooglePlacesReady()) {
      const locationInputs = [
        { selector: '[data-cl="startLocation"]', latKey: 'startLat', lngKey: 'startLng', placeKey: 'startPlaceId', valKey: 'startLocation' },
        { selector: '[data-cl="endLocation"]', latKey: 'endLat', lngKey: 'endLng', placeKey: 'endPlaceId', valKey: 'endLocation' },
        { selector: '[data-cl="accommodationCity"]', latKey: 'accommodationCityLat', lngKey: 'accommodationCityLng', placeKey: 'accommodationCityPlaceId', valKey: 'accommodationCity' },
        { selector: '[data-cl="activityLocation"]', latKey: 'activityLocationLat', lngKey: 'activityLocationLng', placeKey: 'activityLocationPlaceId', valKey: 'activityLocation' }
      ];
      locationInputs.forEach(({ selector, latKey, lngKey, placeKey, valKey }) => {
        const input = itemEl.querySelector(selector);
        if (!input) return;
        attachPlaceAutocompleteElement(input, {
          onResolved: ({ formattedAddress, placeId, lat, lng }) => {
            const item = state.confidenceChecklist.find((x) => x.id === id);
            if (!item) return;
            item[valKey] = formattedAddress;
            item[placeKey] = placeId;
            item[latKey] = lat;
            item[lngKey] = lng;
            input.value = formattedAddress;
          },
          onInput: () => {
            const item = state.confidenceChecklist.find((x) => x.id === id);
            if (!item) return;
            item[placeKey] = '';
            item[latKey] = null;
            item[lngKey] = null;
          },
          onInvalid: () => {
            const item = state.confidenceChecklist.find((x) => x.id === id);
            if (!item) return;
            item[placeKey] = '';
            item[latKey] = null;
            item[lngKey] = null;
          }
        });
      });
    }
  });
}

function syncItemFromExpanded(el, id) {
  const item = state.confidenceChecklist.find((x) => x.id === id);
  if (!item) return;
  const itemEl = el.querySelector(`[data-cl-item="${CSS.escape(id)}"]`);
  if (!itemEl) return;

  const get = (sel) => itemEl.querySelector(sel)?.value?.trim() ?? '';
  const getNum = (sel) => { const v = Number(itemEl.querySelector(sel)?.value); return Number.isFinite(v) && v >= 0 ? v : null; };

  item.name = get('[data-cl="name"]');
  item.referenceNum = get('[data-cl="referenceNum"]');
  item.budgetUsd = getNum('[data-cl="budgetUsd"]');
  item.notes = get('[data-cl="notes"]');
  item.updatedAt = new Date().toISOString();

  if (item.type === 'transportation') {
    const scope = get('[data-cl="transportScope"]');
    item.transportScope = scope === 'entry_exit' ? 'entry_exit' : 'experience';
    item.startLocation = get('[data-cl="startLocation"]');
    item.endLocation = get('[data-cl="endLocation"]');
    item.departureDate = get('[data-cl="departureDate"]');
    item.departureTime = get('[data-cl="departureTime"]');
    item.arrivalDate = get('[data-cl="arrivalDate"]');
    item.arrivalTime = get('[data-cl="arrivalTime"]');
    item.returnDate = get('[data-cl="returnDate"]');
    item.returnTime = get('[data-cl="returnTime"]');
    item.returnArrivalDate = get('[data-cl="returnArrivalDate"]');
    item.returnArrivalTime = get('[data-cl="returnArrivalTime"]');

    if (!item.startLocation) {
      item.startPlaceId = '';
      item.startLat = null;
      item.startLng = null;
    }
    if (!item.endLocation) {
      item.endPlaceId = '';
      item.endLat = null;
      item.endLng = null;
    }
  } else if (item.type === 'accommodation') {
    item.accommodationCity = get('[data-cl="accommodationCity"]');
    item.checkInDate = get('[data-cl="checkInDate"]');
    item.checkOutDate = get('[data-cl="checkOutDate"]');
    if (!item.accommodationCity) {
      item.accommodationCityPlaceId = '';
      item.accommodationCityLat = null;
      item.accommodationCityLng = null;
    }
  } else {
    item.activityLocation = get('[data-cl="activityLocation"]');
    item.activityDate = get('[data-cl="activityDate"]');
    item.activityTime = get('[data-cl="activityTime"]');
    if (!item.activityLocation) {
      item.activityLocationPlaceId = '';
      item.activityLocationLat = null;
      item.activityLocationLng = null;
    }
  }

  // Keep legacy fields in sync for confidence score
  item.dateTime = item.type === 'transportation' ? (item.departureDate ? item.departureDate + (item.departureTime ? 'T' + item.departureTime : '') : '')
    : item.type === 'accommodation' ? item.checkInDate
    : item.activityDate ? item.activityDate + (item.activityTime ? 'T' + item.activityTime : '') : '';
  item.city = item.type === 'transportation' ? item.startLocation
    : item.type === 'accommodation' ? item.accommodationCity
    : item.activityLocation;

  syncChecklistNotesToActivity(item);
  syncChecklistBookingRequirementToActivity(item);
}

// ── renderConfidence (badge + trip health panels) ─────────────────────────

function renderConfidenceBadge() {
  const tripLoaded = Boolean(state.currentItineraryId || (state.activities && state.activities.length));
  if (els.confidenceBadge) els.confidenceBadge.classList.toggle('hidden', !tripLoaded);
  if (!tripLoaded) return;
  state.confidence = computeConfidenceLocal();
  const statusClass = String(state.confidence.status || '').toLowerCase().replace(/\s+/g, '-');
  if (els.confidenceBadge) {
    els.confidenceBadge.className = `confidence-badge ${statusClass}`;
    els.confidenceBadge.innerHTML = `<i class="ph-bold ph-heartbeat" aria-hidden="true"></i><span class="sr-only">Trip Health: ${esc(state.confidence.status)} · ${state.confidence.issueCount} issues</span>`;
  }
  if (els.confidencePopoverStatus) els.confidencePopoverStatus.innerHTML = `<strong>${esc(state.confidence.status)}</strong>`;
  if (els.confidencePopoverIssues) els.confidencePopoverIssues.textContent = `${state.confidence.issueCount} issue${state.confidence.issueCount === 1 ? '' : 's'}`;
  if (els.confidencePopoverTopIssue) els.confidencePopoverTopIssue.textContent = state.confidence.topIssue;
  if (els.confidencePopoverProgress) els.confidencePopoverProgress.textContent = `${state.confidence.checklistProgress.verified} of ${state.confidence.checklistProgress.total} items verified`;
  const signatures = state.confidence.unresolvedIssues.map((x) => x.message);
  const newlyAdded = signatures.filter((x) => !(state.confidenceIssueSignatures || []).includes(x));
  if (newlyAdded.length) showToast(`Confidence warning: ${newlyAdded[0]}`, 'error');
  state.confidenceIssueSignatures = signatures;
}

function renderConfidence() {
  const tripLoaded = Boolean(state.currentItineraryId || (state.activities && state.activities.length));
  if (els.confidenceBadge) els.confidenceBadge.classList.toggle('hidden', !tripLoaded);
  if (!tripLoaded) {
    if (els.confidenceSummary) els.confidenceSummary.innerHTML = '<p class="muted-text">Load or create a trip to open Trip Health.</p>';
    if (els.confidenceIssues) els.confidenceIssues.innerHTML = '';
    return;
  }
  state.confidence = computeConfidenceLocal();
  const statusClass = String(state.confidence.status || '').toLowerCase().replace(/\s+/g, '-');
  if (els.confidenceBadge) {
    els.confidenceBadge.className = `confidence-badge ${statusClass}`;
    els.confidenceBadge.innerHTML = `<i class="ph-bold ph-heartbeat" aria-hidden="true"></i><span class="sr-only">Trip Health: ${esc(state.confidence.status)} · ${state.confidence.issueCount} issues</span>`;
  }
  if (els.confidencePopoverStatus) els.confidencePopoverStatus.innerHTML = `<strong>${esc(state.confidence.status)}</strong>`;
  if (els.confidencePopoverIssues) els.confidencePopoverIssues.textContent = `${state.confidence.issueCount} issue${state.confidence.issueCount === 1 ? '' : 's'}`;
  if (els.confidencePopoverTopIssue) els.confidencePopoverTopIssue.textContent = state.confidence.topIssue;
  if (els.confidencePopoverProgress) els.confidencePopoverProgress.textContent = `${state.confidence.checklistProgress.verified} of ${state.confidence.checklistProgress.total} items verified`;

  if (els.confidenceSummary) {
    const checklist = state.confidenceChecklist || [];
    const verifiedCount = checklist.filter((item) => item.verified || item.status === 'resolved').length;
    const unresolvedBookings = checklist.length - verifiedCount;
    const totals = computeBudgetLensBreakdown();
    const totalBudget = Number(state.tripBudget) || 0;
    const delta = totalBudget > 0 ? totalBudget - totals.budgetLensTotal : null;
    els.confidenceSummary.innerHTML = `
      <section class="trip-health-summary-card">
        <h3>Health summary</h3>
        <div class="trip-health-metrics">
          <p><strong>Status:</strong> ${esc(state.confidence.status)}</p>
          <p><strong>Open issues:</strong> ${state.confidence.issueCount}</p>
          <p><strong>Unresolved bookings:</strong> ${unresolvedBookings}</p>
          <p><strong>Verified items:</strong> ${verifiedCount}</p>
          <p><strong>Biggest issue:</strong> ${esc(state.confidence.topIssue)}</p>
        </div>
      </section>
      <section class="trip-health-summary-card">
        <h3>Budget summary</h3>
        <div class="trip-health-metrics">
          <p><strong>Budget Tracker total:</strong> $${totals.budgetLensTotal.toFixed(2)}</p>
          <p><strong>Absolute trip total:</strong> $${totals.absoluteTripTotal.toFixed(2)}</p>
          <p><strong>Total trip budget:</strong> ${totalBudget > 0 ? `$${totalBudget.toFixed(2)}` : 'Not set'}</p>
          <p><strong>Over / under:</strong> ${delta == null ? 'N/A' : (delta >= 0 ? `$${delta.toFixed(2)} under` : `$${Math.abs(delta).toFixed(2)} over`)}</p>
          <p class="muted-text">Tracks total cost of planned activities.</p>
        </div>
      </section>
    `;
  }

  if (els.confidenceIssues) {
    const unresolved = state.confidence.unresolvedIssues || [];
    els.confidenceIssues.innerHTML = unresolved.length
      ? unresolved.map((issue) => {
          const meta = state.confidenceIssueMeta[issue.message] || {};
          return `<article class="confidence-issue-card" data-issue="${esc(issue.message)}">
            <p><strong>${esc(issue.message)}</strong></p>
            <div class="confidence-issue-actions">
              <button type="button" class="secondary" data-issue-action="fix">Fix</button>
              <button type="button" class="secondary" data-issue-action="verify">Verify</button>
              <button type="button" class="secondary" data-issue-action="dismiss">Dismiss</button>
            </div>
            <textarea rows="2" data-issue-note placeholder="Add note">${esc(meta.note || '')}</textarea>
          </article>`;
        }).join('')
      : '<p class="muted-text">No unresolved issues.</p>';

    els.confidenceIssues.querySelectorAll('[data-issue]').forEach((node) => {
      const key = node.getAttribute('data-issue');
      const setMeta = (patch = {}) => {
        state.confidenceIssueMeta[key] = { ...(state.confidenceIssueMeta[key] || {}), ...patch };
        renderConfidence();
      };
      node.querySelectorAll('[data-issue-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-issue-action');
          if (action === 'fix') {
            openChecklistModal();
            return;
          }
          if (action === 'verify') setMeta({ action: 'verified' });
          if (action === 'dismiss') setMeta({ action: 'dismissed' });
        });
      });
      node.querySelector('[data-issue-note]')?.addEventListener('input', (e) => {
        state.confidenceIssueMeta[key] = { ...(state.confidenceIssueMeta[key] || {}), note: e.target.value };
      });
    });
  }

  const signatures = state.confidence.unresolvedIssues.map((x) => x.message);
  const newlyAdded = signatures.filter((x) => !(state.confidenceIssueSignatures || []).includes(x));
  if (newlyAdded.length) showToast(`Confidence warning: ${newlyAdded[0]}`, 'error');
  state.confidenceIssueSignatures = signatures;
}

function setPlanningLoading(isLoading) {
  const overlay = document.getElementById('planningOverlay');
  if (!overlay) return;

  state.isPlanning = isLoading;
  els.planBtn.disabled = isLoading;
  els.planBtn.innerHTML = isLoading ? 'Planning…' : 'Next <i class="ph-bold ph-arrow-right" aria-hidden="true"></i>';

  if (!isLoading) {
    overlay.classList.add('hidden');
    refreshOverlayInterlocks();
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
  refreshOverlayInterlocks();

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

async function goToNextStep(fromStep = state.step) {
  if (fromStep === 1) {
    if (state.isPlanning) return;

    const hasExistingActivities = Array.isArray(state.activities) && state.activities.length > 0;
    const hasReviewedState = state.reviewed && typeof state.reviewed === 'object';
    const step1Changed = state.lastPlannedFingerprint && state.lastPlannedFingerprint !== step1Fingerprint();

    if (hasExistingActivities && hasReviewedState && !step1Changed) {
      syncTripMetaFromInputs();
      setStep(2);
      return;
    }

    let citiesToRegenerate = null;
    let lockedByCity = {};
    if (hasExistingActivities && step1Changed) {
      const result = await showRegenerateConfirmDialog();
      if (!result) {
        syncTripMetaFromInputs();
        setStep(2);
        return;
      }
      citiesToRegenerate = result.cities;
      lockedByCity = result.lockedByCity;
    }

    if (!validateLocationsBeforePlanning()) {
      showToast('Please validate all locations before planning your trip.', 'error');
      return;
    }
    clearSnapshot();
    if (!citiesToRegenerate) clearPlannedResultsKeepSetup();
    setPlanningLoading(true);
    try { await planTrip(citiesToRegenerate, lockedByCity); }
    catch (e) { showToast(e?.message || 'Failed to plan trip.', 'error'); }
    finally { setPlanningLoading(false); }
    return;
  }

  if (fromStep === 2) {
    const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
    if (!approved.length) return;
    state.days = expandDays(state.cities);
    state.arrangeCity = state.days[0]?.city || null;
    approved.forEach((a) => {
      state.placements[a.id] = state.placements[a.id] || { dayId: null, time: parseTimeTo24(actPreferredTime(a) || typeToTime(a.type)) };
    });
    setStep(3);
    return;
  }

  if (fromStep === 3) {
    try {
      await generateItinerary();
    } catch (e) {
      showToast(e?.message || 'Failed to generate itinerary.', 'error');
    }
    return;
  }

}

function goToPreviousStep(fromStep = state.step) {
  if (fromStep <= 1) return;
  setStep(fromStep - 1);
}

function normalizeCityData(city = {}) {
  const logistics = normalizeCityLogistics(city);
  const normalized = {
    ...city,
    id: city.id || uid(),
    leaveTime: parseTimeTo24(city.leaveTime || '18:00'),
    notes: city.notes || '',
    detailsExpanded: Boolean(city.detailsExpanded),
    accommodation: normalizeAccommodation(city.accommodation || city.accommodations),
    travelEntry: city.travelEntry ? normalizeTravelEntry(city.travelEntry) : null,
    travelTiming: city.travelTiming ? { ...city.travelTiming } : null,
    logistics
  };
  syncCityLegacyDates(normalized);
  return normalized;
}

function getCityDayWindowStart(city, date) {
  const isArrivalDay = city?.startDate === date;
  if (!isArrivalDay) return DAY_START_HOUR * 60;

  const computed = city?.travelTiming?.arrivalAvailableTime;
  if (computed) return minutesFromTime(computed);
  return minutesFromTime(extractTimeFromDateTime(city?.travelEntry?.dateTime) || '09:00');
}

function getCityDayWindowEnd(city, date) {
  const isDepartureDay = city?.endDate === date;
  if (!isDepartureDay) return (DAY_END_HOUR * 60) - 1;

  const computed = city?.travelTiming?.departureMustLeaveTime;
  if (computed) return minutesFromTime(computed);
  return minutesFromTime(parseTimeTo24(city?.leaveTime || '18:00'));
}

function addCityRow(city = { id: uid(), name: '', startDate: '', endDate: '', leaveTime: '18:00', notes: '', detailsExpanded: true }) {
  state.cities.push(normalizeCityData(city));
  syncTravelDateTimes();
  renderCities();
}


function extractTimeFromDateTime(dateTime = '') {
  const text = String(dateTime || '');
  if (!text.includes('T')) return '';
  const [, timePart] = text.split('T');
  const match = String(timePart || '').match(/^(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function getPrimaryCity() {
  return state.cities[0] || null;
}

function syncLegacyTravelsFromCities() {
  const firstCity = getPrimaryCity();
  if (!firstCity?.travelEntry) {
    state.travels = [];
    return;
  }
  state.travels = [normalizeTravelEntry(firstCity.travelEntry)];
}

function ensureFirstCityTravelEntry() {
  const firstCity = getPrimaryCity();
  if (!firstCity) {
    state.travels = [];
    return null;
  }
  const existing = firstCity.travelEntry || state.travels[0] || {};
  const existingTime = extractTimeFromDateTime(existing.dateTime) || '09:00';
  const dateTime = firstCity.startDate ? `${firstCity.startDate}T${existingTime}` : '';
  firstCity.travelEntry = normalizeTravelEntry({ ...existing, id: existing.id || uid(), dateTime });
  syncLegacyTravelsFromCities();
  return firstCity.travelEntry;
}

function setTravelEntryTime(city, timeValue = '') {
  if (!city || state.cities[0]?.id !== city.id) return;
  const travelEntry = ensureFirstCityTravelEntry();
  if (!travelEntry) return;
  const safeTime = String(timeValue || '').match(/^\d{2}:\d{2}$/) ? String(timeValue) : '09:00';
  travelEntry.dateTime = city.startDate ? `${city.startDate}T${safeTime}` : '';
  syncLegacyTravelsFromCities();
}

function syncTravelDateTimes() {
  const firstCity = getPrimaryCity();
  if (!firstCity) {
    state.travels = [];
    return;
  }
  if (firstCity.travelEntry || state.travels[0]) {
    ensureFirstCityTravelEntry();
  }
}

function hydrateTravelIntoCities() {
  if (!state.cities.length) {
    state.travels = [];
    return;
  }
  if (!state.cities[0].travelEntry && state.travels[0]) {
    state.cities[0].travelEntry = normalizeTravelEntry(state.travels[0]);
  }
  syncTravelDateTimes();
}

function cityIsReadyForDetails(city) {
  return Boolean(String(city?.name || '').trim());
}

function daysBetween(startDate, endDate) {
  const start = parseYmdAsLocal(startDate);
  const end = parseYmdAsLocal(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function renderSetupInsights() {
  if (!els.setupInsights) return;
  const complete = state.cities.filter((c) => c.name && c.startDate && c.endDate);
  if (!complete.length) {
    els.setupInsights.innerHTML = 'Add city dates to see a quick trip health check.';
    return;
  }

  const sorted = [...complete].sort((a, b) => parseYmdAsLocal(a.startDate) - parseYmdAsLocal(b.startDate));
  const totalDays = sorted.reduce((sum, c) => sum + daysBetween(c.startDate, c.endDate), 0);
  let overlapCount = 0;
  let reverseDateCount = 0;

  sorted.forEach((city, idx) => {
    if (parseYmdAsLocal(city.endDate) < parseYmdAsLocal(city.startDate)) reverseDateCount += 1;
    if (!idx) return;
    const prev = sorted[idx - 1];
    if (parseYmdAsLocal(city.startDate) <= parseYmdAsLocal(prev.endDate)) overlapCount += 1;
  });

  const firstDate = sorted[0].startDate;
  const lastDate = sorted[sorted.length - 1].endDate;
  const issues = [];
  if (overlapCount) issues.push(`<span class="warn">${overlapCount} date overlap${overlapCount > 1 ? 's' : ''}</span>`);
  if (reverseDateCount) issues.push(`<span class="warn">${reverseDateCount} city with end date before start date</span>`);

  els.setupInsights.innerHTML = `
    <strong>${complete.length}</strong> cities •
    <strong>${totalDays}</strong> planned day${totalDays === 1 ? '' : 's'} •
    <strong>${esc(firstDate)}</strong> to <strong>${esc(lastDate)}</strong>
    ${issues.length ? `• ${issues.join(' • ')}` : '• Looks good to plan'}
  `;
}

function sortCitiesByDate() {
  const existingTravel = state.cities.find((c) => c?.travelEntry)?.travelEntry || state.travels[0] || null;
  const withDates = state.cities.filter((c) => c.startDate);
  const withoutDates = state.cities.filter((c) => !c.startDate);
  state.cities = [
    ...withDates.sort((a, b) => parseYmdAsLocal(a.startDate) - parseYmdAsLocal(b.startDate)),
    ...withoutDates
  ];
  state.cities.forEach((city) => { city.travelEntry = null; });
  if (state.cities[0] && existingTravel) state.cities[0].travelEntry = normalizeTravelEntry(existingTravel);
  syncTravelDateTimes();
  renderCities();
  showToast('Cities sorted by start date.', 'success');
}

function renderCities() {
  bindCityAutocompleteOutsideClick();
  els.citiesContainer.innerHTML = '';

  state.cities.forEach((city, index) => {
    const readyForDetails = cityIsReadyForDetails(city);
    const isFirstCity = index === 0;
    const travelEntry = isFirstCity ? ensureFirstCityTravelEntry() : null;
    city.logistics = normalizeCityLogistics(city);
    if (!city.accommodation) {
      city.accommodation = normalizeAccommodation({ checkIn: city.logistics.accommodation.checkIn, checkOut: city.logistics.accommodation.checkOut });
    }
    syncCityLegacyDates(city);
    const timelineError = validateCityTimeline(city);

    const row = document.createElement('div');
    row.className = 'city-row';
    row.dataset.cityId = city.id;
    row.innerHTML = `
      <div class="city-row-main">
        <button class="icon-btn grey city-row-toggle" type="button" data-toggle-details title="${city.detailsExpanded ? 'Collapse' : 'Expand'}" ${readyForDetails ? '' : 'disabled'}><i class="ph-bold ${city.detailsExpanded ? 'ph-caret-up' : 'ph-caret-down'}" aria-hidden="true"></i></button>
        <div class="city-autocomplete">
          <input type="text" placeholder="City" value="${esc(city.name)}" data-field="name" autocomplete="off" />
        </div>
        <input type="date" value="${esc(city.logistics.arrival.date)}" data-field="dateFrom" aria-label="Start date" title="Start date" />
        <input type="date" value="${esc(city.logistics.departure.date)}" data-field="dateTo" aria-label="End date" title="End date" />
        <button class="icon-btn red" type="button" data-remove-city title="Remove city"><i class="ph-bold ph-trash" aria-hidden="true"></i></button>
      </div>
      <div class="city-notes-row">
        <div class="textarea-expand-wrap">
          <textarea id="cityNotes-${city.id}" rows="2" class="profile-textarea-fixed city-notes-textarea" placeholder="Notes — any reminders, preferences, or details for this city…" data-field="notes">${esc(city.notes || '')}</textarea>
          <button class="textarea-expand-btn city-notes-expand-btn" type="button" data-expand="cityNotes-${city.id}" data-title="Notes — ${esc(city.name || 'City')}" aria-label="Expand notes"><i class="ph-bold ph-arrows-out-simple"></i></button>
        </div>
      </div>
      ${readyForDetails && city.detailsExpanded ? `
        <div class="city-drawer">
          <div class="city-dropdown-grid" role="group" aria-label="City stay details">
            <div class="city-dropdown-section">
              <label class="city-dropdown-label">Accommodation</label>
              <div class="city-dropdown-row accommodation-row">
                <div class="city-autocomplete">
                  <input type="text" placeholder="Accommodation address" value="${esc(city.accommodation?.address || '')}" data-accommodation-field="address" autocomplete="off" aria-label="Accommodation address" />
                </div>
                <input type="date" value="${esc(city.logistics.accommodation.checkIn)}" data-logistics="accommodationCheckIn" aria-label="Check-in date" />
                <input type="date" value="${esc(city.logistics.accommodation.checkOut)}" data-logistics="accommodationCheckOut" aria-label="Check-out date" />
              </div>
            </div>

            <div class="city-dropdown-section">
              <label class="city-dropdown-label">Arrival</label>
              <div class="city-dropdown-row arrival-row">
                <div class="city-autocomplete">
                  <input type="text" placeholder="Arrival location (e.g. airport)" value="${esc(city.logistics.arrival.location)}" data-logistics="arrivalLocation" autocomplete="off" aria-label="Arrival location" />
                </div>
                <input type="time" value="${esc(city.logistics.arrival.time || '')}" data-logistics="arrivalTime" aria-label="Arrival time" />
              </div>
            </div>

            <div class="city-dropdown-section">
              <label class="city-dropdown-label">Departure</label>
              <div class="city-dropdown-row departure-row">
                <div class="city-autocomplete">
                  <input type="text" placeholder="Departure location (e.g. train station)" value="${esc(city.logistics.departure.location)}" data-logistics="departureLocation" autocomplete="off" aria-label="Departure location" />
                </div>
                <input type="time" value="${esc(city.logistics.departure.time || '')}" data-logistics="departureTime" aria-label="Departure time" />
              </div>
            </div>

            <p class="city-dropdown-error ${timelineError ? '' : 'hidden'}" role="alert">${esc(timelineError || '')}</p>
          </div>
        </div>
      ` : ''}
    `;

    row.querySelectorAll('[data-field]').forEach((input) => {
      const eventType = (input.type === 'date' || input.type === 'time') ? 'change' : 'input';
      input.addEventListener(eventType, () => {
        const field = input.dataset.field;

        if (field === 'name') {
          city.name = input.value;
          city.placeId = '';
          city.latitude = null;
          city.longitude = null;
          renderSetupInsights();
          return;
        }

        if (field === 'notes') {
          city.notes = input.value;
          renderSetupInsights();
          return;
        }

        if (field === 'dateFrom') {
          city.logistics.arrival.date = input.value || '';
          city.logistics.accommodation.checkIn = input.value || '';
          if (city.accommodation) city.accommodation.checkIn = input.value || '';
          syncCityLegacyDates(city);
          syncTravelDateTimes();
          refreshCityTimelineUI(row, city);
          renderSetupInsights();
          return;
        }

        if (field === 'dateTo') {
          city.logistics.departure.date = input.value || '';
          city.logistics.accommodation.checkOut = input.value || '';
          if (city.accommodation) city.accommodation.checkOut = input.value || '';
          syncCityLegacyDates(city);
          syncTravelDateTimes();
          refreshCityTimelineUI(row, city);
          renderSetupInsights();
          return;
        }

        city[field] = input.value;
        renderSetupInsights();
      });
    });

    row.querySelector('[data-toggle-details]')?.addEventListener('click', () => {
      if (!readyForDetails) return;
      city.detailsExpanded = !city.detailsExpanded;
      renderCities();
    });

    const cityNameInput = row.querySelector('[data-field="name"]');
    if (cityNameInput && isGooglePlacesReady()) {
      attachPlaceAutocompleteElement(cityNameInput, {
        onResolved: ({ formattedAddress, placeId, lat, lng }) => {
          city.name = formattedAddress;
          city.placeId = placeId;
          city.latitude = lat;
          city.longitude = lng;
          cityNameInput.value = formattedAddress;
          clearLocationValidationError();
          renderSetupInsights();
        },
        onInput: () => {
          city.placeId = '';
          city.latitude = null;
          city.longitude = null;
        },
        onInvalid: () => {
          city.placeId = '';
          city.latitude = null;
          city.longitude = null;
          showLocationValidationError('City location is invalid. Please choose a Google Places suggestion.');
        }
      });
    }
    bindTextareaExpandButtons(row);

    const accommodationInput = row.querySelector('[data-accommodation-field="address"]');
    if (accommodationInput && isGooglePlacesReady()) {
      attachPlaceAutocompleteElement(accommodationInput, {
        locationBias: cityLocationBias(city),
        onResolved: ({ formattedAddress, placeId, lat, lng }) => {
          city.accommodation.address = formattedAddress;
          city.accommodation.placeId = placeId;
          city.accommodation.latitude = lat;
          city.accommodation.longitude = lng;
          accommodationInput.value = formattedAddress;
          clearLocationValidationError();
        },
        onInput: () => { city.accommodation.placeId = ''; city.accommodation.latitude = null; city.accommodation.longitude = null; },
        onInvalid: () => {
          city.accommodation.placeId = ''; city.accommodation.latitude = null; city.accommodation.longitude = null;
          showLocationValidationError('Accommodation address is invalid. Please choose a Google Places suggestion.');
        }
      });
    }

    const arrivalLocationInput = row.querySelector('[data-logistics="arrivalLocation"]');
    if (arrivalLocationInput && isGooglePlacesReady()) {
      attachPlaceAutocompleteElement(arrivalLocationInput, {
        locationBias: cityLocationBias(city),
        onResolved: ({ formattedAddress, placeId, lat, lng }) => {
          city.logistics.arrival.location = formattedAddress;
          city.logistics.arrival.placeId = placeId;
          city.logistics.arrival.latitude = lat;
          city.logistics.arrival.longitude = lng;
          arrivalLocationInput.value = formattedAddress;
          clearLocationValidationError();
        },
        onInput: () => {
          city.logistics.arrival.location = arrivalLocationInput.value;
          city.logistics.arrival.placeId = '';
          city.logistics.arrival.latitude = null;
          city.logistics.arrival.longitude = null;
        },
        onInvalid: () => {
          city.logistics.arrival.placeId = '';
          city.logistics.arrival.latitude = null;
          city.logistics.arrival.longitude = null;
          showLocationValidationError('Arrival location is invalid. Please choose a Google Places suggestion.');
        }
      });
    }

    const departureLocationInput = row.querySelector('[data-logistics="departureLocation"]');
    if (departureLocationInput && isGooglePlacesReady()) {
      attachPlaceAutocompleteElement(departureLocationInput, {
        locationBias: cityLocationBias(city),
        onResolved: ({ formattedAddress, placeId, lat, lng }) => {
          city.logistics.departure.location = formattedAddress;
          city.logistics.departure.placeId = placeId;
          city.logistics.departure.latitude = lat;
          city.logistics.departure.longitude = lng;
          departureLocationInput.value = formattedAddress;
          clearLocationValidationError();
        },
        onInput: () => {
          city.logistics.departure.location = departureLocationInput.value;
          city.logistics.departure.placeId = '';
          city.logistics.departure.latitude = null;
          city.logistics.departure.longitude = null;
        },
        onInvalid: () => {
          city.logistics.departure.placeId = '';
          city.logistics.departure.latitude = null;
          city.logistics.departure.longitude = null;
          showLocationValidationError('Departure location is invalid. Please choose a Google Places suggestion.');
        }
      });
    }

    row.querySelector('[data-remove-city]')?.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog('Remove city?', `Remove ${city.name} from your trip?`, 'Remove');
      if (!confirmed) return;
      if (cityAutocomplete.activeCityId === city.id) closeCityAutocomplete();
      state.cities = state.cities.filter((c) => c.id !== city.id);
      syncTravelDateTimes();
      renderCities();
    });

    row.querySelectorAll('[data-logistics]').forEach((input) => {
      const eventType = (input.type === 'date' || input.type === 'time') ? 'change' : 'input';
      input.addEventListener(eventType, () => {
        const field = input.dataset.logistics;

        // Don't re-render on text input for location fields — it destroys the autocomplete widget
        if (field === 'arrivalLocation' || field === 'departureLocation') return;

        if (field === 'accommodationCheckIn') {
          city.logistics.accommodation.checkIn = input.value || '';
          if (city.accommodation) city.accommodation.checkIn = input.value || '';
        }
        if (field === 'accommodationCheckOut') {
          city.logistics.accommodation.checkOut = input.value || '';
          if (city.accommodation) city.accommodation.checkOut = input.value || '';
        }
        if (field === 'arrivalTime') {
          city.logistics.arrival.time = parseTimeTo24(input.value || '');
        }
        if (field === 'departureTime') {
          city.logistics.departure.time = parseTimeTo24(input.value || '');
        }

        syncCityLegacyDates(city);
        syncTravelDateTimes();
        refreshCityTimelineUI(row, city);
        renderSetupInsights();
      });
    });

    els.citiesContainer.appendChild(row);
  });

  renderSetupInsights();
  initializePlacesWidgets();
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
  if (state.authUserId) return state.authUserId;
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, next);
  return next;
}

async function getAuthToken() {
  const clerk = window.Clerk;
  if (!clerk?.session) return '';
  try {
    return await clerk.session.getToken();
  } catch {
    return '';
  }
}

async function apiFetch(url, options = {}) {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const next = { ...options, headers };
  return fetch(url, next);
}


function renderPreferencesModal() {
  if (!els.profileQuestions) return;
  const store = state.profilesStore || loadProfiles();
  if (!store.profiles.length) return;
  const activeProfileRaw = getActiveProfile(store);
  const activeProfile = {
    ...activeProfileRaw,
    ...normalizeProfile(activeProfileRaw)
  };
  // Always sync UI state from the active profile so profile switching/loading
  // cannot leak values between profiles.
  state.profile = normalizeProfile(activeProfile);

  if (els.deleteProfileBtn) {
    els.deleteProfileBtn.disabled = false;
  }

  const titleEl = document.getElementById('prefsModalTitle');
  if (titleEl) titleEl.textContent = `${activeProfile.name || 'My Profile'}'s Traveler Profile`;

  const profile = state.profile;

  const dotsHtml = (active, key) => {
    const dots = Array.from({ length: 5 }, (_, i) => {
      const v = i + 1;
      return `<span class="dot-scale-dot${v === active ? ' active' : ''}" data-value="${v}" aria-label="${v}" role="button" tabindex="0"></span>`;
    }).join('');
    const label = key === 'pace' ? pacePrefLabel(active) : profileLabel(active);
    return `
      <div class="dot-scale-wrap">
        <div class="dot-scale" data-rating>${dots}</div>
        <span class="dot-scale-label">${esc(label)}</span>
      </div>
    `;
  };

  els.profileQuestions.innerHTML = PROFILE_QUESTIONS.map((q) => {
    if (q.type === 'text') {
      const val = profile.answers[q.key] || '';
      const inputId = `profileQ_${q.key}`;
      return `
        <div class="profile-question profile-question--text" data-question="${esc(q.key)}">
          <p>${esc(q.label)}</p>
          <div class="textarea-expand-wrap">
            <textarea id="${inputId}" class="profile-text-answer profile-textarea-fixed" rows="5" placeholder="${esc(q.placeholder || '')}">${esc(val)}</textarea>
            <button class="textarea-expand-btn" type="button" data-expand="${inputId}" data-title="${esc(q.label)}" aria-label="Expand ${esc(q.label)}"><i class="ph-bold ph-arrows-out-simple"></i></button>
          </div>
        </div>
      `;
    }
    const active = Math.max(PROFILE_MIN, Math.min(PROFILE_MAX, Number(profile.answers[q.key] || PROFILE_DEFAULT)));
    return `
      <div class="profile-question" data-question="${esc(q.key)}">
        <p>${esc(q.label)}</p>
        ${dotsHtml(active, q.key)}
      </div>
    `;
  }).join('');

  bindTextareaExpandButtons(els.profileQuestions);

  els.profileTravelNotes.value = profile.aboutMe || '';
  els.profileTravelNotes.disabled = false;
  els.profileEditBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i>';

  if (els.aiSummarySection && els.profileAiSummary) {
    const instruction = state.learnedPrefs?.profileInstruction || '';
    if (instruction) {
      els.profileAiSummary.value = instruction;
      els.aiSummarySection.classList.remove('hidden');
    } else {
      els.aiSummarySection.classList.add('hidden');
    }
  }

  if (els.learnedPrefsSection && els.learnedPrefsTags) {
    const lp = state.learnedPrefs;
    const constraints = lp?.constraints || [];
    const preferences = lp?.preferences || [];
    const all = [
      ...constraints.map((c) => ({ text: c.text, kind: 'constraint' })),
      ...preferences.map((p) => ({ text: p.text, kind: 'preference' }))
    ];
    if (all.length) {
      els.learnedPrefsTags.innerHTML = all.map((item) =>
        `<span class="learned-pref-tag" data-kind="${item.kind}" data-text="${esc(item.text)}">${esc(item.text)}<button class="learned-pref-remove" aria-label="Remove"><i class="ph-bold ph-x"></i></button></span>`
      ).join('');
      els.learnedPrefsSection.classList.remove('hidden');
    } else {
      els.learnedPrefsSection.classList.add('hidden');
    }
  }

  els.profileQuestions.querySelectorAll('[data-rating]').forEach((scaleEl) => {
    scaleEl.addEventListener('click', (e) => {
      const dot = e.target.closest('.dot-scale-dot');
      if (!dot) return;
      const key = scaleEl.closest('.profile-question')?.dataset.question;
      if (!key) return;

      const nextAnswer = Math.max(PROFILE_MIN, Math.min(PROFILE_MAX, Number(dot.dataset.value)));
      state.profile = normalizeProfile({
        ...(state.profile || defaultProfile()),
        answers: { ...(state.profile?.answers || {}), [key]: nextAnswer }
      });

      scaleEl.querySelectorAll('.dot-scale-dot').forEach((d) => d.classList.toggle('active', Number(d.dataset.value) === nextAnswer));
      const labelEl = scaleEl.nextElementSibling;
      if (labelEl) labelEl.textContent = key === 'pace' ? pacePrefLabel(nextAnswer) : profileLabel(nextAnswer);
    });

    scaleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') e.target.click();
    });
  });

  els.profileQuestions.querySelectorAll('.profile-text-answer').forEach((textarea) => {
    const key = textarea.closest('.profile-question')?.dataset.question;
    if (!key) return;
    textarea.addEventListener('input', () => {
      state.profile = normalizeProfile({
        ...(state.profile || defaultProfile()),
        answers: { ...(state.profile?.answers || {}), [key]: textarea.value }
      });
    });
  });
}

function getProfilePayload() {
  const aboutMeValue = els.profileTravelNotes ? els.profileTravelNotes.value : (state.profile?.aboutMe ?? '');
  return normalizeProfile({
    ...(state.profile || defaultProfile()),
    aboutMe: aboutMeValue
  });
}

function switchActiveProfile(profileId) {
  const store = state.profilesStore || loadProfiles();
  if (!store.profiles.some((p) => p.id === profileId)) return;
  state.profilesStore = saveProfiles({ ...store, activeId: profileId });
  state.profile = normalizeProfile(getActiveProfile(state.profilesStore));
  renderPreferencesModal();
}

function createNewProfile() {
  const store = state.profilesStore || loadProfiles();
  if (store.profiles.length >= 3) {
    showToast('You can create up to 3 profiles.', 'info');
    return;
  }
  openProfileWizard(store);
}

function openProfileWizard(store, { forced = false } = {}) {
  const suggestedName = 'My Profile';
  const totalSteps = PROFILE_QUESTIONS.length + 2; // +1 for name step, +1 for aboutMe step

  const wizardState = {
    stepIndex: 0,
    name: suggestedName,
    answers: Object.fromEntries(PROFILE_QUESTIONS.map((q) => [q.key, q.type === 'text' ? '' : PROFILE_DEFAULT])),
    aboutMe: ''
  };

  const overlay = document.getElementById('profileWizardOverlay');
  overlay.classList.remove('hidden');
  document.body.classList.add('profile-wizard-active');

  const cancelBtn = overlay.querySelector('#wizardCancelBtn');
  if (cancelBtn) cancelBtn.classList.toggle('hidden', forced);

  const aboutMeStepIndex = totalSteps - 1;

  function currentStepAnswer() {
    const input = overlay.querySelector('.wizard-input');
    if (!input) return;
    if (wizardState.stepIndex === 0) {
      wizardState.name = input.value.trim() || suggestedName;
    } else if (wizardState.stepIndex === aboutMeStepIndex) {
      wizardState.aboutMe = input.value;
    } else {
      const q = PROFILE_QUESTIONS[wizardState.stepIndex - 1];
      if (q.type === 'text') {
        wizardState.answers[q.key] = input.value;
      }
    }
  }

  function render() {
    const { stepIndex } = wizardState;
    const pct = Math.max(4, Math.round((stepIndex / (totalSteps - 1)) * 100));

    overlay.querySelector('.profile-wizard-progress-bar').style.width = `${pct}%`;
    overlay.querySelector('.wizard-step-counter').textContent = `${stepIndex + 1} of ${totalSteps}`;

    const backBtn = overlay.querySelector('#wizardBackBtn');
    const nextBtn = overlay.querySelector('#wizardNextBtn');
    backBtn.classList.toggle('hidden', stepIndex === 0);
    nextBtn.textContent = stepIndex === totalSteps - 1 ? 'Finish' : 'Next';

    let bodyHtml;
    if (stepIndex === 0) {
      bodyHtml = `
        <p class="wizard-question-label">What would you like to name this profile?</p>
        <input class="wizard-input wizard-text-input" type="text" maxlength="32"
          value="${esc(wizardState.name)}" placeholder="${esc(suggestedName)}" autocomplete="off" />
      `;
    } else if (stepIndex === aboutMeStepIndex) {
      bodyHtml = `
        <p class="wizard-question-label">Anything else we might have missed?</p>
        <textarea class="wizard-input wizard-text-input wizard-textarea" rows="4"
          placeholder="e.g. I'm not a morning person, I have a smaller budget, avoid things with lots of walking...">${esc(wizardState.aboutMe)}</textarea>
      `;
    } else {
      const q = PROFILE_QUESTIONS[stepIndex - 1];
      if (q.type === 'text') {
        bodyHtml = `
          <p class="wizard-question-label">${esc(q.label)}</p>
          <textarea class="wizard-input wizard-text-input wizard-textarea" rows="3"
            placeholder="${esc(q.placeholder || '')}">${esc(wizardState.answers[q.key] || '')}</textarea>
        `;
      } else {
        const active = Number(wizardState.answers[q.key]) || PROFILE_DEFAULT;
        const dots = Array.from({ length: 5 }, (_, i) => {
          const v = i + 1;
          return `<span class="dot-scale-dot${v === active ? ' active' : ''}" data-value="${v}" role="button" tabindex="0" aria-label="${v}"></span>`;
        }).join('');
        const labelText = q.key === 'pace' ? pacePrefLabel(active) : profileLabel(active);
        bodyHtml = `
          <p class="wizard-question-label">${esc(q.label)}</p>
          <div class="wizard-dot-scale-wrap">
            <div class="dot-scale wizard-dot-scale" data-rating>${dots}</div>
            <span class="dot-scale-label wizard-scale-label">${esc(labelText)}</span>
          </div>
        `;
      }
    }

    overlay.querySelector('#wizardCardBody').innerHTML = bodyHtml;

    if (stepIndex > 0 && stepIndex < aboutMeStepIndex) {
      const q = PROFILE_QUESTIONS[stepIndex - 1];
      if (!q.type) {
        overlay.querySelector('[data-rating]').addEventListener('click', (e) => {
          const dot = e.target.closest('.dot-scale-dot');
          if (!dot) return;
          const v = Number(dot.dataset.value);
          wizardState.answers[q.key] = v;
          overlay.querySelectorAll('.dot-scale-dot').forEach((d) => d.classList.toggle('active', Number(d.dataset.value) === v));
          const labelEl = overlay.querySelector('.wizard-scale-label');
          if (labelEl) labelEl.textContent = q.key === 'pace' ? pacePrefLabel(v) : profileLabel(v);
        });
      }
    }

    const input = overlay.querySelector('.wizard-input');
    if (input) input.focus();
  }

  overlay.querySelector('#wizardBackBtn').onclick = () => {
    currentStepAnswer();
    wizardState.stepIndex = Math.max(0, wizardState.stepIndex - 1);
    render();
  };

  overlay.querySelector('#wizardNextBtn').onclick = () => {
    currentStepAnswer();
    if (wizardState.stepIndex < totalSteps - 1) {
      wizardState.stepIndex++;
      render();
    } else {
      finishWizard();
    }
  };

  overlay.querySelector('#wizardCancelBtn').onclick = () => { if (!forced) closeWizard(); };
  overlay.addEventListener('keydown', onWizardKey);

  function onWizardKey(e) {
    if (e.key === 'Escape' && !forced) closeWizard();
  }

  function closeWizard() {
    overlay.classList.add('hidden');
    document.body.classList.remove('profile-wizard-active');
    overlay.removeEventListener('keydown', onWizardKey);
  }

  function finishWizard() {
    closeWizard();
    const id = createProfileId();
    const profile = {
      id,
      name: normalizeProfileName(wizardState.name, suggestedName),
      answers: { ...wizardState.answers },
      aboutMe: wizardState.aboutMe || ''
    };
    const nextStore = { activeId: id, profiles: [...store.profiles, profile] };
    state.profilesStore = saveProfiles(nextStore);
    state.profile = normalizeProfile(profile);
    openPreferencesModal();
    showToast('Profile created — generating summary…', 'info');
    apiFetch('/api/profile/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizeProfile(profile))
    }).then((r) => r.json()).then((data) => {
      const instruction = String(data?.instruction ?? data?.profileInstruction ?? '').trim();
      if (instruction) {
        state.learnedPrefs = { ...(state.learnedPrefs || {}), profileInstruction: instruction };
        renderPreferencesModal();
        showToast('AI summary ready!', 'success');
      }
    }).catch(() => {});
  }

  render();
}

async function deleteActiveProfile() {
  const store = state.profilesStore || loadProfiles();
  const confirmed = await showConfirmDialog('Delete profile?', 'This will permanently delete your profile and its preferences.', 'Delete');
  if (!confirmed) return;
  const nextStore = { activeId: null, profiles: [] };
  state.profilesStore = saveProfiles(nextStore);
  state.profile = null;
  state.learnedPrefs = null;
  apiFetch('/api/preferences/reset', { method: 'POST' }).catch(() => {});
  closePreferencesModal();
  showToast('Profile deleted.', 'success');
  openProfileWizard(nextStore, { forced: true });
}

async function openPreferencesModal() {
  state.profilesStore = loadProfiles();
  if (!state.profilesStore.profiles.length) {
    openProfileWizard(state.profilesStore, { forced: true });
    return;
  }
  state.profile = normalizeProfile(getActiveProfile(state.profilesStore));
  profileSnapshot = JSON.stringify(state.profile);
  apiFetch('/api/preferences').then((r) => r.ok ? r.json() : null).then((data) => {
    if (data?.preferences) {
      const incoming = data.preferences;
      // Preserve in-memory profileInstruction if server returns empty (race/stale write)
      state.learnedPrefs = {
        ...incoming,
        profileInstruction: incoming.profileInstruction || state.learnedPrefs?.profileInstruction || ''
      };
      renderPreferencesModal();
    }
  }).catch(() => {});

  renderPreferencesModal();
  els.prefsModal.classList.remove('hidden');
  refreshOverlayInterlocks();
}

function closePreferencesModal() {
  renderPreferencesModal();
  els.prefsModal.classList.add('hidden');
  refreshOverlayInterlocks();
}

function openChecklistModal() {
  buildChecklistFromState();
  document.getElementById('checklistModal').classList.remove('hidden');
  renderChecklistModal();
  refreshOverlayInterlocks();
}

function closeChecklistModal() {
  if (checklistSearchRenderTimer) {
    clearTimeout(checklistSearchRenderTimer);
    checklistSearchRenderTimer = null;
  }
  document.getElementById('checklistModal').classList.add('hidden');
  refreshOverlayInterlocks();
}

async function fetchStatus() {
  const res = await apiFetch('/api/status');
  const data = await res.json();
  state.keys = data.keys || state.keys;
  const googleMapsApiKey = String(data?.googleMapsApiKey || '').trim();
  const msgs = [];
  if (!state.keys.anthropicConfigured) msgs.push('Anthropic API key not configured: planning disabled.');
  if (!googleMapsApiKey) msgs.push('Google Maps API key not configured: location autocomplete unavailable.');
  if (msgs.length) {
    els.apiBanner.textContent = msgs.join(' ');
    els.apiBanner.classList.remove('hidden');
  } else {
    els.apiBanner.classList.add('hidden');
  }

  if (googleMapsApiKey) {
    try {
      await loadGoogleMapsPlacesSDK(googleMapsApiKey);
      initializePlacesWidgets();
    } catch (err) {
      showToast(err?.message || 'Google Places failed to load.', 'error');
    }
  }
}

async function fetchArrangeConfig() {
  try {
    const res = await apiFetch('/api/arrange-config');
    const data = await res.json();
    if (!res.ok) throw new Error('Failed to fetch arrange config');
    state.arrangeConfig = data?.categoryDefaults || DEFAULT_ARRANGE_CATEGORY_CONFIG;
  } catch {
    state.arrangeConfig = DEFAULT_ARRANGE_CATEGORY_CONFIG;
  }
}

function getActivityStyle(type = '') {
  const normalized = String(type || '').toLowerCase().trim();
  const ph = (name) => `<i class="ph-bold ${name}" aria-hidden="true"></i>`;
  const map = {
    food:         { icon: ph('ph-fork-knife'),          colorClass: 'activity-food' },
    breakfast:    { icon: ph('ph-coffee'),              colorClass: 'activity-food' },
    lunch:        { icon: ph('ph-fork-knife'),          colorClass: 'activity-food' },
    dinner:       { icon: ph('ph-wine'),                colorClass: 'activity-food' },
    show:         { icon: ph('ph-ticket'),              colorClass: 'activity-show' },
    tour:         { icon: ph('ph-compass'),             colorClass: 'activity-tour' },
    cultural:     { icon: ph('ph-palette'),             colorClass: 'activity-cultural' },
    walk:         { icon: ph('ph-person-simple-walk'),  colorClass: 'activity-walk' },
    neighborhood: { icon: ph('ph-map-trifold'),         colorClass: 'activity-neighborhood' },
    sports:       { icon: ph('ph-soccer-ball'),         colorClass: 'activity-sports' },
    sunset:       { icon: ph('ph-sun-horizon'),         colorClass: 'activity-sunset' },
    museum:       { icon: ph('ph-columns'),             colorClass: 'activity-cultural' },
    gallery:      { icon: ph('ph-paint-brush'),         colorClass: 'activity-show' },
    landmark:     { icon: ph('ph-buildings'),           colorClass: 'activity-tour' },
    park:         { icon: ph('ph-tree'),                colorClass: 'activity-walk' },
    market:       { icon: ph('ph-storefront'),          colorClass: 'activity-default' },
    nightlife:    { icon: ph('ph-martini'),             colorClass: 'activity-show' },
    shopping:     { icon: ph('ph-bag'),                 colorClass: 'activity-default' },
    spa:          { icon: ph('ph-sparkle'),             colorClass: 'activity-default' },
  };
  return map[normalized] || { icon: ph('ph-map-pin'), colorClass: 'activity-default' };
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

function populateReviewCityFilter() {
  if (!els.reviewCityFilter) return;
  const current = state.reviewFilters.city;
  const cities = [...new Set(state.activities.map((a) => String(a.city || '').trim()).filter(Boolean))].sort();
  els.reviewCityFilter.innerHTML = ['<option value="">All cities</option>', ...cities.map((city) => `<option value="${esc(city)}">${esc(city)}</option>`)].join('');
  els.reviewCityFilter.value = current;
}

function getFilteredReviewActivities() {
  const search = String(state.reviewFilters.search || '').trim().toLowerCase();
  const city = String(state.reviewFilters.city || '').trim().toLowerCase();
  const verdict = String(state.reviewFilters.verdict || '').trim();

  return state.activities.filter((a) => {
    const review = state.reviewed[a.id] || { approved: null };
    const text = [a.name, a.city, a.type, a.why_it_fits, a.pitfall, a.booking_advice].join(' ').toLowerCase();

    if (search && !text.includes(search)) return false;
    if (city && String(a.city || '').trim().toLowerCase() !== city) return false;
    if (verdict === 'approved' && review.approved !== true) return false;
    if (verdict === 'declined' && review.approved !== false) return false;
    if (verdict === 'unreviewed' && review.approved !== null) return false;
    return true;
  });
}

function applyVerdictToVisibleActivities(verdict = null) {
  const visible = getFilteredReviewActivities();
  if (!visible.length) {
    showToast('No visible activities to update.', 'info');
    return;
  }

  visible.forEach((activity) => {
    const existing = state.reviewed[activity.id] || { approved: null, notes: '' };
    state.reviewed[activity.id] = {
      ...existing,
      approved: verdict,
      notes: verdict === false ? '' : existing.notes
    };
  });

  showToast(`Updated ${visible.length} visible activities.`, 'success');
  renderActivities();
}

let reviewImageEnrichInFlight = false;

function enrichImages(items = []) {
  const itemsToFetch = (items || []).filter((item) => item && !item.imageUrl && item.name);
  if (!itemsToFetch.length) return Promise.resolve();

  return Promise.all(itemsToFetch.map(async (item) => {
    try {
      const params = new URLSearchParams({ q: item.name, city: item.city || '', type: item.type || '' });
      const res = await apiFetch(`/api/image?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.imageUrl) item.imageUrl = data.imageUrl;
    } catch {}
  }));
}

function enrichPlaces(items = []) {
  const toFetch = (items || []).filter((a) => a && a.name && a.price_level == null && !a.place_id);
  if (!toFetch.length) return Promise.resolve();
  return Promise.all(toFetch.map(async (a) => {
    try { await geocodeActivity(a); } catch {}
  }));
}

function computeApprovedCost(activities) {
  const adults = state.numTravelers || 1;
  const children = state.numChildren || 0;
  return (activities || state.activities.filter((a) => state.reviewed[a.id]?.approved === true))
    .reduce((sum, a) => {
      const cost = actCostUsd(a);
      if (cost === null || cost === undefined) return sum;
      if (actCostType(a) === 'per_group') return sum + cost;
      return sum + (cost * adults) + (cost * 0.6 * children);
    }, 0);
}

function computeBudgetLensBreakdown() {
  const checklist = buildChecklistFromState();
  let itineraryActivityTotal = 0;
  let itineraryTransportTotal = 0;
  let entryExitTransportTotal = 0;
  let accommodationTotal = 0;

  (checklist || []).forEach((item) => {
    const cost = Number(item?.budgetUsd);
    if (!Number.isFinite(cost) || cost < 0) return;

    if (item.type === 'accommodation') {
      accommodationTotal += cost;
      return;
    }

    if (item.type === 'transportation') {
      if (item.transportScope === 'entry_exit') entryExitTransportTotal += cost;
      else itineraryTransportTotal += cost;
      return;
    }

    itineraryActivityTotal += cost;
  });

  const budgetLensTotal = itineraryActivityTotal + itineraryTransportTotal;
  const absoluteTripTotal = budgetLensTotal + entryExitTransportTotal + accommodationTotal;

  return {
    budgetLensTotal,
    absoluteTripTotal,
    itineraryActivityTotal,
    itineraryTransportTotal,
    entryExitTransportTotal,
    accommodationTotal
  };
}

function renderBudgetTracker() {
  const existing = document.getElementById('budgetTracker');
  if (!state.tripBudget) { if (existing) existing.remove(); return; }

  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved === true);
  const used = computeBudgetLensBreakdown().budgetLensTotal;
  const remaining = state.tripBudget - used;
  const pct = Math.min(used / state.tripBudget, 1);
  const nullCount = approved.filter((a) => actCostUsd(a) === null || actCostUsd(a) === undefined).length;
  const colorClass = pct < 0.6 ? 'budget-green' : pct < 0.9 ? 'budget-yellow' : 'budget-red';

  const html = `<div id="budgetTracker" class="budget-tracker ${colorClass}">
    <div class="budget-tracker-top">
      <div class="budget-tracker-left">
        <span class="budget-label">Budget Tracker</span>
        <button class="budget-info-btn" type="button" aria-label="Budget info" data-tooltip="Tracks total cost of planned activities"><i class="ph-bold ph-info" aria-hidden="true"></i></button>
      </div>
      <div class="budget-tracker-right">
        ${nullCount > 0 ? `<span class="budget-caveat">${nullCount} activit${nullCount === 1 ? 'y' : 'ies'} unpriced</span>` : ''}
        <span class="budget-remaining-amt">$${Math.round(used).toLocaleString()} / $${state.tripBudget.toLocaleString()}</span>
        ${approved.length > 0 ? `<button class="secondary budget-optimize-btn" type="button" id="budgetOptimizeBtn"><i class="ph-bold ph-lightning" aria-hidden="true"></i> Optimize</button>` : ''}
      </div>
    </div>
    <div class="budget-bar-track">
      <div class="budget-bar-fill" style="width:${Math.min(pct,1)*100}%"></div>
    </div>
  </div>`;

  if (existing) { existing.outerHTML = html; } else {
    const grid = els.activitiesGrid;
    if (grid?.parentNode) grid.parentNode.insertAdjacentHTML('beforebegin', html);
  }
  document.getElementById('budgetOptimizeBtn')?.addEventListener('click', enterBudgetOptMode);
}

function exitBudgetOptMode() {
  budgetOptState = null;
  const overlay = document.getElementById('budgetOptOverlay');
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
  document.getElementById('budgetOptFooter')?.remove();
  document.body.classList.remove('budget-opt-active');
}

function mountBudgetOptOverlay() {
  document.getElementById('budgetOptOverlay').innerHTML = `
    <div class="budget-opt-shell">
      <div class="budget-opt-header">
        <h3>Budget Optimization</h3>
        <p class="budget-opt-desc">Unlock the activities you want replaced with cheaper alternatives. Locked activities stay as-is.</p>
      </div>
      <div id="budgetOptGrid" class="budget-opt-grid cards-grid"></div>
    </div>`;

  const footer = document.createElement('div');
  footer.id = 'budgetOptFooter';
  footer.className = 'budget-opt-footer';
  footer.innerHTML = `
    <button class="secondary" id="budgetOptCancelBtn" type="button">← Back</button>
    <div class="budget-opt-progress-wrap hidden">
      <div class="budget-opt-progress-bar" id="budgetOptProgressBar"></div>
    </div>
    <span id="budgetOptProgressLabel" class="budget-opt-progress-label hidden"></span>
    <button class="primary" id="budgetOptConfirmLocksBtn" type="button"><i class="ph-bold ph-check" aria-hidden="true"></i> Confirm</button>`;
  document.body.appendChild(footer);

  document.getElementById('budgetOptCancelBtn').addEventListener('click', exitBudgetOptMode);
  document.getElementById('budgetOptConfirmLocksBtn').addEventListener('click', onConfirmLocks);
}

function enterBudgetOptMode() {
  const allApproved = state.activities.filter((a) => state.reviewed[a.id]?.approved === true);
  // Exclude free activities — no cost to optimize
  const approved = allApproved.filter((a) => actCostUsd(a) != null && actCostUsd(a) > 0);
  if (!approved.length) return;
  // Default all to locked — user unlocks what they want changed
  budgetOptState = { lockedIds: new Set(approved.map((a) => a.id)), refinements: new Map(), choiceIsRefined: new Map(), inFlight: false };
  mountBudgetOptOverlay();
  renderBudgetOptCards(approved, 'lock');
  document.getElementById('budgetOptOverlay').classList.remove('hidden');
  document.body.classList.add('budget-opt-active');
}

function buildBudgetOptCard(a, mode, approved) {
  const isLocked = budgetOptState.lockedIds.has(a.id);
  const hasRefinement = budgetOptState.refinements.has(a.id);
  const refined = hasRefinement ? budgetOptState.refinements.get(a.id) : null;
  const showingRefined = budgetOptState.choiceIsRefined.get(a.id) ?? true;

  const cardEl = document.createElement('article');
  cardEl.className = `card activity-card opt-card${isLocked ? ' opt-card--locked' : ''}`;
  cardEl.dataset.activityId = a.id;

  const faceHtml = (act, label) => {
    return `
    <div class="opt-card-img-wrap">
      <img src="${esc(act.imageUrl || '')}" alt="${esc(act.name)}" loading="lazy" style="width:100%;height:160px;object-fit:cover;border-radius:12px 12px 0 0;" />
    </div>
    <div class="card-content">
      ${label ? `<span class="opt-card--refined-label">${label}</span>` : ''}
      <div class="activity-card-head-actions" style="margin-bottom:8px;">
        <div>
          ${act.type ? `<span class="badge">${esc(act.type)}</span>` : ''}
          ${headerPriceBadgeHtml(act)}
        </div>
      </div>
      <h3>${esc(act.name)}</h3>
      <p><strong>City:</strong> ${esc(act.city || '')}</p>
      <p><strong>Why it fits:</strong> ${esc(act.why_it_fits || '')}</p>
    </div>`;
  };

  if (mode === 'lock') {
    const lockIcon = isLocked ? 'ph-lock-key' : 'ph-lock-open';
    cardEl.innerHTML = `
      <button class="opt-lock-btn" type="button" aria-label="${isLocked ? 'Unlock' : 'Lock'} activity">
        <i class="ph-bold ${lockIcon}" aria-hidden="true"></i>
      </button>
      ${faceHtml(a, null)}`;
    cardEl.querySelector('.opt-lock-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (budgetOptState.lockedIds.has(a.id)) {
        budgetOptState.lockedIds.delete(a.id);
        cardEl.classList.remove('opt-card--locked');
        cardEl.querySelector('.opt-lock-btn').innerHTML = '<i class="ph-bold ph-lock-open" aria-hidden="true"></i>';
      } else {
        budgetOptState.lockedIds.add(a.id);
        cardEl.classList.add('opt-card--locked');
        cardEl.querySelector('.opt-lock-btn').innerHTML = '<i class="ph-bold ph-lock-key" aria-hidden="true"></i>';
      }
    });
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openOptCardExpand(a, null);
    });
    return cardEl;
  }

  // flip mode — only unlocked activities with refinements reach here
  cardEl.classList.add('opt-card--flip');
  if (!showingRefined) cardEl.classList.add('is-showing-original');
  cardEl.innerHTML = `
    <button class="opt-flip-btn" type="button" aria-label="Flip card"><i class="ph-bold ph-arrows-clockwise" aria-hidden="true"></i></button>
    <div class="opt-card-inner">
      <div class="opt-card-face opt-card-front">${faceHtml(refined, 'Refined')}</div>
      <div class="opt-card-face opt-card-back">${faceHtml(a, 'Original')}</div>
    </div>`;
  cardEl.querySelector('.opt-flip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const nowRefined = budgetOptState.choiceIsRefined.get(a.id) ?? true;
    budgetOptState.choiceIsRefined.set(a.id, !nowRefined);
    cardEl.classList.toggle('is-showing-original', nowRefined);
    updateBudgetOptProgressBar(approved);
  });
  cardEl.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const nowRefined = budgetOptState.choiceIsRefined.get(a.id) ?? true;
    openOptCardExpand(nowRefined ? refined : a, nowRefined ? 'Refined' : 'Original');
  });
  return cardEl;
}

function openOptCardExpand(act, label) {
  document.querySelector('.opt-card-expand-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'card-expand-overlay opt-card-expand-overlay';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'card-expand-close icon-btn red';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<i class="ph-bold ph-x" aria-hidden="true"></i>';

  const body = document.createElement('div');
  body.className = 'card-expand-body';
  body.innerHTML = `
    <img src="${esc(act.imageUrl || '')}" alt="${esc(act.name)}" style="width:100%;height:220px;object-fit:cover;" />
    <div class="card-content">
      ${label ? `<span class="opt-card--refined-label">${label}</span>` : ''}
      <div class="activity-card-head-actions" style="margin-bottom:8px;">
        <div>
          ${act.type ? `<span class="badge">${esc(act.type)}</span>` : ''}
          ${headerPriceBadgeHtml(act)}
        </div>
      </div>
      <h3>${esc(act.name)}</h3>
      <p><strong>City:</strong> ${esc(act.city || '')}</p>
      <p><strong>Why it fits:</strong> ${esc(act.why_it_fits || '')}</p>
      ${act.pitfall ? `<p><strong>Pitfall:</strong> ${esc(act.pitfall)}</p>` : ''}
      ${act.booking_advice ? `<p><strong>Booking advice:</strong> ${esc(act.booking_advice)}</p>` : ''}
    </div>`;

  overlay.appendChild(closeBtn);
  overlay.appendChild(body);
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.add('closing');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
  }
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

function renderBudgetOptCards(activities, mode) {
  const grid = document.getElementById('budgetOptGrid');
  grid.innerHTML = '';
  activities.forEach((a) => grid.appendChild(buildBudgetOptCard(a, mode, activities)));
}

async function onConfirmLocks() {
  if (budgetOptState.inFlight) return;
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved === true && actCostUsd(a) != null && actCostUsd(a) > 0);
  const unlocked = approved.filter((a) => !budgetOptState.lockedIds.has(a.id));
  if (!unlocked.length) {
    alert('All activities are locked — nothing to optimize.');
    return;
  }
  const locked = approved.filter((a) => budgetOptState.lockedIds.has(a.id));
  const lockedCost = computeApprovedCost(locked);
  const totalBudget = state.tripBudget || computeApprovedCost(approved) * 0.8;
  const perActivityTarget = Math.max(0, Math.round((totalBudget - lockedCost) / unlocked.length));

  const btn = document.getElementById('budgetOptConfirmLocksBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner"></i> Optimizing…';
  budgetOptState.inFlight = true;

  const results = await Promise.allSettled(
    unlocked.map((a) =>
      apiFetch('/api/activity/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: a,
          note: 'find a cheaper alternative within the same activity type and city',
          budget_target: perActivityTarget,
          userId: ensureUserId()
        })
      })
        .then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(e)))
        .then(({ updates }) => ({ id: a.id, refined: { ...a, ...updates, id: a.id } }))
    )
  );

  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      budgetOptState.refinements.set(r.value.id, r.value.refined);
      budgetOptState.choiceIsRefined.set(r.value.id, true);
    }
  });

  budgetOptState.inFlight = false;
  transitionToFlipPhase(approved);
}

function transitionToFlipPhase(approved) {
  const confirmBtn = document.getElementById('budgetOptConfirmLocksBtn');
  if (confirmBtn) {
    confirmBtn.id = 'budgetOptConfirmSelectionsBtn';
    confirmBtn.innerHTML = '<i class="ph-bold ph-check-circle" aria-hidden="true"></i> Confirm Selections';
    confirmBtn.addEventListener('click', onConfirmSelections);
  }
  document.querySelector('#budgetOptFooter .budget-opt-progress-wrap')?.classList.remove('hidden');
  document.getElementById('budgetOptProgressLabel')?.classList.remove('hidden');
  const unlocked = approved.filter((a) => !budgetOptState.lockedIds.has(a.id) && budgetOptState.refinements.has(a.id));
  renderBudgetOptCards(unlocked, 'flip');
  updateBudgetOptProgressBar(approved);
}

function updateBudgetOptProgressBar(approved) {
  const totalCost = computeApprovedCost(approved);
  let selectedCost = 0;
  approved.forEach((a) => {
    const refined = budgetOptState.refinements.get(a.id);
    const showingRefined = budgetOptState.choiceIsRefined.get(a.id) ?? !!refined;
    const act = (showingRefined && refined) ? refined : a;
    const cost = actCostUsd(act);
    if (cost == null) return;
    const adults = state.numTravelers || 1;
    const children = state.numChildren || 0;
    selectedCost += actCostType(act) === 'per_group' ? cost : cost * adults + Math.round(cost * 0.6 * children);
  });

  const pct = totalCost > 0 ? Math.min(selectedCost / totalCost, 1.2) * 100 : 0;
  const bar = document.getElementById('budgetOptProgressBar');
  bar.style.width = `${Math.min(pct, 100)}%`;
  bar.className = 'budget-opt-progress-bar' + (pct > 100 ? ' bar-red' : pct > 80 ? ' bar-yellow' : '');
  document.getElementById('budgetOptProgressLabel').textContent =
    `$${Math.round(selectedCost).toLocaleString()} / $${Math.round(totalCost).toLocaleString()}`;
}

function onConfirmSelections() {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved === true && actCostUsd(a) != null && actCostUsd(a) > 0);
  approved.forEach((a) => {
    if (budgetOptState.choiceIsRefined.get(a.id) && budgetOptState.refinements.has(a.id)) {
      const idx = state.activities.findIndex((x) => x.id === a.id);
      if (idx !== -1) state.activities[idx] = budgetOptState.refinements.get(a.id);
    }
  });
  exitBudgetOptMode();
  renderActivities();
}

function replaceActivityInState(oldId, newActivity) {
  const idx = state.activities.findIndex((x) => x.id === oldId);
  if (idx !== -1) state.activities.splice(idx, 1, newActivity);
  delete state.reviewed[oldId];
  state.reviewed[newActivity.id] = { approved: null, notes: '' };
  geocodeActivity(newActivity).catch(() => {});
  renderActivities();
}

function updateActivityInState(id, updates) {
  const idx = state.activities.findIndex((x) => x.id === id);
  if (idx === -1) return;
  const updated = { ...state.activities[idx], ...updates, id };
  state.activities[idx] = updated;
  geocodeActivity(updated).catch(() => {});
  renderActivities();
}

function renderActivities() {
  updateReviewNav();
  populateReviewCityFilter();
  destroyMiniMaps();

  if (state.step === 2 && !reviewImageEnrichInFlight) {
    reviewImageEnrichInFlight = true;
    Promise.all([
      enrichImages(state.activities),
      enrichPlaces(state.activities)
    ]).then(() => {
      if (state.step === 2) renderActivities();
    }).catch(() => {}).finally(() => {
      reviewImageEnrichInFlight = false;
    });
  }

  const filteredActivities = getFilteredReviewActivities();

  if (!filteredActivities.length) {
    els.activitiesGrid.innerHTML = '<div class="item"><strong>No activities match your filters.</strong><p>Try clearing search/filter settings.</p></div>';
    return;
  }

  renderBudgetTracker();
  els.activitiesGrid.innerHTML = '';

  // Clean up previous observer
  if (window._cardRevealObserver) { window._cardRevealObserver.disconnect(); window._cardRevealObserver = null; }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const placeholder = entry.target;
      observer.unobserve(placeholder);
      const idx = Number(placeholder.dataset.cardIndex);
      const a = filteredActivities[idx];
      if (!a) return;
      const card = buildActivityCard(a);
      placeholder.replaceWith(card);
      requestAnimationFrame(() => card.classList.add('card-revealed'));
      if (a.price_level == null || !a.place_id) {
        resolvePlace(a, a.city).then((place) => {
          if (!place) return;
          if (place.priceLevel != null) a.price_level = place.priceLevel;
          if (place.placeId) a.place_id = place.placeId;
          const badgeEl = card.querySelector(`[data-price-badges="${CSS.escape(a.id)}"]`);
          if (badgeEl) badgeEl.innerHTML = headerPriceBadgeHtml(a);
          const mapsEl = badgeEl?.nextElementSibling;
          if (mapsEl && mapsEl.classList.contains('badge-maps')) mapsEl.outerHTML = googleMapsLinkHtml(a);
        });
      }
    });
  }, { rootMargin: '200px' });
  window._cardRevealObserver = observer;

  filteredActivities.forEach((a, i) => {
    const placeholder = document.createElement('div');
    placeholder.className = 'activity-card-placeholder';
    placeholder.dataset.cardIndex = i;
    els.activitiesGrid.appendChild(placeholder);
    observer.observe(placeholder);
  });

  els.activitiesGrid.appendChild(buildAddActivityCard());

  function syncVerdictClasses(cardEl, approved) {
    const approveBtn = cardEl.querySelector('.approve');
    const declineBtn = cardEl.querySelector('.decline');
    if (approveBtn) {
      approveBtn.classList.toggle('active', approved === true);
      approveBtn.classList.toggle('inactive', approved === false);
    }
    if (declineBtn) {
      declineBtn.classList.toggle('active', approved === false);
      declineBtn.classList.toggle('inactive', approved === true);
    }
    cardEl.classList.toggle('approved', approved === true);
    cardEl.classList.toggle('declined', approved === false);
  }

  function buildActivityCard(a) {
    if (a.enriching) {
      const card = document.createElement('article');
      card.className = 'card activity-card card-reveal activity-card-enriching';
      card.dataset.activityId = a.id;
      card.innerHTML = `
        <div class="activity-enriching-body">
          <div class="activity-enriching-spinner"></div>
          <p class="activity-enriching-label">Finding best match for <strong>${esc(a.name)}</strong>…</p>
        </div>`;
      return card;
    }

    const review = state.reviewed[a.id] || { approved: null, notes: '' };
    const approvedState = review.approved;
    const isApproved = approvedState === true;
    const isDeclined = approvedState === false;
    const approveBtnClass = `primary approve btn-approve ${isApproved ? 'active' : ''} ${isDeclined ? 'inactive' : ''}`.trim();
    const declineBtnClass = `secondary decline btn-decline ${isDeclined ? 'active' : ''} ${isApproved ? 'inactive' : ''}`.trim();
    const cardStateClass = isApproved ? 'approved' : isDeclined ? 'declined' : '';
    const verdictClass = `verdict-${(a.verdict || '').replace(/\s+/g, '-')}`;
    const isFlipped = Boolean(state.reviewCardFlips[a.id]);
    const card = document.createElement('article');
    card.className = `card activity-card card-reveal ${cardStateClass} ${isFlipped ? 'is-flipped' : ''}`.trim();
    card.dataset.activityId = a.id;
    card.innerHTML = `
      <div class="activity-card-inner">
        <div class="activity-card-face activity-card-front">
          <div class="activity-card-img-wrap">
            <img src="${esc(a.imageUrl || '')}" alt="${esc(a.name)}" loading="lazy" />
            <button class="secondary flip-btn activity-flip-btn-overlay" type="button" title="Flip to map" aria-label="Flip card"><i class="ph-bold ph-map-trifold" aria-hidden="true"></i></button>
          </div>
          <div class="card-content">
            <div class="activity-card-head-actions">
              <div>
                ${a.type ? `<span class="badge">${esc(a.type)}</span>` : ''}
                <span class="badge ${verdictClass}">${esc(a.verdict || 'N/A')}</span>
                <span data-price-badges="${esc(a.id)}">${headerPriceBadgeHtml(a)}</span>
                ${googleMapsLinkHtml(a)}
              </div>
            </div>
            <h3>${esc(a.name)}</h3>
            <p><strong>City:</strong> ${esc(a.city || '')}</p>
            <p><strong>Why it fits:</strong> ${esc(a.why_it_fits || '')}</p>
            <p><strong>Pitfall:</strong> ${esc(a.pitfall || '')}</p>
            <p><strong>Booking advice:</strong> ${esc(a.booking_advice || '')}</p>
            <div class="actions">
              <button class="${approveBtnClass}"><i class="ph-bold ph-check-circle" aria-hidden="true"></i> Approve</button>
              <button class="${declineBtnClass}"><i class="ph-bold ph-x-circle" aria-hidden="true"></i> Decline</button>
            </div>
            <div class="activity-inline-row">
              <div class="textarea-expand-wrap activity-notes-wrap">
                <textarea id="actNotes-${a.id}" class="profile-textarea-fixed activity-notes-text" rows="2" maxlength="400" placeholder="Add notes or reminders…">${esc(review.notes || '')}</textarea>
                <button class="textarea-expand-btn" type="button" data-expand="actNotes-${a.id}" data-title="Notes — ${esc(a.name)}" aria-label="Expand notes"><i class="ph-bold ph-arrows-out-simple"></i></button>
              </div>
              <button class="icon-btn save-activity-notes" type="button" title="Save Notes" aria-label="Save Notes"><i class="ph-bold ph-floppy-disk"></i></button>
            </div>
            <div class="activity-inline-row">
              <div class="textarea-expand-wrap activity-notes-wrap">
                <textarea id="actDecline-${a.id}" class="profile-textarea-fixed decline-reason" rows="2" maxlength="200" placeholder="Tweak or replace this activity…"></textarea>
                <button class="textarea-expand-btn" type="button" data-expand="actDecline-${a.id}" data-title="Modify / Replace — ${esc(a.name)}" aria-label="Expand reason"><i class="ph-bold ph-arrows-out-simple"></i></button>
              </div>
              <button class="icon-btn confirm-modify" type="button" title="Adjust name, price, or details" aria-label="Modify" disabled><i class="ph-bold ph-pencil-simple"></i></button>
              <button class="icon-btn confirm-replace" type="button" title="Swap for a different activity" aria-label="Replace" disabled><i class="ph-bold ph-arrows-clockwise"></i></button>
            </div>
          </div>
        </div>
        <div class="activity-card-face activity-card-back">
          <div class="card-content map-back-content">
            <div class="activity-card-head-actions">
              <strong>Map view</strong>
              <button class="secondary flip-btn" type="button" title="Flip back" aria-label="Flip card"><i class="ph-bold ph-arrow-u-up-left" aria-hidden="true"></i></button>
            </div>
            <p class="muted-text">${esc(a.name)}${a.city ? ` · ${esc(a.city)}` : ''}</p>
            <button type="button" class="mini-map-wrap" title="Open full map">
              <div class="mini-map" data-mini-map-for="${esc(a.id)}"></div>
            </button>
            <p class="muted-text">Tap map to open full-screen itinerary map.</p>
          </div>
        </div>
      </div>
    `;

    card.querySelectorAll('.flip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 767px)').matches) {
          openActivityMapOverlay(a.id);
          return;
        }
        const next = !card.classList.contains('is-flipped');
        state.reviewCardFlips[a.id] = next;
        card.classList.toggle('is-flipped', next);
        if (next) ensureMiniMapForCard(card, a);
      });
    });

    if (isFlipped) {
      setTimeout(() => ensureMiniMapForCard(card, a), 0);
    }

    card.querySelector('.approve').addEventListener('click', () => {
      const current = state.reviewed[a.id]?.approved;
      const nextApproved = current === true ? null : true;
      state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), approved: nextApproved };
      syncVerdictClasses(card, nextApproved);
      renderBudgetTracker();
    });
    const declineReason = card.querySelector('.decline-reason');
    const confirmModify = card.querySelector('.confirm-modify');
    const confirmReplace = card.querySelector('.confirm-replace');
    const saveActivityNotes = card.querySelector('.save-activity-notes');
    const activityNotesText = card.querySelector('.activity-notes-text');
    const declineBtn = card.querySelector('.decline');
    bindTextareaExpandButtons(card);

    declineBtn.addEventListener('click', () => {
      const current = state.reviewed[a.id]?.approved;
      const nextApproved = current === false ? null : false;
      state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), approved: nextApproved };
      syncVerdictClasses(card, nextApproved);
      renderBudgetTracker();
    });

    saveActivityNotes.addEventListener('click', () => {
      const notes = activityNotesText.value.trim();
      state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), notes };
      syncActivityNotesToChecklist(a.id, notes);
      saveSnapshot();
      saveActivityNotes.innerHTML = '<i class="ph-bold ph-check"></i>';
      setTimeout(() => { saveActivityNotes.innerHTML = '<i class="ph-bold ph-floppy-disk"></i>'; }, 1500);
    });

    declineReason.addEventListener('input', () => {
      const hasText = !!declineReason.value.trim();
      confirmModify.disabled = !hasText;
      confirmReplace.disabled = !hasText;
    });

    confirmModify.addEventListener('click', async () => {
      const note = declineReason.value.trim();
      if (!note) return;
      confirmModify.disabled = true;
      confirmModify.innerHTML = '<i class="ph-bold ph-spinner"></i>';
      try {
        const resp = await apiFetch('/api/activity/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity: a, note, userId: ensureUserId() })
        });
        if (!resp.ok) throw new Error('Modify failed');
        const { updates } = await resp.json();
        updateActivityInState(a.id, updates);
      } catch {
        confirmModify.innerHTML = '<i class="ph-bold ph-pencil-simple"></i>';
        confirmModify.disabled = false;
      }
    });

    confirmReplace.addEventListener('click', async () => {
      const reason = declineReason.value.trim();
      if (!reason) return;
      confirmReplace.disabled = true;
      confirmReplace.innerHTML = '<i class="ph-bold ph-spinner"></i>';
      try {
        const notes = state.reviewed[a.id]?.notes || '';
        const resp = await apiFetch('/api/activity/replace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity: a, reason, notes, userId: ensureUserId() })
        });
        if (!resp.ok) throw new Error('Replace failed');
        const { activity: rawReplacement } = await resp.json();
        if (!rawReplacement) throw new Error('No activity in response');
        const replacement = { id: `${rawReplacement.city || a.city}-replacement-${uid()}`, ...normalizeActivityMetadata(rawReplacement), city: canonicalizeActivityCity(rawReplacement.city, a.city) };
        replaceActivityInState(a.id, replacement);
      } catch {
        confirmReplace.innerHTML = '<i class="ph-bold ph-arrows-clockwise"></i>';
        confirmReplace.disabled = false;
      }
    });
    card.querySelector('.mini-map-wrap')?.addEventListener('click', () => {
      openActivityMapOverlay(a.id);
    });

    // Mobile: tap card to expand fullscreen
    if (window.matchMedia('(max-width: 767px)').matches) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button, a, textarea, input, .decline-feedback')) return;
        openCardExpand(a, card);
      });
    }

    return card;
  }

  function openCardExpand(a, sourceCard) {
    const existing = document.querySelector('.card-expand-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'card-expand-overlay';

    // Clone the front face content for the expanded view
    const front = sourceCard.querySelector('.activity-card-front');
    if (!front) return;

    const body = document.createElement('div');
    body.className = 'card-expand-body';
    body.innerHTML = front.innerHTML;
    // Ensure all content visible in expanded view
    body.querySelectorAll('.card-content > *').forEach((el) => { el.style.display = ''; });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'card-expand-close';
    closeBtn.innerHTML = '<i class="ph-bold ph-x" aria-hidden="true"></i>';
    closeBtn.classList.add('icon-btn', 'red');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.setAttribute('title', 'Close');

    overlay.appendChild(closeBtn);
    overlay.appendChild(body);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function close() {
      overlay.classList.add('closing');
      document.body.style.overflow = '';
      overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
    }
    closeBtn.addEventListener('click', close);

    function syncExpand(approved) {
      syncVerdictClasses(body, approved);
      syncVerdictClasses(sourceCard, approved);
    }

    // Wire up actions directly against state (source card may be re-rendered)
    body.querySelector('.approve')?.addEventListener('click', () => {
      const current = state.reviewed[a.id]?.approved;
      const next = current === true ? null : true;
      state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), approved: next };
      syncExpand(next);
    });

    const expandDeclineBtn = body.querySelector('.decline');
    const expandDeclineReason = body.querySelector('.decline-reason');
    const expandConfirmModify = body.querySelector('.confirm-modify');
    const expandConfirmReplace = body.querySelector('.confirm-replace');
    const expandSaveActivityNotes = body.querySelector('.save-activity-notes');
    const expandActivityNotesText = body.querySelector('.activity-notes-text');

    expandDeclineBtn?.addEventListener('click', () => {
      const current = state.reviewed[a.id]?.approved;
      const next = current === false ? null : false;
      state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), approved: next };
      syncExpand(next);
    });

    expandSaveActivityNotes?.addEventListener('click', () => {
      const notes = expandActivityNotesText.value.trim();
      state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), notes };
      syncActivityNotesToChecklist(a.id, notes);
      saveSnapshot();
      expandSaveActivityNotes.innerHTML = '<i class="ph-bold ph-check"></i>';
      setTimeout(() => { expandSaveActivityNotes.innerHTML = '<i class="ph-bold ph-floppy-disk"></i>'; }, 1500);
    });

    expandDeclineReason?.addEventListener('input', () => {
      const hasText = !!expandDeclineReason.value.trim();
      if (expandConfirmModify) expandConfirmModify.disabled = !hasText;
      if (expandConfirmReplace) expandConfirmReplace.disabled = !hasText;
    });

    expandConfirmModify?.addEventListener('click', async () => {
      const note = expandDeclineReason.value.trim();
      if (!note) return;
      expandConfirmModify.disabled = true;
      expandConfirmModify.innerHTML = '<i class="ph-bold ph-spinner"></i>';
      try {
        const resp = await apiFetch('/api/activity/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity: a, note, userId: ensureUserId() })
        });
        if (!resp.ok) throw new Error('Modify failed');
        const { updates } = await resp.json();
        close();
        updateActivityInState(a.id, updates);
      } catch {
        expandConfirmModify.innerHTML = '<i class="ph-bold ph-pencil-simple"></i>';
        expandConfirmModify.disabled = false;
      }
    });

    expandConfirmReplace?.addEventListener('click', async () => {
      const reason = expandDeclineReason.value.trim();
      if (!reason) return;
      expandConfirmReplace.disabled = true;
      expandConfirmReplace.innerHTML = '<i class="ph-bold ph-spinner"></i>';
      try {
        const notes = state.reviewed[a.id]?.notes || '';
        const resp = await apiFetch('/api/activity/replace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity: a, reason, notes, userId: ensureUserId() })
        });
        if (!resp.ok) throw new Error('Replace failed');
        const { activity: rawReplacement } = await resp.json();
        if (!rawReplacement) throw new Error('No activity in response');
        const replacement = { id: `${rawReplacement.city || a.city}-replacement-${uid()}`, ...normalizeActivityMetadata(rawReplacement), city: canonicalizeActivityCity(rawReplacement.city, a.city) };
        close();
        replaceActivityInState(a.id, replacement);
      } catch {
        expandConfirmReplace.innerHTML = '<i class="ph-bold ph-arrows-clockwise"></i>';
        expandConfirmReplace.disabled = false;
      }
    });

    body.querySelector('.flip-btn')?.addEventListener('click', () => {
      close();
      openActivityMapOverlay(a.id);
    });
  }
}

function destroyMiniMaps() {
  miniMapInstances.clear();
}

async function ensureMiniMapForCard(card, activity) {
  if (!isGoogleMapsReady()) return;
  const holder = card.querySelector('.mini-map');
  if (!holder) return;
  const key = String(activity.id || '');
  if (!key) return;

  miniMapInstances.delete(key);

  holder.innerHTML = '<div class="mini-map-loading">Loading map…</div>';
  const geo = await geocodeActivity(activity);
  if (!geo) {
    holder.innerHTML = '<div class="mini-map-loading">Location unavailable</div>';
    return;
  }

  holder.innerHTML = '';
  const center = { lat: geo.lat, lng: geo.lng };
  const map = new google.maps.Map(holder, {
    center,
    zoom: 13,
    disableDefaultUI: true,
    gestureHandling: 'none',
    mapId: 'travelplanner-mini'
  });
  new google.maps.marker.AdvancedMarkerElement({ map, position: center });
  miniMapInstances.set(key, map);
}

function makeMapLabel(activity, activities) {
  const city = String(activity.city || '').trim();
  const sameCity = activities.filter((a) => String(a.city || '').trim() === city);
  const cityIndex = [...new Set(activities.map((a) => String(a.city || '').trim()))].filter(Boolean).indexOf(city) + 1;
  const order = sameCity.findIndex((a) => a.id === activity.id) + 1;
  if (cityIndex > 0 && order > 0) return `${cityIndex}.${order}`;
  const globalOrder = activities.findIndex((a) => a.id === activity.id) + 1;
  return String(globalOrder);
}

const CATEGORY_ICONS = {
  museum: 'ph-columns', gallery: 'ph-paint-brush', landmark: 'ph-buildings',
  park: 'ph-tree', neighborhood: 'ph-map-trifold', market: 'ph-storefront',
  food: 'ph-fork-knife', restaurant: 'ph-fork-knife', breakfast: 'ph-coffee',
  lunch: 'ph-fork-knife', dinner: 'ph-wine', nightlife: 'ph-martini',
  show: 'ph-ticket', tour: 'ph-compass', walk: 'ph-person-simple-walk',
  sunset: 'ph-sun-horizon', sports: 'ph-soccer-ball', cultural: 'ph-palette',
  shopping: 'ph-bag', spa: 'ph-sparkle', default: 'ph-map-pin'
};

const CATEGORY_HINTS_CLIENT = [
  [/\b(museum|exhibit)\b/i, 'museum'], [/\b(gallery|art)\b/i, 'gallery'],
  [/\b(park|garden)\b/i, 'park'], [/\b(neighborhood|district|quarter)\b/i, 'neighborhood'],
  [/\b(market|bazaar|souq)\b/i, 'market'], [/\b(breakfast|brunch|cafe)\b/i, 'breakfast'],
  [/\b(lunch)\b/i, 'lunch'], [/\b(dinner|supper)\b/i, 'dinner'],
  [/\b(bar|cocktail|nightlife|club)\b/i, 'nightlife'],
  [/\b(show|concert|theatre|theater|performance)\b/i, 'show'],
  [/\b(tour|day trip|excursion)\b/i, 'tour'], [/\b(walk|hike|stroll)\b/i, 'walk'],
  [/\b(sunset)\b/i, 'sunset'], [/\b(restaurant|dining)\b/i, 'restaurant'],
  [/\b(landmark|monument|castle|palace|cathedral|church)\b/i, 'landmark'],
];

function inferCategoryClient(activity = {}) {
  const raw = String(activity.category || activity.type || '').trim().toLowerCase();
  if (CATEGORY_ICONS[raw]) return raw;
  const haystack = `${activity.name || ''} ${activity.type || ''}`;
  const hit = CATEGORY_HINTS_CLIENT.find(([re]) => re.test(haystack));
  return hit ? hit[1] : (raw || 'default');
}

function markerContent(activity, highlighted = false) {
  const el = document.createElement('div');
  el.className = 'activity-map-marker-wrap';
  const cat = inferCategoryClient(activity);
  const iconClass = highlighted ? 'ph-star' : (CATEGORY_ICONS[cat] || CATEGORY_ICONS.default);
  const catClass = highlighted ? 'star' : `cat-${cat}`;
  el.innerHTML = `<div class="activity-map-marker ${catClass}"><i class="ph-bold ${iconClass}"></i></div>`;
  return el;
}

function logisticsMarkerContent(type) {
  const icons = { accommodation: 'ph-bed', arrival: 'ph-airplane-landing', departure: 'ph-airplane-takeoff' };
  const el = document.createElement('div');
  el.className = 'activity-map-marker-wrap';
  el.innerHTML = `<div class="activity-map-marker log-${type}"><i class="ph-bold ${icons[type] || 'ph-map-pin'}"></i></div>`;
  return el;
}

function mountActivityMapOverlay() {
  if (activityMapOverlay) return;
  const overlay = document.createElement('div');
  overlay.className = 'activity-map-overlay hidden';
  overlay.innerHTML = `
    <div class="activity-map-shell">
      <div class="activity-map-topbar">
        <strong>Itinerary map</strong>
        <button class="icon-btn red close-activity-map" type="button" title="Close map" aria-label="Close map"><i class="ph-bold ph-x" aria-hidden="true"></i></button>
      </div>
      <div class="activity-map-canvas" id="activityMapCanvas"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.close-activity-map')?.addEventListener('click', closeActivityMapOverlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeActivityMapOverlay();
  });
  activityMapOverlay = overlay;
}

function closeActivityMapOverlay() {
  if (!activityMapOverlay) return;
  activityMapOverlay.classList.add('hidden');
  refreshOverlayInterlocks();
}

function buildAddActivityCard() {
  const card = document.createElement('div');
  card.className = 'add-activity-card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', 'Add activity');
  card.innerHTML = `
    <span class="add-activity-card-icon"><i class="ph-bold ph-plus-circle"></i></span>
    <span class="add-activity-card-label">Add activity</span>
  `;
  card.addEventListener('click', openAddActivityModal);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openAddActivityModal(); });
  return card;
}

function openAddActivityModal() {
  const cities = [...new Set(state.activities.map((a) => String(a.city || '').trim()).filter(Boolean))].sort();
  const citySelect = document.getElementById('addActivityCity');
  citySelect.innerHTML = cities.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  document.getElementById('addActivityName').value = '';
  document.getElementById('addActivityCost').value = '';
  document.getElementById('addActivityCostType').value = 'per_person';
  document.getElementById('addActivityWhy').value = '';

  document.getElementById('addActivityModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('addActivityName').focus(), 50);
}

function closeAddActivityModal() {
  document.getElementById('addActivityModal').classList.add('hidden');
}

function submitAddActivity() {
  const name = document.getElementById('addActivityName').value.trim();
  if (!name) {
    document.getElementById('addActivityName').focus();
    showToast('Please enter an activity name.', 'info');
    return;
  }

  const city = document.getElementById('addActivityCity').value;
  const costRaw = document.getElementById('addActivityCost').value;
  const costType = document.getElementById('addActivityCostType').value;
  const why = document.getElementById('addActivityWhy').value.trim();
  const cost = costRaw !== '' && Number.isFinite(Number(costRaw)) && Number(costRaw) >= 0 ? Number(costRaw) : null;

  const stubId = crypto.randomUUID();
  const stub = {
    id: stubId,
    name,
    city,
    type: 'tour',
    category: 'tour',
    why_it_fits: why,
    estimated_cost_usd: cost,
    cost_type: costType,
    verdict: 'Recommend',
    pitfall: '',
    booking_advice: '',
    smarter_alternative: null,
    dedicated_time_block: false,
    suggested_time: '10:00am',
    duration_hours: 2,
    duration: '2 hours',
    opening_hours: '',
    booking_type: 'none',
    booking_links: [],
    imageUrl: '',
    start_location: '',
    end_location: '',
    userAdded: true,
    enriching: true,
  };

  state.activities.push(stub);
  closeAddActivityModal();
  renderActivities();
  showToast(`Finding the best match for "${name}"…`, 'info');

  apiFetch('/api/activity/replace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity: stub, reason: why || null, userId: ensureUserId() }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`server ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (!data?.activity) throw new Error('no activity returned');
      const enriched = { ...data.activity, id: stubId, city: stub.city, userAdded: true };
      replaceActivityInState(stubId, enriched);
      showToast(`"${enriched.name}" added to your itinerary.`, 'success');
    })
    .catch((err) => {
      console.error('[addActivity] enrichment failed:', err);
      updateActivityInState(stubId, { enriching: false });
      showToast(`"${name}" added. Details couldn't be enriched — you can edit it later.`, 'info');
    });
}

function focusActivityCard(activityId) {
  const selector = `[data-activity-id="${String(activityId).replace(/"/g, '\\"')}"]`;
  const card = document.querySelector(selector);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('map-highlight');
  setTimeout(() => card.classList.remove('map-highlight'), 1200);
}

async function openActivityMapOverlay(selectedActivityId = null) {
  if (!isGoogleMapsReady()) return;
  mountActivityMapOverlay();
  state.mapOverlaySelectedActivityId = selectedActivityId;
  activityMapOverlay.classList.remove('hidden');
  refreshOverlayInterlocks();

  const mapCanvas = activityMapOverlay.querySelector('#activityMapCanvas');
  const activities = [...state.activities];

  // Determine which city to focus on
  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const focusCity = String(selectedActivity?.city || '').trim();

  // Geocode approved activities for the focused city only
  const cityActivities = activities.filter((a) =>
    state.reviewed[a.id]?.approved === true &&
    (!focusCity || String(a.city || '').trim() === focusCity)
  );
  const enriched = [];
  for (const activity of cityActivities) {
    const geo = await geocodeActivity(activity);
    if (geo) enriched.push({ activity, geo });
  }

  // Geocode logistics (accommodation, arrival, departure) for the focused city
  const cityObj = focusCity ? state.cities.find((c) => cityMatches(c.name, focusCity)) : null;
  const logisticsPoints = [];
  if (cityObj) {
    const tryLogistics = async (type, obj) => {
      if (!obj) return;
      if (obj.latitude && obj.longitude) {
        logisticsPoints.push({ type, lat: Number(obj.latitude), lng: Number(obj.longitude), label: obj.address || obj.location || type });
      } else {
        const query = obj.address || obj.location;
        if (query) {
          const geo = await geocodeQueryQueued(`${query}, ${focusCity}`);
          if (geo) logisticsPoints.push({ type, lat: geo.lat, lng: geo.lng, label: query });
        }
      }
    };
    await tryLogistics('accommodation', cityObj.accommodation);
    await tryLogistics('arrival', cityObj.logistics?.arrival);
    await tryLogistics('departure', cityObj.logistics?.departure);
  }

  if (!activityMapOverlayMap) {
    activityMapOverlayMap = new google.maps.Map(mapCanvas, {
      zoom: 13,
      center: { lat: 0, lng: 0 },
      mapId: 'travelplanner-overlay'
    });
  }

  activityMapOverlayMarkers.forEach((m) => { m.map = null; });
  activityMapOverlayMarkers = [];

  const gmBounds = new google.maps.LatLngBounds();
  const infoWindow = new google.maps.InfoWindow();

  enriched.forEach(({ activity, geo }) => {
    const selected = activity.id === state.mapOverlaySelectedActivityId;
    const position = { lat: geo.lat, lng: geo.lng };
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map: activityMapOverlayMap,
      position,
      content: markerContent(activity, selected)
    });
    marker.addListener('click', () => {
      infoWindow.setContent(`<strong>${esc(activity.name || 'Activity')}</strong><br>${esc(activity.city || '')}`);
      infoWindow.open({ anchor: marker, map: activityMapOverlayMap });
      state.mapOverlaySelectedActivityId = activity.id;
      focusActivityCard(activity.id);
    });
    activityMapOverlayMarkers.push(marker);
    gmBounds.extend(position);
  });

  logisticsPoints.forEach(({ type, lat, lng, label }) => {
    const position = { lat, lng };
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map: activityMapOverlayMap,
      position,
      content: logisticsMarkerContent(type)
    });
    marker.addListener('click', () => {
      infoWindow.setContent(`<strong>${esc(label)}</strong><br><small>${esc(type)}</small>`);
      infoWindow.open({ anchor: marker, map: activityMapOverlayMap });
    });
    activityMapOverlayMarkers.push(marker);
    gmBounds.extend(position);
  });

  if (enriched.length || logisticsPoints.length) {
    activityMapOverlayMap.fitBounds(gmBounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }
}

function expandDays(cities) {
  const days = [];
  cities.forEach((c) => {
    const start = parseYmdAsLocal(c.startDate);
    const end = parseYmdAsLocal(c.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = formatYmdLocal(d);
      days.push({ id: `${c.name}-${iso}`, city: c.name, date: iso });
    }
  });
  return days;
}

function daysMatchCities(days = [], cities = []) {
  const expected = expandDays(cities).map((d) => d.id).sort();
  const actual = (Array.isArray(days) ? days : []).map((d) => d?.id || `${d?.city}-${d?.date}`).sort();
  if (expected.length !== actual.length) return false;
  return expected.every((id, idx) => id === actual[idx]);
}

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 24;
const PX_PER_HOUR = 60;
const GRID_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * PX_PER_HOUR;

const DEFAULT_ARRANGE_CATEGORY_CONFIG = {
  arrival: { durationHours: 1, openingHours: '00:00-23:59' },
  departure: { durationHours: 1, openingHours: '00:00-23:59' },
  museum: { durationHours: 2.5, openingHours: '10:00-18:00' },
  gallery: { durationHours: 2, openingHours: '10:00-18:00' },
  park: { durationHours: 1.5, openingHours: '07:00-19:00' },
  neighborhood: { durationHours: 2, openingHours: '09:00-21:00' },
  market: { durationHours: 1.5, openingHours: '09:00-17:00' },
  breakfast: { durationHours: 1, openingHours: '07:30-10:30' },
  lunch: { durationHours: 1.25, openingHours: '12:00-14:30' },
  dinner: { durationHours: 1.75, openingHours: '18:30-22:30' },
  show: { durationHours: 2, openingHours: '19:00-23:00' },
  tour: { durationHours: 2.5, openingHours: '09:00-17:00' },
  walk: { durationHours: 1.5, openingHours: '08:00-19:00' },
  sunset: { durationHours: 1, openingHours: '17:30-20:30' },
  default: { durationHours: 1.5, openingHours: '09:00-18:00' }
};

function getArrangeCategoryDefaults(category = '') {
  const merged = state.arrangeConfig || DEFAULT_ARRANGE_CATEGORY_CONFIG;
  const key = String(category || '').trim().toLowerCase();
  return merged[key] || merged.default || DEFAULT_ARRANGE_CATEGORY_CONFIG.default;
}

function inferActivityCategory(activity = {}) {
  const raw = String(activity.category || activity.type || '').trim().toLowerCase();
  const text = `${activity.name || ''} ${activity.type || ''} ${actPreferredTime(activity) || ''}`;
  if (raw && getArrangeCategoryDefaults(raw)) return raw;
  if (/\b(arrival|arrive|check[- ]?in)\b/i.test(text)) return 'arrival';
  if (/\b(depart|departure|check[- ]?out)\b/i.test(text)) return 'departure';
  if (/\b(museum|exhibit)\b/i.test(text)) return 'museum';
  if (/\b(park|garden)\b/i.test(text)) return 'park';
  if (/\b(breakfast|brunch|cafe)\b/i.test(text)) return 'breakfast';
  if (/\b(lunch)\b/i.test(text)) return 'lunch';
  if (/\b(dinner|supper|restaurant)\b/i.test(text)) return 'dinner';
  if (/\b(show|concert|theatre|theater)\b/i.test(text)) return 'show';
  return raw || 'default';
}

function parseDurationHoursFromText(value = '') {
  const text = String(value || '').trim().toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return /^m|min/i.test(match[2]) ? (amount / 60) : amount;
}

function normalizeActivityMetadata(activity = {}) {
  const category = inferActivityCategory(activity);
  const defaults = getArrangeCategoryDefaults(category);
  const parsedDuration = parseDurationHoursFromText(activity.duration);
  const _rawDurH = actDurationHours(activity, 0);
  const durationHours = _rawDurH > 0 ? _rawDurH : (parsedDuration || defaults.durationHours || 1.5);
  const FIXED_HOUR_CATEGORIES = new Set(['breakfast', 'lunch', 'dinner', 'nightlife', 'sunset']);
  const openingHours = (FIXED_HOUR_CATEGORIES.has(category)
    ? defaults.openingHours
    : String(activity.opening_hours || activity.openingHours || defaults.openingHours || '').trim());
  return {
    ...activity,
    category,
    duration_hours: durationHours,
    duration: String(activity.duration || `${durationHours} hours`).trim(),
    opening_hours: openingHours
  };
}

function parseOpeningWindows(openingHours = '') {
  const text = String(openingHours || '').trim();
  if (!text) return [[0, (24 * 60) - 1]];
  return text.split(',').map((segment) => {
    const match = segment.trim().match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)[\s-]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (!match) return null;
    return [minutesFromTime(parseTimeTo24(match[1])), minutesFromTime(parseTimeTo24(match[2]))];
  }).filter((window) => Array.isArray(window) && window[1] > window[0]);
}

function formatDuration(hours = 1) {
  return `${Number(hours || 1)}h`;
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

function timeFromMinutes(totalMinutes = 0) {
  const clamped = Math.max(0, Math.min((24 * 60) - 1, Number(totalMinutes || 0)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function commutePairKey(fromId, toId) {
  return `${fromId}->${toId}`;
}

function getIncomingCommuteForActivity(activityId) {
  const activity = state.activities.find((a) => a.id === activityId);
  if (!activity) return null;
  const placement = state.placements[activityId];
  if (!placement?.dayId) return null;

  const activitiesInDay = state.activities
    .filter((a) => state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId === placement.dayId)
    .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)));

  const index = activitiesInDay.findIndex((a) => a.id === activityId);
  if (index <= 0) return null;

  const prev = activitiesInDay[index - 1];
  return state.commutes[commutePairKey(prev.id, activityId)] || null;
}

function normalizeCommuteStateMap(commuteMap = {}) {
  const normalized = {};
  Object.entries(commuteMap || {}).forEach(([key, commute]) => {
    if (!commute || typeof commute !== 'object') return;

    const modes = commute.modes && typeof commute.modes === 'object'
      ? commute.modes
      : {
        transit: commute.mode === 'transit' ? { durationMinutes: commute.durationMinutes, modeIcon: commute.modeIcon || '🚇' } : { durationMinutes: null, modeIcon: '🚇' },
        driving: commute.mode === 'driving' ? { durationMinutes: commute.durationMinutes, modeIcon: commute.modeIcon || '🚗' } : { durationMinutes: null, modeIcon: '🚗' },
        walking: commute.mode === 'walking' ? { durationMinutes: commute.durationMinutes, modeIcon: commute.modeIcon || '🚶' } : { durationMinutes: null, modeIcon: '🚶' }
      };

    const selectedMode = resolveSelectedCommuteMode({ ...commute, modes });
    const selected = modes[selectedMode] || {};

    normalized[key] = {
      ...commute,
      modes,
      selectedMode,
      durationMinutes: Number.isFinite(Number(selected.durationMinutes)) ? Number(selected.durationMinutes) : null,
      modeIcon: selected.modeIcon || '🚇'
    };
  });

  return normalized;
}

const COMMUTE_MODE_ORDER = ['transit', 'driving', 'walking'];
const COMMUTE_MODE_LABEL = {
  transit: 'Transit',
  driving: 'Driving',
  walking: 'Walking'
};

function resolveSelectedCommuteMode(commute) {
  if (!commute || typeof commute !== 'object') return null;
  const selectedMode = commute.selectedMode && commute.modes?.[commute.selectedMode]
    ? commute.selectedMode
    : COMMUTE_MODE_ORDER.find((mode) => Number.isFinite(commute.modes?.[mode]?.durationMinutes));
  return selectedMode || COMMUTE_MODE_ORDER[0];
}

function resolveSelectedCommuteDetails(commute) {
  if (!commute) return null;
  const selectedMode = resolveSelectedCommuteMode(commute);
  const selected = commute.modes?.[selectedMode] || {};
  const durationMinutes = Number.isFinite(Number(selected.durationMinutes)) ? Number(selected.durationMinutes) : null;
  const modeIcon = selected.modeIcon || '🚇';
  return { selectedMode, durationMinutes, modeIcon };
}

function formatCommuteBadge(commute) {
  const selected = resolveSelectedCommuteDetails(commute);
  if (!selected || !Number.isFinite(selected.durationMinutes)) return '';
  return `${selected.modeIcon} ${selected.durationMinutes} min`;
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
    <button type="button" class="icon-btn nav-secondary arrange-city-arrow" data-city-prev title="Previous city" ${activeIndex <= 0 ? 'disabled' : ''} aria-label="Previous city"><i class="ph-bold ph-arrow-left" aria-hidden="true"></i></button>
    <div class="arrange-city-tabs">
      ${cityGroups.map((g) => {
        const start = parseYmdAsLocal(g.days[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const end = parseYmdAsLocal(g.days[g.days.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `<button type="button" class="arrange-city-tab ${normalizeCity(g.city) === normalizeCity(state.arrangeCity) ? 'active' : ''}" data-city-tab="${esc(g.city)}">${esc(g.city)} (${start}–${end})</button>`;
      }).join('')}
    </div>
    <button type="button" class="icon-btn nav-primary arrange-city-arrow" data-city-next title="Next city" ${activeIndex >= cityGroups.length - 1 ? 'disabled' : ''} aria-label="Next city"><i class="ph-bold ph-arrow-right" aria-hidden="true"></i></button>
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
  const { icon, colorClass } = getActivityStyle(item.type);
  return `
    <div class="item staging-card ${colorClass}" data-id="${item.id}">
      <h4><span class="activity-icon" aria-hidden="true">${icon}</span><span class="activity-name">${esc(item.name)}</span></h4>
    </div>
  `;
}

function formatTypeLabel(type = '') {
  const normalized = String(type || '').trim().toLowerCase();
  if (!normalized) return 'Activity';
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDurationHoursLong(hours = 1) {
  const value = Number(hours || 1);
  const safe = Number.isFinite(value) ? value : 1;
  return `${safe % 1 === 0 ? safe.toFixed(0) : safe.toFixed(1)} hours`;
}

function makePlacedCard(item) {
  const { icon, colorClass } = getActivityStyle(item.type);
  const placement = state.placements[item.id] || {};
  const time = parseTimeTo24(placement.time || actPreferredTime(item) || typeToTime(item.type));
  const h = Math.max(28, actDurationHours(item) * PX_PER_HOUR);
  const y = yFromTime(time);
  const typeLabel = formatTypeLabel(item.type);
  const durationLabel = formatDurationHoursLong(actDurationHours(item));
  return `
    <article class="placed-card ${colorClass}" data-id="${item.id}" style="height:${h}px;top:${y}px;">
      <div class="placed-body">
        <div class="placed-head-row">
          <h4>
            <span class="activity-icon activity-icon-wrap" aria-hidden="true">
              ${icon}
              <button
                type="button"
                class="placed-info-wrap"
                aria-label="Activity details"
                data-tooltip-name="${esc(item.name)}"
                data-tooltip-type-icon="${esc(icon)}"
                data-tooltip-type="${esc(typeLabel)}"
                data-tooltip-duration="${esc(durationLabel)}"
                data-tooltip-verdict="${esc(item.verdict || 'N/A')}"
                data-tooltip-why="${esc(item.why_it_fits || '')}"
                data-tooltip-start-location="${esc(actAddress(item))}"
              >
                <span class="placed-info-icon" aria-hidden="true">ℹ</span>
              </button>
            </span>
            <span class="activity-name">${esc(item.name)}</span>
          </h4>
        </div>
      </div>
    </article>
  `;
}

function renderCommuteSelector(fromId, toId, y) {
  const commute = state.commutes[commutePairKey(fromId, toId)] || null;
  const selected = resolveSelectedCommuteDetails(commute);
  if (!selected || !Number.isFinite(selected.durationMinutes)) return '';

  const options = COMMUTE_MODE_ORDER
    .map((mode) => {
      const option = commute?.modes?.[mode];
      if (!option || !Number.isFinite(Number(option.durationMinutes))) return '';
      const isActive = selected.selectedMode === mode;
      return `
        <button type="button" class="commute-option ${isActive ? 'active' : ''}" data-mode="${mode}">
          <span>${esc(option.modeIcon || '🚇')} ${esc(COMMUTE_MODE_LABEL[mode] || mode)} - ${Number(option.durationMinutes)} min</span>
          ${isActive ? '<span class="commute-option-check">✓</span>' : ''}
        </button>
      `;
    })
    .filter(Boolean)
    .join('');

  if (!options) return '';

  return `
    <div class="commute-indicator" style="top:${y}px;">
      <div class="commute-selector" data-from-id="${esc(fromId)}" data-to-id="${esc(toId)}">
        <button type="button" class="commute-selector-trigger" aria-expanded="false">
          <span class="commute-selected-label">${esc(formatCommuteBadge(commute))}</span>
          <span class="commute-selector-arrow" aria-hidden="true">▾</span>
        </button>
        <div class="commute-selector-menu" role="menu">${options}</div>
      </div>
    </div>
  `;
}

function makeCommuteIndicator(currentItem, nextItem) {
  const placement = state.placements[currentItem.id] || {};
  const time = parseTimeTo24(placement.time || actPreferredTime(currentItem) || typeToTime(currentItem.type));
  const h = Math.max(28, actDurationHours(currentItem) * PX_PER_HOUR);
  return renderCommuteSelector(currentItem.id, nextItem.id, yFromTime(time) + h + 6);
}

function makeLogisticsCard(label, icon, time, subtitle = '') {
  const y = yFromTime(time);
  const subtitleHtml = subtitle ? `<span class="logistics-card-sub">${esc(subtitle)}</span>` : '';
  return `
    <div class="logistics-card" style="top:${y}px;" aria-label="${esc(label)}">
      <span class="logistics-card-icon" aria-hidden="true">${icon}</span>
      <div class="logistics-card-text">
        <span class="logistics-card-label">${esc(label)}</span>
        ${subtitleHtml}
      </div>
      <span class="logistics-card-time">${esc(time)}</span>
    </div>
  `;
}

function getLogisticsCardHeight() {
  return 36;
}

function getLogisticsForDay(city, date) {
  if (!city) return null;
  const logistics = city.logistics || {};
  const arrivalDate = String(logistics.arrival?.date || city.startDate || '').slice(0, 10);
  const departureDate = String(logistics.departure?.date || city.endDate || '').slice(0, 10);
  const dateStr = String(date || '').slice(0, 10);

  const result = { isArrival: false, isDeparture: false };
  if (dateStr === arrivalDate) {
    const time = city.travelTiming?.arrivalAvailableTime || '09:00';
    result.isArrival = true;
    result.arrivalTime = time;
    result.arrivalLocation = String(logistics.arrival?.location || '').trim();
  }
  if (dateStr === departureDate) {
    const time = city.travelTiming?.departureMustLeaveTime || '18:00';
    result.isDeparture = true;
    result.departureTime = time;
    result.departureLocation = String(logistics.departure?.location || '').trim();
  }
  return result;
}

function getAccommodationLabel(cityName, date) {
  const acc = getAccommodationForDay(cityName, date);
  const raw = String(acc?.address || '').trim();
  if (!raw) return 'Accommodation';
  const short = raw.split(',')[0].trim();
  return short || raw;
}

function citySlug(cityName) {
  return String(cityName || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function logisticsArrivalId(cityName) { return `logistics-arrival-${citySlug(cityName)}`; }
function logisticsDepartureId(cityName) { return `logistics-departure-${citySlug(cityName)}`; }
function logisticsAccommodationArrivalId(cityName) { return `logistics-acc-arrival-${citySlug(cityName)}`; }
function logisticsAccommodationDepartureId(cityName) { return `logistics-acc-departure-${citySlug(cityName)}`; }

function buildLogisticsPseudoActivities(cityObj, date, cityName) {
  if (!cityObj) return { arrival: null, departure: null };
  const logistics = cityObj.logistics || {};
  const arrivalDate = String(logistics.arrival?.date || cityObj.startDate || '').slice(0, 10);
  const departureDate = String(logistics.departure?.date || cityObj.endDate || '').slice(0, 10);
  const dateStr = String(date || '').slice(0, 10);
  const acc = getAccommodationForDay(cityName, date);
  const accAddress = String(acc?.address || '').trim();
  const accLat = normalizeCoordinate(acc?.latitude);
  const accLng = normalizeCoordinate(acc?.longitude);

  let arrival = null;
  let arrivalAccommodation = null;
  if (dateStr === arrivalDate) {
    const arrLoc = String(logistics.arrival?.location || '').trim();
    arrival = {
      id: logisticsArrivalId(cityName),
      name: 'Arrival → Accommodation',
      city: cityName,
      start_location: arrLoc,
      start_latitude: normalizeCoordinate(logistics.arrival?.latitude),
      start_longitude: normalizeCoordinate(logistics.arrival?.longitude),
      end_location: arrLoc,
      end_latitude: normalizeCoordinate(logistics.arrival?.latitude),
      end_longitude: normalizeCoordinate(logistics.arrival?.longitude)
    };
    arrivalAccommodation = {
      id: logisticsAccommodationArrivalId(cityName),
      name: 'Accommodation',
      city: cityName,
      start_location: accAddress,
      start_latitude: accLat,
      start_longitude: accLng,
      end_location: accAddress,
      end_latitude: accLat,
      end_longitude: accLng
    };
  }

  let departure = null;
  let departureAccommodation = null;
  if (dateStr === departureDate) {
    const depLoc = String(logistics.departure?.location || '').trim();
    departure = {
      id: logisticsDepartureId(cityName),
      name: 'Accommodation → Departure',
      city: cityName,
      start_location: depLoc,
      start_latitude: normalizeCoordinate(logistics.departure?.latitude),
      start_longitude: normalizeCoordinate(logistics.departure?.longitude),
      end_location: depLoc,
      end_latitude: normalizeCoordinate(logistics.departure?.latitude),
      end_longitude: normalizeCoordinate(logistics.departure?.longitude)
    };
    departureAccommodation = {
      id: logisticsAccommodationDepartureId(cityName),
      name: 'Accommodation',
      city: cityName,
      start_location: accAddress,
      start_latitude: accLat,
      start_longitude: accLng,
      end_location: accAddress,
      end_latitude: accLat,
      end_longitude: accLng
    };
  }

  return { arrival, arrivalAccommodation, departure, departureAccommodation };
}

function makeLogisticsCommuteIndicator(fromId, toId, baseTime, cardHeight) {
  return renderCommuteSelector(fromId, toId, yFromTime(baseTime) + cardHeight + 6);
}

function getPlacementTimeRange(activity, placementOverride = null) {
  const placement = placementOverride || state.placements[activity.id] || {};
  const startTime = parseTimeTo24(placement.time || actPreferredTime(activity) || typeToTime(activity.type));
  const startMinutes = minutesFromTime(startTime);
  const durationMinutes = Math.max(30, actDurationHours(activity) * 60);
  return {
    startMinutes,
    endMinutes: startMinutes + durationMinutes
  };
}

function rangesOverlap(a, b) {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

function hasOverlapInDay(activityId, dayId, placementOverride = null) {
  const dropped = state.activities.find((a) => a.id === activityId);
  if (!dropped || !dayId) return false;

  const droppedRange = getPlacementTimeRange(dropped, placementOverride);
  const day = state.days.find((d) => d.id === dayId);
  const city = day ? state.cities.find((c) => cityMatches(c.name, day.city)) : null;
  if (day && city) {
    const dayStartMinutes = getCityDayWindowStart(city, day.date);
    const dayEndMinutes = getCityDayWindowEnd(city, day.date);
    if (droppedRange.startMinutes < dayStartMinutes || droppedRange.endMinutes > dayEndMinutes) {
      return true;
    }
  }

  const dayActivities = state.activities.filter((a) => (
    a.id !== activityId
    && state.reviewed[a.id]?.approved
    && state.placements[a.id]?.dayId === dayId
  ));

  return dayActivities.some((other) => rangesOverlap(droppedRange, getPlacementTimeRange(other)));
}

function closeAllCommuteMenus(except = null) {
  document.querySelectorAll('.commute-selector.open').forEach((selector) => {
    if (except && selector === except) return;
    selector.classList.remove('open');
    const trigger = selector.querySelector('.commute-selector-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  });
}

function bindCommuteInteractions() {
  document.querySelectorAll('.commute-selector').forEach((selector) => {
    const fromId = selector.dataset.fromId;
    const toId = selector.dataset.toId;
    if (!fromId || !toId) return;

    const trigger = selector.querySelector('.commute-selector-trigger');
    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !selector.classList.contains('open');
        closeAllCommuteMenus(selector);
        selector.classList.toggle('open', willOpen);
        trigger.setAttribute('aria-expanded', String(willOpen));
      });
    }

    selector.querySelectorAll('.commute-option').forEach((optionBtn) => {
      optionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = optionBtn.dataset.mode;
        const key = commutePairKey(fromId, toId);
        const commute = state.commutes[key];
        if (!commute || !mode || !commute.modes?.[mode]) return;

        const selected = commute.modes[mode];
        if (!Number.isFinite(Number(selected.durationMinutes))) return;

        state.commutes[key] = {
          ...commute,
          selectedMode: mode,
          durationMinutes: Number(selected.durationMinutes),
          modeIcon: selected.modeIcon || commute.modeIcon || '🚇'
        };

        const toPlacement = state.placements[toId] || {};
        const dayId = toPlacement.dayId;
        if (dayId) {
          const orderedActivities = state.activities
            .filter((a) => state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId === dayId)
            .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)));
          const pairIndex = orderedActivities.findIndex((a, index) => index > 0 && orderedActivities[index - 1].id === fromId && a.id === toId);
          recalculateDayFromIndex(dayId, pairIndex === -1 ? 1 : pairIndex);
        }

        renderArrange();
      });
    });
  });

  document.addEventListener('click', closeAllCommuteMenus, { once: true });
}

let _arrangeSortables = [];
function renderArrange() {
  _arrangeSortables.forEach((s) => { try { s.destroy(); } catch {} });
  _arrangeSortables = [];

  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  const cityGroups = getArrangeCities();
  renderArrangeCityNav(cityGroups);
  renderArrangeDiagnostics();

  const activeCity = state.arrangeCity;
  const activeDays = state.days.filter((d) => cityMatches(d.city, activeCity));


  els.stagingArea.innerHTML = approved
    .filter((a) => cityMatches(a.city, activeCity) && !state.placements[a.id]?.dayId)
    .map(makeStagingCard)
    .join('');

  els.dayColumns.innerHTML = activeDays.map((d) => {
    const dt = parseYmdAsLocal(d.date);
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

    const cityObj = state.cities.find((c) => cityMatches(c.name, d.city));
    const dayLogistics = getLogisticsForDay(cityObj, d.date);
    const accLabel = getAccommodationLabel(d.city, d.date);
    const arrId = logisticsArrivalId(d.city);
    const depId = logisticsDepartureId(d.city);
    const arrAccId = logisticsAccommodationArrivalId(d.city);
    const depAccId = logisticsAccommodationDepartureId(d.city);
    const cardH = getLogisticsCardHeight();

    let html = '';

    if (dayLogistics?.isArrival) {
      const arrivalLabel = dayLogistics.arrivalLocation || 'Arrival';
      // 1. Arrival location card
      html += makeLogisticsCard(`Arrive: ${arrivalLabel}`, '<i class="ph-bold ph-airplane-landing" aria-hidden="true"></i>', dayLogistics.arrivalTime);
      // 2. Commute: arrival → accommodation
      html += makeLogisticsCommuteIndicator(arrId, arrAccId, dayLogistics.arrivalTime, cardH);
      // 3. Accommodation card (positioned after arrival + commute)
      const arrToAccCommute = state.commutes[commutePairKey(arrId, arrAccId)] || null;
      const arrToAccMins = resolveSelectedCommuteDetails(arrToAccCommute)?.durationMinutes || 0;
      const accArrivalMins = minutesFromTime(dayLogistics.arrivalTime) + arrToAccMins;
      const accArrivalTime = timeFromMinutes(accArrivalMins);
      html += makeLogisticsCard(accLabel, '<i class="ph-bold ph-bed" aria-hidden="true"></i>', accArrivalTime);
      // 4. Commute: accommodation → first activity
      if (items.length > 0) {
        html += makeLogisticsCommuteIndicator(arrAccId, items[0].id, accArrivalTime, cardH);
      }
    }

    items.forEach((item, index) => {
      html += makePlacedCard(item);
      if (index < items.length - 1) {
        html += makeCommuteIndicator(item, items[index + 1]);
      }
    });

    if (dayLogistics?.isDeparture) {
      const departureLabel = dayLogistics.departureLocation || 'Departure';
      if (items.length > 0) {
        const lastItem = items[items.length - 1];
        const lastPlacement = state.placements[lastItem.id] || {};
        const lastTime = parseTimeTo24(lastPlacement.time || actPreferredTime(lastItem) || typeToTime(lastItem.type));
        const lastEndMins = minutesFromTime(lastTime) + Math.max(30, actDurationHours(lastItem) * 60);
        // 1. Commute: last activity → accommodation
        html += makeLogisticsCommuteIndicator(lastItem.id, depAccId, timeFromMinutes(lastEndMins), 0);
      }
      // 2. Accommodation card (positioned before departure - commute)
      const accToDepCommute = state.commutes[commutePairKey(depAccId, depId)] || null;
      const accToDepMins = resolveSelectedCommuteDetails(accToDepCommute)?.durationMinutes || 0;
      const accDepartureMins = minutesFromTime(dayLogistics.departureTime) - accToDepMins;
      const accDepartureTime = timeFromMinutes(Math.max(0, accDepartureMins));
      html += makeLogisticsCard(accLabel, '<i class="ph-bold ph-bed" aria-hidden="true"></i>', accDepartureTime);
      // 3. Commute: accommodation → departure
      html += makeLogisticsCommuteIndicator(depAccId, depId, accDepartureTime, cardH);
      // 4. Departure location card
      html += makeLogisticsCard(`Depart: ${departureLabel}`, '<i class="ph-bold ph-airplane-takeoff" aria-hidden="true"></i>', dayLogistics.departureTime);
    }

    schedule.innerHTML = html;
  });

  bindCommuteInteractions();

  _arrangeSortables.push(new Sortable(els.stagingArea, {
    group: 'itinerary',
    sort: false,
    animation: 120,
    onStart: (evt) => {
      const id = evt.item?.dataset.id;
      if (!id) return;
      evt.item.dataset.dragActivityId = id;
      evt.item.dataset.prevPlacement = JSON.stringify(state.placements[id] || { dayId: null, time: null });
    }
  }));

  document.querySelectorAll('.day-schedule').forEach((zone) => {
    _arrangeSortables.push(new Sortable(zone, {
      group: 'itinerary',
      sort: false,
      animation: 120,
      onStart: (evt) => {
        const id = evt.item?.dataset.id;
        if (!id) return;
        evt.item.dataset.dragActivityId = id;
        evt.item.dataset.prevPlacement = JSON.stringify(state.placements[id] || { dayId: null, time: null });
      },
      onEnd: (evt) => {
        if (evt.item) {
          if (Sortable?.utils?.deselect) Sortable.utils.deselect(evt.item);
          evt.item.style.transform = '';
          evt.item.style.opacity = '';
        }

        clearActivePlacedCardDrag();

        const id = evt.item?.dataset.id;
        if (!id) return;

        if (evt.to !== zone || evt.item?.parentElement !== zone) {
          delete evt.item.dataset.prevPlacement;
          return;
        }

        if (evt.item.dataset.dropHandled === '1') {
          delete evt.item.dataset.prevPlacement;
          return;
        }
        evt.item.dataset.dropHandled = '1';
        setTimeout(() => {
          if (evt.item) delete evt.item.dataset.dropHandled;
        }, 0);

        const dayId = zone.id.replace('schedule-', '');
        const prevPlacement = (() => {
          try {
            return JSON.parse(evt.item.dataset.prevPlacement || 'null');
          } catch {
            return null;
          }
        })() || { ...(state.placements[id] || {}), dayId: null, time: null };

        const y = (evt.originalEvent?.clientY || evt.item.getBoundingClientRect().top) - zone.getBoundingClientRect().top;
        const nextPlacement = {
          ...(state.placements[id] || {}),
          dayId,
          time: timeFromY(y)
        };

        if (hasOverlapInDay(id, dayId, nextPlacement)) {
          state.placements[id] = {
            ...(state.placements[id] || {}),
            dayId: prevPlacement.dayId || null,
            time: prevPlacement.time || parseTimeTo24(actPreferredTime(state.activities.find((a) => a.id === id)) || typeToTime(state.activities.find((a) => a.id === id)?.type))
          };
          showToast('Overlap detected, placement reverted', 'info');
          delete evt.item.dataset.prevPlacement;
          renderArrange();
          return;
        }

        const previousDayId = state.placements[id]?.dayId || null;
        const previousTime = state.placements[id]?.time || null;

        state.placements[id] = nextPlacement;
        delete evt.item.dataset.prevPlacement;

        if (previousDayId === nextPlacement.dayId && previousTime === nextPlacement.time) return;

        renderArrange();
      }
    }));
  });

  bindPlacedCardInteractions();
}

async function fetchCommutesForActivities(activities = []) {
  if (!Array.isArray(activities) || activities.length < 2) return [];
  try {
    const res = await apiFetch('/api/commute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities })
    });
    const data = await res.json();
    return Array.isArray(data?.commutes) ? data.commutes : [];
  } catch {
    return [];
  }
}

function enforceDayTimeBoundaries(dayId) {
  const day = state.days.find((d) => d.id === dayId);
  if (!day) return;

  const city = state.cities.find((c) => cityMatches(c.name, day.city));
  if (!city) return;

  const dayStartMinutes = getCityDayWindowStart(city, day.date);
  const dayEndMinutes = getCityDayWindowEnd(city, day.date);

  const orderedActivities = state.activities
    .filter((a) => state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId === dayId)
    .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)));

  orderedActivities.forEach((activity) => {
    const isDepartureActivity = /\b(depart|departure)\b/i.test(String(activity.name || ''));
    if (isDepartureActivity && city.endDate === day.date) {
      state.placements[activity.id] = {
        ...(state.placements[activity.id] || {}),
        dayId,
        time: timeFromMinutes(dayEndMinutes)
      };
      return;
    }

    const durationMinutes = Math.max(30, actDurationHours(activity) * 60);
    const currentStart = minutesFromTime(parseTimeTo24(state.placements[activity.id]?.time || actPreferredTime(activity) || typeToTime(activity.type)));
    const latestStart = Math.max(dayStartMinutes, dayEndMinutes - durationMinutes);
    const boundedStart = Math.max(dayStartMinutes, Math.min(currentStart, latestStart));
    state.placements[activity.id] = {
      ...(state.placements[activity.id] || {}),
      dayId,
      time: timeFromMinutes(boundedStart)
    };
  });
}

function getAccommodationForDay(cityName) {
  const city = state.cities.find((c) => cityMatches(c.name, cityName));
  return city?.accommodation?.address ? city.accommodation : null;
}

function recalculateDayFromIndex(dayId, startIndex = 1) {
  if (!dayId) return;
  const orderedActivities = state.activities
    .filter((a) => state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId === dayId)
    .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)));

  for (let i = Math.max(1, startIndex); i < orderedActivities.length; i += 1) {
    const previous = orderedActivities[i - 1];
    const current = orderedActivities[i];
    const commute = state.commutes[commutePairKey(previous.id, current.id)];
    const selected = resolveSelectedCommuteDetails(commute);
    if (!selected || !Number.isFinite(selected.durationMinutes)) continue;

    const prevStart = minutesFromTime(parseTimeTo24(state.placements[previous.id]?.time || actPreferredTime(previous) || typeToTime(previous.type)));
    const prevDurationMinutes = actDurationHours(previous) * 60;
    const currentStart = minutesFromTime(parseTimeTo24(state.placements[current.id]?.time || actPreferredTime(current) || typeToTime(current.type)));
    const minByTravel = prevStart + prevDurationMinutes + selected.durationMinutes;

    state.placements[current.id] = {
      ...(state.placements[current.id] || {}),
      dayId,
      time: timeFromMinutes(Math.max(currentStart, minByTravel))
    };
  }

  enforceDayTimeBoundaries(dayId);
}

async function updateCommutesForCityDays(dayIds = []) {
  for (const dayId of dayIds) {
    const day = state.days.find((d) => d.id === dayId);
    if (!day) continue;
    const accommodation = getAccommodationForDay(day.city, day.date);
    const accommodationLocation = String(accommodation?.address || '').trim();
    const orderedActivities = state.activities
      .filter((a) => state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId === dayId)
      .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)));

    const cityObj = state.cities.find((c) => cityMatches(c.name, day.city));
    const { arrival, arrivalAccommodation, departure, departureAccommodation } = buildLogisticsPseudoActivities(cityObj, day.date, day.city);
    const payloadActivities = orderedActivities.map((a) => ({
      id: a.id, name: a.name, city: a.city,
      start_location: actAddress(a),
      accommodation_location: accommodationLocation,
      hotel_location: accommodationLocation,
      hotel_latitude: normalizeCoordinate(accommodation?.latitude),
      hotel_longitude: normalizeCoordinate(accommodation?.longitude),
      suggested_time: state.placements[a.id]?.time || parseTimeTo24(actPreferredTime(a) || typeToTime(a.type))
    }));

    const fullPayload = [
      ...(arrival && arrivalAccommodation ? [arrival, arrivalAccommodation] : arrival ? [arrival] : []),
      ...payloadActivities,
      ...(departure && departureAccommodation ? [departureAccommodation, departure] : departure ? [departure] : [])
    ];

    if (fullPayload.length < 2) continue;

    // Clear all commute keys involving any ID in this payload
    const payloadIds = new Set(fullPayload.map((p) => p.id));
    Object.keys(state.commutes).forEach((key) => {
      const [fromId, toId] = key.split('->');
      if (payloadIds.has(fromId) || payloadIds.has(toId)) delete state.commutes[key];
    });

    const commutes = await fetchCommutesForActivities(fullPayload);
    commutes.forEach((c) => {
      const selectedMode = resolveSelectedCommuteMode(c);
      const selected = c?.modes?.[selectedMode] || {};
      state.commutes[commutePairKey(c.fromId, c.toId)] = {
        ...c, selectedMode,
        durationMinutes: Number.isFinite(Number(selected.durationMinutes)) ? Number(selected.durationMinutes) : null,
        modeIcon: selected.modeIcon || '🚇'
      };
    });
  }
}

function renderArrangeDiagnostics() {
  if (!els.arrangeDiagnostics) return;
  const activeCity = state.arrangeCity;
  const diagnostics = state.arrangeDiagnostics[activeCity] || [];
  if (!diagnostics.length) {
    els.arrangeDiagnostics.innerHTML = '<p>Auto-arrange uses durations, category defaults, and opening hours to place activities.</p>';
    return;
  }
  els.arrangeDiagnostics.innerHTML = `<ul>${diagnostics.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`;
}

async function autoArrangeActiveCity() {
  const activeCity = state.arrangeCity;
  if (!activeCity) return;

  const activeDays = state.days
    .filter((d) => cityMatches(d.city, activeCity))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!activeDays.length) return;

  const approvedInCity = state.activities
    .filter((a) => state.reviewed[a.id]?.approved && cityMatches(a.city, activeCity))
    .map((a) => normalizeActivityMetadata(a));

  const hasExistingPlacements = approvedInCity.some((a) => state.placements[a.id]?.dayId);
  if (hasExistingPlacements) {
    const confirmed = await showConfirmDialog('Replace arrangement?', 'This will replace your current schedule for this city.', 'Replace');
    if (!confirmed) return;
  }

  const cityPlan = state.cities.find((c) => cityMatches(c.name, activeCity));

  const cityLogistics = cityPlan?.logistics || {};
  const arrivalLocation = String(cityLogistics.arrival?.location || '').trim() || 'arrival point';
  const departureLocation = String(cityLogistics.departure?.location || '').trim() || 'departure point';
  const primaryAccommodation = cityPlan?.accommodation;
  const accommodationLabel = String(primaryAccommodation?.address || '').trim() || 'accommodation';

  // Fetch arrival→accommodation and accommodation→departure commute durations via Google Maps
  const arrLogistics = buildLogisticsPseudoActivities(cityPlan, cityPlan?.startDate, activeCity);
  const depLogistics = buildLogisticsPseudoActivities(cityPlan, cityPlan?.endDate, activeCity);
  const [arrivalCommutes, departureCommutes] = await Promise.all([
    arrLogistics.arrival && arrLogistics.arrivalAccommodation
      ? fetchCommutesForActivities([arrLogistics.arrival, arrLogistics.arrivalAccommodation])
      : [],
    depLogistics.departureAccommodation && depLogistics.departure
      ? fetchCommutesForActivities([depLogistics.departureAccommodation, depLogistics.departure])
      : []
  ]);

  let arrivalTransitMins = 0;
  const arrCommute = resolveSelectedCommuteDetails(arrivalCommutes[0]);
  if (arrCommute && Number.isFinite(arrCommute.durationMinutes)) arrivalTransitMins = arrCommute.durationMinutes;

  let departureTransitMins = 0;
  const depCommute = resolveSelectedCommuteDetails(departureCommutes[0]);
  if (depCommute && Number.isFinite(depCommute.durationMinutes)) departureTransitMins = depCommute.durationMinutes;

  const dayPayload = activeDays.map((day) => {
    const startMins = getCityDayWindowStart(cityPlan, day.date);
    const endMins = getCityDayWindowEnd(cityPlan, day.date);
    const isArrival = day.date === cityPlan?.startDate;
    const isDeparture = day.date === cityPlan?.endDate;
    const label = isArrival && isDeparture ? 'arrival + departure day'
      : isArrival ? 'arrival day'
      : isDeparture ? 'departure day'
      : 'full day';

    const fixedStart = isArrival
      ? { label: `Transit: ${arrivalLocation} → ${accommodationLabel}`, time: timeFromMinutes(startMins + arrivalTransitMins) }
      : null;
    const fixedEnd = isDeparture
      ? { label: `Transit: ${accommodationLabel} → ${departureLocation}`, time: timeFromMinutes(endMins - departureTransitMins) }
      : null;

    return { date: day.date, label, windowStart: timeFromMinutes(startMins), windowEnd: timeFromMinutes(endMins), fixedStart, fixedEnd };
  });

  approvedInCity.forEach((a) => {
    state.activities = state.activities.map((current) => (current.id === a.id ? a : current));
    state.placements[a.id] = { ...(state.placements[a.id] || {}), dayId: null, time: null };
  });

  els.autoArrangeBtn.disabled = true;
  els.autoArrangeBtn.textContent = 'Arranging…';

  try {
    const res = await apiFetch('/api/arrange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        days: dayPayload,
        activities: approvedInCity.map((a) => {
          return a;
        }),
        userId: ensureUserId(),
        profile: getProfilePayload(),
        budget: state.tripBudget,
        numTravelers: state.numTravelers,
        numChildren: state.numChildren,
        approvedCostTotal: computeApprovedCost(approvedInCity)
      })
    });

    if (!res.ok) throw new Error('Arrange request failed');
    const { placements, unplaced = [] } = await res.json();

    const dateToDay = Object.fromEntries(activeDays.map((d) => [d.date, d]));
    for (const [id, placement] of Object.entries(placements || {})) {
      const day = dateToDay[placement.date];
      if (day) {
        state.placements[id] = { dayId: day.id, time: placement.time };
        // Update booking link dates to use the actual scheduled date
        const activity = state.activities.find((a) => a.id === id);
        if (activity) {
          const links = actBookingLinks(activity);
          const updated = links.map((l) => {
            const url = new URL(l.url);
            if (l.site === 'GetYourGuide') url.searchParams.set('date_from', placement.date);
            if (l.site === 'Viator') url.searchParams.set('startDate', placement.date);
            return { ...l, url: url.toString() };
          });
          if (activity.booking != null) activity.booking.links = updated;
          else activity.booking_links = updated;
        }
      }
    }

    state.arrangeDiagnostics[activeCity] = unplaced.map((u) => {
      const a = approvedInCity.find((x) => x.id === u.id);
      return a ? `${a.name}: unplaced — ${u.reason}` : null;
    }).filter(Boolean);
  } catch (e) {
    showToast(e?.message || 'Failed to arrange activities.', 'error');
  } finally {
    els.autoArrangeBtn.disabled = false;
    els.autoArrangeBtn.textContent = 'Auto Arrange';
  }

  const activeDayIds = activeDays.map((d) => d.id);
  await updateCommutesForCityDays(activeDayIds);
  renderArrange();
}

let activePlacedCardDragCleanup = null;
let placedCardDragMouseupFallbackBound = false;
let placedTooltipLayer = null;
let currentDragMode = null;

function ensurePlacedTooltipLayer() {
  if (placedTooltipLayer && document.body.contains(placedTooltipLayer)) return placedTooltipLayer;
  placedTooltipLayer = document.createElement('div');
  placedTooltipLayer.className = 'placed-tooltip-layer';
  placedTooltipLayer.setAttribute('role', 'tooltip');
  document.body.appendChild(placedTooltipLayer);
  window.addEventListener('scroll', hidePlacedTooltip, true);
  window.addEventListener('resize', hidePlacedTooltip);
  return placedTooltipLayer;
}

function positionPlacedTooltip(anchorEl) {
  if (!placedTooltipLayer || !anchorEl) return;
  const spacing = 8;
  const rect = anchorEl.getBoundingClientRect();
  const tooltipRect = placedTooltipLayer.getBoundingClientRect();

  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
  let top = rect.top - tooltipRect.height - spacing;

  if (left < 8) left = 8;
  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = window.innerWidth - tooltipRect.width - 8;
  }

  if (top < 8) {
    top = rect.bottom + spacing;
  }

  placedTooltipLayer.style.left = `${left}px`;
  placedTooltipLayer.style.top = `${top}px`;
}

function showPlacedTooltip(anchorEl) {
  if (!anchorEl) return;
  const layer = ensurePlacedTooltipLayer();
  layer.innerHTML = `
    <div class="placed-tooltip-title">${anchorEl.dataset.tooltipName || ''}</div>
    <div class="placed-tooltip-row"><strong>Type:</strong> ${anchorEl.dataset.tooltipTypeIcon || ''} ${anchorEl.dataset.tooltipType || ''}</div>
    <div class="placed-tooltip-row"><strong>Duration:</strong> ${anchorEl.dataset.tooltipDuration || ''}</div>
    <div class="placed-tooltip-row"><strong>Verdict:</strong> ${anchorEl.dataset.tooltipVerdict || 'N/A'}</div>
    <div class="placed-tooltip-row"><strong>Start:</strong> ${anchorEl.dataset.tooltipStartLocation || '—'}</div>
    <div class="placed-tooltip-row"><strong>End:</strong> ${anchorEl.dataset.tooltipEndLocation || '—'}</div>
    <div class="placed-tooltip-row"><strong>Why it fits:</strong> ${anchorEl.dataset.tooltipWhy || ''}</div>
  `;
  layer.classList.add('visible');
  positionPlacedTooltip(anchorEl);
}

function hidePlacedTooltip() {
  if (!placedTooltipLayer) return;
  placedTooltipLayer.classList.remove('visible');
}

function clearActivePlacedCardDrag() {
  if (typeof activePlacedCardDragCleanup === 'function') {
    activePlacedCardDragCleanup();
  }
  activePlacedCardDragCleanup = null;
}

function bindPlacedCardInteractions() {
  if (!placedCardDragMouseupFallbackBound) {
    document.addEventListener('mouseup', () => {
      clearActivePlacedCardDrag();
    });
    placedCardDragMouseupFallbackBound = true;
  }

  const HOLD_DELAY_MS = 100;
  const MOVE_THRESHOLD_PX = 5;
  const RESIZE_EDGE_PX = 14;

  document.querySelectorAll('.placed-card').forEach((card) => {
    const id = card.dataset.id;
    const schedule = card.closest('.day-schedule');
    const dayId = schedule?.id.replace('schedule-', '');
    if (!id || !schedule || !dayId) return;

    const inResizeEdge = (clientY) => {
      const cardRect = card.getBoundingClientRect();
      const isNearBottom = clientY >= (cardRect.bottom - RESIZE_EDGE_PX) && clientY <= cardRect.bottom;
      const isNearTop = clientY >= cardRect.top && clientY <= (cardRect.top + RESIZE_EDGE_PX);
      return isNearBottom || isNearTop;
    };

    const onHoverMove = (ev) => {
      card.classList.toggle('resize-hover', inResizeEdge(ev.clientY));
    };

    card.addEventListener('mousemove', onHoverMove);
    card.addEventListener('mouseleave', () => {
      card.classList.remove('resize-hover');
    });

    const infoWrap = card.querySelector('.placed-info-wrap');
    if (infoWrap) {
      infoWrap.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      infoWrap.addEventListener('mouseenter', () => showPlacedTooltip(infoWrap));
      infoWrap.addEventListener('focus', () => showPlacedTooltip(infoWrap));
      infoWrap.addEventListener('mouseleave', hidePlacedTooltip);
      infoWrap.addEventListener('blur', hidePlacedTooltip);
    }

    card.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      e.preventDefault();
      hidePlacedTooltip();

      clearActivePlacedCardDrag();

      const cardRect = card.getBoundingClientRect();
      const clickY = e.clientY;
      const isNearBottom = clickY > (cardRect.bottom - RESIZE_EDGE_PX);
      const isNearTop = clickY < (cardRect.top + RESIZE_EDGE_PX);
      currentDragMode = (isNearBottom || isNearTop) ? 'resize' : 'move';

      const rect = schedule.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const startHeight = card.offsetHeight;
      const currentTop = Number.parseFloat(card.style.top) || yFromTime(state.placements[id]?.time);
      const maxHeight = Math.max(28, GRID_HEIGHT - currentTop);
      let holdReady = false;
      let isDragging = false;

      const holdTimer = setTimeout(() => {
        holdReady = true;
      }, HOLD_DELAY_MS);

      const updateCardPosition = (ev) => {
        const y = ev.clientY - rect.top;
        state.placements[id] = { ...(state.placements[id] || {}), dayId, time: timeFromY(y) };
        const nextY = yFromTime(state.placements[id].time);
        card.style.top = `${nextY}px`;
      };

      const updateCardDuration = (ev) => {
        const rawHeight = startHeight + (ev.clientY - startY);
        const clampedHeight = Math.max(28, Math.min(maxHeight, rawHeight));
        const roundedMinutes = Math.max(30, Math.round((clampedHeight / PX_PER_HOUR) * 2) * 30);
        const snappedHeight = (roundedMinutes / 60) * PX_PER_HOUR;
        const nextDurationHours = roundedMinutes / 60;

        card.style.height = `${snappedHeight}px`;

        const activity = state.activities.find((a) => a.id === id);
        if (activity) {
          if (activity.timing != null) {
            activity.timing.duration_minutes = roundedMinutes;
          } else {
            activity.duration_hours = nextDurationHours;
          }
        }
      };

      const move = (ev) => {
        ev.stopPropagation();
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const movedDistance = Math.hypot(dx, dy);

        if (!isDragging) {
          if (!holdReady || movedDistance < MOVE_THRESHOLD_PX) return;
          isDragging = true;
        }

        if (currentDragMode === 'resize') {
          updateCardDuration(ev);
        } else {
          updateCardPosition(ev);
        }
      };

      const up = (ev) => {
        ev.stopPropagation();
        clearTimeout(holdTimer);
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        activePlacedCardDragCleanup = null;

        card.classList.remove('resize-hover');
        currentDragMode = null;
        if (isDragging) renderArrange();
      };

      activePlacedCardDragCleanup = () => {
        clearTimeout(holdTimer);
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        card.classList.remove('resize-hover');
        currentDragMode = null;
      };

      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  });
}

function paceLabel(totalHours) {
  if (totalHours < 4) return { label: 'Light day', className: 'pace-light' };
  if (totalHours <= 7) return { label: 'Balanced day', className: 'pace-balanced' };
  return { label: 'Packed day', className: 'pace-packed' };
}

function renderItineraryInsights(approvedActivities) {
  if (!els.itineraryInsights) return;
  if (!state.days.length) {
    els.itineraryInsights.innerHTML = '';
    return;
  }

  const cards = state.days.map((day) => {
    const items = approvedActivities
      .filter((a) => state.placements[a.id]?.dayId === day.id)
      .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)));

    const activityHours = items.reduce((sum, item) => sum + actDurationHours(item), 0);
    let commuteMinutes = 0;
    for (let i = 1; i < items.length; i += 1) {
      const commute = state.commutes[commutePairKey(items[i - 1].id, items[i].id)] || getIncomingCommuteForActivity(items[i].id);
      const selected = resolveSelectedCommuteDetails(commute);
      if (selected?.durationMinutes) commuteMinutes += Number(selected.durationMinutes);
    }

    const pace = paceLabel(activityHours);
    return `
      <article class="itinerary-insight-card">
        <h4>${esc(day.date)} • ${esc(day.city)}</h4>
        <p><strong>${items.length}</strong> activities</p>
        <p><strong>${activityHours.toFixed(1)}h</strong> planned activity time</p>
        <p><strong>${commuteMinutes} min</strong> commute time</p>
        <span class="pace-pill ${pace.className}">${pace.label}</span>
      </article>
    `;
  });

  els.itineraryInsights.innerHTML = cards.join('');
}

function renderItinerary() {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  renderItineraryInsights(approved);
  els.itineraryGrid.innerHTML = state.days.map((d) => {
    const items = approved
      .filter((a) => state.placements[a.id]?.dayId === d.id)
      .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)))
      .map((a) => `
        <div class="item">
          <h4>${esc(a.name)}</h4>
          <p><strong>Time:</strong> ${esc(state.placements[a.id]?.time || parseTimeTo24(actPreferredTime(a) || typeToTime(a.type)))}</p>
          <p><strong>Duration:</strong> ${esc(formatDuration(actDurationHours(a)))}</p>
          <p><strong>Type:</strong> ${esc(a.type)}</p>
          <p><strong>Why:</strong> ${esc(a.why_it_fits || '')}</p>
        </div>
      `)
      .join('');
    const accommodation = getAccommodationForDay(d.city, d.date);
    const accommodationInfo = accommodation
      ? `<p class="muted-text"><strong>Accommodation:</strong> ${esc(accommodation.address || 'Address missing')}</p>`
      : '';
    return `<section class="day-col"><div class="day-head">${d.date} • ${esc(d.city)}</div><div class="list">${accommodationInfo}${items || '<em>No activities assigned.</em>'}</div></section>`;
  }).join('');

  renderItineraryMode();
  renderConfidence();
}

function formatTimeRangeLabel(startMinutes, endMinutes) {
  const fmt = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = (h % 12) || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  if (!Number.isFinite(startMinutes)) return '';
  if (!Number.isFinite(endMinutes) || endMinutes <= startMinutes) return fmt(startMinutes);
  return `${fmt(startMinutes)} – ${fmt(endMinutes)}`;
}

function getActivityReferenceNum(activityId) {
  const items = Array.isArray(state.confidenceChecklist) ? state.confidenceChecklist : [];
  const match = items.find((x) => x && x.type === 'activity' && x.activityId === activityId);
  return match ? String(match.referenceNum || '').trim() : '';
}

function getItemAttachments(itemId) {
  const list = state.attachmentsByItem?.[itemId];
  return Array.isArray(list) ? list : [];
}

function setItemAttachments(itemId, list) {
  if (!state.attachmentsByItem) state.attachmentsByItem = {};
  state.attachmentsByItem[itemId] = Array.isArray(list) ? list : [];
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
}

function formatDateTimeLabel(dateStr, timeStr) {
  const date = formatDateShort(dateStr);
  if (!timeStr) return date;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (!Number.isFinite(h)) return date;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = (h % 12) || 12;
  const timeFmt = `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
  return date ? `${date}, ${timeFmt}` : timeFmt;
}

function getItineraryRows() {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  return approved
    .map((activity) => {
      const placement = state.placements[activity.id] || {};
      const day = state.days.find((d) => d.id === placement.dayId);
      if (!day) return null;

      const startTime = placement.time || parseTimeTo24(actPreferredTime(activity) || typeToTime(activity.type));
      const range = getPlacementTimeRange(activity, placement);
      const timeLabel = formatTimeRangeLabel(range.startMinutes, range.endMinutes);
      const location = actAddress(activity) || activity.city || '';
      const locationQuery = location || `${activity.name} ${activity.city || ''}`;
      const navigateHref = location || activity.name
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`
        : '';
      const notes = String(state.reviewed[activity.id]?.notes || '').trim();
      const referenceNum = getActivityReferenceNum(activity.id);

      return {
        id: activity.id,
        date: day.date,
        city: day.city,
        startTime,
        timeLabel,
        title: activity.name,
        location,
        notes,
        referenceNum,
        navigateHref,
        fileCount: getItemAttachments(activity.id).length
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aKey = `${a.date}T${parseTimeTo24(a.startTime)}`;
      const bKey = `${b.date}T${parseTimeTo24(b.startTime)}`;
      return new Date(aKey).getTime() - new Date(bKey).getTime();
    });
}

function buildNavigateHref(location) {
  return location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : '';
}

function getCityAccomTravelRows(city, cityIdx) {
  const rows = [];
  const logistics = city?.logistics || {};
  const accommodation = city?.accommodation || {};
  const logAcc = logistics.accommodation || {};
  const arrival = logistics.arrival || {};
  const departure = logistics.departure || {};

  const address = String(accommodation.address || '').trim();
  if (address || logAcc.checkIn || logAcc.checkOut) {
    const inFmt = formatDateShort(logAcc.checkIn);
    const outFmt = formatDateShort(logAcc.checkOut);
    const timeLabel = [inFmt, outFmt].filter(Boolean).join(' → ');
    rows.push({
      id: `acc_${cityIdx}`,
      title: address || 'Accommodation',
      timeLabel,
      location: '',
      notes: '',
      referenceNum: '',
      navigateHref: buildNavigateHref(address),
      fileCount: getItemAttachments(`acc_${cityIdx}`).length
    });
  }

  if (arrival.location || arrival.date || arrival.time) {
    const loc = String(arrival.location || '').trim();
    rows.push({
      id: `arr_${cityIdx}`,
      title: loc ? `Arrival: ${loc}` : 'Arrival',
      timeLabel: formatDateTimeLabel(arrival.date, arrival.time),
      location: '',
      notes: '',
      referenceNum: '',
      navigateHref: buildNavigateHref(loc),
      fileCount: getItemAttachments(`arr_${cityIdx}`).length
    });
  }

  if (departure.location || departure.date || departure.time) {
    const loc = String(departure.location || '').trim();
    rows.push({
      id: `dep_${cityIdx}`,
      title: loc ? `Departure: ${loc}` : 'Departure',
      timeLabel: formatDateTimeLabel(departure.date, departure.time),
      location: '',
      notes: '',
      referenceNum: '',
      navigateHref: buildNavigateHref(loc),
      fileCount: getItemAttachments(`dep_${cityIdx}`).length
    });
  }

  return rows;
}

function getConsolidatedConfirmations() {
  const rows = [];
  state.cities.forEach((city) => {
    const cityName = String(city?.name || '').trim();
    const logistics = city?.logistics || {};
    const accommodation = city?.accommodation || {};

    if (accommodation?.address) {
      rows.push({
        city: cityName,
        type: 'Accommodation',
        title: accommodation.address,
        meta: [accommodation.checkIn, accommodation.checkOut].filter(Boolean).join(' → ')
      });
    }

    if (logistics?.arrival?.location || logistics?.arrival?.time) {
      rows.push({
        city: cityName,
        type: 'Arrival',
        title: logistics.arrival.location || 'Arrival location',
        meta: [logistics.arrival.date, logistics.arrival.time].filter(Boolean).join(' • ')
      });
    }

    if (logistics?.departure?.location || logistics?.departure?.time) {
      rows.push({
        city: cityName,
        type: 'Departure',
        title: logistics.departure.location || 'Departure location',
        meta: [logistics.departure.date, logistics.departure.time].filter(Boolean).join(' • ')
      });
    }
  });

  return rows;
}

function getMinimalPayload() {
  const itineraryRows = getItineraryRows();
  const confirmations = getConsolidatedConfirmations();
  const firstDate = state.days[0]?.date || '';
  const lastDate = state.days[state.days.length - 1]?.date || '';
  return {
    itineraryId: state.currentItineraryId || '',
    tripName: state.tripName || 'Untitled Trip',
    generatedAt: new Date().toISOString(),
    firstDate,
    lastDate,
    cities: [...new Set(state.days.map((d) => d.city).filter(Boolean))],
    itemCount: itineraryRows.length,
    itineraryRows,
    confirmations
  };
}

function getMinimalOfflineStore() {
  try {
    return JSON.parse(localStorage.getItem(MINIMAL_OFFLINE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMinimalOfflinePayload(payload) {
  const id = String(payload?.itineraryId || '').trim();
  if (!id) {
    showToast('Generate and save an itinerary first.', 'info');
    return;
  }

  const store = getMinimalOfflineStore();
  store[id] = payload;
  localStorage.setItem(MINIMAL_OFFLINE_KEY, JSON.stringify(store));
  showToast('Minimal itinerary saved for offline use.', 'success');
}

function loadMinimalOfflinePayload(id = '') {
  const key = String(id || '').trim();
  if (!key) return null;
  const store = getMinimalOfflineStore();
  return store[key] || null;
}

function copyMinimalItineraryText() {
  const payload = getMinimalPayload();
  const lines = [
    `${payload.tripName}`,
    payload.firstDate && payload.lastDate ? `${payload.firstDate} → ${payload.lastDate}` : '',
    '',
    'SCHEDULE',
    ...payload.itineraryRows.map((row) => `${row.date} ${row.timeLabel} • ${row.title}${row.location ? ` — ${row.location}` : ''}${row.referenceNum ? ` [ref ${row.referenceNum}]` : ''}`),
    '',
    'CONSOLIDATED CONFIRMATIONS',
    ...payload.confirmations.map((row) => `${row.type}: ${row.title}${row.meta ? ` (${row.meta})` : ''}${row.city ? ` [${row.city}]` : ''}`)
  ].filter(Boolean);

  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => showToast('Copied minimal itinerary.', 'success'))
    .catch(() => showToast('Could not copy itinerary text.', 'error'));
}

async function shareMinimalItinerary() {
  if (!state.currentItineraryId) {
    showToast('Save itinerary first to create a share link.', 'info');
    return;
  }

  const shareUrl = `${window.location.origin}/planner.html?itinerary=${encodeURIComponent(state.currentItineraryId)}&mode=itinerary`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${state.tripName || 'Trip'} — Itinerary`,
        text: 'Open this lightweight itinerary view',
        url: shareUrl
      });
      return;
    } catch {
      // fallback to clipboard below
    }
  }

  navigator.clipboard.writeText(shareUrl)
    .then(() => showToast('Share link copied.', 'success'))
    .catch(() => showToast('Could not copy share link.', 'error'));
}

function renderItineraryModeSummary(payload) {
  if (!els.itineraryModeSummary) return;
  const range = payload.firstDate && payload.lastDate ? `${payload.firstDate} → ${payload.lastDate}` : 'No date range';
  els.itineraryModeSummary.innerHTML = `
    <article class="itinerary-mode-summary-card">
      <h4>Trip</h4>
      <p>${esc(payload.tripName)}</p>
    </article>
    <article class="itinerary-mode-summary-card">
      <h4>Dates</h4>
      <p>${esc(range)}</p>
    </article>
    <article class="itinerary-mode-summary-card">
      <h4>Cities</h4>
      <p>${esc(payload.cities.join(', ') || '—')}</p>
    </article>
    <article class="itinerary-mode-summary-card">
      <h4>Items</h4>
      <p>${payload.itemCount}</p>
    </article>
  `;
}

function renderItineraryItemCard(row) {
  const hasRef = Boolean(row.referenceNum);
  const refText = hasRef ? row.referenceNum : 'No reference #';
  const viewDisabled = row.fileCount === 0;
  const fileCountText = row.fileCount ? ` (${row.fileCount})` : '';
  const navigateBtn = row.navigateHref
    ? `<a class="btn-ghost" href="${esc(row.navigateHref)}" target="_blank" rel="noopener noreferrer" data-action="navigate"><i class="ph-bold ph-navigation-arrow"></i> Navigate</a>`
    : '';
  return `
    <article class="itinerary-item" data-activity-id="${esc(row.id)}">
      <header class="itinerary-item-head">
        <h3 class="itinerary-title">${esc(row.title)}</h3>
        <time class="itinerary-time">${esc(row.timeLabel || '')}</time>
      </header>
      ${row.location ? `<div class="itinerary-subtitle">${esc(row.location)}</div>` : ''}
      ${row.notes ? `<p class="itinerary-notes">${esc(row.notes)}</p>` : ''}
      <div class="itinerary-reference${hasRef ? ' has-value' : ''}">
        <i class="ph-bold ph-ticket" aria-hidden="true"></i>
        <span>${esc(refText)}</span>
      </div>
      <div class="itinerary-file-actions">
        <button class="btn-ghost" type="button" data-action="upload-files">
          <i class="ph-bold ph-upload-simple"></i> Upload tickets
        </button>
        <button class="btn-ghost" type="button" data-action="view-files"${viewDisabled ? ' disabled' : ''}>
          <i class="ph-bold ph-folder-open"></i> View files${fileCountText}
        </button>
        ${navigateBtn}
      </div>
    </article>
  `;
}

function renderItineraryMode() {
  if (!els.itineraryModeList) return;
  const payload = getMinimalPayload();
  const rows = payload.itineraryRows;
  renderItineraryModeSummary(payload);

  const cityOrder = [];
  const cityIdxByName = new Map();
  (state.cities || []).forEach((city, idx) => {
    const name = String(city?.name || '').trim();
    if (!name || cityIdxByName.has(name)) return;
    cityIdxByName.set(name, idx);
    cityOrder.push(name);
  });
  rows.forEach((row) => {
    if (!cityIdxByName.has(row.city)) {
      cityIdxByName.set(row.city, cityIdxByName.size);
      cityOrder.push(row.city);
    }
  });

  if (!cityOrder.length) {
    els.itineraryModeList.innerHTML = '<p class="muted-text">No scheduled itinerary yet. Build your plan in Planning Mode first.</p>';
    return;
  }

  const rowsByCity = rows.reduce((acc, row) => {
    (acc[row.city] = acc[row.city] || []).push(row);
    return acc;
  }, {});

  const html = cityOrder.map((cityName) => {
    const cityIdx = cityIdxByName.get(cityName);
    const cityObj = (state.cities || []).find((c) => String(c?.name || '').trim() === cityName) || {};
    const accomTravelRows = getCityAccomTravelRows(cityObj, cityIdx);
    const cityRows = rowsByCity[cityName] || [];
    const dayGroups = cityRows.reduce((acc, row) => {
      (acc[row.date] = acc[row.date] || []).push(row);
      return acc;
    }, {});
    const dayOrder = Object.keys(dayGroups).sort();

    const accomTravelHtml = accomTravelRows.length
      ? `<section class="itinerary-city-block">
          <h4 class="itinerary-block-head">Accommodation &amp; Travel</h4>
          ${accomTravelRows.map(renderItineraryItemCard).join('')}
        </section>`
      : '';

    const daysHtml = dayOrder.map((date) => `
      <section class="itinerary-city-block">
        <h4 class="itinerary-block-head">${esc(formatDateShort(date))}</h4>
        ${dayGroups[date].map(renderItineraryItemCard).join('')}
      </section>
    `).join('');

    return `
      <section class="itinerary-city-group">
        <h3 class="itinerary-city-title">${esc(cityName)}</h3>
        ${accomTravelHtml}
        ${daysHtml}
      </section>
    `;
  }).join('');

  els.itineraryModeList.innerHTML = html;
}

function setViewMode(mode = 'planning') {
  const resolved = mode === 'itinerary' || mode === 'execution' ? 'itinerary' : 'planning';
  state.viewMode = resolved;
  localStorage.setItem(VIEW_MODE_KEY, resolved);
  syncToServer('viewMode', resolved);
  document.body.classList.toggle('itinerary-mode', resolved === 'itinerary');
  if (els.planningModeBtn) els.planningModeBtn.classList.toggle('active', resolved === 'planning');
  if (els.itineraryModeBtn) els.itineraryModeBtn.classList.toggle('active', resolved === 'itinerary');
  if (resolved === 'itinerary') {
    renderItineraryMode();
    if (state.currentItineraryId) {
      hydrateAttachmentsForItinerary(state.currentItineraryId).then(() => renderItineraryMode());
    }
  }
}

// ── Attachment helpers ───────────────────────────────────────────────

function mimeToPhosphorIcon(mimeType) {
  const m = String(mimeType || '').toLowerCase();
  if (m === 'application/pdf') return 'ph-file-pdf';
  if (m.startsWith('image/')) return 'ph-image';
  return 'ph-file';
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let _pendingUploadActivityId = null;
let _pendingUploadButton = null;

function setUploadBtnState(btn, stateKind) {
  if (!btn) return;
  btn.classList.remove('is-loading', 'is-success');
  btn.disabled = false;
  if (stateKind === 'loading') {
    btn.classList.add('is-loading');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Uploading…';
  } else if (stateKind === 'success') {
    btn.classList.add('is-success');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph-bold ph-check" aria-hidden="true"></i> Uploaded';
  } else {
    btn.innerHTML = '<i class="ph-bold ph-upload-simple" aria-hidden="true"></i> Upload tickets';
  }
}

async function uploadActivityAttachments(activityId, fileList, buttonEl = null) {
  if (!fileList?.length) return;
  setUploadBtnState(buttonEl, 'loading');

  if (!activityId) {
    setUploadBtnState(buttonEl, 'idle');
    showToast('Could not identify activity. Please refresh and try again.', 'error');
    return;
  }

  if (!state.currentItineraryId) {
    try {
      await generateItinerary();
    } catch {
      setUploadBtnState(buttonEl, 'idle');
      showToast('Save your trip first, then upload files.', 'error');
      return;
    }
    if (!state.currentItineraryId) {
      setUploadBtnState(buttonEl, 'idle');
      showToast('Save your trip first, then upload files.', 'error');
      return;
    }
  }

  const formData = new FormData();
  for (const f of fileList) formData.append('files', f);
  try {
    const res = await apiFetch(
      `/api/itinerary/${encodeURIComponent(state.currentItineraryId)}/activity/${encodeURIComponent(activityId)}/attachments`,
      { method: 'POST', body: formData }
    );
    if (res.status === 401) { setUploadBtnState(buttonEl, 'idle'); showToast('Sign in to upload files.', 'error'); return; }
    if (res.status === 404) { setUploadBtnState(buttonEl, 'idle'); showToast('Activity not found on the server. Try saving the trip again.', 'error'); return; }
    if (res.status === 413) { setUploadBtnState(buttonEl, 'idle'); showToast('File exceeds 10 MB limit.', 'error'); return; }
    if (res.status === 415) { setUploadBtnState(buttonEl, 'idle'); showToast('Unsupported file type.', 'error'); return; }
    if (!res.ok) {
      setUploadBtnState(buttonEl, 'idle');
      let msg = 'Upload failed.';
      try { const j = await res.json(); if (j?.error) msg = `Upload failed: ${j.error}`; } catch {}
      showToast(msg, 'error');
      return;
    }
    const data = await res.json();
    const added = Array.isArray(data?.attachments) ? data.attachments : [];
    setItemAttachments(activityId, [...getItemAttachments(activityId), ...added]);
    setUploadBtnState(buttonEl, 'success');
    setTimeout(() => renderItineraryMode(), 1000);
  } catch (err) {
    setUploadBtnState(buttonEl, 'idle');
    showToast(`Upload failed: ${err?.message || 'network error'}`, 'error');
  }
}

function openAttachmentViewer(activityId) {
  if (!els.attachmentViewerModal) return;
  const attachments = getItemAttachments(activityId);
  const activity = state.activities.find((a) => a.id === activityId);
  if (els.attachmentViewerTitle) {
    els.attachmentViewerTitle.textContent = `Attachments${activity?.name ? ` — ${activity.name}` : ''}`;
  }
  renderAttachmentViewerList(activityId, attachments);
  els.attachmentViewerModal.classList.remove('hidden');
}

function renderAttachmentViewerList(activityId, attachments) {
  if (!els.attachmentViewerList) return;
  if (!attachments.length) {
    els.attachmentViewerList.innerHTML = '<p class="muted-text">No files uploaded yet.</p>';
    return;
  }
  els.attachmentViewerList.innerHTML = attachments.map((att) => {
    const icon = mimeToPhosphorIcon(att.mimeType);
    return `
      <div class="attachment-row" data-attachment-id="${esc(att.id)}" data-activity-id="${esc(activityId)}">
        <i class="ph-bold ${icon} file-icon" aria-hidden="true"></i>
        <div class="attachment-meta">
          <span class="attachment-name" title="${esc(att.filename)}">${esc(att.filename)}</span>
          <span class="attachment-size">${esc(formatBytes(att.size))}</span>
        </div>
        <div class="attachment-actions">
          <a href="/api/attachments/${esc(att.id)}" target="_blank" rel="noopener noreferrer" class="secondary" style="padding:4px 10px;font-size:.84rem;">Open</a>
          <button class="icon-btn red" type="button" data-action="delete-attachment" title="Delete file"><i class="ph-bold ph-trash" aria-hidden="true"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteAttachment(activityId, attachmentId) {
  try {
    const res = await apiFetch(`/api/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Could not delete file.', 'error'); return; }
    const remaining = getItemAttachments(activityId).filter((a) => a.id !== attachmentId);
    setItemAttachments(activityId, remaining);
    renderAttachmentViewerList(activityId, remaining);
    renderItineraryMode();
    showToast('File deleted.', 'success');
  } catch {
    showToast('Could not delete file.', 'error');
  }
}

async function hydrateAttachmentsForItinerary(itineraryId) {
  if (!itineraryId) return;
  try {
    const res = await apiFetch(`/api/itinerary/${encodeURIComponent(itineraryId)}/attachments`);
    if (!res.ok) return;
    const data = await res.json();
    const attachments = Array.isArray(data?.attachments) ? data.attachments : [];
    const grouped = {};
    for (const att of attachments) {
      const key = String(att.activityId || '');
      if (!key) continue;
      (grouped[key] = grouped[key] || []).push(att);
    }
    state.attachmentsByItem = grouped;
  } catch {
    // non-fatal
  }
}

// ── End attachment helpers ───────────────────────────────────────────

async function fetchSavedItineraries() {
  try {
    const res = await apiFetch('/api/itineraries');
    if (!res.ok) return;
    const data = await res.json();
    state.savedItineraries = Array.isArray(data?.itineraries) ? data.itineraries : [];
  } catch {
    state.savedItineraries = [];
  }
}

function renderSavedItineraries() {
  if (!els.savedItineraries) return;
  if (!state.savedItineraries.length) {
    els.savedItineraries.innerHTML = '<p class="muted-text">No saved itineraries yet.</p>';
    return;
  }

  els.savedItineraries.innerHTML = state.savedItineraries.map((item) => {
    const generatedDate = item.generatedAt
      ? new Date(item.generatedAt).toLocaleString()
      : 'Unknown date';
    const isCurrent = item.id === state.currentItineraryId;
    return `
      <article class="saved-itinerary-item ${isCurrent ? 'active' : ''}">
        <div>
          <h4>${esc(item.tripName || 'Untitled Trip')}</h4>
          <p>${esc(generatedDate)} • ${Number(item.days || 0)} days • ${Number(item.activityCount || 0)} activities</p>
        </div>
        <div class="saved-itinerary-actions">
          <button type="button" class="secondary" data-load-itinerary="${esc(item.id)}">Open</button>
          <button type="button" class="icon-btn red" data-delete-itinerary="${esc(item.id)}" title="Delete itinerary"><i class="ph-bold ph-trash" aria-hidden="true"></i></button>
        </div>
      </article>
    `;
  }).join('');

  els.savedItineraries.querySelectorAll('[data-load-itinerary]').forEach((btn) => {
    btn.addEventListener('click', () => {
      loadItineraryById(btn.dataset.loadItinerary);
    });
  });

  els.savedItineraries.querySelectorAll('[data-delete-itinerary]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteItinerary;
      if (!id) return;
      const confirmed = await showConfirmDialog('Delete itinerary?', 'This saved itinerary will be permanently deleted.', 'Delete');
      if (!confirmed) return;

      try {
        const res = await apiFetch(`/api/itinerary/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete itinerary');
        if (state.currentItineraryId === id) {
          state.currentItineraryId = null;
          state.itinerary = null;
          els.itineraryGrid.innerHTML = '';
          if (els.itineraryInsights) els.itineraryInsights.innerHTML = '';
          updateCalendarControls();
        }
        await fetchSavedItineraries();
        renderSavedItineraries();
        showToast('Itinerary deleted.', 'success');
      } catch {
        showToast('Could not delete itinerary.', 'error');
      }
    });
  });
}

async function loadItineraryById(id) {
  if (!id) return;
  try {
    const res = await apiFetch(`/api/itinerary/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok || !data?.itinerary) throw new Error('Failed to load itinerary');

    const itinerary = data.itinerary;
    state.itinerary = itinerary;
    state.currentItineraryId = itinerary.id || null;
    state.tripName = itinerary.tripName || state.tripName;
    state.tripBudget = itinerary.tripBudget ?? state.tripBudget;
    state.numTravelers = itinerary.numTravelers ?? state.numTravelers;
    state.numChildren = itinerary.numChildren ?? state.numChildren;
    if (els.tripName) els.tripName.value = state.tripName;
    if (els.tripBudget && state.tripBudget != null) els.tripBudget.value = state.tripBudget;
    if (els.numTravelers) els.numTravelers.value = state.numTravelers;
    if (els.numChildren) els.numChildren.value = state.numChildren;
    state.confidenceChecklist = Array.isArray(itinerary?.confidence?.checklist)
      ? itinerary.confidence.checklist.map(normalizeChecklistItem)
      : [];
    state.confidenceNotificationPrefs = itinerary?.confidence?.notificationPrefs || state.confidenceNotificationPrefs;
    state.confidenceIssueMeta = itinerary?.confidence?.issueMeta || {};
    state.cities = Array.isArray(itinerary.cities)
      ? itinerary.cities.map(normalizeCityData)
      : state.cities;
    state.travels = Array.isArray(itinerary.travels) ? itinerary.travels.slice(0, 1).map(normalizeTravelEntry) : state.travels;
    state.days = Array.isArray(itinerary.days)
      ? itinerary.days.map((day) => ({ id: day.id || `${day.city}-${day.date}`, city: day.city, date: day.date }))
      : [];

    if (Array.isArray(itinerary.activities) && itinerary.activities.length) {
      state.activities = itinerary.activities.map((a) => normalizeActivityMetadata(a));
      state.reviewed = itinerary.reviewed || {};
      state.placements = itinerary.placements || {};
    } else {
      const activities = [];
      const reviewed = {};
      const placements = {};
      (itinerary.days || []).forEach((day) => {
        (day.activities || []).forEach((activity) => {
          const normalizedActivity = normalizeActivityMetadata(activity);
          const idValue = normalizedActivity.id || uid();
          activities.push({ ...normalizedActivity, id: idValue });
          reviewed[idValue] = { approved: true, notes: activity.notes || '' };
          placements[idValue] = { dayId: day.id || `${day.city}-${day.date}`, time: parseTimeTo24(activity.time || actPreferredTime(normalizedActivity) || typeToTime(activity.type)) };
        });
      });
      state.activities = activities;
      state.reviewed = reviewed;
      state.placements = placements;
    }
    hydrateTravelIntoCities();
    renderCities();
    state.lastPlannedFingerprint = step1Fingerprint();
    updateCalendarControls();
    renderItinerary();
    await fetchSavedItineraries();
    renderSavedItineraries();
    ensureChatSessionId();
    await restoreChatHistory();
    await hydrateAttachmentsForItinerary(state.currentItineraryId);
    setStep(4);
  } catch {
    showToast('Could not load itinerary.', 'error');
  }
}

function syncTripMetaFromInputs() {
  state.tripName = els.tripName.value.trim();
  const budgetVal = parseFloat(els.tripBudget?.value);
  state.tripBudget = Number.isFinite(budgetVal) && budgetVal > 0 ? budgetVal : null;
  state.numTravelers = Math.max(1, parseInt(els.numTravelers?.value, 10) || 1);
  state.numChildren = Math.max(0, parseInt(els.numChildren?.value, 10) || 0);
}

async function planTrip(citiesToRegenerate = null, lockedByCity = {}) {
  syncTripMetaFromInputs();
  syncLegacyTravelsFromCities();
  const allCities = state.cities.map(({name,startDate,endDate,leaveTime,notes,accommodation,travelEntry,logistics}) => ({
    name,
    startDate,
    endDate,
    leaveTime,
    notes,
    logistics: logistics ? JSON.parse(JSON.stringify(logistics)) : null,
    accommodation: accommodation ? { ...accommodation } : null,
    travelEntry: travelEntry ? { ...travelEntry } : null
  }));
  const travels = state.travels.map((travel) => ({ ...travel }));

  // When regenerating only specific cities, keep existing activities for unselected cities
  const regenSet = citiesToRegenerate ? new Set(citiesToRegenerate) : null;
  const cities = regenSet ? allCities.filter((c) => regenSet.has(c.name)) : allCities;
  if (regenSet) {
    const lockedIds = new Set(Object.values(lockedByCity).flat().map((a) => a.id));
    const removedIds = new Set(
      state.activities
        .filter((a) => regenSet.has(a.city) && !lockedIds.has(a.id))
        .map((a) => a.id)
    );
    console.log('[regen] regenSet:', [...regenSet], 'lockedIds:', [...lockedIds]);
    console.log('[regen] activities before filter:', state.activities.map((a) => ({ id: a.id, city: a.city, name: a.name })));
    state.activities = state.activities.filter(
      (a) => !regenSet.has(a.city) || lockedIds.has(a.id)
    );
    console.log('[regen] activities after filter:', state.activities.map((a) => ({ id: a.id, city: a.city, name: a.name })));
    removedIds.forEach((id) => {
      delete state.reviewed[id];
      delete state.placements[id];
    });
    Object.keys(state.commutes || {}).forEach((key) => {
      const [from, to] = key.split('->');
      if (removedIds.has(from) || removedIds.has(to)) delete state.commutes[key];
    });
    state.confidenceChecklist = (state.confidenceChecklist || [])
      .filter((item) => !(item.type === 'activity' && removedIds.has(item.activityId)));
  } else {
    state.activities = [];
    state.reviewed = {};
    state.placements = {};
  }

  const lockedForApi = {};
  Object.entries(lockedByCity).forEach(([city, acts]) => {
    if (acts.length) {
      lockedForApi[city] = acts.map(({ name, type, category, start_location, suggested_time, duration_hours }) =>
        ({ name, type, category, start_location, suggested_time, duration_hours })
      );
    }
  });

  const payload = {
    cities, travels,
    profile: state.profile || loadProfile(),
    userId: ensureUserId(),
    budget: state.tripBudget,
    numTravelers: state.numTravelers,
    numChildren: state.numChildren,
    ...(Object.keys(lockedForApi).length && { lockedActivities: lockedForApi })
  };

  renderActivities();

  const res = await apiFetch('/api/plan', {
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
      const cityIndex = state.cities.findIndex((c) => cityMatches(c.name, evt.city));
      if (cityIndex !== -1 && evt.travelTiming) {
        state.cities[cityIndex] = {
          ...state.cities[cityIndex],
          travelTiming: { ...evt.travelTiming }
        };
      }

      const cityActivities = (evt.activities || []).map((a, i) => {
        const migrated = window.ActivityMigration ? window.ActivityMigration.migrateActivity(a) : a;
        const normalized = normalizeActivityMetadata(migrated);
        return {
          id: normalized.id || `${evt.city}-${i}-${uid()}`,
          ...normalized,
          city: canonicalizeActivityCity(normalized.city, evt.city)
        };
      });

      console.log('[regen] SSE city event:', evt.city, 'incoming:', cityActivities.length, 'cities in state.activities:', [...new Set(state.activities.map((a) => a.city))]);
      state.activities.push(...cityActivities);
      setStep(2);
      renderActivities();

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

  state.lastPlannedFingerprint = step1Fingerprint();
  setStep(2);
}

async function generateItinerary() {
  syncTripMetaFromInputs();
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  const arranged = approved.map((a) => ({
    ...a,
    notes: state.reviewed[a.id]?.notes || '',
    dayId: state.placements[a.id]?.dayId || null,
    order: minutesFromTime(parseTimeTo24(state.placements[a.id]?.time || actPreferredTime(a) || typeToTime(a.type))),
    time: state.placements[a.id]?.time || parseTimeTo24(actPreferredTime(a) || typeToTime(a.type))
  }));

  const byDay = state.days.map((d) => ({
    ...d,
    activities: arranged.filter((a) => a.dayId === d.id).sort((x,y) => x.order - y.order)
  }));

  const payload = {
    tripName: state.tripName,
    tripBudget: state.tripBudget,
    numTravelers: state.numTravelers,
    numChildren: state.numChildren,
    cities: state.cities,
    travels: state.travels,
    days: byDay,
    activities: state.activities,
    placements: state.placements,
    reviewed: state.reviewed,
    confidence: {
      checklist: state.confidenceChecklist,
      notificationPrefs: state.confidenceNotificationPrefs,
      issueMeta: state.confidenceIssueMeta
    }
  };
  let res;
  if (state.currentItineraryId) {
    res = await apiFetch(`/api/itinerary/${encodeURIComponent(state.currentItineraryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.status === 404) {
      // Stale ID — fall back to creating a new itinerary
      state.currentItineraryId = null;
      res = await apiFetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  } else {
    res = await apiFetch('/api/itinerary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  if (!res.ok) throw new Error('Failed to save itinerary');
  const data = await res.json();
  state.itinerary = data.itinerary;
  state.currentItineraryId = data?.itinerary?.id || null;
  if (state.currentItineraryId && state.chatSessionId) {
    const map = loadChatSessionMap();
    map[state.currentItineraryId] = state.chatSessionId;
    saveChatSessionMap(map);
  }
  updateCalendarControls();
  renderItinerary();
  clearSnapshot();
  await fetchSavedItineraries();
  renderSavedItineraries();
  setStep(4);
}

function buildScheduledDays() {
  return state.days.map((d) => ({
    date: d.date,
    city: d.city,
    activities: state.activities
      .filter((a) => state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId === d.id)
      .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)))
      .map((a) => ({ name: a.name, type: a.type, time: state.placements[a.id]?.time, duration: a.duration, location: actAddress(a) }))
  })).filter((d) => d.activities.length);
}

const STEP_LABELS = { 1: 'setup', 2: 'reviewing activities', 3: 'arranging schedule', 4: 'itinerary finalized' };

function slimCities() {
  return state.cities.map((c) => ({
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    leaveTime: c.leaveTime,
    notes: c.notes || '',
    accommodations: [c.accommodation?.address].filter(Boolean)
  }));
}

function getTripContext() {
  syncLegacyTravelsFromCities();
  const scheduled = buildScheduledDays();
  const hasSchedule = scheduled.length > 0;
  return {
    step: STEP_LABELS[state.step] || 'unknown',
    tripName: state.tripName,
    cities: slimCities(),
    approvedActivities: hasSchedule ? [] : state.activities.filter((a) => state.reviewed[a.id]?.approved).map((a) => a.name),
    declinedActivities: hasSchedule ? [] : state.activities.filter((a) => state.reviewed[a.id]?.approved === false).map((a) => a.name),
    scheduledByDay: scheduled
  };
}

function loadChatSessionMap() {
  try { return JSON.parse(localStorage.getItem('chat_sessions') || '{}'); } catch { return {}; }
}

function saveChatSessionMap(map) {
  localStorage.setItem('chat_sessions', JSON.stringify(map));
  syncToServer('chatSessions', map);
}

function ensureChatSessionId() {
  const itineraryId = state.currentItineraryId;
  if (itineraryId) {
    const map = loadChatSessionMap();
    if (!map[itineraryId]) {
      map[itineraryId] = crypto.randomUUID();
      saveChatSessionMap(map);
    }
    state.chatSessionId = map[itineraryId];
    return state.chatSessionId;
  }
  const existing = localStorage.getItem('chat_session_id');
  state.chatSessionId = existing || crypto.randomUUID();
  if (!existing) localStorage.setItem('chat_session_id', state.chatSessionId);
  return state.chatSessionId;
}

function renderChatMessages() {
  if (!els.chatMessages) return;
  els.chatMessages.innerHTML = state.chatHistory.map((msg) => {
    let html = esc(msg.content || '');
    if (msg.role === 'assistant') {
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      html = html.replace(/(^|[^"'>])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">link</a>');
    }
    return `<div class="${msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-assistant'}">${html}</div>`;
  }).join('');
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function setChatOpen(isOpen) {
  state.chatOpen = isOpen;
  els.chatPanel.classList.toggle('hidden', !isOpen);
}

async function restoreChatHistory() {
  try {
    const sessionId = ensureChatSessionId();
    const res = await apiFetch(`/api/chat/session/${encodeURIComponent(sessionId)}`);
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
    const res = await apiFetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: ensureChatSessionId(),
        message,
        tripContext: getTripContext(),
        userId: ensureUserId()
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
  const existing = state.chatSessionId || localStorage.getItem('chat_session_id');
  if (existing) {
    try { await apiFetch(`/api/chat/session/${encodeURIComponent(existing)}`, { method: 'DELETE' }); } catch {}
  }

  const nextSessionId = crypto.randomUUID();
  localStorage.setItem('chat_session_id', nextSessionId);
  state.chatSessionId = nextSessionId;
  state.currentItineraryId = null;
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

function mountToastHost() {
  const host = document.createElement('div');
  host.id = 'toastHost';
  host.className = 'toast-host';
  document.body.appendChild(host);
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

function showRegenerateConfirmDialog() {
  return new Promise((resolve) => {
    const existing = document.getElementById('regenerateConfirmDialog');
    if (existing) existing.remove();

    const allCityNames = state.cities.map((c) => c.name);
    const prevBudgetOptState = budgetOptState;

    const dialog = document.createElement('div');
    dialog.id = 'regenerateConfirmDialog';
    dialog.className = 'modal';
    document.body.appendChild(dialog);
    refreshOverlayInterlocks();

    const cleanup = (result) => {
      budgetOptState = prevBudgetOptState;
      document.querySelector('.opt-card-expand-overlay')?.remove();
      document.getElementById('regenFooter')?.remove();
      dialog.remove();
      refreshOverlayInterlocks();
      resolve(result);
    };

    dialog.addEventListener('click', (e) => { if (e.target === dialog) cleanup(null); });

    function renderPhase1(prevSelected = null) {
      const cityCheckboxes = allCityNames.map((name, i) => `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
          <input type="checkbox" class="regen-city-cb" data-index="${i}"
            ${!prevSelected || prevSelected.includes(name) ? 'checked' : ''}
            style="width:16px;height:16px;cursor:pointer">
          <span>${esc(name)}</span>
        </label>`).join('');

      dialog.innerHTML = `
        <div class="modal-card" style="max-width:400px;gap:16px">
          <h3 style="margin:0">Regenerate trip</h3>
          <p class="muted-text" style="margin:0">Your trip settings have changed. Select which cities to regenerate:</p>
          <div style="display:flex;flex-direction:column;gap:8px;padding:4px 0">${cityCheckboxes}</div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
            <button id="regenCancel" class="secondary" type="button">Cancel</button>
            <button id="regenNext" class="primary" type="button">Next →</button>
          </div>
        </div>`;

      dialog.querySelector('#regenCancel').addEventListener('click', () => cleanup(null));
      dialog.querySelector('#regenNext').addEventListener('click', () => {
        const selectedCities = [...dialog.querySelectorAll('.regen-city-cb:checked')]
          .map((cb) => allCityNames[parseInt(cb.dataset.index, 10)]);
        if (!selectedCities.length) { cleanup(null); return; }
        const citiesWithActivities = selectedCities.filter(
          (cn) => state.activities.some((a) => a.city === cn)
        );
        if (!citiesWithActivities.length) {
          cleanup({ cities: selectedCities, lockedByCity: {} });
          return;
        }
        renderPhase2(selectedCities, citiesWithActivities);
      });
    }

    function renderPhase2(selectedCities, citiesWithActivities) {
      budgetOptState = { lockedIds: new Set(), refinements: new Map(), choiceIsRefined: new Map(), inFlight: false };

      const allActivities = citiesWithActivities.flatMap((cn) => state.activities.filter((a) => a.city === cn));

      // Swap to full-screen overlay style matching budget optimization
      dialog.className = 'budget-opt-overlay';

      const shell = document.createElement('div');
      shell.className = 'budget-opt-shell';
      shell.innerHTML = `
        <div class="budget-opt-header">
          <h3>Lock activities to keep</h3>
          <p class="budget-opt-desc">Locked activities are preserved exactly as-is. Unlocked ones will be replaced.</p>
        </div>`;

      citiesWithActivities.forEach((cn) => {
        const section = document.createElement('section');
        section.innerHTML = `<h4 style="font-size:.9rem;font-weight:700;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid var(--secondary-light)">${esc(cn)}</h4>`;
        const grid = document.createElement('div');
        grid.className = 'budget-opt-grid cards-grid';
        state.activities.filter((a) => a.city === cn)
          .forEach((a) => grid.appendChild(buildBudgetOptCard(a, 'lock', allActivities)));
        section.appendChild(grid);
        shell.appendChild(section);
      });

      dialog.innerHTML = '';
      dialog.appendChild(shell);

      // Floating footer
      const footer = document.createElement('div');
      footer.id = 'regenFooter';
      footer.className = 'budget-opt-footer';
      footer.innerHTML = `
        <button id="regenBack" class="secondary" type="button">← Back</button>
        <button id="regenConfirm" class="primary" type="button"><i class="ph-bold ph-check" aria-hidden="true"></i> Confirm</button>`;
      document.body.appendChild(footer);

      footer.querySelector('#regenBack').addEventListener('click', () => {
        footer.remove();
        dialog.className = 'modal';
        renderPhase1(selectedCities);
      });
      footer.querySelector('#regenConfirm').addEventListener('click', () => {
        footer.remove();
        const lockedByCity = {};
        selectedCities.forEach((cn) => {
          const locked = state.activities.filter((a) => a.city === cn && budgetOptState.lockedIds.has(a.id));
          if (locked.length) lockedByCity[cn] = locked;
        });
        cleanup({ cities: selectedCities, lockedByCity });
      });
    }

    renderPhase1();
  });
}

function showConfirmDialog(title, message, confirmLabel = 'Confirm') {
  return new Promise((resolve) => {
    const existing = document.getElementById('confirmDialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'confirmDialog';
    dialog.className = 'modal';
    dialog.innerHTML = `
      <div class="modal-card" style="max-width:380px;text-align:center;gap:16px">
        <h3 style="margin:0">${esc(title)}</h3>
        <p class="muted-text" style="margin:0">${esc(message)}</p>
        <div style="display:flex;gap:10px;justify-content:center">
          <button id="confirmNo" class="secondary" type="button">Cancel</button>
          <button id="confirmYes" class="danger" type="button">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    refreshOverlayInterlocks();

    const cleanup = (result) => {
      dialog.remove();
      refreshOverlayInterlocks();
      resolve(result);
    };
    dialog.querySelector('#confirmYes').addEventListener('click', () => cleanup(true));
    dialog.querySelector('#confirmNo').addEventListener('click', () => cleanup(false));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) cleanup(false); });
  });
}

function step1Fingerprint() {
  const budgetVal = parseFloat(els.tripBudget?.value);
  const budget = Number.isFinite(budgetVal) && budgetVal > 0 ? budgetVal : null;
  const travelers = Math.max(1, parseInt(els.numTravelers?.value, 10) || 1);
  const children = Math.max(0, parseInt(els.numChildren?.value, 10) || 0);
  return JSON.stringify({ cities: state.cities, travels: state.travels, budget, travelers, children });
}

function clearSnapshot() {
  localStorage.removeItem(SNAPSHOT_KEY);
  syncToServer('snapshot', null);
}

function saveSnapshot() {
  syncTripMetaFromInputs();

  const payload = {
    cities: state.cities,
    travels: state.travels,
    activities: state.activities,
    placements: state.placements,
    commutes: state.commutes,
    reviewed: state.reviewed,
    tripName: state.tripName,
    days: state.days,
    arrangeCity: state.arrangeCity,
    currentStep: state.step,
    tripBudget: state.tripBudget,
    numTravelers: state.numTravelers,
    numChildren: state.numChildren,
    confidenceChecklist: state.confidenceChecklist,
    confidenceNotificationPrefs: state.confidenceNotificationPrefs,
    confidenceIssueMeta: state.confidenceIssueMeta,
    currentItineraryId: state.currentItineraryId || null
  };
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  syncToServer('snapshot', payload);

  if (state.currentItineraryId) {
    apiFetch(`/api/itinerary/${encodeURIComponent(state.currentItineraryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripName: state.tripName,
        tripBudget: state.tripBudget,
        numTravelers: state.numTravelers,
        numChildren: state.numChildren,
        cities: state.cities,
        travels: state.travels,
        activities: state.activities,
        placements: state.placements,
        reviewed: state.reviewed,
        days: state.days
      })
    }).catch(() => {});
  }

  showToast('Saved!', 'success');
}

function resetToFresh() {
  state.step = 1;
  state.maxStep = 1;
  state.tripName = '';
  state.cities = [];
  state.travels = [];
  state.activities = [];
  state.reviewed = {};
  state.days = [];
  state.placements = {};
  state.itinerary = null;
  state.currentItineraryId = null;
  state.commutes = {};
  state.arrangeCity = null;
  state.chatHistory = [];
  state.chatLoading = false;
  state.reviewFilters = { search: '', city: '', verdict: '' };
  state.confidenceChecklist = [];
  state.confidence = null;
  state.confidenceIssueSignatures = [];
  state.confidenceIssueMeta = {};

  els.tripName.value = '';
  if (els.reviewSearch) els.reviewSearch.value = '';
  if (els.reviewCityFilter) els.reviewCityFilter.value = '';
  if (els.reviewVerdictFilter) els.reviewVerdictFilter.value = '';
  renderCities();
  addCityRow();
  renderActivities();
  els.dayColumns.innerHTML = '';
  els.stagingArea.innerHTML = '';
  els.itineraryGrid.innerHTML = '';
  if (els.itineraryInsights) els.itineraryInsights.innerHTML = '';
  updateCalendarControls();
  renderChatMessages();
  setStep(1);
}

function hydrateFromSnapshot(snapshot) {
  state.tripName = snapshot.tripName || '';
  state.cities = (snapshot.cities || []).map(normalizeCityData);
  state.travels = Array.isArray(snapshot.travels) ? snapshot.travels.slice(0, 1).map(normalizeTravelEntry) : [];
  hydrateTravelIntoCities();
  state.activities = (snapshot.activities || []).map(
    (a) => window.ActivityMigration ? window.ActivityMigration.migrateActivity(a) : a
  );
  state.placements = snapshot.placements || {};
  state.commutes = normalizeCommuteStateMap(snapshot.commutes || {});
  state.reviewed = snapshot.reviewed || {};
  const snapshotDays = Array.isArray(snapshot.days) ? snapshot.days : [];
  const migrateDay = (d) => ({
    ...d,
    activities: Array.isArray(d.activities)
      ? d.activities.map((a) => window.ActivityMigration ? window.ActivityMigration.migrateActivity(a) : a)
      : []
  });
  state.days = daysMatchCities(snapshotDays, state.cities)
    ? snapshotDays.map(migrateDay)
    : expandDays(state.cities);
  state.arrangeCity = snapshot.arrangeCity || state.days[0]?.city || null;

  state.currentItineraryId = snapshot.currentItineraryId || null;
  state.tripBudget = snapshot.tripBudget ?? null;
  state.numTravelers = snapshot.numTravelers ?? 1;
  state.numChildren = snapshot.numChildren ?? 0;
  state.confidenceChecklist = Array.isArray(snapshot.confidenceChecklist)
    ? snapshot.confidenceChecklist.map(normalizeChecklistItem)
    : [];
  state.confidenceNotificationPrefs = snapshot.confidenceNotificationPrefs || state.confidenceNotificationPrefs;
  state.confidenceIssueMeta = snapshot.confidenceIssueMeta || {};

  els.tripName.value = state.tripName;
  if (els.tripBudget && state.tripBudget != null) els.tripBudget.value = state.tripBudget;
  if (els.numTravelers) els.numTravelers.value = state.numTravelers;
  if (els.numChildren) els.numChildren.value = state.numChildren;
  renderCities();

  const targetStep = Math.min(snapshot.currentStep || 3, 4);
  if (targetStep >= 2) renderActivities();
  if (targetStep >= 3) renderArrange();
  if (targetStep >= 4) renderItinerary();

  state.lastPlannedFingerprint = step1Fingerprint();
  setStep(targetStep);
}

function renderMyTrips() {
  if (!els.myTripsPanel || !els.myTripsList) return;

  const snapshot = getSnapshot();
  const trips = [];

  if (snapshot) {
    const snapshotMatchesSaved = snapshot.currentItineraryId &&
      state.savedItineraries.some((item) => item.id === snapshot.currentItineraryId);
    if (!snapshotMatchesSaved) {
      trips.push({
        type: 'draft',
        tripName: snapshot.tripName || 'Untitled Trip',
        detail: `In-progress draft · Step ${snapshot.currentStep || 3}`,
        snapshot
      });
    }
  }

  state.savedItineraries.forEach((item) => {
    const generatedDate = item.generatedAt
      ? new Date(item.generatedAt).toLocaleString()
      : 'Unknown date';
    trips.push({
      type: 'saved',
      id: item.id,
      tripName: item.tripName || 'Untitled Trip',
      detail: `${esc(generatedDate)} · ${Number(item.days || 0)} days · ${Number(item.activityCount || 0)} activities`
    });
  });

  if (!trips.length) {
    els.myTripsPanel.classList.add('hidden');
    resetToFresh();
    return;
  }

  els.myTripsPanel.classList.remove('hidden');

  els.myTripsList.innerHTML = trips.map((trip) => {
    if (trip.type === 'draft') {
      return `
        <article class="saved-itinerary-item draft-item">
          <div>
            <h4>${esc(trip.tripName)} <span class="draft-badge">Draft</span></h4>
            <p>${esc(trip.detail)}</p>
          </div>
          <div class="saved-itinerary-actions">
            <button type="button" class="primary" data-resume-draft>Resume</button>
            <button type="button" class="secondary" data-delete-draft>Delete</button>
          </div>
        </article>`;
    }
    return `
      <article class="saved-itinerary-item">
        <div>
          <h4>${esc(trip.tripName)}</h4>
          <p>${trip.detail}</p>
        </div>
        <div class="saved-itinerary-actions">
          <button type="button" class="secondary" data-load-trip="${esc(trip.id)}">Open</button>
          <button type="button" class="secondary" data-delete-trip="${esc(trip.id)}">Delete</button>
        </div>
      </article>`;
  }).join('');

  const resumeBtn = els.myTripsList.querySelector('[data-resume-draft]');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      hydrateFromSnapshot(snapshot);
    });
  }

  const deleteDraftBtn = els.myTripsList.querySelector('[data-delete-draft]');
  if (deleteDraftBtn) {
    deleteDraftBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog('Delete draft?', 'Your in-progress draft will be permanently deleted.', 'Delete');
      if (!confirmed) return;
      clearSnapshot();
      resetChatSession();
      renderMyTrips();
      resetToFresh();
    });
  }

  els.myTripsList.querySelectorAll('[data-load-trip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      loadItineraryById(btn.dataset.loadTrip);
    });
  });

  els.myTripsList.querySelectorAll('[data-delete-trip]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteTrip;
      if (!id) return;
      const confirmed = await showConfirmDialog('Delete trip?', 'This saved trip will be permanently deleted.', 'Delete');
      if (!confirmed) return;
      try {
        const res = await apiFetch(`/api/itinerary/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        if (state.currentItineraryId === id) {
          state.currentItineraryId = null;
          state.itinerary = null;
        }
        await fetchSavedItineraries();
        renderMyTrips();
        renderSavedItineraries();
        showToast('Trip deleted.', 'success');
      } catch {
        showToast('Could not delete trip.', 'error');
      }
    });
  });

  resetToFresh();
}

async function maybeLoadSharedItineraryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const itineraryId = String(params.get('itinerary') || '').trim();
  const mode = String(params.get('mode') || '').trim().toLowerCase();

  if (!itineraryId) return false;

  try {
    await loadItineraryById(itineraryId);
    if (mode === 'itinerary' || mode === 'execution') setViewMode('itinerary');
    return true;
  } catch {
    const offline = loadMinimalOfflinePayload(itineraryId);
    if (!offline) return false;

    const offlineRows = Array.isArray(offline.itineraryRows)
      ? offline.itineraryRows
      : (Array.isArray(offline.executionRows) ? offline.executionRows : []);

    if (els.itineraryModeSummary) {
      renderItineraryModeSummary(offline);
    }
    if (els.itineraryModeList) {
      els.itineraryModeList.innerHTML = offlineRows.map((row) => {
        const title = row.title || '';
        const location = row.location || row.place || '';
        const timeLabel = row.timeLabel || row.time || '';
        const notes = row.notes || row.note || '';
        const refNum = row.referenceNum || '';
        return `
          <article class="itinerary-item">
            <header class="itinerary-item-head">
              <h3 class="itinerary-title">${esc(title)}</h3>
              <time class="itinerary-time">${esc(timeLabel)} • ${esc(row.date || '')}</time>
            </header>
            ${location ? `<div class="itinerary-subtitle">${esc(location)}</div>` : ''}
            ${notes ? `<p class="itinerary-notes">${esc(notes)}</p>` : ''}
            ${refNum ? `<div class="itinerary-reference has-value"><i class="ph-bold ph-ticket"></i><span>${esc(refNum)}</span></div>` : ''}
          </article>
        `;
      }).join('');
    }
    setViewMode('itinerary');
    return true;
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

function renderAuthUi() {
  const loggedIn = Boolean(state.authUserId);
  if (els.signInBtn) els.signInBtn.classList.toggle('hidden', loggedIn);
  if (els.profileMenu) els.profileMenu.classList.toggle('hidden', !loggedIn);
  if (els.profileMenuEmail) els.profileMenuEmail.textContent = state.authUserEmail || '';
  if (els.forwardingPanel) els.forwardingPanel.classList.toggle('hidden', !state.forwardingAddress);
  if (els.forwardingAddress) els.forwardingAddress.textContent = state.forwardingAddress || 'Not available yet';
  updateCalendarControls();
}

function updateCalendarControls() {
  const hasItinerary = Boolean(state.currentItineraryId);
  if (els.downloadCalendarBtn) els.downloadCalendarBtn.disabled = !hasItinerary;
  if (els.syncGoogleCalendarBtn) els.syncGoogleCalendarBtn.disabled = !(hasItinerary && state.googleCalendarConnected);
  if (els.connectGoogleCalendarBtn) {
    els.connectGoogleCalendarBtn.innerHTML = state.googleCalendarConnected
      ? '<i class="ph-bold ph-check-circle" aria-hidden="true"></i> Google Connected'
      : '<i class="ph-bold ph-lock-key" aria-hidden="true"></i> Connect Google';
  }
}

function setCalendarStatus(message = '') {
  if (!els.calendarSyncStatus) return;
  els.calendarSyncStatus.textContent = message;
}

async function connectGoogleCalendar() {
  try {
    const res = await apiFetch('/api/calendar/google/auth-url');
    const data = await res.json();
    if (!res.ok || !data?.authUrl) throw new Error(data.error || 'Failed to start Google OAuth');
    window.open(data.authUrl, '_blank', 'noopener,noreferrer');
    setCalendarStatus('Google OAuth opened. After connecting, return and click Sync Google.');
  } catch (error) {
    setCalendarStatus(error?.message || 'Failed to connect Google Calendar');
  }
}

async function syncGoogleCalendar() {
  if (!state.currentItineraryId) return;
  const metadataMode = String(state.calendarMetadataMode || 'compact');

  try {
    setCalendarStatus('Checking for time conflicts…');
    const precheckRes = await apiFetch(`/api/itinerary/${encodeURIComponent(state.currentItineraryId)}/calendar/google/precheck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadataMode })
    });
    const precheck = await precheckRes.json();
    if (!precheckRes.ok) throw new Error(precheck.error || 'Conflict check failed');

    if (precheck.conflictCount > 0) {
      const preview = (precheck.conflicts || []).slice(0, 5).map((c) => `${c.itemTitle} overlaps with ${c.existingTitle}`).join('\n');
      const proceed = window.confirm(`Found ${precheck.conflictCount} potential overlap(s).\n\n${preview}${precheck.conflictCount > 5 ? '\n…' : ''}\n\nContinue sync anyway?`);
      if (!proceed) {
        setCalendarStatus('Sync cancelled due to conflicts.');
        return;
      }
    }

    setCalendarStatus('Syncing to Google Calendar…');
    const syncRes = await apiFetch(`/api/itinerary/${encodeURIComponent(state.currentItineraryId)}/calendar/google/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadataMode })
    });
    const syncData = await syncRes.json();
    if (!syncRes.ok) throw new Error(syncData.error || 'Google sync failed');

    state.googleCalendarConnected = true;
    updateCalendarControls();
    setCalendarStatus(`Synced ${syncData.total} event(s): ${syncData.created} created, ${syncData.updated} updated.`);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('not connected')) {
      state.googleCalendarConnected = false;
      updateCalendarControls();
    }
    setCalendarStatus(error?.message || 'Google Calendar sync failed');
  }
}

async function loadAuthSessionData() {
  try {
    const res = await apiFetch('/api/auth/session');
    if (!res.ok) return;
    const data = await res.json();
    state.authUserId = String(data?.userId || state.authUserId || '');
    state.forwardingAddress = String(data?.forwardingAddress || '');
    localStorage.setItem(USER_ID_KEY, state.authUserId);
  } catch {}

  try {
    const statusRes = await apiFetch('/api/calendar/google/status');
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      state.googleCalendarConnected = Boolean(statusData?.connected);
    }
  } catch {
    state.googleCalendarConnected = false;
  }

  renderAuthUi();
}

async function initClerkAuth() {
  const clerk = window.Clerk;
  if (!clerk) throw new Error('Clerk SDK not loaded');

  await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
  const user = clerk.user;
  if (!user) {
    await clerk.openSignIn({
      redirectUrl: window.location.href,
      afterSignInUrl: window.location.href,
      afterSignUpUrl: window.location.href
    });
    throw new Error('Authentication required');
  }

  state.authUserId = user.id || '';
  state.authUserEmail = user.primaryEmailAddress?.emailAddress || '';
  state.authReady = true;
  renderAuthUi();

  if (els.signInBtn) {
    els.signInBtn.onclick = () => clerk.openSignIn({ redirectUrl: window.location.href, afterSignInUrl: window.location.href });
  }
  if (els.signOutBtn) {
    els.signOutBtn.onclick = async () => {
      await clerk.signOut({ redirectUrl: window.location.href });
    };
  }

  await loadAuthSessionData();
  await syncFromServer();

  const store = state.profilesStore || loadProfiles();
  if (!store.profiles.length) {
    openProfileWizard(store, { forced: true });
  }
}

function clearPlannedResultsKeepSetup() {
  state.activities = [];
  state.reviewed = {};
  state.days = [];
  state.placements = {};
  state.itinerary = null;
  state.currentItineraryId = null;
  state.commutes = {};
  state.arrangeCity = null;
  renderActivities();
  els.dayColumns.innerHTML = '';
  els.stagingArea.innerHTML = '';
  els.itineraryGrid.innerHTML = '';
  if (els.itineraryInsights) els.itineraryInsights.innerHTML = '';
  updateCalendarControls();
}

function validateLocationsBeforePlanning() {
  clearLocationValidationError();
  for (const city of state.cities) {
    if (!String(city.name || '').trim()) {
      showLocationValidationError('Each city destination must be set.');
      return false;
    }
    if (city.latitude == null || city.longitude == null) {
      showLocationValidationError(`City "${city.name}" is unvalidated. Please choose it from Google Places suggestions.`);
      return false;
    }

    const logistics = city.logistics || normalizeCityLogistics(city);
    if (!logistics.arrival.date || !logistics.departure.date) {
      showLocationValidationError(`City "${city.name}" needs both arrival and departure dates.`);
      return false;
    }

    const arrivalTime = logistics.arrival.time || '';
    const departureTime = logistics.departure.time || '';
    if (!arrivalTime || !departureTime) {
      showLocationValidationError(`City "${city.name}" needs both arrival and departure times.`);
      return false;
    }

    const timelineError = validateCityTimeline(city);
    if (timelineError) {
      showLocationValidationError(`${city.name}: ${timelineError}`);
      return false;
    }
  }

  return true;
}

els.addCityBtn.addEventListener('click', () => { addCityRow(); });
els.sortCitiesBtn?.addEventListener('click', sortCitiesByDate);
els.reviewSearch?.addEventListener('input', (e) => {
  state.reviewFilters.search = e.target.value || '';
  renderActivities();
});
els.reviewCityFilter?.addEventListener('change', (e) => {
  state.reviewFilters.city = e.target.value || '';
  renderActivities();
});
els.reviewVerdictFilter?.addEventListener('change', (e) => {
  state.reviewFilters.verdict = e.target.value || '';
  renderActivities();
});
els.approveVisibleBtn?.addEventListener('click', () => applyVerdictToVisibleActivities(true));

document.querySelectorAll('.save-progress-btn').forEach((btn) => btn.addEventListener('click', saveSnapshot));
document.getElementById('saveConfidenceBtn')?.addEventListener('click', async () => {
  if (!state.currentItineraryId) { saveSnapshot(); return; }
  try {
    const res = await apiFetch(`/api/itinerary/${encodeURIComponent(state.currentItineraryId)}/confidence`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist: state.confidenceChecklist, notificationPrefs: state.confidenceNotificationPrefs, issueMeta: state.confidenceIssueMeta })
    });
    if (!res.ok) throw new Error('Save failed');
    showToast('Saved!', 'success');
  } catch {
    showToast('Failed to save confidence data', 'error');
  }
});
els.autoArrangeBtn?.addEventListener('click', autoArrangeActiveCity);
els.downloadCalendarBtn?.addEventListener('click', () => {
  if (!state.currentItineraryId) return;
  const metadataMode = encodeURIComponent(state.calendarMetadataMode || 'compact');
  window.open(`/api/itinerary/${encodeURIComponent(state.currentItineraryId)}/calendar.ics?metadata=${metadataMode}`, '_blank');
});
els.connectGoogleCalendarBtn?.addEventListener('click', connectGoogleCalendar);
els.syncGoogleCalendarBtn?.addEventListener('click', syncGoogleCalendar);
els.calendarMetadataMode?.addEventListener('change', (e) => {
  state.calendarMetadataMode = e.target.value === 'full' ? 'full' : 'compact';
  setCalendarStatus(`Metadata mode: ${state.calendarMetadataMode}`);
});
els.shareMinimalBtn?.addEventListener('click', shareMinimalItinerary);
els.copyMinimalBtn?.addEventListener('click', copyMinimalItineraryText);
els.saveOfflineMinimalBtn?.addEventListener('click', () => saveMinimalOfflinePayload(getMinimalPayload()));
els.printMinimalBtn?.addEventListener('click', () => window.print());
els.planningModeBtn?.addEventListener('click', () => setViewMode('planning'));
els.itineraryModeBtn?.addEventListener('click', () => setViewMode('itinerary'));

// Delegated handler for itinerary item buttons
els.itineraryModeList?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const card = btn.closest('[data-activity-id]');
  if (!card) return;
  const activityId = card.dataset.activityId;
  const action = btn.dataset.action;
  if (action === 'upload-files') {
    _pendingUploadActivityId = activityId;
    _pendingUploadButton = btn;
    if (els.attachmentFileInput) {
      els.attachmentFileInput.value = '';
      els.attachmentFileInput.click();
    }
  } else if (action === 'view-files') {
    openAttachmentViewer(activityId);
  }
});

// File input triggers upload
els.attachmentFileInput?.addEventListener('change', () => {
  const files = els.attachmentFileInput.files;
  if (_pendingUploadActivityId && files?.length) {
    uploadActivityAttachments(_pendingUploadActivityId, files, _pendingUploadButton);
  }
  _pendingUploadActivityId = null;
  _pendingUploadButton = null;
});

// Attachment viewer modal
els.attachmentViewerClose?.addEventListener('click', () => {
  els.attachmentViewerModal?.classList.add('hidden');
});
els.attachmentViewerModal?.addEventListener('click', (e) => {
  if (e.target === els.attachmentViewerModal) els.attachmentViewerModal.classList.add('hidden');
});
els.attachmentViewerList?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="delete-attachment"]');
  if (!btn) return;
  const row = btn.closest('[data-attachment-id]');
  if (!row) return;
  const attachmentId = row.dataset.attachmentId;
  const activityId = row.dataset.activityId;
  if (!attachmentId || !activityId) return;
  deleteAttachment(activityId, attachmentId);
});

els.profileMenuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  els.profileMenuDropdown?.classList.toggle('hidden');
});
els.profileMenuMyProfile?.addEventListener('click', () => {
  els.profileMenuDropdown?.classList.add('hidden');
  openPreferencesModal();
});
document.addEventListener('click', () => els.profileMenuDropdown?.classList.add('hidden'));
els.profileMenuDropdown?.addEventListener('click', (e) => e.stopPropagation());
els.prefsClose.addEventListener('click', closePreferencesModal);
els.prefsModal.addEventListener('click', (e) => {
  if (e.target === els.prefsModal) closePreferencesModal();
});
els.learnedPrefsTags?.addEventListener('click', (e) => {
  const btn = e.target.closest('.learned-pref-remove');
  if (!btn) return;
  const tag = btn.closest('.learned-pref-tag');
  if (!tag) return;
  const kind = tag.dataset.kind;
  const text = tag.dataset.text;
  const lp = state.learnedPrefs;
  if (!lp) return;
  if (kind === 'constraint') lp.constraints = lp.constraints.filter((c) => c.text !== text);
  if (kind === 'preference') lp.preferences = lp.preferences.filter((p) => p.text !== text);
  apiFetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ constraints: lp.constraints, preferences: lp.preferences, profileInstruction: lp.profileInstruction })
  }).catch(() => {});
  renderPreferencesModal();
});

// Textarea expand modal
const expandModal = document.getElementById('textareaExpandModal');
const expandTitle = document.getElementById('textareaExpandTitle');
const expandEditor = document.getElementById('textareaExpandEditor');
let expandTargetId = null;

if (expandModal && expandModal.parentElement !== document.body) {
  document.body.appendChild(expandModal);
}

function bindTextareaExpandButtons(root = document) {
  root.querySelectorAll('.textarea-expand-btn').forEach((btn) => {
    if (btn.dataset.expandBound === '1') return;
    btn.dataset.expandBound = '1';
    btn.addEventListener('click', () => openExpandModal(btn.dataset.expand, btn.dataset.title));
  });
}

function openExpandModal(targetId, title) {
  expandTargetId = targetId;
  expandTitle.textContent = title;
  expandEditor.value = document.getElementById(targetId)?.value || '';
  expandModal.classList.remove('hidden');
  refreshOverlayInterlocks();
  expandEditor.focus();
}

function closeExpandModal(save) {
  if (save && expandTargetId) {
    const target = document.getElementById(expandTargetId);
    if (target) {
      target.value = expandEditor.value;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  expandModal.classList.add('hidden');
  refreshOverlayInterlocks();
  expandTargetId = null;
}

document.getElementById('textareaExpandClose').addEventListener('click', () => closeExpandModal(false));
document.getElementById('textareaExpandSave').addEventListener('click', () => closeExpandModal(true));
expandModal.querySelector('.textarea-expand-backdrop').addEventListener('click', () => closeExpandModal(false));
expandModal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeExpandModal(false); });

bindTextareaExpandButtons(document);
els.profileEditBtn.addEventListener('click', async () => {
  const next = getProfilePayload();
  if (activeSavingToastId) {
    const stale = document.querySelector(`[data-toast-id="${activeSavingToastId}"]`);
    stale?.click();
  }
  activeSavingToastId = showToast('Saving...', 'info');

  const prev = profileSnapshot ? JSON.parse(profileSnapshot) : null;
  const profileChanged = !prev ||
    JSON.stringify(next.answers) !== JSON.stringify(prev.answers) ||
    next.aboutMe !== prev.aboutMe;

  saveProfile(next);
  profileSnapshot = JSON.stringify(next);

  if (!profileChanged) {
    showToast('Profile saved!', 'success');
    activeSavingToastId = null;
    renderPreferencesModal();
    return;
  }

  try {
    const res = await apiFetch('/api/profile/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
    const data = await res.json();
    const instruction = String(
      data?.instruction
      ?? data?.profileInstruction
      ?? ''
    ).trim();

    if (res.ok && instruction) {
      state.learnedPrefs = { ...(state.learnedPrefs || {}), profileInstruction: instruction };
      if (els.profileAiSummary && els.aiSummarySection) {
        els.profileAiSummary.value = instruction;
        els.aiSummarySection.classList.remove('hidden');
      }
      showToast('Profile saved!', 'success');
    } else {
      showToast('Profile saved (enrichment failed)', 'info');
    }
  } catch {
    showToast('Profile saved (enrichment failed)', 'info');
  } finally {
    activeSavingToastId = null;
  }

  renderPreferencesModal();
});

els.profileAiSummary?.addEventListener('blur', () => {
  const instruction = els.profileAiSummary.value.trim();
  if (instruction === (state.learnedPrefs?.profileInstruction || '')) return;
  state.learnedPrefs = { ...(state.learnedPrefs || {}), profileInstruction: instruction };
  apiFetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileInstruction: instruction })
  }).catch(() => {});
});

els.deleteProfileBtn?.addEventListener('click', deleteActiveProfile);
els.confidenceBadge?.addEventListener('click', () => els.confidencePopover?.classList.toggle('hidden'));
document.getElementById('checklistBtn')?.addEventListener('click', openChecklistModal);
document.getElementById('checklistModalClose')?.addEventListener('click', closeChecklistModal);
document.getElementById('checklistModal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('checklistModal')) closeChecklistModal();
});
document.getElementById('addActivityModalClose')?.addEventListener('click', closeAddActivityModal);
document.getElementById('addActivityCancel')?.addEventListener('click', closeAddActivityModal);
document.getElementById('addActivitySubmit')?.addEventListener('click', submitAddActivity);
document.getElementById('addActivityModal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('addActivityModal')) closeAddActivityModal();
});
els.openConfidenceReviewBtn?.addEventListener('click', () => {
  els.confidencePopover?.classList.add('hidden');
  setStep(4);
  requestAnimationFrame(() => {
    document.getElementById('tripHealthSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

els.activitiesGrid.addEventListener('change', () => {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  state.days = expandDays(state.cities);
  state.arrangeCity = state.arrangeCity || state.days[0]?.city || null;
  approved.forEach((a) => {
    state.placements[a.id] = state.placements[a.id] || { dayId: null, time: parseTimeTo24(actPreferredTime(a) || typeToTime(a.type)) };
  });
  renderArrange();
});

document.querySelectorAll('[data-nav-next]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fromStep = Number(btn.dataset.navNext || state.step);
    goToNextStep(fromStep);
  });
});

document.querySelectorAll('[data-nav-back]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fromStep = Number(btn.dataset.navBack || state.step);
    goToPreviousStep(fromStep);
  });
});

els.steps.forEach((el, i) => {
  el.addEventListener('click', () => {
    const target = i + 1;
    if (target === state.step || target > state.maxStep) return;
    setStep(target);
  });
});

// Seed the initial history entry so the browser back button never leaves the SPA
history.replaceState({ spa: true, step: 1 }, '');

(async function init() {
  try {
    await initClerkAuth();
  } catch (error) {
    if (els.apiBanner) {
      els.apiBanner.textContent = `Authentication required: ${error.message || 'Please sign in.'}`;
      els.apiBanner.classList.remove('hidden');
    }
    return;
  }

  state.profilesStore = loadProfiles();
  state.profile = normalizeProfile(getActiveProfile(state.profilesStore));
  mountPlanningOverlay();
  mountActivityMapOverlay();
  mountToastHost();
  bindChatEvents();
  ensureUserId();
  ensureChatSessionId();
  await restoreChatHistory();
  await fetchStatus();
  await fetchArrangeConfig();
  await fetchSavedItineraries();
  renderSavedItineraries();
  registerServiceWorker();
  if (els.calendarMetadataMode) {
    els.calendarMetadataMode.value = state.calendarMetadataMode;
  }
  updateCalendarControls();
  const savedViewMode = localStorage.getItem(VIEW_MODE_KEY);
  setViewMode(savedViewMode === 'itinerary' || savedViewMode === 'execution' ? 'itinerary' : 'planning');
  const loadedFromShare = await maybeLoadSharedItineraryFromUrl();
  if (!loadedFromShare) renderMyTrips();
})();
