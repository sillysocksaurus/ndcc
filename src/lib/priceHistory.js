// Price history for a token, fetched through our own /api/chart relay (GeckoTerminal data;
// the relay exists because that API has no CORS headers, so browsers can't call it directly).
export const RANGES = {
  "1D": { label: "1 day" },
  "1W": { label: "1 week" },
  "1M": { label: "1 month" },
  "3M": { label: "3 months" },
};

const cache = new Map(); // `${mint}|${range}` -> { at, points }
const TTL = 5 * 60_000;

// -> [{ t (unix seconds), close, high, low }] oldest first; [] when the token has no trading history.
export async function fetchHistory(mint, range) {
  const key = `${mint}|${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.points;
  const r = await fetch(`/api/chart?mint=${encodeURIComponent(mint)}&range=${encodeURIComponent(range)}`);
  let j = null;
  try { j = await r.json(); } catch { /* handled below */ }
  if (!r.ok) throw new Error(j?.error || `Chart data unavailable (${r.status}).`);
  const points = Array.isArray(j?.points) ? j.points : [];
  cache.set(key, { at: Date.now(), points });
  return points;
}
