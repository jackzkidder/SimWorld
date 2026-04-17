"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { apiGet } from "@/lib/utils";

interface SimulationSummary {
  simulation_id: string;
  project_name: string;
  status: string;
  stage: string;
  progress: number;
  agent_count: number;
  created_at: string;
}

interface CreditData {
  plan: string;
  credits_remaining: number;
  credits_total: number;
}

// ── Animated number counter ──
function AnimatedNumber({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>();

  useEffect(() => {
    const start = display;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = (now - startTime) / (duration * 1000);
      if (elapsed >= 1) {
        setDisplay(value);
        return;
      }
      // Ease out cubic
      const t = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(Math.round(start + (value - start) * t));
      ref.current = requestAnimationFrame(tick);
    }

    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <>{display}</>;
}

// ── Stagger animation variants ──
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

export default function DashboardPage() {
  const [simulations, setSimulations] = useState<SimulationSummary[]>([]);
  const [credits, setCredits] = useState<CreditData>({ plan: "free", credits_remaining: 1, credits_total: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [simsResult, creditsResult] = await Promise.all([
        apiGet<{ data: SimulationSummary[] }>("/api/simulations/"),
        apiGet<{ data: CreditData }>("/api/billing/credits"),
      ]);

      if (simsResult.ok && simsResult.data) {
        setSimulations(simsResult.data.data || []);
      } else if (simsResult.error && simsResult.status !== 0) {
        setError(simsResult.error);
      }

      if (creditsResult.ok && creditsResult.data?.data) {
        setCredits(creditsResult.data.data);
      }

      setLoading(false);
    }
    load();
  }, []);

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-serif text-[28px] font-normal tracking-[-0.02em] text-white/90">Dashboard</h1>
          <p className="text-[13px] font-light mt-0.5 text-white/35">
            Your simulation history and quick actions
          </p>
        </div>
        <Link
          href="/simulation/new"
          className="group relative bg-primary text-white px-5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25"
        >
          <span className="relative z-10">New Simulation</span>
          <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {[
          { label: "SIMULATIONS", value: simulations.length, isNumber: true, icon: "◈" },
          { label: "CREDITS REMAINING", value: credits.credits_remaining, isNumber: true, icon: "◇" },
          { label: "PLAN", value: credits.plan, isNumber: false, capitalize: true, icon: "⬡" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="relative rounded-xl p-5 overflow-hidden group cursor-default"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Hover glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: "radial-gradient(circle at 50% 50%, rgba(39,180,120,0.06) 0%, transparent 70%)",
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-primary/50 text-[12px]">{stat.icon}</span>
                <span className="font-mono text-[11px] tracking-[0.05em] uppercase text-white/30">
                  {stat.label}
                </span>
              </div>
              <div className={`font-serif text-[32px] font-normal tracking-[-0.01em] text-white/85 ${stat.capitalize ? "capitalize" : ""}`}>
                {stat.isNumber ? (
                  <AnimatedNumber value={stat.value as number} />
                ) : (
                  String(stat.value)
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Error banner */}
      {error && (
        <motion.div
          variants={fadeUp}
          className="mb-6 px-5 py-3 rounded-xl text-[13px] font-light"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(248,113,113,0.9)" }}
        >
          Could not load simulations: {error}
        </motion.div>
      )}

      {/* Simulation list */}
      <motion.div
        variants={fadeUp}
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <h2 className="text-[14px] font-medium text-white/70">Recent Simulations</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          </div>
        ) : simulations.length === 0 ? (
          <div className="p-16 text-center">
            <div
              className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center font-serif text-[18px] text-white/25"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              S
            </div>
            <h3 className="font-serif text-[18px] font-normal mb-2 text-white/70">No simulations yet</h3>
            <p className="text-[13px] font-light mb-6 max-w-xs mx-auto text-white/35">
              Create your first simulation to see how the world would react to your scenario.
            </p>
            <Link
              href="/simulation/new"
              className="inline-block bg-primary text-white px-5 py-2.5 rounded-full text-[13px] font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              New Simulation
            </Link>
          </div>
        ) : (
          <div>
            {simulations.map((sim, i) => (
              <motion.div
                key={sim.simulation_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
              >
                <Link
                  href={`/simulation/${sim.simulation_id}`}
                  className="flex items-center justify-between px-6 py-4 group transition-all duration-300"
                  style={{
                    ...(i > 0 ? { borderTop: "1px solid rgba(255,255,255,0.04)" } : {}),
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <div>
                    <div className="text-[14px] font-normal flex items-center gap-2.5">
                      <span className="text-white/75 group-hover:text-primary transition-colors duration-300">
                        {sim.project_name}
                      </span>
                      {sim.simulation_id === "sim_demo_001" && (
                        <span
                          className="font-mono text-[10px] px-2 py-0.5 rounded-full text-primary font-medium"
                          style={{ background: "rgba(39,180,120,0.1)", border: "1px solid rgba(39,180,120,0.2)" }}
                        >
                          DEMO
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] mt-1 tracking-[-0.02em] text-white/25">
                      {sim.agent_count} agents · {new Date(sim.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {sim.status === "running" && (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${sim.progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-white/30">{sim.progress}%</span>
                      </div>
                    )}
                    <StatusBadge status={sim.status} />
                    <svg
                      className="w-4 h-4 transition-all duration-300 text-white/15 group-hover:text-white/40 group-hover:translate-x-0.5"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; border: string; color: string; dot: string }> = {
    queued:    { bg: "rgba(234,179,8,0.06)",  border: "rgba(234,179,8,0.12)",  color: "rgba(250,204,21,0.8)", dot: "rgb(250,204,21)" },
    running:   { bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.12)", color: "rgba(96,165,250,0.8)", dot: "rgb(96,165,250)" },
    completed: { bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.12)",  color: "rgba(74,222,128,0.8)", dot: "rgb(74,222,128)" },
    failed:    { bg: "rgba(239,68,68,0.06)",  border: "rgba(239,68,68,0.12)",  color: "rgba(248,113,113,0.8)", dot: "rgb(248,113,113)" },
  };
  const s = styles[status] || styles.queued;
  return (
    <span
      className="font-mono text-[11px] font-normal tracking-[-0.02em] px-2.5 py-0.5 rounded-full flex items-center gap-1.5"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: s.dot,
          boxShadow: status === "running" ? `0 0 6px ${s.dot}` : undefined,
          animation: status === "running" ? "pulse 2s ease-in-out infinite" : undefined,
        }}
      />
      {status}
    </span>
  );
}
