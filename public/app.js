const persist = window.TravelPlannerStatePersistence.createStatePersistence();
const overlayManager = window.TravelPlannerOverlayManager.createOverlayManager();

function sendDebug(scope, payload) {
  try {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    apiFetch('/debug/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, message }),
      keepalive: true
    }).catch(() => {});
  } catch {}
}


['prefsModal', 'checklistModal', 'budgetOptOverlay', 'addActivityModal',
 'attachmentViewerModal',
 'planningOverlay', 'textareaExpandModal', 'confirmDialog', 'resumeTripsModal']
  .forEach((id) => overlayManager.register(id, () => document.getElementById(id)));

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
    type: '',
    verdict: '',
    sort: ''
  },
  reviewCardFlips: {},
  viewMode: 'planning',
  arrangeConfig: null,
  arrangeUnplaced: {},
  arrangedSignatures: {},
  arrangeUnplacedPanelOpen: false,
  lastPlannedFingerprint: null,
  authReady: false,
  authUserId: '',
  authUserEmail: '',
  forwardingAddress: '',
  calendarMetadataMode: 'compact',
  googleCalendarConnected: false,
  mapOverlaySelectedActivityId: null,
  tripHealth: null,
  bookingChecklist: [],
  bookingChecklistNotificationPrefs: { emailSummary: false, reminderBeforeDeparture: false },
  bookingChecklistIssueMeta: {},
  lastFinalizeLocks: {},
  schedulingPrefs: null
};
window.state = state;
window.addEventListener('DOMContentLoaded', () => {
  if (typeof setViewMode === 'function') window.setViewMode = setViewMode;
});

let budgetOptState = null;

const PROFILES_KEY = 'travelplanner_profiles_v1';
const SCHEDULING_PREFS_KEY = 'travelplanner_scheduling_prefs_v1';
const LEGACY_PROFILE_KEY = 'travelplanner_profile_v1';
// PROFILE_QUESTIONS, PROFILE_MIN, PROFILE_MAX, PROFILE_DEFAULT, profileLabel,
// pacePrefLabel provided by /js/profileWizard.js

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
  reviewTypeFilter: document.getElementById('reviewTypeFilter'),
  reviewVerdictFilter: document.getElementById('reviewVerdictFilter'),
  reviewSortFilter: document.getElementById('reviewSortFilter'),
  approveVisibleBtn: document.getElementById('approveVisibleBtn'),
  continueArrangeBtn: document.getElementById('continueArrangeBtn'),
  backToSetupBtn: document.getElementById('backToSetupBtn'),
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

  schedulingWizardBtn: document.getElementById('schedulingWizardBtn'),
  finalizeArrangeBtn: document.getElementById('finalizeArrangeBtn'),
  myTripsPanel: document.getElementById('myTripsPanel'),
  myTripsList: document.getElementById('myTripsList'),
  chatBubble: document.getElementById('chatBubble'),
  chatPanel: document.getElementById('chatPanel'),
  chatClose: document.getElementById('chatClose'),
  chatMessages: document.getElementById('chatMessages'),
  chatSuggestions: document.getElementById('chatSuggestions'),
  chatInput: document.getElementById('chatInput'),
  chatSend: document.getElementById('chatSend'),
  tripHealthBadge: document.getElementById("tripHealthBadge"),
  tripHealthPopover: document.getElementById("tripHealthPopover"),
  tripHealthPopoverStatus: document.getElementById("tripHealthPopoverStatus"),
  tripHealthPopoverIssues: document.getElementById("tripHealthPopoverIssues"),
  tripHealthPopoverTopIssue: document.getElementById("tripHealthPopoverTopIssue"),
  tripHealthPopoverProgress: document.getElementById("tripHealthPopoverProgress"),
  openTripHealthReviewBtn: document.getElementById("openTripHealthReviewBtn"),
  tripHealthSummary: document.getElementById("tripHealthSummary"),
  tripHealthIssues: document.getElementById("tripHealthIssues"),

  bookingChecklist: document.getElementById("bookingChecklist")
};

const SNAPSHOT_KEY = 'travelplanner_snapshot';
const VIEW_MODE_KEY = 'travelplanner_view_mode_v1';
const MINIMAL_OFFLINE_KEY = 'travelplanner_minimal_offline_v1';
const GEO_CACHE_KEY = 'travelplanner_geo_cache_v2';
const PLACES_CACHE_KEY = 'travelplanner_places_cache_v1';
const PLACES_CACHE_MAX = 500;
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s='') => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// normalizeCity provided by /js/cityPlanner.js

// activity accessors (actDurationHours, actPreferredTime, actAddress, actCostUsd,
// actCostType, actBookingType, actBookingLinks, actOpeningHours) provided by /js/activityCard.js

const geocodeCache = loadGeocodeCache();
let geocodeQueue = Promise.resolve();
let activityMapOverlay = null;
let activityMapOverlayMap = null;
let activityMapOverlayMarkers = [];
overlayManager.register('activityMapOverlay', () => activityMapOverlay);
const miniMapInstances = new Map();

