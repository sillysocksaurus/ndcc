import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { TOKENS, BASKETS, ROBO_PORTFOLIOS, CADENCE, MIN_ORDER_USD, USDC_MINT, USDC_DECIMALS, XSTOCK_DECIMALS } from "@/data/xstocks";
import { feesFor, rebalanceLegs, portfolioRows, fmtUSD } from "@/lib/stocklana";
import { swapManyWithWallet } from "@/lib/jupiterSwap";
import { useWallet } from "@/hooks/useWallet";
import { useOnChainHoldings, bumpOnChainSync } from "@/hooks/useOnChainHoldings";
import { track } from "@/lib/analytics";

const STATE_KEY = "stocklana_state";
// xStocks use 8 decimals; other token families (e.g. Tessera's 9-decimal T-Tokens) say so per token.
const decimalsOf = (sym) => TOKENS[sym]?.decimals ?? XSTOCK_DECIMALS;
const ROBO_IDS = new Set(ROBO_PORTFOLIOS.map((b) => b.id));
export const isRoboBasket = (id) => ROBO_IDS.has(id);
const AUTO_REBALANCE_DRIFT = 2;
const AUTO_REBALANCE_COOLDOWN = 5 * 60 * 1000;

/* ---------- prices: snapshot first, live from Jupiter when reachable ---------- */
const PRICE_REFRESH_MS = 60 * 1000;
const priceStore = {
  prices: Object.fromEntries(Object.entries(TOKENS).map(([s, t]) => [s, t.price])),
  live: false,
  fetchedAt: null,
  listeners: new Set(),
};
// useSyncExternalStore only re-renders when getSnapshot returns a *different* object,
// so every price update publishes a fresh snapshot instead of mutating a shared one.
let priceSnapshot = { prices: priceStore.prices, marks: {}, live: false, fetchedAt: null };
let priceFetching = false;
async function fetchLivePrices() {
  if (priceFetching) return;
  priceFetching = true;
  try {
    const ids = Object.values(TOKENS).map((t) => t.mint).join(",");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch("https://lite-api.jup.ag/price/v3?ids=" + ids, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const next = { ...priceStore.prices };
    const marks = {};
    let n = 0;
    for (const s in TOKENS) {
      const p = j[TOKENS[s].mint]?.usdPrice;
      if (p) { next[s] = p; n++; }
      // For pre-IPO tokens Jupiter also reports a reference valuation price ("stockData"),
      // which is what makes a live premium/discount possible.
      const ref = j[TOKENS[s].mint]?.stockData?.price;
      if (ref) marks[s] = ref;
    }
    if (n) {
      priceStore.prices = next;
      priceStore.live = true;
      priceStore.fetchedAt = Date.now();
      priceSnapshot = { prices: priceStore.prices, marks, live: true, fetchedAt: priceStore.fetchedAt };
      priceStore.listeners.forEach((fn) => fn());
    }
  } catch {
    /* keep whatever prices we already have; the next tick tries again */
  } finally {
    priceFetching = false;
  }
}
let priceConsumers = 0, priceTimer = null;
export function usePrices() {
  useEffect(() => {
    if (priceConsumers++ === 0) { fetchLivePrices(); priceTimer = setInterval(fetchLivePrices, PRICE_REFRESH_MS); }
    return () => { if (--priceConsumers === 0) { clearInterval(priceTimer); priceTimer = null; } };
  }, []);
  return useSyncExternalStore(
    (fn) => { priceStore.listeners.add(fn); return () => priceStore.listeners.delete(fn); },
    () => priceSnapshot,
  );
}

/* ---------- portfolio / plans state (localStorage-backed external store) ---------- */
function exampleState() {
  // Example starting state so the pages are never empty: a Magnificent 7 buy six weeks ago.
  const mag7 = BASKETS.find((b) => b.id === "mag7");
  const drift = { AAPLx: 0.93, MSFTx: 1.02, GOOGLx: 1.11, AMZNx: 0.97, NVDAx: 1.19, METAx: 1.04, TSLAx: 0.82 };
  const holdings = {};
  mag7.legs.forEach(([s, w]) => {
    const cost = (700 * w) / 100;
    holdings[s] = { qty: (cost / TOKENS[s].price) * drift[s], cost, basket: "mag7" };
  });
  const fees = feesFor(mag7, 700, priceStore.prices);
  return {
    holdings,
    targets: { mag7: 700 },
    fees,
    plans: [
      { id: "p1", basket: "core", amount: 200, cad: "monthly", started: Date.now() - 20 * 864e5, status: "live", runs: 1 },
      { id: "p2", basket: "mag7", amount: 50, cad: "weekly", started: Date.now() - 42 * 864e5, status: "live", runs: 6 },
    ],
    activity: [{ t: Date.now() - 42 * 864e5, txt: "Bought Magnificent 7 · $700.00 · 7 legs (example)", cost: fees.impact + fees.lp + fees.net }],
    example: true,
  };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through */ }
  return exampleState();
}
const store = { state: loadState(), listeners: new Set() };
function setState(updater) {
  store.state = typeof updater === "function" ? updater(store.state) : updater;
  try { localStorage.setItem(STATE_KEY, JSON.stringify(store.state)); } catch { /* ignore */ }
  store.listeners.forEach((fn) => fn());
}
// Real on-chain balance is always the true qty. Cost basis we only know for the slice
// of a position we actually tracked ourselves — average it down if less is held than
// we recorded (some left outside the app), and leave the rest openly unknown rather
// than guessing.
function mergeOnChainHoldings(localHoldings, onChainBalances) {
  const merged = {};
  const syms = new Set([...Object.keys(localHoldings), ...Object.keys(onChainBalances)]);
  syms.forEach((sym) => {
    const realQty = onChainBalances[sym] || 0;
    if (realQty <= 1e-9) return;
    const local = localHoldings[sym];
    if (!local || local.qty <= 1e-9 || local.cost == null) {
      merged[sym] = { qty: realQty, cost: null, basket: local?.basket ?? null };
      return;
    }
    const coveredQty = Math.min(realQty, local.qty);
    merged[sym] = { qty: realQty, cost: (local.cost * coveredQty) / local.qty, basket: local.basket };
  });
  return merged;
}

