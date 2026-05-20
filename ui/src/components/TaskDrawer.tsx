import { X, XCircle, GitFork } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, type TaskRecord } from "@/lib/api";
import { StateBadge } from "./Badge";
import { fmtDate, fmtDuration } from "@/lib/utils";

interface Props {
  task: TaskRecord;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 py-2.5 border-b border-zinc-800/60 last:border-0">
      <dt className="text-xs font-medium text-zinc-500 pt-0.5">{label}</dt>
      <dd className="text-sm text-zinc-200 break-all">{value ?? "—"}</dd>
    </div>
  );
}

export function TaskDrawer({ task, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const revoke = useMutation({
    mutationFn: (terminate: boolean) => api.tasks.revoke(task.uuid, terminate),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const canRevoke = task.state === "STARTED" || task.state === "RECEIVED" || task.state === "PENDING";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-zinc-900 border-l border-zinc-800 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-white text-sm">Task Detail</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="flex items-center gap-3 mb-5">
            <StateBadge state={task.state} />
            <span className="font-mono text-xs text-zinc-400 break-all">{task.uuid}</span>
          </div>

          <dl>
            <Row label="Name" value={<span className="font-mono">{task.name}</span>} />
            <Row label="Worker" value={<span className="font-mono text-xs">{task.worker}</span>} />
            <Row label="Runtime" value={fmtDuration(task.runtime)} />
            <Row label="Retries" value={task.retries} />
            <Row label="Received" value={fmtDate(task.received)} />
            <Row label="Started" value={fmtDate(task.started)} />
            <Row label="Finished" value={fmtDate(task.succeeded ?? task.failed)} />
          </dl>

          {task.args && (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-500 mb-1.5">Args</p>
              <pre className="rounded-lg bg-zinc-800 p-3 text-xs font-mono text-zinc-300 overflow-auto whitespace-pre-wrap">
                {task.args}
              </pre>
            </div>
          )}

          {task.kwargs && (
            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-500 mb-1.5">Kwargs</p>
              <pre className="rounded-lg bg-zinc-800 p-3 text-xs font-mono text-zinc-300 overflow-auto whitespace-pre-wrap">
                {task.kwargs}
              </pre>
            </div>
          )}

          {task.result && (
            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-500 mb-1.5">Result</p>
              <pre className="rounded-lg bg-zinc-800 p-3 text-xs font-mono text-zinc-300 overflow-auto whitespace-pre-wrap">
                {task.result}
              </pre>
            </div>
          )}

          {task.traceback && (
            <div className="mt-3">
              <p className="text-xs font-medium text-red-400 mb-1.5">Traceback</p>
              <pre className="rounded-lg bg-red-950/30 border border-red-900/40 p-3 text-xs font-mono text-red-300 overflow-auto whitespace-pre-wrap">
                {task.traceback}
              </pre>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 flex gap-2">
          <button
            onClick={() => { onClose(); navigate(`/trace/${task.uuid}`); }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <GitFork className="h-4 w-4" /> View Trace
          </button>
        </div>

        {canRevoke && (
          <div className="px-5 py-4 border-t border-zinc-800 flex gap-2">
            <button
              onClick={() => revoke.mutate(false)}
              className="flex items-center gap-1.5 rounded-lg border border-orange-700/40 bg-orange-500/10 px-3 py-1.5 text-sm text-orange-400 hover:bg-orange-500/20 transition-colors"
            >
              <XCircle className="h-4 w-4" /> Revoke
            </button>
            <button
              onClick={() => revoke.mutate(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-700/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <XCircle className="h-4 w-4" /> Terminate
            </button>
          </div>
        )}
      </div>
    </>
  );
}