function loadGeocodeCache() {
  const parsed = persist.loadJson(GEO_CACHE_KEY, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function persistGeocodeCache() {
  persist.saveJson(GEO_CACHE_KEY, geocodeCache);
}

function geocodeKey(value = '') {
  return String(value || '').trim().toLowerCase();
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

// stripMealPrefix, priceLevelBadge, representativeCostUsd, getGetYourGuideLink,
// googleMapsLinkHtml, headerPriceBadgeHtml, renderActivityCostCell provided by /js/activityCard.js

function loadPlacesCache() {
  const parsed = persist.loadJson(PLACES_CACHE_KEY, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

const placesCache = loadPlacesCache();

function persistPlacesCache() {
  const keys = Object.keys(placesCache);
  if (keys.length > PLACES_CACHE_MAX) {
    const overflow = keys.length - PLACES_CACHE_MAX;
    for (let i = 0; i < overflow; i += 1) delete placesCache[keys[i]];
  }
  persist.saveJson(PLACES_CACHE_KEY, placesCache);
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

// cityVariants, cityMatches provided by /js/cityPlanner.js

function canonicalizeActivityCity(activityCity = '', fallbackCity = '') {
  const preferred = [String(activityCity || '').trim(), String(fallbackCity || '').trim()].filter(Boolean);
  const plannedCityNames = state.cities.map((c) => String(c?.name || '').trim()).filter(Boolean);

  for (const candidate of preferred) {
    const match = plannedCityNames.find((cityName) => cityMatches(candidate, cityName));
    if (match) return match;
  }

  return preferred[0] || '';
}

// parseYmdAsLocal, formatYmdLocal, normalizeCityLogistics, resolveDateTime,
// validateCityTimeline, syncCityLegacyDates provided by /js/cityPlanner.js

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

// normalizeCoordinate provided by /js/cityPlanner.js

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
    if (!inner) return;
    inner.style.width = '100%';
    inner.style.minWidth = '0';
    if (!isMobile) return;
    inner.style.cssText += ';font-size:0.8rem;padding:4px 8px;height:32px;min-height:0;box-sizing:border-box';
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

// formatCitySuggestion provided by /js/cityPlanner.js

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

// defaultProfile, createProfileId, normalizeProfileName, defaultProfilesStore,
// normalizeProfilesStore provided by /js/profileWizard.js

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
      if (!localStorage.getItem(SNAPSHOT_KEY)) {
        persist.saveJson(SNAPSHOT_KEY, data.snapshot);
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

// getActiveProfile, normalizeProfile provided by /js/profileWizard.js

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

function loadSchedulingPrefs() {
  try {
    const raw = localStorage.getItem(SCHEDULING_PREFS_KEY);
    if (raw) return normalizeSchedulingPrefs(JSON.parse(raw));
  } catch {}
  return defaultSchedulingPrefs();
}

function saveSchedulingPrefs(prefs) {
  const normalized = normalizeSchedulingPrefs(prefs);
  try { localStorage.setItem(SCHEDULING_PREFS_KEY, JSON.stringify(normalized)); } catch {}
  state.schedulingPrefs = normalized;
  return normalized;
}

function clearSchedulingPrefs() {
  try { localStorage.removeItem(SCHEDULING_PREFS_KEY); } catch {}
  state.schedulingPrefs = defaultSchedulingPrefs();
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

const BUDGET_OPT_MESSAGES = [
  'Hunting for hidden deals...',
  'Haggling on your behalf...',
  'Keeping the fun, trimming the cost...',
  'Comparing prices across town...',
  'Your wallet will thank you...'
];

const ARRANGE_MESSAGES = [
  'Measuring walking distances...',
  'Untangling your days...',
  'Protecting your lunch break...',
  'Dodging rush hour...',
  'Putting the pieces together...'
];

const REPLACE_MESSAGES = [
  'Reading between the lines of your note...',
  'Scouting alternatives nearby...',
  'Checking what the locals recommend...',
  'Almost found it...'
];

let loadingInterval = null;
let loadingMessageIndex = 0;
let profileSnapshot = null;

function refreshOverlayInterlocks() {
  overlayManager.refresh();
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

function showErrorBanner(message) {
  if (!message) return;
  let banner = document.getElementById('errorBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'errorBanner';
    banner.className = 'error-banner';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = '<span class="error-banner-message"></span><button class="error-banner-dismiss" type="button" aria-label="Dismiss">&times;</button>';
    banner.querySelector('.error-banner-dismiss').addEventListener('click', () => banner.remove());
    document.body.appendChild(banner);
  }
  banner.querySelector('.error-banner-message').textContent = String(message);
}

function setLoaderStatus(status = '', progressLabel = '') {
  const overlay = document.getElementById('planningOverlay');
  if (!overlay) return;
  overlay.querySelector('[data-city-status]').textContent = status;
  overlay.querySelector('[data-progress]').textContent = progressLabel;
}

// Progress-bar trickle: completed units (cities, refined activities, arrange
// milestones) are the only real signal, so we ease the bar forward continuously
// toward the next real milestone — capped just below it until that unit actually
// completes, then snapped exactly to the milestone.
let loaderProgress = null;

function applyLoaderProgress(percent) {
  const overlay = document.getElementById('planningOverlay');
  if (!overlay) return;
  const clamped = Math.max(0, Math.min(100, percent));
  overlay.querySelector('[data-progress-fill]').style.width = `${clamped.toFixed(1)}%`;
  overlay.querySelector('.planning-bar')?.setAttribute('aria-valuenow', String(Math.round(clamped)));
}

function beginLoaderProgress(totalUnits) {
  endLoaderProgress();
  loaderProgress = { total: Math.max(1, totalUnits), done: 0, display: 0, ceiling: 0, timer: null };
  recomputeLoaderCeiling();
  applyLoaderProgress(0);
  loaderProgress.timer = setInterval(() => {
    loaderProgress.display += (loaderProgress.ceiling - loaderProgress.display) * 0.035;
    applyLoaderProgress(loaderProgress.display);
  }, 120);
}

function recomputeLoaderCeiling() {
  if (loaderProgress.done >= loaderProgress.total) {
    loaderProgress.ceiling = 100;
    return;
  }
  const share = 100 / loaderProgress.total;
  loaderProgress.ceiling = Math.min(loaderProgress.done * share + share * 0.9, 96);
}

function setLoaderUnitsDone(done) {
  if (!loaderProgress) return;
  loaderProgress.done = done;
  recomputeLoaderCeiling();
  loaderProgress.display = Math.max(loaderProgress.display, done * (100 / loaderProgress.total));
  applyLoaderProgress(loaderProgress.display);
}

function finishLoaderProgress() {
  if (!loaderProgress) return;
  clearInterval(loaderProgress.timer);
  loaderProgress.timer = null;
  applyLoaderProgress(100);
}

function endLoaderProgress() {
  if (loaderProgress?.timer) clearInterval(loaderProgress.timer);
  loaderProgress = null;
  applyLoaderProgress(0);
}

let loaderMessages = LOADING_MESSAGES;

function showLoader({ title, status = '', progressLabel = '', messages = LOADING_MESSAGES, totalUnits = 1 }) {
  const overlay = document.getElementById('planningOverlay');
  if (!overlay) return;

  loaderMessages = messages;
  overlay.querySelector('[data-trip-name]').textContent = title;
  overlay.querySelector('[data-loading-message]').textContent = messages[0];
  setLoaderStatus(status, progressLabel);
  beginLoaderProgress(totalUnits);
  overlay.classList.remove('hidden');
  refreshOverlayInterlocks();

  if (loadingInterval) clearInterval(loadingInterval);
  loadingMessageIndex = 0;
  loadingInterval = setInterval(() => {
    loadingMessageIndex = (loadingMessageIndex + 1) % loaderMessages.length;
    const messageEl = overlay.querySelector('[data-loading-message]');
    messageEl.classList.remove('loading-visible');
    setTimeout(() => {
      messageEl.textContent = loaderMessages[loadingMessageIndex];
      messageEl.classList.add('loading-visible');
    }, 140);
  }, 2400);
}

function hideLoader() {
  const overlay = document.getElementById('planningOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  refreshOverlayInterlocks();
  if (loadingInterval) clearInterval(loadingInterval);
  loadingInterval = null;
  loadingMessageIndex = 0;
  endLoaderProgress();
}

const STEP_SLUGS = ['setup', 'review', 'arrange', 'finalize'];
const stepPath = (n) => `/plan/${STEP_SLUGS[n - 1] || STEP_SLUGS[0]}`;
function stepFromPath() {
  const slug = (location.pathname.match(/^\/plan\/([^/]+)/)?.[1] || '').toLowerCase();
  const index = STEP_SLUGS.indexOf(slug);
  return index === -1 ? 1 : index + 1;
}

// Every interactive way out of Setup goes through this: the Next button, the step chips, browser
// back/forward, and the Trip Health badge in the topbar. With no cities there is nothing to plan and
// nothing to review: the regenerate dialog builds its checkboxes from state.cities, so an empty list
// renders a modal with no rows whose every exit resolves null — which reads as "user declined" and
// lands on Review showing activities for cities that are gone. maxStep is monotonic and is never
// lowered when cities are removed, so the step chips and browser history need the same check the
// Next button does.
function canLeaveSetup() {
  if (state.cities.length) return true;
  showErrorBanner('Add at least one city to continue.');
  return false;
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
  if (pushHistory) {
    const keepUrl = state.readOnlyShare || document.body.classList.contains('is-embed');
    history.pushState({ spa: true, step: n }, '', keepUrl ? '' : stepPath(n));
  }
  if (typeof renderChatSuggestions === 'function') renderChatSuggestions();

  // Ensure the target step's content is rendered regardless of navigation source
  if (n !== prev) {
    if (n === 1) renderCities();
    if (n === 2) renderActivities();
    if (n === 3) renderArrange();
    if (n === 4) renderItinerary();
  }

  renderBudgetTracker();
  updateStepNavButtons();
  renderTripHealth();
}

window.addEventListener('popstate', (e) => {
  if (!e.state?.spa) return;
  const step = e.state.step;
  if (step > 1 && !canLeaveSetup()) return;
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

// migrateChecklistType, mapActivityTypeToChecklist, normalizeChecklistItem,
// checklistItemSortKey, sortChecklistByDateAsc provided by /js/bookingChecklist.js

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
  const cityOrder = new Map((state.cities || []).map((c, i) => [String(c.name || '').trim(), i]));
  cityGroups.sort((a, b) => {
    if (a.planned !== b.planned) return a.planned ? -1 : 1;
    const oa = cityOrder.has(a.label) ? cityOrder.get(a.label) : Number.MAX_SAFE_INTEGER;
    const ob = cityOrder.has(b.label) ? cityOrder.get(b.label) : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
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

// formatChecklistDate provided by /js/bookingChecklist.js

function checklistActivityEndTime(item) {
  if (!item.activityTime || !item.activityId) return '';
  if (item.activityEndTime) return parseTimeTo24(item.activityEndTime);
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
  const existing = (Array.isArray(state.bookingChecklist) ? state.bookingChecklist : [])
    .map(normalizeChecklistItem)
    .filter((item) => {
      if (item.type !== 'activity' || !item.activityId) return true;
      if (!activityIds.has(item.activityId)) return false;
      return state.reviewed[item.activityId]?.approved !== false;
    });

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
    const representativeCost = (() => {
      const perPerson = representativeCostUsd(a);
      if (perPerson == null) return null;
      const adults = state.numTravelers || 1;
      const children = state.numChildren || 0;
      return perPerson * adults + perPerson * 0.6 * children;
    })();
    const activityEstimatedCost = activityBudgetUsd(a);
    const item = normalizeChecklistItem({
      type: 'activity',
      activityId: a.id,
      bookingNotRequired: Boolean(state.reviewed[a.id]?.bookingNotRequired),
      name: a.name || '',
      activityLocation: day ? (day.city || '') : (a.city || ''),
      activityDate: day ? (day.date || '') : '',
      activityTime: time || '',
      budgetUsd: activityEstimatedCost,
      budgetUsdAuto: activityEstimatedCost,
      notes
    });

    const existingIdx = items.findIndex((x) => x.type === 'activity' && x.activityId && x.activityId === a.id);
    const fallbackIdx = existingIdx === -1 ? items.findIndex((x) => x.type === 'activity' && keyOf(x) === keyOf(item)) : -1;
    const idx = existingIdx !== -1 ? existingIdx : fallbackIdx;

    if (idx !== -1) {
      // Items created before budgetUsdAuto existed were auto-derived from the representative cost
      const priorAuto = items[idx].budgetUsdAuto ?? representativeCost;
      const userOverrode = items[idx].budgetUsd != null && items[idx].budgetUsd !== priorAuto;
      items[idx] = normalizeChecklistItem({
        ...items[idx],
        activityId: a.id,
        bookingNotRequired: items[idx].bookingNotRequired ?? Boolean(state.reviewed[a.id]?.bookingNotRequired),
        name: item.name,
        activityLocation: items[idx].activityLocation || item.activityLocation,
        activityDate: item.activityDate,
        activityTime: item.activityTime,
        budgetUsd: userOverrode ? items[idx].budgetUsd : activityEstimatedCost,
        budgetUsdAuto: activityEstimatedCost,
        notes
      });
      existingKeys.add(keyOf(items[idx]));
    } else if (!existingKeys.has(keyOf(item))) {
      items.push(item);
      existingKeys.add(keyOf(item));
    }
  });

  state.bookingChecklist = items;
  return items;
}

function syncActivityNotesToChecklist(activityId, notes) {
  if (!activityId) return;
  const normalizedNotes = String(notes || '').trim();
  buildChecklistFromState();
  const item = state.bookingChecklist.find((x) => x.type === 'activity' && x.activityId === activityId);
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

function syncChecklistDateTimeToPlacement(item = {}) {
  if (item.type !== 'activity' || !item.activityId) return;
  const activityId = String(item.activityId).trim();
  if (!activityId) return;
  const existing = state.placements[activityId] || { dayId: null, time: null };
  const desiredDate = String(item.activityDate || '').slice(0, 10);
  const desiredTime = parseTimeTo24(item.activityTime || '');
  const matchingDay = desiredDate ? (state.days || []).find((d) => d.date === desiredDate) : null;
  const nextTime = desiredTime || existing.time || null;
  state.placements[activityId] = {
    dayId: matchingDay ? matchingDay.id : existing.dayId,
    time: nextTime,
    endTime: nextTime === existing.time ? (existing.endTime ?? null) : null
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

function computeTripHealthLocal() {
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
    const meta = state.bookingChecklistIssueMeta[issue.message] || {};
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

function checklistAttachmentKey(item) {
  return item.type === 'activity' && item.activityId ? item.activityId : item.id;
}

function renderChecklistItemExpanded(item) {
  const hasSecondary = item.referenceNum || item.notes || item.budgetUsd != null;
  const showReferenceField = item.type !== 'activity' || !item.bookingNotRequired;
  const attachmentKey = checklistAttachmentKey(item);
  const fileCount = getItemAttachments(attachmentKey).length;
  const filesDisabled = fileCount === 0 ? ' disabled' : '';
  const filesCountHtml = fileCount > 0 ? ` <span class="count">${fileCount}</span>` : '';

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
      <label class="cl-field">
        <span class="cl-field-label">Date &amp; time</span>
        <div class="cl-datetime-pair cl-datetime-pair--range">
          <input type="date" data-cl="activityDate" value="${esc(item.activityDate)}" />
          <input type="time" data-cl="activityTime" value="${esc(item.activityTime)}" />
          <span class="finalize-time-sep">–</span>
          <input type="time" data-cl="activityEndTime" value="${esc(item.activityEndTime || checklistActivityEndTime(item))}" />
        </div>
      </label>
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
          <div class="cl-file-actions stop__actions">
            <button type="button" class="stop-act" data-cl-action="view-files" data-cl-key="${esc(attachmentKey)}"${filesDisabled}><i class="ph-bold ph-folder-open"></i>View Files${filesCountHtml}</button>
            <button type="button" class="stop-act" data-cl-action="upload-files" data-cl-key="${esc(attachmentKey)}"><i class="ph-bold ph-upload-simple"></i>Upload Files</button>
          </div>
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
          ${renderItemsBlock(group.items)}
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
  const el = els.bookingChecklist;
  if (!el) return;

  const checklist = state.bookingChecklist || [];
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
    updateFinalizeBtn();
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
      const item = state.bookingChecklist.find((x) => x.id === id);
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
      const item = state.bookingChecklist.find((x) => x.id === id);
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
      const item = state.bookingChecklist.find((x) => x.id === id);
      if (!item) return;
      item.verified = !item.verified;
      item.status = item.verified ? 'resolved' : 'open';
      item.updatedAt = new Date().toISOString();
      renderChecklistModal();
      renderTripHealthBadge();
      updateFinalizeBtn();
    });
  });

  // Booking required toggle (activity only)
  el.querySelectorAll('[data-cl-booking-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemEl = btn.closest('[data-cl-item]');
      if (!itemEl) return;
      const groupLabel = btn.closest('[data-cl-group]')?.dataset.clGroup || '';
      const id = itemEl.dataset.clItem;
      const item = state.bookingChecklist.find((x) => x.id === id);
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

  el.querySelectorAll('[data-cl-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemEl = btn.closest('[data-cl-item]');
      if (!itemEl) return;
      const id = itemEl.dataset.clItem;
      const deleted = state.bookingChecklist.find((x) => x.id === id);
      if (!deleted || deleted.type === 'activity') return;
      state.bookingChecklist = state.bookingChecklist.filter((x) => x.id !== id);
      renderChecklistModal();
      renderTripHealthBadge();
    });
  });

  // Upload Files / View Files (per checklist item)
  el.querySelectorAll('[data-cl-action="upload-files"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.clKey;
      if (!key) return;
      _pendingUploadActivityId = key;
      _pendingUploadButton = btn;
      if (els.attachmentFileInput) {
        els.attachmentFileInput.value = '';
        els.attachmentFileInput.click();
      }
    });
  });
  el.querySelectorAll('[data-cl-action="view-files"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.clKey;
      if (key) openAttachmentViewer(key);
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
      const item = state.bookingChecklist.find((x) => x.id === id);
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
      state.bookingChecklist = [...(state.bookingChecklist || []), newItem];
      renderChecklistModal();
      renderTripHealthBadge();
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
            const item = state.bookingChecklist.find((x) => x.id === id);
            if (!item) return;
            item[valKey] = formattedAddress;
            item[placeKey] = placeId;
            item[latKey] = lat;
            item[lngKey] = lng;
            input.value = formattedAddress;
          },
          onInput: () => {
            const item = state.bookingChecklist.find((x) => x.id === id);
            if (!item) return;
            item[placeKey] = '';
            item[latKey] = null;
            item[lngKey] = null;
          },
          onInvalid: () => {
            const item = state.bookingChecklist.find((x) => x.id === id);
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
  const item = state.bookingChecklist.find((x) => x.id === id);
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
    item.activityEndTime = get('[data-cl="activityEndTime"]');
    if (!item.activityLocation) {
      item.activityLocationPlaceId = '';
      item.activityLocationLat = null;
      item.activityLocationLng = null;
    }
  }

  // Keep legacy fields in sync for trip health score
  item.dateTime = item.type === 'transportation' ? (item.departureDate ? item.departureDate + (item.departureTime ? 'T' + item.departureTime : '') : '')
    : item.type === 'accommodation' ? item.checkInDate
    : item.activityDate ? item.activityDate + (item.activityTime ? 'T' + item.activityTime : '') : '';
  item.city = item.type === 'transportation' ? item.startLocation
    : item.type === 'accommodation' ? item.accommodationCity
    : item.activityLocation;

  syncChecklistNotesToActivity(item);
  syncChecklistDateTimeToPlacement(item);
  syncChecklistBookingRequirementToActivity(item);

  renderBudgetTracker();
  scheduleChecklistAutosave();
}

let checklistAutosaveTimer = null;
function scheduleChecklistAutosave() {
  if (checklistAutosaveTimer) clearTimeout(checklistAutosaveTimer);
  checklistAutosaveTimer = setTimeout(() => {
    checklistAutosaveTimer = null;
    saveSnapshot();
  }, 600);
}

// ── renderTripHealth (badge + trip health panels) ─────────────────────────

function clearItineraryColumns() {
  els.dayColumns.innerHTML = '';
  els.stagingArea.innerHTML = '';
  if (els.itineraryGrid) els.itineraryGrid.innerHTML = '';
  if (els.itineraryInsights) els.itineraryInsights.innerHTML = '';
}

function renderTripHealthBadge() {
  const tripLoaded = Boolean(state.currentItineraryId || (state.activities && state.activities.length));
  if (els.tripHealthBadge) els.tripHealthBadge.classList.toggle('hidden', !tripLoaded);
  if (!tripLoaded) return false;
  state.tripHealth = computeTripHealthLocal();
  const statusClass = String(state.tripHealth.status || '').toLowerCase().replace(/\s+/g, '-');
  if (els.tripHealthBadge) {
    els.tripHealthBadge.className = `trip-health-badge ${statusClass}`;
    els.tripHealthBadge.innerHTML = `<i class="ph-bold ph-heartbeat" aria-hidden="true"></i><span class="sr-only">Trip Health: ${esc(state.tripHealth.status)} · ${state.tripHealth.issueCount} issues</span>`;
  }
  if (els.tripHealthPopoverStatus) els.tripHealthPopoverStatus.innerHTML = `<strong>${esc(state.tripHealth.status)}</strong>`;
  if (els.tripHealthPopoverIssues) els.tripHealthPopoverIssues.textContent = `${state.tripHealth.issueCount} issue${state.tripHealth.issueCount === 1 ? '' : 's'}`;
  if (els.tripHealthPopoverTopIssue) els.tripHealthPopoverTopIssue.textContent = state.tripHealth.topIssue;
  if (els.tripHealthPopoverProgress) els.tripHealthPopoverProgress.textContent = `${state.tripHealth.checklistProgress.verified} of ${state.tripHealth.checklistProgress.total} items verified`;
  return true;
}

function renderTripHealth() {
  if (!renderTripHealthBadge()) {
    if (els.tripHealthSummary) els.tripHealthSummary.innerHTML = '<p class="muted-text">Load or create a trip to open Trip Health.</p>';
    if (els.tripHealthIssues) els.tripHealthIssues.innerHTML = '';
    return;
  }

  if (els.tripHealthSummary) {
    const checklist = state.bookingChecklist || [];
    const verifiedCount = checklist.filter((item) => item.verified || item.status === 'resolved').length;
    const unresolvedBookings = checklist.length - verifiedCount;
    const totals = computeBudgetLensBreakdown();
    const totalBudget = Number(state.tripBudget) || 0;
    const delta = totalBudget > 0 ? totalBudget - totals.budgetLensTotal : null;
    els.tripHealthSummary.innerHTML = `
      <section class="trip-health-summary-card">
        <h3>Health summary</h3>
        <div class="trip-health-metrics">
          <p><strong>Status:</strong> ${esc(state.tripHealth.status)}</p>
          <p><strong>Open issues:</strong> ${state.tripHealth.issueCount}</p>
          <p><strong>Unresolved bookings:</strong> ${unresolvedBookings}</p>
          <p><strong>Verified items:</strong> ${verifiedCount}</p>
          <p><strong>Biggest issue:</strong> ${esc(state.tripHealth.topIssue)}</p>
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

  if (els.tripHealthIssues) {
    const unresolved = state.tripHealth.unresolvedIssues || [];
    els.tripHealthIssues.innerHTML = unresolved.length
      ? unresolved.map((issue) => {
          const meta = state.bookingChecklistIssueMeta[issue.message] || {};
          return `<article class="trip-health-issue-card" data-issue="${esc(issue.message)}">
            <p><strong>${esc(issue.message)}</strong></p>
            <div class="trip-health-issue-actions">
              <button type="button" class="secondary" data-issue-action="fix">Fix</button>
              <button type="button" class="secondary" data-issue-action="verify">Verify</button>
              <button type="button" class="secondary" data-issue-action="dismiss">Dismiss</button>
            </div>
            <textarea rows="2" data-issue-note placeholder="Add note">${esc(meta.note || '')}</textarea>
          </article>`;
        }).join('')
      : '<p class="muted-text">No unresolved issues.</p>';

    els.tripHealthIssues.querySelectorAll('[data-issue]').forEach((node) => {
      const key = node.getAttribute('data-issue');
      const setMeta = (patch = {}) => {
        state.bookingChecklistIssueMeta[key] = { ...(state.bookingChecklistIssueMeta[key] || {}), ...patch };
        renderTripHealth();
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
        state.bookingChecklistIssueMeta[key] = { ...(state.bookingChecklistIssueMeta[key] || {}), note: e.target.value };
      });
    });
  }
}

function setPlanningLoading(isLoading, cityCount = 1) {
  state.isPlanning = isLoading;
  els.planBtn.disabled = isLoading;
  els.planBtn.innerHTML = isLoading ? 'Planning…' : 'Next <i class="ph-bold ph-arrow-right" aria-hidden="true"></i>';

  if (!isLoading) {
    hideLoader();
    return;
  }

  const tripName = (els.tripName.value || state.tripName || 'your trip').trim();
  showLoader({
    title: `Planning your trip to ${tripName}`,
    status: 'Starting planning...',
    totalUnits: cityCount * PLAN_PHASES_PER_CITY
  });
}

async function goToNextStep(fromStep = state.step) {
  if (fromStep === 1) {
    if (state.isPlanning) return;

    if (!canLeaveSetup()) return;

    const hasExistingActivities = Array.isArray(state.activities) && state.activities.length > 0;
    const hasReviewedState = state.reviewed && typeof state.reviewed === 'object';
    const changedCities = citiesChangedSincePlan();

    if (hasExistingActivities && hasReviewedState && !changedCities.length) {
      syncTripMetaFromInputs();
      setStep(2);
      return;
    }

    let citiesToRegenerate = null;
    let lockedByCity = {};
    if (hasExistingActivities && changedCities.length) {
      const result = await showRegenerateConfirmDialog(changedCities);
      if (!result) {
        syncTripMetaFromInputs();
        setStep(2);
        return;
      }
      citiesToRegenerate = result.cities;
      lockedByCity = result.lockedByCity;
    }

    // Resolve any city whose coords haven't landed yet (e.g. Continue clicked
    // before the name-field blur's async geocode finished) so validation can't
    // race ahead of an in-flight resolve.
    const pending = state.cities.filter(
      (c) => String(c.name || '').trim() && !(Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
    );
    if (pending.length) {
      await Promise.all(pending.map(resolveCityCoords));
      renderCities();
    }

    if (!validateLocationsBeforePlanning()) {
      showErrorBanner('Please validate all locations before planning your trip.');
      return;
    }
    clearSnapshot();
    if (!citiesToRegenerate) clearPlannedResultsKeepSetup();
    setPlanningLoading(true, (citiesToRegenerate || state.cities).length);
    try { await planTrip(citiesToRegenerate, lockedByCity); }
    catch (e) { showErrorBanner(e?.message || 'Failed to plan trip.'); }
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
    maybeAutoArrangeCities();
    return;
  }

  if (fromStep === 3) {
    try {
      await generateItinerary();
    } catch (e) {
      showErrorBanner(e?.message || 'Failed to generate itinerary.');
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


// extractTimeFromDateTime, parseTimeTo24, minutesFromTime, timeFromMinutes
// are loaded from /shared/timeHelpers.js via planner.html

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

function tripDaysInclusive(startDate, endDate) {
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
  const totalDays = sorted.reduce((sum, c) => sum + tripDaysInclusive(c.startDate, c.endDate), 0);
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
}

function splitCityName(full) {
  const s = String(full || '').trim();
  if (!s) return { primary: '', country: '' };
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) return { primary: parts[0], country: '' };
  return { primary: parts[0], country: parts[parts.length - 1] };
}

function computeNightsBetween(startYmd, endYmd) {
  if (!startYmd || !endYmd) return 0;
  const start = parseYmdAsLocal(startYmd);
  const end = parseYmdAsLocal(endYmd);
  if (!start || !end) return 0;
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 86400000);
}

function shortenAddr(addr) {
  const s = String(addr || '').trim();
  if (!s) return '';
  const first = s.split(',')[0].trim();
  return first.length > 30 ? first.slice(0, 28) + '…' : first;
}

// Resolve a city's coordinates from its typed name via Google Places. Mutates
// the city in place and returns true if it now has valid coords. Shared by the
// name-field blur handler and the pre-planning validation gate so a fast click
// on Continue can't race ahead of an in-flight resolve.
async function resolveCityCoords(city) {
  const query = String(city?.name || '').trim();
  if (!query) return false;
  if (Number.isFinite(city.latitude) && Number.isFinite(city.longitude)) return true;
  try {
    const res = await fetch(`/api/places/resolve?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    if (!res.ok) {
      sendDebug('city-blur', `id=${city.id} typed="${query}" geocode_http=${res.status}`);
      return false;
    }
    const place = await res.json();
    if (!place?.placeId || !Number.isFinite(place?.lat) || !Number.isFinite(place?.lng)) {
      sendDebug('city-blur', `id=${city.id} typed="${query}" geocode=no_match raw=${JSON.stringify(place).slice(0, 200)}`);
      return false;
    }
    city.placeId = place.placeId;
    city.latitude = place.lat;
    city.longitude = place.lng;
    const formatted = String(place.formattedAddress || '').trim();
    if (formatted) city.name = formatted;
    sendDebug('city-blur', `id=${city.id} name="${city.name}" placeId=${city.placeId} lat=${city.latitude} lng=${city.longitude}`);
    return true;
  } catch (err) {
    sendDebug('city-blur', `id=${city.id} typed="${query}" error=${err?.message || err}`);
    return false;
  }
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

    const row = document.createElement('article');
    row.className = `city-row gm-city ${city.detailsExpanded ? '' : 'collapsed'}`;
    row.dataset.cityId = city.id;

    const { primary: cityPrimary, country: cityCountry } = splitCityName(city.name || '');
    const nightsCount = computeNightsBetween(city.logistics.arrival.date, city.logistics.departure.date);
    const subParts = [];
    const stayAddr = city.accommodation?.address || '';
    if (stayAddr) subParts.push(`Stay <b>${esc(shortenAddr(stayAddr))}</b>`);
    const arr = city.logistics.arrival;
    if (arr.time) subParts.push(`Arrive <b>${esc(arr.time)} ${esc(arr.mode || '')}</b>`);
    const subLine = subParts.join(' · ');

    const activeTab = city.activeTab || 'stay';
    const hasStay = !!(stayAddr || city.logistics.accommodation.checkIn);
    const hasArrival = !!(arr.location || arr.time);
    const hasDeparture = !!(city.logistics.departure.location || city.logistics.departure.time);
    const hasNotes = !!(city.notes && city.notes.trim());

    row.innerHTML = `
      <div class="city-row-main gm-city__head" data-toggle-details>
        <span class="gm-city__num">${String(index + 1).padStart(2, '0')}</span>
        <div class="gm-city__main">
          <span class="gm-city__name">
            <span class="gm-city__name-text">${esc(cityPrimary) || '<span class="gm-city__sub-empty">Untitled city</span>'}</span>
            ${cityCountry ? `<span class="gm-city__country">${esc(cityCountry)}</span>` : ''}
          </span>
          <span class="gm-city__sub">${subLine || '<span class="gm-city__sub-empty">Add stay &amp; arrival details</span>'}</span>
        </div>
        <div class="gm-city__dates" data-stop>
          <input type="date" class="gm-city__date" value="${esc(city.logistics.arrival.date)}" data-field="dateFrom" aria-label="Start date" title="Start date" />
          <span class="arrow">→</span>
          <input type="date" class="gm-city__date" value="${esc(city.logistics.departure.date)}" data-field="dateTo" aria-label="End date" title="End date" />
          ${nightsCount ? `<span class="nights">${nightsCount} ${nightsCount === 1 ? 'night' : 'nights'}</span>` : ''}
        </div>
        <button class="gm-city__chev" type="button" data-toggle-details aria-label="${city.detailsExpanded ? 'Collapse' : 'Expand'}" data-stop>
          <i class="ph-bold ph-caret-right" aria-hidden="true"></i>
        </button>
        <button class="gm-city__del" type="button" data-remove-city aria-label="Remove city" data-stop><i class="ph-bold ph-trash" aria-hidden="true"></i></button>
      </div>

      ${city.detailsExpanded ? `
        <div class="gm-city__body">
          <nav class="gm-city__tabs" role="tablist">
            <span class="gm-city__tab ${activeTab === 'stay' ? 'active' : ''} ${hasStay ? 'has-data' : ''}" data-tab="stay" role="tab" tabindex="0"><span class="dot"></span> Stay</span>
            <span class="gm-city__tab ${activeTab === 'arrival' ? 'active' : ''} ${hasArrival ? 'has-data' : ''}" data-tab="arrival" role="tab" tabindex="0"><span class="dot"></span> Arrival</span>
            <span class="gm-city__tab ${activeTab === 'departure' ? 'active' : ''} ${hasDeparture ? 'has-data' : ''}" data-tab="departure" role="tab" tabindex="0"><span class="dot"></span> Departure</span>
            <span class="gm-city__tab ${activeTab === 'notes' ? 'active' : ''} ${hasNotes ? 'has-data' : ''}" data-tab="notes" role="tab" tabindex="0"><span class="dot"></span> Notes</span>
          </nav>

          <div class="gm-pane ${activeTab === 'stay' ? 'active' : ''}" data-pane="stay">
            <div class="gm-grid c-loc-time" style="margin-bottom:14px;">
              <div class="gm-f">
                <label>City <span class="opt">required</span></label>
                <span class="city-autocomplete">
                  <input class="gm-inp with-icon" type="text" placeholder="City" value="${esc(city.name)}" data-field="name" autocomplete="off" />
                </span>
              </div>
              <div class="gm-f">
                <label>Nights</label>
                <input class="gm-inp" value="${nightsCount ? `${nightsCount} ${nightsCount === 1 ? 'night' : 'nights'}` : '—'}" readonly aria-readonly="true" />
              </div>
            </div>
            <div class="gm-grid c2">
              <div class="gm-f">
                <label>Check-in</label>
                <input class="gm-inp" type="date" value="${esc(city.logistics.accommodation.checkIn)}" data-logistics="accommodationCheckIn" aria-label="Check-in date" />
              </div>
              <div class="gm-f">
                <label>Check-out</label>
                <input class="gm-inp" type="date" value="${esc(city.logistics.accommodation.checkOut)}" data-logistics="accommodationCheckOut" aria-label="Check-out date" />
              </div>
            </div>
            <div class="gm-f" style="margin-top:14px;">
              <label>Accommodation address <span class="opt">optional</span></label>
              <span class="city-autocomplete">
                <input class="gm-inp with-pin" type="text" placeholder="Hotel, address, or neighborhood" value="${esc(city.accommodation?.address || '')}" data-accommodation-field="address" autocomplete="off" aria-label="Accommodation address" />
              </span>
            </div>
          </div>

          <div class="gm-pane ${activeTab === 'arrival' ? 'active' : ''}" data-pane="arrival">
            <div class="gm-grid c-loc-time">
              <div class="gm-f">
                <label>Arriving at <span class="opt">station, airport, or address</span></label>
                <span class="city-autocomplete">
                  <input class="gm-inp with-pin" type="text" placeholder="Station, airport, or address" value="${esc(city.logistics.arrival.location)}" data-logistics="arrivalLocation" autocomplete="off" aria-label="Arrival location" />
                </span>
              </div>
              <div class="gm-f">
                <label>Time</label>
                <input class="gm-inp" type="time" value="${esc(city.logistics.arrival.time || '')}" data-logistics="arrivalTime" aria-label="Arrival time" />
              </div>
            </div>
            <div class="gm-grid c-mode-intl" style="margin-top:14px;">
              <div class="gm-f">
                <label>Mode</label>
                <select class="gm-inp" data-logistics="arrivalMode" aria-label="Arrival transport">
                  <option value="flight" ${arr.mode === 'flight' ? 'selected' : ''}>Flight</option>
                  <option value="train" ${arr.mode === 'train' ? 'selected' : ''}>Train</option>
                  <option value="car" ${arr.mode === 'car' ? 'selected' : ''}>Car</option>
                  <option value="other" ${arr.mode === 'other' ? 'selected' : ''}>Other</option>
                </select>
              </div>
              <div class="gm-f">
                <label>&nbsp;</label>
                <label class="gm-check-inline intl-toggle" data-mode-dep="arrivalMode" ${arr.mode !== 'flight' ? 'hidden' : ''}>
                  <input type="checkbox" data-logistics="arrivalInternational" ${arr.international ? 'checked' : ''}>
                  International
                </label>
              </div>
            </div>
          </div>

          <div class="gm-pane ${activeTab === 'departure' ? 'active' : ''}" data-pane="departure">
            <div class="gm-grid c-loc-time">
              <div class="gm-f">
                <label>Departing from</label>
                <span class="city-autocomplete">
                  <input class="gm-inp with-pin" type="text" placeholder="Station, airport, or address" value="${esc(city.logistics.departure.location)}" data-logistics="departureLocation" autocomplete="off" aria-label="Departure location" />
                </span>
              </div>
              <div class="gm-f">
                <label>Time</label>
                <input class="gm-inp" type="time" value="${esc(city.logistics.departure.time || '')}" data-logistics="departureTime" aria-label="Departure time" />
              </div>
            </div>
            <div class="gm-grid c-mode-intl" style="margin-top:14px;">
              <div class="gm-f">
                <label>Mode</label>
                <select class="gm-inp" data-logistics="departureMode" aria-label="Departure transport">
                  <option value="flight" ${city.logistics.departure.mode === 'flight' ? 'selected' : ''}>Flight</option>
                  <option value="train" ${city.logistics.departure.mode === 'train' ? 'selected' : ''}>Train</option>
                  <option value="car" ${city.logistics.departure.mode === 'car' ? 'selected' : ''}>Car</option>
                  <option value="other" ${city.logistics.departure.mode === 'other' ? 'selected' : ''}>Other</option>
                </select>
              </div>
              <div class="gm-f">
                <label>&nbsp;</label>
                <label class="gm-check-inline intl-toggle" data-mode-dep="departureMode" ${city.logistics.departure.mode !== 'flight' ? 'hidden' : ''}>
                  <input type="checkbox" data-logistics="departureInternational" ${city.logistics.departure.international ? 'checked' : ''}>
                  International
                </label>
              </div>
            </div>
          </div>

          <div class="gm-pane ${activeTab === 'notes' ? 'active' : ''}" data-pane="notes">
            <div class="gm-f">
              <label>Notes for this city <span class="opt">bookings, must-sees, anything</span></label>
              <div class="textarea-expand-wrap">
                <textarea id="cityNotes-${city.id}" rows="4" class="gm-ta city-notes-textarea" placeholder="e.g. tour booked Mar 25 3–5pm, want to see X…" data-field="notes">${esc(city.notes || '')}</textarea>
                <button class="textarea-expand-btn city-notes-expand-btn" type="button" data-expand="cityNotes-${city.id}" data-title="Notes — ${esc(city.name || 'City')}" aria-label="Expand notes"><i class="ph-bold ph-arrows-out-simple"></i></button>
              </div>
            </div>
          </div>

          <p class="city-dropdown-error ${timelineError ? '' : 'hidden'}" role="alert">${esc(timelineError || '')}</p>
        </div>
      ` : ''}
    `;

    row.querySelectorAll('[data-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        city.activeTab = tab.dataset.tab;
        renderCities();
      });
    });

    row.querySelectorAll('[data-field]').forEach((input) => {
      const eventType = (input.type === 'date' || input.type === 'time') ? 'change' : 'input';
      input.addEventListener(eventType, () => {
        const field = input.dataset.field;

        if (field === 'name') {
          city.name = input.value;
          city.placeId = '';
          city.latitude = null;
          city.longitude = null;
          const headerText = row.querySelector('.gm-city__name-text');
          if (headerText) {
            const trimmed = input.value.trim();
            headerText.innerHTML = trimmed ? esc(trimmed) : '<span class="gm-city__sub-empty">Untitled city</span>';
          }
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

    const head = row.querySelector('.gm-city__head');
    head?.addEventListener('click', (e) => {
      const stopEl = e.target.closest('[data-stop]');
      if (stopEl && head.contains(stopEl) && stopEl !== head) return;
      const explicitToggle = e.target.closest('[data-toggle-details]');
      if (explicitToggle && explicitToggle !== head && !head.contains(explicitToggle)) return;
      city.detailsExpanded = !city.detailsExpanded;
      renderCities();
    });
    row.querySelector('.gm-city__chev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      city.detailsExpanded = !city.detailsExpanded;
      renderCities();
    });

    const cityNameInput = row.querySelector('[data-field="name"]');
    if (cityNameInput) {
      cityNameInput.addEventListener('blur', async () => {
        const query = cityNameInput.value.trim();
        if (!query) {
          sendDebug('city-blur', `id=${city.id} typed="" (no geocode)`);
          return;
        }
        const before = city.name;
        const ok = await resolveCityCoords(city);
        if (ok && city.name !== before) {
          cityNameInput.value = city.name;
          renderCities();
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
        onInput: () => { city.accommodation.address = accommodationInput.value; city.accommodation.placeId = ''; city.accommodation.latitude = null; city.accommodation.longitude = null; },
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
      const eventType = (input.type === 'date' || input.type === 'time' || input.type === 'checkbox' || input.tagName === 'SELECT') ? 'change' : 'input';
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
        if (field === 'arrivalMode') {
          city.logistics.arrival.mode = input.value;
          const label = row.querySelector('[data-mode-dep="arrivalMode"]');
          if (label) label.hidden = input.value !== 'flight';
        }
        if (field === 'arrivalInternational') {
          city.logistics.arrival.international = input.checked;
        }
        if (field === 'departureMode') {
          city.logistics.departure.mode = input.value;
          const label = row.querySelector('[data-mode-dep="departureMode"]');
          if (label) label.hidden = input.value !== 'flight';
        }
        if (field === 'departureInternational') {
          city.logistics.departure.international = input.checked;
        }

        syncCityLegacyDates(city);
        syncTravelDateTimes();
        refreshCityTimelineUI(row, city);
        renderSetupInsights();
      });
    });

    els.citiesContainer.appendChild(row);
  });

  const countEl = document.getElementById('citiesCount');
  if (countEl) {
    const n = state.cities.length;
    countEl.textContent = `${n} ${n === 1 ? 'leg' : 'legs'}`;
  }

  renderSetupInsights();
  initializePlacesWidgets();
}

function typeToTime(type) {
  const map = {
    tour: '10:00am',
    neighborhood: '11:30am',
    museum: '2:30pm',
    sports: '4:00pm',
    landmark: '11:00am',
    shopping: '3:00pm',
    meal: '1:00pm'
  };
  return map[type] || 'TBD';
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


const LEARNED_CATEGORIES = [
  { id: 'dining', label: 'Dining & Food', re: /\b(dining|food|restaurant|meal|lunch|dinner|breakfast|brunch|snack|cuisine|eat|ramen|sushi|tapas|seafood|fish|shellfish|meat|beef|pork|chicken|vegetarian|vegan|pescatarian|dish|flavou?r|coffee|cafe|bar|drink|allerg(y|ic|ies|en)|intoleran|gluten|dairy|lactose|nut|peanut|spicy|halal|kosher|diet(ary)?)\b/i },
  { id: 'lodging', label: 'Lodging & Location', re: /\b(accommodat|hotel|stay|lodging|walkable|walking distance|base|neighbou?rhood|central|transit|taxi|commute|near)\b/i },
  { id: 'pace', label: 'Pace & Timing', re: /\b(pace|slow|fast|relax|packed|early|late|morning|evening|night|rest|break|busy|leisure)\b/i },
  { id: 'interests', label: 'Activities & Interests', re: /\b(museum|art|history|nature|hike|hiking|outdoor|shopping|nightlife|culture|tour|beach|adventure|music|architecture|local)\b/i },
  { id: 'budget', label: 'Budget', re: /\b(budget|cheap|expensive|cost|price|afford|splurge|value|luxury)\b/i }
];
const LEARNED_OTHER = { id: 'other', label: 'Other' };

function categorizeLearned(text) {
  for (const c of LEARNED_CATEGORIES) if (c.re.test(text)) return c;
  return LEARNED_OTHER;
}

function renderLearnedPrefs() {
  if (!els.learnedPrefsSection || !els.learnedPrefsTags) return;
  const lp = state.learnedPrefs;
  const all = [
    ...(lp?.constraints || []).map((c) => ({ text: c.text, kind: 'constraint' })),
    ...(lp?.preferences || []).map((p) => ({ text: p.text, kind: 'preference' }))
  ];
  if (!all.length) {
    els.learnedPrefsSection.classList.add('hidden');
    return;
  }
  els.learnedPrefsSection.classList.remove('hidden');

  const filter = (state.learnedFilter || '').trim().toLowerCase();
  const collapsed = state.learnedCollapsed || (state.learnedCollapsed = new Set());

  const groups = new Map();
  for (const item of all) {
    if (filter && !item.text.toLowerCase().includes(filter)) continue;
    const cat = categorizeLearned(item.text);
    if (!groups.has(cat.id)) groups.set(cat.id, { cat, items: [] });
    groups.get(cat.id).items.push(item);
  }

  const order = [...LEARNED_CATEGORIES, LEARNED_OTHER];
  const pill = (item) =>
    `<span class="learned-pref-tag" data-kind="${item.kind}" data-text="${esc(item.text)}">` +
    `<span class="learned-pref-text">${esc(item.text)}</span>` +
    `<button class="learned-pref-edit" aria-label="Edit"><i class="ph-bold ph-pencil-simple"></i></button>` +
    `<button class="learned-pref-remove" aria-label="Remove"><i class="ph-bold ph-x"></i></button>` +
    `</span>`;

  const sections = order
    .map((cat) => groups.get(cat.id))
    .filter(Boolean)
    .map(({ cat, items }) => {
      const isCollapsed = collapsed.has(cat.id);
      return `<div class="learned-group${isCollapsed ? ' collapsed' : ''}" data-cat="${cat.id}">` +
        `<button class="learned-group-header" type="button">` +
        `<span class="learned-group-caret"><i class="ph-bold ph-caret-down"></i></span>` +
        `<span>${esc(cat.label)}</span><span class="learned-group-count">(${items.length})</span>` +
        `</button>` +
        `<div class="learned-group-body">${items.map(pill).join('')}</div>` +
        `</div>`;
    })
    .join('');

  const searchHtml =
    `<input type="text" class="learned-search" placeholder="Search learned items…" aria-label="Search learned items" value="${esc(state.learnedFilter || '')}">`;
  const body = sections || '<p class="learned-empty">No matches.</p>';
  els.learnedPrefsTags.innerHTML = searchHtml + body;

  const search = els.learnedPrefsTags.querySelector('.learned-search');
  if (search && state.learnedFilter) {
    search.focus();
    const len = search.value.length;
    search.setSelectionRange(len, len);
  }
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
      const cls = v === active ? 'active' : (v < active ? 'done' : '');
      return `<span class="dot-scale-dot${cls ? ' ' + cls : ''}" data-value="${v}" aria-label="${v}" role="button" tabindex="0"></span>`;
    }).join('');
    const label = key === 'pace' ? pacePrefLabel(active) : profileLabel(active);
    const isDefault = active === PROFILE_DEFAULT;
    return `
      <div class="dot-scale-wrap">
        <span class="dot-scale-label${isDefault ? ' is-default' : ''}">${esc(label)}</span>
        <div class="dot-scale" data-rating>${dots}</div>
      </div>
    `;
  };

  const scaleHtml = PROFILE_QUESTIONS.filter((q) => q.type !== 'text').map((q) => {
    const active = Math.max(PROFILE_MIN, Math.min(PROFILE_MAX, Number(profile.answers[q.key] || PROFILE_DEFAULT)));
    return `
      <div class="profile-question" data-question="${esc(q.key)}">
        <p>${esc(q.label)}</p>
        ${dotsHtml(active, q.key)}
      </div>
    `;
  }).join('');

  const textHtml = PROFILE_QUESTIONS.filter((q) => q.type === 'text').map((q) => {
    const val = profile.answers[q.key] || '';
    const inputId = `profileQ_${q.key}`;
    return `
      <div class="profile-question profile-question--text" data-question="${esc(q.key)}">
        <p>${esc(q.label)}</p>
        <div class="textarea-expand-wrap">
          <textarea id="${inputId}" class="profile-text-answer profile-textarea-fixed" rows="4" placeholder="${esc(q.placeholder || '')}">${esc(val)}</textarea>
          <button class="textarea-expand-btn" type="button" data-expand="${inputId}" data-title="${esc(q.label)}" aria-label="Expand ${esc(q.label)}"><i class="ph-bold ph-arrows-out-simple"></i></button>
        </div>
      </div>
    `;
  }).join('');

  const scaleHost = document.getElementById('pfScaleQs');
  const textHost = document.getElementById('pfTextQs');
  if (scaleHost) scaleHost.innerHTML = scaleHtml;
  if (textHost) textHost.innerHTML = textHtml;

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

  renderLearnedPrefs();

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

      scaleEl.querySelectorAll('.dot-scale-dot').forEach((d) => {
        const v = Number(d.dataset.value);
        d.classList.toggle('active', v === nextAnswer);
        d.classList.toggle('done', v < nextAnswer);
      });
      const labelEl = scaleEl.parentElement?.querySelector('.dot-scale-label');
      if (labelEl) {
        labelEl.textContent = key === 'pace' ? pacePrefLabel(nextAnswer) : profileLabel(nextAnswer);
        labelEl.classList.toggle('is-default', nextAnswer === PROFILE_DEFAULT);
      }
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

  const SCALE_ENDS = {
    museumPerson:     ['NOT FOR ME', 'LOVE THEM'],
    foodTravel:       ['CASUAL EATS', 'FINE DINING'],
    livePerformances: ['SKIP IT',    'FRONT ROW'],
    outdoorNature:    ['INDOORS',    'ALL DAY OUT'],
    nightlifeBars:    ['EARLY NIGHT','LATE NIGHT'],
    structuredTours:  ['DIY',        'GUIDED'],
    shoppingPerson:   ['NOT MY THING','BIG HAUL'],
    pace:             ['RELAXED',    'NON-STOP']
  };
  const WHY_WE_ASK = {
    museumPerson: 'Tells us how many cultural stops to weave in.',
    foodTravel: 'Decides how many meal slots we flag for booking and how special they are.',
    livePerformances: 'Helps us scout shows, concerts, and ticketed performances.',
    outdoorNature: 'Calibrates how often we route through parks, trails, and the outdoors.',
    nightlifeBars: 'Shapes evening plans — bars, late-night spots, or quiet wind-downs.',
    structuredTours: 'Determines how much we lean on guided experiences vs. self-led exploration.',
    shoppingPerson: 'Decides whether we carve out time for shopping districts and markets.',
    pace: 'Sets how many activities we plan per day.',
    dietaryRestrictions: 'Lets us filter restaurants and meal suggestions.',
    mobilityConsiderations: 'So we keep walking, stairs, and transit within your limits.',
    budgetStyle: 'Calibrates how aggressively we suggest splurges or saves.',
    travelCompanions: 'Helps the planner match the vibe of who you’re with.',
    shoppingInterests: 'Lets us flag the right shops, markets, and neighborhoods.',
    name: 'Names this profile so you can tell yours apart if you make more later.',
    aboutMe: 'Free-form context the planner uses to tailor recommendations.'
  };

  function pad2(n) { return String(n).padStart(2, '0'); }

  function pipLadderHtml(activeIndex) {
    return Array.from({ length: totalSteps }, (_, i) => {
      const cls = i === activeIndex ? 'current' : (i < activeIndex ? 'done' : '');
      return `<span class="wizard-pip${cls ? ' ' + cls : ''}"></span>`;
    }).join('');
  }

  function render() {
    const { stepIndex } = wizardState;
    const pct = Math.max(6, Math.round(((stepIndex + 1) / totalSteps) * 100));

    overlay.querySelector('.profile-wizard-progress-bar').style.width = `${pct}%`;

    const ladder = overlay.querySelector('#wizardPipLadder');
    if (ladder) ladder.innerHTML = pipLadderHtml(stepIndex);

    const isAboutMe = stepIndex === aboutMeStepIndex;
    const isName = stepIndex === 0;
    const q = (!isName && !isAboutMe) ? PROFILE_QUESTIONS[stepIndex - 1] : null;

    const eyebrowKey = isName ? 'PROFILE'
      : isAboutMe ? 'ABOUT YOU'
      : (q.summary || q.key).toUpperCase();
    overlay.querySelector('.wizard-step-counter').innerHTML =
      `<strong>STEP ${pad2(stepIndex + 1)}</strong> / ${pad2(totalSteps)}`;

    const backBtn = overlay.querySelector('#wizardBackBtn');
    const nextBtn = overlay.querySelector('#wizardNextBtn');
    backBtn.classList.toggle('hidden', stepIndex === 0);
    nextBtn.innerHTML = isAboutMe
      ? `Finish <i class="ph-bold ph-check"></i>`
      : `Next <i class="ph-bold ph-arrow-right"></i>`;

    const hintEl = overlay.querySelector('.profile-wizard-nav .wizard-hint');
    if (hintEl) hintEl.innerHTML = `<kbd>↵</kbd> to ${isAboutMe ? 'finish' : 'continue'}`;

    let titleHtml, subHtml = '', contentHtml;
    if (isName) {
      titleHtml = `What should we call this <span class="serif">profile</span>?`;
      subHtml = `<p class="wizard-sub">Just a label — you can rename it later.</p>`;
      contentHtml = `
        <input class="wizard-input wizard-text-input wizard-name-input" type="text" maxlength="32"
          value="${esc(wizardState.name)}" placeholder="${esc(suggestedName)}" autocomplete="off" />
        <div class="wizard-sub" style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-400);">
          <span><span id="wizardNameCount">${wizardState.name.length}</span> / 32</span>
          <span>Press Tab to advance</span>
        </div>
      `;
    } else if (isAboutMe) {
      titleHtml = `Anything else we might have <span class="serif">missed?</span>`;
      subHtml = `<p class="wizard-sub">Free-form context — quirks, constraints, anything that sharpens the plan.</p>`;
      contentHtml = `
        <textarea class="wizard-input wizard-text-input wizard-textarea" rows="5"
          placeholder="e.g. I'm not a morning person, I have a smaller budget, avoid things with lots of walking...">${esc(wizardState.aboutMe)}</textarea>
      `;
    } else if (q.type === 'text') {
      titleHtml = esc(q.label);
      contentHtml = `
        <textarea class="wizard-input wizard-text-input wizard-textarea" rows="4"
          placeholder="${esc(q.placeholder || '')}">${esc(wizardState.answers[q.key] || '')}</textarea>
      `;
    } else {
      const active = Number(wizardState.answers[q.key]) || PROFILE_DEFAULT;
      const dots = Array.from({ length: 5 }, (_, i) => {
        const v = i + 1;
        const cls = v === active ? 'active' : (v < active ? 'done' : '');
        return `<span class="dot-scale-dot${cls ? ' ' + cls : ''}" data-value="${v}" role="button" tabindex="0" aria-label="${v}"></span>`;
      }).join('');
      const labelText = q.key === 'pace' ? pacePrefLabel(active) : profileLabel(active);
      const ends = SCALE_ENDS[q.key] || ['LESS', 'MORE'];
      const fillPct = ((active - 1) / 4) * 100;
      titleHtml = esc(q.label);
      contentHtml = `
        <div class="wizard-dot-scale-wrap">
          <div class="wizard-scale-head">
            <span class="wizard-scale-value">${esc(labelText)}</span>
            <span class="wizard-scale-index"><span class="js-scale-idx">${active}</span> of 5</span>
          </div>
          <div class="dot-scale wizard-dot-scale" data-rating style="--wiz-fill:${fillPct}%">${dots}</div>
          <div class="wizard-scale-ends">
            <span>${esc(ends[0])}</span>
            <span>${esc(ends[1])}</span>
          </div>
        </div>
      `;
    }

    const whyKey = isName ? 'name' : (isAboutMe ? 'aboutMe' : q.key);
    const whyText = WHY_WE_ASK[whyKey];

    overlay.querySelector('#wizardCardBody').innerHTML = `
      <div class="wizard-body-eyebrow"><span class="key">STEP ${pad2(stepIndex + 1)}</span> ${esc(eyebrowKey)}</div>
      <h2 class="wizard-question-label">${titleHtml}</h2>
      ${subHtml}
      ${contentHtml}
      ${whyText ? `<div class="wizard-aside"><span class="key">Why we ask</span><span>${esc(whyText)}</span></div>` : ''}
    `;

    if (q && !q.type) {
      const rail = overlay.querySelector('[data-rating]');
      rail.addEventListener('click', (e) => {
        const dot = e.target.closest('.dot-scale-dot');
        if (!dot) return;
        const v = Number(dot.dataset.value);
        wizardState.answers[q.key] = v;
        rail.querySelectorAll('.dot-scale-dot').forEach((d) => {
          const dv = Number(d.dataset.value);
          d.classList.toggle('active', dv === v);
          d.classList.toggle('done', dv < v);
        });
        rail.style.setProperty('--wiz-fill', `${((v - 1) / 4) * 100}%`);
        const valEl = overlay.querySelector('.wizard-scale-value');
        if (valEl) valEl.textContent = q.key === 'pace' ? pacePrefLabel(v) : profileLabel(v);
        const idxEl = overlay.querySelector('.js-scale-idx');
        if (idxEl) idxEl.textContent = String(v);
      });
    }

    if (isName) {
      const inp = overlay.querySelector('.wizard-name-input');
      const counter = overlay.querySelector('#wizardNameCount');
      if (inp && counter) inp.addEventListener('input', () => { counter.textContent = inp.value.length; });
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
    apiFetch('/api/profile/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizeProfile(profile))
    }).then((r) => r.json()).then((data) => {
      const instruction = String(data?.instruction ?? data?.profileInstruction ?? '').trim();
      if (instruction) {
        state.learnedPrefs = { ...(state.learnedPrefs || {}), profileInstruction: instruction };
        renderPreferencesModal();
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
  overlayManager.open('prefsModal');
}

function closePreferencesModal() {
  renderPreferencesModal();
  overlayManager.close('prefsModal');
}

function openChecklistModal() {
  buildChecklistFromState();
  overlayManager.open('checklistModal');
  renderChecklistModal();
}

function closeChecklistModal() {
  if (checklistSearchRenderTimer) {
    clearTimeout(checklistSearchRenderTimer);
    checklistSearchRenderTimer = null;
  }
  if (checklistAutosaveTimer) {
    clearTimeout(checklistAutosaveTimer);
    checklistAutosaveTimer = null;
    saveSnapshot();
  }
  overlayManager.close('checklistModal');
}

async function fetchStatus() {
  const res = await apiFetch('/api/status');
  const data = await res.json();
  state.keys = data.keys || state.keys;
  let googleMapsApiKey = '';
  if (data?.keys?.googleMapsConfigured) {
    try {
      const keyRes = await apiFetch('/api/config/maps-key');
      const keyData = await keyRes.json();
      googleMapsApiKey = String(keyData?.googleMapsApiKey || '').trim();
    } catch {}
  }
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
      showErrorBanner(err?.message || 'Google Places failed to load.');
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
    meal:         { icon: ph('ph-fork-knife'),          colorClass: 'activity-food' },
    tour:         { icon: ph('ph-compass'),             colorClass: 'activity-tour' },
    museum:       { icon: ph('ph-columns'),             colorClass: 'activity-cultural' },
    landmark:     { icon: ph('ph-buildings'),           colorClass: 'activity-tour' },
    neighborhood: { icon: ph('ph-map-trifold'),         colorClass: 'activity-neighborhood' },
    sports:       { icon: ph('ph-soccer-ball'),         colorClass: 'activity-sports' },
    shopping:     { icon: ph('ph-bag'),                 colorClass: 'activity-default' },
    park:         { icon: ph('ph-tree'),                colorClass: 'activity-walk' },
    market:       { icon: ph('ph-storefront'),          colorClass: 'activity-default' },
    nightlife:    { icon: ph('ph-martini'),             colorClass: 'activity-show' },
    spa:          { icon: ph('ph-sparkle'),             colorClass: 'activity-default' },
  };
  return map[normalized] || { icon: ph('ph-map-pin'), colorClass: 'activity-default' };
}


function updateReviewNav() {
  if (!els.continueArrangeBtn) return;
  const canContinue = state.activities.some((a) => state.reviewed[a.id]?.approved);
  els.continueArrangeBtn.disabled = !canContinue;
  els.continueArrangeBtn.title = canContinue ? '' : 'Approve at least one activity to continue';
}

function populateReviewCityFilter() {
  if (!els.reviewCityFilter) return;
  const current = state.reviewFilters.city;
  const present = new Set(state.activities.map((a) => String(a.city || '').trim()).filter(Boolean));
  const ordered = (state.cities || []).map((c) => String(c.name || '').trim()).filter((n) => n && present.has(n));
  const extras = [...present].filter((n) => !ordered.includes(n)).sort();
  const cities = [...ordered, ...extras];
  els.reviewCityFilter.innerHTML = ['<option value="">All cities</option>', ...cities.map((city) => `<option value="${esc(city)}">${esc(city)}</option>`)].join('');
  els.reviewCityFilter.value = current;
}

const REVIEW_TYPE_FILTER_EXCLUDE = new Set(['arrival', 'departure']);

function populateReviewTypeFilter() {
  if (!els.reviewTypeFilter) return;
  const current = state.reviewFilters.type;
  const present = [...new Set(
    state.activities
      .map((a) => String(a.type || '').trim().toLowerCase())
      .filter((t) => t && !REVIEW_TYPE_FILTER_EXCLUDE.has(t))
  )].sort();
  const label = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  els.reviewTypeFilter.innerHTML = ['<option value="">All types</option>', ...present.map((t) => `<option value="${esc(t)}">${esc(label(t))}</option>`)].join('');
  els.reviewTypeFilter.value = current;
}

function getFilteredReviewActivities() {
  const search = String(state.reviewFilters.search || '').trim().toLowerCase();
  const city = String(state.reviewFilters.city || '').trim().toLowerCase();
  const type = String(state.reviewFilters.type || '').trim().toLowerCase();
  const verdict = String(state.reviewFilters.verdict || '').trim();

  const filtered = state.activities.filter((a) => {
    const review = state.reviewed[a.id] || { approved: null };
    const text = [a.name, a.city, a.type, a.why_it_fits, a.pitfall, a.booking_advice, a.insider_tips].join(' ').toLowerCase();

    if (search && !text.includes(search)) return false;
    if (city && String(a.city || '').trim().toLowerCase() !== city) return false;
    if (type && String(a.type || '').trim().toLowerCase() !== type) return false;
    if (verdict === 'approved' && review.approved !== true) return false;
    if (verdict === 'declined' && review.approved !== false) return false;
    if (verdict === 'unreviewed' && review.approved !== null) return false;
    return true;
  });

  const sort = state.reviewFilters.sort;
  if (sort === 'price-desc' || sort === 'price-asc') {
    filtered.sort(priceComparator(sort === 'price-asc' ? 1 : -1));
  }
  return filtered;
}

function applyVerdictToVisibleActivities(verdict = null) {
  const visible = getFilteredReviewActivities();
  if (!visible.length) {
    showErrorBanner('No visible activities to update.');
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

  renderActivities();
}


async function enrichActivity(a) {
  if (!a?.name) return;
  await Promise.all([
    a.place_id == null && a.price_level == null ? geocodeActivity(a).catch(() => {}) : Promise.resolve(),
    !a.imageUrl ? (async () => {
      try {
        const params = new URLSearchParams({ q: a.name, city: a.city || '', type: a.type || '' });
        const res = await apiFetch(`/api/image?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.imageUrl) a.imageUrl = data.imageUrl;
      } catch {}
    })() : Promise.resolve()
  ]);
}

function enrichActivities(items = []) {
  return Promise.all((items || []).filter((a) => a?.name).map(enrichActivity));
}

function computeBudgetLensBreakdown() {
  const checklist = buildChecklistFromState();
  let itineraryActivityTotal = 0;
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
      entryExitTransportTotal += cost;
      return;
    }

    itineraryActivityTotal += cost;
  });

  const budgetLensTotal = itineraryActivityTotal;
  const absoluteTripTotal = budgetLensTotal + entryExitTransportTotal + accommodationTotal;

  return {
    budgetLensTotal,
    absoluteTripTotal,
    itineraryActivityTotal,
    entryExitTransportTotal,
    accommodationTotal
  };
}

function tripDayCount() {
  return state.cities.reduce((sum, c) => {
    if (!c.startDate || !c.endDate) return sum;
    const start = parseYmdAsLocal(c.startDate);
    const end = parseYmdAsLocal(c.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return sum;
    return sum + Math.floor((end - start) / 86400000) + 1;
  }, 0);
}

function trackerRow({ label, tooltip, value, fillPct, trailing = '' }) {
  return `
    <div class="tk-row">
      <div class="tk-label"><span class="budget-label">${label}</span><button class="budget-info-btn" type="button" aria-label="${label} info" data-tooltip="${tooltip}"><i class="ph-bold ph-info" aria-hidden="true"></i></button></div>
      <div class="tk-value">${value}</div>
      <div class="tk-bar"><div class="tk-fill" style="width:${fillPct}%"></div></div>
      <div class="tk-trailing">${trailing}</div>
    </div>`;
}

// Avg activities/day against a comfortable full day (derived from the trip's pace pref).
// Capped at 100% — fullness signal, never a "you need more" quota.
function activityDensityFill(count) {
  const days = tripDayCount();
  if (!days || !count) return 0;
  const paceVal = Math.max(1, Math.min(5, Math.round(Number(state.profile?.answers?.pace) || 3)));
  const fullPerDay = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }[paceVal] + 2;
  return Math.min((count / days) / fullPerDay, 1) * 100;
}

function renderBudgetTracker() {
  const existing = document.getElementById('budgetTracker');
  const hasBudget = state.tripBudget > 0;
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved === true);

  if (state.step < 2) { if (existing) existing.remove(); return; }

  const days = tripDayCount();
  const perDayLabel = approved.length && days ? ` · ~${Math.round((approved.length / days) * 10) / 10}/day` : '';
  const activitiesRow = trackerRow({
    label: 'Activities',
    tooltip: 'Approved activities and how full your days are on average',
    value: `${approved.length} approved${perDayLabel}`,
    fillPct: activityDensityFill(approved.length)
  });

  let colorClass = 'budget-neutral';
  let budgetSection = '';
  if (hasBudget) {
    const used = computeBudgetLensBreakdown().budgetLensTotal;
    const pct = Math.min(used / state.tripBudget, 1);
    const nullCount = approved.filter((a) => activityCardCostUsd(a) == null).length;
    colorClass = pct < 0.6 ? 'budget-green' : pct < 0.9 ? 'budget-yellow' : 'budget-red';
    budgetSection = trackerRow({
      label: 'Budget',
      tooltip: 'Tracks total cost of planned activities',
      value: `${nullCount > 0 ? `<span class="budget-caveat">${nullCount} unpriced</span> ` : ''}$${Math.round(used).toLocaleString()} / $${state.tripBudget.toLocaleString()}`,
      fillPct: pct * 100,
      trailing: approved.length > 0 ? `<button class="secondary budget-optimize-btn" type="button" id="budgetOptimizeBtn"><i class="ph-bold ph-lightning" aria-hidden="true"></i> Optimize</button>` : ''
    }) + `<div class="tk-divider"></div>`;
  }

  const html = `<div id="budgetTracker" class="budget-tracker budget-grid ${colorClass}">${budgetSection}${activitiesRow}</div>`;

  if (existing) { existing.outerHTML = html; } else {
    const grid = els.activitiesGrid;
    if (grid?.parentNode) grid.parentNode.insertAdjacentHTML('beforebegin', html);
  }
  document.getElementById('budgetOptimizeBtn')?.addEventListener('click', enterBudgetOptMode);
}

function exitBudgetOptMode() {
  budgetOptState = null;
  const overlay = document.getElementById('budgetOptOverlay');
  overlayManager.close('budgetOptOverlay');
  overlay.innerHTML = '';
  document.getElementById('budgetOptFooter')?.remove();
  document.body.classList.remove('budget-opt-active');
}

function mountBudgetOptOverlay() {
  document.getElementById('budgetOptOverlay').innerHTML = `
    <div class="budget-opt-shell">
      <div class="budget-opt-header">
        <h3>Budget Optimization</h3>
        <div class="budget-opt-header-actions">
          <button class="secondary" id="budgetOptSortBtn" type="button" title="Sort by price">
            <i class="ph-bold ph-arrows-down-up" aria-hidden="true"></i> <span id="budgetOptSortLabel">Default</span>
          </button>
        </div>
        <p class="budget-opt-desc">Unlock the activities you want replaced with cheaper alternatives. Locked activities stay as-is.</p>
        <div id="budgetOptCatSummary" class="budget-opt-cat-summary" aria-label="Spend by category"></div>
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
  document.getElementById('budgetOptConfirmLocksBtn').addEventListener('click', () => {
    if (budgetOptState.phase === 'flip') onConfirmSelections();
    else onConfirmLocks();
  });
  document.getElementById('budgetOptSortBtn').addEventListener('click', () => {
    const order = ['default', 'price-desc', 'price-asc'];
    const next = order[(order.indexOf(budgetOptState.sortMode) + 1) % order.length];
    budgetOptState.sortMode = next;
    document.getElementById('budgetOptSortLabel').textContent =
      next === 'price-desc' ? 'Price ↓' : next === 'price-asc' ? 'Price ↑' : 'Default';
    if (budgetOptState.lastRender) renderBudgetOptCards(budgetOptState.lastRender.activities, budgetOptState.lastRender.mode);
  });
}

function enterBudgetOptMode() {
  // Exclude free/unpriced activities — no cost to optimize
  const approved = budgetOptApprovedActivities();
  if (!approved.length) return;
  // Default all to locked — user unlocks what they want changed
  budgetOptState = { phase: 'lock', lockedIds: new Set(approved.map((a) => a.id)), refinements: new Map(), choiceIsRefined: new Map(), inFlight: false, sortMode: 'default', lastRender: null };
  mountBudgetOptOverlay();
  renderBudgetOptCards(approved, 'lock');
  document.querySelector('#budgetOptFooter .budget-opt-progress-wrap')?.classList.remove('hidden');
  document.getElementById('budgetOptProgressLabel')?.classList.remove('hidden');
  updateBudgetOptProgressBar();
  overlayManager.open('budgetOptOverlay');
  document.body.classList.add('budget-opt-active');
}

function optActivityCost(act) {
  const cost = actCostUsd(act);
  if (cost == null) return null;
  const adults = state.numTravelers || 1;
  const children = state.numChildren || 0;
  return actCostType(act) === 'per_group' ? cost : cost * adults + Math.round(cost * 0.6 * children);
}

// Whole-party estimate on the same basis as the checklist budget rollup: the
// activity's real cost when known, else the type-based representative estimate.
// A non-positive real cost ($0 or missing) is not a credible estimate for a
// priced venue (e.g. a refined meal the model priced at $0), so it falls back
// to the representative estimate rather than displaying an impossible $0.
function activityBudgetUsd(act) {
  const partyCost = optActivityCost(act);
  if (partyCost != null && partyCost > 0) return partyCost;
  const perPerson = representativeCostUsd(act);
  if (perPerson == null) return null;
  const adults = state.numTravelers || 1;
  const children = state.numChildren || 0;
  return perPerson * adults + perPerson * 0.6 * children;
}

// The figure to show on a card — prefer any user-edited checklist budget so the
// card matches the checklist exactly, else the derived estimate.
function activityCardCostUsd(act) {
  const item = (state.bookingChecklist || []).find(
    (it) => it.type === 'activity' && it.activityId === act.id
  );
  if (item && item.budgetUsd != null) return Number(item.budgetUsd);
  return activityBudgetUsd(act);
}

function activityCostChipHtml(act) {
  const cost = activityCardCostUsd(act);
  if (cost == null) return `<span class="activity-cost-chip activity-cost-chip--empty" data-cost-chip="${esc(act.id)}"></span>`;
  const party = (state.numTravelers || 1) + (state.numChildren || 0) > 1;
  const tip = party ? 'Estimated total for your party' : 'Estimated cost';
  return `<span class="activity-cost-chip" data-cost-chip="${esc(act.id)}" title="${esc(tip)}">~$${Math.round(cost).toLocaleString()}</span>`;
}

// Eligibility for budget optimization: anything that shows a $ figure on cards/checklist.
function budgetOptEligible(a) {
  return (activityCardCostUsd(a) ?? 0) > 0;
}

function budgetOptApprovedActivities() {
  return state.activities.filter((a) => state.reviewed[a.id]?.approved === true && budgetOptEligible(a));
}

function sumCardCosts(activities = []) {
  return activities.reduce((s, a) => s + (activityCardCostUsd(a) ?? 0), 0);
}

// Cost of the currently-selected option inside budget-opt. Refined candidates
// share the original's id, so they must not go through the checklist lookup —
// activityCardCostUsd would return the original's edited budget.
function budgetOptCurrentCostUsd(a) {
  if (budgetOptState?.phase === 'flip') {
    const refined = budgetOptState.refinements.get(a.id);
    const showingRefined = budgetOptState.choiceIsRefined.get(a.id) ?? !!refined;
    if (showingRefined && refined) return activityBudgetUsd(refined);
  }
  return activityCardCostUsd(a);
}

function priceComparator(dir, costOf = activityCardCostUsd) {
  return (a, b) => {
    const ca = costOf(a);
    const cb = costOf(b);
    if (ca == null && cb == null) return 0;
    if (ca == null) return 1;
    if (cb == null) return -1;
    return (ca - cb) * dir;
  };
}

function activityImgHtml(src, alt, { extraClass = '', style = '' } = {}) {
  const cls = `activity-img${extraClass ? ' ' + extraClass : ''}`;
  const ph = `<div class="${cls} activity-img-placeholder"${style ? ` style="${style}"` : ''}><i class="ph-bold ph-mountains" aria-hidden="true"></i></div>`;
  if (!src) return ph;
  const fallback = ph.replace(/"/g, '&quot;');
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" class="${cls}"${style ? ` style="${style}"` : ''} onerror="this.outerHTML='${fallback}'" />`;
}

function isConfirmedBooking(activityId) {
  return (state.bookingChecklist || []).some(
    (item) => item.type === 'activity' && item.activityId === activityId && item.verified === true
  );
}

function renderBudgetOptCategorySummary(activities) {
  const el = document.getElementById('budgetOptCatSummary');
  if (!el) return;
  const totals = new Map();
  activities.forEach((a) => {
    const cost = budgetOptCurrentCostUsd(a);
    if (cost == null || cost <= 0) return;
    const cat = mapTypeToFinalizeCat(a.type);
    totals.set(cat, (totals.get(cat) || 0) + cost);
  });
  const entries = [...totals.entries()].sort((x, y) => y[1] - x[1]);
  const grand = entries.reduce((s, [, v]) => s + v, 0);
  if (!entries.length || grand <= 0) { el.innerHTML = ''; return; }
  el.innerHTML = entries.map(([cat, sum], i) => {
    const pct = Math.round((sum / grand) * 100);
    return `
      <div class="opt-cat-chip${i === 0 ? ' opt-cat-chip--top' : ''}">
        <span class="opt-cat-label">${esc(FINALIZE_CAT_LABEL[cat] || cat)}</span>
        <span class="opt-cat-amount">~$${Math.round(sum).toLocaleString()}</span>
        <span class="opt-cat-pct">${pct}%</span>
        <span class="opt-cat-bar"><span style="width:${pct}%"></span></span>
      </div>`;
  }).join('');
}

function buildBudgetOptCard(a, mode, approved) {
  const isLocked = budgetOptState.lockedIds.has(a.id);
  const hasRefinement = budgetOptState.refinements.has(a.id);
  const refined = hasRefinement ? budgetOptState.refinements.get(a.id) : null;
  const showingRefined = budgetOptState.choiceIsRefined.get(a.id) ?? true;

  const cardEl = document.createElement('article');
  cardEl.className = `card activity-card opt-card${isLocked ? ' opt-card--locked' : ''}`;
  cardEl.dataset.activityId = a.id;

  const faceHtml = (act, label, isRefined = false) => {
    const cost = isRefined ? activityBudgetUsd(act) : activityCardCostUsd(act);
    return `
    <div class="opt-card-img-wrap">
      ${activityImgHtml(act.imageUrl, act.name, { style: 'width:100%;height:160px;object-fit:cover;border-radius:12px 12px 0 0;' })}
      ${cost != null ? `<span class="opt-cost-chip">~$${Math.round(cost).toLocaleString()}</span>` : ''}
    </div>
    <div class="card-content">
      <div class="activity-card-head-actions" style="margin-bottom:8px;">
        <div>
          ${label ? `<span class="badge badge-refined">${label}</span>` : ''}
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
    const booked = isConfirmedBooking(a.id);
    if (booked) cardEl.classList.add('opt-card--booked');
    const lockIcon = booked ? 'ph-seal-check' : isLocked ? 'ph-lock-key' : 'ph-lock-open';
    cardEl.innerHTML = `
      <button class="opt-lock-btn" type="button" ${booked ? 'disabled data-tooltip="Confirmed booking — can\'t be replaced"' : ''} aria-label="${booked ? 'Confirmed booking, locked' : isLocked ? 'Unlock activity' : 'Lock activity'}">
        <i class="ph-bold ${lockIcon}" aria-hidden="true"></i>
      </button>
      ${faceHtml(a, null)}`;
    if (!booked) {
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
    }
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openOptCardExpand(approved, approved.indexOf(a));
    });
    return cardEl;
  }

  // flip mode — only unlocked activities with refinements reach here
  cardEl.classList.add('opt-card--flip');
  if (!showingRefined) cardEl.classList.add('is-showing-original');
  cardEl.innerHTML = `
    <button class="opt-flip-btn" type="button" aria-label="Flip card"><i class="ph-bold ph-arrows-clockwise" aria-hidden="true"></i></button>
    <div class="opt-card-inner">
      <div class="opt-card-face opt-card-front">${faceHtml(refined, 'Refined', true)}</div>
      <div class="opt-card-face opt-card-back">${faceHtml(a, 'Original')}</div>
    </div>`;
  cardEl.querySelector('.opt-flip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const nowRefined = budgetOptState.choiceIsRefined.get(a.id) ?? true;
    budgetOptState.choiceIsRefined.set(a.id, !nowRefined);
    cardEl.classList.toggle('is-showing-original', nowRefined);
    updateBudgetOptProgressBar();
  });
  cardEl.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    openOptCardExpand(approved, approved.indexOf(a));
  });
  return cardEl;
}

function openOptCardExpand(activities, startIndex) {
  if (startIndex < 0 || !activities[startIndex]) return;
  document.querySelector('.opt-card-expand-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'card-expand-overlay opt-card-expand-overlay';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'card-expand-close icon-btn red';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<i class="ph-bold ph-x" aria-hidden="true"></i>';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'card-expand-nav prev';
  prevBtn.setAttribute('aria-label', 'Previous activity');
  prevBtn.innerHTML = '<i class="ph-bold ph-caret-left" aria-hidden="true"></i>';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'card-expand-nav next';
  nextBtn.setAttribute('aria-label', 'Next activity');
  nextBtn.innerHTML = '<i class="ph-bold ph-caret-right" aria-hidden="true"></i>';

  const body = document.createElement('div');
  body.className = 'card-expand-body';

  overlay.appendChild(closeBtn);
  overlay.appendChild(prevBtn);
  overlay.appendChild(nextBtn);
  overlay.appendChild(body);
  document.body.appendChild(overlay);

  let index = startIndex;

  function close() {
    overlay.classList.add('closing');
    document.removeEventListener('keydown', onKeydown);
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
  }

  function onKeydown(e) {
    if (e.target instanceof Element && e.target.closest('textarea, input, select')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft' && index > 0) show(index - 1);
    else if (e.key === 'ArrowRight' && index < activities.length - 1) show(index + 1);
  }

  function show(i) {
    index = i;
    const a = activities[i];
    const refined = budgetOptState.refinements.get(a.id);
    const showRefined = refined && (budgetOptState.choiceIsRefined.get(a.id) ?? true);
    const act = showRefined ? refined : a;
    const label = refined ? (showRefined ? 'Refined' : 'Original') : null;
    body.innerHTML = `
      ${activityImgHtml(act.imageUrl, act.name, { style: 'width:100%;height:220px;object-fit:cover;' })}
      <div class="card-content">
        <div class="activity-card-head-actions" style="margin-bottom:8px;">
          <div>
            ${label ? `<span class="badge badge-refined">${label}</span>` : ''}
            ${act.type ? `<span class="badge">${esc(act.type)}</span>` : ''}
            ${headerPriceBadgeHtml(act)}
          </div>
        </div>
        <h3>${esc(act.name)}</h3>
        <p><strong>City:</strong> ${esc(act.city || '')}</p>
        <p><strong>Why it fits:</strong> ${esc(act.why_it_fits || '')}</p>
        ${act.pitfall ? `<p><strong>Pitfall:</strong> ${esc(act.pitfall)}</p>` : ''}
        ${act.booking_advice ? `<p><strong>Booking advice:</strong> ${esc(act.booking_advice)}</p>` : ''}
        ${act.insider_tips ? `<p class="activity-insider-tip"><i class="ph-bold ph-lightbulb" aria-hidden="true"></i> <strong>Insider tip:</strong> ${esc(act.insider_tips)}</p>` : ''}
      </div>`;
    body.scrollTop = 0;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === activities.length - 1;
  }

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => { if (index > 0) show(index - 1); });
  nextBtn.addEventListener('click', () => { if (index < activities.length - 1) show(index + 1); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKeydown);

  show(startIndex);
}

function renderBudgetOptCards(activities, mode) {
  budgetOptState.lastRender = { activities, mode };
  let list = activities;
  if (budgetOptState.sortMode && budgetOptState.sortMode !== 'default') {
    list = [...activities].sort(priceComparator(budgetOptState.sortMode === 'price-asc' ? 1 : -1, budgetOptCurrentCostUsd));
  }
  const grid = document.getElementById('budgetOptGrid');
  grid.innerHTML = '';
  list.forEach((a) => grid.appendChild(buildBudgetOptCard(a, mode, list)));
}

async function onConfirmLocks() {
  if (budgetOptState.inFlight) return;
  const approved = budgetOptApprovedActivities();
  const unlocked = approved.filter((a) => !budgetOptState.lockedIds.has(a.id) && !isConfirmedBooking(a.id));
  if (!unlocked.length) {
    alert('All activities are locked — nothing to optimize.');
    return;
  }
  const locked = approved.filter((a) => budgetOptState.lockedIds.has(a.id));
  const lockedCost = sumCardCosts(locked);
  const totalBudget = state.tripBudget || sumCardCosts(approved) * 0.8;
  const perActivityTarget = Math.max(0, Math.round((totalBudget - lockedCost) / unlocked.length));

  const btn = document.getElementById('budgetOptConfirmLocksBtn');
  btn.disabled = true;
  budgetOptState.inFlight = true;

  showLoader({
    title: 'Optimizing your budget',
    status: 'Finding cheaper alternatives…',
    progressLabel: `Activity 0 of ${unlocked.length}`,
    messages: BUDGET_OPT_MESSAGES,
    totalUnits: unlocked.length
  });

  let settledCount = 0;
  const results = await Promise.allSettled(
    unlocked.map((a) =>
      apiFetch('/api/activity/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: a,
          note: 'find a cheaper alternative within the same activity type and city',
          budget_target: perActivityTarget,
          tripId: state.currentItineraryId || null
        })
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(({ updates }) => ({ id: a.id, refined: { ...a, ...updates, id: a.id } }))
        .finally(() => {
          settledCount += 1;
          setLoaderUnitsDone(settledCount);
          setLoaderStatus('Finding cheaper alternatives…', `Activity ${settledCount} of ${unlocked.length}`);
        })
    )
  );

  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      budgetOptState.refinements.set(r.value.id, r.value.refined);
      budgetOptState.choiceIsRefined.set(r.value.id, true);
    }
  });

  budgetOptState.inFlight = false;
  btn.disabled = false;

  const abortToLock = (message) => {
    budgetOptState.refinements.clear();
    budgetOptState.choiceIsRefined.clear();
    hideLoader();
    btn.innerHTML = '<i class="ph-bold ph-check" aria-hidden="true"></i> Confirm';
    showErrorBanner(message);
  };

  if (!budgetOptState.refinements.size) {
    abortToLock('Couldn\'t find cheaper alternatives — try again.');
    return;
  }

  setLoaderStatus('Polishing alternatives…', `Activity ${settledCount} of ${unlocked.length}`);
  await enrichActivities([...budgetOptState.refinements.values()]);

  // Drop refinements that aren't actually cheaper than the original (e.g. a $$
  // restaurant swapped for another $$) — showing an unchanged price reads as broken.
  for (const [id, refined] of [...budgetOptState.refinements.entries()]) {
    const original = approved.find((a) => a.id === id);
    const refinedCost = activityBudgetUsd(refined);
    const originalCost = original ? activityCardCostUsd(original) : null;
    if (refinedCost == null || originalCost == null || refinedCost >= originalCost) {
      budgetOptState.refinements.delete(id);
      budgetOptState.choiceIsRefined.delete(id);
    }
  }

  if (!budgetOptState.refinements.size) {
    abortToLock('No cheaper alternatives found at a lower price — your picks are already good value.');
    return;
  }

  finishLoaderProgress();
  hideLoader();
  transitionToFlipPhase(approved);
}

function transitionToFlipPhase(approved) {
  budgetOptState.phase = 'flip';
  const confirmBtn = document.getElementById('budgetOptConfirmLocksBtn');
  if (confirmBtn) confirmBtn.innerHTML = '<i class="ph-bold ph-check-circle" aria-hidden="true"></i> Confirm Selections';
  const unlocked = approved.filter((a) => !budgetOptState.lockedIds.has(a.id) && budgetOptState.refinements.has(a.id));
  renderBudgetOptCards(unlocked, 'flip');
  updateBudgetOptProgressBar();
}

function updateBudgetOptProgressBar() {
  const bar = document.getElementById('budgetOptProgressBar');
  if (!bar) return;

  const approved = budgetOptApprovedActivities();

  if (budgetOptState.phase === 'lock') {
    const used = computeBudgetLensBreakdown().budgetLensTotal;
    const budget = state.tripBudget || sumCardCosts(approved);
    const ratio = budget > 0 ? used / budget : 0;
    bar.style.width = `${Math.min(ratio, 1) * 100}%`;
    bar.className = 'budget-opt-progress-bar' + (ratio >= 0.9 ? ' bar-red' : ratio >= 0.6 ? ' bar-yellow' : '');
    const budgetLabel = state.tripBudget ? `$${Math.round(budget).toLocaleString()}` : `~$${Math.round(budget).toLocaleString()}`;
    document.getElementById('budgetOptProgressLabel').textContent =
      `~$${Math.round(used).toLocaleString()} / ${budgetLabel}`;
    renderBudgetOptCategorySummary(approved);
    return;
  }

  const totalCost = sumCardCosts(approved);
  const selectedCost = approved.reduce((s, a) => s + (budgetOptCurrentCostUsd(a) ?? 0), 0);

  const pct = totalCost > 0 ? Math.min(selectedCost / totalCost, 1.2) * 100 : 0;
  bar.style.width = `${Math.min(pct, 100)}%`;
  bar.className = 'budget-opt-progress-bar' + (pct > 100 ? ' bar-red' : pct > 80 ? ' bar-yellow' : '');
  document.getElementById('budgetOptProgressLabel').textContent =
    `~$${Math.round(selectedCost).toLocaleString()} / ~$${Math.round(totalCost).toLocaleString()}`;
  renderBudgetOptCategorySummary(approved);
}

function onConfirmSelections() {
  const approved = budgetOptApprovedActivities();
  const swappedIds = new Set();
  approved.forEach((a) => {
    if (budgetOptState.choiceIsRefined.get(a.id) && budgetOptState.refinements.has(a.id)) {
      const idx = state.activities.findIndex((x) => x.id === a.id);
      if (idx !== -1) state.activities[idx] = budgetOptState.refinements.get(a.id);
      swappedIds.add(a.id);
    }
  });
  // The swapped activities are now different venues — drop their old checklist
  // entries (including any cached/manually-set price) so the rebuild re-derives
  // the new venue's cost instead of freezing the original's.
  if (swappedIds.size) {
    state.bookingChecklist = (state.bookingChecklist || []).filter(
      (it) => !(it.type === 'activity' && swappedIds.has(it.activityId))
    );
  }
  exitBudgetOptMode();
  renderActivities();
}

function replaceActivityInState(oldId, newActivity) {
  const idx = state.activities.findIndex((x) => x.id === oldId);
  if (idx !== -1) state.activities.splice(idx, 1, newActivity);
  delete state.reviewed[oldId];
  state.reviewed[newActivity.id] = { approved: null, notes: '' };
  enrichActivity(newActivity).then(() => renderActivities());
  renderActivities();
}

function updateActivityInState(id, updates) {
  const idx = state.activities.findIndex((x) => x.id === id);
  if (idx === -1) return;
  const updated = { ...state.activities[idx], ...updates, id };
  state.activities[idx] = updated;
  enrichActivity(updated).then(() => renderActivities());
  renderActivities();
}

function renderActivities() {
  updateReviewNav();
  populateReviewCityFilter();
  populateReviewTypeFilter();
  destroyMiniMaps();

  const filteredActivities = getFilteredReviewActivities();

  // Ahead of the empty-filter return: the tracker reads every approved activity and renders into
  // #budgetTracker, so it has nothing to do with the review filter. Leaving it behind the return
  // froze the approved count and budget bar whenever a filter matched nothing.
  renderBudgetTracker();

  if (!filteredActivities.length) {
    els.activitiesGrid.innerHTML = '<div class="item"><strong>No activities match your filters.</strong><p>Try clearing search/filter settings.</p></div>';
    return;
  }

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
          const chipEl = card.querySelector(`[data-cost-chip="${CSS.escape(a.id)}"]`);
          if (chipEl) chipEl.outerHTML = activityCostChipHtml(a);
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
    const isFlipped = Boolean(state.reviewCardFlips[a.id]);
    const card = document.createElement('article');
    card.className = `card activity-card card-reveal ${cardStateClass} ${isFlipped ? 'is-flipped' : ''}`.trim();
    card.dataset.activityId = a.id;
    card.innerHTML = `
      <div class="activity-card-inner">
        <div class="activity-card-face activity-card-front">
          <div class="activity-card-img-wrap">
            ${activityImgHtml(a.imageUrl, a.name)}
            ${activityCostChipHtml(a)}
            <button class="secondary flip-btn activity-flip-btn-overlay" type="button" title="Flip to map" aria-label="Flip card"><i class="ph-bold ph-map-trifold" aria-hidden="true"></i></button>
          </div>
          <div class="card-content">
            <div class="activity-card-head-actions">
              <div>
                ${a.type ? `<span class="badge">${esc(a.type)}</span>` : ''}
                <span data-price-badges="${esc(a.id)}">${headerPriceBadgeHtml(a)}</span>
                ${googleMapsLinkHtml(a)}
              </div>
            </div>
            <h3>${esc(a.name)}</h3>
            <p><strong>City:</strong> ${esc(a.city || '')}</p>
            <p><strong>Why it fits:</strong> ${esc(a.why_it_fits || '')}</p>
            <p><strong>Pitfall:</strong> ${esc(a.pitfall || '')}</p>
            <p><strong>Booking advice:</strong> ${esc(a.booking_advice || '')}</p>
            ${a.insider_tips ? `<p class="activity-insider-tip"><i class="ph-bold ph-lightbulb" aria-hidden="true"></i> <strong>Insider tip:</strong> ${esc(a.insider_tips)}</p>` : ''}
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
                <textarea id="actDecline-${a.id}" class="profile-textarea-fixed decline-reason" rows="2" maxlength="200" placeholder="Why replace this activity?…"></textarea>
                <button class="textarea-expand-btn" type="button" data-expand="actDecline-${a.id}" data-title="Replace — ${esc(a.name)}" aria-label="Expand reason"><i class="ph-bold ph-arrows-out-simple"></i></button>
              </div>
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
    const confirmReplace = card.querySelector('.confirm-replace');
    const saveActivityNotes = card.querySelector('.save-activity-notes');
    const activityNotesText = card.querySelector('.activity-notes-text');
    const declineBtn = card.querySelector('.decline');
    bindTextareaExpandButtons(card);

    declineBtn.addEventListener('click', () => {
      const current = state.reviewed[a.id]?.approved;
      const nextApproved = current === false ? null : false;
      state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), approved: nextApproved };
      if (nextApproved === false && state.placements[a.id]?.dayId) {
        state.placements[a.id] = { dayId: null, time: null };
      }
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
      confirmReplace.disabled = !declineReason.value.trim();
    });

    confirmReplace.addEventListener('click', async () => {
      const reason = declineReason.value.trim();
      if (!reason) return;
      confirmReplace.disabled = true;
      showLoader({
        title: 'Replacing activity',
        status: `Finding a better ${a.type || 'option'} in ${a.city}…`,
        messages: REPLACE_MESSAGES
      });
      try {
        const notes = state.reviewed[a.id]?.notes || '';
        const resp = await apiFetch('/api/activity/replace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity: a, reason, notes, tripId: state.currentItineraryId || null })
        });
        if (!resp.ok) throw new Error('Replace failed');
        const { activity: rawReplacement } = await resp.json();
        if (!rawReplacement) throw new Error('No activity in response');
        const replacement = { id: `${rawReplacement.city || a.city}-replacement-${uid()}`, ...normalizeActivityMetadata(rawReplacement), city: canonicalizeActivityCity(rawReplacement.city, a.city) };
        finishLoaderProgress();
        replaceActivityInState(a.id, replacement);
      } catch {
        confirmReplace.innerHTML = '<i class="ph-bold ph-arrows-clockwise"></i>';
        confirmReplace.disabled = false;
      } finally {
        hideLoader();
      }
    });
    card.querySelector('.mini-map-wrap')?.addEventListener('click', () => {
      openActivityMapOverlay(a.id);
    });

    // Tap/click card to expand into the detail overlay
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, a, textarea, input, .decline-feedback')) return;
      openCardExpand(filteredActivities.indexOf(a));
    });

    return card;
  }

  function openCardExpand(startIndex) {
    if (startIndex < 0 || !filteredActivities[startIndex]) return;
    const existing = document.querySelector('.card-expand-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'card-expand-overlay';

    const body = document.createElement('div');
    body.className = 'card-expand-body';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'card-expand-close icon-btn red';
    closeBtn.innerHTML = '<i class="ph-bold ph-x" aria-hidden="true"></i>';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.setAttribute('title', 'Close');

    const prevBtn = document.createElement('button');
    prevBtn.className = 'card-expand-nav prev';
    prevBtn.innerHTML = '<i class="ph-bold ph-caret-left" aria-hidden="true"></i>';
    prevBtn.setAttribute('aria-label', 'Previous activity');

    const nextBtn = document.createElement('button');
    nextBtn.className = 'card-expand-nav next';
    nextBtn.innerHTML = '<i class="ph-bold ph-caret-right" aria-hidden="true"></i>';
    nextBtn.setAttribute('aria-label', 'Next activity');

    overlay.appendChild(closeBtn);
    overlay.appendChild(prevBtn);
    overlay.appendChild(nextBtn);
    overlay.appendChild(body);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    let index = startIndex;

    function close() {
      overlay.classList.add('closing');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
      overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
    }

    function onKeydown(e) {
      if (e.target instanceof Element && e.target.closest('textarea, input, select')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' && index > 0) show(index - 1);
      else if (e.key === 'ArrowRight' && index < filteredActivities.length - 1) show(index + 1);
    }

    function gridCardFor(id) {
      return els.activitiesGrid.querySelector(`[data-activity-id="${CSS.escape(String(id))}"]`);
    }

    function show(i) {
      index = i;
      const a = filteredActivities[i];
      const sourceCard = gridCardFor(a.id) || buildActivityCard(a);
      const front = sourceCard.querySelector('.activity-card-front');
      body.innerHTML = front ? front.innerHTML : sourceCard.innerHTML;
      body.scrollTop = 0;
      // Ensure all content visible in expanded view
      body.querySelectorAll('.card-content > *').forEach((el) => { el.style.display = ''; });
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i === filteredActivities.length - 1;

      function syncExpand(approved) {
        syncVerdictClasses(body, approved);
        const gridCard = gridCardFor(a.id);
        if (gridCard) syncVerdictClasses(gridCard, approved);
      }

      // Wire up actions directly against state (grid card may be re-rendered)
      body.querySelector('.approve')?.addEventListener('click', () => {
        const current = state.reviewed[a.id]?.approved;
        const next = current === true ? null : true;
        state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), approved: next };
        syncExpand(next);
        renderBudgetTracker();
      });

      const expandDeclineBtn = body.querySelector('.decline');
      const expandDeclineReason = body.querySelector('.decline-reason');
      const expandConfirmReplace = body.querySelector('.confirm-replace');
      const expandSaveActivityNotes = body.querySelector('.save-activity-notes');
      const expandActivityNotesText = body.querySelector('.activity-notes-text');

      expandDeclineBtn?.addEventListener('click', () => {
        const current = state.reviewed[a.id]?.approved;
        const next = current === false ? null : false;
        state.reviewed[a.id] = { ...(state.reviewed[a.id] || {}), approved: next };
        if (next === false && state.placements[a.id]?.dayId) {
          state.placements[a.id] = { dayId: null, time: null };
        }
        syncExpand(next);
        renderBudgetTracker();
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
        if (expandConfirmReplace) expandConfirmReplace.disabled = !expandDeclineReason.value.trim();
      });

      expandConfirmReplace?.addEventListener('click', async () => {
        const reason = expandDeclineReason.value.trim();
        if (!reason) return;
        expandConfirmReplace.disabled = true;
        close();
        showLoader({
          title: 'Replacing activity',
          status: `Finding a better ${a.type || 'option'} in ${a.city}…`,
          messages: REPLACE_MESSAGES
        });
        try {
          const notes = state.reviewed[a.id]?.notes || '';
          const resp = await apiFetch('/api/activity/replace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity: a, reason, notes, tripId: state.currentItineraryId || null })
          });
          if (!resp.ok) throw new Error('Replace failed');
          const { activity: rawReplacement } = await resp.json();
          if (!rawReplacement) throw new Error('No activity in response');
          const replacement = { id: `${rawReplacement.city || a.city}-replacement-${uid()}`, ...normalizeActivityMetadata(rawReplacement), city: canonicalizeActivityCity(rawReplacement.city, a.city) };
          finishLoaderProgress();
          replaceActivityInState(a.id, replacement);
        } catch {
          showErrorBanner('Couldn\'t find a replacement — try again.');
        } finally {
          hideLoader();
        }
      });

      body.querySelector('.flip-btn')?.addEventListener('click', () => {
        close();
        openActivityMapOverlay(a.id);
      });
    }

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => { if (index > 0) show(index - 1); });
    nextBtn.addEventListener('click', () => { if (index < filteredActivities.length - 1) show(index + 1); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKeydown);

    show(startIndex);
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

const CATEGORY_ICONS = {
  meal: 'ph-fork-knife',
  tour: 'ph-compass',
  museum: 'ph-columns',
  landmark: 'ph-buildings',
  neighborhood: 'ph-map-trifold',
  sports: 'ph-soccer-ball',
  shopping: 'ph-bag',
  park: 'ph-tree',
  market: 'ph-storefront',
  nightlife: 'ph-martini',
  spa: 'ph-sparkle',
  default: 'ph-map-pin'
};

function inferCategoryClient(activity = {}) {
  const t = String(activity.type || '').trim().toLowerCase();
  return CATEGORY_ICONS[t] ? t : 'default';
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
  overlayManager.close('activityMapOverlay');
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
  setAddActivityError('');

  overlayManager.open('addActivityModal');
  setTimeout(() => document.getElementById('addActivityName').focus(), 50);
}

function closeAddActivityModal() {
  overlayManager.close('addActivityModal');
}

function setAddActivityError(message) {
  const errorEl = document.getElementById('addActivityError');
  errorEl.textContent = message || '';
  errorEl.classList.toggle('hidden', !message);
}

async function submitAddActivity() {
  const nameInput = document.getElementById('addActivityName');
  const name = nameInput.value.trim();
  if (!name) {
    setAddActivityError('Please enter an activity name.');
    nameInput.focus();
    return;
  }

  const city = document.getElementById('addActivityCity').value;
  const costRaw = document.getElementById('addActivityCost').value;
  const costType = document.getElementById('addActivityCostType').value;
  const why = document.getElementById('addActivityWhy').value.trim();
  const cost = costRaw !== '' && Number.isFinite(Number(costRaw)) && Number(costRaw) >= 0 ? Number(costRaw) : null;

  const submitBtn = document.getElementById('addActivitySubmit');
  submitBtn.disabled = true;
  setAddActivityError('');

  let resolved = null;
  try {
    const res = await apiFetch(`/api/places/resolve?q=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}`);
    resolved = res.ok ? await res.json() : null;
  } catch {
    resolved = null;
  }
  submitBtn.disabled = false;

  if (resolved && !resolved.error && !resolved.placeId) {
    setAddActivityError(`Couldn't find "${name}" in ${city} — check the spelling.`);
    nameInput.focus();
    return;
  }

  const stubId = crypto.randomUUID();
  const stub = {
    id: stubId,
    name: resolved?.name || name,
    city,
    type: 'tour',
    userAdded: true,
    enriching: true,
  };

  state.activities.push(stub);
  closeAddActivityModal();
  renderActivities();

  apiFetch('/api/activity/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, city, why, cost, costType, tripId: state.currentItineraryId || null }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`server ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (!data?.activity) throw new Error('no activity returned');
      const added = { ...data.activity, id: stubId, city: stub.city, userAdded: true };
      replaceActivityInState(stubId, added);
    })
    .catch((err) => {
      console.error('[addActivity] failed:', err);
      state.activities = state.activities.filter((a) => a.id !== stubId);
      renderActivities();
      showErrorBanner(`Couldn't add "${name}" — try again.`);
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
  overlayManager.open('activityMapOverlay');

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

// expandDays, daysMatchCities, DAY_START_HOUR/END/PX_PER_HOUR/GRID_HEIGHT,
// DEFAULT_ARRANGE_CATEGORY_CONFIG, parseDurationHoursFromText, parseOpeningWindows,
// formatDuration, commutePairKey provided by /js/arrangeView.js

const _arrangeView_getDefaults = window.TravelPlannerArrangeView.getArrangeCategoryDefaults;
const _arrangeView_inferCategory = window.TravelPlannerArrangeView.inferActivityCategory;
const _arrangeView_normalizeMetadata = window.TravelPlannerArrangeView.normalizeActivityMetadata;

function getArrangeCategoryDefaults(category = '') {
  return _arrangeView_getDefaults(category, state.arrangeConfig);
}

function inferActivityCategory(activity = {}) {
  return _arrangeView_inferCategory(activity, {
    config: state.arrangeConfig,
    preferredTime: actPreferredTime(activity)
  });
}

function normalizeActivityMetadata(activity = {}) {
  return _arrangeView_normalizeMetadata(activity, {
    config: state.arrangeConfig,
    preferredTime: actPreferredTime(activity),
    durationHoursRaw: actDurationHours(activity, 0)
  });
}

// parseTimeTo24, minutesFromTime, timeFromMinutes provided by /shared/timeHelpers.js

// The single most-used concept in the arrange/finalize/itinerary code: an activity's position in
// its day is its placement time, and a day's contents are the approved activities placed on it.
// Both were written out longhand at nine call sites, which is nine chances for the ?.time fallback
// to drift.
function byScheduledTime(a, b) {
  return minutesFromTime(parseTimeTo24(state.placements[a.id]?.time))
    - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time));
}

function activitiesOnDay(dayId) {
  return state.activities
    .filter((a) => state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId === dayId)
    .sort(byScheduledTime);
}

function getIncomingCommuteForActivity(activityId) {
  const activity = state.activities.find((a) => a.id === activityId);
  if (!activity) return null;
  const placement = state.placements[activityId];
  if (!placement?.dayId) return null;

  const activitiesInDay = activitiesOnDay(placement.dayId);

  const index = activitiesInDay.findIndex((a) => a.id === activityId);
  if (index <= 0) return null;

  const prev = activitiesInDay[index - 1];
  return state.commutes[commutePairKey(prev.id, activityId)] || null;
}

// normalizeCommuteStateMap, COMMUTE_MODE_ORDER/LABEL, resolveSelectedCommuteMode/Details,
// formatCommuteBadge, timeFromY, yFromTime provided by /js/arrangeView.js

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

  const switchCity = (city) => {
    state.arrangeCity = city;
    renderArrange();
  };

  els.arrangeCityNav.querySelectorAll('[data-city-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchCity(btn.dataset.cityTab));
  });
  els.arrangeCityNav.querySelector('[data-city-prev]')?.addEventListener('click', () => {
    if (activeIndex <= 0) return;
    switchCity(cityGroups[activeIndex - 1].city);
  });
  els.arrangeCityNav.querySelector('[data-city-next]')?.addEventListener('click', () => {
    if (activeIndex >= cityGroups.length - 1) return;
    switchCity(cityGroups[activeIndex + 1].city);
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

// formatTypeLabel, formatDurationHoursLong provided by /js/arrangeView.js

function closeTimeEditPopup() {
  const existing = document.getElementById('time-edit-popup');
  if (existing) existing.remove();
  document.removeEventListener('mousedown', timeEditOutsideHandler, true);
}

function timeEditOutsideHandler(e) {
  const popup = document.getElementById('time-edit-popup');
  if (popup && !popup.contains(e.target)) closeTimeEditPopup();
}

function openTimeEditPopup(activityId, anchorEl) {
  closeTimeEditPopup();
  const item = state.activities.find((a) => String(a.id) === String(activityId));
  if (!item) return;
  const placement = state.placements[activityId] || {};
  const startTime = parseTimeTo24(placement.time || actPreferredTime(item) || typeToTime(item.type));
  const durHours = actDurationHours(item);
  const startMins = minutesFromTime(startTime);
  const endTime = timeFromMinutes(startMins + Math.round(durHours * 60));

  const rect = anchorEl.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - 240);
  const top = Math.min(rect.bottom + 6, window.innerHeight - 240);

  const popup = document.createElement('div');
  popup.id = 'time-edit-popup';
  popup.className = 'time-edit-popup';
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.innerHTML = `
    <div class="tep-label">Edit timing</div>
    <div class="tep-title">${esc(item.name)}</div>
    <label class="tep-field">
      <span class="tep-label">Start time</span>
      <input type="time" class="tep-start" step="900" value="${startTime}">
    </label>
    <label class="tep-field">
      <span class="tep-label">End time</span>
      <input type="time" class="tep-end" step="900" value="${endTime}">
    </label>
    <div class="tep-actions">
      <button type="button" class="tep-btn cancel">Cancel</button>
      <button type="button" class="tep-btn save">Save</button>
    </div>
  `;
  document.body.appendChild(popup);

  const startInput = popup.querySelector('.tep-start');
  const endInput = popup.querySelector('.tep-end');
  startInput.focus();
  startInput.select();

  const save = () => {
    const newStart = startInput.value;
    const newEnd = endInput.value;
    const sMin = minutesFromTime(newStart);
    const eMin = minutesFromTime(newEnd);
    if (!Number.isFinite(sMin) || !Number.isFinite(eMin) || eMin <= sMin) {
      showErrorBanner('End time must be after start time');
      return;
    }
    const newDurHours = (eMin - sMin) / 60;
    state.placements[activityId] = {
      ...(state.placements[activityId] || {}),
      time: newStart,
      endTime: newEnd
    };
    if (Math.abs(newDurHours - durHours) > 0.01) {
      item.duration_hours = newDurHours;
      if (item.timing) item.timing.duration_minutes = eMin - sMin;
    }
    closeTimeEditPopup();
    renderArrange();
    const editedDayId = state.placements[activityId]?.dayId;
    if (editedDayId) {
      updateCommutesForCityDays([editedDayId]).then(() => renderArrange()).catch(() => {});
    }
  };

  popup.querySelector('.tep-btn.save').addEventListener('click', save);
  popup.querySelector('.tep-btn.cancel').addEventListener('click', closeTimeEditPopup);
  [startInput, endInput].forEach((inp) => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') closeTimeEditPopup();
    });
  });

  setTimeout(() => {
    document.addEventListener('mousedown', timeEditOutsideHandler, true);
  }, 0);
}

function makePlacedCard(item, minTopFloor = null) {
  const { icon, colorClass } = getActivityStyle(item.type);
  const placement = state.placements[item.id] || {};
  const time = parseTimeTo24(placement.time || actPreferredTime(item) || typeToTime(item.type));
  const range = getPlacementTimeRange(item, placement);
  const spanHours = (range.endMinutes - range.startMinutes) / 60;
  const h = Math.max(56, spanHours * PX_PER_HOUR);
  const rawY = yFromTime(time);
  const y = Number.isFinite(minTopFloor) ? Math.max(rawY, minTopFloor) : rawY;
  const typeLabel = formatTypeLabel(item.type);
  const durationLabel = formatDurationHoursLong(spanHours);
  const activeCity = state.arrangeCity;
  const isLocked = (state.lastFinalizeLocks[activeCity] || []).some((e) => String(e.activity.id) === String(item.id));
  const lockBadge = isLocked ? '<span class="placed-lock-badge" title="Locked"><i class="ph-bold ph-lock-simple" aria-hidden="true"></i></span>' : '';
  const timeRangeLabel = formatTimeRangeLabel(range.startMinutes, range.endMinutes);
  return `
    <article class="placed-card ${colorClass}${isLocked ? ' placed-card--locked' : ''}" data-id="${item.id}" style="height:${h}px;top:${y}px;">
      ${lockBadge}
      <div class="placed-body">
        <button type="button" class="placed-time" data-edit-time="${item.id}" aria-label="Edit timing">
          <i class="ph-bold ph-clock" aria-hidden="true"></i>
          <span>${esc(timeRangeLabel)}</span>
        </button>
        <div class="placed-head-row">
          <h4>
            <button
              type="button"
              class="activity-icon activity-icon-wrap placed-info-wrap"
              aria-label="Activity details"
              data-tooltip-name="${esc(item.name)}"
              data-tooltip-type-icon="${esc(icon)}"
              data-tooltip-type="${esc(typeLabel)}"
              data-tooltip-duration="${esc(durationLabel)}"
              data-tooltip-why="${esc(item.why_it_fits || '')}"
              data-tooltip-start-location="${esc(actAddress(item))}"
            >${icon}</button>
            <span class="activity-name">${esc(item.name)}</span>
          </h4>
        </div>
      </div>
    </article>
  `;
}

const COMMUTE_MODE_PHOSPHOR = {
  transit: '<i class="ph-bold ph-train" aria-hidden="true"></i>',
  driving: '<i class="ph-bold ph-car" aria-hidden="true"></i>',
  walking: '<i class="ph-bold ph-person-simple-walk" aria-hidden="true"></i>'
};

function renderCommuteSelector(fromId, toId, y) {
  const commute = state.commutes[commutePairKey(fromId, toId)] || null;
  if (!commute) return '';

  if (commute.isWalkingDistance) {
    const mins = resolveSelectedCommuteDetails(commute)?.durationMinutes;
    const label = Number.isFinite(mins) ? `${mins} min` : 'walk';
    return `
      <div class="commute-indicator" style="top:${y}px;">
        <div class="commute-selector commute-selector--static">
          <span class="commute-selector-trigger">
            <span class="commute-selected-label">${COMMUTE_MODE_PHOSPHOR.walking} <span>${label}</span></span>
          </span>
        </div>
      </div>
    `;
  }

  const selected = resolveSelectedCommuteDetails(commute);
  if (!selected || !Number.isFinite(selected.durationMinutes)) return '';

  const options = COMMUTE_MODE_ORDER
    .map((mode) => {
      const option = commute?.modes?.[mode];
      if (!option) return '';
      const dur = Number(option.durationMinutes);
      if (!Number.isFinite(dur) || dur <= 0) return '';
      const isActive = selected.selectedMode === mode;
      const icon = COMMUTE_MODE_PHOSPHOR[mode] || '';
      return `
        <button type="button" class="commute-option ${isActive ? 'active' : ''}" data-mode="${mode}">
          <span class="commute-option-label">${icon} <span>${esc(COMMUTE_MODE_LABEL[mode] || mode)} – ${Number(option.durationMinutes)} min</span></span>
          ${isActive ? '<span class="commute-option-check">✓</span>' : ''}
        </button>
      `;
    })
    .filter(Boolean)
    .join('');

  if (!options) return '';

  const triggerIcon = COMMUTE_MODE_PHOSPHOR[selected.selectedMode] || COMMUTE_MODE_PHOSPHOR.driving;
  const triggerLabel = commute && commute.isWalkingDistance
    ? `${COMMUTE_MODE_PHOSPHOR.walking} <span>walk</span>`
    : `${triggerIcon} <span>${selected.durationMinutes} min</span>`;

  return `
    <div class="commute-indicator" style="top:${y}px;">
      <div class="commute-selector" data-from-id="${esc(fromId)}" data-to-id="${esc(toId)}">
        <button type="button" class="commute-selector-trigger" aria-expanded="false">
          <span class="commute-selected-label">${triggerLabel}</span>
          <span class="commute-selector-arrow" aria-hidden="true">▾</span>
        </button>
        <div class="commute-selector-menu" role="menu">${options}</div>
      </div>
    </div>
  `;
}

function makeCommuteIndicator(currentItem, nextItem, currentTopOverride = null) {
  const placement = state.placements[currentItem.id] || {};
  const time = parseTimeTo24(placement.time || actPreferredTime(currentItem) || typeToTime(currentItem.type));
  const h = Math.max(56, actDurationHours(currentItem) * PX_PER_HOUR);
  const topY = Number.isFinite(currentTopOverride) ? currentTopOverride : yFromTime(time);
  return renderCommuteSelector(currentItem.id, nextItem.id, topY + h + 6);
}

function makeLogisticsCard(label, icon, time, subtitle = '', topOverride = null) {
  const y = Number.isFinite(topOverride) ? topOverride : yFromTime(time);
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
    result.isArrival = true;
    result.arrivalTime = String(logistics.arrival?.time || logistics.arrival?.customTime || '09:00');
    result.arrivalLocation = String(logistics.arrival?.location || '').trim();
    result.arrivalMode = String(logistics.arrival?.mode || 'flight');
    result.arrivalInternational = Boolean(logistics.arrival?.international);
  }
  if (dateStr === departureDate) {
    result.isDeparture = true;
    result.departureTime = String(logistics.departure?.time || logistics.departure?.customTime || '18:00');
    result.departureLocation = String(logistics.departure?.location || '').trim();
    result.departureMode = String(logistics.departure?.mode || 'flight');
    result.departureInternational = Boolean(logistics.departure?.international);
  }
  return result;
}

function getAccommodationLabel(cityName, date) {
  const acc = getAccommodationForCity(cityName);
  const raw = String(acc?.address || '').trim();
  if (!raw) return 'Accommodation';
  const short = raw.split(',')[0].trim();
  return short || raw;
}

// citySlug, logistics*Id provided by /js/arrangeView.js

function buildLogisticsPseudoActivities(cityObj, date, cityName) {
  if (!cityObj) return { arrival: null, departure: null };
  const logistics = cityObj.logistics || {};
  const arrivalDate = String(logistics.arrival?.date || cityObj.startDate || '').slice(0, 10);
  const departureDate = String(logistics.departure?.date || cityObj.endDate || '').slice(0, 10);
  const dateStr = String(date || '').slice(0, 10);
  const acc = getAccommodationForCity(cityName);
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
  // Server-owned end wins; manual edits drop it and fall back to the duration model.
  const serverEnd = placement.endTime ? minutesFromTime(parseTimeTo24(placement.endTime)) : null;
  if (Number.isFinite(serverEnd) && serverEnd > startMinutes) {
    return { startMinutes, endMinutes: serverEnd };
  }
  const durationMinutes = Math.max(30, actDurationHours(activity) * 60);
  return {
    startMinutes,
    endMinutes: startMinutes + durationMinutes
  };
}

// rangesOverlap provided by /js/arrangeView.js

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
      sendDebug('overlap', {
        kind: 'window-violation',
        activity: dropped.name,
        droppedRange,
        dayStartMinutes,
        dayEndMinutes,
        cityArrival: city?.travelTiming?.arrivalAvailableTime,
        cityLeave: city?.travelTiming?.departureMustLeaveTime || city?.leaveTime,
        date: day.date,
        cityStart: city?.startDate,
        cityEnd: city?.endDate
      });
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

const HOTEL_CHECKIN_MIN = 30;

function transitMinsForCommutePair(fromId, toId, fallbackMode) {
  const commute = state.commutes[commutePairKey(fromId, toId)] || null;
  const mins = resolveSelectedCommuteDetails(commute)?.durationMinutes;
  if (Number.isFinite(mins)) return mins;
  return TRANSIT_FALLBACK_MINS[fallbackMode] ?? 30;
}

function logisticsAnchorsForCityDay(cityPlan, date) {
  if (!cityPlan || !date) return [];
  const logistics = cityPlan.logistics || {};
  const anchors = [];
  const cityName = cityPlan.name;

  if (cityPlan.startDate === date && logistics.arrival?.time) {
    const arrStart = minutesFromTime(logistics.arrival.time);
    const buf = arrivalBufferMins(logistics.arrival.mode, logistics.arrival.international);
    const transit = transitMinsForCommutePair(logisticsArrivalId(cityName), logisticsAccommodationArrivalId(cityName), logistics.arrival.mode);
    anchors.push({
      kind: 'arrival',
      start: arrStart,
      end: arrStart + buf + transit,
      name: `Arrive: ${logistics.arrival.location || 'arrival'}`
    });
    anchors.push({
      kind: 'acc-arrival',
      start: arrStart + buf + transit,
      end: arrStart + buf + transit + HOTEL_CHECKIN_MIN,
      name: getAccommodationLabel(cityName, date) || 'Accommodation check-in'
    });
  }

  if (cityPlan.endDate === date && logistics.departure?.time) {
    const depEnd = minutesFromTime(logistics.departure.time);
    const buf = departureBufferMins(logistics.departure.mode, logistics.departure.international);
    const transit = transitMinsForCommutePair(logisticsAccommodationDepartureId(cityName), logisticsDepartureId(cityName), logistics.departure.mode);
    const accStart = Math.max(0, depEnd - buf - transit - HOTEL_CHECKIN_MIN);
    anchors.push({
      kind: 'acc-departure',
      start: accStart,
      end: accStart + HOTEL_CHECKIN_MIN,
      name: getAccommodationLabel(cityName, date) || 'Accommodation checkout'
    });
    anchors.push({
      kind: 'departure',
      start: Math.max(0, depEnd - buf - transit),
      end: depEnd,
      name: `Depart: ${logistics.departure.location || 'departure'}`
    });
  }

  return anchors;
}

function blockedBandsForDay(dayId, draggingActivityId) {
  const day = state.days.find((d) => d.id === dayId);
  const city = day ? state.cities.find((c) => cityMatches(c.name, day.city)) : null;
  if (!day) return { dayStart: DAY_START_HOUR * 60, dayEnd: DAY_END_HOUR * 60, blocks: [] };

  const dayStart = city ? getCityDayWindowStart(city, day.date) : DAY_START_HOUR * 60;
  const dayEnd = city ? getCityDayWindowEnd(city, day.date) : DAY_END_HOUR * 60;

  const blocks = [];
  for (const a of state.activities) {
    if (String(a.id) === String(draggingActivityId)) continue;
    if (!state.reviewed[a.id]?.approved) continue;
    if (state.placements[a.id]?.dayId !== dayId) continue;
    const r = getPlacementTimeRange(a);
    blocks.push({ start: r.startMinutes, end: r.endMinutes, name: a.name, kind: 'activity' });
  }
  for (const anchor of logisticsAnchorsForCityDay(city, day.date)) {
    blocks.push({ start: anchor.start, end: anchor.end, name: anchor.name, kind: anchor.kind });
  }
  blocks.sort((a, b) => a.start - b.start);
  return { dayStart, dayEnd, blocks };
}

function bandStyle(startMin, endMin) {
  const top = (startMin - DAY_START_HOUR * 60) * PX_PER_HOUR / 60;
  const height = Math.max(2, (endMin - startMin) * PX_PER_HOUR / 60);
  return `top:${top}px;height:${height}px;`;
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
          const orderedActivities = activitiesOnDay(dayId);
          const pairIndex = orderedActivities.findIndex((a, index) => index > 0 && orderedActivities[index - 1].id === fromId && a.id === toId);
          recalculateDayFromIndex(dayId, pairIndex === -1 ? 1 : pairIndex);
        }

        renderArrange();
      });
    });
  });

  document.addEventListener('click', closeAllCommuteMenus, { once: true });
}

