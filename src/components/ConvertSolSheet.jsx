import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowDown } from "lucide-react";
import { SOL_MINT, SOL_DECIMALS, USDC_MINT } from "@/data/xstocks";
import { swapWithWallet } from "@/lib/jupiterSwap";
import { bumpOnChainSync } from "@/hooks/useOnChainHoldings";
import { useWallet } from "@/hooks/useWallet";
import { useModalA11y } from "@/hooks/useModalA11y";
import { fmtUSD, fmtNum } from "@/lib/stocklana";
import { toast } from "@/lib/toast";

// Leave a little SOL behind for future network fees rather than letting "Max" sweep the account to zero.
const GAS_RESERVE_SOL = 0.01;
const QUICK_PCT = [25, 50, 75];

export default function ConvertSolSheet({ open, solBalance, onClose }) {
  const wallet = useWallet();
  useModalA11y(open, onClose);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [solPrice, setSolPrice] = useState(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    let alive = true;
    fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setSolPrice(j[SOL_MINT]?.usdPrice || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  const available = Math.max(0, (solBalance || 0) - GAS_RESERVE_SOL);
  const sol = Math.max(0, parseFloat(amount) || 0);
  const overAvailable = sol > available + 1e-9;
  const estUsd = solPrice ? sol * solPrice : null;
  const canConvert = sol > 0 && !overAvailable && !pending;

  const setPct = (pct) => setAmount((available * (pct / 100)).toFixed(4));

  const convert = async () => {
    if (!canConvert) return;
    setPending(true);
    try {
      const { result } = await swapWithWallet({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: sol * 10 ** SOL_DECIMALS,
        wallet,
      });
      const usdcOut = Number(result.outputAmountResult ?? result.totalOutputAmount) / 1e6;
      toast({ title: `Converted ${fmtNum(sol, 4)} SOL`, description: `Received ${fmtUSD(usdcOut)} USDC.` });
      bumpOnChainSync();
      onClose();
    } catch (e) {
      toast({ title: "Conversion failed", description: e.message || String(e) });
    } finally {
      setPending(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[65] bg-black/50" onClick={onClose} />
          <div key="wrap" className="fixed inset-x-0 bottom-0 z-[66] flex justify-center pointer-events-none sm:items-center sm:inset-0">
            <motion.div
              role="dialog" aria-modal="true" aria-labelledby="convert-sol-title"
              initial={{ y: 40, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto w-full sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-t-[20px] sm:rounded-2xl bg-bg shadow-2xl p-5"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <h2 id="convert-sol-title" className="text-[17px] font-semibold text-ink">Convert SOL to USDC</h2>
                <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface2 grid place-items-center text-muted hover:text-ink"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[12.5px] text-muted mb-4">A real Jupiter swap, signed by your wallet — same as buying a basket.</p>

              <div className="rounded-xl2 bg-surface2 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">SOL</span>
                  <span className="text-xs text-muted">{fmtNum(solBalance || 0, 4)} in wallet</span>
                </div>
                <input
                  inputMode="decimal" value={amount} disabled={pending}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                  className="w-full mt-1 bg-transparent text-ink font-mono text-2xl focus:outline-none disabled:opacity-60"
                />
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {QUICK_PCT.map((p) => (
                  <button key={p} type="button" disabled={pending} onClick={() => setPct(p)} className="px-2.5 py-1 rounded-full text-[12.5px] bg-surface2 text-ink2 hover:text-ink disabled:opacity-60">{p}%</button>
                ))}
                <button type="button" disabled={pending} onClick={() => setPct(100)} className="px-2.5 py-1 rounded-full text-[12.5px] bg-surface2 text-ink2 hover:text-ink disabled:opacity-60">Max</button>
              </div>
              {overAvailable && <p className="text-[12px] text-loss mt-1.5">Only {fmtNum(available, 4)} SOL available (keeping {GAS_RESERVE_SOL} SOL for network fees).</p>}

              <div className="flex justify-center my-3">
                <span className="w-8 h-8 rounded-full bg-surface2 grid place-items-center text-muted"><ArrowDown className="w-4 h-4" /></span>
              </div>

              <div className="rounded-xl2 bg-surface2 px-4 py-3">
                <span className="text-xs font-semibold text-muted">USDC</span>
                <p className="text-2xl font-mono text-ink mt-1">{estUsd != null ? `≈ ${fmtUSD(estUsd)}` : sol > 0 ? "…" : "0.00"}</p>
              </div>
              <p className="text-[12px] text-muted mt-1.5">An estimate at the current SOL price — the exact amount is confirmed by a live Jupiter quote when you sign.</p>

              <button type="button" onClick={convert} disabled={!canConvert} className="w-full mt-4 px-5 py-3.5 rounded-xl2 text-[15px] font-semibold bg-accent text-accent-ink hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed">
                {pending ? "Confirm in wallet…" : "Convert"}
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
