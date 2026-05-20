import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, RefreshCw, XCircle, GitFork, ListTodo, Play } from "lucide-react";
import { api, type TaskRecord } from "@/lib/api";
import { StateBadge } from "@/components/Badge";
import { fmtDate, fmtDuration, shortId } from "@/lib/utils";
import { TaskDrawer } from "@/components/TaskDrawer";

const STATES = ["", "SUCCESS", "FAILURE", "STARTED", "RECEIVED", "PENDING", "REVOKED", "RETRY"];
const PAGE_SIZE = 50;

export function Tasks() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<TaskRecord | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["tasks", { search, state, offset }],
    queryFn: () =>
      api.tasks.list({
        search: search || undefined,
        state: state || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    refetchInterval: 3000,
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Tasks</h1>
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Search by name or task ID…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-8 pr-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <select
            value={state}
            onChange={(e) => { setState(e.target.value); setOffset(0); }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {STATES.map((s) => (
              <option key={s} value={s}>{s || "All states"}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Empty state — shown outside the table so it can fill the space properly */}
      {!isLoading && data?.tasks.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
          <ListTodo className="h-10 w-10 text-zinc-700" />
          <div>
            <p className="font-medium text-zinc-400">
              {search || state ? "No tasks match your filters" : "No tasks yet"}
            </p>
            <p className="text-sm text-zinc-600 mt-1 max-w-sm">
              {search || state
                ? "Try clearing the search or state filter."
                : "Tasks appear here as they run. celery-bloom only captures tasks that occur while it's running."}
            </p>
          </div>
          {!search && !state && (
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("open-trigger"))}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Play className="h-3.5 w-3.5" /> Trigger a task
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className={`flex-1 overflow-auto ${data?.tasks.length === 0 ? "hidden" : ""}`}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              <th className="px-6 py-3">Task ID</th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">State</th>
              <th className="px-3 py-3">Worker</th>
              <th className="px-3 py-3">Runtime</th>
              <th className="px-3 py-3">Received</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-zinc-500">Loading…</td>
              </tr>
            ) : (
              data?.tasks.map((t) => (
                <tr
                  key={t.uuid}
                  className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  onClick={() => setSelected(t)}
                >
                  <td className="px-6 py-3 font-mono text-xs text-zinc-400">{shortId(t.uuid)}</td>
                  <td className="px-3 py-3 font-mono text-zinc-200 truncate max-w-xs">{t.name ?? "—"}</td>
                  <td className="px-3 py-3"><StateBadge state={t.state} /></td>
                  <td className="px-3 py-3 font-mono text-xs text-zinc-500 truncate max-w-[180px]">
                    {t.worker?.split("@")[1] ?? t.worker ?? "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-zinc-400">{fmtDuration(t.runtime)}</td>
                  <td className="px-3 py-3 text-zinc-500">{fmtDate(t.received)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/trace/${t.uuid}`); }}
                        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                        title="View execution trace"
                      >
                        <GitFork className="h-3.5 w-3.5" />
                      </button>
                      {(t.state === "STARTED" || t.state === "RECEIVED") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); api.tasks.revoke(t.uuid); }}
                          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3">
          <span className="text-xs text-zinc-500">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={offset + PAGE_SIZE >= data.total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && <TaskDrawer task={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