const ARRANGE_BUFFER_MIN = 30;
const ARRANGE_SNAP_MIN = 15;
let _arrangeDragState = null;
let _arrangeDragListenersBound = false;

function renderArrange() {
  if (_arrangeDragState) cancelArrangeDrag();

  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  const cityGroups = getArrangeCities();
  renderArrangeCityNav(cityGroups);
  renderArrangeDiagnostics();
  updateFinalizeBtn();

  const activeCity = state.arrangeCity;
  const activeDays = state.days.filter((d) => cityMatches(d.city, activeCity));

  const unplaced = approved.filter((a) => cityMatches(a.city, activeCity) && !state.placements[a.id]?.dayId);
  els.stagingArea.innerHTML = unplaced.length
    ? unplaced.map(makeStagingCard).join('')
    : '<div class="staging__empty">All activities placed.</div>';
  const stagingCountEl = document.getElementById('stagingCount');
  if (stagingCountEl) stagingCountEl.textContent = String(unplaced.length);

  els.dayColumns.innerHTML = activeDays.map((d) => {
    const dt = parseYmdAsLocal(d.date);
    const label = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const dayCount = approved.filter((a) => state.placements[a.id]?.dayId === d.id).length;
    const dayHours = approved
      .filter((a) => state.placements[a.id]?.dayId === d.id)
      .reduce((sum, a) => sum + actDurationHours(a), 0);
    const dayPill = `<span class="day-head__pill">${dayCount} · ${dayHours.toFixed(1)}h</span>`;
    const hourLines = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => {
      const hour = DAY_START_HOUR + i;
      const y = i * PX_PER_HOUR;
      const labelHour = new Date(2020, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' }).toLowerCase();
      return `<div class="hour-line" style="top:${y}px"><span>${labelHour}</span></div>`;
    }).join('');
    return `
      <section class="day-col schedule-col" data-day="${d.id}">
        <div class="day-head"><div class="day-head__main"><div>${label}</div><small>${esc(d.city)}</small></div>${dayPill}</div>
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
      .filter((a) => state.placements[a.id]?.dayId === d.id && cityMatches(a.city, d.city))
      .sort(byScheduledTime);

    const cityObj = state.cities.find((c) => cityMatches(c.name, d.city));
    const dayLogistics = getLogisticsForDay(cityObj, d.date);
    const accLabel = getAccommodationLabel(d.city, d.date);
    const arrId = logisticsArrivalId(d.city);
    const depId = logisticsDepartureId(d.city);
    const arrAccId = logisticsAccommodationArrivalId(d.city);
    const depAccId = logisticsAccommodationDepartureId(d.city);
    const cardH = getLogisticsCardHeight();

    let html = '';
    const PILL_RESERVE = 44;
    let prevBottom = -Infinity;

    if (dayLogistics?.isArrival) {
      const arrivalLabel = dayLogistics.arrivalLocation || 'Arrival';
      // 1. Arrival location card
      html += makeLogisticsCard(`Arrive: ${arrivalLabel}`, '<i class="ph-bold ph-airplane-landing" aria-hidden="true"></i>', dayLogistics.arrivalTime);
      // 2. Commute: arrival → accommodation
      html += makeLogisticsCommuteIndicator(arrId, arrAccId, dayLogistics.arrivalTime, cardH);
      // 3. Accommodation card (positioned after arrival + procedural buffer + commute)
      const arrToAccCommute = state.commutes[commutePairKey(arrId, arrAccId)] || null;
      const arrToAccMins = resolveSelectedCommuteDetails(arrToAccCommute)?.durationMinutes || 0;
      const procBuf = arrivalBufferMins(dayLogistics.arrivalMode, dayLogistics.arrivalInternational);
      const accArrivalMins = minutesFromTime(dayLogistics.arrivalTime) + procBuf + arrToAccMins;
      const accArrivalTime = timeFromMinutes(accArrivalMins);
      html += makeLogisticsCard(accLabel, '<i class="ph-bold ph-bed" aria-hidden="true"></i>', accArrivalTime);
      // Seed the flow cursor at the accommodation card's bottom so the first
      // activity (and the commute pill below) can't overlap the arrival block.
      prevBottom = yFromTime(accArrivalTime) + cardH;
      // 4. Commute: accommodation → first activity (positioned from the flow cursor)
      if (items.length > 0) {
        html += renderCommuteSelector(arrAccId, items[0].id, prevBottom + 6);
      }
    }

    items.forEach((item, index) => {
      const placement = state.placements[item.id] || {};
      const itemTime = parseTimeTo24(placement.time || actPreferredTime(item) || typeToTime(item.type));
      const range = getPlacementTimeRange(item, placement);
      const itemH = Math.max(56, ((range.endMinutes - range.startMinutes) / 60) * PX_PER_HOUR);
      const rawY = yFromTime(itemTime);
      const topFloor = prevBottom + PILL_RESERVE;
      const effectiveTop = Math.max(rawY, topFloor);
      html += makePlacedCard(item, effectiveTop);
      if (index < items.length - 1) {
        html += makeCommuteIndicator(item, items[index + 1], effectiveTop);
      }
      prevBottom = effectiveTop + itemH;
    });

    if (dayLogistics?.isDeparture) {
      const departureLabel = dayLogistics.departureLocation || 'Departure';
      // 1. Commute: last activity → accommodation (positioned from the flow cursor
      // so it sits below the actual last card, not its raw time).
      if (items.length > 0) {
        html += renderCommuteSelector(items[items.length - 1].id, depAccId, prevBottom + 6);
        prevBottom += 6 + PILL_RESERVE;
      }
      // 2. Accommodation card (before departure - procedural buffer - commute, floored below the cursor)
      const accToDepCommute = state.commutes[commutePairKey(depAccId, depId)] || null;
      const accToDepMins = resolveSelectedCommuteDetails(accToDepCommute)?.durationMinutes || 0;
      const depProcBuf = departureBufferMins(dayLogistics.departureMode, dayLogistics.departureInternational);
      const accDepartureMins = minutesFromTime(dayLogistics.departureTime) - depProcBuf - accToDepMins;
      const accDepartureTime = timeFromMinutes(Math.max(0, accDepartureMins));
      const accDepTop = Math.max(yFromTime(accDepartureTime), prevBottom);
      html += makeLogisticsCard(accLabel, '<i class="ph-bold ph-bed" aria-hidden="true"></i>', accDepartureTime, '', accDepTop);
      const accDepBottom = accDepTop + cardH;
      // 3. Commute: accommodation → departure
      html += renderCommuteSelector(depAccId, depId, accDepBottom + 6);
      // 4. Departure location card (floored below the commute pill)
      const depTop = Math.max(yFromTime(dayLogistics.departureTime), accDepBottom + PILL_RESERVE);
      html += makeLogisticsCard(`Depart: ${departureLabel}`, '<i class="ph-bold ph-airplane-takeoff" aria-hidden="true"></i>', dayLogistics.departureTime, '', depTop);
    }

    schedule.innerHTML = html;
  });

  bindCommuteInteractions();
  bindArrangeDrag();
  bindPlacedCardInteractions();
}

function isActivityLocked(id) {
  const activeCity = state.arrangeCity;
  return (state.lastFinalizeLocks[activeCity] || []).some((e) => String(e.activity.id) === String(id));
}

function arrangeDayBodies() {
  return Array.from(document.querySelectorAll('#dayColumns .day-grid-wrap'));
}

function dayIdFromGridWrap(el) {
  const sched = el.querySelector('.day-schedule');
  return sched ? sched.id.replace('schedule-', '') : null;
}

// Half-open overlap with ±BUFFER applied to every block.
function arrangeIsValidDrop(dayId, dragId, startMin, durMin) {
  const day = state.days.find((d) => d.id === dayId);
  if (!day) return false;
  const city = state.cities.find((c) => cityMatches(c.name, day.city));
  const dayStart = city ? getCityDayWindowStart(city, day.date) : DAY_START_HOUR * 60;
  const dayEnd = city ? getCityDayWindowEnd(city, day.date) : DAY_END_HOUR * 60;
  if (startMin < dayStart || startMin + durMin > dayEnd) return false;

  const { blocks } = blockedBandsForDay(dayId, dragId);
  const aStart = startMin;
  const aEnd = startMin + durMin;
  for (const b of blocks) {
    const bStart = b.start - ARRANGE_BUFFER_MIN;
    const bEnd = b.end + ARRANGE_BUFFER_MIN;
    if (aStart < bEnd && bStart < aEnd) return false;
  }
  return true;
}

function snapMinutesToGrid(mins) {
  const step = ARRANGE_SNAP_MIN;
  return Math.round(mins / step) * step;
}

function arrangeDragDurationMin(activityId) {
  const a = state.activities.find((x) => String(x.id) === String(activityId));
  if (!a) return 60;
  return Math.max(ARRANGE_SNAP_MIN, Math.round(actDurationHours(a) * 60));
}

function pickupAllowed(target) {
  if (!target) return false;
  if (target.closest('.placed-time, .commute-selector, .commute-selector-trigger, .commute-indicator, .activity-icon-wrap, .placed-info-wrap')) return false;
  return true;
}

let _arrangeDragBound = false;
function bindArrangeDrag() {
  if (_arrangeDragBound) return;
  const stagingArea = els.stagingArea;
  const dayColumns = els.dayColumns;
  if (!stagingArea || !dayColumns) return;
  _arrangeDragBound = true;

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const card = e.target.closest('.staging-card, .placed-card');
    if (!card) return;
    if (card.classList.contains('placed-card--locked')) return;
    if (!pickupAllowed(e.target)) return;

    // Allow resize gesture on .placed-card top/bottom edge to win.
    if (card.classList.contains('placed-card')) {
      const r = card.getBoundingClientRect();
      const RESIZE_EDGE_PX = 14;
      if (e.clientY <= r.top + RESIZE_EDGE_PX || e.clientY >= r.bottom - RESIZE_EDGE_PX) return;
    }

    const id = card.dataset.id;
    if (!id) return;
    if (isActivityLocked(id)) return;
    const item = state.activities.find((a) => String(a.id) === String(id));
    if (!item) return;

    const isStaging = card.classList.contains('staging-card');
    const srcDayId = isStaging ? '__staging' : (card.closest('.day-schedule')?.id.replace('schedule-', '') || null);
    const cardRect = card.getBoundingClientRect();
    const durMin = arrangeDragDurationMin(id);

    e.preventDefault();
    startArrangeDrag({
      id,
      srcDayId,
      item,
      offsetY: isStaging ? 8 : (e.clientY - cardRect.top),
      w: cardRect.width,
      h: Math.max(56, durMin * PX_PER_HOUR / 60),
      durMin,
      ptrX: e.clientX,
      ptrY: e.clientY,
      cardEl: card
    });
  };

  stagingArea.addEventListener('pointerdown', onPointerDown);
  dayColumns.addEventListener('pointerdown', onPointerDown);
}

function startArrangeDrag(drag) {
  if (_arrangeDragState) teardownArrangeDrag();
  document.getElementById('arrange-drag-ghost')?.remove();
  _arrangeDragState = { ...drag, dropTarget: null, rafPending: false };
  drag.cardEl?.classList.add('is-dragging');
  document.body.classList.add('is-dragging-activity');

  // Mark every day-grid-wrap as drag-active so overlays render.
  arrangeDayBodies().forEach((wrap) => wrap.classList.add('drag-active'));

  // Render persistent blocked-range overlays (one set per day, updated only on render).
  renderArrangeBlockedRanges(drag.id);

  // Floating ghost.
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.id = 'arrange-drag-ghost';
  const { icon, colorClass } = getActivityStyle(drag.item.type);
  ghost.innerHTML = `
    <div class="drag-ghost__inner ${colorClass}">
      <div class="drag-ghost__time">drop on a day…</div>
      <div class="drag-ghost__title"><span class="drag-ghost__icon">${icon}</span><span>${esc(drag.item.name)}</span></div>
    </div>`;
  document.body.appendChild(ghost);
  positionGhost(drag);

  if (!_arrangeDragListenersBound) {
    window.addEventListener('pointermove', onArrangePointerMove, true);
    window.addEventListener('pointerup', onArrangePointerUp, true);
    window.addEventListener('pointercancel', cancelArrangeDrag, true);
    window.addEventListener('keydown', onArrangeKeyDown, true);
    _arrangeDragListenersBound = true;
  }
}

function positionGhost(drag) {
  const ghost = document.getElementById('arrange-drag-ghost');
  if (!ghost) return;
  ghost.style.left = `${drag.ptrX + 8}px`;
  ghost.style.top = `${drag.ptrY - (drag.offsetY || 0)}px`;
  ghost.style.height = `${drag.h}px`;
  ghost.style.width = `${Math.min(260, drag.w || 220)}px`;
}

function renderArrangeBlockedRanges(dragId) {
  arrangeDayBodies().forEach((wrap) => {
    const dayId = dayIdFromGridWrap(wrap);
    if (!dayId) return;
    let layer = wrap.querySelector('.blocked-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'blocked-layer';
      wrap.appendChild(layer);
    }
    const { dayStart, dayEnd, blocks } = blockedBandsForDay(dayId, dragId);
    const dayMin = DAY_START_HOUR * 60;
    const dayMax = DAY_END_HOUR * 60;
    const parts = [];
    if (dayStart > dayMin) parts.push(`<div class="blocked-out" style="${bandStyle(dayMin, dayStart)}"></div>`);
    if (dayEnd < dayMax) parts.push(`<div class="blocked-out" style="${bandStyle(dayEnd, dayMax)}"></div>`);
    for (const b of blocks) {
      const coreStart = Math.max(dayStart, b.start);
      const coreEnd = Math.min(dayEnd, b.end);
      const bufBefore = Math.max(dayStart, b.start - ARRANGE_BUFFER_MIN);
      const bufAfter = Math.min(dayEnd, b.end + ARRANGE_BUFFER_MIN);
      if (bufBefore < coreStart) parts.push(`<div class="blocked-buffer" style="${bandStyle(bufBefore, coreStart)}"></div>`);
      if (coreEnd > coreStart) parts.push(`<div class="blocked-core" style="${bandStyle(coreStart, coreEnd)}"></div>`);
      if (bufAfter > coreEnd) parts.push(`<div class="blocked-buffer" style="${bandStyle(coreEnd, bufAfter)}"></div>`);
    }
    layer.innerHTML = parts.join('');
  });
}

function clearArrangeBlockedRanges() {
  arrangeDayBodies().forEach((wrap) => {
    wrap.classList.remove('drag-active', 'drop-target');
    const layer = wrap.querySelector('.blocked-layer');
    if (layer) layer.remove();
    const indicator = wrap.querySelector('.drop-indicator');
    if (indicator) indicator.remove();
  });
}

function onArrangePointerMove(e) {
  if (!_arrangeDragState) return;
  _arrangeDragState.ptrX = e.clientX;
  _arrangeDragState.ptrY = e.clientY;
  if (_arrangeDragState.rafPending) return;
  _arrangeDragState.rafPending = true;
  requestAnimationFrame(() => {
    if (!_arrangeDragState) return;
    _arrangeDragState.rafPending = false;
    updateArrangeDropTarget();
    positionGhost(_arrangeDragState);
    updateArrangeGhostLabel();
  });
}

function updateArrangeDropTarget() {
  const drag = _arrangeDragState;
  if (!drag) return;
  let found = null;
  for (const wrap of arrangeDayBodies()) {
    const r = wrap.getBoundingClientRect();
    if (drag.ptrX >= r.left && drag.ptrX <= r.right && drag.ptrY >= r.top && drag.ptrY <= r.bottom) {
      const dayId = dayIdFromGridWrap(wrap);
      if (!dayId) break;
      const yInside = drag.ptrY - r.top - (drag.offsetY || 0);
      const cursorMin = (DAY_START_HOUR * 60) + (yInside * 60 / PX_PER_HOUR);
      const snapped = snapMinutesToGrid(cursorMin);
      const valid = arrangeIsValidDrop(dayId, drag.id, snapped, drag.durMin);
      found = { dayId, startMin: snapped, valid, wrap };
      break;
    }
  }
  drag.dropTarget = found;

  // Update DOM: drop-target highlight + indicator per day.
  arrangeDayBodies().forEach((wrap) => {
    const isTarget = found && wrap === found.wrap;
    wrap.classList.toggle('drop-target', isTarget && found.valid);
    let indicator = wrap.querySelector('.drop-indicator');
    if (!isTarget) {
      if (indicator) indicator.remove();
      return;
    }
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      wrap.appendChild(indicator);
    }
    const top = (found.startMin - DAY_START_HOUR * 60) * PX_PER_HOUR / 60;
    indicator.style.top = `${top}px`;
    indicator.style.height = `${Math.max(34, drag.durMin * PX_PER_HOUR / 60)}px`;
    indicator.classList.toggle('invalid', !found.valid);
    const label = formatTimeRangeLabel(found.startMin, found.startMin + drag.durMin);
    indicator.dataset.time = found.valid ? label : `${label} · busy`;
  });
}

function updateArrangeGhostLabel() {
  const ghost = document.getElementById('arrange-drag-ghost');
  if (!ghost || !_arrangeDragState) return;
  const timeEl = ghost.querySelector('.drag-ghost__time');
  if (!timeEl) return;
  const t = _arrangeDragState.dropTarget;
  if (!t) { timeEl.textContent = 'drop on a day…'; timeEl.classList.remove('invalid'); return; }
  if (!t.valid) { timeEl.textContent = "can't drop here — busy"; timeEl.classList.add('invalid'); return; }
  timeEl.textContent = formatTimeRangeLabel(t.startMin, t.startMin + _arrangeDragState.durMin);
  timeEl.classList.remove('invalid');
}

function onArrangeKeyDown(e) {
  if (e.key === 'Escape' && _arrangeDragState) {
    e.preventDefault();
    cancelArrangeDrag();
  }
}

function teardownArrangeDrag() {
  const drag = _arrangeDragState;
  if (drag?.cardEl) drag.cardEl.classList.remove('is-dragging');
  document.body.classList.remove('is-dragging-activity');
  document.getElementById('arrange-drag-ghost')?.remove();
  clearArrangeBlockedRanges();
  if (_arrangeDragListenersBound) {
    window.removeEventListener('pointermove', onArrangePointerMove, true);
    window.removeEventListener('pointerup', onArrangePointerUp, true);
    window.removeEventListener('pointercancel', cancelArrangeDrag, true);
    window.removeEventListener('keydown', onArrangeKeyDown, true);
    _arrangeDragListenersBound = false;
  }
  _arrangeDragState = null;
}

function cancelArrangeDrag() {
  teardownArrangeDrag();
}

function onArrangePointerUp() {
  const drag = _arrangeDragState;
  if (!drag) return;
  const target = drag.dropTarget;
  const srcDayId = drag.srcDayId;

  // Outside any day -> return to staging (only if it was placed).
  if (!target) {
    if (srcDayId && srcDayId !== '__staging') {
      state.placements[drag.id] = { dayId: null, time: null };
      teardownArrangeDrag();
      renderArrange();
      updateCommutesForCityDays([srcDayId]).then(() => renderArrange()).catch(() => {});
      return;
    }
    teardownArrangeDrag();
    return;
  }

  if (!target.valid) {
    teardownArrangeDrag();
    return;
  }

  const newTime = timeFromMinutes(target.startMin);
  const prevDayId = srcDayId === '__staging' ? null : srcDayId;
  const prevTime = state.placements[drag.id]?.time || null;
  state.placements[drag.id] = { dayId: target.dayId, time: newTime };

  teardownArrangeDrag();

  if (prevDayId === target.dayId && prevTime === newTime) {
    renderArrange();
    return;
  }

  renderArrange();
  const affectedDays = [target.dayId, prevDayId].filter((v, i, arr) => v && arr.indexOf(v) === i);
  updateCommutesForCityDays(affectedDays).then(() => renderArrange()).catch(() => {});
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

  const orderedActivities = activitiesOnDay(dayId);

  orderedActivities.forEach((activity) => {
    const isDepartureActivity = /\b(depart|departure)\b/i.test(String(activity.name || ''));
    if (isDepartureActivity && city.endDate === day.date) {
      state.placements[activity.id] = { dayId, time: timeFromMinutes(dayEndMinutes) };
      return;
    }

    const durationMinutes = Math.max(30, actDurationHours(activity) * 60);
    const currentStart = minutesFromTime(parseTimeTo24(state.placements[activity.id]?.time || actPreferredTime(activity) || typeToTime(activity.type)));
    const latestStart = Math.max(dayStartMinutes, dayEndMinutes - durationMinutes);
    const boundedStart = Math.max(dayStartMinutes, Math.min(currentStart, latestStart));
    state.placements[activity.id] = { dayId, time: timeFromMinutes(boundedStart) };
  });
}

// Accommodation is a property of the city, not of a day within it. This took a `date` argument at
// every call site and discarded it, which documented a per-day model the code does not implement.
function getAccommodationForCity(cityName) {
  const city = state.cities.find((c) => cityMatches(c.name, cityName));
  return city?.accommodation?.address ? city.accommodation : null;
}

function recalculateDayFromIndex(dayId, startIndex = 1) {
  if (!dayId) return;
  const orderedActivities = activitiesOnDay(dayId);

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

    state.placements[current.id] = { dayId, time: timeFromMinutes(Math.max(currentStart, minByTravel)) };
  }

  enforceDayTimeBoundaries(dayId);
}

async function updateCommutesForCityDays(dayIds = []) {
  for (const dayId of dayIds) {
    const day = state.days.find((d) => d.id === dayId);
    if (!day) continue;
    const accommodation = getAccommodationForCity(day.city);
    const accommodationLocation = String(accommodation?.address || '').trim();
    const orderedActivities = activitiesOnDay(dayId);

    const cityObj = state.cities.find((c) => cityMatches(c.name, day.city));
    const { arrival, arrivalAccommodation, departure, departureAccommodation } = buildLogisticsPseudoActivities(cityObj, day.date, day.city);
    const payloadActivities = orderedActivities.map((a) => ({
      id: a.id, name: a.name, city: a.city,
      location: a.location,
      start_location: actAddress(a),
      end_location: actAddress(a),
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
  const unplaced = state.arrangeUnplaced[activeCity] || [];

  let html = '';
  if (unplaced.length) {
    const open = state.arrangeUnplacedPanelOpen ? ' is-open' : '';
    html += `<button type="button" class="unplaced-chip${open}" data-unplaced-toggle aria-expanded="${state.arrangeUnplacedPanelOpen ? 'true' : 'false'}">
      <i class="ph-bold ph-warning-circle" aria-hidden="true"></i> Unplaced (${unplaced.length})
    </button>`;
    if (state.arrangeUnplacedPanelOpen) {
      html += `<div class="unplaced-panel">
        <p class="unplaced-panel-hint">The planner couldn't fit these into your schedule. Click one to find it in the staging strip, then drag it into a day.</p>
        <ul>${unplaced.map((u) => `
          <li>
            <button type="button" class="unplaced-item" data-unplaced-id="${esc(u.id)}">
              <span class="unplaced-item-name">${esc(u.name)}</span>
            </button>
          </li>`).join('')}</ul>
      </div>`;
    }
  }
  if (!html) {
    html = '<p>Auto-arrange uses durations, category defaults, and opening hours to place activities.</p>';
  }
  els.arrangeDiagnostics.innerHTML = html;

  els.arrangeDiagnostics.querySelector('[data-unplaced-toggle]')?.addEventListener('click', () => {
    state.arrangeUnplacedPanelOpen = !state.arrangeUnplacedPanelOpen;
    renderArrangeDiagnostics();
  });
  els.arrangeDiagnostics.querySelectorAll('[data-unplaced-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.unplacedId;
      const card = els.stagingArea?.querySelector(`.staging-card[data-id="${CSS.escape(id)}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      card.classList.add('staging-card--flash');
      setTimeout(() => card.classList.remove('staging-card--flash'), 1600);
    });
  });
}

