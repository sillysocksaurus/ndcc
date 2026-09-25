import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { ShoppingBasket, Sparkles, Repeat, Wallet, ShieldCheck, Sun, Moon, Rocket, Home as HomeIcon, LineChart, Coins, PlusCircle, ChevronDown } from "lucide-react";
import Home from "@/pages/Home";
import Trade from "@/pages/Trade";
import CreateToken from "@/pages/CreateToken";
import Baskets from "@/pages/Baskets";
import Launches from "@/pages/Launches";
import Robo from "@/pages/Robo";
import Recurring from "@/pages/Recurring";
import Portfolio from "@/pages/Portfolio";
import Admin from "@/pages/Admin";
import MarketClock from "@/components/MarketClock";
import WalletModal from "@/components/WalletModal";
import { Toaster, toast } from "@/lib/toast";
import { useTheme } from "@/hooks/useTheme";
import { useWallet } from "@/hooks/useWallet";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { track } from "@/lib/analytics";
import { loadAnalyticsConfig, applyAnalyticsConfig } from "@/lib/thirdPartyAnalytics";

// Two product areas, each a menu: Stocks (tokenized shares) and Tokens (new coins people create and buy).
const GROUPS = [
  { label: "Stocks", icon: LineChart, items: [
    { to: "/trade", label: "Trade", desc: "Buy or sell individual stocks", icon: LineChart },
    { to: "/baskets", label: "Baskets", desc: "Ready-made bundles of stocks", icon: ShoppingBasket },
    { to: "/robo", label: "Robo", desc: "A portfolio picked for your risk level", icon: Sparkles },
    { to: "/recurring", label: "Recurring", desc: "Auto-buy on a schedule", icon: Repeat },
  ] },
  { label: "Tokens", icon: Coins, items: [
    { to: "/launches", label: "Launches", desc: "Buy new tokens early", icon: Rocket },
    { to: "/create", label: "Create", desc: "Launch your own token", icon: PlusCircle },
  ] },
];
const HOME_ITEM = { to: "/", label: "Home", icon: HomeIcon, end: true };
const PORTFOLIO_NAV_ITEM = { to: "/portfolio", label: "Portfolio", icon: Wallet };
const ADMIN_NAV_ITEM = { to: "/admin", label: "Admin", icon: ShieldCheck };

const inGroup = (g, pathname) => g.items.some((i) => pathname.startsWith(i.to));

