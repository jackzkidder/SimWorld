"use client";

import { useEffect, useRef } from "react";

interface OrbNode {
  angle: number;
  speed: number;
  orbitRadius: number;
  size: number;
}

interface Props {
  className?: string;
  size?: number;
}

export function GlowOrb({ className = "", size = 320 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;

    // Orbiting particles
    const orbiters: OrbNode[] = Array.from({ length: 30 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() - 0.5) * 0.012 + 0.004,
      orbitRadius: 35 + Math.random() * 75,
      size: Math.random() * 2 + 0.8,
    }));

    let time = 0;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      time += 0.016;

      const mouse = mouseRef.current;
      const ox = (mouse.x - 0.5) * 10;
      const oy = (mouse.y - 0.5) * 10;

      // Outer soft halo
      const halo = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, size * 0.45);
      halo.addColorStop(0, "rgba(64,180,130,0.06)");
      halo.addColorStop(0.5, "rgba(64,180,130,0.02)");
      halo.addColorStop(1, "rgba(64,180,130,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      // Orbit rings
      for (let i = 1; i <= 3; i++) {
        const r = 30 + i * 25;
        const alpha = 0.06 + Math.sin(time * 0.4 + i) * 0.02;
        ctx.beginPath();
        ctx.arc(cx + ox * 0.4, cy + oy * 0.4, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(39,26,0,${alpha})`;
        ctx.lineWidth = 0.6;
        ctx.setLineDash([3, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Core - breathing
      const breathe = 0.85 + Math.sin(time * 0.7) * 0.1;
      const coreR = 28 * breathe;

      // Core gradient
      const core = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, coreR * 2);
      core.addColorStop(0, "rgba(64,180,130,0.2)");
      core.addColorStop(0.4, "rgba(64,180,130,0.08)");
      core.addColorStop(1, "rgba(64,180,130,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, coreR * 2, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      const inner = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, coreR);
      inner.addColorStop(0, "rgba(64,180,130,0.35)");
      inner.addColorStop(0.5, "rgba(64,180,130,0.15)");
      inner.addColorStop(1, "rgba(64,180,130,0)");
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Bright center dot
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(64,180,130,0.5)";
      ctx.fill();

      // Orbiting particles with connection lines
      for (const p of orbiters) {
        p.angle += p.speed;
        const wobble = Math.sin(time * 0.3 + p.angle * 2) * 6;
        const r = p.orbitRadius + wobble;
        const px = cx + ox * 0.2 + Math.cos(p.angle) * r;
        const py = cy + oy * 0.2 + Math.sin(p.angle) * r;

        // Connection line to center
        ctx.beginPath();
        ctx.moveTo(cx + ox * 0.3, cy + oy * 0.3);
        ctx.lineTo(px, py);
        ctx.strokeStyle = "rgba(64,180,130,0.05)";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Particle
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(64,180,130,0.25)";
        ctx.fill();
      }

      // Label nodes
      const labels = [
        { text: "MF", full: "MiroFish" },
        { text: "LM", full: "LLM" },
        { text: "KG", full: "Graph" },
        { text: "AG", full: "Agents" },
      ];
      for (let i = 0; i < labels.length; i++) {
        const a = time * (0.12 + i * 0.04) + (i * Math.PI * 2) / 4;
        const r = 90 + i * 10;
        const lx = cx + ox * 0.15 + Math.cos(a) * r;
        const ly = cy + oy * 0.15 + Math.sin(a) * r;

        // Connection to center
        ctx.beginPath();
        ctx.moveTo(cx + ox * 0.3, cy + oy * 0.3);
        ctx.lineTo(lx, ly);
        ctx.strokeStyle = "rgba(39,26,0,0.06)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Node pill
        const pillW = 34, pillH = 20, pillR = 6;
        ctx.beginPath();
        ctx.roundRect(lx - pillW / 2, ly - pillH / 2, pillW, pillH, pillR);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
        ctx.strokeStyle = "rgba(39,26,0,0.1)";
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Label text
        ctx.fillStyle = "rgba(39,26,0,0.55)";
        ctx.font = "500 9px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labels[i].text, lx, ly);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    }

    canvas.addEventListener("mousemove", onMouseMove);
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
