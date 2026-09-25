import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LineChart, ShoppingBasket, Rocket, Wallet, Clock, Layers } from "lucide-react";
import TokenLogo from "@/components/TokenLogo";
import AllocBar from "@/components/AllocBar";
import { TOKENS, BASKETS } from "@/data/xstocks";
import { usePrices } from "@/hooks/useStocklana";
import { fmtUSD } from "@/lib/stocklana";

const about = [
  "Public markets haven't fundamentally changed since 1602. Listing on a traditional exchange can cost hundreds of thousands to millions, take over a year, and still fail to deliver after the IPO. Private fundraising is just as hard: VC backing is fiercely competitive, and businesses struggle to find the marketing partners and developers they need in a digital-first economy.",
  "NDCC exists to fix that. We're a centralized gateway to decentralized capital markets: one platform where emerging businesses raise capital, connect with VCs and crowd investors, list, and grow. By removing layers of intermediaries we cut listing costs by millions and give companies a supported route to market.",
  "We're scaling toward 100 listed companies by the end of 2026, with a full market launch targeted for 2027.",
];

const steps = [
  { icon: Wallet, title: "Connect a wallet", body: "Phantom or Solflare. Your stocks live in your wallet as plain tokens, never in ours." },
  { icon: LineChart, title: "Buy a stock or a basket", body: "Pick one tokenized stock on Trade, or a ready-made basket. Every swap is quoted before you sign." },
  { icon: Clock, title: "Trade around the clock", body: "Solana never closes. Buy at 3am on a Sunday if you want to." },
];

const btnPrimary = "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-accent text-accent-ink hover:brightness-110 transition";
const btnGhost = "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-surface2 border border-line text-ink hover:brightness-110 transition";

