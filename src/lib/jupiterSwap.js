import { VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";

// Jupiter Ultra API: one call gets a quote + ready-to-sign transaction (order),
// another submits the signed transaction and Jupiter itself lands it on-chain —
// no separate RPC connection needed to broadcast.
const ULTRA_BASE = "https://api.jup.ag/ultra/v1";
const ULTRA_BASE_FALLBACK = "https://lite-api.jup.ag/ultra/v1";

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Jupiter ${r.status}: ${await r.text().catch(() => r.statusText)}`);
  return r.json();
}

// amount is in the input token's smallest unit (already scaled by decimals).
export async function getOrder({ inputMint, outputMint, amount, taker }) {
  const qs = new URLSearchParams({ inputMint, outputMint, amount: String(Math.round(amount)), taker });
  try {
    return await getJson(`${ULTRA_BASE}/order?${qs}`);
  } catch {
    return await getJson(`${ULTRA_BASE_FALLBACK}/order?${qs}`);
  }
}

async function postExecute(base, body) {
  const r = await fetch(`${base}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !j.status) throw new Error(`Jupiter ${r.status}: ${j.error || r.statusText}`);
  return j;
}

// Unlike getOrder (read-only, safe to retry against the fallback host), execute actually
// moves funds — retrying the identical signed transaction against a *different* endpoint
// on any failure is exactly wrong if the first attempt's request landed on-chain but its
// response never made it back to us (a dropped connection, a timeout): the fallback host
// has no idea the transaction already succeeded, so its response to what looks like a
// duplicate submission could easily come back as an error, and we'd tell the user their
// swap failed when it actually didn't. So this only ever calls the primary endpoint —
// on failure, surface that failure directly rather than guessing at a retry.
export async function executeOrder({ signedTransactionBase64, requestId }) {
  return postExecute(ULTRA_BASE, { signedTransaction: signedTransactionBase64, requestId });
}

// Many swaps with ONE wallet approval where the wallet supports it: quote every leg,
// have the wallet sign them all in a single prompt (signAllTransactions), then execute
// each. A leg that can't be quoted or executed fails on its own without sinking the
// rest, and is reported so the caller can offer a retry. Quotes are fetched one at a
// time to stay under Jupiter's rate limits.
export async function swapManyWithWallet({ swaps, wallet }) {
  if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
  const taker = wallet.publicKey.toBase58();
  const done = [], failures = [], ready = [];
  for (const s of swaps) {
    try {
      const order = await getOrder({ inputMint: s.inputMint, outputMint: s.outputMint, amount: s.amount, taker });
      if (!order.transaction) throw new Error(order.errorMessage || "No route found for this swap");
      ready.push({ s, order, tx: VersionedTransaction.deserialize(Buffer.from(order.transaction, "base64")) });
    } catch (e) {
      failures.push({ s, error: e.message || String(e) });
    }
  }
  if (!ready.length) return { done, failures };

  let signed;
  try {
    signed = wallet.signAllTransactions
      ? await wallet.signAllTransactions(ready.map((r) => r.tx))
      : await ready.reduce(async (acc, r) => [...(await acc), await wallet.signTransaction(r.tx)], Promise.resolve([]));
  } catch (e) {
    const msg = e.message || "Signing was cancelled";
    return { done, failures: [...failures, ...ready.map((r) => ({ s: r.s, error: msg }))] };
  }

  for (let i = 0; i < ready.length; i++) {
    const { s, order } = ready[i];
    try {
      const result = await executeOrder({ signedTransactionBase64: Buffer.from(signed[i].serialize()).toString("base64"), requestId: order.requestId });
      if (result.status !== "Success") throw new Error(result.error || "Swap failed on-chain");
      done.push({ s, order, result });
    } catch (e) {
      failures.push({ s, error: e.message || String(e) });
    }
  }
  return { done, failures };
}

// Full flow for one leg: quote -> wallet signs -> Jupiter executes.
// `wallet` must expose signTransaction (any standard Solana wallet adapter).
export async function swapWithWallet({ inputMint, outputMint, amount, wallet }) {
  if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
  const taker = wallet.publicKey.toBase58();
  const order = await getOrder({ inputMint, outputMint, amount, taker });
  if (!order.transaction) {
    throw new Error(order.errorMessage || "No route found for this swap");
  }
  const tx = VersionedTransaction.deserialize(Buffer.from(order.transaction, "base64"));
  const signed = await wallet.signTransaction(tx);
  const signedTransactionBase64 = Buffer.from(signed.serialize()).toString("base64");
  const result = await executeOrder({ signedTransactionBase64, requestId: order.requestId });
  if (result.status !== "Success") {
    throw new Error(result.error || "Swap failed on-chain");
  }
  return { order, result };
}
