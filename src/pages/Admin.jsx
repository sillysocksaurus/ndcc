import React, { useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { loadAnalyticsConfig, saveAnalyticsConfig } from "@/lib/thirdPartyAnalytics";
import AdminAnalytics from "@/components/AdminAnalytics";
import AdminApiKeys from "@/components/AdminApiKeys";
import AdminBasketBuilder from "@/components/AdminBasketBuilder";
import AdminDbcLaunch from "@/components/AdminDbcLaunch";
import AdminDbcMonitor from "@/components/AdminDbcMonitor";
import { toast } from "@/lib/toast";

export default function Admin() {
  const wallet = useWallet();
  const isAdmin = useIsAdmin();
  const [config, setConfig] = useState(loadAnalyticsConfig);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl bg-surface p-7 text-center">
        <ShieldAlert className="w-6 h-6 text-muted mx-auto mb-2" />
        <h1 className="text-[17px] font-semibold text-ink">Admin access only</h1>
        <p className="text-[13.5px] text-muted mt-1 max-w-[42ch] mx-auto">
          {wallet.connected ? "This wallet isn't authorized." : "Connect the admin wallet to view this page."}
        </p>
      </div>
    );
  }

  const onSave = (e) => {
    e.preventDefault();
    const saved = saveAnalyticsConfig(config);
    setConfig(saved);
    toast({ title: "Analytics settings saved", description: "Applied immediately in this browser." });
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-accent" />
        <h1 className="text-[22px] font-semibold text-ink">Admin dashboard</h1>
      </div>
      <p className="text-ink2 mt-1.5 max-w-[60ch]">
        Unlocked because <code className="font-mono text-[12.5px] bg-surface2 px-1.5 py-0.5 rounded">{wallet.short}</code> matches the admin wallet. This is a client-side check only — there's no backend, so treat this as a convenience gate, not real access control.
      </p>

      <AdminApiKeys />

      <h2 className="text-[15px] font-semibold text-ink mt-7 mb-2.5">Third-party analytics</h2>
      <form onSubmit={onSave} className="rounded-2xl bg-surface p-4 sm:p-5 flex flex-col gap-4">
        <p className="text-[12.5px] text-muted -mt-1">
          Paste IDs from your own Google Analytics / Adobe Analytics accounts — this only wires them in, it doesn't create the accounts. Heads up: with no backend, this setting is saved in this browser only, so it tracks visits from this browser and does not reach other visitors. To track everyone, set the ID at build time or add a backend. Cover it in your privacy policy either way.
        </p>
        <div>
          <label htmlFor="ga-id" className="text-[12.5px] text-muted font-medium">Google Analytics 4 — Measurement ID</label>
          <input
            id="ga-id"
            value={config.gaId}
            onChange={(e) => setConfig((c) => ({ ...c, gaId: e.target.value }))}
            placeholder="G-XXXXXXXXXX"
            className="mt-1.5 w-full px-4 py-3 rounded-xl2 bg-surface2 text-ink font-mono text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <p className="text-[11.5px] text-muted mt-1">GA4 Admin → Data Streams → your stream → Measurement ID.</p>
        </div>
        <div>
          <label htmlFor="adobe-url" className="text-[12.5px] text-muted font-medium">Adobe Analytics / Launch — embed script URL</label>
          <input
            id="adobe-url"
            value={config.adobeUrl}
            onChange={(e) => setConfig((c) => ({ ...c, adobeUrl: e.target.value }))}
            placeholder="https://assets.adobedtm.com/.../launch-xxxx.min.js"
            className="mt-1.5 w-full px-4 py-3 rounded-xl2 bg-surface2 text-ink font-mono text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <p className="text-[11.5px] text-muted mt-1">Adobe Experience Platform Launch → your property → Environments → embed code. Must be an https:// URL.</p>
        </div>
        <div className="flex items-center gap-4 text-[12.5px]">
          <span className={`flex items-center gap-1.5 ${config.gaId ? "text-gain" : "text-muted"}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />GA4 {config.gaId ? "active" : "not configured"}</span>
          <span className={`flex items-center gap-1.5 ${config.adobeUrl ? "text-gain" : "text-muted"}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />Adobe {config.adobeUrl ? "active" : "not configured"}</span>
        </div>
        <button type="submit" className="w-full py-3 rounded-xl2 text-sm font-semibold bg-accent text-accent-ink hover:brightness-105">Save analytics settings</button>
      </form>
      <p className="text-[12.5px] text-muted mt-2">
        That's for wiring in your own GA4/Adobe accounts. NDCC's own lightweight usage tracking (sessions, funnels, basket opens) is separate from this, always on, and shown below.
      </p>

      <AdminAnalytics />

      <AdminDbcLaunch />
      <AdminDbcMonitor />
      <AdminBasketBuilder />
    </div>
  );
}
