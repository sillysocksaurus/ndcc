import React, { useMemo, useState } from "react";
import { LineChart, Search, Star, ShoppingCart, ChevronDown } from "lucide-react";
import TokenLogo from "@/components/TokenLogo";
import StockChart from "@/components/StockChart";
import ConvertSolSheet from "@/components/ConvertSolSheet";
import BasketSheet from "@/components/BasketSheet";
import { TOKENS } from "@/data/xstocks";
import { useStocklana, usePrices } from "@/hooks/useStocklana";
import { useWatchlist } from "@/hooks/useWatchlist";
import { fmtUSD, fmtPct } from "@/lib/stocklana";
import { examplePct } from "@/lib/exampleOutlook";
import { toast } from "@/lib/toast";

const SECTORS = ["All", "Pre-IPO", ...Array.from(new Set(Object.values(TOKENS).filter((t) => !t.group).map((t) => t.sector))).sort()];
const SORTS = { popular: "Most liquid", priceDesc: "Price, high to low", priceAsc: "Price, low to high", name: "Name A–Z" };

// Rough depth grade off the snapshot pool liquidity: how comfortably a normal-size buy fills.
function depth(liq) {
  if (liq >= 500_000) return { label: "Deep", cls: "bg-gain-soft text-gain" };
  if (liq >= 50_000) return { label: "Medium", cls: "bg-warn-soft text-warn" };
  return { label: "Thin", cls: "bg-loss-soft text-loss" };
}

// A single stock dressed as a one-leg, 100% basket so it goes through exactly the same
// real Jupiter buy path (and the same wallet, balance and retry safeguards) as any basket.
const singleStock = (sym) => ({
  id: "stock-" + sym,
  name: TOKENS[sym].name,
  theme: "Stock",
  thesis: `One-tap buy of ${sym}, a tokenized ${TOKENS[sym].sector.toLowerCase()} holding. Sold and held as a plain token in your wallet.`,
  legs: [[sym, 100]],
  single: true,
});

