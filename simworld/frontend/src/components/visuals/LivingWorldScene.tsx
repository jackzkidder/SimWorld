"use client";

import { useEffect, useRef } from "react";

/*
 * Ambient agent network — fills the entire hero viewport.
 * Bright teal nodes connected by faint lines, slowly drifting.
 * Mouse interaction causes gentle ripple displacement.
 * Uses 2D Canvas for reliability across all browsers.
 */

const NODE_COUNT = 160;
const CONNECT_DIST = 120;

interface Node {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function LivingWorldScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rng = seededRandom(42);
    let w = 0, h = 0;
    const nodes: Node[] = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initNodes() {
      nodes.length = 0;
      // Distribute across full viewport with generous margins
      for (let i = 0; i < NODE_COUNT; i++) {
        const x = rng() * (w + 100) - 50;
        const y = rng() * (h + 100) - 50;
        nodes.push({
          x, y,
          baseX: x,
          baseY: y,
          vx: (rng() - 0.5) * 0.3,
          vy: (rng() - 0.5) * 0.3,
          r: 1.5 + rng() * 2,
          phase: rng() * Math.PI * 2,
        });
      }
    }

    resize();
    initNodes();

    let time = 0;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      time += 0.008;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Update positions — gentle drift + breathing
      for (const n of nodes) {
        n.x = n.baseX + Math.sin(time + n.phase) * 15 + n.vx * time * 20;
        n.y = n.baseY + Math.cos(time * 0.7 + n.phase) * 10 + n.vy * time * 20;

        // Wrap around edges
        if (n.x < -60) n.x += w + 120;
        if (n.x > w + 60) n.x -= w + 120;
        if (n.y < -60) n.y += h + 120;
        if (n.y > h + 60) n.y -= h + 120;

        // Mouse repulsion (gentle)
        const dx = n.x - mx;
        const dy = n.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150;
          n.x += (dx / dist) * force * 8;
          n.y += (dy / dist) * force * 8;
        }
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.12;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(39,180,120,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        // Outer glow
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
        grad.addColorStop(0, "rgba(39,180,120,0.15)");
        grad.addColorStop(1, "rgba(39,180,120,0)");
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(39,180,120,0.55)";
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }

    function onMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }

    function onResize() {
      resize();
      initNodes();
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseleave", onMouseLeave);
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
