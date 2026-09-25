import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useModalA11y } from "@/hooks/useModalA11y";
import { quoteCurveSwap, swapOnCurve, fmtQuote } from "@/lib/dbc";
import { fmtNum } from "@/lib/stocklana";
import { toast } from "@/lib/toast";

// Wider than the ~0.5% guard used for the established xStock pools — a brand-new
// curve is thin by construction in its first hours, so a tighter slippage bound
// would just fail most quotes rather than protect anyone.
const SLIPPAGE_BPS = 150;

export default function LaunchBuySheet({ launch, status, onClose, onTraded }) {
  const wallet = useWallet();
  useModalA11y(!!launch, onClose);
  const [side, setSide] = useState("buy"); // buy: USDC -> token, sell: token -> USDC
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!launch) return;
    setAmount(""); setQuote(null); setSide("buy"); setPending(false);
  }, [launch]);

  useEffect(() => {
    if (!launch || launch.isMigrated) return;
    const usd = Number(amount);
    if (!usd || usd <= 0) { setQuote(null); return; }
    let alive = true;
    setQuoting(true);
    const t = setTimeout(() => {
      if (launch.example) {
        // No real pool behind an example — price it off a fixed made-up rate
        // instead of a live curve quote, with a token 0.5% fee bite so the
        // number still moves the way a real quote would.
        const price = launch.examplePriceUsd || 0.01;
        const outputUi = (side === "buy" ? Number(amount) / price : Number(amount) * price) * 0.995;
        setQuote({ outputUi });
        setQuoting(false);
        return;
      }
      quoteCurveSwap({ pool: launch.pool, amountUi: usd, swapBaseForQuote: side === "sell", slippageBps: SLIPPAGE_BPS })
        .then((q) => { if (alive) setQuote(q); })
        .catch((e) => { if (alive) { setQuote(null); toast({ title: "Quote failed", description: e.message || String(e) }); } })
        .finally(() => { if (alive) setQuoting(false); });
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [launch, amount, side]);

  const submit = async () => {
    if (!launch || !quote || pending || !wallet.connected) return;
    setPending(true);
    try {
      if (launch.example) {
        await new Promise((r) => setTimeout(r, 600)); // a beat, so "Confirm in wallet…" reads naturally
        const outSym = side === "buy" ? symbol : (status?.quoteSym || launch?.quoteSym || "USDC");
        toast({ title: `${side === "buy" ? "Bought" : "Sold"} ${fmtNum(quote.outputUi, side === "buy" ? 4 : 2)} ${outSym} (example)`, description: "No real transaction was sent — this is a preview of the trade flow, not a real pool." });
        onClose();
        return;
      }
      const r = await swapOnCurve({ pool: launch.pool, amountUi: Number(amount), swapBaseForQuote: side === "sell", wallet, slippageBps: SLIPPAGE_BPS });
      toast({ title: side === "buy" ? `Bought ${launch.symbol || "the token"}` : `Sold ${launch.symbol || "the token"}`, description: `Signature ${r.signature.slice(0, 12)}… confirmed on-chain.` });
      onTraded?.();
      onClose();
    } catch (e) {
      toast({ title: "Trade failed", description: e.message || String(e) });
    } finally {
      setPending(false);
    }
  };

  const symbol = launch?.symbol || "token";
  const qSym = status?.quoteSym || launch?.quoteSym || "USDC"; // what the pool is priced in
  const canSubmit = launch && !launch.isMigrated && wallet.connected && quote && !pending && Number(amount) > 0;

  return createPortal(
    <AnimatePresence>
      {launch && (
        <>
          <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
          <div key="wrap" className="fixed inset-x-0 bottom-0 z-[61] flex justify-center pointer-events-none sm:items-center sm:inset-0">
            <motion.div
              role="dialog" aria-modal="true" aria-labelledby="launch-buy-title"
              initial={{ y: 40, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}
              className="pointer-events-auto w-full sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-t-[20px] sm:rounded-2xl bg-bg shadow-2xl p-5"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <h2 id="launch-buy-title" className="text-[17px] font-semibold text-ink">{launch.name || symbol}</h2>
                <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface2 grid place-items-center text-muted hover:text-ink"><X className="w-4 h-4" /></button>
              </div>

              {launch.isMigrated ? (
                <p className="text-[13px] text-ink2 mt-3">
                  {launch.example
                    ? "Example only. Once a real listing graduates to a regular Meteora DAMM v2 pool, it stops being a bonding curve and trades wherever you'd trade any other Solana token."
                    : "This launch has already migrated to a regular Meteora DAMM v2 pool — it's a normal token now, not a bonding curve. Trade it wherever you'd trade any other Solana token."}
                </p>
              ) : (
                <>
                  <p className="text-[12.5px] text-muted mb-4">
                    {launch.example
                      ? "Example only — priced off a made-up rate, not a live curve. Shows the flow; no real transaction is ever sent."
                      : "A real Dynamic Bonding Curve swap, signed by your wallet — not a Jupiter route."}
                  </p>

                  <div className="flex gap-1 p-[3px] rounded-xl2 bg-surface2 mb-3" role="radiogroup">
                    <button type="button" role="radio" aria-checked={side === "buy"} onClick={() => { setSide("buy"); setAmount(""); }} className={`flex-1 px-1 py-2 rounded-[9px] text-[13px] font-medium ${side === "buy" ? "bg-ink text-bg" : "text-ink2 hover:text-ink"}`}>Buy {symbol}</button>
                    <button type="button" role="radio" aria-checked={side === "sell"} onClick={() => { setSide("sell"); setAmount(""); }} className={`flex-1 px-1 py-2 rounded-[9px] text-[13px] font-medium ${side === "sell" ? "bg-ink text-bg" : "text-ink2 hover:text-ink"}`}>Sell {symbol}</button>
                  </div>

                  <div className="rounded-xl2 bg-surface2 px-4 py-3">
                    <span className="text-xs font-semibold text-muted">{side === "buy" ? qSym : symbol}</span>
                    <input
                      inputMode="decimal" value={amount} disabled={pending}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0.00"
                      className="w-full mt-1 bg-transparent text-ink font-mono text-2xl focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div className="rounded-xl2 bg-surface2 px-4 py-3 mt-2">
                    <span className="text-xs font-semibold text-muted">{side === "buy" ? symbol : qSym} (estimated)</span>
                    <p className="text-2xl font-mono text-ink mt-1">
                      {quoting ? "…" : quote ? fmtNum(quote.outputUi, side === "buy" ? 4 : 2) : "0.00"}
                    </p>
                  </div>

                  {status && (
                    <p className="text-[12px] text-muted mt-2">
                      {fmtQuote(status.quoteReserveUi, status.quoteSym)} raised of {fmtQuote(status.migrationThresholdUi, status.quoteSym)} to graduate ({((status.quoteProgress || 0) * 100).toFixed(1)}%).
                    </p>
                  )}

                  <button type="button" onClick={submit} disabled={!canSubmit} className="w-full mt-4 px-5 py-3.5 rounded-xl2 text-[15px] font-semibold bg-accent text-accent-ink hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed">
                    {pending ? (launch.example ? "Simulating…" : "Confirm in wallet…") : !wallet.connected ? "Connect wallet to trade" : side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
