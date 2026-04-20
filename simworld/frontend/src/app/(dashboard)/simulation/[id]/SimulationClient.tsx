"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL, apiGet } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import MiniNetworkPreview from "@/components/results/MiniNetworkPreview";
import AgentDrilldownDrawer from "@/components/results/AgentDrilldownDrawer";

interface SimulationData {
  simulation_id: string;
  project_name: string;
  status: string;
  stage: string;
  stage_message: string;
  progress: number;
  prediction_question: string;
  agent_count: number;
  platforms: string;
  created_at: string;
  result: SimulationResult | null;
  error: string | null;
}

interface SimulationResult {
  executive_summary: {
    overall_sentiment: string;
    sentiment_score: number;
    risk_tier: string;
    confidence: number;
    top_narratives: string[];
    recommended_actions: string[];
  };
  timeline: TimelinePoint[];
  narratives: Narrative[];
  inflection_points: InflectionPoint[];
  agents: Agent[];
  stats: {
    total_agents: number;
    total_rounds: number;
    total_posts: number;
    total_interactions: number;
    sentiment_breakdown: Record<string, number>;
  };
}

interface TimelinePoint {
  round: number;
  positive: number;
  negative: number;
  neutral: number;
  total_posts: number;
}

interface Narrative {
  id: string;
  label: string;
  sentiment: string;
  agent_count: number;
  description: string;
  key_themes: string[];
}

interface InflectionPoint {
  round: number;
  description: string;
  sentiment_shift: number;
  trigger: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  platform: string;
  sentiment: string;
  influence_score: number;
  posts_count: number;
}

const STAGE_INFO: Record<string, { label: string; detail: string; time: string }> = {
  graph_building: {
    label: "Building knowledge graph",
    detail: "Extracting entities and relationships from your seed material",
    time: "~5s",
  },
  generating_agents: {
    label: "Generating agent personas",
    detail: "Creating unique personalities, backgrounds, and social connections",
    time: "~3s",
  },
  simulating: {
    label: "Agents are debating",
    detail: "Agents are posting, replying, and forming opinions in real-time",
    time: "~5s",
  },
  analyzing: {
    label: "Analyzing results",
    detail: "Detecting narrative clusters, inflection points, and sentiment shifts",
    time: "~3s",
  },
  compiling_report: {
    label: "Compiling your report",
    detail: "Generating executive summary and recommended actions",
    time: "~2s",
  },
};

/* Chart theme colors — dark glass palette */
const CHART_COLORS = {
  grid: "rgba(255, 255, 255, 0.06)",
  tick: "rgba(255, 255, 255, 0.3)",
  tooltipBg: "rgba(15, 20, 30, 0.9)",
  tooltipBorder: "rgba(255, 255, 255, 0.1)",
  positive: "#4ade80",
  negative: "#f87171",
  neutral: "#fbbf24",
  mixed: "#fb923c",
};

