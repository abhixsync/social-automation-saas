// Server Component — do NOT add "use client".
// Reads x-app-mode request header forwarded by middleware and passes to AppModeBanner.
import { headers } from "next/headers";
import AppModeBanner from "./AppModeBanner";
import type { AppMode } from "@/lib/app-mode";

export default async function AppModeProvider() {
  const headersList = await headers();
  const mode = headersList.get("x-app-mode") as AppMode | null;
  if (!mode) return null;
  return <AppModeBanner mode={mode} />;
}