/* ---------- real on-chain execution (used whenever a wallet is connected) ---------- */
// Locally tracked holdings/targets/cost basis only mean something for the wallet that
// produced them. Seeded example data, or data from a different wallet than the one
// trading now, is discarded instead of being mixed into the new wallet's numbers.
function localBase(s, address) {
  const trusted = !s.example && (!s.owner || s.owner === address);
  return trusted ? { holdings: s.holdings, targets: s.targets, fees: s.fees } : { holdings: {}, targets: {}, fees: { impact: 0, lp: 0, net: 0 } };
}
function addFees(fees, f) {
  const cur = fees || { impact: 0, lp: 0, net: 0 };
  return { impact: cur.impact + f.impact, lp: cur.lp + f.lp, net: cur.net + f.net };
}

// All legs are quoted and signed in a single wallet approval where the wallet supports
// it (see swapManyWithWallet). `onlySyms` re-runs just the legs that failed earlier,
// at the same per-leg dollar amounts.
async function buyBasketReal(basket, usd, wallet, onlySyms) {
  const wanted = basket.legs.filter(([sym]) => !onlySyms || onlySyms.includes(sym));
  const swaps = wanted.map(([sym, weight]) => ({ sym, weight, usdLeg: (usd * weight) / 100, inputMint: USDC_MINT, outputMint: TOKENS[sym].mint, amount: ((usd * weight) / 100) * 10 ** USDC_DECIMALS }));
  const { done, failures: failed } = await swapManyWithWallet({ swaps, wallet });
  const legs = done.map(({ s, result }) => ({ sym: s.sym, weight: s.weight, amount: s.usdLeg, qty: Number(result.outputAmountResult ?? result.totalOutputAmount) / 10 ** decimalsOf(s.sym), signature: result.signature }));
  const failures = failed.map(({ s, error }) => ({ sym: s.sym, error }));
  if (legs.length) {
    setState((s) => {
      const base = localBase(s, wallet.address);
      const holdings = { ...base.holdings };
      legs.forEach((l) => {
        const h = holdings[l.sym] || { qty: 0, cost: 0, basket: basket.id };
        holdings[l.sym] = { qty: h.qty + l.qty, cost: (h.cost ?? 0) + l.amount, basket: basket.id };
      });
      const spent = legs.reduce((t, l) => t + l.amount, 0);
      return {
        ...s,
        owner: wallet.address,
        holdings,
        targets: { ...base.targets, [basket.id]: (base.targets[basket.id] || 0) + spent },
        fees: addFees(base.fees, feesFor(basket, spent, priceStore.prices)),
        activity: [{ t: Date.now(), txt: `Bought ${basket.name} · ${fmtUSD(spent)} · ${legs.length} legs (on-chain)`, real: true, signatures: legs.map((l) => l.signature) }, ...s.activity],
        example: false,
      };
    });
    bumpOnChainSync();
  }
  track("buy_real", { basket: basket.id, usd, legs: legs.length, failed: failures.length });
  return { legs, failures, real: true };
}

