import React, { useState } from "react";
import { Eye, EyeOff, Plus, Trash2, KeyRound, Zap } from "lucide-react";
import { useApiKeys, saveApiKeys, getRpcEndpoint, normalizeRpcInput, HELIUS_KEY_NAME } from "@/lib/apiKeys";
import { toast } from "@/lib/toast";

const EMPTY_ROW = { name: "", value: "" };
const isHelius = (r) => r.name.trim().toLowerCase() === HELIUS_KEY_NAME.toLowerCase();

const SOURCE_LABEL = { admin: "your Helius RPC from this page", env: "the VITE_SOLANA_RPC build setting", public: "Solana's public endpoint (rate-limited, blocks balance scans)" };

export default function AdminApiKeys() {
  const stored = useApiKeys();
  // The Helius row always exists and always comes first; everything else is free-form.
  const [rows, setRows] = useState(() => {
    const helius = stored.find(isHelius) || { name: HELIUS_KEY_NAME, value: "" };
    const rest = stored.filter((r) => !isHelius(r));
    return [helius, ...(rest.length ? rest : [{ name: "ClawPump", value: "" }])];
  });
  const [revealed, setRevealed] = useState({});
  const [testing, setTesting] = useState(false);
  const active = getRpcEndpoint();
  let activeHost = "";
  try { activeHost = new URL(active.url).host; } catch { /* ignore */ }

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const toggleReveal = (i) => setRevealed((r) => ({ ...r, [i]: !r[i] }));

  const testRpc = async () => {
    const url = normalizeRpcInput(rows[0].value);
    if (!url) { toast({ title: "Enter a Helius RPC URL or API key first" }); return; }
    setTesting(true);
    try {
      const t0 = performance.now();
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error || typeof j.result !== "number") throw new Error(j.error?.message || `HTTP ${r.status}`);
      toast({ title: "RPC works", description: `Slot ${j.result.toLocaleString()} in ${Math.round(performance.now() - t0)} ms.` });
    } catch (e) {
      toast({ title: "RPC test failed", description: `${e.message || e}. Check the key, and that this site's domain is allowed in your Helius dashboard.` });
    } finally {
      setTesting(false);
    }
  };

  const save = (e) => {
    e.preventDefault();
    const helius = rows[0].value.trim();
    if (helius && !normalizeRpcInput(helius)) { toast({ title: "Helius RPC not recognised", description: "Paste the full https:// URL from your Helius dashboard, or just the API key." }); return; }
    const before = (stored.find(isHelius)?.value || "").trim();
    const cleaned = rows.map((r) => ({ name: r.name.trim(), value: r.value.trim() })).filter((r) => r.name && (r.value || !isHelius(r)));
    saveApiKeys(cleaned);
    if (helius !== before) {
      toast({ title: "Helius RPC saved", description: "Reloading so every connection uses it…" });
      setTimeout(() => window.location.reload(), 900);
      return;
    }
    toast({ title: "API keys saved", description: `${cleaned.length} key${cleaned.length === 1 ? "" : "s"} stored in this browser.` });
  };

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5 flex items-center gap-2"><KeyRound className="w-4 h-4 text-accent" />API keys &amp; endpoints</h2>
      <form onSubmit={save} className="rounded-2xl bg-surface p-4 sm:p-5 flex flex-col gap-3">
        <p className="text-[12.5px] text-muted -mt-1">
          Set the RPC and any integration keys here instead of editing files. Saved in this browser's local storage only
          (never baked into the deployed build), so they're not a real secrets vault: anyone with devtools on this
          machine can read them.
        </p>

        <div>
          <label htmlFor="helius-rpc" className="text-[12.5px] text-muted font-medium">Helius RPC (URL or API key)</label>
          <div className="flex gap-2 mt-1.5">
            <div className="relative flex-1">
              <input
                id="helius-rpc"
                type={revealed[0] ? "text" : "password"}
                value={rows[0].value}
                onChange={(e) => setRow(0, { value: e.target.value })}
                placeholder="https://mainnet.helius-rpc.com/?api-key=…  or just the key"
                autoComplete="off"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl2 bg-surface2 text-ink font-mono text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button type="button" onClick={() => toggleReveal(0)} aria-label={revealed[0] ? "Hide" : "Show"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                {revealed[0] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button type="button" onClick={testRpc} disabled={testing} className="flex items-center gap-1.5 px-3.5 rounded-xl2 bg-surface2 text-[13px] font-medium text-ink hover:text-accent disabled:opacity-60"><Zap className="w-3.5 h-3.5" />{testing ? "Testing…" : "Test"}</button>
          </div>
          <p className="text-[11.5px] text-muted mt-1">
            Now using <b className="text-ink2">{SOURCE_LABEL[active.source]}</b>{activeHost && <> (<span className="font-mono">{activeHost}</span>)</>}. Used for wallet balances, launches and sending transactions. Changing it reloads the app.
          </p>
        </div>

        <p className="text-[12.5px] text-muted font-medium mt-1">Other keys</p>
        {rows.slice(1).map((row, k) => {
          const i = k + 1;
          return (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={row.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
                placeholder="Name (e.g. ClawPump)"
                aria-label="Key name"
                className="w-[38%] px-3.5 py-2.5 rounded-xl2 bg-surface2 text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <div className="relative flex-1">
                <input
                  type={revealed[i] ? "text" : "password"}
                  value={row.value}
                  onChange={(e) => setRow(i, { value: e.target.value })}
                  placeholder="cpk_..."
                  aria-label={`${row.name || "Key"} value`}
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl2 bg-surface2 text-ink font-mono text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button type="button" onClick={() => toggleReveal(i)} aria-label={revealed[i] ? "Hide key" : "Show key"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                  {revealed[i] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button type="button" onClick={() => removeRow(i)} aria-label="Remove key" className="w-8 h-8 shrink-0 rounded-full grid place-items-center text-muted hover:text-loss"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
        <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:brightness-110 self-start">
          <Plus className="w-3.5 h-3.5" />Add another key
        </button>
        <button type="submit" className="w-full py-3 rounded-xl2 text-sm font-semibold bg-accent text-accent-ink hover:brightness-105 mt-1">Save</button>
      </form>
    </div>
  );
}
