"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiGet, apiPost } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  price: number;
  credits_per_month: number;
  max_agents: number;
  features: string[];
}

interface CreditData {
  plan: string;
  credits_used: number;
  credits_remaining: number;
  credits_total: number;
  reset_date: string;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [plansResult, creditsResult] = await Promise.all([
        apiGet<{ data: Plan[] }>("/api/billing/plans"),
        apiGet<{ data: CreditData }>("/api/billing/credits"),
      ]);
      if (plansResult.ok && plansResult.data?.data) setPlans(plansResult.data.data);
      if (creditsResult.ok && creditsResult.data?.data) setCredits(creditsResult.data.data);
      setLoading(false);
    }
    load();
  }, []);

  async function handleUpgrade(planId: string) {
    setCheckoutLoading(planId);
    try {
      const res = await apiPost<{ data: { url: string } }>("/api/billing/checkout", {
        plan: planId,
        success_url: `${window.location.origin}/billing?success=true`,
        cancel_url: `${window.location.origin}/billing`,
      });
      const url = res.data?.data?.url;
      if (!url) return;
      if (window.__TAURI__) {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(url);
      } else {
        window.location.href = url;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleManage() {
    try {
      const res = await apiPost<{ data: { url: string } }>("/api/billing/portal");
      const url = res.data?.data?.url;
      if (!url) return;
      if (window.__TAURI__) {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(url);
      } else {
        window.location.href = url;
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = credits?.plan || "free";

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-serif text-[28px] font-normal tracking-[-0.02em] text-white/90">Billing</h1>
          <p className="text-[13px] font-light mt-0.5 text-white/35">Manage your plan and simulation credits</p>
        </div>
        {currentPlan !== "free" && (
          <button
            onClick={handleManage}
            className="font-mono text-[12px] rounded-full px-4 py-2 transition-all duration-300 text-white/40 hover:text-white/60"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
          >
            Manage Subscription
          </button>
        )}
      </motion.div>

      {/* Credit Balance */}
      {credits && (
        <motion.div
          variants={fadeUp}
          className="rounded-xl p-6 mb-10"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.05em] mb-2 text-white/30">
                Credit Balance
              </div>
              <div className="font-serif text-[40px] font-normal tracking-[-0.02em] leading-none text-white/85">
                {credits.credits_remaining}
                <span className="text-[20px] font-light ml-1.5 text-white/25">
                  / {credits.credits_total}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[11px] uppercase tracking-[0.05em] mb-2 text-white/30">
                Current Plan
              </div>
              <div className="font-serif text-[22px] font-normal capitalize text-white/80">{credits.plan}</div>
            </div>
          </div>
          {credits.credits_total > 0 && (
            <div className="mt-6">
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(2, (credits.credits_remaining / credits.credits_total) * 100)}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                  style={{ boxShadow: "0 0 12px rgba(39,180,120,0.3)" }}
                />
              </div>
              <div className="font-mono text-[11px] mt-2 tracking-[-0.02em] text-white/25">
                {credits.credits_used} credits used
                {credits.reset_date && ` · Resets ${new Date(credits.reset_date).toLocaleDateString()}`}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Plans */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isPopular = plan.id === "pro";
          const isUpgrade = plan.id !== "free" && (currentPlan === "free" || (currentPlan === "pro" && plan.id === "team"));

          return (
            <motion.div
              key={plan.id}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className={`relative rounded-xl p-6 transition-all duration-500 overflow-hidden ${isPopular ? "scale-[1.02]" : ""}`}
              style={{
                background: isPopular ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                border: isPopular ? "1px solid rgba(39,180,120,0.2)" : "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(12px)",
              }}
            >
              {isPopular && (
                <>
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "radial-gradient(ellipse at 50% 0%, rgba(39,180,120,0.08) 0%, transparent 60%)",
                    }}
                  />
                  <div className="relative font-mono text-[10px] text-primary uppercase tracking-wider mb-3 font-medium">Most Popular</div>
                </>
              )}
              <div className="relative mb-5">
                <h3 className="font-serif text-[20px] font-normal text-white/80">{plan.name}</h3>
                <div className="mt-2">
                  {plan.price === 0 ? (
                    <span className="font-serif text-[32px] font-normal tracking-[-0.02em] text-white/85">Free</span>
                  ) : (
                    <>
                      <span className="font-serif text-[32px] font-normal tracking-[-0.02em] text-white/85">${(plan.price / 100).toFixed(0)}</span>
                      <span className="text-[13px] ml-1 font-light text-white/30">/mo</span>
                    </>
                  )}
                </div>
                <div className="font-mono text-[11px] mt-1.5 tracking-[-0.02em] text-white/25">
                  {plan.credits_per_month} credits/mo · up to {plan.max_agents} agents
                </div>
              </div>

              <ul className="relative space-y-2.5 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="text-[13px] flex items-center gap-2 font-light text-white/45">
                    <svg className="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 8 7 12 13 4" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div
                  className="relative text-center font-mono text-[12px] text-primary py-2.5 rounded-full"
                  style={{ border: "1px solid rgba(39,180,120,0.2)", background: "rgba(39,180,120,0.08)" }}
                >
                  Current Plan
                </div>
              ) : isUpgrade ? (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={checkoutLoading === plan.id}
                  className={`relative w-full py-2.5 rounded-full text-[13px] font-medium transition-all duration-300 disabled:opacity-50 ${
                    isPopular
                      ? "bg-primary text-white hover:shadow-lg hover:shadow-primary/25"
                      : "text-white/70 hover:text-white/90"
                  }`}
                  style={isPopular ? undefined : { border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}
                >
                  {checkoutLoading === plan.id ? "Opening..." : `Upgrade to ${plan.name}`}
                </button>
              ) : (
                <div className="h-[42px]" />
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
