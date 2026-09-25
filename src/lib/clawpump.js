import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getConnection } from "@/lib/solanaConnection";

// Launching a token through ClawPump (pump.fun) is three steps, and the app never holds
// the ClawPump key (it lives on the server, behind /api/clawpump):
//   1. quote:   ask for a price for this token          -> { recipient, sol, preflightToken }
//   2. pay:     the user's own wallet sends that SOL    -> transaction signature
//   3. confirm: hand the signature back; ClawPump mints -> { mint, url }
// The quote's exact JSON isn't documented, and paying a wrongly-read address would lose
// money, so extraction is strict: unless we can find a valid recipient address, a sane SOL
// amount and a quote token, we refuse to pay and show the raw response instead.

const MAX_SOL = 0.05; // ClawPump's stated cost is ~0.012–0.018 SOL; anything far above that is refused
// Deliberately excludes "wallet"/"walletAddress": responses may echo the payer's own address back.
const RECIPIENT_KEYS = ["recipient", "recipientAddress", "receivingAddress", "receiver", "payTo", "paymentAddress", "address", "to"];
const SOL_KEYS = ["amountSol", "solAmount", "sol", "priceSol", "costSol", "totalSol", "amount", "price", "cost"];
const TOKEN_KEYS = ["preflightToken", "quoteToken", "quoteId", "token"];

// Looks through the response (and one level of nesting) for the first usable value.
function pick(obj, keys, ok) {
  const layers = [obj, ...Object.values(obj || {}).filter((v) => v && typeof v === "object" && !Array.isArray(v))];
  for (const layer of layers) for (const k of keys) if (k in layer && ok(layer[k])) return layer[k];
  return undefined;
}
const isKey = (v) => { try { return typeof v === "string" && v.length >= 32 && v.length <= 44 && !!new PublicKey(v); } catch { return false; } };

export function readQuote(json, payer) {
  const recipient = pick(json, RECIPIENT_KEYS, (v) => isKey(v) && v !== payer);
  let sol = pick(json, SOL_KEYS, (v) => Number(v) > 0 && Number(v) <= MAX_SOL);
  if (sol == null) { const l = pick(json, ["lamports", "amountLamports"], (v) => Number(v) > 0 && Number(v) / 1e9 <= MAX_SOL); if (l != null) sol = Number(l) / 1e9; }
  const preflightToken = pick(json, TOKEN_KEYS, (v) => typeof v === "string" && v.length > 8);
  if (!recipient || sol == null || !preflightToken) return { ok: false };
  return { ok: true, recipient, sol: Number(sol), preflightToken };
}

async function post(body) {
  const r = await fetch("/api/clawpump", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, json };
}

const fields = (f, wallet) => ({ name: f.name, symbol: f.symbol, description: f.description, imageUrl: f.imageUrl, walletAddress: wallet.address });

export async function getLaunchQuote(f, wallet) {
  const r = await post({ ...fields(f, wallet), preflight: true });
  if (!r.ok) throw new Error(r.json?.error || r.json?.message || `ClawPump returned ${r.status}`);
  return { raw: r.json, quote: readQuote(r.json, wallet.address) };
}

// Sends exactly the quoted SOL to exactly the quoted address, waits for it to confirm.
export async function payQuote({ recipient, sol }, wallet) {
  if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
  const connection = getConnection();
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: new PublicKey(recipient), lamports: Math.round(sol * 1e9) }));
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

export async function confirmLaunch(f, wallet, { txSignature, preflightToken }) {
  const r = await post({ ...fields(f, wallet), preflight: false, txSignature, preflightToken });
  if (!r.ok) throw new Error(r.json?.error || r.json?.message || `ClawPump returned ${r.status}`);
  return r.json;
}

// Best-effort read of the result: the new token's mint and its page.
export function readLaunch(json) {
  const mint = pick(json, ["mint", "mintAddress", "tokenAddress", "address"], isKey);
  const url = pick(json, ["url", "tokenUrl", "pumpFunUrl", "link"], (v) => typeof v === "string" && /^https:\/\//.test(v));
  return { mint, url };
}
