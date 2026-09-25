// "Equity Discovery Curve" — an issuer-launch preset on top of Meteora's Dynamic
// Bonding Curve (DBC), tuned for a newly-tokenized, thinly-traded stock instead of
// a memecoin. Three choices make it different from a default meme DBC config:
//
// 1. Quote token is always USDC, not SOL or another meme token — the instrument
//    equity buyers actually think in.
// 2. Trading fee starts high and decays over the first `feeDecayDays` (a
//    FeeSchedulerLinear base fee) — expensive to flip in hour one, cheap once the
//    price has had time to find a level. The issuer also earns an ongoing cut of
//    every trade (`creatorTradingFeePercentage`), an equity-style "listing
//    royalty" rather than a one-time mint payday.
// 3. The issuer's own token allocation (`lockedVesting`) and their share of the
//    post-migration DAMM v2 LP (`creatorLiquidityVestingInfoParams`) are vested
//    with a cliff by default — on-chain enforced, so "graduation" only benefits
//    an issuer who has committed to not dumping on day one. DBC has no native
//    concept of a holder-count or elapsed-time migration gate (the Meteora
//    keeper migrates the instant the quote threshold is crossed, full stop), so
//    this vesting lock — not a fake holder gate — is the real, verifiable trust
//    mechanic this preset adds on top of the raw primitive.
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { useSyncExternalStore } from "react";
import {
  DynamicBondingCurveClient,
  buildCurveWithMarketCap,
  getCurrentPoint,
  deriveDbcPoolAddress,
  deriveTokenBadgeAddress,
  ActivationType,
  TokenType,
  TokenDecimal,
  TokenAuthorityOption,
  CollectFeeMode,
  BaseFeeMode,
  MigrationOption,
  SwapMode,
  DAMM_V2_MIGRATION_FEE_ADDRESS,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { getConnection } from "@/lib/solanaConnection";
import { USDC_MINT, USDC_DECIMALS, TOKENS } from "@/data/xstocks";
import { fmtUSD, fmtNum } from "@/lib/stocklana";

// What a launch can be priced in. USDC is the default. The xStocks below are Token-2022
// mints that Meteora has explicitly approved as DBC quote tokens (each has an on-chain
// "token badge", checked); the Tessera T-Tokens do NOT have one, so they can't be used.
export const QUOTE_OPTIONS = [
  { sym: "USDC", mint: USDC_MINT, decimals: USDC_DECIMALS, badge: false },
  ...["SPYx", "QQQx", "NVDAx", "TSLAx"].map((sym) => ({ sym, mint: TOKENS[sym].mint, decimals: 8, badge: true })),
];
export const quoteBySym = (sym) => QUOTE_OPTIONS.find((q) => q.sym === sym) || QUOTE_OPTIONS[0];
export const quoteByMint = (mint) => QUOTE_OPTIONS.find((q) => q.mint === mint) || null;
export const fmtQuote = (v, sym) => (sym === "USDC" ? fmtUSD(v) : `${fmtNum(v, v < 10 ? 4 : 2)} ${sym}`);
// Meteora requires at least about $750 of quote value for a stock-paired pool to graduate.
export const MIN_STOCK_QUOTE_THRESHOLD_USD = 750;
import { ADMIN_WALLETS } from "@/hooks/useIsAdmin";

let dbcClient = null;
export function getDbcClient() {
  if (!dbcClient) dbcClient = new DynamicBondingCurveClient(getConnection(), "confirmed");
  return dbcClient;
}

const daysToSeconds = (d) => Math.max(0, Math.round(Number(d) || 0)) * 86400;

// Index = MigrationFeeOption enum value. Fixed bps tiers DBC supports for the
// migrated DAMM v2 pool's own trading fee; each maps to a canonical on-chain
// dammConfig account via DAMM_V2_MIGRATION_FEE_ADDRESS[index].
export const MIGRATION_FEE_OPTIONS = [
  { index: 0, bps: 25, label: "0.25%" },
  { index: 1, bps: 30, label: "0.30%" },
  { index: 2, bps: 100, label: "1.00%" },
  { index: 3, bps: 200, label: "2.00%" },
  { index: 4, bps: 400, label: "4.00%" },
  { index: 5, bps: 600, label: "6.00%" },
];

export const EQUITY_LAUNCH_DEFAULTS = {
  name: "",
  symbol: "",
  uri: "",
  domain: "",
  quoteSym: "USDC",
  totalSupply: 1_000_000_000,
  initialMarketCapUsd: 10_000,
  migrationMarketCapUsd: 500_000,
  feeStartBps: 500,
  feeEndBps: 50,
  feeDecayDays: 7,
  feePeriods: 14,
  dynamicFeeEnabled: true,
  creatorTradingFeePct: 20,
  creatorLockedLiquidityPct: 30,
  creatorLpVestingDays: 180,
  creatorLpCliffDays: 30,
  tokenVestingPct: 10,
  tokenVestingDays: 365,
  tokenCliffDays: 90,
  migrationFeeOptionIndex: 2,
};

// Cheap client-side checks so obvious mistakes are caught before any wallet prompt
// (the SDK validates too, but its errors arrive only after a config is being built).
export function validateLaunchForm(f) {
  const errs = [];
  const n = (v) => Number(v);
  if (!f.name.trim()) errs.push("Name is required.");
  if (!/^[A-Za-z0-9]{1,10}$/.test(f.symbol.trim())) errs.push("Symbol must be 1–10 letters or digits.");
  if (!/^(https:\/\/|ipfs:\/\/)/i.test(f.uri.trim())) errs.push("Metadata URI must start with https:// or ipfs://.");
  if (!(n(f.totalSupply) >= 1_000_000)) errs.push("Total supply must be at least 1,000,000.");
  if (!(n(f.initialMarketCapUsd) > 0)) errs.push("Initial market cap must be above 0.");
  if (!(n(f.migrationMarketCapUsd) > n(f.initialMarketCapUsd))) errs.push("Graduation market cap must be higher than the initial market cap.");
  if (n(f.feeStartBps) < n(f.feeEndBps)) errs.push("Starting fee must be at least the ending fee.");
  if (n(f.feeStartBps) > 9900 || n(f.feeEndBps) < 25) errs.push("Fees must be between 0.25% and 99% (25–9900 bps).");
  if (n(f.creatorTradingFeePct) < 0 || n(f.creatorTradingFeePct) > 100) errs.push("Your trading-fee cut must be 0–100%.");
  if (n(f.tokenVestingPct) < 0 || n(f.tokenVestingPct) > 90) errs.push("Token allocation must be 0–90% of supply.");
  if (n(f.creatorLockedLiquidityPct) < 10 || n(f.creatorLockedLiquidityPct) > 100) errs.push("Permanently locked LP must be 10–100% (Meteora requires at least 10% locked).");
  return errs;
}

// Turns the issuer's plain-English form (dollars, percentages, days) into a DBC
// ConfigParameters struct via buildCurveWithMarketCap — the SDK's own curve math,
// not anything hand-rolled here.
export function buildEquityConfigParams(form, quotePriceUsd = 1) {
  const quote = quoteBySym(form.quoteSym);
  const totalSupply = Math.round(Number(form.totalSupply));
  const tokenVestingAmount = Math.round(totalSupply * (Number(form.tokenVestingPct) / 100));

  const lockedVesting = tokenVestingAmount > 0
    ? {
        totalLockedVestingAmount: tokenVestingAmount,
        numberOfVestingPeriod: 12,
        cliffUnlockAmount: 0,
        totalVestingDuration: daysToSeconds(form.tokenVestingDays),
        cliffDurationFromMigrationTime: daysToSeconds(form.tokenCliffDays),
      }
    : { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 };

  const creatorLiquidityVestingInfoParams = Number(form.creatorLpVestingDays) > 0
    ? {
        vestingPercentage: 100 - Number(form.creatorLockedLiquidityPct),
        bpsPerPeriod: Math.floor(10000 / 12),
        numberOfPeriods: 12,
        cliffDurationFromMigrationTime: daysToSeconds(form.creatorLpCliffDays),
        totalDuration: daysToSeconds(form.creatorLpVestingDays),
      }
    : undefined;

  const migrationFeeOptionIndex = Number(form.migrationFeeOptionIndex);
  const migrationFeeBps = MIGRATION_FEE_OPTIONS[migrationFeeOptionIndex]?.bps ?? 100;

  return buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.NINE,
      tokenQuoteDecimal: quote.decimals, // TokenDecimal values are the decimals themselves (6–9)
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: totalSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: Number(form.feeStartBps),
          endingFeeBps: Number(form.feeEndBps),
          numberOfPeriod: Number(form.feePeriods),
          totalDuration: daysToSeconds(form.feeDecayDays),
        },
      },
      dynamicFeeEnabled: !!form.dynamicFeeEnabled,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: Number(form.creatorTradingFeePct),
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: migrationFeeOptionIndex,
      migrationFee: { feePercentage: migrationFeeBps / 100, creatorFeePercentage: 100 },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 0,
      partnerLiquidityPercentage: 0,
      // Meteora requires locked + immediately-claimable + vested LP to total exactly 100
      // (the vested slice is counted separately, via vestingPercentage). The launcher is
      // both "partner" and "creator", so: a permanently locked slice, and all the rest is
      // the issuer's LP, vested with a cliff (or claimable at once if vesting is turned off).
      creatorPermanentLockedLiquidityPercentage: Number(form.creatorLockedLiquidityPct),
      creatorLiquidityPercentage: creatorLiquidityVestingInfoParams ? 0 : 100 - Number(form.creatorLockedLiquidityPct),
      creatorLiquidityVestingInfoParams,
    },
    lockedVesting,
    activationType: ActivationType.Timestamp,
    // The SDK wants market caps in units of the quote token, so a USD figure is divided
    // by the quote's USD price (1 for USDC; the live stock price for a stock-paired pool).
    initialMarketCap: Number(form.initialMarketCapUsd) / quotePriceUsd,
    migrationMarketCap: Number(form.migrationMarketCapUsd) / quotePriceUsd,
  });
}

