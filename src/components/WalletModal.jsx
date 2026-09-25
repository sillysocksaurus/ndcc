import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useModalA11y } from "@/hooks/useModalA11y";

const TERMS_KEY = "ndcc_terms_ok";
const readTerms = () => { try { return localStorage.getItem(TERMS_KEY) === "1"; } catch { return false; } };

export default function WalletModal({ open, wallets, onSelect, onClose }) {
  useModalA11y(open, onClose);
  const [agreed, setAgreed] = useState(readTerms);
  const [needsAgree, setNeedsAgree] = useState(false);
  const toggleAgreed = (v) => { setAgreed(v); setNeedsAgree(false); try { localStorage.setItem(TERMS_KEY, v ? "1" : "0"); } catch { /* ignore */ } };
  const pick = (w, installed) => {
    if (!installed) { window.open(w.adapter.url, "_blank", "noopener"); return; }
    if (!agreed) { setNeedsAgree(true); return; }
    onSelect(w.adapter.name);
  };
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/50" onClick={onClose} />
          <div key="wrap" className="fixed inset-x-0 bottom-0 z-[71] flex justify-center pointer-events-none sm:items-center sm:inset-0">
            <motion.div
              role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title"
              initial={{ y: 40, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto w-full sm:max-w-sm max-h-[80vh] overflow-y-auto rounded-t-[20px] sm:rounded-2xl bg-bg shadow-2xl p-5"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <h2 id="wallet-modal-title" className="text-[17px] font-semibold text-ink">Connect a wallet</h2>
                <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface2 grid place-items-center text-muted hover:text-ink"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[12.5px] text-muted mb-3">Trades sign and send real transactions on Solana mainnet.</p>
              <label className={`flex items-start gap-2.5 text-[12.5px] mb-3 cursor-pointer rounded-lg p-2 -mx-2 ${needsAgree ? "bg-loss/10 text-loss ring-1 ring-loss/40" : "text-ink2"}`}>
                <input type="checkbox" checked={agreed} onChange={(e) => toggleAgreed(e.target.checked)} className="mt-0.5 rounded" />
                <span>{needsAgree && <b>Tick this box to continue. </b>}I understand tokenized stocks are risky, aren't investment advice, and may not be available in my jurisdiction. I'm not a US person or resident of a restricted country.</span>
              </label>
              <div className="flex flex-col gap-2">
                {wallets.map((w) => {
                  const installed = w.readyState === WalletReadyState.Installed;
                  return (
                    <button
                      key={w.adapter.name}
                      type="button"
                      onClick={() => pick(w, installed)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl2 bg-surface2 hover:bg-accent-soft transition-colors text-left"
                    >
                      <img src={w.adapter.icon} alt="" className="w-7 h-7 rounded-md" />
                      <span className="flex-1 text-[15px] font-medium text-ink">{w.adapter.name}</span>
                      <span className="text-[11.5px] text-muted">{installed ? "Detected" : "Install"}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