function findLockedOverlaps(locked) {
  const intervals = locked.map((entry) => {
    const duration = entry.activity.timing?.duration_minutes || actDurationHours(entry.activity) * 60 || 60;
    const startMin = minutesFromTime(entry.time);
    return { id: entry.activity.id, name: entry.activity.name, date: entry.date, startMin, endMin: startMin + duration };
  });
  const conflicts = [];
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i];
      const b = intervals[j];
      if (a.date === b.date && a.startMin < b.endMin && b.startMin < a.endMin) {
        conflicts.push([a, b]);
      }
    }
  }
  return conflicts;
}

function updateFinalizeBtn() {
  if (!els.finalizeArrangeBtn) return;
  const activeCity = state.arrangeCity;
  const approved = state.activities.filter((a) => state.reviewed[a.id]?.approved);
  const approvedInCity = activeCity
    ? approved.filter((a) => cityMatches(a.city, activeCity))
    : approved;
  const approvedIds = new Set(approvedInCity.map((a) => String(a.id)));
  const hasVerified = (state.bookingChecklist || []).some(
    (item) => item.type === 'activity' && item.verified && approvedIds.has(String(item.activityId))
  );
  const hasFixed = approvedInCity.some((a) => a.timing?.fixed?.date && a.timing?.fixed?.time);
  els.finalizeArrangeBtn.disabled = !(hasVerified || hasFixed);
}

