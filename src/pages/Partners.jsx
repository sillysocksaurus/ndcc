import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Handshake } from "lucide-react";

const STATUS = {
  built: { label: "Built", cls: "bg-gain-soft text-gain" },
  partly: { label: "Partly built", cls: "bg-warn-soft text-warn" },
  none: { label: "Not used in this build", cls: "bg-surface2 text-muted" },
};

// Descriptions come from the hackathon bounty pages; "what NDCC does" is what is actually in the app.
const PARTNERS = [
  {
    name: "Meteora",
    bounty: "Best Use of Meteora DBC",
    blurb: "Meteora's Dynamic Bonding Curve is a fully configurable token launch primitive: curve shape, fee schedule, quote token, graduation threshold, and migration into DAMM v2 liquidity.",
    status: "built",
    does: [
      "Issuer console that builds and launches a stock on a DBC curve, and a monitor that tracks graduation and migrates the pool.",
      "Quote token can be USDC or a tokenized stock (SPYx, QQQx, NVDAx, TSLAx) for stock-paired pools.",
      "Trading fee that decays after launch, an issuer royalty, a vested issuer allocation and locked liquidity.",
      "Launches page to buy or sell directly on the curve before it graduates.",
    ],
    links: [["DBC developer guide", "https://docs.meteora.ag/developer-guides/dbc"], ["TypeScript SDK", "https://github.com/MeteoraAg/dynamic-bonding-curve-sdk"], ["Docs MCP server", "https://docs.meteora.ag/mcp"], ["meteora.ag", "https://www.meteora.ag"]],
    route: ["/launches", "See launches"],
  },
  {
    name: "Tessera",
    bounty: "Best Use of Tessera, Pre-IPO stocks",
    blurb: "Private equities for everyone: trade SpaceX, OpenAI and Kalshi tokens permissionlessly on DEXs, with no KYC and no minimums.",
    status: "built",
    does: [
      "OpenAI, Kalshi and SpaceX T-Tokens are tradable on Trade (Pre-IPO filter) through Jupiter.",
      "A live premium or discount to reference price is shown, since these pools are thin.",
      "A Private Markets basket buys all three in one tap.",
    ],
    links: [["Documentation", "https://docs.tessera.pe"], ["Product API", "https://rest-api.tessera.pe/v1/public/token-details"], ["Website", "https://app.tessera.pe"], ["X", "https://x.com/tessera_pe"]],
    route: ["/trade", "Open Trade"],
  },
  {
    name: "ClawPump",
    bounty: "Stocknized Agent on ClawPump",
    blurb: "Launch, fund and trade autonomous AI agents onchain. The bounty asks for a token launched with a stock-paired liquidity pool using ClawPump and Meteora.",
    status: "partly",
    does: [
      "Create a token: anyone can launch a token through ClawPump, paying the launch fee from their own wallet.",
      "A server relay keeps the secret key off the browser, and the payment address and amount are checked before anything is paid.",
      "Stock-paired pools are built separately on the Meteora side and are not yet joined to this flow.",
    ],
    links: [["clawpump.tech", "https://clawpump.tech"], ["X", "https://x.com/clawpumptech"]],
    route: ["/create", "Create a token"],
  },
  {
    name: "PreStocks",
    bounty: "Best Use of PreStocks",
    blurb: "Tokenized pre-IPO stocks, each backed 1:1 by SPV exposure to a private company. Projects that integrate any non-PreStocks pre-IPO tokens are ineligible for this bounty.",
    status: "built",
    does: [
      "Eight PreStocks tokens are tradable on Trade (Anthropic, OpenAI, SpaceX, Anduril, Figure AI, Neuralink, Kalshi, Polymarket), swapped through Jupiter.",
      "Each expands to show the company description, PreStocks' reference valuation, the valuation implied by the token price, and supply, read from the PreStocks API through a small server relay.",
      "A live premium or discount to PreStocks' reference price, and a PreStocks Frontier basket that buys five of them in one tap.",
      "Note: NDCC also lists Tessera tokens. The PreStocks bounty excludes projects that integrate other pre-IPO tokens, so NDCC can enter only one of the two.",
    ],
    route: ["/trade", "Open Trade"],
    links: [["API", "https://prestocks.com/api/prestocks"], ["Products", "https://prestocks.com/products"], ["X", "https://x.com/PreStocks"]],
  },
];

export default function Partners() {
  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight flex items-center gap-2"><Handshake className="w-6 h-6 text-accent" />Built with</h1>
      <p className="text-ink2 mt-2 max-w-[62ch]">NDCC was built for the Stocklana hackathon on Solana. These are the sponsors' programs, what each one is about, and exactly what NDCC does with it today.</p>

      <div className="mt-6 flex flex-col gap-3">
        {PARTNERS.map((p) => {
          const st = STATUS[p.status];
          return (
            <section key={p.name} className="rounded-2xl bg-surface p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">{p.name}</h2>
                  <p className="text-[12.5px] text-accent font-medium">{p.bounty}</p>
                </div>
                <span className={`shrink-0 text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
              </div>
              <p className="text-[13px] text-ink2 mt-2.5 leading-relaxed">{p.blurb}</p>
              <p className="text-[12px] text-muted font-medium mt-3.5 mb-1">What NDCC does</p>
              <ul className="text-[13px] text-ink2 list-disc pl-4 flex flex-col gap-1">{p.does.map((d) => <li key={d}>{d}</li>)}</ul>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5">
                {p.route && <Link to={p.route[0]} className="px-3.5 py-2 rounded-xl2 text-[13px] font-semibold bg-accent text-accent-ink hover:brightness-110">{p.route[1]}</Link>}
                {p.links.map(([l, href]) => (
                  <a key={href} href={href} target="_blank" rel="noreferrer" className="text-[12.5px] text-accent font-medium inline-flex items-center gap-1 hover:brightness-110">{l}<ExternalLink className="w-3 h-3" /></a>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
