import React, { useEffect, useState } from "react";
import { isNyseOpen, nextNyseOpen } from "@/lib/stocklana";

export default function MarketClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  const open = isNyseOpen(now);
  const next = nextNyseOpen(now);
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted mb-5">
      <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-gain" : "bg-muted"}`} />
      <span title={open ? "NYSE regular session is open" : next ? `NYSE reopens ${next.toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : ""}>
        {open ? "Markets open" : "Markets closed"} · Solana always open
      </span>
    </div>
  );
}
