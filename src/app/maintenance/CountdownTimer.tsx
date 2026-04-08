"use client";

import { useEffect, useState } from "react";

interface Props {
  until: string; // UTC ISO 8601, e.g. "2026-04-02T18:00:00Z"
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function CountdownTimer({ until }: Props) {
  const target = new Date(until).getTime();
  const [diff, setDiff] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    if (target <= Date.now()) return;
    const id = setInterval(() => {
      setDiff(Math.max(0, target - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (diff === 0) {
    return (
      <p className="text-slate-400 text-sm mt-6">We&apos;re almost back…</p>
    );
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="mt-8 flex items-end gap-3">
      {[
        { value: pad(hours), label: "hours" },
        { value: pad(minutes), label: "mins" },
        { value: pad(seconds), label: "secs" },
      ].map(({ value, label }, i) => (
        <div key={label} className="flex items-end gap-3">
          {i > 0 && (
            <span className="text-slate-500 text-3xl font-light mb-3">:</span>
          )}
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white tabular-nums">
              {value}
            </span>
            <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
