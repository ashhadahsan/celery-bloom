const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export interface TaskRecord {
  uuid: string;
  name: string | null;
  state: "PENDING" | "RECEIVED" | "STARTED" | "SUCCESS" | "FAILURE" | "REVOKED" | "RETRY";
  worker: string | null;
  args: string | null;
  kwargs: string | null;
  result: string | null;
  traceback: string | null;
  received: number | null;
  started: number | null;
  succeeded: number | null;
  failed: number | null;
  retried: number | null;
  revoked: number | null;
  runtime: number | null;
  retries: number;
  timestamp: number;
  parent_id: string | null;
  root_id: string | null;
  group_id: string | null;
}

export interface TaskList {
  total: number;
  tasks: TaskRecord[];
}

export interface WorkerRecord {
  name: string;
  status: string;
  active_tasks: TaskRecord[];
  scheduled_tasks: TaskRecord[];
  reserved_tasks: TaskRecord[];
  registered_tasks: string[];
  concurrency: number | null;
  total_tasks: Record<string, number>;
  prefetch_count: number | null;
}

export interface TaskStats {
  total: number;
  by_state: Record<string, number>;
}

export interface GraphNode extends TaskRecord {
  is_root: boolean;
  [key: string]: unknown; // satisfies @xyflow/react Node<T> constraint
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "chain" | "group" | "chord";
}

export interface TaskGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  root_id: string;
}

export const api = {
  tasks: {
    list: (params: Record<string, string | number | undefined> = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return request<TaskList>(`/tasks${qs ? `?${qs}` : ""}`);
    },
    stats: () => request<TaskStats>("/tasks/stats"),
    get: (id: string) => request<TaskRecord>(`/tasks/${id}`),
    graph: (id: string) => request<TaskGraph>(`/tasks/${id}/graph`),
    registered: () => request<string[]>("/tasks/registered"),
    trigger: (payload: {
      task_name: string;
      args?: unknown[];
      kwargs?: Record<string, unknown>;
      countdown?: number | null;
      queue?: string | null;
    }) =>
      request<{ task_id: string; task_name: string }>("/tasks/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    revoke: (id: string, terminate = false) =>
      request(`/tasks/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminate }),
      }),
  },
  workers: {
    list: () => request<WorkerRecord[]>("/workers"),
  },
};
