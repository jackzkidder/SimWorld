"use client";

import { useEffect, useRef, ReactNode } from "react";

interface Props {
  children: ReactNode;
  speed?: number; // 0 = static, 1 = full scroll speed, negative = parallax up
  className?: string;
  fadeIn?: boolean;
  scaleFrom?: number; // e.g., 0.9 scales up from 90%
}

export function ScrollParallax({
  children,
  speed = -0.15,
  className = "",
  fadeIn = false,
  scaleFrom,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ticking = false;

    function update() {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewH = window.innerHeight;
      const center = rect.top + rect.height / 2;
      const progress = (center - viewH / 2) / viewH; // -0.5 to 0.5 when centered

      const y = progress * speed * 100;
      let transform = `translateY(${y}px)`;

      let opacity = 1;
      if (fadeIn) {
        opacity = Math.max(0, Math.min(1, 1 - Math.abs(progress) * 1.5));
      }

      if (scaleFrom !== undefined) {
        const scale = scaleFrom + (1 - scaleFrom) * (1 - Math.abs(progress));
        transform += ` scale(${Math.min(1, scale)})`;
      }

      el.style.transform = transform;
      el.style.opacity = String(opacity);
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => window.removeEventListener("scroll", onScroll);
  }, [speed, fadeIn, scaleFrom]);

  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}
