"use client";

import { useEffect, useState } from "react";
import type { AppMode } from "@/lib/app-mode";

interface Props {
  mode: AppMode;
}

const BANNER_CONFIG = {
  read_only: {
    bg: "bg-amber-500/25 border-amber-500/50",
    text: "text-amber-200",
    icon: "🔒",
    message: "Read-only mode — writes are temporarily disabled",
    borderLeft: "border-l-4 border-l-amber-400",
  },
  degraded: {
    bg: "bg-yellow-500/25 border-yellow-500/50",
    text: "text-yellow-200",
    icon: "⚠️",
    message: "Degraded mode — some features may be unavailable",
    borderLeft: "border-l-4 border-l-yellow-400",
  },
} as const;

export default function AppModeBanner({ mode }: Props) {
  const storageKey = `app_mode_banner_dismissed_${mode}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(storageKey)) setVisible(true);
  }, [storageKey]);

  const bannerCfg = BANNER_CONFIG[mode as keyof typeof BANNER_CONFIG];
  if (!visible || !bannerCfg) return null;

  function dismiss() {
    sessionStorage.setItem(storageKey, "1");
    setVisible(false);
  }

  return (
    <div
      className={`w-full border-b px-4 py-3 flex items-center justify-between text-sm ${bannerCfg.bg} ${bannerCfg.text} ${bannerCfg.borderLeft}`}
    >
      <span>
        <span className="mr-2">{bannerCfg.icon}</span>
        <span className="font-medium">{bannerCfg.message}</span>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="ml-4 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
