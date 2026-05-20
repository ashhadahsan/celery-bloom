import { cn, stateBadge } from "@/lib/utils";

interface Props {
  state: string;
  className?: string;
}

export function StateBadge({ state, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        stateBadge(state),
        className
      )}
    >
      {state}
    </span>
  );
}
