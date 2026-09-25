// Server-side relay for the PreStocks public API (https://prestocks.com/api/prestocks). It sends no CORS
// headers, so browsers can't call it directly; this runs in `npm run dev` (via vite.config.js) and as a Vercel function.
const URL_PRESTOCKS = "https://prestocks.com/api/prestocks";
const TTL = 60_000;
let cache = null; // { at, tokens }

const num = (v) => (Number.isFinite(+v) ? +v : null);

// -> { status, json: { tokens: [{ id, symbol, name, mint, description, markPrice, tokenPrice, markValuation, impliedValuation, supply, url }] } }
export async function prestocksRelay() {
  if (cache && Date.now() - cache.at < TTL) return { status: 200, json: { tokens: cache.tokens } };
  try {
    const r = await fetch(URL_PRESTOCKS, { headers: { accept: "application/json" } });
    if (!r.ok) return { status: 502, json: { error: `PreStocks API unavailable (${r.status}).` } };
    const list = await r.json();
    if (!Array.isArray(list)) return { status: 502, json: { error: "Unexpected PreStocks response." } };
    const tokens = list.map((t) => ({
      id: String(t.symbol || "").toLowerCase(),
      symbol: String(t.symbol || ""),
      name: String(t.name || ""),
      mint: String(t.contract_address || ""),
      description: String(t.description || "").split("\n\n")[0].slice(0, 600),
      markPrice: num(t.markPrice),
      tokenPrice: num(t.tokenPrice),
      markValuation: num(t.markValuation),
      impliedValuation: num(t.impliedValuation),
      supply: num(t.supply),
      url: /^https:\/\/(www\.)?prestocks\.com\//.test(t.external_url || "") ? t.external_url : "https://www.prestocks.com/products",
    })).filter((t) => t.mint);
    cache = { at: Date.now(), tokens };
    return { status: 200, json: { tokens } };
  } catch {
    return { status: 502, json: { error: "PreStocks API unavailable." } };
  }
}
