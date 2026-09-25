import React, { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import AllocBar from "@/components/AllocBar";
import TokenLogo from "@/components/TokenLogo";
import BasketSheet from "@/components/BasketSheet";
import Disclosure from "@/components/Disclosure";
import { ROBO_PORTFOLIOS } from "@/data/xstocks";
import { QUESTIONS, scoreToProfileId } from "@/lib/risk";
import { useStocklana, usePrices } from "@/hooks/useStocklana";
import { fmtUSD } from "@/lib/stocklana";
import { toast } from "@/lib/toast";

const PROFILE_KEY = "stocklana_risk_profile";
const loadProfileId = () => { try { return localStorage.getItem(PROFILE_KEY); } catch { return null; } };

function RiskDots({ level }) {
  return (
    <span className="flex items-center gap-1 shrink-0" title={`Risk level ${level} of 4`}>
      {[1, 2, 3, 4].map((n) => <span key={n} className={`w-1.5 h-1.5 rounded-full ${n <= level ? "bg-accent" : "bg-line"}`} />)}
    </span>
  );
}

const MAX_LOGOS = 6;

function ProfileCard({ portfolio, recommended, onInvest }) {
  const byWeight = [...portfolio.legs].sort((a, b) => b[1] - a[1]);
  const ring = recommended ? "ring-accent-soft" : "ring-surface";
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${recommended ? "bg-accent-soft" : "bg-surface"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[17px] font-semibold text-ink">{portfolio.name}</h3>
            {recommended && <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-ink font-medium">Recommended for you</span>}
          </div>
          <p className="text-ink2 text-[13.5px] mt-1 leading-snug">{portfolio.thesis}</p>
        </div>
        <RiskDots level={portfolio.risk} />
      </div>
      <div className="flex items-center -space-x-2 mt-3">
        {byWeight.slice(0, MAX_LOGOS).map(([s], i) => (
          <TokenLogo key={s} sym={s} index={i} size={26} className={`ring-2 ${ring}`} />
        ))}
        {byWeight.length > MAX_LOGOS && (
          <span className={`w-[26px] h-[26px] rounded-full bg-surface2 ring-2 ${ring} grid place-items-center text-[10px] font-semibold text-muted shrink-0`}>+{byWeight.length - MAX_LOGOS}</span>
        )}
      </div>
      <AllocBar className="mt-3" items={portfolio.legs.map(([s, w]) => ({ label: s, pct: w }))} />
      <button type="button" onClick={() => onInvest(portfolio)} className="mt-3.5 w-full py-2.5 rounded-xl2 text-sm font-semibold bg-ink text-bg hover:brightness-110">
        Invest in {portfolio.name}
      </button>
    </div>
  );
}

export default function Robo() {
  const { buyBasket, createPlan, autoRebalanceCheck, sync } = useStocklana();
  const { prices } = usePrices();
  const [profileId, setProfileId] = useState(loadProfileId);
  const [answers, setAnswers] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await autoRebalanceCheck();
      if (r?.suggested) toast({ title: "Your Robo portfolio has drifted", description: `About ${r.drift.toFixed(1)}% off target — head to Portfolio to rebalance.` });
    })();
  }, [autoRebalanceCheck]);

  const step = answers.length;

  const pick = (v) => {
    const next = [...answers, v];
    setAnswers(next);
    if (next.length === QUESTIONS.length) {
      const id = scoreToProfileId(next.reduce((a, b) => a + b, 0));
      try { localStorage.setItem(PROFILE_KEY, id); } catch { /* ignore */ }
      setProfileId(id);
    }
  };

  const retake = () => { setAnswers([]); setProfileId(null); try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ } };

  const onBuy = async (basket, usd, onlySyms) => {
    const r = await buyBasket(basket, usd, onlySyms);
    if (!r) return r;
    if (r.blocked === "wallet") { toast({ title: "Connect a wallet to invest", description: "Trades sign and send real transactions — there's no simulated mode." }); return r; }
    if (r.blocked === "syncing") { toast({ title: "Still syncing your wallet", description: "Try again in a moment." }); return r; }
    if (r.legs.length) toast({ title: `Invested in ${basket.name}`, description: `${r.legs.length} legs signed on-chain. Robo will flag it when it drifts.` });
    if (r.failures?.length) toast({ title: `${r.failures.length} leg${r.failures.length === 1 ? "" : "s"} failed`, description: `${r.failures.map((f) => f.sym).join(", ")} — you can retry just those.` });
    return r;
  };
  const onPlan = (basket, usd, cad) => { if (createPlan(basket, usd, cad)) toast({ title: `${basket.name} plan started`, description: `${fmtUSD(usd)} ${cad}. Robo will flag it when it drifts.` }); };

  const recommended = profileId ? ROBO_PORTFOLIOS.find((p) => p.id === profileId) : null;
  const others = ROBO_PORTFOLIOS.filter((p) => p.id !== profileId);

  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight">Let Robo build it for you.</h1>
      <p className="text-ink2 mt-2 max-w-[60ch]">Answer a few questions to get a diversified portfolio matched to your risk tolerance. Once you're in, Robo tells you when it drifts off target and you rebalance in a tap.</p>

      {!recommended ? (
        <div className="mt-6 rounded-2xl bg-surface p-5 sm:p-6">
          <p className="text-[12.5px] text-muted mb-3">Question {step + 1} of {QUESTIONS.length}</p>
          <h2 className="text-[17px] font-semibold text-ink mb-4">{QUESTIONS[step].q}</h2>
          <div className="flex flex-col gap-2">
            {QUESTIONS[step].options.map((o) => (
              <button key={o.label} type="button" onClick={() => pick(o.v)} className="text-left px-4 py-3 rounded-xl2 bg-surface2 text-ink hover:bg-accent-soft transition-colors">
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Your match</h2>
            <button type="button" onClick={retake} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><RotateCcw className="w-3.5 h-3.5" />Retake quiz</button>
          </div>
          <div className="mt-2.5"><ProfileCard portfolio={recommended} recommended onInvest={setOpen} /></div>

          <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">Other profiles</h2>
          <div className="flex flex-col gap-3">
            {others.map((p) => <ProfileCard key={p.id} portfolio={p} onInvest={setOpen} />)}
          </div>
        </>
      )}

      <Disclosure label="How Robo rebalancing works" className="mt-8">
        <p className="text-xs text-muted leading-relaxed">
          Every Robo portfolio has a target weight per stock. When a holding drifts more than 2% from its target — a stock ran up, another lagged — the next time you open the app Robo flags it and you can rebalance stock-for-stock from Portfolio. Every swap is signed by your wallet, so nothing ever trades on its own. Robo is a set of model portfolios matched to a short quiz, not personalized investment advice.
        </p>
      </Disclosure>

      <BasketSheet basket={open} prices={prices} onClose={() => setOpen(null)} onBuy={onBuy} onPlan={onPlan} sync={sync} />
    </div>
  );
}
