import React from "react";
import AllocBar from "./AllocBar";
import TokenLogo from "./TokenLogo";
import { feesFor, totalCost, fmtUSD } from "@/lib/stocklana";

const MAX_LOGOS = 6;

export default function BasketCard({ basket, prices, onOpen }) {
  const cost100 = totalCost(feesFor(basket, 100, prices));
  const byWeight = [...basket.legs].sort((a, b) => b[1] - a[1]);
  return (
    <button
      type="button"
      onClick={() => onOpen(basket)}
      aria-label={`Open ${basket.name}`}
      className="w-full text-left rounded-2xl bg-surface p-4 sm:p-5 hover:bg-surface2 transition-colors active:scale-[.995]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[19px] font-semibold text-ink">{basket.name}</h3>
          <p className="text-ink2 text-[13.5px] mt-1 leading-snug">{basket.thesis}</p>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface2 text-muted font-medium shrink-0">{basket.theme}</span>
      </div>
      <div className="flex items-center -space-x-2 mt-3">
        {byWeight.slice(0, MAX_LOGOS).map(([s], i) => (
          <TokenLogo key={s} sym={s} index={i} size={26} className="ring-2 ring-surface" />
        ))}
        {byWeight.length > MAX_LOGOS && (
          <span className="w-[26px] h-[26px] rounded-full bg-surface2 ring-2 ring-surface grid place-items-center text-[10px] font-semibold text-muted shrink-0">+{byWeight.length - MAX_LOGOS}</span>
        )}
      </div>
      <AllocBar className="mt-3" items={basket.legs.map(([s, w]) => ({ label: s, pct: w }))} />
      <p className="mt-3 text-[12.5px] text-muted">
        {basket.legs.length} stocks · about <span className="text-ink2 font-medium tnum">{fmtUSD(cost100)}</span> in fees on a $100 buy
      </p>
    </button>
  );
}
