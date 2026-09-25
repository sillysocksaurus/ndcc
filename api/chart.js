// Vercel function: GET /api/chart?mint=<address>&range=1D|1W|1M|3M
import { chartRelay } from "./_chart.js";

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  const { status, json } = await chartRelay({ mint: String(req.query.mint || ""), range: String(req.query.range || "") });
  if (status === 200) res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(status).json(json);
}
