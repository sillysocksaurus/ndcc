import React, { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { fmtUSD } from "@/lib/stocklana";
import { loadSessions, onAnalyticsChange } from "@/lib/analytics";
import { getAllPortfolios, useCustomBaskets } from "@/lib/customBaskets";

function Tile({ label, value, sub }) {
  return (
    <div className="p-4 rounded-2xl bg-surface2 min-w-0">
      <span className="block text-[12.5px] text-muted truncate">{label}</span>
      <p className="text-xl font-bold font-mono tnum text-ink mt-1">{value}</p>
      {sub && <p className="text-[11.5px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}
function BarList({ rows, empty, color = "#a855f7", format = (v) => v }) {
  if (!rows.length) return <p className="text-muted text-sm">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.v), 1);
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[minmax(80px,auto)_1fr_auto] gap-3 items-center text-xs">
          <span className="text-ink2 truncate">{r.k}</span>
          <span className="h-2.5 rounded-full bg-line2 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(100 * r.v) / max}%`, background: color }} /></span>
          <span className="font-mono tnum text-ink min-w-[48px] text-right">{format(r.v)}</span>
        </div>
      ))}
    </div>
  );
}

// Stocklana's own event tracking (sessions, funnel, basket opens) — pulled into
// the admin dashboard directly rather than left as a collapsed section on the
// public-facing /analytics page, since it's operator data, not something a
// regular visitor should have to dig through a disclosure to find (or should
// necessarily see at all).
export default function AdminAnalytics() {
  useCustomBaskets(); // re-render if the admin adds/removes a bundle
  const portfolios = getAllPortfolios();
  const [usage, setUsage] = useState({ sessions: [], source: "local" });

  useEffect(() => {
    let alive = true;
    const refresh = () => loadSessions().then((u) => { if (alive) setUsage(u); });
    refresh();
    const off = onAnalyticsChange(refresh);
    return () => { alive = false; off(); };
  }, []);

  const ux = useMemo(() => {
    const cutoff = Date.now() - 30 * 864e5;
    const S = usage.sessions.filter((s) => s.started_at >= cutoff);
    const all = S.flatMap((s) => s.events || []);
    const has = (s, e) => (s.events || []).some((x) => x.e === e);
    const count = (e) => all.filter((x) => x.e === e).length;
    const buys = all.filter((x) => x.e === "buy"), plans = all.filter((x) => x.e === "plan_create");
    const usdList = [...buys, ...plans].map((x) => +x.p?.usd || 0).filter(Boolean).sort((a, b) => a - b);
    const durations = S.map((s) => (s.last_at || s.started_at) - s.started_at).filter((d) => d > 0).sort((a, b) => a - b);
    const med = (arr) => (arr.length ? arr[Math.floor(arr.length / 2)] : 0);
    const funnel = [
      ["Opened the app", S.length],
      ["Opened a basket", S.filter((s) => has(s, "basket_open")).length],
      ["Changed amount or cadence", S.filter((s) => has(s, "amount_set") || has(s, "cadence_set")).length],
      ["Bought or started a plan", S.filter((s) => has(s, "buy") || has(s, "plan_create")).length],
    ];
    const opened = {};
    all.filter((x) => x.e === "basket_open").forEach((x) => { const b = portfolios.find((y) => y.id === x.p?.basket); const k = b ? b.name : String(x.p?.basket); opened[k] = (opened[k] || 0) + 1; });
    const cad = {};
    plans.forEach((x) => { cad[x.p?.cad] = (cad[x.p?.cad] || 0) + 1; });
    return {
      sessions: S.length, buys: buys.length, plans: plans.length, medUsd: med(usdList), medSec: Math.round(med(durations) / 1000),
      rebal: count("rebalance_confirm"), rebalPrev: count("rebalance_preview"),
      walletOk: all.filter((x) => x.e === "wallet_connect" && x.p?.ok).length, walletNo: all.filter((x) => x.e === "wallet_connect" && !x.p?.ok).length,
      funnel, opened: Object.entries(opened).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v })),
      cadence: [["weekly", "Weekly"], ["biweekly", "Every 2 weeks"], ["monthly", "Monthly"]].map(([k, l]) => ({ k: l, v: cad[k] || 0 })),
      latest: all.sort((a, b) => b.t - a.t).slice(0, 12),
    };
  }, [usage, portfolios]);

  return (
    <div>
      <div className="flex items-center gap-2 mt-7 mb-2.5">
        <Activity className="w-4 h-4 text-accent" />
        <h2 className="text-[15px] font-semibold text-ink">Product usage</h2>
      </div>
      <p className="text-[12.5px] text-muted mb-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${usage.source === "shared" ? "bg-gain" : "bg-muted"}`} />
        {usage.source === "shared" ? "Live from the shared session store" : "No shared store configured — showing this browser's sessions"} · {usage.sessions.length} session{usage.sessions.length === 1 ? "" : "s"} · last 30 days
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Tile label="Sessions" value={ux.sessions} sub={`${ux.funnel[1][1]} opened a basket`} />
        <Tile label="Buys" value={ux.buys} sub={`${ux.plans} plans created`} />
        <Tile label="Median ticket" value={ux.medUsd ? fmtUSD(ux.medUsd, 0) : "—"} sub="per buy or plan" />
        <Tile label="Rebalances" value={ux.rebal} sub={`${ux.rebalPrev} previewed`} />
        <Tile label="Median session" value={ux.medSec ? `${ux.medSec}s` : "—"} sub="first to last event" />
        <Tile label="Wallet connects" value={ux.walletOk} sub={`${ux.walletNo} without a wallet`} />
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <div className="rounded-2xl bg-surface p-4 sm:p-5">
          <h3 className="text-[13px] text-muted font-medium mb-3">Funnel</h3>
          <div className="flex flex-col gap-2.5">
            {ux.funnel.map(([l, n], i) => (
              <div key={l} className="text-xs">
                <div className="flex justify-between mb-1"><span className="text-ink2">{l}</span><span className="font-mono tnum text-ink">{n}{i ? ` · ${(n && ux.funnel[0][1]) ? Math.round((100 * n) / ux.funnel[0][1]) : 0}%` : ""}</span></div>
                <div className="h-3 rounded bg-line2 overflow-hidden"><div className="h-full rounded bg-accent" style={{ width: `${(100 * n) / (ux.funnel[0][1] || 1)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-surface p-4 sm:p-5">
            <h3 className="text-[13px] text-muted font-medium mb-3">Baskets opened</h3>
            <BarList rows={ux.opened} empty="No basket opens recorded yet." />
          </div>
          <div className="rounded-2xl bg-surface p-4 sm:p-5">
            <h3 className="text-[13px] text-muted font-medium mb-3">Cadence chosen on plans</h3>
            <BarList rows={ux.cadence} empty="—" color="#22d3ee" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-4 sm:p-5 mb-3">
        <h3 className="text-[13px] text-muted font-medium mb-3">Latest events</h3>
        {ux.latest.length ? (
          <div className="flex flex-col gap-1 font-mono tnum text-[11px] text-ink2">
            {ux.latest.map((x, i) => (
              <div key={i} className="flex justify-between gap-3 whitespace-nowrap overflow-hidden">
                <span className="truncate">{x.e} {Object.entries(x.p || {}).map(([k, v]) => `${k}=${v}`).join(" ")}</span>
                <span className="text-muted">{new Date(x.t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-muted text-sm">No events yet.</p>}
      </div>
      <p className="text-[11.5px] text-muted">Events are aggregated per session and stored locally (plug a remote sink into src/lib/analytics.js to share across devices); no wallet addresses or personal data are recorded.</p>
    </div>
  );
}