// Desktop dropdown: click to open, closes on outside click, Escape or navigation.
function NavMenu({ group, pathname }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const active = inGroup(group, pathname);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[13.5px] font-medium transition-colors ${active || open ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>
        {group.label}<ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-64 rounded-xl2 bg-surface border border-line shadow-2xl p-1.5 z-50">
          {group.items.map(({ to, label, desc, icon: Icon }) => (
            <NavLink key={to} to={to} role="menuitem" className={({ isActive }) => `flex items-start gap-3 px-3 py-2.5 rounded-lg ${isActive ? "bg-accent-soft" : "hover:bg-surface2"}`}>
              {({ isActive }) => (<>
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? "text-accent" : "text-muted"}`} />
                <span><span className={`block text-[13.5px] font-semibold ${isActive ? "text-accent" : "text-ink"}`}>{label}</span><span className="block text-[12px] text-muted">{desc}</span></span>
              </>)}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// Portfolio is per-wallet, so it only exists once a wallet is connected.
function RequireWallet({ children }) {
  const { connected, connecting } = useWallet();
  if (connected) return children;
  return (
    <div className="rounded-2xl bg-surface p-7 text-center">
      <Wallet className="w-6 h-6 text-muted mx-auto mb-2" />
      <h1 className="text-[17px] font-semibold text-ink">{connecting ? "Connecting your wallet…" : "Connect a wallet to see your portfolio"}</h1>
      <p className="text-[13.5px] text-muted mt-1 max-w-[42ch] mx-auto">Your holdings are read straight from your wallet, so there's nothing to show until you connect.</p>
    </div>
  );
}

function WalletButton({ className = "" }) {
  const wallet = useWallet();
  const [pickerOpen, setPickerOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const onClick = () => {
    if (wallet.address) { setMenuOpen((o) => !o); return; }
    setPickerOpen(true);
  };
  const copyAddress = async () => {
    try { await navigator.clipboard.writeText(wallet.address); toast({ title: "Address copied" }); } catch { toast({ title: "Couldn't copy", description: wallet.address }); }
    setMenuOpen(false);
  };
  const doDisconnect = async () => {
    setMenuOpen(false);
    await wallet.disconnect();
    toast({ title: "Wallet disconnected" });
  };
  const onSelect = async (name) => {
    setPickerOpen(false);
    const r = await wallet.connect(name);
    if (!r.ok) toast({ title: r.reason === "declined" ? "Wallet connection was declined" : r.reason === "none" ? "Wallet not available" : "Couldn't connect", description: r.message || "" });
    else toast({ title: `${name} connected`, description: "Buys and rebalances now sign and send real transactions." });
  };

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={onClick} aria-haspopup={wallet.address ? "menu" : undefined} aria-expanded={wallet.address ? menuOpen : undefined} title={wallet.address || "Connect a Solana wallet"} className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface2 text-xs font-medium hover:brightness-95 transition-colors min-w-[8.25rem] justify-center ${className}`}>
        <span className={`w-2 h-2 rounded-full ${wallet.address ? "bg-gain" : "bg-muted"}`} />
        <span className="font-mono">{wallet.short || "Connect wallet"}</span>
      </button>
      {menuOpen && wallet.address && (
        <div role="menu" className="absolute right-0 mt-2 w-52 rounded-xl2 bg-surface border border-line shadow-2xl p-1.5 z-50">
          <p className="px-3 py-1.5 text-[11.5px] text-muted">{wallet.walletName || "Wallet"} · <span className="font-mono">{wallet.short}</span></p>
          <button role="menuitem" onClick={copyAddress} className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-ink hover:bg-surface2">Copy address</button>
          <button role="menuitem" onClick={doDisconnect} className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-loss hover:bg-surface2">Disconnect</button>
        </div>
      )}
      <WalletModal open={pickerOpen} wallets={wallet.wallets} onSelect={onSelect} onClose={() => setPickerOpen(false)} />
    </div>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const isAdmin = useIsAdmin();
  const { connected } = useWallet();
  // Portfolio is per-wallet and Admin is per-admin, so both appear only when they apply.
  const tailItems = [...(connected ? [PORTFOLIO_NAV_ITEM] : []), ...(isAdmin ? [ADMIN_NAV_ITEM] : [])];
  const announcedAdmin = useRef(false);
  const [sheet, setSheet] = useState(null); // label of the phone group sheet that's open
  useEffect(() => { setSheet(null); }, [pathname]);
  const openGroup = GROUPS.find((g) => g.label === sheet);

  useEffect(() => { track("app_open", {}); }, []);
  useEffect(() => { track("tab_view", { view: pathname }); window.scrollTo({ top: 0 }); }, [pathname]);
  useEffect(() => { applyAnalyticsConfig(loadAnalyticsConfig()); }, []);
  useEffect(() => {
    if (isAdmin && !announcedAdmin.current) {
      announcedAdmin.current = true;
      toast({ title: "Admin access unlocked", description: "Open the Admin tab to configure analytics." });
    }
  }, [isAdmin]);

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line2">
        <div className="max-w-4xl mx-auto px-4">
          <div className="h-14 flex items-center justify-between gap-3">
            <NavLink to="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight">
              {/* The logo is white artwork, so it sits on a dark chip to stay visible in light mode too. */}
              <img src="/ndcc-logo.png" alt="" width="28" height="28" className="w-7 h-7 rounded-lg bg-[#0d0d1a] shrink-0" />

              NDCC
            </NavLink>
            <nav className="hidden md:flex items-center gap-0.5 flex-1 ml-3" aria-label="Sections">
              {[HOME_ITEM].map(({ to, label, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `px-2.5 py-1.5 rounded-lg text-[13.5px] font-medium transition-colors ${isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>{label}</NavLink>
              ))}
              {GROUPS.map((g) => <NavMenu key={g.label} group={g} pathname={pathname} />)}
              {tailItems.map(({ to, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `px-2.5 py-1.5 rounded-lg text-[13.5px] font-medium transition-colors ${isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>{label}</NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <button onClick={toggle} aria-label="Toggle light or dark mode" className="w-8 h-8 rounded-full border border-line bg-surface grid place-items-center text-muted hover:text-ink">
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-4">
        <MarketClock />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/baskets" element={<Baskets />} />
          <Route path="/launches" element={<Launches />} />
          <Route path="/create" element={<CreateToken />} />
          <Route path="/robo" element={<Robo />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/portfolio" element={<RequireWallet><Portfolio /></RequireWallet>} />
          <Route path="/analytics" element={<Navigate to="/portfolio" replace />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="max-w-4xl mx-auto px-4 mt-10 text-[11.5px] leading-relaxed text-muted">
        NDCC is software, not a broker, exchange or adviser. Tokenized stocks and bonding-curve launches carry a high risk of loss and may be unavailable in your jurisdiction, including the United States. Nothing here is investment advice. Trades are signed by your own wallet and cannot be reversed.
      </footer>

      {openGroup && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setSheet(null)}>
          <div className="absolute inset-x-3 bottom-[76px] rounded-xl2 bg-surface border border-line shadow-2xl p-1.5" onClick={(e) => e.stopPropagation()}>
            {openGroup.items.map(({ to, label, desc, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `flex items-start gap-3 px-3 py-3 rounded-lg ${isActive ? "bg-accent-soft" : "hover:bg-surface2"}`}>
                {({ isActive }) => (<>
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${isActive ? "text-accent" : "text-muted"}`} />
                  <span><span className={`block text-[14px] font-semibold ${isActive ? "text-accent" : "text-ink"}`}>{label}</span><span className="block text-[12.5px] text-muted">{desc}</span></span>
                </>)}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line flex px-2 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom))]" aria-label="Sections">
        {[HOME_ITEM].map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[11px] font-semibold ${isActive ? "text-ink" : "text-muted"}`}>
            {({ isActive }) => (<><Icon className={`w-5 h-5 ${isActive ? "text-accent" : ""}`} />{label}</>)}
          </NavLink>
        ))}
        {GROUPS.map((g) => {
          const active = inGroup(g, pathname), Icon = g.icon;
          return (
            <button key={g.label} onClick={() => setSheet((s) => (s === g.label ? null : g.label))} aria-expanded={sheet === g.label} className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[11px] font-semibold ${active || sheet === g.label ? "text-ink" : "text-muted"}`}>
              <Icon className={`w-5 h-5 ${active || sheet === g.label ? "text-accent" : ""}`} />{g.label}
            </button>
          );
        })}
        {tailItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[11px] font-semibold ${isActive ? "text-ink" : "text-muted"}`}>
            {({ isActive }) => (<><Icon className={`w-5 h-5 ${isActive ? "text-accent" : ""}`} />{label}</>)}
          </NavLink>
        ))}
      </nav>
      <Toaster />
    </div>
  );
}
