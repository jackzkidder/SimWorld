"use client";

import { useEffect } from "react";
import { warmBackend } from "@/lib/utils";

/**
 * Fires a no-op ping to /health on mount to pre-boot the Fly.io machine.
 * Because Fly scales to zero, this masks cold-start latency from the user —
 * by the time they click a button, the backend is already awake.
 */
export default function WarmClient() {
  useEffect(() => {
    warmBackend();
    // Re-warm every 4 minutes so the machine never scales down mid-session.
    const id = setInterval(warmBackend, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}
