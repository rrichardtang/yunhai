(function initTravelPlannerStatePersistence(global) {
  function createStatePersistence(storage = global.localStorage) {
    function loadJson(key, fallback = null) {
      try {
        const raw = storage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }

    function saveJson(key, value) {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch {}
      return value;
    }

    function remove(key) {
      try {
        storage.removeItem(key);
      } catch {}
    }

    return {
      loadJson,
      saveJson,
      remove
    };
  }

  global.TravelPlannerStatePersistence = {
    createStatePersistence
  };
})(window);
