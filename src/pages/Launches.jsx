import React, { useEffect, useState } from "react";
import { Rocket, ExternalLink } from "lucide-react";
import LaunchBuySheet from "@/components/LaunchBuySheet";
import Disclosure from "@/components/Disclosure";
import { discoverLaunches, getLaunchStatus, fetchMeteoraGraduatedPools, fmtQuote } from "@/lib/dbc";
import { fmtUSD, shortMint } from "@/lib/stocklana";

// Shown only when no real launch exists yet, so the page isn't just an empty
// state — clearly badged "Example". Opens the same buy/sell sheet a real
// listing would (same wallet-required gate, same layout), but priced off a
// fixed made-up rate instead of a real curve, and "buying" never sends a
// transaction — see the `example` handling in LaunchBuySheet. Fictional
// companies on purpose, not real ones, so nothing here could be mistaken for
// an actual listing.
const EXAMPLE_LAUNCHES = [
  { pool: "example-1", baseMint: "ExampLeMint1111111111111111111111111111111", name: "Nova Robotics (Example)", symbol: "NOVAx", isMigrated: false, example: true, examplePriceUsd: 0.0021 },
  { pool: "example-2", baseMint: "ExampLeMint2222222222222222222222222222222", name: "Meridian Health (Example)", symbol: "MRDx", isMigrated: false, example: true, examplePriceUsd: 0.000018, quoteSym: "SPYx" }, // priced in SPYx (≈ $0.0138)
  { pool: "example-3", baseMint: "ExampLeMint3333333333333333333333333333333", name: "Atlas Energy (Example)", symbol: "ATLx", isMigrated: true, example: true, examplePriceUsd: 0.0412 },
];
const EXAMPLE_STATUS = {
  "example-1": { quoteProgress: 0.08, quoteSym: "USDC", quoteReserveUi: 4200, migrationThresholdUi: 500000 },
  "example-2": { quoteProgress: 0.47, quoteSym: "SPYx", quoteReserveUi: 235, migrationThresholdUi: 500 },
  "example-3": { quoteProgress: 1, quoteSym: "USDC", quoteReserveUi: 500000, migrationThresholdUi: 500000 },
};

function LaunchLogo({ domain, symbol }) {
  const [failed, setFailed] = useState(false);
  if (!domain || failed) {
    return <span className="w-10 h-10 rounded-full bg-surface2 grid place-items-center text-[13px] font-semibold text-muted shrink-0">{(symbol || "?").slice(0, 2).toUpperCase()}</span>;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt="" width={40} height={40}
      className="rounded-full shrink-0 bg-surface2 object-contain p-1.5"
      onError={() => setFailed(true)} loading="lazy"
    />
  );
}

