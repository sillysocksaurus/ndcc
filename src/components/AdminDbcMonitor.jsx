import React, { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, GraduationCap } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useLaunches, getLaunchStatus, graduateLaunch, fmtQuote } from "@/lib/dbc";
import { shortMint } from "@/lib/stocklana";
import { toast } from "@/lib/toast";

const explorerUrl = (address) => `https://solscan.io/account/${address}`;

function ProgressBar({ pct }) {
  return (
    <div className="h-2 rounded-full bg-surface overflow-hidden">
      <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export default function AdminDbcMonitor() {
  const launches = useLaunches();
  const wallet = useWallet();
  const [statuses, setStatuses] = useState({});
  const [pendingPool, setPendingPool] = useState(null);

  const refresh = async (pool) => {
    setStatuses((s) => ({ ...s, [pool]: { ...s[pool], loading: true } }));
    try {
      const status = await getLaunchStatus(pool);
      setStatuses((s) => ({ ...s, [pool]: { ...status, loading: false } }));
    } catch (e) {
      setStatuses((s) => ({ ...s, [pool]: { error: e.message || String(e), loading: false } }));
    }
  };

  useEffect(() => {
    launches.forEach((l) => refresh(l.pool));
    // Only re-poll when the set of tracked launches changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launches.map((l) => l.pool).join(",")]);

  const graduate = async (pool) => {
    setPendingPool(pool);
    try {
      const r = await graduateLaunch({ pool, wallet });
      toast({ title: "Migrated to DAMM v2", description: `Signature ${r.signature.slice(0, 12)}… — now trades as a normal pool.` });
      refresh(pool);
    } catch (e) {
      toast({ title: "Migration failed", description: e.message || String(e) });
    } finally {
      setPendingPool(null);
    }
  };

  if (!launches.length) return null;

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">Your launches</h2>
      <div className="flex flex-col gap-2.5">
        {launches.map((l) => {
          const st = statuses[l.pool];
          const pct = st?.quoteProgress != null ? st.quoteProgress * 100 : null;
          return (
            <div key={l.pool} className="rounded-2xl bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-semibold text-ink">{l.name}</h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface2 text-muted font-medium">{l.symbol}</span>
                    {st?.isMigrated && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gain/15 text-gain font-medium">Migrated</span>}
                  </div>
                  <p className="text-[11.5px] text-muted mt-1 font-mono">{shortMint(l.pool)}</p>
                </div>
                <button type="button" onClick={() => refresh(l.pool)} disabled={st?.loading} className="w-8 h-8 shrink-0 rounded-full grid place-items-center text-muted hover:text-ink disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${st?.loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {st?.error && <p className="text-[12px] text-loss mt-2">{st.error}</p>}

              {st && !st.error && !st.isMigrated && (
                <div className="mt-3">
                  <div className="flex justify-between text-[12px] text-muted mb-1">
                    <span>{fmtQuote(st.quoteReserveUi, st.quoteSym)} raised</span>
                    <span>{fmtQuote(st.migrationThresholdUi, st.quoteSym)} to graduate</span>
                  </div>
                  <ProgressBar pct={pct} />
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[12px] text-muted">{pct != null ? pct.toFixed(1) : "…"}% of the way there</span>
                    <button
                      type="button"
                      onClick={() => graduate(l.pool)}
                      disabled={pendingPool === l.pool || pct == null || pct < 100}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold bg-accent text-accent-ink disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      {pendingPool === l.pool ? "Confirm in wallet…" : "Migrate to DAMM v2"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-3 text-[11.5px]">
                <a href={explorerUrl(l.pool)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent font-medium hover:brightness-110">Pool <ExternalLink className="w-3 h-3" /></a>
                <a href={explorerUrl(l.baseMint)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent font-medium hover:brightness-110">Mint <ExternalLink className="w-3 h-3" /></a>
                {(l.hasTokenVesting || l.hasLpVesting) && <span className="text-muted">Issuer allocation is vested with a cliff</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
