import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Tasks } from "@/pages/Tasks";
import { Workers } from "@/pages/Workers";
import { Trace } from "@/pages/Trace";
import { useEvents } from "@/hooks/useEvents";

function AppRoutes() {
  useEvents(); // Connect WebSocket for real-time updates

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="workers" element={<Workers />} />
        <Route path="trace" element={<Navigate to="/tasks" replace />} />
        <Route path="trace/:taskId" element={<Trace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
