import React, { useState } from "react";
import { TOKENS, SERIES } from "@/data/xstocks";

// Real company logos via Google's favicon service (no key, fails cleanly with a 404
// for unknown domains). Index/commodity xStocks (SPYx, QQQx, GLDx) have no single
// issuing company, so they and any failed image fall back to a plain color swatch.
export default function TokenLogo({ sym, index = 0, size = 18, className = "" }) {
  const [failed, setFailed] = useState(false);
  const domain = TOKENS[sym]?.domain;
  const color = SERIES[index % SERIES.length];

  if (!domain || failed) {
    // Same outer box as the image, so a logo that fails to load never changes the row's size.
    return (
      <span className={`inline-grid place-items-center shrink-0 ${className}`} style={{ width: size, height: size }}>
        <span className="rounded-sm" style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5), background: color }} />
      </span>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      width={size}
      height={size}
      className={`rounded-full shrink-0 bg-surface2 object-contain p-[3px] ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
