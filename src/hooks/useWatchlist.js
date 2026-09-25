import { useCallback, useState } from "react";

const KEY = "ndcc_watchlist";

// Starred stocks (by symbol), remembered in this browser.
export function useWatchlist() {
  const [list, setList] = useState(() => {
    try { const raw = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(raw) ? raw : []; } catch { return []; }
  });
  const toggle = useCallback((sym) => {
    setList((prev) => {
      const next = prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return { watchlist: list, isWatched: (sym) => list.includes(sym), toggle };
}
