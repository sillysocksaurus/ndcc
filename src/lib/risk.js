// A short risk-tolerance quiz. Scores sum to 0-11 and map onto the four Robo portfolio tiers.
export const QUESTIONS = [
  {
    q: "When will you need this money?",
    options: [
      { label: "Within a year", v: 0 },
      { label: "1–3 years", v: 1 },
      { label: "3–7 years", v: 2 },
      { label: "7+ years", v: 3 },
    ],
  },
  {
    q: "Your portfolio drops 20% in a month. You:",
    options: [
      { label: "Sell everything", v: 0 },
      { label: "Sell some of it", v: 1 },
      { label: "Hold and wait it out", v: 2 },
      { label: "Buy more while it's cheap", v: 3 },
    ],
  },
  {
    q: "How would you describe your investing experience?",
    options: [
      { label: "New to investing", v: 0 },
      { label: "Some experience", v: 1 },
      { label: "Experienced", v: 2 },
    ],
  },
  {
    q: "What's the goal?",
    options: [
      { label: "Preserve what I have", v: 0 },
      { label: "Steady, reliable growth", v: 1 },
      { label: "Maximise long-term growth", v: 2 },
      { label: "Aggressive growth, higher risk", v: 3 },
    ],
  },
];

const TIERS = [
  { max: 2, id: "robo-conservative" },
  { max: 5, id: "robo-balanced" },
  { max: 8, id: "robo-growth" },
  { max: Infinity, id: "robo-aggressive" },
];

export function scoreToProfileId(score) {
  return TIERS.find((t) => score <= t.max).id;
}
