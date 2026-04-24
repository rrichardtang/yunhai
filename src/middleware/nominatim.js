let nominatimQueue = Promise.resolve();

const nominatimFetch = (url) => {
  nominatimQueue = nominatimQueue.then(async () => {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TravelPlannerApp/1.0' } });
    await new Promise((res) => setTimeout(res, 1100));
    return r;
  });
  return nominatimQueue;
};

module.exports = { nominatimFetch };
