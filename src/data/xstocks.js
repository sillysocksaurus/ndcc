// Tokenized stocks on Solana mainnet (Backed xStocks, vanity mint prefix "Xs…").
// Prices and pool liquidity are a Jupiter Token API snapshot; useStocklana() refreshes
// prices live from the Jupiter Price API v3 when the network allows it.

export const SNAPSHOT_ISO = "2026-09-13T20:13:58Z";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOL_MINT = "So11111111111111111111111111111111111111112"; // native SOL's wrapped mint address
export const XSTOCK_DECIMALS = 8;
export const USDC_DECIMALS = 6;
export const SOL_DECIMALS = 9;

export const TOKENS = {
  SPYx:  { name: "SP500 xStock",             sector: "Index",          mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", price: 762.62,  liq: 4057632, venue: "Raydium CLMM" },
  QQQx:  { name: "Nasdaq xStock",            sector: "Index",          mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", price: 708.45,  liq: 1707199, venue: "Raydium CLMM" },
  GLDx:  { name: "Gold xStock",              sector: "Commodity",      mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", price: 398.58,  liq: 327156,  venue: "Raydium CLMM" },
  NVDAx: { name: "NVIDIA xStock",            sector: "Semis",          mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", price: 214.82,  liq: 1857679, venue: "Raydium CLMM", domain: "nvidia.com" },
  TSLAx: { name: "Tesla xStock",             sector: "Autos",          mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", price: 361.70,  liq: 1256603, venue: "Raydium CLMM", domain: "tesla.com" },
  AAPLx: { name: "Apple xStock",             sector: "Hardware",       mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", price: 330.00,  liq: 810652,  venue: "Raydium CLMM", domain: "apple.com" },
  MSFTx: { name: "Microsoft xStock",         sector: "Software",       mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", price: 492.14,  liq: 438438,  venue: "Raydium CLMM", domain: "microsoft.com" },
  GOOGLx:{ name: "Alphabet xStock",          sector: "Internet",       mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", price: 336.80,  liq: 343932,  venue: "Raydium CLMM", domain: "abc.xyz" },
  AMZNx: { name: "Amazon xStock",            sector: "Internet",       mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", price: 253.54,  liq: 190309,  venue: "Raydium CLMM", domain: "amazon.com" },
  METAx: { name: "Meta xStock",              sector: "Internet",       mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", price: 642.11,  liq: 229166,  venue: "Raydium CLMM", domain: "meta.com" },
  AVGOx: { name: "Broadcom xStock",          sector: "Semis",          mint: "XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo", price: 399.22,  liq: 58763,   venue: "Jupiter route", domain: "broadcom.com" },
  AMDx:  { name: "AMD xStock",               sector: "Semis",          mint: "XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF", price: 481.61,  liq: 3074,    venue: "Manifest order book", domain: "amd.com" },
  PLTRx: { name: "Palantir xStock",          sector: "Software",       mint: "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4", price: 165.22,  liq: 181058,  venue: "Raydium CLMM", domain: "palantir.com" },
  JNJx:  { name: "Johnson & Johnson xStock", sector: "Healthcare",     mint: "XsGVi5eo1Dh2zUpic4qACcjuWGjNv8GCt3dm5XcX6Dn", price: 253.71,  liq: 42,      venue: "Manifest order book", domain: "jnj.com" },
  KOx:   { name: "Coca-Cola xStock",         sector: "Staples",        mint: "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ", price: 87.12,   liq: 97839,   venue: "Jupiter route", domain: "coca-colacompany.com" },
  PEPx:  { name: "PepsiCo xStock",           sector: "Staples",        mint: "Xsv99frTRUeornyvCfvhnDesQDWuvns1M852Pez91vF", price: 136.93,  liq: 5364,    venue: "Manifest order book", domain: "pepsico.com" },
  XOMx:  { name: "Exxon Mobil xStock",       sector: "Energy",         mint: "XsaHND8sHyfMfsWPj6kSdd5VwvCayZvjYgKmmcNL5qh", price: 160.82,  liq: 17083,   venue: "Raydium CLMM", domain: "exxonmobil.com" },
  JPMx:  { name: "JPMorgan Chase xStock",    sector: "Financials",     mint: "XsMAqkcKsUewDrzVkait4e5u4y8REgtyS7jWgCpLV2C", price: 354.90,  liq: 896,     venue: "Manifest order book", domain: "jpmorganchase.com" },
  MCDx:  { name: "McDonald's xStock",        sector: "Consumer",       mint: "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2", price: 253.09,  liq: 323276,  venue: "Raydium CLMM", domain: "mcdonalds.com" },
  COINx: { name: "Coinbase xStock",          sector: "Crypto finance", mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", price: 172.92,  liq: 340795,  venue: "Raydium CLMM", domain: "coinbase.com" },
  MSTRx: { name: "MicroStrategy xStock",     sector: "Crypto finance", mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", price: 130.01,  liq: 752377,  venue: "Raydium CLMM", domain: "strategy.com" },
  HOODx: { name: "Robinhood xStock",         sector: "Financials",     mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", price: 109.44,  liq: 360599,  venue: "Raydium CLMM", domain: "robinhood.com" },
  CRCLx: { name: "Circle xStock",            sector: "Crypto finance", mint: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1", price: 90.48,   liq: 2023651, venue: "Raydium CLMM", domain: "circle.com" },
  LLYx:  { name: "Eli Lilly xStock",         sector: "Healthcare",     mint: "Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH", price: 1109.39, liq: 3940,    venue: "Manifest order book", domain: "lilly.com" },

  // Tessera T-Tokens: tokenized exposure to private, pre-IPO companies, tradable on
  // Solana DEXs (Meteora, Jupiter). 9 decimals (checked on-chain), unlike xStocks' 8.
  // `mark` comes live from Tessera's public API (see lib/tessera.js); price/liq are a
  // Jupiter snapshot. Remove the `group: "Pre-IPO"` entries to drop the family entirely.
  tOpenAI: { name: "OpenAI T-Token",  sector: "Artificial Intelligence", mint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ", price: 1038.24, liq: 504797, venue: "Meteora / Jupiter", domain: "openai.com", decimals: 9, group: "Pre-IPO", issuer: "Tessera" },
  tKalshi: { name: "Kalshi T-Token",  sector: "Prediction Markets",     mint: "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ", price: 447.14,  liq: 193716, venue: "Meteora / Jupiter", domain: "kalshi.com", decimals: 9, group: "Pre-IPO", issuer: "Tessera" },
  tSpaceX: { name: "SpaceX T-Token",  sector: "Aerospace",              mint: "TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v", price: 563.37,  liq: 117005, venue: "Meteora / Jupiter", domain: "spacex.com", decimals: 9, group: "Pre-IPO", issuer: "Tessera" },
  // PreStocks: tokenized pre-IPO stocks (each backed 1:1 by SPV exposure), 9 decimals, tradable through Jupiter.
  // Snapshot prices/liquidity from Jupiter; live prices and reference valuations refresh from Jupiter and the PreStocks API.
  pAnthropic: { name: "Anthropic PreStocks", sector: "Artificial Intelligence", mint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw", price: 1052.74, liq: 872094, venue: "Jupiter", domain: "anthropic.com", decimals: 9, group: "Pre-IPO", issuer: "PreStocks", psId: "anthropic" },
  pOpenAI: { name: "OpenAI PreStocks", sector: "Artificial Intelligence", mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", price: 1335.23, liq: 826650, venue: "Jupiter", domain: "openai.com", decimals: 9, group: "Pre-IPO", issuer: "PreStocks", psId: "openai" },
  pSpaceX: { name: "SpaceX PreStocks", sector: "Aerospace", mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh", price: 117.47, liq: 111319, venue: "Jupiter", domain: "spacex.com", decimals: 9, group: "Pre-IPO", issuer: "PreStocks", psId: "spacex" },
  pAnduril: { name: "Anduril PreStocks", sector: "Defense", mint: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB", price: 164.95, liq: 451666, venue: "Jupiter", domain: "anduril.com", decimals: 9, group: "Pre-IPO", issuer: "PreStocks", psId: "anduril" },
  pFigureAI: { name: "Figure AI PreStocks", sector: "Robotics", mint: "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd", price: 176.72, liq: 100761, venue: "Jupiter", domain: "figure.ai", decimals: 9, group: "Pre-IPO", issuer: "PreStocks", psId: "figureai" },
  pNeuralink: { name: "Neuralink PreStocks", sector: "Neurotech", mint: "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S", price: 446.64, liq: 245762, venue: "Jupiter", domain: "neuralink.com", decimals: 9, group: "Pre-IPO", issuer: "PreStocks", psId: "neuralink" },
  pKalshi: { name: "Kalshi PreStocks", sector: "Prediction Markets", mint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua", price: 881.50, liq: 99666, venue: "Jupiter", domain: "kalshi.com", decimals: 9, group: "Pre-IPO", issuer: "PreStocks", psId: "kalshi" },
  pPolymarket: { name: "Polymarket PreStocks", sector: "Prediction Markets", mint: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP", price: 152.52, liq: 198618, venue: "Jupiter", domain: "polymarket.com", decimals: 9, group: "Pre-IPO", issuer: "PreStocks", psId: "polymarket" },
};

// Weighted baskets. Weights are percentages and sum to 100.
export const BASKETS = [
  { id: "core",     name: "Core Three",        theme: "Index",     thesis: "The boring portfolio, on-chain: S&P 500, Nasdaq-100 and gold in a 60/30/10 split.",                         legs: [["SPYx", 60], ["QQQx", 30], ["GLDx", 10]] },
  { id: "mag7",     name: "Magnificent 7",     theme: "Megacaps",  thesis: "Equal-weight the seven megacaps. Rebalance quarterly so winners don't swallow the basket.",                    legs: [["AAPLx", 14.3], ["MSFTx", 14.3], ["GOOGLx", 14.3], ["AMZNx", 14.3], ["NVDAx", 14.3], ["METAx", 14.3], ["TSLAx", 14.2]] },
  { id: "ai",       name: "AI Infrastructure", theme: "Tech",      thesis: "Chips, hyperscalers and the software layer that sells compute.",                                                legs: [["NVDAx", 30], ["AVGOx", 20], ["AMDx", 15], ["MSFTx", 15], ["GOOGLx", 10], ["PLTRx", 10]] },
  { id: "div",      name: "Dividend Payers",   theme: "Income",    thesis: "Six long-running dividend names. Pools are thin on-chain today, so bigger buys see high price impact.",          legs: [["JNJx", 20], ["KOx", 20], ["PEPx", 15], ["XOMx", 15], ["JPMx", 15], ["MCDx", 15]] },
  { id: "cryptoeq", name: "Crypto Equities",   theme: "Crypto",    thesis: "Public companies whose earnings move with crypto: exchanges, treasuries, stablecoin issuers.",                   legs: [["COINx", 30], ["MSTRx", 30], ["HOODx", 20], ["CRCLx", 20]] },
  { id: "semis",    name: "Semiconductors",    theme: "Tech",      thesis: "The chipmakers behind every AI buildout, without the hyperscalers on top.",                                       legs: [["NVDAx", 40], ["AVGOx", 35], ["AMDx", 25]] },
  { id: "cloud",    name: "Cloud & Software",  theme: "Tech",      thesis: "Enterprise software and cloud infrastructure, minus the chipmakers underneath.",                                  legs: [["MSFTx", 30], ["GOOGLx", 25], ["AMZNx", 25], ["PLTRx", 20]] },
  { id: "defensive",name: "Healthcare & Staples", theme: "Defensive", thesis: "Drugs, soda and fast food — demand that doesn't care what the market's doing.",                                 legs: [["JNJx", 25], ["LLYx", 25], ["KOx", 20], ["PEPx", 15], ["MCDx", 15]] },
  { id: "prestocks", name: "PreStocks Frontier", theme: "Pre-IPO",   thesis: "The frontier-tech private companies as PreStocks tokens: Anthropic, OpenAI, SpaceX, Anduril and Figure AI. Volatile, thinly traded, high risk.", legs: [["pAnthropic", 30], ["pOpenAI", 25], ["pSpaceX", 20], ["pAnduril", 15], ["pFigureAI", 10]] },
  { id: "private",   name: "Private Markets",   theme: "Pre-IPO",   thesis: "Exposure to the biggest private companies, before they list: OpenAI, SpaceX and Kalshi as Tessera T-Tokens. Volatile, thinly traded, high risk.", legs: [["tOpenAI", 40], ["tSpaceX", 30], ["tKalshi", 30]] },
  { id: "fintech",  name: "Fintech Disruptors",theme: "Financials",thesis: "Banking's old guard next to the exchanges and apps trying to replace it.",                                         legs: [["JPMx", 30], ["HOODx", 25], ["COINx", 25], ["CRCLx", 20]] },
];

// Risk-tiered model portfolios for the Robo flow. Same shape as BASKETS (id/name/thesis/legs)
// so they plug straight into the existing buy / plan / rebalance machinery.
export const ROBO_PORTFOLIOS = [
  { id: "robo-conservative", name: "Conservative", risk: 1, thesis: "Priority on stability: broad index, gold and steady dividend payers.", legs: [["SPYx", 35], ["GLDx", 25], ["JNJx", 15], ["KOx", 15], ["XOMx", 10]] },
  { id: "robo-balanced",     name: "Balanced",     risk: 2, thesis: "A mix of growth and stability for a smoother ride.",                    legs: [["SPYx", 35], ["QQQx", 20], ["AAPLx", 15], ["GLDx", 10], ["JNJx", 10], ["KOx", 10]] },
  { id: "robo-growth",       name: "Growth",       risk: 3, thesis: "Tilted toward tech and megacaps for long-term growth.",                 legs: [["QQQx", 30], ["NVDAx", 15], ["MSFTx", 15], ["GOOGLx", 15], ["AAPLx", 15], ["GLDx", 10]] },
  { id: "robo-aggressive",   name: "Aggressive",   risk: 4, thesis: "Concentrated in high-growth tech and crypto-linked equities.",           legs: [["NVDAx", 25], ["AVGOx", 15], ["PLTRx", 10], ["MSTRx", 15], ["COINx", 15], ["TSLAx", 10], ["HOODx", 10]] },
];

// Every investable portfolio, manual or robo — used wherever holdings need to resolve back to weights/names.
export const ALL_PORTFOLIOS = [...BASKETS, ...ROBO_PORTFOLIOS];

// Categorical series colours (validated palette, dark-surface steps). Fixed order, never cycled per render.
export const SERIES = ["#a855f7", "#22d3ee", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#fb923c", "#f87171"];

export const LP_FEE = 0.0005;      // typical xStocks CLMM fee tier
export const NET_FEE_USD = 0.02;   // ~priority fee per swap
export const GUARD_BPS = 50;       // legs above this estimated impact get sliced
export const MIN_ORDER_USD = 5;

export const CADENCE = {
  once:     { label: "Once",         per: "",                 ms: 0,            seconds: 0,       perMonth: 0 },
  weekly:   { label: "Weekly",       per: " per week",        ms: 7 * 864e5,    seconds: 604800,  perMonth: 52 / 12 },
  biweekly: { label: "Every 2 wks",  per: " every 2 weeks",   ms: 14 * 864e5,   seconds: 1209600, perMonth: 26 / 12 },
  monthly:  { label: "Monthly",      per: " per month",       ms: 30 * 864e5,   seconds: 2592000, perMonth: 1 },
};
