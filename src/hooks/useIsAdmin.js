import { useWallet } from "@/hooks/useWallet";

// VITE_ADMIN_WALLET takes one address or several separated by commas.
export const ADMIN_WALLETS = (import.meta.env.VITE_ADMIN_WALLET || "").split(",").map((s) => s.trim()).filter(Boolean);
export const ADMIN_WALLET = ADMIN_WALLETS[0] || null;

// UI-visibility gate only — this app has no backend, so there is no real access
// control here. Anyone with devtools can inspect or alter client-side state.
export function useIsAdmin() {
  const { address } = useWallet();
  return !!address && ADMIN_WALLETS.includes(address);
}
