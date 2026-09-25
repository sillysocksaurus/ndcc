// Tokens launched from the Create page, remembered in this browser only.
// Each entry records the creating wallet so Portfolio can show just that wallet's tokens.
const KEY = "ndcc_created_tokens";

export function loadCreatedTokens() {
  try { const r = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(r) ? r : []; } catch { return []; }
}

export function saveCreatedTokens(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50))); } catch { /* ignore */ }
}

// Entries saved before wallets were recorded have no `creator`; keep showing them rather than hiding them.
export const createdBy = (list, address) => list.filter((t) => !t.creator || t.creator === address);
