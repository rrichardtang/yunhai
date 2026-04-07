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
  }
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
  { key: 'structuredTours', label: 'Do you like structured tours?', summary: 'Structured tours' }
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

const els = {
  steps: [...document.querySelectorAll('#stepIndicator .step')],
  panels: [1,2,3,4].map((n) => document.getElementById(`step${n}`)),
  tripName: document.getElementById('tripName'),
  citiesContainer: document.getElementById('citiesContainer'),
  accommodationsContainer: document.getElementById('accommodationsContainer'),
  travelEntryPoint: document.getElementById('travelEntryPoint'),
  travelEntryPointLat: document.getElementById('travelEntryPointLat'),
  travelEntryPointLng: document.getElementById('travelEntryPointLng'),
  travelEntryPointResolved: document.getElementById('travelEntryPointResolved'),
  locationValidationError: document.getElementById('locationValidationError'),
  travelEntryDateTime: document.getElementById('travelEntryDateTime'),
  addCityBtn: document.getElementById('addCityBtn'),
  sortCitiesBtn: document.getElementById('sortCitiesBtn'),
  setupInsights: document.getElementById('setupInsights'),
  planBtn: document.getElementById('planBtn'),
  activitiesGrid: document.getElementById('activitiesGrid'),
  reviewSearch: document.getElementById('reviewSearch'),
  reviewCityFilter: document.getElementById('reviewCityFilter'),
  reviewVerdictFilter: document.getElementById('reviewVerdictFilter'),
  approveVisibleBtn: document.getElementById('approveVisibleBtn'),
  clearVisibleBtn: document.getElementById('clearVisibleBtn'),
  continueArrangeBtn: document.getElementById('continueArrangeBtn'),
  backToSetupBtn: document.getElementById('backToSetupBtn'),
  continueArrangeHint: document.getElementById('continueArrangeHint'),
  budgetTracker: document.getElementById('budgetTracker'),
  arrangeCityNav: document.getElementById('arrangeCityNav'),
  dayColumns: document.getElementById('dayColumns'),
  stagingArea: document.getElementById('stagingArea'),
  backToReviewBtn: document.getElementById('backToReviewBtn'),
  generateBtn: document.getElementById('generateBtn'),
  itineraryInsights: document.getElementById('itineraryInsights'),
  itineraryGrid: document.getElementById('itineraryGrid'),
  downloadCalendarBtn: document.getElementById('downloadCalendarBtn'),
  savedItineraries: document.getElementById('savedItineraries'),
  editBtn: document.getElementById('editBtn'),
  apiBanner: document.getElementById('apiBanner'),
  preferencesLink: document.getElementById('preferencesLink'),
  prefsModal: document.getElementById('prefsModal'),
  prefsClose: document.getElementById('prefsClose'),
  profileSelector: document.getElementById('profileSelector'),
  profileNameInput: document.getElementById('profileNameInput'),
  newProfileBtn: document.getElementById('newProfileBtn'),
  deleteProfileBtn: document.getElementById('deleteProfileBtn'),
  profileQuestions: document.getElementById('profileQuestions'),
  profileTravelNotes: document.getElementById('profileTravelNotes'),
  profileEditBtn: document.getElementById('profileEditBtn'),
  saveProgressBtn: document.getElementById('saveProgressBtn'),
  autoArrangeBtn: document.getElementById('autoArrangeBtn'),
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

function setTravelResolvedAddress(text = '') {
  if (!els.travelEntryPointResolved) return;
  els.travelEntryPointResolved.textContent = text ? `Validated location: ${text}` : '';
}

function normalizeCoordinate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeAccommodation(accommodation = {}) {
  return {
    ...accommodation,
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

function markTravelEntryUnvalidated() {
  ensureSingleTravelEntry();
  state.travels[0].entryPointPlaceId = '';
  state.travels[0].entryPointLat = null;
  state.travels[0].entryPointLng = null;
  if (els.travelEntryPointLat) els.travelEntryPointLat.value = '';
  if (els.travelEntryPointLng) els.travelEntryPointLng.value = '';
  setTravelResolvedAddress('');
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
          await window.google.maps.importLibrary('places');
        }
        if (isGooglePlacesReady()) resolve(true);
        else reject(new Error('Google Places library failed to initialize.'));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Google Places library failed to initialize.'));
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

function extractResolvedPlace(placeLike) {
  const formattedAddress = String(
    placeLike?.formattedAddress
    || placeLike?.formatted_address
    || placeLike?.displayName?.text
    || ''
  ).trim();
  const placeId = String(placeLike?.id || placeLike?.place_id || '').trim();
  const latFn = placeLike?.location?.lat || placeLike?.geometry?.location?.lat;
  const lngFn = placeLike?.location?.lng || placeLike?.geometry?.location?.lng;
  const lat = typeof latFn === 'function' ? latFn.call(placeLike.location || placeLike.geometry?.location) : Number(latFn);
  const lng = typeof lngFn === 'function' ? lngFn.call(placeLike.location || placeLike.geometry?.location) : Number(lngFn);

  if (!formattedAddress || !placeId || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { formattedAddress, placeId, lat, lng };
}

async function resolvePlaceFromAutocompleteEvent(event, element) {
  const eventPlace = event?.detail?.place || event?.detail?.placeResult || event?.place;
  const fromEventPlace = extractResolvedPlace(eventPlace);
  if (fromEventPlace) return fromEventPlace;

  const prediction = event?.detail?.placePrediction || event?.placePrediction;
  if (prediction?.toPlace) {
    const place = prediction.toPlace();
    if (place?.fetchFields) {
      await place.fetchFields({ fields: ['id', 'formattedAddress', 'location'] });
    }
    const resolved = extractResolvedPlace(place);
    if (resolved) return resolved;
  }

  const componentPlace = typeof element?.getPlace === 'function' ? element.getPlace() : null;
  const resolvedFromComponent = extractResolvedPlace(componentPlace);
  if (resolvedFromComponent) return resolvedFromComponent;

  return null;
}

function attachPlaceAutocompleteElement(element, { onResolved, onInvalid, onInput }) {
  if (!element || !isGooglePlacesReady()) return;
  if (placesAutocompleteByElement.has(element)) return;

  const handleSelection = async (event) => {
    try {
      const resolved = await resolvePlaceFromAutocompleteEvent(event, element);
      if (!resolved) {
        if (typeof onInvalid === 'function') onInvalid();
        return;
      }
      if (typeof onResolved === 'function') onResolved(resolved);
    } catch {
      if (typeof onInvalid === 'function') onInvalid();
    }
  };

  element.addEventListener('gmp-placeselect', handleSelection);
  element.addEventListener('place_changed', handleSelection);

  const handleInput = () => {
    if (typeof onInput === 'function') onInput();
  };
  element.addEventListener('input', handleInput);
  element.addEventListener('change', handleInput);

  placesAutocompleteByElement.set(element, { handleSelection, handleInput });
}

function initializePlacesWidgets() {
  if (!isGooglePlacesReady()) return;

  if (els.travelEntryPoint) {
    attachPlaceAutocompleteElement(els.travelEntryPoint, {
      onResolved: ({ formattedAddress, placeId, lat, lng }) => {
        ensureSingleTravelEntry();
        state.travels[0].entryPoint = formattedAddress;
        state.travels[0].entryPointPlaceId = placeId;
        state.travels[0].entryPointLat = lat;
        state.travels[0].entryPointLng = lng;

        els.travelEntryPoint.value = formattedAddress;
        if (els.travelEntryPointLat) els.travelEntryPointLat.value = String(lat);
        if (els.travelEntryPointLng) els.travelEntryPointLng.value = String(lng);
        setTravelResolvedAddress(formattedAddress);
        clearLocationValidationError();
      },
      onInput: () => {
        markTravelEntryUnvalidated();
      },
      onInvalid: () => {
        markTravelEntryUnvalidated();
        showLocationValidationError('Could not validate the travel entry point. Please choose a suggestion from Google Places.');
      }
    });
  }

  state.cities.forEach((city) => {
    (city.accommodations || []).forEach((accommodation) => {
      const row = document.querySelector(`[data-hotel-id="${CSS.escape(accommodation.id || '')}"]`);
      const input = getAccommodationAutocompleteInput(row);
      if (!input) return;

      attachPlaceAutocompleteElement(input, {
        onResolved: ({ formattedAddress, placeId, lat, lng }) => {
          accommodation.address = formattedAddress;
          accommodation.placeId = placeId;
          accommodation.latitude = lat;
          accommodation.longitude = lng;
          input.value = formattedAddress;
          row.dataset.addressValidated = '1';
          const resolved = row.querySelector('[data-accommodation-resolved]');
          if (resolved) resolved.textContent = `Validated location: ${formattedAddress}`;
          clearLocationValidationError();
        },
        onInput: () => {
          accommodation.placeId = '';
          accommodation.latitude = null;
          accommodation.longitude = null;
          row.dataset.addressValidated = '0';
          const resolved = row.querySelector('[data-accommodation-resolved]');
          if (resolved) resolved.textContent = '';
        },
        onInvalid: () => {
          accommodation.placeId = '';
          accommodation.latitude = null;
          accommodation.longitude = null;
          row.dataset.addressValidated = '0';
          const resolved = row.querySelector('[data-accommodation-resolved]');
          if (resolved) resolved.textContent = 'Address could not be validated. Please choose a suggestion.';
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
  return normalized;
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

function addCityRow(city = { id: uid(), name: '', startDate: '', endDate: '', notes: '' }) {
  state.cities.push({
    ...city,
    notes: city.notes || '',
    accommodations: Array.isArray(city.accommodations)
      ? city.accommodations.map(normalizeAccommodation)
      : []
  });
  renderCities();
}

function addAccommodationRow(city) {
  if (!city) return;
  city.accommodations = Array.isArray(city.accommodations)
    ? city.accommodations
    : [];
  city.accommodations.push({
    id: uid(),
    type: 'hotel',
    name: '',
    address: '',
    placeId: '',
    latitude: null,
    longitude: null,
    checkIn: city.startDate || '',
    checkOut: city.endDate || ''
  });
  renderCities();
}

function ensureSingleTravelEntry() {
  const autoDateTime = getTripEntryDateTime();
  const existing = Array.isArray(state.travels) && state.travels.length ? state.travels[0] : null;
  state.travels = [{
    id: existing?.id || uid(),
    entryPoint: existing?.entryPoint || '',
    entryPointPlaceId: existing?.entryPointPlaceId || '',
    entryPointLat: normalizeCoordinate(existing?.entryPointLat),
    entryPointLng: normalizeCoordinate(existing?.entryPointLng),
    dateTime: autoDateTime
  }];
}

function getTripStartDate() {
  const dates = state.cities
    .map((city) => String(city?.startDate || '').slice(0, 10))
    .filter(Boolean)
    .sort();
  return dates[0] || '';
}

function getTripEntryDateTime() {
  const startDate = getTripStartDate();
  return startDate ? `${startDate}T09:00` : '';
}

function syncTravelDateTimes() {
  ensureSingleTravelEntry();
}

function renderTravels() {
  ensureSingleTravelEntry();
  const travel = state.travels[0];
  if (!travel) return;

  if (els.travelEntryPoint) {
    els.travelEntryPoint.value = travel.entryPoint || '';
  }
  if (els.travelEntryPointLat) {
    els.travelEntryPointLat.value = travel.entryPointLat == null ? '' : String(travel.entryPointLat);
  }
  if (els.travelEntryPointLng) {
    els.travelEntryPointLng.value = travel.entryPointLng == null ? '' : String(travel.entryPointLng);
  }
  setTravelResolvedAddress((travel.entryPointLat != null && travel.entryPointLng != null) ? travel.entryPoint : '');
  if (els.travelEntryDateTime) {
    els.travelEntryDateTime.value = travel.dateTime || '';
  }
}

function renderAccommodations() {
  if (!els.accommodationsContainer) return;
  els.accommodationsContainer.innerHTML = '';

  if (!state.cities.length) {
    els.accommodationsContainer.innerHTML = '<p class="muted-text">Add a city first to add accommodations.</p>';
    return;
  }

  state.cities.forEach((city) => {
    const card = document.createElement('div');
    card.className = 'city-hotels';
    card.innerHTML = `
      <div class="city-hotels-head">
        <strong>${esc(city.name || 'Unnamed city')}</strong>
        <button class="secondary" type="button" data-add-accommodation>+ Add accommodation</button>
      </div>
      <div class="city-hotels-list">
        ${(Array.isArray(city.accommodations) && city.accommodations.length)
          ? city.accommodations.map((accommodation) => `
            <div class="hotel-row" data-hotel-id="${esc(accommodation.id || '')}" data-address-validated="${accommodation.latitude != null && accommodation.longitude != null ? '1' : '0'}">
              <select data-accommodation-field="type">
                <option value="hotel" ${accommodation.type === 'hotel' ? 'selected' : ''}>Hotel</option>
                <option value="airbnb" ${accommodation.type === 'airbnb' ? 'selected' : ''}>Airbnb</option>
                <option value="hostel" ${accommodation.type === 'hostel' ? 'selected' : ''}>Hostel</option>
                <option value="guesthouse" ${accommodation.type === 'guesthouse' ? 'selected' : ''}>Guesthouse</option>
                <option value="other" ${accommodation.type === 'other' ? 'selected' : ''}>Other</option>
              </select>
              <input type="text" placeholder="Accommodation name" value="${esc(accommodation.name || '')}" data-accommodation-field="name" />
              <gmp-places-autocomplete
                data-accommodation-field="address"
                placeholder="Accommodation address"
                value="${esc(accommodation.address || '')}"
              ></gmp-places-autocomplete>
              <input type="date" value="${esc(accommodation.checkIn || '')}" data-accommodation-field="checkIn" />
              <input type="date" value="${esc(accommodation.checkOut || '')}" data-accommodation-field="checkOut" />
              <button class="secondary" type="button" data-remove-accommodation>Remove</button>
              <div class="muted-text" data-accommodation-resolved>${accommodation.latitude != null && accommodation.longitude != null ? `Validated location: ${esc(accommodation.address || '')}` : ''}</div>
            </div>
          `).join('')
          : '<p class="muted-text">No accommodations added for this city yet.</p>'}
      </div>
    `;

    card.querySelector('[data-add-accommodation]')?.addEventListener('click', () => addAccommodationRow(city));
    card.querySelectorAll('.hotel-row').forEach((hotelRow) => {
      const hotelId = hotelRow.dataset.hotelId;
      const hotel = (city.accommodations || []).find((h) => h.id === hotelId);
      if (!hotel) return;

      hotelRow.querySelectorAll('[data-accommodation-field]').forEach((input) => {
        if (input.dataset.accommodationField === 'address') return;
        input.addEventListener('input', () => {
          hotel[input.dataset.accommodationField] = input.value;
        });
      });

      hotelRow.querySelector('[data-remove-accommodation]')?.addEventListener('click', () => {
        city.accommodations = (city.accommodations || []).filter((h) => h.id !== hotelId);
        renderAccommodations();
      });
    });

    els.accommodationsContainer.appendChild(card);
  });

  initializePlacesWidgets();
}

function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
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

  const sorted = [...complete].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const totalDays = sorted.reduce((sum, c) => sum + daysBetween(c.startDate, c.endDate), 0);
  let overlapCount = 0;
  let reverseDateCount = 0;

  sorted.forEach((city, idx) => {
    if (new Date(city.endDate) < new Date(city.startDate)) reverseDateCount += 1;
    if (!idx) return;
    const prev = sorted[idx - 1];
    if (new Date(city.startDate) <= new Date(prev.endDate)) overlapCount += 1;
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
  const withDates = state.cities.filter((c) => c.startDate);
  const withoutDates = state.cities.filter((c) => !c.startDate);
  state.cities = [
    ...withDates.sort((a, b) => new Date(a.startDate) - new Date(b.startDate)),
    ...withoutDates
  ];
  renderCities();
  showToast('Cities sorted by start date.', 'success');
}

function renderCities() {
  bindCityAutocompleteOutsideClick();
  els.citiesContainer.innerHTML = '';
  state.cities.forEach((city) => {
    const row = document.createElement('div');
    row.className = 'city-row';
    row.innerHTML = `
      <div class="city-autocomplete">
        <gmp-places-autocomplete placeholder="City" value="${esc(city.name)}" data-field="name" autocomplete="off"></gmp-places-autocomplete>
        <div class="muted-text" data-city-resolved>${city.latitude != null && city.longitude != null ? `Validated location: ${esc(city.name)}` : ''}</div>
      </div>
      <input type="date" value="${esc(city.startDate)}" data-field="startDate" />
      <input type="date" value="${esc(city.endDate)}" data-field="endDate" />
      <input type="text" placeholder="Notes for this city (e.g. want to see FC Barcelona game)" value="${esc(city.notes || '')}" data-field="notes" />
      <button class="secondary" type="button" data-remove-city>Remove</button>
    `;
    const inputs = row.querySelectorAll('input[data-field]');
    inputs.forEach((input) => {
      input.addEventListener('input', () => {
        city[input.dataset.field] = input.value;
        if (input.dataset.field === 'name') {
          city.placeId = '';
          city.latitude = null;
          city.longitude = null;
          const resolved = row.querySelector('[data-city-resolved]');
          if (resolved) resolved.textContent = '';
        }
        syncTravelDateTimes();
        renderTravels();
        renderSetupInsights();
      });
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
          const resolved = row.querySelector('[data-city-resolved]');
          if (resolved) resolved.textContent = `Validated location: ${formattedAddress}`;
          clearLocationValidationError();
          renderSetupInsights();
        },
        onInput: () => {
          city.placeId = '';
          city.latitude = null;
          city.longitude = null;
          const resolved = row.querySelector('[data-city-resolved]');
          if (resolved) resolved.textContent = '';
        },
        onInvalid: () => {
          city.placeId = '';
          city.latitude = null;
          city.longitude = null;
          const resolved = row.querySelector('[data-city-resolved]');
          if (resolved) resolved.textContent = 'City could not be validated. Please choose a suggestion.';
          showLocationValidationError('City location is invalid. Please choose a Google Places suggestion.');
        }
      });
    }

    row.querySelector('[data-remove-city]')?.addEventListener('click', () => {
      if (cityAutocomplete.activeCityId === city.id) closeCityAutocomplete();
      state.cities = state.cities.filter((c) => c.id !== city.id);
      renderCities();
    });

    els.citiesContainer.appendChild(row);
  });

  renderSetupInsights();
  renderAccommodations();
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
    const label = profileLabel(active);
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
      if (labelEl) labelEl.textContent = profileLabel(nextAnswer);
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
  const res = await fetch('/api/status');
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
  console.log('[enrichImages] starting with', items.length, 'items');

  if (!Array.isArray(items) || !items.length) {
    const immediatePromise = Promise.resolve();
    console.log('[enrichImages] no items; created/returning immediate Promise:', immediatePromise);
    immediatePromise.then(() => {
      console.log('[enrichImages] immediate Promise resolved (no items)');
      console.log('[enrichImages] done');
    });
    return immediatePromise;
  }

  const itemsToFetch = items.filter((item) => item && !item.imageUrl && item.name);
  console.log('[enrichImages] items needing images:', itemsToFetch.map((i) => i.name));

  if (!itemsToFetch.length) {
    const immediatePromise = Promise.resolve();
    console.log('[enrichImages] no images to fetch; created/returning immediate Promise:', immediatePromise);
    immediatePromise.then(() => {
      console.log('[enrichImages] immediate Promise resolved (nothing to fetch)');
      console.log('[enrichImages] done');
    });
    return immediatePromise;
  }

  const enrichmentPromise = Promise.all(itemsToFetch.map(async (item) => {
    try {
      const name = String(item.name || '');
      const city = String(item.city || '');
      console.log('[enrichImages] fetching image for:', name, city);
      const params = new URLSearchParams({ q: name, city });
      const url = `/api/image?${params.toString()}`;
      console.log('[image fetch] url=', url);
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      console.log('[enrichImages] got response:', data);
      if (data?.imageUrl) item.imageUrl = data.imageUrl;
    } catch (err) {
      console.error('[image fetch error]', err);
    }
  }));

  console.log('[enrichImages] created/returning Promise:', enrichmentPromise);
  return enrichmentPromise.then((result) => {
    console.log('[enrichImages] Promise resolved');
    console.log('[enrichImages] done');
    return result;
  }).catch((err) => {
    console.error('[enrichImages] Promise rejected', err);
    throw err;
  });
}

function renderActivities() {
  console.log('[renderActivities] step=', state.step, 'activity count=', state.activities.length);
  renderBudget();
  updateReviewNav();
  populateReviewCityFilter();

  if (state.step === 2 && !reviewImageEnrichInFlight) {
    console.log('[renderActivities] step 2 detected, calling enrichImages');
    reviewImageEnrichInFlight = true;
    console.log('[renderActivities] enrichment start');
    const enrichPromise = enrichImages(state.activities);
    console.log('[renderActivities] enrichPromise returned:', enrichPromise);
    enrichPromise.then(() => {
      console.log('[renderActivities] enrichPromise.then() fired!');
      if (state.step === 2) {
        renderActivities(); // Re-render cards to display loaded images
      }
    }).catch((err) => {
      console.error('[renderActivities] enrichPromise rejected:', err);
    }).finally(() => {
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

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 24;
const PX_PER_HOUR = 60;
const GRID_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * PX_PER_HOUR;

function formatDuration(hours = 1) {
  const h = Number(hours || 1);
  return Number.isInteger(h) ? `${h}h` : `${h}h`;
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

function makeCommuteIndicator(currentItem, nextItem) {
  const placement = state.placements[currentItem.id] || {};
  const time = parseTimeTo24(placement.time || currentItem.suggested_time || typeToTime(currentItem.type));
  const h = Math.max(28, Number(currentItem.duration_hours || 1) * PX_PER_HOUR);
  const y = yFromTime(time) + h + 6;
  const commute = state.commutes[commutePairKey(currentItem.id, nextItem.id)] || null;
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
      <div class="commute-selector" data-from-id="${esc(currentItem.id)}" data-to-id="${esc(nextItem.id)}">
        <button type="button" class="commute-selector-trigger" aria-expanded="false">
          <span class="commute-selected-label">${esc(formatCommuteBadge(commute))}</span>
          <span class="commute-selector-arrow" aria-hidden="true">▾</span>
        </button>
        <div class="commute-selector-menu" role="menu">${options}</div>
      </div>
    </div>
  `;
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
  console.log('[render] state.commutes=', state.commutes);
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

    let html = '';
    items.forEach((item, index) => {
      html += makePlacedCard(item);
      if (index < items.length - 1) {
        html += makeCommuteIndicator(item, items[index + 1]);
      }
    });

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
    const res = await fetch('/api/commute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities })
    });
    const data = await res.json();
    console.log('[commute response]', data);
    return Array.isArray(data?.commutes) ? data.commutes : [];
  } catch (err) {
    console.error('[commute error]', err);
    return [];
  }
}

function applyCommuteTimeAdjustments(dayId, orderedActivities = [], commutes = []) {
  if (!dayId || orderedActivities.length < 2 || !commutes.length) return;
  const commuteMap = new Map(commutes.map((c) => [commutePairKey(c.fromId, c.toId), c]));

  for (let i = 1; i < orderedActivities.length; i += 1) {
    const current = orderedActivities[i];
    const previous = orderedActivities[i - 1];
    const commute = commuteMap.get(commutePairKey(previous.id, current.id));
    if (!commute) continue;

    const prevPlacement = state.placements[previous.id] || {};
    const currentPlacement = state.placements[current.id] || {};
    const prevStart = minutesFromTime(parseTimeTo24(prevPlacement.time || previous.suggested_time || typeToTime(previous.type)));
    const prevDurationMinutes = Number(previous.duration_hours || 1) * 60;
    const currentStart = minutesFromTime(parseTimeTo24(currentPlacement.time || current.suggested_time || typeToTime(current.type)));
    const selected = resolveSelectedCommuteDetails(commute);
    const commuteMinutes = Number(selected?.durationMinutes || 0);

    const minByTravel = prevStart + prevDurationMinutes + commuteMinutes;
    const adjustedStart = Math.max(currentStart, minByTravel);

    state.placements[current.id] = {
      ...currentPlacement,
      dayId,
      time: timeFromMinutes(adjustedStart)
    };
  }
}

function getAccommodationForDay(cityName, date) {
  const city = state.cities.find((c) => normalizeCity(c.name) === normalizeCity(cityName));
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
}

async function updateCommutesForCityDays(dayIds = []) {
  for (const dayId of dayIds) {
    const day = state.days.find((d) => d.id === dayId);
    const accommodation = day ? getAccommodationForDay(day.city, day.date) : null;
    const accommodationLocation = [accommodation?.name, accommodation?.address].filter(Boolean).join(', ').trim();
    const orderedActivities = state.activities
      .filter((a) => state.reviewed[a.id]?.approved && state.placements[a.id]?.dayId === dayId)
      .sort((a, b) => minutesFromTime(parseTimeTo24(state.placements[a.id]?.time)) - minutesFromTime(parseTimeTo24(state.placements[b.id]?.time)));

    const dayIdsSet = new Set(orderedActivities.map((a) => a.id));
    Object.keys(state.commutes).forEach((key) => {
      const [fromId, toId] = key.split('->');
      if (dayIdsSet.has(fromId) && dayIdsSet.has(toId)) delete state.commutes[key];
    });

    if (orderedActivities.length < 2) continue;

    const payloadActivities = orderedActivities.map((a) => ({
      id: a.id,
      name: a.name,
      city: a.city,
      start_location: a.start_location,
      end_location: a.end_location,
      accommodation_location: accommodationLocation,
      hotel_location: accommodationLocation,
      hotel_latitude: normalizeCoordinate(accommodation?.latitude),
      hotel_longitude: normalizeCoordinate(accommodation?.longitude),
      suggested_time: state.placements[a.id]?.time || parseTimeTo24(a.suggested_time || typeToTime(a.type))
    }));

    const commutes = await fetchCommutesForActivities(payloadActivities);
    commutes.forEach((c) => {
      const selectedMode = resolveSelectedCommuteMode(c);
      const selected = c?.modes?.[selectedMode] || {};
      state.commutes[commutePairKey(c.fromId, c.toId)] = {
        ...c,
        selectedMode,
        durationMinutes: Number.isFinite(Number(selected.durationMinutes)) ? Number(selected.durationMinutes) : null,
        modeIcon: selected.modeIcon || '🚇'
      };
    });

    applyCommuteTimeAdjustments(dayId, orderedActivities, commutes);
  }
}

async function autoArrangeActiveCity() {
  const activeCity = state.arrangeCity;
  if (!activeCity) return;

  const activeDays = state.days
    .filter((d) => normalizeCity(d.city) === normalizeCity(activeCity))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!activeDays.length) return;

  const approvedInCity = state.activities.filter((a) => (
    state.reviewed[a.id]?.approved
    && normalizeCity(a.city) === normalizeCity(activeCity)
  ));

  const hasExistingPlacements = approvedInCity.some((a) => state.placements[a.id]?.dayId);
  if (hasExistingPlacements) {
    const shouldContinue = window.confirm('This will replace your current arrangement. Continue?');
    if (!shouldContinue) return;
  }

  approvedInCity.forEach((a) => {
    if (state.placements[a.id]?.dayId && activeDays.some((d) => d.id === state.placements[a.id].dayId)) {
      state.placements[a.id] = {
        ...(state.placements[a.id] || {}),
        dayId: null,
        time: parseTimeTo24(a.suggested_time || typeToTime(a.type))
      };
    }
  });

  const unplaced = approvedInCity
    .filter((a) => !state.placements[a.id]?.dayId)
    .map((a) => ({
      activity: a,
      normalizedTime: parseTimeTo24(a.suggested_time || typeToTime(a.type))
    }))
    .sort((a, b) => minutesFromTime(a.normalizedTime) - minutesFromTime(b.normalizedTime));

  if (!unplaced.length) {
    renderArrange();
    return;
  }

  const perDay = Math.ceil(unplaced.length / activeDays.length);

  unplaced.forEach((entry, index) => {
    const dayIndex = Math.min(Math.floor(index / perDay), activeDays.length - 1);
    const day = activeDays[dayIndex];
    state.placements[entry.activity.id] = {
      dayId: day.id,
      time: parseTimeTo24(entry.activity.suggested_time || typeToTime(entry.activity.type))
    };
  });

  const activeDayIds = activeDays.map((d) => d.id);
  await updateCommutesForCityDays(activeDayIds);
  console.log('[auto-arrange] state.commutes', state.commutes);

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
    const accommodationTypeLabel = accommodation?.type
      ? accommodation.type.charAt(0).toUpperCase() + accommodation.type.slice(1)
      : 'Accommodation';
    const accommodationInfo = accommodation
      ? `<p class="muted-text"><strong>${esc(accommodationTypeLabel)}:</strong> ${esc(accommodation.name || 'Unnamed accommodation')}${accommodation.address ? ` · ${esc(accommodation.address)}` : ''}</p>`
      : '';
    return `<section class="day-col"><div class="day-head">${d.date} • ${esc(d.city)}</div><div class="list">${accommodationInfo}${items || '<em>No activities assigned.</em>'}</div></section>`;
  }).join('');
}

async function fetchSavedItineraries() {
  try {
    const res = await fetch('/api/itineraries');
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
        const res = await fetch(`/api/itinerary/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete itinerary');
        if (state.currentItineraryId === id) {
          state.currentItineraryId = null;
          state.itinerary = null;
          els.itineraryGrid.innerHTML = '';
          if (els.itineraryInsights) els.itineraryInsights.innerHTML = '';
          if (els.downloadCalendarBtn) els.downloadCalendarBtn.disabled = true;
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
    const res = await fetch(`/api/itinerary/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok || !data?.itinerary) throw new Error('Failed to load itinerary');

    const itinerary = data.itinerary;
    state.itinerary = itinerary;
    state.currentItineraryId = itinerary.id || null;
    state.tripName = itinerary.tripName || state.tripName;
    state.cities = Array.isArray(itinerary.cities)
      ? itinerary.cities.map((city) => ({
        ...city,
        accommodations: Array.isArray(city.accommodations) ? city.accommodations.map(normalizeAccommodation) : []
      }))
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
        const idValue = activity.id || uid();
        activities.push({ ...activity, id: idValue });
        reviewed[idValue] = { approved: true, notes: activity.notes || '' };
        placements[idValue] = { dayId: day.id || `${day.city}-${day.date}`, time: parseTimeTo24(activity.time || activity.suggested_time || typeToTime(activity.type)) };
      });
    });

    state.activities = activities;
    state.reviewed = reviewed;
    state.placements = placements;
    renderCities();
    renderTravels();
    if (els.downloadCalendarBtn) els.downloadCalendarBtn.disabled = !state.currentItineraryId;
    renderItinerary();
    await fetchSavedItineraries();
    renderSavedItineraries();
    setStep(4);
  } catch {
    showToast('Could not load itinerary.', 'error');
  }
}

async function planTrip() {
  state.tripName = els.tripName.value.trim();
  const cities = state.cities.map(({name,startDate,endDate,notes,accommodations}) => ({
    name,
    startDate,
    endDate,
    notes,
    accommodations: Array.isArray(accommodations) ? accommodations : []
  }));
  const travels = state.travels.map((travel) => ({ ...travel }));
  const payload = { cities, travels, profile: state.profile || loadProfile(), userId: ensureUserId() };

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
        city: a.city || evt.city,
        start_location: String(a.start_location || '').trim(),
        end_location: String(a.end_location || '').trim()
      }));

      state.activities.push(...cityActivities);
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

  const payload = {
    tripName: state.tripName,
    cities: state.cities,
    travels: state.travels,
    days: byDay
  };
  const res = await fetch('/api/itinerary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  state.itinerary = data.itinerary;
  state.currentItineraryId = data?.itinerary?.id || null;
  if (els.downloadCalendarBtn) els.downloadCalendarBtn.disabled = !state.currentItineraryId;
  renderItinerary();
  await fetchSavedItineraries();
  renderSavedItineraries();
  setStep(4);
}

function getTripContext() {
  return {
    step: state.step,
    cities: state.cities,
    travels: state.travels,
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

function clearSnapshot() {
  localStorage.removeItem(SNAPSHOT_KEY);
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
  renderTravels();
  addCityRow();
  renderActivities();
  els.dayColumns.innerHTML = '';
  els.stagingArea.innerHTML = '';
  els.itineraryGrid.innerHTML = '';
  if (els.itineraryInsights) els.itineraryInsights.innerHTML = '';
  if (els.downloadCalendarBtn) els.downloadCalendarBtn.disabled = true;
  renderChatMessages();
  setStep(1);
}

function hydrateFromSnapshot(snapshot) {
  state.tripName = snapshot.tripName || '';
  state.cities = (snapshot.cities || []).map((city) => ({
    ...city,
    notes: city.notes || '',
    accommodations: Array.isArray(city.accommodations) ? city.accommodations.map(normalizeAccommodation) : []
  }));
  state.travels = Array.isArray(snapshot.travels) ? snapshot.travels.slice(0, 1).map(normalizeTravelEntry) : [];
  state.activities = snapshot.activities || [];
  state.placements = snapshot.placements || {};
  state.commutes = normalizeCommuteStateMap(snapshot.commutes || {});
  state.reviewed = snapshot.reviewed || {};
  state.days = snapshot.days || expandDays(state.cities);
  state.arrangeCity = snapshot.arrangeCity || state.days[0]?.city || null;

  els.tripName.value = state.tripName;
  renderCities();
  renderTravels();
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
  state.currentItineraryId = null;
  state.commutes = {};
  state.arrangeCity = null;
  renderActivities();
  els.dayColumns.innerHTML = '';
  els.stagingArea.innerHTML = '';
  els.itineraryGrid.innerHTML = '';
  if (els.itineraryInsights) els.itineraryInsights.innerHTML = '';
  if (els.downloadCalendarBtn) els.downloadCalendarBtn.disabled = true;
}

function validateLocationsBeforePlanning() {
  clearLocationValidationError();
  ensureSingleTravelEntry();

  const travel = state.travels[0] || {};
  if (!String(travel.entryPoint || '').trim()) {
    showLocationValidationError('Travel entry point is required. Please select it from Google Places suggestions.');
    return false;
  }
  if (travel.entryPointLat == null || travel.entryPointLng == null) {
    showLocationValidationError('Travel entry point is not validated. Please pick a suggestion from Google Places.');
    return false;
  }

  for (const city of state.cities) {
    if (!String(city.name || '').trim()) {
      showLocationValidationError('Each city destination must be set.');
      return false;
    }
    if (city.latitude == null || city.longitude == null) {
      showLocationValidationError(`City "${city.name}" is unvalidated. Please choose it from Google Places suggestions.`);
      return false;
    }

    for (const accommodation of (city.accommodations || [])) {
      const label = `${accommodation.name || 'Accommodation'} in ${city.name || 'city'}`;
      if (!String(accommodation.address || '').trim()) {
        showLocationValidationError(`${label} is missing an address. Please select an address from Google Places.`);
        return false;
      }
      if (accommodation.latitude == null || accommodation.longitude == null) {
        showLocationValidationError(`${label} address is unvalidated. Please choose a Google Places suggestion.`);
        return false;
      }
    }
  }

  return true;
}

els.addCityBtn.addEventListener('click', () => { addCityRow(); });
els.sortCitiesBtn?.addEventListener('click', sortCitiesByDate);
els.travelEntryPoint?.addEventListener('input', (e) => {
  ensureSingleTravelEntry();
  state.travels[0].entryPoint = e.target.value || '';
  markTravelEntryUnvalidated();
});
els.planBtn.addEventListener('click', async () => {
  if (state.isPlanning) return;
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
});
els.backToSetupBtn.addEventListener('click', () => {
  clearPlannedResultsKeepSetup();
  setStep(1);
});
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
els.clearVisibleBtn?.addEventListener('click', () => applyVerdictToVisibleActivities(null));

els.continueArrangeBtn.addEventListener('click', () => {
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
});
els.saveProgressBtn.addEventListener('click', saveSnapshot);
els.autoArrangeBtn?.addEventListener('click', autoArrangeActiveCity);
els.backToReviewBtn.addEventListener('click', () => setStep(2));
els.generateBtn.addEventListener('click', async () => {
  try {
    await generateItinerary();
  } catch (e) {
    showToast(e?.message || 'Failed to generate itinerary.', 'error');
  }
});
els.editBtn.addEventListener('click', () => { renderArrange(); setStep(3); });
els.downloadCalendarBtn?.addEventListener('click', () => {
  if (!state.currentItineraryId) return;
  window.open(`/api/itinerary/${encodeURIComponent(state.currentItineraryId)}/calendar.ics`, '_blank');
});
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
    console.log('[profile enrich] request payload', next);

    const res = await fetch('/api/profile/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
    const data = await res.json();
    console.log('[profile enrich] response', { status: res.status, ok: res.ok, data });

    const instruction = String(
      data?.instruction
      ?? data?.profileInstruction
      ?? ''
    ).trim();

    if (res.ok && instruction) {
      saveProfile({ ...next, profileInstruction: instruction });
      showToast('Profile saved!', 'success');
    } else {
      console.warn('[profile enrich] missing instruction or non-ok response', {
        status: res.status,
        ok: res.ok,
        data
      });
      showToast('Profile saved (enrichment failed)', 'info');
    }
  } catch (enrichErr) {
    console.error('[profile enrich] catch error', enrichErr);
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

(async function init() {
  state.profilesStore = loadProfiles();
  state.profile = normalizeProfile(getActiveProfile(state.profilesStore));
  mountPlanningOverlay();
  mountToastHost();
  bindChatEvents();
  ensureUserId();
  ensureChatSessionId();
  await restoreChatHistory();
  await fetchStatus();
  await fetchSavedItineraries();
  renderSavedItineraries();
  maybePromptSnapshot();
})();
