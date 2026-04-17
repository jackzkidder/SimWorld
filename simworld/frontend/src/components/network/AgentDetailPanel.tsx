"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AgentDetail } from "@/lib/mock-network-data";
import { getMockAgentDetail } from "@/lib/mock-network-data";
import { API_BASE_URL } from "@/lib/utils";

interface AgentDetailPanelProps {
  agentId: string | null;
  simulationId: string;
  onClose: () => void;
}

function sentimentColor(s: number): string {
  if (s > 0.5) return "#22C55E";
  if (s > 0.15) return "#86EFAC";
  if (s > -0.15) return "#6B7280";
  if (s > -0.5) return "#FB923C";
  return "#EF4444";
}

function agentTypeBadge(type: string) {
  const styles: Record<string, string> = {
    general_public: "bg-white/10 text-white/70",
    media: "bg-yellow-500/20 text-yellow-400",
    adversarial: "bg-red-500/20 text-red-400",
    institutional: "bg-blue-500/20 text-blue-400",
    seed: "bg-amber-500/20 text-amber-400",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${styles[type] || styles.general_public}`}>
      {type.replace("_", " ")}
    </span>
  );
}

export default function AgentDetailPanel({ agentId, simulationId, onClose }: AgentDetailPanelProps) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [activeSection, setActiveSection] = useState<"timeline" | "activity" | "connections" | "chat">("timeline");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "agent"; message: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (!agentId) {
      setDetail(null);
      setChatHistory([]);
      return;
    }
    // Use mock data for now
    const d = getMockAgentDetail(agentId);
    setDetail(d);
    setChatHistory([]);
  }, [agentId]);

  async function handleChat() {
    if (!chatInput.trim() || !agentId || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", message: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/simulation/${simulationId}/agent/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: chatHistory }),
      });
      const data = await res.json();
      if (data.success) {
        setChatHistory((prev) => [...prev, { role: "agent", message: data.data.reply }]);
      } else {
        setChatHistory((prev) => [...prev, { role: "agent", message: "I'm having trouble responding right now." }]);
      }
    } catch {
      // Generate mock response
      const mockResponses = [
        `That's an interesting question. Based on my experience as a ${detail?.profile.occupation || "professional"}, I think the situation is more nuanced than most people realize.`,
        `I've been following this closely. My position hasn't changed much — I still think we need to be ${detail?.profile.cluster_id === 0 ? "optimistic but careful" : detail?.profile.cluster_id === 1 ? "much more critical of the claims being made" : "patient and wait for more evidence"}.`,
        `From what I've seen in my community in ${detail?.profile.location || "my area"}, the reaction has been mixed. People are concerned but also curious.`,
      ];
      const reply = mockResponses[chatHistory.length % mockResponses.length];
      setChatHistory((prev) => [...prev, { role: "agent", message: reply }]);
    } finally {
      setChatLoading(false);
    }
  }

  if (!agentId) return null;

  return (
    <AnimatePresence>
      {agentId && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute right-0 top-0 bottom-0 w-[400px] bg-[#0D0D15]/95 backdrop-blur-xl border-l border-white/10 flex flex-col z-50 overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors z-10"
          >
            ✕
          </button>

          {detail ? (
            <>
              {/* Agent Header */}
              <div className="p-5 border-b border-white/10">
                <div className="flex items-start gap-3">
                  {/* DiceBear Avatar */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.dicebear.com/7.x/personas/svg?seed=${detail.profile.avatar_seed}&backgroundColor=1a1a2e`}
                    alt={detail.profile.name}
                    className="w-14 h-14 rounded-full border-2"
                    style={{ borderColor: sentimentColor(detail.sentiment_timeline[detail.sentiment_timeline.length - 1]?.score || 0) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white text-sm truncate">{detail.profile.name}</h3>
                      {agentTypeBadge(detail.profile.agent_type)}
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">
                      {detail.profile.age} · {detail.profile.occupation}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {detail.profile.location}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-xs text-white/40">Sentiment</div>
                    <div
                      className="text-sm font-bold font-mono"
                      style={{ color: sentimentColor(detail.sentiment_timeline[detail.sentiment_timeline.length - 1]?.score || 0) }}
                    >
                      {(detail.sentiment_timeline[detail.sentiment_timeline.length - 1]?.score || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-xs text-white/40">Influence</div>
                    <div className="text-sm font-bold font-mono text-white">
                      {detail.profile.influence_score}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-xs text-white/40">Actions</div>
                    <div className="text-sm font-bold font-mono text-white">
                      {detail.actions.length}
                    </div>
                  </div>
                </div>

                {/* Persona */}
                <p className="text-xs text-white/50 mt-3 leading-relaxed italic">
                  &ldquo;{detail.profile.persona}&rdquo;
                </p>
              </div>

              {/* Section tabs */}
              <div className="flex border-b border-white/10 px-2">
                {(
                  [
                    { key: "timeline", label: "Timeline" },
                    { key: "activity", label: "Activity" },
                    { key: "connections", label: "Graph" },
                    { key: "chat", label: "Chat" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSection(tab.key)}
                    className={`px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                      activeSection === tab.key
                        ? "border-indigo-500 text-white"
                        : "border-transparent text-white/40 hover:text-white/70"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Section content */}
              <div className="flex-1 overflow-y-auto">
                {activeSection === "timeline" && (
                  <div className="p-4">
                    <h4 className="text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">
                      Opinion Timeline
                    </h4>
                    <div className="h-48 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={detail.sentiment_timeline}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis
                            dataKey="round"
                            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                          />
                          <YAxis
                            domain={[-1, 1]}
                            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(15,15,25,0.95)",
                              border: "1px solid rgba(79,70,229,0.3)",
                              borderRadius: "8px",
                              fontSize: "11px",
                              color: "white",
                            }}
                            formatter={(value) => [Number(value).toFixed(2), "Sentiment"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#4F46E5"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: "#4F46E5" }}
                          />
                          {/* Zero line */}
                          <Line
                            type="monotone"
                            dataKey={() => 0}
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth={1}
                            strokeDasharray="4 4"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Key events */}
                    <div className="space-y-2">
                      {detail.sentiment_timeline
                        .filter((t) => t.trigger_event)
                        .map((t) => (
                          <div key={t.round} className="flex gap-2 text-xs">
                            <span className="font-mono text-indigo-400 whitespace-nowrap">
                              R{t.round}
                            </span>
                            <span className="text-white/50">{t.trigger_event}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {activeSection === "activity" && (
                  <div className="p-4 space-y-2">
                    <h4 className="text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">
                      Activity Feed
                    </h4>
                    {detail.actions.map((action, i) => (
                      <div
                        key={i}
                        className="bg-white/[0.03] rounded-lg p-3 border border-white/5"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-indigo-400">
                            Round {action.round}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            action.type === "post" ? "bg-blue-500/20 text-blue-400" :
                            action.type === "comment" ? "bg-green-500/20 text-green-400" :
                            action.type === "like" ? "bg-pink-500/20 text-pink-400" :
                            action.type === "repost" ? "bg-purple-500/20 text-purple-400" :
                            action.type === "follow" ? "bg-cyan-500/20 text-cyan-400" :
                            "bg-red-500/20 text-red-400"
                          }`}>
                            {action.type}
                          </span>
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed">
                          {action.content}
                        </p>
                        {action.target_agent_id && (
                          <p className="text-[10px] text-white/30 mt-1">
                            → {action.target_agent_id}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeSection === "connections" && (
                  <div className="p-4">
                    <h4 className="text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">
                      Connections ({detail.connections.length})
                    </h4>
                    <div className="space-y-1.5">
                      {detail.connections.slice(0, 30).map((conn) => (
                        <div
                          key={conn.agent_id}
                          className="flex items-center justify-between py-1.5 px-2 rounded bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor:
                                  conn.relationship_type === "positive" ? "#3B82F6" :
                                  conn.relationship_type === "negative" ? "#EF4444" : "#6B7280",
                              }}
                            />
                            <span className="text-xs text-white/70 font-mono">
                              {conn.agent_id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/40">
                              {conn.interaction_count} interactions
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeSection === "chat" && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                      {chatHistory.length === 0 && (
                        <div className="text-center py-8">
                          <div className="text-2xl mb-2">💬</div>
                          <p className="text-xs text-white/40">
                            Talk to {detail.profile.name}
                          </p>
                          <p className="text-[10px] text-white/25 mt-1">
                            They&apos;ll respond in character based on their simulation memory
                          </p>
                        </div>
                      )}
                      {chatHistory.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                              msg.role === "user"
                                ? "bg-indigo-600 text-white"
                                : "bg-white/[0.06] text-white/80 border border-white/5"
                            }`}
                          >
                            {msg.message}
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/40 border border-white/5">
                            <span className="animate-pulse">Thinking...</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t border-white/10">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleChat()}
                          placeholder={`Ask ${detail.profile.name.split(" ")[0]} anything...`}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
                        />
                        <button
                          onClick={handleChat}
                          disabled={chatLoading || !chatInput.trim()}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 rounded-lg text-xs text-white font-medium transition-colors"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-white/30 text-sm">
              Loading agent...
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
