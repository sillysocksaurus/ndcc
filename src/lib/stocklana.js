import { TOKENS, LP_FEE, NET_FEE_USD, GUARD_BPS, USDC_MINT } from "@/data/xstocks";
import { getAllPortfolios } from "@/lib/customBaskets";

/* ---------- formatting ---------- */
export const fmtUSD = (n, d = 2) =>
  (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtNum = (n, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (n, d = 1) => fmtNum(n, d) + "%";
export const shortMint = (m) => m.slice(0, 4) + "…" + m.slice(-4);

/* ---------- execution model ---------- */
// Rough depth model, calibrated against a live Jupiter quote (1,000 USDC → JNJx via Manifest:
// 0.95% observed vs 1.00% here). The real number comes from /swap/v1/quote at signing.
export function impactPct(usd, sym, prices) {
  const depth = Math.max(TOKENS[sym].liq, 25000);
  void prices;
  return (100 * usd) / (4 * depth);
}

export function liquidityGrade(basket, prices) {
  const worst = Math.max(...basket.legs.map(([s, w]) => impactPct((1000 * w) / 100, s, prices)));
  return worst < 0.1 ? "A" : worst < 0.5 ? "B" : "C";
}

export function feesFor(basket, usd, prices) {
  let impact = 0;
  basket.legs.forEach(([s, w]) => {
    const a = (usd * w) / 100;
    impact += (a * impactPct(a, s, prices)) / 100;
  });
  return { impact, lp: usd * LP_FEE, net: basket.legs.length * NET_FEE_USD };
}

export function totalCost(fees) {
  return fees.impact + fees.lp + fees.net;
}

// One swap leg per basket constituent: USDC → xStock.
export function planFor(basket, usd, prices) {
  return basket.legs.map(([sym, weight], i) => {
    const amount = (usd * weight) / 100;
    const imp = impactPct(amount, sym, prices);
    const qty = (amount * (1 - imp / 100 - LP_FEE)) / prices[sym];
    const slices = imp > GUARD_BPS / 100 ? Math.min(48, Math.ceil(imp / (GUARD_BPS / 100))) : 1;
    return {
      sym, weight, index: i, amount, impact: imp, qty, slices,
      venue: TOKENS[sym].venue,
      inputMint: USDC_MINT,
      outputMint: TOKENS[sym].mint,
    };
  });
}

/* ---------- portfolio maths ---------- */
export function targetWeights(targets) {
  const tw = {};
  let sum = 0;
  const portfolios = getAllPortfolios();
  for (const bid in targets) {
    const b = portfolios.find((x) => x.id === bid);
    if (!b) continue;
    b.legs.forEach(([s, w]) => {
      const v = (targets[bid] * w) / 100;
      tw[s] = (tw[s] || 0) + v;
      sum += v;
    });
  }
  const out = {};
  for (const s in tw) out[s] = sum ? (100 * tw[s]) / sum : 0;
  return out;
}

// holdings[s].cost may be null/undefined — real on-chain balances a user acquired
// outside this app (or before connecting) have no known cost basis. Those rows still
// count toward value/weight/drift, they're just excluded from cost/P&L aggregates.
export function portfolioRows(holdings, targets, prices) {
  const syms = Object.keys(holdings).filter((s) => holdings[s].qty > 1e-9);
  let value = 0, cost = 0, trackedValue = 0;
  syms.forEach((s) => {
    const v = holdings[s].qty * prices[s];
    value += v;
    if (holdings[s].cost != null) { cost += holdings[s].cost; trackedValue += v; }
  });
  const tw = targetWeights(targets);
  const rows = syms
    .map((s) => {
      const v = holdings[s].qty * prices[s];
      const cw = value ? (100 * v) / value : 0;
      const tg = tw[s] ?? cw;
      return { sym: s, qty: holdings[s].qty, cost: holdings[s].cost ?? null, value: v, weight: cw, target: tg, drift: cw - tg, basket: holdings[s].basket };
    })
    .sort((a, b) => b.value - a.value);
  const untrackedValue = value - trackedValue;
  return { rows, value, cost, trackedValue, untrackedValue, costKnown: trackedValue > 0 };
}

// Pair overweight sellers with underweight buyers as direct stock-to-stock swaps.
export function rebalanceLegs(holdings, targets, prices) {
  const { rows, value } = portfolioRows(holdings, targets, prices);
  const sells = [], buys = [];
  rows.forEach((r) => {
    const tv = (value * r.target) / 100;
    const d = r.value - tv;
    if (d > 1) sells.push({ sym: r.sym, usd: d });
    else if (d < -1) buys.push({ sym: r.sym, usd: -d });
  });
  const legs = [];
  let bi = 0;
  const rem = buys.map((b) => b.usd);
  sells.forEach(({ sym, usd }) => {
    let left = usd;
    while (left > 0.5 && bi < buys.length) {
      const take = Math.min(left, rem[bi]);
      legs.push({ from: sym, to: buys[bi].sym, usd: take });
      left -= take;
      rem[bi] -= take;
      if (rem[bi] < 0.5) bi++;
    }
  });
  const sold = sells.reduce((t, x) => t + x.usd, 0);
  return { legs, cost: legs.length * NET_FEE_USD + sold * LP_FEE, sold };
}

/* ---------- market clock ---------- */
const NY = "America/New_York";
function nyParts(d) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: NY, weekday: "short", hour: "numeric", minute: "numeric", hour12: false, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
  const g = (k) => parts.find((p) => p.type === k)?.value;
  return { weekday: g("weekday"), hour: +g("hour") % 24, minute: +g("minute"), year: +g("year"), month: +g("month"), day: +g("day") };
}
// Full-day NYSE closures. Half-day early closes (13:00) aren't modeled.
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
function nthWeekday(y, m, wd, n) {
  if (n > 0) { const first = utc(y, m, 1).getUTCDay(); return 1 + ((wd - first + 7) % 7) + (n - 1) * 7; }
  const last = utc(y, m + 1, 0);
  return last.getUTCDate() - ((last.getUTCDay() - wd + 7) % 7);
}
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, month, day);
}
function isNyseHoliday(y, mo, d) {
  const key = (dt) => dt.getUTCMonth() + 1 + "-" + dt.getUTCDate();
  const observed = (m, day, newYear = false) => {
    const dt = utc(y, m, day), wd = dt.getUTCDay();
    if (wd === 6) return newYear ? null : utc(y, m, day - 1);
    if (wd === 0) return utc(y, m, day + 1);
    return dt;
  };
  const good = easterSunday(y); good.setUTCDate(good.getUTCDate() - 2);
  const days = [
    observed(1, 1, true), utc(y, 1, nthWeekday(y, 1, 1, 3)), utc(y, 2, nthWeekday(y, 2, 1, 3)), good,
    utc(y, 5, nthWeekday(y, 5, 1, -1)), observed(6, 19), observed(7, 4), utc(y, 9, nthWeekday(y, 9, 1, 1)),
    utc(y, 11, nthWeekday(y, 11, 4, 4)), observed(12, 25),
  ].filter(Boolean).map(key);
  return days.includes(mo + "-" + d);
}
const isTradingDay = (p) => !["Sat", "Sun"].includes(p.weekday) && !isNyseHoliday(p.year, p.month, p.day);

export function isNyseOpen(now = new Date()) {
  const p = nyParts(now);
  const m = p.hour * 60 + p.minute;
  return isTradingDay(p) && m >= 570 && m < 960;
}
export function nextNyseOpen(now = new Date()) {
  for (let i = 0; i < 12; i++) {
    const c = new Date(now.getTime() + i * 864e5);
    const p = nyParts(c);
    if (!isTradingDay(p)) continue;
    const probe = new Date(Date.UTC(p.year, p.month - 1, p.day, 13, 30));
    const nyHour = nyParts(probe).hour;
    const open = new Date(probe.getTime() + (9 - nyHour) * 36e5);
    if (open > now) return open;
  }
  return null;
}
