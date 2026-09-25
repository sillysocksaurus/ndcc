import { useSyncExternalStore } from "react";

// Arbitrary named API keys the admin wants this browser to remember (ClawPump,
// or any other integration added later). Unlike a VITE_ env var — which gets
// baked into the build and shipped to every visitor — these only ever live in
// this browser's localStorage, so they're a better fit for something that
// shouldn't be public. Still no backend, so still not a real secrets vault:
// anyone with devtools on this machine can read them.
const KEY = "stocklana_api_keys";
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

let keys = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(keys)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}

export function getApiKeys() {
  return keys;
}

export function useApiKeys() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => keys,
  );
}

export function saveApiKeys(next) {
  keys = next;
  persist();
  return keys;
}

export const HELIUS_KEY_NAME = "Helius RPC";
const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";

// Accepts a full RPC URL or just a Helius API key, and returns a usable https endpoint
// (or null if the value is neither).
export function normalizeRpcInput(raw) {
  const v = (raw || "").trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v)) return v;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return `https://mainnet.helius-rpc.com/?api-key=${v}`;
  return null;
}

// Where Solana RPC calls go: the Helius value saved in Admin → API keys wins, then the
// VITE_SOLANA_RPC build setting, then Solana's rate-limited public endpoint. Read once
// at startup, so changing it in Admin reloads the app.
export function getRpcEndpoint() {
  const custom = normalizeRpcInput(getApiKey(HELIUS_KEY_NAME));
  if (custom) return { url: custom, source: "admin" };
  const env = normalizeRpcInput(import.meta.env.VITE_SOLANA_RPC);
  if (env) return { url: env, source: "env" };
  return { url: PUBLIC_RPC, source: "public" };
}

// Look up one key's value by name (case-insensitive) — for any integration
// code that needs to call out with it later, e.g. getApiKey("ClawPump").
export function getApiKey(name) {
  const q = name.trim().toLowerCase();
  return keys.find((k) => k.name.trim().toLowerCase() === q)?.value || null;
}
