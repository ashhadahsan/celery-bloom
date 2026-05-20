import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { api, type GraphNode } from "@/lib/api";
import { TaskNode } from "@/components/TaskNode";
import { TaskDrawer } from "@/components/TaskDrawer";
import { applyDagreLayout } from "@/lib/layout";

const NODE_TYPES = { task: TaskNode };

const EDGE_STYLE = { stroke: "#52525b", strokeWidth: 1.5 };

const STATE_COLORS: Record<string, string> = {
  SUCCESS: "#22c55e",
  FAILURE: "#ef4444",
  STARTED: "#3b82f6",
  RETRY: "#a855f7",
  RECEIVED: "#eab308",
  REVOKED: "#f97316",
  PENDING: "#52525b",
};

function buildFlow(
  apiNodes: GraphNode[],
  apiEdges: { id: string; source: string; target: string }[]
): { nodes: Node<GraphNode>[]; edges: Edge[] } {
  const nodes: Node<GraphNode>[] = apiNodes.map((n) => ({
    id: n.uuid,
    type: "task",
    data: n,
    position: { x: 0, y: 0 },
  }));

  const edges: Edge[] = apiEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#52525b" },
    style: EDGE_STYLE,
  }));

  return { nodes: applyDagreLayout(nodes, edges), edges };
}

export function Trace() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["task-graph", taskId],
    queryFn: () => api.tasks.graph(taskId!),
    refetchInterval: 3000,
    enabled: !!taskId,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphNode>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Sync React Flow state whenever the API data changes
  useEffect(() => {
    if (data?.nodes.length) {
      const { nodes: laid, edges: e } = buildFlow(data.nodes, data.edges);
      setNodes(laid);
      setEdges(e);
    }
  }, [data, setNodes, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<GraphNode>) => {
    setSelected(node.data);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="h-4 w-px bg-zinc-700" />
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Execution Trace</h1>
          <p className="font-mono text-xs text-zinc-500 mt-0.5">{taskId}</p>
        </div>
        {data && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{data.nodes.length} node{data.nodes.length !== 1 ? "s" : ""}</span>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-zinc-500 text-sm">
            Loading graph…
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#27272a" gap={20} />
            <Controls className="!bg-zinc-900 !border-zinc-700 !text-zinc-300" />
            <MiniMap
              nodeColor={(n) => STATE_COLORS[(n.data as unknown as GraphNode)?.state] ?? "#52525b"}
              className="!bg-zinc-900 !border-zinc-800"
            />
          </ReactFlow>
        )}
      </div>

      {selected && <TaskDrawer task={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
