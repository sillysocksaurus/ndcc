import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function Disclosure({ label, openLabel, defaultOpen = false, children, className = "" }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink transition-colors"
      >
        {open ? (openLabel || label) : label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
