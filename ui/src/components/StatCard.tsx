import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}

export function StatCard({ label, value, sub, color }: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={cn("mt-2 text-3xl font-bold tabular-nums", color ?? "text-white")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