export default function SimulationClient() {
  const params = useParams();
  const id = params.id as string;
  const [sim, setSim] = useState<SimulationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "agents" | "narratives">("overview");
  const [copied, setCopied] = useState(false);
  const [drilldownAgent, setDrilldownAgent] = useState<Agent | null>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const result = await apiGet<{ success: boolean; data: SimulationData }>(`/api/simulations/${id}`);
    if (result.ok && result.data?.success) {
      setSim(result.data.data);
      setFetchError(null);
    } else if (!sim) {
      // Only show error on initial load, not during polling
      setFetchError(result.error || "Could not load simulation");
    }
    setLoading(false);
  }, [id, sim]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (sim?.status === "running" || sim?.status === "queued") {
        fetchData();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchData, sim?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError && !sim) {
    return (
      <div className="text-center py-24">
        <p className="text-[15px] mb-4" style={{ color: 'rgba(185,28,28,0.9)' }}>{fetchError}</p>
        <Link href="/dashboard" className="text-primary text-[14px] hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl font-bold mb-2">Simulation Not Found</h2>
        <Link href="/dashboard" className="text-primary text-sm hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (sim.status !== "completed") {
    return <ProgressScreen sim={sim} />;
  }

  const result = sim.result!;

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/dashboard"
            className="text-[13px] mb-2 inline-flex items-center gap-1 transition-colors hover:text-primary text-white/35"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 4l-4 4 4 4" /></svg>
            Dashboard
          </Link>
          <h1 className="font-serif text-[22px] font-normal tracking-[-0.02em] text-white/90">{sim.project_name}</h1>
          <p className="text-[13px] mt-1 leading-relaxed max-w-xl font-light text-white/40">
            {sim.prediction_question}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`${API_BASE_URL}/api/simulations/${id}/pdf`, "_blank")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PDF
          </button>
          <button
            onClick={async () => {
              const url = `${window.location.origin}/simulation/${id}`;
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            {copied ? "Copied!" : "Share"}
          </button>
          <Link
            href={`/simulation/${id}/network`}
            className="bg-primary text-white flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium hover:opacity-90 transition-all shadow-md shadow-primary/20"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="2" />
              <circle cx="6" cy="6" r="2" />
              <circle cx="18" cy="6" r="2" />
              <circle cx="6" cy="18" r="2" />
              <circle cx="18" cy="18" r="2" />
              <line x1="8" y1="8" x2="10" y2="10" />
              <line x1="14" y1="10" x2="16" y2="8" />
              <line x1="8" y1="16" x2="10" y2="14" />
              <line x1="14" y1="14" x2="16" y2="16" />
            </svg>
            Network
          </Link>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label="Sentiment"
          value={result.executive_summary.overall_sentiment.replace("_", " ")}
          color={
            result.executive_summary.sentiment_score > 0
              ? "text-emerald-400"
              : result.executive_summary.sentiment_score < 0
              ? "text-red-400"
              : "text-amber-400"
          }
        />
        <SummaryCard
          label="Risk Tier"
          value={result.executive_summary.risk_tier.toUpperCase()}
          color={
            result.executive_summary.risk_tier === "low"
              ? "text-emerald-400"
              : result.executive_summary.risk_tier === "high"
              ? "text-red-400"
              : "text-amber-400"
          }
        />
        <SummaryCard
          label="Confidence"
          value={`${Math.round(result.executive_summary.confidence * 100)}%`}
          color="text-primary"
        />
        <SummaryCard
          label="Agents / Posts"
          value={`${result.stats.total_agents} / ${result.stats.total_posts}`}
          color="text-white/50"
        />
      </div>

      {/* Top Narratives */}
      <div className="rounded-xl p-6 mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
        <h3 className="text-[13px] font-medium mb-3 text-white/85">Top Narratives</h3>
        <ol className="space-y-2">
          {result.executive_summary.top_narratives.map((n, i) => (
            <li key={i} className="text-[13px] flex items-center gap-2.5 font-light text-white/45">
              <span className="text-primary font-mono text-[11px] font-semibold w-4">{i + 1}.</span>
              {n}
            </li>
          ))}
        </ol>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {(["overview", "agents", "narratives"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-200"
            style={activeTab === tab
              ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }
              : { color: 'rgba(255,255,255,0.35)' }
            }
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          result={result}
          simulationId={sim.simulation_id}
          onSelectAgent={setDrilldownAgent}
        />
      )}
      {activeTab === "agents" && (
        <AgentsTab
          agents={result.agents}
          onSelectAgent={setDrilldownAgent}
        />
      )}
      {activeTab === "narratives" && <NarrativesTab narratives={result.narratives} inflections={result.inflection_points} />}

      {drilldownAgent && (
        <AgentDrilldownDrawer
          agent={drilldownAgent}
          simulationId={sim.simulation_id}
          timeline={result.timeline}
          onClose={() => setDrilldownAgent(null)}
        />
      )}

      {/* Recommended Actions */}
      <div className="rounded-xl p-6 mt-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
        <h3 className="text-[13px] font-medium mb-4 text-white/85">Recommended Actions</h3>
        <ul className="space-y-3">
          {result.executive_summary.recommended_actions.map((action, i) => (
            <li key={i} className="text-[13px] flex gap-3 items-start">
              <span className="w-5 h-5 rounded-full text-primary text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(39,180,120,0.08)', border: '0.8px solid rgba(39,180,120,0.15)' }}>
                {i + 1}
              </span>
              <span className="font-light leading-relaxed text-white/45">{action}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ============= Sub-components ============= */

function ProgressScreen({ sim }: { sim: SimulationData }) {
  const stages = ["graph_building", "generating_agents", "simulating", "analyzing", "compiling_report"];
  const currentIdx = stages.indexOf(sim.stage);
  const completedStages = Math.max(0, currentIdx);
  const totalEstimate = 18;
  const elapsed = completedStages * 3.5;
  const remaining = Math.max(0, Math.round(totalEstimate - elapsed));

  return (
    <div className="max-w-md mx-auto py-20 text-center animate-fade-in-up">
      <Link
        href="/dashboard"
        className="text-[13px] mb-8 inline-flex items-center gap-1 transition-colors font-light text-white/35"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 4l-4 4 4 4" /></svg>
        Dashboard
      </Link>
      <h1 className="font-serif text-[22px] font-normal mb-2 tracking-[-0.02em] text-white/90">{sim.project_name}</h1>
      <p className="text-[13px] mb-10 leading-relaxed font-light text-white/40">
        {sim.prediction_question}
      </p>

      {sim.status === "failed" ? (
        <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(239,68,68,0.2)", backdropFilter: "blur(12px)" }}>
          <div className="text-red-500 font-semibold mb-2">Simulation Failed</div>
          <p className="text-sm font-light text-white/50">{sim.error}</p>
        </div>
      ) : (
        <>
          <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${sim.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] mb-8 font-mono text-white/30">
            <span>{sim.progress}%</span>
            <span>{remaining > 0 ? `~${remaining}s remaining` : "Almost done..."}</span>
          </div>

          <div className="space-y-1.5 text-left">
            {stages.map((stage, i) => {
              const info = STAGE_INFO[stage];
              const isActive = i === currentIdx;
              const isDone = i < currentIdx;
              return (
                <div
                  key={stage}
                  className={`flex items-start gap-3 py-3 px-4 rounded-xl transition-all duration-300 ${
                    isDone
                      ? "opacity-50"
                      : !isActive
                      ? "opacity-20"
                      : ""
                  }`}
                style={isActive ? { background: 'rgba(39,180,120,0.05)', border: '0.8px solid rgba(39,180,120,0.15)' } : undefined}
                >
                  <div className="w-5 h-5 flex items-center justify-center mt-0.5 shrink-0">
                    {isDone ? (
                      <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 8 7 12 13 4" /></svg>
                    ) : isActive ? (
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-white/85">{info?.label || stage}</span>
                      <span className="text-[10px] font-mono text-white/30">{info?.time}</span>
                    </div>
                    {isActive && info?.detail && (
                      <p className="text-[12px] mt-0.5 leading-relaxed font-light text-white/45">{info.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function OverviewTab({
  result,
  simulationId,
  onSelectAgent,
}: {
  result: SimulationResult;
  simulationId: string;
  onSelectAgent: (a: Agent) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Embedded animated network — the "run the future" payoff, surfaced */}
      <MiniNetworkPreview
        agents={result.agents}
        timeline={result.timeline}
        simulationId={simulationId}
        onSelectAgent={onSelectAgent}
      />

      {/* Sentiment Over Time — stacked area so composition is legible at a glance */}
      <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
        <h3 className="font-medium text-sm mb-5 text-white/85">Sentiment Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.timeline} stackOffset="expand">
              <defs>
                <linearGradient id="grad-pos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.positive} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={CHART_COLORS.positive} stopOpacity={0.35} />
                </linearGradient>
                <linearGradient id="grad-neu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.neutral} stopOpacity={0.55} />
                  <stop offset="95%" stopColor={CHART_COLORS.neutral} stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id="grad-neg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.negative} stopOpacity={0.65} />
                  <stop offset="95%" stopColor={CHART_COLORS.negative} stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="round"
                tick={{ fontSize: 10, fill: CHART_COLORS.tick }}
                label={{ value: "Round", position: "insideBottom", offset: -4, fontSize: 10, fill: CHART_COLORS.tick }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: CHART_COLORS.tick }}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: CHART_COLORS.tooltipBg,
                  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                  borderRadius: "12px",
                  fontSize: "11px",
                  backdropFilter: "blur(12px)",
                  color: "rgba(255,255,255,0.85)",
                }}
                formatter={(value, name, entry) => {
                  const v = typeof value === "number" ? value : Number(value) || 0;
                  const p = (entry as { payload?: TimelinePoint } | undefined)?.payload;
                  const total = p ? (p.positive + p.negative + p.neutral) : 0;
                  const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                  return [`${v} (${pct}%)`, name] as [string, string | number];
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
              <Area
                type="monotone"
                dataKey="positive"
                stackId="1"
                stroke={CHART_COLORS.positive}
                strokeWidth={1.2}
                fill="url(#grad-pos)"
              />
              <Area
                type="monotone"
                dataKey="neutral"
                stackId="1"
                stroke={CHART_COLORS.neutral}
                strokeWidth={1.2}
                fill="url(#grad-neu)"
              />
              <Area
                type="monotone"
                dataKey="negative"
                stackId="1"
                stroke={CHART_COLORS.negative}
                strokeWidth={1.2}
                fill="url(#grad-neg)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] font-mono text-white/25 mt-3">
          Stacked share of sentiment per round. The full height is normalized so composition reads at a glance.
        </p>
      </div>

      {/* Inflection Points */}
      <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
        <h3 className="font-medium text-sm mb-5 text-white/85">Key Inflection Points</h3>
        <div className="space-y-4">
          {result.inflection_points.map((ip, i) => (
            <div key={i} className="flex gap-4" style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' } : undefined}>
              <div className="text-[11px] font-mono text-primary whitespace-nowrap pt-0.5 font-semibold">
                R{ip.round}
              </div>
              <div>
                <div className="text-[13px] font-medium text-white/85">{ip.description}</div>
                <div className="text-[12px] mt-0.5 font-light text-white/40">
                  {ip.trigger} &middot;{" "}
                  <span className={ip.sentiment_shift > 0 ? "text-emerald-400" : "text-red-400"}>
                    {ip.sentiment_shift > 0 ? "+" : ""}{ip.sentiment_shift}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentsTab({ agents, onSelectAgent }: { agents: Agent[]; onSelectAgent: (a: Agent) => void }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? agents : agents.filter((a) => a.sentiment === filter);
  const topAgents = [...filtered].sort((a, b) => b.influence_score - a.influence_score);

  return (
    <div>
      <div className="flex gap-1.5 mb-5">
        {["all", "positive", "negative", "neutral"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[12px] px-3 py-1.5 rounded-full font-medium transition-all duration-200 ${
              filter === f
                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                : "hover:bg-white/5"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}{" "}
            <span className="opacity-50">
              {f === "all"
                ? agents.length
                : agents.filter((a) => a.sentiment === f).length}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
        {topAgents.slice(0, 20).map((agent, idx) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className="w-full px-5 py-3.5 flex items-center justify-between transition-all hover:bg-white/[0.05] text-left group"
            style={idx > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[11px] font-bold text-primary ring-1 ring-primary/15">
                {agent.name.charAt(0)}
              </div>
              <div>
                <div className="text-[13px] font-medium text-white/85">{agent.name}</div>
                <div className="text-[11px] font-light text-white/35">
                  {agent.role} &middot; {agent.platform}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-mono text-white/35">{agent.posts_count} posts</div>
              <div className="text-[11px] font-mono text-white/20">{agent.influence_score}</div>
              <SentimentDot sentiment={agent.sentiment} />
              <span className="text-[11px] text-white/0 group-hover:text-primary transition-colors font-mono">inspect →</span>
            </div>
          </button>
        ))}
      </div>
      {filtered.length > 20 && (
        <p className="text-[12px] text-center mt-4 font-light text-white/35">
          Showing 20 of {filtered.length} agents
        </p>
      )}
    </div>
  );
}

function NarrativesTab({ narratives }: { narratives: Narrative[]; inflections?: InflectionPoint[] }) {
  return (
    <div className="space-y-3">
      {narratives.map((n) => (
        <div key={n.id} className="rounded-xl p-5 transition-all duration-300" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-[13px] text-white/85">{n.label}</h3>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-mono text-white/30">
                {n.agent_count} agents
              </span>
              <SentimentDot sentiment={n.sentiment} />
            </div>
          </div>
          <p className="text-[13px] mb-3 leading-relaxed font-light text-white/45">{n.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {n.key_themes.map((theme) => (
              <span
                key={theme}
                className="text-[11px] px-2.5 py-0.5 rounded-full font-light text-white/40"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============= Utility components ============= */

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[11px] mb-1.5 uppercase tracking-wide font-mono text-white/30">{label}</div>
      <div className={`text-lg font-bold capitalize tracking-tight ${color}`}>{value}</div>
    </div>
  );
}


function SentimentDot({ sentiment }: { sentiment: string }) {
  const color =
    sentiment === "positive" ? "bg-emerald-400"
      : sentiment === "negative" ? "bg-red-400"
      : sentiment === "mixed" ? "bg-orange-400"
      : "bg-amber-400";
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}
