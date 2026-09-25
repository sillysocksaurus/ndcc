import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pause, Play, Trash2 } from "lucide-react";
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TOKENS, CADENCE } from "@/data/xstocks";
import { useStocklana } from "@/hooks/useStocklana";
import { fmtUSD, shortMint } from "@/lib/stocklana";
import { getAllPortfolios, useCustomBaskets } from "@/lib/customBaskets";
import { toast } from "@/lib/toast";
import Disclosure from "@/components/Disclosure";
import TokenLogo from "@/components/TokenLogo";

const INTERVAL = { weekly: "7-day", biweekly: "14-day", monthly: "30-day" };
const MAX_LOGOS = 6;

// Shown only while you have no plans of your own, so the page isn't empty. Not saved anywhere.
const DAY = 864e5;
const EXAMPLE_PLANS = [
  { id: "example-core", basket: "core", cad: "weekly", amount: 50, status: "live", runs: 2, started: Date.now() - 16 * DAY },
  { id: "example-ai", basket: "ai", cad: "monthly", amount: 200, status: "live", runs: 1, started: Date.now() - 40 * DAY },
  { id: "example-div", basket: "div", cad: "biweekly", amount: 40, status: "paused", runs: 3, started: Date.now() - 45 * DAY },
];

function PlanCard({ plan, onToggle, onCancel, example = false }) {
  useCustomBaskets(); // re-render if the admin adds/removes a bundle while this is open
  const basket = getAllPortfolios().find((b) => b.id === plan.basket);
  if (!basket) return null; // unknown/removed portfolio id — don't crash the page over a stray plan
  const next = new Date(plan.started + (plan.runs + 1) * CADENCE[plan.cad].ms);
  const live = plan.status === "live";
  const byWeight = [...basket.legs].sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-2xl bg-surface p-4 sm:p-5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-ink">{basket.name}</h3>
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent-soft text-accent" title={example ? "Sample plan shown until you make your own" : "No on-chain order exists; nothing executes automatically"}>{example ? "Example" : "Simulated"}</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${live ? "bg-gain-soft text-gain" : "bg-surface2 text-muted"}`}>{live ? "Planned" : "Paused"}</span>
        </span>
      </div>
      <div className="flex items-center -space-x-2">
        {byWeight.slice(0, MAX_LOGOS).map(([s], i) => (
          <TokenLogo key={s} sym={s} index={i} size={22} className="ring-2 ring-surface" />
        ))}
        {byWeight.length > MAX_LOGOS && (
          <span className="w-[22px] h-[22px] rounded-full bg-surface2 ring-2 ring-surface grid place-items-center text-[9.5px] font-semibold text-muted shrink-0">+{byWeight.length - MAX_LOGOS}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 text-[12.5px] text-muted">
        <span>{fmtUSD(plan.amount)} {CADENCE[plan.cad].label.toLowerCase()}</span>
        <span>Would run next: <b className="text-ink">{next.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</b></span>
      </div>
      <Disclosure label="Show legs">
        <div className="flex flex-col gap-1 text-[12.5px] text-ink2">
          {basket.legs.map(([s, w]) => (
            <div key={s} className="flex items-center justify-between gap-3"><span>USDC → {s} · {fmtUSD((plan.amount * w) / 100)} · {INTERVAL[plan.cad]} interval</span><code className="font-mono text-[11.5px] text-muted whitespace-nowrap">{shortMint(TOKENS[s].mint)}</code></div>
          ))}
        </div>
      </Disclosure>
      <div className="flex gap-2 mt-1">
        <button onClick={() => onToggle(plan.id)} disabled={example} title={example ? "Example plan" : undefined} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] bg-surface2 text-ink hover:text-accent disabled:opacity-50 disabled:hover:text-ink disabled:cursor-not-allowed">{live ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}{live ? "Pause" : "Resume"}</button>
        <button onClick={() => onCancel(plan.id)} disabled={example} title={example ? "Example plan" : undefined} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] bg-surface2 text-loss hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 className="w-3.5 h-3.5" />Cancel</button>
      </div>
    </div>
  );
}

function ProjTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload.find((p) => p.dataKey === "value")?.value ?? 0;
  const c = payload.find((p) => p.dataKey === "contrib")?.value ?? 0;
  return (
    <div className="rounded-lg bg-surface border border-line px-3 py-2 text-xs shadow-lg">
      <p className="text-muted mb-1">Month {label}</p>
      <p className="text-ink font-mono tnum">Value {fmtUSD(v, 0)}</p>
      <p className="text-ink2 font-mono tnum">Contributed {fmtUSD(c, 0)}</p>
    </div>
  );
}

