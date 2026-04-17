"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import LivingWorldScene from "@/components/visuals/LivingWorldScene";

/* ─── Data ───────────────────────────────────────────── */

const PROMPTS = [
  "Predict public reaction to our Q2 earnings announcement",
  "Simulate how users respond to the new pricing model",
  "What happens if we announce layoffs next Tuesday?",
  "Model the market impact of our competitor's acquisition",
  "How will the community react to our open-source pivot?",
];

const STEPS = [
  { n: "1", title: "Describe your scenario", desc: "Tell SimWorld what you want to know in plain language. No prompts to engineer." },
  { n: "2", title: "Agents are generated", desc: "Thousands of AI personas with unique demographics, psychology, and social connections." },
  { n: "3", title: "Simulation runs", desc: "Agents interact across rounds — debating, reacting, forming narratives in real time." },
  { n: "4", title: "Report delivered", desc: "Sentiment analysis, narrative clusters, risk assessment, and recommended actions." },
];

const USE_CASES = [
  { title: "Crisis prediction", desc: "Simulate how a crisis unfolds before it happens. Identify narrative flashpoints and prepare your response.", icon: "!" },
  { title: "Launch readiness", desc: "Test product launches, pricing changes, and announcements against simulated audiences.", icon: "R" },
  { title: "Policy impact", desc: "Model public response to regulations, policy changes, and government announcements.", icon: "P" },
  { title: "Market intelligence", desc: "Stress-test investment theses. Understand how markets react to financial events.", icon: "M" },
  { title: "Narrative mapping", desc: "Map how stories emerge and spread. Find narrative clusters, influencers, and viral pathways.", icon: "N" },
  { title: "Agent explorer", desc: "Chat with individual simulated agents. Explore their reasoning and reactions interactively.", icon: "A" },
];

const PLANS = [
  { name: "Free", price: "$0", period: "", credits: "100 credits/mo", features: ["1 simulation/month", "50 agents per run", "Basic prediction report"], cta: "Get started" },
  { name: "Pro", price: "$49", period: "/mo", credits: "2,500 credits/mo", popular: true, features: ["10 simulations/month", "200 agents per run", "Full report + PDF export", "Agent explorer", "12+ integrations", "Priority support"], cta: "Start free trial" },
  { name: "Team", price: "$199", period: "/mo", credits: "10,000 credits/mo", features: ["Unlimited simulations", "1,000 agents per run", "All Pro features", "5 seats included", "API access", "White-label reports"], cta: "Contact sales" },
];

/* ─── Typewriter ─────────────────────────────────────── */

function useTypewriter(strings: string[], typingSpeed = 35, pause = 2200) {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    const target = strings[idx];
    if (typing) {
      if (text.length < target.length) {
        const t = setTimeout(() => setText(target.slice(0, text.length + 1)), typingSpeed + Math.random() * 25);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setTyping(false), pause);
        return () => clearTimeout(t);
      }
    } else {
      if (text.length > 0) {
        const t = setTimeout(() => setText(text.slice(0, -1)), 18);
        return () => clearTimeout(t);
      } else {
        setIdx((i) => (i + 1) % strings.length);
        setTyping(true);
      }
    }
  }, [text, typing, idx, strings, typingSpeed, pause]);

  return text;
}

/* ─── Scroll reveal hook ─────────────────────────────── */

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = "1";
            (e.target as HTMLElement).style.transform = "translateY(0)";
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ─── Simulating widget ──────────────────────────────── */