function openFinalizeModal() {
  const activeCity = state.arrangeCity;
  if (!activeCity) return;

  const approved = state.activities
    .filter((a) => state.reviewed[a.id]?.approved && cityMatches(a.city, activeCity))
    .map((a) => normalizeActivityMetadata(a));

  const activeDays = state.days
    .filter((d) => cityMatches(d.city, activeCity))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Build initial lockedSet from timing.fixed + verified checklist
  const lockedSet = [];
  for (const activity of approved) {
    const fixed = activity.timing?.fixed;
    if (fixed?.date && fixed?.time) {
      lockedSet.push({ activity, date: fixed.date, time: fixed.time, sourceKind: 'fixed', checked: true });
      continue;
    }
    const item = (state.bookingChecklist || []).find(
      (c) => c.type === 'activity' && c.verified && String(c.activityId) === String(activity.id)
    );
    if (item?.activityDate && item?.activityTime) {
      const endOverride = item.activityEndTime ? parseTimeTo24(item.activityEndTime) : '';
      lockedSet.push({ activity, date: item.activityDate, time: parseTimeTo24(item.activityTime), endOverride, sourceKind: 'verified', checked: true });
    } else {
      const placement = state.placements[activity.id];
      const day = placement?.dayId ? state.days.find((d) => d.id === placement.dayId) : activeDays[0];
      lockedSet.push({ activity, date: day?.date || activeDays[0]?.date || '', time: parseTimeTo24(placement?.time || actPreferredTime(activity) || typeToTime(activity.type)), sourceKind: item ? 'verified' : 'none', checked: false });
    }
  }

  function deriveEndTime(entry) {
    if (entry.endOverride) return entry.endOverride;
    const durMins = entry.activity.timing?.duration_minutes || actDurationHours(entry.activity) * 60 || 60;
    const totalMins = minutesFromTime(entry.time) + durMins;
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // State for the modal (mutable during interaction)
  const modalState = lockedSet.map((e) => ({ ...e, endTime: deriveEndTime(e), expanded: false }));

  function renderRows() {
    const byDate = {};
    for (const day of activeDays) byDate[day.date] = [];
    for (const entry of modalState) {
      if (!byDate[entry.date]) byDate[entry.date] = [];
      byDate[entry.date].push(entry);
    }
    const dayRows = activeDays.map((day) => {
      const entries = (byDate[day.date] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const rowsHtml = entries.map((entry) => {
        const globalIdx = modalState.indexOf(entry);
        const checkedClass = entry.checked ? ' cl-item--checked' : '';
        const meta = entry.sourceKind === 'verified' ? 'from checklist' : entry.sourceKind === 'fixed' ? 'fixed time' : '';
        const why = entry.activity.why_it_fits || '';
        const pitfall = entry.activity.pitfall || '';
        const insiderTips = entry.activity.insider_tips || '';
        const notes = state.reviewed[entry.activity.id]?.notes || '';
        return `
          <div class="cl-item${checkedClass} finalize-item" data-idx="${globalIdx}">
            <div class="cl-item-collapsed" data-cl-collapse-row>
              <button type="button" class="cl-checkbox ${entry.checked ? 'checked' : ''}" aria-label="Lock this activity" aria-pressed="${entry.checked}" data-finalize-check>
                ${entry.checked ? '<i class="ph-bold ph-check" aria-hidden="true"></i>' : ''}
              </button>
              <div class="cl-item-text">
                <span class="cl-item-name">${esc(entry.activity.name)}</span>
                ${meta ? `<span class="cl-item-meta">${esc(meta)}</span>` : ''}
              </div>
              <input type="time" class="finalize-time finalize-time-start" value="${entry.time}" data-finalize-time="start" />
              <span class="finalize-time-sep">–</span>
              <input type="time" class="finalize-time finalize-time-end" value="${entry.endTime}" data-finalize-time="end" />
              <i class="ph-bold ${entry.expanded ? 'ph-caret-up' : 'ph-caret-down'} cl-item-chevron" aria-hidden="true"></i>
            </div>
            ${entry.expanded ? `
              <div class="cl-item-expanded-wrap finalize-expanded">
                ${why ? `<p class="finalize-exp-line"><strong>Why it fits:</strong> ${esc(why)}</p>` : ''}
                ${pitfall ? `<p class="finalize-exp-line"><strong>Pitfall:</strong> ${esc(pitfall)}</p>` : ''}
                ${insiderTips ? `<p class="finalize-exp-line activity-insider-tip"><i class="ph-bold ph-lightbulb" aria-hidden="true"></i> <strong>Insider tip:</strong> ${esc(insiderTips)}</p>` : ''}
                ${notes ? `<p class="finalize-exp-line"><strong>Notes:</strong> ${esc(notes)}</p>` : ''}
              </div>` : ''}
          </div>`;
      }).join('');
      return `<div class="finalize-day-group"><div class="finalize-day-label">${esc(dateLabel)}</div>${rowsHtml}</div>`;
    }).join('');

    document.getElementById('finalizeRows').innerHTML = dayRows;
    document.querySelectorAll('#finalizeModal [data-cl-collapse-row]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-finalize-check]') || e.target.closest('[data-finalize-time]')) return;
        const idx = Number(row.closest('.finalize-item').dataset.idx);
        modalState[idx].expanded = !modalState[idx].expanded;
        renderRows();
      });
    });
    document.querySelectorAll('#finalizeModal [data-finalize-check]').forEach((cb) => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(cb.closest('.finalize-item').dataset.idx);
        modalState[idx].checked = !modalState[idx].checked;
        updateConflicts();
        renderRows();
      });
    });
    document.querySelectorAll('#finalizeModal [data-finalize-time]').forEach((inp) => {
      inp.addEventListener('click', (e) => e.stopPropagation());
      inp.addEventListener('change', () => {
        const idx = Number(inp.closest('.finalize-item').dataset.idx);
        if (inp.dataset.finalizeTime === 'start') {
          modalState[idx].time = inp.value;
        } else {
          modalState[idx].endTime = inp.value;
        }
        updateConflicts();
      });
    });
  }

  function updateConflicts() {
    const checked = modalState.filter((e) => e.checked);
    const conflicts = findLockedOverlaps(checked.map((e) => ({
      ...e,
      activity: { ...e.activity, timing: { ...(e.activity.timing || {}), duration_minutes: minutesFromTime(e.endTime) - minutesFromTime(e.time) } }
    })));
    const banner = document.getElementById('finalizeConflictBanner');
    const confirmBtn = document.getElementById('finalizeConfirmBtn');
    if (conflicts.length) {
      const msgs = conflicts.map(([a, b]) => `"${a.name}" and "${b.name}" overlap on ${a.date}`);
      banner.innerHTML = `<span class="finalize-conflict-icon">⚠️</span> ${msgs.map(esc).join('; ')}`;
      banner.hidden = false;
      confirmBtn.disabled = true;
    } else {
      banner.hidden = true;
      confirmBtn.disabled = false;
    }
  }

  async function onConfirm() {
    const checked = modalState.filter((e) => e.checked);
    // Persist inline time edits back to state
    for (const entry of checked) {
      if (entry.sourceKind === 'fixed') {
        entry.activity.timing.fixed = {
          date: entry.date,
          time: entry.time,
          reason: entry.activity.timing.fixed?.reason || ''
        };
        state.activities = state.activities.map((a) => (a.id === entry.activity.id ? entry.activity : a));
      } else if (entry.sourceKind === 'verified') {
        const item = (state.bookingChecklist || []).find(
          (c) => c.type === 'activity' && String(c.activityId) === String(entry.activity.id)
        );
        if (item) {
          item.activityDate = entry.date;
          item.activityTime = entry.time;
          item.activityEndTime = entry.endTime;
          syncChecklistDateTimeToPlacement(item);
        }
      }
    }
    saveSnapshot();
    closeModal();
    await autoArrangeActiveCity({ finalize: true, lockedSet: checked });
  }

  function closeModal() {
    document.getElementById('finalizeModal')?.remove();
    refreshOverlayInterlocks?.();
  }

  const existing = document.getElementById('finalizeModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'finalizeModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card finalize-modal-card" style="display:flex;flex-direction:column;padding:0;overflow:hidden;">
      <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:24px 24px 12px;flex:0 0 auto;">
        <h3 style="margin:0">Finalize Arrangement</h3>
        <button type="button" id="finalizeCloseBtn" class="icon-btn" aria-label="Close">✕</button>
      </div>
      <p class="muted-text" style="margin:0;padding:0 24px 16px;flex:0 0 auto;">Lock activities to their current times. Unlocked activities will be scheduled by AI.</p>
      <div style="flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 24px;overscroll-behavior:contain;">
        <div id="finalizeRows"></div>
        <div id="finalizeConflictBanner" class="finalize-conflict-banner" hidden></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;padding:16px 24px 24px;flex:0 0 auto;border-top:1px solid var(--hair,rgba(10,22,40,.08));">
        <button type="button" class="secondary" id="finalizeCancelBtn">Cancel</button>
        <button type="button" id="finalizeConfirmBtn">Confirm &amp; Arrange</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  refreshOverlayInterlocks?.();

  renderRows();
  updateConflicts();

  modal.querySelector('#finalizeCloseBtn').addEventListener('click', closeModal);
  modal.querySelector('#finalizeCancelBtn').addEventListener('click', closeModal);
  modal.querySelector('#finalizeConfirmBtn').addEventListener('click', onConfirm);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

// expandDays keys day ids on city name + date, so a city's day-id set is the signature its
// schedule was built against: extending a city appends ids and leaves its neighbours untouched,
// while shifting, shrinking or renaming rewrites them. Comparing the set before and after the
// rebuild is what tells us which cities actually moved.
function cityDayKey(days, city) {
  return days.filter((d) => cityMatches(d.city, city)).map((d) => d.id).sort().join('|');
}

// Membership in the current day set, not truthiness: a placement left over from a date the trip no
// longer covers is still a non-empty string, and counting it as a schedule would adopt a signature
// for a city whose activities render nowhere at all.
function cityIsScheduled(city) {
  const liveDayIds = new Set(state.days.filter((d) => cityMatches(d.city, city)).map((d) => d.id));
  return state.activities.some(
    (a) => state.reviewed[a.id]?.approved && cityMatches(a.city, city) && liveDayIds.has(state.placements[a.id]?.dayId)
  );
}

function citiesNeedingArrange() {
  const candidates = getArrangeCities()
    .map((g) => g.city)
    .filter((city) => state.activities.some((a) => state.reviewed[a.id]?.approved && cityMatches(a.city, city)));

  // A city with no record is either a trip arranged before this was tracked or one the user
  // arranged by hand. Adopt what is really on the board rather than rebuilding over their work;
  // a city with nothing on it keeps no record and is picked up as needing arranging below.
  candidates
    .filter((city) => state.arrangedSignatures[city] === undefined && cityIsScheduled(city))
    .forEach((city) => { state.arrangedSignatures[city] = cityDayKey(state.days, city); });

  return candidates.filter((city) => state.arrangedSignatures[city] !== cityDayKey(state.days, city));
}

async function autoArrangeCities(cities) {
  const viewing = state.arrangeCity;
  for (const city of cities) {
    state.arrangeCity = city;
    await autoArrangeActiveCity({ auto: true });
  }
  state.arrangeCity = viewing;
  renderArrange();
}

function maybeAutoArrangeCities() {
  const cities = citiesNeedingArrange();
  if (!cities.length) return;
  if (state.schedulingPrefs?._userConfirmed) {
    autoArrangeCities(cities);
    return;
  }
  openSchedulingWizard(state.schedulingPrefs, {
    onSave: (saved) => {
      saveSchedulingPrefs(saved);
      autoArrangeCities(cities);
    }
  });
}

async function autoArrangeActiveCity(opts = {}) {
  const finalize = Boolean(opts.finalize);
  const lockedSet = Array.isArray(opts.lockedSet) ? opts.lockedSet : [];
  const lockedIds = new Set(lockedSet.map((e) => String(e.activity.id)));

  const activeCity = state.arrangeCity;
  if (!activeCity) return;

  const activeDays = state.days
    .filter((d) => cityMatches(d.city, activeCity))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!activeDays.length) return;

  const allApprovedInCity = state.activities
    .filter((a) => state.reviewed[a.id]?.approved && cityMatches(a.city, activeCity))
    .map((a) => normalizeActivityMetadata(a));

  const locked = allApprovedInCity.filter((a) => lockedIds.has(String(a.id)));
  const flexible = allApprovedInCity.filter((a) => !lockedIds.has(String(a.id)));

  const hasExistingPlacements = allApprovedInCity.some((a) => state.placements[a.id]?.dayId);
  if (!finalize && !opts.auto && hasExistingPlacements) {
    const confirmed = await showConfirmDialog('Replace arrangement?', 'This will replace your current schedule for this city.', 'Replace');
    if (!confirmed) return;
  }

  if (finalize) {
    state.lastFinalizeLocks[activeCity] = lockedSet;
  } else {
    delete state.lastFinalizeLocks[activeCity];
  }

  const cityPlan = state.cities.find((c) => cityMatches(c.name, activeCity));

  const cityLogistics = cityPlan?.logistics || {};
  const departureLocation = String(cityLogistics.departure?.location || '').trim() || 'departure point';

  const prefs = state.schedulingPrefs || defaultSchedulingPrefs();
  const prefStartMins = minutesFromTime(prefs.dayStartTime);
  const prefEndMins = minutesFromTime(prefs.dayEndTime);

  const dayPayload = activeDays.map((day) => {
    const rawStart = getCityDayWindowStart(cityPlan, day.date);
    const rawEnd = getCityDayWindowEnd(cityPlan, day.date);
    const isArrival = day.date === cityPlan?.startDate;
    const isDeparture = day.date === cityPlan?.endDate;
    // Clamp by user preferences only on full days — arrival/departure days keep their travel-time bounds.
    const startMins = isArrival ? rawStart : Math.max(rawStart, prefStartMins);
    const endMins = isDeparture ? rawEnd : Math.min(rawEnd, prefEndMins);
    const label = isArrival && isDeparture ? 'arrival + departure day'
      : isArrival ? 'arrival day'
      : isDeparture ? 'departure day'
      : 'full day';

    // getCityDayWindow{Start,End} already returns the buffered travelTiming values for arrival/departure days,
    // so windowStart === arrivalAvailableTime and windowEnd === departureMustLeaveTime on those days.
    // We pass them through explicitly so the server validator's effectiveDayStart/End enforces them.
    const arrivalAvailableTime = isArrival ? timeFromMinutes(startMins) : null;
    const departureMustLeaveTime = isDeparture ? timeFromMinutes(endMins) : null;

    const fixedStart = isArrival
      ? { label: `Arrival + ${cityLogistics.arrival.mode} buffer → accommodation`, time: arrivalAvailableTime }
      : null;
    const fixedEnd = isDeparture
      ? { label: `Depart for ${departureLocation}`, time: departureMustLeaveTime }
      : null;

    return {
      date: day.date,
      label,
      windowStart: timeFromMinutes(startMins),
      windowEnd: timeFromMinutes(endMins),
      arrivalAvailableTime,
      departureMustLeaveTime,
      fixedStart,
      fixedEnd
    };
  });

  const sameDayEntry = dayPayload.find(d => d.fixedStart && d.fixedEnd);
  if (sameDayEntry) {
    const fsMin = minutesFromTime(sameDayEntry.fixedStart.time);
    const feMin = minutesFromTime(sameDayEntry.fixedEnd.time);
    if (feMin <= fsMin) return;
  }

  allApprovedInCity.forEach((a) => {
    state.activities = state.activities.map((current) => (current.id === a.id ? a : current));
    state.placements[a.id] = { dayId: null, time: null };
  });

  // Clear cross-city placements: an activity placed on a day whose city doesn't match
  const dayCityById = new Map(state.days.map((d) => [d.id, d.city]));
  state.activities.forEach((a) => {
    const dayId = state.placements[a.id]?.dayId;
    if (!dayId) return;
    const dayCity = dayCityById.get(dayId);
    if (dayCity && !cityMatches(a.city, dayCity)) {
      state.placements[a.id] = { dayId: null, time: null };
    }
  });

  // Clear stale placements for declined / unreviewed activities in this city
  state.activities.forEach((a) => {
    if (!cityMatches(a.city, activeCity)) return;
    if (state.reviewed[a.id]?.approved === true) return;
    if (state.placements[a.id]?.dayId) {
      state.placements[a.id] = { dayId: null, time: null };
    }
  });

  // If all activities are locked, skip the LLM call and apply locks directly
  if (finalize && flexible.length === 0) {
    const dateToDay = Object.fromEntries(activeDays.map((d) => [d.date, d]));
    for (const entry of lockedSet) {
      const day = dateToDay[entry.date];
      if (day) state.placements[entry.activity.id] = { dayId: day.id, time: entry.time, endTime: entry.endTime || null };
    }
    state.arrangeUnplaced[activeCity] = [];
    state.arrangedSignatures[activeCity] = cityDayKey(activeDays, activeCity);
    const activeDayIds = activeDays.map((d) => d.id);
    await updateCommutesForCityDays(activeDayIds);
    renderArrange();
    return;
  }

  showLoader({
    title: finalize ? `Finalizing ${activeCity}` : `Arranging ${activeCity}`,
    status: 'Computing commutes…',
    messages: ARRANGE_MESSAGES,
    totalUnits: 3
  });

  try {
    const lockedActivities = lockedSet.map((entry) => {
      const fallback = entry.activity.timing?.duration_minutes || actDurationHours(entry.activity) * 60 || 60;
      const fromEnd = entry.endTime ? minutesFromTime(entry.endTime) - minutesFromTime(entry.time) : 0;
      return {
        id: entry.activity.id,
        date: entry.date,
        time: entry.time,
        duration_minutes: fromEnd > 0 ? fromEnd : fallback,
        type: entry.activity.type,
        name: entry.activity.name
      };
    });

    const ANCHOR_ID_BY_KIND = {
      arrival: logisticsArrivalId(activeCity),
      'acc-arrival': logisticsAccommodationArrivalId(activeCity),
      'acc-departure': logisticsAccommodationDepartureId(activeCity),
      departure: logisticsDepartureId(activeCity)
    };
    const activeDateSet = new Set(activeDays.map((d) => d.date));
    for (const date of [cityPlan?.startDate, cityPlan?.endDate]) {
      if (!date || !activeDateSet.has(date)) continue;
      for (const anchor of logisticsAnchorsForCityDay(cityPlan, date)) {
        lockedActivities.push({
          id: ANCHOR_ID_BY_KIND[anchor.kind],
          date,
          time: timeFromMinutes(anchor.start),
          duration_minutes: anchor.end - anchor.start,
          type: 'logistics',
          name: anchor.name
        });
      }
    }

    let commuteMatrix = {};
    if (flexible.length >= 2) {
      try {
        const matrixRes = await apiFetch('/api/commute-matrix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activities: flexible })
        });
        if (matrixRes.ok) {
          const data = await matrixRes.json();
          commuteMatrix = data?.matrix || {};
        }
      } catch {
        commuteMatrix = {};
      }
    }

    setLoaderUnitsDone(1);
    setLoaderStatus('Assigning activities to days…');
    const arrangeUrl = '/api/arrange' + (location.search.includes('debug=1') ? '?debug=1' : '');
    const res = await apiFetch(arrangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        days: dayPayload,
        activities: flexible.map((a) => {
          const notes = String(state.reviewed[a.id]?.notes || '').trim();
          return notes ? { ...a, user_notes: notes } : a;
        }),
        lockedActivities,
        commuteMatrix,
        profile: getProfilePayload(),
        numTravelers: state.numTravelers,
        numChildren: state.numChildren,
        schedulingPrefs: state.schedulingPrefs || defaultSchedulingPrefs(),
        tripId: state.currentItineraryId || null
      })
    });

    if (!res.ok) throw new Error('Arrange request failed');
    const { placements, unplaced = [] } = await res.json();
    setLoaderUnitsDone(2);
    setLoaderStatus('Building your schedule…');

    const dateToDay = Object.fromEntries(activeDays.map((d) => [d.date, d]));

    // The response is authoritative for every flexible activity in this city. Dropping their old
    // placements first means a day that no longer exists can't leave one stranded on a dead dayId,
    // where it renders in no column and is excluded from the unplaced list for being "placed".
    flexible.forEach((a) => {
      state.placements[a.id] = { dayId: null, time: state.placements[a.id]?.time || null };
    });

    for (const [id, placement] of Object.entries(placements || {})) {
      const day = dateToDay[placement.date];
      if (day) {
        state.placements[id] = { dayId: day.id, time: placement.time, endTime: placement.endTime || null };
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

    // Locked activities always win — overwrite any placements the LLM may have emitted
    for (const entry of lockedSet) {
      const day = dateToDay[entry.date];
      if (day) state.placements[entry.activity.id] = { dayId: day.id, time: entry.time, endTime: entry.endTime || null };
    }

    const unplacedItems = unplaced
      .map((u) => {
        const a = flexible.find((x) => x.id === u.id);
        if (!a) return null;
        if (state.placements[a.id]?.dayId) return null;
        return { id: a.id, name: a.name };
      })
      .filter(Boolean);
    state.arrangeUnplaced[activeCity] = unplacedItems;
    state.arrangedSignatures[activeCity] = cityDayKey(activeDays, activeCity);
  } catch (e) {
    showErrorBanner(e?.message || 'Failed to arrange activities.');
  }

  try {
    const activeDayIds = activeDays.map((d) => d.id);
    await updateCommutesForCityDays(activeDayIds);
    renderArrange();
    finishLoaderProgress();
  } finally {
    hideLoader();
  }
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
  // dataset getters return the decoded attribute value, so escape at read time
  const d = anchorEl.dataset;
  layer.innerHTML = `
    <div class="placed-tooltip-title">${esc(d.tooltipName)}</div>
    <div class="placed-tooltip-row"><strong>Type:</strong> ${esc(d.tooltipTypeIcon)} ${esc(d.tooltipType)}</div>
    <div class="placed-tooltip-row"><strong>Duration:</strong> ${esc(d.tooltipDuration)}</div>
    <div class="placed-tooltip-row"><strong>Location:</strong> ${esc(d.tooltipStartLocation) || '—'}</div>
    <div class="placed-tooltip-row"><strong>Why it fits:</strong> ${esc(d.tooltipWhy)}</div>
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

    const timeBtn = card.querySelector('.placed-time');
    if (timeBtn) {
      timeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
      timeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        openTimeEditPopup(id, timeBtn);
      });
    }

    card.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;

      const activeCity = state.arrangeCity;
      const isLocked = (state.lastFinalizeLocks[activeCity] || []).some((entry) => String(entry.activity.id) === id);
      if (isLocked) {
        e.stopPropagation();
        e.preventDefault();
        showErrorBanner('This activity is locked. Re-open Finalize to unlock.');
        return;
      }

      if (!inResizeEdge(e.clientY)) return;

      e.stopPropagation();
      e.preventDefault();
      hidePlacedTooltip();

      clearActivePlacedCardDrag();

      const startY = e.clientY;
      const startHeight = card.offsetHeight;
      const currentTop = Number.parseFloat(card.style.top) || yFromTime(state.placements[id]?.time);
      const maxHeight = Math.max(28, GRID_HEIGHT - currentTop);
      let holdReady = false;
      let isResizing = false;

      const holdTimer = setTimeout(() => {
        holdReady = true;
      }, HOLD_DELAY_MS);

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
        const dy = ev.clientY - startY;
        if (!isResizing) {
          if (!holdReady || Math.abs(dy) < MOVE_THRESHOLD_PX) return;
          isResizing = true;
        }
        updateCardDuration(ev);
      };

      const up = (ev) => {
        ev.stopPropagation();
        clearTimeout(holdTimer);
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        activePlacedCardDragCleanup = null;

        card.classList.remove('resize-hover');
        currentDragMode = null;
        if (isResizing) {
          const placement = state.placements[id];
          if (placement?.endTime) state.placements[id] = { dayId: placement.dayId, time: placement.time };
          renderArrange();
          updateCommutesForCityDays([dayId]).then(() => renderArrange()).catch(() => {});
        }
      };

      activePlacedCardDragCleanup = () => {
        clearTimeout(holdTimer);
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        card.classList.remove('resize-hover');
        currentDragMode = null;
      };

      currentDragMode = 'resize';
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
      .sort(byScheduledTime);

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
  renderFinalize();
  renderItineraryMode();
  renderTripHealthBadge();
}

const FINALIZE_CAT_MAP = {
  food: 'food', meal: 'food',
  tour: 'tour',
  museum: 'culture', landmark: 'culture', cultural: 'culture',
  park: 'outdoor', walk: 'outdoor', neighborhood: 'outdoor', outdoor: 'outdoor',
  nightlife: 'night', show: 'night',
  sports: 'outdoor', shopping: 'tour',
  arrival: 'transit', departure: 'transit', transit: 'transit'
};
const FINALIZE_CAT_LABEL = {
  food: 'Food', tour: 'Tour', culture: 'Culture',
  outdoor: 'Outdoor', night: 'Night', transit: 'Transit'
};

function mapTypeToFinalizeCat(type) {
  const key = String(type || '').toLowerCase();
  return FINALIZE_CAT_MAP[key] || 'tour';
}

function deriveDayTheme(day, dayIndex, allDays) {
  if (allDays.length === 1) return 'Trip day';
  if (dayIndex === 0) return 'Arrival';
  if (dayIndex === allDays.length - 1) return 'Departure';
  const firstForCity = !allDays.slice(0, dayIndex).some((d) => d.city === day.city);
  const lastForCity = !allDays.slice(dayIndex + 1).some((d) => d.city === day.city);
  if (firstForCity) return `To ${day.city}`;
  if (lastForCity) return `Last in ${day.city}`;
  return day.city;
}

function finalizeOpenChecklistItems() {
  const list = Array.isArray(state.bookingChecklist) ? state.bookingChecklist : [];
  return list.filter((item) => {
    if (!item || item.bookingNotRequired) return false;
    if (item.status === 'resolved') return false;
    const ref = String(item.referenceNum || '').trim();
    return !ref;
  });
}

function activityHasPendingBooking(activityId) {
  const list = Array.isArray(state.bookingChecklist) ? state.bookingChecklist : [];
  return list.some((item) => (
    item.type === 'activity'
    && String(item.activityId) === String(activityId)
    && !item.bookingNotRequired
    && item.status !== 'resolved'
    && !String(item.referenceNum || '').trim()
  ));
}

function renderFinalize() {
  renderFinalizeTripCard();
  renderFinalizeOpenItems();
  renderFinalizeDayByDay();
  renderFinalizeFooter();
}

function renderFinalizeTripCard() {
  const titleEl = document.getElementById('finTripTitle');
  const routeEl = document.getElementById('finTripRoute');
  const statsEl = document.getElementById('finTripStats');
  if (!titleEl || !routeEl || !statsEl) return;

  const cities = (state.cities || []).filter((c) => c.startDate && c.endDate);
  const orderedCities = [...cities].sort((a, b) => parseYmdAsLocal(a.startDate) - parseYmdAsLocal(b.startDate));
  const first = orderedCities[0];
  const last = orderedCities[orderedCities.length - 1];
  const start = first ? parseYmdAsLocal(first.startDate) : null;
  const end = last ? parseYmdAsLocal(last.endDate) : null;
  const nights = (start && end) ? Math.max(0, Math.round((end - start) / 86400000)) : 0;
  const primaryCity = first?.name || 'your destination';

  const rawTitle = (state.tripName || `${nights || 1} ${nights === 1 ? 'night' : 'nights'} in ${primaryCity}`).trim();
  const titleParts = rawTitle.split(' ');
  if (titleParts.length > 1) {
    const last = titleParts.pop();
    titleEl.innerHTML = `${esc(titleParts.join(' '))} <span class="serif">${esc(last)}</span>`;
  } else {
    titleEl.innerHTML = `<span class="serif">${esc(rawTitle)}</span>`;
  }

  if (orderedCities.length === 0) {
    routeEl.innerHTML = '<span class="city">Add cities to see your route</span>';
  } else {
    routeEl.innerHTML = orderedCities
      .map((c, i) => `${i ? '<span class="arrow">→</span>' : ''}<span class="city">${esc(c.name)}</span>`)
      .join(' ');
  }

  const fmtMD = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  const datesValue = (start && end)
    ? `${fmtMD(start)} <span class="u">→</span> ${fmtMD(end)}`
    : '—';
  const travelers = Number(state.numTravelers || 0) + Number(state.numChildren || 0) || 1;
  const placedApproved = (state.activities || []).filter((a) => (
    state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId
  ));
  const stats = [
    { k: 'Dates', v: datesValue },
    { k: 'Nights', v: String(nights || 0) },
    { k: 'Travelers', v: String(travelers) },
    { k: 'Cities', v: String(orderedCities.length || 0) },
    { k: 'Activities', v: String(placedApproved.length) }
  ];
  statsEl.innerHTML = stats.map((s) => `
    <div class="fin-stat">
      <span class="k">${esc(s.k)}</span>
      <span class="v">${s.v}</span>
    </div>
  `).join('');
}

function renderFinalizeOpenItems() {
  const listEl = document.getElementById('finOpenList');
  const countEl = document.getElementById('finOpenCount');
  const attachAllBtn = document.getElementById('finAttachAllBtn');
  if (!listEl || !countEl) return;

  const open = finalizeOpenChecklistItems();
  const n = open.length;
  countEl.textContent = n === 0 ? 'All set' : `${n} open`;
  countEl.classList.toggle('all-set', n === 0);
  if (attachAllBtn) attachAllBtn.style.display = n === 0 ? 'none' : '';

  if (n === 0) {
    listEl.innerHTML = '<div class="fin-open__empty">Every booking has a reference. You\'re set.</div>';
    return;
  }

  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  listEl.innerHTML = open.map((item) => {
    const linkedActivity = item.type === 'activity'
      ? state.activities.find((a) => String(a.id) === String(item.activityId))
      : null;
    const placement = linkedActivity ? state.placements[linkedActivity.id] : null;
    const day = placement?.dayId ? state.days.find((d) => d.id === placement.dayId) : null;
    const dateStr = item.activityDate || item.date || day?.date || '';
    let chipMonth = '—'; let chipDay = '—';
    if (dateStr) {
      const dt = parseYmdAsLocal(dateStr);
      if (!Number.isNaN(dt.getTime())) {
        chipMonth = MONTHS[dt.getMonth()];
        chipDay = String(dt.getDate()).padStart(2, '0');
      }
    }
    const chipTime = (item.activityTime || placement?.time || '').slice(0, 5) || '—';

    const title = item.title || linkedActivity?.name || 'Untitled item';
    const missingLabel = item.type === 'activity'
      ? 'No booking ref'
      : (item.type === 'flight' || item.type === 'transport' ? 'No confirmation' : 'No reservation');
    const why = item.notes || linkedActivity?.why_it_fits || '';
    const priceUsd = Number((linkedActivity ? activityCardCostUsd(linkedActivity) : null) ?? item.budgetUsd ?? 0);
    const priceHtml = priceUsd > 0 ? ` <span class="price">$${Math.round(priceUsd).toLocaleString()}</span>` : '';

    return `
      <div class="open-item" data-checklist-id="${esc(item.id)}">
        <div class="open-item__when">
          <span class="d">${esc(chipMonth)}</span>
          <span class="n">${esc(chipDay)}</span>
          <span class="t">${esc(chipTime)}</span>
        </div>
        <div class="open-item__body">
          <div class="open-item__title">${esc(title)}<span class="open-item__missing">${esc(missingLabel)}</span></div>
          ${why ? `<div class="open-item__why">${esc(why)}${priceHtml}</div>` : (priceHtml ? `<div class="open-item__why">${priceHtml}</div>` : '')}
        </div>
        <button class="open-item__cta" type="button" data-open-checklist="${esc(item.id)}">
          Add confirmation <span class="arrow">→</span>
        </button>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('[data-open-checklist]').forEach((btn) => {
    btn.addEventListener('click', () => openChecklistModal());
  });
}

