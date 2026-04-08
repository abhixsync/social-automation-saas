export const dynamic = "force-dynamic";

import CountdownTimer from "./CountdownTimer";
import { resolveAppMode, MODE_CONFIG } from "@/lib/app-mode";

export default async function MaintenancePage() {
  // Phase 1: env-var only. Phase 2+: wire up DB SiteSetting lookup.
  const mode = resolveAppMode({});
  const config = MODE_CONFIG[mode];

  const title =
    process.env.APP_MODE_TITLE || config.defaultTitle || "Down for maintenance";
  const subtitle =
    process.env.APP_MODE_SUBTITLE ||
    config.defaultSubtitle ||
    "We'll be back shortly.";

  const until = process.env.MAINTENANCE_UNTIL || null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-6">
      <div className="max-w-md w-full flex flex-col items-center">
        <div className="mb-8">
          <span className="text-3xl font-bold text-white tracking-tight">
            Crescova
          </span>
        </div>
        {config.icon && (
          <span className="text-5xl mb-6" role="img" aria-label={mode}>
            {config.icon}
          </span>
        )}
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        <p className="text-slate-400 mt-3 text-base leading-relaxed">
          {subtitle}
        </p>
        {until && <CountdownTimer until={until} />}
        <p className="mt-12 text-xs text-slate-600">Crescova</p>
      </div>
    </div>
  );
}