export default function Recurring() {
  const { state, value, cost, costKnown, togglePlan, cancelPlan } = useStocklana();
  const [ret, setRet] = useState(7);
  const isExample = state.plans.length === 0;
  const plans = isExample ? EXAMPLE_PLANS : state.plans;
  const monthly = plans.filter((p) => p.status === "live").reduce((t, p) => t + p.amount * CADENCE[p.cad].perMonth, 0);
  // Project forward from what you actually hold today, not from zero — otherwise the
  // chart only shows what future contributions alone grow to and silently drops whatever
  // you already have. "Contributed" mirrors that: past cost basis plus future contributions.
  const startValue = value || 0;
  const startContrib = costKnown ? cost : startValue;
  const data = useMemo(() => {
    const out = [];
    let bal = startValue;
    for (let m = 1; m <= 60; m++) { bal = bal * (1 + ret / 100 / 12) + monthly; out.push({ m, contrib: startContrib + monthly * m, value: bal }); }
    return out;
  }, [monthly, ret, startValue, startContrib]);
  const last = data[data.length - 1];

  return (
    <div>
      <h1 className="text-[26px] font-bold leading-tight">Plan it, and see what steady buying builds.</h1>
      <p className="text-ink2 mt-2 max-w-[60ch]">Plan a steady schedule and see what it could grow into. <b className="text-ink">Recurring plans are simulated in this build</b>: nothing is bought automatically and no on-chain order is created, so this is a planner, not an autopilot.</p>

      <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">Your plans</h2>
      {isExample && (
        <p className="rounded-xl2 bg-accent-soft text-accent text-[12.5px] font-medium px-3.5 py-2.5 mb-2.5">
          Example plans, so you can see how this page works. You have none yet: <Link to="/baskets" className="underline">open a basket</Link> and pick a cadence to make your own, and these disappear.
        </p>
      )}
      {(
        <div className="flex flex-col gap-2.5">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} example={isExample} onToggle={(id) => { const s = togglePlan(id); toast({ title: s === "live" ? "Plan resumed" : "Plan paused" }); }} onCancel={(id) => { cancelPlan(id); toast({ title: "Recurring orders cancelled (simulated)" }); }} />
          ))}
        </div>
      )}

      <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">What steady buying builds{isExample && <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent align-middle">Example</span>}</h2>
      <div className="rounded-2xl bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-3 text-[12.5px] text-muted mb-2">
          <label htmlFor="ret">Assumed return</label>
          <input id="ret" type="range" min="0" max="15" step="1" value={ret} onChange={(e) => setRet(+e.target.value)} className="flex-1 accent-[rgb(var(--accent))]" />
          <b className="font-mono tnum text-ink">{ret}%/yr</b>
        </div>
        {monthly > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgb(var(--line2))" vertical={false} />
                <XAxis dataKey="m" ticks={[1, 12, 24, 36, 48, 60]} tickFormatter={(m) => (m === 1 ? "now" : `yr ${m / 12}`)} tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={{ stroke: "rgb(var(--line))" }} tickLine={false} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)} tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ProjTooltip />} cursor={{ stroke: "rgb(var(--line))" }} />
                <Area type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} fill="#a855f7" fillOpacity={0.15} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="contrib" stroke="rgb(var(--muted))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-muted text-sm text-center py-10">No live plans to project.</p>}
        <div className="flex gap-4 text-xs text-ink2 mt-2">
          <span className="flex items-center gap-1.5"><i className="inline-block w-3.5 h-0.5 bg-[#a855f7]" />Projected value</span>
          <span className="flex items-center gap-1.5"><i className="inline-block w-3.5 h-0.5 bg-muted" />Contributions</span>
        </div>
        {monthly > 0 && (
          <p className="text-[12.5px] text-muted mt-1.5">
            {fmtUSD(startValue, 0)} today + {fmtUSD(monthly)}/month across live plans → ≈ {fmtUSD(last.value, 0)} after 5 years at {ret}%, on {fmtUSD(last.contrib, 0)} put in total. An assumption, not a forecast.
          </p>
        )}
      </div>
    </div>
  );
}
