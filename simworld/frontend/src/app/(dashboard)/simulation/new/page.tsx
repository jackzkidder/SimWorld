"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { apiPostForm } from "@/lib/utils";

const EXAMPLE_SCENARIOS = [
  {
    name: "Tech Product Launch",
    question: "How will the tech community react to Apple announcing a $199/month AI assistant that manages your email, calendar, and finances?",
    text: "Apple today announced 'Apple Mind', a premium AI assistant priced at $199/month that can autonomously manage your email inbox, schedule meetings, pay bills, and make investment decisions on your behalf. The service launches in September and requires full access to your Apple ID, iCloud, and connected bank accounts.",
  },
  {
    name: "Policy Change",
    question: "How will the public react to a new law requiring AI companies to open-source their training data?",
    text: "The EU Parliament passed the AI Transparency Act today, requiring all companies deploying AI systems with more than 1 million users to publicly disclose their complete training datasets within 18 months. Non-compliance carries fines of up to 6% of global revenue.",
  },
  {
    name: "Corporate Crisis",
    question: "How will consumers react to a major data breach at a popular fitness app?",
    text: "FitTrack, the fitness app with 50 million users, disclosed today that hackers accessed 3 years of health data including heart rate, sleep patterns, GPS running routes, and body measurements. The breach went undetected for 6 months. CEO issued an apology video on Twitter.",
  },
];

const audiences = [
  { value: "general_public", label: "General Public" },
  { value: "tech", label: "Tech Community" },
  { value: "finance", label: "Finance / Investors" },
  { value: "political", label: "Political / Policy" },
  { value: "academic", label: "Academic / Research" },
];

