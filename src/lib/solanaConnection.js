import { Connection, PublicKey } from "@solana/web3.js";
import { TOKENS, USDC_MINT } from "@/data/xstocks";
import { getRpcEndpoint } from "@/lib/apiKeys";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ALL_MINTS = [USDC_MINT, ...Object.values(TOKENS).map((t) => t.mint)];

// Public mainnet RPC by default. Solana's public endpoint actively blocks the broad
// "scan every token account by program ID" query (too expensive to serve for free),
// and rate-limits everything else hard. Set VITE_SOLANA_RPC to a dedicated endpoint
// (Helius, QuickNode, Triton, etc.) for anything beyond occasional casual use.
// The endpoint is chosen in Admin → API keys ("Helius RPC"), falling back to the
// VITE_SOLANA_RPC build setting, then the public endpoint. See getRpcEndpoint().
const { url: RPC_ENDPOINT, source: RPC_SOURCE } = getRpcEndpoint();
const usingPublicRpc = RPC_SOURCE === "public";
// Never put the full URL in user-visible errors: it carries the API key.
const RPC_HOST = (() => { try { return new URL(RPC_ENDPOINT).host; } catch { return "the RPC endpoint"; } })();

let connection = null;
export function getConnection() {
  if (!connection) connection = new Connection(RPC_ENDPOINT, "confirmed");
  return connection;
}

function describeRpcError(e, { wasScan = false } = {}) {
  const msg = String(e?.message || e || "");
  if (e?.name === "TypeError" && /fetch/i.test(msg)) return `Can't reach ${RPC_HOST} (network error or blocked by CORS)`;
  if (/429|too many requests/i.test(msg)) return `Rate-limited by ${RPC_HOST}${usingPublicRpc ? " — add a Helius RPC in Admin → API keys" : ""}`;
  if (/401|403|unauthorized|forbidden/i.test(msg)) {
    if (wasScan && usingPublicRpc) return "Solana's public RPC blocks broad balance scans — add a Helius RPC in Admin → API keys";
    return `Rejected by ${RPC_HOST}${usingPublicRpc ? "" : " (check your API key and allowed domains)"}`;
  }
  return msg || "Unknown RPC error";
}

// Fast path: one call for every SPL token account the wallet holds, filtered by
// program ID. Cheap on a dedicated RPC, but public RPCs commonly 403 this exact
// pattern (an unindexed scan), so callers should fall back to per-mint lookups.
async function scanAllTokenAccounts(ownerAddress) {
  const conn = getConnection();
  const owner = new PublicKey(ownerAddress);
  const { value } = await conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
  const byMint = {};
  for (const { account } of value) {
    const info = account.data.parsed?.info;
    const mint = info?.mint;
    const amt = info?.tokenAmount?.uiAmount || 0;
    if (!mint || amt <= 0) continue;
    byMint[mint] = (byMint[mint] || 0) + amt;
  }
  return byMint;
}

// Fallback: one targeted call per known mint. More calls, but this query shape
// (owner + exact mint) is what public RPCs actually allow. Run in parallel and
// tolerate individual failures — but a mint we couldn't confirm is reported as
// "incomplete", not silently folded into the result as if it were a zero balance.
// A stock you actually hold must never look like one you don't just because its
// one RPC call got rate-limited among the other 25.
async function scanKnownMintsOneByOne(ownerAddress) {
  const conn = getConnection();
  const owner = new PublicKey(ownerAddress);
  const results = await Promise.allSettled(
    ALL_MINTS.map((mint) => conn.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(mint) }).then((r) => [mint, r.value])),
  );
  const byMint = {};
  let okCount = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    okCount++;
    const [mint, value] = r.value;
    const amt = value.reduce((sum, { account }) => sum + (account.data.parsed?.info?.tokenAmount?.uiAmount || 0), 0);
    if (amt > 0) byMint[mint] = amt;
  }
  if (okCount === 0) throw new Error("All per-mint balance lookups failed");
  return { byMint, incomplete: okCount < ALL_MINTS.length };
}

export async function getAllTokenBalances(ownerAddress) {
  try {
    return { ok: true, byMint: await scanAllTokenAccounts(ownerAddress), incomplete: false };
  } catch (scanError) {
    console.warn("[stocklana] broad token scan failed, falling back to per-mint lookups:", scanError);
    try {
      const { byMint, incomplete } = await scanKnownMintsOneByOne(ownerAddress);
      return { ok: true, byMint, incomplete };
    } catch (e) {
      console.error("[stocklana] per-mint balance fallback also failed:", e);
      return { ok: false, error: describeRpcError(scanError, { wasScan: true }) };
    }
  }
}

export async function getSolBalance(ownerAddress) {
  try {
    const conn = getConnection();
    const lamports = await conn.getBalance(new PublicKey(ownerAddress));
    return { ok: true, sol: lamports / 1e9 };
  } catch (e) {
    console.error("[stocklana] getSolBalance failed:", e);
    return { ok: false, error: describeRpcError(e) };
  }
}
