import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STATE_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  FAILURE: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  STARTED: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
  RECEIVED: "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30",
  PENDING: "bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600/30",
  REVOKED: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30",
  RETRY: "bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30",
};

export function stateBadge(state: string) {
  return STATE_STYLES[state] ?? STATE_STYLES.PENDING;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(0).padStart(2, "0");
  return `${m}m ${s}s`;
}

export function fmtTime(ts: number | null | undefined): string {
  if (ts == null) return "—";
  return new Date(ts * 1000).toLocaleTimeString();
}

export function fmtDate(ts: number | null | undefined): string {
  if (ts == null) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export function shortId(id: string): string {
  return id.slice(0, 8) + "…";
}
