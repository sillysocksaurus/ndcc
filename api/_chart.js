// Server-side price-history relay. GeckoTerminal's public API doesn't send CORS headers, so browsers
// can't call it directly; this runs in `npm run dev` (via vite.config.js) and as a Vercel function.
//
// GeckoTerminal's free tier allows roughly 30 requests a minute, so every call here goes through a queue
// that spaces requests out, results are cached, and if it still says "slow down" we retry once and then
// serve the last good data instead of an error.
const BASE = "https://api.geckoterminal.com/api/v2/networks/solana";
const RANGES = {
  "1D": { tf: "minute", agg: 15, limit: 96 },
  "1W": { tf: "hour", agg: 1, limit: 168 },
  "1M": { tf: "day", agg: 1, limit: 30 },
  "3M": { tf: "day", agg: 1, limit: 90 },
};
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const GAP_MS = 2300;            // ~26 requests a minute, under the 30/min limit
const FRESH_MS = 5 * 60_000;    // serve cached candles this long without asking again
const poolCache = new Map();    // mint -> pool address
const dataCache = new Map();    // `${mint}|${range}` -> { at, points }
const pending = new Map();      // in-flight requests, so identical ones share one call

// One-at-a-time queue with a minimum gap between upstream calls.
let chain = Promise.resolve();
let lastCall = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function queued(task) {
  const run = chain.then(async () => {
    const wait = lastCall + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    return task();
  });
  chain = run.catch(() => {});
  return run;
}

async function getJson(url, retried = false) {
  const r = await queued(() => fetch(url, { headers: { accept: "application/json" } }));
  if (r.status === 429 && !retried) { await sleep(8000); return getJson(url, true); }
  if (!r.ok) { const e = new Error(r.status === 429 ? "Chart data is busy right now, try again shortly." : `Chart data unavailable (${r.status}).`); e.status = r.status === 429 ? 429 : 502; throw e; }
  return r.json();
}

async function findPool(mint) {
  if (poolCache.has(mint)) return poolCache.get(mint);
  const j = await getJson(`${BASE}/tokens/${mint}/pools?page=1`);
  const pools = j?.data || [];
  // Deepest pools come first. Prefer one quoted in a dollar stablecoin so candles are plain USD.
  const usd = pools.find((p) => /\/\s*(USDC|USDT|USD1|PYUSD)\s*$/i.test(p?.attributes?.name || ""));
  const addr = (usd || pools[0])?.attributes?.address || null;
  if (addr) poolCache.set(mint, addr);
  return addr;
}

async function fetchPoints(mint, range, cfg) {
  const pool = await findPool(mint);
  if (!pool) return [];
  const j = await getJson(`${BASE}/pools/${pool}/ohlcv/${cfg.tf}?aggregate=${cfg.agg}&limit=${cfg.limit}&currency=usd`);
  return (j?.data?.attributes?.ohlcv_list || [])
    .map(([t, , h, l, c]) => ({ t, high: +h, low: +l, close: +c }))
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .sort((a, b) => a.t - b.t);
}

// -> { status, json } like the ClawPump relay, so both adapters stay tiny.
export async function chartRelay({ mint, range }) {
  const cfg = RANGES[range];
  if (!MINT_RE.test(mint || "") || !cfg) return { status: 400, json: { error: "Bad request" } };
  const key = `${mint}|${range}`;
  const hit = dataCache.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return { status: 200, json: { points: hit.points } };
  if (!pending.has(key)) {
    pending.set(key, fetchPoints(mint, range, cfg)
      .then((points) => { dataCache.set(key, { at: Date.now(), points }); return points; })
      .finally(() => pending.delete(key)));
  }
  try {
    return { status: 200, json: { points: await pending.get(key) } };
  } catch (e) {
    // Prefer slightly old candles over an error message.
    if (hit) return { status: 200, json: { points: hit.points, stale: true } };
    return { status: e.status || 502, json: { error: e.message || "Chart data unavailable." } };
  }
}