// Direct stock-to-stock swaps for a real rebalance, one per leg.
async function rebalanceReal(legs, prices, wallet) {
  const swaps = legs.map((l) => ({ l, inputMint: TOKENS[l.from].mint, outputMint: TOKENS[l.to].mint, amount: (l.usd / prices[l.from]) * 10 ** decimalsOf(l.from) }));
  const { done: doneRaw, failures: failedRaw } = await swapManyWithWallet({ swaps, wallet });
  const done = doneRaw.map(({ s, result }) => ({
    ...s.l,
    outQty: Number(result.outputAmountResult ?? result.totalOutputAmount) / 10 ** decimalsOf(s.l.to),
    inQty: Number(result.inputAmountResult ?? result.totalInputAmount) / 10 ** decimalsOf(s.l.from),
    signature: result.signature,
  }));
  const failures = failedRaw.map(({ s, error }) => ({ ...s.l, error }));
  if (done.length) {
    setState((s) => {
      const base = localBase(s, wallet.address);
      const holdings = { ...base.holdings };
      done.forEach((l) => {
        const from = holdings[l.from] || { qty: 0, cost: null, basket: null };
        const to = holdings[l.to] || { qty: 0, cost: null, basket: from.basket };
        // A stock-to-stock swap realizes gain/loss on the "from" leg and opens a fresh
        // basis on the "to" leg — we don't track either precisely, so mark both unknown
        // rather than carry forward a cost figure that's now silently wrong.
        holdings[l.from] = { ...from, qty: Math.max(0, from.qty - l.inQty), cost: null };
        holdings[l.to] = { ...to, qty: to.qty + l.outQty, cost: null };
      });
      return {
        ...s,
        owner: wallet.address,
        holdings,
        targets: base.targets,
        fees: base.fees,
        activity: [{ t: Date.now(), txt: `Rebalanced · ${done.length} stock-to-stock swaps (on-chain)`, real: true, signatures: done.map((l) => l.signature) }, ...s.activity],
      };
    });
    bumpOnChainSync();
  }
  track("rebalance_real", { legs: done.length, failed: failures.length });
  return { legs: done, failures, real: true };
}

