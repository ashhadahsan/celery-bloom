import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, ListTodo, Server, Flower, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { TriggerModal } from "./TriggerModal";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/workers", label: "Workers", icon: Server },
];

export function Layout() {
  const [triggerOpen, setTriggerOpen] = useState(false);

  useEffect(() => {
    const handler = () => setTriggerOpen(true);
    document.addEventListener("open-trigger", handler);
    return () => document.removeEventListener("open-trigger", handler);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800">
          <Flower className="h-5 w-5 text-brand-500" />
          <span className="font-semibold tracking-tight text-white">celery-bloom</span>
        </div>

        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Trigger button — lives at the bottom of the sidebar */}
        <div className="p-3 border-t border-zinc-800 space-y-3">
          <button
            onClick={() => setTriggerOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            Trigger Task
          </button>
          <p className="text-xs text-zinc-600 text-center">v0.1.0</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {triggerOpen && <TriggerModal onClose={() => setTriggerOpen(false)} />}
    </div>
  );
}
