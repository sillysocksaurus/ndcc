import React, { useCallback, useMemo } from "react";
import { ConnectionProvider, WalletProvider, useWallet as useAdapterWallet, useConnection } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { track } from "@/lib/analytics";
import { getRpcEndpoint } from "@/lib/apiKeys";

const RPC_ENDPOINT = getRpcEndpoint().url;

export function SolanaWalletProvider({ children }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Thin wrapper over the standard adapter hook: adds our short-address formatting,
// analytics tracking, and a name-based select+connect for the wallet-picker modal.
export function useWallet() {
  const { connection } = useConnection();
  const { wallet, wallets, select, connect: adapterConnect, disconnect: adapterDisconnect, connecting, connected, publicKey, signTransaction, signAllTransactions, sendTransaction } = useAdapterWallet();

  const address = publicKey ? publicKey.toBase58() : null;

  // Dedupe by name — some wallets register both an explicit adapter and a Wallet Standard entry.
  const uniqueWallets = useMemo(() => {
    const seen = new Set();
    return wallets.filter((w) => (seen.has(w.adapter.name) ? false : seen.add(w.adapter.name)));
  }, [wallets]);

  const describe = (e) => {
    const reason = e?.name === "WalletNotReadyError" ? "none" : /reject|declin|cancel|denied/i.test(`${e?.name} ${e?.message}`) ? "declined" : "error";
    return { ok: false, reason, message: e?.message || String(e || "") };
  };

  // Connecting an already-selected wallet (e.g. one that failed earlier) goes straight
  // through the adapter's connect().
  const doConnect = useCallback(async (name) => {
    try {
      await adapterConnect();
      track("wallet_connect", { ok: true, wallet: name });
      return { ok: true };
    } catch (e) {
      const r = describe(e);
      track("wallet_connect", { ok: false, reason: r.reason });
      console.error("[wallet] connect failed:", e);
      return r;
    }
  }, [adapterConnect]);

  // Picking a NEW wallet: select() it and let wallet-adapter-react's own autoConnect do
  // the connecting (that's its designed flow — it connects as soon as the selection
  // lands, from the same click). Calling connect() ourselves as well raced it: the
  // second call returned instantly and reported success before the wallet had even
  // answered. Instead we listen on the adapter for the real outcome: 'connect' means
  // connected, 'error' carries the wallet's actual failure message.
  const connect = useCallback((walletName) => {
    if (!walletName || wallet?.adapter?.name === walletName) return doConnect(walletName || wallet?.adapter?.name);
    const adapter = wallets.find((w) => w.adapter.name === walletName)?.adapter;
    if (!adapter) return Promise.resolve({ ok: false, reason: "none", message: `${walletName} isn't available in this browser.` });
    return new Promise((resolve) => {
      let timer;
      const finish = (r) => {
        clearTimeout(timer);
        adapter.off("connect", onConnect);
        adapter.off("error", onError);
        track("wallet_connect", r.ok ? { ok: true, wallet: walletName } : { ok: false, reason: r.reason });
        resolve(r);
      };
      const onConnect = () => finish({ ok: true });
      const onError = (e) => { console.error("[wallet] connect failed:", e); finish(describe(e)); };
      adapter.on("connect", onConnect);
      adapter.on("error", onError);
      timer = setTimeout(() => finish({ ok: false, reason: "timeout", message: "The wallet didn't respond. Check for a popup or unlock the extension, then try again." }), 90000);
      select(walletName);
    });
  }, [select, doConnect, wallet, wallets]);

  // Some wallets — especially ones registered via the Wallet Standard rather
  // than a dedicated legacy adapter (which is how modern Phantom/Solflare
  // often show up) — don't reliably fire the 'disconnect' event back to
  // wallet-adapter-react after adapter.disconnect() resolves. That event is
  // what normally clears the persisted selected-wallet name and flips
  // `connected` back to false, so without it the UI can get stuck showing
  // "connected" even though disconnect was actually called. Clearing the
  // selection ourselves guarantees the UI reflects disconnected either way.
  const disconnect = useCallback(async () => {
    try { await adapterDisconnect(); } catch { /* ignore */ }
    select(null);
  }, [adapterDisconnect, select]);

  return {
    address,
    short: address ? address.slice(0, 4) + "…" + address.slice(-4) : null,
    connected,
    connecting,
    walletName: wallet?.adapter?.name || null,
    wallets: uniqueWallets,
    publicKey,
    signTransaction,
    signAllTransactions,
    sendTransaction,
    connection,
    connect,
    disconnect,
  };
}
