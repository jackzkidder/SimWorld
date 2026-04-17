"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  connections: number[];
  weight: number; // 0-1 importance
}

interface Props {
  className?: string;
  nodeCount?: number;
  lineColor?: string;
  nodeColor?: string;
  accentColor?: string;
}

export function ParticleNetwork({
  className = "",
  nodeCount = 45,
  lineColor = "rgba(39,26,0,0.07)",
  nodeColor = "rgba(39,26,0,0.12)",
  accentColor = "rgba(64,180,130,",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.scale(dpr, dpr);
      initNodes();
    }

    function initNodes() {
      const nodes: Node[] = [];
      const margin = 40;

      // Place nodes in a relaxed grid with jitter for organic feel
      const cols = Math.ceil(Math.sqrt(nodeCount * (w / h)));
      const rows = Math.ceil(nodeCount / cols);
      const spacingX = (w - margin * 2) / (cols - 1 || 1);
      const spacingY = (h - margin * 2) / (rows - 1 || 1);

      for (let i = 0; i < nodeCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // Offset every other row for hex-like pattern
        const hexOffset = row % 2 === 0 ? 0 : spacingX * 0.4;
        const jitterX = (Math.random() - 0.5) * spacingX * 0.6;
        const jitterY = (Math.random() - 0.5) * spacingY * 0.6;
        const x = margin + col * spacingX + hexOffset + jitterX;
        const y = margin + row * spacingY + jitterY;

        if (x > -20 && x < w + 20 && y > -20 && y < h + 20) {
          // Weight based on proximity to center - center nodes are more important
          const cx = w / 2, cy = h / 2;
          const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          const maxDist = Math.sqrt(cx ** 2 + cy ** 2);
          const weight = 1 - (distFromCenter / maxDist) * 0.7;

          nodes.push({
            x, y,
            baseX: x, baseY: y,
            vx: 0, vy: 0,
            radius: 1.5 + weight * 3,
            connections: [],
            weight,
          });
        }
      }

      // Build connections - each node connects to 2-4 nearest neighbors
      for (let i = 0; i < nodes.length; i++) {
        const distances: { idx: number; dist: number }[] = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          distances.push({ idx: j, dist: Math.sqrt(dx * dx + dy * dy) });
        }
        distances.sort((a, b) => a.dist - b.dist);
        const maxConnections = 2 + Math.floor(nodes[i].weight * 2);
        const maxDist = Math.min(spacingX, spacingY) * 2;
        for (let k = 0; k < Math.min(maxConnections, distances.length); k++) {
          if (distances[k].dist < maxDist && !nodes[i].connections.includes(distances[k].idx)) {
            nodes[i].connections.push(distances[k].idx);
          }
        }
      }

      nodesRef.current = nodes;
    }

    let time = 0;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      time += 0.005;

      const nodes = nodesRef.current;
      const mouse = mouseRef.current;
      const mouseRadius = 180;

      // Update nodes
      for (const node of nodes) {
        // Gentle breathing motion around base position
        const breathX = Math.sin(time * 2 + node.baseX * 0.01) * 3;
        const breathY = Math.cos(time * 1.5 + node.baseY * 0.01) * 3;

        // Mouse interaction - push away gently, pull connections
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let mouseForceX = 0;
        let mouseForceY = 0;
        if (dist < mouseRadius && dist > 0) {
          const force = (mouseRadius - dist) / mouseRadius;
          mouseForceX = (dx / dist) * force * 15;
          mouseForceY = (dy / dist) * force * 15;
        }

        // Spring back to base
        node.x += (node.baseX + breathX + mouseForceX - node.x) * 0.08;
        node.y += (node.baseY + breathY + mouseForceY - node.y) * 0.08;
      }

      // Draw connections
      const drawnEdges = new Set<string>();
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        for (const j of node.connections) {
          const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
          if (drawnEdges.has(key)) continue;
          drawnEdges.add(key);

          const other = nodes[j];

          // Check if mouse is near this edge
          const midX = (node.x + other.x) / 2;
          const midY = (node.y + other.y) / 2;
          const mouseDist = Math.sqrt((mouse.x - midX) ** 2 + (mouse.y - midY) ** 2);
          const isNearMouse = mouseDist < mouseRadius * 1.2;

          if (isNearMouse) {
            // Accent colored, thicker
            const proximity = 1 - mouseDist / (mouseRadius * 1.2);
            const alpha = 0.15 + proximity * 0.25;
            ctx.strokeStyle = `${accentColor}${alpha})`;
            ctx.lineWidth = 0.8 + proximity * 1.2;
          } else {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 0.6;
          }

          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isNearMouse = dist < mouseRadius;
        const proximity = isNearMouse ? 1 - dist / mouseRadius : 0;

        // Node fill
        if (isNearMouse) {
          const alpha = 0.3 + proximity * 0.5;
          ctx.fillStyle = `${accentColor}${alpha})`;

          // Glow ring
          if (proximity > 0.3) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius + 4 + proximity * 6, 0, Math.PI * 2);
            ctx.fillStyle = `${accentColor}${proximity * 0.08})`;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + proximity * 2, 0, Math.PI * 2);
          ctx.fillStyle = `${accentColor}${0.3 + proximity * 0.5})`;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fillStyle = nodeColor;
          ctx.fill();
        }
      }

      // Draw a subtle ring at mouse position
      if (mouse.x > 0 && mouse.y > 0) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `${accentColor}0.3)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, mouseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${accentColor}0.04)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 };
    }

    resize();
    draw();

    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [nodeCount, lineColor, nodeColor, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-auto ${className}`}
    />
  );
}
