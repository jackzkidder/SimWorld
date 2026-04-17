"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import * as d3 from "d3";
import type { NetworkNode, NetworkEdge, NetworkAgent } from "@/lib/mock-network-data";

// ─── Types ────────────────────────────────────────────────────────
export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  sentiment: number;
  influence_score: number;
  agent_type: string;
  cluster_id: number;
  name: string;
  persona: string;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  weight: number;
  interaction_type: "positive" | "negative" | "neutral";
  active: boolean;
}

interface ForceGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  agents: NetworkAgent[];
  currentRound: number;
  filters: {
    agentTypes: Set<string>;
    sentimentRange: [number, number];
    influenceRange: [number, number];
    searchQuery: string;
  };
  hoveredNode: string | null;
  selectedNode: string | null;
  onHoverNode: (id: string | null) => void;
  onSelectNode: (id: string | null) => void;
  onPinnedCountChange?: (count: number) => void;
  resetPinsSignal?: number;
}

// ─── Color helpers ─────────────────────────────────────────────────
function sentimentColor(s: number): string {
  if (s > 0.5) return "#22C55E";
  if (s > 0.15) return "#86EFAC";
  if (s > -0.15) return "#6B7280";
  if (s > -0.5) return "#FB923C";
  return "#EF4444";
}

function getNodeColor(sentimentByRound: number[], round: number): string {
  let directionChanges = 0;
  for (let i = 2; i <= Math.min(round, sentimentByRound.length); i++) {
    const prev = sentimentByRound[i - 1] - sentimentByRound[i - 2];
    const curr =
      sentimentByRound[i] !== undefined && sentimentByRound[i - 1] !== undefined
        ? (sentimentByRound[i] || 0) - sentimentByRound[i - 1]
        : 0;
    if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) directionChanges++;
  }
  if (directionChanges >= 3) return "#A855F7";
  const idx = Math.min(round - 1, sentimentByRound.length - 1);
  return sentimentColor(sentimentByRound[idx] || 0);
}

function getNodeRadius(influence: number): number {
  return 5 + (influence / 100) * 18;
}

function getBorderStyle(agentType: string): { color: string; dash: boolean } {
  switch (agentType) {
    case "media":         return { color: "#EAB308", dash: true };
    case "adversarial":   return { color: "#EF4444", dash: false };
    case "institutional": return { color: "#3B82F6", dash: false };
    case "seed":          return { color: "#F59E0B", dash: false };
    default:              return { color: "rgba(255,255,255,0.4)", dash: false };
  }
}

function edgeColor(type: string): string {
  if (type === "positive") return "rgba(59,130,246,0.18)";
  if (type === "negative") return "rgba(239,68,68,0.15)";
  return "rgba(107,114,128,0.1)";
}