async function signSendConfirm(tx, wallet, extraSigners = []) {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  if (extraSigners.length) tx.partialSign(...extraSigners);
  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

// Builds the config account, then the pool itself (two transactions — the config
// must land before a pool can reference it). Does not perform a first buy; the
// issuer buys through the normal curve buy flow immediately after, same as any
// other trader, against the pool's real on-chain state rather than a pre-launch
// simulated quote.
export async function createEquityLaunch({ form, wallet, quotePriceUsd = 1 }) {
  if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
  const client = getDbcClient();
  const owner = wallet.publicKey;
  const quote = quoteBySym(form.quoteSym);
  const quoteMint = new PublicKey(quote.mint);
  // Meteora-approved Token-2022 quote mints (the xStocks) carry an on-chain "badge"
  // account that both the config and the pool must reference.
  const tokenBadge = quote.badge ? deriveTokenBadgeAddress(quoteMint) : undefined;

  const configParams = buildEquityConfigParams(form, quotePriceUsd);
  const configKeypair = Keypair.generate();
  const baseMintKeypair = Keypair.generate();

  const createConfigTx = await client.partner.createConfig({
    ...configParams,
    config: configKeypair.publicKey,
    feeClaimer: owner,
    leftoverReceiver: owner,
    quoteMint,
    payer: owner,
    ...(tokenBadge ? { tokenBadge } : {}),
  });
  const configSig = await signSendConfirm(createConfigTx, wallet, [configKeypair]);

  let poolSig;
  try {
    const createPoolTx = await client.creator.createPool({
      name: form.name.trim(),
      symbol: form.symbol.trim(),
      uri: form.uri.trim(),
      payer: owner,
      poolCreator: owner,
      config: configKeypair.publicKey,
      baseMint: baseMintKeypair.publicKey,
      ...(tokenBadge ? { tokenBadge } : {}),
    });
    poolSig = await signSendConfirm(createPoolTx, wallet, [baseMintKeypair]);
  } catch (e) {
    // Step 1 already landed and can't be rolled back; say so instead of a bare failure.
    throw new Error(`Config account ${configKeypair.publicKey.toBase58()} was created (rent already paid), but creating the pool failed: ${e.message || e}. Retrying makes a fresh config.`);
  }

  const pool = deriveDbcPoolAddress(quoteMint, baseMintKeypair.publicKey, configKeypair.publicKey);

  const launch = {
    pool: pool.toBase58(),
    config: configKeypair.publicKey.toBase58(),
    baseMint: baseMintKeypair.publicKey.toBase58(),
    name: form.name.trim(),
    symbol: form.symbol.trim(),
    domain: form.domain?.trim() || "",
    creator: owner.toBase58(),
    quoteSym: quote.sym,
    createdAt: Date.now(),
    initialMarketCapUsd: Number(form.initialMarketCapUsd),
    migrationMarketCapUsd: Number(form.migrationMarketCapUsd),
    migrationFeeOptionIndex: Number(form.migrationFeeOptionIndex),
    hasTokenVesting: Number(form.tokenVestingPct) > 0,
    hasLpVesting: Number(form.creatorLpVestingDays) > 0,
    configSig,
    poolSig,
    migratedAt: null,
  };
  addLaunch(launch);
  return launch;
}

// Live on-chain state for one launch: raw progress toward migration, current
// reserves, and unclaimed/lifetime fee metrics. No caching — always a fresh read.
export async function getLaunchStatus(poolAddress) {
  const client = getDbcClient();
  const pool = new PublicKey(poolAddress);
  const virtualPool = await client.state.getPool(pool);
  if (!virtualPool) return null;
  const [poolConfig, quoteProgress, migrationThreshold, feeMetrics] = await Promise.all([
    client.state.getPoolConfig(virtualPool.config),
    client.state.getPoolQuoteTokenCurveProgress(pool),
    client.state.getPoolMigrationQuoteThreshold(pool),
    client.state.getPoolFeeMetrics(pool).catch(() => null),
  ]);
  const q = quoteInfo(poolConfig);
  return {
    virtualPool,
    poolConfig,
    quoteProgress, // 0..1
    quoteSym: q.sym,
    quoteReserveUi: bnToUi(virtualPool.quoteReserve, q.decimals),
    migrationThresholdUi: bnToUi(migrationThreshold, q.decimals),
    isMigrated: Number(virtualPool.isMigrated) === 1,
    feeMetrics,
  };
}

// The quote token a pool trades against, from its on-chain config. A pool created
// elsewhere with a quote we don't know is treated as 6 decimals and labeled generically.
function quoteInfo(poolConfig) {
  return quoteByMint(poolConfig.quoteMint.toBase58()) || { sym: "quote", decimals: 6 };
}

function bnToUi(bn, decimals) {
  return Number(bn.toString()) / 10 ** decimals;
}

// Quote-only (no wallet, no network write) — used to show an estimate before the
// trader commits to a swap.
export async function quoteCurveSwap({ pool, amountUi, swapBaseForQuote, slippageBps = 100 }) {
  const client = getDbcClient();
  const connection = getConnection();
  const poolPk = new PublicKey(pool);
  const virtualPool = await client.state.getPool(poolPk);
  if (!virtualPool) throw new Error("Launch not found on-chain");
  const poolConfig = await client.state.getPoolConfig(virtualPool.config);
  const currentPoint = await getCurrentPoint(connection, poolConfig.activationType);
  const q = quoteInfo(poolConfig);
  const decimalsIn = swapBaseForQuote ? poolConfig.tokenDecimal : q.decimals;
  const amountIn = new BN(Math.round(Number(amountUi) * 10 ** decimalsIn));
  const quote = client.pool.swapQuote2({
    virtualPool,
    config: poolConfig,
    swapBaseForQuote,
    swapMode: SwapMode.ExactIn,
    amountIn,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint,
    slippageBps,
  });
  const decimalsOut = swapBaseForQuote ? q.decimals : poolConfig.tokenDecimal;
  return { virtualPool, poolConfig, amountIn, quote, quoteSym: q.sym, outputUi: bnToUi(quote.outputAmount, decimalsOut) };
}

// swapBaseForQuote=false buys the launched token with the pool's quote token (USDC or the
// paired stock); true sells it back.
export async function swapOnCurve({ pool, amountUi, swapBaseForQuote, wallet, slippageBps = 100 }) {
  if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
  const client = getDbcClient();
  const { amountIn, quote } = await quoteCurveSwap({ pool, amountUi, swapBaseForQuote, slippageBps });
  const minimumAmountOut = quote.outputAmount.mul(new BN(10000 - slippageBps)).div(new BN(10000));
  const tx = await client.pool.swap2({
    owner: wallet.publicKey,
    pool: new PublicKey(pool),
    swapMode: SwapMode.ExactIn,
    amountIn,
    minimumAmountOut,
    swapBaseForQuote,
    referralTokenAccount: null,
  });
  const signature = await signSendConfirm(tx, wallet);
  return { signature, quote };
}

// Meteora's keeper migrates any pool automatically once its quote reserve
// crosses the threshold — this button doesn't race or replace that, it's here
// for the issuer to trigger it themselves (or confirm it already happened)
// rather than wait on the keeper. Locked/vesting allocations require a locker
// account to exist first, so that transaction runs before the migration itself
// whenever this launch has either kind of lockup.
export async function graduateLaunch({ pool, wallet }) {
  if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
  const client = getDbcClient();
  const poolPk = new PublicKey(pool);
  const status = await getLaunchStatus(pool);
  if (!status) throw new Error("Launch not found on-chain");
  if (status.isMigrated) throw new Error("Already migrated to DAMM v2");
  if (status.quoteProgress < 1) throw new Error("Hasn't reached its migration threshold yet");

  const record = getLaunches().find((l) => l.pool === pool);
  if (!record || record.hasTokenVesting || record.hasLpVesting) {
    const lockerTx = await client.migration.createLocker({ payer: wallet.publicKey, pool: poolPk });
    await signSendConfirm(lockerTx, wallet);
  }

  const dammConfig = DAMM_V2_MIGRATION_FEE_ADDRESS[status.poolConfig.migrationFeeOption];
  const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } = await client.migration.migrateToDammV2({
    payer: wallet.publicKey,
    pool: poolPk,
    dammConfig,
  });
  const signature = await signSendConfirm(transaction, wallet, [firstPositionNftKeypair, secondPositionNftKeypair]);
  markMigrated(pool);
  return { signature };
}

