import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const listeners = new Set();
let id = 0;
export function toast({ title, description }) {
  const t = { id: ++id, title, description };
  listeners.forEach((fn) => fn(t));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const on = (t) => {
      setItems((s) => [...s, t].slice(-3));
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 3200);
    };
    listeners.add(on);
    return () => listeners.delete(on);
  }, []);
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[84px] md:bottom-6 z-[80] flex flex-col gap-2 w-[min(520px,calc(100%-32px))] pointer-events-none" role="status" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="pointer-events-auto rounded-xl bg-ink text-bg px-4 py-3 shadow-2xl">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="text-xs opacity-75 mt-0.5">{t.description}</p>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
