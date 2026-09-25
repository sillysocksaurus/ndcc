import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import BasketCard from "@/components/BasketCard";
import BasketSheet from "@/components/BasketSheet";
import Disclosure from "@/components/Disclosure";
import { BASKETS, TOKENS, SNAPSHOT_ISO } from "@/data/xstocks";
import { useStocklana, usePrices } from "@/hooks/useStocklana";
import { isNyseOpen, nextNyseOpen, fmtUSD } from "@/lib/stocklana";
import { useCustomBaskets, mergeCustomBaskets } from "@/lib/customBaskets";
import { toast } from "@/lib/toast";

function Why() {
  const now = new Date();
  const open = isNyseOpen(now);
  const next = nextNyseOpen(now);
  const items = [
    ["Trades 24/7", open ? "NYSE is open right now; Solana pools never close." : `It is ${now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}. NYSE reopens ${next ? next.toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "soon"}; Solana pools are quoting right now.`],
    ["Any amount", "Shares are fractional, so even $5 buys a slice of every stock in the basket."],
    ["Full transparency", "See the price, fees and route for every leg before you confirm."],
    ["You hold the keys", "Baskets are just tokens in your wallet. Leave any time; nothing to withdraw."],
  ];
  return (
    <Disclosure label="How this works" openLabel="Hide details" className="mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map(([t, b]) => (
          <div key={t} className="rounded-xl bg-surface2 p-3 text-[13px] text-ink2">
            <b className="block text-ink font-medium mb-0.5">{t}</b>{b}
          </div>
        ))}
      </div>
    </Disclosure>
  );
}

export default function Baskets() {
  const { buyBasket, createPlan, sync } = useStocklana();
  const { prices, live, fetchedAt } = usePrices();
  const customBaskets = useCustomBaskets();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);

  const allBaskets = useMemo(() => mergeCustomBaskets(BASKETS, customBaskets), [customBaskets]);
  const themes = useMemo(() => ["All", ...Array.from(new Set(allBaskets.map((b) => b.theme)))], [allBaskets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allBaskets.filter((b) => (filter === "All" || b.theme === filter) && (!q || b.name.toLowerCase().includes(q) || b.legs.some(([s]) => s.toLowerCase().includes(q) || TOKENS[s].name.toLowerCase().includes(q))));
  }, [allBaskets, filter, search]);

  const onBuy = async (basket, usd, onlySyms) => {
    const r = await buyBasket(basket, usd, onlySyms);
    if (!r) return r;
    if (r.blocked === "wallet") { toast({ title: "Connect a wallet to buy", description: "Trades sign and send real transactions — there's no simulated mode." }); return r; }
    if (r.blocked === "syncing") { toast({ title: "Still syncing your wallet", description: "Try again in a moment." }); return r; }
    if (r.legs.length) toast({ title: `Bought ${r.failures?.length || onlySyms ? "part of " : ""}${basket.name}`, description: `${r.legs.length} Jupiter swaps signed on-chain.` });
    if (r.failures?.length) toast({ title: `${r.failures.length} leg${r.failures.length === 1 ? "" : "s"} failed`, description: `${r.failures.map((f) => f.sym).join(", ")} — you can retry just those.` });
    return r;
  };
  const onPlan = (basket, usd, cad) => { if (createPlan(basket, usd, cad)) toast({ title: `${basket.name} plan created`, description: `${fmtUSD(usd)} ${cad}. Simulated planner only: no on-chain orders are created and nothing buys automatically.` }); };
  const snap = new Date(fetchedAt || SNAPSHOT_ISO).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight">Buy a basket of stocks in one tap.</h1>
      <p className="text-ink2 mt-2 max-w-[60ch]">Weighted baskets of tokenized stocks, always open, held right in your wallet.</p>
      <Link to="/robo" className="mt-3 flex items-center gap-1.5 text-[13px] text-accent font-medium w-fit"><Sparkles className="w-3.5 h-3.5" />Not sure where to start? Let Robo pick for you</Link>
      <Why />

      <div className="relative mt-6 mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input type="search" placeholder="Search baskets or stocks" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl2 bg-surface2 text-ink placeholder:text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {themes.map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${filter === t ? "bg-ink text-bg" : "bg-surface2 text-ink2 hover:text-ink"}`}>{t}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted text-sm text-center py-16">No baskets match.</p>
      ) : (
        <div className="flex flex-col gap-3">{filtered.map((b) => <BasketCard key={b.id} basket={b} prices={prices} onOpen={setOpen} />)}</div>
      )}

      <Disclosure label="Pricing & data sources" className="mt-8">
        <p className="text-xs text-muted leading-relaxed">
          Prices {live ? "live from Jupiter Price API v3" : `from a Jupiter Price API snapshot taken ${snap} UTC`}. Pool depth from Jupiter Token API; impact is a depth estimate, the real number comes from a Jupiter quote at signing. Mints are Backed xStocks on Solana mainnet, e.g. SPYx <code className="font-mono text-[11px]">{TOKENS.SPYx.mint}</code>. One-time buys sign and send real Jupiter swaps from your wallet; recurring plans are simulated. Not investment advice, and tokenized stocks may not be available in your jurisdiction (including the US).
        </p>
      </Disclosure>

      <BasketSheet basket={open} prices={prices} onClose={() => setOpen(null)} onBuy={onBuy} onPlan={onPlan} sync={sync} />
    </div>
  );
}
