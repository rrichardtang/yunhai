(function initTravelPlannerApiService(global) {
  function createApiService({ tokenProvider } = {}) {
    const getToken = typeof tokenProvider === 'function' ? tokenProvider : async () => '';

    async function request(url, options = {}) {
      const token = await getToken();
      const headers = new Headers(options.headers || {});
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    }

    async function requestJson(url, options = {}) {
      const res = await request(url, options);
      const data = await res.json().catch(() => null);
      return { res, data };
    }

    return {
      request,
      requestJson
    };
  }

  global.TravelPlannerApiService = {
    createApiService
  };
})(window);