function renderFinalizeDayByDay() {
  const listEl = document.getElementById('finItinList');
  const metaEl = document.getElementById('finItinMeta');
  if (!listEl) return;

  const days = Array.isArray(state.days) ? state.days : [];
  const approved = (state.activities || []).filter((a) => state.reviewed[a.id]?.approved);

  let totalStops = 0;
  const citiesSet = new Set();

  const html = days.map((day, idx) => {
    citiesSet.add(day.city);
    const items = approved
      .filter((a) => state.placements[a.id]?.dayId === day.id)
      .sort(byScheduledTime);
    totalStops += items.length;

    const dt = parseYmdAsLocal(day.date);
    const validDate = !Number.isNaN(dt.getTime());
    const dayName = validDate
      ? `${dt.toLocaleDateString(undefined, { weekday: 'short' })} · ${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : day.date;

    const theme = deriveDayTheme(day, idx, days);

    const itemsHtml = items.map((a) => {
      const placement = state.placements[a.id] || {};
      const startMins = minutesFromTime(parseTimeTo24(placement.time || actPreferredTime(a) || typeToTime(a.type)));
      const endMins = startMins + Math.round(actDurationHours(a) * 60);
      const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const cat = mapTypeToFinalizeCat(a.type);
      const pending = activityHasPendingBooking(a.id);
      return `
        <div class="item" data-activity-id="${esc(a.id)}">
          <span class="item__time">${esc(fmt(startMins))}<span class="dash">–</span>${esc(fmt(endMins))}</span>
          <span class="item__dot cat-${cat}" aria-hidden="true"></span>
          <span class="item__title">${esc(a.name)}${pending ? '<span class="item__pending" role="img" aria-label="Booking confirmation needed" title="Booking confirmation needed">!</span>' : ''}</span>
          <span class="item__cat">${esc(FINALIZE_CAT_LABEL[cat] || 'Stop')}</span>
        </div>
      `;
    }).join('');

    return `
      <section class="day">
        <div class="day__head">
          <span class="day__num">Day ${String(idx + 1).padStart(2, '0')}</span>
          <span class="day-name">${esc(dayName)}</span>
          <span class="day__theme">${esc(theme)}</span>
          <span class="day__city">${esc(day.city)}</span>
        </div>
        <div class="day__items">${itemsHtml}</div>
      </section>
    `;
  }).join('');

  listEl.innerHTML = html || '<div class="fin-open__empty">No days planned yet.</div>';
  if (metaEl) {
    metaEl.innerHTML = `${totalStops} stops<span class="pipe">·</span>${days.length} days<span class="pipe">·</span>${citiesSet.size} cities`;
  }
}

function renderFinalizeFooter() {
  const versionEl = document.getElementById('finVersionMeta');
  const autosaveEl = document.getElementById('finAutosave');
  if (versionEl) {
    const days = (state.days || []).length;
    const activities = (state.activities || []).filter((a) => state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId).length;
    versionEl.innerHTML = `v 01<span class="pipe" style="color:var(--text-400);margin:0 6px;">·</span>${days} days<span class="pipe" style="color:var(--text-400);margin:0 6px;">·</span>${activities} activities`;
  }
  if (autosaveEl) autosaveEl.textContent = 'Auto-saved · just now';
}

function formatTimeRangeLabel(startMinutes, endMinutes) {
  const fmt = (mins) => {
    const h = Math.floor(mins / 60) % 24;
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
  const items = Array.isArray(state.bookingChecklist) ? state.bookingChecklist : [];
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
      const lat = Number(activity.location?.lat);
      const lng = Number(activity.location?.lng);
      const navigateHref = activity.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(activity.place_id)}`
        : (Number.isFinite(lat) && Number.isFinite(lng))
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          : (location || activity.name)
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`
            : '';
      const notes = String(state.reviewed[activity.id]?.notes || '').trim();
      const referenceNum = getActivityReferenceNum(activity.id);

      const priceTier = Number.isInteger(activity.price_level) ? activity.price_level : null;
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
        priceTier,
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
      date: logAcc.checkIn || '',
      kindLabel: 'Stay',
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
      date: arrival.date || '',
      kindLabel: modeToLabel(arrival.mode),
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
      date: departure.date || '',
      kindLabel: modeToLabel(departure.mode),
      location: '',
      notes: '',
      referenceNum: '',
      navigateHref: buildNavigateHref(loc),
      fileCount: getItemAttachments(`dep_${cityIdx}`).length
    });
  }

  return rows;
}

function modeToLabel(mode) {
  switch (String(mode || '').toLowerCase()) {
    case 'flight': return 'Flight';
    case 'train': return 'Train';
    case 'car': return 'Car';
    case 'other': return 'Other';
    default: return 'Travel';
  }
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
  return persist.loadJson(MINIMAL_OFFLINE_KEY, {}) || {};
}

function saveMinimalOfflinePayload(payload) {
  const id = String(payload?.itineraryId || '').trim();
  if (!id) {
    showErrorBanner('Generate and save an itinerary first.');
    return;
  }

  const store = getMinimalOfflineStore();
  store[id] = payload;
  persist.saveJson(MINIMAL_OFFLINE_KEY, store);
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
    .catch(() => showErrorBanner('Could not copy itinerary text.'));
}

async function shareMinimalItinerary() {
  if (!state.currentItineraryId) {
    showErrorBanner('Save itinerary first to create a share link.');
    return;
  }

  const shareUrl = `${window.location.origin}/trip/${encodeURIComponent(state.currentItineraryId)}`;

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
    .catch(() => showErrorBanner(`Could not copy — share link: ${shareUrl}`));
}

function formatItinHeroDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function nightsBetween(a, b) {
  if (!a || !b) return 0;
  const d1 = new Date(`${a}T12:00:00`);
  const d2 = new Date(`${b}T12:00:00`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function renderItineraryHero(payload) {
  const heroEl = document.getElementById('itineraryModeHero');
  if (!heroEl) return;
  const tripName = String(payload.tripName || 'Untitled Trip').trim();
  const lastWord = tripName.split(/\s+/).pop();
  const head = tripName.slice(0, tripName.length - lastWord.length).trim();
  const titleHtml = head
    ? `${esc(head)} <span class="serif">${esc(lastWord)}</span>`
    : `<span class="serif">${esc(tripName)}</span>`;
  const dates = payload.firstDate && payload.lastDate
    ? `${formatItinHeroDate(payload.firstDate)} → ${formatItinHeroDate(payload.lastDate)}`
    : '—';
  const nights = nightsBetween(payload.firstDate, payload.lastDate);
  const travelers = (Number(state.numTravelers || 0) + Number(state.numChildren || 0)) || 1;
  const routeCities = payload.cities || [];
  const routeHtml = routeCities.length
    ? routeCities.map((c, i) => `${i > 0 ? '<span class="arrow">→</span>' : ''}<span class="city">${esc(c)}</span>`).join(' ')
    : '<span class="city">—</span>';
  heroEl.innerHTML = `
    <div class="itin-hero__title">
      <span class="eyebrow">Itinerary · v ${esc(String((state.itineraryVersion || 1)).padStart(2, '0'))}</span>
      <h1>${titleHtml}</h1>
      <div class="route">${routeHtml}</div>
    </div>
    <div class="itin-hero__meta">
      <div><span class="k">Dates</span><span class="v">${esc(dates)}</span></div>
      <div><span class="k">Nights</span><span class="v">${nights}</span></div>
      <div><span class="k">Travelers</span><span class="v">${travelers}</span></div>
      <div><span class="k">Items</span><span class="v">${payload.itemCount}</span></div>
    </div>
  `;
}

function classifyStop(row) {
  const id = String(row.id || '');
  if (id.startsWith('arr_') || id.startsWith('dep_')) return 'is-travel';
  if (id.startsWith('acc_')) return 'is-lodging';
  return '';
}

function formatStopTime(timeLabel) {
  if (!timeLabel) return '<span class="end">—</span>';
  const label = String(timeLabel);
  const rangeParts = label.split(/\s*→\s*|\s+[–-]\s+/);
  if (rangeParts.length >= 2) {
    return `${esc(rangeParts[0])}<span class="end">→ ${esc(rangeParts[1])}</span>`;
  }
  const dateTimeParts = label.split(/,\s+/);
  if (dateTimeParts.length >= 2) {
    return `${esc(dateTimeParts[0])}<span class="end">${esc(dateTimeParts.slice(1).join(', '))}</span>`;
  }
  return esc(label);
}

function renderStop(row) {
  const mod = classifyStop(row);
  const hasRef = Boolean(row.referenceNum);
  const refHtml = hasRef
    ? `<span class="stop__ref">Confirmation <code>${esc(row.referenceNum)}</code></span>`
    : `<span class="stop__ref is-empty">No booking attached</span>`;
  const fileCount = Number(row.fileCount || 0);
  const filesDisabled = fileCount === 0 ? ' disabled' : '';
  const filesCountHtml = fileCount > 0 ? ` <span class="count">${fileCount}</span>` : '';
  const navDisabled = row.navigateHref ? '' : ' disabled';
  const navigateAttr = row.navigateHref ? ` data-href="${esc(row.navigateHref)}"` : '';

  const metaParts = [];
  if (row.location) metaParts.push(esc(row.location));
  if (row.priceTier) metaParts.push(`<b>${'$'.repeat(row.priceTier)}</b>`);
  const metaHtml = metaParts.length
    ? `<div class="stop__meta">${metaParts.join(' <span class="sep">·</span> ')}</div>`
    : '';
  const noteHtml = row.notes ? `<p class="stop__note">${esc(row.notes)}</p>` : '';

  let kindHtml = '';
  if (row.kindLabel) {
    const kindMod = mod === 'is-travel' ? 'stop__kind--travel' : mod === 'is-lodging' ? 'stop__kind--accent' : '';
    kindHtml = `<span class="stop__kind ${kindMod}">${esc(row.kindLabel)}</span>`;
  }

  return `
    <div class="stop ${mod}" data-activity-id="${esc(row.id)}">
      <div class="stop__time">${formatStopTime(row.timeLabel)}</div>
      <div class="stop__body">
        <div class="stop__head">${kindHtml}<h4 class="stop__title">${esc(row.title || 'Untitled')}</h4></div>
        ${metaHtml}
        ${noteHtml}
        ${refHtml}
        <div class="stop__actions">
          <button type="button" class="stop-act" data-action="navigate"${navigateAttr}${navDisabled}><i class="ph-bold ph-navigation-arrow"></i>Navigate</button>
          <button type="button" class="stop-act" data-action="view-files"${filesDisabled}><i class="ph-bold ph-folder-open"></i>View Files${filesCountHtml}</button>
          <button type="button" class="stop-act" data-action="upload-files"><i class="ph-bold ph-upload-simple"></i>Upload Tickets</button>
        </div>
      </div>
      <div class="stop__cost"></div>
    </div>
  `;
}

function formatWeekday(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { weekday: 'short' });
}

function renderItineraryMode() {
  if (!els.itineraryModeList) return;
  const payload = getMinimalPayload();
  const rows = payload.itineraryRows;
  renderItineraryHero(payload);

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
    els.itineraryModeList.innerHTML = '<p class="itin-empty">No scheduled itinerary yet. Build your plan in Planning Mode first.</p>';
    return;
  }

  const rowsByCity = rows.reduce((acc, row) => {
    (acc[row.city] = acc[row.city] || []).push(row);
    return acc;
  }, {});

  const totalCities = cityOrder.length;
  let dayCounter = 0;

  const html = cityOrder.map((cityName, cityIdxInOrder) => {
    const cityIdx = cityIdxByName.get(cityName);
    const cityObj = (state.cities || []).find((c) => String(c?.name || '').trim() === cityName) || {};
    const accomTravelRows = getCityAccomTravelRows(cityObj, cityIdx);
    const cityRows = rowsByCity[cityName] || [];

    const dayGroups = {};
    cityRows.forEach((row) => {
      (dayGroups[row.date] = dayGroups[row.date] || []).push(row);
    });

    const orphanLogistics = [];
    accomTravelRows.forEach((row) => {
      const key = row.date || '';
      if (key && dayGroups[key]) {
        dayGroups[key].unshift(row);
      } else if (key) {
        dayGroups[key] = [row];
      } else {
        orphanLogistics.push(row);
      }
    });

    const dayOrder = Object.keys(dayGroups).sort();

    const cityStart = dayOrder[0] ? formatDateShort(dayOrder[0]) : '';
    const cityEnd = dayOrder[dayOrder.length - 1] ? formatDateShort(dayOrder[dayOrder.length - 1]) : '';
    const nightsInCity = Math.max(1, dayOrder.length);
    const whenHtml = cityStart && cityEnd
      ? `<b>${esc(cityStart)}</b> → ${esc(cityEnd)} · ${nightsInCity} night${nightsInCity > 1 ? 's' : ''}`
      : esc(cityStart || cityEnd || '');

    const daysHtml = dayOrder.map((date) => {
      dayCounter += 1;
      const stops = dayGroups[date];
      const weekday = formatWeekday(date);
      const dateLabel = formatDateShort(date);

      return `
        <div class="day">
          <div class="day__when">
            <span class="day__date">${esc(weekday)} · ${esc(dateLabel)}</span>
            <span class="day__weekday">Day<span class="num">Day ${String(dayCounter).padStart(2, '0')}</span></span>
          </div>
          <div class="stops">
            ${stops.map(renderStop).join('')}
          </div>
        </div>
      `;
    }).join('');

    const orphanHtml = orphanLogistics.length
      ? `<div class="day"><div class="day__when"><span class="day__date">Logistics</span><span class="day__weekday">&nbsp;</span></div><div class="stops">${orphanLogistics.map(renderStop).join('')}</div></div>`
      : '';

    return `
      <section class="city-section">
        <header class="city-head">
          <span class="city-head__index">${String(cityIdxInOrder + 1).padStart(2, '0')} / ${String(totalCities).padStart(2, '0')}</span>
          <h2 class="city-head__name">${esc(cityName)}</h2>
          <span class="city-head__when">${whenHtml}</span>
        </header>
        ${daysHtml}
        ${orphanHtml}
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
    showErrorBanner('Could not identify activity. Please refresh and try again.');
    return;
  }

  if (!state.currentItineraryId) {
    try {
      await generateItinerary();
    } catch {
      setUploadBtnState(buttonEl, 'idle');
      showErrorBanner('Save your trip first, then upload files.');
      return;
    }
    if (!state.currentItineraryId) {
      setUploadBtnState(buttonEl, 'idle');
      showErrorBanner('Save your trip first, then upload files.');
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
    if (res.status === 401) { setUploadBtnState(buttonEl, 'idle'); showErrorBanner('Sign in to upload files.'); return; }
    if (res.status === 404) { setUploadBtnState(buttonEl, 'idle'); showErrorBanner('Activity not found on the server. Try saving the trip again.'); return; }
    if (res.status === 413) { setUploadBtnState(buttonEl, 'idle'); showErrorBanner('File exceeds 10 MB limit.'); return; }
    if (res.status === 415) { setUploadBtnState(buttonEl, 'idle'); showErrorBanner('Unsupported file type.'); return; }
    if (!res.ok) {
      setUploadBtnState(buttonEl, 'idle');
      let msg = 'Upload failed.';
      try { const j = await res.json(); if (j?.error) msg = `Upload failed: ${j.error}`; } catch {}
      showErrorBanner(msg);
      return;
    }
    const data = await res.json();
    const added = Array.isArray(data?.attachments) ? data.attachments : [];
    setItemAttachments(activityId, [...getItemAttachments(activityId), ...added]);
    setUploadBtnState(buttonEl, 'success');
    setTimeout(() => {
      renderItineraryMode();
      if (els.checklistModal && !els.checklistModal.classList.contains('hidden')) renderChecklistModal();
    }, 1000);
  } catch (err) {
    setUploadBtnState(buttonEl, 'idle');
    showErrorBanner(`Upload failed: ${err?.message || 'network error'}`);
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
  overlayManager.open('attachmentViewerModal');
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
    if (!res.ok) { showErrorBanner('Could not delete file.'); return; }
    const remaining = getItemAttachments(activityId).filter((a) => a.id !== attachmentId);
    setItemAttachments(activityId, remaining);
    renderAttachmentViewerList(activityId, remaining);
    renderItineraryMode();
  } catch {
    showErrorBanner('Could not delete file.');
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
          if (els.itineraryGrid) els.itineraryGrid.innerHTML = '';
          if (els.itineraryInsights) els.itineraryInsights.innerHTML = '';
          updateCalendarControls();
        }
        await fetchSavedItineraries();
        renderSavedItineraries();
      } catch {
        showErrorBanner('Could not delete itinerary.');
      }
    });
  });
}

