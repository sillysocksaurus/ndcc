// Admin-configured third-party analytics (Google Analytics / Adobe Analytics).
// Config lives in localStorage only — this app has no backend to store it centrally,
// so it applies per-browser. Loaded once on app start and re-applied whenever the
// admin saves changes from the dashboard.
const KEY = "stocklana_analytics_config";
const GA_SCRIPT_ID = "stocklana-ga4-script";
const GA_INLINE_ID = "stocklana-ga4-inline";
const ADOBE_SCRIPT_ID = "stocklana-adobe-script";

export function loadAnalyticsConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return { gaId: raw?.gaId || "", adobeUrl: raw?.adobeUrl || "" };
  } catch {
    return { gaId: "", adobeUrl: "" };
  }
}

function removeById(id) {
  document.getElementById(id)?.remove();
}

function injectGA(gaId) {
  removeById(GA_SCRIPT_ID);
  removeById(GA_INLINE_ID);
  if (!gaId) return;
  const s = document.createElement("script");
  s.id = GA_SCRIPT_ID;
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.appendChild(s);

  const inline = document.createElement("script");
  inline.id = GA_INLINE_ID;
  inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(gaId)});`;
  document.head.appendChild(inline);
}

function injectAdobe(url) {
  removeById(ADOBE_SCRIPT_ID);
  if (!url || !/^https:\/\//i.test(url)) return; // only ever load https script URLs, never inline/js: strings
  const s = document.createElement("script");
  s.id = ADOBE_SCRIPT_ID;
  s.async = true;
  s.src = url;
  document.head.appendChild(s);
}

export function applyAnalyticsConfig(config) {
  injectGA(config?.gaId?.trim());
  injectAdobe(config?.adobeUrl?.trim());
}

export function saveAnalyticsConfig(config) {
  const clean = { gaId: config.gaId?.trim() || "", adobeUrl: config.adobeUrl?.trim() || "" };
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* ignore */ }
  applyAnalyticsConfig(clean);
  return clean;
}