export function useStocklana() {
  const state = useSyncExternalStore(
    (fn) => { store.listeners.add(fn); return () => store.listeners.delete(fn); },
    () => store.state,
  );
  const { prices } = usePrices();
  const wallet = useWallet();
  const walletReady = wallet.connected && wallet.publicKey && wallet.signTransaction;
  const onChain = useOnChainHoldings(walletReady ? wallet.address : null);

  // Real on-chain balance is the source of truth whenever a wallet is connected and
  // synced; otherwise fall back to the locally tracked (simulated) holdings.
  const address = wallet.address;
  const local = useMemo(
    () => (walletReady ? localBase(state, address) : { holdings: state.holdings, targets: state.targets, fees: state.fees }),
    [walletReady, address, state],
  );
  const effectiveHoldings = useMemo(() => {
    if (!walletReady || !onChain.balances) return local.holdings;
    return mergeOnChainHoldings(local.holdings, onChain.balances);
  }, [walletReady, onChain.balances, local]);

  const portfolio = useMemo(
    () => portfolioRows(effectiveHoldings, local.targets, prices),
    [effectiveHoldings, local, prices],
  );

  // True once it's safe to size a REAL trade off effectiveHoldings: either there's no
  // wallet (local/simulated data is authoritative), or the wallet's real balances have
  // been fetched *completely* at least once. False while still loading, after a failed
  // sync, or after a partial one (some mints rate-limited) — in all three cases a
  // holding could be silently missing from onChain.balances and read as "you own zero
  // of this", which is exactly wrong input for sizing a real buy or rebalance.
  const holdingsTrustworthy = !walletReady || (!!onChain.balances && !onChain.incomplete);

  const sync = {
    active: walletReady,
    loading: onChain.loading,
    lastSynced: onChain.lastSynced,
    error: onChain.error,
    usdc: onChain.usdc,
    sol: onChain.sol,
    refresh: onChain.refresh,
    holdingsTrustworthy,
  };

  const buyBasket = useCallback(async (basket, usd, onlySyms) => {
    if (usd < MIN_ORDER_USD) return null;
    if (!walletReady) return { legs: [], failures: [], blocked: "wallet" };
    if (!holdingsTrustworthy) return { legs: [], failures: [], blocked: "syncing" };
    return buyBasketReal(basket, usd, wallet, onlySyms);
  }, [walletReady, wallet, holdingsTrustworthy]);

  const createPlan = useCallback((basket, usd, cad) => {
    if (usd < MIN_ORDER_USD || !CADENCE[cad] || cad === "once") return null;
    const plan = { id: "p" + Date.now().toString(36), basket: basket.id, amount: usd, cad, started: Date.now(), status: "live", runs: 0 };
    setState((s) => ({
      ...s,
      plans: [plan, ...s.plans],
      activity: [{ t: Date.now(), txt: `Started ${cad} plan · ${basket.name} · $${usd.toFixed(2)}` }, ...s.activity],
      example: false,
    }));
    track("plan_create", { basket: basket.id, usd, cad });
    return plan;
  }, []);

  const togglePlan = useCallback((id) => {
    let next = null;
    setState((s) => ({
      ...s,
      plans: s.plans.map((p) => {
        if (p.id !== id) return p;
        next = p.status === "live" ? "paused" : "live";
        track(next === "live" ? "plan_resume" : "plan_pause", { basket: p.basket });
        return { ...p, status: next };
      }),
    }));
    return next;
  }, []);

  const cancelPlan = useCallback((id) => {
    setState((s) => {
      const p = s.plans.find((x) => x.id === id);
      if (p) track("plan_cancel", { basket: p.basket });
      return { ...s, plans: s.plans.filter((x) => x.id !== id) };
    });
  }, []);

  const previewRebalance = useCallback(() => {
    if (!holdingsTrustworthy) return { legs: [], cost: 0, sold: 0, blocked: "syncing" };
    const r = rebalanceLegs(effectiveHoldings, local.targets, priceStore.prices);
    track("rebalance_preview", { legs: r.legs.length });
    return r;
  }, [effectiveHoldings, local, holdingsTrustworthy]);

  const confirmRebalance = useCallback(async () => {
    if (!holdingsTrustworthy) return { legs: [], failures: [], blocked: "syncing" };
    if (!walletReady) return { legs: [], failures: [], blocked: "wallet" };
    const r = rebalanceLegs(effectiveHoldings, local.targets, priceStore.prices);
    if (!r.legs.length) return r;
    return rebalanceReal(r.legs, priceStore.prices, wallet);
  }, [effectiveHoldings, local, walletReady, wallet, holdingsTrustworthy]);

  const resetDemo = useCallback(() => setState(exampleState()), []);

  // Robo positions rebalance themselves — but every real swap still needs the user's
  // own signature, so this only ever surfaces a "you're off target" nudge, never
  // executes anything unattended.
  const autoRebalanceCheck = useCallback(async () => {
    if (!walletReady || !holdingsTrustworthy) return null;
    const s = store.state;
    const hasRobo = Object.values(effectiveHoldings).some((h) => ROBO_IDS.has(h.basket));
    if (!hasRobo) return null;
    if (Date.now() - (s.lastAutoRebalance || 0) < AUTO_REBALANCE_COOLDOWN) return null;
    const { rows } = portfolioRows(effectiveHoldings, local.targets, priceStore.prices);
    const maxDrift = rows.length ? Math.max(...rows.map((r) => Math.abs(r.drift))) : 0;
    if (maxDrift < AUTO_REBALANCE_DRIFT) return null;
    setState((st) => ({ ...st, lastAutoRebalance: Date.now() }));
    track("robo_rebalance_suggested", { drift: maxDrift });
    return { suggested: true, drift: maxDrift };
  }, [walletReady, effectiveHoldings, local, holdingsTrustworthy]);

  return {
    state, prices, buyBasket, createPlan, togglePlan, cancelPlan, previewRebalance, confirmRebalance, resetDemo, autoRebalanceCheck, isRoboBasket,
    holdings: effectiveHoldings, ...portfolio, sync,
    // Seeded demo numbers are never shown as, or mixed into, a connected wallet's real portfolio.
    isExample: !walletReady && !!state.example,
    fees: local.fees || { impact: 0, lp: 0, net: 0 },
  };
}
