import React, { useMemo, useState } from "react";
import { Search, X, Trash2, Pencil, RotateCcw } from "lucide-react";
import TokenLogo from "@/components/TokenLogo";
import AllocBar from "@/components/AllocBar";
import { TOKENS, BASKETS } from "@/data/xstocks";
import { addCustomBasket, deleteCustomBasket, useCustomBaskets, mergeCustomBaskets } from "@/lib/customBaskets";
import { toast } from "@/lib/toast";

// Split 100% evenly across n legs, dumping any rounding remainder on the last one
// so the total is always exactly 100 — never leave the admin fighting a 99.9%/100.1% gap.
function evenWeights(n) {
  if (n === 0) return [];
  const base = Math.round((100 / n) * 10) / 10;
  const arr = Array(n).fill(base);
  arr[arr.length - 1] = Math.round((100 - base * (n - 1)) * 10) / 10;
  return arr;
}

const BUILTIN_IDS = new Set(BASKETS.map((b) => b.id));
const isBuiltIn = (id) => BUILTIN_IDS.has(id);

const EMPTY_FORM = { name: "", theme: "Custom", thesis: "" };

export default function AdminBasketBuilder() {
  const customBaskets = useCustomBaskets();
  const allBaskets = useMemo(() => mergeCustomBaskets(BASKETS, customBaskets), [customBaskets]);
  const overriddenIds = useMemo(() => new Set(customBaskets.map((b) => b.id)), [customBaskets]);

  const [editingId, setEditingId] = useState(null); // null = creating a brand-new basket
  const [search, setSearch] = useState("");
  const [legs, setLegs] = useState([]); // [{sym, weight}]
  const [form, setForm] = useState(EMPTY_FORM);

  const selectedSyms = useMemo(() => new Set(legs.map((l) => l.sym)), [legs]);
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return Object.entries(TOKENS)
      .filter(([sym, t]) => !selectedSyms.has(sym) && (sym.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [search, selectedSyms]);

  const addStock = (sym) => {
    const next = [...legs, { sym, weight: 0 }];
    const w = evenWeights(next.length);
    setLegs(next.map((l, i) => ({ ...l, weight: w[i] })));
    setSearch("");
  };
  const removeStock = (sym) => {
    const next = legs.filter((l) => l.sym !== sym);
    const w = evenWeights(next.length);
    setLegs(next.map((l, i) => ({ ...l, weight: w[i] })));
  };
  const setWeight = (sym, weight) => setLegs((ls) => ls.map((l) => (l.sym === sym ? { ...l, weight } : l)));

  const totalWeight = legs.reduce((t, l) => t + (Number(l.weight) || 0), 0);
  const weightsOk = legs.length > 0 && Math.abs(totalWeight - 100) < 0.05;
  const canSave = form.name.trim().length > 0 && weightsOk;

  const resetForm = () => { setEditingId(null); setForm(EMPTY_FORM); setLegs([]); setSearch(""); };

  const startEdit = (basket) => {
    setEditingId(basket.id);
    setForm({ name: basket.name, theme: basket.theme, thesis: basket.thesis || "" });
    setLegs(basket.legs.map(([sym, weight]) => ({ sym, weight })));
    setSearch("");
    window.scrollTo({ top: document.getElementById("bundle-form")?.offsetTop - 16, behavior: "smooth" });
  };

  const save = () => {
    if (!canSave) return;
    const basket = {
      id: editingId || ("custom-" + Date.now().toString(36)),
      name: form.name.trim(),
      theme: form.theme.trim() || "Custom",
      thesis: form.thesis.trim() || `A custom basket of ${legs.length} stocks.`,
      legs: legs.map((l) => [l.sym, Number(l.weight)]),
      custom: true,
    };
    addCustomBasket(basket);
    toast({
      title: editingId ? `${basket.name} updated` : `${basket.name} created`,
      description: "Saved in this browser only — other visitors won't see it until baskets are stored on a backend.",
    });
    resetForm();
  };

  const removeOrRevert = (basket) => {
    deleteCustomBasket(basket.id);
    if (isBuiltIn(basket.id)) toast({ title: `${basket.name} reverted to default` });
    else toast({ title: `${basket.name} deleted` });
    if (editingId === basket.id) resetForm();
  };

  return (
    <div>
      <h2 id="bundle-form" className="text-[15px] font-semibold text-ink mt-7 mb-2.5 scroll-mt-4">
        {editingId ? `Editing "${form.name || allBaskets.find((b) => b.id === editingId)?.name}"` : "Create a basket"}
      </h2>
      <div className="rounded-2xl bg-surface p-4 sm:p-5 flex flex-col gap-4">
        <p className="text-[12.5px] text-muted -mt-1">
          {editingId
            ? (isBuiltIn(editingId) ? "Editing a built-in basket saves your version over it everywhere in the app — you can revert to the original any time from the list below." : "Changes apply the moment you save, in this browser.")
            : "Search any of the 24 stocks and combine them into a new basket, live on the Baskets tab in this browser as soon as you save."}
        </p>
        <div>
          <label htmlFor="bundle-name" className="text-[12.5px] text-muted font-medium">Basket name</label>
          <input id="bundle-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Green Energy" className="mt-1.5 w-full px-4 py-3 rounded-xl2 bg-surface2 text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bundle-theme" className="text-[12.5px] text-muted font-medium">Theme</label>
            <input id="bundle-theme" value={form.theme} onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))} placeholder="Custom" className="mt-1.5 w-full px-4 py-3 rounded-xl2 bg-surface2 text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
          <div>
            <label htmlFor="bundle-thesis" className="text-[12.5px] text-muted font-medium">Thesis (optional)</label>
            <input id="bundle-thesis" value={form.thesis} onChange={(e) => setForm((f) => ({ ...f, thesis: e.target.value }))} placeholder="One line description" className="mt-1.5 w-full px-4 py-3 rounded-xl2 bg-surface2 text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
        </div>

        <div>
          <label htmlFor="bundle-search" className="text-[12.5px] text-muted font-medium">Search stocks</label>
          <div className="relative mt-1.5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input id="bundle-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by symbol or company" className="w-full pl-10 pr-4 py-3 rounded-xl2 bg-surface2 text-ink placeholder:text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
          {results.length > 0 && (
            <div className="mt-2 rounded-xl2 bg-surface2 divide-y divide-line/60 overflow-hidden">
              {results.map(([sym, t]) => (
                <button key={sym} type="button" onClick={() => addStock(sym)} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-accent-soft transition-colors">
                  <TokenLogo sym={sym} size={22} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink">{sym}</span>
                    <span className="block text-[11.5px] text-muted truncate">{t.name}</span>
                  </span>
                  <span className="text-[11.5px] text-accent font-medium shrink-0">Add</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {legs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12.5px] text-muted font-medium">{legs.length} stock{legs.length === 1 ? "" : "s"} selected</span>
              <span className={`text-[12.5px] font-mono tnum font-medium ${weightsOk ? "text-gain" : "text-loss"}`}>{totalWeight.toFixed(1)}% of 100%</span>
            </div>
            <AllocBar items={legs.map((l) => ({ label: l.sym, pct: Math.max(0, Number(l.weight) || 0) }))} className="mb-2.5" />
            <div className="rounded-xl2 bg-surface2 divide-y divide-line/60 overflow-hidden">
              {legs.map((l) => (
                <div key={l.sym} className="flex items-center gap-3 px-3.5 py-2.5">
                  <TokenLogo sym={l.sym} size={22} />
                  <span className="flex-1 text-[13.5px] font-semibold text-ink">{l.sym}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="0.1" value={l.weight}
                      onChange={(e) => setWeight(l.sym, e.target.value)}
                      className="w-16 px-2 py-1.5 rounded-lg bg-surface text-ink text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <span className="text-[12.5px] text-muted">%</span>
                  </div>
                  <button type="button" onClick={() => removeStock(l.sym)} aria-label={`Remove ${l.sym}`} className="w-7 h-7 rounded-full grid place-items-center text-muted hover:text-loss shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2.5">
          {editingId && (
            <button type="button" onClick={resetForm} className="px-5 py-3 rounded-xl2 text-sm font-semibold bg-surface2 text-ink">Cancel</button>
          )}
          <button type="button" onClick={save} disabled={!canSave} className="flex-1 py-3 rounded-xl2 text-sm font-semibold bg-accent text-accent-ink disabled:opacity-50 disabled:cursor-not-allowed">
            {legs.length === 0 ? "Add stocks to get started" : !weightsOk ? "Weights must add up to 100%" : editingId ? "Save changes" : "Create basket"}
          </button>
        </div>
      </div>

      <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">All baskets</h2>
      <div className="flex flex-col gap-2.5">
        {allBaskets.map((b) => {
          const edited = overriddenIds.has(b.id) && isBuiltIn(b.id);
          const deletable = !isBuiltIn(b.id);
          return (
            <div key={b.id} className="rounded-2xl bg-surface p-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[15px] font-semibold text-ink">{b.name}</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface2 text-muted font-medium">{b.theme}</span>
                  {edited && <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-soft text-accent font-medium">Edited</span>}
                </div>
                {b.thesis && <p className="text-ink2 text-[12.5px] mt-0.5">{b.thesis}</p>}
                <AllocBar className="mt-2" items={b.legs.map(([s, w]) => ({ label: s, pct: w }))} height={8} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => startEdit(b)} aria-label={`Edit ${b.name}`} className="w-8 h-8 rounded-full grid place-items-center text-muted hover:text-accent"><Pencil className="w-4 h-4" /></button>
                {edited && (
                  <button type="button" onClick={() => removeOrRevert(b)} aria-label={`Revert ${b.name} to default`} title="Revert to default" className="w-8 h-8 rounded-full grid place-items-center text-muted hover:text-ink"><RotateCcw className="w-4 h-4" /></button>
                )}
                {deletable && (
                  <button type="button" onClick={() => removeOrRevert(b)} aria-label={`Delete ${b.name}`} className="w-8 h-8 rounded-full grid place-items-center text-muted hover:text-loss"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
