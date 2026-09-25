import React, { useMemo, useState } from "react";
import { ChevronDown, Rocket } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { usePrices } from "@/hooks/useStocklana";
import { EQUITY_LAUNCH_DEFAULTS, MIGRATION_FEE_OPTIONS, QUOTE_OPTIONS, MIN_STOCK_QUOTE_THRESHOLD_USD, quoteBySym, buildEquityConfigParams, fmtQuote, createEquityLaunch, validateLaunchForm } from "@/lib/dbc";
import { fmtUSD } from "@/lib/stocklana";
import { toast } from "@/lib/toast";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-[12.5px] text-muted font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-[11.5px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full px-4 py-3 rounded-xl2 bg-surface2 text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 font-mono";

export default function AdminDbcLaunch() {
  const wallet = useWallet();
  const [form, setForm] = useState(EQUITY_LAUNCH_DEFAULTS);
  const [advanced, setAdvanced] = useState(false);
  const [pending, setPending] = useState(false);
  const [lastLaunch, setLastLaunch] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setChecked = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));

  const { prices } = usePrices();
  const quote = quoteBySym(form.quoteSym);
  const quotePriceUsd = quote.sym === "USDC" ? 1 : prices[quote.sym];
  // What the chosen curve actually needs raised before it graduates, straight from the SDK.
  const threshold = useMemo(() => {
    try {
      const cp = buildEquityConfigParams(form, quotePriceUsd);
      const amount = Number(cp.migrationQuoteThreshold.toString()) / 10 ** quote.decimals;
      return { amount, usd: amount * quotePriceUsd };
    } catch (e) {
      return { error: e.message || String(e) };
    }
  }, [form, quote.decimals, quotePriceUsd]);

  const errors = validateLaunchForm(form);
  if (quote.badge && threshold.usd != null && threshold.usd < MIN_STOCK_QUOTE_THRESHOLD_USD) {
    errors.push(`A ${quote.sym}-paired pool needs about $${MIN_STOCK_QUOTE_THRESHOLD_USD}+ raised to graduate; this curve graduates at ≈ $${Math.round(threshold.usd)}. Raise the graduation market cap.`);
  }
  if (threshold.error) errors.push(`Curve can't be built: ${threshold.error}`);
  const canLaunch = wallet.connected && errors.length === 0 && !pending;

  const launch = async () => {
    if (!canLaunch) return;
    setPending(true);
    try {
      const result = await createEquityLaunch({ form, wallet, quotePriceUsd });
      setLastLaunch(result);
      toast({ title: `${result.symbol} is live on the curve`, description: `Pool ${result.pool.slice(0, 4)}…${result.pool.slice(-4)} — trades in the Launches tab now.` });
    } catch (e) {
      toast({ title: "Launch failed", description: e.message || String(e) });
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">Launch a tokenized stock (Meteora DBC)</h2>
      <div className="rounded-2xl bg-surface p-4 sm:p-5 flex flex-col gap-4">
        <p className="text-[12.5px] text-muted -mt-1">
          Deploys a real Dynamic Bonding Curve pool on mainnet, priced in USDC or paired with a tokenized stock. Trading fees decay over the first
          few days to discourage minute-one flipping, and your own token + post-migration LP allocation are
          vested with a cliff by default — the on-chain commitment that makes graduation trustworthy for
          equity-minded buyers, not a fake holder gate DBC can't actually enforce. Two wallet approvals: one to
          create the pool's config, one to create the pool itself.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input value={form.name} onChange={set("name")} placeholder="Acme Robotics (Tokenized)" className={inputCls} /></Field>
          <Field label="Symbol"><input value={form.symbol} onChange={set("symbol")} placeholder="ACMEx" className={inputCls} /></Field>
        </div>
        <Field label="Metadata URI" hint="An Arweave/IPFS JSON URI with name/symbol/image, per the Metaplex token-metadata standard.">
          <input value={form.uri} onChange={set("uri")} placeholder="https://arweave.net/…" className={inputCls} />
        </Field>
        <Field label="Logo domain (this app only, optional)" hint="Used to pull a favicon for display here — not stored on-chain.">
          <input value={form.domain} onChange={set("domain")} placeholder="acme.com" className={inputCls} />
        </Field>

        <Field label="Paired with" hint={quote.badge ? `Stock-paired: traders buy your token with ${quote.sym}, and the graduated DAMM v2 pool is ${form.symbol || "TOKEN"} / ${quote.sym}. Meteora has approved ${quote.sym} as a quote token. Prices below stay in USD and are converted at today's ${quote.sym} price, so the real USD value moves with the stock.` : "Traders buy with USDC."}>
          <select value={form.quoteSym} onChange={set("quoteSym")} className={inputCls}>
            {QUOTE_OPTIONS.map((q) => <option key={q.sym} value={q.sym}>{q.sym === "USDC" ? "USDC (default)" : `${q.sym} (tokenized stock)`}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Total supply">
            <input type="number" min="1" value={form.totalSupply} onChange={set("totalSupply")} className={inputCls} />
          </Field>
          <Field label="Migration fee tier">
            <select value={form.migrationFeeOptionIndex} onChange={set("migrationFeeOptionIndex")} className={inputCls}>
              {MIGRATION_FEE_OPTIONS.map((o) => (<option key={o.index} value={o.index}>{o.label} on migration</option>))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Initial market cap" hint="Implied valuation at the very first trade.">
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">$</span><input type="number" min="1" value={form.initialMarketCapUsd} onChange={set("initialMarketCapUsd")} className={`${inputCls} pl-7`} /></div>
          </Field>
          <Field label="Graduation market cap" hint="Migrates to a real DAMM v2 pool once reached.">
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">$</span><input type="number" min="1" value={form.migrationMarketCapUsd} onChange={set("migrationMarketCapUsd")} className={`${inputCls} pl-7`} /></div>
          </Field>
        </div>

        {threshold.amount != null && (
          <p className="text-[12px] text-ink2 rounded-xl2 bg-accent-soft px-3.5 py-2.5">
            Graduates after ≈ <b>{fmtQuote(threshold.amount, quote.sym)}</b>{quote.sym !== "USDC" && <> (≈ ${Math.round(threshold.usd).toLocaleString()} at today's price)</>} is raised on the curve.
          </p>
        )}

        <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink2 hover:text-ink self-start">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advanced ? "rotate-180" : ""}`} />
          {advanced ? "Hide" : "Show"} fee schedule &amp; issuer lockups
        </button>

        {advanced && (
          <div className="rounded-xl2 bg-surface2 p-3.5 flex flex-col gap-3.5">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Starting fee (bps)"><input type="number" min="0" max="10000" value={form.feeStartBps} onChange={set("feeStartBps")} className={inputCls} /></Field>
              <Field label="Ending fee (bps)"><input type="number" min="0" max="10000" value={form.feeEndBps} onChange={set("feeEndBps")} className={inputCls} /></Field>
              <Field label="Decays over (days)"><input type="number" min="0" value={form.feeDecayDays} onChange={set("feeDecayDays")} className={inputCls} /></Field>
            </div>
            <Field label="Your ongoing cut of every trade's fee (%)" hint="Paid to you continuously while the pool trades pre-migration, not just once at launch.">
              <input type="number" min="0" max="100" value={form.creatorTradingFeePct} onChange={set("creatorTradingFeePct")} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your token allocation (% of supply)" hint="Reserved off the curve, not sold to traders.">
                <input type="number" min="0" max="90" value={form.tokenVestingPct} onChange={set("tokenVestingPct")} className={inputCls} />
              </Field>
              <Field label="Vested over (days), cliff (days)">
                <div className="flex gap-2">
                  <input type="number" min="0" value={form.tokenVestingDays} onChange={set("tokenVestingDays")} className={inputCls} />
                  <input type="number" min="0" value={form.tokenCliffDays} onChange={set("tokenCliffDays")} className={inputCls} />
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Permanently locked LP (%)" hint={`Never withdrawable. The other ${Math.max(0, 100 - (Number(form.creatorLockedLiquidityPct) || 0))}% of the graduated pool's liquidity is yours, vested as set here. Meteora requires at least 10% locked.`}>
                <input type="number" min="10" max="100" value={form.creatorLockedLiquidityPct} onChange={set("creatorLockedLiquidityPct")} className={inputCls} />
              </Field>
              <Field label="Your LP vested over (days), cliff (days)">
                <div className="flex gap-2">
                  <input type="number" min="0" value={form.creatorLpVestingDays} onChange={set("creatorLpVestingDays")} className={inputCls} />
                  <input type="number" min="0" value={form.creatorLpCliffDays} onChange={set("creatorLpCliffDays")} className={inputCls} />
                </div>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-ink2">
              <input type="checkbox" checked={form.dynamicFeeEnabled} onChange={setChecked("dynamicFeeEnabled")} className="rounded" />
              Dynamic volatility fee (extra fee during sharp moves — dampens thin-liquidity whipsaws)
            </label>
          </div>
        )}

        {errors.length > 0 && (form.name || form.symbol || form.uri) && (
          <ul className="text-[12px] text-loss list-disc pl-4 -mb-1">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
        <button
          type="button"
          onClick={launch}
          disabled={!canLaunch}
          className="w-full py-3.5 rounded-xl2 text-sm font-semibold bg-accent text-accent-ink disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Rocket className="w-4 h-4" />
          {pending ? "Confirm in wallet…" : !wallet.connected ? "Connect wallet to launch" : `Launch on mainnet — ${fmtUSD(Number(form.initialMarketCapUsd) || 0, 0)} start`}
        </button>
        <p className="text-[11.5px] text-muted -mt-1">Real: creates a config account and a pool account on Solana mainnet, each costing rent + network fees paid from {wallet.short || "your wallet"}. Irreversible.</p>

        {lastLaunch && (
          <div className="rounded-xl2 bg-accent-soft p-3.5 text-[12.5px] text-ink">
            <p className="font-semibold">{lastLaunch.symbol} launched</p>
            <p className="mt-1 font-mono break-all">pool {lastLaunch.pool}</p>
            <p className="mt-0.5 font-mono break-all">mint {lastLaunch.baseMint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
