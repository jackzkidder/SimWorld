"use client";

/**
 * MiniNetworkPreview
 * ------------------
 * An embedded, animated agent network that lives on the simulation results
 * page. It is intentionally lighter than the full NetworkClient: no filters,
 * no pinning, no d3-force — just a deterministic layout, smooth sentiment
 * tinting across rounds, and a Play button that reveals how opinions move.
 *
 * Click a node → opens the agent drilldown drawer (via onSelectAgent).
 * "Expand →" button routes to the full network view.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  role: string;
  platform: string;
  sentiment: string;
  influence_score: number;
  posts_count: number;
}

interface TimelinePoint {
  round: number;
  positive: number;
  negative: number;
  neutral: number;
  total_posts: number;
}

interface Props {
  agents: Agent[];
  timeline: TimelinePoint[];
  simulationId: string;
  onSelectAgent: (agent: Agent) => void;
}

// Deterministic hash → float in [0, 1]
function hash01(str: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function sentimentToScore(s: string): number {
  if (s === "positive") return 0.7;
  if (s === "negative") return -0.7;
  if (s === "mixed") return -0.2;
  return 0.0;
}

function colorForScore(s: number): string {
  if (s > 0.5) return "#22C55E";
  if (s > 0.15) return "#86EFAC";
  if (s > -0.15) return "#9CA3AF";
  if (s > -0.5) return "#FB923C";
  return "#EF4444";
}

// Interpolate two hex colors. Both must be #RRGGBB.
function lerpColor(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export default function MiniNetworkPreview({
  agents,
  timeline,
  simulationId,
  onSelectAgent,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [round, setRound] = useState(1);
  const totalRounds = Math.max(1, timeline.length || 20);

  // Cap displayed nodes so the preview stays legible
  const display = agents.slice(0, Math.min(agents.length, 80));

  // Pre-compute deterministic positions + per-agent sentiment trajectories.
  // Position is hash-based (no physics). Sentiment drifts from neutral to
  // each agent's final sentiment as rounds progress, modulated by the
  // simulation-wide timeline so the mass-mood feels consistent.
  const layoutRef = useRef<{
    id: string;
    x: number;
    y: number;
    r: number;
    trajectory: number[]; // length = totalRounds
    agent: Agent;
  }[]>([]);

  const edgesRef = useRef<[number, number][]>([]);

  useEffect(() => {
    const nodes = display.map((a) => {
      const finalScore = sentimentToScore(a.sentiment);
      // Position: polar layout with jitter so clusters form
      const cluster = hash01(a.id, 1);
      const clusterAngle = cluster * Math.PI * 2;
      const sentBias = finalScore; // positive goes right, negative left
      const angleJitter = (hash01(a.id, 2) - 0.5) * 1.4;
      const angle = clusterAngle + angleJitter;
      const rad = 0.25 + hash01(a.id, 3) * 0.7;
      const x = 0.5 + Math.cos(angle) * rad * 0.46 + sentBias * 0.02;
      const y = 0.5 + Math.sin(angle) * rad * 0.38;
      const r = 2.5 + (a.influence_score / 100) * 7;

      // Trajectory: interpolate from 0 → finalScore, perturbed by timeline mood
      const trajectory: number[] = [];
      for (let i = 0; i < totalRounds; i++) {
        const t = (i + 1) / totalRounds;
        const tp = timeline[Math.min(i, timeline.length - 1)];
        const moodShift = tp
          ? (tp.positive - tp.negative) / Math.max(1, tp.positive + tp.negative + tp.neutral)
          : 0;
        const base = finalScore * t;
        const mood = moodShift * 0.25 * (1 - Math.abs(finalScore));
        const noise = (hash01(a.id, 100 + i) - 0.5) * 0.08;
        trajectory.push(Math.max(-1, Math.min(1, base + mood + noise)));
      }
      return { id: a.id, x, y, r, trajectory, agent: a };
    });
    layoutRef.current = nodes;

    // Build edges: each node connects to ~2 nearest (by hash proximity)
    const edges: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let k = 1; k <= 2; k++) {
        const j = (i + 1 + Math.floor(hash01(nodes[i].id, 50 + k) * (nodes.length - 1))) % nodes.length;
        if (i !== j) edges.push([i, j]);
      }
    }
    edgesRef.current = edges;
  }, [display, timeline, totalRounds]);

  // Draw
  const draw = useCallback((r: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== W * DPR || canvas.height !== H * DPR) {
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    ctx.clearRect(0, 0, W, H);

    const nodes = layoutRef.current;
    const edges = edgesRef.current;
    if (!nodes.length) return;

    const roundIdx = Math.max(0, Math.min(totalRounds - 1, Math.floor(r) - 1));

    // Edges first
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    for (const [i, j] of edges) {
      const a = nodes[i], b = nodes[j];
      ctx.beginPath();
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke();
    }

    // Nodes
    for (const n of nodes) {
      const score = n.trajectory[roundIdx];
      const target = colorForScore(score);
      // Soft glow
      const cx = n.x * W, cy = n.y * H;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, n.r * 3.2);
      grd.addColorStop(0, hexA(target, 0.45));
      grd.addColorStop(1, hexA(target, 0));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, n.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.fillStyle = lerpColor("#1a1f2b", target, 0.85);
      ctx.beginPath();
      ctx.arc(cx, cy, n.r, 0, Math.PI * 2);
      ctx.fill();
      // Thin ring
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }, [totalRounds]);

  // Redraw when round changes
  useEffect(() => {
    draw(round);
  }, [round, draw]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => draw(round));
    ro.observe(el);
    return () => ro.disconnect();
  }, [round, draw]);

  // Playback
  useEffect(() => {
    if (!isPlaying) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      if (dt > 280) {
        last = now;
        setRound((r) => {
          if (r >= totalRounds) {
            setIsPlaying(false);
            return totalRounds;
          }
          return r + 1;
        });
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, totalRounds]);

  const handlePlayToggle = () => {
    if (round >= totalRounds) {
      setRound(1);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  };

  // Click detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    // Find nearest node within 14px
    let best: { dist: number; agent: Agent } | null = null;
    for (const n of layoutRef.current) {
      const dx = n.x * W - mx;
      const dy = n.y * H - my;
      const d = Math.hypot(dx, dy);
      if (d < Math.max(14, n.r + 6) && (!best || d < best.dist)) {
        best = { dist: d, agent: n.agent };
      }
    }
    if (best) onSelectAgent(best.agent);
  };

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-medium text-white/85">Live simulation</h3>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              color: "rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            round {round} / {totalRounds}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayToggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
            style={{
              background: isPlaying ? "rgba(255,255,255,0.06)" : "rgba(39,180,120,0.12)",
              color: isPlaying ? "rgba(255,255,255,0.7)" : "#27B478",
              border: `1px solid ${isPlaying ? "rgba(255,255,255,0.08)" : "rgba(39,180,120,0.25)"}`,
            }}
          >
            {isPlaying ? (
              <>
                <svg width="9" height="9" viewBox="0 0 8 8" fill="currentColor">
                  <rect x="1" y="1" width="2" height="6" />
                  <rect x="5" y="1" width="2" height="6" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg width="9" height="9" viewBox="0 0 8 8" fill="currentColor">
                  <path d="M2 1l5 3-5 3z" />
                </svg>
                {round >= totalRounds ? "Replay" : round > 1 ? "Resume" : "Play"}
              </>
            )}
          </button>
          <Link
            href={`/simulation/${simulationId}/network`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:bg-white/5"
            style={{
              color: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Expand
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 3h4v4M13 3L7 9M7 13H3V9" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative" style={{ height: 280, background: "radial-gradient(ellipse at center, rgba(39,180,120,0.04) 0%, transparent 60%)" }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full h-full cursor-pointer"
        />
        {/* Corner stat */}
        <div
          className="absolute bottom-2.5 left-3 text-[10px] font-mono pointer-events-none"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          {display.length} of {agents.length} agents · click a node to inspect
        </div>
      </div>

      {/* Scrubber */}
      <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <input
          type="range"
          min={1}
          max={totalRounds}
          value={round}
          onChange={(e) => {
            setIsPlaying(false);
            setRound(parseInt(e.target.value, 10));
          }}
          className="w-full accent-emerald-400"
          style={{ height: 3 }}
        />
      </div>
    </div>
  );
}

// hex (#RRGGBB) with alpha
function hexA(hex: string, a: number): string {
  // Accept "rgb(...)" fallback from lerpColor by mapping to plain rgba
  if (hex.startsWith("rgb(")) {
    return hex.replace("rgb(", "rgba(").replace(")", `,${a})`);
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
