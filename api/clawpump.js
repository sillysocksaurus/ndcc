// Vercel serverless function: POST /api/clawpump. Set CLAWPUMP_API_KEY, CLAWPUMP_AGENT_ID
// (and optionally CLAWPUMP_AGENT_NAME) as environment variables in the Vercel project.
import { relay } from "./_clawpump.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const client = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const { status, json } = await relay(req.body, process.env, client);
  res.status(status).json(json);
}
