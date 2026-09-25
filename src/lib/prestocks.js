import { useEffect, useState } from "react";
import { TOKENS } from "@/data/xstocks";

// Live PreStocks data (description, reference and implied valuation, supply) via our /api/prestocks relay,
// refreshed every minute while a screen is using it. Tokens PreStocks lists that we don't have yet are
// added to TOKENS on the fly, so new listings appear without a code change or redeploy.
// Empty until loaded, or if the relay is unreachable (e.g. a static host with no server).
const REFRESH_MS = 60_000;
let state = { map: {}, updatedAt: null };
let listeners = new Set();
let timer = null;
let inflight = null;

// A fresh snapshot object each time, so useSyncExternalStore-style consumers re-render.
function publish(map) {
  state = { map, updatedAt: Date.now() };
  listeners.forEach((fn) => fn());
}

// Same as PreStocks' own ticker (ANTHROPIC, KALSHI, ...), which is what people see in the app.
const symKey = (symbol) => symbol.toUpperCase();

function registerNewTokens(tokens) {
  const known = new Set(Object.values(TOKENS).map((t) => t.mint));
  for (const t of tokens) {
    if (known.has(t.mint) || !t.symbol || !/^Pre/.test(t.mint)) continue;
    let key = symKey(t.symbol);
    while (TOKENS[key]) key += "_";
    // Liquidity is unknown until Jupiter reports it, so leave it null; the UI shows "New" instead of a grade.
    TOKENS[key] = { name: t.name || `${t.symbol} PreStocks`, sector: "Pre-IPO", mint: t.mint, price: t.tokenPrice || t.markPrice || 0, liq: null, venue: "Jupiter", decimals: 9, group: "Pre-IPO", issuer: "PreStocks", psId: t.id };
  }
}

function refresh() {
  if (inflight) return inflight;
  inflight = fetch("/api/prestocks")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) => {
      const tokens = j.tokens || [];
      registerNewTokens(tokens);
      publish(Object.fromEntries(tokens.map((t) => [t.mint, t])));
    })
    .catch(() => { /* keep the last good data */ })
    .finally(() => { inflight = null; });
  return inflight;
}

export function usePreStocks() {
  const [snap, setSnap] = useState(state);
  useEffect(() => {
    const fn = () => setSnap(state);
    listeners.add(fn);
    if (listeners.size === 1) timer = setInterval(refresh, REFRESH_MS);
    refresh();
    return () => {
      listeners.delete(fn);
      if (listeners.size === 0) { clearInterval(timer); timer = null; }
    };
  }, []);
  return snap;
}
