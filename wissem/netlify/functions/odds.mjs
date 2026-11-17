const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const BASE = 'https://moviodds.com/odds';
const MAX_BYTES = 8 * 1024 * 1024; // refuse anything bigger: protects the 1 GB memory limit
const MAX_MATCHES = 150;           // Netlify also limits responses to ~6 MB

// Read the body in chunks and stop if it gets too big (instead of crashing).
async function readCapped(res, max) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel(); throw new Error('TooLarge'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchBoard(query, apiKey, label) {
  const res = await fetch(`${BASE}?${query}`, {
    headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000)
  });
  const raw = await readCapped(res, MAX_BYTES);
  console.log(`[${label}] status:`, res.status, 'bytes:', raw.length);
  if (!res.ok) { console.error(`[${label}] error body:`, raw.slice(0, 300)); throw new Error(`Provider returned ${res.status}`); }
  const data = JSON.parse(raw);
  console.log(`[${label}] shape:`, Array.isArray(data) ? `array(${data.length})` : Object.keys(data).join(','));
  const list = Array.isArray(data) ? data : (Array.isArray(data.matches) ? data.matches : []);
  if (list[0]) console.log(`[${label}] first match sample:`, JSON.stringify(list[0]).slice(0, 800));
  return list;
}

export default async () => {
  const apiKey = process.env.MOVIODDS_API_KEY;
  if (!apiKey) return json({ configured: false, matches: [], error: 'MOVIODDS_API_KEY is not configured' });

  // groups=40 = soccer Full Time Result (pre-match). groups=1777 + in_play=1 = same market, live.
  // Without "groups" the API returns EVERY market of EVERY match: that is what crashed the function.
  const [pre, live] = await Promise.allSettled([
    fetchBoard('sport=soccer&groups=40', apiKey, 'prematch'),
    fetchBoard('sport=soccer&in_play=1&groups=1777', apiKey, 'live')
  ]);

  if (pre.status === 'rejected') console.error('prematch failed:', pre.reason?.message);
  if (live.status === 'rejected') console.error('live failed:', live.reason?.message);

  const list = [
    ...(live.status === 'fulfilled' ? live.value : []),
    ...(pre.status === 'fulfilled' ? pre.value : [])
  ];
  if (!list.length && pre.status === 'rejected' && live.status === 'rejected') {
    return json({ configured: true, matches: [], error: 'Odds provider unavailable: ' + (pre.reason?.message || 'unknown') }, 502);
  }

  // Remove duplicates (a live match can appear in both lists)
  const seen = new Set();
  const matches = list.filter((m, i) => {
    const id = String(m.id ?? m.match_id ?? m.fi ?? `${m.home}-${m.away}-${i}`);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, MAX_MATCHES);

  return json({ configured: true, matches, total: list.length, fetchedAt: new Date().toISOString(), pollSeconds: 60 });
};
