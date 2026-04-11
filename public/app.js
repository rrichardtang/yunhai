const state = {
  step: 1,
  tripName: '',
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
  mapOverlaySelectedActivityId: null
};

const PROFILES_KEY = 'travelplanner_profiles_v1';
const LEGACY_PROFILE_KEY = 'travelplanner_profile_v1';
const USER_ID_KEY = 'travelplanner_user_id';
const PROFILE_QUESTIONS = [
  { key: 'museumPerson', label: 'Are you a museum person?', summary: 'Museum person' },
  { key: 'foodTravel', label: 'Do you travel for food?', summary: 'Travels for food' },
  { key: 'livePerformances', label: 'Do you seek out live performances (concerts, theatre, shows)?', summary: 'Live performances' },
  { key: 'outdoorNature', label: 'Do you enjoy outdoor / nature activities?', summary: 'Outdoor / nature activities' },
  { key: 'nightlifeBars', label: 'Are you into nightlife and bars?', summary: 'Nightlife and bars' },
  { key: 'structuredTours', label: 'Do you like structured tours?', summary: 'Structured tours' },
  { key: 'pace', label: 'How packed do you like your days?', summary: 'Trip pace' }
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
  authUserLabel: document.getElementById('authUserLabel'),
  signInBtn: document.getElementById('signInBtn'),
  signOutBtn: document.getElementById('signOutBtn'),
  forwardingPanel: document.getElementById('forwardingPanel'),
  forwardingAddress: document.getElementById('forwardingAddress'),
  planningModeBtn: document.getElementById('planningModeBtn'),
  executionModeBtn: document.getElementById('executionModeBtn'),
  executionModeView: document.getElementById('executionModeView'),
  executionModeList: document.getElementById('executionModeList'),
  executionSummary: document.getElementById('executionSummary'),
  executionConfirmations: document.getElementById('executionConfirmations'),
  shareMinimalBtn: document.getElementById('shareMinimalBtn'),
  copyMinimalBtn: document.getElementById('copyMinimalBtn'),
  saveOfflineMinimalBtn: document.getElementById('saveOfflineMinimalBtn'),
  printMinimalBtn: document.getElementById('printMinimalBtn'),
  preferencesLink: document.getElementById('preferencesLink'),
  prefsModal: document.getElementById('prefsModal'),
  prefsClose: document.getElementById('prefsClose'),
  profileSelector: document.getElementById('profileSelector'),
  profileNameInput: document.getElementById('profileNameInput'),
  newProfileBtn: document.getElementById('newProfileBtn'),
  deleteProfileBtn: document.getElementById('deleteProfileBtn'),
  profileQuestions: document.getElementById('profileQuestions'),
  profileTravelNotes: document.getElementById('profileTravelNotes'),
  profileAiSummary: document.getElementById('profileAiSummary'),
  aiSummarySection: document.getElementById('aiSummarySection'),
  profileEditBtn: document.getElementById('profileEditBtn'),
  saveProgressBtn: document.getElementById('saveProgressBtn'),
  autoArrangeBtn: document.getElementById('autoArrangeBtn'),
  myTripsPanel: document.getElementById('myTripsPanel'),
  myTripsList: document.getElementById('myTripsList'),
  chatBubble: document.getElementById('chatBubble'),
  chatPanel: document.getElementById('chatPanel'),
  chatClose: document.getElementById('chatClose'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  chatSend: document.getElementById('chatSend')
};

const SNAPSHOT_KEY = 'travelplanner_snapshot';
const VIEW_MODE_KEY = 'travelplanner_view_mode_v1';
const MINIMAL_OFFLINE_KEY = 'travelplanner_minimal_offline_v1';
const GEO_CACHE_KEY = 'travelplanner_geo_cache_v1';
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s='') => s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalizeCity = (str = '') => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

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
    activity.start_location,
    activity.end_location,
    activity.location,
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
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
      const rows = await res.json();
      const hit = Array.isArray(rows) ? rows[0] : null;
      if (!hit?.lat || !hit?.lon) return null;
      const coords = { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name || query };
      if (Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
        geocodeCache[key] = coords;
        persistGeocodeCache();
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      return coords;
    });

  return geocodeQueue.catch(() => null);
}

