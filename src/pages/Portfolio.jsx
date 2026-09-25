import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Scale, RefreshCw } from "lucide-react";
import TokenLogo from "@/components/TokenLogo";
import ConvertSolSheet from "@/components/ConvertSolSheet";
import AllocBar, { AllocLegend } from "@/components/AllocBar";
import { useStocklana } from "@/hooks/useStocklana";
import { fmtUSD, fmtNum, fmtPct } from "@/lib/stocklana";
import { TOKENS, SERIES } from "@/data/xstocks";
import { getAllPortfolios, useCustomBaskets } from "@/lib/customBaskets";
import { toast } from "@/lib/toast";
import { useWallet } from "@/hooks/useWallet";
import { loadCreatedTokens, createdBy } from "@/lib/createdTokens";

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m} min ago`;
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

export default function Portfolio() {
  const { state, isExample, fees: feesObj, rows, value, cost, trackedValue, untrackedValue, costKnown, previewRebalance, confirmRebalance, resetDemo, autoRebalanceCheck, isRoboBasket, sync } = useStocklana();
  useCustomBaskets(); // re-render if the admin adds/removes a bundle
  const portfolios = getAllPortfolios();
  const { address } = useWallet();
  const created = createdBy(loadCreatedTokens(), address);
  // Portfolio needs a connected wallet, so leftover demo-mode entries ("(simulated)" / "(example)") aren't this wallet's history.
  const activity = state.activity.filter((a) => !/\((simulated|example)\)/.test(a.txt));
  const [preview, setPreview] = useState(null);
  const pnl = trackedValue - cost;
  const maxDrift = rows.length ? Math.max(...rows.map((r) => Math.abs(r.drift))) : 0;
  const hasRobo = rows.some((r) => isRoboBasket(r.basket));
  const sectors = Object.entries(rows.reduce((acc, r) => { const s = TOKENS[r.sym].sector; acc[s] = (acc[s] || 0) + r.value; return acc; }, {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, pct: value ? (100 * v) / value : 0 }));
  const byBasket = Object.entries(rows.reduce((acc, r) => { const b = portfolios.find((x) => x.id === r.basket); const k = b ? b.name : r.basket?.startsWith("stock-") ? "Individual stocks" : "Other"; acc[k] = (acc[k] || 0) + r.value; return acc; }, {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v }));
  const feeTot = feesObj.impact + feesObj.lp + feesObj.net;

  useEffect(() => {
    (async () => {
      const r = await autoRebalanceCheck();
      if (r?.suggested) toast({ title: "Your Robo portfolio has drifted", description: `About ${r.drift.toFixed(1)}% off target — tap Preview rebalance below to fix it.` });
    })();
  }, [autoRebalanceCheck]);

  const [confirming, setConfirming] = useState(false);
  const onPreview = () => {
    const r = previewRebalance();
    if (r.blocked === "syncing") { toast({ title: "Still syncing your wallet", description: "Hang on — rebalancing needs your real balances first, to avoid signing a trade against stale data." }); return; }
    if (!r.legs.length) { toast({ title: "Already balanced", description: "Every holding is within $1 of its target." }); return; }
    setPreview(r);
  };
  const onConfirm = async () => {
    setConfirming(true);
    const r = await confirmRebalance();
    setConfirming(false);
    if (r.blocked === "syncing") { toast({ title: "Still syncing your wallet", description: "Try again in a moment." }); return; }
    if (r.blocked === "wallet") { toast({ title: "Connect a wallet to rebalance", description: "Trades sign and send real transactions — there's no simulated mode." }); return; }
    setPreview(null);
    if (r.legs.length) toast({ title: "Rebalanced on-chain", description: `${r.legs.length} stock-to-stock swaps signed.` });
    if (r.failures?.length) toast({ title: `${r.failures.length} swap${r.failures.length === 1 ? "" : "s"} failed`, description: r.failures.map((f) => `${f.from}→${f.to}`).join(", ") });
  };
  // Preview/confirm both need a real wallet — rebalancing signs and sends actual
  // swaps, there's no simulated fallback (same reasoning as buying).
  const rebalanceBlocked = !sync.active || !sync.holdingsTrustworthy;
  const [convertOpen, setConvertOpen] = useState(false);

  return (
    <div>
      <p className="text-[13px] text-muted font-medium flex items-center gap-2 flex-wrap">
        Portfolio
        {isExample && <span className="px-2 py-0.5 rounded-full bg-surface2 text-muted">example data</span>}
        {sync.active && (
          <button onClick={sync.refresh} disabled={sync.loading} title={sync.error || ""} className="flex items-center gap-1 text-[11.5px] text-muted hover:text-ink disabled:opacity-60">
            <RefreshCw className={`w-3 h-3 ${sync.loading ? "animate-spin" : ""}`} />
            {sync.loading ? "Syncing…" : sync.error ? "Sync failed — retry" : sync.lastSynced ? `Synced from wallet · ${timeAgo(sync.lastSynced)}` : "Sync from wallet"}
          </button>
        )}
      </p>
      {sync.active && sync.error && <p className="text-[12px] text-loss mt-1">{sync.error}</p>}
      <p className="font-display text-[38px] font-bold tracking-tight leading-none mt-2 tnum">{fmtUSD(value)}</p>
      <p className={`text-[13.5px] font-medium mt-1 ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
        {!rows.length ? "Nothing held yet" : costKnown ? `${pnl >= 0 ? "+" : ""}${fmtUSD(pnl)} (${pnl >= 0 ? "+" : ""}${fmtPct(cost ? (100 * pnl) / cost : 0, 2)}) vs cost` : "Cost basis unknown for these holdings"}
      </p>
      {sync.active && untrackedValue > 1 && (
        <p className="text-[12px] text-muted mt-0.5">{fmtUSD(untrackedValue)} held outside trades made in this app — cost basis not tracked.</p>
      )}
      {sync.active && sync.usdc != null && (
        <p className="text-[12px] text-muted mt-0.5 flex items-center gap-2 flex-wrap">
          {fmtUSD(sync.usdc)} USDC available to spend.
          {sync.sol != null && (
            <button onClick={() => setConvertOpen(true)} className="text-accent font-medium hover:brightness-110">Convert SOL →</button>
          )}
        </p>
      )}

      <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">Holdings</h2>
      {rows.length === 0 ? (
        <div className="rounded-2xl bg-surface p-7 text-center text-[13.5px] text-muted">No holdings yet. <Link to="/baskets" className="text-accent font-medium">Buy a basket</Link> and it shows up here as plain tokens in your wallet.</div>
      ) : (
        <div className="rounded-2xl bg-surface divide-y divide-line/60 overflow-hidden">
          {rows.map((r, i) => (
            <div key={r.sym} className="px-4 py-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <TokenLogo sym={r.sym} index={i} size={20} />{r.sym}
                  {isRoboBasket(r.basket) && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-accent-soft text-accent font-medium">Robo</span>}
                  {r.cost == null && sync.active && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-surface2 text-muted font-medium" title="Not bought through this app — cost basis unknown">untracked</span>}
                </span>
                <span className="font-mono tnum text-ink">{fmtUSD(r.value)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 mt-0.5 text-xs text-muted">
                <span>{fmtNum(r.qty, 6)} sh</span>
                <span>{fmtPct(r.weight)} of portfolio{Math.abs(r.drift) > 2 && <span className="text-warn"> · {r.drift >= 0 ? "+" : ""}{fmtPct(r.drift)} off target</span>}</span>
              </div>
              {r.cost != null && (
                <p className={`text-xs mt-0.5 ${r.value - r.cost >= 0 ? "text-gain" : "text-loss"}`}>
                  {r.value - r.cost >= 0 ? "+" : ""}{fmtUSD(r.value - r.cost)} ({r.value - r.cost >= 0 ? "+" : ""}{fmtPct(r.cost ? (100 * (r.value - r.cost)) / r.cost : 0, 1)}) vs cost
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <p className="text-[12.5px] text-muted mt-2.5">
            {maxDrift > 2 ? `Largest drift is ${fmtPct(maxDrift)}. Rebalancing swaps stock for stock directly, no round-trip through USDC.` : "Everything is within 2% of target. No rebalance needed."}
            {hasRobo && " Robo-picked holdings rebalance themselves automatically; this covers the rest."}
          </p>
          {preview ? (
            <div className="mt-3 rounded-2xl bg-surface p-4">
              <div className="flex items-center gap-2 mb-2"><Scale className="w-4 h-4 text-accent" /><h3 className="font-semibold text-ink text-sm">Rebalance preview · {preview.legs.length} swaps</h3></div>
              <div className="divide-y divide-line/60 text-[13px]">
                {preview.legs.map((l, i) => (<div key={i} className="flex justify-between py-2"><span className="text-ink font-medium">{l.from} → {l.to}</span><span className="font-mono tnum text-ink2">{fmtUSD(l.usd)}</span></div>))}
              </div>
              <div className="flex justify-between text-[13px] text-ink2 mt-2 pt-2 border-t border-line/60"><span>Estimated cost</span><span className="font-mono tnum text-ink font-semibold">{fmtUSD(preview.cost)}</span></div>
              <div className="flex gap-2.5 mt-3">
                <button onClick={() => setPreview(null)} className="flex-1 py-3 rounded-xl2 text-sm font-semibold bg-surface2 text-ink">Not now</button>
                <button onClick={onConfirm} disabled={confirming} className="flex-1 py-3 rounded-xl2 text-sm font-semibold bg-accent text-accent-ink disabled:opacity-60">{confirming ? "Confirm in wallet…" : "Confirm rebalance"}</button>
              </div>
            </div>
          ) : (
            <button onClick={onPreview} disabled={rebalanceBlocked} className="mt-3 w-full py-3 rounded-xl2 text-sm font-semibold bg-surface2 text-ink hover:text-accent disabled:opacity-60 disabled:hover:text-ink flex items-center justify-center gap-2">
              <Scale className="w-4 h-4" />{!sync.active ? "Connect wallet to rebalance" : rebalanceBlocked ? "Syncing your wallet…" : "Preview rebalance"}
            </button>
          )}
        </>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid md:grid-cols-2 gap-3 mt-7">
            <div className="rounded-2xl bg-surface p-4 sm:p-5">
              <h3 className="text-[13px] text-muted font-medium mb-3">Exposure by sector</h3>
              {sectors.length ? <><AllocBar items={sectors} /><AllocLegend items={sectors} /></> : <p className="text-muted text-sm">—</p>}
            </div>
            <div className="rounded-2xl bg-surface p-4 sm:p-5">
              <h3 className="text-[13px] text-muted font-medium mb-3">Exposure by basket</h3>
              <BarList rows={byBasket} empty="—" color={SERIES[6]} format={(v) => fmtUSD(v, 0)} />
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-4 sm:p-5 mt-3 flex items-center justify-between">
            <span className="text-[13px] text-ink2">Est. fees paid, lifetime</span>
            <span className="font-mono tnum text-ink font-semibold">{fmtUSD(feeTot)} <span className="text-muted font-normal text-xs">({fmtPct(cost ? (100 * feeTot) / cost : 0, 2)} of cost basis)</span></span>
          </div>
        </>
      )}

      {created.length > 0 && (<>
      <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">Tokens you've created</h2>
      {
        <div className="flex flex-col gap-2">
          {created.map((t) => (
            <div key={t.sig} className="rounded-2xl bg-surface p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {t.imageUrl ? <img src={t.imageUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-surface2 shrink-0" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <span className="w-9 h-9 rounded-full bg-surface2 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-[14.5px] font-semibold text-ink truncate">{t.name} <span className="font-mono text-[12px] text-muted">{t.symbol}</span></p>
                  <p className="text-[11.5px] text-muted font-mono truncate">{t.mint || "mint pending"} · {new Date(t.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                </div>
              </div>
              {t.url && <a href={t.url} target="_blank" rel="noreferrer" className="shrink-0 text-accent text-[13px] font-medium">View</a>}
            </div>
          ))}
        </div>
      }
      </>)}

      {activity.length > 0 && (<>
        <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">Activity</h2>
        <div className="flex flex-col gap-1 text-[12.5px] text-ink2">
          {activity.slice(0, 8).map((a, i) => (
            <div key={i} className="flex justify-between gap-3"><span>{a.txt}</span><span className="text-[11.5px] text-muted whitespace-nowrap">{new Date(a.t).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></div>
          ))}
        </div>
      </>)}
      {!sync.active && <button onClick={() => { resetDemo(); toast({ title: "Demo reset" }); }} className="mt-6 text-xs text-muted underline underline-offset-2 hover:text-ink">Reset demo data</button>}

      <ConvertSolSheet open={convertOpen} solBalance={sync.sol} onClose={() => setConvertOpen(false)} />
    </div>
  );
}