const scales = [
  { value: 50, label: "Fast", desc: "50 agents", credit: "1 credit" },
  { value: 200, label: "Standard", desc: "200 agents", credit: "4 credits" },
  { value: 1000, label: "Deep", desc: "1,000 agents", credit: "20 credits" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

function NewSimulationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [seedText, setSeedText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [projectName, setProjectName] = useState("");
  const [question, setQuestion] = useState("");

  // Pre-fill from landing page search bar
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuestion(q);
      setProjectName(q.length > 50 ? q.slice(0, 50) + "..." : q);
    }
  }, [searchParams]);
  const [audience, setAudience] = useState("general_public");
  const [geography, setGeography] = useState("US");
  const [agentCount, setAgentCount] = useState(50);
  const [platforms, setPlatforms] = useState("both");
  const [crisisMode, setCrisisMode] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) { setError("Please enter a prediction question."); return; }
    setLoading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("prediction_question", question);
      formData.append("project_name", projectName || "Untitled Simulation");
      formData.append("audience", audience);
      formData.append("geography", geography);
      formData.append("agent_count", String(agentCount));
      formData.append("platforms", platforms);
      formData.append("crisis_mode", String(crisisMode));
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
      } else if (seedText) {
        formData.append("seed_text", seedText);
      }
      const result = await apiPostForm<{ success: boolean; data?: { simulation_id: string }; error?: string; detail?: string }>("/api/simulations/create", formData);
      if (result.ok && result.data?.success && result.data?.data?.simulation_id) {
        router.push(`/simulation/${result.data.data.simulation_id}`);
      } else {
        setError(result.error || result.data?.error || result.data?.detail || "Failed to create simulation");
      }
    } catch {
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg px-3.5 py-2.5 text-[14px] font-light text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all duration-300";
  const inputStyle = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-2xl mx-auto">
      <motion.div variants={fadeUp} className="mb-10">
        <h1 className="font-serif text-[28px] font-normal tracking-[-0.02em] text-white/90">New Simulation</h1>
        <p className="text-[13px] font-light mt-0.5 text-white/35">
          Upload your scenario and configure simulation parameters
        </p>
      </motion.div>

      {/* Examples */}
      <motion.div
        variants={fadeUp}
        className="rounded-xl p-5 mb-10"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}
      >
        <div className="text-[13px] mb-3 flex items-center gap-2">
          <span className="text-primary font-medium">Try an example</span>
          <span className="font-light text-white/25">— launch in one click</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {EXAMPLE_SCENARIOS.map((ex) => (
            <motion.button
              key={ex.name}
              type="button"
              whileHover={{ y: -2 }}
              onClick={() => { setProjectName(ex.name); setQuestion(ex.question); setSeedText(ex.text); }}
              className="rounded-lg p-3.5 text-left transition-all duration-300 group"
              style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
            >
              <div className="text-[13px] font-medium text-white/70 group-hover:text-primary transition-colors duration-300">{ex.name}</div>
              <div className="text-[12px] mt-1 line-clamp-2 leading-relaxed font-light text-white/30">{ex.question}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1 */}
        <motion.section
          variants={fadeUp}
          className="rounded-xl p-6"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}
        >
          <h2 className="text-[14px] font-medium mb-5 flex items-center gap-2.5 text-white/70">
            <span className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] text-primary" style={{ background: "rgba(39,180,120,0.1)", border: "1px solid rgba(39,180,120,0.2)" }}>1</span>
            Seed Material
          </h2>
          <div className="space-y-4">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-[0.05em] mb-1.5 block text-white/30">Project Name</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Q2 Product Launch PR Test"
                className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-[0.05em] mb-1.5 block text-white/30">
                Upload Files <span className="normal-case opacity-60">(PDF, TXT, MD)</span>
              </label>
              <input type="file" multiple accept=".pdf,.txt,.md,.markdown" onChange={(e) => setFiles(e.target.files)}
                className="w-full text-[13px] font-light text-white/40 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[12px] file:font-medium file:bg-white/5 file:text-white/60 hover:file:bg-white/8 file:cursor-pointer" />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 text-[11px] font-mono text-white/20" style={{ background: "rgb(10,16,22)" }}>OR paste text</span>
              </div>
            </div>
            <textarea value={seedText} onChange={(e) => setSeedText(e.target.value)}
              placeholder="Paste your scenario text here..." rows={5}
              className={`${inputClass} resize-none`} style={inputStyle} />
          </div>
        </motion.section>

        {/* Step 2 */}
        <motion.section
          variants={fadeUp}
          className="rounded-xl p-6"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}
        >
          <h2 className="text-[14px] font-medium mb-5 flex items-center gap-2.5 text-white/70">
            <span className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] text-primary" style={{ background: "rgba(39,180,120,0.1)", border: "1px solid rgba(39,180,120,0.2)" }}>2</span>
            Configure
          </h2>
          <div className="space-y-4">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-[0.05em] mb-1.5 block text-white/30">
                What do you want to predict? <span className="text-red-400/60">*</span>
              </label>
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How will the tech community react to this announcement?" rows={2}
                className={`${inputClass} resize-none`} style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-[11px] uppercase tracking-[0.05em] mb-1.5 block text-white/30">Audience</label>
                <select value={audience} onChange={(e) => setAudience(e.target.value)}
                  className={inputClass} style={inputStyle}>
                  {audiences.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="font-mono text-[11px] uppercase tracking-[0.05em] mb-1.5 block text-white/30">Geography</label>
                <select value={geography} onChange={(e) => setGeography(e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="US">United States</option>
                  <option value="global">Global</option>
                  <option value="europe">Europe</option>
                  <option value="asia">Asia-Pacific</option>
                </select>
              </div>
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-[0.05em] mb-2.5 block text-white/30">Simulation Scale</label>
              <div className="grid grid-cols-3 gap-3">
                {scales.map((s) => (
                  <motion.button
                    key={s.value}
                    type="button"
                    whileHover={{ y: -1 }}
                    onClick={() => setAgentCount(s.value)}
                    className="rounded-lg p-3.5 text-left transition-all duration-300"
                    style={{
                      border: agentCount === s.value ? "1px solid rgba(39,180,120,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      background: agentCount === s.value ? "rgba(39,180,120,0.06)" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="text-[13px] font-medium text-white/70">{s.label}</div>
                    <div className="font-mono text-[11px] mt-0.5 text-white/30">{s.desc}</div>
                    <div className="font-mono text-[11px] mt-1 text-primary">{s.credit}</div>
                  </motion.button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-[11px] uppercase tracking-[0.05em] mb-1.5 block text-white/30">Platforms</label>
                <select value={platforms} onChange={(e) => setPlatforms(e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="both">Both (Twitter + Reddit)</option>
                  <option value="twitter">Twitter-style only</option>
                  <option value="reddit">Reddit-style only</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2.5 cursor-pointer py-2.5">
                  <div
                    className="w-4 h-4 rounded-sm flex items-center justify-center transition-all duration-300"
                    style={{ background: crisisMode ? "hsl(var(--primary))" : "rgba(255,255,255,0.06)", border: crisisMode ? "none" : "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {crisisMode && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="3 8 7 12 13 4" />
                      </svg>
                    )}
                  </div>
                  <input type="checkbox" checked={crisisMode} onChange={(e) => setCrisisMode(e.target.checked)} className="sr-only" />
                  <span className="text-[13px] font-light text-white/60">
                    Crisis mode <span className="text-white/30 text-[12px]">(adversarial)</span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </motion.section>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg px-4 py-3 text-[13px] font-light"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(248,113,113,0.9)" }}
          >
            {error}
          </motion.div>
        )}

        <motion.button
          variants={fadeUp}
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full bg-primary text-white py-3.5 rounded-full text-[14px] font-medium transition-all duration-300 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-primary/30"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Launching...
            </span>
          ) : "Launch Simulation"}
        </motion.button>
      </form>
    </motion.div>
  );
}

export default function NewSimulationPage() {
  return (
    <Suspense fallback={null}>
      <NewSimulationInner />
    </Suspense>
  );
}
