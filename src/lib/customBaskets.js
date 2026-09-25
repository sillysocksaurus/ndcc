import { useSyncExternalStore } from "react";
import { ALL_PORTFOLIOS } from "@/data/xstocks";

// Admin-created baskets ("bundles"). No backend, so these live in localStorage —
// visible in this browser only, same constraint as the rest of the admin dashboard.
const KEY = "stocklana_custom_baskets";
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

let baskets = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(baskets)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}

export function getCustomBaskets() {
  return baskets;
}

export function useCustomBaskets() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => baskets,
  );
}

// Same call whether creating a brand-new bundle or editing one — including editing
// a built-in basket, which saves an override here under the built-in's own id
// rather than mutating the shipped data (there's nowhere to persist that anyway).
export function addCustomBasket(basket) {
  baskets = [basket, ...baskets.filter((b) => b.id !== basket.id)];
  persist();
}

// Removes a custom bundle entirely, or — if id belongs to a built-in basket that
// was edited — removes just the override, reverting it back to the shipped version.
export function deleteCustomBasket(id) {
  baskets = baskets.filter((b) => b.id !== id);
  persist();
}

// Layers custom entries over a base list, replacing any base entry with the same
// id rather than duplicating it — this is what makes "editing" a built-in basket
// work: the edited version has the same id, so it supersedes the original
// wherever baskets are looked up or listed, without touching the shipped data.
// Takes `overrides` explicitly (rather than always reading the module's current
// `baskets`) so callers that memoize off useCustomBaskets() have a real dependency
// to key off, not just a same-shaped array recomputed from state React can't see.
function withOverrides(base, overrides) {
  const overrideIds = new Set(overrides.map((b) => b.id));
  return [...base.filter((b) => !overrideIds.has(b.id)), ...overrides];
}

// Every investable portfolio the app knows about — built-in baskets, Robo tiers,
// and admin-created/edited bundles. Use this (not the static ALL_PORTFOLIOS) wherever
// a holding or plan needs to resolve back to weights/a name: a plan on a bundle that
// only exists in this dynamic registry would otherwise look up as undefined and
// crash, the same class of bug a Robo plan hit before this.
export function getAllPortfolios() {
  return withOverrides(ALL_PORTFOLIOS, baskets);
}

// Same override layering, scoped to just the manual Baskets-tab list (no Robo
// tiers) — what the Baskets page and the admin builder's basket list both render.
// Pass the array from useCustomBaskets() as `overrides` so it's usable inside a
// useMemo with a real, lint-clean dependency.
export function mergeCustomBaskets(base, overrides = baskets) {
  return withOverrides(base, overrides);
}
