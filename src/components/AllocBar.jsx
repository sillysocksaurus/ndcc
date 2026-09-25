import React from "react";
import { SERIES } from "@/data/xstocks";

export default function AllocBar({ items, height = 12, className = "" }) {
  return (
    <div className={`flex gap-[2px] overflow-hidden rounded-full ${className}`} style={{ height }} role="img" aria-label={items.map((i) => `${i.label} ${i.pct.toFixed(1)}%`).join(", ")}>
      {items.map((it, i) => (
        <span key={it.label} title={`${it.label} ${it.pct.toFixed(1)}%`} style={{ width: `${it.pct}%`, background: SERIES[i % SERIES.length] }} className="block h-full" />
      ))}
    </div>
  );
}

export function AllocLegend({ items, right }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-x-2.5 gap-y-1.5 mt-3 text-xs text-ink2 items-center">
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />
          <span className="truncate">{it.label}</span>
          <span className="font-mono tnum text-ink text-right">{right ? right(it) : `${it.pct.toFixed(1)}%`}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
