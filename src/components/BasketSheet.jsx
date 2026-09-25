import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import AllocBar from "./AllocBar";
import ExecutionPlan from "./ExecutionPlan";
import ConvertSolSheet from "./ConvertSolSheet";
import { CADENCE, MIN_ORDER_USD } from "@/data/xstocks";
import { planFor, fmtUSD } from "@/lib/stocklana";
import { useWallet } from "@/hooks/useWallet";
import { track } from "@/lib/analytics";

const QUICK = [25, 100, 500, 2500];

export default function BasketSheet({ basket, prices, onClose, onBuy, onPlan, sync }) {
  const wallet = useWallet();
  const usdcBalance = sync?.active ? sync.usdc : null;
  const [amount, setAmount] = useState("100");
  const [cad, setCad] = useState("once");
  const [pending, setPending] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [failedSyms, setFailedSyms] = useState([]); // legs of the last buy that didn't go through
  const amtTimer = useRef(null);
  const usd = Math.max(0, parseFloat(String(amount).replace(/[^0-9.]/g, "")) || 0);
  const legs = useMemo(() => (basket ? planFor(basket, usd, prices) : []), [basket, usd, prices]);

  useEffect(() => {
    if (!basket) return;
    setAmount("100"); setCad("once"); setFailedSyms([]);
    track("basket_open", { basket: basket.id });
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [basket, onClose]);

  const changeAmount = (v) => {
    setAmount(v);
    setFailedSyms([]); // leg sizes change with the amount, so a partial-retry no longer applies
    clearTimeout(amtTimer.current);
    amtTimer.current = setTimeout(() => track("amount_set", { basket: basket?.id, usd: parseFloat(v) || 0 }), 900);
  };
  const changeCad = (c) => { setCad(c); track("cadence_set", { basket: basket?.id, cad: c }); };
  const insufficientBalance = cad === "once" && usdcBalance != null && usd > usdcBalance;
  // While a wallet is connected but its balance hasn't loaded yet (or sync failed), we
  // don't actually know if there's enough USDC — the check above silently passes when
  // usdcBalance is still null. Block submitting a real buy until we genuinely know.
  const balanceUnknown = cad === "once" && sync?.active && !sync?.holdingsTrustworthy;
  // A one-time buy signs and sends a real transaction, so it always needs a wallet —
  // unlike a recurring plan, which stays simulated in this build either way (see the
  // disclaimer below), so it's fine to start one without connecting anything.
  const walletRequired = cad === "once" && !wallet.connected;
  const lowSol = sync?.active && sync.sol != null && sync.sol < 0.003;
  const tinyLegs = usd >= MIN_ORDER_USD && legs.some((l) => l.amount < 1);
  const submit = async () => {
    if (usd < MIN_ORDER_USD || pending || insufficientBalance || balanceUnknown || walletRequired) return;
    if (cad !== "once") { onPlan(basket, usd, cad); onClose(); return; }
    setPending(true);
    try {
      const r = await onBuy(basket, usd, failedSyms.length ? failedSyms : undefined);
      if (r?.blocked) return; // toast already explained; stay open
      const failed = (r?.failures || []).map((f) => f.sym);
      setFailedSyms(failed);
      if (!failed.length) onClose();
    } finally { setPending(false); }
  };

  return (
    <AnimatePresence>
      {basket && (
        <>
          <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
          <div key="wrap" className="fixed inset-x-0 bottom-0 z-[61] flex justify-center pointer-events-none">
            <motion.div
              role="dialog" aria-modal="true" aria-labelledby="basket-sheet-title"
              initial={{ y: 40, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}
              className="pointer-events-auto w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-[20px] bg-bg shadow-2xl px-4 pb-8 pt-3 md:px-6"
            >
              <div className="w-10 h-1 rounded-full bg-line mx-auto mb-3" />
              <div className="flex items-center justify-between gap-3">
                <h2 id="basket-sheet-title" className="text-[22px] font-semibold text-ink">{basket.name}</h2>
                <button onClick={onClose} aria-label="Close" className="w-[34px] h-[34px] rounded-full bg-surface2 grid place-items-center text-muted hover:text-ink"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-ink2 text-[13.5px] mt-1">{basket.thesis}</p>
              <AllocBar className="mt-3" items={basket.legs.map(([s, w]) => ({ label: s, pct: w }))} />

              <div className="mt-5 flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="basket-amount" className="text-[12.5px] text-muted font-medium">Amount</label>
                    {usdcBalance != null && <span className="text-[12.5px] text-muted">{fmtUSD(usdcBalance)} available</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl2 bg-surface2 px-4 py-3 focus-within:ring-2 focus-within:ring-accent/40">
                    <span className="text-xs font-semibold text-muted">USDC</span>
                    <input id="basket-amount" inputMode="decimal" value={amount} disabled={pending} onChange={(e) => changeAmount(e.target.value)} className="flex-1 min-w-0 bg-transparent text-ink font-mono text-2xl focus:outline-none disabled:opacity-60" />
                    <span className="text-xs text-muted whitespace-nowrap">{usd ? `= ${fmtUSD(usd)}` : ""}</span>
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {QUICK.map((q) => (
                      <button key={q} type="button" onClick={() => changeAmount(String(q))} className="px-2.5 py-1 rounded-full text-[12.5px] bg-surface2 text-ink2 hover:text-ink">${q.toLocaleString()}</button>
                    ))}
                    {usdcBalance > 0 && (
                      <button type="button" onClick={() => changeAmount(String(Math.floor(usdcBalance * 100) / 100))} className="px-2.5 py-1 rounded-full text-[12.5px] bg-surface2 text-ink2 hover:text-ink">Max</button>
                    )}
                  </div>
                  {usdcBalance != null && (
                    <p className={`text-[12px] mt-1.5 ${usd > usdcBalance ? "text-loss" : "text-muted"}`}>
                      {usd > usdcBalance ? `Only ${fmtUSD(usdcBalance)} USDC in this wallet. ` : "Need more USDC? "}
                      {sync?.sol != null && <button type="button" onClick={() => setConvertOpen(true)} className="text-accent font-medium hover:brightness-110">Convert SOL to USDC →</button>}
                    </p>
                  )}
                </div>
                {!basket.single && <div>
                  <span className="text-[12.5px] text-muted font-medium">Cadence</span>
                  <div className="mt-1.5 flex gap-1 p-[3px] rounded-xl2 bg-surface2" role="radiogroup" aria-label="Cadence">
                    {Object.entries(CADENCE).map(([k, c]) => (
                      <button key={k} type="button" role="radio" aria-checked={cad === k} onClick={() => changeCad(k)} className={`flex-1 px-1 py-2 rounded-[9px] text-[13px] font-medium whitespace-nowrap transition-colors ${cad === k ? "bg-ink text-bg" : "text-ink2 hover:text-ink"}`}>{c.label}</button>
                    ))}
                  </div>
                </div>}
                <div>
                  <h4 className="text-[15px] font-semibold text-ink mb-2">What you'll get</h4>
                  <ExecutionPlan legs={legs} usd={usd} cad={cad} />
                </div>
                {cad === "once" && wallet.connected && (lowSol || tinyLegs) && (
                  <p className="text-[12px] text-warn -mb-2">
                    {lowSol && "Your wallet is nearly out of SOL, which pays network fees, so these swaps may fail. "}
                    {tinyLegs && "Some stocks would get under $1 each and Jupiter may reject swaps that small; try a larger amount."}
                  </p>
                )}
                <button type="button" onClick={submit} disabled={usd < MIN_ORDER_USD || pending || insufficientBalance || balanceUnknown || walletRequired} className="w-full px-5 py-4 rounded-xl2 text-[15px] font-semibold bg-accent text-accent-ink hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed">
                  {pending ? "Confirm in wallet…" : walletRequired ? "Connect wallet to buy" : failedSyms.length ? `Retry ${failedSyms.length} failed leg${failedSyms.length === 1 ? "" : "s"} (${failedSyms.join(", ")})` : balanceUnknown ? "Syncing your balance…" : insufficientBalance ? "Not enough USDC" : cad === "once" ? `Buy ${basket.name} for ${fmtUSD(usd)}` : `Start ${CADENCE[cad].label.toLowerCase()} plan · ${fmtUSD(usd)}${CADENCE[cad].per}`}
                </button>
                <p className="text-[12.5px] text-muted">
                  {cad === "once"
                    ? (wallet.connected ? `Real: signs and sends ${legs.length} Jupiter swaps from ${wallet.short}. Your wallet asks you to approve them together in one prompt (or one at a time if it doesn't support batching).` : "Connect a wallet to buy — this signs and sends real transactions on Solana mainnet, nothing simulated.")
                    : (wallet.connected ? "Recurring plans are still simulated in this build — only a one-time buy signs a real transaction." : `Simulated: on mainnet this creates ${legs.length} Jupiter Recurring orders (one per leg) that your wallet signs once.`)}
                </p>
              </div>
            </motion.div>
          </div>
          <ConvertSolSheet open={convertOpen} solBalance={sync?.sol} onClose={() => setConvertOpen(false)} />
        </>
      )}
    </AnimatePresence>
  );
}
