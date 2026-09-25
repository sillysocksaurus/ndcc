# NDCC

**NDCC is an always-open Solana app for buying, planning and launching tokenized stocks (single stocks, baskets, pre-IPO tokens and new bonding-curve listings) straight from your own wallet.**

Non-custodial: you connect Phantom or Solflare, every trade is signed by your own wallet, and stocks sit in your wallet as ordinary tokens.

## Contents

1. [What it does](#what-it-does)
2. [Quick start](#quick-start)
3. [Setting up the keys and wallets](#setting-up-the-keys-and-wallets)
4. [Analytics tracking](#analytics-tracking)
5. [How it works](#how-it-works)
6. [Hackathon bounties](#bounties-used)
7. [Deploying](#deploying)
8. [Limitations](#limitations)

## What it does

- **Trade:** 27 tokenized stocks with search, sector filters, watchlist and tap-to-expand price charts (1D / 1W / 1M / 3M).
- **Baskets and Robo:** one-tap weighted portfolios (one approval buys every leg) and a risk quiz that builds a model portfolio.
- **Recurring:** weekly, fortnightly or monthly plans, with a growth projection that starts from your real holdings.
- **Portfolio:** live on-chain balances, targets, exposure, fees and tokens you created (needs a connected wallet).
- **Pre-IPO:** OpenAI, Kalshi and SpaceX tokens with a premium or discount to reference price.
- **Launches:** buy or sell stocks on a Meteora bonding curve before they graduate.
- **Create a token:** launch a token through ClawPump, paying from your own wallet.
- **Admin (admin wallet only):** DBC launch console and monitor, basket builder, API keys, usage dashboard, analytics hookup.

## Quick start

You need [Node.js](https://nodejs.org) (the LTS version).

```bash
npm install
cp .env.example .env     # on Windows: copy .env.example .env
```

Fill in `.env` (next section), then:

```bash
npm run dev              # opens at http://localhost:5173
```

Use a browser with the **Phantom** or **Solflare** extension. To build for production: `npm run build` (output in `dist/`).

## Setting up the keys and wallets

Everything goes in the `.env` file in the project root. **Never upload `.env` to GitHub**; it is already listed in `.gitignore`. After editing `.env`, stop and restart `npm run dev`.

### 1. Helius RPC (needed: reads wallet balances)

The public Solana server is heavily rate-limited and often fails with "Sync failed". Use your own free Helius endpoint.

1. Create a free account at [helius.dev](https://www.helius.dev) and copy your **mainnet RPC URL** (it looks like `https://mainnet.helius-rpc.com/?api-key=...`).
2. Put it in `.env`:
   ```
   VITE_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
   ```
3. **Or change it without touching files:** connect the admin wallet, open **Admin, then API keys, then Helius RPC**, paste the URL (a bare key also works) and press **Test**. This is saved in that browser only.

The Admin value wins over `.env`, and `.env` wins over the public default. In your Helius dashboard, restrict the key to your website's domain, because `VITE_` values are visible in the built site.

### 2. Admin wallet (needed to see the Admin tab)

The Admin tab appears when the connected wallet's address is in `VITE_ADMIN_WALLET`. Separate several addresses with commas, no spaces:

```
VITE_ADMIN_WALLET=FirstWalletAddress,SecondWalletAddress
```

This is a convenience gate, not real security: there is no backend to enforce it, so do not put anything secret behind it. Launches created by any of these wallets are also listed on the Launches page.

To show launches from extra wallets on the Launches page, add `VITE_LAUNCH_CREATORS=addr1,addr2` (optional).

### 3. ClawPump (only for the "Create a token" page)

ClawPump blocks browser requests and needs a secret key, so the app calls a small server relay (`api/clawpump.js`). The key never reaches the browser.

1. Sign in at [clawpump.tech](https://clawpump.tech), create an API key at `clawpump.tech/dashboard/api` (starts with `cpk_`) and register an agent.
2. Put these in `.env` (no `VITE_` prefix, on purpose):
   ```
   CLAWPUMP_API_KEY=cpk_...
   CLAWPUMP_AGENT_ID=your-agent-id
   CLAWPUMP_AGENT_NAME=NDCC
   ```
3. Restart `npm run dev`. Leave them blank to disable the page (it shows a "not configured" message).

### 4. No key needed

Jupiter (swaps and prices), the PreStocks API (via `api/prestocks.js`), GeckoTerminal (chart history, via `api/chart.js`), DexScreener and the Meteora SDK need no keys.

### Summary of `.env`

| Variable | Needed for | Visible to visitors? |
|---|---|---|
| `VITE_SOLANA_RPC` | Reading wallet balances | Yes (restrict it in Helius) |
| `VITE_ADMIN_WALLET` | Showing the Admin tab | Yes (public addresses) |
| `VITE_LAUNCH_CREATORS` | Extra launch creators (optional) | Yes |
| `CLAWPUMP_API_KEY`, `CLAWPUMP_AGENT_ID`, `CLAWPUMP_AGENT_NAME` | Create a token | **No** (server only) |

## Analytics tracking

There are two separate layers, both viewable and configurable from the Admin page.

**1. NDCC's own product-usage tracking (built in, no setup).**
- Records anonymous events per session: `app_open`, `tab_view`, `wallet_connect` (only the wallet brand, never the address), `basket_open`, `amount_set`, `cadence_set`, `buy_real`, `rebalance_preview`, `rebalance_real`, `plan_create`, `plan_cancel`.
- Stored in the visitor's browser (`localStorage`), capped at 200 sessions and 150 events per session.
- The Admin **usage dashboard** shows sessions, a funnel and a live event feed. Without a backend this only shows data from the browser you are using. To gather data from every visitor, connect a shared store by calling `setRemoteSink({ upsert(session), list() })` in `src/lib/analytics.js` (for example a Supabase table or your own endpoint).

**2. Third-party analytics (optional).**
- In **Admin, then Third-party analytics**, paste a Google Analytics 4 Measurement ID (`G-XXXXXXXXXX`) and/or an Adobe Analytics / Launch script URL (https only) and save. The scripts load immediately.
- This setting is stored per browser, so it only tracks visits from the browser where it was saved. To track everyone, add the ID at build time or add a backend.
- Mention analytics in your privacy policy.

## How it works

1. **Connect** with the Solana wallet-adapter; declined or failed connections are reported clearly.
2. **Read the wallet** from Solana through your RPC. Real trades are blocked until sync completes, so nothing is sized on stale data.
3. **Quote and swap** with Jupiter Ultra: one quote per leg, one batched signature per basket, failed legs retried alone.
4. **Live updates:** prices and pre-IPO reference prices refresh every 60 seconds from Jupiter, PreStocks details refresh every minute, and newly listed PreStocks tokens are added automatically (this needs the server relay running). Chart requests are queued and cached to stay under the free rate limit.
5. **Show the risk:** price impact, fees and thin-pool warnings before signing. Prices come from the Jupiter Price API; chart history from GeckoTerminal.
6. **Launch** with the Meteora DBC SDK from the admin wallet, or with ClawPump through the server relay.

There is no database: baskets, plans, watchlist and settings live in the browser. The only server code is three small relays in `api/`.

Code map: `src/pages` (screens), `src/hooks` (wallet, portfolio, prices), `src/lib` (Jupiter, Meteora DBC, ClawPump, charts, analytics), `src/data/xstocks.js` (token mints and baskets), `api/` (relays).

## Bounties used

- **Main track:** a working end-to-end app for buying, holding and planning tokenized stocks with self-custody, on Solana for 24/7 markets and cheap, fast swaps.
- **Meteora, Best Use of DBC:** equity launch console on the DBC SDK, with USDC or stock-paired quote tokens (SPYx, QQQx, NVDAx, TSLAx), a decaying trading fee plus issuer royalty, vested issuer allocation, locked liquidity, a monitor, and one-click migration to DAMM v2.
- **PreStocks, Best Use of PreStocks:** eight PreStocks tokens (Anthropic, OpenAI, SpaceX, Anduril, Figure AI, Neuralink, Kalshi, Polymarket) tradable through Jupiter. Each expands to show the company description, reference valuation, valuation implied by the token price and supply from the PreStocks API (via the `api/prestocks relay), plus a PreStocks Frontier basket.
- **Tessera, Pre-IPO tokens:** OpenAI, Kalshi and SpaceX T-Tokens tradable through Jupiter with a premium or discount to reference price, plus a Private Markets basket.
- **ClawPump, Stocknized Agent:** Create a token launches through ClawPump's self-funded flow: the user pays the launch fee from their own wallet, and the app validates the payment address and amount first.

## Deploying

The `api/` folder works as Vercel serverless functions. Import the repo at vercel.com, add the environment variables from the table above, and deploy. GitHub Pages serves static files only, so the charts and Create-a-token page would not work there.

## Limitations

- Recurring plans are simulated (no on-chain orders); the growth chart is an illustration, not a forecast.
- Trade rows show placeholder "example" outlook figures, not a model.
- State is per-browser and there are no user accounts yet; admin gating is client-side only.
- Tokenized stocks are high risk, can have thin liquidity, and may be unavailable in some regions. Not investment advice.
