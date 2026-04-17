"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FilterPanelProps {
  filters: {
    agentTypes: Set<string>;
    sentimentRange: [number, number];
    influenceRange: [number, number];
    searchQuery: string;
  };
  onFiltersChange: (filters: FilterPanelProps["filters"]) => void;
  clusterLabels: { id: number; name: string }[];
  activeCluster: number | null;
  onClusterSelect: (id: number | null) => void;
  agentCount: number;
  filteredCount: number;
}

const AGENT_TYPES = [
  { key: "general_public", label: "General Public", color: "rgba(255,255,255,0.5)", icon: "👤" },
  { key: "media", label: "Media", color: "#EAB308", icon: "📰" },
  { key: "adversarial", label: "Adversarial", color: "#EF4444", icon: "⚡" },
  { key: "institutional", label: "Institutional", color: "#3B82F6", icon: "🏛" },
  { key: "seed", label: "Seed", color: "#F59E0B", icon: "🌱" },
];

export default function FilterPanel({
  filters,
  onFiltersChange,
  clusterLabels,
  activeCluster,
  onClusterSelect,
  agentCount,
  filteredCount,
}: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  function toggleAgentType(type: string) {
    const newTypes = new Set(filters.agentTypes);
    if (newTypes.has(type)) newTypes.delete(type);
    else newTypes.add(type);
    onFiltersChange({ ...filters, agentTypes: newTypes });
  }

  function setSentimentRange(range: [number, number]) {
    onFiltersChange({ ...filters, sentimentRange: range });
  }

  function setInfluenceRange(range: [number, number]) {
    onFiltersChange({ ...filters, influenceRange: range });
  }

  function setSearchQuery(query: string) {
    onFiltersChange({ ...filters, searchQuery: query });
  }

  function resetFilters() {
    onFiltersChange({
      agentTypes: new Set(AGENT_TYPES.map((t) => t.key)),
      sentimentRange: [-1, 1],
      influenceRange: [0, 100],
      searchQuery: "",
    });
    onClusterSelect(null);
  }

  const hasActiveFilters =
    filters.agentTypes.size < AGENT_TYPES.length ||
    filters.sentimentRange[0] > -1 ||
    filters.sentimentRange[1] < 1 ||
    filters.influenceRange[0] > 0 ||
    filters.influenceRange[1] < 100 ||
    filters.searchQuery.length > 0 ||
    activeCluster !== null;

  return (
    <div className="absolute top-4 left-4 z-40">
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-2 bg-[#0D0D15]/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="14" y2="12" />
              <line x1="4" y1="18" x2="18" y2="18" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
            )}
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-64 bg-[#0D0D15]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white/80">Filters</span>
                <span className="text-[10px] text-white/30 font-mono">
                  {filteredCount}/{agentCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors px-1.5"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setCollapsed(true)}
                  className="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Search */}
              <div>
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search agents..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Agent Types */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block font-medium">
                  Agent Type
                </label>
                <div className="space-y-1">
                  {AGENT_TYPES.map((type) => (
                    <button
                      key={type.key}
                      onClick={() => toggleAgentType(type.key)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                        filters.agentTypes.has(type.key)
                          ? "bg-white/5 text-white/80"
                          : "text-white/25 hover:text-white/40"
                      }`}
                    >
                      <span>{type.icon}</span>
                      <span className="flex-1 text-left">{type.label}</span>
                      <div
                        className={`w-3 h-3 rounded-sm border ${
                          filters.agentTypes.has(type.key)
                            ? "border-indigo-500 bg-indigo-500"
                            : "border-white/20"
                        }`}
                      >
                        {filters.agentTypes.has(type.key) && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                            <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.5" fill="none" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sentiment Range */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block font-medium">
                  Sentiment Range
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-red-400 w-8">
                    {filters.sentimentRange[0].toFixed(1)}
                  </span>
                  <div className="flex-1 flex flex-col gap-1">
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.1}
                      value={filters.sentimentRange[0]}
                      onChange={(e) =>
                        setSentimentRange([
                          Math.min(parseFloat(e.target.value), filters.sentimentRange[1]),
                          filters.sentimentRange[1],
                        ])
                      }
                      className="w-full accent-indigo-500 h-1"
                    />
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.1}
                      value={filters.sentimentRange[1]}
                      onChange={(e) =>
                        setSentimentRange([
                          filters.sentimentRange[0],
                          Math.max(parseFloat(e.target.value), filters.sentimentRange[0]),
                        ])
                      }
                      className="w-full accent-indigo-500 h-1"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-green-400 w-8 text-right">
                    {filters.sentimentRange[1].toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Influence Range */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block font-medium">
                  Influence Score
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/40 w-6">
                    {filters.influenceRange[0]}
                  </span>
                  <div className="flex-1 flex flex-col gap-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={filters.influenceRange[0]}
                      onChange={(e) =>
                        setInfluenceRange([
                          Math.min(parseInt(e.target.value), filters.influenceRange[1]),
                          filters.influenceRange[1],
                        ])
                      }
                      className="w-full accent-indigo-500 h-1"
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={filters.influenceRange[1]}
                      onChange={(e) =>
                        setInfluenceRange([
                          filters.influenceRange[0],
                          Math.max(parseInt(e.target.value), filters.influenceRange[0]),
                        ])
                      }
                      className="w-full accent-indigo-500 h-1"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-white/40 w-6 text-right">
                    {filters.influenceRange[1]}
                  </span>
                </div>
              </div>

              {/* Clusters */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block font-medium">
                  Opinion Clusters
                </label>
                <div className="space-y-1">
                  {clusterLabels.map((cluster) => {
                    const colors = ["#22C55E", "#EF4444", "#EAB308"];
                    return (
                      <button
                        key={cluster.id}
                        onClick={() =>
                          onClusterSelect(activeCluster === cluster.id ? null : cluster.id)
                        }
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                          activeCluster === cluster.id
                            ? "bg-white/10 text-white"
                            : activeCluster !== null
                            ? "text-white/20"
                            : "text-white/60 hover:text-white/80 hover:bg-white/5"
                        }`}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: colors[cluster.id] || "#6B7280" }}
                        />
                        <span className="flex-1 text-left">{cluster.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
