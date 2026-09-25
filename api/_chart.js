// Server-side price-history relay. GeckoTerminal's public API doesn't send CORS headers, so browsers
// can't call it directly; this runs in `npm run dev` (via vite.config.js) and as a Vercel function.
const BASE = "https://api.geckoterminal.com/api/v2/networks/solana";
const RANGES = {
  "1D": { tf: "minute", agg: 15, limit: 96 },
  "1W": { tf: "hour", agg: 1, limit: 168 },
  "1M": { tf: "day", agg: 1, limit: 30 },
  "3M": { tf: "day", agg: 1, limit: 90 },
};
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const poolCache = new Map(); // mint -> pool address

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) { const e = new Error(r.status === 429 ? "Chart data is rate-limited, try again in a minute." : `Chart data unavailable (${r.status}).`); e.status = r.status === 429 ? 429 : 502; throw e; }
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

// -> { status, json } like the ClawPump relay, so both adapters stay tiny.
export async function chartRelay({ mint, range }) {
  const cfg = RANGES[range];
  if (!MINT_RE.test(mint || "") || !cfg) return { status: 400, json: { error: "Bad request" } };
  try {
    const pool = await findPool(mint);
    if (!pool) return { status: 200, json: { points: [] } };
    const j = await getJson(`${BASE}/pools/${pool}/ohlcv/${cfg.tf}?aggregate=${cfg.agg}&limit=${cfg.limit}&currency=usd`);
    const points = (j?.data?.attributes?.ohlcv_list || [])
      .map(([t, , h, l, c]) => ({ t, high: +h, low: +l, close: +c }))
      .filter((p) => Number.isFinite(p.close) && p.close > 0)
      .sort((a, b) => a.t - b.t);
    return { status: 200, json: { points } };
  } catch (e) {
    return { status: e.status || 502, json: { error: e.message || "Chart data unavailable." } };
  }
}
