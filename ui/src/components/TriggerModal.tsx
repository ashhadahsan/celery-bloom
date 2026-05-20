import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { X, Play, ChevronDown, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
}

function JsonEditor({
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error: string | null;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        spellCheck={false}
        className={cn(
          "w-full rounded-lg border bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 resize-none",
          error
            ? "border-red-700 focus:ring-red-500"
            : "border-zinc-700 focus:ring-brand-500"
        )}
      />
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

function tryParseJson(raw: string, fallback: unknown): { value: unknown; error: string | null } {
  if (!raw.trim()) return { value: fallback, error: null };
  try {
    return { value: JSON.parse(raw), error: null };
  } catch {
    return { value: fallback, error: "Invalid JSON" };
  }
}

export function TriggerModal({ onClose }: Props) {
  const navigate = useNavigate();

  const { data: registered = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["registered-tasks"],
    queryFn: api.tasks.registered,
  });

  const [taskName, setTaskName] = useState("");
  const [argsRaw, setArgsRaw] = useState("[]");
  const [kwargsRaw, setKwargsRaw] = useState("{}");
  const [countdown, setCountdown] = useState("");
  const [queue, setQueue] = useState("");
  const [argsError, setArgsError] = useState<string | null>(null);
  const [kwargsError, setKwargsError] = useState<string | null>(null);
  const [result, setResult] = useState<{ task_id: string; task_name: string } | null>(null);

  // Default to first task once loaded
  useEffect(() => {
    if (!taskName && registered.length > 0) setTaskName(registered[0]);
  }, [registered, taskName]);

  const trigger = useMutation({
    mutationFn: api.tasks.trigger,
    onSuccess: (data) => setResult(data),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { value: args, error: ae } = tryParseJson(argsRaw, []);
    const { value: kwargs, error: ke } = tryParseJson(kwargsRaw, {});

    setArgsError(ae);
    setKwargsError(ke);
    if (ae || ke) return;

    if (!Array.isArray(args)) {
      setArgsError("Must be a JSON array, e.g. [1, 2]");
      return;
    }
    if (typeof kwargs !== "object" || Array.isArray(kwargs)) {
      setKwargsError("Must be a JSON object, e.g. {\"key\": \"value\"}");
      return;
    }

    trigger.mutate({
      task_name: taskName,
      args: args as unknown[],
      kwargs: kwargs as Record<string, unknown>,
      countdown: countdown ? Number(countdown) : null,
      queue: queue || null,
    });
  }

  function handleViewTrace() {
    if (result) {
      onClose();
      navigate(`/trace/${result.task_id}`);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg">
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Play className="h-4 w-4 text-brand-500" />
              <h2 className="font-semibold text-white text-sm">Trigger Task</h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {result ? (
            /* Success state */
            <div className="px-5 py-8 text-center space-y-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <div>
                <p className="font-medium text-white">Task sent!</p>
                <p className="text-sm text-zinc-500 mt-1 font-mono">{result.task_name}</p>
                <p className="text-xs text-zinc-600 mt-1 font-mono">{result.task_id}</p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={handleViewTrace}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                >
                  Watch Trace
                </button>
                <button
                  onClick={() => { setResult(null); trigger.reset(); }}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Trigger Another
                </button>
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
              {/* Task selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Task name</label>
                {loadingTasks ? (
                  <div className="flex items-center gap-2 text-zinc-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading registered tasks…
                  </div>
                ) : registered.length === 0 ? (
                  <p className="text-xs text-zinc-500">No workers online — can't discover registered tasks.</p>
                ) : (
                  <div className="relative">
                    <select
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-8 font-mono text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      {registered.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  </div>
                )}
              </div>

              {/* Args */}
              <JsonEditor
                label="Args (JSON array)"
                placeholder='[1, "hello", true]'
                value={argsRaw}
                onChange={setArgsRaw}
                error={argsError}
              />

              {/* Kwargs */}
              <JsonEditor
                label="Kwargs (JSON object)"
                placeholder='{"duration": 5, "fail_rate": 0.5}'
                value={kwargsRaw}
                onChange={setKwargsRaw}
                error={kwargsError}
              />

              {/* Advanced: countdown + queue */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Countdown (seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={countdown}
                    onChange={(e) => setCountdown(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Queue</label>
                  <input
                    type="text"
                    value={queue}
                    onChange={(e) => setQueue(e.target.value)}
                    placeholder="celery (default)"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {trigger.isError && (
                <p className="flex items-center gap-1.5 rounded-lg bg-red-950/40 border border-red-900/40 px-3 py-2 text-xs text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {(trigger.error as Error).message}
                </p>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={trigger.isPending || !taskName}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {trigger.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Run Task
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
