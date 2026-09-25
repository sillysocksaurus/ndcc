import { useCallback, useEffect, useState } from "react";
const KEY = "stocklana_theme";
export function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(KEY) || "dark"; } catch { return "dark"; } });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return { theme, toggle };
}
