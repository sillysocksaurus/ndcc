// Vercel function: GET /api/prestocks
import { prestocksRelay } from "./_prestocks.js";

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  const { status, json } = await prestocksRelay();
  if (status === 200) res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(status).json(json);
}
