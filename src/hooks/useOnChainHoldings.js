import { useCallback, useEffect, useRef, useState } from "react";
import { TOKENS, USDC_MINT } from "@/data/xstocks";
import { getAllTokenBalances, getSolBalance } from "@/lib/solanaConnection";

const MINT_TO_SYM = Object.fromEntries(Object.entries(TOKENS).map(([sym, t]) => [t.mint, sym]));

// A shared "sync tick" so any part of the app that just sent a real transaction can
// tell every mounted useOnChainHoldings() to refetch, without prop-drilling a refresh fn.
const syncBus = { version: 0, listeners: new Set() };
export function bumpOnChainSync() {
  syncBus.version++;
  syncBus.listeners.forEach((fn) => fn());
}

export function useOnChainHoldings(address) {
  const [state, setState] = useState({ balances: null, usdc: null, sol: null, loading: false, lastSynced: null, error: null, incomplete: false, forAddress: null });

  // Always holds the most recently requested address, so an in-flight fetch that started
  // for a wallet the user has since switched away from can tell it's stale and drop its
  // result instead of overwriting the new wallet's balances with the old one's.
  const addressRef = useRef(address);
  useEffect(() => { addressRef.current = address; }, [address]);

  const refresh = useCallback(async () => {
    if (!address) { setState({ balances: null, usdc: null, sol: null, loading: false, lastSynced: null, error: null, incomplete: false, forAddress: null }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    const [tokenRes, solRes] = await Promise.all([getAllTokenBalances(address), getSolBalance(address)]);
    if (addressRef.current !== address) return; // a different wallet is active now — this result is stale
    if (!tokenRes.ok) {
      setState((s) => ({ ...s, loading: false, error: tokenRes.error }));
      return;
    }
    const balances = {};
    for (const [mint, amt] of Object.entries(tokenRes.byMint)) {
      const sym = MINT_TO_SYM[mint];
      if (sym) balances[sym] = amt;
    }
    setState({
      balances,
      usdc: tokenRes.byMint[USDC_MINT] || 0,
      sol: solRes.ok ? solRes.sol : null,
      loading: false,
      lastSynced: Date.now(),
      forAddress: address,
      incomplete: tokenRes.incomplete,
      error: tokenRes.incomplete
        ? "Some balances couldn't be confirmed (rate-limited) — refresh before trading"
        : (solRes.ok ? null : `Balances synced, but SOL balance failed: ${solRes.error}`),
    });
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onTick = () => refresh();
    syncBus.listeners.add(onTick);
    return () => syncBus.listeners.delete(onTick);
  }, [refresh]);

  // Data fetched for a previous wallet must never be presented as the current wallet's:
  // after a switch, balances read as "not loaded yet" until this address's fetch lands.
  const stale = state.forAddress !== address;
  if (stale) return { ...state, balances: null, usdc: null, sol: null, lastSynced: null, incomplete: false, refresh };
  return { ...state, refresh };
}
