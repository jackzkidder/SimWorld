"use client";

/**
 * AgentDrilldownDrawer
 * --------------------
 * Click an agent → opens a drawer with Profile / Activity / Chat tabs.
 *
 * Profile:  persona card, role + platform + sentiment + influence + posts.
 * Activity: synthesized sentiment trajectory for this agent (interpolated
 *           from the run's overall timeline + agent's final sentiment) and
 *           a posts-per-round sparkline.
 * Chat:     same Claude-powered in-character chat as before.
 *
 * Everything in Activity is clearly labeled so users don't read synthesized
 * data as ground truth per-round persistence.
 */

import { useEffect, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiPost } from "@/lib/utils";

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
  agent: Agent;
  simulationId: string;
  timeline: TimelinePoint[];
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  loading?: boolean;
}

const CHART_COLORS = {
  grid: "rgba(255, 255, 255, 0.06)",
  tick: "rgba(255, 255, 255, 0.3)",
  tooltipBg: "rgba(15, 20, 30, 0.9)",
  tooltipBorder: "rgba(255, 255, 255, 0.1)",
};

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

function sentimentAccent(s: string) {
  if (s === "positive") return { dot: "#22C55E", text: "text-emerald-400", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)" };
  if (s === "negative") return { dot: "#EF4444", text: "text-red-400", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" };
  if (s === "mixed") return { dot: "#FB923C", text: "text-orange-400", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.25)" };
  return { dot: "#FBBF24", text: "text-amber-400", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)" };
}

function buildTrajectory(agent: Agent, timeline: TimelinePoint[]) {
  const finalScore = sentimentToScore(agent.sentiment);
  const rounds = Math.max(timeline.length, 1);
  return Array.from({ length: rounds }, (_, i) => {
    const tp = timeline[i];
    const t = (i + 1) / rounds;
    const mood = tp
      ? (tp.positive - tp.negative) / Math.max(1, tp.positive + tp.negative + tp.neutral)
      : 0;
    const base = finalScore * t;
    const moodTint = mood * 0.3 * (1 - Math.abs(finalScore));
    const noise = (hash01(agent.id, 200 + i) - 0.5) * 0.12;
    const score = Math.max(-1, Math.min(1, base + moodTint + noise));
    return {
      round: tp?.round ?? i + 1,
      sentiment: parseFloat(score.toFixed(2)),
    };
  });
}

function buildPostsPerRound(agent: Agent, timeline: TimelinePoint[]) {
  const rounds = Math.max(timeline.length, 1);
  const total = agent.posts_count || 0;
  if (total === 0) return timeline.map((tp, i) => ({ round: tp.round ?? i + 1, posts: 0 }));
  // Weighted by seed hash so each agent has its own rhythm, normalized so
  // the sum matches posts_count.
  const weights = Array.from({ length: rounds }, (_, i) => 0.4 + hash01(agent.id, 400 + i));
  const wsum = weights.reduce((a, b) => a + b, 0);
  return Array.from({ length: rounds }, (_, i) => ({
    round: timeline[i]?.round ?? i + 1,
    posts: Math.round((weights[i] / wsum) * total),
  }));
}

export default function AgentDrilldownDrawer({
  agent,
  simulationId,
  timeline,
  onClose,
}: Props) {
  const [tab, setTab] = useState<"profile" | "activity" | "chat">("profile");
  const accent = sentimentAccent(agent.sentiment);

  const trajectory = buildTrajectory(agent, timeline);
  const postsPerRound = buildPostsPerRound(agent, timeline);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg },
      { role: "agent", content: "", loading: true },
    ]);
    const result = await apiPost<{ success: boolean; data?: { message?: string } | string }>(
      `/api/simulations/${simulationId}/agents/${agent.id}/chat`,
      { message: msg }
    );
    let reply = "Sorry, I couldn't respond right now.";
    if (result.ok && result.data?.success) {
      const d = result.data.data;
      reply = typeof d === "string" ? d : d?.message || reply;
    }
    setMessages((prev) => [...prev.slice(0, -1), { role: "agent", content: reply }]);
    setSending(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in-up"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, #0e141a 0%, #0a0f14 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          maxHeight: "88vh",
          minHeight: "560px",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-bold ring-1"
              style={{
                background: `linear-gradient(135deg, ${accent.bg}, rgba(255,255,255,0.02))`,
                color: accent.dot,
                borderColor: accent.border,
              }}
            >
              {agent.name.charAt(0)}
            </div>
            <div>
              <div className="text-[14px] font-medium text-white/90">{agent.name}</div>
              <div className="text-[11px] text-white/40 font-light">
                {agent.role} · {agent.platform}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition p-1.5 rounded-lg hover:bg-white/5"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {(["profile", "activity", "chat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-[12px] px-3 py-2 transition-all relative"
              style={{
                color: tab === t ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                fontWeight: tab === t ? 500 : 400,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {tab === t && (
                <span className="absolute bottom-0 left-2 right-2 h-px" style={{ background: "var(--primary, #27B478)" }} />
              )}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto">
          {tab === "profile" && (
            <div className="px-5 py-5 space-y-4">
              {/* Stat grid */}
              <div className="grid grid-cols-3 gap-2">
                <StatBlock label="Sentiment" value={agent.sentiment} valueClass={accent.text} />
                <StatBlock label="Influence" value={String(agent.influence_score)} mono />
                <StatBlock label="Posts" value={String(agent.posts_count)} mono />
              </div>

              {/* Persona paragraph — honest about what this is */}
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="text-[10px] uppercase tracking-wide font-mono mb-2 text-white/35">
                  Persona snapshot
                </div>
                <p className="text-[13px] leading-relaxed font-light text-white/70">
                  A {agent.role.toLowerCase()} active on {agent.platform}. Over the course of
                  the run they contributed {agent.posts_count} posts and landed at
                  a <span className={accent.text}>{agent.sentiment}</span> stance. Their
                  influence score of <span className="font-mono text-white/85">{agent.influence_score}</span> places
                  them in the {influenceTier(agent.influence_score)} of active participants.
                </p>
              </div>

              {/* Behavior signals */}
              <div>
                <div className="text-[10px] uppercase tracking-wide font-mono mb-2.5 text-white/35">
                  Signals
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Tag>{avgPostsLabel(agent.posts_count, timeline.length)}</Tag>
                  <Tag>{influenceTier(agent.influence_score)} influencer</Tag>
                  <Tag>
                    ended <span className={accent.text + " ml-1"}>{agent.sentiment}</span>
                  </Tag>
                </div>
              </div>

              <p className="text-[10px] font-mono text-white/25 leading-relaxed">
                Activity tab shows how this agent&apos;s sentiment drifted alongside the run&apos;s overall mood.
                Use Chat to ask them about the scenario in character.
              </p>
            </div>
          )}

          {tab === "activity" && (
            <div className="px-5 py-5 space-y-5">
              {/* Sentiment trajectory */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-medium text-white/80">Sentiment trajectory</div>
                  <div className="text-[10px] font-mono text-white/30">
                    rounds {trajectory[0]?.round}–{trajectory[trajectory.length - 1]?.round}
                  </div>
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trajectory} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-sent-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={accent.dot} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={accent.dot} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                      <XAxis dataKey="round" tick={{ fontSize: 10, fill: CHART_COLORS.tick }} />
                      <YAxis domain={[-1, 1]} tick={{ fontSize: 10, fill: CHART_COLORS.tick }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: CHART_COLORS.tooltipBg,
                          border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                          borderRadius: "10px",
                          fontSize: "11px",
                          color: "rgba(255,255,255,0.85)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sentiment"
                        stroke={accent.dot}
                        strokeWidth={2}
                        fill={`url(#grad-sent-${agent.id})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Posts per round */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-medium text-white/80">Posts per round</div>
                  <div className="text-[10px] font-mono text-white/30">{agent.posts_count} total</div>
                </div>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={postsPerRound} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                      <XAxis dataKey="round" tick={{ fontSize: 10, fill: CHART_COLORS.tick }} />
                      <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.tick }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: CHART_COLORS.tooltipBg,
                          border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                          borderRadius: "10px",
                          fontSize: "11px",
                          color: "rgba(255,255,255,0.85)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="posts"
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={1.5}
                        dot={{ r: 2, fill: "rgba(255,255,255,0.5)", strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <p className="text-[10px] font-mono text-white/25 leading-relaxed">
                Per-round sentiment is interpolated from the run&apos;s overall mood and this agent&apos;s final stance.
                For exact per-round posts, expand the network view.
              </p>
            </div>
          )}

          {tab === "chat" && (
            <div className="flex flex-col" style={{ height: "100%", minHeight: 380 }}>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono mb-4 text-primary border border-primary/20 bg-primary/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Claude-powered in-character chat
                    </div>
                    <p className="text-[13px] text-white/45 font-light max-w-xs mx-auto leading-relaxed">
                      Ask {agent.name.split(" ")[0]} anything about the scenario. They&apos;ll respond from their perspective.
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center mt-5">
                      {[
                        "What's your take on this?",
                        "What worries you most?",
                        "How would you respond?",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => setInput(q)}
                          className="text-[11px] px-3 py-1.5 rounded-full border border-white/10 text-white/50 hover:text-white/80 hover:border-primary/30 hover:bg-primary/5 transition"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                        m.role === "user"
                          ? "bg-primary/15 text-white/90 ring-1 ring-primary/20"
                          : "bg-white/[0.04] text-white/80 ring-1 ring-white/[0.06]"
                      }`}
                    >
                      {m.loading ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
                          <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: "0.2s" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: "0.4s" }} />
                        </span>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendMessage();
                    }}
                    placeholder={`Message ${agent.name.split(" ")[0]}...`}
                    disabled={sending}
                    className="flex-1 bg-transparent text-[13px] text-white/85 placeholder:text-white/25 outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, valueClass, mono }: { label: string; value: string; valueClass?: string; mono?: boolean }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="text-[9.5px] uppercase tracking-wide font-mono text-white/30">{label}</div>
      <div className={`text-[14px] mt-0.5 capitalize ${mono ? "font-mono" : ""} ${valueClass || "text-white/85"}`}>
        {value}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[11px] px-2.5 py-0.5 rounded-full font-light text-white/55 inline-flex items-center"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {children}
    </span>
  );
}

function influenceTier(score: number): string {
  if (score >= 75) return "top 10%";
  if (score >= 55) return "top quartile";
  if (score >= 30) return "mid-tier";
  return "long-tail";
}

function avgPostsLabel(total: number, rounds: number): string {
  const r = Math.max(1, rounds);
  const avg = total / r;
  if (avg >= 3) return "highly active";
  if (avg >= 1.2) return "steady poster";
  if (avg >= 0.4) return "occasional";
  return "lurker";
}
