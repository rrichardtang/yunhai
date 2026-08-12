const fs = require('fs');
const path = require('path');

// Brave results are recorded on the first run and replayed after, so every arm
// answers the same prompt. Places lookups deliberately stay live: arms invent
// different venue names, and whether those names resolve is the measurement.
function installBraveCassette(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const cassettePath = path.join(outDir, 'brave-cassette.json');
  const cassette = fs.existsSync(cassettePath) ? JSON.parse(fs.readFileSync(cassettePath, 'utf8')) : {};
  const realFetch = global.fetch;

  global.fetch = async (url, options) => {
    const target = String(url);
    if (!target.includes('api.search.brave.com')) return realFetch(url, options);

    const query = new URL(target).searchParams.get('q');
    if (cassette[query]) return { ok: true, json: async () => cassette[query] };

    const res = await realFetch(url, options);
    if (!res.ok) return res;
    const data = await res.json();
    cassette[query] = data;
    fs.writeFileSync(cassettePath, JSON.stringify(cassette, null, 2));
    return { ok: true, json: async () => data };
  };

  return () => Object.keys(cassette).length;
}

module.exports = { installBraveCassette };
