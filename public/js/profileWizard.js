(function (root) {
  const PROFILE_QUESTIONS = [
    { key: 'museumPerson', label: 'Are you a museum person?', summary: 'Museum person' },
    { key: 'foodTravel', label: 'Do you travel for food?', summary: 'Travels for food' },
    { key: 'livePerformances', label: 'Do you enjoy live performances?', summary: 'Live performances' },
    { key: 'outdoorNature', label: 'Do you enjoy outdoor / nature activities?', summary: 'Outdoor / nature activities' },
    { key: 'nightlifeBars', label: 'Are you into nightlife and bars?', summary: 'Nightlife and bars' },
    { key: 'structuredTours', label: 'Do you like guided tours?', summary: 'Structured tours' },
    { key: 'shoppingPerson', label: 'Do you enjoy shopping while traveling?', summary: 'Shopping' },
    { key: 'pace', label: 'How packed do you like your days?', summary: 'Trip pace' },
    { key: 'dayStructure', label: 'How do you like your days structured?', summary: 'Day structure', type: 'text', placeholder: 'e.g. I like to start early and wrap up by 9pm' },
    { key: 'dietaryRestrictions', label: 'Do you have any dietary restrictions or food preferences?', summary: 'Dietary restrictions', type: 'text', placeholder: 'e.g. I\'m vegetarian and avoid shellfish' },
    { key: 'mobilityConsiderations', label: 'Any mobility or physical considerations we should know about?', summary: 'Mobility', type: 'text', placeholder: 'e.g. I avoid lots of walking or stairs' },
    { key: 'budgetStyle', label: 'How would you describe your spending style while traveling?', summary: 'Budget style', type: 'text', placeholder: 'e.g. I prefer mid-range, splurge on food but save on activities' },
    { key: 'travelCompanions', label: 'Who are you typically traveling with?', summary: 'Travel companions', type: 'text', placeholder: 'e.g. My partner and two kids aged 8 and 11' },
    { key: 'shoppingInterests', label: 'What do you like to shop for while traveling?', summary: 'Shopping interests', type: 'text', placeholder: 'e.g. fragrance, fashion, vinyl, vintage, food souvenirs' }
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

  function getActiveProfile(store) {
    const normalized = normalizeProfilesStore(store);
    return normalized.profiles.find((p) => p.id === normalized.activeId) || normalized.profiles[0];
  }

  const api = {
    PROFILE_QUESTIONS,
    PROFILE_MIN,
    PROFILE_MAX,
    PROFILE_DEFAULT,
    profileLabel,
    pacePrefLabel,
    defaultProfile,
    createProfileId,
    normalizeProfileName,
    defaultProfilesStore,
    normalizeProfile,
    normalizeProfilesStore,
    getActiveProfile
  };

  if (root) {
    root.TravelPlannerProfileWizard = api;
    Object.assign(root, api);
  }
})(typeof window !== 'undefined' ? window : null);