function edgeHighlightColor(type: string): string {
  if (type === "positive") return "rgba(59,130,246,0.85)";
  if (type === "negative") return "rgba(239,68,68,0.8)";
  return "rgba(150,150,165,0.65)";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Component ─────────────────────────────────────────────────────
export default function ForceGraph({
  nodes,
  edges,
  agents,
  currentRound,
  filters,
  hoveredNode,
  selectedNode,
  onHoverNode,
  onSelectNode,
  onPinnedCountChange,
  resetPinsSignal = 0,
}: ForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const graphNodesRef = useRef<GraphNode[]>([]);
  const graphLinksRef = useRef<GraphLink[]>([]);
  const transformRef = useRef(d3.zoomIdentity);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const animFrameRef = useRef<number>(0);
  const connectedNodesRef = useRef<Set<string>>(new Set());
  const pinnedNodesRef = useRef<Set<string>>(new Set());
  const dragNodeRef = useRef<GraphNode | null>(null);
  const isDraggingRef = useRef(false);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const mouseDownTimeRef = useRef(0);
  const agentMap = useRef(new Map<string, NetworkAgent>());
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const selRef = useRef<d3.Selection<HTMLCanvasElement, unknown, null, undefined> | null>(null);

  useEffect(() => {
    agentMap.current.clear();
    for (const a of agents) agentMap.current.set(a.id, a);
  }, [agents]);

  // Reset pins
  useEffect(() => {
    if (resetPinsSignal === 0) return;
    for (const node of graphNodesRef.current) {
      node.fx = null;
      node.fy = null;
    }
    pinnedNodesRef.current.clear();
    onPinnedCountChange?.(0);
    simRef.current?.alpha(0.3).restart();
  }, [resetPinsSignal, onPinnedCountChange]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    obs.observe(parent);
    return () => obs.disconnect();
  }, []);

  // Build graph data + simulation
  useEffect(() => {
    const { agentTypes, sentimentRange: [sentMin, sentMax], influenceRange: [infMin, infMax], searchQuery } = filters;
    const query = searchQuery.toLowerCase();

    const filteredNodeIds = new Set<string>();
    const graphNodes: GraphNode[] = [];

    for (const node of nodes) {
      const agent = agentMap.current.get(node.id);
      if (!agent) continue;
      if (!agentTypes.has(node.agent_type)) continue;
      const sentiment =
        node.sentiment_by_round[Math.min(currentRound - 1, node.sentiment_by_round.length - 1)] || 0;
      if (sentiment < sentMin || sentiment > sentMax) continue;
      if (node.influence_score < infMin || node.influence_score > infMax) continue;
      if (query && !agent.name.toLowerCase().includes(query) && !agent.persona.toLowerCase().includes(query))
        continue;

      filteredNodeIds.add(node.id);
      const existing = graphNodesRef.current.find((n) => n.id === node.id);
      const isPinned = pinnedNodesRef.current.has(node.id);

      graphNodes.push({
        id: node.id,
        sentiment,
        influence_score: node.influence_score,
        agent_type: node.agent_type,
        cluster_id: node.cluster_id,
        name: agent.name,
        persona: agent.persona,
        x: existing?.x,
        y: existing?.y,
        vx: isPinned ? 0 : existing?.vx,
        vy: isPinned ? 0 : existing?.vy,
        fx: isPinned ? (existing?.fx ?? existing?.x) : undefined,
        fy: isPinned ? (existing?.fy ?? existing?.y) : undefined,
      });
    }

    const graphLinks: GraphLink[] = [];
    for (const edge of edges) {
      if (!filteredNodeIds.has(edge.source) || !filteredNodeIds.has(edge.target)) continue;
      graphLinks.push({
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        interaction_type: edge.interaction_type,
        active: edge.rounds_active.includes(currentRound),
      });
    }

    graphNodesRef.current = graphNodes;
    graphLinksRef.current = graphLinks;

    if (simRef.current) {
      simRef.current.nodes(graphNodes);
      const linkForce = simRef.current.force("link") as d3.ForceLink<GraphNode, GraphLink>;
      if (linkForce) linkForce.links(graphLinks);
      simRef.current.alpha(0.2).restart();
    } else if (dimensions.width > 0) {
      const sim = d3
        .forceSimulation<GraphNode>(graphNodes)
        .force(
          "link",
          d3
            .forceLink<GraphNode, GraphLink>(graphLinks)
            .id((d) => d.id)
            .distance((d) => 120 + (1 - d.weight) * 80)  // long rest length — nodes spread out
            .strength((d) => d.weight * 0.005)            // very weak link pull
        )
        .force(
          "charge",
          d3.forceManyBody<GraphNode>()
            .strength(-260)        // strong repulsion keeps nodes apart
            .distanceMin(15)
            .distanceMax(420)
        )
        .force(
          "center",
          d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.01)
        )
        .force(
          "cluster",
          forceCluster(graphNodes, dimensions.width, dimensions.height, 0.0006)
        )
        .force(
          "collision",
          d3.forceCollide<GraphNode>().radius((d) => getNodeRadius(d.influence_score) + 6).strength(0.9)
        )
        .alphaDecay(0.022)
        .velocityDecay(0.52);

      simRef.current = sim;
    }
  }, [nodes, edges, agents, currentRound, filters, dimensions]);

  // Connected nodes for hover highlight
  useEffect(() => {
    const connected = new Set<string>();
    if (hoveredNode) {
      connected.add(hoveredNode);
      for (const link of graphLinksRef.current) {
        const s = typeof link.source === "object" ? (link.source as GraphNode).id : String(link.source);
        const t = typeof link.target === "object" ? (link.target as GraphNode).id : String(link.target);
        if (s === hoveredNode) connected.add(t);
        if (t === hoveredNode) connected.add(s);
      }
    }
    connectedNodesRef.current = connected;
  }, [hoveredNode]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (selRef.current && zoomBehaviorRef.current)
      selRef.current.transition().duration(240).call(zoomBehaviorRef.current.scaleBy, 1.4);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (selRef.current && zoomBehaviorRef.current)
      selRef.current.transition().duration(240).call(zoomBehaviorRef.current.scaleBy, 0.714);
  }, []);

  const handleFitView = useCallback(() => {
    const gnodes = graphNodesRef.current.filter((n) => n.x != null && n.y != null);
    if (!gnodes.length || !selRef.current || !zoomBehaviorRef.current) return;
    const xs = gnodes.map((n) => n.x!);
    const ys = gnodes.map((n) => n.y!);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 110;
    const { width, height } = dimensions;
    const k = Math.min(
      (width - pad * 2) / Math.max(maxX - minX, 1),
      (height - pad * 2) / Math.max(maxY - minY, 1),
      2
    );
    const t = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(k)
      .translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
    selRef.current.transition().duration(480).call(zoomBehaviorRef.current.transform, t);
  }, [dimensions]);

  // Canvas render loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensions;
    if (width === 0 || height === 0) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const transform = transformRef.current;
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#09090F";
    ctx.fillRect(0, 0, width, height);

    // Miro-style dot grid (scrolls with pan/zoom)
    {
      const gridSpacing = 40;
      const dotRadius = 0.9;
      const ox = ((transform.x % (gridSpacing * transform.k)) + gridSpacing * transform.k) % (gridSpacing * transform.k);
      const oy = ((transform.y % (gridSpacing * transform.k)) + gridSpacing * transform.k) % (gridSpacing * transform.k);
      ctx.fillStyle = "rgba(255,255,255,0.042)";
      for (let gx = ox - gridSpacing * transform.k; gx < width + gridSpacing * transform.k; gx += gridSpacing * transform.k) {
        for (let gy = oy - gridSpacing * transform.k; gy < height + gridSpacing * transform.k; gy += gridSpacing * transform.k) {
          ctx.beginPath();
          ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const hasHover = hoveredNode !== null;
    const connectedSet = connectedNodesRef.current;
    const graphNodes = graphNodesRef.current;
    const graphLinks = graphLinksRef.current;
    const now = Date.now();

    // ── Draw edges ──────────────────────────────────────────────────
    for (const link of graphLinks) {
      const source = link.source as GraphNode;
      const target = link.target as GraphNode;
      if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

      const sId = source.id, tId = target.id;
      const isConn = hasHover && connectedSet.has(sId) && connectedSet.has(tId);
      const isFaded = hasHover && !isConn;

      if (isFaded) {
        ctx.strokeStyle = "rgba(30,30,42,0.06)";
        ctx.lineWidth = 0.5;
      } else if (isConn) {
        ctx.strokeStyle = edgeHighlightColor(link.interaction_type);
        ctx.lineWidth = Math.min(link.weight * 0.9, 3.5);
      } else {
        ctx.strokeStyle = edgeColor(link.interaction_type);
        ctx.lineWidth = Math.max(0.5, link.weight * 0.35);
      }

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      // Directional arrow on highlighted edges
      if (isConn) {
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        const r = getNodeRadius(target.influence_score) + 3;
        const ax = target.x - Math.cos(angle) * r;
        const ay = target.y - Math.sin(angle) * r;
        const arrowSz = 5;
        ctx.fillStyle = edgeHighlightColor(link.interaction_type);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - arrowSz * Math.cos(angle - Math.PI / 6), ay - arrowSz * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ax - arrowSz * Math.cos(angle + Math.PI / 6), ay - arrowSz * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }

      // Traveling particle on active edges
      if (link.active && !isFaded) {
        const t = (now % 2200) / 2200;
        const px = source.x + (target.x - source.x) * t;
        const py = source.y + (target.y - source.y) * t;
        ctx.fillStyle =
          link.interaction_type === "positive" ? "#60A5FA"
            : link.interaction_type === "negative" ? "#F87171"
            : "#9CA3AF";
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Draw nodes ──────────────────────────────────────────────────
    for (const node of graphNodes) {
      if (node.x == null || node.y == null) continue;

      const isHovered  = node.id === hoveredNode;
      const isSelected = node.id === selectedNode;
      const isPinned   = pinnedNodesRef.current.has(node.id);
      const isConn     = hasHover && connectedSet.has(node.id);
      const isFaded    = hasHover && !isConn;

      const baseRadius = getNodeRadius(node.influence_score);
      const radius = isHovered ? baseRadius * 1.25 : baseRadius;

      const nodeData = nodes.find((n) => n.id === node.id);
      const color = nodeData
        ? getNodeColor(nodeData.sentiment_by_round, currentRound)
        : sentimentColor(node.sentiment);

      // Selection ring
      if (isSelected && !isFaded) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Glow
      if ((isHovered || isSelected) && !isFaded) {
        ctx.shadowColor = color;
        ctx.shadowBlur = isHovered ? 30 : 18;
      }

      ctx.globalAlpha = isFaded ? 0.08 : 1;

      // Fill
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight shimmer
      if (!isFaded) {
        const grad = ctx.createRadialGradient(
          node.x - radius * 0.3, node.y - radius * 0.3, radius * 0.05,
          node.x, node.y, radius
        );
        grad.addColorStop(0, "rgba(255,255,255,0.22)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Border
      const border = getBorderStyle(node.agent_type);
      ctx.strokeStyle = isFaded ? "rgba(60,60,75,0.07)" : border.color;
      ctx.lineWidth = (isHovered || isSelected) ? 2.2 : 1.2;
      if (border.dash) ctx.setLineDash([3, 3]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Active pulse ring
      if (nodeData && !isFaded) {
        const activeEdges = graphLinksRef.current.filter((l) => {
          const s = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
          return (s === node.id || t === node.id) && l.active;
        });
        if (activeEdges.length > 0) {
          const pulse = (Math.sin(now / 360) + 1) / 2;
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.2 * pulse;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 5 + pulse * 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Pinned indicator — white pin dot
      if (isPinned && !isFaded) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(node.x, node.y - radius + 4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Label
      const showLabel =
        isHovered || isSelected || (node.influence_score > 65 && !isFaded && transform.k > 0.32);
      if (showLabel) {
        ctx.globalAlpha = isFaded ? 0.07 : 1;
        const fontSize = Math.max(9, 10.5 / Math.sqrt(transform.k));
        ctx.font = `${(isHovered || isSelected) ? "600 " : "400 "}${fontSize}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 6;
        ctx.fillStyle = isHovered ? "#FFFFFF" : "rgba(255,255,255,0.85)";
        ctx.fillText(node.name, node.x, node.y + radius + 14);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();

    // ── Tooltip (screen-space) ───────────────────────────────────────
    if (hoveredNode && !isDraggingRef.current) {
      const node = graphNodes.find((n) => n.id === hoveredNode);
      if (node && node.x != null && node.y != null) {
        const sx = transform.applyX(node.x);
        const sy = transform.applyY(node.y);
        const agent = agentMap.current.get(hoveredNode);
        if (agent) {
          const tw = 272, th = 108;
          let tx = sx + 20;
          let ty = sy - th / 2;
          if (tx + tw > width - 12) tx = sx - tw - 20;
          if (ty < 10) ty = 10;
          if (ty + th > height - 10) ty = height - th - 10;

          // Shadow
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 24;

          ctx.fillStyle = "rgba(10,10,20,0.97)";
          ctx.strokeStyle = "rgba(99,102,241,0.28)";
          ctx.lineWidth = 1;
          roundRect(ctx, tx, ty, tw, th, 12);
          ctx.fill();
          ctx.stroke();

          ctx.shadowBlur = 0;

          ctx.fillStyle = "#F1F5F9";
          ctx.font = "600 12.5px -apple-system, system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(agent.name, tx + 14, ty + 24);

          ctx.fillStyle = "rgba(148,163,184,0.72)";
          ctx.font = "11px -apple-system, system-ui, sans-serif";
          const persona =
            agent.persona.length > 56 ? agent.persona.slice(0, 56) + "…" : agent.persona;
          ctx.fillText(persona, tx + 14, ty + 42);

          ctx.fillStyle = sentimentColor(node.sentiment);
          ctx.font = "600 11px monospace";
          ctx.fillText(
            `Sentiment ${node.sentiment >= 0 ? "+" : ""}${node.sentiment.toFixed(2)}`,
            tx + 14, ty + 64
          );

          const rank =
            graphNodes
              .slice()
              .sort((a, b) => b.influence_score - a.influence_score)
              .findIndex((n) => n.id === hoveredNode) + 1;

          ctx.fillStyle = "rgba(148,163,184,0.55)";
          ctx.font = "10.5px -apple-system, sans-serif";
          const hint = pinnedNodesRef.current.has(hoveredNode)
            ? "📌 pinned — dbl-click to release"
            : "drag to pin  ·  dbl-click to release";
          ctx.fillText(`#${rank} influence`, tx + 14, ty + 84);
          ctx.fillText(hint, tx + 14, ty + 100);
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [dimensions, hoveredNode, selectedNode, currentRound, nodes]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // ── Interactions: Zoom + Drag + Pin ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    function findNodeAt(mx: number, my: number): GraphNode | null {
      const t = transformRef.current;
      const wx = (mx - t.x) / t.k;
      const wy = (my - t.y) / t.k;
      let best: GraphNode | null = null;
      let bestDist = Infinity;
      for (const node of graphNodesRef.current) {
        if (node.x == null || node.y == null) continue;
        const dx = node.x - wx, dy = node.y - wy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const r = getNodeRadius(node.influence_score) + 7;
        if (dist < r && dist < bestDist) { best = node; bestDist = dist; }
      }
      return best;
    }

    // D3 zoom — filter so dragging a node doesn't pan canvas
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.06, 12])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "mousedown") {
          const rect = canvas.getBoundingClientRect();
          return !findNodeAt(event.clientX - rect.left, event.clientY - rect.top);
        }
        return !event.button;
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
      });

    const sel = d3.select(canvas);
    sel.call(zoom);
    zoomBehaviorRef.current = zoom;
    selRef.current = sel;

    function onMouseMove(e: MouseEvent) {
      if (isDraggingRef.current) return;
      const rect = canvas!.getBoundingClientRect();
      const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      onHoverNode(node ? node.id : null);
      canvas!.style.cursor = node ? "pointer" : "grab";
    }

    function onMouseDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const node = findNodeAt(mx, my);
      mouseDownPosRef.current = { x: mx, y: my };
      mouseDownTimeRef.current = Date.now();
      if (node) {
        dragNodeRef.current = node;
        isDraggingRef.current = false;
        canvas!.style.cursor = "grabbing";
        // Gently wake sim — not full reheat
        simRef.current?.alphaTarget(0.06).restart();
      }
    }

    function onMouseDragGlobal(e: MouseEvent) {
      if (!dragNodeRef.current) return;
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = mx - mouseDownPosRef.current.x;
      const dy = my - mouseDownPosRef.current.y;
      if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) > 4) {
        isDraggingRef.current = true;
      }
      if (isDraggingRef.current) {
        const t = transformRef.current;
        const node = dragNodeRef.current;
        node.fx = (mx - t.x) / t.k;
        node.fy = (my - t.y) / t.k;
        onHoverNode(node.id);
        canvas!.style.cursor = "grabbing";
      }
    }

    function onMouseUp() {
      const node = dragNodeRef.current;
      simRef.current?.alphaTarget(0);

      if (node) {
        if (isDraggingRef.current) {
          // Drop = pin at position (Miro-style)
          pinnedNodesRef.current.add(node.id);
          onPinnedCountChange?.(pinnedNodesRef.current.size);
          // Keep fx/fy so it stays put
        } else {
          // Short tap = select
          const elapsed = Date.now() - mouseDownTimeRef.current;
          if (elapsed < 240) onSelectNode(node.id);
          // Release if not pinned
          if (!pinnedNodesRef.current.has(node.id)) {
            node.fx = null;
            node.fy = null;
          }
        }
      } else {
        // Click empty space = deselect
        const elapsed = Date.now() - mouseDownTimeRef.current;
        if (elapsed < 200) onSelectNode(null);
      }

      isDraggingRef.current = false;
      dragNodeRef.current = null;
      canvas!.style.cursor = "grab";
    }

    function onDblClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        // Unpin — release to sim
        node.fx = null;
        node.fy = null;
        pinnedNodesRef.current.delete(node.id);
        onPinnedCountChange?.(pinnedNodesRef.current.size);
        simRef.current?.alpha(0.25).restart();
      }
    }

    // Touch support
    let touchNode: GraphNode | null = null;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = canvas!.getBoundingClientRect();
      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;
      const node = findNodeAt(mx, my);
      if (node) {
        touchNode = node;
        simRef.current?.alphaTarget(0.06).restart();
        e.preventDefault();
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!touchNode || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = canvas!.getBoundingClientRect();
      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;
      const t = transformRef.current;
      touchNode.fx = (mx - t.x) / t.k;
      touchNode.fy = (my - t.y) / t.k;
      onHoverNode(touchNode.id);
      e.preventDefault();
    }

    function onTouchEnd() {
      if (touchNode) {
        pinnedNodesRef.current.add(touchNode.id);
        onPinnedCountChange?.(pinnedNodesRef.current.size);
        simRef.current?.alphaTarget(0);
        touchNode = null;
      }
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    const mouseUpHandler = () => onMouseUp();
    window.addEventListener("mousemove", onMouseDragGlobal);
    window.addEventListener("mouseup", mouseUpHandler);

    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("mousemove", onMouseDragGlobal);
      window.removeEventListener("mouseup", mouseUpHandler);
      sel.on(".zoom", null);
    };
  }, [dimensions, onHoverNode, onSelectNode, onPinnedCountChange]);

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "#09090F" }}
      />

      {/* Zoom Controls */}
      <div className="absolute right-4 bottom-28 z-20 flex flex-col gap-1.5">
        <div
          className="flex flex-col overflow-hidden"
          style={{
            background: "rgba(14,14,24,0.94)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            onClick={handleZoomIn}
            className="w-9 h-9 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.07] transition-colors text-[22px] font-extralight leading-none"
            title="Zoom in"
          >
            +
          </button>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />
          <button
            onClick={handleZoomOut}
            className="w-9 h-9 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.07] transition-colors text-[22px] font-extralight leading-none"
            title="Zoom out"
          >
            −
          </button>
        </div>
        <button
          onClick={handleFitView}
          className="w-9 h-9 flex items-center justify-center text-white/45 hover:text-white/80 transition-colors"
          style={{
            background: "rgba(14,14,24,0.94)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            backdropFilter: "blur(12px)",
          }}
          title="Fit all nodes in view"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Cluster force (very gentle — barely pulls) ───────────────────
function forceCluster(
  nodes: GraphNode[],
  width: number,
  height: number,
  strength: number = 0.0006
) {
  const centers: Record<number, { x: number; y: number }> = {
    0: { x: width * 0.3,  y: height * 0.38 },
    1: { x: width * 0.7,  y: height * 0.38 },
    2: { x: width * 0.5,  y: height * 0.68 },
  };
  return () => {
    for (const node of nodes) {
      if (node.fx != null) continue; // pinned nodes don't get cluster pull
      const c = centers[node.cluster_id] ?? { x: width / 2, y: height / 2 };
      if (node.x != null && node.y != null) {
        node.vx = (node.vx || 0) + (c.x - node.x) * strength;
        node.vy = (node.vy || 0) + (c.y - node.y) * strength;
      }
    }
  };
}
