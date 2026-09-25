/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), surface: v("surface"), surface2: v("surface2"),
        ink: v("ink"), ink2: v("ink2"), muted: v("muted"),
        line: v("line"), line2: v("line2"),
        accent: v("accent"), "accent-ink": v("accent-ink"), "accent-soft": v("accent-soft"), cyan: v("cyan"),
        gain: v("gain"), "gain-soft": v("gain-soft"),
        loss: v("loss"), "loss-soft": v("loss-soft"),
        warn: v("warn"), "warn-soft": v("warn-soft"),
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"IBM Plex Sans"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
};