async function geocodeActivity(activity = {}) {
  const candidates = getActivityLocationCandidates(activity);
  for (const candidate of candidates) {
    const cached = geocodeCache[geocodeKey(candidate)];
    if (cached?.lat != null && cached?.lng != null) return cached;
  }
  for (const candidate of candidates) {
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
  return {
    id: String(accommodation.id || uid()),
    address: String(accommodation.address || ''),
    checkIn: String(accommodation.checkIn || ''),
    checkOut: String(accommodation.checkOut || ''),
    placeId: String(accommodation.placeId || ''),
    latitude: normalizeCoordinate(accommodation.latitude),
    longitude: normalizeCoordinate(accommodation.longitude)
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
  const defaultBase = 'https://maps.googleapis.com/maps/api/js?libraries=places&v=beta&loading=async';
  let base = String(window.TRAVELPLANNER_GOOGLE_MAPS_SDK_BASE_URL || defaultBase);
  if (!base.includes('libraries=places')) base += `${base.includes('?') ? '&' : '?'}libraries=places`;
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
          const lib = await window.google.maps.importLibrary('places');
          if (!window.google.maps.places) window.google.maps.places = {};
          if (lib) Object.assign(window.google.maps.places, lib);
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

  state.cities.forEach((city) => {
    (city.accommodations || []).forEach((accommodation) => {
      const row = document.querySelector(`[data-hotel-id="${CSS.escape(accommodation.id || '')}"]`);
      const input = getAccommodationAutocompleteInput(row);
      if (!input) return;

      attachPlaceAutocompleteElement(input, {
        locationBias: cityLocationBias(city),
        onResolved: ({ formattedAddress, placeId, lat, lng }) => {
          accommodation.address = formattedAddress;
          accommodation.placeId = placeId;
          accommodation.latitude = lat;
          accommodation.longitude = lng;
          input.value = formattedAddress;
          row.dataset.addressValidated = '1';
          clearLocationValidationError();
        },
        onInput: () => {
          accommodation.placeId = '';
          accommodation.latitude = null;
          accommodation.longitude = null;
          row.dataset.addressValidated = '0';
        },
        onInvalid: () => {
          accommodation.placeId = '';
          accommodation.latitude = null;
          accommodation.longitude = null;
          row.dataset.addressValidated = '0';
          showLocationValidationError('One or more accommodation addresses are invalid. Please select each from Google Places suggestions.');
        }
      });
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
    answers: Object.fromEntries(PROFILE_QUESTIONS.map((q) => [q.key, PROFILE_DEFAULT])),
    aboutMe: '',
    profileInstruction: ''
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
  const id = createProfileId();
  return {
    activeId: id,
    profiles: [{ id, name: 'My Profile', ...defaultProfile() }]
  };
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
    return defaultProfilesStore();
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
    const legacy = typeof raw === 'string' ? legacyMap[raw] : undefined;
    const numeric = Number(raw);
    const resolved = Number.isFinite(numeric) ? numeric : legacy;
    const clamped = Math.max(PROFILE_MIN, Math.min(PROFILE_MAX, Math.round(Number(resolved || PROFILE_DEFAULT))));
    base.answers[q.key] = clamped;
  }
  // Keep aboutMe and profileInstruction strictly separated.
  // Only use legacy travelNotes when aboutMe is missing and no instruction exists.
  const hasAboutMe = profile.aboutMe !== undefined && profile.aboutMe !== null;
  const canUseLegacyTravelNotes = !hasAboutMe && !profile.profileInstruction;
  const aboutSource = hasAboutMe ? profile.aboutMe : (canUseLegacyTravelNotes ? profile.travelNotes : '');

  base.aboutMe = String(aboutSource ?? '').trim();
  base.profileInstruction = String(profile.profileInstruction || '').trim();
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

function setStep(n) {
  state.step = n;
  els.steps.forEach((el, i) => el.classList.toggle('active', i + 1 === n));
  els.panels.forEach((el, i) => el.classList.toggle('active', i + 1 === n));
  updateStepNavButtons();
}

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

function setPlanningLoading(isLoading) {
  const overlay = document.getElementById('planningOverlay');
  if (!overlay) return;

  state.isPlanning = isLoading;
  els.planBtn.disabled = isLoading;
  els.planBtn.textContent = isLoading ? 'Planning…' : 'Next →';

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

async function goToNextStep(fromStep = state.step) {
  if (fromStep === 1) {
    if (state.isPlanning) return;

    const hasExistingActivities = Array.isArray(state.activities) && state.activities.length > 0;
    const hasReviewedState = state.reviewed && typeof state.reviewed === 'object';
    const step1Changed = state.lastPlannedFingerprint && state.lastPlannedFingerprint !== step1Fingerprint();

    if (hasExistingActivities && hasReviewedState && !step1Changed) {
      setStep(2);
      return;
    }

    if (!validateLocationsBeforePlanning()) {
      showToast('Please validate all locations before planning your trip.', 'error');
      return;
    }
    clearSnapshot();
    clearPlannedResultsKeepSetup();
    setPlanningLoading(true);
    try { await planTrip(); }
    catch (e) { showToast(e?.message || 'Failed to plan trip.', 'error'); }
    finally { setPlanningLoading(false); }
    return;
  }

  if (fromStep === 2) {
    const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
    if (!approved.length) return;
    state.commutes = {};
    state.days = expandDays(state.cities);
    state.arrangeCity = state.days[0]?.city || null;
    approved.forEach((a) => {
      state.placements[a.id] = state.placements[a.id] || { dayId: null, time: parseTimeTo24(a.suggested_time || typeToTime(a.type)) };
    });
    renderArrange();
    setStep(3);
    return;
  }

  if (fromStep === 3) {
    try {
      await generateItinerary();
    } catch (e) {
      showToast(e?.message || 'Failed to generate itinerary.', 'error');
    }
  }
}

function goToPreviousStep(fromStep = state.step) {
  if (fromStep <= 1) return;
  if (fromStep === 4) renderArrange();
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
    accommodations: Array.isArray(city.accommodations) ? city.accommodations.map(normalizeAccommodation) : [],
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

function addAccommodationRow(city) {
  if (!city) return;
  city.accommodations = Array.isArray(city.accommodations) ? city.accommodations : [];
  city.accommodations.push({
    id: uid(),
    address: '',
    placeId: '',
    latitude: null,
    longitude: null,
    checkIn: city.startDate || '',
    checkOut: city.endDate || ''
  });
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
    if (!Array.isArray(city.accommodations) || city.accommodations.length === 0) {
      city.accommodations = [normalizeAccommodation({ checkIn: city.logistics.accommodation.checkIn, checkOut: city.logistics.accommodation.checkOut })];
    }
    syncCityLegacyDates(city);
    const timelineError = validateCityTimeline(city);

    const row = document.createElement('div');
    row.className = 'city-row';
    row.dataset.cityId = city.id;
    row.innerHTML = `
      <div class="city-row-main">
        <button class="secondary city-row-toggle" type="button" data-toggle-details ${readyForDetails ? '' : 'disabled'}>${city.detailsExpanded ? '−' : '+'}</button>
        <div class="city-autocomplete">
          <input type="text" placeholder="City" value="${esc(city.name)}" data-field="name" autocomplete="off" />
        </div>
        <input type="date" value="${esc(city.logistics.arrival.date)}" data-field="dateFrom" aria-label="Start date" title="Start date" />
        <input type="date" value="${esc(city.logistics.departure.date)}" data-field="dateTo" aria-label="End date" title="End date" />
        <input type="text" placeholder="Notes" value="${esc(city.notes || '')}" data-field="notes" />
        <button class="secondary" type="button" data-remove-city>Remove</button>
      </div>
      ${readyForDetails && city.detailsExpanded ? `
        <div class="city-drawer">
          <div class="city-dropdown-grid" role="group" aria-label="City stay details">
            <div class="city-dropdown-section">
              <label class="city-dropdown-label">Accommodation</label>
              <div class="city-dropdown-row accommodation-row">
                <div class="city-autocomplete">
                  <input type="text" placeholder="Accommodation address" value="${esc((city.accommodations?.[0]?.address) || '')}" data-accommodation-field="address" data-hotel-id="${esc(city.accommodations?.[0]?.id || '')}" autocomplete="off" aria-label="Accommodation address" />
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

    row.querySelectorAll('input[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
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
          if (city.accommodations?.[0]) city.accommodations[0].checkIn = input.value || '';
          syncCityLegacyDates(city);
          syncTravelDateTimes();
          renderSetupInsights();
          renderCities();
          return;
        }

        if (field === 'dateTo') {
          city.logistics.departure.date = input.value || '';
          city.logistics.accommodation.checkOut = input.value || '';
          if (city.accommodations?.[0]) city.accommodations[0].checkOut = input.value || '';
          syncCityLegacyDates(city);
          syncTravelDateTimes();
          renderSetupInsights();
          renderCities();
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

    const accommodationInput = row.querySelector('[data-accommodation-field="address"]');
    if (accommodationInput && isGooglePlacesReady()) {
      const accom = city.accommodations[0];
      attachPlaceAutocompleteElement(accommodationInput, {
        locationBias: cityLocationBias(city),
        onResolved: ({ formattedAddress, placeId, lat, lng }) => {
          accom.address = formattedAddress;
          accom.placeId = placeId;
          accom.latitude = lat;
          accom.longitude = lng;
          accommodationInput.value = formattedAddress;
          clearLocationValidationError();
        },
        onInput: () => { accom.placeId = ''; accom.latitude = null; accom.longitude = null; },
        onInvalid: () => {
          accom.placeId = ''; accom.latitude = null; accom.longitude = null;
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

    row.querySelector('[data-remove-city]')?.addEventListener('click', () => {
      if (cityAutocomplete.activeCityId === city.id) closeCityAutocomplete();
      state.cities = state.cities.filter((c) => c.id !== city.id);
      syncTravelDateTimes();
      renderCities();
    });

    row.querySelectorAll('[data-logistics]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.logistics;

        // Don't re-render on text input for location fields — it destroys the autocomplete widget
        if (field === 'arrivalLocation' || field === 'departureLocation') return;

        if (field === 'accommodationCheckIn') {
          city.logistics.accommodation.checkIn = input.value || '';
          if (city.accommodations[0]) city.accommodations[0].checkIn = input.value || '';
        }
        if (field === 'accommodationCheckOut') {
          city.logistics.accommodation.checkOut = input.value || '';
          if (city.accommodations[0]) city.accommodations[0].checkOut = input.value || '';
        }
        if (field === 'arrivalTime') {
          city.logistics.arrival.time = parseTimeTo24(input.value || '');
        }
        if (field === 'departureTime') {
          city.logistics.departure.time = parseTimeTo24(input.value || '');
        }

        syncCityLegacyDates(city);
        syncTravelDateTimes();
        renderSetupInsights();
        renderCities();
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

function postPreferenceSignal(activity, verdict) {
  apiFetch('/api/preferences/signal', {
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

function renderPreferencesModal() {
  if (!els.profileQuestions) return;
  const store = state.profilesStore || loadProfiles();
  const activeProfileRaw = getActiveProfile(store);
  const activeProfile = {
    ...activeProfileRaw,
    ...normalizeProfile(activeProfileRaw)
  };
  // Always sync UI state from the active profile so profile switching/loading
  // cannot leak values between profiles.
  state.profile = normalizeProfile(activeProfile);

  const canCreateProfile = store.profiles.length < 3;
  const canDeleteProfile = store.profiles.length > 1;

  if (els.profileSelector) {
    els.profileSelector.innerHTML = store.profiles
      .map((p) => `<option value="${esc(p.id)}" ${p.id === store.activeId ? 'selected' : ''}>${esc(p.name)}</option>`)
      .join('');
  }

  if (els.profileNameInput) {
    els.profileNameInput.value = activeProfile.name || 'My Profile';
    els.profileNameInput.classList.add('hidden');
    els.profileNameInput.maxLength = 32;
  }

  if (els.newProfileBtn) {
    els.newProfileBtn.disabled = !canCreateProfile;
  }

  if (els.deleteProfileBtn) {
    els.deleteProfileBtn.disabled = !canDeleteProfile;
  }

  const profile = state.profile;

  els.profileQuestions.innerHTML = PROFILE_QUESTIONS.map((q) => {
    const active = Math.max(PROFILE_MIN, Math.min(PROFILE_MAX, Number(profile.answers[q.key] || PROFILE_DEFAULT)));
    const label = q.key === 'pace' ? pacePrefLabel(active) : profileLabel(active);
    return `
      <div class="profile-question" data-question="${esc(q.key)}">
        <p>${esc(q.label)}</p>
        <div class="rating-slider-wrap">
          <input
            type="range"
            class="rating-slider"
            min="${PROFILE_MIN}"
            max="${PROFILE_MAX}"
            step="1"
            value="${active}"
            data-rating
            aria-label="${esc(q.label)} rating"
          />
          <div class="rating-meta">
            <span class="rating-value">${active}/5</span>
            <span class="rating-label">${esc(label)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  els.profileTravelNotes.value = profile.aboutMe || '';
  els.profileTravelNotes.disabled = false;
  els.profileEditBtn.textContent = 'Save';

  if (els.aiSummarySection && els.profileAiSummary) {
    const instruction = profile.profileInstruction || '';
    if (instruction) {
      els.profileAiSummary.value = instruction;
      els.aiSummarySection.classList.remove('hidden');
    } else {
      els.aiSummarySection.classList.add('hidden');
    }
  }

  els.profileQuestions.querySelectorAll('[data-rating]').forEach((slider) => {
    slider.addEventListener('input', () => {
      const key = slider.closest('.profile-question')?.dataset.question;
      if (!key) return;

      const nextAnswer = Math.max(PROFILE_MIN, Math.min(PROFILE_MAX, Number(slider.value || PROFILE_DEFAULT)));
      state.profile = normalizeProfile({
        ...(state.profile || defaultProfile()),
        answers: { ...(state.profile?.answers || {}), [key]: nextAnswer }
      });

      const question = slider.closest('.profile-question');
      if (!question) return;
      const valueEl = question.querySelector('.rating-value');
      const labelEl = question.querySelector('.rating-label');
      if (valueEl) valueEl.textContent = `${nextAnswer}/5`;
      if (labelEl) labelEl.textContent = key === 'pace' ? pacePrefLabel(nextAnswer) : profileLabel(nextAnswer);
    });
  });
}

function getProfilePayload() {
  const aboutMeValue = els.profileTravelNotes ? els.profileTravelNotes.value : (state.profile?.aboutMe ?? '');
  const aiSummaryValue = els.profileAiSummary ? els.profileAiSummary.value : (state.profile?.profileInstruction ?? '');
  return normalizeProfile({
    ...(state.profile || defaultProfile()),
    aboutMe: aboutMeValue,
    profileInstruction: aiSummaryValue
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
  const suggested = `Profile ${store.profiles.length + 1}`;
  const prompted = window.prompt('Profile name:', suggested);
  if (prompted === null) return;

  const id = createProfileId();
  const profile = {
    id,
    name: normalizeProfileName(prompted, suggested),
    ...defaultProfile()
  };
  const nextStore = {
    activeId: id,
    profiles: [...store.profiles, profile]
  };
  state.profilesStore = saveProfiles(nextStore);
  state.profile = normalizeProfile(profile);
  renderPreferencesModal();
  showToast('Profile created.', 'success');
}

function deleteActiveProfile() {
  const store = state.profilesStore || loadProfiles();
  if (store.profiles.length <= 1) {
    showToast('At least one profile is required.', 'info');
    return;
  }
  const remaining = store.profiles.filter((p) => p.id !== store.activeId);
  const nextStore = {
    activeId: remaining[0].id,
    profiles: remaining
  };
  state.profilesStore = saveProfiles(nextStore);
  state.profile = normalizeProfile(getActiveProfile(state.profilesStore));
  renderPreferencesModal();
  showToast('Profile deleted.', 'success');
}

async function openPreferencesModal() {
  state.profilesStore = loadProfiles();
  state.profile = normalizeProfile(getActiveProfile(state.profilesStore));
  renderPreferencesModal();
  els.prefsModal.classList.remove('hidden');
}

function closePreferencesModal() {
  renderPreferencesModal();
  els.prefsModal.classList.add('hidden');
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
  const map = {
    food: { icon: '🍴', colorClass: 'activity-food' },
    breakfast: { icon: '🍴', colorClass: 'activity-food' },
    lunch: { icon: '🍴', colorClass: 'activity-food' },
    dinner: { icon: '🍴', colorClass: 'activity-food' },
    show: { icon: '🎭', colorClass: 'activity-show' },
    tour: { icon: '🗺️', colorClass: 'activity-tour' },
    cultural: { icon: '🏛️', colorClass: 'activity-cultural' },
    walk: { icon: '🚶', colorClass: 'activity-walk' },
    neighborhood: { icon: '🚶', colorClass: 'activity-neighborhood' },
    sports: { icon: '⚽', colorClass: 'activity-sports' },
    sunset: { icon: '🌅', colorClass: 'activity-sunset' }
  };
  return map[normalized] || { icon: '📍', colorClass: 'activity-default' };
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

function renderActivities() {
  updateReviewNav();
  populateReviewCityFilter();
  destroyMiniMaps();

  if (state.step === 2 && !reviewImageEnrichInFlight) {
    reviewImageEnrichInFlight = true;
    enrichImages(state.activities).then(() => {
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

  els.activitiesGrid.innerHTML = '';
  filteredActivities.forEach((a) => {
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
    card.className = `card activity-card ${cardStateClass} ${isFlipped ? 'is-flipped' : ''}`.trim();
    card.dataset.activityId = a.id;
    card.innerHTML = `
      <div class="activity-card-inner">
        <div class="activity-card-face activity-card-front">
          <img src="${esc(a.imageUrl || '')}" alt="${esc(a.name)}" />
          <div class="card-content">
            <div class="activity-card-head-actions">
              <div>
                <span class="badge">${esc(a.type)}</span>
                <span class="badge ${verdictClass}">${esc(a.verdict || 'N/A')}</span>
              </div>
              <button class="secondary flip-btn" type="button" title="Flip to map" aria-label="Flip card">🗺️</button>
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
              Customize
              <div class="notes-row">
                <textarea rows="2" class="notes" placeholder="e.g. I want to eat at (RESTAURANT NAME)">${esc(review.notes || '')}</textarea>
                <button class="apply-note" title="Apply note to activity" ${(review.notes || '').trim() ? '' : 'disabled'}>✔</button>
              </div>
            </label>
          </div>
        </div>
        <div class="activity-card-face activity-card-back">
          <div class="card-content map-back-content">
            <div class="activity-card-head-actions">
              <strong>Map view</strong>
              <button class="secondary flip-btn" type="button" title="Flip back" aria-label="Flip card">↩️</button>
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
    const applyBtn = card.querySelector('.apply-note');
    if (notes) {
      notes.addEventListener('input', () => {
        state.reviewed[a.id].notes = notes.value;
        if (applyBtn) applyBtn.disabled = !notes.value.trim();
      });
    }
    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        const note = (state.reviewed[a.id]?.notes || '').trim();
        if (!note) return;
        applyBtn.disabled = true;
        applyBtn.textContent = '…';
        try {
          const resp = await apiFetch('/api/activity/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity: a, note })
          });
          if (!resp.ok) throw new Error('Refine failed');
          const { updates } = await resp.json();
          Object.assign(a, updates);
          state.reviewed[a.id].notes = '';
          renderActivities();
        } catch {
          applyBtn.textContent = '✔';
          applyBtn.disabled = false;
        }
      });
    }

    card.querySelector('.mini-map-wrap')?.addEventListener('click', () => {
      openActivityMapOverlay(a.id);
    });

    els.activitiesGrid.appendChild(card);
  });
}

function destroyMiniMaps() {
  miniMapInstances.forEach((map) => {
    try { map.remove(); } catch {}
  });
  miniMapInstances.clear();
}

async function ensureMiniMapForCard(card, activity) {
  if (!window.L) return;
  const holder = card.querySelector('.mini-map');
  if (!holder) return;
  const key = String(activity.id || '');
  if (!key) return;

  const oldMap = miniMapInstances.get(key);
  if (oldMap) {
    try { oldMap.remove(); } catch {}
    miniMapInstances.delete(key);
  }

  holder.innerHTML = '<div class="mini-map-loading">Loading map…</div>';
  const geo = await geocodeActivity(activity);
  if (!geo) {
    holder.innerHTML = '<div class="mini-map-loading">Location unavailable</div>';
    return;
  }

  holder.innerHTML = '';
  const map = window.L.map(holder, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false });
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  window.L.marker([geo.lat, geo.lng]).addTo(map);
  map.setView([geo.lat, geo.lng], 13);
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

function markerIcon(label, highlighted = false) {
  return window.L.divIcon({
    className: 'activity-map-marker-wrap',
    html: `<div class="activity-map-marker ${highlighted ? 'star' : ''}">${highlighted ? '★' : esc(label)}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

function mountActivityMapOverlay() {
  if (activityMapOverlay) return;
  const overlay = document.createElement('div');
  overlay.className = 'activity-map-overlay hidden';
  overlay.innerHTML = `
    <div class="activity-map-shell">
      <div class="activity-map-topbar">
        <strong>Itinerary map</strong>
        <button class="secondary close-activity-map" type="button">Close ✕</button>
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
  if (!window.L) return;
  mountActivityMapOverlay();
  state.mapOverlaySelectedActivityId = selectedActivityId;
  activityMapOverlay.classList.remove('hidden');

  const mapCanvas = activityMapOverlay.querySelector('#activityMapCanvas');
  const activities = [...state.activities];
  const enriched = [];
  for (const activity of activities) {
    const geo = await geocodeActivity(activity);
    if (geo) enriched.push({ activity, geo });
  }

  if (!activityMapOverlayMap) {
    activityMapOverlayMap = window.L.map(mapCanvas, { zoomControl: true });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(activityMapOverlayMap);
  }

  activityMapOverlayMarkers.forEach((m) => {
    try { m.remove(); } catch {}
  });
  activityMapOverlayMarkers = [];

  const bounds = [];
  enriched.forEach(({ activity, geo }) => {
    const label = makeMapLabel(activity, activities);
    const selected = activity.id === state.mapOverlaySelectedActivityId;
    const marker = window.L.marker([geo.lat, geo.lng], { icon: markerIcon(label, selected) })
      .addTo(activityMapOverlayMap)
      .bindPopup(`<strong>${esc(activity.name || 'Activity')}</strong><br>${esc(activity.city || '')}<br><small>#${esc(label)}</small>`);
    marker.on('click', () => {
      state.mapOverlaySelectedActivityId = activity.id;
      focusActivityCard(activity.id);
      openActivityMapOverlay(activity.id);
    });
    activityMapOverlayMarkers.push(marker);
    bounds.push([geo.lat, geo.lng]);
  });

  if (bounds.length) activityMapOverlayMap.fitBounds(bounds, { padding: [40, 40] });
  setTimeout(() => activityMapOverlayMap.invalidateSize(), 0);
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
  const text = `${activity.name || ''} ${activity.type || ''} ${activity.suggested_time || ''}`;
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
  const durationHours = Number(activity.duration_hours || 0) > 0
    ? Number(activity.duration_hours)
    : (parsedDuration || defaults.durationHours || 1.5);
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
    <button type="button" class="secondary arrange-city-arrow" data-city-prev ${activeIndex <= 0 ? 'disabled' : ''}>←</button>
    <div class="arrange-city-tabs">
      ${cityGroups.map((g) => {
        const start = parseYmdAsLocal(g.days[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const end = parseYmdAsLocal(g.days[g.days.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  const time = parseTimeTo24(placement.time || item.suggested_time || typeToTime(item.type));
  const h = Math.max(28, Number(item.duration_hours || 1) * PX_PER_HOUR);
  const y = yFromTime(time);
  const typeLabel = formatTypeLabel(item.type);
  const durationLabel = formatDurationHoursLong(item.duration_hours || 1);
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
                data-tooltip-start-location="${esc(item.start_location || '')}"
                data-tooltip-end-location="${esc(item.end_location || '')}"
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
  const time = parseTimeTo24(placement.time || currentItem.suggested_time || typeToTime(currentItem.type));
  const h = Math.max(28, Number(currentItem.duration_hours || 1) * PX_PER_HOUR);
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
  const startTime = parseTimeTo24(placement.time || activity.suggested_time || typeToTime(activity.type));
  const startMinutes = minutesFromTime(startTime);
  const durationMinutes = Math.max(30, Number(activity.duration_hours || 1) * 60);
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

function renderArrange() {
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
      html += makeLogisticsCard(`Arrive: ${arrivalLabel}`, '✈️', dayLogistics.arrivalTime);
      // 2. Commute: arrival → accommodation
      html += makeLogisticsCommuteIndicator(arrId, arrAccId, dayLogistics.arrivalTime, cardH);
      // 3. Accommodation card (positioned after arrival + commute)
      const arrToAccCommute = state.commutes[commutePairKey(arrId, arrAccId)] || null;
      const arrToAccMins = resolveSelectedCommuteDetails(arrToAccCommute)?.durationMinutes || 0;
      const accArrivalMins = minutesFromTime(dayLogistics.arrivalTime) + arrToAccMins;
      const accArrivalTime = timeFromMinutes(accArrivalMins);
      html += makeLogisticsCard(accLabel, '🏨', accArrivalTime);
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
        const lastTime = parseTimeTo24(lastPlacement.time || lastItem.suggested_time || typeToTime(lastItem.type));
        const lastEndMins = minutesFromTime(lastTime) + Math.max(30, Number(lastItem.duration_hours || 1) * 60);
        // 1. Commute: last activity → accommodation
        html += makeLogisticsCommuteIndicator(lastItem.id, depAccId, timeFromMinutes(lastEndMins), 0);
      }
      // 2. Accommodation card (positioned before departure - commute)
      const accToDepCommute = state.commutes[commutePairKey(depAccId, depId)] || null;
      const accToDepMins = resolveSelectedCommuteDetails(accToDepCommute)?.durationMinutes || 0;
      const accDepartureMins = minutesFromTime(dayLogistics.departureTime) - accToDepMins;
      const accDepartureTime = timeFromMinutes(Math.max(0, accDepartureMins));
      html += makeLogisticsCard(accLabel, '🏨', accDepartureTime);
      // 3. Commute: accommodation → departure
      html += makeLogisticsCommuteIndicator(depAccId, depId, accDepartureTime, cardH);
      // 4. Departure location card
      html += makeLogisticsCard(`Depart: ${departureLabel}`, '🛫', dayLogistics.departureTime);
    }

    schedule.innerHTML = html;
  });

  bindCommuteInteractions();

  new Sortable(els.stagingArea, {
    group: 'itinerary',
    sort: false,
    animation: 120,
    onStart: (evt) => {
      const id = evt.item?.dataset.id;
      if (!id) return;
      evt.item.dataset.dragActivityId = id;
      evt.item.dataset.prevPlacement = JSON.stringify(state.placements[id] || { dayId: null, time: null });
    }
  });

  document.querySelectorAll('.day-schedule').forEach((zone) => {
    new Sortable(zone, {
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
            time: prevPlacement.time || parseTimeTo24(state.activities.find((a) => a.id === id)?.suggested_time || typeToTime(state.activities.find((a) => a.id === id)?.type))
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
    });
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

    const durationMinutes = Math.max(30, Number(activity.duration_hours || 1) * 60);
    const currentStart = minutesFromTime(parseTimeTo24(state.placements[activity.id]?.time || activity.suggested_time || typeToTime(activity.type)));
    const latestStart = Math.max(dayStartMinutes, dayEndMinutes - durationMinutes);
    const boundedStart = Math.max(dayStartMinutes, Math.min(currentStart, latestStart));
    state.placements[activity.id] = {
      ...(state.placements[activity.id] || {}),
      dayId,
      time: timeFromMinutes(boundedStart)
    };
  });
}

function getAccommodationForDay(cityName, date) {
  const city = state.cities.find((c) => cityMatches(c.name, cityName));
  if (!city || !Array.isArray(city.accommodations) || !city.accommodations.length) return null;

  const dayDate = String(date || '').slice(0, 10);
  const inRange = city.accommodations.find((accommodation) => {
    const checkIn = String(accommodation.checkIn || '').slice(0, 10);
    const checkOut = String(accommodation.checkOut || '').slice(0, 10);
    if (!checkIn || !checkOut || !dayDate) return false;
    return dayDate >= checkIn && dayDate <= checkOut;
  });

  return inRange || city.accommodations[0] || null;
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

    const prevStart = minutesFromTime(parseTimeTo24(state.placements[previous.id]?.time || previous.suggested_time || typeToTime(previous.type)));
    const prevDurationMinutes = Number(previous.duration_hours || 1) * 60;
    const currentStart = minutesFromTime(parseTimeTo24(state.placements[current.id]?.time || current.suggested_time || typeToTime(current.type)));
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
      start_location: a.start_location, end_location: a.end_location,
      accommodation_location: accommodationLocation,
      hotel_location: accommodationLocation,
      hotel_latitude: normalizeCoordinate(accommodation?.latitude),
      hotel_longitude: normalizeCoordinate(accommodation?.longitude),
      suggested_time: state.placements[a.id]?.time || parseTimeTo24(a.suggested_time || typeToTime(a.type))
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
  if (hasExistingPlacements && !window.confirm('This will replace your current arrangement. Continue?')) return;

  const cityPlan = state.cities.find((c) => cityMatches(c.name, activeCity));

  const cityLogistics = cityPlan?.logistics || {};
  const arrivalLocation = String(cityLogistics.arrival?.location || '').trim() || 'arrival point';
  const departureLocation = String(cityLogistics.departure?.location || '').trim() || 'departure point';
  const primaryAccommodation = cityPlan?.accommodations?.[0];
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
          const obj = { id: a.id, name: a.name, category: a.category, duration_hours: a.duration_hours };
          if (a.opening_hours) obj.opening_hours = a.opening_hours;
          const st = String(a.suggested_time || '').trim();
          if (st && st !== '10:00am') obj.suggested_time = st;
          const loc = (a.start_location || a.end_location || '').trim();
          if (loc) obj.location = loc;
          return obj;
        }),
        userId: ensureUserId(),
        profile: getProfilePayload()
      })
    });

    if (!res.ok) throw new Error('Arrange request failed');
    const { placements, unplaced = [] } = await res.json();

    const dateToDay = Object.fromEntries(activeDays.map((d) => [d.date, d]));
    for (const [id, placement] of Object.entries(placements || {})) {
      const day = dateToDay[placement.date];
      if (day) state.placements[id] = { dayId: day.id, time: placement.time };
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
        if (activity) activity.duration_hours = nextDurationHours;
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

    const activityHours = items.reduce((sum, item) => sum + Number(item.duration_hours || 1), 0);
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
          <p><strong>Time:</strong> ${esc(state.placements[a.id]?.time || parseTimeTo24(a.suggested_time || typeToTime(a.type)))}</p>
          <p><strong>Duration:</strong> ${esc(formatDuration(a.duration_hours || 1))}</p>
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

  renderExecutionMode();
}

function getExecutionRows() {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  return approved
    .map((activity) => {
      const placement = state.placements[activity.id] || {};
      const day = state.days.find((d) => d.id === placement.dayId);
      if (!day) return null;

      const time = placement.time || parseTimeTo24(activity.suggested_time || typeToTime(activity.type));
      const place = String(activity.start_location || activity.end_location || activity.city || '').trim();
      const note = String(activity.why_it_fits || activity.type || '').trim();
      const locationQuery = place || `${activity.name} ${activity.city || ''}`;
      const navigateHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`;
      const phone = String(activity.phone || activity.phone_number || activity.contact_phone || '').trim();

      return {
        id: activity.id,
        date: day.date,
        city: day.city,
        time,
        title: activity.name,
        place,
        note,
        navigateHref,
        callHref: phone ? `tel:${phone}` : ''
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aKey = `${a.date}T${parseTimeTo24(a.time)}`;
      const bKey = `${b.date}T${parseTimeTo24(b.time)}`;
      return new Date(aKey).getTime() - new Date(bKey).getTime();
    });
}

function getConsolidatedConfirmations() {
  const rows = [];
  state.cities.forEach((city) => {
    const cityName = String(city?.name || '').trim();
    const logistics = city?.logistics || {};
    const accommodation = (city?.accommodations || [])[0] || {};

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
  const executionRows = getExecutionRows();
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
    itemCount: executionRows.length,
    executionRows,
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
    ...payload.executionRows.map((row) => `${row.date} ${parseTimeTo24(row.time)} • ${row.title}${row.place ? ` — ${row.place}` : ''}`),
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

  const shareUrl = `${window.location.origin}/planner.html?itinerary=${encodeURIComponent(state.currentItineraryId)}&mode=execution`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${state.tripName || 'Trip'} — Smart Minimal Itinerary`,
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

function renderExecutionSummary(payload) {
  if (!els.executionSummary) return;
  const range = payload.firstDate && payload.lastDate ? `${payload.firstDate} → ${payload.lastDate}` : 'No date range';
  els.executionSummary.innerHTML = `
    <article class="execution-summary-card">
      <h4>Trip</h4>
      <p>${esc(payload.tripName)}</p>
    </article>
    <article class="execution-summary-card">
      <h4>Dates</h4>
      <p>${esc(range)}</p>
    </article>
    <article class="execution-summary-card">
      <h4>Cities</h4>
      <p>${esc(payload.cities.join(', ') || '—')}</p>
    </article>
    <article class="execution-summary-card">
      <h4>Items</h4>
      <p>${payload.itemCount}</p>
    </article>
  `;
}

function renderExecutionConfirmations(confirmations = []) {
  if (!els.executionConfirmations) return;
  if (!confirmations.length) {
    els.executionConfirmations.innerHTML = '<p class="muted-text">No confirmations captured yet.</p>';
    return;
  }

  els.executionConfirmations.innerHTML = confirmations.map((row) => `
    <article class="execution-confirmation-item">
      <p><strong>${esc(row.type)}:</strong> ${esc(row.title || '—')}</p>
      <p class="muted-text">${esc([row.city, row.meta].filter(Boolean).join(' • '))}</p>
    </article>
  `).join('');
}

function renderExecutionMode() {
  if (!els.executionModeList) return;
  const payload = getMinimalPayload();
  const rows = payload.executionRows;
  renderExecutionSummary(payload);
  renderExecutionConfirmations(payload.confirmations);

  if (!rows.length) {
    els.executionModeList.innerHTML = '<p class="muted-text">No scheduled itinerary yet. Build your plan in Planning Mode first.</p>';
    return;
  }

  const groups = rows.reduce((acc, row) => {
    const key = `${row.date}__${row.city}`;
    if (!acc[key]) acc[key] = { date: row.date, city: row.city, items: [] };
    acc[key].items.push(row);
    return acc;
  }, {});

  els.executionModeList.innerHTML = Object.values(groups).map((group) => `
    <section class="execution-day-group">
      <h3>${esc(group.date)} • ${esc(group.city)}</h3>
      ${group.items.map((row) => `
    <article class="execution-item">
      <div class="execution-time">${esc(row.time)}</div>
      <div class="execution-place">${esc(row.title)}${row.place ? ` — ${esc(row.place)}` : ''}</div>
      <p class="execution-note">${esc(row.note || 'No note')}</p>
      <div class="execution-actions">
        <a href="${esc(row.navigateHref)}" target="_blank" rel="noopener noreferrer">🧭 Navigate</a>
        ${row.callHref ? `<a href="${esc(row.callHref)}">📞 Call</a>` : '<button type="button" disabled>📞 Call</button>'}
      </div>
    </article>
      `).join('')}
    </section>
  `).join('');
}

function setViewMode(mode = 'planning') {
  const resolved = mode === 'execution' ? 'execution' : 'planning';
  state.viewMode = resolved;
  localStorage.setItem(VIEW_MODE_KEY, resolved);
  syncToServer('viewMode', resolved);
  document.body.classList.toggle('execution-mode', resolved === 'execution');
  if (els.planningModeBtn) els.planningModeBtn.classList.toggle('active', resolved === 'planning');
  if (els.executionModeBtn) els.executionModeBtn.classList.toggle('active', resolved === 'execution');
  if (resolved === 'execution') renderExecutionMode();
}

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
          <button type="button" class="secondary" data-delete-itinerary="${esc(item.id)}">Delete</button>
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
      const confirmed = window.confirm('Delete this saved itinerary?');
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
    state.cities = Array.isArray(itinerary.cities)
      ? itinerary.cities.map(normalizeCityData)
      : state.cities;
    state.travels = Array.isArray(itinerary.travels) ? itinerary.travels.slice(0, 1).map(normalizeTravelEntry) : state.travels;
    state.days = Array.isArray(itinerary.days)
      ? itinerary.days.map((day) => ({ id: day.id || `${day.city}-${day.date}`, city: day.city, date: day.date }))
      : [];

    const activities = [];
    const reviewed = {};
    const placements = {};
    (itinerary.days || []).forEach((day) => {
      (day.activities || []).forEach((activity) => {
        const normalizedActivity = normalizeActivityMetadata(activity);
        const idValue = normalizedActivity.id || uid();
        activities.push({ ...normalizedActivity, id: idValue });
        reviewed[idValue] = { approved: true, notes: activity.notes || '' };
        placements[idValue] = { dayId: day.id || `${day.city}-${day.date}`, time: parseTimeTo24(activity.time || activity.suggested_time || typeToTime(activity.type)) };
      });
    });

    state.activities = activities;
    state.reviewed = reviewed;
    state.placements = placements;
    hydrateTravelIntoCities();
    renderCities();
    updateCalendarControls();
    renderItinerary();
    await fetchSavedItineraries();
    renderSavedItineraries();
    ensureChatSessionId();
    await restoreChatHistory();
    setStep(4);
  } catch {
    showToast('Could not load itinerary.', 'error');
  }
}

async function planTrip() {
  state.tripName = els.tripName.value.trim();
  syncLegacyTravelsFromCities();
  const cities = state.cities.map(({name,startDate,endDate,leaveTime,notes,accommodations,travelEntry,logistics}) => ({
    name,
    startDate,
    endDate,
    leaveTime,
    notes,
    logistics: logistics ? JSON.parse(JSON.stringify(logistics)) : null,
    accommodations: Array.isArray(accommodations) ? accommodations : [],
    travelEntry: travelEntry ? { ...travelEntry } : null
  }));
  const travels = state.travels.map((travel) => ({ ...travel }));
  const payload = { cities, travels, profile: state.profile || loadProfile(), userId: ensureUserId() };

  state.activities = [];
  state.reviewed = {};
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
        const normalized = normalizeActivityMetadata(a);
        return {
          id: normalized.id || `${evt.city}-${i}-${uid()}`,
          ...normalized,
          city: canonicalizeActivityCity(normalized.city, evt.city),
          start_location: String(normalized.start_location || '').trim(),
          end_location: String(normalized.end_location || '').trim()
        };
      });

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

  const payload = {
    tripName: state.tripName,
    cities: state.cities,
    travels: state.travels,
    days: byDay
  };
  const res = await apiFetch('/api/itinerary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
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
      .map((a) => ({ name: a.name, type: a.type, time: state.placements[a.id]?.time, duration: a.duration, location: a.start_location }))
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
    accommodations: (c.accommodations || []).map((a) => a.address).filter(Boolean)
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

function step1Fingerprint() {
  return JSON.stringify({ cities: state.cities, travels: state.travels });
}

function clearSnapshot() {
  localStorage.removeItem(SNAPSHOT_KEY);
  syncToServer('snapshot', null);
}

function saveSnapshot() {
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
    currentStep: 3
  };
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  syncToServer('snapshot', payload);
  showToast('Saved!', 'success');
}

function resetToFresh() {
  state.step = 1;
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
  state.activities = snapshot.activities || [];
  state.placements = snapshot.placements || {};
  state.commutes = normalizeCommuteStateMap(snapshot.commutes || {});
  state.reviewed = snapshot.reviewed || {};
  const snapshotDays = Array.isArray(snapshot.days) ? snapshot.days : [];
  state.days = daysMatchCities(snapshotDays, state.cities)
    ? snapshotDays
    : expandDays(state.cities);
  state.arrangeCity = snapshot.arrangeCity || state.days[0]?.city || null;

  els.tripName.value = state.tripName;
  renderCities();
  renderActivities();
  renderArrange();
  setStep(3);
}

function renderMyTrips() {
  if (!els.myTripsPanel || !els.myTripsList) return;

  const snapshot = getSnapshot();
  const trips = [];

  if (snapshot) {
    trips.push({
      type: 'draft',
      tripName: snapshot.tripName || 'Untitled Trip',
      detail: 'In-progress draft',
      snapshot
    });
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
    deleteDraftBtn.addEventListener('click', () => {
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
      const confirmed = window.confirm('Delete this trip?');
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
    if (mode === 'execution') setViewMode('execution');
    return true;
  } catch {
    const offline = loadMinimalOfflinePayload(itineraryId);
    if (!offline) return false;

    if (els.executionSummary) {
      renderExecutionSummary(offline);
    }
    if (els.executionConfirmations) {
      renderExecutionConfirmations(offline.confirmations || []);
    }
    if (els.executionModeList) {
      els.executionModeList.innerHTML = (offline.executionRows || []).map((row) => `
        <article class="execution-item">
          <div class="execution-time">${esc(row.time)} • ${esc(row.date)}</div>
          <div class="execution-place">${esc(row.title)}${row.place ? ` — ${esc(row.place)}` : ''}</div>
          <p class="execution-note">${esc(row.note || '')}</p>
        </article>
      `).join('');
    }
    setViewMode('execution');
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
  if (els.authUserLabel) {
    els.authUserLabel.textContent = state.authUserEmail || (state.authUserId ? 'Signed in' : 'Signed out');
  }
  if (els.signInBtn) els.signInBtn.classList.toggle('hidden', Boolean(state.authUserId));
  if (els.signOutBtn) els.signOutBtn.classList.toggle('hidden', !state.authUserId);
  if (els.forwardingPanel) els.forwardingPanel.classList.toggle('hidden', !state.forwardingAddress);
  if (els.forwardingAddress) els.forwardingAddress.textContent = state.forwardingAddress || 'Not available yet';
  updateCalendarControls();
}

function updateCalendarControls() {
  const hasItinerary = Boolean(state.currentItineraryId);
  if (els.downloadCalendarBtn) els.downloadCalendarBtn.disabled = !hasItinerary;
  if (els.syncGoogleCalendarBtn) els.syncGoogleCalendarBtn.disabled = !(hasItinerary && state.googleCalendarConnected);
  if (els.connectGoogleCalendarBtn) {
    els.connectGoogleCalendarBtn.textContent = state.googleCalendarConnected ? '✅ Google Connected' : '🔐 Connect Google';
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

els.saveProgressBtn.addEventListener('click', saveSnapshot);
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
els.executionModeBtn?.addEventListener('click', () => setViewMode('execution'));
els.preferencesLink.addEventListener('click', openPreferencesModal);
els.prefsClose.addEventListener('click', closePreferencesModal);
els.prefsModal.addEventListener('click', (e) => {
  if (e.target === els.prefsModal) closePreferencesModal();
});
els.profileEditBtn.addEventListener('click', async () => {
  const next = getProfilePayload();
  if (activeSavingToastId) {
    const stale = document.querySelector(`[data-toast-id="${activeSavingToastId}"]`);
    stale?.click();
  }
  activeSavingToastId = showToast('Saving...', 'info');
  saveProfile(next);

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
      saveProfile({ ...next, profileInstruction: instruction });
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

els.profileSelector?.addEventListener('change', (e) => {
  const nextId = e.target.value;
  if (!nextId) return;
  switchActiveProfile(nextId);
});

els.newProfileBtn?.addEventListener('click', createNewProfile);
els.deleteProfileBtn?.addEventListener('click', deleteActiveProfile);

els.activitiesGrid.addEventListener('change', () => {
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  state.days = expandDays(state.cities);
  state.arrangeCity = state.arrangeCity || state.days[0]?.city || null;
  approved.forEach((a) => {
    state.placements[a.id] = state.placements[a.id] || { dayId: null, time: parseTimeTo24(a.suggested_time || typeToTime(a.type)) };
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
  setViewMode(localStorage.getItem(VIEW_MODE_KEY) === 'execution' ? 'execution' : 'planning');
  const loadedFromShare = await maybeLoadSharedItineraryFromUrl();
  if (!loadedFromShare) renderMyTrips();
})();