function hydrateLoadedItinerary(itinerary) {
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
  state.bookingChecklist = Array.isArray(itinerary?.bookingChecklist?.checklist)
    ? itinerary.bookingChecklist.checklist.map(normalizeChecklistItem)
    : [];
  state.bookingChecklistNotificationPrefs = itinerary?.bookingChecklist?.notificationPrefs || state.bookingChecklistNotificationPrefs;
  state.bookingChecklistIssueMeta = itinerary?.bookingChecklist?.issueMeta || {};
  state.cities = Array.isArray(itinerary.cities)
    ? itinerary.cities.map(normalizeCityData)
    : state.cities;
  state.travels = Array.isArray(itinerary.travels) ? itinerary.travels.slice(0, 1).map(normalizeTravelEntry) : state.travels;
  state.days = Array.isArray(itinerary.days)
    ? itinerary.days.map((day) => ({ id: day.id || `${day.city}-${day.date}`, city: day.city, date: day.date }))
    : [];
  state.activities = (itinerary.activities || []).map((a) => normalizeActivityMetadata(a));
  state.reviewed = itinerary.reviewed || {};
  state.placements = itinerary.placements || {};
  state.arrangedSignatures = itinerary.arrangedSignatures || {};
  state.commutes = normalizeCommuteStateMap(itinerary.commutes || {});
  state.schedulingPrefs = itinerary.schedulingPrefs
    ? saveSchedulingPrefs(itinerary.schedulingPrefs)
    : loadSchedulingPrefs();
  hydrateTravelIntoCities();
  renderCities();
  state.lastPlannedFingerprint = step1Fingerprint();
  updateCalendarControls();
  renderItinerary();
}

async function loadItineraryById(id) {
  if (!id) return;
  try {
    const res = await apiFetch(`/api/itinerary/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok || !data?.itinerary) throw new Error('Failed to load itinerary');

    hydrateLoadedItinerary(data.itinerary);
    await fetchSavedItineraries();
    renderSavedItineraries();
    ensureChatSessionId();
    await restoreChatHistory();
    await hydrateAttachmentsForItinerary(state.currentItineraryId);
    setStep(4);
  } catch {
    showErrorBanner('Could not load itinerary.');
  }
}

async function loadPublicSharedItinerary(id) {
  const res = await fetch(`/api/public/itinerary/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Failed to load shared itinerary');
  const data = await res.json();
  if (!data?.itinerary) throw new Error('Failed to load shared itinerary');
  state.readOnlyShare = true;
  hydrateLoadedItinerary(data.itinerary);
}

function syncTripMetaFromInputs() {
  state.tripName = els.tripName.value.trim();
  const budgetVal = parseFloat(els.tripBudget?.value);
  state.tripBudget = Number.isFinite(budgetVal) && budgetVal > 0 ? budgetVal : null;
  state.numTravelers = Math.max(1, parseInt(els.numTravelers?.value, 10) || 1);
  state.numChildren = Math.max(0, parseInt(els.numChildren?.value, 10) || 0);
}

const PLAN_PHASES_PER_CITY = 4;
const PLAN_PHASE_LABELS = {
  research: 'Researching',
  generating: 'Writing activities for',
  enriching: 'Finding places in'
};

async function planTrip(citiesToRegenerate = null, lockedByCity = {}) {
  syncTripMetaFromInputs();
  syncLegacyTravelsFromCities();
  const allCities = state.cities.map(cityPlanningInputs);
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
    state.activities = state.activities.filter(
      (a) => !regenSet.has(a.city) || lockedIds.has(a.id)
    );
    removedIds.forEach((id) => {
      delete state.reviewed[id];
      delete state.placements[id];
    });
    regenSet.forEach((city) => { delete state.arrangedSignatures[city]; });
    Object.keys(state.commutes || {}).forEach((key) => {
      const [from, to] = key.split('->');
      if (removedIds.has(from) || removedIds.has(to)) delete state.commutes[key];
    });
    state.bookingChecklist = (state.bookingChecklist || [])
      .filter((item) => !(item.type === 'activity' && removedIds.has(item.activityId)));
  } else {
    state.activities = [];
    state.reviewed = {};
    state.placements = {};
    state.arrangedSignatures = {};
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
    budget: state.tripBudget,
    numTravelers: state.numTravelers,
    numChildren: state.numChildren,
    tripId: state.currentItineraryId || null,
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
  let stepsDone = 0;
  const failedCities = [];

  // Cities are planned in parallel and each takes minutes, so completed-city
  // count alone leaves the bar frozen. Count the four observable steps per city
  // the server now reports instead.
  const cityPhase = new Map();
  const totalSteps = cities.length * PLAN_PHASES_PER_CITY;

  const renderLoaderStatus = () => {
    const active = [...cityPhase.entries()]
      .map(([city, label]) => `${label} ${truncateLocation(city, 20)}`)
      .join(' · ');
    setLoaderStatus(
      active || 'Starting planning...',
      `${completedCities} of ${cities.length} cities · step ${stepsDone} of ${totalSteps}`
    );
  };

  const advance = () => {
    stepsDone += 1;
    setLoaderUnitsDone(stepsDone);
    renderLoaderStatus();
  };

  renderLoaderStatus();

  const handleEvent = async (payloadText) => {
    const evt = JSON.parse(payloadText);

    if (evt.type === 'error') throw new Error(evt.error || 'Failed to plan');

    if (evt.type === 'city_start') {
      cityPhase.set(evt.city, 'Starting');
      renderLoaderStatus();
      return;
    }

    if (evt.type === 'phase') {
      cityPhase.set(evt.city, PLAN_PHASE_LABELS[evt.phase] || 'Working on');
      advance();
      return;
    }

    // One city failing leaves the others usable, so surface it and keep reading.
    if (evt.type === 'city_error') {
      failedCities.push(truncateLocation(evt.city, 40));
      cityPhase.delete(evt.city);
      advance();
      return;
    }

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
          city: canonicalizeActivityCity(normalized.city, evt.city)
        };
      });

      state.activities.push(...cityActivities);
      enrichActivities(cityActivities).then(() => { if (state.step === 2) renderActivities(); });
      setStep(2);
      renderActivities();

      completedCities += 1;
      cityPhase.delete(evt.city);
      advance();
    }

    if (evt.type === 'done') {
      cityPhase.clear();
      setLoaderStatus('Finalizing...', `${cities.length} of ${cities.length} cities`);
      finishLoaderProgress();
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

  if (failedCities.length) {
    showErrorBanner(`Couldn't plan ${failedCities.join(' or ')}. The rest of your trip is ready — go back to Setup to retry.`);
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
    arrangedSignatures: state.arrangedSignatures,
    reviewed: state.reviewed,
    bookingChecklist: {
      checklist: state.bookingChecklist,
      notificationPrefs: state.bookingChecklistNotificationPrefs,
      issueMeta: state.bookingChecklistIssueMeta
    },
    schedulingPrefs: state.schedulingPrefs || defaultSchedulingPrefs()
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

function buildActivityDigest(a) {
  return {
    name: a.name,
    type: a.type,
    durationMin: a.timing?.duration_minutes ?? null,
    location: actAddress(a),
    lat: a.location?.lat ?? null,
    lng: a.location?.lng ?? null,
    costUsd: actCostUsd(a),
    costType: actCostType(a),
    booking: { type: actBookingType(a), reference: a.booking?.reference || null, links: actBookingLinks(a) },
    openingHours: actOpeningHours(a),
    whyItFits: a.why_it_fits || '',
    pitfall: a.pitfall || '',
    insiderTips: a.insider_tips || null,
    smarterAlternative: a.smarter_alternative || null
  };
}

function buildScheduledDays() {
  return state.days.map((d) => ({
    date: d.date,
    city: d.city,
    activities: activitiesOnDay(d.id)
      .map((a) => ({ time: state.placements[a.id]?.time, ...buildActivityDigest(a) }))
  })).filter((d) => d.activities.length);
}

const STEP_LABELS = { 1: 'setup', 2: 'reviewing activities', 3: 'arranging schedule', 4: 'itinerary finalized' };

const STEP_SUGGESTED_QUESTIONS = {
  'setup': [
    { icon: 'ph-hourglass-medium', text: "Is 3 days enough for Tokyo?" },
    { icon: 'ph-thermometer-simple', text: "Is Madrid in August too hot?" },
    { icon: 'ph-arrow-right', text: "What happens after I click Continue?" }
  ],
  'reviewing activities': [
    { icon: 'ph-bowl-food', text: "Best ramen spots locals actually go to in Harajuku?" },
    { icon: 'ph-ticket', text: "What's worth booking ahead in Barcelona?" },
    { icon: 'ph-arrows-left-right', text: "What happens when I approve or decline an activity?" }
  ],
  'arranging schedule': [
    { icon: 'ph-magic-wand', text: "What does Finalize do?" },
    { icon: 'ph-train', text: "How long does it actually take to get from Shibuya to Asakusa?" },
    { icon: 'ph-stack', text: "How many activities is too many for one day in Tokyo?" }
  ],
  'itinerary finalized': [
    { icon: 'ph-receipt', text: "Where can I update my booking reference numbers?" },
    { icon: 'ph-download-simple', text: "How can I save my itinerary offline?" },
    { icon: 'ph-share-network', text: "How do I share this trip with my friends?" }
  ]
};

function slimCities() {
  return state.cities.map((c) => {
    const arr = c.logistics?.arrival;
    return {
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      leaveTime: c.leaveTime,
      notes: c.notes || '',
      accommodation: c.accommodation?.address ? {
        address: c.accommodation.address,
        checkIn: c.accommodation.checkIn || '',
        checkOut: c.accommodation.checkOut || '',
        lat: c.accommodation.latitude ?? null,
        lng: c.accommodation.longitude ?? null
      } : null,
      arrival: arr?.time ? { mode: arr.mode || '', time: arr.time } : null
    };
  });
}

function getTripContext() {
  syncLegacyTravelsFromCities();
  const scheduled = buildScheduledDays();
  const hasSchedule = scheduled.length > 0;
  return {
    step: STEP_LABELS[state.step] || 'unknown',
    tripName: state.tripName,
    cities: slimCities(),
    approvedActivities: hasSchedule ? [] : state.activities.filter((a) => state.reviewed[a.id]?.approved).map(buildActivityDigest),
    declinedActivities: hasSchedule ? [] : state.activities.filter((a) => state.reviewed[a.id]?.approved === false).map(buildActivityDigest),
    scheduledByDay: scheduled
  };
}

function loadChatSessionMap() {
  return persist.loadJson('chat_sessions', {}) || {};
}

function saveChatSessionMap(map) {
  persist.saveJson('chat_sessions', map);
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

const CHAT_WELCOME = {
  headline: "Hello — I'm Tianhe, your trip concierge.",
  sub: "Ask about restaurants, timing, weather, or what to swap in your itinerary."
};

function renderChatMessages() {
  if (!els.chatMessages) return;
  const hasMessages = state.chatHistory.length > 0;
  const welcomeHtml = hasMessages ? '' : `
    <div class="chat-msg-assistant chat-msg-welcome">
      <span class="chat-role-label">Tianhe</span>
      ${esc(CHAT_WELCOME.headline)}
      <span class="chat-msg-sub">${esc(CHAT_WELCOME.sub)}</span>
    </div>`;
  const messagesHtml = state.chatHistory.map((msg) => {
    let html = esc(msg.content || '');
    if (msg.role === 'assistant') {
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      html = html.replace(/(^|[^"'>])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">link</a>');
      return `<div class="chat-msg-assistant"><span class="chat-role-label">Tianhe</span>${html}</div>`;
    }
    return `<div class="chat-msg-user">${html}</div>`;
  }).join('');
  const typingHtml = state.chatLoading ? '<div class="chat-typing" aria-label="Tianhe is typing"><span></span><span></span><span></span></div>' : '';
  els.chatMessages.innerHTML = welcomeHtml + messagesHtml + typingHtml;
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  renderChatSuggestions();
}

function renderChatSuggestions() {
  const container = els.chatSuggestions;
  if (!container) return;
  const label = STEP_LABELS[state.step];
  const questions = STEP_SUGGESTED_QUESTIONS[label];
  const suppressed = state.chatSuggestionsSuppressedForStep === state.step;
  if (suppressed || !questions) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  container.classList.remove('hidden');
  const collapsed = !!state.chatSuggestionsCollapsed;
  container.classList.toggle('chat-suggestions--collapsed', collapsed);
  const toggleIcon = collapsed ? 'ph-caret-down' : 'ph-caret-up';
  const toggleLabel = collapsed ? 'Show suggestions' : 'Hide suggestions';
  const chipsHtml = collapsed ? '' : questions.map((q) => `
    <button type="button" class="chat-suggestion-chip">
      <span class="chat-suggestion-icon"><i class="ph-bold ${q.icon}" aria-hidden="true"></i></span>
      <span class="chat-suggestion-text">${esc(q.text)}</span>
      <span class="chat-suggestion-arrow" aria-hidden="true">→</span>
    </button>`).join('');
  container.innerHTML = `
    <button type="button" class="chat-suggestions-label" aria-expanded="${!collapsed}" aria-label="${toggleLabel}">
      <span>Try asking</span>
      <i class="ph-bold ${toggleIcon}" aria-hidden="true"></i>
    </button>${chipsHtml}`;
  container.querySelector('.chat-suggestions-label').addEventListener('click', () => {
    state.chatSuggestionsCollapsed = !state.chatSuggestionsCollapsed;
    renderChatSuggestions();
  });
  container.querySelectorAll('.chat-suggestion-chip').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      els.chatInput.value = questions[i].text;
      sendChatMessage();
    });
  });
}

function setChatOpen(isOpen) {
  state.chatOpen = isOpen;
  els.chatPanel.classList.toggle('hidden', !isOpen);
  const widget = document.getElementById('chatWidget');
  if (widget) widget.setAttribute('data-state', isOpen ? 'expanded' : 'collapsed');
  if (isOpen) {
    setTimeout(() => { els.chatInput?.focus(); }, 320);
  }
}

function updateChatSendEnabled() {
  if (!els.chatSend) return;
  const hasText = (els.chatInput?.value || '').trim().length > 0;
  els.chatSend.disabled = !hasText || state.chatLoading;
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
  state.chatSuggestionsSuppressedForStep = state.step;
  els.chatInput.value = '';
  state.chatLoading = true;
  renderChatMessages();
  updateChatSendEnabled();

  try {
    const res = await apiFetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: ensureChatSessionId(),
        message,
        tripContext: getTripContext(),
        tripId: state.currentItineraryId || null
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Chat failed');
    state.chatHistory.push({
      role: 'assistant',
      content: data.reply || "I couldn't reach my brain just now — try again in a moment."
    });
  } catch (err) {
    state.chatHistory.push({
      role: 'assistant',
      content: err.message || "I couldn't reach my brain just now — try again in a moment."
    });
  } finally {
    state.chatLoading = false;
    renderChatMessages();
    updateChatSendEnabled();
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
  state.chatSuggestionsSuppressedForStep = null;
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
  els.chatInput.addEventListener('input', updateChatSendEnabled);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.chatOpen) setChatOpen(false);
  });
  updateChatSendEnabled();
}

function mountPlanningOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'planningOverlay';
  overlay.className = 'planning-overlay hidden';
  overlay.innerHTML = `
    <div class="planning-overlay-card">
      <div class="planning-globe" aria-hidden="true">
        <svg viewBox="0 0 220 150" class="globe-svg" role="presentation" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="pgOcean" cx="38%" cy="30%" r="82%">
              <stop offset="0%" stop-color="#5aa2f2"/><stop offset="52%" stop-color="#1c5fae"/><stop offset="100%" stop-color="#0b2c58"/>
            </radialGradient>
            <radialGradient id="pgGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(42,125,225,.55)"/><stop offset="100%" stop-color="rgba(42,125,225,0)"/>
            </radialGradient>
            <clipPath id="pgClip"><circle cx="110" cy="78" r="52"/></clipPath>
          </defs>
          <circle cx="110" cy="78" r="72" fill="url(#pgGlow)"/>
          <circle cx="110" cy="78" r="52" fill="url(#pgOcean)"/>
          <g clip-path="url(#pgClip)" fill="none" stroke="rgba(245,240,235,.22)" stroke-width="1">
            <ellipse cx="110" cy="78" rx="18" ry="52"/><ellipse cx="110" cy="78" rx="38" ry="52"/>
            <line x1="110" y1="26" x2="110" y2="130"/>
            <ellipse cx="110" cy="78" rx="52" ry="20"/><ellipse cx="110" cy="78" rx="52" ry="40"/>
            <line x1="58" y1="78" x2="162" y2="78"/>
          </g>
          <ellipse cx="92" cy="56" rx="19" ry="11" fill="rgba(245,240,235,.16)" transform="rotate(-30 92 56)"/>
          <g transform="rotate(-13 110 78)">
            <path d="M196,78 A86,24 0 1,1 24,78 A86,24 0 1,1 196,78" fill="none" stroke="rgba(109,176,255,.6)" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1 7" class="orbit-route"/>
            <g class="plane">
              <path d="M12,0 L-7,-7 L-2,-2 L-12,-2 L-9,0 L-12,2 L-2,2 L-7,7 Z" fill="#F7F3EE" stroke="#0b2c58" stroke-width=".6" stroke-linejoin="round"/>
            </g>
          </g>
        </svg>
      </div>
      <div class="planning-trip" data-trip-name></div>
      <div class="planning-status" data-city-status></div>
      <div class="planning-progress" data-progress></div>
      <div class="planning-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="planning-bar-fill" data-progress-fill>
          <span class="planning-bar-plane" aria-hidden="true">
            <svg viewBox="-13 -8 27 16" xmlns="http://www.w3.org/2000/svg">
              <path d="M12,0 L-7,-7 L-2,-2 L-12,-2 L-9,0 L-12,2 L-2,2 L-7,7 Z" fill="#F7F3EE" stroke="#0b2c58" stroke-width=".6" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
      </div>
      <div class="planning-message loading-visible" data-loading-message></div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function getSnapshot() {
  return persist.loadJson(SNAPSHOT_KEY, null);
}

function showRegenerateConfirmDialog(changedCities) {
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

    function renderPhase1(prevSelected) {
      const cityCheckboxes = allCityNames.map((name, i) => `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
          <input type="checkbox" class="regen-city-cb" data-index="${i}"
            ${prevSelected.includes(name) ? 'checked' : ''}
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

    renderPhase1(changedCities);
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

// cityPlanningInputs, changedCityNames provided by /shared/cityChanges.js

// Parsing the stored fingerprint back is load-bearing, not a formality: step1Snapshot returns live
// references into state.cities, so the stringify at plan time is what froze a copy that later edits
// cannot reach through.
function citiesChangedSincePlan() {
  if (!state.lastPlannedFingerprint) return [];
  return changedCityNames(JSON.parse(state.lastPlannedFingerprint), step1Snapshot());
}

function step1Snapshot() {
  const budgetVal = parseFloat(els.tripBudget?.value);
  const budget = Number.isFinite(budgetVal) && budgetVal > 0 ? budgetVal : null;
  const travelers = Math.max(1, parseInt(els.numTravelers?.value, 10) || 1);
  const children = Math.max(0, parseInt(els.numChildren?.value, 10) || 0);
  return { cities: state.cities, travels: state.travels, budget, travelers, children };
}

function step1Fingerprint() {
  return JSON.stringify(step1Snapshot());
}

function clearSnapshot() {
  persist.remove(SNAPSHOT_KEY);
  syncToServer('snapshot', null);
}

function saveSnapshot() {
  syncTripMetaFromInputs();

  const payload = {
    cities: state.cities,
    travels: state.travels,
    activities: state.activities,
    placements: state.placements,
    arrangedSignatures: state.arrangedSignatures,
    commutes: state.commutes,
    reviewed: state.reviewed,
    tripName: state.tripName,
    days: state.days,
    arrangeCity: state.arrangeCity,
    currentStep: state.step,
    tripBudget: state.tripBudget,
    numTravelers: state.numTravelers,
    numChildren: state.numChildren,
    bookingChecklist: state.bookingChecklist,
    bookingChecklistNotificationPrefs: state.bookingChecklistNotificationPrefs,
    bookingChecklistIssueMeta: state.bookingChecklistIssueMeta,
    currentItineraryId: state.currentItineraryId || null
  };
  persist.saveJson(SNAPSHOT_KEY, payload);
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
        arrangedSignatures: state.arrangedSignatures,
        commutes: state.commutes,
        reviewed: state.reviewed,
        days: state.days,
        bookingChecklist: {
          checklist: state.bookingChecklist,
          notificationPrefs: state.bookingChecklistNotificationPrefs,
          issueMeta: state.bookingChecklistIssueMeta
        },
        schedulingPrefs: state.schedulingPrefs || defaultSchedulingPrefs()
      })
    }).catch(() => {});
  }

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
  state.arrangedSignatures = {};
  state.itinerary = null;
  state.currentItineraryId = null;
  state.commutes = {};
  state.arrangeCity = null;
  state.chatHistory = [];
  state.chatLoading = false;
  state.reviewFilters = { search: '', city: '', type: '', verdict: '', sort: '' };
  state.bookingChecklist = [];
  state.tripHealth = null;
  state.bookingChecklistIssueMeta = {};
  clearSchedulingPrefs();

  els.tripName.value = '';
  if (els.reviewSearch) els.reviewSearch.value = '';
  if (els.reviewCityFilter) els.reviewCityFilter.value = '';
  if (els.reviewTypeFilter) els.reviewTypeFilter.value = '';
  if (els.reviewVerdictFilter) els.reviewVerdictFilter.value = '';
  if (els.reviewSortFilter) els.reviewSortFilter.value = '';
  renderCities();
  addCityRow();
  renderActivities();
  clearItineraryColumns();
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
  state.arrangedSignatures = snapshot.arrangedSignatures || {};
  state.commutes = normalizeCommuteStateMap(snapshot.commutes || {});
  state.reviewed = snapshot.reviewed || {};
  const snapshotDays = Array.isArray(snapshot.days) ? snapshot.days : [];
  state.days = daysMatchCities(snapshotDays, state.cities)
    ? snapshotDays
    : expandDays(state.cities);
  state.arrangeCity = snapshot.arrangeCity || state.days[0]?.city || null;

  state.currentItineraryId = snapshot.currentItineraryId || null;
  state.tripBudget = snapshot.tripBudget ?? null;
  state.numTravelers = snapshot.numTravelers ?? 1;
  state.numChildren = snapshot.numChildren ?? 0;
  state.bookingChecklist = Array.isArray(snapshot.bookingChecklist)
    ? snapshot.bookingChecklist.map(normalizeChecklistItem)
    : [];
  state.bookingChecklistNotificationPrefs = snapshot.bookingChecklistNotificationPrefs || state.bookingChecklistNotificationPrefs;
  state.bookingChecklistIssueMeta = snapshot.bookingChecklistIssueMeta || {};

  els.tripName.value = state.tripName;
  if (els.tripBudget && state.tripBudget != null) els.tripBudget.value = state.tripBudget;
  if (els.numTravelers) els.numTravelers.value = state.numTravelers;
  if (els.numChildren) els.numChildren.value = state.numChildren;
  renderCities();

  // A snapshot saved before the zero-city guard existed can hold currentStep >= 2 with no cities,
  // which is the one restore path that reaches a step the four interactive guards protect.
  const savedStep = Math.min(snapshot.currentStep || 3, 4);
  const targetStep = state.cities.length ? savedStep : 1;
  if (targetStep >= 2) renderActivities();
  if (targetStep >= 3) renderArrange();
  if (targetStep >= 4) renderItinerary();

  state.lastPlannedFingerprint = step1Fingerprint();
  setStep(targetStep);
}

function collectMyTrips() {
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
      detail: `${generatedDate} · ${Number(item.days || 0)} days · ${Number(item.activityCount || 0)} activities`
    });
  });

  return trips;
}

function tripRowMarkup(trip) {
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
        <p>${esc(trip.detail)}</p>
      </div>
      <div class="saved-itinerary-actions">
        <button type="button" class="secondary" data-load-trip="${esc(trip.id)}">Open</button>
        <button type="button" class="secondary" data-delete-trip="${esc(trip.id)}">Delete</button>
      </div>
    </article>`;
}

// Renders trip rows into listEl and wires actions. onPick fires after a trip is
// opened/resumed; onChange fires after a deletion (so callers can re-render/close).
function bindTripRows(listEl, trips, { onPick, onChange } = {}) {
  const snapshot = trips.find((t) => t.type === 'draft')?.snapshot || null;
  listEl.innerHTML = trips.map(tripRowMarkup).join('');

  const resumeBtn = listEl.querySelector('[data-resume-draft]');
  if (resumeBtn && snapshot) {
    resumeBtn.addEventListener('click', () => {
      hydrateFromSnapshot(snapshot);
      onPick?.();
    });
  }

  const deleteDraftBtn = listEl.querySelector('[data-delete-draft]');
  if (deleteDraftBtn) {
    deleteDraftBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog('Delete draft?', 'Your in-progress draft will be permanently deleted.', 'Delete');
      if (!confirmed) return;
      clearSnapshot();
      resetChatSession();
      renderMyTrips();
      resetToFresh();
      onChange?.();
    });
  }

  listEl.querySelectorAll('[data-load-trip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      loadItineraryById(btn.dataset.loadTrip);
      onPick?.();
    });
  });

  listEl.querySelectorAll('[data-delete-trip]').forEach((btn) => {
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
        onChange?.();
      } catch {
        showErrorBanner('Could not delete trip.');
      }
    });
  });
}

function renderMyTrips() {
  if (!els.myTripsPanel || !els.myTripsList) return;

  const trips = collectMyTrips();
  if (!trips.length) {
    els.myTripsPanel.classList.add('hidden');
    resetToFresh();
    return;
  }

  els.myTripsPanel.classList.remove('hidden');
  bindTripRows(els.myTripsList, trips);
  resetToFresh();
}

function showResumeTripsPopup() {
  const trips = collectMyTrips();
  if (!trips.length) return;
  if (document.getElementById('resumeTripsModal')) return;

  const modal = document.createElement('div');
  modal.id = 'resumeTripsModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:560px;gap:16px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="text-align:left">
          <h3 style="margin:0">Welcome back</h3>
          <p class="muted-text" style="margin:4px 0 0">Pick up where you left off, or start something new.</p>
        </div>
        <button id="resumeTripsClose" class="icon-btn" type="button" aria-label="Close"><i class="ph-bold ph-x" aria-hidden="true"></i></button>
      </div>
      <div id="resumeTripsList" class="saved-itineraries-list"></div>
      <button id="resumeTripsNew" class="secondary" type="button" style="align-self:stretch">Start a new trip</button>
    </div>`;
  document.body.appendChild(modal);
  refreshOverlayInterlocks();

  const close = () => {
    modal.remove();
    refreshOverlayInterlocks();
  };

  bindTripRows(modal.querySelector('#resumeTripsList'), trips, { onPick: close, onChange: close });

  modal.querySelector('#resumeTripsClose').addEventListener('click', close);
  modal.querySelector('#resumeTripsNew').addEventListener('click', () => {
    close();
    resetToFresh();
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

async function maybeLoadSharedItineraryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromPath = window.location.pathname.match(/^\/trip\/([^/]+)/)?.[1];
  const itineraryId = decodeURIComponent(fromPath || params.get('itinerary') || '').trim();

  if (!itineraryId) return false;

  try {
    await loadPublicSharedItinerary(itineraryId);
    setViewMode('itinerary');
    return true;
  } catch {
    const offline = loadMinimalOfflinePayload(itineraryId);
    if (!offline) return false;

    const offlineRows = Array.isArray(offline.itineraryRows)
      ? offline.itineraryRows
      : (Array.isArray(offline.executionRows) ? offline.executionRows : []);

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
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
    .catch(() => {});
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
  if (els.syncGoogleCalendarBtn) els.syncGoogleCalendarBtn.disabled = !hasItinerary;
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

    const popup = window.open(data.authUrl, 'googleCalendarOAuth', 'width=520,height=640,noopener=no');
    setCalendarStatus('Waiting for Google authorization…');

    const deadline = Date.now() + (2 * 60 * 1000);
    const poll = async () => {
      let connected = false;
      try {
        const statusRes = await apiFetch('/api/calendar/google/status');
        if (statusRes.ok) connected = Boolean((await statusRes.json())?.connected);
      } catch {}

      if (connected) {
        state.googleCalendarConnected = true;
        updateCalendarControls();
        try { popup?.close(); } catch {}
        await syncGoogleCalendar();
        return;
      }
      if (Date.now() > deadline) {
        setCalendarStatus('Google connection timed out. Please try again.');
        return;
      }
      if (popup && popup.closed) {
        setCalendarStatus('Google connection cancelled.');
        return;
      }
      setTimeout(poll, 2000);
    };
    setTimeout(poll, 2000);
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

function readInviteCodeFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get('invite');
    return code ? code.trim() : '';
  } catch {
    return '';
  }
}

function clearInviteCodeFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('invite')) return;
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());
  } catch {}
}

async function enforceEntitlementGate() {
  let entitled = false;
  try {
    const res = await apiFetch('/api/auth/entitlement', { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const body = await res.json();
      entitled = Boolean(body?.entitled);
    }
  } catch {}
  if (entitled) {
    clearInviteCodeFromUrl();
    return true;
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'entitlement-gate';
    overlay.innerHTML = `
      <div class="entitlement-card">
        <h1>Private beta</h1>
        <p>YunHai is invite-only right now. Enter your access code to continue.</p>
        <form class="entitlement-form">
          <input type="text" name="code" placeholder="Access code" autocomplete="off" required />
          <div class="entitlement-error hidden"></div>
          <button type="submit">Unlock</button>
        </form>
        <p class="entitlement-foot">Don't have a code? Ask whoever invited you, or <a href="#" data-signout>sign out</a>.</p>
      </div>
    `;
    document.body.appendChild(overlay);

    const form = overlay.querySelector('.entitlement-form');
    const input = form.querySelector('input[name="code"]');
    const errorEl = overlay.querySelector('.entitlement-error');
    const signOut = overlay.querySelector('[data-signout]');

    const showError = (msg) => {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.classList.add('hidden');
      const code = input.value.trim();
      if (!code) return;
      let res;
      try {
        res = await apiFetch('/api/auth/redeem-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ code })
        });
      } catch (err) {
        showError(`Network error: ${err?.message || err}`);
        return;
      }
      let data;
      try {
        data = await res.json();
      } catch (err) {
        showError(`Could not parse response (status ${res.status})`);
        return;
      }
      if (data?.ok) {
        clearInviteCodeFromUrl();
        overlay.remove();
        resolve(true);
        return;
      }
      const reasons = {
        invalid: 'That code isn’t recognized.',
        already_used: 'That code has already been used.',
        already_entitled: 'Your account already has access — reload the page.'
      };
      showError(reasons[data?.reason] || `Could not redeem code (reason=${data?.reason || 'unknown'})`);
    });

    signOut.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await window.Clerk?.signOut({ redirectUrl: window.location.href }); } catch {}
    });

    const presetCode = readInviteCodeFromUrl();
    if (presetCode) {
      input.value = presetCode;
      form.requestSubmit();
    } else {
      input.focus();
    }
  });
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

function initEmbedMode() {
  document.body.classList.add('is-embed');
  state.authReady = true;
  state.maxStep = 4;
  state.authUserId = 'demo-embed';
  state.authUserEmail = 'demo@yunhai.app';
  state.profilesStore = loadProfiles();
  state.profile = normalizeProfile(getActiveProfile(state.profilesStore));
  state.schedulingPrefs = loadSchedulingPrefs();
  mountPlanningOverlay();

  state.tripName = 'Andalucía Spring';
  els.tripName.value = state.tripName;
  addCityRow({
    id: uid(),
    name: 'Córdoba, Spain',
    startDate: '2026-04-24',
    endDate: '2026-04-26',
    leaveTime: '18:00',
    notes: '',
    detailsExpanded: false
  });

  window.setStep = setStep;
  window.addCityRow = addCityRow;
  window.renderCities = renderCities;
  window.uid = uid;

  // Demo-reel hooks: seed mock state and force renders without the live AI.
  window.applyDemoState = (partial) => Object.assign(state, partial);
  window.renderActivities = renderActivities;
  window.renderArrange = renderArrange;
  window.renderItinerary = renderItinerary;
  window.replaceActivityInState = replaceActivityInState;
  window.openChecklistModal = openChecklistModal;
  window.renderChecklistModal = renderChecklistModal;
}

function clearPlannedResultsKeepSetup() {
  state.activities = [];
  state.reviewed = {};
  state.days = [];
  state.placements = {};
  state.arrangedSignatures = {};
  state.itinerary = null;
  state.currentItineraryId = null;
  state.commutes = {};
  state.arrangeCity = null;
  renderActivities();
  clearItineraryColumns();
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
els.reviewTypeFilter?.addEventListener('change', (e) => {
  state.reviewFilters.type = e.target.value || '';
  renderActivities();
});
els.reviewVerdictFilter?.addEventListener('change', (e) => {
  state.reviewFilters.verdict = e.target.value || '';
  renderActivities();
});
els.reviewSortFilter?.addEventListener('change', (e) => {
  state.reviewFilters.sort = e.target.value || '';
  renderActivities();
});
els.approveVisibleBtn?.addEventListener('click', () => applyVerdictToVisibleActivities(true));

document.querySelectorAll('.save-progress-btn').forEach((btn) => btn.addEventListener('click', saveSnapshot));
els.schedulingWizardBtn?.addEventListener('click', () => {
  openSchedulingWizard(state.schedulingPrefs, {
    onSave: (saved) => { saveSchedulingPrefs(saved); }
  });
});
els.finalizeArrangeBtn?.addEventListener('click', openFinalizeModal);
els.downloadCalendarBtn?.addEventListener('click', () => {
  if (!state.currentItineraryId) return;
  const metadataMode = encodeURIComponent(state.calendarMetadataMode || 'compact');
  window.open(`/api/itinerary/${encodeURIComponent(state.currentItineraryId)}/calendar.ics?metadata=${metadataMode}`, '_blank');
});
els.connectGoogleCalendarBtn?.addEventListener('click', connectGoogleCalendar);
els.syncGoogleCalendarBtn?.addEventListener('click', () => {
  if (!state.googleCalendarConnected) {
    connectGoogleCalendar();
    return;
  }
  syncGoogleCalendar();
});
document.getElementById('savePdfBtn')?.addEventListener('click', () => {
  if (window.exportItineraryPdf) {
    window.exportItineraryPdf().catch((err) => {
      console.error('PDF export failed', err);
      showErrorBanner(err?.message || 'PDF export failed');
    });
  } else {
    window.print();
  }
});
document.getElementById('shareTripLinkBtn')?.addEventListener('click', () => {
  const id = state.currentItineraryId;
  if (!id) { showErrorBanner('Save your trip first'); return; }
  const url = `${window.location.origin}/trip/${encodeURIComponent(id)}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).catch(() => showErrorBanner(`Could not copy — share link: ${url}`));
  } else {
    showErrorBanner(`Could not copy — share link: ${url}`);
  }
});
document.getElementById('lockTripBtn')?.addEventListener('click', () => {
  if (typeof openFinalizeModal === 'function') {
    openFinalizeModal();
  }
});
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
  if (!btn || btn.disabled) return;
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
  } else if (action === 'navigate') {
    const href = btn.dataset.href;
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  }
});

// Itinerary send-tile buttons (mirror Finalize handlers)
document.getElementById('syncGoogleCalendarBtnItin')?.addEventListener('click', () => {
  if (!state.googleCalendarConnected) {
    connectGoogleCalendar();
    return;
  }
  syncGoogleCalendar();
});
document.getElementById('shareTripLinkBtnItin')?.addEventListener('click', () => {
  document.getElementById('shareTripLinkBtn')?.click();
});
document.getElementById('savePdfBtnItin')?.addEventListener('click', () => {
  if (window.exportItineraryPdf) {
    window.exportItineraryPdf().catch((err) => {
      console.error('PDF export failed', err);
      showErrorBanner(err?.message || 'PDF export failed');
    });
  } else {
    window.print();
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
  overlayManager.close('attachmentViewerModal');
});
els.attachmentViewerModal?.addEventListener('click', (e) => {
  if (e.target === els.attachmentViewerModal) overlayManager.close('attachmentViewerModal');
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
function persistLearnedPrefs() {
  const lp = state.learnedPrefs;
  if (!lp) return;
  apiFetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ constraints: lp.constraints, preferences: lp.preferences, profileInstruction: lp.profileInstruction })
  }).catch(() => {});
}

function learnedListFor(kind) {
  const lp = state.learnedPrefs;
  if (!lp) return null;
  if (kind === 'constraint') return lp.constraints || (lp.constraints = []);
  return lp.preferences || (lp.preferences = []);
}

function startLearnedEdit(tag) {
  if (tag.classList.contains('editing')) return;
  const textEl = tag.querySelector('.learned-pref-text');
  const current = tag.dataset.text;
  tag.classList.add('editing');
  const input = document.createElement('textarea');
  input.className = 'learned-pref-edit-input';
  input.rows = 1;
  input.value = current;
  textEl.replaceWith(input);
  const autosize = () => {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  };
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  autosize();
  input.addEventListener('input', autosize);

  const commit = () => {
    const next = input.value.trim().replace(/\s+/g, ' ');
    const kind = tag.dataset.kind;
    const list = learnedListFor(kind);
    if (!list) return renderLearnedPrefs();
    const dup = list.some((i) => i.text.toLowerCase() === next.toLowerCase() && i.text !== current);
    if (!next || dup || next === current) return renderLearnedPrefs();
    const idx = list.findIndex((i) => i.text === current);
    if (idx === -1) return renderLearnedPrefs();
    list[idx] = { ...list[idx], text: next };
    persistLearnedPrefs();
    renderLearnedPrefs();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); input.removeEventListener('blur', commit); renderLearnedPrefs(); }
  });
  input.addEventListener('blur', commit);
}

els.learnedPrefsTags?.addEventListener('input', (e) => {
  const search = e.target.closest('.learned-search');
  if (!search) return;
  state.learnedFilter = search.value;
  renderLearnedPrefs();
});

els.learnedPrefsTags?.addEventListener('click', async (e) => {
  const header = e.target.closest('.learned-group-header');
  if (header) {
    const group = header.closest('.learned-group');
    const id = group?.dataset.cat;
    if (!id) return;
    const set = state.learnedCollapsed || (state.learnedCollapsed = new Set());
    if (set.has(id)) set.delete(id); else set.add(id);
    group.classList.toggle('collapsed');
    return;
  }

  const tag = e.target.closest('.learned-pref-tag');
  if (!tag) return;

  if (e.target.closest('.learned-pref-edit')) {
    startLearnedEdit(tag);
    return;
  }

  if (e.target.closest('.learned-pref-remove')) {
    const kind = tag.dataset.kind;
    const text = tag.dataset.text;
    const ok = await showConfirmDialog(
      'Remove this?',
      `"${text}" will be removed from what the planner has learned.`,
      'Remove'
    );
    if (!ok) return;
    const list = learnedListFor(kind);
    if (!list) return;
    if (kind === 'constraint') state.learnedPrefs.constraints = list.filter((c) => c.text !== text);
    else state.learnedPrefs.preferences = list.filter((p) => p.text !== text);
    persistLearnedPrefs();
    renderLearnedPrefs();
  }
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
  overlayManager.open('textareaExpandModal');
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
  overlayManager.close('textareaExpandModal');
  expandTargetId = null;
}

document.getElementById('textareaExpandClose').addEventListener('click', () => closeExpandModal(false));
document.getElementById('textareaExpandSave').addEventListener('click', () => closeExpandModal(true));
expandModal.querySelector('.textarea-expand-backdrop').addEventListener('click', () => closeExpandModal(false));
expandModal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeExpandModal(false); });

bindTextareaExpandButtons(document);
els.profileEditBtn.addEventListener('click', async () => {
  const next = getProfilePayload();

  const prev = profileSnapshot ? JSON.parse(profileSnapshot) : null;
  const profileChanged = !prev ||
    JSON.stringify(next.answers) !== JSON.stringify(prev.answers) ||
    next.aboutMe !== prev.aboutMe;

  saveProfile(next);
  profileSnapshot = JSON.stringify(next);

  if (!profileChanged) {
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
    } else {
      showErrorBanner('Profile saved, but AI summary update failed.');
    }
  } catch {
    showErrorBanner('Profile saved, but AI summary update failed.');
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
els.tripHealthBadge?.addEventListener('click', () => els.tripHealthPopover?.classList.toggle('hidden'));
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
els.openTripHealthReviewBtn?.addEventListener('click', () => {
  // The badge that opens this gates on `currentItineraryId || activities.length`, and removing a
  // city clears neither — so it stays visible and clickable from Setup after the last city is gone.
  // The popover closes either way: a click that leaves it open behind an error banner reads as if
  // nothing happened.
  els.tripHealthPopover?.classList.add('hidden');
  if (!canLeaveSetup()) return;
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
    if (target > 1 && !canLeaveSetup()) return;
    setStep(target);
  });
});

// Seed the initial history entry so the browser back button never leaves the SPA
history.replaceState({ spa: true, step: stepFromPath() }, '');

(async function init() {
  if (new URLSearchParams(location.search).has('embed')) {
    initEmbedMode();
    return;
  }

  try {
    await initClerkAuth();
  } catch (error) {
    if (els.apiBanner) {
      els.apiBanner.textContent = `Authentication required: ${error.message || 'Please sign in.'}`;
      els.apiBanner.classList.remove('hidden');
    }
    return;
  }

  const hasShareLink = /^\/trip\//.test(location.pathname)
    || new URLSearchParams(location.search).has('itinerary');
  if (!hasShareLink) {
    const entitled = await enforceEntitlementGate();
    if (!entitled) return;
  }

  state.profilesStore = loadProfiles();
  state.profile = normalizeProfile(getActiveProfile(state.profilesStore));
  state.schedulingPrefs = loadSchedulingPrefs();
  mountPlanningOverlay();
  mountActivityMapOverlay();
  bindChatEvents();
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
  if (!loadedFromShare) {
    renderMyTrips();
    showResumeTripsPopup();
    const bootStep = Math.min(stepFromPath(), state.maxStep);
    setStep(bootStep, { pushHistory: false });
    history.replaceState({ spa: true, step: bootStep }, '', stepPath(bootStep));
  }
})();
