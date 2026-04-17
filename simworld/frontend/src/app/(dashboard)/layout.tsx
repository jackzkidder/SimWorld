"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn, apiGet } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "◈" },
  { label: "New Simulation", href: "/simulation/new", icon: "+" },
  { label: "Billing", href: "/billing", icon: "◇" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [creditLabel, setCreditLabel] = useState("Loading...");

  useEffect(() => {
    apiGet<{ data: { plan: string; credits_remaining: number } }>("/api/billing/credits")
      .then((r) => {
        const d = r.data?.data;
        if (d) {
          const plan = (d.plan || "free").charAt(0).toUpperCase() + (d.plan || "free").slice(1);
          setCreditLabel(`${plan} · ${d.credits_remaining} credit${d.credits_remaining !== 1 ? "s" : ""}`);
        } else {
          setCreditLabel("Free · 1 credit");
        }
      });
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #080c14 0%, #0a1118 40%, #0c1a12 100%)" }}
    >
      {/* Subtle grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Nav */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: "rgba(8,12,20,0.7)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shrink-0">
                <span className="font-bold text-[10px] text-white">S</span>
              </div>
              <span className="text-[14px] font-medium tracking-[-0.01em] text-white/80">
                sim<span className="font-serif italic">world</span>
              </span>
            </Link>
            <div className="hidden sm:flex items-center gap-0.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative px-3 py-1.5 rounded-md text-[13px] font-normal transition-all duration-300",
                      isActive
                        ? "text-white/90"
                        : "text-white/40 hover:text-white/70"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-md"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/billing"
              className="font-mono text-[11px] rounded-full px-3 py-1 transition-all duration-300 text-white/40 hover:text-white/60"
              style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
            >
              {creditLabel}
            </Link>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] text-primary font-medium"
              style={{ background: "rgba(39,180,120,0.12)", border: "1px solid rgba(39,180,120,0.2)" }}
            >
              U
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 max-w-[1200px] mx-auto px-8 py-8">{children}</main>
    </div>
  );
}