function LaunchCard({ launch, status, onOpen }) {
  const pct = status?.quoteProgress != null ? status.quoteProgress * 100 : null;
  return (
    <button type="button" onClick={() => onOpen(launch)} className="w-full text-left rounded-2xl bg-surface p-4 sm:p-5 hover:bg-surface2 transition-colors active:scale-[.995]">
      <div className="flex items-center gap-3">
        <LaunchLogo domain={launch.domain} symbol={launch.symbol} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold text-ink truncate">{launch.name || shortMint(launch.baseMint)}</h3>
          <p className="text-[12.5px] text-muted font-mono">{launch.symbol || shortMint(launch.baseMint)}</p>
        </div>
        {launch.example && <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface2 text-muted font-medium shrink-0">Example</span>}
        {launch.isMigrated && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gain/15 text-gain font-medium shrink-0">Graduated</span>}
      </div>
      {!launch.isMigrated && (
        <div className="mt-3">
          <div className="h-2 rounded-full bg-surface2 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} /></div>
          <p className="mt-1.5 text-[12px] text-muted">
            {pct != null ? `${pct.toFixed(1)}% to graduation` : "Loading curve…"}
            {status?.quoteReserveUi != null && ` · ${fmtQuote(status.quoteReserveUi, status.quoteSym)} raised`}
          </p>
        </div>
      )}
    </button>
  );
}

function MeteoraPoolCard({ pool }) {
  const [failed, setFailed] = useState(false);
  return (
    <a href={pool.url} target="_blank" rel="noreferrer" className="w-full text-left rounded-2xl bg-surface p-4 sm:p-5 hover:bg-surface2 transition-colors active:scale-[.995] flex items-center gap-3">
      {pool.logoUrl && !failed ? (
        <img src={pool.logoUrl} alt="" width={40} height={40} className="rounded-full shrink-0 bg-surface2 object-cover" onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <span className="w-10 h-10 rounded-full bg-surface2 grid place-items-center text-[13px] font-semibold text-muted shrink-0">{(pool.symbol || "?").slice(0, 2).toUpperCase()}</span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-ink truncate">{pool.name}</h3>
        <p className="text-[12px] text-muted">
          {pool.priceUsd != null && fmtUSD(pool.priceUsd, pool.priceUsd < 1 ? 6 : 2)}
          {pool.marketCapUsd != null && ` · ${fmtUSD(pool.marketCapUsd, 0)} mcap`}
        </p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted shrink-0" />
    </a>
  );
}

export default function Launches() {
  const [launches, setLaunches] = useState(null); // null = still loading
  const [statuses, setStatuses] = useState({});
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);
  const [meteoraPools, setMeteoraPools] = useState(null);
  const [meteoraError, setMeteoraError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const list = await discoverLaunches();
      setLaunches(list);
      const entries = await Promise.all(list.map(async (l) => [l.pool, await getLaunchStatus(l.pool).catch(() => null)]));
      setStatuses(Object.fromEntries(entries));
    } catch (e) {
      setError(e.message || String(e));
      setLaunches([]);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetchMeteoraGraduatedPools()
      .then(setMeteoraPools)
      .catch((e) => { setMeteoraError(e.message || String(e)); setMeteoraPools([]); });
  }, []);

  const active = (launches || []).filter((l) => !l.isMigrated);
  const graduated = (launches || []).filter((l) => l.isMigrated);

  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight flex items-center gap-2"><Rocket className="w-6 h-6 text-accent" />New listings</h1>
      <p className="text-ink2 mt-2 max-w-[60ch]">
        Tokenized stocks launching through a Meteora Dynamic Bonding Curve — real USDC price discovery before a
        stock graduates to a regular pool. This list is read straight from Solana mainnet, not a database, so it's
        the same for every visitor.
      </p>

      {error && <p className="text-loss text-sm mt-4">{error}</p>}
      {launches === null ? (
        <div className="mt-6 flex flex-col gap-3" aria-busy="true" aria-label="Reading mainnet">
          {[0, 1, 2].map((i) => <div key={i} className="h-[118px] rounded-2xl bg-surface animate-pulse" />)}
        </div>
      ) : launches.length === 0 ? (
        <>
          <p className="text-muted text-[12.5px] mt-6">No real launches yet — here's what one looks like once it's live:</p>
          <div className="flex flex-col gap-3 mt-2.5">
            {EXAMPLE_LAUNCHES.map((l) => <LaunchCard key={l.pool} launch={l} status={EXAMPLE_STATUS[l.pool]} onOpen={setOpen} />)}
          </div>
        </>
      ) : (
        <>
          {active.length > 0 && <div className="flex flex-col gap-3 mt-6">{active.map((l) => <LaunchCard key={l.pool} launch={l} status={statuses[l.pool]} onOpen={setOpen} />)}</div>}
          {graduated.length > 0 && (
            <>
              <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">Graduated</h2>
              <div className="flex flex-col gap-3">{graduated.map((l) => <LaunchCard key={l.pool} launch={l} status={statuses[l.pool]} onOpen={setOpen} />)}</div>
            </>
          )}
        </>
      )}

      <h2 className="text-[15px] font-semibold text-ink mt-8 mb-1">Live on Meteora</h2>
      <p className="text-[12px] text-muted mb-2.5">
        Recently-graduated pools from across all of Meteora, not just NDCC — sourced from DexScreener, since DBC
        pools still on the curve aren't indexed anywhere fast enough to list here. Not launched through NDCC;
        trading opens DexScreener in a new tab.
      </p>
      {meteoraError && <p className="text-loss text-sm">{meteoraError}</p>}
      {meteoraPools === null ? (
        <div className="grid sm:grid-cols-2 gap-3" aria-busy="true" aria-label="Loading">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[74px] rounded-2xl bg-surface animate-pulse" />)}
        </div>
      ) : meteoraPools.length === 0 ? (
        !meteoraError && <p className="text-muted text-sm py-4">Nothing found right now.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">{meteoraPools.map((p) => <MeteoraPoolCard key={p.pairAddress} pool={p} />)}</div>
      )}

      <Disclosure label="How a launch works" className="mt-8">
        <p className="text-xs text-muted leading-relaxed">
          Every listing here is a Meteora Dynamic Bonding Curve pool: price rises along a fixed curve as more USDC
          comes in, with no order book and no counterparty needed. Trading fees start high and decay over the
          first several days to discourage minute-one flipping, and the issuer's own token and post-migration
          liquidity allocation are vested with a cliff by default — verify that yourself on-chain rather than take
          our word for it. Once a pool crosses its graduation market cap, it migrates permanently to a normal
          Meteora DAMM v2 pool. Trading here signs and sends a real transaction; there is no simulated mode.
        </p>
      </Disclosure>

      <LaunchBuySheet launch={open} status={open ? (open.example ? EXAMPLE_STATUS[open.pool] : statuses[open.pool]) : null} onClose={() => setOpen(null)} onTraded={load} />
    </div>
  );
}
