// Made-up "outlook" numbers used to show what a prediction would look like on each stock.
// Deterministic per symbol (so a stock always shows the same figure) and NOT derived from any
// model or data feed. Everything that displays these must label them as examples.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// Example move over the next month, in percent, roughly -6% to +8%.
export const examplePct = (sym) => -6 + hash("outlook:" + sym) * 14;

