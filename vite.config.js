import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath, URL } from "node:url";
import { relay } from "./api/_clawpump.js";
import { chartRelay } from "./api/_chart.js";
import { prestocksRelay } from "./api/_prestocks.js";

// Serves POST /api/clawpump during `npm run dev` / `npm run preview` with the same relay
// the Vercel function uses. The env vars it reads have no VITE_ prefix, so they stay on
// the server and are never bundled into the app.
function clawpumpApi(env) {
  const handler = (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/clawpump") return next();
    if (req.method !== "POST") { res.statusCode = 405; res.end(JSON.stringify({ error: "POST only" })); return; }
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on("end", async () => {
      let body = {};
      try { body = JSON.parse(raw || "{}"); } catch { /* validated (and rejected) by relay */ }
      const { status, json } = await relay(body, env, req.socket?.remoteAddress || "local");
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(json));
    });
  };
  // (Braces matter: a hook that *returns* a function is treated by Vite as a post-hook and called.)
  return { name: "clawpump-api", configureServer(s) { s.middlewares.use(handler); }, configurePreviewServer(s) { s.middlewares.use(handler); } };
}

// Serves GET /api/chart in dev/preview with the same relay as the Vercel function.
function chartApi() {
  const handler = async (req, res, next) => {
    const url = new URL(req.url || "", "http://local");
    if (url.pathname !== "/api/chart") return next();
    if (req.method !== "GET") { res.statusCode = 405; res.end(JSON.stringify({ error: "GET only" })); return; }
    const { status, json } = await chartRelay({ mint: url.searchParams.get("mint") || "", range: url.searchParams.get("range") || "" });
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(json));
  };
  return { name: "chart-api", configureServer(s) { s.middlewares.use(handler); }, configurePreviewServer(s) { s.middlewares.use(handler); } };
}

// Serves GET /api/prestocks in dev/preview with the same relay as the Vercel function.
function prestocksApi() {
  const handler = async (req, res, next) => {
    if ((req.url || "").split("?")[0] !== "/api/prestocks") return next();
    if (req.method !== "GET") { res.statusCode = 405; res.end(JSON.stringify({ error: "GET only" })); return; }
    const { status, json } = await prestocksRelay();
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(json));
  };
  return { name: "prestocks-api", configureServer(s) { s.middlewares.use(handler); }, configurePreviewServer(s) { s.middlewares.use(handler); } };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); // all vars, including non-VITE_ ones (server-side only)
  return {
    plugins: [
      react(),
      // The Meteora DBC SDK (via @coral-xyz/anchor's Borsh coder) references a bare
      // global `Buffer` at module-evaluation time, not just inside functions. ES
      // import hoisting means main.jsx's own `window.Buffer = ...` line always runs
      // AFTER every module it imports has already been evaluated — including this
      // SDK — so that per-file assignment is too late. This plugin injects a real
      // Buffer global before any module (dev pre-bundle or production chunk) runs.
      nodePolyfills({ globals: { Buffer: true, global: false, process: false } }),
      clawpumpApi(env),
      chartApi(),
      prestocksApi(),
    ],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    define: { global: "globalThis" },
    optimizeDeps: { esbuildOptions: { define: { global: "globalThis" } } },
    build: {
      rollupOptions: {
        output: {
          // Solana/wallet-adapter libraries rarely change and are heavy (~370kB gzipped) —
          // splitting them into their own chunk lets browsers cache them independently of
          // app code, and lets the two download in parallel instead of one blocking bundle.
          manualChunks(id) {
            if (/[\\/]node_modules[\\/](@solana|buffer)[\\/]/.test(id)) return "solana-wallet";
            // The Meteora DBC SDK bundles its full program IDL (types for every
            // instruction/account), which is heavy and only needed on the Admin
            // and Launches pages — keep it out of the bundle everyone else pays for.
            if (/[\\/]node_modules[\\/]@meteora-ag[\\/]/.test(id)) return "dbc-sdk";
          },
        },
      },
    },
  };
});