export default function Home() {
  const { prices } = usePrices();
  const featured = Object.entries(TOKENS).sort((a, b) => b[1].liq - a[1].liq).slice(0, 4).map(([sym, t]) => ({ sym, ...t, price: prices[sym] ?? t.price }));
  const baskets = BASKETS.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl mb-8 border border-line">
        {/* Purple contour-wave artwork from the NDCC brand, darkened so the text stays readable. */}
        <div className="absolute inset-0 bg-[#141420]" />
        <img src="/ndcc-waves.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d1a]/60 via-[#0d0d1a]/35 to-[#0d0d1a]/80" />
        <div className="relative px-6 py-12 md:px-10 md:py-16 flex flex-col items-center text-center">
          <img src="/ndcc-logo.png" alt="NDCC" width="88" height="88" className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-[#0d0d1a] border border-white/10 mb-5" />
          <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-accent-soft text-accent mb-5">Tokenized stocks on Solana</span>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white">Reimagining public markets<br className="hidden sm:block" /> for the digital age</h1>
          <p className="text-gray-300 mt-4 text-sm md:text-lg max-w-2xl leading-relaxed">
            Buy tokenized stocks one at a time or as ready-made baskets, straight from your own wallet, 24 hours a day.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link to="/trade" className={btnPrimary}>Trade stocks<ArrowRight className="w-4 h-4" /></Link>
            <Link to="/baskets" className={btnGhost}>Browse baskets<ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[[String(Object.keys(TOKENS).length), "tokenized stocks"], [String(BASKETS.length), "ready-made baskets"], ["24/7", "always open"]].map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-surface p-4 text-center">
            <p className="font-display text-2xl font-bold text-ink tnum">{v}</p>
            <p className="text-[12px] text-muted mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Pre-IPO */}
      <Link to="/trade" className="block rounded-2xl border border-line bg-gradient-to-r from-accent/15 to-cyan/10 p-4 sm:p-5 mb-8 hover:brightness-110 transition">
        <p className="text-[12px] font-medium text-cyan">New · Pre-IPO</p>
        <p className="text-[16px] font-semibold text-ink mt-0.5">Trade Anthropic, OpenAI, SpaceX and more before they list</p>
        <p className="text-[12.5px] text-ink2 mt-1">PreStocks and Tessera tokens on Solana, with a live premium or discount to reference price. Or grab a bundle in the PreStocks Frontier and Private Markets baskets. <span className="text-accent font-medium">Explore →</span></p>
      </Link>

      {/* Featured stocks */}
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[17px] font-semibold text-ink flex items-center gap-2"><LineChart className="w-4 h-4 text-cyan" />Most liquid stocks</h2>
        <Link to="/trade" className="text-[13px] text-accent font-medium hover:brightness-110">See all →</Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-2.5 mb-8">
        {featured.map((s, i) => (
          <Link key={s.sym} to="/trade" className="rounded-2xl bg-surface hover:bg-surface2 transition-colors p-3.5 flex items-center gap-3">
            <TokenLogo sym={s.sym} index={i} size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-ink truncate">{s.name}</p>
              <p className="text-[12px] text-muted font-mono">{s.sym} · {s.sector}</p>
            </div>
            <span className="font-mono tnum font-semibold text-ink">{fmtUSD(s.price)}</span>
          </Link>
        ))}
      </div>

      {/* Featured baskets */}
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[17px] font-semibold text-ink flex items-center gap-2"><ShoppingBasket className="w-4 h-4 text-cyan" />Popular baskets</h2>
        <Link to="/baskets" className="text-[13px] text-accent font-medium hover:brightness-110">See all →</Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-2.5 mb-8">
        {baskets.map((b) => (
          <Link key={b.id} to="/baskets" className="rounded-2xl bg-surface hover:bg-surface2 transition-colors p-4 flex flex-col gap-2.5">
            <p className="text-[15px] font-semibold text-ink">{b.name}</p>
            <p className="text-[12.5px] text-ink2 leading-snug line-clamp-3">{b.thesis}</p>
            <AllocBar className="mt-auto" items={b.legs.map(([s, w]) => ({ label: s, pct: w }))} height={8} />
          </Link>
        ))}
      </div>

      {/* How it works */}
      <h2 className="text-[17px] font-semibold text-ink mb-2.5 flex items-center gap-2"><Layers className="w-4 h-4 text-cyan" />How it works</h2>
      <div className="grid sm:grid-cols-3 gap-2.5 mb-8">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="rounded-2xl bg-surface p-4">
            <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent grid place-items-center mb-3"><Icon className="w-5 h-5" /></span>
            <p className="text-[14.5px] font-semibold text-ink"><span className="text-muted font-mono text-[12px] mr-1.5">{i + 1}</span>{title}</p>
            <p className="text-[12.5px] text-ink2 mt-1 leading-snug">{body}</p>
          </div>
        ))}
      </div>

      {/* About */}
      <div className="relative mb-8 px-5 py-12 md:py-14 rounded-3xl overflow-hidden border border-line bg-surface">
        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(ellipse at 50% 0%, rgb(var(--accent-soft) / 0.6), transparent 70%)" }} />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold lowercase tracking-tight text-ink mb-6">about us</h2>
          <div className="text-ink2 text-sm md:text-base leading-relaxed flex flex-col gap-4">{about.map((p, i) => <p key={i}>{p}</p>)}</div>
        </div>
      </div>

      {/* CTA */}
      <div className="relative overflow-hidden rounded-2xl p-8 text-center border border-line">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/15 to-transparent" />
        <div className="relative">
          <h2 className="text-xl font-bold text-ink mb-2 flex items-center justify-center gap-2"><Rocket className="w-5 h-5 text-accent" />Ready to list your business?</h2>
          <p className="text-ink2 text-sm mb-5 max-w-md mx-auto">Launch through NDCC and reach capital, investors and a built-in community on a lower-cost platform.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/launches" className={btnGhost}>See new listings<ArrowRight className="w-4 h-4" /></Link>
            <a href="https://newdawn.services/" target="_blank" rel="noreferrer" className={btnPrimary}>Talk to NDCC<ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      </div>
    </div>
  );
}
