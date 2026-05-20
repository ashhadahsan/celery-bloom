import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StateBadge } from "./Badge";
import { fmtDuration, fmtTime } from "@/lib/utils";
import type { GraphNode } from "@/lib/api";

const STATE_RING: Record<string, string> = {
  SUCCESS: "ring-emerald-500/40",
  FAILURE: "ring-red-500/40",
  STARTED: "ring-blue-500/40",
  RECEIVED: "ring-yellow-500/40",
  RETRY: "ring-purple-500/40",
  REVOKED: "ring-orange-500/40",
  PENDING: "ring-zinc-600/40",
};

// Build the ordered timeline of states a task has passed through
function getStateTimeline(task: GraphNode): { state: string; ts: number | null }[] {
  const steps: { state: string; ts: number | null }[] = [];
  if (task.received != null)  steps.push({ state: "RECEIVED",  ts: task.received });
  if (task.started != null)   steps.push({ state: "STARTED",   ts: task.started });
  if (task.retried != null)   steps.push({ state: "RETRY",     ts: task.retried });
  if (task.succeeded != null) steps.push({ state: "SUCCESS",   ts: task.succeeded });
  if (task.failed != null)    steps.push({ state: "FAILURE",   ts: task.failed });
  if (task.revoked != null)   steps.push({ state: "REVOKED",   ts: task.revoked });
  // If nothing recorded yet, show current state as pending
  if (steps.length === 0)     steps.push({ state: task.state,  ts: null });
  return steps;
}

export const TaskNode = memo(({ data }: NodeProps) => {
  const task = data as unknown as GraphNode;
  const ring = STATE_RING[task.state] ?? STATE_RING.PENDING;
  const timeline = getStateTimeline(task);

  return (
    <div
      className={`
        w-[240px] rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl
        ring-2 ${ring}
        ${task.state === "STARTED" ? "animate-pulse" : ""}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-zinc-600 !border-zinc-500" />

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-zinc-800">
        <p className="font-mono text-xs font-medium text-zinc-200 truncate flex-1 mr-2">
          {task.name?.split(".").pop() ?? "unknown"}
        </p>
        {task.is_root && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 flex-shrink-0">root</span>
        )}
      </div>

      {/* State timeline */}
      <div className="px-3.5 py-2.5 space-y-1">
        {timeline.map(({ state, ts }, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <StateBadge state={state} />
            <span className="text-[10px] text-zinc-600 font-mono tabular-nums">
              {fmtTime(ts)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer: task ID + runtime */}
      <div className="flex items-center justify-between px-3.5 pb-3 pt-1 border-t border-zinc-800/60">
        <span className="font-mono text-[10px] text-zinc-600">{task.uuid.slice(0, 8)}…</span>
        {task.runtime != null && (
          <span className="text-[10px] text-zinc-500 tabular-nums">{fmtDuration(task.runtime)}</span>
        )}
      </div>

      {task.state === "FAILURE" && task.result && (
        <div className="px-3.5 pb-3 -mt-1">
          <p className="truncate rounded bg-red-950/40 px-2 py-1 text-[10px] font-mono text-red-400">
            {task.result}
          </p>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-zinc-600 !border-zinc-500" />
    </div>
  );
});

TaskNode.displayName = "TaskNode";
