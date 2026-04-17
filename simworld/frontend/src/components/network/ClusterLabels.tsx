"use client";

import { useMemo } from "react";
import type { NetworkNode } from "@/lib/mock-network-data";
import { CLUSTER_INFO } from "@/lib/mock-network-data";

interface ClusterLabelsProps {
  nodes: NetworkNode[];
  graphNodes: { id: string; x?: number; y?: number; cluster_id: number }[];
  transform: { x: number; y: number; k: number };
  activeCluster: number | null;
  onClusterClick: (id: number | null) => void;
}

export default function ClusterLabels({
  graphNodes,
  transform,
  activeCluster,
  onClusterClick,
}: ClusterLabelsProps) {
  const clusterPositions = useMemo(() => {
    const clusters = new Map<number, { xSum: number; ySum: number; count: number }>();

    for (const node of graphNodes) {
      if (node.x == null || node.y == null) continue;
      const existing = clusters.get(node.cluster_id);
      if (existing) {
        existing.xSum += node.x;
        existing.ySum += node.y;
        existing.count++;
      } else {
        clusters.set(node.cluster_id, { xSum: node.x, ySum: node.y, count: 1 });
      }
    }

    return Array.from(clusters.entries()).map(([id, data]) => ({
      id,
      x: data.xSum / data.count,
      y: data.ySum / data.count,
      count: data.count,
      label: CLUSTER_INFO[id]?.name || `Cluster ${id}`,
      narrative: CLUSTER_INFO[id]?.dominant_narrative || "",
    }));
  }, [graphNodes]);

  if (transform.k < 0.3) return null;

  const colors = ["#22C55E", "#EF4444", "#EAB308"];

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {clusterPositions.map((cluster) => {
        const screenX = transform.x + cluster.x * transform.k;
        const screenY = transform.y + cluster.y * transform.k - 40 * transform.k;
        const isFaded = activeCluster !== null && activeCluster !== cluster.id;

        return (
          <div
            key={cluster.id}
            className="absolute pointer-events-auto cursor-pointer transition-opacity duration-300"
            style={{
              left: screenX,
              top: screenY,
              transform: "translate(-50%, -100%)",
              opacity: isFaded ? 0.15 : 0.85,
            }}
            onClick={() => onClusterClick(activeCluster === cluster.id ? null : cluster.id)}
          >
            <div className="flex items-center gap-1.5 bg-[#0D0D15]/80 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors[cluster.id] || "#6B7280" }}
              />
              <span className="text-[11px] font-medium text-white/80">
                {cluster.label}
              </span>
              <span className="text-[10px] text-white/30 font-mono">
                {cluster.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
