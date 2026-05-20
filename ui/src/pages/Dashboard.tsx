import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { StateBadge } from "@/components/Badge";
import { fmtDuration, fmtTime } from "@/lib/utils";

const STATE_COLORS: Record<string, string> = {
  SUCCESS: "#22c55e",
  FAILURE: "#ef4444",
  STARTED: "#3b82f6",
  RECEIVED: "#eab308",
  PENDING: "#71717a",
  REVOKED: "#f97316",
  RETRY: "#a855f7",
};

export function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ["task-stats"], queryFn: api.tasks.stats });
  const { data: workers } = useQuery({ queryKey: ["workers"], queryFn: api.workers.list });
  const { data: recent } = useQuery({
    queryKey: ["tasks", { limit: 10 }],
    queryFn: () => api.tasks.list({ limit: 10 }),
  });

  const chartData = Object.entries(stats?.by_state ?? {}).map(([state, count]) => ({
    state,
    count,
    fill: STATE_COLORS[state] ?? "#71717a",
  }));

  const activeCount = workers?.reduce((s, w) => s + w.active_tasks.length, 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Real-time Celery overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Tasks" value={stats?.total ?? 0} />
        <StatCard
          label="Active Now"
          value={activeCount}
          color={activeCount > 0 ? "text-blue-400" : "text-white"}
        />
        <StatCard
          label="Success"
          value={stats?.by_state?.SUCCESS ?? 0}
          color="text-emerald-400"
        />
        <StatCard
          label="Failed"
          value={stats?.by_state?.FAILURE ?? 0}
          color={(stats?.by_state?.FAILURE ?? 0) > 0 ? "text-red-400" : "text-white"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Chart */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Tasks by State</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={32}>
                <XAxis dataKey="state" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                  labelStyle={{ color: "#e4e4e7" }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.state} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-48 items-center justify-center text-zinc-600 text-sm">
              No task data yet
            </div>
          )}
        </div>

        {/* Workers summary */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">
            Workers ({workers?.length ?? 0})
          </h2>
          {workers && workers.length > 0 ? (
            <ul className="space-y-2">
              {workers.map((w) => (
                <li key={w.name} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                  <span className="text-sm font-mono text-zinc-300 truncate max-w-[60%]">{w.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{w.active_tasks.length} active</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-32 items-center justify-center text-zinc-600 text-sm">
              No workers online
            </div>
          )}
        </div>
      </div>

      {/* Recent tasks */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-300">Recent Tasks</h2>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {recent?.tasks.length ? (
            recent.tasks.map((t) => (
              <div key={t.uuid} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-800/40 transition-colors">
                <StateBadge state={t.state} />
                <span className="flex-1 truncate text-sm text-zinc-300 font-mono">
                  {t.name ?? "unknown"}
                </span>
                <span className="text-xs text-zinc-500 hidden sm:block">{fmtDuration(t.runtime)}</span>
                <span className="text-xs text-zinc-600">{fmtTime(t.timestamp)}</span>
              </div>
            ))
          ) : (
            <div className="flex h-24 items-center justify-center text-zinc-600 text-sm">
              Waiting for tasks…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
