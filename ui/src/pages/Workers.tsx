import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Cpu, Activity } from "lucide-react";
import { api } from "@/lib/api";
import { StateBadge } from "@/components/Badge";
import { fmtDuration } from "@/lib/utils";

export function Workers() {
  const { data: workers, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["workers"],
    queryFn: api.workers.list,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Workers</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{workers?.length ?? 0} online</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <p className="text-zinc-600 text-sm">Loading…</p>
      ) : workers?.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <Activity className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No workers online</p>
          <p className="text-zinc-600 text-xs mt-1">Start a Celery worker to see it here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workers?.map((w) => (
            <div key={w.name} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              {/* Worker header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                  <span className="font-mono text-sm text-white">{w.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  {w.concurrency && (
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3.5 w-3.5" /> {w.concurrency} threads
                    </span>
                  )}
                  <span>{w.active_tasks.length} active</span>
                  <span>{w.reserved_tasks.length} reserved</span>
                </div>
              </div>

              {/* Active tasks */}
              {w.active_tasks.length > 0 && (
                <div className="px-5 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-600 mb-2">Active</p>
                  <div className="space-y-1.5">
                    {w.active_tasks.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3 rounded-lg bg-zinc-800/50 px-3 py-2">
                        <StateBadge state="STARTED" />
                        <span className="flex-1 font-mono text-xs text-zinc-300 truncate">{t.name ?? t.id}</span>
                        <span className="text-xs text-zinc-600 font-mono">{t.id?.slice(0, 8)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Registered tasks */}
              {w.registered_tasks.length > 0 && (
                <div className="px-5 py-3 border-t border-zinc-800/50">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-600 mb-2">
                    Registered ({w.registered_tasks.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {w.registered_tasks.map((name: string) => (
                      <span
                        key={name}
                        className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Total tasks processed */}
              {Object.keys(w.total_tasks ?? {}).length > 0 && (
                <div className="px-5 py-3 border-t border-zinc-800/50">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-600 mb-2">Processed</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(w.total_tasks).map(([name, count]) => (
                      <div key={name} className="text-xs">
                        <span className="font-mono text-zinc-400">{name.split(".").pop()}</span>
                        <span className="ml-1.5 tabular-nums text-zinc-300">{String(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
