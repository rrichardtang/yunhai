(function (root) {
  const TOUR_TIMINGS = ['morning', 'afternoon', 'flexible'];
  const BREAKS_MIN = 1;
  const BREAKS_MAX = 5;

  const DEFAULTS = {
    dayStartTime: '09:00',
    dayEndTime: '21:00',
    tourTiming: 'flexible',
    lunchTime: '12:30',
    dinnerTime: '19:00',
    breaksBetween: 3,
    notes: '',
    _userConfirmed: false
  };

  function defaultSchedulingPrefs() {
    return { ...DEFAULTS };
  }

  function isHHMM(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function normalizeSchedulingPrefs(prefs) {
    const base = defaultSchedulingPrefs();
    if (!prefs || typeof prefs !== 'object') return base;
    if (isHHMM(prefs.dayStartTime)) base.dayStartTime = prefs.dayStartTime;
    if (isHHMM(prefs.dayEndTime)) base.dayEndTime = prefs.dayEndTime;
    if (TOUR_TIMINGS.includes(prefs.tourTiming)) base.tourTiming = prefs.tourTiming;
    if (isHHMM(prefs.lunchTime)) base.lunchTime = prefs.lunchTime;
    if (isHHMM(prefs.dinnerTime)) base.dinnerTime = prefs.dinnerTime;
    const breaks = Number(prefs.breaksBetween);
    if (Number.isFinite(breaks)) {
      base.breaksBetween = Math.max(BREAKS_MIN, Math.min(BREAKS_MAX, Math.round(breaks)));
    }
    if (typeof prefs.notes === 'string') base.notes = prefs.notes.slice(0, 500);
    base._userConfirmed = Boolean(prefs._userConfirmed);
    return base;
  }

  function breaksLabel(n) {
    const v = Math.max(BREAKS_MIN, Math.min(BREAKS_MAX, Math.round(Number(n) || 3)));
    return ['Back-to-back', 'Short breaks', 'Moderate breaks', 'Generous breaks', 'Lots of downtime'][v - 1];
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function openSchedulingWizard(prefs, { onSave } = {}) {
    const overlay = document.getElementById('schedulingWizardOverlay');
    if (!overlay) return;

    const state = normalizeSchedulingPrefs(prefs);
    overlay.classList.remove('hidden');
    document.body.classList.add('profile-wizard-active');

    function close() {
      overlay.classList.add('hidden');
      document.body.classList.remove('profile-wizard-active');
    }

    function render() {
      overlay.querySelector('#schedulingWizardBody').innerHTML = `
        <h2 class="wizard-question-label">Schedule <span class="serif">preferences</span></h2>
        <p class="wizard-sub">How should we shape this trip's days? These apply to this trip only.</p>

        <div class="sched-row">
          <label class="sched-field">
            <span class="sched-label">Earliest start of day</span>
            <input type="time" id="schedDayStart" value="${escHtml(state.dayStartTime)}" />
          </label>
          <label class="sched-field">
            <span class="sched-label">Latest end of day</span>
            <input type="time" id="schedDayEnd" value="${escHtml(state.dayEndTime)}" />
          </label>
        </div>

        <div class="sched-field">
          <span class="sched-label">Tour timing preference</span>
          <div class="sched-radio-group" id="schedTourTiming">
            ${TOUR_TIMINGS.map((t) => `
              <label class="sched-radio${state.tourTiming === t ? ' active' : ''}">
                <input type="radio" name="tourTiming" value="${t}" ${state.tourTiming === t ? 'checked' : ''} />
                <span>${t.charAt(0).toUpperCase() + t.slice(1)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="sched-row">
          <label class="sched-field">
            <span class="sched-label">Preferred lunch time</span>
            <input type="time" id="schedLunch" value="${escHtml(state.lunchTime)}" />
          </label>
          <label class="sched-field">
            <span class="sched-label">Preferred dinner time</span>
            <input type="time" id="schedDinner" value="${escHtml(state.dinnerTime)}" />
          </label>
        </div>

        <div class="sched-field">
          <span class="sched-label">Downtime between activities — <span id="schedBreaksLabel">${escHtml(breaksLabel(state.breaksBetween))}</span></span>
          <input type="range" id="schedBreaks" min="${BREAKS_MIN}" max="${BREAKS_MAX}" step="1" value="${state.breaksBetween}" />
        </div>

        <label class="sched-field">
          <span class="sched-label">Anything else? (optional)</span>
          <textarea id="schedNotes" rows="3" maxlength="500"
            placeholder="e.g. always end the day with a quiet dinner, prefer breakfast spots near the hotel">${escHtml(state.notes)}</textarea>
        </label>
      `;

      overlay.querySelector('#schedBreaks').addEventListener('input', (e) => {
        const v = Number(e.target.value);
        state.breaksBetween = v;
        overlay.querySelector('#schedBreaksLabel').textContent = breaksLabel(v);
      });

      overlay.querySelectorAll('#schedTourTiming input[name="tourTiming"]').forEach((el) => {
        el.addEventListener('change', () => {
          state.tourTiming = el.value;
          overlay.querySelectorAll('#schedTourTiming .sched-radio').forEach((lab) => {
            lab.classList.toggle('active', lab.querySelector('input').value === el.value);
          });
        });
      });
    }

    function collect() {
      const get = (id) => overlay.querySelector(id);
      const next = {
        dayStartTime: get('#schedDayStart').value,
        dayEndTime: get('#schedDayEnd').value,
        tourTiming: (overlay.querySelector('#schedTourTiming input:checked') || {}).value || state.tourTiming,
        lunchTime: get('#schedLunch').value,
        dinnerTime: get('#schedDinner').value,
        breaksBetween: Number(get('#schedBreaks').value),
        notes: get('#schedNotes').value,
        _userConfirmed: true
      };
      return normalizeSchedulingPrefs(next);
    }

    overlay.querySelector('#schedulingWizardCancel').onclick = () => close();
    overlay.querySelector('#schedulingWizardSave').onclick = () => {
      const saved = collect();
      close();
      if (typeof onSave === 'function') onSave(saved);
    };

    render();
  }

  const api = {
    TOUR_TIMINGS,
    BREAKS_MIN,
    BREAKS_MAX,
    defaultSchedulingPrefs,
    normalizeSchedulingPrefs,
    breaksLabel,
    openSchedulingWizard
  };

  if (root) {
    root.TravelPlannerSchedulingWizard = api;
    Object.assign(root, api);
  }
})(typeof window !== 'undefined' ? window : null);
