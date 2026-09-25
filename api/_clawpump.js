// Server-side relay for ClawPump's wallet-funded token launch. It exists because
// ClawPump requires a secret API key (Authorization: Bearer cpk_…) and doesn't allow
// browser requests (no CORS), so the key can never live in the web app. This file runs
// on a server only: in `npm run dev`/`preview` via the Vite plugin, and in production as
// the Vercel function api/clawpump.js. Both call `relay()`.
//
// It is deliberately NOT an open proxy: it forwards only whitelisted, validated fields to
// one fixed URL, always launches under the site's own agent, and rate-limits per client.
// The launch itself is paid by the end user's wallet; the key is never spent by this.

const LAUNCH_URL = "https://clawpump.tech/api/v1/launch/self-funded";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

const hits = new Map(); // best-effort, in-memory per server instance
function rateLimited(client) {
  const now = Date.now(), windowMs = 10 * 60 * 1000, max = 12;
  const recent = (hits.get(client) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(client, recent);
  return recent.length > max;
}

function clean(body) {
  const b = body && typeof body === "object" ? body : {};
  const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const out = {
    name: str(b.name, 32),
    symbol: str(b.symbol, 10),
    description: str(b.description, 500),
    imageUrl: str(b.imageUrl, 500),
    walletAddress: str(b.walletAddress, 60),
    preflight: b.preflight !== false, // anything but an explicit `false` is a quote-only request
  };
  if (!out.name) return { error: "Name is required." };
  if (!/^[A-Za-z0-9]{1,10}$/.test(out.symbol)) return { error: "Symbol must be 1–10 letters or digits." };
  if (!out.description) return { error: "Description is required." };
  if (!/^https:\/\//i.test(out.imageUrl)) return { error: "Image must be an https:// URL." };
  if (!(BASE58.test(out.walletAddress) && out.walletAddress.length >= 32 && out.walletAddress.length <= 44)) return { error: "Invalid wallet address." };
  if (!out.preflight) {
    const sig = str(b.txSignature, 100), token = str(b.preflightToken, 4000);
    if (!(BASE58.test(sig) && sig.length >= 64)) return { error: "Missing or invalid payment signature." };
    if (!token) return { error: "Missing quote token." };
    out.txSignature = sig;
    out.preflightToken = token;
  }
  return { payload: out };
}

export async function relay(body, env, client = "unknown") {
  const key = env.CLAWPUMP_API_KEY, agentId = env.CLAWPUMP_AGENT_ID;
  if (!key || !agentId) {
    return { status: 503, json: { error: "Token launching isn't configured on this server yet (CLAWPUMP_API_KEY and CLAWPUMP_AGENT_ID are required)." } };
  }
  if (rateLimited(client)) return { status: 429, json: { error: "Too many requests. Try again in a few minutes." } };
  const { payload, error } = clean(body);
  if (error) return { status: 400, json: { error } };

  try {
    const r = await fetch(LAUNCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...payload, agentId, agentName: env.CLAWPUMP_AGENT_NAME || agentId }),
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
    return { status: r.status, json };
  } catch (e) {
    return { status: 502, json: { error: `Couldn't reach ClawPump: ${e.message || e}` } };
  }
}
