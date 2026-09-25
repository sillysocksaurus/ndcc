import React, { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchHistory, RANGES } from "@/lib/priceHistory";
import { fmtUSD, fmtPct } from "@/lib/stocklana";
import { examplePct } from "@/lib/exampleOutlook";

const HEIGHT = 190; // fixed, so loading / empty / loaded states never shift the page

// Illustrative outlook only. The centre line heads to this stock's made-up example move (see
// exampleOutlook.js); the band width comes from the token's real past volatility. Not a forecast.
// `share` = how much of the one-month example move fits inside the chart's forward window.
const HORIZON = { "1D": { label: "next 6 hours", share: 0.05 }, "1W": { label: "next ~2 days", share: 0.15 }, "1M": { label: "next ~1 week", share: 0.3 }, "3M": { label: "next ~3 weeks", share: 0.7 } };
function buildOutlook(points, monthPct, share) {
  if (!points || points.length < 8) return null;
  const rets = [];
  for (let i = 1; i < points.length; i++) rets.push(Math.log(points[i].close / points[i - 1].close));
  const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sigma = Math.sqrt(rets.reduce((a, b) => a + (b - mu) ** 2, 0) / rets.length);
  const last = points[points.length - 1];
  const dt = (last.t - points[0].t) / (points.length - 1);
  const steps = Math.max(4, Math.round(points.length * 0.25));
  const endMove = (monthPct / 100) * share;
  const future = [];
  for (let k = 1; k <= steps; k++) {
    const mid = last.close * (1 + (endMove * k) / steps), w = sigma * Math.sqrt(k);
    future.push({ t: last.t + dt * k, proj: mid, band: [mid * Math.exp(-w), mid * Math.exp(w)] });
  }
  return { future, end: future[future.length - 1], pct: endMove * 100 };
}

const fmtTime = (t, range) => new Date(t * 1000).toLocaleString("en-GB", range === "1D" || range === "1W" ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });

function Tip({ active, payload, range }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg bg-surface border border-line px-2.5 py-1.5 text-[12px] shadow-lg">
      {p.close != null ? <p className="font-mono tnum font-semibold text-ink">{fmtUSD(p.close)}</p> : (<>
        <p className="font-mono tnum font-semibold text-accent">{fmtUSD(p.proj)}</p>
        <p className="text-muted">Example range {fmtUSD(p.band[0])} – {fmtUSD(p.band[1])}</p>
      </>)}
      <p className="text-muted">{fmtTime(p.t, range)}{p.close == null && " · example"}</p>
    </div>
  );
}

export default function StockChart({ mint, sym }) {
  const [range, setRange] = useState("1M");
  const [state, setState] = useState({ key: "", points: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const key = `${mint}|${range}|${attempt}`;

  useEffect(() => {
    let live = true;
    fetchHistory(mint, range)
      .then((points) => { if (live) setState({ key, points, error: null }); })
      .catch((e) => { if (live) setState({ key, points: null, error: e.message || "Chart data unavailable." }); });
    return () => { live = false; };
  }, [mint, range, key]);

  const loading = state.key !== key;
  const points = !loading ? state.points : null;
  const first = points?.[0]?.close, last = points?.[points.length - 1]?.close;
  const change = first && last ? (100 * (last - first)) / first : null;
  const up = change == null || change >= 0;
  const color = up ? "rgb(var(--gain))" : "rgb(var(--loss))";
  const hi = points?.length ? Math.max(...points.map((p) => p.high)) : null;
  const lo = points?.length ? Math.min(...points.map((p) => p.low)) : null;

  const [showOutlook, setShowOutlook] = useState(true);
  const outlook = showOutlook ? buildOutlook(points, examplePct(sym), HORIZON[range].share) : null;
  const data = points && (outlook ? [...points.map((p, i) => (i === points.length - 1 ? { ...p, proj: p.close, band: [p.close, p.close] } : p)), ...outlook.future] : points);
  const ys = data ? data.flatMap((p) => [p.close, ...(p.band || [])]).filter((v) => v != null) : [];
  const domain = ys.length ? [Math.min(...ys) * 0.998, Math.max(...ys) * 1.002] : ["auto", "auto"];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex gap-1">
          {Object.keys(RANGES).map((r) => (
            <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`px-2.5 py-1 rounded-full text-[12px] font-medium ${range === r ? "bg-accent text-accent-ink" : "bg-surface2 text-ink2 hover:text-ink"}`}>{r}</button>
          ))}
        </div>
        <p className="text-[12.5px] font-mono tnum min-h-[1.25rem]">
          {change != null && <span className={up ? "text-gain" : "text-loss"}>{up ? "+" : ""}{fmtPct(change, 2)} <span className="text-muted font-sans">over {range}</span></span>}
        </p>
      </div>

      <div style={{ height: HEIGHT }} className="rounded-xl bg-surface2/50 relative">
        {points?.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="stockfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis domain={domain} hide />
              <Tooltip content={<Tip range={range} />} cursor={{ stroke: "rgb(var(--line))" }} />
              {outlook && <Area type="monotone" dataKey="band" stroke="none" fill="rgb(var(--accent))" fillOpacity={0.18} dot={false} activeDot={false} isAnimationActive={false} />}
              <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill="url(#stockfill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              {outlook && <Area type="monotone" dataKey="proj" stroke="rgb(var(--accent))" strokeWidth={2} strokeDasharray="5 4" fill="none" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[12.5px] text-muted text-center px-6">
            <p>
              {loading ? "Loading chart… (can take a few seconds)" : state.error || "No trading history for this range yet."}
              {!loading && state.error && <> <button onClick={() => setAttempt((n) => n + 1)} className="text-accent font-medium underline underline-offset-2">Try again</button></>}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between text-[11.5px] text-muted mt-1.5 min-h-[1rem]">
        <span>{lo != null && <>Low <span className="font-mono tnum text-ink2">{fmtUSD(lo)}</span></>}</span>
        <span>{hi != null && <>High <span className="font-mono tnum text-ink2">{fmtUSD(hi)}</span></>}</span>
      </div>
      {points?.length > 7 && (
        <div className="mt-2.5 rounded-xl bg-accent-soft/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] font-semibold text-accent">Example outlook</p>
            <button onClick={() => setShowOutlook((s) => !s)} aria-pressed={showOutlook} className="text-[12px] font-medium text-accent underline underline-offset-2">{showOutlook ? "Hide" : "Show"}</button>
          </div>
          {outlook && (
            <p className="text-[12.5px] text-ink2 mt-1">
              {HORIZON[range].label}: an example of <span className={`font-mono tnum font-semibold ${outlook.pct >= 0 ? "text-gain" : "text-loss"}`}>{outlook.pct >= 0 ? "+" : ""}{fmtPct(outlook.pct, 1)}</span>, around <span className="font-mono tnum font-semibold text-ink">{fmtUSD(outlook.end.proj)}</span>, with a swing range of <span className="font-mono tnum">{fmtUSD(outlook.end.band[0])} – {fmtUSD(outlook.end.band[1])}</span>.
            </p>
          )}
          <p className="text-[11px] text-muted mt-1">Example data only. The direction is a placeholder to show how a prediction would look here; only the width of the range uses this token's real past swings. Not a real forecast and not investment advice.</p>
        </div>
      )}
      <p className="text-[11px] text-muted mt-2">On-chain trading prices from the token's deepest pool (GeckoTerminal). Tokenized stocks trade around the clock, so they can differ from the stock market's price when it's closed.</p>
    </div>
  );
}
