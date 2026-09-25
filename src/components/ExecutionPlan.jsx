import React from "react";
import { LP_FEE, NET_FEE_USD, CADENCE } from "@/data/xstocks";
import { fmtUSD, fmtNum, fmtPct } from "@/lib/stocklana";
import Disclosure from "./Disclosure";
import TokenLogo from "./TokenLogo";

export default function ExecutionPlan({ legs, usd, cad = "once" }) {
  const sliced = legs.filter((l) => l.slices > 1);
  const maxSlices = sliced.length ? Math.max(...sliced.map((l) => l.slices)) : 0;
  const impact = legs.reduce((t, l) => t + (l.amount * l.impact) / 100, 0);
  const lp = usd * LP_FEE;
  const net = legs.length * NET_FEE_USD;
  const total = impact + lp + net;
  const per = CADENCE[cad]?.per || "";
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-surface2 divide-y divide-line/60 overflow-hidden">
        {legs.map((l) => (
          <div key={l.sym} className="flex items-center justify-between gap-3 px-3.5 py-3 text-[13px]">
            <span className="flex items-center gap-2 font-semibold text-ink">
              <TokenLogo sym={l.sym} index={l.index} size={20} />
              {l.sym}
              <span className="text-muted font-normal text-xs">{fmtPct(l.weight, 1)}</span>
              {l.slices > 1 && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-accent-soft text-accent font-medium">thin pool</span>}
            </span>
            <span className="font-mono tnum text-ink">{fmtUSD(l.amount)}</span>
          </div>
        ))}
      </div>
      {sliced.length > 0 && (
        <p className="text-[12.5px] text-muted px-0.5">
          {sliced.map((l) => l.sym).join(", ")} {sliced.length === 1 ? "is a" : "are"} thin pool{sliced.length === 1 ? "" : "s"}: at this size the price impact is high, and every swap executes immediately in one go. Consider buying in about {maxSlices} smaller chunks over time.
        </p>
      )}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[13px] text-ink2">Total cost{per}</span>
        <span className="font-mono tnum text-ink font-semibold">{fmtUSD(total)} <span className="text-muted font-normal text-xs">({fmtPct(usd ? (100 * total) / usd : 0, 2)})</span></span>
      </div>
      <Disclosure label="Show fee breakdown">
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[13px] text-ink2">
          <span>Price impact (est.)</span><span className="font-mono tnum">{fmtUSD(impact)}</span>
          <span>Liquidity-provider fees ({fmtNum(LP_FEE * 100, 2)}%)</span><span className="font-mono tnum">{fmtUSD(lp)}</span>
          <span>Network fees ({legs.length} swaps)</span><span className="font-mono tnum">{fmtUSD(net)}</span>
          <span>NDCC commission · spread · FX</span><span className="font-mono tnum">$0.00</span>
          <span>Jupiter routing fee</span><span className="font-mono tnum text-muted">set at signing</span>
        </div>
        <p className="text-[11.5px] text-muted mt-2">The estimates above use a depth model. Jupiter's own routing fee and the exact price impact are only known when your wallet is asked to sign, and can differ.</p>
      </Disclosure>
    </div>
  );
}
