import React, { useState } from "react";
import { Sparkles, ExternalLink, CheckCircle2 } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import Disclosure from "@/components/Disclosure";
import { getLaunchQuote, payQuote, confirmLaunch, readLaunch } from "@/lib/clawpump";
import { toast } from "@/lib/toast";

import { loadCreatedTokens as loadMine, saveCreatedTokens as saveMine, createdBy } from "@/lib/createdTokens";

const inputCls = "w-full px-4 py-3 rounded-xl2 bg-surface2 text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40";
const EMPTY = { name: "", symbol: "", description: "", imageUrl: "" };
const DEMO_FORM = { name: "Example Token", symbol: "EXMPL", description: "A sample token to show how launching works here.", imageUrl: "https://example.com/logo.png" };
const DEMO_QUOTE_RAW = { example: true, costSol: "0.02", paymentAddress: "ExampLe1111111111111111111111111111111111111", note: "Made-up numbers for illustration." };
const DEMO_MINT = "ExampLeMint1111111111111111111111111pump";

export default function CreateToken() {
  const wallet = useWallet();
  const [f, setF] = useState(EMPTY);
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState("form"); // form | quote | working | done
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState(null);   // { raw, quote }
  const [result, setResult] = useState(null); // { mint, url, raw }
  const [mine, setMine] = useState(loadMine);
  const [demo, setDemo] = useState(false);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const errs = [];
  if (f.name.trim() && f.name.trim().length > 32) errs.push("Name is 32 characters max.");
  if (f.symbol && !/^[A-Za-z0-9]{1,10}$/.test(f.symbol.trim())) errs.push("Symbol must be 1–10 letters or digits.");
  if (f.imageUrl && !/^https:\/\//i.test(f.imageUrl.trim())) errs.push("Image must be an https:// link.");
  const complete = f.name.trim() && f.symbol.trim() && f.description.trim() && f.imageUrl.trim();
  const canQuote = wallet.connected && complete && errs.length === 0 && agreed && !busy;

  const clean = () => ({ name: f.name.trim(), symbol: f.symbol.trim(), description: f.description.trim(), imageUrl: f.imageUrl.trim() });

  const getQuote = async () => {
    setBusy(true);
    try {
      setQuote(await getLaunchQuote(clean(), wallet));
      setStep("quote");
    } catch (e) {
      toast({ title: "Couldn't get a quote", description: e.message || String(e) });
    } finally { setBusy(false); }
  };

  const payAndLaunch = async () => {
    if (!quote?.quote?.ok) return;
    setBusy(true); setStep("working");
    let sig = null;
    try {
      sig = await payQuote(quote.quote, wallet);
      const raw = await confirmLaunch(clean(), wallet, { txSignature: sig, preflightToken: quote.quote.preflightToken });
      const { mint, url } = readLaunch(raw);
      const entry = { ...clean(), mint: mint || null, url: url || null, sig, creator: wallet.address, at: Date.now() };
      const next = [entry, ...mine];
      setMine(next); saveMine(next);
      setResult({ mint, url, raw });
      setStep("done");
      toast({ title: `${entry.symbol} launched`, description: "Your token is live." });
    } catch (e) {
      // If the payment already went through, say so plainly: the user must not pay twice.
      setStep("quote");
      toast({ title: sig ? "Paid, but the launch didn't complete" : "Launch failed", description: sig ? `Your payment went through (signature ${sig.slice(0, 12)}…). Don't pay again — contact support with that signature. ${e.message || e}` : (e.message || String(e)) });
    } finally { setBusy(false); }
  };

  const reset = () => { setF(EMPTY); setAgreed(false); setQuote(null); setResult(null); setDemo(false); setStep("form"); };

  // Walks the whole flow with made-up data: no wallet, no network, nothing saved.
  const startDemo = () => {
    setF(DEMO_FORM); setAgreed(true); setResult(null); setDemo(true);
    setQuote({ raw: DEMO_QUOTE_RAW, quote: { ok: true, sol: DEMO_QUOTE_RAW.costSol, recipient: DEMO_QUOTE_RAW.paymentAddress, preflightToken: "example" } });
    setStep("quote");
  };
  const demoLaunch = async () => {
    setBusy(true); setStep("working");
    await new Promise((r) => setTimeout(r, 1200));
    setResult({ mint: DEMO_MINT, url: null, raw: null });
    setStep("done"); setBusy(false);
  };

  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight flex items-center gap-2"><Sparkles className="w-6 h-6 text-accent" />Create a token</h1>
      <p className="text-ink2 mt-2 max-w-[60ch]">Launch your own token on pump.fun in a couple of minutes, through ClawPump. You pay a small launch fee from your own wallet, and nothing is sent until you approve it.</p>

      {demo ? (
        <p className="mt-4 rounded-xl2 bg-accent-soft text-accent text-[12.5px] font-medium px-3.5 py-2.5 flex items-center justify-between gap-3">
          <span>Example only: made-up data, no wallet, nothing is sent or charged.</span>
          <button onClick={reset} className="shrink-0 underline">Exit example</button>
        </p>
      ) : step === "form" && (
        <button onClick={startDemo} className="mt-4 px-4 py-2 rounded-xl2 text-[13px] font-semibold bg-surface text-ink hover:brightness-110">See an example</button>
      )}

      {step === "done" ? (
        <div className="mt-6 rounded-2xl bg-surface p-5">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-ink"><CheckCircle2 className="w-5 h-5 text-gain" />{f.name || "Your token"} is live</p>
          {result?.mint && <p className="text-[12.5px] text-ink2 mt-2 break-all">Mint <span className="font-mono">{result.mint}</span></p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {result?.url && <a href={result.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl2 text-sm font-semibold bg-accent text-accent-ink hover:brightness-110">View on pump.fun<ExternalLink className="w-3.5 h-3.5" /></a>}
            <button onClick={reset} className="px-4 py-2.5 rounded-xl2 text-sm font-semibold bg-surface2 text-ink">Create another</button>
          </div>
          {!result?.mint && <Disclosure label="Show ClawPump's response" className="mt-3"><pre className="text-[11px] text-muted whitespace-pre-wrap break-all">{JSON.stringify(result?.raw, null, 2)}</pre></Disclosure>}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-surface p-4 sm:p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12.5px] text-muted font-medium">Name</label><input value={f.name} onChange={set("name")} disabled={step !== "form"} maxLength={40} placeholder="My Token" className={`mt-1.5 ${inputCls}`} /></div>
            <div><label className="text-[12.5px] text-muted font-medium">Symbol</label><input value={f.symbol} onChange={set("symbol")} disabled={step !== "form"} maxLength={10} placeholder="MYTKN" className={`mt-1.5 font-mono ${inputCls}`} /></div>
          </div>
          <div><label className="text-[12.5px] text-muted font-medium">Description</label><textarea value={f.description} onChange={set("description")} disabled={step !== "form"} rows={3} maxLength={500} placeholder="What is this token about?" className={`mt-1.5 ${inputCls}`} /></div>
          <div>
            <label className="text-[12.5px] text-muted font-medium">Logo image link</label>
            <input value={f.imageUrl} onChange={set("imageUrl")} disabled={step !== "form"} placeholder="https://…/logo.png" className={`mt-1.5 font-mono ${inputCls}`} />
            <p className="text-[11.5px] text-muted mt-1">A public https link to a square image (host it anywhere, e.g. your site or an image host).</p>
          </div>

          {step === "form" && (
            <label className="flex items-start gap-2.5 text-[12.5px] text-ink2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 rounded" />
              <span>I understand launching costs real SOL, can't be undone, and that I'm responsible for what my token says and does. Meme and new tokens can go to zero.</span>
            </label>
          )}
          {errs.length > 0 && <ul className="text-[12px] text-loss list-disc pl-4">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}

          {step === "form" && (
            <button onClick={getQuote} disabled={!canQuote} className="w-full py-3.5 rounded-xl2 text-sm font-semibold bg-accent text-accent-ink hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? "Getting your quote…" : !wallet.connected ? "Connect wallet to continue" : "Get launch quote (free)"}
            </button>
          )}

          {(step === "quote" || step === "working") && quote && (
            <div className="rounded-xl2 bg-surface2 p-4">
              {quote.quote.ok ? (
                <>
                  <p className="text-[13px] text-ink2">Launch cost</p>
                  <p className="font-mono tnum text-2xl font-semibold text-ink">{quote.quote.sol} SOL</p>
                  <p className="text-[12px] text-muted mt-1 break-all">Paid from your wallet to <span className="font-mono">{quote.quote.recipient}</span> (ClawPump). Plus a tiny network fee.</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { if (demo) reset(); else { setQuote(null); setStep("form"); } }} disabled={busy} className="px-4 py-3 rounded-xl2 text-sm font-semibold bg-surface text-ink disabled:opacity-50">Back</button>
                    <button onClick={demo ? demoLaunch : payAndLaunch} disabled={busy} className="flex-1 py-3 rounded-xl2 text-sm font-semibold bg-accent text-accent-ink hover:brightness-110 disabled:opacity-60">{busy ? (demo ? "Launching…" : "Confirm in your wallet…") : `${demo ? "Example: pay" : "Pay"} ${quote.quote.sol} SOL & launch`}</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-loss font-medium">We couldn't safely read this quote, so nothing will be paid.</p>
                  <p className="text-[12px] text-muted mt-1">The response didn't contain a valid payment address, a sensible SOL amount and a quote token. Nothing has been charged.</p>
                  <button onClick={() => { setQuote(null); setStep("form"); }} className="mt-3 px-4 py-2.5 rounded-xl2 text-sm font-semibold bg-surface text-ink">Back</button>
                </>
              )}
              <Disclosure label="Show ClawPump's raw quote" className="mt-3"><pre className="text-[11px] text-muted whitespace-pre-wrap break-all">{JSON.stringify(quote.raw, null, 2)}</pre></Disclosure>
            </div>
          )}

          <p className="text-[11.5px] text-muted">Tokens launch on pump.fun through NDCC's ClawPump agent. Check with NDCC how creator trading fees are shared before you launch. NDCC doesn't custody funds or guarantee any token's value.</p>
        </div>
      )}

      {createdBy(mine, wallet.address).length > 0 && (
        <>
          <h2 className="text-[15px] font-semibold text-ink mt-8 mb-2.5">Tokens you've launched here</h2>
          <div className="flex flex-col gap-2">
            {createdBy(mine, wallet.address).map((t) => (
              <div key={t.sig} className="rounded-2xl bg-surface p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="text-[14.5px] font-semibold text-ink truncate">{t.name} <span className="font-mono text-[12px] text-muted">{t.symbol}</span></p><p className="text-[11.5px] text-muted font-mono truncate">{t.mint || "mint pending"}</p></div>
                {t.url && <a href={t.url} target="_blank" rel="noreferrer" className="shrink-0 text-accent text-[13px] font-medium flex items-center gap-1">View<ExternalLink className="w-3 h-3" /></a>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