function SimulatingWidget() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setStep((s) => (s + 1) % 5), 2000);
    return () => clearInterval(iv);
  }, []);

  const steps = ["Extracting entities", "Building knowledge graph", "Generating 2,400 agents", "Running simulation rounds", "Compiling report"];

  return (
    <div className="sw-card p-5 max-w-xs w-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-mono tracking-wide text-foreground/40 uppercase">Simulating</span>
      </div>
      <div className="space-y-2.5">
        {steps.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={label} className="flex items-center gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-500
                ${done ? "bg-emerald-500/15" : active ? "bg-emerald-500/10 animate-pulse" : "bg-foreground/5"}`}>
                {done && <svg viewBox="0 0 16 16" className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 8 7 12 13 4" /></svg>}
                {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </div>
              <span className={`text-[13px] transition-all duration-300 ${done ? "text-foreground/35" : active ? "text-foreground/75 font-medium" : "text-foreground/25"}`}>{label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 h-1 rounded-full bg-foreground/5 overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${((step + 1) / 5) * 100}%` }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════ */

export default function LandingPage() {
  const typed = useTypewriter(PROMPTS);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useReveal();

  function handleSimulate(text?: string) {
    const q = (text || query).trim();
    if (q) {
      router.push(`/simulation/new?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/simulation/new");
    }
  }

  return (
    <div className="min-h-screen font-sans">

      {/* ══════ HERO — dark, full-viewport ══════ */}
      <section className="relative min-h-[100dvh] flex flex-col bg-[#070b11] overflow-hidden">

        {/* Network canvas background */}
        <LivingWorldScene />

        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between px-6 md:px-10 h-16 max-w-[1400px] mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">S</span>
            </div>
            <span className="text-white/80 text-[15px] font-medium tracking-tight">SimWorld</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="#how" className="text-white/40 text-[13px] hover:text-white/60 transition hidden sm:block">How it works</Link>
            <Link href="#pricing" className="text-white/40 text-[13px] hover:text-white/60 transition hidden sm:block">Pricing</Link>
            <Link href="/sign-in" className="text-white/50 text-[13px] hover:text-white/70 transition">Sign in</Link>
            <Link href="/dashboard" className="text-[13px] px-4 py-1.5 rounded-lg bg-white text-gray-900 font-medium hover:bg-white/90 transition">
              Get started
            </Link>
          </div>
        </nav>

        {/* Hero content — centered */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="text-center max-w-2xl mx-auto">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-mono mb-8 text-white/40 border border-white/10 bg-white/[0.04]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI-powered scenario simulation
            </div>

            {/* Headline */}
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white mb-5">
              Run the future<br />before it happens
            </h1>

            <p className="text-[17px] leading-relaxed text-white/45 max-w-md mx-auto mb-10">
              Describe what you need predicted. Thousands of AI agents simulate real reactions and deliver a full report.
            </p>

            {/* Search bar — Perplexity-style, functional */}
            <div className="max-w-xl mx-auto">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSimulate(); }}
                className="relative group"
              >
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/5 to-emerald-500/20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500 blur-sm" />
                <div className="relative flex items-center gap-3 bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-4 transition-all duration-300 group-hover:border-white/15 group-hover:bg-white/[0.09] group-focus-within:border-emerald-500/30 group-focus-within:bg-white/[0.09]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-emerald-500/70 shrink-0">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder=" "
                      className="w-full bg-transparent text-[15px] text-white/80 placeholder:text-transparent outline-none"
                    />
                    {!query && !focused && (
                      <span
                        className="absolute inset-0 flex items-center text-[15px] text-white/35 truncate pointer-events-none"
                        onClick={() => inputRef.current?.focus()}
                      >
                        {typed}
                        <span className="inline-block w-[2px] h-5 bg-emerald-500/60 animate-pulse ml-0.5" />
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-medium px-5 py-2 rounded-xl transition-all shrink-0 hover:shadow-lg hover:shadow-emerald-500/20"
                  >
                    Simulate
                  </button>
                </div>
              </form>

              {/* Quick tags — clickable */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                {[
                  { label: "Product launch", q: "How will the public react to our new product launch?" },
                  { label: "PR crisis", q: "What happens if our CEO's controversial statement goes viral?" },
                  { label: "Policy change", q: "How will voters respond to the proposed healthcare reform?" },
                  { label: "M&A event", q: "How will the market react to this $10B acquisition?" },
                ].map((t) => (
                  <button
                    key={t.label}
                    onClick={() => handleSimulate(t.q)}
                    className="text-[11px] font-mono px-3 py-1 rounded-full border border-white/8 text-white/30 hover:text-white/50 hover:border-emerald-500/30 hover:bg-emerald-500/5 cursor-pointer transition"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trusted by strip */}
        <div className="relative z-10 pb-10">
          <p className="text-center text-[11px] font-mono text-white/20 tracking-wider uppercase mb-4">Trusted by forward-thinking teams</p>
          <div className="flex items-center justify-center gap-10 opacity-25">
            {["Acme Corp", "Meridian", "Helios", "Vertex AI", "Foundry"].map((name) => (
              <span key={name} className="text-white text-[13px] font-medium tracking-wide whitespace-nowrap">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ LIGHT SECTIONS ══════ */}
      <div className="bg-[#faf9f7]">

        {/* ── Stats ────────────────────────── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div data-reveal className="reveal-init grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: "50k+", label: "Agents per run" },
              { value: "< 2 min", label: "Average time" },
              { value: "12+", label: "Integrations" },
              { value: "94%", label: "Prediction accuracy" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-[32px] font-semibold tracking-tight text-foreground">{s.value}</div>
                <div className="text-[12px] text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6"><div className="h-px bg-border" /></div>

        {/* ── How it works ─────────────────── */}
        <section id="how" className="max-w-5xl mx-auto px-6 py-24">
          <div data-reveal className="reveal-init mb-14">
            <p className="text-[12px] font-mono text-emerald-600 tracking-wider uppercase mb-2">How it works</p>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-tight leading-tight text-foreground">
              From question to prediction<br />in four steps
            </h2>
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-12 items-start">
            <div className="space-y-0">
              {STEPS.map((step, i) => (
                <div key={step.n} data-reveal className="reveal-init relative pl-14 pb-10" style={{ transitionDelay: `${i * 80}ms` }}>
                  {i < STEPS.length - 1 && (
                    <div className="absolute left-[18px] top-10 bottom-0 w-px bg-border" />
                  )}
                  <div className="absolute left-0 top-0 w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center">
                    <span className="text-[13px] font-semibold text-emerald-600">{step.n}</span>
                  </div>
                  <h3 className="text-[17px] font-semibold text-foreground mb-1">{step.title}</h3>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>

            <div data-reveal className="reveal-init sticky top-24">
              <SimulatingWidget />
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6"><div className="h-px bg-border" /></div>

        {/* ── Use cases ────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <div data-reveal className="reveal-init mb-14">
            <p className="text-[12px] font-mono text-emerald-600 tracking-wider uppercase mb-2">Use cases</p>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-tight leading-tight text-foreground">
              What you can predict
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {USE_CASES.map((uc, i) => (
              <div key={uc.title} data-reveal className="reveal-init sw-card p-6 hover:border-emerald-500/20 transition-all duration-300" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="w-9 h-9 rounded-lg bg-emerald-500/8 border border-emerald-500/12 flex items-center justify-center mb-4">
                  <span className="text-emerald-600 text-[13px] font-bold">{uc.icon}</span>
                </div>
                <h3 className="text-[15px] font-semibold text-foreground mb-1.5">{uc.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6"><div className="h-px bg-border" /></div>

        {/* ── Pricing ──────────────────────── */}
        <section id="pricing" className="max-w-4xl mx-auto px-6 py-24">
          <div data-reveal className="reveal-init text-center mb-14">
            <p className="text-[12px] font-mono text-emerald-600 tracking-wider uppercase mb-2">Pricing</p>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-tight text-foreground mb-2">
              Simple, credit-based
            </h2>
            <p className="text-[15px] text-muted-foreground">Start free. Scale as you simulate more.</p>
          </div>

          <div data-reveal className="reveal-init grid md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`sw-card p-6 flex flex-col ${plan.popular ? "ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/5" : ""}`}>
                {plan.popular && <span className="text-[10px] font-mono font-semibold text-emerald-600 uppercase tracking-wider mb-2">Most popular</span>}
                <h3 className="text-[18px] font-semibold text-foreground">{plan.name}</h3>
                <div className="mt-2 mb-1">
                  <span className="text-[36px] font-semibold tracking-tight text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-[14px] text-muted-foreground">{plan.period}</span>}
                </div>
                <p className="text-[12px] font-mono text-muted-foreground mb-5">{plan.credits}</p>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-[13px] text-muted-foreground flex items-start gap-2">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 8 7 12 13 4" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard" className={`block text-center py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                  plan.popular
                    ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
                    : "border border-border text-foreground hover:bg-foreground/[0.03]"
                }`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6"><div className="h-px bg-border" /></div>

        {/* ── CTA ──────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-24 text-center">
          <div data-reveal className="reveal-init">
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-tight text-foreground mb-4">
              Stop guessing. Start predicting.
            </h2>
            <p className="text-[15px] text-muted-foreground mb-8 max-w-md mx-auto">
              SimWorld is your autonomous prediction engine. Describe what you need to know — it handles everything else.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/dashboard" className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-lg text-[14px] font-medium transition shadow-sm">
                Start for free
              </Link>
              <Link href="#how" className="border border-border text-foreground hover:bg-foreground/[0.03] px-8 py-3 rounded-lg text-[14px] font-medium transition">
                See how it works
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────── */}
        <footer className="border-t border-border px-6 py-8">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center">
                <span className="text-white text-[7px] font-bold">S</span>
              </div>
              <span className="text-[13px] text-muted-foreground">SimWorld</span>
            </div>
            <div className="flex items-center gap-6 text-[12px] text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition">Privacy</Link>
              <Link href="#" className="hover:text-foreground transition">Terms</Link>
              <Link href="#" className="hover:text-foreground transition">Docs</Link>
              <span>&copy; 2026 SimWorld</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