// --- Local registry of launches created through this app (no backend, same
// constraint as the rest of the admin dashboard — see customBaskets.js) ---
const REG_KEY = "stocklana_dbc_launches";
const listeners = new Set();

function loadLaunches() {
  try {
    const raw = JSON.parse(localStorage.getItem(REG_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

let launches = loadLaunches();

function persistLaunches() {
  try { localStorage.setItem(REG_KEY, JSON.stringify(launches)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}

export function getLaunches() {
  return launches;
}

export function useLaunches() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => launches,
  );
}

export function addLaunch(launch) {
  launches = [launch, ...launches.filter((l) => l.pool !== launch.pool)];
  persistLaunches();
}

export function markMigrated(pool) {
  launches = launches.map((l) => (l.pool === pool ? { ...l, migratedAt: Date.now() } : l));
  persistLaunches();
}

// The trader-facing list isn't sourced from localStorage — every visitor's
// browser independently asks Solana mainnet "which pools did the Stocklana
// admin wallet create?" via getPoolsByCreator, so a launch shows up for
// everyone the moment it lands on-chain, not just in the browser that created
// it. The local registry above only supplies a nicer name/symbol/logo when
// this browser happens to have them cached; a launch discovered on-chain but
// uncached still shows up, just labeled by its mint address.
// Which wallets count as issuers: the admin wallet, any extra addresses listed in
// VITE_LAUNCH_CREATORS (comma-separated), and any creator recorded in this browser.
export async function discoverLaunches() {
  const registry = getLaunches();
  const extra = (import.meta.env.VITE_LAUNCH_CREATORS || "").split(",").map((s) => s.trim());
  const creators = [...new Set([...ADMIN_WALLETS, ...extra, ...registry.map((l) => l.creator)].filter(Boolean))];
  if (!creators.length) return [];
  const client = getDbcClient();
  const results = await Promise.allSettled(creators.map((c) => client.state.getPoolsByCreator(c)));
  if (results.every((r) => r.status === "rejected")) throw results[0].reason;
  const seen = new Set();
  const accounts = results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((a) => !seen.has(a.publicKey.toBase58()) && seen.add(a.publicKey.toBase58()));
  return accounts.map(({ publicKey, account }) => {
    const pool = publicKey.toBase58();
    const cached = registry.find((l) => l.pool === pool);
    return {
      pool,
      baseMint: account.baseMint.toBase58(),
      config: account.config.toBase58(),
      isMigrated: Number(account.isMigrated) === 1,
      name: cached?.name || null,
      symbol: cached?.symbol || null,
      domain: cached?.domain || "",
    };
  });
}

// Wider Meteora activity beyond this app's own launches. There is no direct,
// fast way to list *pre-migration* DBC pools by any creator: Meteora publishes
// a pools API for DLMM but not DBC, and scanning the DBC program's own
// accounts directly (client.state.getPools(), no filter) takes well over a
// minute against a free-tier RPC and then fails outright — DBC runs at
// pump.fun-like scale, so an unfiltered on-chain scan is the wrong tool here.
// DexScreener's public search API is fast and free, but only indexes pools
// once they're real on-chain liquidity pools — i.e. only *after* a DBC pool
// graduates to DAMM v2 (labeled "DYN2"), not while still on the curve. That's
// a real, honest limitation: this shows recent graduations across all of
// Meteora, not "what's currently price-discovering," which only this app's
// own launches (above) can show.
export async function fetchMeteoraGraduatedPools(limit = 12) {
  const r = await fetch("https://api.dexscreener.com/latest/dex/search?q=meteora");
  if (!r.ok) throw new Error(`DexScreener ${r.status}: ${r.statusText}`);
  const j = await r.json();
  return (j.pairs || [])
    // External data going into an href/src: only accept real https DexScreener/CDN URLs.
    .filter((p) => p.dexId === "meteora" && p.labels?.includes("DYN2") && p.baseToken?.address && /^https:\/\/dexscreener\.com\//.test(p.url || ""))
    .sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0))
    .slice(0, limit)
    .map((p) => ({
      pairAddress: p.pairAddress,
      baseMint: p.baseToken.address,
      name: p.baseToken.name || p.baseToken.symbol,
      symbol: p.baseToken.symbol,
      logoUrl: /^https:\/\//.test(p.info?.imageUrl || "") ? p.info.imageUrl : null,
      priceUsd: p.priceUsd != null ? Number(p.priceUsd) : null,
      marketCapUsd: p.marketCap ?? p.fdv ?? null,
      liquidityUsd: p.liquidity?.usd ?? null,
      createdAt: p.pairCreatedAt || null,
      url: p.url,
    }));
}
