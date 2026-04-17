"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const WARM = "rgb(39,26,0)";
const WARM_50 = "rgba(39,26,0,0.5)";
const WARM_08 = "rgba(39,26,0,0.08)";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (email.trim()) {
      localStorage.setItem("simworld_user", JSON.stringify({ email: email.trim(), name: name.trim() || email.split("@")[0] }));
    }
    setTimeout(() => router.push("/dashboard"), 600);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <span className="font-bold text-[11px] text-white">S</span>
          </div>
          <span className="font-sans text-[17px] font-medium tracking-[-0.01em]" style={{ color: WARM }}>
            sim<span className="font-serif italic">world</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl p-8 elevation-2" style={{ border: `0.8px solid ${WARM_08}` }}>
          <h1 className="font-serif text-[24px] font-normal mb-1 text-center" style={{ color: WARM }}>
            Create your account
          </h1>
          <p className="text-[13px] font-light text-center mb-8" style={{ color: WARM_50 }}>
            Start predicting for free
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-tight mb-1.5" style={{ color: WARM_50 }}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none transition-all focus:ring-2 focus:ring-primary/20"
                style={{ border: `0.8px solid ${WARM_08}`, color: WARM }}
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-tight mb-1.5" style={{ color: WARM_50 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none transition-all focus:ring-2 focus:ring-primary/20"
                style={{ border: `0.8px solid ${WARM_08}`, color: WARM }}
                required
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-tight mb-1.5" style={{ color: WARM_50 }}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none transition-all focus:ring-2 focus:ring-primary/20"
                style={{ border: `0.8px solid ${WARM_08}`, color: WARM }}
                defaultValue="demo"
              />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-xl text-[14px] font-medium hover:opacity-90 transition-all shadow-md shadow-primary/20 disabled:opacity-50">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : "Create Account"}
            </button>
          </form>

          <div className="mt-6 pt-5" style={{ borderTop: `0.8px solid ${WARM_08}` }}>
            <p className="text-[12px] text-center font-light" style={{ color: WARM_50 }}>
              Already have an account?{" "}
              <Link href="/sign-in" className="text-primary font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>

        <p className="text-center mt-6 text-[11px] font-mono" style={{ color: "rgba(39,26,0,0.3)" }}>
          Demo mode — enter any email to continue
        </p>
      </div>
    </div>
  );
}
