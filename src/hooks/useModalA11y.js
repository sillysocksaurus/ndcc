import { useEffect } from "react";

// Shared behavior for bottom sheets and dialogs: Escape closes, and the page behind
// doesn't scroll while one is open. Restores the previous scroll setting on close.
export function useModalA11y(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
}
