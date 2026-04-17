"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getMockNetworkData, CLUSTER_INFO } from "@/lib/mock-network-data";
import type { NetworkNode, NetworkEdge, NetworkAgent, TimelineRound } from "@/lib/mock-network-data";
import AgentDetailPanel from "@/components/network/AgentDetailPanel";
import TimelineScrubber from "@/components/network/TimelineScrubber";
import FilterPanel from "@/components/network/FilterPanel";

const ForceGraph = dynamic(() => import("@/components/network/ForceGraph"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#09090F" }}>
      <div className="text-center">
        <div className="w-7 h-7 border-2 border-indigo-500/60 border-t-transparent rounded-full animate-spin mb-3 mx-auto" />
        <p className="text-[11px] text-white/30 font-mono">Initializing graph...</p>
      </div>
    </div>
  ),
});

export default function NetworkClient() {
  const params = useParams();
  const router = useRouter();
  const simulationId = params.id as string;

  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [edges, setEdges] = useState<NetworkEdge[]>([]);
  const [agents, setAgents] = useState<NetworkAgent[]>([]);
  const [timeline, setTimeline] = useState<TimelineRound[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentRound, setCurrentRound] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeCluster, setActiveCluster] = useState<number | null>(null);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [resetPinsSignal, setResetPinsSignal] = useState(0);

  const [filters, setFilters] = useState({
    agentTypes: new Set(["general_public", "media", "adversarial", "institutional", "seed"]),
    sentimentRange: [-1, 1] as [number, number],
    influenceRange: [0, 100] as [number, number],
    searchQuery: "",
  });

  useEffect(() => {
    const data = getMockNetworkData();
    setNodes(data.nodes);
    setEdges(data.edges);
    setAgents(data.agents);
    setTimeline(data.timeline);
    setLoading(false);
  }, []);

  // Playback
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentRound((prev) => {
          if (prev >= 20) { setIsPlaying(false); return 20; }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, playbackSpeed]);

  const handleTogglePlay = useCallback(() => {
    if (currentRound >= 20) { setCurrentRound(1); setIsPlaying(true); }
    else setIsPlaying((p) => !p);
  }, [currentRound]);

  const handleRoundChange = useCallback((round: number) => {
    setCurrentRound(round);
    setIsPlaying(false);
  }, []);

  const handleResetPins = useCallback(() => {
    setResetPinsSignal((s) => s + 1);
    setPinnedCount(0);
  }, []);

  // Filter logic
  const filteredNodes = activeCluster !== null
    ? nodes.filter((n) => n.cluster_id === activeCluster)
    : nodes;

  const graphFilters = { ...filters };

  const filteredCount = nodes.filter((n) => {
    if (!filters.agentTypes.has(n.agent_type)) return false;
    const s = n.sentiment_by_round[Math.min(currentRound - 1, n.sentiment_by_round.length - 1)] || 0;
    if (s < filters.sentimentRange[0] || s > filters.sentimentRange[1]) return false;
    if (n.influence_score < filters.influenceRange[0] || n.influence_score > filters.influenceRange[1]) return false;
    if (activeCluster !== null && n.cluster_id !== activeCluster) return false;
    if (filters.searchQuery) {
      const agent = agents.find((a) => a.id === n.id);
      if (agent && !agent.name.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false;
    }
    return true;
  }).length;

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "#09090F" }}>
        <div className="text-center">
          <div className="w-9 h-9 border-2 border-indigo-500/50 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
          <p className="text-sm text-white/35 font-mono">Loading agent network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden" style={{ background: "#09090F" }}>

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4"
        style={{
          height: "52px",
          background: "linear-gradient(to bottom, rgba(9,9,15,0.97) 55%, transparent)",
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/simulation/${simulationId}`)}
            className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/75 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Results
          </button>

          <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.09)" }} />

          <h1 className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.72)" }}>
            Agent Network
          </h1>

          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-md"
            style={{
              color: "rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {agents.length} agents · {edges.length} connections
          </span>

          {pinnedCount > 0 && (
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                style={{
                  color: "rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                📌 {pinnedCount} pinned
              </span>
              <button
                onClick={handleResetPins}
                className="text-[10px] font-mono transition-colors"
                style={{ color: "rgba(255,255,255,0.25)", textDecoration: "underline", textUnderlineOffset: "2px" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
              >
                reset all
              </button>
            </div>
          )}
        </div>

        {/* Right — legend */}
        <div className="flex items-center gap-5">
          <div className="hidden md:flex items-center gap-4 font-mono" style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)" }}>
            {[
              { color: "#22C55E", label: "Positive" },
              { color: "#6B7280", label: "Neutral" },
              { color: "#EF4444", label: "Negative" },
              { color: "#A855F7", label: "Volatile" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
          <div className="hidden lg:flex items-center gap-4 font-mono" style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
            {[
              { borderStyle: "1px solid rgba(255,255,255,0.38)", label: "Public" },
              { borderStyle: "1px dashed #EAB308", label: "Media" },
              { borderStyle: "1px solid #EF4444", label: "Adversarial" },
              { borderStyle: "1px solid #3B82F6", label: "Institutional" },
            ].map(({ borderStyle, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ border: borderStyle }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="absolute inset-0">
        <ForceGraph
          nodes={filteredNodes}
          edges={edges}
          agents={agents}
          currentRound={currentRound}
          filters={graphFilters}
          hoveredNode={hoveredNode}
          selectedNode={selectedNode}
          onHoverNode={setHoveredNode}
          onSelectNode={setSelectedNode}
          onPinnedCountChange={setPinnedCount}
          resetPinsSignal={resetPinsSignal}
        />
      </div>

      {/* Filter panel */}
      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        clusterLabels={CLUSTER_INFO.map((c) => ({ id: c.id, name: c.name }))}
        activeCluster={activeCluster}
        onClusterSelect={setActiveCluster}
        agentCount={agents.length}
        filteredCount={filteredCount}
      />

      {/* Agent detail panel */}
      <AgentDetailPanel
        agentId={selectedNode}
        simulationId={simulationId}
        onClose={() => setSelectedNode(null)}
      />

      {/* Timeline scrubber */}
      <TimelineScrubber
        rounds={timeline}
        currentRound={currentRound}
        onRoundChange={handleRoundChange}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        playbackSpeed={playbackSpeed}
        onSpeedChange={setPlaybackSpeed}
      />

      {/* Interaction hint */}
      <div
        className="absolute bottom-20 right-16 z-20 font-mono select-none"
        style={{ fontSize: "10px", color: "rgba(255,255,255,0.13)" }}
      >
        scroll to zoom · drag canvas to pan · drag agent to pin · dbl-click to free
      </div>
    </div>
  );
}