export default function Trade() {
  const { buyBasket, sync } = useStocklana();
  const { prices, marks, live } = usePrices();
  const { isWatched, toggle } = useWatchlist();
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All");
  const [sort, setSort] = useState("popular");
  const [open, setOpen] = useState(null);
  const [expanded, setExpanded] = useState(null); // symbol whose chart is showing
  const [convertOpen, setConvertOpen] = useState(false);
  const canConvert = !!sync?.active && sync.sol != null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = Object.entries(TOKENS)
      .filter(([sym, t]) => {
        if (sector === "Watchlist" ? !isWatched(sym) : sector === "Pre-IPO" ? t.group !== "Pre-IPO" : sector !== "All" && t.sector !== sector) return false;
        return !q || sym.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
      })
      .map(([sym, t]) => ({ sym, ...t, price: prices[sym] ?? t.price }));
    const by = { popular: (a, b) => b.liq - a.liq, priceDesc: (a, b) => b.price - a.price, priceAsc: (a, b) => a.price - b.price, name: (a, b) => a.name.localeCompare(b.name) };
    return list.sort(by[sort]);
  }, [search, sector, sort, prices, isWatched]);

  const onBuy = async (basket, usd, onlySyms) => {
    const r = await buyBasket(basket, usd, onlySyms);
    if (!r) return r;
    if (r.blocked === "wallet") { toast({ title: "Connect a wallet to buy", description: "Trades sign and send real transactions — there's no simulated mode." }); return r; }
    if (r.blocked === "syncing") { toast({ title: "Still syncing your wallet", description: "Try again in a moment." }); return r; }
    if (r.legs.length) toast({ title: `Bought ${basket.name}`, description: "Swap signed and confirmed on-chain." });
    if (r.failures?.length) toast({ title: "Purchase failed", description: `${r.failures[0].error} — you can retry.` });
    return r;
  };

  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight flex items-center gap-2"><LineChart className="w-6 h-6 text-accent" />Trade</h1>
      <p className="text-ink2 mt-2 max-w-[60ch]">Buy any tokenized stock on its own, no basket needed. Tap a stock to see its chart. Each buy is a real Jupiter swap from your wallet.</p>
      {canConvert && (
        <p className="text-[12.5px] text-muted mt-2">
          {sync.usdc != null && <>{fmtUSD(sync.usdc)} USDC to spend · </>}
          <button onClick={() => setConvertOpen(true)} className="text-accent font-medium hover:brightness-110">Convert SOL to USDC →</button>
        </p>
      )}

      <div className="relative mt-6 mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input type="search" placeholder="Search by name or ticker" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl2 bg-surface2 text-ink placeholder:text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {["All", "Watchlist", ...SECTORS.slice(1)].map((s) => (
          <button key={s} onClick={() => setSector(s)} className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${sector === s ? "bg-accent text-accent-ink shadow-lg shadow-accent/20" : "bg-surface2 text-ink2 hover:text-ink"}`}>
            {s === "Watchlist" ? "★ Watchlist" : s}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between mb-2.5 text-[12.5px] text-muted">
        <span>{rows.length} stock{rows.length === 1 ? "" : "s"} · prices {live ? "live from Jupiter" : "from a snapshot"}</span>
        <label className="flex items-center gap-2">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-surface2 text-ink rounded-lg px-2 py-1 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-accent/40">
            {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted text-sm text-center py-16">{sector === "Watchlist" ? "Star a stock to keep it here." : "No stocks match."}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r, i) => {
            const d = depth(r.liq);
            const isOpen = expanded === r.sym;
            return (
              <div key={r.sym} className="rounded-2xl bg-surface">
              <div onClick={() => setExpanded(isOpen ? null : r.sym)} className="p-3.5 sm:p-4 flex items-center gap-3 cursor-pointer rounded-2xl hover:bg-surface2/40 transition-colors">
                <TokenLogo sym={r.sym} index={i} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-semibold text-ink truncate">{r.name}</h3>
                    <span className="text-[11.5px] font-mono text-muted">{r.sym}</span>
                  </div>
                  <p className="sm:hidden font-mono tnum font-semibold text-ink text-[14px] mt-0.5">{fmtUSD(r.price)}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-soft text-accent font-medium">{r.sector}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${d.cls}`} title={`About ${fmtUSD(r.liq, 0)} of pool liquidity (${r.venue})`}>{d.label}<span className="hidden sm:inline"> liquidity</span></span>
                    {r.group === "Pre-IPO" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface2 text-cyan font-medium">Pre-IPO</span>}
                    {(() => { const p = examplePct(r.sym); return <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface2 text-ink2 font-medium whitespace-nowrap" title="Made-up example data to show what a prediction would look like. Not a real forecast.">Outlook <b className={p >= 0 ? "text-gain" : "text-loss"}>{p >= 0 ? "▲ +" : "▼ "}{fmtPct(p, 1)}</b> <span className="text-muted">1M · example</span></span>; })()}
                  </div>
                  {r.group === "Pre-IPO" && marks[r.sym] && (() => {
                    const gap = (100 * (r.price - marks[r.sym])) / marks[r.sym];
                    return <p className="text-[11.5px] text-muted mt-1">Reference {fmtUSD(marks[r.sym])} · trades <b className={gap >= 0 ? "text-warn" : "text-gain"}>{Math.abs(gap).toFixed(1)}% {gap >= 0 ? "above" : "below"}</b></p>;
                  })()}
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <p className="font-mono tnum font-semibold text-ink">{fmtUSD(r.price)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); toggle(r.sym); }} aria-label={isWatched(r.sym) ? `Remove ${r.sym} from watchlist` : `Add ${r.sym} to watchlist`} className="shrink-0 p-1.5 rounded-lg hover:bg-surface2">
                  <Star className={`w-4 h-4 ${isWatched(r.sym) ? "fill-warn text-warn" : "text-muted"}`} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setOpen(singleStock(r.sym)); }} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold bg-accent text-accent-ink hover:brightness-110">
                  <ShoppingCart className="w-3.5 h-3.5" />Buy
                </button>
                <button onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : r.sym); }} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} ${r.sym} chart`} className="shrink-0 p-1.5 rounded-lg hover:bg-surface2 text-muted">
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
              {isOpen && (
                <div className="px-3.5 sm:px-4 pb-4">
                  <StockChart mint={r.mint} sym={r.sym} />
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button onClick={() => setOpen(singleStock(r.sym))} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl2 text-[13.5px] font-semibold bg-accent text-accent-ink hover:brightness-110"><ShoppingCart className="w-4 h-4" />Buy {r.sym}</button>
                    {canConvert && <button onClick={() => setConvertOpen(true)} className="px-4 py-2.5 rounded-xl2 text-[13.5px] font-semibold bg-surface2 text-ink hover:brightness-110">Convert SOL to USDC</button>}
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}

      {(sector === "Pre-IPO" || sector === "All") && (
        <p className="text-[11.5px] text-muted mt-6">Pre-IPO tokens are Tessera T-Tokens: tokenized exposure to private companies (OpenAI, Kalshi, SpaceX), not shares. They can trade far above or below their reference price, and pools are much thinner than for public stocks.</p>
      )}
      <p className="text-[11.5px] text-muted mt-3">Tokenized stocks are Backed xStocks on Solana. Thin pools mean higher price impact on larger buys; the exact price is confirmed when your wallet signs.</p>

      <BasketSheet basket={open} prices={prices} onClose={() => setOpen(null)} onBuy={onBuy} onPlan={() => {}} sync={sync} />
      <ConvertSolSheet open={convertOpen} solBalance={sync?.sol} onClose={() => setConvertOpen(false)} />
    </div>
  );
}
